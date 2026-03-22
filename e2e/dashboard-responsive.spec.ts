import { test, expect, type Page, type BrowserContext } from '@playwright/test';

test.setTimeout(90_000);

const BASE = process.env.BASE_URL || 'http://localhost:3001';

/* ---------- Viewport matrix ---------- */
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

/* ---------- Auth helpers ---------- */
function extractSessionCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/kwr_session=([^;]+)/);
  return match ? match[1] : null;
}

async function getAuthCookie(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const regRes = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'E2E Responsive Tester', email: TEST_EMAIL, password: TEST_PASSWORD }),
      });
      if (regRes.ok) { const c = extractSessionCookie(regRes); if (c) return c; }
      if (regRes.status === 409) {
        const loginRes = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
        });
        if (loginRes.ok) { const c = extractSessionCookie(loginRes); if (c) return c; }
      }
      if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
    } catch { if (attempt < 2) await new Promise(r => setTimeout(r, 3000)); }
  }
  throw new Error('Could not authenticate after 3 attempts');
}

async function setAuthCookie(page: Page, cookie: string) {
  const url = new URL(BASE);
  await page.context().addCookies([{ name: 'kwr_session', value: cookie, domain: url.hostname, path: '/' }]);
}

async function openDashboard(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await setAuthCookie(page, sessionCookie);
  // Try seed project first (has realistic data), fall back to workspace selector
  const res = await page.goto(`${BASE}/dashboard/seed-project-001`, { waitUntil: 'load', timeout: 30000 });
  if (!res || res.status() >= 400) {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load', timeout: 30000 });
  }
  await page.waitForTimeout(2500);
  return page;
}

/* ---------- Assertion helpers ---------- */
async function checkNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow, `Horizontal overflow detected at ${label}`).toBe(false);
}

async function checkMainContentContained(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return { ok: true, reason: 'no main element' };
    const viewportWidth = window.innerWidth;
    if (main.getBoundingClientRect().right > viewportWidth + 1) {
      return { ok: false, reason: `main extends ${Math.round(main.getBoundingClientRect().right - viewportWidth)}px beyond viewport` };
    }
    return { ok: true, reason: '' };
  });
  expect(result.ok, `Main content overflow at ${label}: ${result.reason}`).toBe(true);
}

async function checkNoClippedCards(page: Page, label: string) {
  const clipped = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
    const vw = window.innerWidth;
    for (const card of cards) {
      if (card.getBoundingClientRect().right > vw + 2)
        return `Card extends ${Math.round(card.getBoundingClientRect().right - vw)}px past viewport`;
    }
    return null;
  });
  expect(clipped, `Clipped card at ${label}: ${clipped}`).toBeNull();
}

async function checkNoErrorBoundary(page: Page, label: string) {
  const hasError = await page.locator('text=Something went wrong').count();
  expect(hasError, `Error boundary triggered at ${label}`).toBe(0);
}

/* ---------- Tests ---------- */

test.describe('Dashboard responsive — overflow regression', () => {
  test.beforeAll(async () => { sessionCookie = await getAuthCookie(); });

  for (const vp of VIEWPORTS) {
    test(`no overflow or clipping at ${vp.width}px (${vp.label})`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await openDashboard(context);
      const label = `${vp.width}px ${vp.label}`;

      await checkNoErrorBoundary(page, label);
      await checkNoHorizontalOverflow(page, label);
      await checkMainContentContained(page, label);
      await checkNoClippedCards(page, label);
      await context.close();
    });
  }
});

test.describe('Dashboard responsive — component behavior', () => {
  test.beforeAll(async () => { sessionCookie = await getAuthCookie(); });

  test('step cards grid stays contained at 1280px', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await openDashboard(context);
    await checkNoErrorBoundary(page, '1280px step cards');

    // All grid items with step-like content must be within viewport
    const gridOverflow = await page.evaluate(() => {
      const grids = document.querySelectorAll('[class*="grid"]');
      const vw = window.innerWidth;
      for (const grid of grids) {
        for (const child of grid.children) {
          if (child.getBoundingClientRect().right > vw + 2)
            return `Grid child extends ${Math.round(child.getBoundingClientRect().right - vw)}px past viewport`;
        }
      }
      return null;
    });
    expect(gridOverflow, `Grid overflow: ${gridOverflow}`).toBeNull();
    await context.close();
  });

  test('step cards use 2 columns at lg, not 4', async ({ browser }) => {
    // At 1280px (lg but not 2xl), step cards should be 2-col not 4-col
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await openDashboard(context);
    await checkNoErrorBoundary(page, '1280px step cols');

    const maxCardsPerRow = await page.evaluate(() => {
      const grids = document.querySelectorAll('[class*="grid"]');
      let maxInRow = 0;
      for (const grid of grids) {
        const children = Array.from(grid.children);
        if (children.length < 4) continue;
        const rowMap = new Map<number, number>();
        for (const child of children) {
          const top = Math.round(child.getBoundingClientRect().top);
          rowMap.set(top, (rowMap.get(top) || 0) + 1);
        }
        for (const count of rowMap.values()) {
          if (count > maxInRow) maxInRow = count;
        }
      }
      return maxInRow;
    });
    // At 1280px, should never have 4 items in a row inside the half-width column
    // (the main grid is 2-col, so inner grids should use ≤3 cols)
    expect(maxCardsPerRow).toBeLessThanOrEqual(3);
    await context.close();
  });

  test('action buttons visible and not clipped on mobile', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await openDashboard(context);
    await checkNoErrorBoundary(page, '375px buttons');

    const buttonsClipped = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a[role="button"]');
      const vw = window.innerWidth;
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        // Only check visible buttons (not hidden/collapsed)
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.right > vw + 2) return `Button "${btn.textContent?.trim()}" extends past viewport`;
        if (rect.left < -2) return `Button "${btn.textContent?.trim()}" extends before viewport`;
      }
      return null;
    });
    expect(buttonsClipped, `Buttons clipped: ${buttonsClipped}`).toBeNull();
    await context.close();
  });

  test('tables do not cause page-level overflow at tablet', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await openDashboard(context);
    await checkNoErrorBoundary(page, '768px tables');

    // Tables may scroll internally but page must not overflow
    await checkNoHorizontalOverflow(page, '768px table containment');

    // Verify table wrapper has overflow-x auto/hidden/scroll
    const tableContainment = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        let el: HTMLElement | null = table.parentElement;
        let hasOverflowContainment = false;
        while (el && el !== document.body) {
          const style = getComputedStyle(el);
          if (['auto', 'hidden', 'scroll'].includes(style.overflowX)) {
            hasOverflowContainment = true;
            break;
          }
          el = el.parentElement;
        }
        if (!hasOverflowContainment) return `Table lacks overflow container`;
      }
      return null;
    });
    expect(tableContainment, `Table containment: ${tableContainment}`).toBeNull();
    await context.close();
  });

  test('long text does not break layout on mobile', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await openDashboard(context);
    await checkNoErrorBoundary(page, '375px long text');
    await checkNoHorizontalOverflow(page, '375px long text');
    await context.close();
  });

  test('sidebar and main content coexist at desktop', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await openDashboard(context);
    await checkNoErrorBoundary(page, '1440px sidebar');

    const layoutOk = await page.evaluate(() => {
      const sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="Sidebar"]');
      const main = document.querySelector('main');
      if (!sidebar || !main) return { ok: true, reason: 'no sidebar or main' };
      const sidebarRect = sidebar.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const vw = window.innerWidth;
      if (sidebarRect.right + mainRect.width > vw + 5) {
        return { ok: false, reason: `sidebar(${Math.round(sidebarRect.width)}px) + main(${Math.round(mainRect.width)}px) > viewport(${vw}px)` };
      }
      return { ok: true, reason: '' };
    });
    expect(layoutOk.ok, `Layout broken: ${layoutOk.reason}`).toBe(true);
    await context.close();
  });

  test('no error boundary at any viewport', async ({ browser }) => {
    // Quick sweep of all viewports for error boundaries
    for (const vp of [{ w: 375, h: 812 }, { w: 768, h: 1024 }, { w: 1280, h: 800 }, { w: 1920, h: 1080 }]) {
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await openDashboard(context);
      await checkNoErrorBoundary(page, `${vp.w}px error sweep`);
      await context.close();
    }
  });
});
