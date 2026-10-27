# PSE Dashboard — Agent Guide

CRM and performance dashboard for the Private Sector Engagement (PSE) team: Contacts → Pipelines (money only) → Meetings → Activities, plus Targets and a two-lens Dashboard (monetary / non-monetary). Modular monolith on Next.js App Router + Supabase Postgres, deployed on Vercel.

Deadline: Wed 28 Oct 2026, 11:59 PM (submit by 8 PM). Progress and phase status live in [MEMORY.md](MEMORY.md); the build order is in [PHASES.md](PHASES.md).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Read first

| File | Why |
|---|---|
| [MEMORY.md](MEMORY.md) | Phase tracker, what exists, demo credentials, hardening notes. Update it when a phase finishes. |
| [PHASES.md](PHASES.md) | Per-phase business rules and acceptance criteria (P7 Dashboard, P8 Caching are next). |
| [ARCHITECURE.md](ARCHITECURE.md) | Architecture, invariants, cache-tag table (§10.3). The filename is misspelled on purpose; don't rename it. |
| [DESIGN.md](DESIGN.md) | Design system. Hard bans are enforced in CI. |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | Decisions taken where requirements were open. |

Where documents conflict, the later "major requirement changes" win (see IMPLEMENTATION_PLAN.md Part A).

## Commands (npm only)

```
npm run dev            # next dev
npm run lint           # eslint, includes module-boundary rules
npm run lint:design    # bans gradients, blur, pulse/ping, shadow-lg+
npm run typecheck
npm test               # vitest
npm run db:push        # apply new supabase/migrations/*.sql (ledgered, once each) + reference seed
npm run db:seed        # demo users and data
npm run db:test        # DB invariant + RLS tests against the live DATABASE_URL
npm run build
```

Before calling a phase done, all of lint, lint:design, typecheck, test, db:test and build must pass. Use `npm` (never pnpm/yarn); `.npmrc` sets `legacy-peer-deps=true`.

## Architecture rules

```
src/app            routing only; thin pages compose modules
src/modules/<name> schema.ts · repository.ts · service.ts · actions.ts · queries.ts · components/ · index.ts
src/shared         ui/ and lib/{supabase,cache,rbac,money,periods,phone}
src/types          database.ts (hand-maintained to match migrations)
```

- Dependency direction: `app → modules → shared → types`. Enforced by `eslint-plugin-boundaries`.
- Other modules are imported only through `@/modules/<name>` (its `index.ts`), never deep paths.
- `schema.ts`: zod, the single validation source for client and server.
- `service.ts`: pure business rules, no framework or DB imports. Unit-test it (`<module>.test.ts`).
- `repository.ts`: the only place that talks to the database, with parameterised SQL (`pg`, no ORM). Never build SQL from user input.
- `actions.ts` (`'use server'`): authenticate/authorise → zod parse → service → repository → `invalidateTags(...)` + `revalidatePath(...)`. Return `{ status: 'success' | 'error' }` results; don't throw to the client.
- `queries.ts`: reads for pages. Call `requireUser()` before any cached read.
- Every new screen ships a matching `loading.tsx` using `shared/ui/skeletons`.

## Database and auth

- Connection is `DATABASE_URL` (Supabase Session Pooler, port 5432) through `pg`. No Supabase client SDK or API keys.
- Auth is `profiles` (scrypt hashes) plus an HS256 JWT cookie `pse_session` signed with `AUTH_SECRET` (32+ chars in production).
- User-scoped work goes through `withUserTransaction(userId, fn)`, which sets role `authenticated` and the user id so Postgres RLS applies. Use the owner pool (`queryDb`) only for login/session checks and for reads that run after `requireUser()`.
- Roles: `admin`, `target_manager`, `member`. All PSE members read all PSE data; writes are owner or admin; targets are admin/target_manager only. Non-PSE users get nothing.
- Invariants live in the database (CHECKs, triggers, RLS). The UI and service layers mirror them for good messages but are never the only guard.
- Schema changes are new numbered files in `supabase/migrations/` (next is `009`). Never edit an applied migration. `numeric` columns come back from `pg` as strings; cast with `::float8` or `::text` in SQL.
- `SECURITY DEFINER` functions bypass RLS, so they must check the caller's role themselves.

## Business rules that must not drift

- Pipelines exist only for expected money (`expected_amount > 0`). In-kind needs a value and a valuation note; small or unvalued items are Activities.
- Achievement = sum of `pipeline_receipts` in the period. Forecast and Won are not achievement. Activities and meetings never affect monetary figures.
- Reports group by stage `kind` (open/won/lost/junk), never by stage name. Vertical comes from `category_vertical_map`.
- Targets: annual → manual Q1–Q4 (sum = annual) → members (sum = quarter) → vertical % (= 100). Publish locks the plan; no revisions, no carry-forward. Month target is quarter ÷ 3 and labelled pro-rata.
- Contacts need at least one email or phone; duplicates are rejected on the normalised value (lowercase email, E.164 phone).
- Out of scope: Gmail sync, file uploads, external autofill, an Events module, follow-up KPI, target hierarchy.

## UI rules (DESIGN.md is authoritative)

- Flat, low-chroma, tokens only (`bg-background`, `text-muted-foreground`, `border-border`, ...). No raw hex, gradients, blur/glass, pulse/ping, `shadow-lg` or larger, emoji, fake status text, or placeholder data.
- All money goes through `<Money />` and all dates through `<DateText />` from `@/shared/ui`. Missing values render as `—`.
- Use shared wrappers (`Button`, `ButtonLink`, `Field`, `Input`, `Select`, `DataTable`, `Tag`, `Card`, `KpiTile`, `TargetBar`, `ConfirmDialog`, ...) instead of one-off styles. Navigation that looks like a button is `ButtonLink`, not `<Link><Button/></Link>`.
- No focus outline ring on click for inputs/buttons. Buttons and tags never wrap. Charts: max 4 series, no pie above 4 slices, no gauges.
- Copy is plain and specific; sentence case; no greetings or marketing text.

## Caching

Use `cached()` and `invalidateTags()` from `@/shared/lib/cache`; never import Next cache primitives elsewhere. Cache keys contain filters, never the viewer's identity, and authorisation happens before the cached call. Tags and the write→tag table are in ARCHITECURE.md §10.3.

## Git and safety

- Conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `test:`. `develop` for work, `main` is deployed.
- Never commit `.env` or secrets. `DATABASE_URL` and `AUTH_SECRET` are server-only, never `NEXT_PUBLIC_*`.
- `db:push`, `db:seed` and `db:test` hit the live Supabase database; migrations are forward-only.
- Demo accounts and their shared password are listed in MEMORY.md; they are fake and may appear in the README.
