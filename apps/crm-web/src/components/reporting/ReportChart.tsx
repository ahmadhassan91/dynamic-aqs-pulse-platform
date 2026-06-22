'use client';

import { useState } from 'react';
import { Group, SegmentedControl, Stack } from '@mantine/core';
import { AreaChart, BarChart, LineChart } from '@mantine/charts';

export type ReportChartType = 'bar' | 'line' | 'area';

export interface ReportChartSeries {
  name: string; // key in each data row
  label?: string;
  color?: string;
}

export interface ReportChartProps<T extends object> {
  data: readonly T[];
  dataKey: keyof T & string; // category (x-axis) key
  series: ReportChartSeries[];
  height?: number;
  defaultType?: ReportChartType;
  allowedTypes?: ReportChartType[];
  valueFormatter?: (value: number) => string;
}

// FR-RPT-006 / FR-RPT-067: the shared reporting chart. Wraps @mantine/charts behind a bar/line/area toggle
// so every reporting widget gets a consistent chart-type switch without importing the chart lib directly.
export function ReportChart<T extends object>({
  data,
  dataKey,
  series,
  height = 240,
  defaultType = 'bar',
  allowedTypes = ['bar', 'line', 'area'],
  valueFormatter,
}: ReportChartProps<T>) {
  const [type, setType] = useState<ReportChartType>(defaultType);
  const chartSeries = series.map((entry) => ({
    name: entry.name,
    label: entry.label ?? entry.name,
    color: entry.color ?? 'blue.6',
  }));

  // @mantine/charts takes row records; our callers pass typed rows, so cast once here.
  const common = {
    h: height,
    data: data as unknown as Record<string, unknown>[],
    dataKey,
    series: chartSeries,
    withLegend: chartSeries.length > 1,
    ...(valueFormatter ? { valueFormatter } : {}),
  };

  return (
    <Stack gap="xs">
      {allowedTypes.length > 1 ? (
        <Group justify="flex-end">
          <SegmentedControl
            size="xs"
            value={type}
            onChange={(value) => setType(value as ReportChartType)}
            data={allowedTypes.map((entry) => ({ value: entry, label: entry.charAt(0).toUpperCase() + entry.slice(1) }))}
            aria-label="Chart type"
          />
        </Group>
      ) : null}
      {type === 'bar' ? <BarChart {...common} /> : null}
      {type === 'line' ? <LineChart {...common} curveType="linear" /> : null}
      {type === 'area' ? <AreaChart {...common} curveType="linear" /> : null}
    </Stack>
  );
}
