# 05 · Technical Docs

Setup, configuration, deployment, caching, testing, security and known limitations.

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React, TypeScript strict |
| Styling | Tailwind CSS v4, shared wrappers in `src/shared/ui` |
| Database | Supabase Cloud Postgres, Session Pooler, `pg` with parameterised SQL |
| Auth | `profiles` with scrypt, HS256 JWT cookie `pse_session` |
| Validation | zod |
| Tests | Vitest, SQL tests (`scripts/db-tests.mjs`), Playwright |
| CI | GitHub Actions, Node 22, `npm ci` |
| Hosting | Vercel |

> This Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before using a Next API.

## 2. Local setup

```bash
npm install
cp .env.example .env     # fill in DATABASE_URL and AUTH_SECRET
npm run db:push          # apply migrations (each once) + reference seed
npm run db:seed          # demo users and sample data
npm run dev              # http://localhost:3000
```

Use `npm` only. `.npmrc` sets `legacy-peer-deps=true`.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Supabase Session Pooler URI, port 5432 |
| `AUTH_SECRET` | yes in production | Random string, 32+ chars, signs session cookies. No default in production |
| `DATABASE_CA_CERT` | no | PEM of the Supabase CA for full TLS verification |
| `DATABASE_POOL_MAX` | no | Max connections per instance (default 3) |
| `NEXT_PUBLIC_APP_URL` | no | Public app URL |

`DATABASE_URL` and `AUTH_SECRET` are server-only. Never prefix them with `NEXT_PUBLIC_`. Never commit `.env`. Generate a secret with `openssl rand -base64 48`.

## 3. Commands

| Command | Purpose |
|---|---|
| `npm run dev` / `build` | Dev server / production build |
| `npm run lint` | ESLint including module-boundary rules |
| `npm run lint:design` | Bans gradients, blur, pulse/ping, `shadow-lg` or larger |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run db:push` | Apply new migrations (ledgered) + reference seed |
| `npm run db:seed` | Demo users and data |
| `npm run db:test` | DB invariant, trigger, function and RLS tests (live DB) |
| `npm run db:bench` | Dashboard benchmark in a rolled-back transaction |
| `npm run test:e2e` | Playwright happy path and security suite |
| `npm run check:security` | Scans `.next/static` for secret leaks; checks auth gating on cached queries |

Before calling any phase done, `lint`, `lint:design`, `typecheck`, `test`, `db:test` and `build` must all pass.

`db:push`, `db:seed` and `db:test` hit the live database.

## 4. Database operations

- Add a numbered file in `supabase/migrations/` (next is `011`). Never edit an applied one.
- `db:push` records applied files in `schema_migrations` and runs each once, in a transaction. The reference seed runs every time.
- `numeric` columns return from `pg` as strings. Cast with `::float8` or `::text` in SQL.
- Reference data (stages, categories, FX) is changed through idempotent SQL or `supabase/seed.sql`. After a change, invalidate the `config` cache tag by redeploying, or wait for the 5-minute TTL.
- Example, add an FX rate:

```sql
INSERT INTO fx_rates (currency, rate_to_base, effective_from)
VALUES ('USD', 122.00, CURRENT_DATE);
```

## 5. Deployment runbook

**Vercel**
1. Import the GitHub repo. Vercel deploys `main`.
2. Set `DATABASE_URL`, `AUTH_SECRET` (32+ chars) and optionally `NEXT_PUBLIC_APP_URL` for Production and Preview.
3. Use different secrets for Preview and Production.

**Supabase**
1. Copy the Session Pooler string (Project Settings → Database).
2. Run `npm run db:push`, then `npm run db:seed` for demo data.

**Smoke test on the live URL**
- Logged out: protected routes redirect to `/login`.
- Sign in as admin, target manager, member and non-PSE (no-access page).
- Create and read in each module.
- Dashboard renders both lenses. The published 2026 plan shows as locked.

**Release:** merge `develop` into `main`, tag `v1.0.0`. The repo's current local branch is `master`; align branch names with the CI triggers (`main`, `master`, `develop`) before release.

> Public demo accounts can be locked for 15 minutes by five failed sign-ins. Warn evaluators.

## 6. Caching

Layers are described in `02_Architecture_and_Database.md` §8. Rules:

1. Import cache primitives only through `@/shared/lib/cache`.
2. Call `requireUser()` or `requireRole()` before every cached read.
3. Cache keys contain filters, never viewer identity.
4. Every write action calls `invalidateTags(...)` and `revalidatePath(...)`.

### Cached reads

| Module | Loader | Filter args in key | Tags |
|---|---|---|---|
| dashboard | `loadFiscalStart`, `loadFilterOptions`, `loadNameLookup` | none | `config` |
| dashboard | `loadMonetary` | period, year, index, fiscalStart, member, vertical | `dashboard`, `receipts`, `pipelines`, `targets`, `config` |
| dashboard | `loadNonMonetary` | period, year, index, fiscalStart, member | `dashboard`, `meetings`, `activities`, `contacts`, `pipelines`, `config` |
| pipelines | `loadPipelineReferenceData` | none | `config` |
| auth | `loadActivePseTeamMembers`, `loadReferenceConfigSummary` | none | `config` |

All use a 300 s fallback TTL.

### Write → tag table

| Write | Action | Tags invalidated | Paths revalidated |
|---|---|---|---|
| Contact create / update | `createContactAction`, `updateContactAction` | `contacts`, `dashboard` | `/contacts`, `/contacts/[id]` |
| Pipeline create | `createPipelineAction` | `pipelines`, `dashboard`, `contacts` | `/pipelines`, `/contacts/[id]`, `/dashboard` |
| Pipeline update | `updatePipelineAction` | `pipelines`, `receipts`, `dashboard`, `contacts` | `/pipelines`, `/pipelines/[id]`, `/contacts/[id]`, `/dashboard` |
| Stage change | `changePipelineStageAction` | `pipelines`, `dashboard` | `/pipelines`, `/pipelines/[id]`, `/dashboard` |
| Receipt | `recordPipelineReceiptAction` | `receipts`, `pipelines`, `dashboard` | `/pipelines`, `/pipelines/[id]`, `/dashboard` |
| Meeting create / edit | `createMeetingAction`, `updateMeetingAction` | `meetings`, `dashboard`, `contacts`, `pipelines` | `/meetings`, `/contacts/[id]`, `/pipelines/[id]`, `/dashboard` |
| Meeting status | `updateMeetingStatusAction` | `meetings`, `dashboard` | `/meetings`, `/dashboard` |
| Activity create / edit | `createActivityAction`, `updateActivityAction` | `activities`, `dashboard`, `contacts`, `pipelines`, `meetings` | `/activities`, `/meetings`, `/contacts/[id]`, `/pipelines/[id]`, `/dashboard` |
| Activity status | `updateActivityStatusAction` | `activities`, `dashboard` | `/activities`, `/dashboard` |
| Target draft / publish / discard | `saveTargetDraftAction`, `publishTargetPlanAction`, `discardTargetDraftAction` | `targets`, `dashboard` | `/targets`, `/dashboard` |
| Admin user create / role change | `createUserAction`, `updateUserRoleAction` | `config`, `dashboard` | `/admin`, `/dashboard` |

## 7. Performance results

Reproduce with `npm run db:bench`. It runs in `BEGIN … ROLLBACK`, so demo data is untouched.

Dataset: 10,004 contacts, 5,002 pipelines, 3,001 receipts, 5,001 meetings, 20,001 activities.

| Scenario | p50 (ms) | p95 (ms) |
|---|---:|---:|
| Before `010`, unbatched, cold (14 queries over a `max=3` pool) | 1,790 | 1,940 |
| After `010`, batched, cold (one round trip per lens, remote pooler) | 391.09 | 395.45 |
| Pure Postgres time, all dashboard functions | 38.22 | — |
| Warm tagged cache hit | 0.01 | 0.04 |

The warm target of 300 ms is met by a wide margin.

What changed in `010`:
- Timestamp filters `col::date BETWEEN …` (not index-friendly) became `col >= p_start::timestamptz AND col < (p_end + 1)::timestamptz`.
- Added covering and partial indexes on receipts, pipelines (created and won), meetings and activities.
- `fn_member_workload` and `fn_trend` use single-pass CTEs instead of correlated subqueries.
- The repository sends each lens as one SQL statement (`fetchMonetaryRaw`, `fetchNonMonetaryRaw`).

Invalidation was verified in `cache.test.ts` and in the benchmark: a recorded 250,000 BDT receipt plus `invalidateTags` changed the next read from 34,226,000 to 34,476,000 BDT.

## 8. Testing

| Level | Tooling | Covers |
|---|---|---|
| Unit | Vitest, 87 tests in 12 files | Phone and email normalisation, `allocateByPercent`, period math, activity default class, FX, target validation, dashboard assembly, password and JWT, RBAC, cache |
| Database | `npm run db:test`, 17 suites | Dedupe, channel minimum, CHECKs, lock trigger, totals, RLS for PSE vs non-PSE, column revoke, owner guard, stage trigger and audit, SQL function checks against a rolled-back fixture |
| E2E | Playwright, `e2e/happy-path.spec.ts` | Non-PSE restriction; member flow (duplicate blocked → contact → inline company → pipeline → Won → receipt → dashboard → mobile drawer); target manager wizard, publish and lock |
| Security | `npm run check:security` | No `DATABASE_URL`, `AUTH_SECRET` or Postgres URI in `.next/static`; auth gating on every cached query file |

Defects found and fixed in the hardening pass:
- `ContactForm` in compact mode rendered a nested `<form>`, so "Save contact" submitted the outer form. It now renders a `<div>` with `type="button"`.
- Concurrent `client.query` calls on one `PoolClient` (a `pg@9` deprecation) were made sequential in the contacts and pipelines repositories.

Not run in CI: `db:test`, `test:e2e` and `check:security` need the live database.

## 9. Security notes

- Parameterised SQL only. Never build SQL from user input.
- Pool is cached on `globalThis` (default max 3). Dashboard lens queries are batched so cold misses do not queue on the pool.
- `SECURITY DEFINER` functions check the caller's role.
- Password hashes are not readable by the `authenticated` role.
- Login for unknown emails verifies against a dummy hash, so timing does not reveal valid emails.
- Notes are rendered as escaped text. Only URLs become links, with `rel="noopener noreferrer"`.

## 10. Known limitations

| # | Limitation | Reason |
|---|---|---|
| 1 | No Gmail sync | Out of scope; log emails as activities |
| 2 | No file uploads | Documents live in Drive; paste links |
| 3 | No external autofill | Internal records only |
| 4 | No Events module | Activity types cover events, campaigns, visits |
| 5 | Odoo importer not built | Waiting on PSE field mapping (`07_Migration.md`) |
| 6 | Board has no drag-and-drop | Stage selector is keyboard-accessible |
| 7 | Reference tables edited by SQL | Admin screen is read-only for them |
| 8 | Monthly target rounding can drift 0.01–0.02 | Each member × vertical line is rounded to 2 dp |
| 9 | Pipeline dashboard tiles do not drill down | Dashboard counts by created and won date; the list filters by expected close |
| 10 | Lead KPI formula pending PSE | One function to change: `fn_lead_count` |
| 11 | FX rates are manual | No live rate feed |
| 12 | Demo email lockout is possible | Public demo addresses plus 5-failure lockout |

## 11. Conventions

- Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`. `develop` for work, `main` is deployed.
- Every new screen ships a matching `loading.tsx` using `shared/ui/skeletons`.
- Money goes through `<Money />`, dates through `<DateText />`. Missing values render as `—`.
- Design rules are in `DESIGN.md`.

## 12. Source map

| Path | Content |
|---|---|
| `src/proxy.ts` | Route guard |
| `src/modules/*` | Feature modules |
| `src/shared/lib/{supabase,cache,rbac,money,periods,phone}` | Shared infrastructure |
| `src/shared/ui` | Shared components and skeletons |
| `supabase/migrations`, `supabase/seed.sql` | Schema and reference data |
| `scripts/` | `db-push`, `seed-demo`, `db-tests`, `benchmark-dashboard`, `check-design-bans`, `check-security` |
| `e2e/`, `playwright.config.ts` | End-to-end tests |
| `.github/workflows/ci.yml` | CI |
