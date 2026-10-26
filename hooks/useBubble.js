import { useEffect, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import {
  canDrawOverlays,
  isBubbleEnabled,
  isBubbleRunning,
  onBubbleState,
  openOverlaySettings,
  startBubble,
  stopBubble,
} from '../modules/installed-apps';

// الدائرة العائمة: تشغيل/إيقاف + مزامنة حالتها مع الخدمة الأصلية
export function useBubble(ensureMic, setMessage) {
  const [bubbleOn, setBubbleOn] = useState(false);

  useEffect(() => {
    // حالة الدائرة تأتي كحدث من الخدمة نفسها (بدء/إيقاف/قتل) — لا استطلاع كل ثانيتين
    const sub = onBubbleState((e) => setBubbleOn(!!e.running));
    const sync = () => {
      try {
        const running = isBubbleRunning();
        setBubbleOn(running);
        // كانت مفعّلة ثم قتلها النظام أو الإقلاع (أندرويد 12+ يمنع إعادتها من الخلفية):
        // والتطبيق الآن ظاهر فيُسمح لنا بإعادة تشغيلها. الإيقاف المتعمد يمسح علامة التفعيل فلا تعود.
        if (!running && isBubbleEnabled() && canDrawOverlays() && startBubble() === 'ok') setBubbleOn(true);
      } catch (e) {}
    };
    sync();
    // احتياط: لو فاتنا حدث بينما كان JS متوقفًا، نزامن عند العودة للتطبيق
    const appSub = AppState.addEventListener('change', (st) => st === 'active' && sync());
    return () => {
      sub && sub.remove && sub.remove();
      appSub && appSub.remove && appSub.remove();
    };
  }, []);

  async function toggleBubble() {
    if (bubbleOn) {
      stopBubble();
      setBubbleOn(false);
      return;
    }
    if (!(await ensureMic())) return;
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
      } catch (e) {}
    }
    if (!canDrawOverlays()) {
      Alert.alert(
        'إذن الظهور فوق التطبيقات',
        'لازم تسمح لـ "افتح لي" بالظهور فوق التطبيقات الأخرى. هتفتح لك شاشة الإعدادات: فعّل الإذن ثم ارجع واضغط "تشغيل الدائرة العائمة" تاني.',
        [
          { text: 'لا', style: 'cancel' },
          { text: 'فتح الإعدادات', onPress: () => openOverlaySettings() },
        ]
      );
      return;
    }
    const st = startBubble();
    if (st === 'ok') {
      setBubbleOn(true);
      setMessage({ kind: 'ok', body: 'الدائرة شغالة. اضغطها من أي تطبيق وقل الأمر.' });
    } else {
      setMessage({ kind: 'warn', body: 'ما قدرتش أشغّل الدائرة. تأكد من الأذونات وجرّب تاني.' });
    }
  }

  return { bubbleOn, toggleBubble };
}
