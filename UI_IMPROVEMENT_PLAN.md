# UI Improvement Plan

## Current UI/UX Problems

- The app is visually over-framed. Too many cards, chips, glows, borders, and rounded treatments compete for attention.
- Primary tasks are not obvious. The dashboard treats overview, run creation, live status, history, and navigation with similar visual weight.
- Shell context is repetitive. Sidebar, header, badges, and helper copy restate the same workspace concept instead of clarifying next actions.
- Shared components are inconsistent. Cards, buttons, badges, alerts, fields, and empty states are implemented multiple ways.
- Typography hierarchy is weak. There are too many uppercase micro-labels, similar heading sizes, and long explanatory paragraphs.
- Mobile and tablet behavior is uneven. Auth puts marketing ahead of the form, header actions compress badly, and several dashboard controls rely on wrap or overflow instead of true responsive layouts.
- Some data presentation is low quality. URLs, filenames, workbook names, and preview content are frequently truncated instead of being structured for scanability.
- Auth recovery is incomplete. Redirect intent is preserved in middleware, but stale-cookie/server-guard flows can still lose the target route.

## Root Causes

- Global tokens and utility classes encourage decorative surfaces everywhere instead of a clear surface hierarchy.
- Shared UI primitives are too thin, so feature code reimplements visual patterns locally.
- Breakpoints are not coordinated across shell and page layouts.
- Dashboard information architecture has grown around modules rather than a ranked action model.
- Auth pages optimize for hero copy on small screens instead of fast task completion.
- Inline status, alert, and feedback states lack reusable semantic components.

## Screens / Routes Affected

- `/`
- `/auth/login`
- `/auth/register`
- `/dashboard`
- `/dashboard/[projectId]`
- `/dashboard/[projectId]/runs/[runId]`
- `/runs`
- `/runs/[runId]`

## Components That Need Redesign

- Global tokens and utility shells in `src/app/globals.css`
- `src/components/ui/Card.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Tabs.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/Toast.tsx`
- New shared feedback / form primitives for alert + field wrappers
- `src/components/auth/AuthForm.tsx`
- `src/components/app/AppShell.tsx`
- `src/components/app/SiteSelectionDashboard.tsx`
- `src/components/research/ResearchDashboard.tsx`
- `src/components/research/ResearchProcessTracker.tsx`

## Responsive Strategy

- Make auth task-first on small screens by surfacing the form before the hero and compressing nonessential marketing copy.
- Remove small-screen overflow from decorative glows and toast positioning.
- Rebuild the app header into stacked mobile rows: context, actions, then nav.
- Align shell and content breakpoints so the sidebar and page grids switch modes together.
- Convert primary dashboard action rows into vertical or 2-up mobile layouts instead of relying on wrapping.
- Keep horizontal scroll only where unavoidable, mainly tabs and rich data preview.
- Improve data scanability on small screens with card-like preview rows, better wrapping, and less truncation.

## Validation Checklist

- Verify protected routes redirect correctly to `/auth/login` with redirect intent preserved.
- Verify login, register, logout, and optional Google sign-in behavior still work.
- Verify `/dashboard` site selection route still works and project selection sync remains intact.
- Verify `/dashboard/[projectId]` and run history/detail flows still render correctly.
- Verify desktop, laptop, tablet, and mobile layouts for overflow, clipping, broken wrapping, and action clarity.
- Verify hover, focus, active, loading, empty, and error states across shared controls.
- Verify console is clean during auth, dashboard navigation, and primary actions.
- Verify visual consistency across cards, buttons, badges, alerts, tables, and toasts.

## Implementation Order

1. Refine global tokens, spacing, radii, and surface hierarchy.
2. Expand shared primitives: cards, buttons, badges, tabs, alerts, fields, and empty/feedback patterns.
3. Fix auth redirect hardening and logout workspace cleanup.
4. Redesign login and register layouts with stronger mobile-first structure.
5. Simplify the shell header/sidebar and reduce repeated workspace framing.
6. Rebuild the site selector dashboard for cleaner hierarchy and better forms/cards.
7. Rebuild the project dashboard around one dominant run-creation flow, slimmer live status, and calmer history presentation.
8. Improve preview, logs, loading, empty, and status states.
9. Run validation locally, then final QA review, then document results in `UI_QA_REPORT.md`.
