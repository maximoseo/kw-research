import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { ResearchInputSnapshot, ResearchRow } from '@/lib/research';
import { verifyWorkbookBuffer } from './qa';
import { buildWorkbook, getWorkbookHeaderOrder } from './workbook';

const baseInput: ResearchInputSnapshot = {
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
};

const rows: ResearchRow[] = [
  {
    existingParentPage: '-',
    existingParentPageUrl: null,
    pillar: 'Water Filtration Systems',
    cluster: 'Water Filtration Systems',
    intent: 'Commercial',
    primaryKeyword: 'water filtration systems',
    keywords: ['Maximo SEO', 'whole house water filters', 'water filtration solutions'],
    rowType: 'pillar',
    slugPath: '/water-filtration-systems/',
  },
  {
    existingParentPage: '/water-filtration-systems/',
    existingParentPageUrl: 'https://example.com/water-filtration-systems/',
    pillar: 'Water Filtration Systems',
    cluster: 'Water Filtration System Cost',
    intent: 'Commercial',
    primaryKeyword: 'water filtration system cost',
    keywords: ['Maximo SEO', 'water filter cost', 'water treatment pricing'],
    rowType: 'cluster',
    slugPath: '/water-filtration-systems/',
  },
];

describe('buildWorkbook', () => {
  it('writes the required column order and row grouping', async () => {
    const buffer = await buildWorkbook({
      input: baseInput,
      rows,
    });

    const verification = await verifyWorkbookBuffer(buffer);
    expect(verification.columns).toEqual(getWorkbookHeaderOrder());
    expect(verification.rowCount).toBe(3);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.getRow(2).getCell(1).value).toBe('-');
    expect(worksheet.getRow(2).getCell(2).value).toBe('Water Filtration Systems');

    const linkedCell = worksheet.getRow(3).getCell(1).value as ExcelJS.CellHyperlinkValue;
    expect(linkedCell.text).toBe('/water-filtration-systems/');
    expect(linkedCell.hyperlink).toBe('https://example.com/water-filtration-systems/');
    expect(worksheet.autoFilter).toBe('A1:F3');
  });

  it('sets worksheet direction to RTL for Hebrew output', async () => {
    const buffer = await buildWorkbook({
      input: {
        ...baseInput,
        language: 'Hebrew',
      },
      rows,
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.views?.[0]?.rightToLeft).toBe(true);
  });
});
