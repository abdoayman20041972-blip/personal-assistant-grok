import React from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

// تبويب «الإعدادات»: الدائرة العائمة، البصمة الصوتية، المظهر، النسخ الاحتياطي، تحديث القائمة
export default function SettingsScreen({ s, c, apps, loadApps, bubble, voice, cmds, theme }) {
  const { bubbleOn, toggleBubble } = bubble;
  const { voicePrints, voiceTh, diag, bumpTh, doDiagnose, doDeleteVoice } = voice;
  const { showImport, setShowImport, importText, setImportText, exportCommands, importCommands } = cmds;
  const { themeMode, changeTheme } = theme;

  const themeChoices = [
    ['auto', 'تلقائي'],
    ['light', 'فاتح'],
    ['dark', 'داكن'],
  ];

  return (
    <ScrollView contentContainerStyle={s.grid} keyboardShouldPersistTaps="handled">
      <Text style={s.pageTitle}>الإعدادات</Text>

      <View style={s.setCard}>
        <View style={s.bubbleCard0}>
          <Switch value={bubbleOn} onValueChange={toggleBubble} trackColor={{ false: c.border, true: c.accent }} thumbColor="#FFFFFF" />
          <View style={s.bubbleInfo}>
            <Text style={s.bubbleTitle}>الدائرة العائمة</Text>
            <Text style={s.bubbleSub}>
              {bubbleOn
                ? voicePrints.length
                  ? `شغالة. عندك ${voicePrints.length} بصمة أوفلاين — قول اسمها والدائرة تفهمك بلا نت`
                  : 'شغالة. اسحبها إلى ✕ أسفل الشاشة لإغلاقها'
                : 'بتظهر فوق أي تطبيق علشان تتكلم من أي مكان'}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.setCard}>
        <Text style={s.formTitle}>🎙️ البصمة الصوتية (أوفلاين)</Text>
        <Text style={s.tuneHint}>
          {voicePrints.length ? `${voicePrints.length} بصمة مسجلة. ` : ''}علشان تسجّل بصمة جديدة: دوس مطولًا على أي تطبيق في تبويب «تطبيقاتي».
        </Text>
        {voicePrints.map((v) => (
          <View key={v.id || v.pkg} style={s.vpRow}>
            <Pressable onPress={() => doDeleteVoice({ pkg: v.pkg, name: v.phrase })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`حذف بصمة ${v.phrase}`}>
              <Text style={s.del}>حذف</Text>
            </Pressable>
            <Text style={s.vpName} numberOfLines={1}>{v.phrase}</Text>
          </View>
        ))}
        {voicePrints.length ? (
          <View style={{ marginTop: 12 }}>
            <View style={s.tuneHead}>
              <View style={s.tuneThRow}>
                <Pressable style={s.tuneBtn} onPress={() => bumpTh(-0.04)} accessibilityRole="button" accessibilityLabel="تقليل العتبة">
                  <Text style={s.tuneBtnText}>−</Text>
                </Pressable>
                <Text style={s.tuneVal}>العتبة {voiceTh.toFixed(2)}</Text>
                <Pressable style={s.tuneBtn} onPress={() => bumpTh(0.04)} accessibilityRole="button" accessibilityLabel="زيادة العتبة">
                  <Text style={s.tuneBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={s.tuneTitle}>⚙️ ضبط البصمة</Text>
            </View>
            <Text style={s.tuneHint}>
              جرّب تقول اسم التطبيق 5 مرات وشوف الأرقام: لو المسافة أعلى من العتبة رغم إن نطقك صح، ارفعها بالـ +. لو فتحت تطبيق غلط، قللها بالـ −.
            </Text>
            <Pressable style={s.tuneTest} onPress={doDiagnose} accessibilityRole="button">
              <Text style={s.tuneTestText}>🧪 اختبر بصمتك (تسجيلة بلا فتح أي حاجة)</Text>
            </Pressable>
            {diag ? (
              <Text style={s.tuneDiag}>
                آخر اختبار: «{diag.bestPhrase}» — مسافة {diag.bestD.toFixed(2)} / عتبة {diag.threshold.toFixed(2)}{' '}
                {diag.matched ? '✅ هتُقبل' : '⛔ هتُرفض'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={s.setCard}>
        <Text style={s.formTitle}>🎨 المظهر</Text>
        <View style={s.themeRow}>
          {themeChoices.map(([k, label]) => (
            <Pressable key={k} style={[s.themeBtn, themeMode === k && s.themeBtnOn]} onPress={() => changeTheme(k)} accessibilityRole="button">
              <Text style={[s.themeText, themeMode === k && { color: c.onAccent }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.setCard}>
        <Text style={s.formTitle}>نسخة احتياطية للأوامر</Text>
        <Text style={s.formLabel}>صدّر أوامرك واحفظها في أي مكان، أو الصق نسخة سابقة لاسترجاعها. الاستيراد يضيف ولا يمسح شيئًا.</Text>
        <View style={s.backupRow}>
          <Pressable style={s.saveBtnHalf} onPress={() => setShowImport((v) => !v)} accessibilityRole="button">
            <Text style={s.goText}>{showImport ? 'إخفاء الاستيراد' : 'استيراد'}</Text>
          </Pressable>
          <Pressable style={s.saveBtnHalf} onPress={exportCommands} accessibilityRole="button">
            <Text style={s.goText}>تصدير الأوامر</Text>
          </Pressable>
        </View>
        {showImport ? (
          <View>
            <TextInput
              style={[s.input, s.importInput]}
              value={importText}
              onChangeText={setImportText}
              placeholder="الصق هنا النص الذي نسخته من التصدير"
              placeholderTextColor={c.sub}
              multiline
              textAlign="right"
              autoCorrect={false}
            />
            <Pressable style={s.saveBtn} onPress={importCommands} accessibilityRole="button">
              <Text style={s.goText}>استيراد الآن</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Pressable style={s.setCard} onPress={loadApps} accessibilityRole="button">
        <Text style={s.refreshText}>🔄 تحديث قائمة التطبيقات ({apps.length})</Text>
      </Pressable>
    </ScrollView>
  );
}
