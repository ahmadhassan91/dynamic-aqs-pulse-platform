'use client';

import type { ReactNode } from 'react';
import {
  ActionIcon,
  Accordion,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import type { MantineColor } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconDotsVertical,
  IconInbox,
  IconLock,
  IconPlugConnectedX,
  IconSearch,
} from '@tabler/icons-react';

/**
 * Pulse workbench contract:
 * one page, one job, one visible primary action. Default module routes should
 * show the ranked attention lane, at most four decision metrics, one primary
 * work surface, and a selected-record detail rail/drawer for dense evidence.
 * Prefer these primitives before adding raw Mantine tables, panels, empty
 * states, or local action clusters in module workspaces.
 */
export type WorkbenchStatusTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const statusToneColor: Record<WorkbenchStatusTone, MantineColor> = {
  brand: 'blue',
  success: 'green',
  warning: 'orange',
  danger: 'red',
  neutral: 'gray',
};

export type WorkbenchPageProps = {
  children: ReactNode;
  gap?: string | number;
  className?: string;
  maxWidth?: number | string;
};

export type WorkbenchPrimaryActionsProps = {
  primary?: ReactNode;
  secondary?: ReactNode;
  more?: ReactNode;
  justify?: 'flex-start' | 'space-between' | 'flex-end';
};

export type WorkbenchHeaderProps = {
  title: string;
  description?: string | undefined;
  eyebrow?: string | undefined;
  policyText?: string | undefined;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  actions?: ReactNode;
};

export type WorkbenchMetric = {
  label: string;
  value: ReactNode;
  tone?: MantineColor | WorkbenchStatusTone | undefined;
  helper?: string | undefined;
  icon?: ReactNode;
};

export type WorkbenchMetricStripProps = {
  metrics: WorkbenchMetric[];
  columns?: {
    base?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
};

export type WorkbenchAttentionItem = {
  id: string;
  title: string;
  description?: string | undefined;
  count?: ReactNode;
  tone?: MantineColor | WorkbenchStatusTone | undefined;
  action?: ReactNode;
};

export type WorkbenchAttentionLaneProps = {
  title?: string;
  description?: string | undefined;
  items: WorkbenchAttentionItem[];
  emptyState?: string | undefined;
  icon?: ReactNode;
};

export type WorkbenchAttentionPanelProps = WorkbenchAttentionLaneProps;

export type WorkbenchTableColumn<Row> = {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
};

export type WorkbenchMenuItem = {
  id: string;
  label: string;
  description?: string | undefined;
  icon?: ReactNode;
  color?: MantineColor | WorkbenchStatusTone | undefined;
  disabled?: boolean | undefined;
  onClick?: () => void;
};

/**
 * Repeated records should use WorkbenchTable first. Keep default workbench
 * tables to five data columns plus one row action menu; extend this primitive
 * for shared behavior before adding a new local table pattern.
 */
export type WorkbenchTableProps<Row> = {
  rows: Row[];
  columns: WorkbenchTableColumn<Row>[];
  getRowKey: (row: Row) => string;
  emptyState?: ReactNode;
  rowActions?: (row: Row) => WorkbenchMenuItem[];
  onRowClick?: (row: Row) => void;
  ariaLabel?: string;
  minWidth?: number;
  striped?: boolean;
  highlightOnHover?: boolean;
  withContainer?: boolean;
};

/**
 * Selection-driven side panels should use WorkbenchDetailRail. Dense metadata,
 * audit/source trace, parked dependency notes, versions, and history belong in
 * a rail, drawer, or detail route instead of competing with the primary queue.
 */
export type WorkbenchDetailRailProps = {
  title: string;
  description?: string | undefined;
  children?: ReactNode;
  actions?: ReactNode;
  emptyState?: ReactNode;
};

export type WorkbenchMoreMenuProps = {
  label?: string;
  items: WorkbenchMenuItem[];
  width?: number;
  variant?: 'button' | 'icon';
};

export type StatusBadgeProps = {
  children: ReactNode;
  tone?: WorkbenchStatusTone;
  color?: MantineColor;
  variant?: 'light' | 'filled' | 'outline' | 'dot' | 'default' | 'transparent' | 'white';
};

export type RowActionMenuProps = {
  items: WorkbenchMenuItem[];
  label?: string;
  width?: number;
};

export type EmptyStateMessageKind = 'all-clear' | 'no-data' | 'filtered-out' | 'no-permission' | 'external-dependency';

/**
 * Use typed empty states instead of plain centered "No data" text so all-clear,
 * filtered, permission, and external-dependency states read consistently.
 */
export type EmptyStateMessageProps = {
  title: string;
  description?: string | undefined;
  kind?: EmptyStateMessageKind;
  action?: ReactNode;
};

export type WorkbenchAdvancedSectionProps = {
  title: string;
  description?: string | undefined;
  children: ReactNode;
};

function isWorkbenchStatusTone(tone: string): tone is WorkbenchStatusTone {
  return tone in statusToneColor;
}

function resolveToneColor(
  tone: MantineColor | WorkbenchStatusTone | undefined,
  fallback?: MantineColor,
): MantineColor | undefined {
  if (!tone) {
    return fallback;
  }

  return isWorkbenchStatusTone(tone) ? statusToneColor[tone] : tone;
}

function emptyStateIcon(kind: EmptyStateMessageKind) {
  switch (kind) {
    case 'all-clear':
      return <IconCheck size={18} />;
    case 'filtered-out':
      return <IconSearch size={18} />;
    case 'no-permission':
      return <IconLock size={18} />;
    case 'external-dependency':
      return <IconPlugConnectedX size={18} />;
    case 'no-data':
    default:
      return <IconInbox size={18} />;
  }
}

export function WorkbenchPage({ children, gap = 'lg', className, maxWidth = 1440 }: WorkbenchPageProps) {
  return (
    <Stack gap={gap} maw={maxWidth} w="100%" mx="auto" {...(className ? { className } : {})}>
      {children}
    </Stack>
  );
}

export function WorkbenchPrimaryActions({
  primary,
  secondary,
  more,
  justify = 'flex-end',
}: WorkbenchPrimaryActionsProps) {
  if (!primary && !secondary && !more) {
    return null;
  }

  return (
    <Group gap="sm" justify={justify} align="center" wrap="wrap">
      {secondary}
      {more}
      {primary}
    </Group>
  );
}

export function WorkbenchHeader({
  title,
  description,
  eyebrow,
  policyText,
  primaryAction,
  secondaryActions,
  actions,
}: WorkbenchHeaderProps) {
  const actionContent = actions ?? (
    <WorkbenchPrimaryActions primary={primaryAction} secondary={secondaryActions} />
  );

  return (
    <Paper withBorder radius="xl" p="xl" className="premium-hero-panel">
      <Group justify="space-between" align="flex-start" gap="xl">
        <Stack gap={6} maw={900}>
          {eyebrow ? (
            <Text size="xs" fw={800} tt="uppercase" c="blue">
              {eyebrow}
            </Text>
          ) : null}
          <Title order={1}>{title}</Title>
          {description ? (
            <Text c="dimmed" size="sm">
              {description}
            </Text>
          ) : null}
          {policyText ? (
            <Text c="dimmed" size="xs">
              {policyText}
            </Text>
          ) : null}
        </Stack>
        {actionContent ? <Box>{actionContent}</Box> : null}
      </Group>
    </Paper>
  );
}

export function WorkbenchAttentionLane({
  title = 'Needs attention',
  description,
  items,
  emptyState = 'No urgent work needs attention right now.',
  icon = <IconAlertTriangle size={16} />,
}: WorkbenchAttentionLaneProps) {
  const totalCount = items.reduce((total, item) => total + (typeof item.count === 'number' ? item.count : 0), 0);

  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Group gap="xs">
              {icon}
              <Text fw={800}>{title}</Text>
            </Group>
            {description ? (
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            ) : null}
          </Stack>
          {totalCount > 0 ? <StatusBadge tone="warning">{totalCount}</StatusBadge> : null}
        </Group>

        {items.length ? (
          <SimpleGrid cols={{ base: 1, md: Math.min(items.length, 3) }} spacing="sm">
            {items.map((item) => (
              <Paper key={item.id} withBorder radius="md" p="sm">
                <Group justify="space-between" align="center" gap="md" wrap="nowrap">
                  <Stack gap={2}>
                    <Text fw={700} size="sm">
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text size="xs" c="dimmed">
                        {item.description}
                      </Text>
                    ) : null}
                  </Stack>
                  <Group gap="xs" wrap="nowrap">
                    {item.count !== undefined ? (
                      <Badge color={resolveToneColor(item.tone) ?? 'orange'} variant="light">
                        {item.count}
                      </Badge>
                    ) : null}
                    {item.action}
                  </Group>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        ) : (
          <Text size="sm" c="dimmed">
            {emptyState}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

export function WorkbenchAttentionPanel(props: WorkbenchAttentionPanelProps) {
  return <WorkbenchAttentionLane {...props} />;
}

export function WorkbenchMetricStrip({ metrics, columns = { base: 1, sm: 2, lg: 4 } }: WorkbenchMetricStripProps) {
  return (
    <SimpleGrid cols={columns} spacing="md">
      {metrics.map((metric) => (
        <Paper key={metric.label} withBorder radius="lg" p="md" className="premium-stat-card">
          <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
            <Stack gap={2}>
              <Text size="xs" tt="uppercase" fw={800} c="dimmed">
                {metric.label}
              </Text>
              <Text fw={800} size="xl" {...(metric.tone ? { c: resolveToneColor(metric.tone) ?? metric.tone } : {})}>
                {metric.value}
              </Text>
              {metric.helper ? (
                <Text size="xs" c="dimmed">
                  {metric.helper}
                </Text>
              ) : null}
            </Stack>
            {metric.icon ? <Box c={resolveToneColor(metric.tone) ?? 'gray'}>{metric.icon}</Box> : null}
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

export function WorkbenchTable<Row>({
  rows,
  columns,
  getRowKey,
  emptyState,
  rowActions,
  onRowClick,
  ariaLabel = 'Workbench table',
  minWidth = 720,
  striped = true,
  highlightOnHover = true,
  withContainer = true,
}: WorkbenchTableProps<Row>) {
  const hasRowActions = Boolean(rowActions);
  const columnCount = columns.length + (hasRowActions ? 1 : 0);

  const table = (
    <ScrollArea>
      <Table
        aria-label={ariaLabel}
        miw={minWidth}
        striped={striped}
        highlightOnHover={highlightOnHover}
        verticalSpacing="sm"
      >
        <Table.Thead>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Th key={column.key} w={column.width} ta={column.align}>
                {column.header}
              </Table.Th>
            ))}
            {hasRowActions ? <Table.Th w={48} /> : null}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length ? (
            rows.map((row) => {
              const actions = rowActions?.(row) ?? [];

              return (
                <Table.Tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((column) => (
                    <Table.Td key={column.key} ta={column.align}>
                      {column.render(row)}
                    </Table.Td>
                  ))}
                  {hasRowActions ? (
                    <Table.Td onClick={(event) => event.stopPropagation()}>
                      <RowActionMenu items={actions} />
                    </Table.Td>
                  ) : null}
                </Table.Tr>
              );
            })
          ) : (
            <Table.Tr>
              <Table.Td colSpan={columnCount}>
                {emptyState ?? (
                  <EmptyStateMessage title="No records found" description="There is nothing to show here yet." />
                )}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );

  return withContainer ? (
    <Paper withBorder radius="lg" p={0}>
      {table}
    </Paper>
  ) : table;
}

export function WorkbenchDetailRail({
  title,
  description,
  children,
  actions,
  emptyState,
}: WorkbenchDetailRailProps) {
  return (
    <Paper withBorder radius="lg" p="md" h="100%">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={2}>
            <Text component="h2" fw={800} size="md" lh={1.2} m={0}>
              {title}
            </Text>
            {description ? (
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            ) : null}
          </Stack>
          {actions}
        </Group>
        <Divider />
        {children ?? emptyState ?? (
          <EmptyStateMessage
            kind="no-data"
            title="Select a record"
            description="Details appear here after a row is selected."
          />
        )}
      </Stack>
    </Paper>
  );
}

export function WorkbenchMoreMenu({
  label = 'More',
  items,
  width = 220,
  variant = 'button',
}: WorkbenchMoreMenuProps) {
  if (!items.length) {
    return null;
  }

  return (
    <Menu position="bottom-end" shadow="md" width={width} withinPortal>
      <Menu.Target>
        {variant === 'icon' ? (
          <Tooltip label={label}>
            <ActionIcon variant="default" aria-label={label}>
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <Button variant="default" rightSection={<IconChevronDown size={14} />}>
            {label}
          </Button>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item
            key={item.id}
            leftSection={item.icon}
            {...(item.color ? { color: resolveToneColor(item.color) ?? item.color } : {})}
            {...(item.disabled !== undefined ? { disabled: item.disabled } : {})}
            {...(item.onClick ? { onClick: item.onClick } : {})}
          >
            <Stack gap={0}>
              <Text size="sm">{item.label}</Text>
              {item.description ? (
                <Text size="xs" c="dimmed">
                  {item.description}
                </Text>
              ) : null}
            </Stack>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function StatusBadge({ children, tone = 'neutral', color, variant = 'light' }: StatusBadgeProps) {
  return (
    <Badge color={color ?? statusToneColor[tone]} variant={variant}>
      {children}
    </Badge>
  );
}

export function RowActionMenu({ items, label = 'Row actions', width = 220 }: RowActionMenuProps) {
  if (!items.length) {
    return null;
  }

  return (
    <Menu position="bottom-end" shadow="md" width={width} withinPortal>
      <Menu.Target>
        <Tooltip label={label}>
            <ActionIcon variant="subtle" aria-label={label} data-ux-row-action="true">
              <IconDotsVertical size={16} />
            </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item
            key={item.id}
            leftSection={item.icon}
            {...(item.color ? { color: resolveToneColor(item.color) ?? item.color } : {})}
            {...(item.disabled !== undefined ? { disabled: item.disabled } : {})}
            {...(item.onClick ? { onClick: item.onClick } : {})}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function EmptyStateMessage({
  title,
  description,
  kind = 'no-data',
  action,
}: EmptyStateMessageProps) {
  return (
    <Stack gap="sm" align="center" ta="center" py="lg">
      <ThemeIcon color={kind === 'all-clear' ? 'green' : 'gray'} variant="light" size="lg" radius="xl">
        {emptyStateIcon(kind)}
      </ThemeIcon>
      <Stack gap={2} align="center" maw={520}>
        <Text fw={800}>{title}</Text>
        {description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}
      </Stack>
      {action}
    </Stack>
  );
}

export function WorkbenchAdvancedSection({ title, description, children }: WorkbenchAdvancedSectionProps) {
  return (
    <Accordion variant="contained" radius="md">
      <Accordion.Item value="advanced">
        <Accordion.Control>
          <Stack gap={2}>
            <Text fw={700}>{title}</Text>
            {description ? (
              <Text size="xs" c="dimmed">
                {description}
              </Text>
            ) : null}
          </Stack>
        </Accordion.Control>
        <Accordion.Panel>{children}</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
