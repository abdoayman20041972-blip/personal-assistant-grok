/**
 * اختبارات الوحدات الجديدة المضافة من حزمة التحسينات.
 * تشغيل: node test-improvements.js
 */
const assert = require('assert');

// --- Tool Registry ---
const { ToolRegistry, AssistantOrchestrator } = require('./features/tools/toolRegistry');

async function testToolRegistry() {
  const reg = new ToolRegistry();
  reg.register('add', {
    description: 'جمع رقمين',
    schema: {
      type: 'object',
      properties: { a: { type: 'number' }, b: { type: 'number' } },
      required: ['a', 'b'],
      additionalProperties: false,
    },
    execute: async ({ a, b }) => a + b,
    requiresConfirmation: false,
    timeoutMs: 2000,
  });

  const ok = await reg.execute('add', { a: 2, b: 3 });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.value, 5);

  const bad = await reg.execute('add', { a: 1 });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.error, 'invalid_arguments');

  const unknown = await reg.execute('nope', {});
  assert.strictEqual(unknown.ok, false);
  assert.strictEqual(unknown.error, 'unknown_tool');

  // تأكيد مطلوب
  reg.register('danger', {
    description: 'فعل حساس',
    schema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => 'done',
    requiresConfirmation: true,
  });
  const denied = await reg.execute('danger', {}, { confirm: async () => false });
  assert.strictEqual(denied.error, 'confirmation_denied');
  const allowed = await reg.execute('danger', {}, { confirm: async () => true });
  assert.strictEqual(allowed.ok, true);

  console.log('  toolRegistry: OK');
}

async function testOrchestrator() {
  const reg = new ToolRegistry();
  reg.register('echo', {
    description: 'يرجع النص',
    schema: { type: 'object', properties: { t: { type: 'string' } }, required: ['t'] },
    execute: async ({ t }) => t,
  });

  let calls = 0;
  const orch = new AssistantOrchestrator({
    tools: reg,
    maxSteps: 3,
    planner: async ({ step }) => {
      calls += 1;
      if (step === 0) return { type: 'tool', name: 'echo', args: { t: 'مرحبا' } };
      return { type: 'respond', text: 'تم' };
    },
  });
  const r = await orch.run('اختبار');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.text, 'تم');
  assert.strictEqual(r.steps.length, 1);

  // منع التكرار
  const orch2 = new AssistantOrchestrator({
    tools: reg,
    maxSteps: 4,
    planner: async () => ({ type: 'tool', name: 'echo', args: { t: 'نفس' } }),
  });
  const r2 = await orch2.run('تكرار');
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.error, 'repeated_tool_call_blocked');

  console.log('  orchestrator: OK');
}

// --- Action Policy ---
const { assessAction } = require('./features/policy/actionPolicy');

function testActionPolicy() {
  assert.strictEqual(assessAction({ action: 'open_app' }).allowed, true);
  assert.strictEqual(assessAction({ action: 'torch_on' }).allowed, false);
  assert.strictEqual(assessAction({ action: 'torch_on' }).reason, 'USER_CONFIRMATION_REQUIRED');
  assert.strictEqual(assessAction({ action: 'torch_on' }, { approved: true }).allowed, true);
  assert.strictEqual(assessAction({ action: 'run_shell' }).allowed, false);
  assert.strictEqual(assessAction({ action: 'run_shell' }).reason, 'BLOCKED_ACTION');
  assert.strictEqual(assessAction(null).allowed, false);
  console.log('  actionPolicy: OK');
}

// --- Wake Word ---
const { WakeWordMatcher } = require('./features/voice/wakeWordMatcher');

function testWakeWord() {
  const m = new WakeWordMatcher({ phrases: ['افتح لي', 'افتحلي'], threshold: 0.78 });
  const r1 = m.match('افتح لي الواتس');
  assert.strictEqual(r1.detected, true);
  assert.ok(r1.remainder.includes('واتس') || r1.remainder.includes('الواتس'));

  const r2 = m.match('شغل اليوتيوب');
  assert.strictEqual(r2.detected, false);

  const r3 = m.match('افتحلي الكاميرا');
  assert.strictEqual(r3.detected, true);

  console.log('  wakeWordMatcher: OK');
}

// --- Session Controller ---
const { VoiceSessionController } = require('./features/voice/sessionController');

function testSession() {
  let t = 1000;
  const s = new VoiceSessionController({ durationMs: 500, now: () => t });
  assert.strictEqual(s.state, 'idle');
  s.setState('listening');
  assert.strictEqual(s.state, 'listening');
  assert.strictEqual(s.isActive(), true);
  t += 600;
  assert.strictEqual(s.isActive(), false);
  assert.strictEqual(s.state, 'idle');
  s.setState('thinking');
  assert.strictEqual(s.state, 'thinking');
  s.close();
  assert.strictEqual(s.state, 'idle');
  console.log('  sessionController: OK');
}

// --- Conversation Store ---
const { createConversationStore } = require('./features/conversation/conversationStore');

function testConversationStore() {
  const store = createConversationStore({ maxMessages: 3, now: () => new Date('2026-01-01') });
  store.add('user', 'مرحبا');
  store.add('assistant', 'أهلاً');
  store.add('user', 'افتح الواتس');
  store.add('assistant', 'تم');
  assert.strictEqual(store.size(), 3); // max
  assert.strictEqual(store.list()[0].role, 'assistant'); // الأقدم اتحذف
  store.clear();
  assert.strictEqual(store.size(), 0);
  console.log('  conversationStore: OK');
}

// --- Settings Store ---
const { createSettingsStore, DEFAULT_SETTINGS } = require('./features/settings/settingsStore');

async function testSettingsStore() {
  const mem = new Map();
  const storage = {
    getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: async (k, v) => { mem.set(k, v); },
  };
  const s = createSettingsStore(storage);
  const g1 = await s.get();
  assert.strictEqual(g1.language, 'ar-EG');
  assert.strictEqual(g1.wakeWordEnabled, true);
  await s.update({ theme: 'light', historyLimit: 50 });
  const g2 = await s.get();
  assert.strictEqual(g2.theme, 'light');
  assert.strictEqual(g2.historyLimit, 50);
  assert.strictEqual(g2.language, DEFAULT_SETTINGS.language); // defaults preserved
  console.log('  settingsStore: OK');
}

// --- Sentence Chunker ---
const { chunkSentences, stripMarkdownLight } = require('./features/voice/sentenceChunker');

function testChunker() {
  const t = 'مرحبا. هذا اختبار طويل **بالخط العريض**. هل يعمل؟';
  const chunks = chunkSentences(t, { maxLen: 40 });
  assert.ok(chunks.length >= 1);
  assert.ok(!stripMarkdownLight('**نص**').includes('**'));
  console.log('  sentenceChunker: OK');
}

(async () => {
  console.log('test-improvements:');
  try {
    await testToolRegistry();
    await testOrchestrator();
    testActionPolicy();
    testWakeWord();
    testSession();
    testConversationStore();
    await testSettingsStore();
    testChunker();
    console.log('ALL PASSED');
    process.exit(0);
  } catch (e) {
    console.error('FAILED:', e);
    process.exit(1);
  }
})();
