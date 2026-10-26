# سجل دمج التحسينات — «افتح لي Claude»

**التاريخ:** 26 أكتوبر 2026  
**المصدر:** حزمة `ifta7-improvements-from-6-projects` (Freya, OpenMuse, PocketPal, Jarvis Android, Meegol Jarvis, Vox Voice)

---

## ما تم دمجه فعليًا

### 1. نظام أدوات أقوى
| الملف | الوصف |
|---|---|
| `features/tools/toolRegistry.js` | سجل أدوات مع schema validation، تأكيد، مهلة، إلغاء. + `AssistantOrchestrator` محدود الخطوات (max 5–10) يمنع تكرار استدعاء نفس الأداة. |

**الاستخدام لاحقًا:** سجّل الأدوات الحالية عبر `registry.register(...)` واربط الـplanner عند الحاجة لأدوات متعددة الخطوات. الـrouter الحالي ما زال يعمل كما هو.

### 2. سياسة الأفعال (Action Policy)
| الملف | الوصف |
|---|---|
| `features/policy/actionPolicy.js` | بوابة موافقة للأفعال الحساسة (كشاف، إعدادات، حذف بصمة...). يمنع `run_shell` تمامًا. |

### 3. تحسينات الصوت
| الملف | الوصف |
|---|---|
| `features/voice/wakeWordMatcher.js` | مطابقة «افتح لي / افتحلي / يا افتح لي» بعد STT مع عتبة تشابه. |
| `features/voice/sessionController.js` | آلة حالات: `idle` → `listening` → `thinking` → `speaking` + نافذة زمنية. |
| `features/voice/sentenceChunker.js` | تقسيم الرد لمقاطع TTS + تنظيف Markdown خفيف. |
| `hooks/useVoice.js` | محدّث: يعرض `voiceState`، ويوفّر `prepareVoiceCommand` و`matchWakeWord` و`setSessionState`. |

### 4. سجل محادثة محدود
| الملف | الوصف |
|---|---|
| `features/conversation/conversationStore.js` | سجل محلي بحد أقصى (افتراضي 80) + `clear` و`recent`. |

### 5. إعدادات محسّنة
| الملف | الوصف |
|---|---|
| `features/settings/settingsStore.js` | defaults + دمج آمن مع القيم القديمة (AsyncStorage). حقول: language, voiceEnabled, wakeWordEnabled, theme, historyLimit, voiceThreshold, sessionDurationMs. |

### 6. اختبارات
| الملف | الوصف |
|---|---|
| `test-improvements.js` | يغطي كل الوحدات الجديدة. مدمج في `npm test`. |

---

## ما لم يُدمَج بعد (متعمد)

- ربط Tool Registry بالأدوات الحالية في `tool-engine.js` بشكل كامل (جاهز للربط في مرحلة لاحقة).
- عرض حالات الصوت بصريًا في `MessageBox` / الدائرة (الـAPI موجود في useVoice).
- Conversation Queue من OpenMuse (مفيد عند وجود رد متدفق).
- Fact Extractor / Confusion Detector (اختياري).
- أي LLM / Ollama / streaming parsers.
- تعديلات على ملفات Kotlin.

---

## قواعد الاستخدام بعد الدمج

1. **لا تستبدل** `matcher.js` أو `resolver.js` أو وحدات Kotlin.
2. عند فتح شاشة الأدوات أو تنفيذ فعل حساس، مرّر عبر `assessAction`.
3. قبل تمرير نص STT إلى `resolveCommand`، استخدم `prepareVoiceCommand(text)` لإزالة عبارة التنبيه.
4. استخدم `setSessionState('listening'|'thinking'|'speaking'|'idle')` لتحديث الواجهة.
5. شغّل `npm test` بعد أي تعديل إضافي.

---

## حالة الاختبارات

جميع الاختبارات الحالية + الاختبارات الجديدة نجحت:
- matcher, store, device, resolver, tools, **improvements**
