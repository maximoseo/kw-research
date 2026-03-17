# UI Improvement Plan — KW Research Dashboard

## Current Problems Found

### Critical Bugs (Fixed)
1. **`px-5.5` undefined** — Button large size horizontal padding was broken because `spacing['5.5']` was missing from tailwind.config.ts
2. **Stale ThemeProvider key** — Storage key was `"social-media-dist-theme"` from a previous project

### Design System Inconsistencies (Fixed)
3. **13 different border-radius values** across components, despite 6 named design tokens being defined
4. **Shadow elevation tokens defined but 100% unused** — Every component used inline arbitrary shadow values
5. **Hardcoded color values on landing page** — 12+ raw `rgba(124,92,255,...)` and `#hex` values instead of theme tokens
6. **Duplicate Metric component** — Defined independently in ResearchDashboard and SiteSelectionDashboard with different styling
7. **Inline button-link pattern** — ResearchDashboard manually styled a span to look like Button instead of using the component
8. **Missing foreground color tokens** — `success.foreground`, `warning.foreground`, `info.foreground` absent from tailwind config
9. **Eyebrow label pattern duplicated 6+ times** — `.eyebrow` utility exists but was reimplemented with varying values

### Responsive Design Gaps (Fixed)
10. **No intermediate responsive breakpoints** — All two-column layouts jumped from single-column to two-column only at `xl:` (1280px)
11. **Redundant responsive padding** — InfoRow had `sm:px-4` identical to base `px-4`
12. **Auth pages used `xl:` breakpoint for two-column** — Missing `lg:` intermediate step

### Visual Quality Issues (Fixed)
13. **Select dropdowns had no arrow indicator** — `appearance-none` applied without custom dropdown arrow
14. **Body background used hardcoded color** — `hsl(226 42% 4.5%)` instead of CSS variable reference
15. **Scrollbar hover used hardcoded purple** — Raw value instead of `hsl(var(--accent))`
16. **Weak heading hierarchy** — Excessive spacing between headings and descriptions
17. **ResearchProcessTracker used hardcoded hex colors** — `#7c5cff` and `#60a5fa` instead of CSS variables

## Screens/Routes Affected
- `/` — Landing page
- `/auth/login` — Login page
- `/auth/register` — Registration page
- `/dashboard` — Site selection dashboard
- `/dashboard/[projectId]` — Project research dashboard
- `/dashboard/[projectId]/runs/[runId]` — Run detail page (inherits dashboard layout)

## Components Improved
| Component | Changes |
|---|---|
| tailwind.config.ts | Added `spacing['5.5']`, added `success/warning/info.foreground` tokens |
| globals.css | CSS var references, elevation shadows, `.field-select` arrow, `.field-input` radius, panel/hero/data-card/list-card radius standardization |
| ThemeProvider | Fixed storage key to `kw-research-theme` |
| Card | Standardized to `rounded-xl`, switched to elevation shadow tokens, improved padding scale |
| Button | Fixed `px-5.5`, used `rounded-lg`, refined shadow intensity |
| Alert | Used `rounded-lg`, improved icon container size |
| EmptyState | Used `rounded-xl` and elevation shadows, tighter proportions |
| Tabs | Used `rounded-lg`/`rounded-md`, preserved 44px touch targets on all screens |
| **Metric (NEW)** | Shared component replacing two independent duplicates |
| AppShell | Tighter sidebar (280px), better header spacing, reduced visual noise |
| AuthForm | Cleaner spacing, better visual hierarchy, tighter form layout |
| Login/Register pages | `lg:grid-cols-2` intermediate breakpoint, theme token colors |
| SiteSelectionDashboard | `lg:` breakpoints, shared Metric, tighter spacing |
| ResearchDashboard | `lg:` breakpoints, shared Metric, fixed inline button, standardized radius |
| ResearchProcessTracker | Replaced hardcoded hex colors with CSS variable references |
| Toast | Elevation shadow token, standardized radius |
| Landing page (page.tsx) | Replaced all hardcoded hex/rgba colors with design system tokens |

## Responsive Strategy
- **Mobile** (< 640px): Single column, full-width cards, stacked buttons
- **Small tablet** (640–767px): Layout adjustments via `sm:` prefix
- **Tablet** (768–1023px): Two-column grids activate via `lg:grid-cols-2` — **NEW**
- **Laptop** (1024–1279px): Two-column grids with equal widths — via `lg:` prefix
- **Desktop** (1280px+): Two-column grids with proportional widths via `xl:` prefix
- **Desktop with sidebar** (1280px+): Sidebar visible, content area adapts

## Implementation Order (Completed)
1. Foundation: tailwind.config.ts fixes (spacing, color tokens)
2. Foundation: globals.css improvements (CSS vars, utility classes, form controls)
3. Infrastructure: ThemeProvider fix
4. UI primitives: Card, Button, Alert, EmptyState, Tabs
5. New component: Shared Metric
6. Layout: AppShell improvements
7. Auth: Login/Register page + AuthForm improvements
8. Dashboard: SiteSelectionDashboard responsive + cleanup
9. Dashboard: ResearchDashboard responsive + cleanup
10. Feature: ResearchProcessTracker token adoption
11. Landing: page.tsx design system alignment
12. Peripheral: Toast radius/shadow standardization
