import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SELECTED_PROJECT_COOKIE_NAME, buildProjectDashboardPath } from '@/lib/project-context';
import { sanitizeRedirectPath } from '@/lib/auth';
import { getProjectForUser } from '@/server/research/repository';
import { getCurrentUser } from './session';

export async function requireAuthenticatedUser(redirectTo = '/dashboard') {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(sanitizeRedirectPath(redirectTo))}`);
  }

  return user;
}

export async function getAuthenticatedUserOrNull() {
  return getCurrentUser();
}

export async function requireProjectAccess(projectId: string) {
  const user = await requireAuthenticatedUser(buildProjectDashboardPath(projectId));
  const project = await getProjectForUser(user.id, projectId);
  if (!project) {
    redirect('/dashboard');
  }

  return {
    user,
    project,
  };
}

export async function getSelectedProjectRedirectPath(userId: string, fallback = '/dashboard') {
  const selectedProjectId = cookies().get(SELECTED_PROJECT_COOKIE_NAME)?.value;
  if (!selectedProjectId) {
    return fallback;
  }

  const project = await getProjectForUser(userId, selectedProjectId);
  return project ? buildProjectDashboardPath(project.id) : fallback;
}
