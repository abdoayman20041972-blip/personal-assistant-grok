// اختبارات الأدوات + التوجيه + عدم تعارضها مع أوامر التطبيقات (تشغيل: node test-tools.js)
const { tools, categories } = require('./features/tools/tools');
const { getToolFields, calculateTool: calc } = require('./features/tools/tool-engine');
const { routeTool } = require('./features/tools/router');
const { resolveCommand } = require('./resolver');
const { buildApps } = require('./appList');
const KNOWN = require('./apps');

let failed = 0;
const check = (name, cond) => { if (!cond) failed++; console.log(`${cond ? 'OK  ' : 'FAIL'} | ${name}`); };
const v = (id, vals, i = 0) => calc(id, vals)[i];

// ===== الحزمة الأصلية =====
check('8 أدوات وتصنيف العلوم', tools.length === 8 && categories.includes('العلوم'));
check('كل أداة لها حقول', tools.every((t) => getToolFields(t.id).length > 0));
check('خصم 20٪ من 1000', v('discount', { amount: '1000', rate: '20' }).value === '800.00' && v('discount', { amount: '1000', rate: '20' }, 1).value === '200.00');
check('خصم > 100٪ مرفوض', v('discount', { amount: '10', rate: '101' }).tone === 'danger');
check('مساحة 4×3', v('room-area', { length: '4', width: '3' }).value === '12.00 م²');
check('kg→lb', v('unit-converter', { value: '1', unit: 'kg', target: 'lb' }).value === '2.205');
check('تاريخ 31/02 مرفوض', v('age', { birthDate: '31/02/2000', asOfDate: '01/01/2020' }).tone === 'danger');
check('وقود 100كم', v('fuel', { distance: '100', consumption: '5', fuelPrice: '20', passengers: '2' }, 1).value === '100.00');
check('عدّ النص', v('text-tools', { text: 'one two\nthree', operation: 'count' }).value === '3');
check('مولارية', v('scientific', { operation: 'molarity', a: '1', b: '2' }).value === '0.5000 mol/L');
check('عشوائي min=max', v('random', { min: '5', max: '5' }).value === '5');

// ===== إصلاحات هذا الدمج (كل واحد كان خطأً/ثغرة) =====
check('أرقام عربية ٢٠٠ و٢٥', v('discount', { amount: '٢٠٠', rate: '٢٥' }).value === '150.00');
check('فاصلة عشرية عربية ٣٫٥', v('room-area', { length: '٣٫٥', width: '2' }).value === '7.00 م²');
check('فاصل آلاف 1,000,000 لا يُقرأ 1', v('discount', { amount: '1,000,000', rate: '10' }).tone === 'danger');
check('0x10 و1e3 و Infinity مرفوضة', ['0x10', '1e3', 'Infinity', 'abc', ''].every((x) => v('discount', { amount: x, rate: '10' }).tone === 'danger'));
check('وحدات عربية كجم→رطل', v('unit-converter', { value: '1', unit: 'كجم', target: 'رطل' }).value === '2.205');
check('°C→°F', v('unit-converter', { value: '100', unit: '°C', target: '°F' }).value === '212.000');
check('أقل من الصفر المطلق مرفوض', v('unit-converter', { value: '-300', unit: 'c', target: 'f' }).tone === 'danger');
check('طول سالب مرفوض', v('unit-converter', { value: '-5', unit: 'm', target: 'ft' }).tone === 'danger');
check('تحويل غير مدعوم يوضّح', /غير مدعوم/.test(v('unit-converter', { value: '1', unit: 'kg', target: 'm' }).value));
check('عدد ركاب كسري مرفوض', v('fuel', { distance: '100', consumption: '5', fuelPrice: '20', passengers: '2.5' }).tone === 'danger');
check('استهلاك صفر مرفوض (لا قسمة/نتيجة وهمية)', v('fuel', { distance: '100', consumption: '0', fuelPrice: '20', passengers: '2' }).tone === 'danger');
check('حجم صفر للمولارية مرفوض', v('scientific', { operation: 'molarity', a: '1', b: '0' }).tone === 'danger');
check('الكثافة بوحدة جم/مل', v('scientific', { operation: 'density', a: '10', b: '5' }).value === '2.0000 جم/مل');
check('كتلة صفر للكثافة مرفوضة', v('scientific', { operation: 'density', a: '0', b: '5' }).tone === 'danger');
check('pH=3 لتركيز 0.001 مع إعلان الافتراض', v('scientific', { operation: 'ph', a: '0.001' }).value === '3.0000' && calc('scientific', { operation: 'ph', a: '0.001' }).length === 2);
check('pH لتركيز صفر/سالب مرفوض', v('scientific', { operation: 'ph', a: '0' }).tone === 'danger' && v('scientific', { operation: 'ph', a: '-1' }).tone === 'danger');
check('قيم هائلة لا تنتج نتيجة أسّية', v('room-area', { length: '1e20', width: '2' }).tone === 'danger' && v('room-area', { length: '99999999999999999999', width: '9999999999999999' }).tone === 'danger');
check('عشوائي بنطاق غير آمن مرفوض', v('random', { min: '0', max: '99999999999999999999' }).tone === 'danger');
const r = Number(v('random', { min: '1', max: '3' }).value);
check('عشوائي ضمن النطاق', r >= 1 && r <= 3);
check('29 فبراير: عمر لا يصبح سالبًا', !/-/.test(v('age', { birthDate: '29/02/2000', asOfDate: '28/02/2001' }).value));
check('تاريخ ميلاد بعد التاريخ المطلوب مرفوض', v('age', { birthDate: '01/01/2030', asOfDate: '01/01/2020' }).tone === 'danger');
check('نص فارغ مرفوض', v('text-tools', { text: '', operation: 'count' }).tone === 'danger');
check('أداة غير معروفة ترجع قائمة فارغة', calc('nope', {}).length === 0);

// ===== التوجيه =====
const toolOf = (p) => (routeTool(p) || {}).toolId;
check('«احسب الخصم» → discount', toolOf('احسب الخصم') === 'discount');
check('«حوّل الوحدات» → unit-converter', toolOf('حوّل الوحدات') === 'unit-converter');
check('«احسب مساحة الغرفة» → room-area', toolOf('احسب مساحة الغرفة') === 'room-area');
check('«احسب عمري» → age', toolOf('احسب عمري') === 'age');
check('«احسب بنزين الرحلة» → fuel', toolOf('احسب بنزين الرحلة') === 'fuel');
check('فعل وحده بلا أداة → لا توجيه', !routeTool('احسب') && !routeTool('حول'));
check('جمل تطبيقات لا توجَّه', ['افتح واتساب', 'افتح الحاسبة', 'افتح خصم', 'شغل الكشاف', 'واتساب', 'افتح الصور'].every((p) => !routeTool(p)));

// ===== عدم التعارض عبر resolveCommand =====
const apps = buildApps(KNOWN.map(({ name, pkg }) => ({ name, pkg })));
const ctx = { apps, custom: [], usage: { counts: {}, recent: [] } };
let d = resolveCommand(['احسب الخصم'], ctx);
check('resolver: «احسب الخصم» → tool', d.kind === 'tool' && d.toolId === 'discount');
check('resolver: أوامر التطبيقات كما هي', resolveCommand(['افتح واتساب'], ctx).kind === 'open' && resolveCommand(['افتح الكاميرا'], ctx).kind !== 'tool');
check('resolver: كل أسماء التطبيقات المعروفة لا تُوجَّه لأداة', KNOWN.every((k) => k.aliases.every((a) => resolveCommand([`افتح ${a}`], ctx).kind !== 'tool' && resolveCommand([a], ctx).kind !== 'tool')));
check('resolver: الكشاف يبقى device', resolveCommand(['شغل الكشاف'], ctx).kind === 'device');
const cust = [{ pkg: 'com.whatsapp', name: 'واتساب', aliases: ['احسب الخصم'] }];
const dc = resolveCommand(['احسب الخصم'], { apps, custom: cust, usage: ctx.usage });
check('resolver: أمر مخصص للمستخدم له الأولوية على الأداة', dc.kind === 'open' && dc.app.pkg === 'com.whatsapp');

console.log(failed ? `\nفشل ${failed}` : '\nكل اختبارات الأدوات نجحت');
process.exit(failed ? 1 : 0);
