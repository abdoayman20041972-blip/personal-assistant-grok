import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Pressable, Text, TextInput, View } from 'react-native';
import { tools } from '../features/tools/tools';
import { calculateTool, getToolFields } from '../features/tools/tool-engine';

// تبويب «الأدوات»: حسابات محلية بلا إنترنت ولا صلاحيات. المنطق كله في features/tools/ — هنا عرض فقط.
export default function ToolsScreen({ s, c, openToolId, onToolShown }) {
  const [toolId, setToolId] = useState(null);
  const [values, setValues] = useState({});
  const [results, setResults] = useState(null);
  const tool = useMemo(() => tools.find((t) => t.id === toolId) || null, [toolId]);

  // وصل طلب أداة من الأمر الصوتي/المكتوب («احسب الخصم»)
  useEffect(() => {
    if (openToolId) {
      select(openToolId);
      onToolShown && onToolShown();
    }
  }, [openToolId]);

  function select(id) {
    setToolId(id);
    setValues({});
    setResults(null);
  }

  return (
    <ScrollView contentContainerStyle={s.grid} keyboardShouldPersistTaps="handled">
      <Text style={s.pageTitle}>الأدوات</Text>
      {!tool ? (
        tools.map((t) => (
          <Pressable key={t.id} style={s.cmdCard} onPress={() => select(t.id)} accessibilityRole="button" accessibilityLabel={t.title}>
            <Text style={s.cmdApp}>{t.title}</Text>
            <Text style={s.formLabel}>{t.description}</Text>
          </Pressable>
        ))
      ) : (
        <View style={s.form}>
          <Pressable onPress={() => select(null)} accessibilityRole="button">
            <Text style={s.del}>◂ كل الأدوات</Text>
          </Pressable>
          <Text style={[s.formTitle, { marginTop: 10 }]}>{tool.title}</Text>
          {getToolFields(tool.id).map((f) => (
            <View key={f.key}>
              <Text style={s.formLabel}>{f.label}</Text>
              <TextInput
                style={s.input}
                value={values[f.key] || ''}
                onChangeText={(v) => setValues((x) => ({ ...x, [f.key]: v }))}
                placeholder={f.placeholder}
                placeholderTextColor={c.sub}
                keyboardType={f.keyboardType || 'default'}
                textAlign="right"
                autoCorrect={false}
              />
            </View>
          ))}
          <Pressable style={s.saveBtn} onPress={() => setResults(calculateTool(tool.id, values))} accessibilityRole="button">
            <Text style={s.goText}>احسب</Text>
          </Pressable>
          <Pressable style={s.refresh} onPress={() => select(tool.id)} accessibilityRole="button">
            <Text style={s.refreshText}>مسح</Text>
          </Pressable>
          {(results || []).map((r, i) => (
            <View key={i} style={s.cmdCard}>
              <Text style={s.formLabel}>{r.label}</Text>
              <Text style={[s.cmdApp, r.tone === 'danger' && { color: c.danger }]}>{r.value}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
