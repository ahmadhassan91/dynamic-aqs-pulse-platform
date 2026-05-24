import { Linking, Pressable, Text, View } from 'react-native';
import type { DigitalAssetSummary } from '@pulse/contracts/digital-assets';
import { Card, EmptyState, ErrorState, Field, HeroCard, LoadingState, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { useMobileAssets } from '@/hooks/use-mobile-assets';
import { colors, spacing, typography } from '@/theme';

export default function AssetsScreen() {
  const { assets, cache, clearSearch, createShareForSelectedAsset, errorMessage, isLoading, isSharing, loadAssets, search, selectedAsset, selectAsset, setSearch, shareUrl, submitSearch } = useMobileAssets();

  return (
    <Screen>
      <HeroCard title="Asset Library" eyebrow="Customer sharing" icon={{ name: 'photo.on.rectangle.angled', fallback: 'A' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Find approved product photos, brochures, spec sheets, and videos. Share CRM-generated links with prospects or dealers.
        </Text>
      </HeroCard>

      <Field label="Search assets" value={search} onChangeText={setSearch} placeholder="Product, brochure, Widen ID..." returnKeyType="search" onSubmitEditing={submitSearch} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <SecondaryButton label="Search" icon={{ name: 'magnifyingglass.circle.fill', fallback: 'S' }} onPress={submitSearch} />
        <SecondaryButton label="Refresh" icon={{ name: 'arrow.clockwise.circle.fill', fallback: 'R' }} onPress={() => void loadAssets()} />
        {search ? <SecondaryButton label="Clear" icon={{ name: 'xmark.circle.fill', fallback: 'X' }} onPress={clearSearch} /> : null}
      </View>

      {cache.cachedAt ? (
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          Cached metadata from {formatCacheDate(cache.cachedAt)}. Files are opened from CRM links; binary offline file cache is parked until storage policy is approved.
        </Text>
      ) : null}
      {cache.errorMessage ? <ErrorState message={`Asset cache warning: ${cache.errorMessage}`} /> : null}
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
              <Text selectable style={{ ...typography.caption, color: colors.primary }}>
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
        <EmptyState title="No active assets found" detail="Refresh when connected, or check that the asset is active and visible for field sharing." />
      ) : null}

    </Screen>
  );
}

function AssetCard({ asset, onPress, selected }: { asset: DigitalAssetSummary; onPress: () => void; selected: boolean }) {
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
    asset.widenAssetId ? `Widen ${asset.widenAssetId}` : null,
  ].filter(Boolean).join(' · ') || 'Approved asset metadata';
}

function formatCacheDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
