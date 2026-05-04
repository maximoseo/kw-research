'use client';

import { useCallback, useState, useTransition } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  GanttChart,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, EmptyState, Field, Skeleton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type {
  GeneratedContentBrief,
  BriefSection,
  ContentBriefSummary,
  ContentBriefFull,
} from '@/server/research/content-brief-repository';

// ── Types ──

type GenerateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; brief: GeneratedContentBrief }
  | { status: 'error'; message: string };

type ActiveView = 'generate' | 'saved';

// ── Sub-components ──

function H2Icon() {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/10 text-[10px] font-bold text-accent">H2</span>;
}

function H3Icon() {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-info/10 text-[10px] font-bold text-info">H3</span>;
}

function OutlineItem({ section }: { section: BriefSection }) {
  const isH2 = section.heading === 'H2';
  return (
    <li className={`flex items-start gap-2.5 ${isH2 ? '' : 'ml-5'}`}>
      {isH2 ? <H2Icon /> : <H3Icon />}
      <span className={`text-body ${isH2 ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
        {section.text}
      </span>
    </li>
  );
}

function LoadingSkeleton_brief() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 bg-border/30 rounded w-1/3" />
        <div className="h-5 bg-border/20 rounded w-1/2" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-border/20 rounded w-1/4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-border/15 rounded w-full" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-border/20 rounded w-1/4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 bg-border/15 rounded w-3/4" />
        ))}
      </div>
    </div>
  );
}

function BriefResult({
  brief,
  onCopy,
  onDownload,
  copied,
}: {
  brief: GeneratedContentBrief;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant={copied ? 'primary' : 'secondary'}
          size="sm"
          icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          onClick={onCopy}
        >
          {copied ? 'Copied' : 'Copy to Clipboard'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<Download className="h-3.5 w-3.5" />}
          onClick={onDownload}
        >
          Export .md
        </Button>
      </div>

      {/* Target keyword + secondary */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">
          <Target className="h-3 w-3 mr-1" />
          {brief.targetKeyword}
        </Badge>
        {brief.secondaryKeywords.map((kw) => (
          <Badge key={kw} variant="neutral">{kw}</Badge>
        ))}
      </div>

      {/* Word count */}
      <div className="flex items-center gap-2 text-body-sm text-text-secondary">
        <FileText className="h-4 w-4" />
        Recommended word count: <span className="font-semibold text-text-primary">{brief.recommendedWordCount.toLocaleString()} words</span>
      </div>

      {/* Titles */}
      <div>
        <h3 className="text-label font-semibold text-text-primary flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" />
          Title Options
        </h3>
        <ul className="mt-2 space-y-1.5">
          {brief.titles.map((title, i) => (
            <li key={i} className="flex items-start gap-2 text-body text-text-secondary">
              <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-caption font-semibold text-accent">
                {i + 1}
              </span>
              {title}
            </li>
          ))}
        </ul>
      </div>

      {/* Outline */}
      <div>
        <h3 className="text-label font-semibold text-text-primary flex items-center gap-2">
          <GanttChart className="h-4 w-4 text-accent" />
          Heading Structure
        </h3>
        <ol className="mt-2 space-y-2">
          {brief.outline.map((section, i) => (
            <OutlineItem key={i} section={section} />
          ))}
        </ol>
      </div>

      {/* Key Points */}
      <div>
        <h3 className="text-label font-semibold text-text-primary flex items-center gap-2">
          <Check className="h-4 w-4 text-success" />
          Key Points to Cover
        </h3>
        <ul className="mt-2 space-y-1.5">
          {brief.keyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2.5 text-body text-text-secondary">
              <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-success/60" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* Competitor Gap */}
      <div className="rounded-xl border border-warning/20 bg-warning/[0.04] p-4">
        <h3 className="text-label font-semibold text-text-primary flex items-center gap-2">
          <Target className="h-4 w-4 text-warning" />
          Competitor Content Gap
        </h3>
        <p className="mt-1.5 text-body text-text-secondary">{brief.competitorGap}</p>
      </div>

      {/* Unique Angle */}
      <div className="rounded-xl border border-accent/15 bg-accent/[0.03] p-4">
        <h3 className="text-label font-semibold text-text-primary flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" />
          Unique Angle
        </h3>
        <p className="mt-1.5 text-body text-text-secondary">{brief.uniqueAngle}</p>
      </div>
    </div>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ── Main Component ──

export default function ContentBriefGenerator({ projectId }: { projectId?: string }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  // Generate state
  const [keywordsText, setKeywordsText] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [competitorUrlsText, setCompetitorUrlsText] = useState('');
  const [generateState, setGenerateState] = useState<GenerateState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('generate');

  // Saved briefs query
  const savedBriefsQuery = useQuery({
    queryKey: ['content-briefs'],
    queryFn: async (): Promise<ContentBriefSummary[]> => {
      const res = await fetch('/api/content-briefs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load briefs');
      return data.briefs || [];
    },
  });

  // Selected saved brief
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);

  const selectedBriefQuery = useQuery({
    queryKey: ['content-brief', selectedBriefId],
    queryFn: async (): Promise<ContentBriefFull> => {
      const res = await fetch(`/api/content-briefs?id=${selectedBriefId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load brief');
      return data.brief;
    },
    enabled: Boolean(selectedBriefId),
  });

  const parseKeywords = (text: string): string[] =>
    text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const parseUrls = (text: string): string[] =>
    text
      .split(/[\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => s.startsWith('http'));

  const handleGenerate = () => {
    const keywords = parseKeywords(keywordsText);
    if (keywords.length === 0) {
      addToast('Please enter at least one keyword.', 'error');
      return;
    }

    startTransition(async () => {
      setGenerateState({ status: 'loading' });
      try {
        const res = await fetch('/api/content-briefs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            keywords,
            clusterName: clusterName.trim() || undefined,
            competitorUrls: parseUrls(competitorUrlsText),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to generate brief');
        }

        setGenerateState({ status: 'result', brief: data.brief });
        addToast('Brief generated successfully!', 'success');
        queryClient.invalidateQueries({ queryKey: ['content-briefs'] });
      } catch (error) {
        setGenerateState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to generate brief.',
        });
        addToast('Failed to generate brief.', 'error');
      }
    });
  };

  const handleCopy = useCallback(() => {
    if (generateState.status !== 'result') return;
    const b = generateState.brief;

    const md = buildMarkdown(b);
    navigator.clipboard.writeText(md).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      },
      () => addToast('Failed to copy to clipboard.', 'error'),
    );
  }, [generateState, addToast]);

  const handleDownload = useCallback(() => {
    if (generateState.status !== 'result') return;
    const b = generateState.brief;
    const md = buildMarkdown(b);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brief-${b.targetKeyword.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [generateState]);

  const handleDeleteBrief = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/content-briefs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      addToast('Brief deleted.', 'success');
      if (selectedBriefId === id) setSelectedBriefId(null);
      queryClient.invalidateQueries({ queryKey: ['content-briefs'] });
    } catch {
      addToast('Failed to delete brief.', 'error');
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      {/* View toggle */}
      <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-surface-raised/40 p-1 w-fit">
        {([
          { id: 'generate' as ActiveView, label: 'Generate Brief', icon: <Sparkles className="h-4 w-4" /> },
          { id: 'saved' as ActiveView, label: 'Saved Briefs', icon: <FileText className="h-4 w-4" /> },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveView(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-body-sm font-semibold transition-all duration-150 ${
              activeView === tab.id
                ? 'bg-surface text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-border/30'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-raised'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Generate View */}
      {activeView === 'generate' && (
        <div className="grid gap-6 xl:grid-cols-[0.45fr_0.55fr] [&>*]:min-w-0">
          {/* Input form */}
          <Card className="space-y-4">
            <div>
              <p className="eyebrow">AI Content Brief</p>
              <h2 className="section-subtitle mt-2">Generate from keywords</h2>
              <p className="section-copy mt-1.5">
                Enter keywords and optional competitor URLs to create a detailed content writing brief.
              </p>
            </div>

            <div className="space-y-4">
              <Field label="Keywords" hint="One per line or comma-separated. First keyword = target.">
                <textarea
                  className="field-textarea"
                  placeholder="react hooks&#10;useState&#10;useEffect&#10;custom hooks"
                  rows={4}
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                />
              </Field>

              <Field label="Cluster/Topic Name" hint="Optional. Used as the brief title.">
                <input
                  className="field-input"
                  type="text"
                  placeholder="React Hooks Tutorial"
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                />
              </Field>

              <Field label="Competitor URLs" hint="Optional. One per line.">
                <textarea
                  className="field-textarea"
                  placeholder="https://competitor.com/react-hooks-guide&#10;https://other.com/react-hooks-tutorial"
                  rows={3}
                  value={competitorUrlsText}
                  onChange={(e) => setCompetitorUrlsText(e.target.value)}
                />
              </Field>

              <Button
                type="button"
                variant="primary"
                size="md"
                icon={<Sparkles className="h-4 w-4" />}
                loading={isPending}
                onClick={handleGenerate}
                className="w-full sm:w-auto"
              >
                Generate Brief
              </Button>
            </div>
          </Card>

          {/* Result */}
          <Card className="space-y-4">
            <div className="section-header">
              <p className="eyebrow">Result</p>
            </div>

            {generateState.status === 'idle' && (
              <EmptyState
                icon={<Sparkles className="h-8 w-8 text-text-muted" />}
                title="Generate a brief"
                description="Enter keywords and click 'Generate Brief' to create an AI-powered content writing brief."
              />
            )}

            {generateState.status === 'loading' && <LoadingSkeleton_brief />}

            {generateState.status === 'result' && (
              <BriefResult
                brief={generateState.brief}
                onCopy={handleCopy}
                onDownload={handleDownload}
                copied={copied}
              />
            )}

            {generateState.status === 'error' && (
              <Alert variant="error" title="Generation failed">
                {generateState.message}
              </Alert>
            )}
          </Card>
        </div>
      )}

      {/* Saved Briefs View */}
      {activeView === 'saved' && (
        <div className="grid gap-6 xl:grid-cols-[0.38fr_0.62fr] [&>*]:min-w-0">
          {/* List of saved briefs */}
          <Card className="space-y-4">
            <div>
              <p className="eyebrow">Saved</p>
              <h2 className="section-subtitle mt-2">Briefs Library</h2>
            </div>

            {savedBriefsQuery.isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-border/15 rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {savedBriefsQuery.data?.length === 0 && (
              <EmptyState
                icon={<FileText className="h-8 w-8 text-text-muted" />}
                title="No briefs yet"
                description='Generate a brief to see it saved here.'
              />
            )}

            {savedBriefsQuery.data?.length && savedBriefsQuery.data.length > 0 && (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {savedBriefsQuery.data.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBriefId(b.id)}
                    className={cn(
                      'w-full text-left rounded-lg border p-3 transition-all duration-150',
                      selectedBriefId === b.id
                        ? 'border-accent/30 bg-accent/[0.04] ring-1 ring-accent/12'
                        : 'border-border/40 bg-surface-raised/50 hover:border-accent/15 hover:bg-surface',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-body font-semibold text-text-primary truncate">{b.title}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {b.keywords.slice(0, 3).map((kw) => (
                            <Badge key={kw} variant="neutral">{kw}</Badge>
                          ))}
                          {b.keywords.length > 3 && (
                            <span className="text-caption text-text-muted">+{b.keywords.length - 3} more</span>
                          )}
                        </div>
                        <p className="mt-1.5 text-caption text-text-muted">{formatDate(b.createdAt)}</p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        onClick={(e) => handleDeleteBrief(b.id, e)}
                        title="Delete brief"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Full brief view */}
          <Card className="space-y-4">
            <div className="section-header">
              <p className="eyebrow">Preview</p>
            </div>

            {!selectedBriefId && (
              <EmptyState
                icon={<BookOpen className="h-8 w-8 text-text-muted" />}
                title="Select a brief"
                description="Click on a saved brief to view its full content."
              />
            )}

            {selectedBriefQuery.isLoading && <LoadingSkeleton_brief />}

            {selectedBriefQuery.data && (
              <BriefResult
                brief={selectedBriefQuery.data.brief}
                onCopy={() => {
                  if (!selectedBriefQuery.data) return;
                  const md = buildMarkdown(selectedBriefQuery.data.brief);
                  navigator.clipboard.writeText(md).then(
                    () => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    },
                    () => addToast('Failed to copy.', 'error'),
                  );
                }}
                onDownload={() => {
                  if (!selectedBriefQuery.data) return;
                  const b = selectedBriefQuery.data.brief;
                  const md = buildMarkdown(b);
                  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `brief-${b.targetKeyword.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.md`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                copied={copied}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Markdown Builder ──

function buildMarkdown(brief: GeneratedContentBrief): string {
  const lines: string[] = [];

  lines.push(`# Content Brief: ${brief.targetKeyword}`);
  lines.push('');

  lines.push('## Target Keyword');
  lines.push('');
  lines.push(`- **Primary:** ${brief.targetKeyword}`);
  lines.push(`- **Secondary:** ${brief.secondaryKeywords.join(', ')}`);
  lines.push('');

  lines.push('## Recommended Word Count');
  lines.push('');
  lines.push(`${brief.recommendedWordCount.toLocaleString()} words`);
  lines.push('');

  lines.push('## Title Options');
  lines.push('');
  brief.titles.forEach((t, i) => {
    lines.push(`${i + 1}. ${t}`);
  });
  lines.push('');

  lines.push('## Outline');
  lines.push('');
  brief.outline.forEach((s) => {
    const prefix = s.heading === 'H2' ? '##' : '###';
    lines.push(`${prefix} ${s.text}`);
    lines.push('');
  });

  lines.push('## Key Points to Cover');
  lines.push('');
  brief.keyPoints.forEach((p) => {
    lines.push(`- ${p}`);
  });
  lines.push('');

  lines.push('## Competitor Content Gap');
  lines.push('');
  lines.push(brief.competitorGap);
  lines.push('');

  lines.push('## Unique Angle');
  lines.push('');
  lines.push(brief.uniqueAngle);
  lines.push('');

  return lines.join('\n');
}
