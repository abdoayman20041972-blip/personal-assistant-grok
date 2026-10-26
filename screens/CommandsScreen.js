import React, { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import AppPicker from '../components/AppPicker';

// تبويب «أوامري»: نموذج أمر جديد + الصيغ المحفوظة
export default function CommandsScreen({ s, c, apps, cmds, msgBox, onAdded }) {
  const { custom, newPhrase, setNewPhrase, picked, setPicked, addCommand, removeOneAlias, removeWholeApp } = cmds;
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
    <FlatList
      key="cmds-list"
      data={custom}
      keyExtractor={(x) => x.pkg}
      contentContainerStyle={s.grid}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={s.form}>
          <Text style={s.pageTitle}>أوامري</Text>
          {msgBox}
          <Text style={[s.formTitle, { marginTop: 14 }]}>أمر جديد</Text>
          <TextInput
            style={s.input}
            value={newPhrase}
            onChangeText={setNewPhrase}
            placeholder="الجملة اللي هتقولها، مثال: مزرعتي"
            placeholderTextColor={c.sub}
            textAlign="right"
            autoCorrect={false}
          />
          <Text style={s.formLabel}>التطبيق اللي يفتحه:</Text>
          <Pressable style={s.pickerBtn} onPress={() => setPickerOpen(true)} accessibilityRole="button">
            <Text style={[s.pickText, !picked && { color: c.sub }]} numberOfLines={1}>{picked ? picked.name : 'اضغط لاختيار التطبيق ▾'}</Text>
          </Pressable>
          <Pressable style={s.saveBtn} onPress={() => addCommand(onAdded)} accessibilityRole="button">
            <Text style={s.goText}>حفظ الأمر</Text>
          </Pressable>
          <Text style={[s.formTitle, { marginTop: 20 }]}>أوامري المحفوظة</Text>
          {custom.length ? <Text style={s.formLabel}>اضغط على أي صيغة لحذفها. تقدر تضيف لنفس التطبيق أكثر من صيغة.</Text> : null}
        </View>
      }
      ListEmptyComponent={<Text style={s.empty}>لسه ما أضفتش أوامر.</Text>}
      renderItem={({ item }) => (
        <View style={s.cmdCard}>
          <View style={s.cmdHead}>
            <Pressable onPress={() => removeWholeApp(item)} accessibilityRole="button" accessibilityLabel={`حذف كل صيغ ${item.name}`}>
              <Text style={s.del}>حذف الكل</Text>
            </Pressable>
            <Text style={s.cmdApp} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={s.chipRow}>
            {item.aliases.map((al) => (
              <Pressable key={al} style={s.aliasChip} onPress={() => removeOneAlias(item, al)} accessibilityRole="button" accessibilityLabel={`حذف ${al}`}>
                <Text style={s.aliasText}>{`${al}  ✕`}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    />
    <AppPicker
      s={s}
      c={c}
      visible={pickerOpen}
      apps={apps}
      selected={picked}
      onSelect={(a) => {
        setPicked(a);
        setPickerOpen(false);
      }}
      onClose={() => setPickerOpen(false)}
    />
    </>
  );
}
