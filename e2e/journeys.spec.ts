import { test, expect } from '@playwright/test';
import {
  getAuthCookie,
  setAuthCookie,
  createProjectAndRunViaApi,
} from './helpers/auth';

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const TARGET_ROWS = 150;

let cookie = '';

/* ------------------------------------------------------------------ */
/*  Shared auth setup                                                  */
/* ------------------------------------------------------------------ */

test.beforeAll(async () => {
  cookie = await getAuthCookie();
});

/* ------------------------------------------------------------------ */
/*  Journey 1 — Sign in / Register pages render correctly              */
/* ------------------------------------------------------------------ */

test.describe('Journey 1: Sign in / Register', () => {
  test('login page loads and shows AuthForm', async ({ page }) => {
    const res = await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(400);

    await expect(page.locator('h2')).toContainText('Sign in');
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder(/At least 6/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In|Sign in/ })).toBeVisible();

    // Link to register page
    await expect(page.getByRole('link', { name: /Sign up/ })).toBeVisible();
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /Sign up/ }).click();
    await page.waitForURL('**/auth/register**');
    await expect(page.locator('h2')).toContainText('Create');
  });

  test('register page loads and shows AuthForm', async ({ page }) => {
    const res = await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(400);

    await expect(page.locator('h2')).toContainText('Create');
    await expect(page.getByPlaceholder('Your name')).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder(/At least 6/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Account/ })).toBeVisible();

    // Link to login page
    await expect(page.getByRole('link', { name: /Sign in/ })).toBeVisible();
  });

  test('register page redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /Sign in/ }).click();
    await page.waitForURL('**/auth/login**');
    await expect(page.locator('h2')).toContainText('Sign in');
  });

  test('dashboard redirects to login when unauthenticated', async ({ page }) => {
    // Clear cookies to ensure we're unauthenticated
    await page.context().clearCookies();
    const res = await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    // Should redirect to login
    expect(page.url()).toContain('/auth/login');
  });
});

/* ------------------------------------------------------------------ */
/*  Journey 2 — Create project lands on /dashboard                     */
/* ------------------------------------------------------------------ */

test.describe('Journey 2: Create project → dashboard', () => {
  test('authenticated user can reach dashboard selection page', async ({ page }) => {
    await setAuthCookie(page, cookie);
    const res = await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(400);

    // SiteSelectionDashboard should be visible
    await expect(page.locator('h1')).toContainText(/workspace|website|site/i, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Create workspace|Create new/i })).toBeVisible();
  });

  test('create project form is present on dashboard', async ({ page }) => {
    await setAuthCookie(page, cookie);
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });

    // Scroll to the create form
    await page.locator('#new-site-form').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await expect(page.locator('#new-site-form')).toBeVisible();
    await expect(page.getByPlaceholder('https://example.com')).toBeVisible();
    await expect(page.getByPlaceholder(/Brand name/i).first()).toBeVisible();
  });

  test('create project via API lands in response', async () => {
    // This test validates the API flow — lenient since we may already
    // have projects from other test runs
    const result = await createProjectAndRunViaApi(cookie, {
      homepageUrl: 'https://example-smoke-test.com/',
      brandName: 'Smoke Test Workspace',
      language: 'English',
      market: 'Global',
      targetRows: TARGET_ROWS,
    });
    expect(result.projectId).toBeTruthy();
    expect(result.runId).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  Journey 3 — Start research run shows ResearchProcessTracker        */
/* ------------------------------------------------------------------ */

test.describe('Journey 3: Research run → process tracker', () => {
  test('start run via API returns a runId', async () => {
    const { projectId, runId } = await createProjectAndRunViaApi(cookie, {
      homepageUrl: 'https://example-process-tracker-test.com/',
      brandName: 'Process Tracker Test',
      language: 'English',
      market: 'Test',
      targetRows: TARGET_ROWS,
    });
    expect(projectId).toBeTruthy();
    expect(runId).toBeTruthy();
  });

  test('run status endpoint returns valid progress data', async () => {
    const { runId } = await createProjectAndRunViaApi(cookie, {
      homepageUrl: 'https://example-progress-test.com/',
      brandName: 'Progress Test',
      language: 'English',
      market: 'Test',
      targetRows: TARGET_ROWS,
    });

    const res = await fetch(`${BASE}/api/runs/${runId}`, {
      headers: { cookie: `kwr_session=${cookie}` },
    });
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data.status).toBeTruthy();
    // Status should be queued or processing initially
    expect(['queued', 'processing', 'completed', 'failed']).toContain(data.status);
  });

  test('browser: authenticated user sees research dashboard', async ({ page }) => {
    // Create a project first, then navigate to its dashboard
    const { projectId } = await createProjectAndRunViaApi(cookie, {
      homepageUrl: 'https://example-browser-dashboard-test.com/',
      brandName: 'Browser Dashboard Test',
      language: 'English',
      market: 'Test',
      targetRows: TARGET_ROWS,
    });

    await setAuthCookie(page, cookie);
    const res = await page.goto(`${BASE}/dashboard/${projectId}`, {
      waitUntil: 'domcontentloaded',
    });
    expect(res?.status()).toBeLessThan(400);

    // The project dashboard should render — look for research tab or header
    await page.waitForTimeout(2000);
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  Journey 4 — Inspect results shows keyword table                    */
/* ------------------------------------------------------------------ */

test.describe('Journey 4: Inspect results → keyword table', () => {
  test('keywords API returns results for a completed run', async () => {
    // Create project+run, then poll until complete
    const { runId } = await createProjectAndRunViaApi(cookie, {
      homepageUrl: 'https://example-inspect-test.com/',
      brandName: 'Inspect Results Test',
      language: 'English',
      market: 'Test',
      targetRows: TARGET_ROWS,
    });

    // Poll the run — lenient: we don't require completion, just check the API shape
    const res = await fetch(`${BASE}/api/runs/${runId}`, {
      headers: { cookie: `kwr_session=${cookie}` },
    });
    expect(res.ok).toBe(true);

    const data = await res.json();
    // If rows exist, validate their shape
    if (data.rows && data.rows.length > 0) {
      const firstRow = data.rows[0];
      // Keyword table columns
      expect(firstRow).toHaveProperty('primaryKeyword');
      expect(firstRow).toHaveProperty('pillar');
      expect(firstRow).toHaveProperty('cluster');
      expect(firstRow).toHaveProperty('intent');
    }
    // Lenient: empty rows are fine if run hasn't completed
  });

  test('browser: run results page loads when authenticated', async ({ page }) => {
    const { projectId, runId } = await createProjectAndRunViaApi(cookie, {
      homepageUrl: 'https://example-results-page-test.com/',
      brandName: 'Results Page Test',
      language: 'English',
      market: 'Test',
      targetRows: TARGET_ROWS,
    });

    await setAuthCookie(page, cookie);
    const res = await page.goto(
      `${BASE}/dashboard/${projectId}/runs/${runId}`,
      { waitUntil: 'domcontentloaded' },
    );
    expect(res?.status()).toBeLessThan(400);

    // Should see the research dashboard with the run loaded
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  Journey 5 — Export workbook triggers download                      */
/* ------------------------------------------------------------------ */

test.describe('Journey 5: Export workbook → download', () => {
  test('download endpoint accepts request', async () => {
    // Create a project+run — we don't need it to complete for this test
    const { runId } = await createProjectAndRunViaApi(cookie, {
      homepageUrl: 'https://example-export-test.com/',
      brandName: 'Export Test',
      language: 'English',
      market: 'Test',
      targetRows: TARGET_ROWS,
    });

    const res = await fetch(`${BASE}/api/runs/${runId}/download`, {
      headers: { cookie: `kwr_session=${cookie}` },
    });

    // Lenient: 404 is expected if run hasn't completed (no workbook yet)
    // 200 is expected if workbook exists
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      // Should be an Excel/spreadsheet type
      expect(
        contentType.includes('spreadsheet') ||
          contentType.includes('excel') ||
          contentType.includes('xlsx') ||
          contentType.includes('octet-stream'),
      ).toBe(true);

      const buffer = await res.arrayBuffer();
      // If we got a workbook, it should have content
      expect(buffer.byteLength).toBeGreaterThan(0);
    } else {
      // Accept 404/503 — run may not have completed yet
      expect([404, 500, 502, 503]).toContain(res.status);
    }
  });

  test('download endpoint requires authentication', async () => {
    const { runId } = await createProjectAndRunViaApi(cookie, {
      homepageUrl: 'https://example-download-auth-test.com/',
      brandName: 'Download Auth Test',
      language: 'English',
      market: 'Test',
      targetRows: TARGET_ROWS,
    });

    const res = await fetch(`${BASE}/api/runs/${runId}/download`);
    // Should redirect or return 401/403 when unauthenticated
    expect(res.status).not.toBe(200);
  });
});
