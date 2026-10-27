'use client';

import * as React from 'react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/shared/lib/utils';
import { Money } from './money';

export interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  context?: React.ReactNode;
  href?: string;
  className?: string;
}

/**
 * KPI tile (DESIGN.md §8):
 * Label (13px muted), Value (28px 600 tabular), one line of context in muted text.
 * No icons, no sparkline, no fake trend arrows.
 */
export function KpiTile({ label, value, context, href, className }: KpiTileProps) {
  const valueNode = (
    <div
      className={cn(
        'mt-1 text-[22px] leading-8 font-semibold text-foreground tabular-nums break-words sm:text-[28px]',
        href && 'underline-offset-4 hover:underline',
      )}
    >
      {value}
    </div>
  );

  return (
    <div className={cn('rounded-md border border-border bg-background p-4', className)}>
      <p className="text-[13px] leading-5 font-medium text-muted-foreground">{label}</p>
      {href ? <a href={href}>{valueNode}</a> : valueNode}
      {context && (
        <p className="mt-1 text-[12px] leading-4 text-muted-foreground tabular-nums">{context}</p>
      )}
    </div>
  );
}

export interface TargetBarProps {
  label: string;
  achieved: number;
  target: number;
  currency?: string;
  className?: string;
}

/**
 * Horizontal target vs achievement bar (DESIGN.md §10):
 * Achieved bar over a thin target marker line, with exact percentage printed as text.
 * Over-achievement (>100%) is never capped in text and extends past the target marker.
 */
export function TargetBar({
  label,
  achieved,
  target,
  currency = 'BDT',
  className,
}: TargetBarProps) {
  const percent = target > 0 ? (achieved / target) * 100 : 0;
  const scaleMax = Math.max(target, achieved, 1);
  const achievedWidthPct = Math.min(100, (achieved / scaleMax) * 100);
  const targetMarkerPct = Math.min(100, (target / scaleMax) * 100);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-[13px] leading-5">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          <Money amount={achieved} currency={currency} className="font-medium text-foreground" /> /{' '}
          <Money amount={target} currency={currency} /> ({percent.toFixed(1)}%)
        </span>
      </div>
      <div className="relative h-3 w-full rounded-sm bg-surface-2">
        <div
          className="h-full rounded-sm bg-primary"
          style={{ width: `${achievedWidthPct}%` }}
        />
        {target > 0 && (
          <div
            aria-label="Target marker"
            className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-foreground"
            style={{ left: `${targetMarkerPct}%` }}
          />
        )}
      </div>
    </div>
  );
}

const CHART_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
];

export interface ChartSeries {
  key: string;
  label: string;
  colorIndex?: 0 | 1 | 2 | 3;
}

export interface BarChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: ChartSeries[];
  stacked?: boolean;
  height?: number;
  emptyMessage?: string;
}

export function BarChart({
  data,
  xKey,
  series,
  stacked = false,
  height = 260,
  emptyMessage = 'No data for this period.',
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-border bg-surface text-[13px] text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }} className="tabular-nums">
      <ResponsiveContainer>
        <RechartsBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--foreground)',
              color: 'var(--background)',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          {series.slice(0, 4).map((s, idx) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? 'stack' : undefined}
              fill={CHART_PALETTE[s.colorIndex ?? idx]}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface LineChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
  emptyMessage?: string;
}

export function LineChart({
  data,
  xKey,
  series,
  height = 260,
  emptyMessage = 'No data for this period.',
}: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-border bg-surface text-[13px] text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }} className="tabular-nums">
      <ResponsiveContainer>
        <RechartsLineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--foreground)',
              color: 'var(--background)',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          {series.slice(0, 4).map((s, idx) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={CHART_PALETTE[s.colorIndex ?? idx]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
