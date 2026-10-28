# 04 · User Guide

For PSE team members, the target manager and administrators.

## 1. Signing in

Open the app and sign in with your email and password. The login page offers one-click fill for the demo accounts.

| Role | What you can do |
|---|---|
| `member` | Read all PSE data. Create records. Edit only your own. |
| `target_manager` | Everything a member can do, plus create and publish targets. |
| `admin` | Everything, plus manage users in Admin. |
| Non-PSE user | Sees only the no-access page. |

Five failed sign-ins for the same email lock that email for 15 minutes.

Demo accounts (password `Password123!`): `admin@pse.org`, `safina@pse.org` (target manager), `rahim@pse.org`, `karim@pse.org`, `nadia@pse.org` (members), `external@otherdept.org` (non-PSE).

## 2. Layout

A sidebar lists Dashboard, Contacts, Pipelines, Meetings, Activities, Targets, and Admin (admin only). Below 1024 px the sidebar becomes a drawer opened from the top bar. A theme toggle switches light and dark. Each page shows a loading skeleton while data loads.

## 3. Contacts

1. Open **Contacts** and choose **New contact**.
2. Pick **Individual** or **Company**. The form changes with the type.
3. Add at least one email or phone. Use the repeater to add more.
4. Save.

If the email or phone already exists, you see a message with **Open contact** or **Use existing**. Duplicates are matched on lowercase email and E.164 phone, so `+880 1711-000000` and `01711000000` count as the same number.

An individual may have a company, a designation and notes. Use notes for relationship context such as referrals, roles and background. Paste Google Drive links in notes; they become safe clickable links.

Filter the list by type, status, organisation and industry. A contact page shows tabs for Pipelines, Meetings, Activities and People (for companies), with shortcuts **New pipeline**, **Schedule meeting** and **Log activity**.

Anywhere a form asks for a contact, you can search and use **Create new contact** without leaving the form.

## 4. Pipelines and receipts

A pipeline exists only for **expected money**.

1. Open **Pipelines** → **New pipeline**.
2. Enter deal name, focal person, category, and contribution type.
   - **Cash:** enter amount and currency.
   - **In-kind:** enter a value and a **valuation note** (who valued it and on what basis).
3. Choose the party: **Individual** (the donor) or **Company** (company plus a Point of Contact and optional secondary contact).
4. For foreign currency, the form shows the BDT value using the latest FX rate. That value is stored when you save.

The amount must be greater than 0. Small or unvalued items belong in **Activities**; the form links there.

**Views:** a list with filters, and a board grouped by stage.

**Changing stage:** use the stage selector on a row or card.
- **Won** asks for confirmation.
- **Lost** requires a reason.
- **Abandoned** takes an optional reason.

The detail page shows the stage history, linked meetings and activities, and receipts.

**Recording receipts.** Money counts as achievement only when received. On a won pipeline choose **Record receipt**, then enter amount, currency and date. The banner reads `Won ৳ X · Received ৳ Y · Unrealized ৳ (X − Y)`. Receiving more than the won amount is allowed and flagged.

## 5. Meetings

1. Open **Meetings** → **New meeting**.
2. Pick a contact, a pipeline, or both (at least one). Organisation and designation appear read-only from the contact.
3. Set date and time, then add a description.

Tabs: **All**, **Upcoming**, **Done**. Use **Mark done** after the meeting. **Add follow-up** opens a new activity already linked to the meeting, contact and pipeline.

## 6. Activities

Activities record non-monetary work. They never change monetary figures.

Types: task, email (manual log), call, meeting, event, campaign, proposal, visit, servicing, prospect engagement, general.

Class (set from the type, editable):
- **Stewardship:** work with existing donors.
- **Prospect engagement:** work before a money opportunity exists.
- **Independent:** information requests, visits, events with no defined value.

Links to a contact, pipeline or meeting are optional. Without a contact, type the organisation in the related-organisation field. Use **Remaining work** for next steps.

The table matches the team's Excel tracker (date, activity and notes, type, class, related, owner, status, remaining work). Toggle **All team** or **My activities**. Change status inline.

Small gifts in-kind, such as goods with no meaningful value, are logged here as `general` or `servicing`.

## 7. Targets

Only a target manager or admin can edit targets. Everyone else sees the published plan.

1. Open **Targets** and choose the year. The wizard has five steps. Your draft saves when you press **Next**.
2. **Annual:** enter the team target in BDT.
3. **Quarters:** split into Q1–Q4. Uneven splits are fine. The sum must equal the annual target. **Remaining to allocate** shows what is left.
4. **Members:** allocate each quarter to team members. Members must add up to the quarter.
5. **Verticals:** set DSP / VBD / Project percentages per member and quarter. They must total 100%. Amounts are rounded so they add up exactly.
6. **Review and publish.**

> **Publishing locks the plan permanently.** The database blocks every later edit. There are no revisions and no carry-forward. Check the review step carefully.

## 8. Dashboard

Dashboard filters live in the URL, so a view can be shared by link.

**Filters:** period (Month, Quarter, Year), year and index, member, vertical. Switch between **Monetary** and **Non-monetary** with the lens toggle. Both load together.

### Monetary lens

| Tile | Meaning |
|---|---|
| Target | Quarter exact. Month is quarter ÷ 3, labelled pro-rata. Year is the sum of quarters |
| Achieved | Money received in the period (receipts) |
| Attainment | Achieved ÷ Target. Over-achievement is shown uncapped (for example 110%) |
| Unachieved / Over-achieved | Shortfall or excess against target |
| Won, not yet received | Deals won in the period minus receipts, per deal, not below zero |
| Leads | Pipelines created in the period |
| Open pipeline | Value of pipelines in open stages |

Charts: target vs achievement by member and by vertical, pipeline by stage kind (open, won, lost, junk) with cash vs in-kind, and a 12-month trend.

A rounded monthly target can differ by one or two cents from an exact third of the quarter.

### Non-monetary lens

Meetings (total, scheduled, done, completion rate), activities by type and class, visits / events / campaigns, distinct contacts engaged, and workload by member.

Every chart has **View as table**. Meeting and activity tiles link to the matching filtered list. Pipeline tiles do not, because the pipelines list filters on expected close date while the dashboard counts by created and won date.

### Key definitions

| Term | Definition |
|---|---|
| Forecast | Expected amount on an open pipeline |
| Won | Pipeline in a won stage |
| Achievement | Receipts recorded in the period |
| Lead | Pipeline created in the period (pending PSE confirmation) |

## 9. Admin (admin only)

Create users, set role, active status and PSE membership. Reference tables (stages, category-to-vertical map, FX rates) are shown read-only. Changing them is done by SQL; see `05_Technical_Docs.md`.

## 10. Troubleshooting

| Problem | Cause and fix |
|---|---|
| "Contact already exists" | Another contact uses that email or phone. Open it instead |
| Cannot save a pipeline | Amount must be > 0. In-kind needs a valuation note. Company needs a Point of Contact |
| Cannot record a receipt | The pipeline must be in a won stage |
| Cannot edit a record | You are not the owner. Ask the owner or an admin |
| Target plan will not save | Quarters must equal annual; members must equal the quarter; verticals must total 100% |
| Target plan is read-only | It was published and locked |
| Email locked after failed sign-ins | Wait 15 minutes |
| Redirected to no-access | Your account is not marked as PSE. Ask an admin |
