import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getRunRecord, updateRunState, addResearchLog } from '@/server/research/repository';
import { broadcastRunProgress } from '@/server/research/progress';

export async function POST(
  request: Request,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const run = await getRunRecord(params.runId);
  if (!run || run.userId !== user.id) {
    return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
  }

  if (run.status !== 'queued' && run.status !== 'processing') {
    return NextResponse.json({ error: 'Run is not in a cancellable state.' }, { status: 400 });
  }

  await updateRunState(params.runId, {
    status: 'cancelled',
    step: 'Cancelled by user',
    workerId: null,
    lockAcquiredAt: null,
  });

  await addResearchLog({
    runId: params.runId,
    stage: 'system',
    level: 'info',
    message: 'Run cancelled by user.',
  });

  broadcastRunProgress({
    runId: params.runId,
    progress: run.progress ?? 0,
    step: 'Cancelled by user',
    status: 'cancelled',
  });

  return NextResponse.json({ ok: true });
}
