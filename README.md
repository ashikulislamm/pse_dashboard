# PSE Dashboard

Modular CRM and performance dashboard for Private Sector Engagement: contacts, pipelines, meetings, activities, and target-vs-achievement tracking. Built with Next.js and Supabase Postgres.

## Architecture in brief

- **Full-stack Next.js (App Router)** on Vercel. Server code lives in each module's `actions.ts`, `service.ts` and `repository.ts`; there is no separate backend project.
- **Supabase Cloud Postgres** reached through the Session Pooler URI (`DATABASE_URL`) with `pg` and typed, parameterized SQL.
- **Auth:** Postgres `profiles` (`scrypt` password hashes) with HS256 JWT session cookies. Every user-scoped query runs in a transaction as role `authenticated`, so Postgres Row-Level Security enforces who can read and write.
- **Modules:** `auth`, `contacts`, `pipelines`, `meetings`, `activities`, `targets`, `dashboard`, `admin` under `src/modules/<name>`. Modules are imported only through their `index.ts` (enforced by ESLint).
- Details: [ARCHITECURE.md](ARCHITECURE.md), [DESIGN.md](DESIGN.md), [PHASES.md](PHASES.md), [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md).

## Setup

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and AUTH_SECRET
npm run db:push             # apply migrations (each runs once) + reference seed
npm run db:seed             # demo users and sample data
npm run dev                 # http://localhost:3000
```

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Supabase Session Pooler connection string |
| `AUTH_SECRET` | yes in production | Random string, 32+ characters, signs session cookies |
| `DATABASE_CA_CERT` | no | PEM contents of the Supabase CA, to verify the database TLS chain |
| `DATABASE_POOL_MAX` | no | Max connections per server instance (default 3) |
| `NEXT_PUBLIC_APP_URL` | no | Public app URL |

## Demo accounts

All demo accounts use the password `Password123!`.

| Email | Role |
|---|---|
| `admin@pse.org` | admin |
| `safina@pse.org` | target_manager |
| `rahim@pse.org`, `karim@pse.org`, `nadia@pse.org` | member |
| `external@otherdept.org` | non-PSE user (sees the no-access page) |

Five failed sign-ins for the same email lock that email for 15 minutes.

## Scripts

| Command | What it does |
|---|---|
| `npm run lint` / `lint:design` | ESLint with module-boundary rules / design-system ban check |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run db:push` / `db:seed` / `db:test` | Apply migrations / load demo data / run database invariant tests |
| `npm run build` | Production build |

## Scope

Built: auth and roles, contacts, pipelines with receipts, meetings, activities. Planned next: targets, dashboards, caching. Not in scope by design: Gmail sync, file uploads, external autofill, a standalone Events module.
