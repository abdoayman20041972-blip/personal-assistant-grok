/**
 * يسجّل الأدوات الحالية (من tools.js + tool-engine) داخل ToolRegistry.
 * لا يغيّر سلوك router الحالي — جاهز للاستخدام عند الحاجة لـorchestrator أو تأكيد.
 */
const { tools } = require('./tools');
const { calculateTool } = require('./tool-engine');
const { ToolRegistry } = require('./toolRegistry');

function createBuiltinRegistry() {
  const registry = new ToolRegistry();

  for (const t of tools) {
    registry.register(t.id, {
      description: t.description || t.title,
      schema: {
        type: 'object',
        // الحقول ديناميكية حسب الأداة؛ نقبل object عامًا هنا
        additionalProperties: true,
      },
      execute: async (args) => calculateTool(t.id, args),
      requiresConfirmation: false,
      timeoutMs: 5000,
    });
  }

  return registry;
}

module.exports = { createBuiltinRegistry };
