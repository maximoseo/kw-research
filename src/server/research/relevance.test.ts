import { describe, expect, it } from 'vitest';
import { scoreCandidate, scoreCandidates, type RelevanceContext } from './relevance';

const baseContext: RelevanceContext = {
  offerings: ['chimney sweep', 'fireplace repair', 'chimney inspection'],
  audiences: ['homeowners', 'property managers'],
  painPoints: ['smoke damage', 'carbon monoxide', 'creosote buildup'],
  coveredTopics: [],
  excludedTopics: [],
  brandName: 'Citywide Chimney',
  competitorBrands: ['Lords Chimney', 'ABC Chimney'],
  existingPages: [],
  language: 'English',
  notes: '',
};

describe('scoreCandidate', () => {
  it('scores high for relevant offerings', () => {
    const score = scoreCandidate(
      { title: 'chimney inspection safety', primaryKeyword: 'chimney inspection safety', supportingKeywords: ['chimney safety'] },
      baseContext,
      [],
    );
    expect(score.signals.offeringMatch).toBeGreaterThanOrEqual(20);
    expect(score.total).toBeGreaterThanOrEqual(25);
  });

  it('scores zero offering match for unrelated topics', () => {
    const score = scoreCandidate(
      { title: 'dog grooming tips', primaryKeyword: 'dog grooming tips', supportingKeywords: [] },
      baseContext,
      [],
    );
    expect(score.signals.offeringMatch).toBe(0);
    expect(score.total).toBeLessThan(25);
  });

  it('applies generic penalty for template patterns', () => {
    const score = scoreCandidate(
      { title: 'chimney sweep buying guide', primaryKeyword: 'chimney sweep buying guide', supportingKeywords: [] },
      baseContext,
      [],
    );
    expect(score.signals.genericPenalty).toBe(-25);
  });

  it('applies competitor penalty for brand contamination', () => {
    const score = scoreCandidate(
      { title: 'Lords Chimney services review', primaryKeyword: 'Lords Chimney review', supportingKeywords: [] },
      baseContext,
      [],
    );
    expect(score.signals.competitorPenalty).toBe(-20);
  });

  it('rewards audience match', () => {
    const score = scoreCandidate(
      { title: 'chimney services for homeowners', primaryKeyword: 'chimney services homeowners', supportingKeywords: [] },
      baseContext,
      [],
    );
    expect(score.signals.audienceMatch).toBe(15);
  });

  it('rewards pain point match', () => {
    const score = scoreCandidate(
      { title: 'preventing creosote buildup', primaryKeyword: 'creosote buildup prevention', supportingKeywords: [] },
      baseContext,
      [],
    );
    expect(score.signals.painPointMatch).toBe(10);
  });

  it('penalizes existing page overlap', () => {
    const contextWithPages: RelevanceContext = {
      ...baseContext,
      existingPages: [{ title: 'chimney sweep services', path: '/chimney-sweep/', headings: [] }],
    };
    const score = scoreCandidate(
      { title: 'chimney sweep services guide', primaryKeyword: 'chimney sweep services', supportingKeywords: [] },
      contextWithPages,
      [],
    );
    expect(score.signals.existingOverlap).toBeLessThan(0);
  });

  it('rewards distinctiveness among unique siblings', () => {
    const score = scoreCandidate(
      { title: 'chimney inspection', primaryKeyword: 'chimney inspection', supportingKeywords: [] },
      baseContext,
      [{ title: 'fireplace repair', primaryKeyword: 'fireplace repair' }],
    );
    expect(score.signals.distinctiveness).toBe(15);
  });

  it('penalizes low distinctiveness', () => {
    const score = scoreCandidate(
      { title: 'chimney sweep service', primaryKeyword: 'chimney sweep service', supportingKeywords: [] },
      baseContext,
      [{ title: 'chimney sweep repair', primaryKeyword: 'chimney sweep repair' }],
    );
    expect(score.signals.distinctiveness).toBeLessThan(15);
  });
});

describe('scoreCandidates', () => {
  it('filters out low-scoring candidates', () => {
    const candidates = [
      { title: 'chimney inspection safety', primaryKeyword: 'chimney inspection safety', supportingKeywords: [] },
      { title: 'dog grooming tips', primaryKeyword: 'dog grooming tips', supportingKeywords: [] },
      { title: 'fireplace repair guide', primaryKeyword: 'fireplace repair services', supportingKeywords: [] },
    ];

    const scored = scoreCandidates(candidates, baseContext, { minScore: 25 });
    expect(scored.length).toBeGreaterThanOrEqual(1);
    expect(scored.every((c) => c.relevanceScore.total >= 25)).toBe(true);
    expect(scored.some((c) => c.title === 'dog grooming tips')).toBe(false);
  });

  it('returns results sorted by score descending', () => {
    const candidates = [
      { title: 'chimney inspection', primaryKeyword: 'chimney inspection', supportingKeywords: [] },
      { title: 'fireplace repair', primaryKeyword: 'fireplace repair', supportingKeywords: [] },
    ];

    const scored = scoreCandidates(candidates, baseContext, { minScore: 0 });
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1].relevanceScore.total).toBeGreaterThanOrEqual(scored[i].relevanceScore.total);
    }
  });

  it('respects maxResults limit', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      title: `chimney service type ${i}`,
      primaryKeyword: `chimney service type ${i}`,
      supportingKeywords: [],
    }));

    const scored = scoreCandidates(candidates, baseContext, { minScore: 0, maxResults: 3 });
    expect(scored.length).toBeLessThanOrEqual(3);
  });
});
