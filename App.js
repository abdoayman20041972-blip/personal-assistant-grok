import React, { useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { countAliases } from './commandStore';
import { useTheme } from './hooks/useTheme';
import { useKeyboardOpen } from './hooks/useKeyboardOpen';
import { useInsets } from './hooks/useInsets';
import { useApps } from './hooks/useApps';
import { useCommands } from './hooks/useCommands';
import { useVoice } from './hooks/useVoice';
import { useBubble } from './hooks/useBubble';
import { useLauncher } from './hooks/useLauncher';
import AppsScreen from './screens/AppsScreen';
import CommandsScreen from './screens/CommandsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ToolsScreen from './screens/ToolsScreen';
import MessageBox from './components/MessageBox';
import BottomBar from './components/BottomBar';

// App.js يركّب الأجزاء فقط. المنطق في hooks/ والشاشات في screens/ والألوان والأنماط في theme.js.
export default function App() {
  const theme = useTheme();
  const { c, s, isDark } = theme;
  const kbOpen = useKeyboardOpen();
  const insets = useInsets();

  const [tab, setTab] = useState('apps'); // apps | cmds | tools | settings
  const [toolRequest, setToolRequest] = useState(null); // أداة طلبها المستخدم بالأمر («احسب الخصم»)
  const [message, setMessage] = useState({ kind: 'info', body: 'اكتب أو قل بالميكروفون: "افتح واتساب"' });

  const { apps, loadingApps, loadApps } = useApps(setMessage);
  const cmds = useCommands(apps, setMessage);
  const voice = useVoice(setMessage);
  const bubble = useBubble(voice.ensureMic, setMessage);
  const launcher = useLauncher({
    apps,
    custom: cmds.custom,
    usage: cmds.usage,
    noteUse: cmds.noteUse,
    learnFrom: cmds.learnFrom,
    ensureMic: voice.ensureMic,
    setMessage,
    onOpenTool: (id) => {
      setToolRequest(id);
      setTab('tools');
    },
  });

  // «علّمني»: نملأ نموذج الأمر الجديد ونذهب لتبويب أوامري
  function teach(phrase) {
    cmds.prefillForm(phrase);
    setTab('cmds');
  }

  const msgBox = (
    <MessageBox
      s={s}
      c={c}
      message={message}
      choice={launcher.choice}
      teachPhrase={launcher.teachPhrase}
      onChoose={(app, phrase) => {
        launcher.openApp(app, phrase);
        launcher.setText('');
      }}
      onTeach={() => teach(launcher.teachPhrase)}
    />
  );

  const tabItems = [
    ['apps', '📱', `تطبيقاتي (${apps.length})`],
    ['cmds', '🗣️', `أوامري (${countAliases(cmds.custom)})`],
    ['tools', '🧮', 'الأدوات'],
    ['settings', '⚙️', 'الإعدادات'],
  ];

  return (
    <View style={s.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={s.flex} behavior="padding">
        {/* الشاشات الثلاث تبقى مركّبة (تُخفى فقط) فلا يضيع موضع التمرير ولا النص المكتوب عند التبديل */}
        <View style={s.flex}>
          <View style={[s.flex, tab !== 'apps' && s.hidden]}>
            <AppsScreen s={s} c={c} apps={apps} loadingApps={loadingApps} usage={cmds.usage} launcher={launcher} voice={voice} msgBox={msgBox} onTeachText={teach} />
          </View>
          <View style={[s.flex, tab !== 'cmds' && s.hidden]}>
            <CommandsScreen s={s} c={c} apps={apps} cmds={cmds} msgBox={msgBox} onAdded={() => launcher.setTeachPhrase(null)} />
          </View>
          <View style={[s.flex, tab !== 'tools' && s.hidden]}>
            <ToolsScreen s={s} c={c} openToolId={toolRequest} onToolShown={() => setToolRequest(null)} />
          </View>
          <View style={[s.flex, tab !== 'settings' && s.hidden]}>
            <SettingsScreen s={s} c={c} apps={apps} loadApps={loadApps} bubble={bubble} voice={voice} cmds={cmds} theme={theme} />
          </View>
        </View>
        {kbOpen ? null : <BottomBar s={s} c={c} items={tabItems} tab={tab} onChange={setTab} bottomInset={insets.bottom} />}
      </KeyboardAvoidingView>
    </View>
  );
}
