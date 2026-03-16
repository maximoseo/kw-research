import { redirect } from 'next/navigation';
import { requireAuthenticatedUser } from '@/server/auth/guards';
import { buildProjectRunPath } from '@/lib/project-context';
import { getRunForUser } from '@/server/research/repository';

export default async function LegacyRunDetailPage({
  params,
}: {
  params: { runId: string };
}) {
  const user = await requireAuthenticatedUser();
  const run = await getRunForUser(user.id, params.runId);

  if (!run) {
    redirect('/dashboard');
  }

  redirect(buildProjectRunPath(run.projectId, run.id));
}
