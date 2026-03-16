import { redirect } from 'next/navigation';
import { getSelectedProjectRedirectPath, requireAuthenticatedUser } from '@/server/auth/guards';

export default async function RunsPage() {
  const user = await requireAuthenticatedUser();
  const redirectPath = await getSelectedProjectRedirectPath(user.id);
  redirect(redirectPath);
}
