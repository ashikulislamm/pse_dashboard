# PSE Dashboard — Implementation Phases (Deadline-Driven)

**Hard deadline: Wednesday 28 Oct 2026, 11:59 PM.** Today is Monday 26 Oct. That leaves roughly **2.5 working days**, not the 15 days in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). This file is the compressed, ordered build plan. Architecture reference: [ARCHITECURE.md](ARCHITECURE.md).

> **Rule of the schedule:** the project is *submitted* by **Wed 28 Oct, 8:00 PM** (target) and never later than 10:30 PM. The last 90 minutes are a safety buffer for deployment surprises. Anything unfinished at a gate is cut, not rushed.

---

## 0. Scheduling overview

| Block | When | Phases | Gate (must be true to continue) |
|---|---|---|---|
| **Day 1 — Mon 26 Oct (rest of day, ~6–8 h)** | now → night | P0 Decisions · P1 Init & infra · P2 Database, auth, RBAC | Live "login works" URL on Vercel, schema + RLS migrated |
| **Day 2 — Tue 27 Oct (~12 h)** | morning → night | P3 Contacts · P4 Pipelines & receipts · P5 Meetings & Activities · P6 Targets | Full data-entry flow works end to end locally |
| **Day 3 — Wed 28 Oct (to 8 PM)** | morning → evening | P7 Dashboards · P8 Caching · P9 Test & harden · P10 Deploy & docs · P11 Submit | Submission email sent |
| **Buffer** | Wed 8:00–11:59 PM | Fixes only | — |

### Time budget per phase

| Phase | Budget | Cut priority if late (1 = cut first) |
|---|---|---|
| P0 Decisions | 0.5 h | — |
| P1 Init & infra | 2 h | — |
| P2 DB, auth, RBAC | 4 h | — |
| P3 Contacts | 2.5 h | — |
| P4 Pipelines + receipts | 3.5 h | — |
| P5 Meetings + Activities | 3 h | — |
| P6 Targets | 2.5 h | — |
| P7 Dashboards | 4 h | — |
| P8 Caching | 1.5 h | — |
| P9 Test & harden | 2 h | — |
| P10 Deploy & docs (PDF, Drive, README) | 3 h | — |
| Importer UI | not built | **1** (documented as designed/future) |
| Kanban drag-and-drop | stage dropdown instead | **2** |
| Admin screens for config | seeded + SQL-editable only | **3** |
| Count-targets, CSV export, matview, Redis | not built | **4** |

### Scope cut (decided now, stated in docs, not hidden)

**Built:** auth + roles, Contacts, Pipelines (with stages, history, receipts), Meetings, Activities, Targets (wizard + lock), two-lens Dashboard, tagged caching, deployment, docs.
**Designed but not built (documented as extension points):** Odoo CSV importer, admin CRUD screens for stages/verticals/FX, kanban drag, count-targets, follow-up KPI, target hierarchy.
**Never built (excluded by requirements):** Gmail sync, uploads, external autofill, Events module.

### Shortcuts that save hours (and are acceptable)
1. **One Supabase Cloud Postgres project connected via Session Pooler URI (`DATABASE_URL`, port `5432`)** using `pg` (`node-postgres`) and Typed Parameterized SQL in `repository.ts` (no separate ORM).
2. **Push SQL migrations directly via `DATABASE_URL`** (no local Docker or extra Supabase API keys needed).
3. **Package manager:** **`npm`** (`package-lock.json`, `npm ci`) used across all commands and CI.
4. **Auth by email+password stored in Postgres (`scrypt`) + standard HS256 JWT cookie (`pse_session`)**; user-scoped transactions set `request.jwt.claim.sub` / `app.current_user_id` so Postgres RLS works directly over `DATABASE_URL`.
5. **Config tables are seeded**; edited through Supabase SQL editor.
6. Deploy to Vercel **in Phase 1** and keep it green, so Day 3 has no first-deploy surprise.

---

## P0 — Lock decisions (Mon, 30 min)

No more clarification cycles; there is no time to wait. Record these as **assumptions** in `docs/ASSUMPTIONS.md` and send them in the submission email.

| Open item | Decision for this build |
|---|---|
| Pipeline stages | New, Scoping, Preparation, Submitted, Pending, Won, Lost, Abandoned → `kind`: open ×5, won, lost, junk |
| Lead KPI | Pipelines created in the period (one SQL function, swappable) |
| Category vs vertical | Two dimensions + `category_vertical_map` (DSP→DSP, Project→Project, all others→VBD; editable) |
| Achievement | Σ receipts in period; "Won, unrealized" = won amount − receipts |
| Monthly target | Quarter ÷ 3, labelled "pro-rata" |
| Year / currency | Calendar year; base currency BDT; USD, EUR, GBP via manual `fx_rates` |
| Contact status | active/inactive included |
| Target rights | Role `target_manager` (+ admin) |
| Follow-up KPI, count-targets, importer, hierarchy | Not built |

**Deliverable:** `docs/ASSUMPTIONS.md` (copy the table above).

---

## P1 — Project initialization & infrastructure (Mon, 2 h)

### Steps
1. `pnpm create next-app@latest pse-dashboard` — TypeScript, Tailwind, ESLint, App Router, `src/` dir, import alias `@/*`. Move/clone so the repo root is `d:\pse_dashboard`.
2. Install:
   ```
   pnpm add @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers @tanstack/react-query @tanstack/react-table recharts date-fns libphonenumber-js lucide-react
   pnpm add -D vitest @vitejs/plugin-react @playwright/test eslint-plugin-boundaries prettier husky lint-staged supabase
   pnpm dlx shadcn@latest init   # then add: button input select textarea dialog form table tabs badge card calendar popover command sonner dropdown-menu
   ```
3. Folder skeleton exactly as in ARCHITECURE.md §6:
   `src/modules/{auth,contacts,pipelines,meetings,activities,targets,dashboard,admin}` each with `schema.ts repository.ts service.ts actions.ts queries.ts components/ index.ts`, plus `src/shared/lib/{supabase,cache,rbac,periods,money,phone}`.
4. `eslint-plugin-boundaries` config: `app → modules → shared`; cross-module imports only via `index.ts`; Supabase client imported only by `repository.ts` and `shared/lib/supabase`.
5. `git init`; `.gitignore` (`.env*`, `.next`); create GitHub repo `pse-dashboard`; first commit; push `main`. Branch `develop` for work; merge to `main` at each gate (Vercel deploys `main`).
6. **Supabase**: create one project. `pnpm supabase init`, `pnpm supabase link --project-ref <ref>`. Keys into `.env.local`:
   ```
   DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   AUTH_SECRET=pse-dashboard-dev-secret-change-in-production
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
   Commit `.env.example` with empty values.
7. **Vercel**: import the GitHub repo, set the same three env vars (Production + Preview), deploy. The service-role key must **not** be exposed to the browser bundle.
8. **CI** (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`.
9. Scripts in `package.json`: `dev`, `build`, `lint`, `typecheck` (`tsc --noEmit`), `test`, `db:push`, `db:types` (`supabase gen types typescript --linked > src/types/database.ts`).

### Shared helpers to write now (used by everything)
- `shared/lib/supabase/{server,client,admin}.ts` — `server` uses `@supabase/ssr` with cookies; `admin` uses the service-role key and starts with `import 'server-only'`.
- `shared/lib/cache/index.ts` — a single `cached(fn, keyParts, tags, revalidate)` wrapper around the version-appropriate Next caching API, so the rest of the code never imports Next cache primitives directly.
- `shared/lib/rbac/index.ts` — `requireUser()`, `requireRole(...roles)` (throws / redirects).
- `shared/lib/phone.ts` — `normalizePhone(raw, defaultCountry='BD')` → E.164 via libphonenumber-js, returns `null` if invalid. `normalizeEmail` = trim + lowercase.
- `shared/lib/money.ts` — `toBase(amount, currency, fxRate)`, `allocateByPercent(total, percents[])` using **largest-remainder** rounding to 2 dp so allocations sum exactly.
- `shared/lib/periods.ts` — `periodRange({type:'month'|'quarter'|'year', year, index, fiscalStartMonth=1})` → `{start, end}`; `quarterOf(date)`.

### Exit gate (Mon, ~+2 h)
Vercel production URL shows the app; CI green; repo on GitHub. **Commit message prefix convention:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`.

---

## P2 — Database, auth, RBAC (Mon, 4 h)

Create migrations with `pnpm supabase migration new <name>`; one file per concern; push with `pnpm db:push`.

### 2.1 Migration order and content

**`001_enums_and_config.sql`**
```sql
create type app_role as enum ('admin','target_manager','member');
create type contact_type as enum ('individual','company');
create type channel_kind as enum ('email','phone');
create type stage_kind as enum ('open','won','lost','junk');
create type contribution_type as enum ('cash','in_kind');
create type party_type as enum ('individual','company');
create type payment_interval as enum ('one_time','monthly','quarterly','semi_annual','annual');
create type meeting_status as enum ('scheduled','done');
create type activity_type as enum ('task','email','call','meeting','event','campaign','proposal','visit','servicing','prospect_engagement','general');
create type activity_class as enum ('stewardship','prospect_engagement','independent');
create type activity_status as enum ('planned','in_progress','done','cancelled');

create table teams(id uuid primary key default gen_random_uuid(), name text not null);
create table profiles(
  id uuid primary key references auth.users on delete cascade,
  full_name text not null, role app_role not null default 'member',
  team_id uuid references teams, is_pse boolean not null default true,
  is_active boolean not null default true);
create table settings(key text primary key, value text not null);   -- base_currency, fiscal_year_start_month
create table currencies(code text primary key, name text);
create table fx_rates(currency text references currencies, rate_to_base numeric(18,6) not null, effective_from date not null, primary key(currency,effective_from));
create table pipeline_stages(id uuid primary key default gen_random_uuid(), name text unique not null, kind stage_kind not null, position int not null);
create table contribution_categories(id uuid primary key default gen_random_uuid(), name text unique not null);
create table verticals(id uuid primary key default gen_random_uuid(), name text unique not null);
create table category_vertical_map(category_id uuid primary key references contribution_categories, vertical_id uuid not null references verticals);
```

**`002_contacts.sql`**
```sql
create table contacts(
  id uuid primary key default gen_random_uuid(),
  type contact_type not null, name text not null,
  organization_id uuid references contacts,        -- individual -> company (nullable)
  designation text, website text, industry text, notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  owner_id uuid references profiles, created_at timestamptz default now(), updated_at timestamptz default now(),
  check (organization_id is null or organization_id <> id));
create table contact_channels(
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts on delete cascade,
  kind channel_kind not null, value text not null, value_normalized text not null,
  is_primary boolean default false,
  unique (kind, value_normalized));                 -- duplicate prevention on email AND phone
create index on contacts(type, status); create index on contacts using gin (to_tsvector('simple', name));
-- >=1 channel per contact, checked at commit
create function enforce_contact_channel() returns trigger language plpgsql as $$
begin
  if not exists(select 1 from contact_channels where contact_id = coalesce(new.contact_id, old.contact_id))
     and exists(select 1 from contacts where id = coalesce(new.contact_id, old.contact_id)) then
    raise exception 'contact needs at least one email or phone';
  end if; return null; end $$;
create constraint trigger contact_min_channel after insert or delete on contact_channels
  deferrable initially deferred for each row execute function enforce_contact_channel();
-- companion constraint trigger on contacts INSERT performs the same check
```

**`003_pipelines.sql`**
```sql
create table pipelines(
  id uuid primary key default gen_random_uuid(),
  deal_name text not null, focal_person_id uuid not null references profiles,
  contribution_type contribution_type not null,
  category_id uuid not null references contribution_categories,
  party_type party_type not null,
  contact_id uuid not null references contacts,           -- donor / company
  poc_contact_id uuid references contacts, secondary_contact_id uuid references contacts,
  stage_id uuid not null references pipeline_stages,
  expected_amount numeric(18,2) not null check (expected_amount > 0),   -- money-only rule
  currency text not null references currencies, amount_base numeric(18,2) not null,
  payment_interval payment_interval not null default 'one_time',
  expected_close date, country text, description text, operational_budget numeric(18,2),
  notes text, in_kind_valuation_note text, lost_reason text, won_at timestamptz,
  created_by uuid references profiles, created_at timestamptz default now(), updated_at timestamptz default now(),
  check (contribution_type='cash' or in_kind_valuation_note is not null),   -- in-kind must be valued
  check (party_type='individual' or poc_contact_id is not null));
create table pipeline_stage_history(id bigserial primary key, pipeline_id uuid references pipelines on delete cascade, from_stage uuid, to_stage uuid, changed_by uuid, changed_at timestamptz default now());
create table pipeline_receipts(id uuid primary key default gen_random_uuid(), pipeline_id uuid not null references pipelines on delete cascade,
  amount numeric(18,2) not null check (amount>0), currency text not null references currencies, amount_base numeric(18,2) not null,
  received_on date not null, note text, created_by uuid references profiles);
create index on pipelines(stage_id); create index on pipelines(focal_person_id, created_at); create index on pipeline_receipts(received_on);
-- trigger: AFTER UPDATE OF stage_id on pipelines -> insert pipeline_stage_history; set won_at when new stage kind='won'
```

**`004_meetings_activities.sql`**
```sql
create table meetings(id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts, pipeline_id uuid references pipelines,
  scheduled_at timestamptz not null, status meeting_status not null default 'scheduled',
  description text, owner_id uuid not null references profiles, created_at timestamptz default now(),
  check (contact_id is not null or pipeline_id is not null));
create table activities(id uuid primary key default gen_random_uuid(),
  type activity_type not null, class activity_class not null default 'independent',
  title text not null, owner_id uuid not null references profiles,
  contact_id uuid references contacts, pipeline_id uuid references pipelines, meeting_id uuid references meetings,
  related_org_name text, status activity_status not null default 'planned', remaining_work text,
  occurred_at timestamptz, due_at timestamptz, notes text, created_at timestamptz default now());
create index on activities(owner_id, occurred_at); create index on activities(type); create index on activities(class);
create index on meetings(scheduled_at, status);
```

**`005_targets.sql`**
```sql
create table target_plans(id uuid primary key default gen_random_uuid(), year int not null, team_id uuid references teams,
  annual_amount numeric(18,2) not null check (annual_amount>0), locked_at timestamptz, locked_by uuid references profiles, unique(year,team_id));
create table target_quarters(id uuid primary key default gen_random_uuid(), plan_id uuid not null references target_plans on delete cascade,
  quarter int not null check (quarter between 1 and 4), amount numeric(18,2) not null check (amount>=0), unique(plan_id,quarter));
create table target_lines(id uuid primary key default gen_random_uuid(), quarter_id uuid not null references target_quarters on delete cascade,
  user_id uuid not null references profiles, vertical_id uuid not null references verticals,
  percent numeric(6,3) not null check (percent between 0 and 100), amount numeric(18,2) not null, unique(quarter_id,user_id,vertical_id));
-- BEFORE INSERT/UPDATE/DELETE on all three: raise if parent plan.locked_at is not null (lock invariant)
-- publish_target_plan(plan_id) SECURITY DEFINER function: verifies SUM(quarters)=annual AND each quarter's lines sum = quarter amount, then sets locked_at.
```

**`006_audit_rls.sql`**
```sql
create function is_pse_member() returns boolean language sql stable security definer as
$$ select exists(select 1 from profiles where id = auth.uid() and is_pse and is_active) $$;
create function has_role(r app_role[]) returns boolean language sql stable security definer as
$$ select exists(select 1 from profiles where id = auth.uid() and is_active and role = any(r)) $$;
-- For every business table:
alter table contacts enable row level security;
create policy contacts_read on contacts for select using (is_pse_member());
create policy contacts_ins  on contacts for insert with check (is_pse_member());
create policy contacts_upd  on contacts for update using (owner_id = auth.uid() or has_role(array['admin']::app_role[]));
-- same pattern: pipelines/meetings/activities (owner or admin writes); receipts (pipeline owner/admin)
-- targets: select is_pse_member(); insert/update/delete only has_role(array['admin','target_manager']) AND not locked
-- audit_log table + generic audit trigger on pipelines, receipts, targets, contacts
```

**`seed.sql`** — teams (PSE), stages (8 above), categories (6), verticals (DSP, VBD, Project) + map, currencies (BDT, USD, EUR, GBP) + `fx_rates`, settings (`base_currency=BDT`, `fiscal_year_start_month=1`). Demo users are created via the Supabase dashboard / `auth.admin.createUser` script (`scripts/seed-users.ts`): `safina` (target_manager), `admin` (admin), `member1..3` (member). **Plus a demo-data script** `scripts/seed-demo.ts`: ~40 contacts, ~25 pipelines across stages, receipts, ~30 meetings, ~80 activities, a locked 2026 target plan — all clearly fake.

### 2.2 Auth & app shell
- `middleware.ts`: refresh Supabase session; redirect unauthenticated users to `/login`; non-PSE profile → `/no-access`.
- `/login` page (email+password, server action `signIn`).
- Profile auto-create trigger on `auth.users` insert.
- App shell: sidebar (Dashboard, Contacts, Pipelines, Meetings, Activities, Targets, role-gated Admin), header with user menu and sign-out.
- `pnpm db:types` → `src/types/database.ts`.

### 2.3 Tests (SQL + unit, 30 min)
Pgtap-style or a `scripts/db-tests.ts` against the project, checking: duplicate email rejected, duplicate phone rejected, contact without channel rejected, pipeline amount ≤ 0 rejected, in-kind without valuation rejected, meeting with no contact/pipeline rejected, non-PSE user reads zero rows, member cannot write targets, locked plan rejects edits. Unit: `normalizePhone`, `allocateByPercent` (sums exact), `periodRange`.

### Exit gate (Mon night)
Log in as each role on the Vercel URL; RLS tests pass; seed loaded. **Merge `develop` → `main`.** *If not met by midnight, stop writing features Tuesday morning until it is.*

---

## P3 — Contacts module (Tue, 2.5 h)

### Business logic
- Individual vs Company drives the form. Individual: name, channels, designation, organization (optional), notes. Company: name, channels, website, industry, notes.
- ≥1 email or phone mandatory. Duplicate check on **normalized email and normalized phone**.
- Notes carry relationship intelligence (referrals, roles, family, donor background).
- Organization/designation are **structured fields** (filterable); suggestions only from internal contacts.
- `status` active/inactive.

### Technical
- `schema.ts`: zod discriminated union on `type`; channels array `min(1)`; phone refined with `normalizePhone`.
- `repository.ts`: `list({q,type,status,organizationId,page})`, `get(id)`, `findByChannels(emails, phones)`, `create`, `update`, `searchLite(q)` (id, name, type, org).
- `service.ts`: `createContact(input)` → normalize → `findByChannels` → if hit, return `{status:'duplicate', existing}`; else insert contact + channels in one RPC/transaction.
- `actions.ts`: `createContactAction`, `updateContactAction` (requireUser; zod; revalidate tags `contacts`).
- UI: list table (search, filters, pagination), detail page with **related panel** (pipelines, meetings, activities), create/edit dialog with conditional fields and channel repeater (Email/Phone dropdown + value), duplicate banner "Already exists — Open".
- **`ContactPicker`** (shared component in `modules/contacts/components`, exported via `index.ts`): command-style combobox using `searchLite`; footer item "+ Create new contact" opens the create dialog inline and returns the new id. Used by Pipelines and Meetings.

### Acceptance
Creating a second contact with the same email **or** the same phone is blocked with a link to the existing one; individual without company saves; contact with zero channels is rejected; picker creates and selects a contact without leaving the deal form.

---

## P4 — Pipelines & receipts (Tue, 3.5 h)

### Business logic
- Pipeline exists **only** for expected money. `expected_amount > 0`; the form shows a hint "Small or unvalued items → log as an Activity" with a link.
- Contribution type: **Cash** or **In-kind** (valued). In-kind requires a manual value and a valuation note (who valued it, basis).
- Party type: **Individual** (contact = donor) or **Company** (company contact + Point of Contact + optional Secondary Contact).
- Category (6 seeded) required; vertical derived from `category_vertical_map` at query time.
- Currency + amount → `amount_base` using latest `fx_rates` row ≤ today (`rate=1` for BDT), stored at write time.
- Stage changes write history. Moving to a **won** stage asks confirmation; **lost** requires `lost_reason`; **junk** (Abandoned) optional reason.
- **Achievement comes only from `pipeline_receipts`.** A Won pipeline shows "Won ৳X · Received ৳Y · Unrealized ৳(X−Y)". Over-receipt is allowed but flagged.
- Documents = Google Drive URLs pasted in notes (rendered as clickable links).

### Technical
- `schema.ts`: zod discriminated union on `party_type`; `refine` in-kind ⇒ valuation note.
- `repository.ts`: `list(filters)`, `get`, `create`, `update`, `changeStage`, `addReceipt`, `listReceipts`, `listStages`.
- `service.ts`: `computeBase()`, `canMoveToKind()`, `createPipeline`, `changeStage` (validates reason), `addReceipt` (computes base, checks won stage — receipts allowed only when pipeline stage kind = won).
- `actions.ts` revalidate tags: `pipelines`, `receipts`, `dashboard`.
- UI:
  - **List** (table; filters: stage, kind, category, focal person, party, date) and **board view** grouped by stage using a plain column layout; stage change via a dropdown on each card (drag-and-drop is cut priority 2 — add only if time remains).
  - **New/Edit form** with dynamic sections per party type, `ContactPicker` for contact/POC/secondary, currency select showing computed base amount live.
  - **Detail page**: summary, stage timeline (from history), receipts table + "Record receipt" dialog, linked meetings and activities with "+ add" shortcuts.

### Acceptance
Cannot save with amount 0; in-kind without valuation note rejected; moving to Lost needs a reason; stage history rows appear; recording a receipt raises Achievement on the dashboard; USD deal stores the converted BDT amount.

---

## P5 — Meetings & Activities (Tue, 3 h)

### Meetings — business logic
- Linked to a **contact or a pipeline** (at least one); if only a pipeline is chosen, the pipeline's contact is shown. Organization name and designation are **displayed from the linked contact's structured fields**, not typed.
- Status: Scheduled / Done. Date-time required. Description.
- Follow-up is recorded as an **Activity**: "Add follow-up" button on a meeting pre-fills `meeting_id`, `contact_id`, `pipeline_id`.
- UI: list with tabs (Upcoming / Done / All), filters (owner, date, status), create/edit dialog using `ContactPicker` and pipeline select.

### Activities — business logic
- 11 types: task, email (manual log), call, meeting, event, campaign, proposal, visit, servicing, prospect_engagement, general.
- **Class** drives non-monetary reporting: *stewardship* (existing donors), *prospect engagement* (before a money opportunity exists), *independent* (info requests, visits, events with no defined value). Default class by type (servicing→stewardship, prospect_engagement→prospect, others→independent) but user-editable.
- Fields: owner (default current user), optional contact/pipeline/meeting links, `related_org_name` (free text when no contact), status, `remaining_work`, `occurred_at`/`due_at`, notes.
- **Never affects monetary figures.** Small in-kind donations are logged here (type `general`/`servicing`).
- UI: table reproducing the Excel tracker (columns: date, type, class, related, owner, status, remaining work), filters (type, class, owner, date, status), "My activities" preset, quick-add dialog also reachable from contact / pipeline / meeting pages.
- Team-wide read; only owner/admin edit.

### Technical
Standard module files as before; tags `meetings`, `activities`, `dashboard`. Activity default-class helper in `service.ts` with unit test.

### Acceptance
Meeting with neither contact nor pipeline is rejected; activity can exist with no links; all 11 types selectable; follow-up shortcut pre-links records; another member can view but not edit someone else's activity.

---

## P6 — Targets (Tue, 2.5 h)

### Business logic (agreed targeting logic)
1. `target_manager`/`admin` creates a plan: **year + annual team target** (BDT).
2. Distribute across **Q1–Q4 manually**, uneven allowed. UI shows "Remaining to allocate"; saving blocked unless **ΣQ = annual**.
3. For each quarter allocate to **team members** (amount); Σ members must equal the quarter amount.
4. For each member/quarter set **vertical percentages** (DSP / VBD / Project); must total **100%**; amounts computed with `allocateByPercent` (largest remainder, sums exactly).
5. **Publish = lock.** After lock, all target writes fail (UI read-only + DB trigger). No revisions, to preserve integrity.
6. Overachievement never changes other quarters (no carry-forward). Annual actual = Σ all receipts in the year.

### Technical
- `service.ts`: `validatePlan(plan)`, `buildLines(quarter, members, verticalPercents)`.
- `repository.ts`: CRUD plus `publish(planId)` calling the `publish_target_plan` SQL function (the final authority).
- Wizard UI (client component, step state in memory; each step saved as draft): Annual → Quarters → Members → Verticals → Review & Publish. Members come from `profiles`.
- Permission: `requireRole('admin','target_manager')` on all actions; page is read-only for others.
- Tags: `targets`, `dashboard`.

### Acceptance
Unequal quarters that don't add to annual cannot be saved; percentages ≠ 100 rejected; after publish every edit fails at the DB; a `member` sees the plan but no edit controls; rounding never leaves a 0.01 gap.

---

## P7 — Dashboards (Wed morning, 4 h)

### SQL read-model functions (`007_dashboard_functions.sql`)
All take `(p_start date, p_end date, p_user uuid default null, p_vertical uuid default null)`.

```sql
-- Achievement (money received) grouped by member and vertical
create function fn_achievement(p_start date, p_end date, p_user uuid, p_vertical uuid)
returns table(user_id uuid, vertical_id uuid, achieved numeric)
language sql stable as $$
  select p.focal_person_id, m.vertical_id, sum(r.amount_base)
  from pipeline_receipts r
  join pipelines p on p.id = r.pipeline_id
  join category_vertical_map m on m.category_id = p.category_id
  where r.received_on between p_start and p_end
    and (p_user is null or p.focal_person_id = p_user)
    and (p_vertical is null or m.vertical_id = p_vertical)
  group by 1,2 $$;

-- Target for the same window (quarter exact; month = quarter/3; year = sum of quarters)
-- fn_target(p_year int, p_quarter int, p_month int, p_user, p_vertical) -> sum(target_lines.amount) (÷3 when month)
-- fn_pipeline_by_kind(p_start, p_end, p_user) -> kind, count, expected_base, cash_base, in_kind_base
-- fn_won_unrealized(p_start, p_end)          -> won amount - receipts
-- fn_lead_count(p_start, p_end, p_user)      -> pipelines created in period   (formula isolated here)
-- fn_meeting_summary(p_start, p_end, p_user) -> status, count
-- fn_activity_summary(p_start, p_end, p_user)-> type, class, count, distinct contacts engaged
-- fn_trend(p_year, p_user)                   -> month, achieved
```
Each function is covered by a quick seeded assertion test.

### Page design (`/dashboard`)
- **Global filters:** period type (Month / Quarter / Year) + selector, member/team, vertical. State in URL search params (shareable, drives the cache key).
- **Lens 1 — Monetary**
  - KPI tiles: Target, Achieved, Attainment %, Unachieved, Over-achieved, Won-unrealized.
  - Target vs achievement bars per member and per vertical.
  - Pipeline by stage kind (open/won/lost/junk): count and value; cash vs valued in-kind split.
  - Monthly trend line.
  - Month view labelled *"Target = quarter ÷ 3 (pro-rata)"*.
- **Lens 2 — Non-monetary**
  - Meetings: total, scheduled vs done, completion %.
  - Activities by type and by class (stewardship / prospect / independent).
  - Visits, events, campaigns counts; distinct contacts engaged; per-member workload bars.
- The four originally requested KPIs (Lead, Meeting, Achievement, Events) all appear, per Monthly/Quarterly/Annual tab.
- Tiles drill down to the filtered list page; empty/loading/error states present.
- Charts: Recharts via shadcn chart wrappers, accessible colors, readable in light/dark.

### Technical
`modules/dashboard/queries.ts` exposes `getMonetary(filters)` and `getNonMonetary(filters)` which call the SQL functions through `admin` client wrapped by `cached()` (see P8). Server component fetches both in parallel (`Promise.all`) and passes plain objects to client chart components.

### Acceptance
Seeded data reproduces a hand-computed Q result; filtering by member/vertical changes numbers consistently; achievement ignores non-monetary activities; overachieved quarter shows >100% and does not change the next quarter's target.

---

## P8 — Caching (Wed, 1.5 h)

1. Implement `cached()` in `shared/lib/cache` (one place to change API by Next version).
2. Wrap in `modules/dashboard/queries.ts` and config reads (stages, verticals, FX):
   - key = `['dashboard', lens, periodType, periodIndex, year, userId|all, verticalId|all]`
   - tags: dashboard reads → `dashboard`; config → `config`
   - fallback TTL 300 s.
3. **Authorization before cache:** page calls `requireUser()` first; cached functions use the service-role client and run only after that. Cache keys contain filters, never the viewer's identity.
4. Every server action calls `revalidateTag` per the table in ARCHITECURE.md §10.3.
5. Client: TanStack Query provider for list filters/search and optimistic stage change.
6. **Measure:** seed ≥ 5k pipelines / 20k activities with a script; record cold vs warm server time for `/dashboard` (Vercel logs or `console.time` in dev) and add `EXPLAIN ANALYZE` indexes if needed. Paste results into `docs/CACHING.md`.
7. **Test:** record a receipt → reload dashboard → the new value shows immediately (invalidation works).

---

## P9 — Test & harden (Wed, 2 h)

| Check | How |
|---|---|
| Unit | `vitest`: phone/email normalize, `allocateByPercent`, `periodRange`, activity default class, FX base |
| DB rules | `scripts/db-tests.ts` (from P2) re-run |
| E2E (one Playwright test, the happy path) | login as member → create contact (duplicate attempt blocked) → new deal with inline contact → move to Won → add receipt → dashboard shows it → log in as `safina` → create & publish target → edit rejected |
| Security | log in as a non-PSE profile → 0 rows and `/no-access`; confirm `SUPABASE_SERVICE_ROLE_KEY` is absent from the client bundle (search `.next/static`) |
| Quality | `pnpm lint && pnpm typecheck && pnpm build`; Lighthouse run on `/dashboard`; mobile-width check |

Fix only P1/P2 defects. Anything else goes into `docs/KNOWN_LIMITATIONS.md` honestly.

---

## P10 — Deployment & documentation (Wed, 3 h, starts by 2 PM)

### Deployment
1. Confirm Supabase migrations pushed; run seed + demo data scripts against the project.
2. Merge `develop` → `main`; Vercel auto-deploys. Verify env vars in Production.
3. **Smoke test on the live URL** (logged-out redirect, each role's login, create/read/update in each module, dashboard renders, targets locked state).
4. Tag `v1.0.0`.

### Repository polish
`README.md`: what it is, architecture summary, tech stack, setup in ≤10 steps, env table, scripts, demo credentials (demo users only), live URL, scope cuts. Plus `docs/ASSUMPTIONS.md`, `docs/CACHING.md`, `docs/KNOWN_LIMITATIONS.md`, `ARCHITECURE.md`, `PHASES.md`, `IMPLEMENTATION_PLAN.md`.

### Architecture PDF (target: 45 min)
Render `ARCHITECURE.md` to PDF (VS Code "Markdown PDF"/Mermaid preview, or `pandoc` with a Mermaid filter). Check that every diagram renders, add a cover page (title, author, date), and an appendix with the requirements-traceability table (requirement → module → table). Export as `PSE_Architecture.pdf`.

### Google Drive
Create folder `PSE Dashboard – Assessment/` with subfolders:
```
01_Requirements_Analysis   02_Architecture (PDF)   03_Database (ERD, dictionary)
04_User_Guide              05_Technical_Docs        06_Testing (results, screenshots)
07_Migration (importer design, mapping template)   08_Project_Management (PHASES, plan)
00_INDEX (doc with all links: GitHub, Vercel, Drive, PDF)
```
Set sharing to "Anyone with the link — viewer" and open each link in a private window. (The Drive connector is not authorized in this session, so this is a manual upload unless you authorize it.)
Write the **user guide** (2–3 pages with screenshots): roles, creating contacts/deals, receipts, activities, targets, reading each dashboard lens, KPI definitions.

---

## P11 — Submission (Wed, by 8 PM; hard stop 10:30 PM)

Checklist (tick every line before sending):
- [ ] Vercel URL loads in a private window; demo login works
- [ ] GitHub repo URL accessible to reviewers; README complete; `main` is the deployed code
- [ ] Architecture PDF opens, diagrams visible
- [ ] Drive folder shared and every link verified logged-out
- [ ] Assumptions + known limitations listed
- [ ] Email drafted: URLs (Vercel, GitHub, Drive, PDF), demo credentials, short summary of what is built vs designed-not-built

---

## Timeline at a glance

| Day | Time | Work |
|---|---|---|
| Mon 26 | evening | P0, P1, deploy "hello" |
| Mon 26 | night | P2 database + auth (gate at midnight) |
| Tue 27 | 9:00–11:30 | P3 Contacts |
| Tue 27 | 11:30–15:00 | P4 Pipelines + receipts |
| Tue 27 | 15:00–18:00 | P5 Meetings + Activities |
| Tue 27 | 19:00–21:30 | P6 Targets (**Day-2 gate: full entry flow works**) |
| Wed 28 | 9:00–13:00 | P7 Dashboards |
| Wed 28 | 13:00–14:30 | P8 Caching + measurements |
| Wed 28 | 14:30–16:00 | P9 Tests & hardening |
| Wed 28 | 16:00–19:30 | P10 Deploy, PDF, Drive, README |
| Wed 28 | **by 20:00** | P11 Submit |
| Wed 28 | 20:00–23:59 | Buffer — fixes only |

## Slip protocol
- **Behind by ≤1 h at a gate:** drop the lowest-priority cut item and continue.
- **Behind by >2 h at the Day-2 gate:** cut Activities filters beyond type/owner, skip board view (list only), and build the Monetary lens fully before the Non-monetary lens.
- **Never cut:** RLS and DB invariants, receipts-based achievement, Targets lock, tagged caching with invalidation, live deployment, Architecture PDF, Drive folder.
- **Order of safety:** a smaller *working, deployed* system with accurate docs beats a larger broken one. At every gate, `main` must be deployable.
