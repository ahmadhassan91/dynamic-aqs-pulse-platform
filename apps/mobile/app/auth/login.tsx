import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Card, ErrorState, Field, PrimaryButton, Screen } from '@/components/native-kit';
import { PulseLogo } from '@/components/pulse-logo';
import { useSession } from '@/providers/session-provider';
import { colors, spacing, typography } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { apiBaseUrl, errorMessage, isSigningIn, setApiBaseUrl, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSigningIn;

  async function handleSignIn() {
    if (!canSubmit) return;
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await signIn({ email: email.trim(), password });
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', paddingTop: spacing.xxxl, paddingBottom: spacing.lg }}>
          <PulseLogo />
        </View>

        <Card style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={{ ...typography.title, color: colors.text }}>
              Sign in to Pulse Field
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              Use your Pulse CRM account to open the field workspace.
            </Text>
          </View>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@dynamicaqs.com" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" />
          <PrimaryButton label={isSigningIn ? 'Signing in...' : 'Sign in'} onPress={handleSignIn} disabled={!canSubmit} />
        </Card>

        {errorMessage ? <ErrorState message={errorMessage} /> : null}

        <Card style={{ backgroundColor: colors.surfaceMuted }}>
          <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
            API Environment
          </Text>
          <Field label="Base URL" value={apiBaseUrl} onChangeText={setApiBaseUrl} autoCapitalize="none" autoCorrect={false} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
