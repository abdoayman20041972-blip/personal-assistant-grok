// منتقى ومكيّف من personal-assistant-expo/data/tool-engine.ts إلى JavaScript.
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩', FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const numberOf = (value) => {
  // أرقام عربية/فارسية ← لاتينية، والفاصلة العشرية العربية (٫) أو العادية (,) ← نقطة.
  // نرفض فواصل الآلاف (1,000,000) وأي صيغة غير رقمية (0x10 وغيرها) بدل تفسيرها بصمت تفسيرًا خاطئًا.
  const normalized = String(value ?? '').trim()
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٫,]/, '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const finite = (...xs) => xs.every((x) => Number.isFinite(x) && Math.abs(x) < 1e15);
const textOf = (value) => String(value ?? '').trim();
const invalid = (message) => [{ label: 'تنبيه', value: message, tone: 'danger' }];

function getToolFields(id) {
  switch (id) {
    case 'discount': return [
      { key: 'amount', label: 'السعر الأصلي', placeholder: 'مثال: 1000', keyboardType: 'decimal-pad' },
      { key: 'rate', label: 'نسبة الخصم ٪', placeholder: 'مثال: 20', keyboardType: 'decimal-pad' },
    ];
    case 'room-area': return [
      { key: 'length', label: 'الطول بالمتر', placeholder: 'مثال: 4', keyboardType: 'decimal-pad' },
      { key: 'width', label: 'العرض بالمتر', placeholder: 'مثال: 3.5', keyboardType: 'decimal-pad' },
    ];
    case 'unit-converter': return [
      { key: 'value', label: 'القيمة', placeholder: 'مثال: 5', keyboardType: 'decimal-pad' },
      { key: 'unit', label: 'الوحدة الأصلية', placeholder: 'kg أو m أو °C' },
      { key: 'target', label: 'الوحدة المطلوبة', placeholder: 'lb أو ft أو °F' },
    ];
    case 'age': return [
      { key: 'birthDate', label: 'تاريخ الميلاد', placeholder: 'DD/MM/YYYY' },
      { key: 'asOfDate', label: 'الحساب حتى (اختياري)', placeholder: 'DD/MM/YYYY' },
    ];
    case 'fuel': return [
      { key: 'distance', label: 'المسافة بالكيلومتر', placeholder: 'مثال: 250', keyboardType: 'decimal-pad' },
      { key: 'consumption', label: 'الاستهلاك لتر/100 كم', placeholder: 'مثال: 7.5', keyboardType: 'decimal-pad' },
      { key: 'fuelPrice', label: 'سعر اللتر', placeholder: 'مثال: 20', keyboardType: 'decimal-pad' },
      { key: 'passengers', label: 'عدد الأشخاص', placeholder: 'مثال: 4', keyboardType: 'numeric' },
    ];
    case 'random': return [
      { key: 'min', label: 'الحد الأدنى', placeholder: 'مثال: 1', keyboardType: 'numeric' },
      { key: 'max', label: 'الحد الأقصى', placeholder: 'مثال: 100', keyboardType: 'numeric' },
    ];
    case 'text-tools': return [
      { key: 'text', label: 'النص', placeholder: 'اكتب أو الصق النص هنا' },
      { key: 'operation', label: 'العملية', placeholder: 'count أو clean أو upper أو lower' },
    ];
    case 'scientific': return [
      { key: 'operation', label: 'العملية', placeholder: 'molarity أو density أو ph' },
      { key: 'a', label: 'القيمة الأولى (مولات / كتلة بالجرام / تركيز H⁺ بـ mol/L)', placeholder: 'مثال: 0.5', keyboardType: 'decimal-pad' },
      { key: 'b', label: 'القيمة الثانية (حجم باللتر للمولارية / حجم بالمل للكثافة)', placeholder: 'مثال: 1', keyboardType: 'decimal-pad' },
    ];
    default: return [];
  }
}

function parseDate(raw) {
  const match = textOf(raw).match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  if (date.getFullYear() !== Number(match[3]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[1])) return null;
  return date;
}

function calculateTool(id, values = {}) {
  switch (id) {
    case 'discount': {
      const amount = numberOf(values.amount), rate = numberOf(values.rate);
      if (amount === null || rate === null || amount < 0 || rate < 0 || rate > 100 || !finite(amount)) return invalid('أدخل سعرًا صحيحًا ونسبة بين 0 و100');
      const saved = amount * rate / 100;
      return [
        { label: 'السعر بعد الخصم', value: (amount - saved).toFixed(2), tone: 'success' },
        { label: 'قيمة الخصم', value: saved.toFixed(2) },
      ];
    }
    case 'room-area': {
      const length = numberOf(values.length), width = numberOf(values.width);
      if (length === null || width === null || length <= 0 || width <= 0 || !finite(length * width)) return invalid('أدخل طولًا وعرضًا أكبر من صفر');
      return [
        { label: 'المساحة', value: (length * width).toFixed(2) + ' م²', tone: 'success' },
        { label: 'المحيط', value: (2 * (length + width)).toFixed(2) + ' م' },
      ];
    }
    case 'unit-converter': {
      const value = numberOf(values.value), unit = textOf(values.unit).toLowerCase(), target = textOf(values.target).toLowerCase();
      if (value === null || !unit || !target) return invalid('أدخل القيمة والوحدتين');
      const UNIT_ALIASES = { 'كجم': 'kg', 'كيلو': 'kg', 'كيلوجرام': 'kg', 'رطل': 'lb', 'متر': 'm', 'قدم': 'ft', 'كم': 'km', 'ميل': 'mi', 'سم': 'cm', 'بوصة': 'in', 'لتر': 'l', 'جالون': 'gal', '°c': 'c', '°f': 'f' };
      const u = UNIT_ALIASES[unit] || unit, t = UNIT_ALIASES[target] || target;
      if ((u === 'c' && value < -273.15) || (u === 'f' && value < -459.67)) return invalid('درجة الحرارة أقل من الصفر المطلق');
      if (!['c', 'f'].includes(u) && value < 0) return invalid('القيمة السالبة غير منطقية لهذه الوحدة');
      let result = null;
      switch (u + '>' + t) {
        case 'kg>lb': case 'كيلو>رطل': case 'كجم>رطل': result = value * 2.2046226218; break;
        case 'lb>kg': case 'رطل>كيلو': result = value / 2.2046226218; break;
        case 'm>ft': case 'متر>قدم': result = value * 3.280839895; break;
        case 'ft>m': case 'قدم>متر': result = value / 3.280839895; break;
        case 'km>mi': case 'كم>ميل': result = value * 0.621371192; break;
        case 'mi>km': case 'ميل>كم': result = value / 0.621371192; break;
        case 'cm>in': case 'سم>بوصة': result = value / 2.54; break;
        case 'in>cm': case 'بوصة>سم': result = value * 2.54; break;
        case 'c>f': case '°c>°f': result = value * 9 / 5 + 32; break;
        case 'f>c': case '°f>°c': result = (value - 32) * 5 / 9; break;
        case 'l>gal': case 'لتر>جالون': result = value * 0.264172052; break;
        case 'gal>l': case 'جالون>لتر': result = value / 0.264172052; break;
      }
      if (result !== null && !finite(result)) return invalid('القيمة كبيرة جدًا');
      if (result === null) return invalid('التحويل غير مدعوم حاليًا. جرّب kg↔lb أو m↔ft أو km↔mi أو °C↔°F');
      return [{ label: target, value: result.toFixed(3), tone: 'success' }];
    }
    case 'age': {
      const birth = parseDate(values.birthDate);
      const end = textOf(values.asOfDate) ? parseDate(values.asOfDate) : new Date();
      if (!birth || !end || birth > end) return invalid('استخدم تاريخًا صحيحًا بصيغة DD/MM/YYYY');
      let years = end.getFullYear() - birth.getFullYear();
      let months = end.getMonth() - birth.getMonth();
      let days = end.getDate() - birth.getDate();
      if (days < 0) { months -= 1; days += new Date(end.getFullYear(), end.getMonth(), 0).getDate(); }
      if (months < 0) { years -= 1; months += 12; }
      return [{ label: 'العمر', value: `${years} سنة و${months} شهر و${days} يوم`, tone: 'success' }];
    }
    case 'fuel': {
      const distance = numberOf(values.distance), consumption = numberOf(values.consumption);
      const fuelPrice = numberOf(values.fuelPrice), passengers = numberOf(values.passengers);
      if (distance === null || consumption === null || fuelPrice === null || passengers === null || distance < 0 || consumption <= 0 || fuelPrice < 0 || passengers <= 0 || !Number.isInteger(passengers) || !finite(distance * consumption * fuelPrice)) return invalid('أدخل قيمًا صحيحة للمسافة والاستهلاك والسعر وعدد الأشخاص');
      const liters = distance * consumption / 100, cost = liters * fuelPrice;
      return [
        { label: 'الوقود المطلوب', value: liters.toFixed(2) + ' لتر', tone: 'success' },
        { label: 'تكلفة الرحلة', value: cost.toFixed(2) },
        { label: 'التكلفة لكل شخص', value: (cost / passengers).toFixed(2) },
      ];
    }
    case 'random': {
      const min = numberOf(values.min), max = numberOf(values.max);
      if (min === null || max === null || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max || max - min > 1e9) return invalid('أدخل عددين صحيحين بحيث يكون الحد الأدنى أصغر من أو يساوي الحد الأقصى');
      return [{ label: 'النتيجة', value: String(Math.floor(Math.random() * (max - min + 1)) + min), tone: 'success' }];
    }
    case 'text-tools': {
      const input = String(values.text ?? ''), operation = textOf(values.operation).toLowerCase();
      if (!input) return invalid('أدخل نصًا أولًا');
      if (operation === 'count' || operation === 'عدد') return [
        { label: 'الكلمات', value: String(input.trim() ? input.trim().split(/\s+/).length : 0), tone: 'success' },
        { label: 'الحروف', value: String([...input].length) },
        { label: 'الأسطر', value: String(input.split(/\r?\n/).length) },
      ];
      if (operation === 'clean' || operation === 'تنظيف') return [{ label: 'النص المنظف', value: input.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(), tone: 'success' }];
      if (operation === 'upper' || operation === 'كبير') return [{ label: 'النص', value: input.toUpperCase(), tone: 'success' }];
      if (operation === 'lower' || operation === 'صغير') return [{ label: 'النص', value: input.toLowerCase(), tone: 'success' }];
      return invalid('العمليات: count أو clean أو upper أو lower');
    }
    case 'scientific': {
      const operation = textOf(values.operation).toLowerCase(), a = numberOf(values.a), b = numberOf(values.b);
      if (!operation) return invalid('اختر العملية العلمية المطلوبة');
      if (operation === 'molarity' || operation === 'مولارية') {
        if (a === null || b === null || a < 0 || b <= 0 || !finite(a / b)) return invalid('للمولارية أدخل عدد المولات والحجم باللتر');
        return [{ label: 'المولارية', value: (a / b).toFixed(4) + ' mol/L', tone: 'success' }];
      }
      if (operation === 'density' || operation === 'كثافة') {
        if (a === null || b === null || a <= 0 || b <= 0 || !finite(a / b)) return invalid('للكثافة أدخل الكتلة (جم) والحجم (مل) أكبر من صفر');
        return [{ label: 'الكثافة', value: (a / b).toFixed(4) + ' جم/مل', tone: 'success' }];
      }
      if (operation === 'ph') {
        if (a === null || a <= 0) return invalid('لـ pH أدخل تركيز H⁺ بوحدة mol/L أكبر من صفر');
        return [{ label: 'pH', value: (-Math.log10(a)).toFixed(4), tone: 'success' }, { label: 'ملاحظة', value: 'يفترض سلوكًا مثاليًا (النشاط = التركيز) وحمضًا قويًا مفككًا بالكامل' }];
      }
      return invalid('العمليات: molarity أو density أو ph');
    }
    default: return [];
  }
}
module.exports = { getToolFields, calculateTool };
