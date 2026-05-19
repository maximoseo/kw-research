# KW Research — Design, Features & QA Improvement Plan

> Created: 2026-05-19 · Method: Hermes Five-Phase Planning · Owner: Tomerake
> Based on: Live QA session on 2026-05-19 (site, API, dashboard, user journey)

---

## GOAL

Transform the KW Research dashboard from a functional research tool into a polished, fast, feature-rich product that a real user would enjoy using daily — fixing the 2 critical UX bugs, adding 4 high-impact features, and elevating the visual design to "premium SaaS" quality.

---

## SUCCESS CRITERIA

1. **Bug fixes verified**: "Create workspace" and "Run research" buttons both produce immediate visual feedback (loading → success toast/redirect).
2. **Design uplift visible**: A side-by-side before/after screenshot comparison shows clear improvements in spacing, hierarchy, and polish.
3. **New features work end-to-end**:
   - Run Comparison: user can select 2 runs and see a side-by-side keyword overlap table.
   - Dashboard Analytics: project-level card showing total runs, success rate, avg keywords/run.
   - Quick Actions toolbar: Export, Delete, Rerun available from the run list without navigating into the run.
   - Empty States: illustrated empty states for 0 workspaces, 0 runs, 0 keywords (replacing "No runs yet" plain text).
4. **QA re-test passes**: Full user journey (signup → workspace → run → browse → filter → export → delete) completes in < 2 minutes with 0 JS errors.
5. **Performance verified**: `GET /api/keywords` < 500ms with a completed run (confirming `getKeywordRows` is live).

---

## GROUND TRUTH

### From live QA (2026-05-19)
- Site is live and serving pages. Auth + API infrastructure is solid (0 500s across 21 endpoints).
- **BUG B1**: Workspace creation form submits but UI stays on form — workspace IS created but page doesn't refresh.
- **BUG B2**: "Run research" button produces zero feedback — no loading, no error, no redirect.
- **BUG B3**: Commit `4dc323b` (Zod validation, debounce, lightweight fetch) not deployed to Render yet.
- All API response times < 1 second (best: 418ms, worst: 993ms).
- Zero JS console errors.

### From dashboard analysis (text snapshot + code)
- **Layout**: 3-column grid (workspace info | site profile | new run form). Sidebar with 4 nav links + theme toggle + logout.
- **Workspace card** (selector page): Dense text — brand, language, market, run count, competitor count, URLs, timestamp, "Open workspace" link. No visual hierarchy.
- **Run form**: Mode dropdown, targetRows spinner, competitor URLs textarea, notes textarea, "Run research" button. Clean but no progress indicator.
- **Empty states**: Plain text paragraphs ("No runs yet", "No website workspaces yet") — no illustrations, no CTA.
- **Sidebar**: Functional but minimal — 4 links, theme toggle, logout. No project context breadcrumb.
- **Color palette**: Surface/raised/card layers with text-primary/text-muted hierarchy. Clean but monochromatic — lacks accent colors for CTAs and status indicators.

### From codebase
- `AGENTS.md`: Design system uses `bg-surface`, `text-text-primary`, `hsl(var(--chart-1))` — tokens, not raw colors. Good foundation.
- `ResearchDashboard.tsx`: 2387 lines after debounce patch. 30+ useState. Needs further decomposition.
- UX improvements from `AGENT_PLAN.md §7` partially done (dashboard components extracted but not fully wired).
- TanStack Query + Table already integrated — good foundation for optimistic updates and caching.

---

## PLAN

### Phase 1: Critical Bug Fixes *(unblock the user journey)*

**Inputs:** Live dashboard, bug reproduction steps from QA  
**Outputs:** Both buttons work with proper feedback  
**Owner:** Agent  
**Effort:** S  
**Dependencies:** None (go first)

- [ ] P1.1 — Fix BUG B1: Investigate workspace creation form `onSubmit` — verify `handleSubmit` triggers, `createProject` API resolves, then navigate or refresh the workspace list.
- [ ] P1.2 — Fix BUG B2: Investigate "Run research" button — verify `handleCreateRun` is bound to the form, `FormData` is built correctly, `fetch` is called, and the response is handled (toast + redirect).
- [ ] P1.3 — Add loading state to "Create workspace" button (disable + spinner during submit).
- [ ] P1.4 — Add loading state to "Run research" button (disable + spinner + "Queuing…" text).
- [ ] P1.5 — Verify both fixes with Playwright E2E: create workspace → verify UI updates, create run → verify navigation to results.
- [ ] P1.6 — Trigger Render manual redeploy so commit `4dc323b` goes live (Zod validation, debounce, lightweight fetch).

### Phase 2: Design Uplift *(premium SaaS feel)*

**Inputs:** Current dashboard layouts, design token system  
**Outputs:** Visual comparison showing hierarchy, spacing, color, and empty-state improvements  
**Owner:** Agent  
**Effort:** M  
**Dependencies:** Phase 1 complete (so we see improvements on a working dashboard)

- [ ] P2.1 — **Workspace card redesign**: Add icon/logo placeholder, highlight run count as a badge, separate metadata into a footer row, make the card fully clickable (not just the "Open" link).
- [ ] P2.2 — **Empty states with illustrations**: Replace "No runs yet" and "No workspaces" plain text with SVG illustrations + a CTA button (e.g., "Create your first workspace →").
- [ ] P2.3 — **Dashboard header polish**: Add project breadcrumb to sidebar, make the project name more prominent, add a "last active" timestamp.
- [ ] P2.4 — **Button hierarchy**: Primary (blue/solid) for "Run research" and "Create", secondary (outline) for "Reset" and "Cancel", ghost for "Delete". Ensure consistent across all pages.
- [ ] P2.5 — **Status badges with color**: "Completed" (green), "Processing" (blue/amber pulse), "Failed" (red), "Queued" (gray) — use semantic colors instead of monochrome variants.
- [ ] P2.6 — **Mobile responsive polish**: Test at 375px — ensure the 3-column layout stacks to single column, sidebar collapses to hamburger, buttons are 44px minimum touch targets.
- [ ] P2.7 — **Micro-interactions**: Add hover scale (1.02) on cards, smooth tab transitions (opacity + translateY), skeleton loaders instead of spinners.

### Phase 3: Feature: Run Comparison *(high-value differentiator)*

**Inputs:** Existing keyword data model, competitor/overlap API  
**Outputs:** Side-by-side comparison table for 2 runs  
**Owner:** Agent  
**Effort:** M  
**Dependencies:** Phase 1 complete (need working runs)

- [ ] P3.1 — Add "Compare" button to the run history list (selectable checkboxes, max 2).
- [ ] P3.2 — Build `/api/runs/compare` endpoint — accepts 2 runIds, returns merged keyword list with presence flags (in_both, only_in_a, only_in_b).
- [ ] P3.3 — Build `RunComparisonView` component — side-by-side table: left = Run A keywords, right = Run B keywords, center = overlap.
- [ ] P3.4 — Add keyword count summary: "Run A: 220 keywords · Run B: 185 keywords · Overlap: 142 · Unique to A: 78 · Unique to B: 43".
- [ ] P3.5 — Add export option for comparison results (CSV with overlap flags).

### Phase 4: Feature: Dashboard Analytics *(at-a-glance insights)*

**Inputs:** Run history data, keyword counts  
**Outputs:** Stats card row above the run list  
**Owner:** Agent  
**Effort:** S  
**Dependencies:** Phase 1 complete

- [ ] P4.1 — Build `/api/projects/[projectId]/stats` endpoint — returns totalRuns, completedRuns, failedRuns, totalKeywords, avgKeywordsPerRun, mostRecentRunDate.
- [ ] P4.2 — Build `ProjectStatsBar` component — 4-5 stat cards in a horizontal row: "12 Runs", "89% Success", "2,450 Keywords", "204 avg/run".
- [ ] P4.3 — Add a mini sparkline or trend indicator (↑12% vs last month) if historical data available.

### Phase 5: Feature: Quick Actions + Empty States *(UX completeness)*

**Inputs:** Run list, keyword table  
**Outputs:** Contextual actions available without navigation  
**Owner:** Agent  
**Effort:** S  
**Dependencies:** Phase 1 complete

- [ ] P5.1 — **Quick Actions in run list**: Add a "⋯" menu per run row with: Download, Rerun, Delete. No need to open the run first.
- [ ] P5.2 — **Empty state for keywords**: When a run completes but has 0 keywords, show "No keywords found for this site. Try adjusting your target pages or competitor URLs."
- [ ] P5.3 — **Onboarding tooltip**: On first visit to a new project, show a 2-step tooltip: "1. Set your domain → 2. Launch a research run →".
- [ ] P5.4 — **Keyboard shortcut help**: Add "?" shortcut that opens a modal listing: `Ctrl+K` search, `Ctrl+Shift+S` save search, `Esc` close panels.

### Phase 6: Full QA Re-Test *(close the loop)*

**Inputs:** All fixes and features deployed  
**Outputs:** QA report confirming the original bugs are fixed + new features work  
**Owner:** Agent  
**Effort:** M  
**Dependencies:** Phases 1-5 complete

- [ ] P6.1 — Re-run the full user journey: signup → workspace → run → browse keywords → search → filter → delete keyword → export → delete run.
- [ ] P6.2 — Verify BUG B1 and BUG B2 are resolved with visual confirmation.
- [ ] P6.3 — Verify new features: Run Comparison, Dashboard Analytics, Quick Actions.
- [ ] P6.4 — Verify design uplift: before/after screenshots at 375px, 768px, 1440px.
- [ ] P6.5 — Measure `GET /api/keywords` with a completed 200-keyword run → target < 500ms.
- [ ] P6.6 — Run `npm run lint && npm test` — zero new failures.

---

## RISKS

| Risk | Early Warning | Mitigation |
|------|---------------|------------|
| Bugs B1/B2 are deeper than simple event wiring (e.g., API auth, CORS, or FormData serialization) | Console error during form submit | Debug the network tab; fall back to direct API call if form library is the culprit |
| Design uplift breaks mobile layout | Horizontal scroll at 375px | Test each component at 375px BEFORE merging; use `@container` queries where possible |
| Run Comparison endpoint is slow with 200+ keywords per run | > 2s response time | Pre-compute overlap on run completion and store in DB; compare from cache |
| Render deploy delay blocks verification | Zod validation still not live after Phase 1 | Trigger manual deploy via Render dashboard; verify with `curl` on DELETE route |

---

## VERIFICATION

**The ONE test:** A new user creates a workspace (button works, UI updates), launches a research run (button shows loading, redirects to results), sees a polished dashboard with illustrated empty states replaced by real data, views analytics cards showing their run stats, compares two runs side-by-side, and exports the comparison — all in under 3 minutes, with zero JS errors, and every API call under 1 second.

---

## OPEN QUESTIONS

- Is the "Run research" button failing because of missing API keys (Anthropic/Firecrawl) on the Render deploy? (Check: does the research pipeline start or does it fail silently?)
- Should Run Comparison be limited to 2 runs or N runs? (Default: 2 for MVP, N later)
- Should Dashboard Analytics aggregate across ALL projects or just the current one? (Current: per-project)

---

## Notes

- Phase 2 (Design Uplift) uses the existing design token system (`bg-surface`, `text-text-primary`, etc.) — no new color palette, just better application of existing tokens.
- All features should follow the project's rules: no shadcn/Radix, no `console.log` in server code, mobile-first with `lg:` breakpoints.
- The debounce hook (`useDebouncedValue`) and lightweight keyword fetch (`getKeywordRows`) are already in the codebase — they just need to be deployed (P1.6).
- Estimated total effort: 2-3 focused sessions. Phase 1 (bugs) is the critical path and should take < 1 hour.
