# 08 · Project Management

Implementation plan and phase record for the PSE Dashboard.

**Deadline:** Wednesday 28 Oct 2026, 11:59 PM. Target submission 8:00 PM; never later than 10:30 PM. The last hours are a safety buffer for deployment problems.

## 1. Plan summary

The original plan assumed about 15 working days. The real window was about 2.5 days, so the plan was compressed. Anything unfinished at a gate was cut, not rushed.

**Built:** auth and roles, Contacts, Pipelines (stages, history, receipts), Meetings, Activities, Targets (wizard and lock), two-lens Dashboard, tagged caching, hardening, admin users screen.
**Designed, not built:** Odoo importer, admin CRUD for reference tables, Kanban drag-and-drop, count targets, follow-up KPI, target hierarchy.
**Excluded by requirement:** Gmail sync, uploads, external autofill, Events module.

Principles:
- A smaller working, deployed system with accurate docs beats a larger broken one.
- `main` must be deployable at every gate.
- Never cut: RLS and DB invariants, receipts-based achievement, target lock, tagged caching with invalidation, live deployment, documentation.

## 2. Phase status

| Phase | Scope | Status |
|---|---|---|
| P0 | Lock decisions and scope | Done |
| P1 | Init, infrastructure, shared helpers, design system | Done |
| P2 | Migrations 001–006, seed, auth, RBAC, app shell | Done |
| P3 | Contacts and `ContactPicker` | Done |
| P4 | Pipelines and receipts | Done |
| P5 | Meetings and Activities | Done |
| P6 | Targets wizard and lock | Done |
| P7 | Two-lens Dashboard and SQL read functions (009) | Done |
| P8 | Tagged caching and benchmark (010) | Done |
| P9 | Testing and hardening | Done |
| P10 | Deployment and documentation | **In progress** (docs consolidated; deployment and Drive pack remain) |
| P11 | Final submission | Pending |

## 3. Phase detail

### P0 · Lock decisions
Defaults for every open item are recorded in `01_Requirement_Analysis.md` §6. No more clarification cycles.

### P1 · Initialisation and infrastructure
Next.js App Router with `src/`, npm, Tailwind, ESLint with module boundaries. Module skeleton. Shared helpers: `supabase` (pool and `withUserTransaction`), `cache` (`cached`), `rbac` (`requireUser`, `requireRole`), `phone`, `money` (`allocateByPercent`), `periods` (`periodRange`). Env files, CI workflow, Vercel linked to GitHub.
**Exit:** CI green; app deployed.

### P2 · Database, auth, RBAC
Migrations 001–006, reference seed, six demo accounts, login, proxy route guard, role-aware shell, `/admin`. 10 DB and RLS tests at the time.
**Exit:** log in as each role; RLS tests pass.

### P3 · Contacts
Type-conditional form, channel repeater (≥1), dedupe on email and phone with "Open contact" / "Use existing", inline company creation, reusable `ContactPicker`, list with filters, detail page with related records.
**Acceptance:** duplicate email or phone blocked; individual without company saves; zero channels rejected; picker creates and selects without leaving the deal form.

### P4 · Pipelines and receipts
Money-only validation, cash vs in-kind with valuation note, individual vs company (POC and secondary), live FX preview, list and board views, stage history, Won/Lost/Junk dialogs, receipts with over-receipt flag.
**Acceptance:** amount 0 rejected; in-kind without note rejected; Lost needs a reason; history rows appear; a receipt raises achievement; USD deal stores BDT.

### P5 · Meetings and Activities
Meetings with contact-or-pipeline rule, derived organisation and designation, scheduled/done tabs, follow-up shortcut. Activities with 11 types, 3 classes, tracker table, "My activities", pre-linked shortcuts.
**Acceptance:** meeting with neither link rejected; standalone activity allowed; others can view but not edit.

### P6 · Targets
Five-step wizard with server-saved drafts, "Remaining to allocate", largest-remainder rounding, publish = lock via triggers and `publish_target_plan`, read-only view for everyone else.
**Acceptance:** unequal totals cannot save; percentages ≠ 100 rejected; edits fail at the DB after publish; no 0.01 gap.

### P7 · Dashboard
Migration 009 functions, pure view assembly in `service.ts`, filters in the URL, both lenses, "View as table" on every chart, drill-down only where date bases match.
**Acceptance:** seeded data reproduces a hand-computed result (db-tests suite 12); activities never affect achievement; over-achievement shows above 100%.

### P8 · Caching
`cached()` and tag map, reference reads cached, migration 010 indexes, single-round-trip lens queries, `cache.test.ts`, `db:bench`.
**Exit:** warm p95 0.04 ms (target 300 ms); invalidation proven.

### P9 · Testing and hardening
87 unit tests, 17 DB suites, Playwright happy path and security flow, bundle secret scan, nested-form fix, `pg@9` deprecation fix, brute-force lockout, password hash isolation, pool and secret hardening (migrations 007–008).

### P10 · Deployment and documentation (current)

| Task | Status |
|---|---|
| Consolidate docs to six files in `docs/` | Done |
| Trim root docs to `DESIGN`, `README`, `INFO`, `MEMORY`, `AGENTS`, `CLAUDE` | Done |
| Run `db:push` and `db:seed` against the production project | To do |
| Merge `develop` → `main`; confirm Vercel Production env vars | To do |
| Smoke test the live URL (see `05_Technical_Docs.md` §5) | To do |
| Tag `v1.0.0` | To do |
| Update README with live URL | To do |
| Architecture PDF from `02_Architecture_and_Database.md` (check every Mermaid diagram renders; add cover page) | To do |
| Upload docs to Google Drive, share as viewer, test links logged out | To do |

Drive folder mirror of `docs/`:

```
PSE Dashboard – Assessment/
  01_Requirement_Analysis
  02_Architecture_and_Database
  04_User_Guide
  05_Technical_Docs
  07_Migration
  08_Project_Management
```

### P11 · Submission
Checklist:
- [ ] Vercel URL loads in a private window; demo login works
- [ ] GitHub repo accessible; README complete; `main` is the deployed code
- [ ] Architecture PDF opens with diagrams visible
- [ ] Drive folder shared; every link verified logged out
- [ ] Assumptions and known limitations listed
- [ ] Email drafted: Vercel, GitHub, Drive and PDF links, demo credentials, summary of built vs designed-not-built

## 4. Timeline

| Day | Work |
|---|---|
| Mon 26 Oct | P0, P1, P2 |
| Tue 27 Oct | P3, P4, P5, P6 |
| Wed 28 Oct | P7–P9 completed; P10 deploy and docs; P11 submit by 8 PM; buffer to 11:59 PM (fixes only) |

Phases P7–P9 were finished ahead of the original Wednesday slots, leaving Wednesday for P10 and P11.

## 5. Slip protocol

- Behind by ≤ 1 h at a gate: drop the lowest-priority cut item.
- Behind by > 2 h: reduce Activities filters, list-only pipelines, monetary lens before non-monetary.
- Cut order: importer UI → Kanban drag → admin config screens → count targets, CSV export, materialised views, Redis.

## 6. Branching and quality gates

- `develop` for work; `main` is deployed. Conventional commits.
- Before closing a phase: `npm run lint`, `lint:design`, `typecheck`, `test`, `db:test`, `build` all pass. Update the tracker in `MEMORY.md`.

## 7. Definition of done

All business rules in `01_Requirement_Analysis.md` §5 pass tests; CI green; production deployed and smoke-tested; GitHub, Vercel, Drive and PDF links verified from a logged-out browser; assumptions and limitations documented.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Requirements still moving | Config tables, swappable SQL KPIs, locked defaults |
| Stale or leaking cache | Authorise before cache; invalidation tests |
| Deployment surprises | Deploy early; buffer hours; smoke test |
| Public demo lockout | Documented; wait 15 minutes |
| Scope creep | Written out-of-scope list |
