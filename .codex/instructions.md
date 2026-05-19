# Codex CLI — kw-research extras

Codex inherits all rules from `AGENTS.md` (which points to `AGENT_PLAN.md` + `CLAUDE.md`). This file is for Codex-specific overrides only.

## Trust order

1. `AGENT_PLAN.md` (master)
2. `AGENTS.md` (this is what Codex auto-loads)
3. `CLAUDE.md` (mirror — same rules)
4. `OVERHAUL-PLAN.md` (visual direction)
5. `UI_IMPROVEMENT_PLAN.md` (what's already shipped)

## Codex-specific reminders

- Codex does **not** read `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, or `.mcp.json`. The rules they encode are mirrored in `AGENTS.md` and `AGENT_PLAN.md` so Codex still obeys them.
- When asked to "plan", produce the same shape as Claude's `/plan` command template.
- When asked to "ship", run the DoD list from `AGENT_PLAN.md §8` + the greps in `§8.1`. Do not push.
- Honor `.gitignore` strictly. Never commit `.data/`, `.env.local`, `playwright-report/`, `test-results/`.
