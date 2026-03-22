import { test, expect, type Page } from '@playwright/test';

test.setTimeout(90_000);

const BASE = process.env.BASE_URL || 'http://localhost:3001';

const VIEWPORTS = [
  { width: 320, height: 568, label: 'iPhone SE' },
  { width: 375, height: 812, label: 'iPhone 12' },
  { width: 390, height: 844, label: 'iPhone 14' },
  { width: 430, height: 932, label: 'iPhone 15 Pro Max' },
  { width: 768, height: 1024, label: 'iPad portrait' },
  { width: 834, height: 1194, label: 'iPad Air portrait' },
  { width: 1024, height: 768, label: 'iPad landscape' },
  { width: 1280, height: 800, label: 'Laptop' },
  { width: 1440, height: 900, label: 'Desktop' },
  { width: 1920, height: 1080, label: 'Full HD' },
];

const TEST_EMAIL = 'e2e-responsive-test@test.local';
const TEST_PASSWORD = 'TestPass123!';

let sessionCookie: string;
let projectId: string;

function extractSessionCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/kwr_session=([^;]+)/);
  return match ? match[1] : null;
}

async function getAuthCookie(): Promise<string> {
  // Try register first, fall back to login if already exists
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const regRes = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'E2E Responsive Tester',
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        }),
      });
      if (regRes.ok) {
        const cookie = extractSessionCookie(regRes);
        if (cookie) return cookie;
      }
      if (regRes.status === 409) {
        // Already registered — use login
        const loginRes = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
        });
        if (loginRes.ok) {
          const cookie = extractSessionCookie(loginRes);
          if (cookie) return cookie;
        }
      }
      // 404 or other transient error — wait and retry (dev server cold start)
      if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Could not authenticate after 3 attempts');
}

async function setAuthCookie(page: Page, cookie: string) {
  const url = new URL(BASE);
  await page.context().addCookies([{
    name: 'kwr_session',
    value: cookie,
    domain: url.hostname,
    path: '/',
  }]);
}

async function checkNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, `Horizontal overflow detected at ${label}`).toBe(false);
}

async function checkMainContentContained(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return { ok: true, reason: 'no main element' };
    const mainRect = main.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    if (mainRect.right > viewportWidth + 1) {
      return { ok: false, reason: `main extends ${Math.round(mainRect.right - viewportWidth)}px beyond viewport` };
    }
    return { ok: true, reason: '' };
  });
  expect(result.ok, `Main content overflow at ${label}: ${result.reason}`).toBe(true);
}

async function checkNoClippedCards(page: Page, label: string) {
  const clipped = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
    const viewportWidth = window.innerWidth;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.right > viewportWidth + 2) {
        return `Card extends ${Math.round(rect.right - viewportWidth)}px past viewport`;
      }
    }
    return null;
  });
  expect(clipped, `Clipped card at ${label}: ${clipped}`).toBeNull();
}

test.describe('Dashboard responsive layout', () => {
  test.beforeAll(async () => {
    sessionCookie = await getAuthCookie();
    // Use existing project with real content for best coverage
    projectId = '099428ea-fb12-46e5-871c-738cc714c094';
  });

  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow at ${vp.width}px (${vp.label})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      await setAuthCookie(page, sessionCookie);

      await page.goto(`${BASE}/dashboard/${projectId}`, { waitUntil: 'load', timeout: 30000 }).catch(() =>
        page.goto(`${BASE}/dashboard`, { waitUntil: 'load', timeout: 30000 })
      );

      // Wait for hydration
      await page.waitForTimeout(2000);

      await checkNoHorizontalOverflow(page, `${vp.width}px ${vp.label}`);
      await checkMainContentContained(page, `${vp.width}px ${vp.label}`);
      await checkNoClippedCards(page, `${vp.width}px ${vp.label}`);

      await context.close();
    });
  }

  test('action rows wrap on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await setAuthCookie(page, sessionCookie);
    await page.goto(`${BASE}/dashboard/${projectId}`, { waitUntil: 'load', timeout: 30000 }).catch(() =>
      page.goto(`${BASE}/dashboard`, { waitUntil: 'load', timeout: 30000 })
    );
    await page.waitForTimeout(2000);

    const actionRowOverflow = await page.evaluate(() => {
      const rows = document.querySelectorAll('.action-row');
      const viewportWidth = window.innerWidth;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (rect.right > viewportWidth + 2) return true;
      }
      return false;
    });

    expect(actionRowOverflow, 'Action rows should not overflow on mobile').toBe(false);
    await context.close();
  });

  test('tables scroll horizontally within container only', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    await setAuthCookie(page, sessionCookie);
    await page.goto(`${BASE}/dashboard/${projectId}`, { waitUntil: 'load', timeout: 30000 }).catch(() =>
      page.goto(`${BASE}/dashboard`, { waitUntil: 'load', timeout: 30000 })
    );
    await page.waitForTimeout(2000);

    // Page-level overflow check (tables should not cause page scroll)
    await checkNoHorizontalOverflow(page, 'tablet 768px with tables');
    await context.close();
  });
});
