# Agent Changelog

Every PR opened by an agent gets a dated entry here.

---

## 2026-05-19 — full-phase-sweep
- AGENT_PLAN tasks: 26 of 32 completed (Phases 1-4, 6-8, 9 partial, 10)
- **Phase 1-2 (Foundation)**: landing hero `page-hero`, auth verified, chart-5/6 + focus-ring tokens, Card/Button shadows → elevation, Tabs variant prop
- **Phase 3 (Dark mode)**: chart-theme.ts created, ThemeToggle upgrade (aria-pressed + label)
- **Phase 4 (App shell)**: T-011/012 already done, T-013 domain input → toolbar popover
- **Phase 5 (Decomposition)**: DEFERRED — ResearchDashboard.tsx is 2375 lines, needs dedicated PR
- **Phase 6 (Tables)**: KeywordTable toolbar grouped (search·view·export), MobileKeywordView card-first, column visibility localStorage (`kw-research:keyword-cols`)
- **Phase 7 (Charts)**: 7 raw-color fixes (KeywordOverlapViz 5 rgba, DifficultyBadge 1 gradient, ContentBriefGenerator 1 shadow)
- **Phase 8 (QA)**: e2e/journeys.spec.ts (15 tests, 5 journeys), .github/workflows/ci.yml (4 jobs: lint/typecheck/test/e2e)
- **Phase 9 (Backend)**: src/server/log.ts, src/server/rate-limit.ts, src/server/retry.ts, 31 console.log→logger replacements, retry wrapped on AI calls. T-029 (pipeline state) deferred
- **Phase 10 (Feature)**: KeywordOverlapViz: Matrix view (pairwise + triadic), CSV export, Venn↔Matrix toggle
- **Files created**: AGENT_PLAN.md, CLAUDE.md, AGENTS.md, CHANGELOG-AGENTS.md, .mcp.json, .claude/agents/ (4), .claude/skills/kw-research/SKILL.md, .codex/instructions.md, scripts/preflight.sh, src/lib/chart-theme.ts, src/server/log.ts, src/server/rate-limit.ts, src/server/retry.ts, e2e/journeys.spec.ts, .github/workflows/ci.yml
- **Files modified**: globals.css, tailwind.config.ts, Card.tsx, Button.tsx, Tabs.tsx, ThemeToggle.tsx, page.tsx, ProjectDashboardView.tsx, KeywordOverlapViz.tsx, DifficultyBadge.tsx, ContentBriefGenerator.tsx, KeywordTable.tsx, MobileKeywordView.tsx, ai.ts, competitors.ts, firecrawl.ts, pipeline.ts, worker.ts
- Verification: lint ✓ / typecheck ✓ (2 pre-existing supabase) / test ✓ (62/62) / greps ✓

## 2026-05-19 — initial-agent-bundle
- Seeded `AGENT_PLAN.md`, `CLAUDE.md`, `AGENTS.md`, `.claude/*`, `.codex/*`, `scripts/preflight.sh`.
- No code changes.
- Verification: n/a (docs only).
