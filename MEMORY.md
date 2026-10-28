# PSE Dashboard — Project Memory & Progress Log

Last updated: 2026-10-27 (after Phases 0–9 plus the security and infrastructure hardening pass below)

---

## 1. Project Context & Key Overrides

- **Goal:** Build the Private Sector Engagement (PSE) CRM & Performance Dashboard (modular monolith on Next.js App Router + Supabase Cloud Postgres/RLS + Vercel).
- **Hard Deadline:** Wednesday, 28 Oct 2026, 11:59 PM (target submission by 8:00 PM).
- **Package Manager Override:** Uses **`npm`** (`package-lock.json`, `.npmrc` with `legacy-peer-deps=true`, `npm run ...`, `npm ci` on Node 22 in GitHub Actions).
- **Database & Auth Connection Override (Option 2 — Session Pooler URI Only, Typed SQL, HS256 JWT):**
  - Connects to Supabase Cloud PostgreSQL **strictly via the Session Pooler `DATABASE_URL` (port `5432`, IPv4-compatible)** using `pg` (`node-postgres`) and Typed Parameterized SQL inside each module's `repository.ts` (no separate ORM layer, and no external Supabase API keys required).
  - Authentication uses PostgreSQL `profiles` records (`scrypt` password hashes) + **standard RFC 7519 HS256 JWT** HTTP-only cookies (`pse_session`, signed with `AUTH_SECRET`).
  - User-scoped database operations (`withUserTransaction(userId, fn)` in `src/shared/lib/supabase/server.ts`) execute `SET LOCAL ROLE authenticated` and set `request.jwt.claim.sub` and `app.current_user_id` inside each transaction so PostgreSQL Row-Level Security (RLS) and triggers enforce all permissions directly inside Postgres.
- **Strict Design System (`DESIGN.md`):**
  - Flat, low-chroma CSS variables in `src/app/globals.css` (`:root` and `.dark`), `Inter` typeface (`tabular-nums` on all numbers/dates).
  - Hard bans enforced by `npm run lint:design` (`scripts/check-design-bans.mjs`): no gradients, blur/glassmorphism, pulsing/pinging animations, or `shadow-lg/xl/2xl`.
  - **No focus outline ring on click:** All inputs (`Input`), dropdowns (`Select`, `Combobox`, `ContactPicker`), `Textarea`, and `Button` components use `outline-none focus:outline-none focus-visible:outline-none` (no blue focus ring on click).
  - All money and dates MUST be formatted exclusively through `<Money />` (`formatMoney`) and `<DateText />` (`formatDateText`) from `@/shared/ui`.

---

## 2. Phase Tracker

| Phase | Description | Status | Notes |
|---|---|---|---|
| **P0** | Lock decisions & scope (`docs/ASSUMPTIONS.md`, `docs/00-scope-and-assumptions.md`) | **Completed** | All ambiguity defaults and in/out-of-scope rules documented. |
| **P1** | Project initialization, infra, shared helpers & design system setup | **Completed** | Next.js 16.4.3, Tailwind v4, module skeleton, shared libs, shared UI, ESLint boundaries. |
| **P2** | Database migrations (`001`–`006`), seed scripts, Auth, RBAC, AppShell | **Completed** | All 6 SQL migrations + reference seed + demo dataset pushed to Supabase Cloud DB; 10 DB & RLS invariant tests passing; `/login`, `/no-access`, `src/proxy.ts`, role-aware `AppShell`, and `/admin` user & config screen implemented. |
| **P3** | Contacts module & `ContactPicker` | **Completed** | Individual/Company conditional form, channel repeater (`>= 1` email/phone), E.164/email deduplication with "Open contact" / "Use existing" alert, inline company creation, reusable `<ContactPicker />` with inline create, `/contacts` list + filters, and `/contacts/[id]` detail page with related records tabs. |
| **P4** | Pipelines & Receipts module | **Completed** | Money-only (`expected_amount > 0`) with `/activities` redirect hint, Cash vs. In-kind mandatory valuation note, Company (with POC & secondary contact via `<ContactPicker />`) vs. Individual, live FX conversion to BDT (`amount_base`), List & stage-grouped Board views with `<StageQuickSelect />`, stage history timeline, Won/Lost/Junk confirmation & reason dialogs, `pipeline_receipts` recording (`Won ৳ X · Received ৳ Y · Unrealized ৳ (X − Y)` + over-receipt flag), and cache tag invalidation. |
| **P5** | Meetings & Activities modules | **Completed** | Meetings (`contact_id` OR `pipeline_id` required, derived read-only organization/designation from contact, Scheduled/Done tabs, 1-click `"Add follow-up"` activity shortcut); Activities (11 types, 3 non-monetary classes with `defaultActivityClassForType`, Excel tracker table view, `"My activities"` preset toggle, inline status updates, and pre-linked shortcuts from Contacts, Pipelines, and Meetings). |
| **P6** | Targets wizard & lock | **Completed** | Annual → Q1–Q4 → Members → Verticals (%) → Review wizard (drafts saved server-side on every step), largest-remainder rounding, publish = lock (DB triggers + `publish_target_plan`), read-only published view for everyone, drafts visible only to admin/target_manager. |
| **P7** | Two-lens Dashboard & SQL read functions (`009`) | **Completed** | Monetary + Non-monetary lenses, Monthly (pro-rata) / Quarterly / Annual, member and vertical filters in the URL, tagged `cached()` reads. Cache benchmarking and `docs/CACHING.md` are still P8. |
| **P8** | Tagged server caching & performance benchmark | **Completed** | `010_dashboard_perf_indexes.sql`, single-round-trip lens queries, cached reference reads (`dashboard`, `pipelines`, `auth`), `cache.test.ts`, `scripts/benchmark-dashboard.mjs` (`npm run db:bench`), and `docs/CACHING.md` (warm cache p95 = `0.04 ms` on 10k contacts / 5k pipelines / 20k activities). |
| **P9** | Testing & hardening | **Completed** | 87 Vitest unit tests (12 files), 17 PostgreSQL invariant/RLS/trigger/function tests (`npm run db:test`), Playwright E2E happy-path & security suite (`npm run test:e2e`), client bundle security audit (`npm run check:security`), P1 nested `<form>` fix in `ContactForm`, `pg@9.0` deprecation fix, and `docs/KNOWN_LIMITATIONS.md`. |
 progress | Docs consolidated into six files in docs/ (01, 02, 04, 05, 07, 08). Remaining: prod deploy, PSE_Architecture.pdf, Google Drive upload, README live URL. |
| **P11** | Final submission | Pending | Pre-submission checklist verification. |

---

## 3. Demo Credentials (Seeded in Supabase Cloud DB)

All demo accounts use password: `Password123!`

| Email | Role | PSE Access | Purpose |
|---|---|---|---|
| `admin@pse.org` | `admin` | `true` | Full read/write + `/admin` user & config management |
| `safina@pse.org` | `target_manager` | `true` | Full PSE read + own writes + Targets wizard & lock |
| `rahim@pse.org` | `member` | `true` | Full PSE read + own writes |
| `karim@pse.org` | `member` | `true` | Full PSE read + own writes |
| `nadia@pse.org` | `member` | `true` | Full PSE read + own writes |
| `external@otherdept.org` | `member` | `false` | Non-PSE user (redirected to `/no-access`; RLS returns 0 rows) |

---

## 4. What Exists in the Codebase (P0, P1, P2, P3, P4 & P5)

### SQL Migrations & Database Scripts
- `supabase/migrations/001_enums_and_config.sql` — 11 enums, `teams`, `profiles`, `settings`, `currencies`, `fx_rates`, `pipeline_stages`, `contribution_categories`, `verticals`, `category_vertical_map`.
- `supabase/migrations/002_contacts.sql` — `contacts`, `contact_channels` (`UNIQUE(kind, value_normalized)`), and deferred constraint triggers (`contact_min_channel_on_contacts`, `contact_min_channel_on_channels`).
- `supabase/migrations/003_pipelines.sql` — `pipelines` (`expected_amount > 0`, in-kind valuation check, POC check), `pipeline_stage_history`, `pipeline_receipts`, stage history & `lost_reason` / `won_at` triggers.
- `supabase/migrations/004_meetings_activities.sql` — `meetings` (`contact_id IS NOT NULL OR pipeline_id IS NOT NULL`), `activities` (11 types, 3 classes).
- `supabase/migrations/005_targets.sql` — `target_plans`, `target_quarters`, `target_lines`, immutability lock triggers (`fn_lock_guard_*`), and `publish_target_plan(uuid)`.
- `supabase/migrations/006_audit_rls.sql` — `audit_log`, `current_app_user_id()`, `is_pse_member()`, `has_role()`, audit triggers, and RLS policies on all 19 tables.
- `supabase/seed.sql` — Reference data (stages, categories, verticals, mappings, currencies, FX rates, settings).
- `scripts/db-push.mjs` (`npm run db:push`) — Pushes migrations `001`–`006` and `seed.sql` to `DATABASE_URL`.
- `scripts/seed-demo.mjs` (`npm run db:seed`) — Seeds the 6 demo accounts and initial demo contacts, pipelines, receipts, meeting, activity, and locked 2026 target plan.
- `scripts/db-tests.mjs` (`npm run db:test`) — Verifies all 10 database & RLS invariants against the live database.

### Auth Module & Route Guard (`src/modules/auth/` & `src/proxy.ts`)
- `src/proxy.ts` — Next.js 16 proxy (middleware) protecting `/dashboard`, `/contacts`, `/pipelines`, `/meetings`, `/activities`, `/targets`, `/admin` and redirecting unauthenticated visitors to `/login`.
- `src/modules/auth/{schema,repository,service,actions,queries,index}.ts` — `signInAction`, `signOutAction`, `createUserAction`, `updateUserRoleAction`, `getAuthenticatedUser`, `getActivePseTeamMembers`, `getAdminPageData`.
- `src/modules/auth/components/{login-form,admin-users-panel}.tsx` — `<LoginForm />` (with 1-click demo credential autofill) and `<AdminUsersPanel />` (team role/PSE access management + reference config tables).
- `src/app/no-access/page.tsx` — Blocked screen for non-PSE users with sign-out button.

### Contacts Module (`src/modules/contacts/` & `/contacts`)
- `src/modules/contacts/{schema,service,repository,actions,queries,index}.ts`
  - `contactFormSchema`, `normalizeContactChannels`, `prepareContactPayload`, `canEditContact` (tested in `src/modules/contacts/contacts.test.ts`).
  - `listContacts`, `getContactDetail`, `findByNormalizedChannels`, `createContactRecord`, `updateContactRecord`, `searchContactsLite`, `listFilterMetadata`.
  - `createContactAction`, `updateContactAction`, `searchContactsAction` (invalidates `CACHE_TAGS.contacts` and `CACHE_TAGS.dashboard`).
- `src/modules/contacts/components/`
  - `contact-form.tsx` — Type-conditional Individual/Company form, multi-channel repeater (`>= 1` channel), duplicate email/phone alert with `"Open contact"` / `"Use existing"`, and inline company creation.
  - `contact-picker.tsx` — Reusable `<ContactPicker />` combobox exported via `@/modules/contacts` with live search and inline `"Create new contact"` flow.
  - `contacts-view.tsx` & `contact-detail-view.tsx` — List view (`/contacts`) and Detail view (`/contacts/[id]`) with Related Records tabs (Pipelines, Meetings, Activities, and People for companies).

### Pipelines & Receipts Module (`src/modules/pipelines/` & `/pipelines`)
- `src/modules/pipelines/{schema,service,repository,actions,queries,index}.ts`
  - `pipelineFormSchema`, `changeStageInputSchema`, `recordReceiptInputSchema`, `pipelineFilterSchema`.
  - `resolveFxRate`, `computeBase`, `canMoveToKind`, `validateReceiptAllowed`, `computePipelineAchievementSummary`, `preparePipelinePayload`, `canEditPipeline` (tested in `src/modules/pipelines/pipelines.test.ts`).
  - `listPipelineReferenceData`, `listPipelines`, `getPipelineDetail`, `createPipelineRecord`, `updatePipelineRecord`, `changePipelineStageRecord`, `addPipelineReceiptRecord`, `listPipelinesLite`.
  - `createPipelineAction`, `updatePipelineAction`, `changePipelineStageAction`, `recordPipelineReceiptAction` (invalidating `CACHE_TAGS.pipelines`, `CACHE_TAGS.receipts`, `CACHE_TAGS.dashboard`, `CACHE_TAGS.contacts`).
- `src/modules/pipelines/components/`
  - `pipeline-form.tsx` — Money-only notice with link to `/activities`, Cash vs. In-kind valuation note, Company (with POC & secondary contact via `<ContactPicker />`) vs. Individual donor, live FX conversion preview to BDT.
  - `stage-transition-dialog.tsx` — `<StageQuickSelect />` with confirmation dialog for Won (`won_at` + receipt unlock), required `lost_reason` modal for Lost, and optional reason modal for Junk/Abandoned.
  - `record-receipt-dialog.tsx` — Realized receipt dialog (`pipeline_receipts`) with live BDT FX conversion and over-receipt notice.
  - `pipelines-view.tsx` & `pipeline-detail-view.tsx` — `/pipelines` (KPI summary strip, filters, List table view, and stage-grouped Board view) and `/pipelines/[id]` (`Won ৳ X · Received ৳ Y · Unrealized ৳ (X − Y)` banner, `<TargetBar />`, stage history timeline, receipts table, and linked meetings/activities tabs).

### Meetings Module (`src/modules/meetings/` & `/meetings`)
- `src/modules/meetings/{schema,service,repository,actions,queries,index}.ts`
  - `meetingFormSchema`, `meetingFilterSchema`, `prepareMeetingPayload`, `deriveMeetingContactInfo`, `canEditMeeting` (tested in `src/modules/meetings/meetings.test.ts`).
  - `listMeetings` (SQL join deriving `effective_contact_id`, `derived_organization_name`, and `derived_designation` from the linked contact or fallback pipeline contact), `listMeetingOwners`, `createMeetingRecord`, `updateMeetingRecord`, `updateMeetingStatusRecord`, `listMeetingsLite`.
  - `createMeetingAction`, `updateMeetingAction`, `updateMeetingStatusAction`.
- `src/modules/meetings/components/`
  - `meeting-form.tsx` — `<ContactPicker />` + pipeline select with live read-only derived Contact / Organization / Designation box.
  - `meetings-view.tsx` — `/meetings` with KPI summary strip, `All / Upcoming (Scheduled) / Done` tabs, filters, quick `"Mark done"`, and 1-click `"Add follow-up"` linking to `/activities?new=1&meetingId=...&contactId=...&pipelineId=...`.

### Activities Module (`src/modules/activities/` & `/activities`)
- `src/modules/activities/{schema,service,repository,actions,queries,index}.ts`
  - `activityFormSchema`, `activityFilterSchema`, `defaultActivityClassForType` (`servicing → stewardship`, `prospect_engagement → prospect_engagement`, others `→ independent`), `prepareActivityPayload`, `canEditActivity` (tested in `src/modules/activities/activities.test.ts`).
  - `listActivities`, `listActivityOwners`, `createActivityRecord`, `updateActivityRecord`, `updateActivityStatusRecord`.
  - `createActivityAction`, `updateActivityAction`, `updateActivityStatusAction`.
- `src/modules/activities/components/`
  - `activity-form.tsx` — 11 activity types, 3 non-monetary reporting classes (auto-defaulted from type and user-editable), optional contact/pipeline/meeting links, free-text `related_org_name`, `remaining_work`, `occurred_at`/`due_at`, and Google Drive notes.
  - `activities-view.tsx` — `/activities` reproducing the Excel tracker table (`Date`, `Activity & notes`, `Type`, `Class`, `Related`, `Owner`, `Status`, `Remaining work`), `"All team"` vs. `"My activities"` preset toggle, and inline status selector.

---

### Targets Module (`src/modules/targets/` & `/targets`)
- `schema.ts` (zod draft: year, annual, 4 quarters, member allocations with vertical %), `service.ts` (`validatePlan`, `summarizePlan`, `buildPlanLines` via `allocateByPercent`, `splitEvenly`, `allocationsFromLines`, `canManageTargets`; totals compared in whole cents), `repository.ts` (`saveTargetDraft` replaces quarters + lines in one transaction; `publishTargetPlanRecord` calls the SQL function), `actions.ts` (`saveTargetDraftAction`, `publishTargetPlanAction`, `discardTargetDraftAction`; `requireRole('admin','target_manager')`; invalidate `targets` + `dashboard`), `queries.ts` (`getTargetsPageData`; members only ever receive published plans).
- `components/`: `target-wizard.tsx` (5 steps, always-visible "Remaining to allocate", draft autosaved on Next), `target-plan-summary.tsx` (read-only annual/quarter/member x vertical breakdown, also the review step), `targets-view.tsx` (year selector, published vs wizard vs empty).
- Plan team = actor's `team_id` (fallback: first team) so `UNIQUE(year, team_id)` holds. Numerics are read with `::float8`. Tests: `targets.test.ts`, db-tests 11a/11b.
- The seeded 2026 plan is already published and locked; sign in as `safina@pse.org` and open `/targets?year=2027` to try the wizard.

### Dashboard Module (`src/modules/dashboard/` & `/dashboard`)
- `009_dashboard_functions.sql`: `fn_achievement`, `fn_target` (quarter exact, month = quarter / 3, year = sum; published plans only), `fn_pipeline_by_kind`, `fn_won_unrealized`, `fn_lead_count`, `fn_meeting_summary`, `fn_activity_summary`, `fn_contacts_engaged`, `fn_member_workload`, `fn_trend`, `fn_fiscal_start_month`. Each KPI formula lives in one function (the Lead KPI is `fn_lead_count`). db-tests 12 checks them against a hand-computed rolled-back 2031 fixture.
- `service.ts` (pure): `resolveDashboardFilters`, `periodWindow`, `fiscalPositionOf`, `computeAttainment` (never caps over-achievement), `buildMonetaryDashboard`, `buildNonMonetaryDashboard`, drill-down hrefs. `repository.ts` runs the functions on the owner pool (`queryDb`, `::float8` casts). `queries.ts` exposes `getDashboardData`: `requireUser()` first, then `cached()` reads keyed by filters only (tags: dashboard, receipts, pipelines, targets, meetings, activities, config).
- URL filters: `period` (month|quarter|year), `year`, `index`, `member`, `vertical`, `lens` (monetary|non_monetary). Both lenses load together; the lens switch is client-side and only rewrites the URL.
- Monetary lens: Target, Achieved, Attainment, Unachieved, Over-achieved, Won-not-yet-received, Leads, Open pipeline; target-vs-achievement by member and vertical (`TargetBar`), pipeline by stage kind (cash vs in-kind), 12-month trend. Non-monetary lens: meetings and completion, activities by type and class, visits/events/campaigns, contacts engaged, workload by member. Every chart has a "View as table".
- Definitions: pipeline-by-kind and Leads count pipelines CREATED in the period (grouped by current stage kind); Won-not-yet-received covers deals WON in the period, floored at zero per deal; activities are dated by occurred_at, else due_at, else created_at, and cancelled ones are excluded. Month targets are rounded per line, so they can drift by a cent or two from an exact third.
- Drill-down links exist only where the list page uses the same date basis (meetings, activities). Pipeline tiles do not link, because the pipelines list filters on expected close date.
- Shared UI: `BarChart`/`LineChart` take `valueFormatter` and `tooltipFormatter`; `formatCompactNumber` (axes only) is in `shared/ui/money.tsx`.

## 5. Verification Commands

Run these before completing any phase:
```powershell
npm run lint
npm run lint:design
npm run typecheck
npm test
npm run db:test
npm run build
```

---

## 6. Hardening Pass (2026-10-27) — what changed after the P0–P5 review

- **Connection pool:** `getDbPool()` now always caches the pool on `globalThis` (previously production created a new pool per query). Default `max` is 3 (`DATABASE_POOL_MAX` overrides). Optional `DATABASE_CA_CERT` enables full TLS verification.
- **`AUTH_SECRET`:** no default in production. Sessions throw unless it is set to 32+ characters. `.env.example` is blank; local dev falls back to a dev-only secret. **Set a random `AUTH_SECRET` on Vercel.**
- **Passwords:** `hashPassword` / `verifyPassword` are async (`crypto.scrypt`). Login verifies against `DUMMY_PASSWORD_HASH` for unknown emails (no timing leak).
- **Brute-force protection:** `login_attempts` table (migration `007_security_hardening.sql`); 5 failed attempts per email in 15 minutes locks sign-in for that email until the window passes.
- **Credential hash isolation:** migration `007` revokes table-level `SELECT` on `profiles` from `authenticated` and grants every column except `password_hash`. Login and session checks use the owner connection and are unaffected.
- **Migration ledger:** `npm run db:push` records applied files in `schema_migrations` and applies each file once, in a transaction. The reference seed (idempotent) still runs every time. Next migration number: `010` (`008` added a role check to `publish_target_plan`; `009` added the dashboard SQL functions).
- **Lint boundaries now actually run:** elements use `mode: 'full'` and the `@/` alias is resolved. Cross-module deep imports (`@/modules/<name>/<file>`) are blocked; use `@/modules/<name>`.
- **Cleanup:** removed duplicate `shared/lib/{money,phone,periods}.ts` re-export stubs (the `index.ts` folders remain); removed dev-text from the Dashboard empty state; README rewritten; stale pnpm / service-role / Supabase Auth wording fixed in `PHASES.md`, `ARCHITECURE.md`, `IMPLEMENTATION_PLAN.md`, `docs/ASSUMPTIONS.md`.
- **Demo credentials are unchanged** and remain visible on `/login` (one-click fill) and in the README. Known trade-off: an attacker can lock a known email for 15 minutes by failing sign-in five times.
- **Required after pulling:** run `npm run db:push` to apply migrations `007`–`010`. Next migration number: `011`.

## 9. Phase 8 — Caching & Performance Optimization (2026-10-27)

- **Migration `010_dashboard_perf_indexes.sql`:**
  - Added covering & partial functional indexes (`idx_pipeline_receipts_received_covering`, `idx_pipelines_created_covering`, `idx_pipelines_won_covering`, `idx_meetings_scheduled_covering`, `idx_activities_effective_ts_covering`).
  - Rewrote non-sargable `col::date BETWEEN p_start AND p_end` predicates on `timestamptz` columns to sargable `col >= p_start::timestamptz AND col < (p_end + 1)::timestamptz` range predicates across `fn_pipeline_by_kind`, `fn_won_unrealized`, `fn_lead_count`, `fn_meeting_summary`, `fn_activity_summary`, `fn_contacts_engaged`, `fn_member_workload`, and `fn_trend`.
  - Refactored `fn_member_workload` and `fn_trend` from correlated subqueries to single-pass CTE aggregations.
- **Single-Round-Trip Dashboard Repository (`src/modules/dashboard/repository.ts`):**
  - Consolidated the 6 monetary SQL function calls in `fetchMonetaryRaw` into 1 SQL round-trip and the 4 non-monetary SQL function calls in `fetchNonMonetaryRaw` into 1 SQL round-trip (eliminating pool queueing on `max = 3` serverless pools and reducing cold DB latency from ~1,815 ms to ~391 ms over the remote pooler, with pure PostgreSQL execution time at `38.22 ms`).
- **Cached Reference Reads & Write → Tag Invalidation:**
  - Wrapped reference/config reads in `cached(..., [CACHE_TAGS.config])` across `dashboard` (`loadFiscalStart`, `loadFilterOptions`, `loadNameLookup`), `pipelines` (`loadPipelineReferenceData`), and `auth` (`loadActivePseTeamMembers`, `loadReferenceConfigSummary`), always gated by `requireUser()` / `requireRole('admin')` first.
  - Updated `createUserAction` and `updateUserRoleAction` in `src/modules/auth/actions.ts` to invalidate both `CACHE_TAGS.config` and `CACHE_TAGS.dashboard` per `ARCHITECURE.md` §10.3.
- **Tests, Benchmark & Documentation:**
  - Added unit tests in `src/shared/lib/cache/cache.test.ts` (3 tests verifying key isolation, 300s default TTL, and immediate tag eviction).
  - Added `scripts/benchmark-dashboard.mjs` (`npm run db:bench`) running inside a rolled-back transaction (`10,004 contacts`, `5,002 pipelines`, `3,001 receipts`, `5,001 meetings`, `20,001 activities`), recording `EXPLAIN (ANALYZE, BUFFERS)` plans, cold DB vs. warm cache timings (warm p95 = `0.04 ms`, well under the `300 ms` target), and live write → `invalidateTags` → fresh achievement verification.
  - Documented the complete architecture, invalidation matrix, `EXPLAIN ANALYZE` plans, and benchmark numbers in `docs/CACHING.md`.

## 7. Loading States & Toasts (2026-10-27)

- **Skeleton system:** `src/shared/ui/skeletons.tsx` (`LoadingRegion`, `PageHeaderSkeleton`, `KpiRowSkeleton`, `FilterBarSkeleton`, `TableSkeleton`, `CardSkeleton`, `ListPageSkeleton`, `DetailPageSkeleton`, `DashboardSkeleton`, `FormPageSkeleton`). Static flat blocks (no pulse/shimmer, per DESIGN.md); wrapped in `role="status"` with an sr-only "Loading".
- **Route loading screens:** `loading.tsx` for dashboard, contacts, contacts/[id], pipelines, pipelines/[id], meetings, activities, targets, admin, plus a generic `(app)/loading.tsx`. Sidebar and top bar stay visible while the page area shows its skeleton.
- **Filter changes** on Pipelines, Meetings, Activities now run in `useTransition`; `DataTable` has a `loading` prop that shows `TableSkeleton` while the server refetches (pipelines board does too). Contacts filters are client-side and need no loader.
- **New screens must ship with a matching `loading.tsx`** (P6 Targets and P7 Dashboard already have one to refine when their real layouts exist).
- **Toasts:** `<Toaster position="top-right">` with a 64px top offset so toasts sit below the top bar.

## 8. UI Break Fixes (2026-10-27)

- **Buttons never wrap:** `Button` now has `whitespace-nowrap shrink-0` and icons `shrink-0` (fixes "Add follow-up (1)" wrapping on Meetings). Same for `Tag`, `Money`, `DateText`, and table headers.
- **`ButtonLink`** (in `shared/ui/primitives.tsx`) replaces `<Link><Button/></Link>` (invalid nested interactive elements). Use it for any navigation that looks like a button.
- **Responsive shell:** below 1024px the sidebar becomes a slide-in drawer (hamburger in the top bar, closes on route change / Escape / backdrop). On small screens the top bar hides the user name/role and theme label.
- **Theme flash / hydration:** a small pre-paint script in `app/layout.tsx` applies the saved theme; `AppShell` reads the class after mount instead of reading localStorage during render.
- **KPI tiles** use a smaller value size on narrow screens and wrap long amounts.
- Contact detail action buttons are now short ("New pipeline", "Schedule meeting", "Log activity") instead of embedding the contact name.


## 10. Phase 9 — Testing & Hardening (2026-10-27)

- **Unit Test Suite (`vitest`, `npm test` — 87 tests across 12 files):**
  - Covers phone E.164 normalization, email lowercase normalization, `allocateByPercent` largest-remainder rounding, `periodRange` / `fiscalPositionOf`, `defaultActivityClassForType`, FX base calculation (`computeBase`), target wizard reconciliation (`validatePlan`, `summarizePlan`, `buildPlanLines`), dashboard monetary & non-monetary view assembly, scrypt password hashing & HS256 JWT sessions, RBAC guards, and tagged server caching (`cached()` + `invalidateTags()`).
- **Database Invariant, Trigger, Function & RLS Test Suite (`scripts/db-tests.mjs`, `npm run db:test` — 17 suites):**
  - Added suites 13–17 on top of suites 1–12:
    - Suite 13: Company pipeline without `poc_contact_id` is rejected by `pipelines_company_poc_check`.
    - Suite 14: Column-level `SELECT` privilege revocation blocks `authenticated` from reading `profiles.password_hash`.
    - Suite 15: Member RLS owner guard allows reading all PSE pipelines (`is_pse_member()`) while rejecting updates to another member's pipeline (`owner_id = current_app_user_id() OR has_role(ARRAY['admin'])`).
    - Suite 16: Pipeline stage transition to `Won` automatically sets `won_at`, appends `pipeline_stage_history`, and records an `audit_log` row.
    - Suite 17: Non-monetary SQL read functions (`fn_activity_summary`, `fn_contacts_engaged`) exclude `cancelled` activities and deduplicate distinct contacts across meetings and activities.
- **Playwright E2E Happy-Path & Security Suite (`playwright.config.ts`, `e2e/happy-path.spec.ts`, `npm run test:e2e`):**
  - Verifies non-PSE user (`external@otherdept.org`) restriction to `/no-access` with zero PSE data exposed.
  - Verifies Member (`rahim@pse.org`) flow: duplicate email detection on `/contacts/new` -> unique contact creation -> inline company creation via `<ContactPicker />` inside `/pipelines/new` -> deal creation -> stage transition to `Won` -> recording a realized receipt (`pipeline_receipts`) -> immediate `/dashboard` cache invalidation & Non-monetary lens -> mobile (`375px`) slide-in navigation drawer.
  - Verifies Target Manager (`safina@pse.org`) flow: completing all 5 steps of the Targets Wizard (`Annual -> Quarters -> Members -> Verticals -> Review`), publishing & locking, and confirming the read-only `Published` state.
- **Defects Caught & Fixed During Phase 9:**
  - **P1 Nested `<form>` Bug in `src/modules/contacts/components/contact-form.tsx`:** Rendering `ContactForm` with `compact={true}` inside `<ContactPicker />` (which sits inside `<PipelineForm />`, `<MeetingForm />`, or `<ActivityForm />`) previously rendered a nested `<form>`, causing the browser to submit the outer form when clicking `"Save contact"`. Fixed by rendering a `<div>` container and `type="button"` when `compact={true}`.
  - **`pg@9.0` Concurrent `client.query` Deprecation Warning:** Replaced concurrent `Promise.all([client.query(...), ...])` calls on single transaction `PoolClient`s with sequential `await client.query(...)` calls in `src/modules/contacts/repository.ts` and `src/modules/pipelines/repository.ts`.
- **Security Audit & Known Limitations:**
  - Added `scripts/check-security.mjs` (`npm run check:security`) verifying zero `DATABASE_URL` / `AUTH_SECRET` / Postgres URI leaks in `.next/static` and verifying `requireUser()` / `requireRole()` gating on every `cached()` module query file.
  - Documented intentional scope cuts and domain trade-offs in `docs/KNOWN_LIMITATIONS.md`.
