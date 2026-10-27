import { describe, expect, it } from 'vitest';
import {
  activitiesHref,
  buildMonetaryDashboard,
  buildNonMonetaryDashboard,
  computeAttainment,
  fiscalPositionOf,
  meetingsHref,
  periodWindow,
  resolveDashboardFilters,
  sumMoney,
  type MonetaryRaw,
  type NonMonetaryRaw,
} from './service';

const U1 = '10000000-0000-0000-0000-000000000003';
const U2 = '10000000-0000-0000-0000-000000000004';
const DSP = 'v-dsp';
const VBD = 'v-vbd';
const names = {
  members: { [U1]: 'Rahim', [U2]: 'Karim' },
  verticals: { [DSP]: 'DSP', [VBD]: 'VBD' },
};

describe('fiscalPositionOf', () => {
  it('uses calendar quarters when the year starts in January', () => {
    expect(fiscalPositionOf(new Date(2026, 9, 27), 1)).toEqual({
      year: 2026,
      month: 10,
      quarter: 4,
    });
    expect(fiscalPositionOf(new Date(2026, 0, 5), 1)).toEqual({ year: 2026, month: 1, quarter: 1 });
  });

  it('shifts month, quarter and year for a July fiscal year', () => {
    expect(fiscalPositionOf(new Date(2026, 8, 1), 7)).toEqual({ year: 2026, month: 3, quarter: 1 });
    expect(fiscalPositionOf(new Date(2026, 1, 1), 7)).toEqual({ year: 2025, month: 8, quarter: 3 });
  });
});

describe('resolveDashboardFilters', () => {
  const today = new Date(2026, 9, 27);

  it('defaults to the current quarter, all members and verticals, monetary lens', () => {
    expect(resolveDashboardFilters({}, today)).toEqual({
      period: 'quarter',
      year: 2026,
      index: 4,
      member: null,
      vertical: null,
      lens: 'monetary',
    });
  });

  it('defaults a monthly view to the current month', () => {
    expect(resolveDashboardFilters({ period: 'month' }, today).index).toBe(10);
  });

  it('starts at the first period when another year is chosen', () => {
    expect(resolveDashboardFilters({ period: 'quarter', year: 2025 }, today).index).toBe(1);
  });

  it('clamps the index to the period type', () => {
    expect(resolveDashboardFilters({ period: 'quarter', index: 9 }, today).index).toBe(4);
    expect(resolveDashboardFilters({ period: 'year', index: 9 }, today).index).toBe(1);
  });
});

describe('periodWindow', () => {
  it('maps a quarter to exact dates and a quarter target', () => {
    const w = periodWindow({ period: 'quarter', year: 2026, index: 2 });
    expect(w).toMatchObject({
      start: '2026-04-01',
      end: '2026-06-30',
      isProRata: false,
      targetQuarter: 2,
      targetMonth: null,
    });
  });

  it('marks a month as pro-rata and passes the month to the target function', () => {
    const w = periodWindow({ period: 'month', year: 2026, index: 11 });
    expect(w).toMatchObject({
      start: '2026-11-01',
      end: '2026-11-30',
      isProRata: true,
      targetMonth: 11,
    });
  });

  it('uses the whole year for the annual view', () => {
    const w = periodWindow({ period: 'year', year: 2026, index: 1 });
    expect(w).toMatchObject({
      start: '2026-01-01',
      end: '2026-12-31',
      targetQuarter: null,
      targetMonth: null,
    });
  });
});

describe('computeAttainment', () => {
  it('reports shortfall for an under-achieved period', () => {
    expect(computeAttainment(1000, 400)).toEqual({
      attainmentPct: 40,
      unachieved: 600,
      overachieved: 0,
    });
  });

  it('never caps over-achievement', () => {
    const a = computeAttainment(1000, 1100);
    expect(a.attainmentPct).toBeCloseTo(110);
    expect(a.overachieved).toBe(100);
    expect(a.unachieved).toBe(0);
  });

  it('has no attainment without a target', () => {
    expect(computeAttainment(0, 500).attainmentPct).toBeNull();
  });
});

describe('sumMoney', () => {
  it('adds without floating point drift', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
  });
});

describe('buildMonetaryDashboard', () => {
  const window = periodWindow({ period: 'quarter', year: 2026, index: 4 });
  const raw: MonetaryRaw = {
    targets: [
      { user_id: U1, vertical_id: DSP, target: 500 },
      { user_id: U1, vertical_id: VBD, target: 300 },
      { user_id: U2, vertical_id: DSP, target: 200 },
    ],
    achievements: [
      { user_id: U1, vertical_id: DSP, achieved: 600 },
      { user_id: U2, vertical_id: VBD, achieved: 50 },
    ],
    pipelineByKind: [
      { kind: 'open', pipeline_count: 2, expected_base: 900, cash_base: 700, in_kind_base: 200 },
      { kind: 'won', pipeline_count: 1, expected_base: 400, cash_base: 400, in_kind_base: 0 },
      { kind: 'lost', pipeline_count: 0, expected_base: 0, cash_base: 0, in_kind_base: 0 },
      { kind: 'junk', pipeline_count: 0, expected_base: 0, cash_base: 0, in_kind_base: 0 },
    ],
    wonUnrealized: { won_base: 400, received_base: 150, unrealized_base: 250 },
    leadCount: 3,
    trend: [
      { month_index: 2, month_start: '2026-02-01', achieved: 20 },
      { month_index: 1, month_start: '2026-01-01', achieved: 10 },
    ],
  };

  const dash = buildMonetaryDashboard(raw, names, window);

  it('totals target and achievement across members and verticals', () => {
    expect(dash.totals.target).toBe(1000);
    expect(dash.totals.achieved).toBe(650);
    expect(dash.totals.attainmentPct).toBe(65);
    expect(dash.totals.unachieved).toBe(350);
    expect(dash.hasTarget).toBe(true);
  });

  it('groups per member and per vertical and keeps both views consistent', () => {
    const rahim = dash.byMember.find((m) => m.id === U1);
    expect(rahim).toMatchObject({ name: 'Rahim', target: 800, achieved: 600 });
    expect(dash.byVertical.find((v) => v.id === DSP)).toMatchObject({
      target: 700,
      achieved: 600,
    });
    expect(dash.byMember.reduce((a, m) => a + m.achieved, 0)).toBe(dash.totals.achieved);
    expect(dash.byVertical.reduce((a, v) => a + v.target, 0)).toBe(dash.totals.target);
  });

  it('carries won-not-received, leads and pipeline kinds through', () => {
    expect(dash.wonUnrealized).toEqual({ won: 400, received: 150, unrealized: 250 });
    expect(dash.leadCount).toBe(3);
    expect(dash.pipelineByKind.map((k) => k.kind)).toEqual(['open', 'won', 'lost', 'junk']);
  });

  it('orders the trend by month and labels it', () => {
    expect(dash.trend).toEqual([
      { month: 'Jan', achieved: 10 },
      { month: 'Feb', achieved: 20 },
    ]);
  });

  it('flags a period with no published target', () => {
    const none = buildMonetaryDashboard({ ...raw, targets: [] }, names, window);
    expect(none.hasTarget).toBe(false);
    expect(none.totals.attainmentPct).toBeNull();
  });

  it('shows a member with receipts but no target without inventing one', () => {
    const only = buildMonetaryDashboard(
      { ...raw, targets: [{ user_id: U1, vertical_id: DSP, target: 100 }] },
      names,
      window,
    );
    expect(only.byMember.find((m) => m.id === U2)).toMatchObject({
      target: 0,
      attainmentPct: null,
    });
  });
});

describe('buildNonMonetaryDashboard', () => {
  const window = periodWindow({ period: 'month', year: 2026, index: 10 });
  const raw: NonMonetaryRaw = {
    meetings: [
      { status: 'scheduled', meeting_count: 1 },
      { status: 'done', meeting_count: 3 },
    ],
    activities: [
      { type: 'visit', class: 'independent', activity_count: 2, distinct_contacts: 2 },
      { type: 'event', class: 'independent', activity_count: 1, distinct_contacts: 0 },
      { type: 'servicing', class: 'stewardship', activity_count: 4, distinct_contacts: 3 },
      { type: 'visit', class: 'stewardship', activity_count: 1, distinct_contacts: 1 },
    ],
    contactsEngaged: 5,
    workload: [{ user_id: U1, full_name: 'Rahim', meeting_count: 2, activity_count: 6 }],
  };
  const dash = buildNonMonetaryDashboard(raw, window);

  it('computes meeting completion', () => {
    expect(dash.meetings).toEqual({ total: 4, scheduled: 1, done: 3, completionPct: 75 });
  });

  it('has no completion rate without meetings', () => {
    const empty = buildNonMonetaryDashboard({ ...raw, meetings: [] }, window);
    expect(empty.meetings.completionPct).toBeNull();
  });

  it('counts activity types across classes and exposes visit, event and campaign counts', () => {
    expect(dash.activities.total).toBe(8);
    expect(dash.visits).toBe(3);
    expect(dash.events).toBe(1);
    expect(dash.campaigns).toBe(0);
    expect(dash.activities.byType[0]).toEqual({ type: 'servicing', count: 4 });
  });

  it('always lists the three classes', () => {
    expect(dash.activities.byClass).toEqual([
      { class: 'stewardship', count: 5 },
      { class: 'prospect_engagement', count: 0 },
      { class: 'independent', count: 3 },
    ]);
  });

  it('never exposes a monetary field', () => {
    expect(JSON.stringify(dash)).not.toMatch(/amount|achiev|target|receipt/i);
  });
});

describe('drill-down links', () => {
  const w = { start: '2026-10-01', end: '2026-12-31' };

  it('carries the period and member to the list pages', () => {
    expect(meetingsHref(w, U1)).toBe(
      `/meetings?fromDate=2026-10-01&toDate=2026-12-31&ownerId=${U1}`,
    );
    expect(activitiesHref(w, null, { type: 'visit' })).toBe(
      '/activities?fromDate=2026-10-01&toDate=2026-12-31&type=visit',
    );
  });
});
