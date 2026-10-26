import { useCallback, useEffect, useState } from 'react';
import { getLaunchableApps } from '../modules/installed-apps';
import { buildApps } from '../appList';

// قائمة التطبيقات المثبتة فعليًا على الجوال
export function useApps(setMessage) {
  const [apps, setApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);

  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const installed = await getLaunchableApps();
      setApps(buildApps(installed));
    } catch (e) {
      setMessage({ kind: 'warn', body: 'ما قدرتش أقرأ قائمة التطبيقات من الجوال. تأكد إنك ثبّتت النسخة الكاملة (APK) مش Expo Go.' });
    } finally {
      setLoadingApps(false);
    }
  }, [setMessage]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  return { apps, loadingApps, loadApps };
}
