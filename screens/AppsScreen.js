import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { topUsed } from '../commandStore';
import { tokens } from '../matcher';
import { matchesSearch } from '../search';
import AppTile from '../components/AppTile';

// تبويب «تطبيقاتي»: الترويسة وخانة الكتابة والميكروفون جزء من القائمة نفسها فتتحرك معها
export default function AppsScreen({ s, c, apps, loadingApps, usage, launcher, voice, msgBox, onTeachText }) {
  const { text, setText, listening, run, openApp, toggleListen } = launcher;
  const pulse = useRef(new Animated.Value(0)).current;

  // حلقة نبض حول زر الميكروفون أثناء الاستماع
  useEffect(() => {
    if (!listening) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  const shownApps = useMemo(() => apps.filter((a) => matchesSearch(a, text)), [apps, text]);
  const appByPkg = useMemo(() => new Map(apps.map((a) => [a.pkg, a])), [apps]);
  const topApps = useMemo(() => topUsed(usage, 6).map((p) => appByPkg.get(p)).filter(Boolean), [usage, appByPkg]);
  const recentApps = useMemo(() => usage.recent.map((p) => appByPkg.get(p)).filter(Boolean), [usage, appByPkg]);

  const header = (
    <View>
      <View style={s.header}>
        <View style={s.headerTexts}>
          <Text style={s.title}>افتح لي</Text>
          <Text style={s.subtitle}>قل الاسم… وأنا أفتحه</Text>
        </View>
        <View style={s.logo}>
          <Text style={s.logoText}>🎤</Text>
        </View>
      </View>

      <View style={s.inputRow}>
        <Pressable style={s.goBtn} onPress={() => run(text)} accessibilityRole="button" accessibilityLabel="افتح">
          <Text style={s.goText}>افتح</Text>
        </Pressable>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => run(text)}
          placeholder="اكتب: افتحلي يوتيوب"
          placeholderTextColor={c.sub}
          returnKeyType="go"
          textAlign="right"
          autoCorrect={false}
        />
        <View style={s.micWrap}>
          {listening ? (
            <Animated.View
              pointerEvents="none"
              style={[s.heroRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }]}
            />
          ) : null}
          <Pressable style={[s.heroMic, listening && s.heroMicOn]} onPress={toggleListen} accessibilityRole="button" accessibilityLabel={listening ? 'إيقاف الاستماع' : 'تحدث بالصوت'}>
            <Text style={s.heroMicText}>{listening ? '■' : '🎤'}</Text>
          </Pressable>
        </View>
      </View>

      {msgBox}

      {!text.trim() && (topApps.length || recentApps.length) ? (
        <View style={s.usageBox}>
          {topApps.length ? (
            <View>
              <Text style={s.usageTitle}>الأكثر استخداماً</Text>
              <View style={s.chipRow}>
                {topApps.map((a) => (
                  <Pressable key={`top-${a.pkg}`} style={s.chip} onPress={() => openApp(a)} accessibilityRole="button" accessibilityLabel={`افتح ${a.name}`}>
                    <Text style={s.chipText} numberOfLines={1}>{a.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {recentApps.length ? (
            <View style={{ marginTop: topApps.length ? 10 : 0 }}>
              <Text style={s.usageTitle}>آخر ما فتحته</Text>
              <View style={s.chipRow}>
                {recentApps.map((a) => (
                  <Pressable key={`recent-${a.pkg}`} style={s.chip} onPress={() => openApp(a)} accessibilityRole="button" accessibilityLabel={`افتح ${a.name}`}>
                    <Text style={s.chipText} numberOfLines={1}>{a.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      key="apps-grid"
      data={loadingApps ? [] : shownApps}
      keyExtractor={(a) => a.pkg}
      numColumns={3}
      contentContainerStyle={s.grid}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={18}
      maxToRenderPerBatch={18}
      windowSize={9}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loadingApps ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={c.accent} />
        ) : (
          <View>
            <Text style={s.empty}>{apps.length ? 'مفيش تطبيق بالاسم ده.' : 'القائمة فاضية. من الإعدادات اضغط "تحديث قائمة التطبيقات".'}</Text>
            {apps.length && text.trim() ? (
              <Pressable style={s.teachBtnCenter} onPress={() => onTeachText(tokens(text).join(' '))} accessibilityRole="button">
                <Text style={s.teachText}>علّمني «{text.trim()}» كأمر جديد</Text>
              </Pressable>
            ) : null}
          </View>
        )
      }
      renderItem={({ item }) => (
        <AppTile s={s} app={item} hasVoice={voice.voicePrints.some((v) => v.pkg === item.pkg)} onOpen={openApp} onVoiceMenu={voice.voiceMenu} />
      )}
    />
  );
}
