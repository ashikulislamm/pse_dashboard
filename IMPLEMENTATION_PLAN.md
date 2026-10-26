# PSE (Private Sector Engagement) CRM & Dashboard — Analysis and Implementation Plan

Stack (fixed by assessment): Next.js/React · Supabase (Postgres) · caching layer · Vercel · GitHub · Google Drive docs.
Deliverables: (1) Architecture PDF, (2) GitHub source, (3) Google Drive documentation, (4) live Vercel URL.

---

## PART A — DEEP ANALYSIS OF THE REQUIREMENTS

### A1. How to read the two documents

The pack is two layers. **Layer 1** is the original "Dashboard Requirements" (Contacts, Pipelines, Meetings, Events, hierarchical targets, 4 KPIs × 3 periods). **Layer 2** is the "Major requirement changes" from the later meeting. Where they conflict, **Layer 2 wins**. Layer 1 is only a source of field lists.

Net product: **a simplified, Odoo-like CRM for the PSE team**, rebuilt from scratch, with a clear record chain:

```
Contact ──► Pipeline/Opportunity ──► Meeting ──► Activity
            (money only)             (links to contact OR pipeline)   (links to anything, or standalone)
```

with **two separate reporting lenses**: monetary fundraising performance and non-monetary work performance.

### A2. What changed, and what I will build

| Area | Original | Final decision for the build |
|---|---|---|
| Leads | Dashboard KPI | **No Lead module.** A "lead" = pipeline in an early open stage. KPI definition unconfirmed → build it **configurable**, flagged as an assumption. |
| Pipeline scope | Cash + in-kind | **Only items with expected financial value** (cash, valued in-kind, project). Hard validation: expected value > 0. |
| Non-monetary work | Counted with Events, year-end valuation | **Activities module.** Never touches monetary targets. |
| Events | Standalone module | **Activity type.** No Event module. Keep an extension point. |
| Documents | Upload | **No uploads.** Google Drive URLs pasted in a large notes field. No Supabase Storage. |
| Email | Unclear | **No Gmail sync.** Emails logged manually as activities. |
| Autofill | Org/designation suggestions | **No external autofill.** Internal search/suggest only (from our own contacts). |
| Visibility | Hierarchy | **All PSE members see all PSE records.** Other departments are blocked from PSE. |
| Targets | Director → Dept head → Member | **Central:** only an authorised manager (Safina) edits. Hierarchy layout pending. |
| Target logic | Monthly/Quarterly/Annual | Annual → manual uneven Q1–Q4 → by member → by vertical (percent). Sum of quarters = annual. **Locked after setup.** |
| Over-achievement | Not defined | **No carry-forward.** Q1 110% stays 110%; Q2 target unchanged. Annual = sum of actuals. |
| Achievement | "Expected/Budgeted fund" | **Forecast ≠ achievement.** Achievement = confirmed/realized amounts. |
| In-kind valuation | Year-end manual estimate | Valued **at entry**, manually, only if material/sellable/offsets approved budget. Else it is an activity. |
| Migration | Undefined | Odoo → new system. **PSE must supply field mapping first** → build a generic, dry-run CSV importer. |

### A3. Gaps, contradictions and ambiguities (the important part)

These are the places where a naive build goes wrong. Each has a **default I will implement** so work is never blocked, and each is made **configuration, not code**, so a later answer from PSE costs minutes, not days.

| # | Issue | Why it matters | Default I implement |
|---|---|---|---|
| 1 | **Pipeline stages not final** (New…Abandoned vs Odoo open/won/lost/junk) | Dashboard "won/lost/open/junk" depends on it | `pipeline_stages` table with a `kind` (open/won/lost/junk). Seed the 8 proposed stages mapped to the 4 kinds. Admin can edit. Reports group by **kind**, never by stage name. |
| 2 | **"Lead" KPI undefined** | Original dashboard has it | Lead = count of pipelines **created** in period (optionally only those that reached stage ≥ Scoping). Behind one SQL function so the formula is swappable. |
| 3 | **VBD vs SAC / category vs vertical** | Targets use DSP/VBD/Project; pipelines use DSP/SAC/Disaster/Project/Event/General | Treat as **two dimensions**. `contribution_categories` (6, seeded) and `verticals` (DSP, VBD, Project, seeded). A `category_vertical_map` table (editable) rolls categories up to verticals. Pipeline stores category; vertical is derived. |
| 4 | **Achievement definition** | "Won value" vs "money actually received" differ | Add `pipeline_receipts` (amount, date). **Achievement = sum of receipts in period.** Won-but-not-received shows as "won, unrealized". Setting allows fallback "won value at won date". Payment Interval then has a real meaning (expected receipt schedule). |
| 5 | **Monthly view vs quarterly-only targets** | Original wants Monthly Target vs Achievement, new logic has no monthly target | Monthly shows **achievement vs quarter target ÷ 3 (pro-rata, labelled as such)**. Quarterly and annual are exact. |
| 6 | **Count targets (Lead/Meeting/Events)** | Original asks Target vs Achievement for these; new targets are monetary only | Monetary targets fully built. Optional `kpi_targets` table for counts, **Phase 2 / stretch**, off by default. |
| 7 | **Multi-currency** | Currency field exists | `currencies` + `fx_rates`; base currency in settings (assume BDT). Store original amount **and** base amount at won/receipt time. Targets always in base. |
| 8 | **Fiscal vs calendar year** | Q1–Q4 boundaries | `settings.fiscal_year_start_month` (default 1). All period math uses it. |
| 9 | **Meeting vs Activity "Meeting" type** | Duplicate concept | Structured **Meeting record** is the source for meeting KPIs. Activity type `meeting` kept for informal logging. Dashboards count meetings only from `meetings`. |
| 10 | **Contact active/inactive** | "Under consideration" | Add `status` (default active). Cheap, filterable. |
| 11 | **Target hierarchy** | "Pending from PSE" | Single permission `targets.manage` granted by role. Hierarchy tables not built until PSE decides. |
| 12 | **Follow-up rate KPI** | Explicitly not approved | **Not built.** Listed in docs as parked. |
| 13 | **Odoo migration fields** | PSE must define | Build importer + mapping UI; ship with sample mapping; real import is a post-handover step. |
| 14 | **"Individual w/o company"** | Allowed | `organization_id` nullable FK to a company contact. Also structured `designation`. |
| 15 | **Operational budget (optional)** | On pipelines (and old events) | Nullable numeric on pipeline. Event budget **not** built (extension point). |
| 16 | **Contact channels** | "Email/Phone dropdown", ≥1 mandatory, dedupe on both | Separate `contact_channels` table (type, value, normalized). Unique on normalized value. Min-one enforced in DB and form. |

### A4. Business rules checklist (acceptance-test source)

- Contact: individual or company; ≥1 email/phone; duplicate check on **both** email and phone (normalised: lowercase email, E.164 phone); notes support relationship intelligence; company/workplace/designation are structured, filterable fields.
- New Deal form can **create a contact inline** without leaving the form, and shows existing match if duplicate.
- Pipeline cannot be saved without expected value > 0. In-kind pipeline requires manually entered value + valuation note.
- Small/unvalued in-kind goods **cannot** be created as pipelines (UI hint redirects to "Log as activity").
- Stage → Won/Lost requires confirmation (+ lost reason). Stage history recorded.
- Achievement counts only receipts. Non-monetary activities never affect monetary numbers.
- Targets: annual → quarters (sum must equal annual) → members → verticals (percent). Locked after publish. Only `targets.manage` can write. Edits after lock are blocked; an audit log records everything.
- Overachievement never alters other quarters.
- All PSE members read all PSE data; non-PSE users get nothing. Writes: own records (owner) + admin override.
- Dashboard has **two lenses**: Monetary and Non-monetary.

---

## PART B — ARCHITECTURE

### B1. Technology decisions

| Concern | Choice | Reason |
|---|---|---|
| Framework | **Next.js (latest stable, App Router) + React + TypeScript strict** | Required; server components + server actions fit a CRUD/dashboard app |
| DB | **Supabase Postgres** (not MySQL) | Required options; gives Auth + RLS + SQL views/functions for aggregation, one vendor, Vercel integration |
| Auth | Supabase Auth (email+password; Google OAuth optional) | Team-wide access control, RLS uses `auth.uid()` |
| Authorization | **RLS in DB + role checks in server layer** (defence in depth) | PSE-only visibility enforced at the data layer |
| UI | Tailwind + shadcn/ui, TanStack Table, Recharts, react-hook-form + zod | Fast, Odoo-like list/kanban/form views |
| Pipeline board | dnd-kit kanban | Odoo-style stage drag |
| Caching | See B4 | Required deliverable |
| Migrations | Supabase CLI SQL migrations + generated TS types | Reproducible schema in git |
| Tests | Vitest (unit), Playwright (e2e), SQL tests for constraints/RLS | |
| CI/CD | GitHub Actions → Vercel (preview per PR, prod on `main`) | |

> Before init, check current versions (`npx create-next-app@latest`) and use whichever caching API that Next version ships (`use cache` + `cacheTag` on newer versions; `unstable_cache` + `revalidateTag` on 15). The design below is the same either way.

### B2. Modular layout (the "modular architecture" the brief asks for)

```
pse-dashboard/
├─ src/
│  ├─ app/                      # routing ONLY; thin pages that compose modules
│  │  ├─ (auth)/login
│  │  └─ (app)/{dashboard,contacts,pipelines,meetings,activities,targets,admin,import}
│  ├─ modules/
│  │  ├─ contacts/   ─┐
│  │  ├─ pipelines/   │  each module:
│  │  ├─ meetings/    │   schema.ts      (zod + types)
│  │  ├─ activities/  │   repository.ts  (only place that talks to Supabase)
│  │  ├─ targets/     │   service.ts     (business rules, no framework code)
│  │  ├─ dashboard/   │   actions.ts     (server actions, auth + revalidate)
│  │  ├─ admin/       │   queries.ts     (cached reads + tags)
│  │  ├─ import/      │   components/    (UI)
│  │  └─ auth/       ─┘   index.ts       (public API — other modules import ONLY this)
│  ├─ shared/{ui,lib/supabase,lib/cache,lib/rbac,lib/periods,lib/money,lib/phone}
│  └─ types/database.ts         # generated from Supabase
├─ supabase/{migrations,seed.sql,tests}
├─ docs/{architecture,adr,api,runbook,user-guide}
├─ e2e/   .github/workflows/
```

Rules enforced by lint (`eslint-plugin-boundaries`): `app → modules → shared`; modules may not import each other's internals; only `repository.ts` imports the Supabase client.

### B3. Data model (Postgres)

Reference/config: `profiles(id, full_name, role[admin|target_manager|member], team_id, is_active)`, `teams`, `settings`, `currencies`, `fx_rates`, `pipeline_stages(id,name,kind,position)`, `contribution_categories`, `verticals`, `category_vertical_map`.

Core:
- `contacts(id, type[individual|company], name, organization_id→contacts, designation, website, industry, notes, status, owner_id, created_at…)`
- `contact_channels(id, contact_id, kind[email|phone], value, value_normalized, is_primary)` — **unique(value_normalized, kind)**; deferred constraint: contact has ≥1 channel
- `pipelines(id, deal_name, focal_person_id→profiles, contribution_type[cash|in_kind], category_id, party_type[individual|company], contact_id, poc_contact_id, secondary_contact_id, stage_id, expected_amount, currency, amount_base, payment_interval, expected_close, country, description, operational_budget, notes, in_kind_valuation_note, lost_reason, won_at, created_by…)`; CHECK expected_amount > 0
- `pipeline_stage_history(pipeline_id, from_stage, to_stage, changed_by, changed_at)`
- `pipeline_receipts(id, pipeline_id, amount, currency, amount_base, received_on, note)`
- `meetings(id, contact_id, pipeline_id, scheduled_at, status[scheduled|done], description, owner_id)` — CHECK contact_id OR pipeline_id; organisation/designation **derived by join**, not stored
- `activities(id, type[task|email|call|meeting|event|campaign|proposal|visit|servicing|prospect_engagement|general], class[stewardship|prospect_engagement|independent], title, owner_id, contact_id?, pipeline_id?, meeting_id?, related_org_name?, status, remaining_work, occurred_at/due_at, notes)`
- Targets: `target_plans(id, year, team_id, annual_amount, locked_at, locked_by)`, `target_quarters(plan_id, quarter, amount)`, `target_lines(quarter_id, user_id, vertical_id, amount, percent)`; triggers: ΣQ = annual, Σlines = quarter amount, **no writes once `locked_at` set**, role check.
- `audit_log(table, row_id, actor, action, diff, at)`, `import_jobs(id, source, mapping, status, report)`

Aggregations as SQL (versioned, testable): `fn_monetary_summary(period, group_by)`, `fn_pipeline_by_stage_kind`, `fn_activity_summary`, `fn_meeting_summary`, plus indexes on `(owner_id, created_at)`, `(stage_id)`, `(received_on)`.

### B4. Caching strategy (assessment requirement)

Three layers, each with a stated purpose:

1. **Server data cache (primary)** — dashboard aggregate queries wrapped in Next's tag-based cache (key: period + filters). Tags: `dashboard`, `pipelines`, `receipts`, `targets`, `activities`, `meetings`. Every server action that writes calls `revalidateTag` for affected tags → dashboards are fast yet never stale after a write. TTL fallback 5 min.
   *Design point:* cached functions can't read request cookies, so they use a server-only **service-role** client. **Authorization happens before the cached call** (middleware + `requireUser()` + `requireRole()`), and results contain only PSE data (all-PSE visibility makes the shared cache safe). Service key never leaves server.
2. **Client cache** — TanStack Query for list filters/search/optimistic kanban moves (stale-while-revalidate).
3. **DB-level** — indexed SQL functions; optional **materialized view** `mv_monthly_achievement` refreshed on write/cron if profiling shows need. Optional Upstash Redis (Vercel Marketplace) as a drop-in for layer 1 if multi-region.

Doc deliverable: an ADR with before/after timings (seed 10k+ rows, measure dashboard p95 cold vs warm).

### B5. Security
Supabase RLS on every table (`is_pse_member()` for select; owner/admin/target_manager for write); targets table write only via `targets.manage`; zod validation on every action; service key only in server env; Google Drive URL fields sanitised/linkified (`rel=noopener`); rate-limit login; audit log; no PII in logs; env vars separated for Preview vs Production.

---

## PART C — IMPLEMENTATION PLAN (start → delivery)

Estimate assumes 1 developer, ~15 working days. If the assessment deadline is shorter, use the **MVP cut** at the end of Part C.

### Phase 0 — Clarify & freeze scope (Day 1, ½ day)
- Send the **Open-Items list (Part E)** to the recruiter/PSE; proceed with defaults in A3 if no reply.
- Write a one-page **scope statement** (in/out: no Gmail sync, no uploads, no autofill, no Events module, no follow-up KPI).
- Deliver: `docs/00-scope-and-assumptions.md`. **Exit:** assumptions agreed/recorded.

### Phase 1 — Architecture & design docs (Day 1–2)
- Diagrams: system context, container/deployment (Browser → Vercel Next.js → Supabase; cache layer), module diagram, ERD, auth/RLS flow, cache invalidation flow, dashboard data flow, target-setup state diagram.
- ADRs: Supabase vs MySQL; App Router + server actions; cache design; achievement = receipts; category vs vertical; stages as config.
- Low-fidelity wireframes: list, form, kanban, target wizard, two-lens dashboard.
- Deliver: **Architecture PDF** (sections: overview, requirements trace, tech stack, modules, ERD, security, caching, deployment, scalability, risks). **Exit:** PDF reviewed.

### Phase 2 — Project initialization & infrastructure (Day 2)
1. `npx create-next-app@latest` (TS, Tailwind, App Router, ESLint, `src/`), pnpm.
2. Install: shadcn/ui, supabase-js + `@supabase/ssr`, zod, react-hook-form, TanStack Query/Table, recharts, dnd-kit, date-fns, libphonenumber-js, vitest, playwright, eslint-plugin-boundaries, prettier, husky + lint-staged.
3. `git init`; GitHub repo `pse-dashboard`; branch model: `main` (prod) ← `develop` ← feature branches; Conventional Commits; PR template; branch protection.
4. Supabase project(s): `dev` and `prod`; `supabase init`, link, `.env.example`.
5. Vercel project linked to GitHub; env vars per environment; preview deploys on PRs.
6. GitHub Actions: typecheck, lint, unit tests, build, (later) e2e.
7. Create module folder skeleton and boundaries lint.
- **Exit:** "Hello" page auto-deploys from `main` to Vercel; CI green.

### Phase 3 — Database, auth, RBAC (Day 3–4)
- Migrations in order: enums → reference tables → contacts/channels → pipelines/history/receipts → meetings → activities → targets → audit → indexes → RLS → triggers/functions.
- Seed: stages, categories, verticals + map, currencies/FX, settings, demo users (admin, Safina-like `target_manager`, 3 members), then demo data.
- Auth: login page, session middleware, `requireUser/requireRole`, profile bootstrap trigger, user admin screen, app shell (sidebar, header, role-aware nav).
- Tests: SQL tests for dedupe, channel-min, amount>0, RLS (PSE vs non-PSE user), target lock.
- **Exit:** can log in, role-gated shell works, RLS tests pass.

### Phase 4 — Contacts module (Day 5)
- List (search, filter by type/status/organisation/industry), detail, create/edit with **type-conditional form** (Individual vs Company fields per spec).
- Multi-channel repeater (email/phone dropdown), normalisation, **duplicate check on both**, friendly "already exists → open it" message.
- Organisation combobox (internal search only) with "create new company".
- **Reusable `ContactPicker` with inline create** (used by Pipelines/Meetings).
- Notes (long text) + related timeline panel (pipelines, meetings, activities for that contact).
- Tests: duplicate scenarios, ≥1 channel, individual without org.

### Phase 5 — Pipelines module (Day 6–7)
- Dynamic form: Deal name, focal person, contribution type, category, party type → Individual fields or Company fields (incl. POC + secondary contact, website, country, operational budget, notes with Drive URLs).
- Validation: value>0; in-kind needs valuation note; hint redirecting small items to Activities.
- Views: list, **kanban by stage** (drag = stage change + history), detail page with stage timeline, receipts panel, linked meetings/activities.
- Won/Lost dialogs; receipts entry (amount, date, currency → base conversion).
- Cache tags + invalidation on every write.
- Tests: validation matrix, stage history, FX conversion, won→receipts→achievement.

### Phase 6 — Meetings & Activities (Day 8–9)
- **Meetings:** form with contact or pipeline (one required); organisation/designation shown via join; scheduled/done toggle; calendar-style list; "Add follow-up activity" shortcut.
- **Activities:** all 11 types, class (stewardship / prospect / independent), owner, optional links to contact/pipeline/meeting, status + remaining work, date, notes; list with filters (type, class, owner, date, status); quick-add from any record's page; "My activities" view reproducing the Excel tracker (export to CSV).
- Team-wide read, owner write.
- Tests: link combinations, independent activity, class filters.

### Phase 7 — Targets module (Day 10)
- Setup **wizard**: (1) annual team target → (2) manual Q1–Q4 with live "remaining to allocate" bar, blocks save if Σ≠annual → (3) allocate per member → (4) vertical % per member/quarter (must total 100%) → (5) review & **Publish/Lock**.
- Read-only after lock (UI + DB trigger); audit trail; only `targets.manage`.
- Tests: sums, percent rounding (largest-remainder), lock, permission denial.

### Phase 8 — Dashboards (Day 11–12)
- Global filters: period (Month/Quarter/Year, fiscal-aware), team/member, vertical.
- **Lens 1 – Monetary:** target vs achievement (gauge/bar), achieved/unachieved/overachieved, per member/team/vertical, pipeline value & count by stage kind (open/won/lost/junk), cash vs valued in-kind, won-unrealized, trend line. Quarterly fixed; annual = Σ actuals; monthly = pro-rata (labelled).
- **Lens 2 – Non-monetary:** meeting counts + completion, activity counts by type/class, visits/events/campaigns, contacts engaged, stewardship volume, per-member workload, trend.
- Original KPIs (Lead, Meeting, Achievement, Events) all present across Monthly/Quarterly/Annual tabs.
- Drill-down from tile → filtered list. Empty/loading/error states; CSV export.
- Charts follow accessible, consistent palette; responsive.

### Phase 9 — Caching & performance (Day 12–13)
- Wrap dashboard queries in tag cache; map **write → tags** table; verify invalidation.
- Seed 10k contacts / 5k pipelines / 20k activities; EXPLAIN + add indexes; measure cold/warm p95; add Query client cache; optional matview.
- Document results in ADR + Architecture PDF addendum. **Exit:** warm dashboard < ~300 ms server time, no stale data after writes (test proves it).

### Phase 10 — Admin & Migration tool (Day 13)
- Admin: stages (name, kind, order), categories, verticals + map, currencies/FX, users/roles, settings (fiscal start, base currency).
- Importer: upload CSV (parsing in memory, no storage) → column-mapping UI → **dry-run report** (valid, duplicates, errors) → commit → `import_jobs` log. Dedupe via same channel rules. Sample mapping `odoo-contacts.csv` + `odoo-opportunities.csv` templates.

### Phase 11 — Testing & hardening (Day 14)
- Unit (rules, periods, money, phone), SQL tests, **Playwright e2e**: login → create contact (dup blocked) → New Deal w/ inline contact → move stages → won → receipt → dashboard reflects → targets wizard → lock.
- Security pass (RLS from non-PSE account, service key exposure check), a11y pass, responsive pass, Lighthouse, `npm audit`.
- Fix list triaged; no P1/P2 open.

### Phase 12 — Deployment & delivery packaging (Day 15)
1. Run prod migrations against Supabase prod; seed reference data and **demo dataset** (clearly fake).
2. Vercel production deploy from `main`; set env vars; verify Preview≠Prod secrets; smoke test live URL; check logs.
3. Repo polish: README (setup in <10 min, env table, scripts, architecture summary), CONTRIBUTING, LICENSE, `.env.example`, tags `v1.0.0`, screenshots.
4. **Google Drive** structure (see Part D). Share with view access; verify links open logged-out.
5. Submission email: Vercel URL, GitHub URL, Drive folder URL, Architecture PDF, demo credentials (read-only/demo users), list of assumptions + open items.

### MVP cut (if time is tight — do these in this order)
1. Phases 0–3 (docs, init, DB, auth)
2. Contacts → Pipelines (with receipts) → Targets → Monetary dashboard
3. Meetings + Activities + Non-monetary dashboard
4. Caching ADR + measured result
5. Defer: importer UI, kanban drag, CSV export, count targets, matview.
**Never cut:** architecture PDF, caching, live deployment, the clarified-requirement rules in A4.

---

## PART D — DELIVERABLES MAP

**1. Architecture PDF** — overview · requirements traceability (each req → module/table) · assumptions & open items · tech stack rationale · module diagram · ERD · security/RLS · caching design + measurements · deployment · scalability · risks.

**2. GitHub** — clean history (Conventional Commits), PRs per phase, CI badge, README, `/docs`, migrations, seed, tests.

**3. Google Drive** (`PSE Dashboard – Assessment/`)
```
01_Requirements_Analysis   (A1–A4, changes matrix, open-items log)
02_Architecture            (PDF, diagrams source, ADRs)
03_Database                (ERD, data dictionary, migration notes)
04_User_Guide              (per module + dashboard KPI definitions + target setup)
05_Technical_Docs          (setup, env, deployment runbook, caching, API/actions)
06_Testing                 (test plan, results, e2e screenshots)
07_Migration               (Odoo mapping template, import guide)
08_Project_Management      (this plan, timeline, decisions log)
README / index document with all links
```
> Note: the Google Drive connector in this session is not authorised, so uploading to Drive must be done manually (or authorise the connector in claude.ai settings first).

**4. Vercel** — production URL, demo credentials in the README/email, seeded demo data.

---

## PART E — OPEN QUESTIONS TO SEND TO PSE (with my defaults)

1. Final pipeline stages and mapping to open/won/lost/junk? *(default: 8 proposed stages)*
2. Exact "Lead" KPI formula? *(default: pipelines created in period)*
3. Is VBD a replacement for SAC/others, or are category and vertical separate? *(default: separate + mapping table)*
4. Is "achievement" = money received, or won value? *(default: receipts)*
5. Monthly target: pro-rata of quarter, or no monthly target? *(default: pro-rata, labelled)*
6. Calendar or fiscal year? Base currency and FX source? *(default: calendar, BDT, manual FX table)*
7. Is the contact active/inactive flag wanted? *(default: yes)*
8. Who exactly holds target-edit rights besides Safina? *(default: role `target_manager`)*
9. Do count-targets (meetings/events) still matter? *(default: not built, stretch)*
10. Odoo migration: which fields, completeness, old→new mapping?
11. Excel activity tracker columns (needed to match the activity form exactly).

---

## PART F — RISKS

| Risk | Mitigation |
|---|---|
| Requirements still moving | Config-driven stages/categories/verticals/KPI functions; ADRs record decisions |
| Cache serving stale or leaking data | Tag invalidation tests; auth strictly before cached calls; PSE-only data in cache |
| Achievement misunderstanding | Explicit labels: Forecast / Won / Realized on every dashboard tile |
| Target rounding errors | Largest-remainder allocation; DB trigger on totals |
| Scope creep (Gmail, uploads, autofill, event module) | Written out-of-scope list in scope doc |
| Deadline | MVP cut list above |

## Definition of Done
All A4 rules pass tests · CI green · prod deployed and smoke-tested · PDF/Drive/GitHub/Vercel links verified from a logged-out browser · assumptions and open items documented.
