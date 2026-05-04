import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getRunRecord } from '@/server/research/repository';
import { subscribeRunProgress, type RunProgressEvent } from '@/server/research/progress';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send the current state immediately
      const initialEvent: RunProgressEvent = {
        runId: params.runId,
        progress: run.progress ?? 0,
        step: run.step ?? run.status,
        status: run.status,
        resultCount: run.resultRows ? JSON.parse(run.resultRows).length : 0,
        errorMessage: run.errorMessage ?? undefined,
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`));

      const unsubscribe = subscribeRunProgress(params.runId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          unsubscribe();
        }
      });

      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(interval);
        }
      }, 15000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
