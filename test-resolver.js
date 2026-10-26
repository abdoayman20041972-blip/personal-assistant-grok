// اختبارات طبقة القرار (resolver): نفس القرار للشاشة والدائرة.
const { resolveCommand } = require('./resolver');
const { buildApps } = require('./appList');

let failed = 0;
const check = (name, cond) => { if (!cond) failed++; console.log(`${cond ? 'OK  ' : 'FAIL'} | ${name}`); };

const apps = buildApps([
  { name: 'WhatsApp', pkg: 'com.whatsapp' },
  { name: 'YouTube', pkg: 'com.google.android.youtube' },
  { name: 'Google Maps', pkg: 'com.google.android.apps.maps' },
  { name: 'Google Photos', pkg: 'com.google.android.apps.photos' },
]);
const usage = { counts: { 'com.google.android.youtube': 3 }, recent: ['com.google.android.youtube', 'com.whatsapp'] };
const ctx = { apps, custom: [], usage };

let r = resolveCommand(['افتح واتساب'], ctx);
check('تطبيق مؤكد → open', r.kind === 'open' && r.app.pkg === 'com.whatsapp');

r = resolveCommand(['شغل الكشاف'], ctx);
check('كشاف → device torch', r.kind === 'device' && r.device.type === 'torch' && r.device.on === true);

r = resolveCommand(['افتح الواي فاي'], ctx);
check('واي فاي → device settings (وليس آخر تطبيق)', r.kind === 'device' && r.device.type === 'settings' && r.device.target === 'wifi');

r = resolveCommand(['افتح اخر واحد'], ctx);
check('آخر واحد → last مع يوتيوب', r.kind === 'last' && r.app && r.app.pkg === 'com.google.android.youtube');

r = resolveCommand(['افتح اخر واحد'], { apps, custom: [], usage: { counts: {}, recent: [] } });
check('آخر واحد بلا سجل → last بلا تطبيق', r.kind === 'last' && r.app === null);

r = resolveCommand(['جوجل'], ctx);
check('غامض بين تطبيقات جوجل → choose أو confirm (لا open)', r.kind === 'choose' || r.kind === 'confirm');

r = resolveCommand(['افتح سبوتيفاي'], ctx);
check('معروف وغير مثبت → not_installed', r.kind === 'not_installed' && r.app.pkg === 'com.spotify.music');

r = resolveCommand(['كلام فارغ تماما'], ctx);
check('غير مفهوم → unknown', r.kind === 'unknown');

r = resolveCommand([], ctx);
check('مدخل فارغ → unknown', r.kind === 'unknown');

r = resolveCommand(['كلام فارغ', 'افتح واتساب'], ctx);
check('يأخذ أفضل صيغة من البدائل (صيغة واحدة فقط تتفق → تأكيد حسب تصويت المطابق)', (r.kind === 'open' || r.kind === 'confirm') && r.app.pkg === 'com.whatsapp');
r = resolveCommand(['افتح واتساب', 'افتح واتساب'], ctx);
check('صيغتان متفقتان → open فوري', r.kind === 'open' && r.app.pkg === 'com.whatsapp');

r = resolveCommand('افتح يوتيوب', ctx);
check('يقبل نصًا مفردًا', r.kind === 'open' && r.app.pkg === 'com.google.android.youtube');

console.log(failed ? `\nفشل ${failed}` : '\nكل اختبارات المُقرِّر نجحت');
process.exit(failed ? 1 : 0);
