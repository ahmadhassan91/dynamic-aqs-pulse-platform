import { Tabs, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { NativeIcon } from '@/components/native-kit';
import { useMobileNextActions } from '@/hooks/use-mobile-next-actions';
import { colors } from '@/theme';

const icons: Record<string, { name: string; fallback: string }> = {
  index: { name: 'house.fill', fallback: 'H' },
  leads: { name: 'person.crop.circle.badge.plus', fallback: 'L' },
  accounts: { name: 'building.2.fill', fallback: 'A' },
  route: { name: 'map.fill', fallback: 'R' },
  map: { name: 'mappin.and.ellipse', fallback: 'M' },
  'voice-notes': { name: 'mic.circle.fill', fallback: 'V' },
  consignment: { name: 'shippingbox.fill', fallback: 'C' },
  more: { name: 'ellipsis.circle.fill', fallback: 'M' },
  training: { name: 'graduationcap.fill', fallback: 'T' },
};

export default function TabsLayout() {
  const { nextActions } = useMobileNextActions();
  const notificationCount = nextActions.badgeCount;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerRight: () => <HeaderBellButton count={notificationCount} />,
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 66,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
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
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarLabel: 'Today' }} />
      <Tabs.Screen name="route" options={{ title: 'Route Plan', tabBarLabel: 'Route' }} />
      <Tabs.Screen name="map" options={{ title: 'Field Map', tabBarLabel: 'Map' }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarLabel: 'More' }} />
      <Tabs.Screen name="leads" options={{ title: 'Lead Inbox', href: null }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', href: null }} />
      <Tabs.Screen name="voice-notes" options={{ title: 'Voice Notes', href: null }} />
      <Tabs.Screen name="consignment" options={{ title: 'Consignment', tabBarLabel: 'Consign' }} />
      <Tabs.Screen name="training" options={{ title: 'Training', href: null }} />
    </Tabs>
  );
}

function HeaderBellButton({ count }: { count: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${count} field notification${count === 1 ? '' : 's'}` : 'Open notifications'}
      onPress={() => router.push('/notifications')}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        marginRight: 12,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <NativeIcon name={count > 0 ? 'bell.badge.fill' : 'bell.fill'} fallback="!" color={count > 0 ? colors.danger : colors.primary} size={18} />
      {count > 0 ? (
        <View
          style={{
            position: 'absolute',
            right: 3,
            top: 5,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 10, lineHeight: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            {count > 9 ? '9+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
