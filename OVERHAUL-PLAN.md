# KW Research Dashboard Overhaul Plan

Audience: coding agents working in this repository.

Goal: turn the current authenticated dashboard experience into a coherent, production-grade product UI, while also fixing the misleading public/live entry point and formalizing dark mode.

Relevant live entry points:

- Public landing: `https://kw-research.maximo-seo.ai/`
- Authenticated app shell: `/dashboard`
- Project dashboard: `/dashboard/[projectId]`

Relevant repo areas:

- Routing and app shell: `src/app/**`, `src/components/app/**`
- Research dashboard: `src/components/research/**`
- Design system primitives: `src/components/ui/**`
- Theme system: `src/app/globals.css`, `src/components/ThemeProvider.tsx`, `src/components/ThemeToggle.tsx`, `tailwind.config.ts`

---

## Part 1: Root Cause Analysis

### 1.1 The live URL is not the actual dashboard

Primary root cause: the URL being evaluated (`/`) is the unauthenticated marketing/entry page, not the authenticated dashboard.

Evidence from the codebase:

- `src/app/page.tsx` renders the public landing page and redirects only when a user session exists.
- `middleware.ts` protects `/dashboard` and `/runs`, redirecting unauthenticated users to `/auth/login`.
- `src/app/(app)/dashboard/[projectId]/page.tsx` is the real project dashboard route.

Implication:

- The public page can make the product feel "broken" or "not like a dashboard" because it is intentionally not the dashboard.
- Any UX review based only on `https://kw-research.maximo-seo.ai/` will over-index on the landing page and miss the actual product.

### 1.2 Styling is loading; the problem is quality and consistency, not a global CSS outage

This is not primarily a "Tailwind/CSS failed to load" issue.

Evidence:

- `src/app/layout.tsx` imports `src/app/globals.css`.
- `tailwind.config.ts` is configured and maps many CSS variables.
- `src/components/ThemeProvider.tsx` uses `next-themes`.
- The landing/auth/dashboard code uses many Tailwind classes and theme tokens.

What is actually broken:

1. **The product has two visual systems at once**
   - A token-based system exists in `src/app/globals.css`.
   - Many components still bypass it with arbitrary radius, arbitrary shadow, hardcoded colors, and custom per-component gradients.

2. **The authenticated dashboard is too dense and fragmented**
   - `src/components/research/ResearchDashboard.tsx` is extremely large and mixes layout, data UX, tables, actions, tabs, detail panels, and summaries in one file.
   - `src/components/research/ProjectDashboardView.tsx` adds another custom tab system and domain bar above it.
   - Result: inconsistent section hierarchy, competing controls, and weak information architecture.

3. **Responsive behavior is only partially solved**
   - Many screens still depend on wide layouts, horizontal scrolling tables, sticky cells, and `min-w-*` table patterns.
   - Several major layouts still hide or degrade navigation until `xl` and rely on overflow behavior instead of mobile-first composition.

4. **Dark mode exists technically, but not as a complete product theme**
   - `tailwind.config.ts` and `globals.css` already support `.dark`.
   - However, chart colors, badges, overlap visualizations, difficulty colors, and some interactive states still use hardcoded values that do not fully participate in the theme system.

5. **Visual hierarchy is inconsistent**
   - Repeated hero treatments, card treatments, custom tab bars, and badge patterns create a "designed by file" feel instead of a unified app.
   - There is no single canonical pattern for:
     - page headers
     - filters/toolbars
     - empty/loading/error states
     - desktop vs mobile data views

### 1.3 Why it currently looks bad

#### User-facing causes

- The public root route looks like a promo splash, not a SaaS dashboard.
- The authenticated dashboard is visually busy and over-instrumented.
- Too many panels compete for attention.
- Tables and analytics sections feel cramped and "tool-like" instead of deliberate.
- Component polish varies sharply across routes.

#### Technical causes

- Theme tokens are defined but not consistently enforced.
- Design primitives are incomplete: `Card`, `Button`, `Tabs`, and page-level shells are not yet strict enough to prevent visual drift.
- Dashboard modules are too large, so one-off UI decisions accumulate.
- Data visualizations use hardcoded color logic outside the theme palette.
- The dashboard route tree does not clearly distinguish:
  - app chrome
  - page header
  - workspace/project controls
  - section navigation
  - heavy data panes

### 1.4 Root cause summary

This is a **product-UX architecture issue**, not one single broken CSS setting.

The biggest root causes are:

1. Wrong route being judged (`/` instead of `/dashboard/...`)
2. Partial design-system adoption
3. Monolithic dashboard composition
4. Hardcoded data-viz colors that break theming consistency
5. Over-dense layout and weak content prioritization

---

## Part 2: UI / Visual Fixes

This section lists exact files and what to change.

### 2.1 Public entry and auth flow

#### `src/app/page.tsx`

Problem:

- Public landing is too much like a lightweight marketing card.
- It undersells the product and makes the live app feel like a placeholder.

Change:

- Reframe this route as a **product gateway** instead of a startup splash.
- Replace the centered single-card composition with a real product landing shell:
  - top nav
  - short product explanation
  - product screenshots/feature previews
  - direct CTA to sign in
  - explicit "Dashboard requires sign-in" messaging
- Add a visible path hint to `/auth/login`.

Implementation notes:

- Convert the current centered panel into stacked sections.
- Reuse `Card` and utility classes instead of inline hero styling.
- Reduce custom shadow syntax and gradient duplication.

Representative snippet:

```tsx
<main className="page-container page-stack">
  <section className="page-hero">
    <div className="page-hero-inner">
      <p className="eyebrow">Maximo SEO</p>
      <h1 className="section-title max-w-3xl">
        Keyword research workspace for authenticated teams
      </h1>
      <p className="section-copy">
        Sign in to access site-scoped dashboards, run history, overlap analysis,
        cannibalization checks, and workbook exports.
      </p>
      <div className="action-row">
        <Link href="/auth/login"><Button size="lg">Sign in</Button></Link>
        <Link href="/auth/register"><Button variant="secondary" size="lg">Create account</Button></Link>
      </div>
    </div>
  </section>
</main>
```

#### `src/app/auth/login/page.tsx`
#### `src/app/auth/register/page.tsx`
#### `src/components/auth/AuthForm.tsx`

Problem:

- Auth pages are more polished than the main dashboard in some areas, but they still duplicate hero patterns and use route-local visual treatments.

Change:

- Standardize auth screens to the same app design language.
- Reduce decorative visual weight so auth feels like part of the product, not a separate microsite.
- Align cards, borders, spacing, and messaging with the app shell.

Specific fixes:

- Replace repeated inline hero shells with shared utility classes.
- Tighten copy and reduce decorative blur/glow.
- Add clearer redirect context styling when users are sent from protected routes.

---

### 2.2 App shell and high-level navigation

#### `src/components/app/AppShell.tsx`

Problem:

- Sidebar only appears at `xl`, which delays stable app navigation until very wide screens.
- Header/nav composition is still cramped on medium screens.
- Visual weight is inconsistent between sidebar, mobile nav, and header action areas.

Change:

- Move persistent sidebar visibility earlier (`lg` instead of `xl`) if the layout supports it.
- Normalize shell spacing and create a stricter hierarchy:
  - sidebar = navigation
  - header = project context + global actions
  - content = page-specific controls
- Add a clearer mobile/compact navigation pattern.

Specific fixes:

- Reduce duplicate "switch site / dashboard" affordances.
- Add a dedicated compact project breadcrumb.
- Make top header shorter and less card-like.

Representative snippet:

```tsx
<aside className="hidden lg:flex lg:w-72 xl:w-80 shrink-0 flex-col border-r border-border/50 bg-sidebar-bg">
```

#### `src/components/app/SiteSelectionDashboard.tsx`

Problem:

- Good structure, but still too card-heavy and visually similar across all sections.
- Workspace list and create form compete equally for attention.

Change:

- Make workspace selection primary and "create workspace" secondary.
- Collapse instructional content.
- Convert the create form into a quieter section or progressive disclosure on smaller screens.

Specific fixes:

- Replace duplicated metric rows with a more compact summary rail.
- Reduce hero height.
- Use one primary CTA for "Create workspace".

---

### 2.3 Project-level dashboard architecture

#### `src/components/research/ProjectDashboardView.tsx`

Problem:

- The domain input bar + custom tab strip + large dashboard below creates a stacked-control problem.
- Tabs look custom and disconnected from `src/components/ui/Tabs.tsx`.

Change:

- Promote this file into the canonical project header layer.
- Replace the bespoke tab bar with the shared `Tabs` primitive.
- Convert the domain input into a compact toolbar item or settings popover.

Specific fixes:

- Use one page header block with:
  - project title / market context
  - optional domain input
  - top-level section tabs
- Keep active content underneath with more breathing room.

Representative snippet:

```tsx
<section className="section-shell">
  <div className="section-header">
    <div>
      <p className="eyebrow">Project workspace</p>
      <h1 className="section-title">{project.brandName}</h1>
      <p className="section-copy">
        Research, overlap, cannibalization, and briefs in one project-scoped workspace.
      </p>
    </div>
  </div>
  <Tabs tabs={projectTabs} activeTab={activeTab} onChange={setActiveTab} />
</section>
```

#### `src/components/research/ResearchDashboard.tsx`

Problem:

- This is the main source of dashboard sprawl.
- It is too large and likely drives UI inconsistency because layout and behavior are coupled.

Change:

- Break it into page-level sections with dedicated subcomponents.
- Rebuild the page around a consistent structure:
  1. page header / run selector
  2. create run panel
  3. progress + status
  4. results toolbar
  5. main data area
  6. secondary analysis panels

New suggested extraction targets:

- `src/components/research/dashboard/ResearchDashboardHeader.tsx`
- `src/components/research/dashboard/RunCreationPanel.tsx`
- `src/components/research/dashboard/RunHistoryPanel.tsx`
- `src/components/research/dashboard/ResearchSummaryPanel.tsx`
- `src/components/research/dashboard/ResearchResultsTabs.tsx`
- `src/components/research/dashboard/ResearchExecutiveSummary.tsx`

Specific visual fixes inside the existing file:

- Reduce nested cards inside cards.
- Replace ad hoc section wrappers with `section-shell`, `panel`, `data-card`.
- Increase spacing between major sections, decrease density within toolbars.
- Standardize empty/loading/error states.
- Move some badges and helper text out of the primary visual path.

Acceptance-focused visual goals:

- One obvious primary CTA per section.
- No more than one dense toolbar per viewport band.
- No section should require deciphering more than two tiers of metadata at once.

---

### 2.4 Data display and mobile ergonomics

#### `src/components/research/KeywordTable.tsx`

Problem:

- Heavy reliance on wide tables, sticky cells, and local popovers creates a cramped "admin-grid" feel.
- Toolbar and column controls are functional but visually noisy.

Change:

- Treat the table as one view in a broader results system, not the whole UX.
- Simplify toolbar styling and reduce simultaneous controls.
- Standardize filter popovers and column menus via shared overlay primitives.

Specific fixes:

- Introduce clearer toolbar groupings:
  - search / filters
  - view controls
  - export / bulk actions
- Create visual separation between header row and data rows.
- Reduce shadow/radius variance in popovers and control pills.

#### `src/components/research/MobileKeywordView.tsx`

Problem:

- Mobile handling exists, but it still carries table assumptions and sticky mechanics that feel technical rather than mobile-native.

Change:

- Prefer card/list summaries as the default mobile pattern.
- Use the mobile table only for compact comparison mode.
- Improve spacing, tap targets, and section ordering.

Specific fixes:

- Elevate keyword name, difficulty, and intent above secondary metrics.
- Move actions into a bottom action row.
- Reduce horizontal scroll dependence.

#### `src/components/research/ResearchProcessTracker.tsx`

Problem:

- Reasonably structured, but the progress tiles still feel visually dense and operational.

Change:

- Make the current step visually dominant.
- Reduce the number of same-weight elements.
- Improve success/failure state contrast using semantic theme tokens.

---

### 2.5 Design-system primitives

#### `src/components/ui/Card.tsx`

Problem:

- Still contains inline arbitrary shadow and gradient decisions.

Change:

- Make `Card` variants token-driven only.
- Remove arbitrary `shadow-[...]` and use `shadow-elevation-*`.
- Add stricter variants for `hero`, `panel`, `interactive`, `muted`.

Representative snippet:

```tsx
const variantMap = {
  default: 'rounded-xl border border-border/60 bg-surface shadow-elevation-1',
  muted: 'rounded-xl border border-border/50 bg-surface-raised',
  interactive: 'rounded-xl border border-border/60 bg-surface shadow-elevation-1 hover:border-accent/25 hover:shadow-elevation-2',
  hero: 'rounded-2xl border border-accent/20 bg-surface shadow-elevation-3',
};
```

#### `src/components/ui/Button.tsx`

Problem:

- Button styling still encodes gradient/shadow decisions inline.

Change:

- Move primary/secondary/ghost/danger styling toward tokenized surfaces.
- Add explicit `icon-only` and `toolbar` patterns if needed.
- Ensure dark and light mode use the same semantic tokens.

#### `src/components/ui/Tabs.tsx`

Problem:

- Shared tabs are good, but `ProjectDashboardView` still bypasses them.
- Tabs need stronger "app section" and "subsection" variants.

Change:

- Add optional `variant="pill" | "underline"` to support page-level and section-level usage.

#### `src/app/globals.css`

Problem:

- Good token base, but utilities are doing too much heavy lifting while component files still bypass them.

Change:

- Add a small, explicit set of app-shell/page/toolbar/data-view utilities.
- Add chart and semantic visualization tokens.

New utility/token targets:

- `--chart-1` through `--chart-8`
- `--overlay-backdrop`
- `--focus-ring`
- `--surface-hover`
- `--surface-selected`
- `--success-strong`
- `--warning-strong`
- `--destructive-strong`

---

### 2.6 Charts, badges, and visualizations

#### `src/components/research/KeywordOverlapViz.tsx`

Problem:

- Uses multiple hardcoded hex and rgba values for venn/chart states.
- These values will not stay consistent across light/dark themes.

Change:

- Replace raw chart colors with theme-backed semantic chart tokens.
- Use a shared palette map imported from a chart utility.

#### `src/components/research/VolumeTrendChart.tsx`
#### `src/components/research/Sparkline.tsx`
#### `src/components/research/DifficultyBadge.tsx`

Problem:

- Trend and difficulty colors are still hardcoded.
- Visual semantics are not centralized.

Change:

- Create a single semantic visualization palette source.

Suggested new file:

- `src/lib/chart-theme.ts`

Representative snippet:

```ts
export const chartTheme = {
  series: [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
  ],
  positive: 'hsl(var(--success))',
  negative: 'hsl(var(--destructive))',
  neutral: 'hsl(var(--text-muted))',
  overlap: 'hsl(var(--chart-overlap))',
};
```

#### `src/components/research/ContentGapAnalysis.tsx`
#### `src/components/research/ContentBriefGenerator.tsx`
#### `src/components/research/ListCompare.tsx`
#### `src/components/research/SERPCompare.tsx`

Problem:

- These advanced views likely inherit the same density, table overflow, and per-file styling drift.

Change:

- Normalize section headers, action bars, and overflow containers.
- Audit all sticky headers and `min-w-*` tables.
- Ensure every module can collapse to a comfortable tablet layout.

---

## Part 3: Dark Mode

### 3.1 Current state

Dark mode is already partially implemented:

- `tailwind.config.ts` uses `darkMode: 'class'`
- `src/components/ThemeProvider.tsx` uses `next-themes`
- `src/components/ThemeToggle.tsx` exists
- `src/app/globals.css` defines both `:root/.light` and `.dark`

So the task is **not** to invent dark mode from scratch. The task is to make dark mode complete, reliable, and theme-wide.

### 3.2 Dark mode implementation strategy

#### Strategy

1. Keep `next-themes` and class-based theming.
2. Expand CSS variables into a full semantic token set.
3. Remove hardcoded chart/badge/viz colors from component files.
4. Add a single theme contract for:
   - surfaces
   - text
   - borders
   - semantic states
   - charts
   - overlays
   - interactive states
5. Ensure the toggle works globally from all authenticated routes.

#### Files to update

- `src/app/globals.css`
- `tailwind.config.ts`
- `src/components/ThemeProvider.tsx`
- `src/components/ThemeToggle.tsx`
- `src/components/app/AppShell.tsx`
- `src/components/research/ProjectDashboardView.tsx`
- `src/components/research/KeywordOverlapViz.tsx`
- `src/components/research/VolumeTrendChart.tsx`
- `src/components/research/Sparkline.tsx`
- `src/components/research/DifficultyBadge.tsx`
- Any file using raw hex/rgba chart colors

### 3.3 Recommended semantic palette

#### Light theme

```css
:root,
.light {
  --background: 234 30% 97%;
  --surface: 0 0% 100%;
  --surface-raised: 240 20% 98%;
  --surface-overlay: 0 0% 100%;
  --surface-inset: 234 22% 94%;
  --surface-hover: 240 24% 96%;
  --surface-selected: 254 80% 96%;

  --border: 248 18% 84%;
  --border-subtle: 248 18% 90%;

  --text-primary: 232 36% 10%;
  --text-secondary: 234 18% 34%;
  --text-muted: 236 12% 50%;
  --text-inverted: 0 0% 100%;

  --accent: 254 100% 64%;
  --accent-hover: 254 100% 58%;
  --accent-foreground: 0 0% 100%;
  --accent-muted: 254 60% 94%;
  --accent-glow: 254 100% 64%;

  --success: 152 72% 34%;
  --warning: 35 92% 52%;
  --destructive: 0 78% 56%;
  --info: 217 92% 62%;

  --chart-1: 254 100% 64%;
  --chart-2: 217 92% 62%;
  --chart-3: 152 72% 34%;
  --chart-4: 35 92% 52%;
  --chart-5: 326 78% 56%;
  --chart-6: 190 86% 44%;
  --chart-overlap: 274 76% 58%;
}
```

#### Dark theme

```css
.dark {
  --background: 228 42% 6%;
  --surface: 228 36% 10%;
  --surface-raised: 228 30% 13%;
  --surface-overlay: 228 28% 11%;
  --surface-inset: 228 38% 7%;
  --surface-hover: 228 28% 15%;
  --surface-selected: 254 44% 16%;

  --border: 248 18% 22%;
  --border-subtle: 248 18% 18%;

  --text-primary: 232 80% 97%;
  --text-secondary: 230 26% 72%;
  --text-muted: 232 16% 50%;
  --text-inverted: 228 38% 8%;

  --accent: 254 100% 72%;
  --accent-hover: 254 100% 78%;
  --accent-foreground: 0 0% 100%;
  --accent-muted: 254 42% 18%;
  --accent-glow: 254 100% 72%;

  --success: 152 72% 44%;
  --warning: 36 96% 60%;
  --destructive: 0 80% 64%;
  --info: 217 92% 68%;

  --chart-1: 254 100% 72%;
  --chart-2: 217 92% 68%;
  --chart-3: 152 72% 44%;
  --chart-4: 36 96% 60%;
  --chart-5: 326 78% 64%;
  --chart-6: 190 86% 56%;
  --chart-overlap: 274 76% 66%;
}
```

### 3.4 Theme provider strategy

#### `src/components/ThemeProvider.tsx`

Recommended:

- Keep `attribute="class"`
- Prefer `defaultTheme="system"` only if the product wants OS alignment
- Otherwise keep `defaultTheme="dark"` but explicitly document that decision in the plan and README
- Keep `storageKey="kw-research-theme"`

Suggested revision if system support is desired:

```tsx
<NextThemesProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  storageKey="kw-research-theme"
  disableTransitionOnChange
>
  {children}
</NextThemesProvider>
```

Decision note:

- If the brand wants a premium dark-first product, keep `defaultTheme="dark"` and `enableSystem={false}`.
- If broader SaaS accessibility is the goal, use system mode by default.

### 3.5 Theme toggle strategy

#### `src/components/ThemeToggle.tsx`

Change:

- Expand from a simple icon button into an accessible toggle with visible state in larger shells.
- Add `title`, `aria-pressed`, and optional label mode for sidebar/header use.
- Ensure skeleton state matches final size exactly to avoid shift.

Representative snippet:

```tsx
<button
  type="button"
  aria-label={`Switch to ${nextTheme} mode`}
  aria-pressed={theme === 'dark'}
  title={`Switch to ${nextTheme} mode`}
  className="inline-flex h-10 items-center gap-2 rounded-lg border border-border/70 bg-surface-raised px-3 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
>
  <ThemeIcon />
  <span className="hidden lg:inline text-body-sm font-medium">
    {theme === 'dark' ? 'Dark' : 'Light'}
  </span>
</button>
```

### 3.6 Tailwind mapping changes

#### `tailwind.config.ts`

Add mappings for the new tokens:

```ts
extend: {
  colors: {
    chart: {
      1: 'hsl(var(--chart-1))',
      2: 'hsl(var(--chart-2))',
      3: 'hsl(var(--chart-3))',
      4: 'hsl(var(--chart-4))',
      5: 'hsl(var(--chart-5))',
      6: 'hsl(var(--chart-6))',
      overlap: 'hsl(var(--chart-overlap))',
    },
    surface: {
      hover: 'hsl(var(--surface-hover))',
      selected: 'hsl(var(--surface-selected))',
    },
  },
}
```

### 3.7 Files needing explicit color migration

- `src/components/research/KeywordOverlapViz.tsx`
- `src/components/research/VolumeTrendChart.tsx`
- `src/components/research/Sparkline.tsx`
- `src/components/research/DifficultyBadge.tsx`
- `src/components/research/ProjectDashboardView.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Button.tsx`
- `src/app/page.tsx`
- `src/app/auth/login/page.tsx`
- `src/app/auth/register/page.tsx`

Migration rule:

- No raw hex/rgba in component logic unless required by third-party API format.
- If third-party SVG/chart APIs require strings, feed them token-derived HSL strings from a central helper.

---

## Part 4: Implementation Order

Each phase below should be independently reviewable and PR-able.

### Phase 1 — Clarify product entry points

Tasks:

1. Rework public landing into a product gateway
2. Tighten auth screens and route-recovery messaging

Files:

- `src/app/page.tsx`
- `src/app/auth/login/page.tsx`
- `src/app/auth/register/page.tsx`
- `src/components/auth/AuthForm.tsx`

Complexity: **M**

Acceptance criteria:

- Public root clearly communicates that the real product is behind authentication.
- Landing no longer feels like a placeholder card.
- Login/register pages share the same visual language as the app.
- Redirect context is visible and understandable.

### Phase 2 — Lock the design-system foundation

Tasks:

1. Expand semantic tokens in `globals.css`
2. Add chart/surface token mappings in `tailwind.config.ts`
3. Remove arbitrary shadows/radii from core primitives

Files:

- `src/app/globals.css`
- `tailwind.config.ts`
- `src/components/ui/Card.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Tabs.tsx`

Complexity: **M**

Acceptance criteria:

- Core primitives use tokenized shadows/radii/colors only.
- New semantic tokens exist for charts and interactive surfaces.
- Shared tabs can support project-level and section-level navigation.

### Phase 3 — Formalize dark mode

Tasks:

1. Finalize theme-provider policy
2. Upgrade toggle UX
3. Migrate hardcoded semantic colors into theme tokens

Files:

- `src/components/ThemeProvider.tsx`
- `src/components/ThemeToggle.tsx`
- `src/app/globals.css`
- `tailwind.config.ts`
- `src/lib/chart-theme.ts` (new)

Complexity: **M**

Acceptance criteria:

- Dark and light mode both render with coherent semantic color systems.
- Theme toggle works consistently from app shell and smaller breakpoints.
- No dashboard-critical component depends on raw hardcoded chart/status colors.

### Phase 4 — Rebuild app shell and project header

Tasks:

1. Simplify `AppShell`
2. Unify project header and top-level tabs
3. Reduce duplicated global actions

Files:

- `src/components/app/AppShell.tsx`
- `src/components/research/ProjectDashboardView.tsx`

Complexity: **L**

Acceptance criteria:

- Sidebar/header/mobile nav have one clear hierarchy.
- Project header uses shared tabs instead of bespoke tab buttons.
- Domain input no longer dominates the page.

### Phase 5 — Break apart the research dashboard

Tasks:

1. Extract page sections from `ResearchDashboard.tsx`
2. Standardize section shells and spacing
3. Clarify run creation, status, results, and analysis zones

Files:

- `src/components/research/ResearchDashboard.tsx`
- `src/components/research/dashboard/ResearchDashboardHeader.tsx` (new)
- `src/components/research/dashboard/RunCreationPanel.tsx` (new)
- `src/components/research/dashboard/RunHistoryPanel.tsx` (new)
- `src/components/research/dashboard/ResearchSummaryPanel.tsx` (new)
- `src/components/research/dashboard/ResearchResultsTabs.tsx` (new)

Complexity: **XL**

Acceptance criteria:

- `ResearchDashboard.tsx` becomes an orchestrator, not a mega-component.
- Major sections have stable layout boundaries and predictable spacing.
- Users can immediately identify where to start a run, inspect progress, and work with results.

### Phase 6 — Improve table and mobile results UX

Tasks:

1. Simplify keyword-table toolbar architecture
2. Improve mobile keyword view
3. Normalize popovers/menus/overflow regions

Files:

- `src/components/research/KeywordTable.tsx`
- `src/components/research/MobileKeywordView.tsx`
- `src/components/research/FilterPresets.tsx`
- `src/components/research/SavedSearches.tsx`
- `src/components/research/BulkActionsToolbar.tsx`

Complexity: **L**

Acceptance criteria:

- Mobile view is usable without relying on horizontal table scroll for primary tasks.
- Desktop toolbar actions are grouped logically.
- Popovers and menus match the shared design language.

### Phase 7 — Theme all charts and advanced analysis modules

Tasks:

1. Migrate overlap, trend, sparkline, and difficulty colors
2. Normalize advanced analysis layouts
3. Remove residual raw color values from core UI modules

Files:

- `src/components/research/KeywordOverlapViz.tsx`
- `src/components/research/VolumeTrendChart.tsx`
- `src/components/research/Sparkline.tsx`
- `src/components/research/DifficultyBadge.tsx`
- `src/components/research/ContentGapAnalysis.tsx`
- `src/components/research/ContentBriefGenerator.tsx`
- `src/components/research/ListCompare.tsx`
- `src/components/research/SERPCompare.tsx`

Complexity: **L**

Acceptance criteria:

- Charts render consistently in both themes.
- No advanced analysis screen visually breaks the design system.
- Remaining raw hex/rgba usage is limited to non-theme-critical assets only.

### Phase 8 — QA and regression hardening

Tasks:

1. Visual pass across public, auth, dashboard, and project routes
2. Responsive pass for mobile/tablet/laptop/desktop
3. Theme pass for dark and light modes

Files:

- `e2e/**` (if test coverage is extended)
- `UI_QA_REPORT.md` or a new QA artifact if desired

Complexity: **M**

Acceptance criteria:

- All primary routes are visually coherent at mobile, tablet, laptop, and desktop widths.
- Both themes are validated.
- No key route shows clipped navigation, unreadable text, or broken overflow behavior.

---

## Appendix A: Concrete "fix first" hotspots

Highest-value immediate targets:

1. `src/components/research/ProjectDashboardView.tsx`
2. `src/components/research/ResearchDashboard.tsx`
3. `src/components/app/AppShell.tsx`
4. `src/components/research/KeywordTable.tsx`
5. `src/components/research/MobileKeywordView.tsx`
6. `src/components/research/KeywordOverlapViz.tsx`
7. `src/components/research/VolumeTrendChart.tsx`
8. `src/components/ui/Card.tsx`
9. `src/components/ui/Button.tsx`
10. `src/app/globals.css`

---

## Appendix B: Definition of done

The overhaul is done when all of the following are true:

- Public root no longer creates confusion about where the dashboard lives.
- Authenticated app shell feels like one product, not a stack of unrelated components.
- The project dashboard has a clear hierarchy and calmer density.
- Tables and mobile results are both intentionally designed.
- Dark mode and light mode are both first-class and token-driven.
- Chart, badge, and semantic colors come from a central theme contract.
- Core layout and primitives no longer rely on arbitrary per-file visual decisions.
