import { randomUUID } from 'crypto';
import { and, asc, desc, eq, inArray, lt, or } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { projects, researchLogs, researchRuns, uploadedFiles } from '@/server/db/schema';
import { safeJsonParse } from '@/lib/utils';
import type {
  ResearchInputSnapshot,
  ResearchRunDetail,
  ResearchRunLog,
  ResearchMode,
  ResearchStatus,
  ResearchRunSummary,
  SiteLanguage,
  UploadedResearchSummary,
} from '@/lib/research';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return safeJsonParse(value, fallback);
}

export async function createProjectAndRun(params: {
  userId: string;
  projectName: string;
  brandName: string;
  language: 'English' | 'Hebrew';
  market: string;
  homepageUrl: string;
  aboutUrl: string;
  sitemapUrl: string;
  competitorUrls: string[];
  notes: string;
  targetRows: number;
  mode: 'fresh' | 'expand';
  uploadedFile?: {
    originalName: string;
    storedPath: string;
    mimeType: string;
    sizeBytes: number;
    summary: UploadedResearchSummary | null;
  } | null;
}) {
  const now = Date.now();
  const projectId = randomUUID();
  const runId = randomUUID();

  await db.insert(projects).values({
    id: projectId,
    userId: params.userId,
    name: params.projectName,
    brandName: params.brandName,
    language: params.language,
    market: params.market,
    homepageUrl: params.homepageUrl,
    aboutUrl: params.aboutUrl,
    sitemapUrl: params.sitemapUrl,
    competitorUrls: JSON.stringify(params.competitorUrls),
    notes: params.notes,
    createdAt: now,
    updatedAt: now,
  });

  let uploadedFileId: string | null = null;
  if (params.uploadedFile) {
    uploadedFileId = randomUUID();
    await db.insert(uploadedFiles).values({
      id: uploadedFileId,
      userId: params.userId,
      runId,
      originalName: params.uploadedFile.originalName,
      storedPath: params.uploadedFile.storedPath,
      mimeType: params.uploadedFile.mimeType,
      sizeBytes: params.uploadedFile.sizeBytes,
      summary: JSON.stringify(params.uploadedFile.summary),
      createdAt: now,
    });
  }

  const inputSnapshot: ResearchInputSnapshot = {
    homepageUrl: params.homepageUrl,
    aboutUrl: params.aboutUrl,
    sitemapUrl: params.sitemapUrl,
    brandName: params.brandName,
    language: params.language,
    market: params.market,
    competitorUrls: params.competitorUrls,
    notes: params.notes,
    targetRows: params.targetRows,
    mode: params.mode,
    existingResearchSummary: params.uploadedFile?.summary || null,
  };

  await db.insert(researchRuns).values({
    id: runId,
    projectId,
    userId: params.userId,
    mode: params.mode,
    status: 'queued',
    step: 'Queued',
    targetRows: params.targetRows,
    inputSnapshot: JSON.stringify(inputSnapshot),
    uploadedFileId,
    queuedAt: now,
    updatedAt: now,
  });

  await addResearchLog({
    runId,
    stage: 'system',
    level: 'info',
    message: 'Run queued successfully.',
    metadata: {
      targetRows: params.targetRows,
      mode: params.mode,
    },
  });

  return { projectId, runId };
}

export async function addResearchLog(params: {
  runId: string;
  stage: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(researchLogs).values({
    id: randomUUID(),
    runId: params.runId,
    stage: params.stage,
    level: params.level,
    message: params.message,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    createdAt: Date.now(),
  });
}

export async function listRunsForUser(userId: string, limit = 24): Promise<ResearchRunSummary[]> {
  const rows = await db
    .select({
      id: researchRuns.id,
      projectId: researchRuns.projectId,
      projectName: projects.name,
      brandName: projects.brandName,
      language: projects.language,
      market: projects.market,
      mode: researchRuns.mode,
      status: researchRuns.status,
      step: researchRuns.step,
      targetRows: researchRuns.targetRows,
      queuedAt: researchRuns.queuedAt,
      completedAt: researchRuns.completedAt,
      workbookName: researchRuns.workbookName,
      errorMessage: researchRuns.errorMessage,
    })
    .from(researchRuns)
    .innerJoin(projects, eq(projects.id, researchRuns.projectId))
    .where(eq(researchRuns.userId, userId))
    .orderBy(desc(researchRuns.queuedAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    language: row.language as SiteLanguage,
    mode: row.mode as ResearchMode,
    status: row.status as ResearchStatus,
  }));
}

export async function getRunForUser(userId: string, runId: string): Promise<ResearchRunDetail | null> {
  const runRows = await db
    .select({
      id: researchRuns.id,
      projectId: researchRuns.projectId,
      projectName: projects.name,
      brandName: projects.brandName,
      language: projects.language,
      market: projects.market,
      mode: researchRuns.mode,
      status: researchRuns.status,
      step: researchRuns.step,
      targetRows: researchRuns.targetRows,
      queuedAt: researchRuns.queuedAt,
      completedAt: researchRuns.completedAt,
      workbookName: researchRuns.workbookName,
      errorMessage: researchRuns.errorMessage,
      inputSnapshot: researchRuns.inputSnapshot,
      resultRows: researchRuns.resultRows,
      siteSnapshot: researchRuns.siteSnapshot,
      competitorSnapshot: researchRuns.competitorSnapshot,
      resultSummary: researchRuns.resultSummary,
      uploadedFileId: researchRuns.uploadedFileId,
    })
    .from(researchRuns)
    .innerJoin(projects, eq(projects.id, researchRuns.projectId))
    .where(and(eq(researchRuns.id, runId), eq(researchRuns.userId, userId)))
    .limit(1);

  const run = runRows[0];
  if (!run) {
    return null;
  }

  const logRows = await db
    .select()
    .from(researchLogs)
    .where(eq(researchLogs.runId, runId))
    .orderBy(asc(researchLogs.createdAt));

  const logs: ResearchRunLog[] = logRows.map((row) => ({
    id: row.id,
    runId: row.runId,
    stage: row.stage,
    level: row.level as ResearchRunLog['level'],
    message: row.message,
    metadata: parseJson(row.metadata, null),
    createdAt: row.createdAt,
  }));

  return {
    id: run.id,
    projectId: run.projectId,
    projectName: run.projectName,
    brandName: run.brandName,
    language: run.language as ResearchRunDetail['language'],
    market: run.market,
    mode: run.mode as ResearchRunDetail['mode'],
    status: run.status as ResearchRunDetail['status'],
    step: run.step,
    targetRows: run.targetRows,
    queuedAt: run.queuedAt,
    completedAt: run.completedAt,
    workbookName: run.workbookName,
    errorMessage: run.errorMessage,
    input: parseJson(run.inputSnapshot, {} as ResearchInputSnapshot),
    rows: parseJson(run.resultRows, []),
    logs,
    siteSnapshot: parseJson(run.siteSnapshot, null),
    competitorSnapshot: parseJson(run.competitorSnapshot, null),
    resultSummary: parseJson(run.resultSummary, null),
    uploadedFileId: run.uploadedFileId,
  };
}

export async function getRunRecord(runId: string) {
  const rows = await db.select().from(researchRuns).where(eq(researchRuns.id, runId)).limit(1);
  return rows[0] ?? null;
}

export async function getRunDownloadRecord(userId: string, runId: string) {
  const rows = await db
    .select({
      workbookPath: researchRuns.workbookPath,
      workbookName: researchRuns.workbookName,
      workbookMime: researchRuns.workbookMime,
    })
    .from(researchRuns)
    .where(and(eq(researchRuns.id, runId), eq(researchRuns.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function updateRunState(runId: string, updates: Partial<typeof researchRuns.$inferInsert>) {
  await db
    .update(researchRuns)
    .set({
      ...updates,
      updatedAt: Date.now(),
    })
    .where(eq(researchRuns.id, runId));
}

export async function claimNextQueuedRun(params: { workerId: string; staleLockMs: number }) {
  const now = Date.now();
  const candidates = await db
    .select()
    .from(researchRuns)
    .where(
      or(
        eq(researchRuns.status, 'queued'),
        and(eq(researchRuns.status, 'processing'), lt(researchRuns.lockAcquiredAt, now - params.staleLockMs)),
      ),
    )
    .orderBy(asc(researchRuns.queuedAt))
    .limit(1);

  const candidate = candidates[0];
  if (!candidate) {
    return null;
  }

  await db
    .update(researchRuns)
    .set({
      status: 'processing',
      step: candidate.startedAt ? candidate.step : 'Starting',
      workerId: params.workerId,
      lockAcquiredAt: now,
      startedAt: candidate.startedAt ?? now,
      updatedAt: now,
    })
    .where(eq(researchRuns.id, candidate.id));

  return getRunRecord(candidate.id);
}

export async function heartbeatRun(runId: string) {
  await db
    .update(researchRuns)
    .set({
      lockAcquiredAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(researchRuns.id, runId));
}

export async function listRecentRunIds(limit = 12) {
  const rows = await db.select({ id: researchRuns.id }).from(researchRuns).orderBy(desc(researchRuns.queuedAt)).limit(limit);
  return rows.map((row) => row.id);
}

export async function getRunsByIds(runIds: string[]) {
  if (!runIds.length) {
    return [];
  }

  return db.select().from(researchRuns).where(inArray(researchRuns.id, runIds));
}

export async function resetActiveRunLocks(workerId: string) {
  await db
    .update(researchRuns)
    .set({
      status: 'queued',
      step: 'Recovered from restart',
      workerId: null,
      lockAcquiredAt: null,
      updatedAt: Date.now(),
    })
    .where(and(eq(researchRuns.status, 'processing'), eq(researchRuns.workerId, workerId)));
}

export async function attachWorkbookToRun(runId: string, params: {
  workbookPath: string;
  workbookName: string;
  workbookMime: string;
  rows: string;
  summary: string;
  siteSnapshot: string;
  competitorSnapshot: string;
}) {
  await db
    .update(researchRuns)
    .set({
      workbookPath: params.workbookPath,
      workbookName: params.workbookName,
      workbookMime: params.workbookMime,
      resultRows: params.rows,
      resultSummary: params.summary,
      siteSnapshot: params.siteSnapshot,
      competitorSnapshot: params.competitorSnapshot,
      status: 'completed',
      step: 'Completed',
      completedAt: Date.now(),
      workerId: null,
      lockAcquiredAt: null,
      errorMessage: null,
      updatedAt: Date.now(),
    })
    .where(eq(researchRuns.id, runId));
}

export async function failRun(runId: string, errorMessage: string) {
  await db
    .update(researchRuns)
    .set({
      status: 'failed',
      step: 'Failed',
      errorMessage,
      workerId: null,
      lockAcquiredAt: null,
      updatedAt: Date.now(),
    })
    .where(eq(researchRuns.id, runId));
}

export async function getUploadedFileSummary(fileId: string | null | undefined) {
  if (!fileId) {
    return null;
  }

  const rows = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
  const file = rows[0];
  if (!file) {
    return null;
  }

  return {
    ...file,
    summary: parseJson(file.summary, null),
  };
}
