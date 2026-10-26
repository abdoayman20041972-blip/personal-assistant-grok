import React from 'react';
import { Pressable, Text, View } from 'react-native';

// شريط التبويبات السفلي — تصميم أنظف
export default function BottomBar({ s, c, items, tab, onChange, bottomInset = 16 }) {
  return (
    <View style={[s.bottomBar, { paddingBottom: 8 + bottomInset }]}>
      {items.map(([k, icon, label]) => {
        const on = tab === k;
        return (
          <Pressable
            key={k}
            style={[s.bTab, on && s.bTabOn]}
            onPress={() => onChange(k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={s.bIcon}>{icon}</Text>
            <Text style={[s.bText, on && s.bTextOn]} numberOfLines={1}>
              {label}
            </Text>
            {on && c ? (
              <View
                style={{
                  marginTop: 4,
                  width: 16,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: c.accent,
                }}
              />
            ) : (
              <View style={{ marginTop: 4, height: 3 }} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
