'use client';

import type { BaseSyntheticEvent, Dispatch, SetStateAction } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { UploadCloud, Radar } from 'lucide-react';
import { Alert, Button, Card, Field } from '@/components/ui';
import type { ResearchProjectDetail } from '@/lib/research';
import { createProjectRunFormSchema, type CreateProjectRunFormInput } from '@/lib/validation';

export type CompetitorDiscoveryState = {
  status: 'idle' | 'success' | 'empty' | 'error';
  message?: string;
  metadata?: { methods?: string[]; totalCandidates?: number; [key: string]: unknown };
};

export function buildDefaultValues(project: ResearchProjectDetail): CreateProjectRunFormInput {
  return {
    competitorUrls: project.competitorUrls.join('\n'),
    notes: project.notes || '',
    mode: 'fresh',
    targetRows: 220,
  };
}

export default function RunCreationPanel({
  form,
  isPending,
  isDiscoveringCompetitors,
  competitorDiscovery,
  setCompetitorDiscovery,
  uploadedFile,
  setUploadedFile,
  handleSubmit,
  handleAutoFindCompetitors,
  project,
}: {
  form: UseFormReturn<CreateProjectRunFormInput>;
  isPending: boolean;
  isDiscoveringCompetitors: boolean;
  competitorDiscovery: CompetitorDiscoveryState;
  setCompetitorDiscovery: Dispatch<SetStateAction<CompetitorDiscoveryState>>;
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  handleSubmit: (e?: BaseSyntheticEvent) => void | Promise<void>;
  handleAutoFindCompetitors: () => void;
  project: ResearchProjectDetail;
}) {
  return (
    <Card className="space-y-5">
      <div className="section-header">
        <div>
          <p className="eyebrow">New run</p>
          <h2 className="section-subtitle mt-2">Launch a research run</h2>
          <p className="section-copy mt-1.5">Update competitors, notes, mode, and output size.</p>
        </div>
        <div className="toolbar-chip flex flex-wrap items-center gap-1.5 max-w-[12rem] sm:max-w-[14rem]">
          <UploadCloud className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          <span className="truncate min-w-0 text-caption">{uploadedFile ? uploadedFile.name : 'No workbook'}</span>
        </div>
      </div>
      <form id="new-run-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Mode" error={form.formState.errors.mode?.message}>
            <select className="field-select" {...form.register('mode')}>
              <option value="fresh">Create completely fresh research</option>
              <option value="expand">Expand existing research</option>
            </select>
          </Field>
          <Field label="Target rows" error={form.formState.errors.targetRows?.message}>
            <input className="field-input" type="number" min={120} max={320} step={5} {...form.register('targetRows', { valueAsNumber: true })} />
          </Field>
        </div>
        <Field label="Competitor URLs" error={form.formState.errors.competitorUrls?.message as string | undefined} hint="One per line, or auto-discover.">
          <div className="form-section space-y-3">
            <div className="action-row sm:justify-between">
              <div className="max-w-2xl min-w-0">
                <p className="text-body font-medium text-text-primary">Auto-discover competitors</p>
                <p className="mt-0.5 text-body-sm text-text-secondary">Scan your site profile and find relevant competitors.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Radar className="h-3.5 w-3.5" />}
                loading={isDiscoveringCompetitors}
                disabled={isDiscoveringCompetitors}
                onClick={handleAutoFindCompetitors}
                className="w-full shrink-0 sm:w-auto"
              >
                Find Competitors
              </Button>
            </div>
            {competitorDiscovery.status === 'success' ? (
              <Alert variant="success" title="Discovery complete">
                <p>{competitorDiscovery.message}</p>
                {competitorDiscovery.metadata?.methods && (
                  <p className="mt-1 text-body-sm text-text-secondary">
                    Methods used: {competitorDiscovery.metadata.methods.join(', ')}
                    {competitorDiscovery.metadata.totalCandidates != null && (
                      <> &middot; {competitorDiscovery.metadata.totalCandidates} candidates evaluated</>
                    )}
                  </p>
                )}
              </Alert>
            ) : competitorDiscovery.status === 'empty' ? (
              <Alert variant="warning" title="No results">
                {competitorDiscovery.message}
              </Alert>
            ) : competitorDiscovery.status === 'error' ? (
              <Alert variant="error" title="Discovery failed">
                {competitorDiscovery.message}
              </Alert>
            ) : null}
            <textarea
              className="field-textarea"
              placeholder="https://competitor-one.com&#10;https://competitor-two.com"
              {...form.register('competitorUrls')}
            />
          </div>
        </Field>
        <Field label="Notes / instructions" error={form.formState.errors.notes?.message} hint="Optional.">
          <textarea className="field-textarea" placeholder="Add any research constraints, exclusions, or audience notes" {...form.register('notes')} />
        </Field>
        <Field label="Existing workbook" hint="Upload to seed expansion mode.">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 bg-surface-raised/50 px-4 py-3 text-body text-text-secondary transition-all hover:border-accent/20 hover:bg-surface">
            <div className="min-w-0">
              <p className="font-medium text-text-primary truncate">{uploadedFile ? uploadedFile.name : 'Upload optional workbook'}</p>
              <p className="mt-0.5 text-caption text-text-muted">.xlsx, .xls, or .csv up to 10 MB</p>
            </div>
            <span className="toolbar-chip shrink-0 border-accent/15 bg-accent/[0.05] text-accent">{uploadedFile ? 'Replace' : 'Choose file'}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => setUploadedFile(event.target.files?.[0] || null)} />
          </label>
        </Field>
        <div className="action-row border-t border-border/40 pt-4">
          <Button type="submit" size="md" loading={isPending} className="w-full sm:w-auto">
            Run research
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="w-full sm:w-auto"
            onClick={() => {
              form.reset(buildDefaultValues(project));
              setCompetitorDiscovery({ status: 'idle' });
              setUploadedFile(null);
            }}
          >
            Reset form
          </Button>
        </div>
      </form>
    </Card>
  );
}
