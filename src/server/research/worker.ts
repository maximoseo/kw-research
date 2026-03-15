import { randomUUID } from 'crypto';
import { safeJsonParse } from '@/lib/utils';
import { getRunnerPollIntervalMs, getRunnerStaleLockMs } from '@/lib/env';
import { addResearchLog, claimNextQueuedRun, failRun, resetActiveRunLocks } from './repository';
import { runResearchPipeline } from './pipeline';
import type { ResearchInputSnapshot } from '@/lib/research';

declare global {
  // eslint-disable-next-line no-var
  var __kwResearchWorkerStarted: boolean | undefined;
}

export function startResearchWorker() {
  if (process.env.DISABLE_WORKER === '1') {
    return;
  }

  if (global.__kwResearchWorkerStarted) {
    return;
  }

  global.__kwResearchWorkerStarted = true;
  const workerId = `worker-${randomUUID()}`;

  void resetActiveRunLocks(workerId);

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

      await runResearchPipeline({
        runId: claimed.id,
        input,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Research pipeline failed.';
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
