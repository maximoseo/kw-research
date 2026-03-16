'use client';

import { useEffect } from 'react';
import { SELECTED_PROJECT_COOKIE_NAME, SELECTED_PROJECT_STORAGE_KEY } from '@/lib/project-context';

export function ProjectSelectionSync({ projectId }: { projectId: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, projectId);
    document.cookie = `${SELECTED_PROJECT_COOKIE_NAME}=${encodeURIComponent(projectId)}; path=/; max-age=2592000; samesite=lax`;
  }, [projectId]);

  return null;
}
