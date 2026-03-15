import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { db } from '@/server/db/client';
import { researchRuns } from '@/server/db/schema';
import { addResearchLog, getRunForUser } from '@/server/research/repository';
import { startResearchWorker } from '@/server/research/worker';

export async function POST(
  _request: Request,
  { params }: { params: { runId: string } },
) {
  startResearchWorker();
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const run = await getRunForUser(user.id, params.runId);
  if (!run) {
    return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
  }

  await db
    .update(researchRuns)
    .set({
      status: 'queued',
      step: 'Queued',
      errorMessage: null,
      queuedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(and(eq(researchRuns.id, params.runId), eq(researchRuns.userId, user.id)));

  await addResearchLog({
    runId: params.runId,
    stage: 'system',
    level: 'info',
    message: 'Run queued for retry.',
  });

  startResearchWorker();

  return NextResponse.json({ ok: true });
}
