import type { SiteLanguage } from '@/lib/research';
import { isGenericTopic } from './blockers';
import { containsAny, jaccardSimilarity, ngramSimilarity } from './utils';

export type RelevanceContext = {
  offerings: string[];
  audiences: string[];
  painPoints: string[];
  coveredTopics: string[];
  excludedTopics: string[];
  brandName: string;
  competitorBrands: string[];
  existingPages: Array<{ title: string; path: string; headings: string[] }>;
  language: SiteLanguage;
  notes: string;
};

export type RelevanceSignals = {
  offeringMatch: number;
  audienceMatch: number;
  painPointMatch: number;
  genericPenalty: number;
  competitorPenalty: number;
  existingOverlap: number;
  distinctiveness: number;
};

export type RelevanceScore = {
  total: number;
  signals: RelevanceSignals;
  flags: string[];
};

function maxSimilarity(candidate: string, targets: string[]): number {
  let best = 0;
  for (const target of targets) {
    const jaccard = jaccardSimilarity(candidate, target);
    const ngram = ngramSimilarity(candidate, target);
    const combined = Math.max(jaccard, ngram);
    if (combined > best) best = combined;
  }
  return best;
}

function computeOfferingMatch(primaryKeyword: string, offerings: string[]): number {
  if (!offerings.length) return 15;
  const sim = maxSimilarity(primaryKeyword, offerings);
  if (sim > 0.4) return 30;
  if (sim > 0.25) return 20;
  if (sim > 0.1) return 10;
  return 0;
}

function computeAudienceMatch(title: string, primaryKeyword: string, audiences: string[]): number {
  if (!audiences.length) return 0;
  if (containsAny(title, audiences) || containsAny(primaryKeyword, audiences)) return 15;
  return 0;
}

function computePainPointMatch(title: string, primaryKeyword: string, painPoints: string[]): number {
  if (!painPoints.length) return 0;
  if (containsAny(title, painPoints) || containsAny(primaryKeyword, painPoints)) return 10;
  return 0;
}

function computeGenericPenalty(title: string, primaryKeyword: string, language: SiteLanguage): number {
  const result = isGenericTopic(title, primaryKeyword, language);
  if (result.blocked) return -25;
  return 0;
}

function computeCompetitorPenalty(
  title: string,
  primaryKeyword: string,
  supportingKeywords: string[],
  competitorBrands: string[],
  ownBrandName: string,
): number {
  if (!competitorBrands.length) return 0;
  const filtered = competitorBrands.filter(
    (b) => b.toLowerCase() !== ownBrandName.toLowerCase(),
  );
  const allText = [title, primaryKeyword, ...supportingKeywords];
  for (const text of allText) {
    if (containsAny(text, filtered)) return -20;
  }
  return 0;
}

function computeExistingOverlap(
  title: string,
  primaryKeyword: string,
  existingPages: RelevanceContext['existingPages'],
): number {
  if (!existingPages.length) return 0;

  for (const page of existingPages) {
    const titleSim = Math.max(
      jaccardSimilarity(title, page.title),
      jaccardSimilarity(primaryKeyword, page.title),
    );
    if (titleSim > 0.6) return -15;
    if (titleSim > 0.4) return -8;

    for (const heading of page.headings) {
      if (jaccardSimilarity(primaryKeyword, heading) > 0.6) return -15;
    }
  }
  return 0;
}

function computeDistinctiveness(
  primaryKeyword: string,
  siblings: Array<{ primaryKeyword: string }>,
): number {
  if (!siblings.length) return 15;

  let maxSim = 0;
  for (const sibling of siblings) {
    const sim = jaccardSimilarity(primaryKeyword, sibling.primaryKeyword);
    if (sim > maxSim) maxSim = sim;
  }

  if (maxSim < 0.3) return 15;
  if (maxSim < 0.5) return 8;
  return 0;
}

export function scoreCandidate(
  candidate: { title: string; primaryKeyword: string; supportingKeywords: string[] },
  context: RelevanceContext,
  siblings: Array<{ title: string; primaryKeyword: string }>,
): RelevanceScore {
  const flags: string[] = [];

  const offeringMatch = computeOfferingMatch(candidate.primaryKeyword, context.offerings);
  const audienceMatch = computeAudienceMatch(candidate.title, candidate.primaryKeyword, context.audiences);
  const painPointMatch = computePainPointMatch(candidate.title, candidate.primaryKeyword, context.painPoints);
  const genericPenalty = computeGenericPenalty(candidate.title, candidate.primaryKeyword, context.language);
  const competitorPenalty = computeCompetitorPenalty(
    candidate.title,
    candidate.primaryKeyword,
    candidate.supportingKeywords,
    context.competitorBrands,
    context.brandName,
  );
  const existingOverlap = computeExistingOverlap(candidate.title, candidate.primaryKeyword, context.existingPages);
  const distinctiveness = computeDistinctiveness(candidate.primaryKeyword, siblings);

  if (offeringMatch === 0) flags.push('No offering match');
  if (genericPenalty < 0) flags.push('Generic template pattern');
  if (competitorPenalty < 0) flags.push('Competitor brand detected');
  if (existingOverlap < 0) flags.push('Overlaps existing page');
  if (distinctiveness === 0) flags.push('Low distinctiveness among siblings');

  const raw =
    offeringMatch + audienceMatch + painPointMatch + genericPenalty + competitorPenalty + existingOverlap + distinctiveness;
  const total = Math.max(0, Math.min(100, raw));

  return {
    total,
    signals: {
      offeringMatch,
      audienceMatch,
      painPointMatch,
      genericPenalty,
      competitorPenalty,
      existingOverlap,
      distinctiveness,
    },
    flags,
  };
}

export function scoreCandidates<
  T extends { title: string; primaryKeyword: string; supportingKeywords: string[] },
>(
  candidates: T[],
  context: RelevanceContext,
  options?: { minScore?: number; maxResults?: number },
): Array<T & { relevanceScore: RelevanceScore }> {
  const minScore = options?.minScore ?? 25;
  const maxResults = options?.maxResults;

  const scored = candidates.map((candidate) => {
    const siblings = candidates
      .filter((c) => c !== candidate)
      .map((c) => ({ title: c.title, primaryKeyword: c.primaryKeyword }));

    return {
      ...candidate,
      relevanceScore: scoreCandidate(candidate, context, siblings),
    };
  });

  const filtered = scored.filter((c) => c.relevanceScore.total >= minScore);
  const sorted = filtered.sort((a, b) => b.relevanceScore.total - a.relevanceScore.total);

  return maxResults ? sorted.slice(0, maxResults) : sorted;
}
