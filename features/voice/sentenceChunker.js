/**
 * تقسيم الرد إلى مقاطع مناسبة للنطق + تنظيف بسيط لـ Markdown.
 * مكيّف من Freya — جاهز عند إضافة TTS لاحقًا.
 */

function stripMarkdownLight(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text
 * @param {{ maxLen?: number }} options
 * @returns {string[]}
 */
function chunkSentences(text, { maxLen = 180 } = {}) {
  const clean = stripMarkdownLight(text);
  if (!clean) return [];
  // تقسيم تقريبي على علامات الوقف العربية والإنجليزية
  const parts = clean.split(/(?<=[.!?؟。])\s+/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  for (const part of parts) {
    if (!buf) {
      buf = part;
      continue;
    }
    if ((buf + ' ' + part).length <= maxLen) {
      buf = buf + ' ' + part;
    } else {
      chunks.push(buf);
      buf = part;
    }
  }
  if (buf) chunks.push(buf);
  // لو جملة واحدة طويلة جدًا نقطعها عند المسافات
  return chunks.flatMap((c) => {
    if (c.length <= maxLen) return [c];
    const words = c.split(' ');
    const out = [];
    let cur = '';
    for (const w of words) {
      if (!cur) cur = w;
      else if ((cur + ' ' + w).length <= maxLen) cur += ' ' + w;
      else {
        out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
    return out;
  });
}

module.exports = { chunkSentences, stripMarkdownLight };
