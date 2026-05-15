import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { NativeIcon } from '@/components/native-kit';
import { colors } from '@/theme';

const icons: Record<string, { name: string; fallback: string }> = {
  index: { name: 'house.fill', fallback: 'H' },
  leads: { name: 'person.crop.circle.badge.plus', fallback: 'L' },
  accounts: { name: 'building.2.fill', fallback: 'A' },
  route: { name: 'map.fill', fallback: 'R' },
  consignment: { name: 'shippingbox.fill', fallback: 'C' },
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
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 66,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, focused }) => (
          <View
            style={{
              width: 32,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? colors.primarySoft : 'transparent',
            }}
          >
            <NativeIcon name={icons[route.name]?.name ?? 'circle'} fallback={icons[route.name]?.fallback ?? '.'} color={color} size={17} />
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Field Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="leads" options={{ title: 'Lead Inbox', tabBarLabel: 'Leads' }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarLabel: 'Accounts' }} />
      <Tabs.Screen name="route" options={{ title: 'Route Plan', tabBarLabel: 'Route' }} />
      <Tabs.Screen name="consignment" options={{ title: 'Consignment', tabBarLabel: 'Consign' }} />
    </Tabs>
  );
}
