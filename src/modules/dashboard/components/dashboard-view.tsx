'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { periodRange } from '@/shared/lib/periods';
import { cn } from '@/shared/lib/utils';
import { Field, PageHeader, Select } from '@/shared/ui';
import type { getDashboardData } from '../queries';
import type { DashboardLens, DashboardPeriodType } from '../schema';
import { MonetaryLens } from './monetary-lens';
import { NonMonetaryLens } from './non-monetary-lens';

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

const PERIOD_TABS: { id: DashboardPeriodType; label: string }[] = [
  { id: 'month', label: 'Monthly' },
  { id: 'quarter', label: 'Quarterly' },
  { id: 'year', label: 'Annual' },
];

const LENSES: { id: DashboardLens; label: string }[] = [
  { id: 'monetary', label: 'Monetary' },
  { id: 'non_monetary', label: 'Non-monetary' },
];

export function DashboardView({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const { filters, options, years, fiscalStart: fiscalStartMonth } = data;
  const [lens, setLens] = React.useState<DashboardLens>(filters.lens);

  const buildUrl = React.useCallback(
    (next: {
      period?: DashboardPeriodType;
      year?: number;
      index?: number;
      member?: string | null;
      vertical?: string | null;
      lens?: DashboardLens;
    }) => {
      const merged = {
        period: next.period ?? filters.period,
        year: next.year ?? filters.year,
        index: next.index ?? filters.index,
        member: next.member === undefined ? filters.member : next.member,
        vertical: next.vertical === undefined ? filters.vertical : next.vertical,
        lens: next.lens ?? lens,
      };
      const params = new URLSearchParams();
      params.set('period', merged.period);
      params.set('year', String(merged.year));
      if (merged.period !== 'year') params.set('index', String(merged.index));
      if (merged.member) params.set('member', merged.member);
      if (merged.vertical) params.set('vertical', merged.vertical);
      if (merged.lens !== 'monetary') params.set('lens', merged.lens);
      return `/dashboard?${params.toString()}`;
    },
    [filters, lens],
  );

  const navigate = (next: Parameters<typeof buildUrl>[0]) => {
    startTransition(() => router.replace(buildUrl(next), { scroll: false }));
  };

  const changePeriod = (period: DashboardPeriodType) => {
    // Switching between month and quarter keeps the period containing the same months.
    let index = 1;
    if (period === 'month')
      index = filters.period === 'quarter' ? (filters.index - 1) * 3 + 1 : filters.index;
    if (period === 'quarter')
      index =
        filters.period === 'month' ? Math.ceil(filters.index / 3) : Math.min(filters.index, 4);
    navigate({ period, index });
  };

  const changeLens = (next: DashboardLens) => {
    setLens(next);
    // The URL stays shareable without re-rendering the server tree (both lenses are already loaded).
    window.history.replaceState(null, '', buildUrl({ lens: next }));
  };

  const indexOptions =
    filters.period === 'month'
      ? Array.from({ length: 12 }, (_, i) => ({
          value: i + 1,
          label: periodRange({
            type: 'month',
            year: filters.year,
            index: i + 1,
            fiscalStartMonth,
          }).label,
        }))
      : filters.period === 'quarter'
        ? [1, 2, 3, 4].map((q) => ({ value: q, label: `Q${q}` }))
        : [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Monetary fundraising performance and non-monetary work metrics."
      />

      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border bg-background px-4 pb-3 sm:-mx-6 sm:px-6">
        <div role="tablist" aria-label="Period" className="flex gap-4 border-b border-border">
          {PERIOD_TABS.map((tab) => {
            const active = tab.id === filters.period;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changePeriod(tab.id)}
                className={cn(
                  '-mb-px h-10 border-b-2 px-1 text-[14px] font-medium whitespace-nowrap outline-none focus-visible:outline-none',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field id="dashboard-year" label="Year">
            <Select
              id="dashboard-year"
              value={filters.year}
              onChange={(e) => navigate({ year: Number(e.target.value) })}
              className="h-8 w-24 text-[13px]"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>

          {indexOptions.length > 0 && (
            <Field id="dashboard-index" label={filters.period === 'month' ? 'Month' : 'Quarter'}>
              <Select
                id="dashboard-index"
                value={filters.index}
                onChange={(e) => navigate({ index: Number(e.target.value) })}
                className="h-8 w-32 text-[13px]"
              >
                {indexOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field id="dashboard-member" label="Member">
            <Select
              id="dashboard-member"
              value={filters.member ?? ''}
              onChange={(e) => navigate({ member: e.target.value || null })}
              className="h-8 w-44 text-[13px]"
            >
              <option value="">All members</option>
              {options.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          </Field>

          {lens === 'monetary' && (
            <Field id="dashboard-vertical" label="Vertical">
              <Select
                id="dashboard-vertical"
                value={filters.vertical ?? ''}
                onChange={(e) => navigate({ vertical: e.target.value || null })}
                className="h-8 w-40 text-[13px]"
              >
                <option value="">All verticals</option>
                {options.verticals.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-label="Dashboard lens"
        className="mb-6 inline-flex rounded-md border border-border-strong p-0.5"
      >
        {LENSES.map((l) => {
          const active = l.id === lens;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={active}
              onClick={() => changeLens(l.id)}
              className={cn(
                'h-8 rounded-sm px-3 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:outline-none',
                active
                  ? 'bg-primary-subtle text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      <div
        aria-busy={isPending}
        className={cn('transition-opacity duration-100', isPending && 'opacity-60')}
      >
        <h2 className="mb-4 text-[18px] leading-7 font-semibold text-foreground">
          {lens === 'monetary' ? 'Monetary' : 'Non-monetary'} · {data.window.label}
        </h2>
        {lens === 'monetary' ? (
          <MonetaryLens data={data.monetary} />
        ) : (
          <NonMonetaryLens data={data.nonMonetary} member={filters.member} />
        )}
      </div>
    </div>
  );
}
