import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { avatarColor, initial } from '../theme';

export default function AppTile({ s, app, hasVoice, onOpen, onVoiceMenu }) {
  return (
    <Pressable
      style={s.tile}
      onPress={() => onOpen(app)}
      onLongPress={() => onVoiceMenu(app)}
      accessibilityRole="button"
      accessibilityLabel={`افتح ${app.name}، أو ضغط مطول لتسجيل البصمة الصوتية`}
    >
      <View style={[s.avatar, { backgroundColor: avatarColor(app.name) }, hasVoice && { borderWidth: 2, borderColor: '#F59E0B' }]}>
        <Text style={s.avatarText}>{initial(app.name)}</Text>
      </View>
      <Text style={s.tileText} numberOfLines={2}>
        {app.name}
      </Text>
      {hasVoice ? <Text style={s.tileBadge}>🎙️</Text> : null}
    </Pressable>
  );
}
