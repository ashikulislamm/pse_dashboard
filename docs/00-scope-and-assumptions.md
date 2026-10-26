# PSE Dashboard — Scope Statement & Assumptions (Phase 0)

See [ASSUMPTIONS.md](./ASSUMPTIONS.md) for the complete, canonical scope statement, in/out-of-scope boundaries, and locked ambiguity defaults.

## Quick Summary of Out-of-Scope Items
- **No Gmail / Email Integration:** Emails are logged manually via the Activities module (`type = email`).
- **No File Uploads / Storage Bucket:** Google Drive links are pasted in notes fields and rendered as safe external links (`rel="noopener noreferrer"`).
- **No External Autofill:** Company and contact lookup suggestions use internal PSE records only.
- **No Standalone Events Module:** Events, campaigns, and visits are recorded as Activities (`event`, `campaign`, `visit`).
- **No Follow-up Rate KPI:** Parked pending PSE definition of formula, trigger, and time window.
