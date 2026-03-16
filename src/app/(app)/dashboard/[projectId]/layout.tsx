import { AppShell } from '@/components/app/AppShell';
import { ProjectSelectionSync } from '@/components/app/ProjectSelectionSync';
import { requireProjectAccess } from '@/server/auth/guards';

export default async function ProjectDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  const { user, project } = await requireProjectAccess(params.projectId);

  return (
    <>
      <ProjectSelectionSync projectId={project.id} />
      <AppShell
        user={{
          email: user.email,
          displayName: user.displayName,
        }}
        project={project}
      >
        {children}
      </AppShell>
    </>
  );
}
