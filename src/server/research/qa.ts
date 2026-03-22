import ExcelJS from 'exceljs';
import type { ResearchRow } from '@/lib/research';
import {
  type BlockerContext,
  isGenericTopic,
  isMetadataCategory,
  isScrapedPageTitle,
  hasCompetitorBrandContamination,
} from './blockers';
import type { RelevanceContext } from './relevance';
import { scoreCandidate } from './relevance';
import { ensureBrandFirst, jaccardSimilarity, topKeywordFingerprint } from './utils';

export type QaOptions = {
  context?: RelevanceContext;
  blockerContext?: BlockerContext;
  strictMode?: boolean;
  targetRows?: number;
};

export function validateAndNormalizeRows(
  rows: ResearchRow[],
  brandName: string,
  options?: QaOptions,
) {
  const issues: string[] = [];
  const seen = new Set<string>();
  const normalized: ResearchRow[] = [];
  const minRowFloor = options?.targetRows ? Math.max(2, Math.floor(options.targetRows * 0.3)) : 0;

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

  // --- Blocker-based filtering (when context provided) ---
  let afterBlockers = normalized;

  if (options?.blockerContext) {
    const ctx = options.blockerContext;
    afterBlockers = [];

    for (const row of normalized) {
      const metaResult = isMetadataCategory(row.pillar);
      if (metaResult.blocked) {
        issues.push(`Blocked pillar "${row.pillar}": ${metaResult.reason}`);
        continue;
      }

      const titleResult = isScrapedPageTitle(row.pillar);
      if (titleResult.blocked) {
        issues.push(`Blocked pillar "${row.pillar}": ${titleResult.reason}`);
        continue;
      }

      const genericResult = isGenericTopic(row.cluster, row.primaryKeyword, ctx.language);
      if (genericResult.blocked) {
        issues.push(`Blocked "${row.cluster}": ${genericResult.reason}`);
        continue;
      }

      const competitorResult = hasCompetitorBrandContamination(
        row.cluster,
        row.primaryKeyword,
        row.keywords,
        ctx.competitorBrands,
        ctx.ownBrandName,
      );
      if (competitorResult.blocked) {
        issues.push(`Blocked "${row.cluster}": ${competitorResult.reason}`);
        continue;
      }

      afterBlockers.push(row);
    }
  }

  // --- Cross-pillar primary keyword dedup (RC-13) ---
  const kwPillarMap = new Map<string, { pillar: string; count: number }>();
  const pillarSizes = new Map<string, number>();

  for (const row of afterBlockers) {
    pillarSizes.set(row.pillar, (pillarSizes.get(row.pillar) ?? 0) + 1);
  }

  for (const row of afterBlockers) {
    if (row.rowType === 'pillar') continue;
    const kwKey = row.primaryKeyword.toLowerCase();
    const existing = kwPillarMap.get(kwKey);
    if (!existing) {
      kwPillarMap.set(kwKey, { pillar: row.pillar, count: pillarSizes.get(row.pillar) ?? 0 });
    }
  }

  const afterCrossDedup: ResearchRow[] = [];
  for (const row of afterBlockers) {
    if (row.rowType === 'pillar') {
      afterCrossDedup.push(row);
      continue;
    }
    const kwKey = row.primaryKeyword.toLowerCase();
    const owner = kwPillarMap.get(kwKey);
    if (owner && owner.pillar !== row.pillar) {
      const mySize = pillarSizes.get(row.pillar) ?? 0;
      if (mySize < owner.count) {
        issues.push(
          `Cross-pillar duplicate keyword "${row.primaryKeyword}" removed from "${row.pillar}" (kept in "${owner.pillar}").`,
        );
        continue;
      }
    }
    afterCrossDedup.push(row);
  }

  // --- Apply similarity + relevance filtering with progressive relaxation ---
  const finalRows = applySimilarityAndRelevance(afterCrossDedup, options, issues, minRowFloor);

  issues.push(`QA output: ${finalRows.length} rows (target: ${options?.targetRows ?? 'unknown'}, floor: ${minRowFloor}).`);

  return {
    rows: finalRows,
    issues,
  };
}

/**
 * Groups rows by pillar, applies pillar-cluster similarity, sibling overlap,
 * and relevance scoring. Uses progressive relaxation when row count drops
 * below the minimum floor.
 */
function applySimilarityAndRelevance(
  rows: ResearchRow[],
  options: QaOptions | undefined,
  issues: string[],
  minRowFloor: number,
): ResearchRow[] {
  // Define relaxation levels: each level loosens thresholds further
  const relaxationLevels = [
    { pillarClusterSim: 0.7, siblingOverlap: 0.65, relevance: 25, label: 'strict' },
    { pillarClusterSim: 0.7, siblingOverlap: 0.65, relevance: 15, label: 'relaxed-relevance-15' },
    { pillarClusterSim: 0.7, siblingOverlap: 0.65, relevance: 0, label: 'relaxed-relevance-0' },
    { pillarClusterSim: 0.85, siblingOverlap: 0.8, relevance: 0, label: 'relaxed-similarity' },
    { pillarClusterSim: 1.0, siblingOverlap: 1.0, relevance: 0, label: 'minimal-filtering' },
  ];

  for (const level of relaxationLevels) {
    const levelIssues: string[] = [];
    const result = applyFiltersAtLevel(rows, options, levelIssues, level);

    if (result.length >= minRowFloor || level.label === 'minimal-filtering') {
      issues.push(...levelIssues);
      if (level.label !== 'strict') {
        issues.push(`QA relaxed to "${level.label}" — row count ${result.length} (floor: ${minRowFloor}).`);
      }
      return result;
    }

    issues.push(`QA level "${level.label}" produced only ${result.length} rows (floor: ${minRowFloor}). Relaxing.`);
  }

  // Should not reach here, but return what we have
  return rows;
}

function applyFiltersAtLevel(
  rows: ResearchRow[],
  options: QaOptions | undefined,
  issues: string[],
  level: { pillarClusterSim: number; siblingOverlap: number; relevance: number },
): ResearchRow[] {
  // --- Group by pillar ---
  const grouped = new Map<string, ResearchRow[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.pillar) || [];
    bucket.push({ ...row });
    grouped.set(row.pillar, bucket);
  }

  for (const [pillar, group] of grouped) {
    if (!group.length) continue;

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

    // --- Pillar-cluster distinctiveness ---
    const pillarRow = group.find((r) => r.rowType === 'pillar');
    if (pillarRow && options?.context) {
      const toRemove = new Set<number>();
      for (let i = 1; i < group.length; i++) {
        const cluster = group[i];
        const sim = jaccardSimilarity(cluster.primaryKeyword, pillarRow.primaryKeyword);
        if (sim >= level.pillarClusterSim) {
          issues.push(
            `Removed near-duplicate cluster "${cluster.cluster}" (Jaccard ${sim.toFixed(2)} with pillar).`,
          );
          toRemove.add(i);
        }
      }
      if (toRemove.size) {
        const kept = group.filter((_, i) => !toRemove.has(i));
        group.length = 0;
        group.push(...kept);
      }
    }

    // --- Sibling cluster overlap ---
    if (options?.context) {
      const siblingRemove = new Set<number>();
      for (let li = 1; li < group.length; li++) {
        if (siblingRemove.has(li)) continue;
        for (let ri = li + 1; ri < group.length; ri++) {
          if (siblingRemove.has(ri)) continue;
          const left = group[li];
          const right = group[ri];
          const sim = jaccardSimilarity(left.primaryKeyword, right.primaryKeyword);
          if (sim >= level.siblingOverlap) {
            issues.push(
              `Removed sibling duplicate "${right.cluster}" (Jaccard ${sim.toFixed(2)} with "${left.cluster}").`,
            );
            siblingRemove.add(ri);
          }
        }
      }
      if (siblingRemove.size) {
        const kept = group.filter((_, i) => !siblingRemove.has(i));
        group.length = 0;
        group.push(...kept);
      }
    }

    // --- Legacy overlap warning (for backward compat when no context) ---
    if (!options?.context) {
      for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
          const left = group[leftIndex];
          const right = group[rightIndex];
          if (left.cluster === right.cluster) continue;
          const similarity = jaccardSimilarity(left.primaryKeyword, right.primaryKeyword);
          if (similarity >= 0.8) {
            issues.push(`High keyword overlap detected between "${left.cluster}" and "${right.cluster}".`);
          }
        }
      }
    }
  }

  // --- Remove empty pillar groups ---
  if (options?.context) {
    for (const [pillar, group] of grouped) {
      const clusters = group.filter((r) => r.rowType === 'cluster');
      if (clusters.length === 0) {
        issues.push(`Removed pillar "${pillar}" — no clusters remaining after filtering.`);
        grouped.delete(pillar);
      }
    }
  }

  // --- Relevance scoring gate ---
  let finalRows = [...grouped.values()].flat();

  if (options?.context) {
    const scoredRows: ResearchRow[] = [];
    const siblings = finalRows.map((r) => ({ title: r.cluster, primaryKeyword: r.primaryKeyword }));

    for (const row of finalRows) {
      if (row.rowType === 'pillar') {
        scoredRows.push(row);
        continue;
      }

      const score = scoreCandidate(
        { title: row.cluster, primaryKeyword: row.primaryKeyword, supportingKeywords: row.keywords },
        options.context,
        siblings.filter((s) => s.primaryKeyword !== row.primaryKeyword),
      );

      if (score.total < level.relevance) {
        issues.push(`Low relevance (${score.total}) for "${row.cluster}": ${score.flags.join(', ')}`);
        continue;
      }

      scoredRows.push(row);
    }

    finalRows = scoredRows;

    // Re-check for empty pillar groups after scoring
    const finalGrouped = new Map<string, ResearchRow[]>();
    for (const row of finalRows) {
      const bucket = finalGrouped.get(row.pillar) || [];
      bucket.push(row);
      finalGrouped.set(row.pillar, bucket);
    }
    for (const [pillar, group] of finalGrouped) {
      const clusters = group.filter((r) => r.rowType === 'cluster');
      if (clusters.length === 0) {
        issues.push(`Removed pillar "${pillar}" after relevance scoring — no clusters remaining.`);
        finalGrouped.delete(pillar);
      }
    }
    finalRows = [...finalGrouped.values()].flat();
  }

  return finalRows;
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
