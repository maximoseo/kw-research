import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { db } from '@/server/db/client';
import { researchRuns } from '@/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = params;

  const rows = await db
    .select({
      totalRuns: sql<number>`COUNT(*)`,
      completedRuns: sql<number>`SUM(CASE WHEN ${researchRuns.status} = 'completed' THEN 1 ELSE 0 END)`,
      failedRuns: sql<number>`SUM(CASE WHEN ${researchRuns.status} = 'failed' THEN 1 ELSE 0 END)`,
      processingRuns: sql<number>`SUM(CASE WHEN ${researchRuns.status} = 'processing' OR ${researchRuns.status} = 'queued' THEN 1 ELSE 0 END)`,
    })
    .from(researchRuns)
    .where(and(eq(researchRuns.projectId, projectId), eq(researchRuns.userId, user.id)))
    .get();

  if (!rows) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const totalRuns = Number(rows.totalRuns) || 0;
  const completedRuns = Number(rows.completedRuns) || 0;
  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;

  return NextResponse.json({
    totalRuns,
    completedRuns,
    failedRuns: Number(rows.failedRuns) || 0,
    processingRuns: Number(rows.processingRuns) || 0,
    successRate,
    isEmpty: totalRuns === 0,
  });
}
