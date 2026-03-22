import type { SiteLanguage } from '@/lib/research';
import { containsAny, jaccardSimilarity, keywordTokens, normalizeKeyword } from './utils';

export type BlockerResult = {
  blocked: boolean;
  reason: string | null;
};

const PASS: BlockerResult = { blocked: false, reason: null };

// --- Generic SEO template patterns ---

const GENERIC_SUFFIXES_EN = [
  'buying guide',
  'pricing',
  'maintenance',
  'how it works',
  'faq',
  'benefits',
  'problems',
  'for businesses',
  'for homes',
  'comparison',
  'reviews',
  'installation',
  'local service',
  'cost',
  'best practices',
];

const GENERIC_SUFFIXES_HE = [
  'מדריך',
  'מחיר',
  'תחזוקת',
  'איך לבחור',
  'שאלות נפוצות',
  'יתרונות',
  'בעיות נפוצות',
  'לעסקים',
  'לבתים',
  'השוואת',
  'התקנת',
  'שירות מקומי',
  'המלצות',
  'עלות',
];

const GENERIC_PREFIXES_EN = ['best', 'top', 'cheapest'];

function stripGenericParts(title: string, language: SiteLanguage): string {
  let cleaned = title.toLowerCase().trim();
  const suffixes = language === 'Hebrew' ? GENERIC_SUFFIXES_HE : GENERIC_SUFFIXES_EN;
  const prefixes = language === 'Hebrew' ? [] : GENERIC_PREFIXES_EN;

  for (const suffix of suffixes) {
    if (cleaned.endsWith(suffix.toLowerCase())) {
      cleaned = cleaned.slice(0, -suffix.length).trim();
    }
  }
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.slice(prefix.length).trim();
    }
  }

  return cleaned.replace(/^[\s:–\-]+|[\s:–\-]+$/g, '').trim();
}

export function isGenericTopic(
  title: string,
  primaryKeyword: string,
  language: SiteLanguage,
): BlockerResult {
  const suffixes = language === 'Hebrew' ? GENERIC_SUFFIXES_HE : GENERIC_SUFFIXES_EN;
  const prefixes = language === 'Hebrew' ? [] : GENERIC_PREFIXES_EN;
  const lower = title.toLowerCase().trim();

  // Check title for generic suffix/prefix patterns
  const matchesSuffix = suffixes.some((s) => lower.endsWith(s.toLowerCase()));
  const matchesPrefix = prefixes.some((p) => lower.startsWith(p.toLowerCase() + ' '));

  if (matchesSuffix) {
    return { blocked: true, reason: `Generic template suffix pattern: "${title}"` };
  }

  if (matchesPrefix) {
    return { blocked: true, reason: `Generic template prefix pattern: "${title}"` };
  }

  // Check for cluster suffix patterns like "X: FAQ", "X: Benefits"
  if (lower.includes(':')) {
    const afterColon = lower.split(':').pop()?.trim() ?? '';
    const isGenericCluster = suffixes.some((s) => afterColon === s.toLowerCase());
    if (isGenericCluster) {
      return { blocked: true, reason: `Generic cluster suffix: "${title}"` };
    }
  }

  // Also check primaryKeyword independently
  const kwLower = primaryKeyword.toLowerCase().trim();
  const kwMatchesSuffix = suffixes.some((s) => kwLower.endsWith(s.toLowerCase()));
  const kwMatchesPrefix = prefixes.some((p) => kwLower.startsWith(p.toLowerCase() + ' '));

  if (kwMatchesSuffix || kwMatchesPrefix) {
    return { blocked: true, reason: `Generic template pattern in primary keyword: "${primaryKeyword}"` };
  }

  return PASS;
}

// --- Competitor brand contamination ---

export function hasCompetitorBrandContamination(
  title: string,
  primaryKeyword: string,
  supportingKeywords: string[],
  competitorBrands: string[],
  ownBrandName: string,
): BlockerResult {
  if (!competitorBrands.length) return PASS;

  const filteredBrands = competitorBrands.filter(
    (brand) => normalizeKeyword(brand) !== normalizeKeyword(ownBrandName),
  );

  const allText = [title, primaryKeyword, ...supportingKeywords];

  for (const text of allText) {
    const match = containsAny(text, filteredBrands);
    if (match) {
      return { blocked: true, reason: `Competitor brand contamination: "${match}" in "${text}"` };
    }
  }

  return PASS;
}

// --- City/location in pillar ---

const LOCATION_EXCLUSION_PATTERNS = [
  /no\s+cit(?:y|ies)\s+(?:names?\s+)?in\s+pillar/i,
  /exclude\s+location/i,
  /do\s+not\s+include\s+(?:city|location|geographic)/i,
  /without\s+(?:city|location|geographic)/i,
  /city.*should\s+not\s+appear\s+in\s+(?:pillar|topic|article)/i,
  /אל\s+תכלול\s+(?:עיר|מיקום|גיאוגרפ)/,
  /ללא\s+(?:שם\s+)?(?:עיר|מיקום)/,
];

export function hasCityInPillar(
  title: string,
  geographySignals: string[],
  notes: string,
): BlockerResult {
  if (!notes || !geographySignals.length) return PASS;

  const hasExclusionRule = LOCATION_EXCLUSION_PATTERNS.some((pattern) => pattern.test(notes));
  if (!hasExclusionRule) return PASS;

  const match = containsAny(title, geographySignals);
  if (match) {
    return { blocked: true, reason: `City/location "${match}" in pillar title (spec forbids it)` };
  }

  return PASS;
}

// --- Excluded topics ---

export function matchesExcludedTopic(
  title: string,
  primaryKeyword: string,
  excludedTopics: string[],
): BlockerResult {
  if (!excludedTopics.length) return PASS;

  for (const topic of excludedTopics) {
    if (containsAny(title, [topic]) || containsAny(primaryKeyword, [topic])) {
      return { blocked: true, reason: `Matches excluded topic: "${topic}"` };
    }
    if (jaccardSimilarity(title, topic) > 0.5 || jaccardSimilarity(primaryKeyword, topic) > 0.5) {
      return { blocked: true, reason: `Semantically overlaps excluded topic: "${topic}"` };
    }
  }

  return PASS;
}

// --- Metadata category leakage ---

const METADATA_CATEGORIES = [
  'main customer pain points',
  'customer pain points',
  'pain points',
  'customer needs',
  'target audience',
  'value proposition',
  'buying persona',
  'main customer',
  'prospective customers',
  'key benefits',
  'unique selling',
  'competitive advantage',
  'market positioning',
  'customer segments',
  'buyer journey',
  'sales funnel',
  'marketing strategy',
];

const METADATA_CATEGORIES_HE = [
  'נקודות כאב',
  'צרכי לקוח',
  'קהל יעד',
  'הצעת ערך',
  'פרסונת קנייה',
  'לקוחות פוטנציאליים',
  'יתרונות מרכזיים',
  'יתרון תחרותי',
];

export function isMetadataCategory(title: string): BlockerResult {
  const lower = title.toLowerCase().trim();

  const allPatterns = [...METADATA_CATEGORIES, ...METADATA_CATEGORIES_HE];
  for (const pattern of allPatterns) {
    if (lower.includes(pattern.toLowerCase())) {
      return { blocked: true, reason: `Internal metadata category leaked as topic: "${pattern}"` };
    }
  }

  return PASS;
}

// --- Scraped page title detection ---

export function isScrapedPageTitle(title: string, maxTokenCount = 8): BlockerResult {
  const tokens = keywordTokens(title);

  if (tokens.length > maxTokenCount) {
    return { blocked: true, reason: `Seed too long (${tokens.length} tokens) — likely a scraped page title` };
  }

  if (/\s[-–|]\s/.test(title) && tokens.length > 5) {
    return { blocked: true, reason: `Contains title separator pattern (- or |) — likely a scraped page title` };
  }

  return PASS;
}

// --- Aggregate blocker ---

export type BlockerContext = {
  language: SiteLanguage;
  competitorBrands: string[];
  ownBrandName: string;
  geographySignals: string[];
  notes: string;
  excludedTopics: string[];
};

export function runAllBlockers(
  candidate: { title: string; primaryKeyword: string; supportingKeywords: string[] },
  context: BlockerContext,
): BlockerResult {
  let result: BlockerResult;

  result = isMetadataCategory(candidate.title);
  if (result.blocked) return result;

  result = isScrapedPageTitle(candidate.title);
  if (result.blocked) return result;

  result = isGenericTopic(candidate.title, candidate.primaryKeyword, context.language);
  if (result.blocked) return result;

  result = hasCompetitorBrandContamination(
    candidate.title,
    candidate.primaryKeyword,
    candidate.supportingKeywords,
    context.competitorBrands,
    context.ownBrandName,
  );
  if (result.blocked) return result;

  result = hasCityInPillar(candidate.title, context.geographySignals, context.notes);
  if (result.blocked) return result;

  result = matchesExcludedTopic(candidate.title, candidate.primaryKeyword, context.excludedTopics);
  if (result.blocked) return result;

  return PASS;
}
