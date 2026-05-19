# CLAUDE.md — Claude Code memory for `maximoseo/kw-research`

You are working on KW Research — an AI keyword-research SaaS built with Next.js 14, TypeScript strict, Drizzle/libSQL, and Tailwind 3.4. Live at <https://kw-research.maximo-seo.ai/>.

**Authoritative plan: read `AGENT_PLAN.md` before doing anything.** This file is a quick-reference companion.

## How you behave in this repo

- You favor **small, mergeable PRs** mapped to a single backlog item in `AGENT_PLAN.md §7`.
- You **never** introduce raw hex/rgba in components. Tokens only. See `src/app/globals.css`.
- You **never** add new dependencies without justifying in the PR and noting it in `CHANGELOG-AGENTS.md`.
- You **always** run `npm run lint && npm run typecheck && npm test` before declaring work done.
- You **prefer** editing existing files over creating new ones.
- You **ask once** if scope is ambiguous, then proceed.

## Tech stack (do not change without a PR)

Next.js 14 (App Router) · TS strict · Tailwind 3.4 · Drizzle + libSQL · JWT (jose+bcryptjs) · TanStack Query + Table · react-hook-form + zod · Anthropic + OpenAI · Firecrawl · exceljs · Vitest · Playwright · Render.

## Commands you will use

```bash
npm run dev         # runs migrations then starts dev server
npm run build
npm start
npm run lint
npm run typecheck
npm test
npm run migrate
npx playwright test
```

## Coding rules (the short version)

1. **Tokens, not raw colors.** Use `bg-surface`, `text-text-primary`, `border-border/60`, `shadow-elevation-1`, `rounded-xl`. For chart colors use `hsl(var(--chart-1))` etc. via `src/lib/chart-theme.ts`.
2. **Mobile-first.** Two-column layouts at `lg:`, not `xl:`.
3. **No shadcn / no Radix.** Use `src/components/ui/*`.
4. **`import 'server-only'`** at the top of any file that touches DB, secrets, or external APIs.
5. **`p-limit`** every fan-out over user input. Default concurrency 4.
6. **No `console.log` in `src/server/**`.** Use `src/server/log.ts` (create it on first need — task T-030).
7. **Theme storage key** is `kw-research-theme`. Do not rename.
8. **One CTA per section.** Density is the enemy.

### Visual rules (from the Maximo design playbook — non-negotiable)

9. **No emoji or decorative unicode in product UI.** SVG brand marks only.
10. **CTA color theory.** Resting = lighter accent, hover = deeper accent. On dark gradients, primary CTA is white-on-deep-brand; hover stays white and lifts via shadow + `translateY(-3px)`. Never blue-on-blue.
11. **CTA spacing.** Row `gap: 14px`, button `padding: 14px 32px`, `min-width: 160px` desktop, full-width mobile.
12. **Inline links** are `font-weight: 500` + `text-decoration: underline` with `text-decoration-color: rgba(accent, .35)` resting → full opacity hover. Hover background is a `rgba(accent, .22)` pill. Never bold + gray box.
13. **Max two floating buttons.** Hover inverts to surface (white), not another shade of the same family.
14. **Hover lifts, doesn't recolor** when source and target shades are too close.

## File map (essentials)

| Where | What |
|-------|------|
| `src/app/page.tsx` | public landing |
| `src/app/auth/(login\|register)/page.tsx` | auth pages |
| `src/app/(app)/dashboard/[projectId]/page.tsx` | project dashboard route |
| `src/components/ui/*` | design primitives |
| `src/components/app/AppShell.tsx` | top-level shell |
| `src/components/research/ResearchDashboard.tsx` | the mega component being decomposed in Phase 5 |
| `src/components/research/ProjectDashboardView.tsx` | project header + tab strip |
| `src/server/research/**` | AI pipeline + providers |
| `src/server/db/**` | drizzle schema + migrations |
| `middleware.ts` | JWT gate for `/dashboard`, `/runs` |

## Theme decision (Phase 3)

Default theme is **`dark`** with `enableSystem={false}`. Premium dark-first product. Revisit only if accessibility research demands it. Storage key: `kw-research-theme`.

## Subagents available

When a task fits, delegate via the Task tool to:

- `ui-designer` — Tailwind/component refactors, dark-mode work
- `backend-engineer` — Drizzle, pipeline, auth, API routes
- `test-writer` — Vitest + Playwright specs
- `reviewer` — pre-commit diff review

## Slash commands

- `/plan <task-id>` — turn an AGENT_PLAN task into a concrete patch plan
- `/new-component <Name>` — scaffold component + vitest + e2e fixture
- `/migrate-colors <file>` — replace raw hex/rgba with tokens
- `/ship` — runs the Definition of Done checklist and drafts the PR body

## Project skill

`.claude/skills/kw-research/SKILL.md` documents the token map, common pitfalls, and a cookbook of patterns.

## Before you commit

Run the DoD checklist in `AGENT_PLAN.md §8`. Update the backlog (`[ ]` → `[x]`) and `CHANGELOG-AGENTS.md` in the same commit.

## If you get stuck

- The most authoritative roadmap is `OVERHAUL-PLAN.md` (existing, in repo). Trust it over your assumptions about visual direction.
- `UI_IMPROVEMENT_PLAN.md` lists what is already shipped — don't redo it.
- If a task in `AGENT_PLAN.md §7` is ambiguous, **stop and ask in the PR description** rather than guess.
