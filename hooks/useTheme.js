import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK, LIGHT, makeStyles } from '../theme';

const THEME_KEY = 'ifta7li.theme.v1';

// المظهر: تلقائي (حسب الجوال) | فاتح | داكن — يُحفظ بين مرات التشغيل
export function useTheme() {
  const scheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('auto');
  const isDark = themeMode === 'auto' ? scheme === 'dark' : themeMode === 'dark';
  const c = isDark ? DARK : LIGHT;
  const s = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((v) => v && ['auto', 'light', 'dark'].includes(v) && setThemeMode(v))
      .catch(() => {});
  }, []);

  function changeTheme(k) {
    setThemeMode(k);
    AsyncStorage.setItem(THEME_KEY, k).catch(() => {});
  }

  return { c, s, isDark, themeMode, changeTheme };
}
