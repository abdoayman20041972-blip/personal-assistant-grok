import React from 'react';
import { Pressable, Text, View } from 'react-native';

// بطاقة الرسالة + أزرار الاختيار والتعليم — تصميم أنظف
export default function MessageBox({ s, c, message, choice, teachPhrase, onChoose, onTeach }) {
  const isWarn = message.kind === 'warn';
  const isOk = message.kind === 'ok';
  const borderColor = isWarn ? c.warn : isOk ? c.accent : c.border;
  const icon = isOk ? '✓' : isWarn ? '!' : 'i';
  const iconBg = isOk ? c.accent : isWarn ? c.warn : c.sub;

  return (
    <View style={[s.message, { borderColor, borderRightColor: borderColor }]}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{icon}</Text>
        </View>
        <Text style={[s.messageText, { flex: 1 }, isWarn && { color: c.warn }]}>{message.body}</Text>
      </View>
      {choice ? (
        <View style={s.choiceRow}>
          {choice.candidates.map((a) => (
            <Pressable
              key={a.pkg}
              style={[s.teachBtn, { marginLeft: 8 }]}
              onPress={() => onChoose(a, choice.phrase)}
              accessibilityRole="button"
            >
              <Text style={s.teachText}>
                {choice.candidates.length === 1 ? `نعم، افتح ${a.name}` : `افتح ${a.name}`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {teachPhrase ? (
        <Pressable style={s.teachBtn} onPress={onTeach} accessibilityRole="button">
          <Text style={s.teachText}>علّمني الأمر ده</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
