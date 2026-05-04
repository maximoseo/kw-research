import { randomUUID } from 'crypto';
import { safeJsonParse } from '@/lib/utils';
import { getRunnerPollIntervalMs, getRunnerStaleLockMs } from '@/lib/env';
import { addResearchLog, claimNextQueuedRun, failRun, getRunRecord, updateRunState, attachWorkbookToRun } from './repository';
import { runResearchPipeline } from './pipeline';
import { getCacheEntry, hashSearchParams, setCacheEntry } from './cache';
import type { ResearchInputSnapshot } from '@/lib/research';
import { broadcastRunProgress } from './progress';
import { deleteExpiredEntries } from './cache';

declare global {
  // eslint-disable-next-line no-var
  var __kwResearchWorkerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __kwCacheCleanupInterval: ReturnType<typeof setInterval> | undefined;
}

export function startResearchWorker() {
  if (process.env.DISABLE_WORKER === '1') {
    return;
  }

  if (global.__kwResearchWorkerStarted) {
    return;
  }

  global.__kwResearchWorkerStarted = true;

  // Run expired cache cleanup on startup
  deleteExpiredEntries()
    .then((deleted) => {
      if (deleted > 0) {
        console.info(`[cache-cleanup] Deleted ${deleted} expired cache entries on startup.`);
      }
    })
    .catch((err) => {
      console.warn('[cache-cleanup] Failed to clean expired cache entries:', err instanceof Error ? err.message : err);
    });

  // Schedule daily cache cleanup (every 24 hours)
  if (!global.__kwCacheCleanupInterval) {
    global.__kwCacheCleanupInterval = setInterval(() => {
      deleteExpiredEntries()
        .then((deleted) => {
          if (deleted > 0) {
            console.info(`[cache-cleanup] Daily cleanup: deleted ${deleted} expired cache entries.`);
          }
        })
        .catch((err) => {
          console.warn('[cache-cleanup] Daily cleanup failed:', err instanceof Error ? err.message : err);
        });
    }, 24 * 60 * 60 * 1000);
  }
  const workerId = `worker-${randomUUID()}`;

  const tick = async () => {
    const claimed = await claimNextQueuedRun({
      workerId,
      staleLockMs: getRunnerStaleLockMs(),
    });

    if (!claimed) {
      return;
    }

    try {
      const input = safeJsonParse(claimed.inputSnapshot, null as ResearchInputSnapshot | null);
      if (!input) {
        throw new Error('Run input was missing or invalid.');
      }

      // Determine if this is a refresh (force re-fetch) request
      const rawInput = safeJsonParse(claimed.inputSnapshot, {} as Record<string, unknown>);
      const shouldRefresh = rawInput?.refresh === true;
      const userId = claimed.userId;

      // Build cache payload and hash
      const cachePayload = {
        projectId: claimed.projectId,
        homepageUrl: input.homepageUrl,
        aboutUrl: input.aboutUrl,
        sitemapUrl: input.sitemapUrl,
        brandName: input.brandName,
        language: input.language,
        market: input.market,
        competitorUrls: input.competitorUrls,
        notes: input.notes ?? '',
        targetRows: input.targetRows,
        mode: input.mode,
        existingResearchSummary: input.existingResearchSummary,
      };
      const queryHash = hashSearchParams(cachePayload);

      // Check cache (skip if refresh requested)
      if (!shouldRefresh) {
        const cached = await getCacheEntry(queryHash);
        if (cached) {
          const cachedData = JSON.parse(cached);
          // Immediately complete the run with cached results
          await attachWorkbookToRun(claimed.id, {
            workbookPath: cachedData.workbookPath,
            workbookName: cachedData.workbookName,
            workbookMime: cachedData.workbookMime,
            rows: cachedData.rows,
            summary: cachedData.summary,
            siteSnapshot: cachedData.siteSnapshot,
            competitorSnapshot: cachedData.competitorSnapshot,
            synthesisSnapshot: cachedData.synthesisSnapshot,
          });
          await addResearchLog({
            runId: claimed.id,
            stage: 'cache',
            level: 'info',
            message: 'Results served from cache (identical parameters).',
            metadata: { queryHash, cacheHit: true },
          });
          console.info(`[worker:${workerId}] Cache hit for run ${claimed.id}, skipping pipeline`);
          return;
        }
      }

      // Run the full pipeline (cache miss or refresh)
      await runResearchPipeline({
        runId: claimed.id,
        input,
        refresh: shouldRefresh,
      });

      // After successful completion, cache the results
      const completedRun = await getRunRecord(claimed.id);
      if (completedRun?.status === 'completed' && completedRun.workbookPath) {
        await setCacheEntry(userId, queryHash, JSON.stringify({
          workbookPath: completedRun.workbookPath,
          workbookName: completedRun.workbookName,
          workbookMime: completedRun.workbookMime,
          rows: completedRun.resultRows,
          summary: completedRun.resultSummary,
          siteSnapshot: completedRun.siteSnapshot,
          competitorSnapshot: completedRun.competitorSnapshot,
          synthesisSnapshot: completedRun.synthesisSnapshot,
        }));
        console.info(`[worker:${workerId}] Cached results for hash ${queryHash}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Research pipeline failed.';
      console.error(`[worker:${workerId}] Pipeline failed for run ${claimed.id}:`, message, error);
      await addResearchLog({
        runId: claimed.id,
        stage: 'system',
        level: 'error',
        message,
      });
      await failRun(claimed.id, message);
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, getRunnerPollIntervalMs());
}

/**
 * Check whether a run has been cancelled. If so, throw so the worker exits cleanly.
 */
export async function assertNotCancelled(runId: string): Promise<void> {
  const run = await getRunRecord(runId);
  if (run?.status === 'cancelled') {
    throw new Error('Run was cancelled.');
  }
}

/**
 * Update progress for a run and broadcast via SSE.
 */
export async function updateRunProgress(
  runId: string,
  progress: number,
  step: string,
  resultCount?: number,
): Promise<void> {
  const updates: Record<string, unknown> = { progress, step };
  await updateRunState(runId, updates);

  broadcastRunProgress({
    runId,
    progress,
    step,
    resultCount: resultCount ?? undefined,
    status: 'processing',
  });
}
