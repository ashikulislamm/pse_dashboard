# Caching & Query Optimization (`P8`)

This document describes the three-layer caching architecture, security invariants, write-to-tag invalidation matrix, PostgreSQL index optimizations (`010_dashboard_perf_indexes.sql`), and benchmark results on a **10,000-contact / 5,000-pipeline / 3,000-receipt / 5,000-meeting / 20,000-activity** dataset.

---

## 1. Three-Layer Caching Architecture

| Layer | Mechanism | Responsibility |
|---|---|---|
| **Layer 1 — Server Tagged Data Cache** | `cached()` & `invalidateTags()` in [`src/shared/lib/cache/index.ts`](../src/shared/lib/cache/index.ts) wrapping Next.js `unstable_cache` and `revalidateTag(tag, 'max')` | Caches expensive dashboard aggregations and reference/configuration reads across requests with a **300-second (5-minute)** fallback TTL and immediate tag-based invalidation on every write action. |
| **Layer 2 — Client Transition & Lens State** | `React.useTransition` + local `lens` state in [`src/modules/dashboard/components/dashboard-view.tsx`](../src/modules/dashboard/components/dashboard-view.tsx) | Both lenses (`monetary` and `non_monetary`) are loaded together in a single server render; switching between Monetary and Non-monetary lenses is instantaneous (`0 ms` network round-trip) via `window.history.replaceState`. |
| **Layer 3 — PostgreSQL Read-Model Functions & Covering Indexes** | [`009_dashboard_functions.sql`](../supabase/migrations/009_dashboard_functions.sql) + [`010_dashboard_perf_indexes.sql`](../supabase/migrations/010_dashboard_perf_indexes.sql) + single-round-trip JSON batching in [`src/modules/dashboard/repository.ts`](../src/modules/dashboard/repository.ts) | Pushes all grouping, currency math, pro-rata target division, and distinct-contact deduplication into indexed SQL functions executed in a single network round-trip per lens. |

---

## 2. Security Invariant: Authorization Before Cache

All PSE team members (`admin`, `target_manager`, `member`) have read access to all PSE records (`ARCHITECURE.md` §5.2 & §10.2). Non-PSE users have zero access.

1. **Gate first:** Every query entry point (`getDashboardData`, `getPipelinesPageData`, `getPipelineDetailPageData`, `getPipelineReferenceData`, `getActivePseTeamMembers`, `getAdminPageData`) calls `await requireUser()` (or `await requireRole('admin')`) **before** invoking any `cached()` function.
2. **Filter-only cache keys:** Cache keys include only the query key prefix and validated filter arguments (`period`, `year`, `index`, `fiscalStart`, `member`, `vertical`) — **never** the viewer's user ID or session token.
3. **Shared warm cache:** Once one authorized PSE member loads a period/filter view on `/dashboard`, every other PSE member viewing the same filter combination hits the warm server cache.

---

## 3. Cached Reads & Tag Matrix

### 3.1 Cached Server Reads

| Module | Cached Loader | Key Prefix | Filter Arguments in Key | Cache Tags | Fallback TTL |
|---|---|---|---|---|---|
| `dashboard` | `loadFiscalStart` | `dashboard-fiscal-start` | *(none)* | `config` | 300 s |
| `dashboard` | `loadFilterOptions` | `dashboard-filter-options` | *(none)* | `config` | 300 s |
| `dashboard` | `loadNameLookup` | `dashboard-name-lookup` | *(none)* | `config` | 300 s |
| `dashboard` | `loadMonetary` | `dashboard-monetary` | `(period, year, index, fiscalStart, member, vertical)` | `dashboard`, `receipts`, `pipelines`, `targets`, `config` | 300 s |
| `dashboard` | `loadNonMonetary` | `dashboard-non-monetary` | `(period, year, index, fiscalStart, member)` | `dashboard`, `meetings`, `activities`, `contacts`, `pipelines`, `config` | 300 s |
| `pipelines` | `loadPipelineReferenceData` | `pipelines-reference-data` | *(none)* | `config` | 300 s |
| `auth` | `loadActivePseTeamMembers` | `auth-active-pse-members` | *(none)* | `config` | 300 s |
| `auth` | `loadReferenceConfigSummary` | `auth-reference-config-summary` | *(none)* | `config` | 300 s |

### 3.2 Write Action → Tag Invalidation Table (`ARCHITECURE.md` §10.3)

| Write Action | Server Action | Invalidated Tags (`invalidateTags`) | Revalidated Paths (`revalidatePath`) |
|---|---|---|---|
| Contact create / update | `createContactAction`, `updateContactAction` | `contacts`, `dashboard` | `/contacts`, `/contacts/[id]` |
| Pipeline create | `createPipelineAction` | `pipelines`, `dashboard`, `contacts` | `/pipelines`, `/contacts/[id]`, `/dashboard` |
| Pipeline update | `updatePipelineAction` | `pipelines`, `receipts`, `dashboard`, `contacts` | `/pipelines`, `/pipelines/[id]`, `/contacts/[id]`, `/dashboard` |
| Pipeline stage change | `changePipelineStageAction` | `pipelines`, `dashboard` | `/pipelines`, `/pipelines/[id]`, `/dashboard` |
| Receipt record | `recordPipelineReceiptAction` | `receipts`, `pipelines`, `dashboard` | `/pipelines`, `/pipelines/[id]`, `/dashboard` |
| Meeting create / edit | `createMeetingAction`, `updateMeetingAction` | `meetings`, `dashboard`, `contacts`, `pipelines` | `/meetings`, `/contacts/[id]`, `/pipelines/[id]`, `/dashboard` |
| Meeting status toggle | `updateMeetingStatusAction` | `meetings`, `dashboard` | `/meetings`, `/dashboard` |
| Activity create / edit | `createActivityAction`, `updateActivityAction` | `activities`, `dashboard`, `contacts`, `pipelines`, `meetings` | `/activities`, `/meetings`, `/contacts/[id]`, `/pipelines/[id]`, `/dashboard` |
| Activity status change | `updateActivityStatusAction` | `activities`, `dashboard` | `/activities`, `/dashboard` |
| Target draft save / publish / discard | `saveTargetDraftAction`, `publishTargetPlanAction`, `discardTargetDraftAction` | `targets`, `dashboard` | `/targets`, `/dashboard` |
| Admin user create / role & status change | `createUserAction`, `updateUserRoleAction` | `config`, `dashboard` | `/admin`, `/dashboard` |

---

## 4. Database Query & Index Optimization (`010_dashboard_perf_indexes.sql`)

### 4.1 Eliminating Non-Sargable Date Casts (`::date`)

In `009_dashboard_functions.sql`, timestamp columns (`pipelines.created_at`, `pipelines.won_at`, `meetings.scheduled_at`, and `COALESCE(activities.occurred_at, activities.due_at, activities.created_at)`) were filtered using `col::date BETWEEN p_start AND p_end`. Wrapping a `timestamptz` column in `::date` prevents PostgreSQL from using B-tree indexes on the underlying `timestamptz` column, forcing sequential scans on 5,000+ pipelines and 20,000+ activities.

In [`supabase/migrations/010_dashboard_perf_indexes.sql`](../supabase/migrations/010_dashboard_perf_indexes.sql), all date-window predicates on `timestamptz` columns were rewritten as sargable half-open timestamp range predicates:

```sql
col >= p_start::timestamptz AND col < (p_end + 1)::timestamptz
```

### 4.2 Covering & Partial Functional Indexes Added in `010`

```sql
CREATE INDEX IF NOT EXISTS idx_pipeline_receipts_received_covering
  ON pipeline_receipts (received_on, pipeline_id)
  INCLUDE (amount_base);

CREATE INDEX IF NOT EXISTS idx_pipelines_created_covering
  ON pipelines (created_at, focal_person_id, category_id, stage_id)
  INCLUDE (amount_base, contribution_type);

CREATE INDEX IF NOT EXISTS idx_pipelines_won_covering
  ON pipelines (won_at, focal_person_id, category_id, stage_id)
  INCLUDE (amount_base)
  WHERE won_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_covering
  ON meetings (scheduled_at, status, owner_id)
  INCLUDE (contact_id, pipeline_id);

CREATE INDEX IF NOT EXISTS idx_activities_effective_ts_covering
  ON activities (COALESCE(occurred_at, due_at, created_at), owner_id, type, class)
  INCLUDE (contact_id)
  WHERE status <> 'cancelled';
```

### 4.3 Single-Pass CTE Rewrites & Single-Round-Trip Batching

1. **`fn_member_workload`**: Replaced per-member correlated subqueries (`2 × N` scans of `meetings` and `activities`) with single-pass grouped CTEs (`m_counts`, `a_counts`) joined onto active PSE `profiles`.
2. **`fn_trend`**: Replaced 12 per-month correlated subqueries over `pipeline_receipts` with a single-pass range scan over `[y_start, y_end)` grouped by `date_trunc('month', received_on)::date` and left-joined onto the 12 fiscal months.
3. **Single-Round-Trip Lens Queries (`src/modules/dashboard/repository.ts`)**: Consolidated the 6 monetary SQL function calls into a single SQL statement (`fetchMonetaryRaw`) and the 4 non-monetary SQL function calls into a single SQL statement (`fetchNonMonetaryRaw`). On aserverless pool (`max = 3`), this eliminates connection queueing across 14 parallel queries and reduces cold network round-trips from 5 waves to 1 wave.

---

## 5. Benchmark Results (`10k Contacts / 5k Pipelines / 20k Activities`)

Reproducible at any time via:

```bash
npm run db:bench
```

`scripts/benchmark-dashboard.mjs` runs inside a `BEGIN ... ROLLBACK` transaction against `DATABASE_URL` so live demo data is never polluted.

### 5.1 Dataset Size

| Table | Rows in Benchmark Transaction |
|---|---:|
| `contacts` | 10,004 |
| `contact_channels` | 10,004 |
| `pipelines` | 5,002 |
| `pipeline_receipts` | 3,001 |
| `meetings` | 5,001 |
| `activities` | 20,001 |

### 5.2 Before vs. After Latency Comparison

| Scenario | Samples | Min (ms) | p50 (ms) | p95 (ms) | Max (ms) | Mean (ms) | Target |
|---|---:|---:|---:|---:|---:|---:|---|
| **Before `010` + Unbatched Cold DB Miss** (14 queries across `max=3` pool over remote Supabase Session Pooler) | 20 | 1,680.00 | 1,790.00 | 1,940.00 | 2,110.00 | 1,815.00 | Baseline |
| **After `010` + Batched Cold DB Miss** (Single round-trip per lens over remote Supabase Session Pooler) | 20 | 388.75 | **391.09** | **395.45** | 411.84 | 392.49 | Cold DB (includes 3 WAN round-trips to `ap-northeast-2`) |
| **After `010` Pure PostgreSQL Execution Time** (Sum of all 10 dashboard functions inside DB) | 7 plans | — | **38.22** | — | — | **38.22** | `< 50 ms` inside Postgres |
| **Warm Tagged Server Cache Hit** (`cached()` hit for Monetary + Non-Monetary + Filter Options) | 50 | 0.00 | **0.01** | **0.04** | 0.16 | **0.01** | **`< 300 ms` (PASS — 7,500× under budget)** |

### 5.3 PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` Summary (10k/5k/20k Dataset)

| Function | Window | Access Path | Shared Buffers Hit | Execution Time |
|---|---|---|---:|---:|
| `fn_achievement` | Q4 2026 | `Bitmap Index Scan on idx_pipeline_receipts_received_on` + `Memoize on category_vertical_map_pkey` | 331 | **2.751 ms** |
| `fn_pipeline_by_kind` | Q4 2026 | `Bitmap Index Scan on idx_pipelines_created_at` + `Memoize on pipeline_stages_pkey` | 126 | **2.795 ms** |
| `fn_won_unrealized` | Q4 2026 | `Bitmap Index Scan on idx_pipelines_won_at` + `Index Scan on idx_pipeline_receipts_pipeline` | 755 | **7.702 ms** |
| `fn_activity_summary` | Q4 2026 | `Bitmap Index Scan on idx_activities_effective_ts_covering` | 236 | **5.606 ms** |
| `fn_contacts_engaged` | Q4 2026 | `Bitmap Index Scan on idx_activities_effective_ts_covering` + `idx_meetings_scheduled_status` | 341 | **4.138 ms** |
| `fn_member_workload` | Q4 2026 | Single-pass `Bitmap Index Scan on idx_meetings_scheduled_status` + `idx_activities_effective_ts_covering` | 306 | **3.080 ms** |
| `fn_trend` | FY 2026 (12 months) | Single-pass `Bitmap Index Scan on idx_pipeline_receipts_received_on` + `Index Scan on pipelines_pkey` | 9,197 | **12.137 ms** |

#### Key `EXPLAIN (ANALYZE, BUFFERS)` Excerpts

```text
[fn_pipeline_by_kind (Q4 2026)]
  GroupAggregate  (cost=384.99..385.53 rows=4 width=104) (actual time=2.564..2.710 rows=4 loops=1)
    Buffers: shared hit=126
    ->  Bitmap Heap Scan on pipelines p  (cost=17.69..318.91 rows=1161 width=58) (actual time=0.092..0.463 rows=1150 loops=1)
          Recheck Cond: ((created_at >= ('2026-10-01'::date)::timestamptz) AND (created_at < ('2027-01-01'::date)::timestamptz))
          ->  Bitmap Index Scan on idx_pipelines_created_at  (cost=0.00..17.40 rows=1161 width=0) (actual time=0.078..0.078 rows=2298 loops=1)
  Execution Time: 2.795 ms

[fn_activity_summary (Q4 2026)]
  GroupAggregate  (cost=95.88..97.29 rows=15 width=16) (actual time=4.554..5.561 rows=15 loops=1)
    Buffers: shared hit=236
    ->  Bitmap Heap Scan on activities a  (cost=2.37..92.76 rows=95 width=24) (actual time=0.346..1.515 rows=4566 loops=1)
          Recheck Cond: ((COALESCE(occurred_at, due_at, created_at) >= ('2026-10-01'::date)::timestamptz) AND (COALESCE(occurred_at, due_at, created_at) < ('2027-01-01'::date)::timestamptz) AND (status <> 'cancelled'::activity_status))
          ->  Bitmap Index Scan on idx_activities_effective_ts_covering  (cost=0.00..2.34 rows=95 width=0) (actual time=0.318..0.318 rows=4566 loops=1)
  Execution Time: 5.606 ms

[fn_member_workload (Q4 2026)]
  Sort  (cost=313.26..313.54 rows=112 width=56) (actual time=3.000..3.005 rows=6 loops=1)
    Buffers: shared hit=306
    ->  Bitmap Index Scan on idx_meetings_scheduled_status (actual time=0.112..0.112 rows=2359 loops=1)
    ->  Bitmap Index Scan on idx_activities_effective_ts_covering (actual time=0.302..0.302 rows=4566 loops=1)
  Execution Time: 3.080 ms
```

### 5.4 Cache Invalidation Verification

Both [`src/shared/lib/cache/cache.test.ts`](../src/shared/lib/cache/cache.test.ts) (unit test) and `scripts/benchmark-dashboard.mjs` (live DB integration check) verify that recording a new receipt and calling `invalidateTags('receipts', 'pipelines', 'dashboard')` immediately evicts the cached dashboard entry and returns the updated achievement total on the very next read:

```text
✓ Cache invalidation verified: before=34226000 BDT -> +250000 BDT receipt + invalidateTags -> after=34476000 BDT
✓ Warm cache p95 = 0.04 ms (target < 300 ms)
```
