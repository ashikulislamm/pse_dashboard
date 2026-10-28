import { roundCurrency } from '@/shared/lib/money';
import { periodRange } from '@/shared/lib/periods';
import type { ActivityClass, ActivityType, MeetingStatus, StageKind } from '@/types/database';
import type { DashboardFilterInput, DashboardLens, DashboardPeriodType } from './schema';

// Filters and period window

export interface ResolvedDashboardFilters {
  period: DashboardPeriodType;
  year: number;
  /** Month 1-12 or quarter 1-4 within the (fiscal) year; 1 and unused for a full year. */
  index: number;
  member: string | null;
  vertical: string | null;
  lens: DashboardLens;
}

export interface DashboardWindow {
  start: string;
  end: string;
  label: string;
  isProRata: boolean;
  /** Arguments for `fn_target`. */
  targetYear: number;
  targetQuarter: number | null;
  targetMonth: number | null;
}

export interface FiscalPosition {
  year: number;
  month: number;
  quarter: number;
}

/** Where `today` falls in the fiscal year that starts in `fiscalStartMonth`. */
export function fiscalPositionOf(today: Date, fiscalStartMonth = 1): FiscalPosition {
  const calendarMonth = today.getMonth() + 1;
  const month = ((calendarMonth - fiscalStartMonth + 12) % 12) + 1;
  const year = calendarMonth >= fiscalStartMonth ? today.getFullYear() : today.getFullYear() - 1;
  return { year, month, quarter: Math.floor((month - 1) / 3) + 1 };
}

/** Fills defaults (current quarter, all members, all verticals, monetary lens) and clamps the index. */
export function resolveDashboardFilters(
  raw: DashboardFilterInput,
  today: Date,
  fiscalStartMonth = 1,
): ResolvedDashboardFilters {
  const position = fiscalPositionOf(today, fiscalStartMonth);
  const period = raw.period ?? 'quarter';
  const year = raw.year ?? position.year;
  const isCurrentYear = year === position.year;

  let index = 1;
  if (period === 'month') {
    index = Math.min(12, Math.max(1, raw.index ?? (isCurrentYear ? position.month : 1)));
  } else if (period === 'quarter') {
    index = Math.min(4, Math.max(1, raw.index ?? (isCurrentYear ? position.quarter : 1)));
  }

  return {
    period,
    year,
    index,
    member: raw.member ?? null,
    vertical: raw.vertical ?? null,
    lens: raw.lens ?? 'monetary',
  };
}

export function periodWindow(
  filters: Pick<ResolvedDashboardFilters, 'period' | 'year' | 'index'>,
  fiscalStartMonth = 1,
): DashboardWindow {
  const range = periodRange({
    type: filters.period,
    year: filters.year,
    index: filters.index,
    fiscalStartMonth,
  });

  return {
    start: range.start,
    end: range.end,
    label: range.label,
    isProRata: range.isProRata,
    targetYear: filters.year,
    targetQuarter: filters.period === 'quarter' ? filters.index : null,
    targetMonth: filters.period === 'month' ? filters.index : null,
  };
}

// Money helpers

function toCents(value: number): number {
  return Math.round(roundCurrency(value) * 100);
}

export function sumMoney(values: number[]): number {
  return values.reduce((acc, v) => acc + toCents(v), 0) / 100;
}

export interface Attainment {
  /** Percent of target reached, never capped; null when there is no target to measure against. */
  attainmentPct: number | null;
  unachieved: number;
  overachieved: number;
}

/**
 * Over-achievement stays visible (110% is 110%) and never changes another period's target:
 * `unachieved` and `overachieved` are computed per period and are never netted across periods.
 */
export function computeAttainment(target: number, achieved: number): Attainment {
  const targetCents = toCents(target);
  const achievedCents = toCents(achieved);
  return {
    attainmentPct: targetCents > 0 ? (achievedCents / targetCents) * 100 : null,
    unachieved: Math.max(targetCents - achievedCents, 0) / 100,
    overachieved: Math.max(achievedCents - targetCents, 0) / 100,
  };
}

// Raw SQL rows (already converted to numbers by the repository)

export interface AchievementRow {
  user_id: string;
  vertical_id: string;
  achieved: number;
}

export interface TargetRow {
  user_id: string;
  vertical_id: string;
  target: number;
}

export interface PipelineKindRow {
  kind: StageKind;
  pipeline_count: number;
  expected_base: number;
  cash_base: number;
  in_kind_base: number;
}

export interface WonUnrealizedRow {
  won_base: number;
  received_base: number;
  unrealized_base: number;
}

export interface TrendRow {
  month_index: number;
  /** YYYY-MM-DD */
  month_start: string;
  achieved: number;
}

export interface MeetingRow {
  status: MeetingStatus;
  meeting_count: number;
}

export interface ActivityRow {
  type: ActivityType;
  class: ActivityClass;
  activity_count: number;
  distinct_contacts: number;
}

export interface WorkloadRow {
  user_id: string;
  full_name: string;
  meeting_count: number;
  activity_count: number;
}

export interface MonetaryRaw {
  achievements: AchievementRow[];
  targets: TargetRow[];
  pipelineByKind: PipelineKindRow[];
  wonUnrealized: WonUnrealizedRow | null;
  leadCount: number;
  trend: TrendRow[];
}

export interface NonMonetaryRaw {
  meetings: MeetingRow[];
  activities: ActivityRow[];
  contactsEngaged: number;
  workload: WorkloadRow[];
}

export interface NameLookup {
  members: Record<string, string>;
  verticals: Record<string, string>;
}

// Monetary lens

export interface AttainmentRowView extends Attainment {
  id: string;
  name: string;
  target: number;
  achieved: number;
}

export interface PipelineKindView {
  kind: StageKind;
  count: number;
  expected: number;
  cash: number;
  inKind: number;
}

export interface MonetaryDashboard {
  /** Target year; the trend chart covers all twelve months of it. */
  year: number;
  label: string;
  isProRata: boolean;
  start: string;
  end: string;
  hasTarget: boolean;
  totals: Attainment & { target: number; achieved: number };
  wonUnrealized: { won: number; received: number; unrealized: number };
  leadCount: number;
  byMember: AttainmentRowView[];
  byVertical: AttainmentRowView[];
  pipelineByKind: PipelineKindView[];
  trend: { month: string; achieved: number }[];
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function groupAttainment(
  targets: TargetRow[],
  achievements: AchievementRow[],
  key: 'user_id' | 'vertical_id',
  names: Record<string, string>,
): AttainmentRowView[] {
  const targetById = new Map<string, number[]>();
  const achievedById = new Map<string, number[]>();

  for (const t of targets) targetById.set(t[key], [...(targetById.get(t[key]) ?? []), t.target]);
  for (const a of achievements) {
    achievedById.set(a[key], [...(achievedById.get(a[key]) ?? []), a.achieved]);
  }

  const ids = new Set([...targetById.keys(), ...achievedById.keys()]);
  return [...ids]
    .map((id) => {
      const target = sumMoney(targetById.get(id) ?? []);
      const achieved = sumMoney(achievedById.get(id) ?? []);
      return {
        id,
        name: names[id] ?? 'Unknown',
        target,
        achieved,
        ...computeAttainment(target, achieved),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildMonetaryDashboard(
  raw: MonetaryRaw,
  names: NameLookup,
  window: DashboardWindow,
): MonetaryDashboard {
  const target = sumMoney(raw.targets.map((t) => t.target));
  const achieved = sumMoney(raw.achievements.map((a) => a.achieved));
  const won = raw.wonUnrealized;

  return {
    year: window.targetYear,
    label: window.label,
    isProRata: window.isProRata,
    start: window.start,
    end: window.end,
    hasTarget: toCents(target) > 0,
    totals: { target, achieved, ...computeAttainment(target, achieved) },
    wonUnrealized: {
      won: won?.won_base ?? 0,
      received: won?.received_base ?? 0,
      unrealized: won?.unrealized_base ?? 0,
    },
    leadCount: raw.leadCount,
    byMember: groupAttainment(raw.targets, raw.achievements, 'user_id', names.members),
    byVertical: groupAttainment(raw.targets, raw.achievements, 'vertical_id', names.verticals),
    pipelineByKind: raw.pipelineByKind.map((r) => ({
      kind: r.kind,
      count: r.pipeline_count,
      expected: r.expected_base,
      cash: r.cash_base,
      inKind: r.in_kind_base,
    })),
    trend: [...raw.trend]
      .sort((a, b) => a.month_index - b.month_index)
      .map((r) => ({
        month: MONTH_LABELS[Number(r.month_start.slice(5, 7)) - 1] ?? String(r.month_index),
        achieved: r.achieved,
      })),
  };
}

// Non-monetary lens

export const ACTIVITY_CLASS_LABELS: Record<ActivityClass, string> = {
  stewardship: 'Stewardship',
  prospect_engagement: 'Prospect engagement',
  independent: 'Independent',
};

export interface NonMonetaryDashboard {
  start: string;
  end: string;
  label: string;
  meetings: {
    total: number;
    scheduled: number;
    done: number;
    completionPct: number | null;
  };
  activities: {
    total: number;
    byType: { type: ActivityType; count: number }[];
    byClass: { class: ActivityClass; count: number }[];
  };
  visits: number;
  events: number;
  campaigns: number;
  contactsEngaged: number;
  workload: { id: string; name: string; meetings: number; activities: number }[];
}

export function buildNonMonetaryDashboard(
  raw: NonMonetaryRaw,
  window: DashboardWindow,
): NonMonetaryDashboard {
  const countOf = (status: MeetingStatus) =>
    raw.meetings.find((m) => m.status === status)?.meeting_count ?? 0;
  const scheduled = countOf('scheduled');
  const done = countOf('done');
  const totalMeetings = scheduled + done;

  const byTypeMap = new Map<ActivityType, number>();
  const byClassMap = new Map<ActivityClass, number>();
  for (const row of raw.activities) {
    byTypeMap.set(row.type, (byTypeMap.get(row.type) ?? 0) + row.activity_count);
    byClassMap.set(row.class, (byClassMap.get(row.class) ?? 0) + row.activity_count);
  }

  const byType = [...byTypeMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  const classOrder: ActivityClass[] = ['stewardship', 'prospect_engagement', 'independent'];
  const byClass = classOrder.map((c) => ({ class: c, count: byClassMap.get(c) ?? 0 }));

  return {
    start: window.start,
    end: window.end,
    label: window.label,
    meetings: {
      total: totalMeetings,
      scheduled,
      done,
      completionPct: totalMeetings > 0 ? (done / totalMeetings) * 100 : null,
    },
    activities: {
      total: byType.reduce((acc, t) => acc + t.count, 0),
      byType,
      byClass,
    },
    visits: byTypeMap.get('visit') ?? 0,
    events: byTypeMap.get('event') ?? 0,
    campaigns: byTypeMap.get('campaign') ?? 0,
    contactsEngaged: raw.contactsEngaged,
    workload: raw.workload.map((w) => ({
      id: w.user_id,
      name: w.full_name,
      meetings: w.meeting_count,
      activities: w.activity_count,
    })),
  };
}

// Drill-down links (only where the list uses the same date basis as the KPI)

function listHref(path: string, params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function meetingsHref(
  window: Pick<DashboardWindow, 'start' | 'end'>,
  member: string | null,
  status?: MeetingStatus,
): string {
  return listHref('/meetings', {
    fromDate: window.start,
    toDate: window.end,
    ownerId: member,
    status,
  });
}

export function activitiesHref(
  window: Pick<DashboardWindow, 'start' | 'end'>,
  member: string | null,
  extra: { type?: ActivityType; class?: ActivityClass } = {},
): string {
  return listHref('/activities', {
    fromDate: window.start,
    toDate: window.end,
    ownerId: member,
    type: extra.type,
    class: extra.class,
  });
}
