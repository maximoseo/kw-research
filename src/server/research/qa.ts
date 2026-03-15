import ExcelJS from 'exceljs';
import type { ResearchRow } from '@/lib/research';
import { ensureBrandFirst, jaccardSimilarity, topKeywordFingerprint } from './utils';

export function validateAndNormalizeRows(rows: ResearchRow[], brandName: string) {
  const issues: string[] = [];
  const seen = new Set<string>();
  const normalized: ResearchRow[] = [];

  for (const row of rows) {
    const keywords = ensureBrandFirst(brandName, row.keywords);
    const normalizedRow: ResearchRow = {
      ...row,
      keywords,
    };

    if (!normalizedRow.intent || !normalizedRow.primaryKeyword || !normalizedRow.cluster || !normalizedRow.pillar) {
      issues.push(`Row "${row.cluster || row.pillar}" was missing required content.`);
      continue;
    }

    const key = [
      normalizedRow.pillar.toLowerCase(),
      normalizedRow.cluster.toLowerCase(),
      normalizedRow.primaryKeyword.toLowerCase(),
      topKeywordFingerprint(normalizedRow.keywords),
    ].join('::');

    if (seen.has(key)) {
      issues.push(`Removed duplicate row for "${normalizedRow.cluster}".`);
      continue;
    }

    seen.add(key);
    normalized.push(normalizedRow);
  }

  const grouped = new Map<string, ResearchRow[]>();
  for (const row of normalized) {
    const bucket = grouped.get(row.pillar) || [];
    bucket.push(row);
    grouped.set(row.pillar, bucket);
  }

  for (const [pillar, group] of grouped) {
    if (!group.length) {
      continue;
    }

    const first = group[0];
    if (first.rowType !== 'pillar' || first.cluster !== pillar || first.existingParentPage !== '-') {
      issues.push(`Pillar group "${pillar}" was reordered to restore the pillar row first.`);
      group.sort((left, right) => {
        if (left.rowType === right.rowType) return 0;
        return left.rowType === 'pillar' ? -1 : 1;
      });
    }

    for (let index = 1; index < group.length; index += 1) {
      const row = group[index];
      if (row.rowType !== 'cluster') {
        row.rowType = 'cluster';
      }
      if (row.existingParentPage === '-') {
        row.existingParentPage = row.slugPath;
      }
    }

    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        if (left.cluster === right.cluster) {
          continue;
        }
        const similarity = jaccardSimilarity(left.primaryKeyword, right.primaryKeyword);
        if (similarity >= 0.8) {
          issues.push(`High keyword overlap detected between "${left.cluster}" and "${right.cluster}".`);
        }
      }
    }
  }

  return {
    rows: [...grouped.values()].flat(),
    issues,
  };
}

export async function verifyWorkbookBuffer(buffer: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  const workbookData = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await workbook.xlsx.load(workbookData as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  const header = worksheet.getRow(1).values;

  return {
    worksheetName: worksheet.name,
    columns: Array.isArray(header) ? header.slice(1) : [],
    rowCount: worksheet.rowCount,
  };
}
