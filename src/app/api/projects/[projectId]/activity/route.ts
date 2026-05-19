import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/server/auth/guards';
import { getProjectActivity } from '@/server/research/activity-repository';
import { requireProjectAccess } from '@/server/auth/guards';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  await requireAuthenticatedUser();
  await requireProjectAccess(params.projectId);

  const limit = _request.nextUrl.searchParams.get('limit');
  const activities = await getProjectActivity(params.projectId, limit ? parseInt(limit, 10) : 20);

  return NextResponse.json({ activities });
}
