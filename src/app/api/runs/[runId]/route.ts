import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getRunForUser } from '@/server/research/repository';

export async function GET(
  _request: Request,
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

  return NextResponse.json({ run });
}
