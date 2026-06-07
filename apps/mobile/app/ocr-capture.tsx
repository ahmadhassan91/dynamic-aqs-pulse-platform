import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Share, Text, TextInput, View } from 'react-native';
import type { PreviewLeadOcrCaptureResponse } from '@pulse/contracts/leads';
import { Card, ErrorState, HeroCard, LoadingState, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
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
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85, base64: true });

      if (picked.canceled || !picked.assets[0]) {
        setIsLoading(false);
        return;
      }

      const asset = picked.assets[0];
      const fileName = asset.fileName ?? `business-card-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? mimeTypeFromFileName(fileName);
      if (!mimeType.startsWith('image/')) {
        throw new Error('Unsupported business-card image type.');
      }
      if (asset.fileSize && asset.fileSize > 4_000_000) {
        throw new Error('Business-card image is too large. Choose a smaller image.');
      }
      const contentBase64 = asset.base64 ?? await uriToBase64(asset.uri);
      const preview = await previewLeadOcrCapture(apiBaseUrl, auth.tokens.accessToken, {
        documentType: 'business_card',
        fileName,
        mimeType,
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
    if (manualText.length > 5000) {
      setErrorMessage('Pasted business-card text is too long. Keep it under 5,000 characters.');
      return;
    }
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
        <HeroCard title="Scan card" eyebrow="Lead capture" icon={{ name: 'camera.viewfinder', fallback: 'S' }}>
          <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
            Capture a business card, preview extracted lead fields, then hand it to the governed lead workflow.
          </Text>
        </HeroCard>

        <Card style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              Preview first
            </Text>
            <Pill label="Review required" tone="review" />
          </View>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            The mobile app reads the card and shows the extracted fields here. Creating the final lead still goes through duplicate review, routing, and source attribution in Pulse CRM.
          </Text>
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="Camera" icon={{ name: 'camera.fill', fallback: 'C' }} onPress={() => void scanFromImage(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="Gallery" icon={{ name: 'photo.on.rectangle.angled', fallback: 'G' }} onPress={() => void scanFromImage(false)} />
          </View>
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
          <PrimaryButton label="Preview pasted text" disabled={!manualText.trim()} icon={{ name: 'text.viewfinder', fallback: 'OCR' }} onPress={() => void scanManualText()} />
        </Card>

        {isLoading ? <LoadingState label="Reading card..." /> : null}
        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {result ? <OcrResult result={result} /> : null}
      </Screen>
    </>
  );
}

function buildShareText(result: PreviewLeadOcrCaptureResponse): string {
  const f = result.fields;
  const lines = [
    '📋 OCR Lead Capture — Pulse CRM Review',
    '',
    `Company:  ${f.companyName?.value ?? '—'}`,
    `Contact:  ${f.contactDisplayName?.value ?? '—'}`,
    `Email:    ${f.email?.value ?? '—'}`,
    `Phone:    ${f.phone?.value ?? '—'}`,
    `State:    ${f.state?.value ?? '—'}`,
    `Service techs: ${f.serviceTechCount?.value ?? '—'}`,
    '',
    result.reviewReasons.length ? `Review flags: ${result.reviewReasons.join(', ')}` : 'No review flags.',
    '',
    'Create the lead in Pulse CRM: https://app.dynamicaqs.com/leads/new',
  ];
  return lines.join('\n');
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
      <Card>
        <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
          Next step
        </Text>
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          Review the extracted fields, then share this summary to create the lead in Pulse CRM. The full intake (duplicate review, routing, attribution) runs in the web app.
        </Text>
        <PrimaryButton
          label="Send to CRM review queue"
          icon={{ name: 'square.and.arrow.up', fallback: 'Share' }}
          onPress={() => void Share.share({ message: buildShareText(result) })}
        />
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
