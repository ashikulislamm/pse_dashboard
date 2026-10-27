import { CACHE_TAGS, cached } from '@/shared/lib/cache';
import { requireUser } from '@/shared/lib/rbac';
import {
  fetchMonetaryRaw,
  fetchNonMonetaryRaw,
  getFiscalStartMonth,
  getNameLookup,
  listDashboardMembers,
  listDashboardVerticals,
} from './repository';
import type { DashboardFilterInput, DashboardPeriodType } from './schema';
import {
  buildMonetaryDashboard,
  buildNonMonetaryDashboard,
  fiscalPositionOf,
  periodWindow,
  resolveDashboardFilters,
} from './service';

/*
 * Cached reads. The cache key is the function arguments (filters only, never the viewer), so every
 * authorised PSE member shares one entry. `getDashboardData` authorises the caller BEFORE touching
 * any of these; the cached functions themselves read on the owner connection.
 */

const loadFiscalStart = cached(
  async () => getFiscalStartMonth(),
  ['dashboard-fiscal-start'],
  [CACHE_TAGS.config],
);

const loadFilterOptions = cached(
  async () => {
    const [members, verticals] = await Promise.all([
      listDashboardMembers(),
      listDashboardVerticals(),
    ]);
    return { members, verticals };
  },
  ['dashboard-filter-options'],
  [CACHE_TAGS.config],
);

const loadMonetary = cached(
  async (
    period: DashboardPeriodType,
    year: number,
    index: number,
    fiscalStart: number,
    member: string | null,
    vertical: string | null,
  ) => {
    const window = periodWindow({ period, year, index }, fiscalStart);
    const [raw, names] = await Promise.all([
      fetchMonetaryRaw(window, member, vertical),
      getNameLookup(),
    ]);
    return buildMonetaryDashboard(raw, names, window);
  },
  ['dashboard-monetary'],
  [
    CACHE_TAGS.dashboard,
    CACHE_TAGS.receipts,
    CACHE_TAGS.pipelines,
    CACHE_TAGS.targets,
    CACHE_TAGS.config,
  ],
);

const loadNonMonetary = cached(
  async (
    period: DashboardPeriodType,
    year: number,
    index: number,
    fiscalStart: number,
    member: string | null,
  ) => {
    const window = periodWindow({ period, year, index }, fiscalStart);
    const raw = await fetchNonMonetaryRaw(window, member);
    return buildNonMonetaryDashboard(raw, window);
  },
  ['dashboard-non-monetary'],
  [CACHE_TAGS.dashboard, CACHE_TAGS.meetings, CACHE_TAGS.activities, CACHE_TAGS.contacts],
);

export async function getDashboardData(rawFilters: DashboardFilterInput) {
  await requireUser();

  const fiscalStart = await loadFiscalStart();
  const today = new Date();
  const filters = resolveDashboardFilters(rawFilters, today, fiscalStart);
  const window = periodWindow(filters, fiscalStart);
  const currentYear = fiscalPositionOf(today, fiscalStart).year;

  const [monetary, nonMonetary, options] = await Promise.all([
    loadMonetary(
      filters.period,
      filters.year,
      filters.index,
      fiscalStart,
      filters.member,
      filters.vertical,
    ),
    loadNonMonetary(filters.period, filters.year, filters.index, fiscalStart, filters.member),
    loadFilterOptions(),
  ]);

  const years = [
    ...new Set([currentYear + 1, currentYear, currentYear - 1, currentYear - 2, filters.year]),
  ].sort((a, b) => b - a);

  return { filters, window, monetary, nonMonetary, options, years, fiscalStart };
}
