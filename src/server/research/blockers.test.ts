import { describe, expect, it } from 'vitest';
import {
  isGenericTopic,
  hasCompetitorBrandContamination,
  hasCityInPillar,
  matchesExcludedTopic,
  isMetadataCategory,
  isScrapedPageTitle,
  runAllBlockers,
} from './blockers';

describe('isGenericTopic', () => {
  it('blocks "X buying guide" pattern', () => {
    const result = isGenericTopic('water filter buying guide', 'water filter buying guide', 'English');
    expect(result.blocked).toBe(true);
  });

  it('blocks "X pricing" pattern', () => {
    const result = isGenericTopic('chimney sweep pricing', 'chimney sweep pricing', 'English');
    expect(result.blocked).toBe(true);
  });

  it('blocks "best X" pattern', () => {
    const result = isGenericTopic('best chimney sweep', 'best chimney sweep', 'English');
    expect(result.blocked).toBe(true);
  });

  it('blocks Hebrew generic patterns', () => {
    const result = isGenericTopic('water filter', 'water filter', 'Hebrew');
    expect(result.blocked).toBe(false);
  });

  it('does NOT block specific topics', () => {
    const result = isGenericTopic('chimney inspection safety checklist', 'chimney inspection safety checklist', 'English');
    expect(result.blocked).toBe(false);
  });

  it('does NOT block standalone service names', () => {
    const result = isGenericTopic('fireplace repair', 'fireplace repair', 'English');
    expect(result.blocked).toBe(false);
  });

  it('blocks cluster suffix patterns like "X: FAQ"', () => {
    const result = isGenericTopic('chimney sweep: FAQ', 'chimney sweep faq', 'English');
    expect(result.blocked).toBe(true);
  });
});

describe('hasCompetitorBrandContamination', () => {
  it('blocks when competitor brand is in title', () => {
    const result = hasCompetitorBrandContamination(
      'Lords Chimney vs other services',
      'chimney sweep comparison',
      [],
      ['Lords Chimney', 'ABC Chimney'],
      'Citywide Chimney',
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('Lords Chimney');
  });

  it('does NOT block own brand name', () => {
    const result = hasCompetitorBrandContamination(
      'Citywide Chimney services',
      'chimney sweep services',
      [],
      ['Lords Chimney'],
      'Citywide Chimney',
    );
    expect(result.blocked).toBe(false);
  });

  it('blocks when competitor brand is in supporting keywords', () => {
    const result = hasCompetitorBrandContamination(
      'chimney services',
      'chimney sweep',
      ['Lords Chimney sweep', 'chimney repair'],
      ['Lords Chimney'],
      'Citywide Chimney',
    );
    expect(result.blocked).toBe(true);
  });

  it('passes when no competitor brands provided', () => {
    const result = hasCompetitorBrandContamination(
      'chimney sweep guide',
      'chimney sweep',
      [],
      [],
      'My Brand',
    );
    expect(result.blocked).toBe(false);
  });
});

describe('hasCityInPillar', () => {
  it('blocks city in pillar when notes forbid it', () => {
    const result = hasCityInPillar(
      'Chimney Sweep Houston',
      ['Houston', 'Texas'],
      'Do not include city names in pillar topics',
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('Houston');
  });

  it('does NOT block when notes have no location exclusion', () => {
    const result = hasCityInPillar(
      'Chimney Sweep Houston',
      ['Houston'],
      'Please focus on local services',
    );
    expect(result.blocked).toBe(false);
  });

  it('does NOT block when no geography signals', () => {
    const result = hasCityInPillar(
      'Chimney Sweep Houston',
      [],
      'No city names in pillars',
    );
    expect(result.blocked).toBe(false);
  });
});

describe('matchesExcludedTopic', () => {
  it('blocks exact substring match', () => {
    const result = matchesExcludedTopic(
      'swimming pool water treatment',
      'pool water treatment',
      ['swimming pool'],
    );
    expect(result.blocked).toBe(true);
  });

  it('does NOT block unrelated topics', () => {
    const result = matchesExcludedTopic(
      'chimney inspection',
      'chimney inspection',
      ['swimming pool', 'HVAC'],
    );
    expect(result.blocked).toBe(false);
  });
});

describe('isMetadataCategory', () => {
  it('blocks "Main customer pain points"', () => {
    const result = isMetadataCategory('Main customer pain points');
    expect(result.blocked).toBe(true);
  });

  it('blocks "target audience"', () => {
    const result = isMetadataCategory('target audience analysis');
    expect(result.blocked).toBe(true);
  });

  it('blocks "value proposition"', () => {
    const result = isMetadataCategory('Our value proposition');
    expect(result.blocked).toBe(true);
  });

  it('does NOT block real business topics', () => {
    const result = isMetadataCategory('chimney inspection services');
    expect(result.blocked).toBe(false);
  });
});

describe('isScrapedPageTitle', () => {
  it('blocks long scraped titles', () => {
    const result = isScrapedPageTitle(
      'Chimney Sweep Near Me - Fireplace Repair Near Me - Houston TX - Lords Chimney',
    );
    expect(result.blocked).toBe(true);
  });

  it('does NOT block short focused titles', () => {
    const result = isScrapedPageTitle('chimney inspection services');
    expect(result.blocked).toBe(false);
  });

  it('blocks titles with separator patterns', () => {
    const result = isScrapedPageTitle('Best Chimney Sweep - Houston Area Services');
    expect(result.blocked).toBe(true);
  });
});

describe('runAllBlockers', () => {
  const baseContext = {
    language: 'English' as const,
    competitorBrands: ['Lords Chimney'],
    ownBrandName: 'Citywide Chimney',
    geographySignals: ['Houston'],
    notes: 'Do not include city names in pillars',
    excludedTopics: [],
  };

  it('short-circuits on first blocking result', () => {
    const result = runAllBlockers(
      {
        title: 'Main customer pain points buying guide',
        primaryKeyword: 'customer pain points buying guide',
        supportingKeywords: [],
      },
      baseContext,
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('metadata category');
  });

  it('passes clean candidates', () => {
    const result = runAllBlockers(
      {
        title: 'chimney inspection services',
        primaryKeyword: 'chimney inspection services',
        supportingKeywords: ['chimney inspection', 'safety inspection'],
      },
      baseContext,
    );
    expect(result.blocked).toBe(false);
  });
});
