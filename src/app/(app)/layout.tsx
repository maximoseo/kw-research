import { requireAuthenticatedUser } from '@/server/auth/guards';
import { startResearchWorker } from '@/server/research/worker';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  startResearchWorker();
  await requireAuthenticatedUser('/dashboard');

  return <>{children}</>;
}
