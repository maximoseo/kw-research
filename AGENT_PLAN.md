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

---

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

### 4.6 Visual / interaction rules (from the Maximo design playbook)

- **No emojis or decorative unicode in product UI.**
- **CTA color theory:** Resting = lighter accent, hover = deeper accent. On dark gradients, primary CTA is white-on-deep-brand.
- **CTA spacing:** Row `gap: 14px`, button `padding: 14px 32px`, `min-width: 160px` desktop.
- **Inline links:** `font-weight: 500`, `text-decoration: underline`, hover background is `rgba(accent, .22)` pill.
- **Floating buttons:** max **two** (back-to-top + contact).
- **Hover surfaces lift, they don't recolor.**

### 4.7 Commits & PRs

- Conventional commits: `feat(dashboard): …`, `fix(theme): …`, `refactor(research): …`, `test(e2e): …`, `chore(deps): …`.
- One phase = one PR (where possible). PR description references the AGENT_PLAN section.

---

## 5. Goals (in priority order)

1. **Trustworthy authenticated dashboard.**
2. **One coherent visual system.** Tokens (light + dark) drive every surface.
3. **Real product features.** Overlap, cannibalization, content briefs, exports.
4. **Resilient pipeline.** Runs survive transient failures.
5. **Production-grade quality bars.** Strict TS, ESLint, tests, Playwright smoke.
6. **Boring deploys.** Migrations idempotent; Render boots green.

Anti-goals: framework migrations, design re-skins, adding shadcn or other UI kits.

---

## 6. Roadmap (Phases 1 → 10)

### Phase 1 — Public entry + auth polish · **M**
**DoD:** landing is a real gateway, auth pages share app language, no hardcoded gradients/hexes.

### Phase 2 — Design-system foundation · **M**
**DoD:** primitives are token-only; shadows/radii come from tokens; new chart/surface tokens shipped.

### Phase 3 — Dark mode formalization · **M**
**DoD:** light + dark render with no broken contrast; charts theme via tokens.

### Phase 4 — App shell + project header · **L**
**DoD:** sidebar visible at `lg`; one header pattern; shared `Tabs`; domain input demoted.

### Phase 5 — Decompose ResearchDashboard · **XL**
**DoD:** `ResearchDashboard.tsx` < 250 lines; subcomponents have test coverage.

### Phase 6 — Tables + mobile · **L**
**DoD:** mobile view is card-first; toolbar grouped; column visibility persisted.

### Phase 7 — Charts + analysis modules · **L**
**DoD:** zero raw hex/rgba in `src/components/research/**`.

### Phase 8 — QA + regression hardening · **M**
**DoD:** Playwright smoke covers 5 journeys; CI workflow runs lint/typecheck/test/e2e.

### Phase 9 — Backend reliability · **L**
- Resumable runs, retry, structured logging, rate-limit AI calls.
**DoD:** kill dev server mid-run → resume; AI call retries 3× then surfaces typed error.

### Phase 10 — Feature deepening · **L**
- **Overlap matrix v2** — pairwise + triadic, exportable.
- **Cannibalization heatmap**
- **Content brief diffing**
- **Saved searches sharing**
- **Workbook themes**

---

## 7. Backlog

Format: `[ID] · Phase · Estimate · Title`. Mark `[x]` when shipped.

```
[x] T-001 · P1 · S · Replace landing hero with `page-hero` utility
[x] T-002 · P1 · S · Remove inline shadows on auth pages
[x] T-003 · P2 · S · Add `--chart-5..6`, `--focus-ring` to `globals.css`
[x] T-004 · P2 · M · Map new tokens in `tailwind.config.ts`
[x] T-005 · P2 · M · Refactor `ui/Card.tsx` variants to shadow-elevation
[x] T-006 · P2 · S · Refactor `ui/Button.tsx` secondary shadow to elevation
[x] T-007 · P2 · M · Add `variant="pill"|"underline"` to `ui/Tabs.tsx`
[x] T-008 · P3 · M · Create `src/lib/chart-theme.ts`
[x] T-009 · P3 · S · Upgrade `ThemeToggle.tsx` (aria-pressed + label)
[x] T-010 · P3 · S · Document `defaultTheme` policy (`dark`)
[x] T-011 · P4 · M · Sidebar visibility at `lg:` (verified)
[x] T-012 · P4 · M · Shared `Tabs` in use (verified)
[x] T-013 · P4 · S · Demote domain input to toolbar popover
[ ] T-014 · P5 · L · Extract `ResearchDashboardHeader`
[ ] T-015 · P5 · L · Extract `RunCreationPanel`
[ ] T-016 · P5 · L · Extract `RunHistoryPanel`
[ ] T-017 · P5 · L · Extract `ResearchSummaryPanel`
[ ] T-018 · P5 · L · Extract `ResearchResultsTabs`
[ ] T-019 · P5 · L · Extract `ResearchExecutiveSummary`
[x] T-020 · P6 · M · Group `KeywordTable` toolbar (search·view·export)
[x] T-021 · P6 · M · Make `MobileKeywordView` card-first
[x] T-022 · P6 · S · Persist column visibility in localStorage
[x] T-023 · P7 · M · Migrate `KeywordOverlapViz` colors to `chart-theme`
[x] T-024 · P7 · S · Migrate `VolumeTrendChart` colors (verified)
[x] T-025 · P7 · S · Migrate `Sparkline` + `DifficultyBadge` to tokens
[x] T-026 · P7 · M · Audit all chart components for raw colors
[x] T-027 · P8 · M · Playwright smoke spec (e2e/journeys.spec.ts)
[x] T-028 · P8 · S · Add `.github/workflows/ci.yml`
[ ] T-029 · P9 · L · Pipeline step state persistence
[x] T-030 · P9 · M · Add `src/server/log.ts`; replace console.*
[x] T-031 · P9 · M · Token-bucket rate limiter
[x] T-032 · P10 · L · Overlap Matrix v2 (pairwise+triadic+export)
```

---

## 8. Definition of Done (every PR)

1. `npm run lint && npm run typecheck && npm test` pass locally.
2. No new raw hex/rgba in `src/components/**`.
3. Touched files have no `console.log` (use `src/server/log.ts`).
4. Strict TS: no new `any`, no `@ts-ignore` without a comment.
5. `AGENT_PLAN.md` backlog updated (`[ ]` → `[x]`).
6. `CHANGELOG-AGENTS.md` has a new dated entry.

### 8.1 Pre-flight grep checks

```bash
bash scripts/preflight.sh
```

---

## 9. Connecting agents

- **Claude Code** reads `CLAUDE.md`, `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, `.mcp.json`.
- **Codex** reads `AGENTS.md` which delegates to this plan.

---

## 10. Risks & known traps

- **libSQL on Render** uses `/var/data`. Local dev uses `.data/`. Test both.
- **`next-themes` flashes** without `disableTransitionOnChange`. Keep it on.
- **Firecrawl quotas** — default fan-out concurrency = 4.
- **Anthropic / OpenAI rate limits** — use retry.
- **Excel exports** — `exceljs` for new, `xlsx` for legacy.

---

Last reviewed: 2026-05-19.
