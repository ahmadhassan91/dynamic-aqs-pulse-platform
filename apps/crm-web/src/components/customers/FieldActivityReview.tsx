'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconRefresh, IconX } from '@tabler/icons-react';
import type { MobileVoiceNoteReviewActionKey, MobileVoiceNoteReviewStatusKey, MobileVoiceNoteSentimentKey, MobileVoiceNoteSummary } from '@pulse/contracts/mobile-voice-notes';
import { fetchFieldActivityReviewQueue, reviewFieldActivityVoiceNote } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type ReviewFilter = MobileVoiceNoteReviewStatusKey;
type FieldActivityForm = {
  summary: string;
  nextStep: string;
  sentiment: MobileVoiceNoteSentimentKey;
  tags: string;
  reviewNotes: string;
  writebackAction: MobileVoiceNoteReviewActionKey;
  followUpTitle: string;
  followUpDueAt: string;
  followUpPriority: 'low' | 'normal' | 'high' | 'urgent';
};

const REVIEW_FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'pending_review', label: 'Needs Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function FieldActivityReview() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [items, setItems] = useState<MobileVoiceNoteSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('pending_review');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FieldActivityForm>({
    summary: '',
    nextStep: '',
    sentiment: 'neutral',
    tags: '',
    reviewNotes: '',
    writebackAction: 'activity_only',
    followUpTitle: '',
    followUpDueAt: '',
    followUpPriority: 'normal',
  });

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0] ?? null, [items, selectedId]);
  const counts = useMemo(() => ({
    pending: items.filter((item) => item.reviewStatus === 'pending_review').length,
    failed: items.filter((item) => item.processingStatus === 'failed' || item.processingStatus === 'needs_review').length,
    approved: items.filter((item) => item.reviewStatus === 'approved').length,
  }), [items]);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setForm({
      summary: selected.structuredSummary ?? selected.rawTranscript ?? '',
      nextStep: selected.structuredNextStep ?? '',
      sentiment: normalizeSentiment(selected.structuredSentiment),
      tags: selected.structuredTags.join(', '),
      reviewNotes: selected.reviewNotes ?? '',
      writebackAction: 'activity_only',
      followUpTitle: selected.structuredNextStep ?? '',
      followUpDueAt: '',
      followUpPriority: selected.structuredSentiment === 'urgent' ? 'urgent' : 'normal',
    });
  }, [selected]);

  const loadQueue = useCallback(async () => {
    if (!auth) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchFieldActivityReviewQueue(apiBaseUrl, auth.tokens.accessToken, {
        reviewStatus: reviewFilter,
        ...(search.trim() ? { search: search.trim() } : {}),
        limit: 50,
      });
      setItems(response.items);
      setSelectedId((current) => response.items.some((item) => item.id === current) ? current : response.items[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, auth, reviewFilter, search]);

  useEffect(() => {
    if (isHydrated && auth) {
      void loadQueue();
    }
  }, [isHydrated, auth, loadQueue]);

  async function submitReview(decision: 'approve' | 'reject') {
    if (!auth || !selected) return;
    setIsSaving(true);
    setError(null);
    try {
      const reviewed = await reviewFieldActivityVoiceNote(apiBaseUrl, auth.tokens.accessToken, selected.id, {
        decision,
        structuredSummary: form.summary,
        structuredNextStep: form.nextStep,
        structuredSentiment: form.sentiment,
        structuredTags: splitTags(form.tags),
        reviewNotes: form.reviewNotes,
        ...(decision === 'reject' ? { rejectedReason: form.reviewNotes || 'Rejected during field activity review.' } : {}),
        ...(decision === 'approve' ? {
          writebackAction: form.writebackAction,
          ...(form.writebackAction !== 'activity_only' ? {
            followUpTitle: form.followUpTitle || form.nextStep || form.summary,
            followUpDescription: form.reviewNotes || form.summary,
            followUpPriority: form.followUpPriority,
            ...(form.followUpDueAt ? { followUpDueAt: form.followUpDueAt } : {}),
          } : {}),
        } : {}),
      });
      setItems((current) => current.map((item) => item.id === reviewed.id ? reviewed : item).filter((item) => item.reviewStatus === reviewFilter));
      setSelectedId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  if (!isHydrated || !auth) {
    return null;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1}>Field Activity Review</Title>
          <Text c="dimmed">Review mobile field notes before they become account or lead activity.</Text>
        </div>
        <Button leftSection={<IconRefresh size={16} />} variant="default" onClick={() => void loadQueue()} loading={isLoading}>
          Refresh
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Metric label="Needs review" value={String(counts.pending)} />
        <Metric label="Needs office attention" value={String(counts.failed)} />
        <Metric label="Approved in this view" value={String(counts.approved)} />
      </SimpleGrid>

      {error ? <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert> : null}

      <Paper withBorder radius="md" p="md">
        <Group align="flex-end">
          <Select
            label="Queue"
            data={REVIEW_FILTERS}
            value={reviewFilter}
            onChange={(value) => setReviewFilter((value as ReviewFilter | null) ?? 'pending_review')}
            w={220}
          />
          <TextInput
            label="Search"
            placeholder="Account, lead, note, or person"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button onClick={() => void loadQueue()} loading={isLoading}>Apply</Button>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm">
            <Title order={3}>Review Queue</Title>
            {isLoading ? <Loader size="sm" /> : <Badge variant="light">{items.length}</Badge>}
          </Group>
          {items.length === 0 ? (
            <Text c="dimmed" py="xl" ta="center">No field notes match this queue.</Text>
          ) : (
            <Table verticalSpacing="sm">
              <Table.Tbody>
                {items.map((item) => (
                  <Table.Tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(item.id)}>
                    <Table.Td>
                      <Text fw={700}>{displayVoiceNoteTarget(item)}</Text>
                      <Text size="sm" c="dimmed" lineClamp={2}>{item.structuredSummary ?? item.rawTranscript ?? item.title}</Text>
                      <Group gap="xs" mt={6}>
                        <Badge size="sm" color={reviewColor(item.reviewStatus)}>{formatStatus(item.reviewStatus)}</Badge>
                        <Badge size="sm" variant="outline">{item.createdByName ?? 'Field user'}</Badge>
                        {item.writebackTarget ? <Badge size="sm" variant="outline" color="green">{formatWritebackTarget(item.writebackTarget)}</Badge> : null}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        <Paper withBorder radius="md" p="md">
          {selected ? (
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Title order={3}>{displayVoiceNoteTarget(selected)}</Title>
                  <Text size="sm" c="dimmed">Captured by {selected.createdByName ?? 'field user'} · {formatDate(selected.recordedAt)}</Text>
                </div>
                <Badge color={reviewColor(selected.reviewStatus)}>{formatStatus(selected.reviewStatus)}</Badge>
              </Group>

              <Group>
                {selected.accountId ? <Button component={Link} href={`/customers/${selected.accountId}?tab=activity-docs`} variant="light">Open Account</Button> : null}
                {selected.leadId ? <Button component={Link} href={`/leads/${selected.leadId}?tab=activity`} variant="light">Open Lead</Button> : null}
                {selected.accountId ? <Button component={Link} href={`/customers/${selected.accountId}?tab=training`} variant="light">Open Training</Button> : null}
                {selected.consignmentSiteId ? <Button component={Link} href={`/consignment/${selected.consignmentSiteId}`} variant="light">Open Consignment</Button> : null}
              </Group>

              <Paper withBorder radius="md" p="sm" bg="gray.0">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">Raw field note</Text>
                <Text size="sm">{selected.rawTranscript ?? 'No transcript was captured.'}</Text>
              </Paper>

              <Textarea label="Reviewed summary" minRows={4} value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.currentTarget.value }))} />
              <Textarea label="Follow-up" minRows={2} value={form.nextStep} onChange={(event) => setForm((current) => ({ ...current, nextStep: event.currentTarget.value }))} />
              <Group grow>
                <Select
                  label="Sentiment"
                  data={[
                    { value: 'positive', label: 'Positive' },
                    { value: 'neutral', label: 'Neutral' },
                    { value: 'concern', label: 'Concern' },
                    { value: 'urgent', label: 'Urgent' },
                  ]}
                  value={form.sentiment}
                  onChange={(value) => setForm((current) => ({ ...current, sentiment: normalizeSentiment(value) }))}
                />
                <TextInput label="Tags" value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.currentTarget.value }))} />
              </Group>
              <Textarea label="Review note" minRows={2} value={form.reviewNotes} onChange={(event) => setForm((current) => ({ ...current, reviewNotes: event.currentTarget.value }))} />

              {selected.reviewStatus === 'pending_review' ? (
                <Paper withBorder radius="md" p="sm">
                  <Stack gap="sm">
                    <Select
                      label="After approval"
                      description="Choose only the real follow-up Dynamic wants created from this reviewed note."
                      data={reviewActionOptions(selected)}
                      value={form.writebackAction}
                      onChange={(value) => setForm((current) => ({ ...current, writebackAction: (value as MobileVoiceNoteReviewActionKey | null) ?? 'activity_only' }))}
                    />
                    {form.writebackAction !== 'activity_only' ? (
                      <SimpleGrid cols={{ base: 1, sm: 2 }}>
                        <TextInput
                          label="Follow-up title"
                          value={form.followUpTitle}
                          onChange={(event) => setForm((current) => ({ ...current, followUpTitle: event.currentTarget.value }))}
                        />
                        <Select
                          label="Priority"
                          data={[
                            { value: 'normal', label: 'Normal' },
                            { value: 'high', label: 'High' },
                            { value: 'urgent', label: 'Urgent' },
                            { value: 'low', label: 'Low' },
                          ]}
                          value={form.followUpPriority}
                          onChange={(value) => setForm((current) => ({ ...current, followUpPriority: (value as FieldActivityForm['followUpPriority'] | null) ?? 'normal' }))}
                        />
                        <TextInput
                          label="Due date"
                          type="date"
                          value={form.followUpDueAt}
                          onChange={(event) => setForm((current) => ({ ...current, followUpDueAt: event.currentTarget.value }))}
                        />
                      </SimpleGrid>
                    ) : null}
                  </Stack>
                </Paper>
              ) : selected.writebackTarget ? (
                <Alert color="green" variant="light">Approved action: {formatWritebackTarget(selected.writebackTarget)}</Alert>
              ) : null}

              <Group justify="flex-end">
                <Button color="red" variant="light" leftSection={<IconX size={16} />} onClick={() => void submitReview('reject')} loading={isSaving} disabled={selected.reviewStatus !== 'pending_review'}>
                  Reject
                </Button>
                <Button leftSection={<IconCheck size={16} />} onClick={() => void submitReview('approve')} loading={isSaving} disabled={selected.reviewStatus !== 'pending_review'}>
                  Approve & write activity
                </Button>
              </Group>
            </Stack>
          ) : (
            <Text c="dimmed" py="xl" ta="center">Select a field note to review.</Text>
          )}
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">{label}</Text>
      <Text size="xl" fw={800}>{value}</Text>
    </Paper>
  );
}

function normalizeSentiment(value: unknown): MobileVoiceNoteSentimentKey {
  return value === 'positive' || value === 'concern' || value === 'urgent' ? value : 'neutral';
}

function splitTags(value: string) {
  return value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 12);
}

function reviewActionOptions(note: MobileVoiceNoteSummary): { value: MobileVoiceNoteReviewActionKey; label: string }[] {
  const options: { value: MobileVoiceNoteReviewActionKey; label: string }[] = [
    { value: 'activity_only', label: 'Save reviewed note only' },
  ];
  if (note.trainingSessionId) {
    options.push({ value: 'create_training_follow_up', label: 'Create training follow-up' });
  }
  if (note.consignmentSiteId) {
    options.push({ value: 'create_consignment_work_item', label: 'Create consignment work item' });
  }
  return options;
}

function displayVoiceNoteTarget(note: MobileVoiceNoteSummary) {
  return note.accountName
    ?? note.leadName
    ?? note.trainingSessionTitle
    ?? note.consignmentSiteName
    ?? note.title
    ?? 'General field note';
}

function formatWritebackTarget(value: string) {
  if (value.startsWith('training_follow_up_task:')) return 'Training follow-up';
  if (value.startsWith('consignment_work_item:')) return 'Consignment work item';
  return formatStatus(value);
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reviewColor(value: string) {
  if (value === 'approved') return 'green';
  if (value === 'rejected') return 'red';
  return 'blue';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
