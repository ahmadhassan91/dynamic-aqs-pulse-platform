import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme';

const icons: Record<string, string> = {
  index: '⌂',
  leads: '+',
  accounts: '◎',
  sync: '↻',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 19, fontWeight: '800' }}>{icons[route.name] ?? '•'}</Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Field Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="leads" options={{ title: 'Lead Inbox', tabBarLabel: 'Leads' }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarLabel: 'Accounts' }} />
      <Tabs.Screen name="sync" options={{ title: 'Sync Status', tabBarLabel: 'Sync' }} />
    </Tabs>
  );
}
