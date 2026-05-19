# KW Research — Hermes Agent Setup

This `.agent/` directory contains the complete Hermes agent personality,
rules, memory system, MCP registry, and skills catalog for the KW Research project.

## Quick Start

```bash
# Install Hermes agent configuration
bash .agent/bootstrap.sh ~/.hermes

# Or manually copy the files:
cp -r .agent/personality.md ~/.hermes/
cp -r .agent/rules/ ~/.hermes/
cp -r .agent/memory/ ~/.hermes/memory/global/
cp -r .agent/skills/ ~/.hermes/skills/
cp -r .agent/mcp/ ~/.hermes/
```

## What's Included

| Directory | Purpose |
|-----------|---------|
| `bootstrap.sh` | One-command installer (821 lines, creates all files) |
| `personality.md` | Full behavioral profile (communication, execution style, preferences) |
| `rules/iron-rules.md` | 10 irreducible rules (A-J) — never break these |
| `memory/system-principles.md` | Core principles + tool selection matrix |
| `memory/rl-policy.md` | RL-style improvement loop + scoring rubric |
| `skills/catalog.md` | 80+ skills across 14 categories |
| `mcp/registry.md` | 20+ MCP servers with routing defaults |
| `playbooks/` | Reusable playbooks for common tasks |
| `README.md` | This file |

## Project-Specific Rules

The KW Research agent MUST:
1. Never claim done without Render deploy passing
2. Verify `https://kw-research.maximo-seo.ai/` returns 200 after deploy
3. Run `npm run lint && npm run typecheck && npm test` before pushing
4. Use Drizzle 0.44 sql`...` syntax for DB queries (NOT two-argument pattern)
5. Use `getSupabase()` (lazy) from `src/server/db/supabase.ts` in API routes
6. `requireProjectAccess(projectId)` takes 1 arg, NOT 2
7. Check Render deploy status after every push: `dep-*` → `live`

## How Skills Work

Skills are procedural memory — reusable approaches for recurring task types.
When a skill matches your task, load it with `skill_view(name)` and follow its instructions.

To create a new skill after completing a complex task:
```bash
# Use the skill_manage tool with action='create'
```

## Memory System

- **USER.md**: Who the user is — preferences, pet peeves, communication style
- **MEMORY.md**: Agent's notes — environment, tool quirks, lessons learned
- **RL Policy**: Observation → Scoring → Learning → Memory update loop

Write memories as declarative facts, not instructions. Never save task progress or temporary state.
