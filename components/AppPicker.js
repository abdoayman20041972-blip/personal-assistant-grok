import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { matchesSearch } from '../search';

// نافذة اختيار تطبيق (بدل قائمة تمرير صغيرة داخل قائمة التمرير الرئيسية)
export default function AppPicker({ s, c, visible, apps, selected, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => apps.filter((a) => matchesSearch(a, q)), [apps, q]);

  function pick(a) {
    setQ('');
    onSelect(a);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.modalWrap}>
        <Text style={s.pageTitle}>اختر التطبيق</Text>
        <TextInput
          style={s.input}
          value={q}
          onChangeText={setQ}
          placeholder="ابحث عن التطبيق"
          placeholderTextColor={c.sub}
          textAlign="right"
          autoCorrect={false}
        />
        <FlatList
          style={{ marginTop: 10 }}
          data={list}
          keyExtractor={(a) => a.pkg}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          ListEmptyComponent={<Text style={s.empty}>مفيش تطبيق بالاسم ده.</Text>}
          renderItem={({ item }) => (
            <Pressable style={[s.pickItem, selected && selected.pkg === item.pkg && s.pickItemOn]} onPress={() => pick(item)}>
              <Text style={[s.pickText, selected && selected.pkg === item.pkg && { color: c.onAccent }]} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
          )}
        />
        <Pressable style={s.saveBtn} onPress={onClose} accessibilityRole="button">
          <Text style={s.goText}>إغلاق</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
