'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, FileText, Play, AlertTriangle, Download } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

interface ActivityFeedProps {
  projectId: string;
  limit?: number;
}

const iconMap: Record<string, React.ReactNode> = {
  run_started: <Play className="h-3.5 w-3.5" />,
  run_completed: <FileText className="h-3.5 w-3.5" />,
  run_failed: <AlertTriangle className="h-3.5 w-3.5" />,
  workbook_exported: <Download className="h-3.5 w-3.5" />,
  run_cancelled: <Clock className="h-3.5 w-3.5" />,
};

export default function ProjectActivityFeed({ projectId, limit = 10 }: ActivityFeedProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/activity?limit=${limit}`);
      if (!res.ok) return [];
      const body = await res.json();
      return body.activities || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-raised" />
        ))}
      </div>
    );
  }

  if (!activities?.length) {
    return <p className="text-body-sm text-text-muted">No activity yet.</p>;
  }

  return (
    <div className="space-y-0.5">
      {activities.slice(0, limit).map((activity: Record<string, unknown>) => (
        <div
          key={activity.id as string}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-body-sm transition-colors hover:bg-surface-raised/60"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border/40 bg-surface-raised text-text-muted">
            {(iconMap[activity.event_type as string] as React.ReactNode) || <Clock className="h-3.5 w-3.5" />}
          </span>
          <span className="flex-1 text-text-secondary">{activity.message as string}</span>
          <span className="shrink-0 text-caption text-text-muted">
            {formatRelative(activity.created_at as string)}
          </span>
        </div>
      ))}
    </div>
  );
}
