# PSE Dashboard — Scope Statement & Assumptions (Phase 0)

See [ASSUMPTIONS.md](./ASSUMPTIONS.md) for the complete, canonical scope statement, in/out-of-scope boundaries, and locked ambiguity defaults.

## Quick Summary of Out-of-Scope Items
- **No Gmail / Email Integration:** Emails are logged manually via the Activities module (`type = email`).
- **No File Uploads / Storage Bucket:** Google Drive links are pasted in notes fields and rendered as safe external links (`rel="noopener noreferrer"`).
- **No External Autofill:** Company and contact lookup suggestions use internal PSE records only.
- **No Standalone Events Module:** Events, campaigns, and visits are recorded as Activities (`event`, `campaign`, `visit`).
- **No Follow-up Rate KPI:** Parked pending PSE definition of formula, trigger, and time window.

# PSE Dashboard — Scope & Assumptions

This document locks the scope, architectural assumptions, and ambiguity defaults for the Private Sector Engagement (PSE) CRM & Performance Dashboard build.

---

## 1. Scope Statement

### In Scope (Built)
- **Authentication & RBAC:** Postgres-backed email + password (`scrypt`) with HS256 JWT session cookies, session proxy, PSE-only visibility (`is_pse_member()`), and role-based write access (`admin`, `target_manager`, `member`) enforced in both the server layer and PostgreSQL Row-Level Security (RLS).
- **Contacts Module:** Individual and Company contacts, structured organization and designation fields, multi-channel (`email` / `phone`) repeater with mandatory `>= 1` channel constraint, normalized deduplication on both email (lowercase) and phone (E.164), relationship intelligence notes, related records timeline, and reusable inline `ContactPicker`.
- **Pipelines & Receipts Module:** Money-only opportunities (`expected_amount > 0`), Cash and valued In-kind contributions (with mandatory valuation note), Individual and Company party modes (with Point of Contact and Secondary Contact), stage progression with `pipeline_stage_history`, Won/Lost confirmation (with mandatory `lost_reason`), multi-currency conversion to base currency (`BDT`), and `pipeline_receipts` tracking realized funds.
- **Meetings Module:** Structured meeting records linked to a Contact or Pipeline (`CHECK` constraint), read-only organization/designation derived from the linked contact, `scheduled` / `done` status tracking, and follow-up activity shortcut.
- **Activities Module:** Non-monetary work tracker covering all 11 activity types (`task`, `email`, `call`, `meeting`, `event`, `campaign`, `proposal`, `visit`, `servicing`, `prospect_engagement`, `general`) and 3 reporting classes (`stewardship`, `prospect_engagement`, `independent`). Never affects monetary figures.
- **Targets Module:** Step-by-step setup wizard (`Annual → Q1–Q4 → Team Members → Vertical % → Review & Publish/Lock`) using largest-remainder rounding so allocations reconcile exactly. Permanently locked after publish via database triggers; writable only by `target_manager` and `admin`.
- **Two-Lens Dashboard:**
  - **Monetary Lens:** Target vs. Achievement, attainment %, unachieved / over-achieved, Won-unrealized, breakdowns by member, vertical, and pipeline stage kind (`open`, `won`, `lost`, `junk`), cash vs. valued in-kind split, and monthly trend.
  - **Non-Monetary Lens:** Meeting counts and completion rate, activity counts by type and class, visits/events/campaigns, distinct contacts engaged, and per-member workload.
- **Tagged Server Caching:** Next.js server data cache with granular tag invalidation (`dashboard`, `pipelines`, `receipts`, `meetings`, `activities`, `targets`, `config`) on every write action, plus TanStack Query client caching.

### Designed as Extension Points (Documented, Not Built in Initial Cut)
- **Odoo CSV Importer UI:** Schema (`import_jobs`) and deduplication service rules are established; bulk CSV mapping UI is deferred until PSE supplies final Odoo export field mappings.
- **Admin Configuration CRUD UI:** Reference tables (`pipeline_stages`, `contribution_categories`, `verticals`, `category_vertical_map`, `currencies`, `fx_rates`, `settings`) are database-driven, seeded, and editable via SQL without code changes.
- **Kanban Drag-and-Drop:** Pipeline board view groups deals by stage and allows stage changes via an accessible stage dropdown; drag-and-drop is deferred.
- **Non-Monetary Count Targets & Follow-up Rate KPI:** Deferred pending PSE formula approval.
- **Hierarchical Target Approval Workflow:** Deferred pending PSE organizational hierarchy sign-off; governed by `target_manager` role in the interim.

### Strictly Out of Scope (Explicit Requirements Decisions)
- **No Gmail / Email Sync:** Emails are logged manually as activities.
- **No File Uploads / Blob Storage:** Documents live in Google Drive; URLs are pasted into notes fields and auto-linked safely (`rel="noopener noreferrer"`).
- **No External Autofill:** Company and contact suggestions come strictly from internal PSE records.
- **No Standalone Events Module:** Events, campaigns, and visits are tracked as Activity types (`event`, `campaign`, `visit`).

---

## 2. Locked Decisions & Defaults for Open Items

| # | Open Item / Ambiguity | Locked Decision for Build | Reconfigurability |
|---|---|---|---|
| 1 | **Pipeline stages** | Seed 8 stages: `New`, `Scoping`, `Preparation`, `Submitted`, `Pending` (`kind = open`), `Won` (`kind = won`), `Lost` (`kind = lost`), `Abandoned` (`kind = junk`). | Stored in `pipeline_stages`; all reports group by `kind`, never hardcoded stage names. |
| 2 | **Lead KPI definition** | Count of pipelines created within the selected period. | Isolated in SQL function `fn_lead_count(p_start, p_end, p_user)` for single-place updates. |
| 3 | **Category vs. Vertical terminology** | Treated as two linked dimensions: 6 `contribution_categories` (`DSP`, `SAC`, `Disaster Campaign`, `Project`, `Event & Campaign`, `General`) mapped to 3 `verticals` (`DSP`, `VBD`, `Project`) via `category_vertical_map` (`DSP → DSP`, `Project → Project`, others `→ VBD`). | Editable in `category_vertical_map` table. |
| 4 | **Achievement definition** | `Achievement = SUM(pipeline_receipts.amount_base)` where `received_on` falls in the period. Won deals without full receipts show the difference as *"Won, not yet received"*. | Isolated in `fn_achievement` and `fn_won_unrealized`. |
| 5 | **Monthly Target vs. Achievement** | Targets are set quarterly and annually. Monthly view displays `Quarter Target ÷ 3`, explicitly labelled *"pro-rata"*. | Computed in `fn_target` and labelled in UI. |
| 6 | **Over-achievement & Carry-forward** | No carry-forward between quarters. Over-achievement in Q1 (`> 100%`) stays in Q1; Q2 target remains unchanged. Annual actual = sum of all receipts in the year. | Enforced by period-bounded SQL queries and immutable `target_quarters`. |
| 7 | **Calendar vs. Fiscal Year & Currency** | Calendar year (`fiscal_year_start_month = 1`); base currency `BDT` (`৳`). Foreign currencies (`USD`, `EUR`, `GBP`) converted to `amount_base` at write time via `fx_rates`. | Stored in `settings`, `currencies`, and `fx_rates`. |
| 8 | **Contact active/inactive status** | Included on `contacts.status` (`active` | `inactive`, default `active`). | Filterable column on `contacts`. |
| 9 | **Target edit permissions** | Restricted to `target_manager` (e.g., Safina) and `admin` roles; read-only for `member`. Locked permanently once published (`locked_at IS NOT NULL`). | Enforced via RLS policies and `BEFORE` triggers on target tables. |
| 10 | **Meetings vs. Activity type `meeting`** | Structured `meetings` table drives all Meeting KPIs on the dashboard. Activity type `meeting` is retained for informal activity logging only. | Separated at schema and SQL function level. |
| 11 | **Database Connection & Auth Mechanism** | Connect strictly via the Supabase Cloud PostgreSQL **Session Pooler URI (`DATABASE_URL`, port `5432`)** using `pg` (`node-postgres`) and Typed Parameterized SQL in `repository.ts` (no separate ORM layer). Authentication uses PostgreSQL credential verification (`scrypt`) + standard RFC 7519 **HS256 JWT** HTTP-only session cookies (`AUTH_SECRET`), setting `request.jwt.claim.sub` / `app.current_user_id` per transaction so PostgreSQL Row-Level Security (RLS) policies and triggers execute directly in the database without requiring external Supabase API keys. | Controlled via `src/shared/lib/supabase/` and `src/shared/lib/rbac/`. |
| 12 | **Package Manager** | Standardized on `npm` (`package-lock.json`, `npm ci`) across local development and GitHub Actions CI. | Configured in `package.json` and `.github/workflows/ci.yml`. |

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

# Known Limitations & Deferred Scope (`P9`)

This document records intentional MVP scope cuts, architectural trade-offs, and open domain items awaiting final sign-off from the Private Sector Engagement (PSE) team.

---

## 1. Intentional Scope Cuts (Per Requirements & `PHASES.md`)

1. **No Gmail / Email Sync:** Outbound and inbound emails are logged manually as Activity records (`type = 'email'`). Automated inbox sync is out of scope for data-privacy and security compliance.
2. **No File Uploads or Blob Storage:** Contracts, MoUs, and valuation sheets are stored in the team's Google Drive; users paste Drive URLs into notes fields (`contacts.notes`, `pipelines.notes`, `activities.notes`), where `<AutoLinkedNotes />` renders them as safe clickable external links (`target="_blank" rel="noopener noreferrer"`).
3. **No External Company Autofill:** Organization and contact suggestions come strictly from internal PSE records via `<ContactPicker />` and `<Combobox />`.
4. **No Standalone Events Module:** Events, campaigns, and visits are tracked inside the **Activities** module (`event`, `campaign`, `visit` types) and surfaced on the Non-Monetary Dashboard lens.
5. **Odoo CSV Bulk Importer UI Deferred:** The database schema (`001`–`010`) and channel deduplication service (`normalizeEmail`, `normalizePhoneE164`, `findByNormalizedChannels`) are production-ready, but an interactive CSV column-mapping UI is deferred until PSE provides final Odoo export column headers.
6. **Stage Board Drag-and-Drop Deferred:** `/pipelines` provides both a tabular List view and a stage-grouped Board view. Changing a pipeline's stage uses `<StageQuickSelect />` (keyboard-accessible `<Select />` with confirmation and mandatory `lost_reason` modals) rather than pointer drag-and-drop.
7. **Admin Reference Table Editing via SQL Seed:** `/admin` provides live user provisioning and role/status/PSE-membership management (`admin`, `target_manager`, `member`) plus read-only inspection of reference tables (`pipeline_stages`, `category_vertical_map`, `fx_rates`). Modifying stages, categories, or FX rates is performed via idempotent SQL migrations or `supabase/seed.sql`.

---

## 2. Domain & Reporting Trade-offs

1. **Monthly Pro-Rata Target Rounding (1–2 Cent Drift):**
   - Targets are set and locked at the **annual** and **quarterly** levels (`target_plans`, `target_quarters`, `target_lines`).
   - When the Dashboard is viewed in **Monthly** mode, `fn_target` computes each member × vertical line as `ROUND(l.amount / 3, 2)` and the UI labels the figure **Pro-rata (quarter ÷ 3)**. Because each line is rounded to 2 decimal places independently, the sum of monthly pro-rata lines can differ by `৳ 0.01–0.02` from the exact one-third of the quarterly total.
2. **Pipeline Dashboard Tiles vs. Pipelines List Date Basis:**
   - On `/dashboard`, `fn_pipeline_by_kind` and `fn_lead_count` count pipelines **created** within the selected period (`created_at`), and `fn_won_unrealized` sums deals **won** within the selected period (`won_at`).
   - On `/pipelines`, date filters operate on `expected_close`. Consequently, only Non-Monetary Dashboard tiles (Meetings and Activities, which share the same date basis as `/meetings` and `/activities`) render direct period drill-down links.
3. **Lead KPI Formula Pending PSE Confirmation:**
   - As documented in `docs/ASSUMPTIONS.md`, the Lead KPI currently counts pipelines created in the period (`fn_lead_count` in `010_dashboard_perf_indexes.sql`). If PSE later refines this definition (for example, filtering by initial stage or contact creation), only `fn_lead_count` needs to be updated.
4. **Manual FX Rate Table (`fx_rates`):**
   - Foreign-currency pipelines and receipts (`USD`, `EUR`, `GBP`) are converted to base currency (`BDT`) at write time using the most recent rate in `fx_rates` on or before the effective date. Live central-bank FX polling is not enabled.

---

## 3. Security & Operational Notes

1. **Public Demo Credentials vs. Brute-Force Lockout (`login_attempts`):**
   - `signInAction` locks an email address for 15 minutes after 5 failed sign-in attempts within a 15-minute window (`007_security_hardening.sql`). Because the demo email addresses (`admin@pse.org`, `safina@pse.org`, `rahim@pse.org`) are publicly listed on `/login` and in `README.md` for evaluators, repeated intentional bad-password attempts against a demo account will temporarily lock that demo email for 15 minutes.
2. **Serverless Connection Pool Sizing (`DATABASE_POOL_MAX`):**
   - `getDbPool()` defaults to `max = 3` connections per serverless instance against the Supabase Session Pooler (`port 5432`). Dashboard lens queries are batched into 1 SQL round-trip per lens (`fetchMonetaryRaw`, `fetchNonMonetaryRaw`) so cold cache misses never queue on the 3-connection pool.
