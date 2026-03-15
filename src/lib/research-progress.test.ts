import { describe, expect, it } from 'vitest';
import type { ResearchRunDetail } from '@/lib/research';
import { deriveResearchProcess } from './research-progress';

function buildRun(overrides: Partial<ResearchRunDetail>): ResearchRunDetail {
  return {
    id: 'run-1',
    projectId: 'project-1',
    projectName: 'Test Project',
    brandName: 'Maximo SEO',
    language: 'English',
    market: 'United States',
    mode: 'fresh',
    status: 'queued',
    step: 'Queued',
    targetRows: 220,
    queuedAt: Date.now(),
    completedAt: null,
    workbookName: null,
    errorMessage: null,
    input: {
      homepageUrl: 'https://example.com',
      aboutUrl: 'https://example.com/about',
      sitemapUrl: 'https://example.com/sitemap.xml',
      brandName: 'Maximo SEO',
      language: 'English',
      market: 'United States',
      competitorUrls: [],
      notes: '',
      targetRows: 220,
      mode: 'fresh',
      existingResearchSummary: null,
    },
    rows: [],
    logs: [],
    siteSnapshot: null,
    competitorSnapshot: null,
    resultSummary: null,
    uploadedFileId: null,
    ...overrides,
  };
}

describe('deriveResearchProcess', () => {
  it('keeps queued as the active step before logs arrive', () => {
    const process = deriveResearchProcess(buildRun({ status: 'queued', step: 'Queued' }));

    expect(process.currentStepId).toBe('queued');
    expect(process.steps[0].state).toBe('current');
    expect(process.progressPercent).toBe(0);
  });

  it('marks earlier steps complete when the run is processing later stages', () => {
    const process = deriveResearchProcess(
      buildRun({
        status: 'processing',
        step: 'Discovering relevant competitors',
        logs: [
          {
            id: '1',
            runId: 'run-1',
            stage: 'crawl',
            level: 'info',
            message: 'Fetching sitemap and required pages',
            metadata: null,
            createdAt: Date.now() - 5_000,
          },
          {
            id: '2',
            runId: 'run-1',
            stage: 'analysis',
            level: 'info',
            message: 'Understanding the business and existing coverage',
            metadata: null,
            createdAt: Date.now() - 3_000,
          },
          {
            id: '3',
            runId: 'run-1',
            stage: 'competitors',
            level: 'info',
            message: 'Discovering relevant competitors',
            metadata: null,
            createdAt: Date.now() - 1_000,
          },
        ],
      }),
    );

    expect(process.currentStepId).toBe('competitors');
    expect(process.steps.find((step) => step.id === 'queued')?.state).toBe('complete');
    expect(process.steps.find((step) => step.id === 'crawl')?.state).toBe('complete');
    expect(process.steps.find((step) => step.id === 'analysis')?.state).toBe('complete');
    expect(process.steps.find((step) => step.id === 'competitors')?.state).toBe('current');
  });

  it('marks the active stage as failed when the run stops with an error', () => {
    const process = deriveResearchProcess(
      buildRun({
        status: 'failed',
        step: 'Building the Excel workbook',
        errorMessage: 'Workbook write failed.',
        logs: [
          {
            id: '1',
            runId: 'run-1',
            stage: 'export',
            level: 'info',
            message: 'Building the Excel workbook',
            metadata: null,
            createdAt: Date.now() - 500,
          },
        ],
      }),
    );

    expect(process.currentStepId).toBe('export');
    expect(process.steps.find((step) => step.id === 'export')?.state).toBe('failed');
    expect(process.helperText).toContain('Workbook write failed');
  });

  it('marks every step complete after workbook generation', () => {
    const process = deriveResearchProcess(
      buildRun({
        status: 'completed',
        step: 'Completed',
        workbookName: 'maximo-seo-research.xlsx',
        logs: [
          {
            id: '1',
            runId: 'run-1',
            stage: 'completed',
            level: 'info',
            message: 'Workbook verified and stored successfully.',
            metadata: null,
            createdAt: Date.now(),
          },
        ],
      }),
    );

    expect(process.progressPercent).toBe(100);
    expect(process.steps.every((step) => step.state === 'complete')).toBe(true);
    expect(process.helperText).toContain('maximo-seo-research.xlsx');
  });
});
