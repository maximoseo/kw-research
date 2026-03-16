import { SiteSelectionDashboard } from '@/components/app/SiteSelectionDashboard';
import { requireAuthenticatedUser } from '@/server/auth/guards';
import { listProjectsForUser } from '@/server/research/repository';

export const metadata = {
  title: 'Select Website · KW Research',
};

export default async function DashboardSelectionPage() {
  const user = await requireAuthenticatedUser();
  const projects = await listProjectsForUser(user.id);

  return (
    <main className="page-shell flex flex-1 flex-col px-4 py-8 sm:px-6">
      <SiteSelectionDashboard
        user={{
          email: user.email,
          displayName: user.displayName,
        }}
        projects={projects}
      />
    </main>
  );
}
