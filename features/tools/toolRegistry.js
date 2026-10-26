/**
 * سجل أدوات آمن مكيّف من Freya + PocketPal لمشروع «افتح لي».
 * - لا ينفّذ إلا أدوات مسجّلة صراحة
 * - يتحقق من المدخلات عبر schema بسيط
 * - يدعم تأكيد المستخدم، مهلة، وإلغاء
 * CommonJS ليتوافق مع باقي المشروع.
 */

function validateValue(value, schema, path) {
  if (!schema || Object.keys(schema).length === 0) return null;
  const type = schema.type;
  const typeOk = {
    object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    array: Array.isArray,
    string: (v) => typeof v === 'string',
    number: (v) => typeof v === 'number' && Number.isFinite(v),
    integer: (v) => Number.isSafeInteger(v),
    boolean: (v) => typeof v === 'boolean',
    null: (v) => v === null,
  };
  if (type && (!typeOk[type] || !typeOk[type](value))) return `${path} must be ${type}`;
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    return `${path} is not an allowed value`;
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) return `${path} is too short`;
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return `${path} is too long`;
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) return `${path} is below minimum`;
    if (schema.maximum !== undefined && value > schema.maximum) return `${path} is above maximum`;
  }
  if (Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i += 1) {
      const error = validateValue(value[i], schema.items, `${path}[${i}]`);
      if (error) return error;
    }
  }
  if (type === 'object' && schema.properties) {
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) return `${path}.${key} is required`;
    }
    for (const [key, child] of Object.entries(value)) {
      if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) {
        if (schema.additionalProperties === false) return `${path}.${key} is not allowed`;
        continue;
      }
      const error = validateValue(child, schema.properties[key], `${path}.${key}`);
      if (error) return error;
    }
  }
  return null;
}

class ToolRegistry {
  constructor() {
    this._tools = new Map();
  }

  register(name, { description = '', schema = {}, execute, requiresConfirmation = false, timeoutMs = 8000 } = {}) {
    if (typeof name !== 'string' || !name.trim()) throw new TypeError('Tool name is required');
    if (this._tools.has(name)) throw new Error(`Tool already registered: ${name}`);
    if (typeof execute !== 'function') throw new TypeError('Tool execute must be a function');
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new TypeError('timeoutMs must be >= 1');
    this._tools.set(name, {
      name,
      description: description || '',
      schema,
      execute,
      requiresConfirmation: Boolean(requiresConfirmation),
      timeoutMs,
    });
  }

  list() {
    return [...this._tools.values()].map(({ name, description, schema, requiresConfirmation, timeoutMs }) => ({
      name,
      description,
      schema,
      requiresConfirmation,
      timeoutMs,
    }));
  }

  has(name) {
    return this._tools.has(name);
  }

  async execute(name, args = {}, { confirm = async () => false, signal, timeoutMs } = {}) {
    const tool = this._tools.get(name);
    if (!tool) return { ok: false, tool: name, error: 'unknown_tool' };
    if (signal && signal.aborted) return { ok: false, tool: name, error: 'aborted' };
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return { ok: false, tool: name, error: 'invalid_arguments_object' };
    }
    const validationError = validateValue(args, tool.schema, 'args');
    if (validationError) {
      return { ok: false, tool: name, error: 'invalid_arguments', details: validationError };
    }

    try {
      if (tool.requiresConfirmation && !(await confirm({ name, args, description: tool.description }))) {
        return { ok: false, tool: name, error: 'confirmation_denied', requiresConfirmation: true };
      }
      if (signal && signal.aborted) return { ok: false, tool: name, error: 'aborted' };

      const limit = timeoutMs ?? tool.timeoutMs;
      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('tool_timeout')), limit);
      });
      try {
        const value = await Promise.race([
          Promise.resolve().then(() => tool.execute(args, { signal })),
          timeoutPromise,
        ]);
        return { ok: true, tool: name, value };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, tool: name, error: message === 'tool_timeout' ? 'timeout' : message };
    }
  }
}

/** Orchestrator محدود الخطوات — يمنع تكرار استدعاء نفس الأداة بنفس المدخلات */
class AssistantOrchestrator {
  constructor({ planner, tools, maxSteps = 5, confirm } = {}) {
    if (typeof planner !== 'function') throw new TypeError('planner function is required');
    if (!tools || typeof tools.execute !== 'function') throw new TypeError('ToolRegistry is required');
    this.planner = planner;
    this.tools = tools;
    this.maxSteps = Number.isInteger(maxSteps) ? Math.max(1, Math.min(10, maxSteps)) : 5;
    this.confirm = confirm || (async () => false);
  }

  async run(userText, { signal } = {}) {
    if (typeof userText !== 'string' || !userText.trim()) {
      return { ok: false, error: 'empty_input', steps: [] };
    }
    const query = userText.trim();
    const steps = [];
    const attemptedCalls = new Set();

    for (let index = 0; index < this.maxSteps; index += 1) {
      if (signal && signal.aborted) return { ok: false, error: 'aborted', steps };
      let decision;
      try {
        decision = await this.planner({
          query,
          toolResults: steps.filter((s) => s.type === 'tool'),
          availableTools: this.tools.list(),
          step: index,
          signal,
        });
      } catch (error) {
        return {
          ok: false,
          error: `planner_failed: ${error instanceof Error ? error.message : String(error)}`,
          steps,
        };
      }

      if (decision && decision.type === 'respond' && typeof decision.text === 'string') {
        return { ok: true, text: decision.text, steps };
      }
      if (!decision || decision.type !== 'tool' || typeof decision.name !== 'string') {
        return { ok: false, error: 'invalid_planner_decision', steps };
      }

      let callKey;
      try {
        callKey = `${decision.name}:${JSON.stringify(decision.args || {})}`;
      } catch {
        return { ok: false, error: 'invalid_tool_arguments', steps };
      }
      if (attemptedCalls.has(callKey)) {
        return {
          ok: false,
          error: 'repeated_tool_call_blocked',
          message: 'تم إيقاف تكرار استدعاء الأداة نفسها بنفس المدخلات.',
          steps,
        };
      }
      attemptedCalls.add(callKey);

      const args = decision.args || {};
      const result = await this.tools.execute(decision.name, args, { confirm: this.confirm, signal });
      const step = { type: 'tool', name: decision.name, args, result };
      steps.push(step);
    }
    return {
      ok: false,
      error: 'max_steps_exceeded',
      message: 'تم إيقاف التنفيذ بعد بلوغ الحد الآمن للخطوات.',
      steps,
    };
  }
}

module.exports = { ToolRegistry, AssistantOrchestrator, validateValue };
