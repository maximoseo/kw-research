import ResearchDashboard from '@/components/research/ResearchDashboard';
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

  return <ResearchDashboard project={project} />;
}
