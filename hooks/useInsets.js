import { useCallback, useEffect, useState } from 'react';
import { AppState, Dimensions } from 'react-native';
import { getInsets } from '../modules/installed-apps';

// هامش أسفل الشاشة الفعلي (أزرار/شريط التنقل) بلا مكتبات إضافية — يقيسه الجزء الأصلي.
// قبل القياس (أو لو فشل) نستخدم هامشًا افتراضيًا آمنًا.
export function useInsets() {
  const [bottom, setBottom] = useState(16);

  const measure = useCallback(() => {
    getInsets()
      .then((v) => {
        if (Array.isArray(v) && typeof v[1] === 'number') setBottom(Math.max(0, Math.round(v[1])));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    measure();
    const d = Dimensions.addEventListener('change', measure);
    const a = AppState.addEventListener('change', (st) => st === 'active' && measure());
    return () => {
      d && d.remove && d.remove();
      a && a.remove && a.remove();
    };
  }, [measure]);

  return { bottom };
}
