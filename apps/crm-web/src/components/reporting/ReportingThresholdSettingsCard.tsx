'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Group, NumberInput, Stack, Text } from '@mantine/core';
import { fetchReportingThresholdSettingsApi, updateReportingThresholdSettingsApi } from '@/lib/pulse-api-ext-reports';
import { usePulseSession } from '@/lib/pulse-session';

// FR-RPT-003: admin control for business-tunable reporting thresholds. Gated by the caller on
// admin.integration_manage (the API enforces it too). Currently exposes the active-account window.
export function ReportingThresholdSettingsCard() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const [windowDays, setWindowDays] = useState<number | string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await fetchReportingThresholdSettingsApi(apiBaseUrl, accessToken);
      setWindowDays(response.settings.activeAccountWindowDays);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const value = typeof windowDays === 'number' ? windowDays : Number(windowDays);
    if (!Number.isFinite(value) || value < 1) {
      setError('Enter a positive number of days.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await updateReportingThresholdSettingsApi(apiBaseUrl, accessToken, { activeAccountWindowDays: value });
      setWindowDays(response.settings.activeAccountWindowDays);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="sm">
        <Text fw={700}>Reporting thresholds</Text>
        <Text size="sm" c="dimmed">
          Tune the parameters behind dashboard KPIs. The active-account window defines how recently an account
          must have ordered to count as &ldquo;active&rdquo;.
        </Text>
        {error ? <Alert color="red" variant="light">{error}</Alert> : null}
        <Group align="flex-end" gap="sm">
          <NumberInput
            label="Active-account window (days)"
            value={windowDays}
            onChange={setWindowDays}
            min={1}
            max={3650}
            step={30}
            disabled={loading}
            w={220}
          />
          <Button onClick={() => void handleSave()} loading={saving} disabled={loading}>
            Save
          </Button>
          {saved ? <Text size="sm" c="green.7">Saved</Text> : null}
        </Group>
        <Text size="xs" c="dimmed">
          The active/lost-account counts that use this window fill in once the Acumatica order feed is connected.
        </Text>
      </Stack>
    </Card>
  );
}
