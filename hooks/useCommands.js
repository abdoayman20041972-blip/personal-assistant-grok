import { useEffect, useState } from 'react';
import { Alert, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUsage, saveCommands } from '../modules/installed-apps';
import { tokens, understand } from '../matcher';
import {
  addAlias,
  exportJson,
  mergeImport,
  mergeUsage,
  parseImport,
  recordUse,
  removeAlias,
  removeApp,
  sanitizeCommands,
  sanitizeUsage,
} from '../commandStore';

const OLD_STORE_KEY = 'ifta7li.customCommands.v1'; // الشكل القديم: سجل لكل جملة (نقرؤه ونرحّله، ولا نمسحه)
const STORE_KEY = 'ifta7li.customCommands.v2'; // الشكل الجديد: التطبيق ← قائمة صيغ
const USAGE_KEY = 'ifta7li.usage.v1';

// نرسل الأوامر لمرآة الكوتلن (Prefs) — بدونها الدائرة العائمة لا ترى الأوامر المخصصة
function pushCommands(list) {
  try {
    saveCommands(JSON.stringify(list));
  } catch (e) {}
}

// الأوامر المخصصة + عدّادات الاستخدام + نموذج «أمر جديد» + النسخ الاحتياطي
export function useCommands(apps, setMessage) {
  const [custom, setCustom] = useState([]);
  const [usage, setUsage] = useState({ counts: {}, recent: [] });

  // نموذج إضافة أمر جديد
  const [newPhrase, setNewPhrase] = useState('');
  const [pickSearch, setPickSearch] = useState('');
  const [picked, setPicked] = useState(null);

  // نسخة احتياطية
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) {
          const parsed = sanitizeCommands(JSON.parse(raw));
          setCustom(parsed);
          pushCommands(parsed);
        } else {
          // ترحيل تلقائي من الشكل القديم دون فقد أي أمر (والمفتاح القديم يبقى كما هو)
          const old = await AsyncStorage.getItem(OLD_STORE_KEY);
          if (old) {
            const migrated = sanitizeCommands(JSON.parse(old));
            setCustom(migrated);
            await AsyncStorage.setItem(STORE_KEY, JSON.stringify(migrated));
            pushCommands(migrated);
          }
        }
      } catch (e) {}
      try {
        const u = await AsyncStorage.getItem(USAGE_KEY);
        let local = u ? sanitizeUsage(JSON.parse(u)) : { counts: {}, recent: [] };
        // ندمج مرآة الكوتلن (عدّادات فتح الدائرة وضغطة الضغط الطويل) مع استخدام التطبيق:
        // كل فتحة تُحسب في جهة واحدة، فالأكبر لكل عدّاد هو الصحيح.
        try {
          const nu = await getUsage();
          if (nu) {
            const merged = mergeUsage(local, JSON.parse(nu));
            local = merged;
            await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(merged));
          }
        } catch (e) {}
        setUsage(local);
      } catch (e) {}
    })();
  }, []);

  async function saveCustom(next) {
    setCustom(next);
    try {
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
      pushCommands(next);
    } catch (e) {
      setMessage({ kind: 'warn', body: 'ما قدرتش أحفظ الأمر على الجوال.' });
    }
  }

  // نسجّل كل فتح ناجح: عدّاد لكل تطبيق + آخر 10
  function noteUse(app) {
    const next = recordUse(usage, app.pkg);
    setUsage(next);
    AsyncStorage.setItem(USAGE_KEY, JSON.stringify(next)).catch(() => {});
  }

  // نتعلّم الصيغة التي قالها المستخدم لو اختار التطبيق بنفسه (إلا لو كان التطبيق يفهمها أصلًا)
  function learnFrom(phrase, app) {
    const clean = tokens(phrase || '').join(' ');
    if (!clean) return null;
    const known = understand(clean, apps, custom);
    if (known && known.confident && known.app.pkg === app.pkg) return null;
    const r = addAlias(custom, app, clean);
    if (!r.added) return null;
    saveCustom(r.list);
    return clean;
  }

  // يملأ نموذج «أمر جديد» بجملة (من «علّمني») أو يفرغه
  function prefillForm(phrase) {
    setNewPhrase(phrase ? tokens(phrase).join(' ') : '');
    setPicked(null);
    setPickSearch('');
  }

  function addCommand(onAdded) {
    const phrase = newPhrase.trim();
    if (!tokens(phrase).length) {
      Alert.alert('الأمر فاضي', 'اكتب كلمة أو جملة غير "افتح" و"شغل" وما شابه، مثل: مزرعتي.');
      return;
    }
    if (!picked) {
      Alert.alert('اختر التطبيق', 'اختر التطبيق اللي عايز الأمر ده يفتحه من القائمة تحت.');
      return;
    }
    const added = addAlias(custom, picked, phrase);
    if (!added.added) {
      Alert.alert('الصيغة موجودة', `الصيغة دي محفوظة بالفعل لـ ${picked.name}.`);
      return;
    }
    saveCustom(added.list);
    setNewPhrase('');
    setPicked(null);
    setPickSearch('');
    if (onAdded) onAdded();
    setMessage({ kind: 'ok', body: `تم. لما تقول "${phrase}" هفتح ${picked.name}.` });
  }

  function removeOneAlias(entry, phrase) {
    Alert.alert('حذف الصيغة', `تحذف الصيغة "${phrase}" من ${entry.name}؟`, [
      { text: 'لا', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => saveCustom(removeAlias(custom, entry.pkg, phrase)) },
    ]);
  }

  function removeWholeApp(entry) {
    Alert.alert('حذف كل الصيغ', `تحذف كل صيغ ${entry.name} (${entry.aliases.length})؟`, [
      { text: 'لا', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => saveCustom(removeApp(custom, entry.pkg)) },
    ]);
  }

  async function exportCommands() {
    if (!custom.length) {
      Alert.alert('مفيش أوامر', 'لسه ما أضفتش أوامر علشان تصدّرها.');
      return;
    }
    try {
      await Share.share({ message: exportJson(custom) });
    } catch (e) {
      setMessage({ kind: 'warn', body: 'ما قدرتش أفتح نافذة المشاركة.' });
    }
  }

  function importCommands() {
    const parsed = parseImport(importText);
    if (!parsed.ok) {
      Alert.alert('ما قدرتش أستورد', parsed.error);
      return;
    }
    const merged = mergeImport(custom, parsed.commands);
    saveCustom(merged.list);
    setImportText('');
    setShowImport(false);
    setMessage({
      kind: 'ok',
      body: `تم الاستيراد: ${merged.added} صيغة جديدة${merged.skipped ? `، وتخطيت ${merged.skipped} متعارضة مع أوامرك الحالية` : ''}.`,
    });
  }

  return {
    custom,
    usage,
    noteUse,
    learnFrom,
    newPhrase,
    setNewPhrase,
    pickSearch,
    setPickSearch,
    picked,
    setPicked,
    prefillForm,
    addCommand,
    removeOneAlias,
    removeWholeApp,
    showImport,
    setShowImport,
    importText,
    setImportText,
    exportCommands,
    importCommands,
  };
}
