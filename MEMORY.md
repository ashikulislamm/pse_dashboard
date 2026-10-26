# PSE Dashboard — Project Memory & Progress Log

Last updated: 2026-10-26 (after completing Phase 0 and Phase 1)

---

## 1. Project Context & Key Overrides

- **Goal:** Build the Private Sector Engagement (PSE) CRM & Performance Dashboard (modular monolith on Next.js App Router + Supabase Postgres/Auth/RLS + Vercel).
- **Hard Deadline:** Wednesday, 28 Oct 2026, 11:59 PM (target submission by 8:00 PM).
- **Package Manager Override:** Although `PHASES.md` and `IMPLEMENTATION_PLAN.md` mention `pnpm`, **this project uses `npm`** (`package-lock.json`, `npm run ...`, `npm ci` in GitHub Actions).
- **Strict Design System (`DESIGN.md`):**
  - Flat, low-chroma CSS variables in `src/app/globals.css` (`:root` and `.dark`), `Inter` typeface (`tabular-nums` on all numbers/dates).
  - Hard bans enforced by `npm run lint:design` (`scripts/check-design-bans.mjs`): no gradients, blur/glassmorphism, pulsing/pinging animations, or `shadow-lg/xl/2xl`.
  - All money and dates MUST be formatted exclusively through `<Money />` (`formatMoney`) and `<DateText />` (`formatDateText`) from `@/shared/ui`.
- **Architecture Boundaries (`ARCHITECURE.md`):**
  - Enforced by `eslint-plugin-boundaries` and `no-restricted-imports` in `eslint.config.mjs`.
  - Direction: `src/app → src/modules/<name> → src/shared → src/types`.
  - Only `**/repository.ts`, `src/shared/lib/supabase/**`, and `src/shared/lib/rbac/**` may import Supabase clients.
  - `src/modules/**/service.ts` must remain framework-free (no `react`, `next`, or `@supabase/*` imports).

---

## 2. Phase Tracker

| Phase | Description | Status | Notes |
|---|---|---|---|
| **P0** | Lock decisions & scope (`docs/ASSUMPTIONS.md`, `docs/00-scope-and-assumptions.md`) | **Completed** | All 10 ambiguity defaults and in/out-of-scope rules documented. |
| **P1** | Project initialization, infra, shared helpers & design system setup | **Completed** | Next.js 16.4.3, Tailwind v4, module skeleton, shared libs, shared UI, ESLint boundaries, 16 unit tests passing, production build verified. |
| **P2** | Database migrations (`001`–`006`), seed scripts, Auth, RBAC, AppShell | **Pending (Next)** | SQL schema, triggers, RLS policies, `/login`, `middleware.ts`, `/no-access`, DB invariant tests. |
| **P3** | Contacts module & `ContactPicker` | Pending | Individual/Company form, channel repeater, E.164/email dedupe, inline create. |
| **P4** | Pipelines & Receipts module | Pending | Expected value > 0, Cash/In-kind valuation note, stage history, receipts = achievement. |
| **P5** | Meetings & Activities modules | Pending | Meetings (`contact_id` OR `pipeline_id`), Activities (11 types, 3 classes). |
| **P6** | Targets wizard & lock | Pending | Annual → Q1–Q4 → Members → Verticals (%), largest-remainder rounding, DB lock trigger. |
| **P7** | Two-lens Dashboard & SQL read functions (`007`) | Pending | Monetary & Non-monetary lenses, Monthly (pro-rata) / Quarterly / Annual views. |
| **P8** | Tagged server caching & performance benchmark | Pending | `cached()` + `invalidateTags()`, benchmark on seeded dataset (`docs/CACHING.md`). |
| **P9** | Testing & hardening | Pending | Unit, DB invariant tests, Playwright E2E happy path, security & a11y checks. |
| **P10** | Deployment & documentation | Pending | Prod Supabase + Vercel deploy, `PSE_Architecture.pdf`, Google Drive pack, `README.md`. |
| **P11** | Final submission | Pending | Pre-submission checklist verification. |

---

## 3. What Exists in the Codebase (P0 & P1)

### Documentation & Config
- `docs/ASSUMPTIONS.md` & `docs/00-scope-and-assumptions.md` — Scope statement and locked decisions.
- `eslint.config.mjs` — Next.js + TypeScript + `eslint-plugin-boundaries` + `no-restricted-imports`.
- `scripts/check-design-bans.mjs` — Scans `src/` for banned Tailwind classes (`DESIGN.md` §2 & §13.2).
- `vitest.config.ts` — Vitest configuration with `@/*` path alias.
- `.github/workflows/ci.yml` — GitHub Actions workflow (`npm ci`, `lint`, `lint:design`, `typecheck`, `test`, `build`).
- `.env.example` & `supabase/config.toml` — Environment template and Supabase CLI config.

### Database Types
- `src/types/database.ts` — Full TypeScript definitions for all tables (`teams`, `profiles`, `settings`, `currencies`, `fx_rates`, `pipeline_stages`, `contribution_categories`, `verticals`, `category_vertical_map`, `contacts`, `contact_channels`, `pipelines`, `pipeline_stage_history`, `pipeline_receipts`, `meetings`, `activities`, `target_plans`, `target_quarters`, `target_lines`), enums (`AppRole`, `ContactType`, `ChannelKind`, `StageKind`, `ContributionType`, `PartyType`, `PaymentInterval`, `MeetingStatus`, `ActivityType`, `ActivityClass`, `ActivityStatus`), and functions.

### Shared Libraries (`src/shared/lib/`)
- `src/shared/lib/supabase/{client,server,admin,index}.ts`
  - `createSupabaseBrowserClient()` — Browser client (`@supabase/ssr`).
  - `createSupabaseServerClient()` — Cookie-aware Server Component / Server Action client.
  - `createSupabaseAdminClient()` — Server-only (`import 'server-only'`) service-role client for cached queries after `requireUser()`.
- `src/shared/lib/cache/index.ts`
  - `CACHE_TAGS` (`dashboard`, `pipelines`, `receipts`, `meetings`, `activities`, `targets`, `config`, `contacts`).
  - `cached(fn, keyParts, tags, revalidate=300)` & `invalidateTags(...tags)`.
- `src/shared/lib/rbac/index.ts`
  - `requireUser()` — Authenticates user and checks `profile.is_pse && profile.is_active` (redirects to `/login` or `/no-access`).
  - `requireRole(...allowedRoles)` — Verifies role (`admin`, `target_manager`, `member`), throws `AuthorizationError` if unauthorized.
- `src/shared/lib/phone/index.ts` (re-exported at `src/shared/lib/phone.ts`)
  - `normalizePhone(raw, defaultCountry='BD')` — E.164 normalization via `libphonenumber-js`.
  - `normalizeEmail(raw)` — Trim + lowercase + format check.
  - Tested in `src/shared/lib/phone/phone.test.ts`.
- `src/shared/lib/money/index.ts` (re-exported at `src/shared/lib/money.ts`)
  - `roundCurrency(value)`, `toBase(amount, currency, fxRate)`, `allocateByPercent(total, percents[])` (Largest Remainder Method with 0.00 drift).
  - Tested in `src/shared/lib/money/money.test.ts`.
- `src/shared/lib/periods/index.ts` (re-exported at `src/shared/lib/periods.ts`)
  - `periodRange({ type, year, index, fiscalStartMonth })` & `quarterOf(date, fiscalStartMonth)`.
  - Tested in `src/shared/lib/periods/periods.test.ts`.

### Shared UI Wrappers (`src/shared/ui/`)
- `src/shared/ui/money.tsx` — `<Money />` and `formatMoney()` (`৳ 1,250,000` for BDT; `USD 5,000 (৳ 600,000)` when `baseAmount` supplied; `—` when null).
- `src/shared/ui/date-text.tsx` — `<DateText />` and `formatDateText()` (`26 Oct 2026` or `26 Oct 2026, 3:30 PM`).
- `src/shared/ui/primitives.tsx` — `Button`, `Input`, `Select`, `Textarea`, `AutoLinkedNotes` (safe Drive URL auto-linker), `Field`, `FormSection`, `Tag`, `Skeleton`, `EmptyState`, `PageHeader`, `Card`.
- `src/shared/ui/data-viz.tsx` — `KpiTile`, `TargetBar`, `BarChart`, `LineChart`.
- `src/shared/ui/interactive.tsx` — `FilterBar`, `ConfirmDialog`, `Combobox`, `DatePicker`, `DataTable`, `AppShell`.

### Module & Route Skeletons
- `src/modules/{auth,contacts,pipelines,meetings,activities,targets,dashboard,admin}/` — Each initialized with stub `schema.ts`, `repository.ts`, `service.ts`, `actions.ts`, `queries.ts`, `components/index.ts`, and `index.ts`.
- `src/app/` — Root layout (`Inter` + `globals.css`), `(auth)/login`, and `(app)/{dashboard,contacts,pipelines,meetings,activities,targets,admin}` shells.

---

## 4. Verification Commands

Run these before completing any phase:
```powershell
npm run lint
npm run lint:design
npm run typecheck
npm test
npm run build
```
