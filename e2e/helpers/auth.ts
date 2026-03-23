import type { Page } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const TEST_EMAIL = 'e2e-research-flow@test.local';
const TEST_PASSWORD = 'E2eResearch123!';

/** Extract the session cookie from a Set-Cookie header */
function extractSessionCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/kwr_session=([^;]+)/);
  return match ? match[1] : null;
}

/** Register or login and return the session cookie value */
export async function getAuthCookie(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Try register first
      const regRes = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'E2E Research Tester', email: TEST_EMAIL, password: TEST_PASSWORD }),
      });
      if (regRes.ok) {
        const c = extractSessionCookie(regRes);
        if (c) return c;
      }
      // If already registered, login
      if (regRes.status === 409) {
        const loginRes = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
        });
        if (loginRes.ok) {
          const c = extractSessionCookie(loginRes);
          if (c) return c;
        }
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3000));
    } catch {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('Could not authenticate after 3 attempts');
}

/** Set the auth cookie on a Playwright page */
export async function setAuthCookie(page: Page, cookie: string) {
  const url = new URL(BASE);
  await page.context().addCookies([{ name: 'kwr_session', value: cookie, domain: url.hostname, path: '/' }]);
}

/** Create a project and run in one call via /api/runs (FormData), return { projectId, runId } */
export async function createProjectAndRunViaApi(cookie: string, params: {
  homepageUrl: string;
  brandName: string;
  language: string;
  market: string;
  targetRows?: number;
  mode?: string;
  aboutUrl?: string;
  sitemapUrl?: string;
  competitorUrls?: string;
  notes?: string;
}): Promise<{ projectId: string; runId: string }> {
  const payload = new FormData();
  payload.set('homepageUrl', params.homepageUrl);
  payload.set('brandName', params.brandName);
  payload.set('language', params.language);
  payload.set('market', params.market);
  payload.set('targetRows', String(params.targetRows ?? 150));
  payload.set('mode', params.mode ?? 'fresh');
  // aboutUrl/sitemapUrl are validated as URLs — use homepage as fallback so validation passes
  // (the pipeline auto-discovers the real about/sitemap pages)
  payload.set('aboutUrl', params.aboutUrl || params.homepageUrl);
  payload.set('sitemapUrl', params.sitemapUrl || `${new URL(params.homepageUrl).origin}/sitemap.xml`);
  payload.set('competitorUrls', params.competitorUrls || '');
  payload.set('notes', params.notes || '');

  const res = await fetch(`${BASE}/api/runs`, {
    method: 'POST',
    headers: { cookie: `kwr_session=${cookie}` },
    body: payload,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Failed to create project+run: ${res.status} ${body?.error || ''}`);
  }

  const data = await res.json();
  return { projectId: data.projectId, runId: data.runId };
}

/** Start a research run for an existing project via API, return runId */
export async function startRunViaApi(cookie: string, projectId: string, targetRows = 150): Promise<string> {
  const payload = new FormData();
  payload.set('projectId', projectId);
  payload.set('mode', 'fresh');
  payload.set('targetRows', String(targetRows));
  payload.set('competitorUrls', '');
  payload.set('notes', '');

  const res = await fetch(`${BASE}/api/runs`, {
    method: 'POST',
    headers: { cookie: `kwr_session=${cookie}` },
    body: payload,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Failed to start run: ${res.status} ${body?.error || ''}`);
  }

  const data = await res.json();
  return data.runId;
}

/** Poll a run until it completes or fails, with timeout */
export async function waitForRunCompletion(cookie: string, runId: string, timeoutMs = 900_000): Promise<{
  status: string;
  rows: unknown[];
  workbookName: string | null;
  errorMessage: string | null;
}> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/api/runs/${runId}`, {
      headers: { cookie: `kwr_session=${cookie}` },
    });

    // Transient errors (502/503/504) during deploy — retry instead of failing
    if (!res.ok) {
      if (res.status >= 500 && res.status < 600) {
        console.warn(`[poll] Transient ${res.status} — retrying in 15s`);
        await new Promise((r) => setTimeout(r, 15_000));
        continue;
      }
      throw new Error(`Failed to poll run: ${res.status}`);
    }

    const data = await res.json();
    if (data.status === 'completed' || data.status === 'failed') {
      return {
        status: data.status,
        rows: data.rows || [],
        workbookName: data.workbookName || null,
        errorMessage: data.errorMessage || null,
      };
    }

    // Poll every 10 seconds
    await new Promise((r) => setTimeout(r, 10_000));
  }

  throw new Error(`Run ${runId} did not complete within ${timeoutMs / 1000}s`);
}
