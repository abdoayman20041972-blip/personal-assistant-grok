// مُقرِّر الأوامر (طبقة القرار): يحوّل صيغ الكلام المحتملة إلى «قرار» واحد واضح،
// بلا أي واجهة وبلا أي استدعاء أصلي — فيُختبر بـ node وتشترك فيه الشاشة والدائرة العائمة.
//
// لماذا؟ كان منطق القرار (جهاز؟ تطبيق مؤكد؟ غامض؟ تقريبي؟ غير مثبت؟) مكتوبًا مرتين:
// في run() للشاشة وفي runFromBubble() للدائرة، وهذا التكرار هو ما سبّب خطأ «افتح الواي فاي
// تفتح آخر تطبيق». الآن مصدر القرار واحد، والمنفّذ (واجهة/Toast) هو الذي يختلف فقط.
//
// يرجع واحدًا من:
//   { kind: 'device', device }                         torch | settings
//   { kind: 'last', app|null }                         «افتح آخر واحد»
//   { kind: 'open', app }                              فهم مؤكد — افتح فورًا
//   { kind: 'choose', phrase, candidates }             غامض بين عدة تطبيقات
//   { kind: 'confirm', phrase, app }                   فهم بثقة منخفضة — اطلب تأكيدًا
//   { kind: 'not_installed', app }                     معروف لكنه غير مثبت
//   { kind: 'tool', toolId }                           طلب أداة (احسب…/حوّل…) — يُفتح في تبويب الأدوات
//   { kind: 'unknown', phrase }                        لم نفهم
const KNOWN = require('./apps');
const { matchDeviceCommand } = require('./deviceCommands');
const { understandBest } = require('./matcher');
const { sortByUsage } = require('./commandStore');
const { routeTool } = require('./features/tools/router');

const MAX_CHOICES = 4;

function resolveCommand(alts, { apps = [], custom = [], usage = { counts: {}, recent: [] }, known = KNOWN } = {}) {
  const list = (Array.isArray(alts) ? alts : [alts]).filter((x) => typeof x === 'string' && x.trim());
  const phrase = list[0] || '';
  if (!list.length) return { kind: 'unknown', phrase };

  // أوامر الجهاز أولًا (قاموس مغلق، لا تُصطاد بأسماء التطبيقات)
  const device = list.map((t) => matchDeviceCommand(t)).find(Boolean);
  if (device) {
    if (device.type === 'last') {
      const pkg = usage && usage.recent && usage.recent[0];
      return { kind: 'last', app: (pkg && apps.find((a) => a.pkg === pkg)) || null };
    }
    return { kind: 'device', device };
  }

  const result = understandBest(list, apps, custom);

  // الأدوات: فقط لجملة تبدأ بفعل حساب/تحويل صريح، وبعد أوامر الجهاز. والأوامر المخصصة للمستخدم لها الأولوية
  // (لو سمّى أحدهم صيغة «احسب كذا» لتطبيق فلا نعترضها).
  if (!(result && result.custom && result.confident)) {
    const tool = list.map((t) => routeTool(t)).find(Boolean);
    if (tool) return { kind: 'tool', toolId: tool.toolId };
  }

  if (result && result.confident) return { kind: 'open', app: result.app };
  if (result && result.ambiguous) {
    const candidates = sortByUsage([result.app, ...result.others], usage).slice(0, MAX_CHOICES);
    return { kind: 'choose', phrase, candidates };
  }
  if (result) return { kind: 'confirm', phrase, app: result.app };

  const k = understandBest(list, known, []);
  if (k && k.confident) return { kind: 'not_installed', app: k.app };
  return { kind: 'unknown', phrase };
}

module.exports = { resolveCommand };
