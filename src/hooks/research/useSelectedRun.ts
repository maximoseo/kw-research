'use client';

import { useQuery } from '@tanstack/react-query';
import type { ResearchRunDetail } from '@/lib/research';

function buildRunUrl(projectId: string, runId: string) {
  return `/api/runs/${runId}?projectId=${encodeURIComponent(projectId)}`;
}

export function useSelectedRun(projectId: string, runId: string | null) {
  return useQuery({
    queryKey: ['run', projectId, runId],
    queryFn: async () => {
      const response = await fetch(buildRunUrl(projectId, runId!));
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load the run.');
      return payload.run as ResearchRunDetail;
    },
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const run = query.state.data as ResearchRunDetail | undefined;
      return run && (run.status === 'queued' || run.status === 'processing') ? 3000 : false;
    },
  });
}
