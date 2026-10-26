/**
 * مطابقة عبارة تنبيه بعد تحويل الصوت إلى نص (STT).
 * لا يلتقط الميكروفون بنفسه — يعمل على النص الناتج فقط.
 * مكيّف من Freya لمشروع «افتح لي».
 */

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return row[b.length];
}

function similarity(a, b) {
  if (!a && !b) return 1;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length, 1);
}

class WakeWordMatcher {
  /**
   * @param {{ phrases?: string[], threshold?: number }} options
   */
  constructor({ phrases = ['افتح لي', 'افتحلي', 'يا افتح لي', 'يا افتحلي'], threshold = 0.78 } = {}) {
    this.phrases = phrases.map(normalize).filter(Boolean);
    this.threshold = Math.max(0.5, Math.min(1, Number(threshold) || 0.78));
    if (!this.phrases.length) throw new TypeError('At least one wake phrase is required');
  }

  /**
   * @param {string} transcript
   * @returns {{ detected: boolean, remainder: string, phrase: string|null, score: number }}
   */
  match(transcript) {
    const text = normalize(transcript);
    if (!text) return { detected: false, remainder: '', phrase: null, score: 0 };
    const words = text.split(' ');
    let best = { detected: false, remainder: '', phrase: null, score: 0, startIndex: -1, endIndex: -1 };

    for (const phrase of this.phrases) {
      const targetWords = phrase.split(' ');
      const minLength = Math.max(1, targetWords.length - 1);
      const maxLength = Math.min(words.length, targetWords.length + 2);
      for (let start = 0; start < words.length; start += 1) {
        for (let length = minLength; length <= maxLength && start + length <= words.length; length += 1) {
          const candidate = words.slice(start, start + length).join(' ');
          const score = similarity(candidate, phrase);
          if (score > best.score) {
            best = {
              detected: score >= this.threshold,
              remainder: words.slice(start + length).join(' '),
              phrase,
              score,
              startIndex: start,
              endIndex: start + length,
            };
          }
        }
      }
    }
    return best;
  }
}

module.exports = { WakeWordMatcher, normalize };
