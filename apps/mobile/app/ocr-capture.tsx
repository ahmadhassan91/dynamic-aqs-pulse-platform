import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { PreviewLeadOcrCaptureResponse } from '@pulse/contracts/leads';
import { Card, ErrorState, LoadingState, Pill, Screen, SectionTitle } from '@/components/native-kit';
import { mimeTypeFromFileName, uriToBase64 } from '@/lib/media';
import { previewLeadOcrCapture } from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

export default function OcrCaptureScreen() {
  const { apiBaseUrl, auth } = useSession();
  const [manualText, setManualText] = useState('');
  const [result, setResult] = useState<PreviewLeadOcrCaptureResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function scanFromImage(useCamera: boolean) {
    if (!auth) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Camera access is required to scan a business card.');
        }
      }

      const picked = useCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85, base64: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85, base64: false });

      if (picked.canceled || !picked.assets[0]) {
        setIsLoading(false);
        return;
      }

      const asset = picked.assets[0];
      const fileName = asset.fileName ?? `business-card-${Date.now()}.jpg`;
      const contentBase64 = await uriToBase64(asset.uri);
      const preview = await previewLeadOcrCapture(apiBaseUrl, auth.tokens.accessToken, {
        documentType: 'business_card',
        fileName,
        mimeType: asset.mimeType ?? mimeTypeFromFileName(fileName),
        contentBase64,
        serviceTechCountFallback: 1,
      });
      setResult(preview);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to preview OCR capture.');
    } finally {
      setIsLoading(false);
    }
  }

  async function scanManualText() {
    if (!auth) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const preview = await previewLeadOcrCapture(apiBaseUrl, auth.tokens.accessToken, {
        documentType: 'business_card',
        rawExtractionText: manualText,
        serviceTechCountFallback: 1,
      });
      setResult(preview);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to preview OCR capture.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Scan Business Card', headerShown: true }} />
      <Screen>
        <SectionTitle title="Scan business card" detail="Preview extracted lead fields before creating or updating a lead." />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Action label="Camera" onPress={() => void scanFromImage(true)} />
          <Action label="Gallery" onPress={() => void scanFromImage(false)} />
        </View>

        <Card>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            Paste text fallback
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            Useful when testing OCR rules or when a photo is not available.
          </Text>
          <TextInput
            value={manualText}
            onChangeText={setManualText}
            multiline
            placeholder="Company, contact, phone, email, address..."
            placeholderTextColor={colors.subtle}
            style={{
              minHeight: 118,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.md,
              textAlignVertical: 'top',
              ...typography.body,
            }}
          />
          <Action label="Preview pasted text" disabled={!manualText.trim()} onPress={() => void scanManualText()} />
        </Card>

        {isLoading ? <LoadingState label="Reading card..." /> : null}
        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {result ? <OcrResult result={result} /> : null}
      </Screen>
    </>
  );
}

function OcrResult({ result }: { result: PreviewLeadOcrCaptureResponse }) {
  const fields = result.fields;
  return (
    <>
      <SectionTitle title="Review extracted lead" detail="This is preview-only; lead creation stays behind a review step." />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            OCR Preview
          </Text>
          <Pill label={result.lowConfidence ? 'Needs review' : 'Ready'} tone={result.lowConfidence ? 'review' : 'active'} />
        </View>
        <FieldRow label="Company" value={fields.companyName?.value} confidence={fields.companyName?.confidence} />
        <FieldRow label="Contact" value={fields.contactDisplayName?.value} confidence={fields.contactDisplayName?.confidence} />
        <FieldRow label="Email" value={fields.email?.value} confidence={fields.email?.confidence} />
        <FieldRow label="Phone" value={fields.phone?.value} confidence={fields.phone?.confidence} />
        <FieldRow label="State" value={fields.state?.value} confidence={fields.state?.confidence} />
        <FieldRow label="Service techs" value={fields.serviceTechCount?.value} confidence={fields.serviceTechCount?.confidence} />
        {result.reviewReasons.length ? (
          <View style={{ gap: spacing.xs }}>
            <Text selectable style={{ ...typography.caption, color: colors.warning, textTransform: 'uppercase' }}>
              Review reasons
            </Text>
            {result.reviewReasons.map((reason) => (
              <Text key={reason} selectable style={{ ...typography.callout, color: colors.muted }}>
                {reason}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>
    </>
  );
}

function FieldRow({
  confidence,
  label,
  value,
}: {
  confidence: number | undefined;
  label: string;
  value: string | number | undefined;
}) {
  return (
    <View style={{ gap: 2 }}>
      <Text selectable style={{ ...typography.caption, color: colors.subtle, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ ...typography.callout, color: value ? colors.text : colors.muted }}>
        {value ? `${value}${confidence !== undefined ? ` · ${Math.round(confidence * 100)}%` : ''}` : 'Not extracted'}
      </Text>
    </View>
  );
}

function Action({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        borderRadius: radius.md,
        backgroundColor: disabled ? colors.border : colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <Text style={{ ...typography.callout, color: disabled ? colors.subtle : colors.white, fontWeight: '800', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
