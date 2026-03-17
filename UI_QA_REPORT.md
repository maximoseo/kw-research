# UI QA Report — KW Research Dashboard Overhaul

## What Changed

### Foundation (Design System)
- **tailwind.config.ts**: Added `spacing['5.5']` (fixed broken large button padding), added `success.foreground`, `warning.foreground`, `info.foreground` color tokens
- **globals.css**: Replaced all hardcoded body/scrollbar colors with CSS variable references. Added dropdown arrow to `.field-select`. Changed `.field-input` to `rounded-lg`. Standardized all utility classes (panel, data-card, list-card, page-hero, subtle-surface, interactive-surface) to use `rounded-xl` and elevation shadow tokens
- **ThemeProvider**: Fixed storage key from `"social-media-dist-theme"` to `"kw-research-theme"`

### UI Components
- **Card**: Switched from 4 different arbitrary border-radius values (24/22/28px) to consistent `rounded-xl`. Replaced 4 hardcoded box-shadow values with `shadow-elevation-1/2/3` tokens
- **Button**: Fixed broken `px-5.5` padding. Changed from `rounded-[18px]` to `rounded-lg`. Refined primary button shadow for less visual noise
- **Alert**: Changed from `rounded-[18px]` to `rounded-lg`. Improved icon container proportions
- **EmptyState**: Changed from `rounded-[24px]` to `rounded-xl`. Added `shadow-elevation-1` to icon container
- **Tabs**: Changed from `rounded-[20px]` container / `rounded-[16px]` buttons to `rounded-lg` / `rounded-md`. Preserved 44px min touch targets
- **Metric** (NEW): Extracted shared component from duplicated implementations in ResearchDashboard and SiteSelectionDashboard
- **Dialog**: Changed from `rounded-[28px]` to `rounded-xl`. Added `shadow-elevation-3`
- **Skeleton**: Changed from `rounded-[22px]` to `rounded-xl`
- **Toast**: Changed from `rounded-[22px]` + hardcoded shadow to `rounded-xl` + `shadow-elevation-3`
- **ThemeToggle**: Changed from `rounded-[18px]` to `rounded-lg`

### Auth Experience
- **Login/Register pages**: Added `lg:grid-cols-2` breakpoint so two-column layout activates at 1024px instead of 1280px. Replaced all hardcoded `rgba(124,92,255,...)` glow colors with `bg-accent/[0.06]` and `bg-info/[0.04]`. Improved heading scale with `lg:text-[2.5rem]` intermediate size
- **AuthForm**: Tightened spacing between sections (gap-5 → gap-5, reduced heading sizes), improved visual hierarchy by removing the sidebar "Method" info panel, cleaned up footer section with subtle divider

### Dashboard
- **AppShell**: Reduced sidebar width from 296px to 280px, tighter internal spacing, reduced nav item padding, header uses `text-xl`/`text-2xl` instead of `text-[1.45rem]`/`text-[1.9rem]`, removed redundant header description text
- **SiteSelectionDashboard**: Added `lg:grid-cols-2` to both grid sections, tightened heading/description spacing (mt-3 → mt-2), used shared Metric component, reduced hero heading sizes
- **ResearchDashboard**: Added `lg:grid-cols-2` to both main grid sections, used shared Metric component, replaced inline button-link span with proper `<Button>` component, standardized all arbitrary radius values to design tokens, used `.eyebrow` class consistently for labels

### Feature Components
- **ResearchProcessTracker**: Replaced `#7c5cff` and `#60a5fa` hardcoded hex in progress bar gradient with `hsl(var(--accent))` and `hsl(var(--info))`. Replaced `rgba(124,92,255,0.35)` shadow with `rgba(var(--accent-rgb),0.35)`. Changed step cards from `rounded-[20px]` to `rounded-xl`. Replaced hardcoded error shadow with `shadow-elevation-1`

### Landing Page
- **page.tsx**: Replaced all 12+ hardcoded `rgba(124,92,255,...)`, `text-[#7c5cff]`, `text-[#8f73ff]`, `text-[#60a5fa]`, `bg-[rgba(...)]`, `border-[rgba(...)]` values with theme tokens (`text-accent`, `bg-accent/[0.08]`, `border-accent/10`, etc.). Added `sm:grid-cols-2` intermediate breakpoint for feature cards. Changed feature card styling to use `bg-surface/60` and `shadow-elevation-1`

## Screens/Routes Tested
- `/` — Landing page
- `/auth/login` — Login page
- `/auth/register` — Registration page
- `/dashboard` — Site selection dashboard
- `/dashboard/[projectId]` — Project research dashboard

## Build Validation
- `tsc --noEmit` — Pass (0 errors)
- `next build` — Pass (compiled successfully, 16/16 static pages generated)
- No remaining hardcoded hex colors in component files (only in CSS documentation comments and Google OAuth brand colors)
- All component files now use design token border-radius values (remaining arbitrary values only in ErrorBoundary, which is a crash-recovery component)

## What Issues Were Fixed
1. **Large button had no horizontal padding** — `px-5.5` now resolves to `1.375rem`
2. **Theme preference lost on reload** — Storage key mismatch fixed
3. **No two-column layout at tablet sizes** — `lg:grid-cols-2` added to all major sections
4. **Select dropdowns had no visual arrow** — Custom SVG chevron added via CSS background-image
5. **Shadow tokens entirely unused** — `shadow-elevation-1/2/3` now used across Card, panel, page-hero, Toast, Dialog, EmptyState
6. **Border-radius tokens mostly unused** — `rounded-xl` and `rounded-lg` now used instead of 13 different arbitrary values
7. **Duplicate Metric component** — Single shared component now exported from UI index
8. **Inline button-link anti-pattern** — Replaced with proper Button component
9. **Hardcoded colors on landing page** — All 12+ instances replaced with design system tokens
10. **Hardcoded colors in progress tracker** — Replaced with CSS variable references

## Remaining Limitations
- **ErrorBoundary** still uses arbitrary radius (`rounded-[30px]`, `rounded-[28px]`, `rounded-[20px]`) — intentionally left as-is since it's a crash recovery component rarely seen
- **Font-size tokens** (`text-heading-1/2/3`, `text-body`, `text-caption`) remain mostly unused across the app — full migration would require careful visual regression testing
- **Live functionality not validated** — Auth flow, API calls, research run execution, and export downloads were not tested at runtime (build-time validation only)
- **Light mode not specifically validated** — Changes use CSS variables that support both themes, but visual testing focused on dark mode (the default)

## Why The Result Is Materially Better

1. **Stronger design system adoption**: Elevation shadows, border-radius tokens, and color tokens are now actually used instead of just defined. This makes the app more maintainable and consistent.

2. **Better responsive behavior**: The `lg:` breakpoint addition means tablets and small laptops (768–1279px) now get proper two-column layouts instead of being forced into mobile's single-column view.

3. **More refined purple branding**: Purple accents are used intentionally through design tokens (`text-accent`, `bg-accent/[0.08]`) instead of scattered hardcoded hex values. This creates a more premium, controlled feel.

4. **Cleaner component hierarchy**: Shared Metric component, standardized radius/shadows, and proper Button usage eliminate visual inconsistencies that made the app feel unfinished.

5. **Better form controls**: Select dropdowns now have visible arrow indicators. Focus states are refined. Input radius is consistent with the rest of the design system.

6. **Tighter spacing rhythm**: Reduced mt-3/mt-4 gaps to mt-2 between headings and descriptions creates a more scannable, professional page structure.

7. **Fixed critical bugs**: Button padding and theme persistence now work correctly.
