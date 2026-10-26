import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Linking } from 'react-native';
import {
  isSpeechAvailable,
  launchApp,
  onSpeechError,
  onSpeechResult,
  onSpeechState,
  onVoiceNoMatch,
  showToast,
  startListening,
  stopListening,
} from '../modules/installed-apps';
import { resolveCommand } from '../resolver';
import { performDevice } from '../deviceActions';

const OWN_PKG = 'com.abdo.iftahli';

// قلب التطبيق: يستقبل الأمر (كتابة / صوت / دائرة عائمة) ← resolveCommand ← يفتح أو يسأل.
// القرار نفسه (resolveCommand) مشترك بين الشاشة والدائرة؛ هنا فقط التنفيذ وعرض النتيجة.
export function useLauncher({ apps, custom, usage, noteUse, learnFrom, ensureMic, setMessage, onOpenTool }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [choice, setChoice] = useState(null); // { phrase, candidates } فهم غير مؤكد: ننتظر اختيار المستخدم ونتعلّم منه
  const [teachPhrase, setTeachPhrase] = useState(null); // يظهر زر "علّمني" بعد أمر غير مفهوم
  const handlerRef = useRef({});
  // عدّاد جولات جوجل الفاشلة المتتالية: إعادة تلقائية واحدة عند «ما فهمتش/ما سمعتش» فقط —
  // بعد فشل جولتين نوجّه المستخدم للتعليم بدل الحلقة اللانهائية.
  const retryRef = useRef(0);

  // ===== فتح التطبيقات =====
  function offerStore(app) {
    setMessage({ kind: 'warn', body: `${app.name} غير مثبت على هذا الجهاز.` });
    Alert.alert(`${app.name} غير مثبت`, 'تحب أفتح صفحته في متجر Play؟', [
      { text: 'لا', style: 'cancel' },
      { text: 'افتح المتجر', onPress: () => Linking.openURL(`market://details?id=${app.pkg}`).catch(() => {}) },
    ]);
  }

  function openApp(app, learnPhrase) {
    let status = 'failed';
    try {
      status = launchApp(app.pkg);
    } catch (e) {
      status = 'failed';
    }
    setChoice(null);
    if (status === 'ok') {
      noteUse(app);
      const learned = learnPhrase ? learnFrom(learnPhrase, app) : null;
      setMessage({ kind: 'ok', body: learned ? `تم فتح ${app.name}. وحفظت إن "${learned}" = ${app.name}.` : `تم فتح ${app.name}` });
      setTeachPhrase(null);
    } else if (status === 'not_installed') {
      offerStore(app);
    } else {
      setMessage({ kind: 'warn', body: `ما قدرتش أفتح ${app.name}. جرّب تفتحه يدويًا أو حدّث قائمة التطبيقات.` });
    }
  }

  // ===== تنفيذ أمر (مكتوب أو مسموع) =====
  function run(command, alts) {
    Keyboard.dismiss();
    setChoice(null);
    const dec = resolveCommand(alts && alts.length ? alts : [command], { apps, custom, usage });
    switch (dec.kind) {
      case 'device':
        setText('');
        setMessage(performDevice(dec.device));
        return;
      case 'tool':
        // طلب أداة (احسب/حوّل): لا علاقة له بالتطبيقات — نفتح تبويب الأدوات
        setText('');
        if (onOpenTool) onOpenTool(dec.toolId);
        return;
      case 'last':
        setText('');
        if (!dec.app) setMessage({ kind: 'warn', body: 'ما فيه تطبيق فتحته قبل كده. افتح تطبيق الأول وهايتذكره.' });
        else openApp(dec.app);
        return;
      case 'open':
        openApp(dec.app);
        setText('');
        return;
      case 'choose':
        // أكثر من تطبيق متقارب: الأكثر استخدامًا أولًا، واختيارك يُحفظ كصيغة جديدة
        setChoice({ phrase: command, candidates: dec.candidates });
        setMessage({ kind: 'warn', body: 'تقصد أيهما؟ اضغط على التطبيق المناسب وهفتكر اختيارك.' });
        setTeachPhrase(command);
        return;
      case 'confirm':
        // فهمناه لكن بثقة منخفضة (تقريب إملائي أو كلمة زائدة): نعرض ونطلب تأكيدًا
        setChoice({ phrase: command, candidates: [dec.app] });
        setMessage({ kind: 'warn', body: `فهمت إنك تقصد ${dec.app.name}. أفتحه؟` });
        setTeachPhrase(command);
        return;
      case 'not_installed':
        offerStore(dec.app);
        return;
      default:
        setMessage({ kind: 'warn', body: 'ما فهمتش أنهي تطبيق تقصد. تقدر تعلّمني الأمر ده مرة واحدة وأفتحه بعد كده.' });
        setTeachPhrase(command);
    }
  }

  // ===== الصوت داخل التطبيق =====
  async function toggleListen() {
    if (listening) {
      stopListening();
      setListening(false);
      retryRef.current = 0; // إيقاف بشري — نصفر السلسلة
      return;
    }
    if (!(await ensureMic())) return;
    if (!isSpeechAvailable()) {
      setMessage({ kind: 'warn', body: 'خدمة التعرف على الكلام مش متاحة. تأكد إن تطبيق Google مثبّت ومحدّث.' });
      return;
    }
    setTeachPhrase(null);
    setChoice(null);
    retryRef.current = 0; // بدء يدوي جديد — سلسلة نظيفة
    setListening(true);
    setMessage({ kind: 'info', body: 'بسمعك... قل اسم التطبيق' });
    startListening();
  }

  // ===== أوامر جاءت من الدائرة العائمة: Toast بدل رسائل الشاشة (التطبيق غالبًا في الخلفية) =====
  function launchFromBubble(app) {
    let status = 'failed';
    try {
      status = launchApp(app.pkg);
    } catch (e) {}
    if (status === 'ok') {
      showToast(`تم فتح ${app.name}`);
      noteUse(app);
    } else if (status === 'not_installed') showToast(`${app.name} غير مثبت`);
    else showToast(`ما قدرتش أفتح ${app.name}`);
  }

  function runFromBubble(alts) {
    const dec = resolveCommand(alts, { apps, custom, usage });
    if (dec.kind === 'device') {
      showToast(performDevice(dec.device).body);
      return;
    }
    if (dec.kind === 'last') {
      if (dec.app) launchFromBubble(dec.app);
      else showToast('ما فيه تطبيق فتحته قبل كده');
      return;
    }
    if (dec.kind === 'open') {
      launchFromBubble(dec.app);
      return;
    }
    // غير مؤكد / غامض / غير مثبت / غير مفهوم: نُظهر "افتح لي" ليعرض الفهم ويطلب التأكيد
    try {
      launchApp(OWN_PKG);
    } catch (e) {}
    setText(alts[0]);
    run(alts[0], alts);
  }

  // ===== أحداث الكوتلن =====
  function onVoiceNoMatchHandler(e) {
    // البصمة لم تثق → جولة جوجل الاحتياطية (بلا تسجيل ذاتي متزامن).
    // مهلة 450ms قبل البدء: AudioRecord يحتاج لحظة ليفلت الميكروفون فعليًا (لا ميكروفونين أبدًا).
    retryRef.current = 0; // جولة الاحتياط = أول محاولة لجوجل، سلسلة نظيفة
    const startFallback = () => {
      if (e.source === 'bubble') {
        try {
          launchApp(OWN_PKG);
        } catch (err) {}
      }
      setListening(true);
      const nums =
        typeof e.distance === 'number' && typeof e.threshold === 'number'
          ? ` (مسافة ${e.distance.toFixed(2)} من عتبة ${e.threshold.toFixed(2)})`
          : '';
      setMessage({ kind: 'info', body: `البصمة ماعرفتهاش بقوة كفاية${nums} — بقول لجوجل.. قول الأمر تاني` });
      startListening();
    };
    setTimeout(startFallback, 450);
  }

  function onState(e) {
    if (e.source === 'app') setListening(e.state !== 'idle');
  }

  function onResult(e) {
    const alts = (e.alternatives ? e.alternatives.split('|') : [e.text]).filter(Boolean);
    if (!alts.length) return;
    retryRef.current = 0; // نجاح — نغلق سلسلة الإعادات
    if (e.source === 'bubble') {
      runFromBubble(alts);
    } else {
      setText(alts[0]);
      run(alts[0], alts);
    }
  }

  function onError(e) {
    if (e.source !== 'app') return; // أخطاء الدائرة تظهر كـ Toast من الخدمة نفسها
    setListening(false);
    // جولتا جوجل فقط (NO_MATCH=7 | SPEECH_TIMEOUT=6) تستحقان إعادة تلقائية — الشبكة والأذونات لا.
    const retryable = e.code === 7 || e.code === 6;
    if (retryable && retryRef.current < 1) {
      retryRef.current += 1;
      setListening(true);
      setMessage({ kind: 'info', body: 'ما وصلتش — قول الأمر تاني...' });
      startListening();
      return;
    }
    if (retryable) {
      // جولتان فاشلتان متتاليتان → الحلقة الصوتية مستنفدة، نوجّه للبدائل المضمونة
      retryRef.current = 0;
      setMessage({
        kind: 'warn',
        body: 'مقدرتش أفهم الأمر بصوتك. اكتبه في الخانة فوق، أو دوس مطول على التطبيق وعلّمني بصمة صوتية تقفل بيها جوجل خالص.',
      });
      return;
    }
    if (e.code === 12 || e.code === 13) {
      // جُرّبت ar-EG ثم ar-SA ثم ar تلقائيًا، فالوصول هنا يعني أن العربية غير مثبتة فعلًا
      setMessage({ kind: 'warn', body: 'حزمة اللغة العربية مش متاحة في Google على جوالك. حدّث تطبيق Google ونزّل العربية، أو استخدم البصمة الصوتية أو اكتب الأمر.' });
      Alert.alert(
        'اللغة العربية مش متاحة',
        'حدّث تطبيق Google، وبعدين من إعدادات Google ← الصوت ← التعرف على الكلام ← اللغات: نزّل العربية. وفي الأثناء تقدر تكتب الأمر أو تسجّل بصمة صوتية.',
        [
          { text: 'لاحقًا', style: 'cancel' },
          { text: 'افتح Google في المتجر', onPress: () => Linking.openURL('market://details?id=com.google.android.googlequicksearchbox').catch(() => {}) },
        ]
      );
      return;
    }
    setMessage({ kind: 'warn', body: e.message });
  }

  // نحدّث المعالجات في كل رسم حتى ترى أحدث التطبيقات والأوامر
  handlerRef.current = { onState, onResult, onError, onVoiceNoMatch: onVoiceNoMatchHandler };

  useEffect(() => {
    const subs = [
      onSpeechState((e) => handlerRef.current.onState(e)),
      onSpeechResult((e) => handlerRef.current.onResult(e)),
      onSpeechError((e) => handlerRef.current.onError(e)),
      onVoiceNoMatch((e) => handlerRef.current.onVoiceNoMatch(e)),
    ];
    return () => subs.forEach((x) => x && x.remove && x.remove());
  }, []);

  return { text, setText, listening, choice, teachPhrase, setTeachPhrase, run, openApp, toggleListen };
}
