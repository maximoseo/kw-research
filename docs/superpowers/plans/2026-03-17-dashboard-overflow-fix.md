# Dashboard Overflow Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- []`) syntax for tracking.

**Goal:** Fix all text and button overflow issues across the dashboard pages where content breaks out of its container boxes.

**Architecture:** Add `min-w-0`, `truncate`, `overflow-hidden`, and `break-words` classes to specific flex children and containers. No component restructuring needed — purely CSS class additions.

**Tech Stack:** Tailwind CSS, React (Next.js App Router)

---

## Overflow Audit Findings

### Root Cause Pattern
Most overflow issues stem from two CSS patterns:
1. **Flex children without `min-w-0`** — flex items default to `min-width: auto`, meaning long text refuses to shrink below its intrinsic width and overflows
2. **Grid children without `overflow-hidden`** — grid cells allow children to overflow their bounds
3. **Long unbroken strings** — URLs and identifiers have no `break-all` or `truncate`

### Files Requiring Changes

| # | File | Issue |
|---|------|-------|
| 1 | `Card.tsx` | `overflow-hidden` clips content that should wrap; needs `overflow-visible` with selective clip |
| 2 | `SiteSelectionDashboard.tsx` | Metric helper text overflows; URL toolbar-chips overflow; form inputs in tight grid |
| 3 | `AppShell.tsx` | Sidebar text overflow in nav links; brand name/email overflow; mobile nav overflow |
| 4 | `ResearchDashboard.tsx` | Metric values overflow (brand names, timestamps); InfoRow URLs overflow; button groups overflow in flex; PreviewTable long text |
| 5 | `ResearchProcessTracker.tsx` | Step description text overflow; status badge overflow |
| 6 | `Tabs.tsx` | Fade gradients reference `from-surface` which may not match actual card bg |
| 7 | `Button.tsx` | Button text can overflow its min-height container; long text needs truncation |

---

## Chunk 1: Core UI Components

### Task 1: Fix Card.tsx overflow behavior

**Files:**
- Modify: `src/components/ui/Card.tsx`

- [ ] **Step 1: Remove `overflow-hidden`, add `overflow-visible` to Card**

Change the Card to use `overflow-visible` by default. The `overflow-hidden` is causing child content to be clipped when it wraps or when flex items expand.

```tsx
// BEFORE:
'relative isolate overflow-hidden rounded-2xl border border-accent/10 bg-surface-raised/70 shadow-elevation backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/10 transition-all duration-300 hover:border-accent/25 hover:shadow-[0_8px_32px_rgba(var(--accent-rgb),0.08)]',

// AFTER:
'relative isolate rounded-2xl border border-accent/10 bg-surface-raised/70 shadow-elevation backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/10 transition-all duration-300 hover:border-accent/25 hover:shadow-[0_8px_32px_rgba(var(--accent-rgb),0.08)] overflow-visible',
```

- [ ] **Step 2: Build check**

Run: `cd /d C:\Users\seoadmin\kw-research && npx tsc --noEmit && npm run lint && npm run build`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Card.tsx
git commit -m "fix: remove overflow-hidden from Card to prevent content clipping"
```

### Task 2: Fix Button.tsx long text handling

**Files:**
- Modify: `src/components/ui/Button.tsx`

- [ ] **Step 1: Add text truncation to button inner text**

Wrap children in a `<span className="truncate">` to prevent long button labels from breaking layout.

```tsx
// Change line 53-54 FROM:
{loading ? <Spinner /> : icon}
{children}

// TO:
{loading ? <Spinner /> : icon}
<span className="truncate">{children}</span>
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "fix: truncate button text to prevent overflow"
```

### Task 3: Fix Tabs.tsx fade gradient colors

**Files:**
- Modify: `src/components/ui/Tabs.tsx`

- [ ] **Step 1: Update fade gradient to use surface-raised for better visual match**

```tsx
// BEFORE (line 46):
<div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-surface to-transparent" />
// AFTER:
<div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-[hsl(var(--surface-overlay))] to-transparent" />

// BEFORE (line 71):
<div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-surface to-transparent" />
// AFTER:
<div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-[hsl(var(--surface-overlay))] to-transparent" />
```

- [ ] **Step 2: Build check + commit**

```bash
git add src/components/ui/Tabs.tsx
git commit -m "fix: match Tabs fade gradient to surface-overlay color"
```

---

## Chunk 2: Site Selection Dashboard

### Task 4: Fix Metric component overflow in SiteSelectionDashboard

**Files:**
- Modify: `src/components/app/SiteSelectionDashboard.tsx`

The `Metric` component at line 291-308 needs `min-w-0` (flex context) and `overflow-hidden`, plus `break-words` on the value and `truncate` on the helper.

- [ ] **Step 1: Add overflow protection to Metric**

```tsx
// BEFORE (line 303):
<div className="rounded-lg border border-border/60 bg-surface-raised/70 px-4 py-3">
  <p className="text-xs uppercase tracking-[0.22em] text-text-muted">{label}</p>
  <p className={cn('mt-2 font-semibold text-text-primary', compact ? 'text-base' : 'text-2xl')}>{value}</p>
  <p className="mt-2 text-sm leading-6 text-text-secondary">{helper}</p>
</div>

// AFTER:
<div className="rounded-lg border border-border/60 bg-surface-raised/70 px-4 py-3 overflow-hidden min-w-0">
  <p className="text-xs uppercase tracking-[0.22em] text-text-muted truncate">{label}</p>
  <p className={cn('mt-2 font-semibold text-text-primary break-words', compact ? 'text-base' : 'text-2xl')}>{value}</p>
  <p className="mt-2 text-sm leading-6 text-text-secondary line-clamp-2">{helper}</p>
</div>
```

- [ ] **Step 2: Fix toolbar-chip URL overflow**

The URL chips at line 200-202 need truncation:

```tsx
// BEFORE (line 200-202):
<div className="mt-5 flex flex-wrap gap-2 text-xs text-text-muted">
  <span className="toolbar-chip border-border/60">{project.homepageUrl}</span>
  <span className="toolbar-chip border-border/60">{project.sitemapUrl}</span>
</div>

// AFTER:
<div className="mt-5 flex flex-wrap gap-2 text-xs text-text-muted min-w-0">
  <span className="toolbar-chip border-border/60 max-w-[260px] truncate">{project.homepageUrl}</span>
  <span className="toolbar-chip border-border/60 max-w-[260px] truncate">{project.sitemapUrl}</span>
</div>
```

- [ ] **Step 3: Fix grid layout cards for mobile**

The top hero section grid needs `overflow-hidden` on its children for tight grid cells:

```tsx
// BEFORE (line 89):
<section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
  <Card padding="none" className="rounded-2xl border-border/70">

// AFTER:
<section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
  <Card padding="none" className="rounded-2xl border-border/70 overflow-hidden">
```

- [ ] **Step 4: Build check + commit**

```bash
git add src/components/app/SiteSelectionDashboard.tsx
git commit -m "fix: prevent Metric, toolbar-chip, and card overflow on dashboard"
```

---

## Chunk 3: AppShell Sidebar

### Task 5: Fix AppShell sidebar text overflow

**Files:**
- Modify: `src/components/app/AppShell.tsx`

- [ ] **Step 1: Add `min-w-0` and `truncate` to sidebar brand name and email**

```tsx
// BEFORE (line 99-101):
<p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
<p className="truncate text-xs text-white/50">{user.email}</p>

// These already have truncate — good. BUT the parent div needs min-w-0:
// BEFORE (line 99):
<div className="min-w-0">
  <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
  <p className="truncate text-xs text-white/50">{user.email}</p>
</div>
```

This is already correct. Now check the project brand name in sidebar:

```tsx
// BEFORE (line 44-45):
<p className="text-base font-semibold text-white">{project.brandName}</p>
<p className="text-sm text-white/58">{project.market} · {project.language}</p>

// AFTER:
<p className="text-base font-semibold text-white truncate">{project.brandName}</p>
<p className="text-sm text-white/58 truncate">{project.market} · {project.language}</p>
```

And add `min-w-0` to the parent div:

```tsx
// BEFORE (line 43):
<div>
  <p className="text-base font-semibold text-white truncate">{project.brandName}</p>

// AFTER:
<div className="min-w-0">
  <p className="text-base font-semibold text-white truncate">{project.brandName}</p>
```

- [ ] **Step 2: Fix header toolbar-chip overflow on mobile**

```tsx
// BEFORE (line 121-123):
<span className="toolbar-chip hidden sm:inline-flex border-accent/10">
  {project.brandName} · {project.market}
</span>

// AFTER:
<span className="toolbar-chip hidden sm:inline-flex border-accent/10 max-w-[220px] truncate">
  {project.brandName} · {project.market}
</span>
```

- [ ] **Step 3: Fix mobile nav link wrapping**

```tsx
// BEFORE (line 150):
className={cn(
  'whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-all',

// AFTER — remove whitespace-nowrap to allow wrapping on very small screens:
className={cn(
  'rounded-full border px-3.5 py-2 text-sm font-medium transition-all whitespace-nowrap',
```
(This is fine — whitespace-nowrap is correct for horizontal scroll. The parent div at line 145 already has `overflow-x-auto`.)

- [ ] **Step 4: Build check + commit**

```bash
git add src/components/app/AppShell.tsx
git commit -m "fix: prevent text overflow in AppShell sidebar and header"
```

---

## Chunk 4: Research Dashboard

### Task 6: Fix Metric overflow in ResearchDashboard

**Files:**
- Modify: `src/components/research/ResearchDashboard.tsx`

The Metric component in ResearchDashboard (line 401-403) has the same overflow issue as the one in SiteSelectionDashboard:

- [ ] **Step 1: Fix ResearchDashboard Metric**

```tsx
// BEFORE (line 402):
function Metric({ label, value, helper, compact = false }: { label: string; value: string; helper: string; compact?: boolean }) {
  return <div className="rounded-lg border border-border/60 bg-surface-raised/70 px-4 py-3"><p className="text-xs uppercase tracking-[0.22em] text-text-muted">{label}</p><p className={cn('mt-2 font-semibold text-text-primary', compact ? 'text-base' : 'text-2xl')}>{value}</p><p className="mt-2 text-sm leading-6 text-text-secondary">{helper}</p></div>;
}

// AFTER:
function Metric({ label, value, helper, compact = false }: { label: string; value: string; helper: string; compact?: boolean }) {
  return <div className="rounded-lg border border-border/60 bg-surface-raised/70 px-4 py-3 overflow-hidden min-w-0"><p className="text-xs uppercase tracking-[0.22em] text-text-muted truncate">{label}</p><p className={cn('mt-2 font-semibold text-text-primary break-words', compact ? 'text-base' : 'text-2xl')}>{value}</p><p className="mt-2 text-sm leading-6 text-text-secondary line-clamp-2">{helper}</p></div>;
}
```

- [ ] **Step 2: Fix InfoRow URL overflow**

The `InfoRow` component at line 360-366 has a `truncate` link but the parent div needs `overflow-hidden`:

```tsx
// BEFORE (line 362-366):
<div className="rounded-xl border border-border/70 bg-surface-raised/65 px-4 py-4">
  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
  {multiline ? <p className="mt-3 leading-6">{value}</p> : <a href={value} target="_blank" rel="noreferrer" className="mt-3 block truncate text-accent hover:underline">{value}</a>}
</div>

// AFTER:
<div className="rounded-xl border border-border/70 bg-surface-raised/65 px-4 py-4 overflow-hidden">
  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
  {multiline ? <p className="mt-3 leading-6 break-words">{value}</p> : <a href={value} target="_blank" rel="noreferrer" className="mt-3 block truncate text-accent hover:underline">{value}</a>}
</div>
```

- [ ] **Step 3: Fix toolbar-chip overflow for workbook upload**

```tsx
// BEFORE (line 214):
<div className="toolbar-chip">{uploadedFile ? uploadedFile.name : 'No workbook uploaded'}</div>

// AFTER:
<div className="toolbar-chip max-w-[200px] truncate">{uploadedFile ? uploadedFile.name : 'No workbook uploaded'}</div>
```

And the inner one at line 257:

```tsx
// BEFORE (line 257):
<span className="toolbar-chip">{uploadedFile ? 'Replace' : 'Choose file'}</span>

// This one is fine — short text.
```

- [ ] **Step 4: Fix PreviewTable long text cells**

```tsx
// BEFORE (line 380-385):
<table className="min-w-full text-left text-sm">
  <thead className="sticky top-0 bg-surface">
    <tr className="border-b border-border/70 text-text-muted">{['Existing Parent Page', 'Pillar', 'Cluster', 'Intent', 'Primary Keyword', 'Keywords'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
  </thead>
  <tbody>
    {previewRows.map((row, index) => <tr key={`${row.cluster}-${index}`} className="border-b border-border/50 align-top"><td className="px-4 py-3 text-text-secondary">{row.existingParentPage}</td><td className="px-4 py-3">{row.pillar}</td><td className="px-4 py-3">{row.cluster}</td><td className="px-4 py-3">{row.intent}</td><td className="px-4 py-3">{row.primaryKeyword}</td><td className="px-4 py-3 text-text-secondary">{row.keywords.join(', ')}</td></tr>)}
  </tbody>
</table>

// AFTER — add max-width and truncate to cells:
<table className="min-w-full text-left text-sm">
  <thead className="sticky top-0 bg-surface">
    <tr className="border-b border-border/70 text-text-muted">{['Existing Parent Page', 'Pillar', 'Cluster', 'Intent', 'Primary Keyword', 'Keywords'].map((label) => <th key={label} className="px-4 py-3 font-medium whitespace-nowrap">{label}</th>)}</tr>
  </thead>
  <tbody>
    {previewRows.map((row, index) => <tr key={`${row.cluster}-${index}`} className="border-b border-border/50 align-top"><td className="px-4 py-3 text-text-secondary max-w-[200px] truncate" title={row.existingParentPage}>{row.existingParentPage}</td><td className="px-4 py-3 max-w-[180px] truncate" title={row.pillar}>{row.pillar}</td><td className="px-4 py-3 max-w-[180px] truncate" title={row.cluster}>{row.cluster}</td><td className="px-4 py-3 max-w-[100px] truncate" title={row.intent}>{row.intent}</td><td className="px-4 py-3 max-w-[180px] truncate" title={row.primaryKeyword}>{row.primaryKeyword}</td><td className="px-4 py-3 text-text-secondary max-w-[250px] truncate" title={row.keywords.join(', ')}>{row.keywords.join(', ')}</td></tr>)}
  </tbody>
</table>
```

Note: Added `title` attributes for tooltip on hover since text is truncated.

- [ ] **Step 5: Fix run history card button overflow**

```tsx
// BEFORE (line 343):
<div className="mt-5 flex flex-wrap gap-3">
  <Button type="button" variant={selectedRunId === run.id ? 'primary' : 'secondary'} size="sm" onClick={() => setSelectedRunId(run.id)}>Open in workspace</Button>
  <Link href={buildProjectRunPath(project.id, run.id)} className="inline-flex min-h-[40px] items-center justify-center rounded-2xl border border-border/80 bg-surface-raised/80 px-3.5 py-2 text-xs font-medium text-text-primary transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:bg-surface">Dedicated run page</Link>
</div>

// AFTER — add min-w-0 to prevent flex child overflow:
<div className="mt-5 flex flex-wrap gap-3 min-w-0">
```

- [ ] **Step 6: Fix StatusBadge for long text**

The StatusBadge (line 405-408) is fine — statuses are short fixed strings.

- [ ] **Step 7: Build check + commit**

```bash
git add src/components/research/ResearchDashboard.tsx
git commit -m "fix: prevent overflow in Metric, InfoRow, PreviewTable, and history cards"
```

---

## Chunk 5: ResearchProcessTracker

### Task 7: Fix ResearchProcessTracker overflow

**Files:**
- Modify: `src/components/research/ResearchProcessTracker.tsx`

- [ ] **Step 1: Add overflow protection to step cards**

The step cards in the grid (line 84-134) can overflow with long labels/descriptions:

```tsx
// BEFORE (line 89-97):
<div
  key={step.id}
  className={cn(
    'rounded-[22px] border px-4 py-4',
    step.state === 'complete' && 'border-success/20 bg-success/[0.08]',
    step.state === 'current' && 'border-accent/25 bg-accent/[0.08] shadow-[0_18px_36px_-28px_rgba(124,92,255,0.7)]',
    step.state === 'failed' && 'border-destructive/25 bg-destructive/[0.08]',
    step.state === 'upcoming' && 'border-border/60 bg-background/35',
  )}
>

// AFTER — add overflow-hidden and min-w-0:
<div
  key={step.id}
  className={cn(
    'rounded-[22px] border px-4 py-4 overflow-hidden min-w-0',
    step.state === 'complete' && 'border-success/20 bg-success/[0.08]',
    step.state === 'current' && 'border-accent/25 bg-accent/[0.08] shadow-[0_18px_36px_-28px_rgba(124,92,255,0.7)]',
    step.state === 'failed' && 'border-destructive/25 bg-destructive/[0.08]',
    step.state === 'upcoming' && 'border-border/60 bg-background/35',
  )}
>
```

And add `break-words` to the label and `line-clamp-2` to the description:

```tsx
// BEFORE (line 129-130):
<p className="mt-4 text-base font-semibold text-text-primary">{step.label}</p>
<p className="mt-2 text-sm leading-6 text-text-secondary">{step.description}</p>

// AFTER:
<p className="mt-4 text-base font-semibold text-text-primary break-words">{step.label}</p>
<p className="mt-2 text-sm leading-6 text-text-secondary line-clamp-3">{step.description}</p>
```

- [ ] **Step 2: Build check + commit**

```bash
git add src/components/research/ResearchProcessTracker.tsx
git commit -m "fix: prevent overflow in process tracker step cards"
```

---

## Chunk 6: Global CSS Safeguard

### Task 8: Add global word-break safety net

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add `overflow-wrap: break-word` to body**

Inside the `body` rule (around line 140), add word-break safety:

```css
body {
  /* existing properties... */
  overflow-wrap: break-word;
  word-break: break-word;
}
```

This ensures no long unbroken strings can ever overflow the viewport.

- [ ] **Step 2: Build check + commit**

```bash
git add src/app/globals.css
git commit -m "fix: add global word-break safety net to prevent overflow"
```

---

## Verification

### Task 9: Final build and visual verification

- [ ] **Step 1: Full build check**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: All pass

- [ ] **Step 2: Review all changes**

Run: `git diff HEAD~6 --stat`
Expected: 7 files changed across ui, app, research components, and globals.css

- [ ] **Step 3: Commit and push**

```bash
git push origin HEAD
```
