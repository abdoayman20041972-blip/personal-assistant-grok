/**
 * بوابة سياسة الأفعال — مكيّفة من Meegol Jarvis + Vox Voice.
 * أي فعل له أثر خارجي أو غير قابل للتراجع يجب أن يمر هنا.
 * لا تسمح بـ shell حر أبدًا.
 */

const REQUIRE_APPROVAL = new Set([
  'torch_on',
  'torch_off',
  'open_settings',
  'wifi_settings',
  'bluetooth_settings',
  'airplane_settings',
  'delete_command',
  'clear_history',
  'enroll_voice',
  'delete_voiceprint',
]);

/** أفعال ممنوعة تمامًا */
const BLOCKED = new Set(['run_shell', 'exec', 'eval', 'system']);

/**
 * @param {{ action: string, payload?: any }} command
 * @param {{ approved?: boolean }} options
 * @returns {{ allowed: boolean, reason: string, requiresApproval?: boolean }}
 */
function assessAction(command, { approved = false } = {}) {
  if (!command || typeof command.action !== 'string' || !command.action.trim()) {
    return { allowed: false, reason: 'INVALID_ACTION' };
  }
  const action = command.action.trim();

  if (BLOCKED.has(action)) {
    return { allowed: false, reason: 'BLOCKED_ACTION' };
  }

  if (REQUIRE_APPROVAL.has(action) && !approved) {
    return { allowed: false, reason: 'USER_CONFIRMATION_REQUIRED', requiresApproval: true };
  }

  return { allowed: true, reason: 'POLICY_PASSED' };
}

/** مساعدة سريعة لبناء أمر */
function makeAction(action, payload = {}) {
  return { action, payload };
}

module.exports = { assessAction, makeAction, REQUIRE_APPROVAL, BLOCKED };
