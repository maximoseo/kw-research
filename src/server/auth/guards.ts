import { redirect } from 'next/navigation';
import { getCurrentUser } from './session';

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  return user;
}

export async function getAuthenticatedUserOrNull() {
  return getCurrentUser();
}
