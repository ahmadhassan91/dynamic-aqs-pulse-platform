import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Card, ErrorState, Field, HeroCard, PrimaryButton, Screen, SecondaryButton } from '@/components/native-kit';
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
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', paddingTop: spacing.xxxl, paddingBottom: spacing.lg }}>
          <PulseLogo />
        </View>

        <HeroCard title="Pulse Field" eyebrow="Mobile workspace" icon={{ name: 'iphone.gen3', fallback: 'P' }}>
          <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
            Sign in with your Pulse CRM account to open the field workspace.
          </Text>
        </HeroCard>

        <Card style={{ gap: spacing.lg }}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@dynamicaqs.com" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" />
          <PrimaryButton label={isSigningIn ? 'Signing in...' : 'Sign in'} icon={{ name: 'arrow.right.circle.fill', fallback: 'Go' }} onPress={handleSignIn} disabled={!canSubmit} />
        </Card>

        {errorMessage ? <ErrorState message={errorMessage} /> : null}

        <Card style={{ backgroundColor: colors.surfaceMuted }}>
          <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
            API Environment
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            Production is used by default. QA can switch to a local API without fighting the keyboard.
          </Text>
          <Field
            label="Base URL"
            value={apiBaseUrl}
            onChangeText={setApiBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            selectTextOnFocus
            placeholder="https://pulse-crm.theclustox.com"
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Production" icon={{ name: 'checkmark.seal.fill', fallback: 'P' }} onPress={() => setApiBaseUrl('https://pulse-crm.theclustox.com')} />
            </View>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Local QA" icon={{ name: 'desktopcomputer', fallback: 'Q' }} onPress={() => setApiBaseUrl('http://127.0.0.1:8111')} />
            </View>
          </View>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
