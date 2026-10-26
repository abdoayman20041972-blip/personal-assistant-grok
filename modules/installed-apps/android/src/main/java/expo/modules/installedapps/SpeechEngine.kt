package expo.modules.installedapps

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

fun speechErrorMessage(code: Int): String = when (code) {
  SpeechRecognizer.ERROR_NO_MATCH -> "ما فهمتش الكلام، حاول تاني"
  SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "ما سمعتش صوت، حاول تاني"
  SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "محتاج إذن الميكروفون"
  SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "التعرف على الكلام محتاج إنترنت"
  SpeechRecognizer.ERROR_AUDIO -> "مشكلة في الميكروفون"
  SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "الميكروفون مشغول، جرّب بعد لحظة"
  12, 13 -> "حزمة اللغة العربية مش متاحة في Google — حدّث تطبيق Google ونزّل العربية من إعدادات الكلام"
  -1 -> "خدمة التعرف على الكلام مش متاحة (اتأكد من تطبيق Google)"
  else -> "ما قدرتش أتعرف على الكلام (رمز $code)"
}

// محرك التعرف على الكلام — singleton واحد يتشاركه التطبيق والدائرة العائمة.
//
// لماذا singleton؟ إنشاء أكثر من SpeechRecognizer في نفس اللحظة يسبب
// ERROR_RECOGNIZER_BUSY. القاعدة: آخر من يطلب الاستماع يفوز، وإفراج السابق تلقائي.
// كل الاستدعاءات يجب أن تتم من الخيط الرئيسي (شرط SpeechRecognizer).
//
// ===== سبب خطأ «اللغة العربية غير متاحة» (الرمزان 12 و13) وحله =====
// كان الكود يفرض ar-EG ويطلب EXTRA_PREFER_OFFLINE=true. عندما لا تكون حزمة العربية
// الأوفلاين محملة (أو لا يدعم Google اللهجة المصرية على ذلك الجهاز) يرد Google بالخطأ 12/13
// بدل أن يرجع للتعرف الأونلاين. الحل:
//   1) لا نطلب الأوفلاين إطلاقًا (البصمة الصوتية تغطي الأوفلاين، وجوجل هو الطبقة الأونلاين).
//   2) سلّم لغات احتياطي تلقائي عند 12/13: ar-EG ← ar-SA ← ar ← لغة الجهاز الافتراضية.
//   3) نتذكر اللغة التي نجحت فتبدأ بها في المرات التالية.
object SpeechEngine {
  private val LANGS = listOf("ar-EG", "ar-SA", "ar", "")
  private val main = Handler(Looper.getMainLooper())

  private var recognizer: SpeechRecognizer? = null
  private var stateCb: (String) -> Unit = {}
  private var resultCb: (List<String>) -> Unit = {}
  private var errorCb: (Int) -> Unit = {}

  // رقم دورة: يبطل أي إعادة محاولة معلّقة بعد release()
  @Volatile private var gen = 0
  // أول لغة نجحت — نبدأ بها في المرات القادمة
  @Volatile private var preferred = 0

  @Volatile
  var listening: Boolean = false
    private set

  fun isAvailable(context: Context): Boolean = SpeechRecognizer.isRecognitionAvailable(context)

  fun start(
    context: Context,
    onState: (String) -> Unit,
    onResult: (List<String>) -> Unit,
    onError: (Int) -> Unit
  ) {
    release()
    if (!isAvailable(context)) {
      onError(-1)
      return
    }
    stateCb = onState
    resultCb = onResult
    errorCb = onError
    launch(context.applicationContext, preferred)
  }

  private fun buildIntent(context: Context, lang: String): Intent =
    Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      if (lang.isNotEmpty()) {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
      }
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
      putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
      // مهلات الصمت: بدونها يبقى الاستماع مفتوحًا طويلًا على realme UI.
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1500L)
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1200L)
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 900L)
    }

  private fun launch(ctx: Context, attempt: Int) {
    val token = gen
    val lang = LANGS[attempt]
    val r = SpeechRecognizer.createSpeechRecognizer(ctx)
    recognizer = r
    r.setRecognitionListener(object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) { if (recognizer === r) { listening = true; stateCb("listening") } }
      override fun onBeginningOfSpeech() { if (recognizer === r) stateCb("hearing") }
      override fun onRmsChanged(rmsdB: Float) {}
      override fun onBufferReceived(buffer: ByteArray?) {}
      override fun onEndOfSpeech() { if (recognizer === r) stateCb("processing") }
      override fun onPartialResults(partialResults: Bundle?) {}
      override fun onEvent(eventType: Int, params: Bundle?) {}
      override fun onError(error: Int) {
        if (recognizer !== r) return
        // اللغة غير متاحة: جرّب التالية في السلّم بصمت بدل إظهار الخطأ للمستخدم
        if ((error == 12 || error == 13) && attempt + 1 < LANGS.size) {
          try { r.cancel() } catch (e: Exception) {}
          try { r.destroy() } catch (e: Exception) {}
          recognizer = null
          listening = false
          main.post { if (token == gen) launch(ctx, attempt + 1) }
          return
        }
        listening = false
        stateCb("idle")
        errorCb(error)
      }
      override fun onResults(results: Bundle?) {
        if (recognizer !== r) return
        listening = false
        preferred = attempt // هذه اللغة تعمل على هذا الجهاز
        stateCb("idle")
        val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.filter { it.isNotBlank() } ?: emptyList()
        if (list.isEmpty()) errorCb(SpeechRecognizer.ERROR_NO_MATCH) else resultCb(list)
      }
    })
    r.startListening(buildIntent(ctx, lang))
  }

  // SpeechRecognizer لا يقبل إلا الخيط الرئيسي. enroll/diagnose تستدعيها من خيط خلفي،
  // فنؤجل التدمير الفعلي للخيط الرئيسي بدل أن يفشل بصمت ويبقى الميكروفون محجوزًا.
  fun release() {
    gen++
    listening = false
    val r = recognizer
    recognizer = null
    if (r == null) return
    val destroy = {
      try { r.cancel() } catch (e: Exception) {}
      try { r.destroy() } catch (e: Exception) {}
    }
    if (Looper.myLooper() == Looper.getMainLooper()) destroy() else main.post { destroy() }
  }
}
