import { useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid } from 'react-native';
import {
  deleteVoiceprint,
  diagnoseVoice,
  enrollVoice,
  getVoiceThreshold,
  getVoiceprints,
  setVoiceThreshold,
} from '../modules/installed-apps';
import { WakeWordMatcher } from '../features/voice/wakeWordMatcher';
import { VoiceSessionController } from '../features/voice/sessionController';

// الميكروفون + البصمة الصوتية + جلسة صوتية محسّنة
export function useVoice(setMessage) {
  const [voicePrints, setVoicePrints] = useState([]); // [{id,pkg,phrase}]
  const [voiceTh, setVoiceTh] = useState(0.72);
  const [diag, setDiag] = useState(null);
  const [voiceState, setVoiceState] = useState('idle'); // idle | listening | thinking | speaking

  const sessionRef = useRef(null);
  const wakeRef = useRef(null);

  if (!sessionRef.current) {
    sessionRef.current = new VoiceSessionController({ durationMs: 8000 });
  }
  if (!wakeRef.current) {
    wakeRef.current = new WakeWordMatcher({
      phrases: ['افتح لي', 'افتحلي', 'يا افتح لي', 'يا افتحلي', 'افتح'],
      threshold: 0.78,
    });
  }

  async function ensureMic() {
    const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'إذن الميكروفون',
      message: 'علشان أسمع الأمر الصوتي وأفتح التطبيق',
      buttonPositive: 'موافق',
      buttonNegative: 'لا',
    });
    if (g === PermissionsAndroid.RESULTS.GRANTED) return true;
    setMessage({ kind: 'warn', body: 'محتاج إذن الميكروفون علشان أسمعك. فعّله من إعدادات التطبيق.' });
    return false;
  }

  function refreshVoice() {
    getVoiceprints()
      .then((raw) => {
        try {
          setVoicePrints(JSON.parse(raw || '[]'));
        } catch (e) {}
      })
      .catch(() => {});
    try {
      setVoiceTh(getVoiceThreshold());
    } catch (e) {}
  }

  useEffect(() => {
    refreshVoice();
  }, []);

  function bumpTh(delta) {
    const v = Math.min(1.2, Math.max(0.4, Math.round((voiceTh + delta) * 100) / 100));
    setVoiceTh(v);
    try {
      setVoiceThreshold(v);
    } catch (e) {}
  }

  /** تغيير حالة الجلسة الصوتية وتحديث الواجهة */
  function setSessionState(next) {
    const snap = sessionRef.current.setState(next);
    setVoiceState(snap.state);
    return snap;
  }

  function getSessionSnapshot() {
    return sessionRef.current.snapshot();
  }

  /**
   * يفحص النص الناتج من STT: لو فيه عبارة تنبيه يرجع الباقي فقط.
   */
  function matchWakeWord(transcript) {
    return wakeRef.current.match(transcript);
  }

  /**
   * يجهّز النص للأمر: يشيل عبارة التنبيه لو موجودة ويرجع النص النظيف.
   */
  function prepareVoiceCommand(transcript) {
    const m = matchWakeWord(transcript);
    if (m.detected && m.remainder) return m.remainder;
    if (m.detected && !m.remainder) return '';
    return String(transcript || '').trim();
  }

  async function doDiagnose() {
    if (!voicePrints.length) {
      setMessage({ kind: 'warn', body: 'سجّل بصمة الأول: دوس مطولًا على أي تطبيق في القايمة.' });
      return;
    }
    if (!(await ensureMic())) return;
    setSessionState('listening');
    setMessage({ kind: 'info', body: 'اتكلم دلوقتي — قل اسم التطبيق اللي سجلته مثل ما بتقوله للدائرة...' });
    try {
      const raw = await diagnoseVoice();
      const d = JSON.parse(raw || '{}');
      setSessionState('idle');
      if (!d.ok) {
        const msg =
          d.error === 'busy'
            ? 'فيه عملية سمع شغالة، استنى لحظة وجرّب تاني.'
            : d.error === 'noisy'
              ? 'ما سمعتش صوت واضح — قرّب من الميكروفون وجرّب تاني.'
              : d.error === 'too_short'
                ? 'الكلام طلع قصير أوي — مطّل الكلام شوية.'
                : 'التشخيص ما نجحش، جرّب تاني.';
        setMessage({ kind: 'warn', body: msg });
        return;
      }
      setDiag(d);
      setMessage({
        kind: d.matched ? 'ok' : 'warn',
        body: d.matched
          ? `تمام — البصمة مطابقة («${d.bestPhrase}»). العتبة الحالية ${d.threshold}.`
          : `ما تطابقتش كويس. أقرب عبارة: «${d.bestPhrase}» (المسافة ${Number(d.bestD).toFixed(3)} / العتبة ${d.threshold}). جرّب ترفع العتبة أو تعيد التسجيل.`,
      });
    } catch (e) {
      setSessionState('idle');
      setMessage({ kind: 'warn', body: 'التشخيص ما نجحش. جرّب تاني.' });
    }
  }

  async function doEnroll(app) {
    if (!(await ensureMic())) return;
    setSessionState('listening');
    setMessage({ kind: 'info', body: `هسجل صوتك: قل «${app.name}» 3 مرات بهدوء وبنفس النطق...` });
    try {
      const st = await enrollVoice(app.pkg, app.name);
      setSessionState('idle');
      if (st === 'ok') {
        refreshVoice();
        setMessage({
          kind: 'ok',
          body: `تم تسجيل بصمة ${app.name}. جرّبها من الدائرة، ولو مفتحتش أو فتحت تطبيق غلط افتح الإعدادات ← «اختبر بصمتك» واضبط العتبة.`,
        });
      } else if (st === 'busy') {
        setMessage({ kind: 'warn', body: 'فيه عملية سمع شغالة دلوقتي. استنى لحظة وجرب تاني.' });
      } else if (st === 'too_short') {
        setMessage({ kind: 'warn', body: 'الكلام طلع قصير أوي. جرب تاني وانت مطول شوية.' });
      } else if (st === 'inconsistent') {
        setMessage({ kind: 'warn', body: 'العينات الثلاثة مختلفة عن بعض. جرب تاني وبنفس النطق بالظبط.' });
      } else {
        setMessage({ kind: 'warn', body: 'ما قدرتش أسجل الصوت. اتأكد من الهدوء حواليك وجرب تاني.' });
      }
    } catch (e) {
      setSessionState('idle');
      setMessage({ kind: 'warn', body: 'ما قدرتش أسجل الصوت.' });
    }
  }

  function doDeleteVoice(app) {
    Alert.alert('حذف البصمة', `تمسح بصمة ${app.name}؟ هترجع تستخدم الإنترنت/جوجل معاها.`, [
      { text: 'لا', style: 'cancel' },
      {
        text: 'احذف',
        style: 'destructive',
        onPress: () => {
          deleteVoiceprint(app.pkg)
            .then(refreshVoice)
            .catch(() => {});
          setMessage({ kind: 'info', body: `تم حذف بصمة ${app.name}.` });
        },
      },
    ]);
  }

  function voiceMenu(app) {
    const has = voicePrints.some((v) => v.pkg === app.pkg);
    const buttons = [{ text: 'إلغاء', style: 'cancel' }];
    if (has) {
      buttons.push({ text: 'إعادة التسجيل', onPress: () => doEnroll(app) });
      buttons.push({ text: 'حذف البصمة', style: 'destructive', onPress: () => doDeleteVoice(app) });
    } else {
      buttons.push({ text: 'سجّل بصمة', onPress: () => doEnroll(app) });
    }
    Alert.alert(
      'البصمة الصوتية (أوفلاين)',
      has
        ? `عندك بصمة لـ ${app.name}. قول اسمها من الدائرة في أي وقت وهي تفتح بلا إنترنت.`
        : `هسجل صوتك وانت بتقول «${app.name}» 3 مرات. بعد كده قول اسمها من الدائرة بلا إنترنت خالص.`,
      buttons
    );
  }

  return {
    voicePrints,
    voiceTh,
    diag,
    voiceState,
    ensureMic,
    bumpTh,
    doDiagnose,
    doEnroll,
    doDeleteVoice,
    voiceMenu,
    setSessionState,
    getSessionSnapshot,
    matchWakeWord,
    prepareVoiceCommand,
  };
}
