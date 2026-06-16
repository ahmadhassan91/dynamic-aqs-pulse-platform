import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { MobileNextActionProvider } from '@/hooks/use-mobile-next-actions';
import { SessionProvider, useSession } from '@/providers/session-provider';
import { ThemeProvider, useTheme } from '@/providers/theme-provider';
import { colors } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });

  if (!fontsLoaded) {
    // Pre-provider splash: static light palette (the ThemeProvider is not mounted yet).
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <SessionGate />
          <ThemedStatusBar />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function SessionGate() {
  const { auth, isHydrated } = useSession();
  const { palette: colors } = useTheme();
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
    return <Redirect href="/" />;
  }

  return (
    <MobileNextActionProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          // Pushed detail screens (account, sync status, …) enable their own header; show just the
          // chevron so the back button never surfaces the "(tabs)" route-group name.
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </MobileNextActionProvider>
  );
}
