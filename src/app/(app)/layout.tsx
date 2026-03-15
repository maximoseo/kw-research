import { AppShell } from '@/components/app/AppShell';
import { requireAuthenticatedUser } from '@/server/auth/guards';
import { startResearchWorker } from '@/server/research/worker';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  startResearchWorker();
  const user = await requireAuthenticatedUser();

  return (
    <AppShell
      user={{
        email: user.email,
        displayName: user.displayName,
      }}
    >
      {children}
    </AppShell>
  );
}
