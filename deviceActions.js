// تنفيذ أوامر الجهاز (كشاف + إعدادات) — يرجع { kind, body }: الشاشة تعرضه رسالة والدائرة Toast.
import { openAirplaneSettings, openBluetoothSettings, openWifiPanel, setFlashlight } from './modules/installed-apps';

function settingsLabel(target) {
  return target === 'wifi' ? 'الواي فاي والنت' : target === 'bluetooth' ? 'البلوتوث' : 'وضع الطيران';
}

function openSettingsFor(target) {
  try {
    return target === 'wifi' ? openWifiPanel() : target === 'bluetooth' ? openBluetoothSettings() : openAirplaneSettings();
  } catch (e) {
    return 'failed';
  }
}

export function performDevice(d) {
  if (d.type === 'torch') {
    let st = 'failed';
    try {
      st = setFlashlight(d.on);
    } catch (e) {}
    if (st === 'ok') return { kind: 'ok', body: d.on ? 'ولّعت الكشاف 💡' : 'قفلت الكشاف' };
    if (st === 'no_flash') return { kind: 'warn', body: 'الجهاز ده معندوش كشاف.' };
    return { kind: 'warn', body: 'ما قدرتش أتحكم في الكشاف. جرّب تاني.' };
  }
  const st = openSettingsFor(d.target);
  return st === 'ok'
    ? { kind: 'info', body: `أندرويد 11 مش بيسمح أغير ${settingsLabel(d.target)} بنفسي — فتحتلك الإعدادات، أكمل بإيدك.` }
    : { kind: 'warn', body: 'ما قدرتش أفتح الإعدادات. جرّب تاني.' };
}
