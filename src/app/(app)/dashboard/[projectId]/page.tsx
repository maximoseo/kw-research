import { Suspense } from 'react';
import ProjectDashboardView from '@/components/research/ProjectDashboardView';
import { requireProjectAccess } from '@/server/auth/guards';

export const metadata = {
  title: 'Project Dashboard · KW Research',
};

export default async function ProjectDashboardPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { project } = await requireProjectAccess(params.projectId);

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>}>
      <ProjectDashboardView project={project} />
    </Suspense>
  );
}
