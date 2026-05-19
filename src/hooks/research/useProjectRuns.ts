'use client';

import { useQuery } from '@tanstack/react-query';
import type { ResearchRunSummary } from '@/lib/research';

function buildRunsUrl(projectId: string) {
  return `/api/runs?projectId=${encodeURIComponent(projectId)}`;
}

export function useProjectRuns(projectId: string) {
  return useQuery({
    queryKey: ['runs', projectId],
    queryFn: async () => {
      const response = await fetch(buildRunsUrl(projectId));
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load runs.');
      return payload.runs as ResearchRunSummary[];
    },
    refetchInterval: (query) => {
      const runs = (query.state.data || []) as ResearchRunSummary[];
      return runs.some((run) => run.status === 'queued' || run.status === 'processing') ? 4000 : false;
    },
  });
}
