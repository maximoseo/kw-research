# KW Research — Agent Plan

> The master plan for coding agents working on `maximoseo/kw-research`.
> Live: <https://kw-research.maximo-seo.ai/> · Repo: <https://github.com/maximoseo/kw-research>
> Read this **first**, before touching any code. Pair it with `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex).

---

## 0. How to use this document

This plan is the single source of truth for agent work on this repo. It is designed for two CLI agents:

- **Claude Code CLI** — reads `CLAUDE.md`, `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, and `.mcp.json`.
- **Codex CLI** — reads `AGENTS.md` (which points back here).

The flow for any coding session is:

1. Read this file end-to-end (or re-read your last working section).
2. Pick **one** task from the Backlog (§7) or a phase in §6.
3. Follow the **Definition of Done** in §8 before opening a PR.
4. Update `CHANGELOG-AGENTS.md` (created on first run) with what shipped.

If a request is vague ("improve the dashboard"), translate it into one or more backlog items here before writing code.

---

## 1. Product snapshot

KW Research is a SaaS keyword-research workspace. Authenticated users create projects, run AI-driven research pipelines (crawl site + competitors → discover keywords → analyze → synthesize), and export Excel workbooks.

- Public root `/` is a marketing gateway; the product lives behind `/dashboard`.
- Auth: custom JWT sessions (bcryptjs + jose).
- Pipeline: Firecrawl + Anthropic Claude + OpenAI + Keywords Everywhere.
- Output: `exceljs`/`xlsx` workbooks.

### 1.1 Top user journeys

| # | Journey | Entry route | Success state |
|---|---------|-------------|---------------|
| 1 | Sign in / register | `/auth/login`, `/auth/register` | Lands on `/dashboard` with a project list |
| 2 | Create project | `/dashboard` | New project row appears; nav into `/dashboard/[projectId]` |
| 3 | Start a research run | `/dashboard/[projectId]` | `ResearchProcessTracker` shows live progress |
| 4 | Inspect results | `/dashboard/[projectId]/runs/[runId]` | Keyword table + analysis tabs render |
| 5 | Export workbook | run page | `.xlsx` download triggers |

Agents must regress-test every change against journey 1 → 5.

---

## 2. Tech stack (authoritative)

| Layer | Choice | Notes |
|------|--------|-------|
| Framework | Next.js **14.2** (App Router) | `src/app/**` |
| Language | TypeScript **strict** | typecheck via `tsconfig.typecheck.json` |
| Styling | Tailwind **3.4** | `tailwind.config.ts`, `src/app/globals.css` |
| UI primitives | In-house (`src/components/ui/`) | No shadcn — do **not** add it |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` | |
| Data fetching | `@tanstack/react-query` (+ devtools) | |
| Tables | `@tanstack/react-table` | |
| Icons | `lucide-react` | |
| Themes | `next-themes`, class-based | storage key `kw-research-theme` |
| DB | `@libsql/client` + `drizzle-orm` | SQLite file at `.data/kw-research.db` |
| Auth | `bcryptjs` + `jose` JWT | `middleware.ts` protects `/dashboard`, `/runs` |
| AI | `@anthropic-ai/sdk`, `openai` | configurable per-run |
| Crawl | `@mendable/firecrawl-js`, `cheerio`, `fast-xml-parser` | |
| Concurrency | `p-limit` | use for fan-out fetches |
| Exports | `exceljs`, `xlsx` | |
| Tests | `vitest`, `@playwright/test`, `@testing-library/react`, `jsdom` | |
| Deploy | Render (`render.yaml`), persistent disk at `/var/data` | |

### 2.1 Scripts

```bash
npm ci                  # install
npm run dev             # migrate + next dev (port 3000)
npm run build           # next build
npm start               # migrate + next start
npm run lint            # ESLint (next/core-web-vitals)
npm run typecheck       # tsc strict against tsconfig.typecheck.json
npm test                # vitest run --passWithNoTests
npm run migrate         # tsx scripts/migrate.ts
npx playwright test     # e2e/
```

Every agent PR must pass: `npm run lint && npm run typecheck && npm test`.


## 3. Repository map

```
.
├── src/
│   ├── app/                       # Next.js App Router (pages + API routes)
│   │   ├── page.tsx               # public landing
│   │   ├── auth/(login|register)/page.tsx
│   │   └── (app)/dashboard/[projectId]/page.tsx
│   ├── components/
│   │   ├── ui/                    # Card, Button, Tabs, Alert, EmptyState, Metric, Toast …
│   │   ├── app/                   # AppShell, SiteSelectionDashboard
│   │   ├── auth/                  # AuthForm
│   │   ├── research/              # ResearchDashboard, ProjectDashboardView, KeywordTable,
│   │   │                          # MobileKeywordView, ResearchProcessTracker,
│   │   │                          # KeywordOverlapViz, VolumeTrendChart, Sparkline,
│   │   │                          # DifficultyBadge, ContentGapAnalysis,
│   │   │                          # ContentBriefGenerator, ListCompare, SERPCompare,
│   │   │                          # FilterPresets, SavedSearches, BulkActionsToolbar
│   │   ├── ThemeProvider.tsx
│   │   └── ThemeToggle.tsx
│   ├── hooks/
│   ├── lib/                       # shared utilities + types  (add chart-theme.ts here)
│   └── server/
│       ├── auth/                  # session, password, OAuth
│       ├── db/                    # drizzle schema + migrations
│       ├── files/                 # file storage helpers
│       └── research/              # AI pipeline + agents
├── e2e/                           # Playwright specs
├── qa-fixtures/                   # canned data for QA
├── scripts/migrate.ts             # runs Drizzle migrations
├── middleware.ts                  # JWT gate for /dashboard, /runs
├── render.yaml                    # Render deploy
└── AGENT_PLAN.md                  # ← you are here
```

The two markdown plans in the repo (`OVERHAUL-PLAN.md`, `UI_IMPROVEMENT_PLAN.md`) are **authoritative** for visual/architecture direction. This file orchestrates the work.

---

## 4. Conventions agents must follow

### 4.1 TypeScript

- Strict mode. No `any` unless wrapped in a comment explaining why.
- Prefer `import type { … }` for type-only imports.
- Co-locate types next to the component that uses them; promote to `src/lib/types.ts` only on second use.
- Server-only code: top of file `import 'server-only'` when handling secrets, DB, or external APIs.

### 4.2 Styling

- **Never** introduce raw hex/rgba in components. Use CSS variables from `globals.css` via Tailwind tokens (`bg-surface`, `text-text-primary`, `hsl(var(--chart-1))`, …).
- **Never** add arbitrary `shadow-[...]`. Use `shadow-elevation-1|2|3`.
- Border radius is one of: `rounded-md | rounded-lg | rounded-xl | rounded-2xl`. No bespoke values.
- Mobile-first. Two-column layouts activate at `lg:` (1024 px), not `xl:`.
- New components live in `src/components/ui/` only if reusable across ≥2 features; otherwise scope them locally.

### 4.3 Data layer

- All DB access goes through Drizzle in `src/server/db/`.
- Mutations run server-side (Server Actions or route handlers). Client mutations call them via React Query.
- Validate every external input with `zod` at the boundary.

### 4.4 AI calls

- Wrap every AI provider behind `src/server/research/providers/*`. Keep prompts in `src/server/research/prompts/*` so they are diffable.
- Token costs and latencies are logged via the run-tracking helpers.
- Use `p-limit` for fan-out; never `Promise.all` unbounded over user input.

### 4.5 Accessibility & responsiveness

- Every interactive element must be reachable with keyboard; visible focus ring uses `--focus-ring`.
- Touch targets ≥ 44 × 44 px on mobile.
- Run `npx playwright test --project=mobile` for any visual change.

### 4.6 Visual / interaction rules (adopted from the Maximo design playbook)

These are imported from the broader Maximo design rule set and apply to the dashboard UI. They are non-negotiable and enforced by the pre-flight checks in §8.

- **No emojis or decorative unicode in product UI.** Forbidden in headings, eyebrows, callout titles, list bullets, CTA labels, badges. Allowed only for inline-SVG brand marks (social icons) and CSS-drawn shapes.
- **CTA color theory.**
  - Resting fill = the **lighter** brand blue (`accent`), hover = the **deeper** brand blue. Never resting-on-deep — the white text gets visually swallowed.
  - On dark gradient strips: primary CTA is **white background + deep-brand text**, hover stays white and adds elevation (`translateY(-3px)`, deeper shadow) — never hover into a blue that merges with the gradient.
  - Outline CTA on dark: hover fills with white solid + deep-brand text.
- **CTA spacing is generous.** `gap: 14px` on rows (16 px on banners), button padding `14px 32px`, `min-width: 160px` on desktop, full-width on mobile. Banner padding `38px 40px` desktop, `28px 22px` mobile.
- **Inline links** are medium weight (`font-weight: 500`), use real `text-decoration: underline` with `text-decoration-color: rgba(accent, .35)` resting → full opacity on hover. Hover background is a low-alpha pill (`rgba(accent, .22)`). **Never** bold + gray-box hover.
- **Floating buttons:** max **two** (back-to-top + contact / help). No three-button clusters. Hover inverts to the surface color (white) — never another shade of the same blue family.
- **Generous spacing on author / About cards.** `padding: 36px 40px` on desktop, soft elevation (`shadow-elevation-2`), accent left-border 4 px in the active brand color.
- **Hover surfaces lift, they don't recolor.** When a card / button is on the same color family as the surface, lift it with shadow + `translateY` — don't change the fill into a neighboring shade.

### 4.7 Commits & PRs

- Conventional commits: `feat(dashboard): …`, `fix(theme): …`, `refactor(research): …`, `test(e2e): …`, `chore(deps): …`.
- One phase = one PR (where possible). PR description references the AGENT_PLAN section it satisfies.
- Always include before/after screenshots for UI work.

---

## 5. Goals (in priority order)

1. **Trustworthy authenticated dashboard.** Users land in `/dashboard`, immediately understand where they are, what to do, and the state of their data.
2. **One coherent visual system.** Tokens (light + dark) drive every surface — no per-file color drift.
3. **Real product features.** Overlap, cannibalization, content briefs, exports work end-to-end with live AI + metrics data.
4. **Resilient pipeline.** Runs survive transient AI/Firecrawl failures, expose progress, and can be resumed.
5. **Production-grade quality bars.** Strict TypeScript, ESLint clean, ≥ basic unit coverage on `src/lib` and `src/server`, Playwright smoke on the five journeys in §1.1.
6. **Boring deploys.** Migrations idempotent; Render boots green; no manual steps.

Anti-goals: framework migrations, design re-skins driven by trends, adding shadcn or other UI kits.

---

## 6. Roadmap (Phases 1 → 10)

### Phase 1 — Public entry + auth polish · **M**
Source: OVERHAUL-PLAN §2.1. Files: `src/app/page.tsx`, `src/app/auth/(login|register)/page.tsx`, `src/components/auth/AuthForm.tsx`.
**DoD:** landing is a real gateway, auth pages share app language, redirect context is visible, no hardcoded gradients/hexes.

### Phase 2 — Design-system foundation · **M**
Source: OVERHAUL-PLAN §2.5. Files: `src/app/globals.css`, `tailwind.config.ts`, `src/components/ui/{Card,Button,Tabs}.tsx`.
**DoD:** primitives are token-only; shadows/radii come from tokens; new chart/surface tokens shipped.

### Phase 3 — Dark mode formalization · **M**
Source: OVERHAUL-PLAN §3. Files: `ThemeProvider.tsx`, `ThemeToggle.tsx`, `globals.css`, `tailwind.config.ts`, **new** `src/lib/chart-theme.ts`.
**DoD:** light + dark render with no broken contrast; toggle reachable from sidebar and header; charts theme via tokens.

### Phase 4 — App shell + project header · **L**
Source: OVERHAUL-PLAN §2.2 – 2.3. Files: `AppShell.tsx`, `ProjectDashboardView.tsx`.
**DoD:** sidebar visible at `lg`; one header pattern; shared `Tabs` replaces the bespoke project tab strip; domain input demoted to a toolbar item.

### Phase 5 — Decompose ResearchDashboard · **XL**
Extract into `src/components/research/dashboard/{Header,RunCreationPanel,RunHistoryPanel,SummaryPanel,ResultsTabs,ExecutiveSummary}.tsx`.
**DoD:** `ResearchDashboard.tsx` < 250 lines; subcomponents have test coverage; no nested cards-inside-cards.

### Phase 6 — Tables + mobile · **L**
Files: `KeywordTable.tsx`, `MobileKeywordView.tsx`, `FilterPresets.tsx`, `SavedSearches.tsx`, `BulkActionsToolbar.tsx`.
**DoD:** mobile view is card-first; toolbar grouped; column visibility persisted per-user in `localStorage`.

### Phase 7 — Charts + analysis modules · **L**
Migrate every chart to `chart-theme.ts`. Files: `KeywordOverlapViz.tsx`, `VolumeTrendChart.tsx`, `Sparkline.tsx`, `DifficultyBadge.tsx`, `ContentGapAnalysis.tsx`, `ContentBriefGenerator.tsx`, `ListCompare.tsx`, `SERPCompare.tsx`.
**DoD:** zero raw hex/rgba in `src/components/research/**`.

### Phase 8 — QA + regression hardening · **M**
Files: `e2e/**`, `vitest.config.ts`, `UI_QA_REPORT.md`.
**DoD:** Playwright smoke covers the 5 journeys in §1.1; CI workflow file runs lint/typecheck/test/e2e on PRs.

### Phase 9 — Backend reliability · **L** (new)
Files: `src/server/research/**`, `src/server/db/**`, `scripts/migrate.ts`.
- Resumable runs, retry with exponential backoff, structured logging, rate-limit AI calls per-user.
**DoD:** kill dev server mid-run, restart, run resumes; failing AI call retries 3× then surfaces typed error.

### Phase 10 — Feature deepening · **L** (new)
- **Overlap matrix v2** — pairwise + triadic, exportable.
- **Cannibalization heatmap** — page × keyword conflicts highlighted.
- **Content brief diffing** — show diff between two brief versions.
- **Saved searches sharing** — URL-encoded filter state for handoffs.
- **Workbook themes** — branded Excel output via `exceljs` styles.

---

## 7. Backlog (atomic tasks agents can pick up)

Format: `[ID] · Phase · Estimate · Title`. Mark `[x]` here when shipped.

```
[x] T-001 · P1 · S · Replace landing hero with `page-hero` utility on `src/app/page.tsx`
[x] T-002 · P1 · S · Remove inline shadows on auth pages; switch to `shadow-elevation-1`
[x] T-003 · P2 · S · Add `--chart-5..6`, `--focus-ring` to `globals.css`
[x] T-004 · P2 · M · Map new tokens in `tailwind.config.ts` (chart-5/6)
[x] T-005 · P2 · M · Refactor `ui/Card.tsx` variants to shadow-elevation tokens
[x] T-006 · P2 · S · Refactor `ui/Button.tsx` secondary shadow to elevation tokens (primary gradient retained)
[x] T-007 · P2 · M · Add `variant="pill"|"underline"` to `ui/Tabs.tsx`
[x] T-008 · P3 · M · Create `src/lib/chart-theme.ts`
[x] T-009 · P3 · S · Upgrade `ThemeToggle.tsx` to labeled toggle with `aria-pressed`
[x] T-010 · P3 · S · Document `defaultTheme` policy (`dark`) in `CLAUDE.md`
[x] T-011 · P4 · M · Sidebar visibility already at `lg:` in AppShell.tsx (verified)
[x] T-012 · P4 · M · Shared `Tabs` already in use in ProjectDashboardView.tsx (verified)
[x] T-013 · P4 · S · Demote domain input to toolbar popover
[ ] T-014 · P5 · L · Extract `ResearchDashboardHeader` component
[ ] T-015 · P5 · L · Extract `RunCreationPanel` component
[ ] T-016 · P5 · L · Extract `RunHistoryPanel` component
[ ] T-017 · P5 · L · Extract `ResearchSummaryPanel` component
[ ] T-018 · P5 · L · Extract `ResearchResultsTabs` component
[ ] T-019 · P5 · L · Extract `ResearchExecutiveSummary` component
[x] T-020 · P6 · M · Group `KeywordTable` toolbar into (search · view · export)
[x] T-021 · P6 · M · Make `MobileKeywordView` card-first; move actions to bottom row
[x] T-022 · P6 · S · Persist column visibility in `localStorage` (`kw-research:keyword-cols`)
[x] T-023 · P7 · M · Migrate `KeywordOverlapViz` colors to `chart-theme`
[x] T-024 · P7 · S · Migrate `VolumeTrendChart` colors to `chart-theme` (verified — no raw colors)
[x] T-025 · P7 · S · Migrate `Sparkline` + `DifficultyBadge` to tokens
[x] T-026 · P7 · M · Audit all chart/analysis components for raw colors (7 fixes across 3 files)
[x] T-027 · P8 · M · Playwright smoke spec for the 5 journeys (`e2e/journeys.spec.ts`)
[x] T-028 · P8 · S · Add `.github/workflows/ci.yml` running lint/typecheck/test/e2e
[ ] T-029 · P9 · L · Persist pipeline step state in libSQL; resume on restart
[x] T-030 · P9 · M · Add `src/server/log.ts`; replace `console.*` in `src/server/**`
[x] T-031 · P9 · M · Token-bucket rate limiter per-user for AI calls
[x] T-032 · P10 · L · Implement Overlap Matrix v2 (pairwise + triadic + export)
```

---

## 8. Definition of Done (every PR)

A PR is mergeable when **all** are true:

1. `npm run lint && npm run typecheck && npm test` pass locally.
2. Playwright smoke (`e2e/journeys.spec.ts`) passes in light and dark mode (once created in P8).
3. No new raw hex/rgba in `src/components/**` (grep `#[0-9a-fA-F]{3,8}` and `rgba(`).
4. Touched files have no `console.log` (use `src/server/log.ts` on the server).
5. Strict TS: no new `any`, no `@ts-ignore` without a comment.
6. PR description links the AGENT_PLAN task ID(s) and the OVERHAUL-PLAN phase.
7. Before/after screenshots attached for any UI change.
8. `AGENT_PLAN.md` backlog updated (`[ ]` → `[x]`).
9. `CHANGELOG-AGENTS.md` has a new dated entry.

### 8.1 Pre-flight grep checks

```bash
bash scripts/preflight.sh
```

---

## 9. Connecting agents (Claude Code & Codex)

- **Claude Code** reads `CLAUDE.md`, `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, `.mcp.json`.
- **Codex** reads `AGENTS.md` which delegates to this plan.

---

## 10. Risks & known traps

- **libSQL on Render** uses a 5 GB persistent disk at `/var/data`. Local dev writes to `.data/`. Migrations must work in both.
- **`next-themes` + Tailwind `darkMode: 'class'`** — flashes if `disableTransitionOnChange` isn't set. Leave it on.
- **Firecrawl quotas** — fan-out crawls without `p-limit` will burn budget. Default concurrency = 4.
- **Anthropic / OpenAI rate limits** — wrap every call in the retry helper added in T-029.
- **Excel exports** — `exceljs` ≠ `xlsx`. Use `exceljs` for new exports (styling); `xlsx` only for legacy reads.

---

## 11. Maintenance

Update this file when:
- You add a new phase or change estimates.
- You ship a backlog item (flip the checkbox in §7).
- A convention in §4 evolves (e.g., new icon library).
- A new MCP or skill becomes part of the standard workflow.

Last reviewed: 2026-05-19.
