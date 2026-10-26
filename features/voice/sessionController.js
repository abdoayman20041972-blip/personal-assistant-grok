/**
 * آلة حالات الجلسة الصوتية — مكيّفة من Freya + أفكار Vox Voice.
 * الحالات: idle | listening | thinking | speaking
 * التطبيق يربطها بواجهة المستخدم والدائرة العائمة.
 */

const VALID_STATES = new Set(['idle', 'listening', 'thinking', 'speaking']);

class VoiceSessionController {
  /**
   * @param {{ durationMs?: number, now?: () => number }} options
   */
  constructor({ durationMs = 8000, now = () => Date.now() } = {}) {
    this.durationMs = Math.max(0, Number(durationMs) || 0);
    this.now = now;
    this.expiresAt = 0;
    this._state = 'idle';
  }

  get state() {
    // لو انتهت نافذة الاستماع نرجع idle تلقائيًا
    if (this._state === 'listening' && !this.isActive()) {
      this._state = 'idle';
    }
    return this._state;
  }

  setState(next) {
    if (!VALID_STATES.has(next)) throw new TypeError(`Invalid voice state: ${next}`);
    this._state = next;
    if (next === 'listening') {
      this.activate();
    } else if (next === 'idle') {
      this.close();
    }
    return this.snapshot();
  }

  activate(durationMs = this.durationMs) {
    this.expiresAt = this.now() + Math.max(0, Number(durationMs) || 0);
    if (this._state === 'idle') this._state = 'listening';
    return this.snapshot();
  }

  isActive() {
    return this.expiresAt > this.now();
  }

  remainingMs() {
    return Math.max(0, this.expiresAt - this.now());
  }

  close() {
    this.expiresAt = 0;
    this._state = 'idle';
    return this.snapshot();
  }

  snapshot() {
    return {
      state: this.state,
      active: this.isActive(),
      expiresAt: this.expiresAt,
      remainingMs: this.remainingMs(),
    };
  }
}

module.exports = { VoiceSessionController, VALID_STATES };
