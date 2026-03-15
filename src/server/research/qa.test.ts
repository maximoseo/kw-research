import { describe, expect, it } from 'vitest';
import type { ResearchRow } from '@/lib/research';
import { validateAndNormalizeRows } from './qa';

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
});
