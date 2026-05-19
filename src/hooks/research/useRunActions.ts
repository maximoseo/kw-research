'use client';

import { useCallback, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseRunActionsOptions {
  projectId: string;
  addToast: (msg: string, type: 'error' | 'success') => void;
}

export function useRunActions({ projectId, addToast }: UseRunActionsOptions) {
  const queryClient = useQueryClient();
  const [isCreating, startCreate] = useTransition();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  const createRun = useCallback(async (payload: Record<string, unknown>) => {
    return new Promise<void>((resolve, reject) => {
      startCreate(async () => {
        try {
          const res = await fetch(`/api/research/trigger`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectId, ...payload }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || 'Failed to create run.');
          queryClient.invalidateQueries({ queryKey: ['runs', projectId] });
          addToast('Research run started.', 'success');
          resolve();
        } catch (err) {
          addToast(err instanceof Error ? err.message : 'Failed to start run.', 'error');
          reject(err);
        }
      });
    });
  }, [projectId, queryClient, addToast]);

  const cancelRun = useCallback(async (runId: string) => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/runs/${runId}/cancel`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to cancel run.');
      queryClient.invalidateQueries({ queryKey: ['runs', projectId] });
      addToast('Run cancelled.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to cancel.', 'error');
    } finally {
      setIsCancelling(false);
    }
  }, [projectId, queryClient, addToast]);

  const rerun = useCallback(async (runId: string) => {
    setIsRerunning(true);
    try {
      const res = await fetch(`/api/runs/${runId}/rerun`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to rerun.');
      queryClient.invalidateQueries({ queryKey: ['runs', projectId] });
      addToast('Run restarted.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to rerun.', 'error');
    } finally {
      setIsRerunning(false);
    }
  }, [projectId, queryClient, addToast]);

  const deleteRun = useCallback(async (runId: string) => {
    setDeletingRunId(runId);
    try {
      const res = await fetch(`/api/runs/${runId}?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to delete run.');
      queryClient.invalidateQueries({ queryKey: ['runs', projectId] });
      addToast('Run deleted.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete.', 'error');
    } finally {
      setDeletingRunId(null);
    }
  }, [projectId, queryClient, addToast]);

  return { createRun, cancelRun, rerun, deleteRun, isCreating, isCancelling, isRerunning, deletingRunId };
}
