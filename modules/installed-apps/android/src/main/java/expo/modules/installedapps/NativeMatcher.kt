package expo.modules.installedapps

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import org.json.JSONArray

// طبقة المطابقة الأصلية الاحتياطية (شبكة أمان).
//
// المعمارية: المطابق الغني (matcher.js: تقريب إملائي، جسر عربي↔إنجليزي، تصويت) يعيش في JS.
// لكن الدائرة العائمة قد تُنطق بينما JS غير حي (التطبيق أُغلق/أُعيد تشغيله) — وقتها كان الأمر
// يضيع برسالة «افتح التطبيق مرة واحدة». هذه الطبقة تضمن حدًا أدنى يعمل دائمًا بلا JS:
//   1) أوامرك المخصصة المحفوظة (المرآة في Prefs) — مطابقة تامة بعد التنظيف.
//   2) اسم التطبيق كما يظهر على الجوال — مطابقة تامة (ولو تطابق أكثر من تطبيق نتركه غامضًا).
//   3) جدول صغير بأشهر الأسماء العربية الدارجة.
// لا تقريب إملائي هنا عمدًا: نفضّل ألا نفتح شيئًا على أن نفتح تطبيقًا غلطًا.
object NativeMatcher {
  private val main = Handler(Looper.getMainLooper())

  private val NOISE = setOf(
    "افتح", "افتحلي", "افتحي", "شغل", "شغلي", "شغللي", "روح", "وديني", "ودي", "طلعلي",
    "عايز", "عاوز", "اريد", "ابغي", "ابي", "محتاج", "نفسي", "ممكن", "لو", "سمحت", "من", "فضلك",
    "يا", "لي", "تطبيق", "برنامج", "اب", "التطبيق", "البرنامج", "خلي", "خليني", "هات", "هاتلي",
    "جيب", "جيبلي", "الو", "طب", "دلوقتي", "يلا", "بس", "اوبن", "open", "launch", "start",
    "please", "app", "the", "me", "to", "go"
  )
  private val VERB_STEMS = listOf(
    "افتح", "فتح", "شغل", "روح", "ودي", "طلع", "هات", "جيب", "خل", "عايز", "عاوز", "اريد", "ابغ", "ابي", "وريني", "ورني", "شوف"
  )
  private val VERB_SUFFIXES = setOf("", "ي", "لي", "ني", "ها", "ه", "هم", "ك", "وا", "و", "هالي")

  // أشهر الأسماء الدارجة → الحزمة (يُتحقق أنها مثبتة قبل الفتح)
  private val BUILTIN = mapOf(
    "واتساب" to "com.whatsapp", "واتس" to "com.whatsapp", "وتساب" to "com.whatsapp",
    "يوتيوب" to "com.google.android.youtube", "يوتوب" to "com.google.android.youtube",
    "فيسبوك" to "com.facebook.katana", "فيس بوك" to "com.facebook.katana", "فيس" to "com.facebook.katana",
    "ماسنجر" to "com.facebook.orca", "مسنجر" to "com.facebook.orca",
    "انستجرام" to "com.instagram.android", "انستا" to "com.instagram.android",
    "تليجرام" to "org.telegram.messenger", "تلجرام" to "org.telegram.messenger",
    "تيك توك" to "com.zhiliaoapp.musically", "تيكتوك" to "com.zhiliaoapp.musically",
    "كروم" to "com.android.chrome", "جيميل" to "com.google.android.gm",
    "خرائط" to "com.google.android.apps.maps", "بلاي ستور" to "com.android.vending"
  )
  private val builtinByKey: Map<String, String> by lazy { BUILTIN.mapKeys { key(it.key) } }

  data class Hit(val pkg: String, val name: String)

  fun normalize(text: String): String {
    val sb = StringBuilder()
    for (ch in text.lowercase()) {
      val c = when (ch) {
        'أ', 'إ', 'آ', 'ٱ' -> 'ا'
        'ى' -> 'ي'
        'ة' -> 'ه'
        'ؤ' -> 'و'
        'ئ' -> 'ي'
        else -> ch
      }
      val code = c.code
      if ((code in 0x064B..0x0652) || code == 0x0640) continue // تشكيل وتطويل
      if (c.isLetterOrDigit()) sb.append(c) else sb.append(' ')
    }
    return sb.toString().trim().replace(Regex("\\s+"), " ")
  }

  private fun stripAl(t: String): String = when {
    t.length > 4 && t.startsWith("لل") -> t.substring(2)
    t.length > 3 && t.startsWith("ال") -> t.substring(2)
    else -> t
  }

  private fun isCommandWord(t: String): Boolean {
    for (stem in VERB_STEMS) {
      if (t.startsWith(stem) && VERB_SUFFIXES.contains(t.substring(stem.length))) return true
    }
    return false
  }

  // نفس فكرة tokens() في matcher.js: تنظيف ثم حذف الحشو وأفعال الأمر
  fun key(text: String): String =
    normalize(text).split(" ")
      .filter { it.isNotEmpty() }
      .map { stripAl(it) }
      .filter { !NOISE.contains(it) && !isCommandWord(it) }
      .joinToString(" ")

  fun resolve(ctx: Context, phrases: List<String>): Hit? {
    val keys = phrases.map { key(it) }.filter { it.isNotEmpty() }.distinct()
    if (keys.isEmpty()) return null
    val pm = ctx.packageManager

    // 1) أوامر المستخدم المخصصة (مرآة JS في Prefs): [{ pkg, name, aliases: [...] }]
    try {
      val raw = Prefs.commandsJson(ctx)
      if (raw.isNotEmpty()) {
        val arr = JSONArray(raw)
        for (i in 0 until arr.length()) {
          val o = arr.optJSONObject(i) ?: continue
          val pkg = o.optString("pkg")
          val aliases = o.optJSONArray("aliases")
          if (pkg.isEmpty() || aliases == null) continue
          for (j in 0 until aliases.length()) {
            if (keys.contains(key(aliases.optString(j)))) return Hit(pkg, o.optString("name", pkg))
          }
        }
      }
    } catch (e: Exception) {}

    // 2) اسم التطبيق كما يظهر على الجوال — تطابق تام؛ لو أكثر من تطبيق فهو غامض فنتركه
    val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val hits = LinkedHashMap<String, String>()
    try {
      for (info in pm.queryIntentActivities(launcher, 0)) {
        val pkg = info.activityInfo.packageName
        if (pkg == ctx.packageName) continue
        val label = info.loadLabel(pm).toString()
        if (keys.contains(key(label))) hits[pkg] = label
      }
    } catch (e: Exception) {}
    if (hits.size == 1) {
      val e = hits.entries.first()
      return Hit(e.key, e.value)
    }
    if (hits.size > 1) return null

    // 3) الأسماء العربية الدارجة (بشرط أن يكون التطبيق مثبتًا)
    for (k in keys) {
      val pkg = builtinByKey[k] ?: continue
      if (pm.getLaunchIntentForPackage(pkg) == null) continue
      val name = try { pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString() } catch (e: Exception) { k }
      return Hit(pkg, name)
    }
    return null
  }

  // يفتح أول تطابق ويعيد true لو نجح. آمن من أي خيط.
  fun openFirst(ctx: Context, phrases: List<String>): Boolean {
    val hit = try { resolve(ctx, phrases) } catch (e: Exception) { null }
    if (hit == null) return false
    return try {
      val intent = ctx.packageManager.getLaunchIntentForPackage(hit.pkg)
      if (intent == null) {
        false
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        Prefs.recordUse(ctx, hit.pkg)
        main.post { Toast.makeText(ctx, "تم فتح ${hit.name}", Toast.LENGTH_SHORT).show() }
        true
      }
    } catch (e: Exception) {
      false
    }
  }
}
