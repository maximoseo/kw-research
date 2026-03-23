import { describe, expect, it } from 'vitest';
import type { ResearchRow } from '@/lib/research';
import type { RelevanceContext } from './relevance';
import type { BlockerContext } from './blockers';
import { validateAndNormalizeRows } from './qa';

function makeRow(overrides: Partial<ResearchRow> & { pillar: string; cluster: string; primaryKeyword: string }): ResearchRow {
  const { pillar, cluster, primaryKeyword, ...rest } = overrides;
  return {
    existingParentPage: rest.rowType === 'pillar' ? '-' : `/${pillar.toLowerCase().replace(/\s+/g, '-')}/`,
    existingParentPageUrl: rest.rowType === 'pillar' ? null : `https://example.com/${pillar.toLowerCase().replace(/\s+/g, '-')}/`,
    pillar,
    cluster,
    intent: rest.intent ?? 'Informational',
    primaryKeyword,
    keywords: rest.keywords ?? ['TestBrand', primaryKeyword],
    rowType: rest.rowType ?? 'cluster',
    slugPath: `/${pillar.toLowerCase().replace(/\s+/g, '-')}/`,
    ...rest,
  };
}

function generateRowSet(pillarCount: number, clustersPerPillar: number): ResearchRow[] {
  const rows: ResearchRow[] = [];
  for (let p = 0; p < pillarCount; p++) {
    const pillarName = `Pillar Topic ${p + 1}`;
    rows.push(makeRow({ pillar: pillarName, cluster: pillarName, primaryKeyword: `pillar topic ${p + 1}`, rowType: 'pillar' }));
    for (let c = 0; c < clustersPerPillar; c++) {
      rows.push(makeRow({
        pillar: pillarName,
        cluster: `Cluster ${p + 1}-${c + 1}`,
        primaryKeyword: `cluster keyword ${p + 1} ${c + 1}`,
      }));
    }
  }
  return rows;
}

const testRelevanceContext: RelevanceContext = {
  offerings: ['pillar topic 1', 'pillar topic 2', 'pillar topic 3'],
  audiences: ['homeowners'],
  painPoints: ['quality issues'],
  coveredTopics: [],
  excludedTopics: [],
  brandName: 'TestBrand',
  competitorBrands: [],
  existingPages: [],
  language: 'English',
  notes: '',
};

const testBlockerContext: BlockerContext = {
  language: 'English',
  competitorBrands: [],
  ownBrandName: 'TestBrand',
  geographySignals: [],
  notes: '',
  excludedTopics: [],
};

describe('validateAndNormalizeRows', () => {
  it('puts the brand first and removes exact duplicates', () => {
    const rows: ResearchRow[] = [
      {
        existingParentPage: '-',
        existingParentPageUrl: null,
        pillar: 'SEO Content Strategy',
        cluster: 'SEO Content Strategy',
        intent: 'Informational',
        primaryKeyword: 'seo content strategy',
        keywords: ['content planning', 'Maximo SEO', 'editorial calendar'],
        rowType: 'pillar',
        slugPath: '/seo-content-strategy/',
      },
      {
        existingParentPage: '/seo-content-strategy/',
        existingParentPageUrl: 'https://example.com/seo-content-strategy/',
        pillar: 'SEO Content Strategy',
        cluster: 'Content Calendar Template',
        intent: 'Informational',
        primaryKeyword: 'content calendar template',
        keywords: ['editorial calendar', 'Maximo SEO', 'content calendar'],
        rowType: 'cluster',
        slugPath: '/seo-content-strategy/',
      },
      {
        existingParentPage: '/seo-content-strategy/',
        existingParentPageUrl: 'https://example.com/seo-content-strategy/',
        pillar: 'SEO Content Strategy',
        cluster: 'Content Calendar Template',
        intent: 'Informational',
        primaryKeyword: 'content calendar template',
        keywords: ['content calendar', 'Maximo SEO', 'editorial calendar'],
        rowType: 'cluster',
        slugPath: '/seo-content-strategy/',
      },
    ];

    const normalized = validateAndNormalizeRows(rows, 'Maximo SEO');

    expect(normalized.rows).toHaveLength(2);
    expect(normalized.rows[0].keywords[0]).toBe('Maximo SEO');
    expect(normalized.rows[1].keywords[0]).toBe('Maximo SEO');
    expect(normalized.issues.some((issue) => issue.includes('Removed duplicate row'))).toBe(true);
  });

  it('restores the pillar row to the start of the group', () => {
    const rows: ResearchRow[] = [
      {
        existingParentPage: '/seo-content-strategy/',
        existingParentPageUrl: 'https://example.com/seo-content-strategy/',
        pillar: 'SEO Content Strategy',
        cluster: 'Content Calendar Template',
        intent: 'Informational',
        primaryKeyword: 'content calendar template',
        keywords: ['Maximo SEO', 'content calendar', 'editorial calendar'],
        rowType: 'cluster',
        slugPath: '/seo-content-strategy/',
      },
      {
        existingParentPage: '-',
        existingParentPageUrl: null,
        pillar: 'SEO Content Strategy',
        cluster: 'SEO Content Strategy',
        intent: 'Informational',
        primaryKeyword: 'seo content strategy',
        keywords: ['Maximo SEO', 'content strategy', 'editorial planning'],
        rowType: 'pillar',
        slugPath: '/seo-content-strategy/',
      },
    ];

    const normalized = validateAndNormalizeRows(rows, 'Maximo SEO');

    expect(normalized.rows[0].rowType).toBe('pillar');
    expect(normalized.rows[0].existingParentPage).toBe('-');
    expect(normalized.issues.some((issue) => issue.includes('reordered'))).toBe(true);
  });

  it('never produces fewer rows than the minimum floor when targetRows is set', () => {
    const rows = generateRowSet(15, 14);
    const targetRows = 220;
    const minFloor = Math.floor(targetRows * 0.3);

    const normalized = validateAndNormalizeRows(rows, 'TestBrand', {
      context: testRelevanceContext,
      blockerContext: testBlockerContext,
      strictMode: true,
      targetRows,
    });

    expect(normalized.rows.length).toBeGreaterThanOrEqual(minFloor);
  });

  it('respects targetRows=220 and produces substantial output', () => {
    const rows = generateRowSet(15, 14);

    const normalized = validateAndNormalizeRows(rows, 'TestBrand', {
      context: testRelevanceContext,
      blockerContext: testBlockerContext,
      strictMode: true,
      targetRows: 220,
    });

    expect(normalized.rows.length).toBeGreaterThanOrEqual(66);
  });

  it('respects targetRows=50 and produces substantial output', () => {
    const rows = generateRowSet(5, 10);

    const normalized = validateAndNormalizeRows(rows, 'TestBrand', {
      context: testRelevanceContext,
      blockerContext: testBlockerContext,
      strictMode: true,
      targetRows: 50,
    });

    expect(normalized.rows.length).toBeGreaterThanOrEqual(15);
  });

  it('respects targetRows=100 and produces substantial output', () => {
    const rows = generateRowSet(8, 12);

    const normalized = validateAndNormalizeRows(rows, 'TestBrand', {
      context: testRelevanceContext,
      blockerContext: testBlockerContext,
      strictMode: true,
      targetRows: 100,
    });

    expect(normalized.rows.length).toBeGreaterThanOrEqual(30);
  });

  it('never silently falls back to 2 rows', () => {
    const rows = generateRowSet(15, 14);

    const normalized = validateAndNormalizeRows(rows, 'TestBrand', {
      context: testRelevanceContext,
      blockerContext: testBlockerContext,
      strictMode: true,
      targetRows: 220,
    });

    expect(normalized.rows.length).toBeGreaterThan(2);
  });

  it('logs QA output row count in issues', () => {
    const rows = generateRowSet(3, 5);

    const normalized = validateAndNormalizeRows(rows, 'TestBrand', {
      context: testRelevanceContext,
      blockerContext: testBlockerContext,
      targetRows: 50,
    });

    expect(normalized.issues.some((issue) => issue.includes('QA output:'))).toBe(true);
  });

  it('relaxes relevance threshold when strict filtering produces too few rows', () => {
    // Create rows that will score poorly — keywords that don't match offerings
    const rows: ResearchRow[] = [];
    for (let p = 0; p < 10; p++) {
      const pillarName = `Obscure Niche ${p}`;
      rows.push(makeRow({ pillar: pillarName, cluster: pillarName, primaryKeyword: `obscure niche ${p}`, rowType: 'pillar' }));
      for (let c = 0; c < 12; c++) {
        rows.push(makeRow({
          pillar: pillarName,
          cluster: `Unrelated Topic ${p}-${c}`,
          primaryKeyword: `completely unrelated keyword ${p} ${c}`,
        }));
      }
    }

    const normalized = validateAndNormalizeRows(rows, 'TestBrand', {
      context: testRelevanceContext,
      blockerContext: testBlockerContext,
      strictMode: true,
      targetRows: 120,
    });

    // With progressive relaxation, should still produce at least floor rows
    const minFloor = Math.floor(120 * 0.3);
    expect(normalized.rows.length).toBeGreaterThanOrEqual(minFloor);
    expect(normalized.issues.some((issue) => issue.includes('Relaxing threshold') || issue.includes('QA relaxed'))).toBe(true);
  });

  it('works correctly without targetRows (backward compat)', () => {
    const rows = generateRowSet(3, 5);

    const normalized = validateAndNormalizeRows(rows, 'TestBrand');

    expect(normalized.rows.length).toBeGreaterThan(0);
    expect(normalized.issues.some((issue) => issue.includes('QA output:'))).toBe(true);
  });
});
