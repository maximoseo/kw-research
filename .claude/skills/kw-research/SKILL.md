---
name: kw-research
description: Project-specific knowledge — token map, file map, anti-patterns, recipes. Auto-loads in this repo.
---

# kw-research — Project Skill

Loaded automatically by Claude Code when working in this repo. Companion to `CLAUDE.md` and `AGENT_PLAN.md`.

## Token map (cheat sheet)

### Surfaces
| Tailwind class | CSS var | Use |
|----------------|---------|-----|
| `bg-background` | `--background` | page bg |
| `bg-surface` | `--surface` | cards, panels |
| `bg-surface-raised` | `--surface-raised` | subtle elevated bg |
| `bg-surface-hover` | `--surface-hover` | hover state |
| `bg-surface-selected` | `--surface-selected` | selected row / tab |

### Text
| Class | Var | Use |
|-------|-----|-----|
| `text-text-primary` | `--text-primary` | body copy |
| `text-text-secondary` | `--text-secondary` | supporting copy |
| `text-text-muted` | `--text-muted` | meta, labels |
| `text-text-inverted` | `--text-inverted` | text on accent fills |

### Accent (brand)
| Class | Var | Use |
|-------|-----|-----|
| `bg-accent` / `text-accent` | `--accent` | primary brand |
| `bg-accent-hover` | `--accent-hover` | hover |
| `text-accent-foreground` | `--accent-foreground` | text on accent |
| `bg-accent-muted` | `--accent-muted` | low-emphasis fills |

### Semantic
| Class | Var |
|-------|-----|
| `bg-success / text-success` | `--success` |
| `bg-warning / text-warning` | `--warning` |
| `bg-destructive / text-destructive` | `--destructive` |
| `bg-info / text-info` | `--info` |

### Charts (use via `src/lib/chart-theme.ts`)
| Var | Role |
|-----|------|
| `--chart-1` | primary series |
| `--chart-2` | secondary series |
| `--chart-3` | tertiary |
| `--chart-4` | extra series |
| `--chart-overlap` | overlap viz |

### Elevation & radius
- Shadow: `shadow-elevation-1`, `-2`, `-3`. **Never** `shadow-[...]`.
- Radius: `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`. **Never** bespoke values.
- Focus: `focus-visible:ring-[hsl(var(--focus-ring))]`.

## Anti-patterns

1. Raw hex / rgba in components → Use tokens
2. `shadow-[...]` arbitrary shadows → Use `shadow-elevation-1|2|3`
3. Bespoke `rounded-[Xpx]` → Pick from radius set
4. `xl:grid-cols-2` for two-column → Use `lg:`
5. `console.log` in `src/server/**` → Use `src/server/log.ts`
6. `any` / `@ts-ignore` without comment → Justify or refactor
7. `Promise.all` over user input → Use `p-limit`
8. New deps without PR justification
9. Three+ floating buttons → Max two
10. Emojis in product UI → SVG brand marks only
11. CTA hover recolors into same-family background → Lift instead
