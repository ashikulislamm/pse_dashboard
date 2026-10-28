# PSE Dashboard — Design System

A minimal, clean, professional interface for a working CRM. It should feel like a precise tool: calm, dense where data needs it, quiet everywhere else. Implementation target: **Tailwind CSS + shadcn/ui** on Next.js. See [docs/02_Architecture_and_Database.md](docs/02_Architecture_and_Database.md) for structure and [docs/08_Project_Management.md](docs/08_Project_Management.md) for when each piece is built.

---

## 1. Principles

1. **Content first.** Data, numbers and actions are the interface. Chrome stays out of the way.
2. **One accent.** A single brand color for primary actions and focus. Everything else is neutral.
3. **Earn every element.** If a badge, icon, border, shadow or color does not help the user read, decide or act, remove it.
4. **Honest UI.** Show only real data and real state. No invented status, no decoration pretending to be information.
5. **Consistent over clever.** Same component, same spacing, same behavior everywhere. Reuse before creating.
6. **Accessible by default.** Contrast, keyboard use, visible focus, and text labels are not optional.

## 2. Hard bans (project-wide)

These are rules, not suggestions. Reject them in review.

| Banned | Why / instead |
|---|---|
| Gradients (backgrounds, buttons, text, charts, borders) | Flat solid colors only |
| Decorative or "marketing" badges (New, Pro, Beta, counts as decoration) | Use a badge only for a real record state that users scan (see §9) |
| Fake status text: "System operational", "All systems normal", "Live", "Online", "Synced" | Show nothing unless there is a real, actionable state |
| Pulse / ping / blinking dots, shimmering "live" indicators | Static UI. Loading uses a skeleton or spinner, only while loading |
| Placeholder or fake data in the shipped UI (lorem ipsum, "John Doe", invented KPIs, fake trend arrows) | Empty states say what is empty and how to fill it |
| Emoji in UI text, icon-as-decoration, illustrations for filler | Icons only where they aid recognition |
| Glassmorphism, blur, glow, neon, heavy drop shadows | Borders and spacing create structure |
| Colored sidebars, hero banners, welcome splash, motivational copy | The dashboard opens on data |
| Rainbow charts, 3D, pie charts with more than 4 slices, gauge/speedometer | See §10 |
| Rounded "pill" buttons everywhere, oversized radii | Radius scale in §5 |
| Auto-playing animation, parallax, page-load flourishes | Motion only for state change, max 150 ms |
| Tooltips as the only way to read essential info | Put the info in the UI |

## 3. Color

Flat, neutral, low-chroma. Define as CSS variables in `globals.css`; reference tokens only, never raw hex in components.

### 3.1 Neutrals and accent (light)

| Token | Value | Use |
|---|---|---|
| `--background` | `#FFFFFF` | App canvas |
| `--surface` | `#FAFAFA` | Sidebar, table header, subtle panels |
| `--surface-2` | `#F4F4F5` | Hover rows, input fills |
| `--border` | `#E4E4E7` | All dividers and outlines |
| `--border-strong` | `#D4D4D8` | Inputs, focused containers |
| `--foreground` | `#18181B` | Primary text |
| `--muted-foreground` | `#52525B` | Secondary text (4.5:1+ on white) |
| `--subtle-foreground` | `#71717A` | Captions, placeholders (large/secondary only) |
| `--primary` | `#1D4ED8` | Primary button, links, selected state, focus ring |
| `--primary-hover` | `#1E40AF` | Primary hover |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--primary-subtle` | `#EFF4FF` | Selected row / active nav background |

### 3.2 Neutrals and accent (dark)

| Token | Value |
|---|---|
| `--background` | `#0B0B0D` |
| `--surface` | `#121215` |
| `--surface-2` | `#1A1A1E` |
| `--border` | `#26262B` |
| `--border-strong` | `#34343B` |
| `--foreground` | `#F4F4F5` |
| `--muted-foreground` | `#A1A1AA` |
| `--subtle-foreground` | `#8A8A93` |
| `--primary` | `#6E96FF` |
| `--primary-hover` | `#8DACFF` |
| `--primary-foreground` | `#0B0B0D` |
| `--primary-subtle` | `#16203A` |

Dark mode is a first-class theme following `prefers-color-scheme`, with a manual toggle stored in the user's browser. Test both themes for every screen.

### 3.3 Semantic colors (used sparingly)

Semantic colors carry meaning only. They appear as **text or a 2 px left rule**, not as filled blocks.

| Meaning | Light | Dark | Used for |
|---|---|---|---|
| Positive | `#15803D` | `#4ADE80` | Target met or exceeded, Won, success message |
| Negative | `#B91C1C` | `#F87171` | Lost, errors, destructive action |
| Warning | `#B45309` | `#FBBF24` | Overdue, below-target at risk, validation caution |
| Info | uses `--primary` | | Neutral notes |

Rules:
- Color is never the only signal. Pair it with a text label or sign (`+12%`, `Lost`).
- No semantic color on more than a few items per screen. If everything is green or red, nothing is.
- Contrast: body text ≥ 4.5:1, large text and UI borders ≥ 3:1, in both themes.

## 4. Typography

| Item | Spec |
|---|---|
| Typeface | **Inter** via `next/font` (one family only). Fallback: system UI |
| Numerals | `font-variant-numeric: tabular-nums` on all tables, KPIs, amounts, dates |
| Weights | 400 body, 500 labels and buttons, 600 headings and KPI values. No 700+ |
| Case | Sentence case everywhere. No ALL CAPS except short table-column labels at 12 px if needed |
| Line length | Max 72 characters for prose (notes) |

### Type scale

| Role | Size / line-height | Weight |
|---|---|---|
| Page title | 24 / 32 | 600 |
| Section title | 18 / 28 | 600 |
| Card title | 14 / 20 | 600 |
| Body | 14 / 20 | 400 |
| Label / table text | 13 / 20 | 500 / 400 |
| Caption / helper | 12 / 16 | 400 |
| KPI value | 28 / 32 | 600, tabular |

Base body size is 14 px for density; never below 12 px. Letter-spacing default (no tracking tricks).

### Number and date formatting
- Currency: `৳ 1,250,000` for BDT; other currencies show code and symbol `USD 5,000`. Always show the **base amount in BDT** on dashboards.
- Large KPI values use full numbers; use compact form (`1.25M`) only in chart axes, with the full value in the table beneath.
- Percentages: one decimal at most (`96.4%`). Over-achievement shown as is (`110%`), never capped.
- Dates: `26 Oct 2026`; date-time `26 Oct 2026, 3:30 PM`; ranges `Q1 2026`, `Oct 2026`.
- Missing values render as an em dash `—`, never `N/A`, `null` or `0` unless it is a real zero.

## 5. Spacing, layout, shape

| Token | Value |
|---|---|
| Base unit | 4 px; scale 4, 8, 12, 16, 24, 32, 48 |
| Page gutter | 24 px (16 px on mobile) |
| Card padding | 16 px (compact) / 24 px (forms) |
| Radius | `--radius-sm` 4 px (inputs, tags), `--radius` 6 px (buttons, cards), `--radius-lg` 8 px (dialogs). Nothing above 8 px except avatars |
| Borders | 1 px `--border`. Structure comes from borders and whitespace |
| Shadows | None on cards. One soft shadow only for overlays (dialog, popover, dropdown): `0 4px 16px rgb(0 0 0 / 0.08)` |

### App shell
- **Left sidebar** 232 px, `--surface` background, 1 px right border. Nav items: icon (16 px) + label. Active item: `--primary-subtle` background and `--primary` text. Collapses to icons under 1024 px, to a drawer under 768 px.
- **Top bar** 56 px: page breadcrumb on the left, user menu (name, role, sign out) and theme toggle on the right. Nothing else. No notification bell, no search unless it searches real data.
- **Content** max width 1440 px, centered; tables and dashboards may use the full width.
- Page header pattern: title (left), primary action button (right), optional one-line description below in muted text.

### Grid
12-column grid, 24 px gap. Dashboard tiles span 3 (KPI) or 6/12 (charts). Forms use a single column up to 640 px width, two columns above for short fields.

## 6. Components

Use **shadcn/ui** primitives as the base. Wrap them once in `shared/ui`; modules consume only the wrappers.

### Buttons
| Variant | Use | Style |
|---|---|---|
| Primary | One per screen/dialog: the main action | `--primary` fill, white text |
| Secondary | Other actions | Transparent, 1 px `--border-strong`, foreground text |
| Ghost | Toolbar, row actions | No border, hover `--surface-2` |
| Destructive | Delete / irreversible | Secondary style with `--negative` text; confirm dialog fills red only on the confirm button |

Height 36 px (32 px compact in tables). Labels are verbs: "Save contact", "Record receipt", "Publish targets". Loading state: spinner inside the button, label stays, button disabled.

### Inputs and forms
- Label above field, 13 px 500. Helper text 12 px muted below. Error text 12 px `--negative`, replaces helper, field border turns `--negative`.
- Required fields marked with `(required)` text in the label only when most fields are optional; otherwise mark optional ones `(optional)`.
- Height 36 px, 1 px `--border-strong`, radius 4 px, focus ring 2 px `--primary` with 2 px offset.
- Selects, comboboxes and date pickers follow the same box. The **ContactPicker** is a combobox with search results (name, type, organization) and a final item "Create new contact".
- Group long forms into titled sections separated by whitespace and a 1 px divider; no nested cards.
- Validate on blur and on submit; show the first error summary at the top only for server errors.
- Notes fields: textarea min 6 rows, auto-linking of URLs (Google Drive links open in a new tab with `rel="noopener noreferrer"`).

### Tables (the most important component)
- Header row: `--surface`, 12–13 px, 500, muted, sticky on scroll. Row height 44 px (40 px compact). Horizontal dividers only, no zebra, no vertical lines.
- Hover row `--surface-2`; selected row `--primary-subtle`.
- Numbers right-aligned, text left-aligned, dates left-aligned. Primary column is a link.
- Toolbar above: search (left), filters as ghost buttons with the active value shown (`Stage: Won`), column or view controls (right). Active filters can be cleared with one click.
- Pagination bottom right, "Showing 1–25 of 312". Default 25 rows.
- Sorting indicated by a small chevron on the sorted column only.
- Row actions: a single "…" menu or inline text actions; never a row of five icons.

### Cards
1 px border, 6 px radius, no shadow, white (`--background`) on `--surface`-free pages. Title 14 px 600, optional muted description. Don't nest cards.

### Dialogs and sheets
Dialog for short forms (≤ 8 fields). Right-side sheet for longer create/edit flows. Title states the action ("New pipeline"), primary action bottom right, Cancel to its left, Esc closes, focus is trapped and returned on close. Never a dialog stacked on a dialog (the inline "Create contact" opens within the picker's popover/sheet flow and returns to the form).

### Tabs and segmented controls
Tabs for views (Monthly / Quarterly / Annual; Upcoming / Done / All): underline style, 2 px `--primary` underline on active. Segmented control for two-way lens switch (Monetary / Non-monetary).

### Tags (the only badge-like element)
Used **only** to show a real record state that users scan in a list: pipeline stage, meeting status, activity status, contact status. Rules:
- Neutral outlined tag: 1 px `--border-strong`, 12 px text, 4 px radius, no fill.
- Only outcomes get color, as **text color**: Won → positive, Lost → negative. Everything else stays neutral.
- Never use a tag for counts, labels like "New", or decoration. Counts are plain muted text in parentheses.
- No dots inside tags.

### Toasts and messages
Toasts (bottom right) for confirmations of actions the user just took: "Contact saved". One line, auto-dismiss in 4 s, errors persist until dismissed. Inline alerts only for blocking problems on the page (duplicate contact found, validation failure), styled as a 1 px bordered box with a 2 px left rule in the semantic color.

### Empty, loading and error states
| State | Pattern |
|---|---|
| Loading | Skeleton blocks matching final layout (flat `--surface-2`, no shimmer sweep); spinner only inside buttons |
| Empty list | One sentence + one action: "No pipelines yet. Create the first one." |
| Empty filter result | "No results for these filters." + "Clear filters" |
| Error | Plain message, what failed, a Retry button. No error codes unless useful |
| No permission | "You don't have access to this page." and a link back |

### Icons
Lucide, 16 px (20 px in empty states), 1.5 px stroke, `currentColor`. Used in navigation, buttons that benefit, and menus. Always paired with a visible text label except universally clear ones (close, search, more).

### Motion
Only for state change: 100–150 ms ease-out on hover, dialog/sheet open, menu open. Respect `prefers-reduced-motion` (disable all). No entrance animations on page load.

## 7. Patterns by module

| Module | Primary view | Notes |
|---|---|---|
| Contacts | Table (name, type, organization, primary channel, owner, status) → detail page | Detail has related-records panel: pipelines, meetings, activities |
| Pipelines | Table (default) and stage-grouped board | Board columns are plain bordered lists headed by stage name and a muted count; cards show deal, contact, amount, owner, expected close. No colored column headers |
| Pipeline detail | Summary header (deal, stage, amount), stage history list, receipts table, linked records | Amounts show original and base: `USD 5,000 (৳ 600,000)` |
| Meetings | Table with Upcoming / Done / All tabs | Organization and designation read-only from the contact |
| Activities | Table that mirrors the Excel tracker | "My activities" is a saved filter |
| Targets | Stepper wizard (Annual → Quarters → Members → Verticals → Review) | Running "Remaining to allocate" figure always visible; after publishing, read-only with "Published on …" text |
| Dashboard | Filter bar + KPI row + charts + supporting tables | See §8 and §10 |
| Admin | Plain tables and forms | Minimal; same patterns |

### Forms specific rules
- **New pipeline:** sections in this order: Deal (name, focal person, contribution type, category), Party (individual or company fields), Value (amount, currency, payment interval, expected closing), Details (country, description, operational budget, notes). A single muted sentence under the amount field: "Pipelines are for expected funds. Log unvalued items as an activity." with a text link.
- **Duplicate contact:** inline alert with the existing contact's name and an "Open contact" link; the form stays intact.
- **In-kind valuation:** valuation note field appears only when type is In-kind.

## 8. Dashboard layout

1. **Filter bar** (sticky below top bar): period type segmented control, period selector, member, vertical. Filters live in the URL.
2. **Lens switch:** Monetary | Non-monetary (segmented control, left-aligned under the filters).
3. **KPI row:** 4–6 tiles in a 12-col grid. A tile: label (13 px muted), value (28 px 600 tabular), one line of context in muted text (`Target ৳ 5,000,000`). No icons, no sparkline unless it carries real data, no trend arrows unless computed from a real prior period.
4. **Charts row**, then **supporting tables** (by member, by vertical, by stage).
5. Every tile and chart title says exactly what it measures; formulas appear as one-line captions where non-obvious (e.g. "Monthly target is the quarter target ÷ 3").
6. Drill-down: clicking a number opens the filtered list; underline on hover signals it.
7. Month view of target is always labelled pro-rata. Won-but-not-received is shown separately from achievement and labelled "Won, not yet received".

No welcome message, greeting, motivational text, or system-health indicator anywhere on the page.

## 9. Content and copy rules

- Plain, specific, short. "Record receipt", not "Let's add some money".
- Use the business vocabulary from the requirements: Pipeline, Contact, Meeting, Activity, Focal person, Stage, Achievement, Target.
- Errors say what to do: "Enter an email or phone number." not "Invalid input".
- Do not write filler: no "Welcome back!", "Everything looks good", "System operational", "Powered by", version banners.
- Success is confirmed by the result appearing plus an optional short toast.
- Units and currency always visible next to figures.

## 10. Data visualization

Follow these for every chart.

| Rule | Detail |
|---|---|
| Chart types | Bar (comparison), line (trend), stacked bar (composition ≤ 4 parts), simple table. **No pie/donut above 4 slices, no gauges, no 3D** |
| Target vs achievement | Horizontal bars: achieved bar over a thin target marker line, with the percentage printed as text. Over-achievement bar extends past the marker |
| Color | **No gradients.** One primary series uses `--primary`; comparison/target uses neutral `--border-strong`/`--foreground`. Additional series from a validated categorical set below, max 4 per chart |
| Axes | Light gridlines (`--border`), no chart borders, tick labels 12 px muted, y-axis starts at zero for bars |
| Labels | Direct labels or a text legend; values shown in tooltips **and** available in a table below or via "View as table" |
| Tooltips | Dark-on-light panel with label and exact value; supplementary only |
| Empty | "No data for this period." with the filter reminder |

Categorical palette (light / dark), used in this order and never beyond four series:

| Series | Light | Dark |
|---|---|---|
| 1 | `#1D4ED8` | `#6E96FF` |
| 2 | `#0F766E` | `#2DD4BF` |
| 3 | `#B45309` | `#FBBF24` |
| 4 | `#71717A` | `#A1A1AA` |

Won/Lost/Open/Junk in a chart use series order, not red/green fills; the label carries the meaning.

## 11. Responsive behavior

| Breakpoint | Behavior |
|---|---|
| ≥ 1280 px | Full sidebar, 12-col dashboards |
| 1024–1279 px | Sidebar collapsed to icons |
| 768–1023 px | Drawer navigation; dashboard tiles 2-up |
| < 768 px | Single column; tables become cards listing key fields; forms single column; sticky bottom action bar for primary action |

Touch targets ≥ 40 px on mobile. No horizontal page scroll; wide tables scroll inside their container.

## 12. Accessibility

- WCAG 2.2 AA minimum, both themes.
- Visible focus ring on every interactive element (2 px `--primary`).
- All form controls have programmatic labels; errors linked via `aria-describedby`.
- Full keyboard operation: tables, dialogs, comboboxes, the target wizard, filters.
- Color never alone; charts have a table alternative.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Language attribute set; headings in logical order; one `h1` per page.

## 13. Implementation instructions

### 13.1 Setup (done in Phase 1)
1. `shadcn init`; set base color to **zinc**; then override CSS variables with the tokens in §3 in `src/app/globals.css` (`:root` and `.dark`).
2. Set the shadcn `--radius` to `0.375rem` (6 px) and adjust the derived sizes to §5.
3. Load Inter with `next/font/google` in the root layout; apply `font-sans` and `tabular-nums` utility on data components.
4. Add icons: `lucide-react` only.
5. Charts: Recharts through shadcn's chart wrapper; define the §10 palette as `--chart-1…4` variables.

### 13.2 Token usage rules
- Components use semantic classes (`bg-background`, `text-muted-foreground`, `border-border`, `text-primary`) and never raw hex or arbitrary Tailwind colors.
- No `bg-gradient-*`, `from-*`, `to-*`, `via-*`, `blur-*`, `backdrop-*`, `animate-pulse`, `animate-ping`, `shadow-lg` or larger in the codebase. Add a lint rule (Tailwind ESLint plugin `no-restricted-classes`) or a CI grep:
  ```
  grep -RInE "bg-gradient|from-|via-|to-\[|animate-(pulse|ping|bounce)|backdrop-|blur-|shadow-(lg|xl|2xl)" src && exit 1 || exit 0
  ```
- Spacing only from the 4 px scale (`p-1/2/3/4/6/8/12`).

### 13.3 Shared UI wrappers (`src/shared/ui`)
Create once, reuse everywhere:

`AppShell`, `PageHeader`, `Button`, `Field` (label + control + helper + error), `Input`, `Select`, `Combobox`, `DatePicker`, `Textarea` (with URL auto-link rendering), `DataTable` (TanStack Table: sorting, filters, pagination, sticky header), `FilterBar`, `Tag`, `EmptyState`, `Skeleton`, `ConfirmDialog`, `FormSection`, `KpiTile`, `TargetBar` (target vs achievement), `BarChart`, `LineChart`, `Money` (formats amount + currency), `DateText`.

`Money` and `DateText` are the **only** places that format money and dates, so formats stay consistent.

### 13.4 Definition of done for any screen
- [ ] Uses shared wrappers; no one-off styles
- [ ] Looks correct in light and dark
- [ ] Has loading, empty, error and no-permission states
- [ ] Keyboard-operable with visible focus
- [ ] Works at 360 px and 1440 px widths
- [ ] Contains none of the banned items in §2
- [ ] Every number has units and a clear definition

## 14. Quick review checklist (use before each merge)

1. Can the main task on this screen be done in the fewest steps? Is the primary action obvious?
2. Is there any element whose removal would not hurt? Remove it.
3. Is there any text that states something the system does not actually know? Remove it.
4. Is color used for meaning only, and is there a text label beside it?
5. Are numbers aligned, formatted by `Money` / `DateText`, and traceable to a definition?
6. Does it still work in dark mode and with reduced motion?
