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

/** Create a project via API and return its ID */
export async function createProjectViaApi(cookie: string, params: {
  homepageUrl: string;
  brandName: string;
  language: string;
  market: string;
  aboutUrl?: string;
  sitemapUrl?: string;
  competitorUrls?: string;
  notes?: string;
}): Promise<string> {
  const payload = new FormData();
  payload.set('homepageUrl', params.homepageUrl);
  payload.set('brandName', params.brandName);
  payload.set('language', params.language);
  payload.set('market', params.market);
  payload.set('aboutUrl', params.aboutUrl || '');
  payload.set('sitemapUrl', params.sitemapUrl || '');
  payload.set('competitorUrls', params.competitorUrls || '');
  payload.set('notes', params.notes || '');

  const res = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { cookie: `kwr_session=${cookie}` },
    body: payload,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Failed to create project: ${res.status} ${body?.error || ''}`);
  }

  const data = await res.json();
  return data.id;
}

/** Start a research run via API and return its ID */
export async function startRunViaApi(cookie: string, projectId: string, targetRows = 150): Promise<string> {
  const res = await fetch(`${BASE}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `kwr_session=${cookie}` },
    body: JSON.stringify({ projectId, mode: 'fresh', targetRows }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Failed to start run: ${res.status} ${body?.error || ''}`);
  }

  const data = await res.json();
  return data.id;
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

    if (!res.ok) {
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
