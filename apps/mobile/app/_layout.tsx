import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/providers/session-provider';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <SessionGate />
        <StatusBar style="dark" />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function SessionGate() {
  const { auth, isHydrated } = useSession();
  const segments = useSegments();

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const inAuthGroup = segments[0] === 'auth';

  if (!auth && !inAuthGroup) {
    return <Redirect href="/auth/login" />;
  }

  if (auth && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
