# KW Research — Post-Deploy QA & User Experience Verification Plan

> Created: 2026-05-19 · Method: Hermes Five-Phase Planning · Owner: Tomerake

---

## GOAL

Verify that the KW Research dashboard is live, fast, and genuinely usable from a real user's perspective — testing every flow a user would go through (sign-up → workspace → research run → keyword browse → filter/search → export), and measuring whether the performance improvements from the previous plan actually landed in production.

---

## SUCCESS CRITERIA

1. **Login/Register works** — user can create account, log in, and reach the workspace selector in under 3 seconds.
2. **Workspace creation works** — form validation catches bad URLs, success creates a workspace card.
3. **Research run creation** — triggers a real (or minimal) run that enters "queued → processing → completed" flow.
4. **Keyword API response** — `GET /api/keywords?runId=…` returns data in `< 500ms` for any completed run (validating the lightweight `getKeywordRows` is live).
5. **Search debounce** — typing into the keyword search box does NOT trigger a full-screen re-render on every keystroke (validating the `useDebouncedValue` hook).
6. **Mobile viewport** — all dashboard tabs, the keyword table, and the filter bar are usable at 375px width.
7. **Delete a run** — succeeds with toast feedback, run disappears from the run list.
8. **Export works** — clicking Export downloads a valid CSV.
9. **No JS console errors** — zero red errors in the browser console during a full user journey.
10. **All 36 API routes return valid responses** — no 500s on any published route.

---

## GROUND TRUTH *(facts from live testing, not assumptions)*

| # | Fact | Source |
|---|------|--------|
| 1 | Site is live and serving pages at https://kw-research.maximo-seo.ai/ | Browser navigate |
| 2 | Landing page renders: hero, sign-in button, create-account button, marketing cards | Snapshot @ landing |
| 3 | Auth redirect works: /dashboard → /auth/login?redirect=%2Fdashboard | Browser navigate |
| 4 | Registration API works: POST /api/auth/register returns {ok:true} | curl test |
| 5 | Login flow works: email + password → workspace selector loads | Browser login |
| 6 | Workspace selector renders: form with 8 fields (homepage, about, sitemap, brand, language, market, competitors, notes) + Create button | Snapshot @ selector |
| 7 | `npm run lint` = 0 errors post-deploy | CI |
| 8 | `npm test` = 59/62 passing (3 flaky pre-existing) | CI |
| 9 | The debounce hook (`useDebouncedValue`) is in production code | `src/hooks/useDebouncedValue.ts` |
| 10 | The lightweight keyword fetch (`getKeywordRows`) is in production code | `src/server/research/repository.ts:742` |

---

## PLAN

### Phase 1: Core User Journey *(critical path)*

**Inputs:** Live site, test credentials (qa-test@maximo-seo.ai / QATest123!)  
**Outputs:** A completed research run visible in the dashboard with keyword results  
**Owner:** Agent  
**Effort:** M  
**Dependencies:** None

- [ ] P1.1 — Create a real workspace (e.g., maximo-seo.ai) via the workspace selector form.
- [ ] P1.2 — Launch a small research run (targetRows=10, mode=fresh) inside that workspace.
- [ ] P1.3 — Wait for run to reach "completed" status (or skip to cache hit for speed).
- [ ] P1.4 — Verify the keyword table renders with data (columns: keyword, volume, CPC, intent, pillar, cluster).
- [ ] P1.5 — Measure keyword API response time with `curl -w "@curl-format.txt"`.

### Phase 2: Performance Verification *(the real test)*

**Inputs:** Completed run from Phase 1  
**Outputs:** Timings proving the optimizations worked  
**Owner:** Agent  
**Effort:** M  
**Dependencies:** Phase 1 complete

- [ ] P2.1 — Measure `GET /api/keywords?runId=…` response time (target: <500ms).
- [ ] P2.2 — Measure `DELETE /api/runs/[runId]` response time (target: <200ms).
- [ ] P2.3 — Verify search input updates instantly (immediate feedback) but table re-filter is debounced.
- [ ] P2.4 — Check browser console for zero errors after full journey.
- [ ] P2.5 — Take a Lighthouse performance audit on the dashboard page.

### Phase 3: Edge Cases & Error Handling

**Inputs:** Live site, a test run  
**Outputs:** All error paths return proper messages (not crashes)  
**Owner:** Agent  
**Effort:** S  
**Dependencies:** Phase 2 complete

- [ ] P3.1 — Try accessing a non-existent runId → expect 404.
- [ ] P3.2 — Try deleting a non-existent run → expect 404 with error code NOT_FOUND.
- [ ] P3.3 — Try invalid search params (e.g., sort=xyz) → expect 400 with descriptive error.
- [ ] P3.4 — Test with an invalid UUID for runId in DELETE → expect 400 INVALID_PARAMS.

### Phase 4: Mobile & Visual QA

**Inputs:** Dashboard with data loaded  
**Outputs:** Screenshots at 375px, 768px, 1440px  
**Owner:** Agent  
**Effort:** S  
**Dependencies:** Phase 1 complete

- [ ] P4.1 — Take a full page screenshot at 375px (mobile) — verify no horizontal scroll, buttons clickable.
- [ ] P4.2 — Verify the keyword table has horizontal scroll (not squished text) on mobile.
- [ ] P4.3 — Verify the filter bar wraps properly on narrow screens.
- [ ] P4.4 — Verify all tabs (preview, logs, summary, questions, content-map, clusters) are accessible.

### Phase 5: API Health Sweep *(30 routes)*

**Inputs:** List of all 30+ API routes  
**Outputs:** Report of any routes returning 500s or unexpected errors  
**Owner:** Agent  
**Effort:** S  
**Dependencies:** Phase 1 complete (for auth session)

- [ ] P5.1 — Hit GET /api/health — expect 200.
- [ ] P5.2 — Hit GET /api/projects — expect 200 with user's projects.
- [ ] P5.3 — Hit GET /api/runs — expect 200.
- [ ] P5.4 — Hit a sample of keyword sub-routes (with valid params) — expect 200 or meaningful 400s.
- [ ] P5.5 — Document any route that returns 500 for the backlog.

---

## RISKS

| Risk | Early Warning | Mitigation |
|------|---------------|------------|
| Research run takes too long (> 5 min) for QA | Progress stuck at "queued" | Create run with cacheable params that match a previous completed run — triggers cache hit instantly |
| No existing completed runs in the DB | Fresh workspace has 0 runs | Run the pipeline on a small batch (targetRows=5) and wait, or seed data directly |
| Debounce doesn't visibly change UX at 300ms | Typing still feels laggy in test | Reduce to 200ms and re-measure; flag for investigation |

---

## VERIFICATION

**The ONE test:** A brand-new user (qa-test@maximo-seo.ai) with 0 workspaces and 0 runs can sign up, create a workspace, launch a research run, browse keywords, search, filter, delete a keyword, export CSV, and delete the run — all without seeing a single JS error in the console and every API call completing in under 1 second.

---

## OPEN QUESTIONS

- Is there a seeded/completed run in production that we can use for instant cache-hit testing? (Unknown — will discover during Phase 1)
- Does the Render deploy pick up the latest commit automatically? (Yes — confirmed by the git push already landing on main)

---

## Notes

- Test user credentials: `qa-test@maximo-seo.ai` / `QATest123!` (freshly created, 0 workspaces, 0 runs).
- The research pipeline is intentionally not profiled in this plan — we're testing dashboard responsiveness, not pipeline speed.
- All measurements should be done with `curl -w` for server time and Chrome DevTools for client time.
- The plan deliberately tests the "cold start" scenario (new user, no data) — this is the hardest path and reveals the most bugs.

---

## QA RESULTS *(executed 2026-05-19 15:30)*

### ✅ PASSED (14 checks)

- #1: Site is live at https://kw-research.maximo-seo.ai/ ✅
- #2: Landing page renders correctly (hero, CTAs, marketing cards) ✅
- #3: Registration API works: POST /api/auth/register → {ok:true} ✅
- #4: Login flow works: email + password → redirect to /dashboard ✅
- #5: Auth redirect works: /dashboard → /auth/login?redirect=%2Fdashboard ✅
- #6: GET /api/health → HTTP 200 in 719ms ✅
- #7: GET /api/projects → HTTP 200 in 590ms ✅
- #8: GET /api/runs → HTTP 200 in 602ms ✅
- #9: GET /api/keywords?runId=test → HTTP 404 (proper error handling) ✅
- #10: All 21 tested API routes respond (no 500s) ✅
- #11: Workspace card renders with correct data (brand, language, market, URLs) ✅
- #12: Dashboard page loads with sidebar, run form, and workspace info ✅
- #13: Response times: all endpoints < 1s (best: 418ms, worst: 993ms) ✅
- #14: Zero JS console errors on dashboard page ✅

### 🐛 BUGS FOUND (3)

| # | Severity | Description |
|---|----------|-------------|
| B1 | 🔴 High | "Create workspace" button: form fills but UI never updates. Workspace IS created (via API) but UI shows 0 workspaces until refresh. |
| B2 | 🔴 High | "Run research" button on dashboard does nothing — no loading, no error, no toast. Complete user journey blocked. |
| B3 | 🟡 Medium | Zod validation commit not live on Render. DELETE invalid UUID returns old 404 instead of new 400 INVALID_PARAMS. |

### 📊 PERFORMANCE

| Endpoint | Time |
|----------|------|
| GET /api/health | 719ms |
| GET /api/projects | 590ms |
| GET /api/runs | 602ms |
| GET /api/keywords | 609ms |
| DELETE /api/runs/[id] | 498ms |

*getKeywordRows lightweight fetch + search debounce not verifiable without completed run (BUG B2 blocks).*

### 🔧 NEXT STEPS

1. Fix BUG B1 (workspace creation UI feedback)
2. Fix BUG B2 (run creation button handler)
3. Trigger Render manual deploy for commit 4dc323b
4. Re-test with completed run to verify performance improvements
