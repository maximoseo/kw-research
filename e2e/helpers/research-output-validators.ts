import { expect } from '@playwright/test';

type ResearchRow = {
  pillar: string;
  cluster: string;
  primaryKeyword: string;
  intent: string;
  keywords: string[];
  rowType: string;
  existingParentPage: string;
  searchVolume?: number | null;
  cpc?: number | null;
};

/** Asserts the output has at least the minimum number of rows (30% of target) */
export function assertMinimumRowCount(rows: ResearchRow[], targetRows: number) {
  const floor = Math.max(10, Math.floor(targetRows * 0.3));
  expect(rows.length, `Expected at least ${floor} rows (30% of ${targetRows} target), got ${rows.length}`).toBeGreaterThanOrEqual(floor);
}

/** Asserts unique primary keywords make up at least 80% of rows */
export function assertNoDuplicates(rows: ResearchRow[]) {
  const primaryKeywords = rows.map((r) => r.primaryKeyword.toLowerCase());
  const unique = new Set(primaryKeywords);
  const uniqueRatio = unique.size / primaryKeywords.length;
  expect(uniqueRatio, `Only ${unique.size}/${primaryKeywords.length} unique primary keywords (${(uniqueRatio * 100).toFixed(0)}%)`).toBeGreaterThanOrEqual(0.8);
}

/** Asserts no rows are missing required fields */
export function assertNoBlankRows(rows: ResearchRow[]) {
  for (const row of rows) {
    expect(row.pillar, 'Row missing pillar').toBeTruthy();
    expect(row.cluster, 'Row missing cluster').toBeTruthy();
    expect(row.primaryKeyword, 'Row missing primaryKeyword').toBeTruthy();
    expect(row.intent, 'Row missing intent').toBeTruthy();
  }
}

/** Asserts Hebrew output contains Hebrew characters, English contains English */
export function assertLanguageCorrectness(rows: ResearchRow[], language: 'Hebrew' | 'English') {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const clusterTexts = rows.filter((r) => r.rowType === 'cluster').map((r) => r.cluster);

  if (language === 'Hebrew') {
    const hebrewCount = clusterTexts.filter((t) => hebrewPattern.test(t)).length;
    const hebrewRatio = hebrewCount / clusterTexts.length;
    expect(hebrewRatio, `Only ${hebrewCount}/${clusterTexts.length} clusters contain Hebrew text (${(hebrewRatio * 100).toFixed(0)}%)`).toBeGreaterThanOrEqual(0.5);
  } else {
    // English clusters should NOT be mostly Hebrew
    const hebrewCount = clusterTexts.filter((t) => hebrewPattern.test(t)).length;
    const hebrewRatio = hebrewCount / clusterTexts.length;
    expect(hebrewRatio, `${hebrewCount}/${clusterTexts.length} English clusters contain Hebrew text`).toBeLessThanOrEqual(0.1);
  }
}

/** Asserts at least N distinct pillars exist */
export function assertMinimumPillarCount(rows: ResearchRow[], minPillars: number) {
  const pillars = new Set(rows.map((r) => r.pillar));
  expect(pillars.size, `Expected at least ${minPillars} distinct pillars, got ${pillars.size}`).toBeGreaterThanOrEqual(minPillars);
}

/** Asserts no placeholder or template text leaked into output */
export function assertNoPlaceholderText(rows: ResearchRow[]) {
  const placeholderPatterns = [/lorem/i, /placeholder/i, /TODO/i, /example\.com/i, /\[.*\]/];
  for (const row of rows) {
    for (const pattern of placeholderPatterns) {
      expect(pattern.test(row.cluster), `Placeholder text "${pattern}" found in cluster: "${row.cluster}"`).toBe(false);
      expect(pattern.test(row.primaryKeyword), `Placeholder text "${pattern}" found in keyword: "${row.primaryKeyword}"`).toBe(false);
    }
  }
}

/** Asserts no encoding issues (mojibake, replacement chars) */
export function assertNoEncodingIssues(rows: ResearchRow[]) {
  const brokenPatterns = [/\?{3,}/, /â€/, /Ã/, /\uFFFD/];
  for (const row of rows) {
    const allText = [row.pillar, row.cluster, row.primaryKeyword, ...row.keywords].join(' ');
    for (const pattern of brokenPatterns) {
      expect(pattern.test(allText), `Encoding issue "${pattern}" found in row: "${row.cluster}"`).toBe(false);
    }
  }
}

/** Asserts pillar-cluster hierarchy is valid (each cluster references a real pillar) */
export function assertHierarchyIntegrity(rows: ResearchRow[]) {
  const pillarNames = new Set(rows.filter((r) => r.rowType === 'pillar').map((r) => r.pillar));
  const clusterRows = rows.filter((r) => r.rowType === 'cluster');

  for (const cluster of clusterRows) {
    expect(pillarNames.has(cluster.pillar), `Cluster "${cluster.cluster}" references non-existent pillar "${cluster.pillar}"`).toBe(true);
  }
}

/** Asserts reasonable intent balance (at least 20% commercial/transactional) */
export function assertIntentBalance(rows: ResearchRow[]) {
  const commercialIntents = rows.filter((r) => r.intent === 'Commercial' || r.intent === 'Transactional');
  const ratio = commercialIntents.length / rows.length;
  expect(ratio, `Only ${(ratio * 100).toFixed(0)}% commercial/transactional intent — expected at least 20%`).toBeGreaterThanOrEqual(0.2);
}

/** Run all output quality assertions */
export function assertOutputQuality(rows: ResearchRow[], language: 'Hebrew' | 'English', targetRows: number) {
  assertMinimumRowCount(rows, targetRows);
  assertNoDuplicates(rows);
  assertNoBlankRows(rows);
  assertLanguageCorrectness(rows, language);
  assertMinimumPillarCount(rows, 5);
  assertNoPlaceholderText(rows);
  assertNoEncodingIssues(rows);
  assertHierarchyIntegrity(rows);
  assertIntentBalance(rows);
}
