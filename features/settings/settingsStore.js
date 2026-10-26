/**
 * مخزن إعدادات مع قيم افتراضية ودمج آمن — مكيّف من Jarvis Android.
 * يعمل مع AsyncStorage أو أي adapter يوفر getItem/setItem.
 */

const DEFAULT_SETTINGS = Object.freeze({
  language: 'ar-EG',
  voiceEnabled: true,
  wakeWordEnabled: true,
  theme: 'dark',
  historyLimit: 80,
  voiceThreshold: 0.72,
  sessionDurationMs: 8000,
});

function createSettingsStore(storage, key = '@ifta7li/settings') {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('A storage adapter with getItem/setItem is required');
  }

  return {
    async get() {
      try {
        const raw = await storage.getItem(key);
        if (!raw) return { ...DEFAULT_SETTINGS };
        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
          return { ...DEFAULT_SETTINGS };
        }
        // دمج defaults مع القيم المحفوظة حتى الإصدارات القديمة تكتسب الحقول الجديدة
        return { ...DEFAULT_SETTINGS, ...saved };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    },

    async update(patch) {
      if (!patch || typeof patch !== 'object') throw new TypeError('patch must be an object');
      const current = await this.get();
      const next = { ...current, ...patch };
      await storage.setItem(key, JSON.stringify(next));
      return next;
    },

    defaults() {
      return { ...DEFAULT_SETTINGS };
    },
  };
}

module.exports = { createSettingsStore, DEFAULT_SETTINGS };
