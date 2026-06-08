'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Group, Modal, Paper, Select, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import type { CisFinanceDecisionRequest, CisFinanceDecisionStatusKey, FinanceQueueItem } from '@pulse/contracts';
import { fetchFinanceQueue } from '@/lib/pulse-api';
import { recordFinanceQueueDecision } from '@/lib/pulse-api-ext-leads-cis';
import { usePulseSession } from '@/lib/pulse-session';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';

export function LeadFinanceQueue() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [decisionFilter, setDecisionFilter] = useState<string>('pending');
  const [items, setItems] = useState<FinanceQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // UX-CIS-008: inline quick-action state
  const [actionTarget, setActionTarget] = useState<FinanceQueueItem | null>(null);
  const [quickDecision, setQuickDecision] = useState<Exclude<CisFinanceDecisionStatusKey, 'not_submitted' | 'pending'>>('approved');
  const [quickDecisionNotes, setQuickDecisionNotes] = useState('');
  const [isRecordingDecision, setIsRecordingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setItems([]);
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadQueue() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchFinanceQueue(apiBaseUrl, accessToken, {
          ...(decisionFilter ? { decisionStatus: decisionFilter as never } : {}),
        });
        if (!cancelled) {
          setItems(response.items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadQueue();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, decisionFilter]);

  async function handleQuickDecision() {
    if (!auth || !actionTarget) {
      return;
    }
    setIsRecordingDecision(true);
    setDecisionError(null);
    setDecisionSuccess(null);

    try {
      const payload: CisFinanceDecisionRequest = {
        decision: quickDecision,
        ...(quickDecisionNotes.trim() ? { decisionNotes: quickDecisionNotes.trim() } : {}),
      };
      await recordFinanceQueueDecision(apiBaseUrl, auth.tokens.accessToken, actionTarget.cisPackageId, payload);
      setDecisionSuccess(`Decision recorded: ${formatDecisionLabel(quickDecision)}`);
      setActionTarget(null);
      setQuickDecisionNotes('');
      // Refresh queue
      const response = await fetchFinanceQueue(apiBaseUrl, auth.tokens.accessToken, {
        ...(decisionFilter ? { decisionStatus: decisionFilter as never } : {}),
      });
      setItems(response.items);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRecordingDecision(false);
    }
  }

  if (!isHydrated || !auth) {
    return null;
  }

  return (
    <Stack gap="lg">
      <Paper shadow="sm" p="lg" radius="xl" className="premium-hero-panel">
        <Stack gap="xs">
          <Title order={1}>Finance Queue</Title>
          <Text size="sm" c="dimmed">
            Review CIS packages that are waiting for finance submission or decision inside the live production workflow.
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
        <Select
          label="Decision status"
          value={decisionFilter}
          onChange={(value) => setDecisionFilter(value ?? 'pending')}
          data={[
            { value: 'awaiting_submission', label: 'Awaiting submission' },
            { value: 'pending', label: 'Pending decision' },
            { value: 'info_requested', label: 'Info requested' },
            { value: 'approved', label: 'Approved' },
            { value: 'conditional', label: 'Conditional' },
            { value: 'declined', label: 'Declined' },
          ]}
          maw={280}
        />
      </Paper>

      {error ? (
        <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
          <Text c="red">{error}</Text>
        </Paper>
      ) : null}

      <Paper withBorder radius="xl" p="sm" className="premium-subhero-panel">
        <Table.ScrollContainer minWidth={980}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Company</Table.Th>
                <Table.Th>Contact</Table.Th>
                <Table.Th>CIS status</Table.Th>
                <Table.Th>Finance status</Table.Th>
                <Table.Th>Payment method</Table.Th>
                <Table.Th>Submitted</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr key={item.cisPackageId}>
                  <Table.Td fw={600}>{item.companyName}</Table.Td>
                  <Table.Td>{item.contactDisplayName}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="blue">{item.cisStatus}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="grape">{item.financeDecisionStatus}</Badge>
                  </Table.Td>
                  <Table.Td>{item.paymentMethod ?? '—'}</Table.Td>
                  <Table.Td>{item.submittedToFinanceAt ? formatDateTimeLabel(item.submittedToFinanceAt) : '—'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {/* UX-CIS-008: inline quick-action buttons */}
                      {item.financeDecisionStatus === 'pending' || item.financeDecisionStatus === 'info_requested' ? (
                        <>
                          <Button
                            size="xs"
                            color="green"
                            variant="light"
                            onClick={() => {
                              setActionTarget(item);
                              setQuickDecision('approved');
                              setQuickDecisionNotes('');
                              setDecisionError(null);
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() => {
                              setActionTarget(item);
                              setQuickDecision('declined');
                              setQuickDecisionNotes('');
                              setDecisionError(null);
                            }}
                          >
                            Decline
                          </Button>
                          <Button
                            size="xs"
                            color="orange"
                            variant="light"
                            onClick={() => {
                              setActionTarget(item);
                              setQuickDecision('info_requested');
                              setQuickDecisionNotes('');
                              setDecisionError(null);
                            }}
                          >
                            Request info
                          </Button>
                        </>
                      ) : null}
                      <Button component={Link} href={`/leads/${item.leadId}`} size="xs" variant="light">
                        Open Lead
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!isLoading && items.length === 0 ? (
          <Text size="sm" c="dimmed" p="md">
            No finance queue records match this filter right now.
          </Text>
        ) : null}
      </Paper>

      {decisionSuccess ? (
        <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
          <Alert color="teal" icon={<IconCheck size={16} />}>{decisionSuccess}</Alert>
        </Paper>
      ) : null}

      {/* UX-CIS-008: quick decision modal */}
      <Modal
        opened={actionTarget !== null}
        onClose={() => { setActionTarget(null); setQuickDecisionNotes(''); setDecisionError(null); }}
        title={actionTarget ? `Finance Decision — ${actionTarget.companyName}` : ''}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Select
            label="Decision"
            value={quickDecision}
            onChange={(value) => {
              if (value) {
                setQuickDecision(value as Exclude<CisFinanceDecisionStatusKey, 'not_submitted' | 'pending'>);
              }
            }}
            data={[
              { value: 'approved', label: 'Approve' },
              { value: 'conditional', label: 'Approve with conditions' },
              { value: 'info_requested', label: 'Request more information' },
              { value: 'declined', label: 'Decline' },
            ]}
            disabled={isRecordingDecision}
          />
          <Textarea
            label="Decision notes (optional)"
            placeholder="Capture approval terms, conditions, or decline reasons."
            value={quickDecisionNotes}
            onChange={(event) => setQuickDecisionNotes(event.currentTarget.value)}
            minRows={3}
            disabled={isRecordingDecision}
          />
          {decisionError ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>{decisionError}</Alert>
          ) : null}
          <Group justify="flex-end" gap="xs">
            <Button
              variant="default"
              onClick={() => { setActionTarget(null); setQuickDecisionNotes(''); setDecisionError(null); }}
              disabled={isRecordingDecision}
            >
              Cancel
            </Button>
            <Button
              onClick={() => { void handleQuickDecision(); }}
              loading={isRecordingDecision}
            >
              Confirm {formatDecisionLabel(quickDecision)}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function formatDateTimeLabel(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDecisionLabel(decision: Exclude<CisFinanceDecisionStatusKey, 'not_submitted' | 'pending'>) {
  switch (decision) {
    case 'approved': return 'Approve';
    case 'conditional': return 'Approve with conditions';
    case 'info_requested': return 'Request info';
    case 'declined': return 'Decline';
    default: return decision;
  }
}
