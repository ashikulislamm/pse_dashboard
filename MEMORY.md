# PSE Dashboard — Project Memory & Progress Log

Last updated: 2026-10-27 (after completing Phase 0, Phase 1, and Phase 2)

---

## 1. Project Context & Key Overrides

- **Goal:** Build the Private Sector Engagement (PSE) CRM & Performance Dashboard (modular monolith on Next.js App Router + Supabase Cloud Postgres/RLS + Vercel).
- **Hard Deadline:** Wednesday, 28 Oct 2026, 11:59 PM (target submission by 8:00 PM).
- **Package Manager Override:** Uses **`npm`** (`package-lock.json`, `npm run ...`, `npm ci` in GitHub Actions).
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
| **P4** | Pipelines & Receipts module | **Pending (Next)** | Expected value > 0, Cash/In-kind valuation note, stage history, receipts = achievement. |
| **P5** | Meetings & Activities modules | Pending | Meetings (`contact_id` OR `pipeline_id`), Activities (11 types, 3 classes). |
| **P6** | Targets wizard & lock | Pending | Annual → Q1–Q4 → Members → Verticals (%), largest-remainder rounding, DB lock trigger. |
| **P7** | Two-lens Dashboard & SQL read functions (`007`) | Pending | Monetary & Non-monetary lenses, Monthly (pro-rata) / Quarterly / Annual views. |
| **P8** | Tagged server caching & performance benchmark | Pending | `cached()` + `invalidateTags()`, benchmark on seeded dataset (`docs/CACHING.md`). |
| **P9** | Testing & hardening | Pending | Unit, DB invariant tests, Playwright E2E happy path, security & a11y checks. |
| **P10** | Deployment & documentation | Pending | Prod Supabase + Vercel deploy, `PSE_Architecture.pdf`, Google Drive pack, `README.md`. |
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

## 4. What Exists in the Codebase (P0, P1 & P2)

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

---

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
