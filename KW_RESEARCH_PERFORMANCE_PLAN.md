# KW Research — Performance & API Improvement Plan

> Created: 2026-05-19 · Method: Hermes Five-Phase Planning · Owner: Tomerake

---

## GOAL

Reduce KW Research dashboard response times to under 500ms for all CRUD operations (list, filter, save, delete) and eliminate unnecessary server-side work, while keeping the existing auth, theme, and agent pipeline intact.

---

## SUCCESS CRITERIA

1. **GET /api/keywords?runId=…** returns results in `< 300ms` for any run with up to 2,000 rows (currently loads all rows into memory and sorts in JS).
2. **DELETE /api/runs/[runId]** completes in `< 200ms` (no cascade blockers).
3. **Client search/filter** feels instant — typing does not trigger server round-trips or expensive re-renders.
4. **`research/trigger`** does not call `startResearchWorker()` on every POST (only called when creating a new run; duplicate guard exists but is called 4× per route as belt-and-suspenders).
5. **No new `console.error`** in server code — all error paths use `src/server/log.ts`.
6. **`npm run lint && npm run typecheck && npm test`** passes with zero new failures.
7. **Playwright smoke** (`npx playwright test e2e/journeys.spec.ts`) passes on both desktop and mobile viewports.

---

## GROUND TRUTH *(facts from code, not opinions)*

| # | Fact | Source | Impact |
|---|------|--------|--------|
| 1 | `GET /api/keywords` loads **all** `run.rows` into memory, sorts with `Array.sort()`, then slices. O(n) memory + CPU on every request. No DB-level sorting or offset. | `src/app/api/keywords/route.ts:110-117` | 🔴 Critical |
| 2 | `startResearchWorker()` is called via `global.__kwResearchWorkerStarted` guard → **safe** (won't double-start), but called from 4 places in `runs/route.ts` redundantly — waste, not a bug. | `src/server/research/worker.ts:24-26`, `runs/route.ts` | 🟡 Minor |
| 3 | `src/server/rate-limit.ts` — in-memory token bucket, no persistence. Resets on restart. No structured error body when rate-limited (just boolean return). | `src/server/rate-limit.ts:21-47` | 🟡 |
| 4 | `src/server/log.ts` — thin wrapper over console. No structured JSON, no log level filtering, no rotation. | `src/server/log.ts:1-34` | 🟢 Nice-to-have |
| 5 | `src/server/retry.ts` — clean exponential backoff. Well-built. | `src/server/retry.ts:21-47` | ✅ Solid |
| 6 | `src/server/research/cache.ts` — 24h TTL in libSQL, hash-based dedup. Solid for research results. | `src/server/research/cache.ts` | ✅ Solid |
| 7 | Research pipeline (`pipeline.ts`) is 1721 lines. Multiple AI agent calls, Firecrawl, workbook generation. This is the heavy path — but runs async via worker, not blocking the dashboard. | `src/server/research/pipeline.ts` | ℹ️ Not in scope |
| 8 | 36 API route files. Some are likely orphaned or unused — no route-level telemetry to confirm. | `src/app/api/**/route.ts` (36 files) | 🟡 |
| 9 | No Zod validation on `DELETE /api/runs/[runId]` — could fail silently on malformed ID. | `src/app/api/runs/[runId]/route.ts` | 🟡 |
| 10 | Client: `ResearchDashboard.tsx` is 2386 lines with 30+ useState calls. Decomposed into sub-components but not fully wired. | `src/components/research/dashboard/` | ℹ️ Phase 2 work |

---

## PLAN

### Phase 1: Server-Side Pagination & Sort *(API Hardening)*

**Inputs:** Current keyword route, DB schema for runs table  
**Outputs:** Keywords served with DB-level `ORDER BY` + `LIMIT/OFFSET`, no in-memory sort  
**Owner:** Agent  
**Effort:** M  
**Dependencies:** None

- [ ] P1.1 — Add `ORDER BY` and `LIMIT/OFFSET` to the keyword fetch query in `repository.ts`. Pass `sort`, `order`, `page`, `limit` to the DB layer instead of sorting in JS.
- [ ] P1.2 — Remove `sortRows()` from `keywords/route.ts` and the `[...rows].sort()` + `.slice()` pattern.
- [ ] P1.3 — Add Zod validation to all `DELETE` routes (`runs/[runId]`, `keywords/[id]`).
- [ ] P1.4 — Replace `console.error` in `worker.ts:147` with `log.error`.
- [ ] P1.5 — Remove redundant `startResearchWorker()` calls from `runs/route.ts` (keep the ones at lines 17, 41, 103, 152 — consolidate to just the POST handler that creates a new run).

### Phase 2: Client Performance *(Debounce + Memo)*

**Inputs:** ResearchDashboard.tsx, search/filter components  
**Outputs:** Search debounced at 300ms, keyword table memoized, no full re-render on every keystroke  
**Owner:** Agent  
**Effort:** M  
**Dependencies:** Phase 1 complete

- [ ] P2.1 — Add `useDebouncedValue` (300ms) to the search input in the keyword table.
- [ ] P2.2 — Wrap `KeywordTable` in `React.memo` with a custom comparator that skips re-render when sort/filter haven't changed.
- [ ] P2.3 — Lazy-load heavy tabs (SERP compare, content briefs, competitor overlap) with `dynamic(() => import(...), { ssr: false })`.
- [ ] P2.4 — Add `Suspense` boundaries with skeleton loaders around each lazy tab.

### Phase 3: Delete/Save Speed *(Optimistic Updates)*

**Inputs:** TanStack Query hooks for keywords/runs  
**Outputs:** UI updates instantly on delete/save, rolls back on server error  
**Owner:** Agent  
**Effort:** S  
**Dependencies:** Phase 1 complete

- [ ] P3.1 — Add `onMutate` optimistic update to `useDeleteKeyword` and `useDeleteRun` mutations.
- [ ] P3.2 — Add `onError` rollback that restores the previous cache state.
- [ ] P3.3 — Invalidate affected queries after successful mutation (not before).
- [ ] P3.4 — Add a toast notification on delete success/failure.

### Phase 4: Code Quality & Route Cleanup *(Housekeeping)*

**Inputs:** All 36 API route files  
**Outputs:** Unused routes identified and flagged, error response format standardized, dead imports removed  
**Owner:** Agent  
**Effort:** S  
**Dependencies:** None (parallel with Phase 1)

- [ ] P4.1 — Audit all 36 route files for actual usage (check for imports in client code). Flag orphaned routes in a comment — do NOT delete without approval.
- [ ] P4.2 — Standardize error response shape across all routes: `{ error: string, code?: string }`.
- [ ] P4.3 — Add `import 'server-only'` to any server file missing it.
- [ ] P4.4 — Remove dead imports (TypeScript compiler already catches most; eslint `no-unused-vars` covers the rest).

---

## RISKS

| Risk | Early Warning | Mitigation |
|------|---------------|------------|
| DB-level sort breaks on large runs if index is missing | Query plan shows full scan | Add index on `(run_id, search_volume DESC)` before deploying sort change |
| Optimistic delete leaves UI stale if rollback fails | Console error in onError handler | Show error toast AND refetch from server as fallback |
| Debounce makes search feel laggy | User reports "search is slow" | Start at 200ms, measure perceived latency, adjust up only if needed |

---

## VERIFICATION

**The ONE test:** Open the dashboard with a run containing 1,000+ keywords. Type a search term, delete a keyword, sort by CPC. Every interaction must complete in under 1 second with no page-level spinner. Run `npm run lint && npm run typecheck && npm test` — zero new failures. Run `npx playwright test e2e/journeys.spec.ts` — all green.

---

## OPEN QUESTIONS

- None. All scope is defined from code inspection.

---

## Notes

- The research pipeline (1721-line `pipeline.ts`) is intentionally out of scope — it runs async in a worker and does not block dashboard responsiveness. Profiling the pipeline is tracked in `AGENT_PLAN.md`.
- The `startResearchWorker()` "issue" from the initial assessment was a false alarm — the `global.__kwResearchWorkerStarted` guard already prevents double-start. The redundant calls are cosmetic, not functional.
- `ResearchDashboard.tsx` decomposition (2386 lines) is a separate tracked effort in `AGENT_PLAN.md §7` and not part of this performance plan.
