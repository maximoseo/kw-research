export const SELECTED_PROJECT_COOKIE_NAME = 'kwr_project';
export const SELECTED_PROJECT_STORAGE_KEY = 'kwr:last-project-id';

export function buildProjectDashboardPath(projectId: string) {
  return `/dashboard/${projectId}`;
}

export function buildProjectRunPath(projectId: string, runId: string) {
  return `/dashboard/${projectId}/runs/${runId}`;
}
