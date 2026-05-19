# AGENTS.md — Codex CLI memory for `maximoseo/kw-research`

> Codex agents working on this repo: read this **first**, then `AGENT_PLAN.md`.
> Most rules live in `AGENT_PLAN.md` and `CLAUDE.md` — this file points there so both Claude Code and Codex obey the same standards.

## What this repo is

KW Research — an authenticated Next.js 14 dashboard for AI-powered keyword research.
Live: <https://kw-research.maximo-seo.ai/> · Auth gates `/dashboard` and `/runs`.

## Authoritative documents (read in this order)

1. `AGENT_PLAN.md` — the master plan, phases, backlog, DoD.
2. `CLAUDE.md` — short-form coding rules and conventions.
3. `OVERHAUL-PLAN.md` — existing UX/architecture roadmap (8 phases). Trust it over assumptions.
4. `UI_IMPROVEMENT_PLAN.md` — what is already shipped (don't redo).
5. `.codex/instructions.md` — Codex-specific overrides (if any).

## Tech stack (do not change without a PR)

Next.js 14 (App Router) · TypeScript strict · Tailwind 3.4 · Drizzle + libSQL · jose+bcryptjs JWT · TanStack Query + Table · react-hook-form + zod · Anthropic + OpenAI · Firecrawl · exceljs · Vitest · Playwright · Render.

## Commands you'll use

```bash
npm ci
npm run dev          # migrates then starts on :3000
npm run lint
npm run typecheck
npm test
npx playwright test
npm run migrate
```

Every PR must pass: `npm run lint && npm run typecheck && npm test`.

## Rules (the irreducible minimum)

- **Tokens, not raw colors** anywhere in `src/components/**`. Use `bg-surface`, `text-text-primary`, `hsl(var(--chart-1))`. Greps in `AGENT_PLAN.md §8.1` enforce it.
- **Mobile-first.** Two-column layouts activate at `lg:`, not `xl:`.
- **`import 'server-only'`** in any file touching DB, secrets, or external APIs.
- **No `console.log` in `src/server/**`** — use `src/server/log.ts`.
- **No emoji or decorative unicode in product UI.**
- **CTA color theory:** lighter resting / deeper hover. White-on-dark-strip stays white on hover and lifts via shadow.
- **Max two floating buttons.** Hover inverts to surface.
- **No new deps** without a justification in the PR body.
- **No shadcn / Radix.** Use `src/components/ui/*`.
- **Theme storage key** is `kw-research-theme`. Do not rename.

## Workflow

1. Pick **one** task from `AGENT_PLAN.md §7` backlog.
2. Make the change in the smallest mergeable chunk.
3. Run `npm run lint && npm run typecheck && npm test` + the grep checks in `AGENT_PLAN.md §8.1`.
4. Run Playwright smoke if any UI changed: `npx playwright test e2e/journeys.spec.ts`.
5. Take before/after screenshots for UI changes.
6. Flip the backlog checkbox in `AGENT_PLAN.md §7`, add a `CHANGELOG-AGENTS.md` entry.
7. Open the PR. Title is conventional: `feat(dashboard): …`, `fix(theme): …`, `refactor(research): …`.
