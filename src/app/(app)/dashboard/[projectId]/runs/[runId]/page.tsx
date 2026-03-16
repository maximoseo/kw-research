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

  return <ResearchDashboard project={project} initialRunId={params.runId} />;
}
