import { router } from 'expo-router';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import type { DigitalAssetSummary } from '@pulse/contracts/digital-assets';
import { Card, EmptyState, ErrorState, Field, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { useMobileAssets } from '@/hooks/use-mobile-assets';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/providers/theme-provider';

export default function AssetsScreen() {
  const { palette: colors, isHighContrast, setHighContrast, scheme } = useTheme();
  const { assets, cache, clearSearch, createShareForSelectedAsset, errorMessage, isLoading, isSharing, loadAssets, search, selectedAsset, selectAsset, setSearch, shareUrl, submitSearch } = useMobileAssets();

  return (
    <Screen>
      <HeroCard title="More" eyebrow="Field assistant" icon={{ name: 'ellipsis.circle.fill', fallback: 'M' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Capture a note, check phone-saved work, or open a full queue without crowding Today.
        </Text>
      </HeroCard>

      <SectionTitle title="Display" detail="The app follows your device light/dark setting. Turn on High contrast for bright outdoor/sunlight readability." />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>High contrast</Text>
            <Text selectable style={{ ...typography.caption, color: colors.muted }}>
              Maximises contrast for bright light. The theme currently follows {scheme} mode.
            </Text>
          </View>
          <Switch
            value={isHighContrast}
            onValueChange={setHighContrast}
            accessibilityRole="switch"
            accessibilityLabel="High contrast theme"
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </Card>

      <SectionTitle title="Capture next" detail="Use Voice notes for the fastest field update. OCR and sync review stay one tap away when needed." />
      <View style={{ gap: spacing.md }}>
        <MoreAction
          detail="Record or type one update, choose the lead/account/training context, then send it for office review."
          icon={{ name: 'mic.circle.fill', fallback: 'V' }}
          label="Voice notes"
          onPress={() => router.push('./voice-notes')}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <QueueButton label="Review card OCR" icon={{ name: 'camera.viewfinder', fallback: 'S' }} onPress={() => router.push('/ocr-capture')} />
          <QueueButton label="Sync status" icon={{ name: 'arrow.triangle.2.circlepath.circle.fill', fallback: 'Sync' }} onPress={() => router.push('/sync-status')} />
        </View>
      </View>

      <SectionTitle title="Open a queue" detail="Lead inbox is the primary queue. Accounts, ROSE audits, and training are available for focused follow-up." />
      <PrimaryButton label="Open lead inbox" icon={{ name: 'person.crop.circle.badge.plus', fallback: 'L' }} onPress={() => router.push('/leads')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <QueueButton label="Accounts" icon={{ name: 'building.2.fill', fallback: 'A' }} onPress={() => router.push('/accounts')} />
        <QueueButton label="ROSE audits" icon={{ name: 'shippingbox.fill', fallback: 'C' }} onPress={() => router.push('/consignment')} />
        <QueueButton label="Training" icon={{ name: 'graduationcap.fill', fallback: 'T' }} onPress={() => router.push('/training')} />
      </View>

      <SectionTitle title="Asset Library" detail="Search once, choose one approved asset, then create a customer-safe share link." />
      <Field label="Search assets" value={search} onChangeText={setSearch} placeholder="Product, brochure, file name..." returnKeyType="search" onSubmitEditing={submitSearch} />
      <PrimaryButton label="Search asset library" icon={{ name: 'magnifyingglass.circle.fill', fallback: 'S' }} onPress={submitSearch} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <SecondaryButton label="Refresh" icon={{ name: 'arrow.clockwise.circle.fill', fallback: 'R' }} onPress={() => void loadAssets()} />
        {search ? <SecondaryButton label="Clear" icon={{ name: 'xmark.circle.fill', fallback: 'X' }} onPress={clearSearch} /> : null}
      </View>

      {cache.cachedAt ? (
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          Library refreshed {formatCacheDate(cache.cachedAt)}. Offline file downloads remain parked; open the approved link when you are ready to share.
        </Text>
      ) : null}
      {cache.errorMessage ? <ErrorState message={`Library refresh warning: ${cache.errorMessage}`} /> : null}
      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState label="Loading asset library..." /> : null}

      {selectedAsset ? (
        <>
          <SectionTitle title="Ready to share" detail="Review the selected asset, then create a customer-safe CRM link." />
          <Card style={{ borderColor: colors.primary, backgroundColor: colors.primarySoft }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              {selectedAsset.title}
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              {assetSummaryLine(selectedAsset)}
            </Text>
            {selectedAsset.currentVersion?.publicUrl ?? selectedAsset.currentVersion?.externalUrl ? (
              <SecondaryButton
                label="Open current file"
                icon={{ name: 'arrow.up.right.square.fill', fallback: 'Open' }}
                onPress={() => void Linking.openURL((selectedAsset.currentVersion?.publicUrl ?? selectedAsset.currentVersion?.externalUrl) as string)}
              />
            ) : null}
            <PrimaryButton disabled={isSharing} label={isSharing ? 'Creating link...' : 'Create customer share link'} icon={{ name: 'square.and.arrow.up.fill', fallback: 'Share' }} onPress={() => void createShareForSelectedAsset()} />
            {shareUrl ? (
              <Text selectable numberOfLines={2} style={{ ...typography.caption, color: colors.primary }}>
                {shareUrl}
              </Text>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionTitle title="Library" detail="Tap any asset below to switch what you are sharing." />
      {assets.length ? (
        <View style={{ gap: spacing.md }}>
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} selected={asset.id === selectedAsset?.id} onPress={() => selectAsset(asset.id)} />
          ))}
        </View>
      ) : !isLoading ? (
        <EmptyState title="No share-ready assets found" detail="Try a simpler search or refresh when connected. If an item is missing, ask marketing to confirm it is approved for field sharing." />
      ) : null}

    </Screen>
  );
}

function MoreAction({ detail, icon, label, onPress }: { detail: string; icon: { name: string; fallback: string }; label: string; onPress: () => void }) {
  const { palette: colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.lg }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.full,
              backgroundColor: colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <NativeIcon name={icon.name} fallback={icon.fallback} color={colors.primary} size={20} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text selectable={false} style={{ ...typography.subtitle, color: colors.text }}>
              {label}
            </Text>
            <Text selectable={false} style={{ ...typography.callout, color: colors.muted }}>
              {detail}
            </Text>
          </View>
          <NativeIcon name="chevron.right" fallback=">" color={colors.subtle} size={18} />
        </View>
      </Card>
    </Pressable>
  );
}

function QueueButton({ icon, label, onPress }: { icon: { name: string; fallback: string }; label: string; onPress: () => void }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1 }}>
      <SecondaryButton label={label} icon={icon} onPress={onPress} />
    </View>
  );
}

function AssetCard({ asset, onPress, selected }: { asset: DigitalAssetSummary; onPress: () => void; selected: boolean }) {
  const { palette: colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}>
      <Card {...(selected ? { style: { borderColor: colors.primary, backgroundColor: colors.primarySoft } } : {})}>
        <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
          {asset.title}
        </Text>
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          {asset.description || assetSummaryLine(asset)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Pill label={asset.kind} />
          <Pill label={asset.visibility} tone={asset.visibility === 'public' || asset.visibility === 'dealer_portal' ? 'active' : 'pending'} />
          <Pill label={asset.reviewStatus} tone={asset.reviewStatus === 'approved' ? 'active' : 'review'} />
        </View>
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          {asset.currentVersion?.fileName ?? asset.legacyFileName ?? asset.stableSlug}
        </Text>
      </Card>
    </Pressable>
  );
}

function assetSummaryLine(asset: DigitalAssetSummary) {
  return [
    asset.brandScope ? `Brand ${asset.brandScope}` : null,
    asset.regionScope ? `Region ${asset.regionScope}` : null,
    asset.productUsageCount !== undefined ? `${asset.productUsageCount} product use${asset.productUsageCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ') || 'Approved asset metadata';
}

function formatCacheDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
