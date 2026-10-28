# 01 · Requirement Analysis

Private Sector Engagement (PSE) CRM and Performance Dashboard.

## 1. Purpose

A simplified, Odoo-like CRM for the PSE team. It manages donors and sponsors, tracks expected and received money against targets, and records all non-monetary work. Reporting has two separate lenses: **monetary** and **non-monetary**.

Record chain:

```
Contact ──► Pipeline (money only) ──► Meeting (contact OR pipeline) ──► Activity (anything, or standalone)
```

Stack fixed by the brief: Next.js / React, Supabase Postgres, a caching layer, Vercel, GitHub, Google Drive for docs.
Deliverables: live Vercel URL, GitHub source, documentation pack on Google Drive, architecture PDF.

## 2. How the requirements were read

The requirement pack has two layers. Layer 1 is the original "Dashboard Requirements". Layer 2 is the later "Major requirement changes" meeting. **Where they conflict, Layer 2 wins.** Layer 1 is used only as a source of field lists.

| Area | Original | Final decision |
|---|---|---|
| Leads | Dashboard KPI | No Lead module. A lead is a pipeline created in the period. Formula is unconfirmed, so it is isolated in one SQL function. |
| Pipeline scope | Cash and in-kind | Only items with expected money value. Expected amount must be > 0. |
| Non-monetary work | Counted with events, year-end valuation | Activities module. Never touches monetary targets. |
| Events | Standalone module | Activity types `event`, `campaign`, `visit`. No Events module. |
| Documents | Upload | No uploads. Google Drive URLs are pasted into notes and rendered as safe links. |
| Email | Unclear | No Gmail sync. Emails are logged manually as activities. |
| Autofill | Org and designation suggestions | No external autofill. Suggestions come from internal contacts only. |
| Visibility | Hierarchy | All PSE members read all PSE data. Other departments see nothing. |
| Targets | Director → Dept head → Member | Central: only `target_manager` and `admin` edit. Hierarchy workflow is pending. |
| Target logic | Monthly / quarterly / annual | Annual → manual uneven Q1–Q4 → members → vertical %. Locked after publish. |
| Over-achievement | Not defined | No carry-forward. Q1 at 110% stays in Q1. Q2 target is unchanged. |
| Achievement | "Expected / budgeted fund" | Forecast is not achievement. Achievement is money received. |
| In-kind | Year-end estimate | Valued at entry, manually, with a valuation note. Otherwise it is an activity. |
| Migration | Undefined | Odoo → new system. PSE must supply the field mapping first. |

## 3. Functional requirements

| ID | Module | Requirement |
|---|---|---|
| FR-01 | Auth | Email + password login. Roles: `admin`, `target_manager`, `member`. Non-PSE users reach only a no-access page. |
| FR-02 | Contacts | Individual or company. At least one email or phone. Duplicates rejected on normalised email (lowercase) and phone (E.164). |
| FR-03 | Contacts | Structured organisation and designation. Notes carry relationship intelligence. Active/inactive status. |
| FR-04 | Contacts | Reusable `ContactPicker` that creates a contact inline without leaving the form. |
| FR-05 | Pipelines | Expected amount > 0. In-kind needs a value and a valuation note. |
| FR-06 | Pipelines | Party type individual or company. Company needs a Point of Contact and may have a secondary contact. |
| FR-07 | Pipelines | Stage changes are logged. Won asks for confirmation. Lost requires a reason. |
| FR-08 | Pipelines | Foreign currency converted to BDT at write time using `fx_rates`. |
| FR-09 | Receipts | Achievement comes only from `pipeline_receipts`. Receipts are allowed only on won pipelines. |
| FR-10 | Meetings | Linked to a contact or a pipeline (at least one). Organisation and designation are derived, not typed. Status scheduled/done. |
| FR-11 | Meetings | "Add follow-up" creates a pre-linked activity. |
| FR-12 | Activities | 11 types and 3 classes (stewardship, prospect engagement, independent). Optional links. Never affects money. |
| FR-13 | Targets | Wizard: annual → Q1–Q4 → members → vertical % → review and publish. Sums reconcile exactly. Publish locks the plan. |
| FR-14 | Dashboard | Monetary and non-monetary lenses. Month / quarter / year. Filters by member and vertical. |
| FR-15 | Dashboard | Monthly target is quarter ÷ 3, labelled pro-rata. Over-achievement is shown uncapped. |
| FR-16 | Admin | User provisioning, role, status and PSE-membership management. Reference tables are inspectable. |
| FR-17 | Migration | Import Odoo data with a dry run, using the same dedupe rules. Designed only, not built (see `07_Migration.md`). |

## 4. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Warm dashboard under 300 ms server time on 10k contacts / 5k pipelines / 20k activities. Measured: p95 0.04 ms warm, ~391 ms cold over the remote pooler. |
| Consistency | The dashboard is never stale after a write (tag invalidation, tested). |
| Security | PSE-only data. Rules enforced in Postgres (RLS, triggers), not only the UI. Secrets server-only. |
| Maintainability | Module boundaries enforced by ESLint. Business rules in pure, unit-tested services. |
| Usability | Responsive (drawer navigation under 1024 px). Keyboard-usable forms. Loading, empty and error states on every screen. |
| Design | Flat, low-chroma UI. Hard bans enforced in CI (`npm run lint:design`). |

## 5. Business rules (acceptance source)

- Pipelines exist only for expected money. Small or unvalued items are Activities.
- Achievement = sum of `pipeline_receipts.amount_base` with `received_on` in the period. Forecast and Won are not achievement.
- Reports group by stage `kind` (open / won / lost / junk), never by stage name.
- Vertical comes from `category_vertical_map`. It is never stored on the pipeline.
- Targets: ΣQ = annual; Σ members = quarter; vertical % = 100. Publish locks the plan with no revisions and no carry-forward.
- Month target is quarter ÷ 3 and labelled pro-rata.
- All PSE members read all PSE data. Writes are owner or admin. Targets are admin/target_manager only.

## 6. Gaps and locked defaults

Each ambiguity has a default so work is never blocked. Each default is configuration or a single SQL function, so a later answer from PSE is a small change.

| # | Open item | Locked default | Where to change |
|---|---|---|---|
| 1 | Pipeline stages | 8 stages: New, Scoping, Preparation, Submitted, Pending (open); Won; Lost; Abandoned (junk) | `pipeline_stages` |
| 2 | Lead KPI | Pipelines created in the period | `fn_lead_count` |
| 3 | Category vs vertical | Two dimensions. 6 categories map to 3 verticals (DSP→DSP, Project→Project, others→VBD) | `category_vertical_map` |
| 4 | Achievement | Receipts in period. "Won, not yet received" shown separately | `fn_achievement`, `fn_won_unrealized` |
| 5 | Monthly target | Quarter ÷ 3, labelled pro-rata | `fn_target` |
| 6 | Carry-forward | None | Period-bounded SQL, immutable quarters |
| 7 | Year and currency | Calendar year, base BDT, USD/EUR/GBP via manual FX | `settings`, `currencies`, `fx_rates` |
| 8 | Contact status | Active/inactive included | `contacts.status` |
| 9 | Target rights | `target_manager` and `admin`. Locked once published | RLS and triggers |
| 10 | Meeting vs activity type `meeting` | Meeting KPIs come only from `meetings`. The activity type is for informal logging | Schema and SQL |
| 11 | DB access and auth | Session Pooler URI, `pg`, typed SQL, scrypt + HS256 JWT cookie | `src/shared/lib/supabase`, `rbac` |
| 12 | Package manager | `npm` | `package.json`, CI |

## 7. Scope

**Built:** auth and roles, Contacts, Pipelines with stages, history and receipts, Meetings, Activities, Targets wizard and lock, two-lens Dashboard, tagged caching, security hardening, admin users screen.

**Designed, not built:** Odoo CSV importer, admin CRUD for reference tables (edited by SQL instead), Kanban drag-and-drop (stage dropdown instead), count targets, follow-up KPI, target hierarchy workflow.

**Excluded by requirement:** Gmail sync, file uploads, external autofill, standalone Events module.

## 8. Open questions for PSE

1. Final pipeline stages and their mapping to open/won/lost/junk.
2. Exact Lead KPI formula.
3. Is VBD a replacement for SAC, or are category and vertical separate?
4. Is achievement money received, or won value?
5. Monthly target: pro-rata of the quarter, or none?
6. Calendar or fiscal year? Base currency and FX source?
7. Is the contact active/inactive flag wanted?
8. Who else holds target-edit rights besides Safina?
9. Do count targets (meetings, events) still matter?
10. Odoo migration: which fields, how complete, and the old → new mapping.
11. Columns of the Excel activity tracker, to match the form exactly.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Requirements still moving | Config tables, swappable SQL KPIs, locked defaults |
| Cache stale or leaking data | Authorisation before cache, PSE-only data, invalidation tests |
| Achievement misread | Forecast / Won / Received labelled on every tile |
| Rounding drift in allocations | Largest-remainder rounding plus database total checks |
| Scope creep | Written out-of-scope list (section 7) |
| Deadline | Fixed phase gates and cut list in `08_Project_Management.md` |
