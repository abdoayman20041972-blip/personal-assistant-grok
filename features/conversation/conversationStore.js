/**
 * سجل محادثة محلي محدود الحجم — مكيّف من Vox Voice + Freya conversationContext.
 * لا يخزّن أسرارًا، وله حد أقصى واضح.
 */

function createConversationStore({ maxMessages = 80, now = () => new Date() } = {}) {
  let messages = [];

  return {
    /**
     * @param {'user'|'assistant'|'system'} role
     * @param {string} content
     * @param {object} [meta]
     */
    add(role, content, meta = undefined) {
      if (!['user', 'assistant', 'system'].includes(role)) {
        throw new TypeError('invalid_role');
      }
      if (typeof content !== 'string') throw new TypeError('invalid_content');
      const message = {
        id: `${now().getTime()}-${messages.length + 1}`,
        role,
        content: content.slice(0, 4000), // حد طول الرسالة
        timestamp: now().toISOString(),
        ...(meta && typeof meta === 'object' ? { meta } : {}),
      };
      messages.push(message);
      if (messages.length > maxMessages) {
        messages = messages.slice(-maxMessages);
      }
      return message;
    },

    list() {
      return messages.map((m) => ({ ...m }));
    },

    clear() {
      messages = [];
    },

    size() {
      return messages.length;
    },

    /** آخر N رسائل (لعرض أو سياق) */
    recent(n = 10) {
      return messages.slice(-Math.max(1, n)).map((m) => ({ ...m }));
    },
  };
}

module.exports = { createConversationStore };
