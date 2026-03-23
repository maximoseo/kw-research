import { test, expect } from '@playwright/test';
import { getAuthCookie, createProjectAndRunViaApi, waitForRunCompletion } from './helpers/auth';
import { assertOutputQuality } from './helpers/research-output-validators';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const TARGET_ROWS = 150;

let sessionCookie: string;
let projectId: string;
let runId: string;

test.describe('Research Flow — English Site (chimneysweepproshouston.com)', () => {
  test.setTimeout(900_000); // 15 minutes — full pipeline run

  test.beforeAll(async () => {
    sessionCookie = await getAuthCookie();
  });

  test('create English project and start research run', async () => {
    const result = await createProjectAndRunViaApi(sessionCookie, {
      homepageUrl: 'https://chimneysweepproshouston.com/',
      brandName: 'Chimney Sweep Pros Houston',
      language: 'English',
      market: 'Houston, TX',
      targetRows: TARGET_ROWS,
      notes: 'E2E test — English site research flow',
    });
    projectId = result.projectId;
    runId = result.runId;
    expect(projectId).toBeTruthy();
    expect(runId).toBeTruthy();
  });

  test('pipeline completes without error', async () => {
    const result = await waitForRunCompletion(sessionCookie, runId, 840_000);
    expect(result.status, `Run failed: ${result.errorMessage}`).toBe('completed');
    expect(result.workbookName).toBeTruthy();
  });

  test('output passes quality assertions', async () => {
    const res = await fetch(`${BASE}/api/runs/${runId}`, {
      headers: { cookie: `kwr_session=${sessionCookie}` },
    });
    expect(res.ok).toBe(true);

    const data = await res.json();
    const rows = data.rows || [];
    assertOutputQuality(rows, 'English', TARGET_ROWS);
  });

  test('workbook download returns valid xlsx', async () => {
    const res = await fetch(`${BASE}/api/runs/${runId}/download`, {
      headers: { cookie: `kwr_session=${sessionCookie}` },
    });
    expect(res.ok, 'Workbook download failed').toBe(true);

    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('spreadsheet');

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength, 'Workbook is empty').toBeGreaterThan(1000);
  });
});
