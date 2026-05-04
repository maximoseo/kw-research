'use client';

import { useCallback, useState } from 'react';
import { Download, HelpCircle, Loader2, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, EmptyState, Field } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type { QuestionResult } from '@/app/api/keywords/questions/route';

interface QuestionsTabProps {
  seedKeyword: string;
  onAddKeyword?: (keyword: string) => void;
}

const volumeBadgeMap: Record<QuestionResult['estimatedVolume'], { variant: 'success' | 'warning' | 'info'; label: string }> = {
  high: { variant: 'success', label: 'High volume' },
  medium: { variant: 'warning', label: 'Medium volume' },
  low: { variant: 'info', label: 'Low volume' },
};

function QuestionsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border border-border/30 bg-surface-raised/40 p-3">
          <div className="h-4 w-4 mt-0.5 bg-border/30 rounded shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-border/30 rounded w-3/4" />
            <div className="h-3 bg-border/20 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function exportQuestionsAsCSV(questions: QuestionResult[], keyword: string) {
  const header = 'question,estimatedVolume,seedKeyword';
  const rows = questions.map(
    (q) => `"${q.question.replace(/"/g, '""')}","${q.estimatedVolume}","${keyword.replace(/"/g, '""')}"`,
  );
  const csv = [header, ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeName = keyword.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'questions';
  anchor.download = `paa-questions-${safeName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function QuestionsTab({ seedKeyword, onAddKeyword }: QuestionsTabProps) {
  const { addToast } = useToast();
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set());

  const questionsQuery = useQuery({
    queryKey: ['questions', seedKeyword],
    queryFn: async () => {
      const params = new URLSearchParams({ keyword: seedKeyword });
      const response = await fetch(`/api/keywords/questions?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load questions');
      }
      return payload as { questions: QuestionResult[]; cached: boolean };
    },
    enabled: Boolean(seedKeyword),
    staleTime: 5 * 60 * 1000,
  });

  const questions = questionsQuery.data?.questions ?? [];
  const isCached = questionsQuery.data?.cached ?? false;
  const isLoading = questionsQuery.isLoading;
  const error = questionsQuery.error;

  const handleAddKeyword = useCallback(
    (question: string) => {
      setAddedSet((prev) => new Set(prev).add(question));
      onAddKeyword?.(question);
      addToast(`"${question}" added to workspace`, 'success');
    },
    [onAddKeyword, addToast],
  );

  const handleExport = useCallback(() => {
    if (questions.length === 0) return;
    exportQuestionsAsCSV(questions, seedKeyword);
    addToast('Questions exported as CSV', 'success');
  }, [questions, seedKeyword, addToast]);

  if (!seedKeyword) {
    return (
      <EmptyState
        icon={<Search className="h-8 w-8 text-text-muted" />}
        title="No keyword selected"
        description="Select a keyword to discover related search questions."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">People Also Ask</p>
          <h3 className="text-heading-2 mt-1 text-text-primary flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-accent" />
            Questions for &ldquo;{seedKeyword}&rdquo;
          </h3>
          <p className="text-caption text-text-muted mt-1">
            {isCached && questions.length > 0
              ? 'Loaded from cache \u00b7 AI-generated questions'
              : 'AI-generated search questions \u00b7 cached for 24 hours'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {questions.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={handleExport}
            >
              Export CSV
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            loading={questionsQuery.isRefetching}
            onClick={() => questionsQuery.refetch()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <QuestionsSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] p-5 text-center">
          <p className="text-body font-medium text-destructive">
            {error instanceof Error ? error.message : 'Failed to load questions'}
          </p>
          <p className="mt-2 text-caption text-text-muted">
            Make sure your AI API key is configured (ANTHROPIC_API_KEY).
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => questionsQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<HelpCircle className="h-8 w-8 text-text-muted" />}
          title="No questions yet"
          description="Click refresh to generate search questions for this keyword."
          action={{
            label: 'Generate questions',
            onClick: () => questionsQuery.refetch(),
          }}
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="flex items-center gap-4 text-caption text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {questions.length} questions generated
            </span>
            {isCached && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/[0.06] border border-accent/15 px-2 py-0.5 text-[10px] text-accent font-medium">
                Cached
              </span>
            )}
          </div>

          {/* Questions list */}
          <ul className="space-y-2.5">
            {questions.map((item, index) => {
              const badgeInfo = volumeBadgeMap[item.estimatedVolume];
              const isAdded = addedSet.has(item.question);

              return (
                <li
                  key={index}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border border-border/40 bg-surface-raised/50 p-3 transition-all',
                    'hover:border-accent/20 hover:bg-accent/[0.02]',
                    isAdded && 'border-success/30 bg-success/[0.03]',
                  )}
                >
                  <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-text-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body text-text-primary leading-relaxed">{item.question}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant={badgeInfo.variant} dot={false}>
                        {badgeInfo.label}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={isAdded ? 'ghost' : 'secondary'}
                    size="sm"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    disabled={isAdded}
                    onClick={() => handleAddKeyword(item.question)}
                    className="shrink-0"
                    title={isAdded ? 'Already added' : 'Add as keyword'}
                  >
                    {isAdded ? 'Added' : 'Use as keyword'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
