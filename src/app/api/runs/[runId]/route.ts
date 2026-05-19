import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { deleteRun, getRunForUser } from '@/server/research/repository';

export async function GET(
  request: Request,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const run = await getRunForUser(user.id, params.runId);

  if (!run) {
    return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (projectId && run.projectId !== projectId) {
    return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
  }

  return NextResponse.json({ run });
}

const deleteRunParamsSchema = z.object({
  runId: z.string().uuid(),
});

export async function DELETE(request: Request, { params }: { params: { runId: string } }) {
  const parsed = deleteRunParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid run ID.', code: 'INVALID_PARAMS' }, { status: 400 });
  }

  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const deleted = await deleteRun(parsed.data.runId, user.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Run not found or access denied.', code: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
