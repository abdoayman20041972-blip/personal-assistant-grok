// موجّه الأدوات: يقرّر هل الجملة «طلب أداة» (احسب الخصم، حوّل الوحدات) أم أمر تطبيق.
// قاعدة الأمان الوحيدة: لا نوجّه إلى أداة إلا إذا بدأت الجملة بفعل حساب/تحويل صريح
// (احسب… / حوّل…) وذُكرت بعده كلمة مفتاحية لأداة معروفة. أي جملة تبدأ بغير ذلك
// (افتح واتساب، الكشاف، اسم تطبيق مجرد…) ترجع null فتبقى لنظام المطابقة الحالي دون أي تغيير.
// JS صِرف بلا واجهة — يُختبر بـ node.
const { normalize } = require('../../matcher');
const { tools } = require('./tools');

const norm = (s) => normalize(s);
// أفعال البدء (بعد التطبيع: ة→ه، همزات→ا) مع لواحق الضمير الشائعة
const CALC_STEMS = ['احسب', 'حاسب', 'حول'];
const SUFFIXES = new Set(['', 'ي', 'لي', 'لنا', 'ها', 'ه', 'ني']);
const isCalcVerb = (t) => CALC_STEMS.some((s) => t.startsWith(s) && SUFFIXES.has(t.slice(s.length)));

// كلمات مفتاحية إضافية بجانب keywords في tools.js (مُطبَّعة)
const EXTRA = {
  discount: ['خصم', 'تخفيض', 'نسبه', 'نسبة', 'سعر'],
  'room-area': ['غرفه', 'مساحه', 'ارضيه', 'محيط'],
  'unit-converter': ['وحدات', 'وحده', 'تحويل'],
  age: ['عمر', 'عمري', 'ميلاد', 'سن'],
  'text-tools': ['كلمات', 'حروف', 'نص'],
  scientific: ['مولاريه', 'كثافه', 'ph', 'حموضه'],
  fuel: ['بنزين', 'وقود', 'رحله', 'تكلفه'],
};
const INDEX = tools.map((t) => ({ id: t.id, words: new Set([...(EXTRA[t.id] || []), ...t.keywords.filter((k) => !/\s/.test(k))].map(norm)) }));

// يرجع { toolId } أو null. لا يحاول فهم الأرقام: الإدخال من شاشة الأدوات.
function routeTool(text) {
  const toks = norm(text).split(' ').filter(Boolean);
  if (toks.length < 2 || toks.length > 8 || !isCalcVerb(toks[0])) return null;
  const rest = toks.slice(1).map((t) => (t.length > 3 && t.startsWith('ال') ? t.slice(2) : t));
  const hits = INDEX.filter((e) => rest.some((t) => e.words.has(t)));
  if (hits.length === 1) return { toolId: hits[0].id };
  // «حوّل» وحدها مع كلمة غير مفتاحية = تحويل وحدات؛ الغموض بين أداتين أو أكثر = لا توجيه
  return null;
}

module.exports = { routeTool };
