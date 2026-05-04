import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import ResearchDashboard from '@/components/research/ResearchDashboard';
import { requireProjectAccess } from '@/server/auth/guards';
import { getRunForUser } from '@/server/research/repository';

export default async function ProjectRunDetailPage({
  params,
}: {
  params: { projectId: string; runId: string };
}) {
  const { project, user } = await requireProjectAccess(params.projectId);
  const run = await getRunForUser(user.id, params.runId);
  if (!run || run.projectId !== project.id) {
    redirect(`/dashboard/${project.id}`);
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>}>
      <ResearchDashboard project={project} initialRunId={params.runId} />
    </Suspense>
  );
}
