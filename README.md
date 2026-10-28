# PSE Dashboard

CRM and performance dashboard for the Private Sector Engagement (PSE) team. It tracks donors and sponsors, expected and received money against targets, and all non-monetary work.

```
Contact ──► Pipeline (money only) ──► Meeting ──► Activity
```

- **Repository:** https://github.com/ashikulislamm/pse_dashboard
- **Live app:** add the Vercel URL here after deployment.

## Features

| Area | What it does |
|---|---|
| Contacts | Individuals and companies. At least one email or phone. Duplicates blocked on email and phone. Inline create from any form. |
| Pipelines | Money opportunities only (amount > 0). Cash or valued in-kind, stage history, Won/Lost confirmation, foreign currency converted to BDT, receipts. |
| Meetings | Linked to a contact or pipeline. Scheduled / done. One-click follow-up activity. |
| Activities | 11 types and 3 reporting classes. Replaces the Excel tracker. Never affects money figures. |
| Targets | Wizard: annual → Q1–Q4 → members → vertical %. Publishing locks the plan permanently. |
| Dashboard | Two lenses, **Monetary** and **Non-monetary**, by month, quarter or year, filtered by member and vertical. |
| Admin | Create users and manage roles, status and PSE access. |

Roles: `admin`, `target_manager`, `member`. All PSE members read all PSE data. Writes are owner or admin. Targets are admin/target_manager only. Non-PSE users see only a no-access page.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase Cloud Postgres (Session Pooler) via `pg`, parameterised SQL, no ORM |
| Auth | Postgres `profiles` with `scrypt`, HS256 JWT session cookie |
| Security | Postgres Row-Level Security, triggers and constraints |
| Forms and validation | react-hook-form, zod |
| Charts | Recharts |
| Caching | Tag-based server cache plus indexed SQL functions |
| Testing | Vitest, SQL invariant tests, Playwright |
| CI and hosting | GitHub Actions, Vercel |

## Architecture in brief

- **One Next.js app** on Vercel. Server code lives in each module; there is no separate backend.
- **Modules** under `src/modules/<name>`: `auth`, `contacts`, `pipelines`, `meetings`, `activities`, `targets`, `dashboard`, `admin`. Each has `schema.ts`, `service.ts`, `repository.ts`, `actions.ts`, `queries.ts`, `components/` and `index.ts`.
- **Dependency direction:** `app → modules → shared → types`. Modules import each other only through `index.ts`. ESLint enforces this.
- **Rules live in the database.** Constraints, triggers and RLS enforce the business rules, so a UI bug cannot break them.
- **Every user-scoped query** runs in a transaction as role `authenticated`, so RLS decides who reads and writes.
- **Caching:** dashboard reads are cached by filters and invalidated by tag on every write. Authorisation always runs before a cached read.

```
src/
├─ app/       routing only
├─ modules/   feature modules
├─ shared/    ui, lib (supabase, cache, rbac, money, periods, phone)
└─ types/
supabase/     migrations and reference seed
scripts/      db push, seed, tests, benchmark, checks
e2e/          Playwright tests
docs/         full documentation
```

## Getting started

### Prerequisites

- Node.js 22
- npm (do not use pnpm or yarn)
- A Supabase project. Copy the **Session Pooler** connection string from Project Settings → Database.

### Setup

```bash
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# edit .env: set DATABASE_URL and AUTH_SECRET
npm run db:push             # apply migrations (each runs once) + reference seed
npm run db:seed             # demo users and sample data
npm run dev                 # http://localhost:3000
```

Generate a secret for `AUTH_SECRET` with `openssl rand -base64 48`.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Supabase Session Pooler connection string (port 5432) |
| `AUTH_SECRET` | yes in production | Random string, 32+ characters, signs session cookies. Local dev falls back to a dev-only value |
| `DATABASE_CA_CERT` | no | PEM contents of the Supabase CA, to verify the database TLS chain |
| `DATABASE_POOL_MAX` | no | Max connections per server instance (default 3) |
| `NEXT_PUBLIC_APP_URL` | no | Public app URL |

`DATABASE_URL` and `AUTH_SECRET` are server-only. Never prefix them with `NEXT_PUBLIC_` and never commit `.env`.

## Demo accounts

All demo accounts use the password `Password123!`. The login page can fill them in with one click.

| Email | Role | Try |
|---|---|---|
| `admin@pse.org` | admin | Everything, plus `/admin` |
| `safina@pse.org` | target_manager | Target wizard (open `/targets?year=2027`; 2026 is already published) |
| `rahim@pse.org`, `karim@pse.org`, `nadia@pse.org` | member | Create and edit own records |
| `external@otherdept.org` | non-PSE | No-access page, no data |

Five failed sign-ins for the same email lock that email for 15 minutes.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint, including module-boundary rules |
| `npm run lint:design` | Fails on gradients, blur, pulse/ping and large shadows |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run db:push` | Apply new migrations and the reference seed |
| `npm run db:seed` | Load demo users and data |
| `npm run db:test` | Database invariant and RLS tests (live database) |
| `npm run db:bench` | Dashboard benchmark, rolled back after the run |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run check:security` | Check the client bundle for leaked secrets |

Before merging, `lint`, `lint:design`, `typecheck`, `test`, `db:test` and `build` must pass.

`db:push`, `db:seed` and `db:test` run against the database in `DATABASE_URL`. Migrations are forward-only: add a new numbered file in `supabase/migrations/` (next is `011`) and never edit an applied one.

## Deploying

1. Push to GitHub and import the repo in Vercel (`main` is deployed).
2. Set `DATABASE_URL` and `AUTH_SECRET` for Production and Preview.
3. Run `npm run db:push` and `npm run db:seed` against the database.
4. Smoke test: logged-out redirect to `/login`, each role, dashboard, locked 2026 targets.

Full runbook: [docs/05_Technical_Docs.md](docs/05_Technical_Docs.md).

## Scope

**Built:** auth and roles, contacts, pipelines with receipts, meetings, activities, targets wizard and lock, two-lens dashboard, tagged caching.

**Designed, not built:** Odoo CSV importer, admin editing of reference tables (use SQL), drag-and-drop pipeline board, count targets, follow-up KPI, target hierarchy.

**Out of scope by design:** Gmail sync, file uploads (paste Google Drive links in notes), external autofill, a standalone Events module.

## Documentation

| Document | Content |
|---|---|
| [docs/01_Requirement_Analysis.md](docs/01_Requirement_Analysis.md) | Requirements, rules, assumptions |
| [docs/02_Architecture_and_Database.md](docs/02_Architecture_and_Database.md) | Architecture, schema, security, caching design |
| [docs/04_User_Guide.md](docs/04_User_Guide.md) | How to use each module and read the dashboard |
| [docs/05_Technical_Docs.md](docs/05_Technical_Docs.md) | Setup, deployment, caching tags, testing, limitations |
| [docs/06_Project_Management.md](docs/06_Project_Management.md) | Plan and phase status |
| [DESIGN.md](DESIGN.md) | Design system and enforced UI rules |
