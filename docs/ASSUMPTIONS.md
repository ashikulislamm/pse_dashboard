# PSE Dashboard — Scope & Assumptions

This document locks the scope, architectural assumptions, and ambiguity defaults for the Private Sector Engagement (PSE) CRM & Performance Dashboard build.

---

## 1. Scope Statement

### In Scope (Built)
- **Authentication & RBAC:** Supabase Auth (email + password), session middleware, PSE-only visibility (`is_pse_member()`), and role-based write access (`admin`, `target_manager`, `member`) enforced in both the server layer and PostgreSQL Row-Level Security (RLS).
- **Contacts Module:** Individual and Company contacts, structured organization and designation fields, multi-channel (`email` / `phone`) repeater with mandatory `>= 1` channel constraint, normalized deduplication on both email (lowercase) and phone (E.164), relationship intelligence notes, related records timeline, and reusable inline `ContactPicker`.
- **Pipelines & Receipts Module:** Money-only opportunities (`expected_amount > 0`), Cash and valued In-kind contributions (with mandatory valuation note), Individual and Company party modes (with Point of Contact and Secondary Contact), stage progression with `pipeline_stage_history`, Won/Lost confirmation (with mandatory `lost_reason`), multi-currency conversion to base currency (`BDT`), and `pipeline_receipts` tracking realized funds.
- **Meetings Module:** Structured meeting records linked to a Contact or Pipeline (`CHECK` constraint), read-only organization/designation derived from the linked contact, `scheduled` / `done` status tracking, and follow-up activity shortcut.
- **Activities Module:** Non-monetary work tracker covering all 11 activity types (`task`, `email`, `call`, `meeting`, `event`, `campaign`, `proposal`, `visit`, `servicing`, `prospect_engagement`, `general`) and 3 reporting classes (`stewardship`, `prospect_engagement`, `independent`). Never affects monetary figures.
- **Targets Module:** Step-by-step setup wizard (`Annual → Q1–Q4 → Team Members → Vertical % → Review & Publish/Lock`) using largest-remainder rounding so allocations reconcile exactly. Permanently locked after publish via database triggers; writable only by `target_manager` and `admin`.
- **Two-Lens Dashboard:**
  - **Monetary Lens:** Target vs. Achievement, attainment %, unachieved / over-achieved, Won-unrealized, breakdowns by member, vertical, and pipeline stage kind (`open`, `won`, `lost`, `junk`), cash vs. valued in-kind split, and monthly trend.
  - **Non-Monetary Lens:** Meeting counts and completion rate, activity counts by type and class, visits/events/campaigns, distinct contacts engaged, and per-member workload.
- **Tagged Server Caching:** Next.js server data cache with granular tag invalidation (`dashboard`, `pipelines`, `receipts`, `meetings`, `activities`, `targets`, `config`) on every write action, plus TanStack Query client caching.

### Designed as Extension Points (Documented, Not Built in Initial Cut)
- **Odoo CSV Importer UI:** Schema (`import_jobs`) and deduplication service rules are established; bulk CSV mapping UI is deferred until PSE supplies final Odoo export field mappings.
- **Admin Configuration CRUD UI:** Reference tables (`pipeline_stages`, `contribution_categories`, `verticals`, `category_vertical_map`, `currencies`, `fx_rates`, `settings`) are database-driven, seeded, and editable via SQL without code changes.
- **Kanban Drag-and-Drop:** Pipeline board view groups deals by stage and allows stage changes via an accessible stage dropdown; drag-and-drop is deferred.
- **Non-Monetary Count Targets & Follow-up Rate KPI:** Deferred pending PSE formula approval.
- **Hierarchical Target Approval Workflow:** Deferred pending PSE organizational hierarchy sign-off; governed by `target_manager` role in the interim.

### Strictly Out of Scope (Explicit Requirements Decisions)
- **No Gmail / Email Sync:** Emails are logged manually as activities.
- **No File Uploads / Blob Storage:** Documents live in Google Drive; URLs are pasted into notes fields and auto-linked safely (`rel="noopener noreferrer"`).
- **No External Autofill:** Company and contact suggestions come strictly from internal PSE records.
- **No Standalone Events Module:** Events, campaigns, and visits are tracked as Activity types (`event`, `campaign`, `visit`).

---

## 2. Locked Decisions & Defaults for Open Items

| # | Open Item / Ambiguity | Locked Decision for Build | Reconfigurability |
|---|---|---|---|
| 1 | **Pipeline stages** | Seed 8 stages: `New`, `Scoping`, `Preparation`, `Submitted`, `Pending` (`kind = open`), `Won` (`kind = won`), `Lost` (`kind = lost`), `Abandoned` (`kind = junk`). | Stored in `pipeline_stages`; all reports group by `kind`, never hardcoded stage names. |
| 2 | **Lead KPI definition** | Count of pipelines created within the selected period. | Isolated in SQL function `fn_lead_count(p_start, p_end, p_user)` for single-place updates. |
| 3 | **Category vs. Vertical terminology** | Treated as two linked dimensions: 6 `contribution_categories` (`DSP`, `SAC`, `Disaster Campaign`, `Project`, `Event & Campaign`, `General`) mapped to 3 `verticals` (`DSP`, `VBD`, `Project`) via `category_vertical_map` (`DSP → DSP`, `Project → Project`, others `→ VBD`). | Editable in `category_vertical_map` table. |
| 4 | **Achievement definition** | `Achievement = SUM(pipeline_receipts.amount_base)` where `received_on` falls in the period. Won deals without full receipts show the difference as *"Won, not yet received"*. | Isolated in `fn_achievement` and `fn_won_unrealized`. |
| 5 | **Monthly Target vs. Achievement** | Targets are set quarterly and annually. Monthly view displays `Quarter Target ÷ 3`, explicitly labelled *"pro-rata"*. | Computed in `fn_target` and labelled in UI. |
| 6 | **Over-achievement & Carry-forward** | No carry-forward between quarters. Over-achievement in Q1 (`> 100%`) stays in Q1; Q2 target remains unchanged. Annual actual = sum of all receipts in the year. | Enforced by period-bounded SQL queries and immutable `target_quarters`. |
| 7 | **Calendar vs. Fiscal Year & Currency** | Calendar year (`fiscal_year_start_month = 1`); base currency `BDT` (`৳`). Foreign currencies (`USD`, `EUR`, `GBP`) converted to `amount_base` at write time via `fx_rates`. | Stored in `settings`, `currencies`, and `fx_rates`. |
| 8 | **Contact active/inactive status** | Included on `contacts.status` (`active` | `inactive`, default `active`). | Filterable column on `contacts`. |
| 9 | **Target edit permissions** | Restricted to `target_manager` (e.g., Safina) and `admin` roles; read-only for `member`. Locked permanently once published (`locked_at IS NOT NULL`). | Enforced via RLS policies and `BEFORE` triggers on target tables. |
| 10 | **Meetings vs. Activity type `meeting`** | Structured `meetings` table drives all Meeting KPIs on the dashboard. Activity type `meeting` is retained for informal activity logging only. | Separated at schema and SQL function level. |
| 11 | **Database Connection & Auth Mechanism** | Connect strictly via the Supabase Cloud PostgreSQL URI (`DATABASE_URL`) using `pg` (`node-postgres`). Authentication uses PostgreSQL credential verification (`scrypt`) + HMAC-SHA256 HTTP-only session cookies (`AUTH_SECRET`), setting `request.jwt.claim.sub` / `app.current_user_id` per transaction so PostgreSQL Row-Level Security (RLS) policies and triggers execute directly in the database without requiring external Supabase API keys. | Controlled via `src/shared/lib/supabase/` and `src/shared/lib/rbac/`. |
