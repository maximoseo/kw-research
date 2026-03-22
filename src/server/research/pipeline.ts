import pLimit from 'p-limit';
import { z } from 'zod';
import type { ResearchInputSnapshot, ResearchIntent, ResearchRow, SiteLanguage } from '@/lib/research';
import { sanitizeFilenameSegment } from '@/lib/utils';
import { writeManagedReport } from '@/server/files/storage';
import { getCrawlLimits } from '@/lib/env';
import { callAiJson } from './ai';
import { fetchBulkKeywordMetrics } from './keyword-metrics';
import { discoverCompetitors, type CompetitorCandidate } from './competitors';
import {
  buildExistingContentMap,
  fetchPageSnapshot,
  fetchSitemapUrls,
  type PageSnapshot,
} from './crawl';
import {
  addResearchLog,
  attachWorkbookToRun,
  heartbeatRun,
  updateRunState,
} from './repository';
import { validateAndNormalizeRows, verifyWorkbookBuffer } from './qa';
import {
  buildSlugPath,
  dedupeStrings,
  ensureBrandFirst,
  jaccardSimilarity,
} from './utils';
import { buildWorkbook } from './workbook';
import { callSwarmAgent, planSwarmExecution, selectModelForTask, synthesizeAgentResults, synthesizeReport, type AgentResult } from './agents';
import { runSiteProfileAgent, type SiteProfile } from './agents/site-profile-agent';
import { runCompetitorValidationAgent } from './agents/competitor-validation-agent';
import { runJudgeAgent } from './agents/judge-agent';
import { runCompetitorGenerationAgent } from './agents/competitor-generation-agent';
import { runSerpIntentAgent } from './agents/serp-intent-agent';

const siteUnderstandingSchema = z.object({
  businessSummary: z.string(),
  offerings: z.array(z.string()).min(1).max(12),
  audiences: z.array(z.string()).min(1).max(12),
  painPoints: z.array(z.string()).max(12).default([]),
  differentiators: z.array(z.string()).max(12).default([]),
  geographySignals: z.array(z.string()).max(8).default([]),
  coveredTopics: z.array(z.string()).max(25).default([]),
  excludedTopics: z.array(z.string()).max(20).default([]),
  competitorQueries: z.array(z.string()).max(6).default([]),
});

const competitorIntelligenceSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string(),
        domain: z.string(),
        url: z.string(),
        whyRelevant: z.string(),
        themes: z.array(z.string()).max(12),
      }),
    )
    .max(6)
    .default([]),
  opportunityThemes: z.array(z.string()).max(20).default([]),
});

const pillarSchema = z.object({
  pillars: z
    .array(
      z.object({
        title: z.string(),
        intent: z.enum(['Informational', 'Commercial', 'Transactional', 'Navigational']),
        primaryKeyword: z.string(),
        supportingKeywords: z.array(z.string()).min(3).max(8),
        rationale: z.string(),
      }),
    )
    .min(1),
});

const clusterSchema = z.object({
  clusters: z
    .array(
      z.object({
        title: z.string(),
        intent: z.enum(['Informational', 'Commercial', 'Transactional', 'Navigational']),
        primaryKeyword: z.string(),
        supportingKeywords: z.array(z.string()).min(3).max(8),
        rationale: z.string(),
        searchVolume: z.number().nullable().optional(),
        cpc: z.number().nullable().optional(),
      }),
    )
    .min(1),
});

type SiteUnderstanding = z.infer<typeof siteUnderstandingSchema>;
type CompetitorIntelligence = z.infer<typeof competitorIntelligenceSchema>;
type PillarCandidate = z.infer<typeof pillarSchema>['pillars'][number];
type ClusterCandidate = z.infer<typeof clusterSchema>['clusters'][number];
export type AiAvailabilityState = { enabled: boolean };
export type CompetitorSuggestion = CompetitorCandidate & {
  whyRelevant: string;
  themes: string[];
};
type MaybePromise<T> = T | Promise<T>;

interface ResolveWithAiFallbackParams<T, TStage extends 'analysis' | 'competitors' | 'pillars' | 'clusters'> {
  stage: TStage;
  aiState: AiAvailabilityState;
  task: () => Promise<T>;
  fallback: () => T;
  onFallback?: (stage: TStage, error: unknown) => MaybePromise<void>;
  modelTier?: 'opus' | 'sonnet' | 'haiku' | 'openai-fast' | 'openai-mini';
}

async function resolveWithAiFallback<T, TStage extends 'analysis' | 'competitors' | 'pillars' | 'clusters'>(params: ResolveWithAiFallbackParams<T, TStage>): Promise<T> {
  if (!params.aiState.enabled) {
    return params.fallback();
  }

  try {
    return await params.task();
  } catch (error) {
    params.aiState.enabled = false;
    await params.onFallback?.(params.stage, error);
    return params.fallback();
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clip(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 3) + '...';
}

function buildParentUrl(baseUrl: string, slugPath: string) {
  return new URL(slugPath, baseUrl).toString();
}

function localize(language: SiteLanguage, english: string, hebrew: string) {
  return language === 'Hebrew' ? hebrew : english;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripBrand(value: string, brandName: string) {
  if (!brandName.trim()) {
    return value;
  }

  return value.replace(new RegExp(escapeRegExp(brandName), 'ig'), '').trim();
}

function splitSentences(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function cleanSeed(value: string, brandName: string, language: SiteLanguage) {
  const genericEnglish = /\b(home|about|blog|services?|contact|learn more)\b/gi;
  const genericHebrew = /\b(בית|אודות|בלוג|שירותים|צור קשר)\b/gi;
  const genericPattern = language === 'Hebrew' ? genericHebrew : genericEnglish;

  return stripBrand(
    value
      .split(/[|•]/)[0]
      .replace(/\s+/g, ' ')
      .replace(genericPattern, '')
      .replace(/^[\s\-–:]+|[\s\-–:]+$/g, '')
      .trim(),
    brandName,
  );
}

function buildSupportingKeywords(input: ResearchInputSnapshot, primaryKeyword: string, extras: string[]) {
  const fallbackTerms =
    input.language === 'Hebrew'
      ? ['מדריך', 'השוואה', 'שירות']
      : ['guide', 'comparison', 'service'];

  return dedupeStrings([primaryKeyword, ...extras, input.market, ...fallbackTerms]).slice(0, 6);
}

function extractTopicSeeds(params: {
  input: ResearchInputSnapshot;
  pageSnapshots: PageSnapshot[];
  existingContentMap: ReturnType<typeof buildExistingContentMap>;
}) {
  const candidates = [
    ...params.pageSnapshots.flatMap((snapshot) => [snapshot.title, ...snapshot.headings]),
    ...params.existingContentMap.pages.flatMap((page) => [page.title, ...page.headings]),
  ];

  return dedupeStrings(
    candidates
      .map((entry) => cleanSeed(entry, params.input.brandName, params.input.language))
      .filter((entry) => entry.length >= (params.input.language === 'Hebrew' ? 3 : 5)),
  ).slice(0, 12);
}

function detectAudiences(text: string, language: SiteLanguage) {
  const patterns =
    language === 'Hebrew'
      ? [
          { regex: /בעלי בתים|לקוחות ביתיים/, label: 'בעלי בתים' },
          { regex: /מסעדות|מסעדה/, label: 'מסעדות' },
          { regex: /מרפאות|מרפאה/, label: 'מרפאות' },
          { regex: /משרדים|משרד/, label: 'משרדים' },
          { regex: /עסקים קטנים|עסקים/, label: 'עסקים קטנים' },
          { regex: /מנהלי נכסים|נכסים/, label: 'מנהלי נכסים' },
        ]
      : [
          { regex: /homeowners?|residential/i, label: 'Homeowners' },
          { regex: /restaurants?|hospitality/i, label: 'Restaurant operators' },
          { regex: /clinics?|dental/i, label: 'Clinic operators' },
          { regex: /offices?|office managers?/i, label: 'Office managers' },
          { regex: /property managers?/i, label: 'Property managers' },
          { regex: /small businesses?|commercial/i, label: 'Small businesses' },
        ];

  const matches = patterns.filter((pattern) => pattern.regex.test(text)).map((pattern) => pattern.label);
  return matches.length
    ? dedupeStrings(matches)
    : [localize(language, 'Prospective customers', 'לקוחות פוטנציאליים')];
}

function detectPainPoints(text: string, language: SiteLanguage) {
  const patterns =
    language === 'Hebrew'
      ? [
          { regex: /אבנית/, label: 'אבנית' },
          { regex: /כלור/, label: 'כלור וטעמי לוואי' },
          { regex: /משקעים/, label: 'משקעים במים' },
          { regex: /תחזוקה/, label: 'תחזוקה שוטפת' },
          { regex: /איכות/, label: 'איכות מים' },
          { regex: /עלו[יו]ת|מחיר/, label: 'עלות מערכת' },
        ]
      : [
          { regex: /hard water/i, label: 'Hard water' },
          { regex: /chlorine/i, label: 'Chlorine taste and odor' },
          { regex: /sediment/i, label: 'Sediment in water' },
          { regex: /scale/i, label: 'Scale buildup' },
          { regex: /maintenance/i, label: 'Ongoing maintenance' },
          { regex: /cost|pricing/i, label: 'System pricing' },
          { regex: /quality|compliance/i, label: 'Water quality compliance' },
        ];

  const matches = patterns.filter((pattern) => pattern.regex.test(text)).map((pattern) => pattern.label);
  return matches.length
    ? dedupeStrings(matches)
    : [localize(language, 'Main customer pain points', 'כאבי הלקוח המרכזיים')];
}

function detectExcludedTopics(text: string, language: SiteLanguage) {
  const matches =
    language === 'Hebrew'
      ? [...text.matchAll(/לא\s+([^.,;]+)/g)].map((match) => match[1]?.trim()).filter(Boolean)
      : [...text.matchAll(/\b(?:do not|don't|does not|not focused on)\s+([^.,;]+)/gi)]
          .map((match) => match[1]?.trim())
          .filter(Boolean);

  return dedupeStrings(matches).slice(0, 6);
}

function overlapWithExisting(candidate: { title: string; primaryKeyword: string }, existing: string[]) {
  return existing.some((entry) => {
    return (
      jaccardSimilarity(candidate.title, entry) >= 0.75 ||
      jaccardSimilarity(candidate.primaryKeyword, entry) >= 0.8
    );
  });
}

function normalizeSiteUnderstanding(payload: SiteUnderstanding): SiteUnderstanding {
  return {
    businessSummary: payload.businessSummary,
    offerings: payload.offerings ?? [],
    audiences: payload.audiences ?? [],
    painPoints: payload.painPoints ?? [],
    differentiators: payload.differentiators ?? [],
    geographySignals: payload.geographySignals ?? [],
    coveredTopics: payload.coveredTopics ?? [],
    excludedTopics: payload.excludedTopics ?? [],
    competitorQueries: payload.competitorQueries ?? [],
  };
}

function normalizeCompetitorIntelligence(payload: CompetitorIntelligence): CompetitorIntelligence {
  return {
    competitors: payload.competitors ?? [],
    opportunityThemes: payload.opportunityThemes ?? [],
  };
}

function buildSiteUnderstandingFallback(params: {
  input: ResearchInputSnapshot;
  pageSnapshots: PageSnapshot[];
  existingContentMap: ReturnType<typeof buildExistingContentMap>;
}): SiteUnderstanding {
  const combinedEvidence = params.pageSnapshots
    .map((snapshot) => [snapshot.title, snapshot.description, snapshot.body].filter(Boolean).join('. '))
    .join(' ');
  const topicSeeds = extractTopicSeeds(params);
  const audiences = detectAudiences(combinedEvidence, params.input.language);
  const painPoints = detectPainPoints(combinedEvidence, params.input.language);
  const summarySentences = splitSentences(combinedEvidence).slice(0, 2);
  const businessSummary =
    summarySentences.join(' ') ||
    localize(
      params.input.language,
      `${params.input.brandName} focuses on ${topicSeeds.slice(0, 2).join(' and ')} for ${audiences.slice(0, 2).join(' and ')} in ${params.input.market}.`,
      `${params.input.brandName} מתמקדת ב-${topicSeeds.slice(0, 2).join(' ו-')} עבור ${audiences
        .slice(0, 2)
        .join(' ו-')} בשוק ${params.input.market}.`,
    );

  return {
    businessSummary,
    offerings:
      topicSeeds.slice(0, 6).length > 0
        ? topicSeeds.slice(0, 6)
        : [localize(params.input.language, 'Core service offering', 'השירות המרכזי')],
    audiences,
    painPoints,
    differentiators: [
      localize(
        params.input.language,
        `Focused on ${params.input.market}`,
        `ממוקדת בשוק ${params.input.market}`,
      ),
    ],
    geographySignals: [params.input.market],
    coveredTopics: dedupeStrings(
      params.existingContentMap.pages.flatMap((page) => [page.title, ...page.headings]).filter(Boolean),
    ).slice(0, 20),
    excludedTopics: detectExcludedTopics(combinedEvidence, params.input.language),
    competitorQueries: topicSeeds.slice(0, 4).map((seed) => `${seed} ${params.input.market}`),
  };
}

function buildCompetitorIntelligenceFallback(params: {
  input: ResearchInputSnapshot;
  siteUnderstanding: SiteUnderstanding;
  competitorPageEvidence: PageSnapshot[];
  autoCompetitorCandidates: Array<{ name: string; url: string; domain: string; snippet: string }>;
}): CompetitorIntelligence {
  const extractedThemes = dedupeStrings(
    params.competitorPageEvidence.flatMap((snapshot) => [snapshot.title, ...snapshot.headings]).filter(Boolean),
  ).slice(0, 12);

  return {
    competitors: params.autoCompetitorCandidates.slice(0, 3).map((candidate, index) => ({
      name: candidate.name,
      domain: candidate.domain,
      url: candidate.url,
      whyRelevant:
        candidate.snippet ||
        localize(
          params.input.language,
          'Relevant competitor discovered from the same market and offering space.',
          'מתחרה רלוונטי שהתגלה באותו שוק ובאותו תחום פעילות.',
        ),
      themes: extractedThemes.slice(index, index + 4).length
        ? extractedThemes.slice(index, index + 4)
        : params.siteUnderstanding.offerings.slice(0, 4),
    })),
    opportunityThemes: dedupeStrings([
      ...params.siteUnderstanding.offerings,
      ...params.siteUnderstanding.painPoints,
      ...extractedThemes,
    ]).slice(0, 15),
  };
}

function buildPillarCandidatesFallback(params: {
  input: ResearchInputSnapshot;
  siteUnderstanding: SiteUnderstanding;
  competitorIntelligence: CompetitorIntelligence;
  desiredCount: number;
}) {
  const seeds = dedupeStrings([
    ...params.siteUnderstanding.offerings,
    ...params.competitorIntelligence.opportunityThemes,
  ]).slice(0, 6);
  const audiences = params.siteUnderstanding.audiences.slice(0, 3);
  const candidates: PillarCandidate[] = [];

  const pushCandidate = (candidate: PillarCandidate) => {
    if (candidates.some((entry) => entry.title.toLowerCase() === candidate.title.toLowerCase())) {
      return;
    }

    candidates.push(candidate);
  };

  for (const seed of seeds) {
    if (params.input.language === 'Hebrew') {
      pushCandidate({
        title: `מדריך ${seed}`,
        intent: 'Informational',
        primaryKeyword: `מדריך ${seed}`,
        supportingKeywords: buildSupportingKeywords(params.input, `מדריך ${seed}`, [seed, `פתרונות ${seed}`]),
        rationale: 'נגזר מהשירותים המרכזיים ומהביקוש המחקרי של האתר.',
      });
      pushCandidate({
        title: `מחיר ${seed}`,
        intent: 'Commercial',
        primaryKeyword: `מחיר ${seed}`,
        supportingKeywords: buildSupportingKeywords(params.input, `מחיר ${seed}`, [seed, `עלות ${seed}`]),
        rationale: 'מכסה כוונת חיפוש מסחרית סביב תמחור והשוואת אפשרויות.',
      });
      pushCandidate({
        title: `תחזוקת ${seed}`,
        intent: 'Informational',
        primaryKeyword: `תחזוקת ${seed}`,
        supportingKeywords: buildSupportingKeywords(params.input, `תחזוקת ${seed}`, [seed, `שירות ${seed}`]),
        rationale: 'מייצר הזדמנות תוכן שאינה חופפת ישירות לעמודי מוצר קיימים.',
      });
      pushCandidate({
        title: `איך לבחור ${seed}`,
        intent: 'Commercial',
        primaryKeyword: `איך לבחור ${seed}`,
        supportingKeywords: buildSupportingKeywords(params.input, `איך לבחור ${seed}`, [seed, 'השוואת אפשרויות']),
        rationale: 'מתאים לחיפושי השוואה ובחירה בשלבי אמצע המשפך.',
      });
    } else {
      pushCandidate({
        title: `${seed} buying guide`,
        intent: 'Informational',
        primaryKeyword: `${seed} buying guide`,
        supportingKeywords: buildSupportingKeywords(params.input, `${seed} buying guide`, [seed, `${seed} options`]),
        rationale: 'Derived from the site’s core service areas and early-stage research intent.',
      });
      pushCandidate({
        title: `${seed} pricing`,
        intent: 'Commercial',
        primaryKeyword: `${seed} pricing`,
        supportingKeywords: buildSupportingKeywords(params.input, `${seed} pricing`, [seed, `${seed} cost`]),
        rationale: 'Captures commercial research intent around budgets and vendor evaluation.',
      });
      pushCandidate({
        title: `${seed} maintenance`,
        intent: 'Informational',
        primaryKeyword: `${seed} maintenance`,
        supportingKeywords: buildSupportingKeywords(params.input, `${seed} maintenance`, [seed, `${seed} service`]),
        rationale: 'Expands into lifecycle and retention topics without duplicating service pages.',
      });
      pushCandidate({
        title: `best ${seed}`,
        intent: 'Commercial',
        primaryKeyword: `best ${seed}`,
        supportingKeywords: buildSupportingKeywords(params.input, `best ${seed}`, [seed, `${seed} comparison`]),
        rationale: 'Targets shortlist and comparison-driven search behavior.',
      });
    }

    for (const audience of audiences) {
      if (params.input.language === 'Hebrew') {
        pushCandidate({
          title: `${seed} ל${audience}`,
          intent: 'Commercial',
          primaryKeyword: `${seed} ל${audience}`,
          supportingKeywords: buildSupportingKeywords(params.input, `${seed} ל${audience}`, [seed, audience]),
          rationale: 'מקשר בין השירותים המרכזיים לבין סגמנט קהל יעד אמיתי של העסק.',
        });
      } else {
        pushCandidate({
          title: `${seed} for ${audience.toLowerCase()}`,
          intent: 'Commercial',
          primaryKeyword: `${seed} for ${audience.toLowerCase()}`,
          supportingKeywords: buildSupportingKeywords(params.input, `${seed} for ${audience.toLowerCase()}`, [
            seed,
            audience,
          ]),
          rationale: 'Connects the offering to a real customer segment found on the site.',
        });
      }
    }
  }

  return candidates.slice(0, params.desiredCount + 6);
}

function extractBaseKeyword(primaryKeyword: string, language: SiteLanguage) {
  if (language === 'Hebrew') {
    return primaryKeyword
      .replace(/\b(מדריך|מחיר|תחזוקת|איך לבחור|השוואת|יתרונות)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return primaryKeyword
    .replace(/\b(buying guide|pricing|maintenance|best|for [a-z\s]+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildClusterCandidatesFallback(params: {
  input: ResearchInputSnapshot;
  pillar: PillarCandidate;
  desiredCount: number;
}) {
  const base = extractBaseKeyword(params.pillar.primaryKeyword, params.input.language) || params.pillar.primaryKeyword;
  const candidates: ClusterCandidate[] = [];

  const pushCandidate = (candidate: ClusterCandidate) => {
    if (candidates.some((entry) => entry.title.toLowerCase() === candidate.title.toLowerCase())) {
      return;
    }
    candidates.push(candidate);
  };

  const definitions =
    params.input.language === 'Hebrew'
      ? [
          [`איך ${base} עובד`, 'Informational', ['תהליך עבודה', base]],
          [`מחיר ${base}`, 'Commercial', ['עלות מערכת', base]],
          [`התקנת ${base}`, 'Commercial', ['שירות התקנה', base]],
          [`תחזוקת ${base}`, 'Informational', ['שירות תחזוקה', base]],
          [`השוואת ${base}`, 'Commercial', ['השוואת אפשרויות', base]],
          [`${base} לעסקים`, 'Commercial', ['פתרונות לעסקים', base]],
          [`${base} לבתים`, 'Commercial', ['פתרונות לבית', base]],
          [`יתרונות ${base}`, 'Informational', ['תועלות מרכזיות', base]],
          [`בעיות נפוצות עם ${base}`, 'Informational', ['תקלות נפוצות', base]],
          [`שאלות נפוצות על ${base}`, 'Informational', ['מדריך שאלות', base]],
          [`שירות מקומי עבור ${base}`, 'Commercial', ['שירות אזורי', base]],
          [`המלצות עבור ${base}`, 'Commercial', ['בחירת ספק', base]],
        ]
      : [
          [`${params.pillar.title}: How it works`, 'Informational', ['process overview', base]],
          [`${params.pillar.title}: Cost`, 'Commercial', ['pricing', base]],
          [`${params.pillar.title}: Installation`, 'Commercial', ['setup', base]],
          [`${params.pillar.title}: Maintenance`, 'Informational', ['service plan', base]],
          [`${params.pillar.title}: Comparison`, 'Commercial', ['alternatives', base]],
          [`${params.pillar.title}: For businesses`, 'Commercial', ['commercial use', base]],
          [`${params.pillar.title}: For homes`, 'Commercial', ['residential use', base]],
          [`${params.pillar.title}: Benefits`, 'Informational', ['advantages', base]],
          [`${params.pillar.title}: Problems`, 'Informational', ['troubleshooting', base]],
          [`${params.pillar.title}: FAQ`, 'Informational', ['questions', base]],
          [`${params.pillar.title}: Local service`, 'Commercial', ['near me', base]],
          [`${params.pillar.title}: Reviews`, 'Commercial', ['provider evaluation', base]],
        ];

  for (const [title, intent, extras] of definitions) {
    const englishSuffix = params.input.language === 'Hebrew' ? '' : String(title).split(': ')[1]!.toLowerCase();
    const primaryKeyword = params.input.language === 'Hebrew' ? String(title) : `${base} ${englishSuffix}`;
    pushCandidate({
      title: String(title),
      intent: intent as ResearchIntent,
      primaryKeyword,
      supportingKeywords: buildSupportingKeywords(params.input, primaryKeyword, extras as string[]),
      rationale: localize(
        params.input.language,
        'Generated from the pillar angle while keeping a distinct search intent.',
        'נגזר מהפילר עם כוונת חיפוש נפרדת כדי לצמצם קניבליזציה.',
      ),
    });
  }

  return candidates.slice(0, params.desiredCount + 4);
}

function keepPageSnapshot(value: PageSnapshot | null): value is PageSnapshot {
  return value !== null;
}

function normalizeCandidateDomain(url: string, fallback = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return fallback;
  }
}

function mergeSuggestedCompetitors(params: {
  autoCompetitorCandidates: CompetitorCandidate[];
  competitorIntelligence: CompetitorIntelligence;
}) {
  const merged: CompetitorSuggestion[] = [];
  const seen = new Set<string>();
  const candidateByDomain = new Map(
    params.autoCompetitorCandidates.map((candidate) => [candidate.domain, candidate]),
  );

  const pushSuggestion = (candidate: CompetitorSuggestion) => {
    const key = candidate.domain || normalizeCandidateDomain(candidate.url);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push(candidate);
  };

  for (const competitor of params.competitorIntelligence.competitors) {
    const matchedCandidate =
      candidateByDomain.get(competitor.domain) ||
      candidateByDomain.get(normalizeCandidateDomain(competitor.url, competitor.domain));
    const resolvedUrl =
      competitor.url || matchedCandidate?.url || (competitor.domain ? `https://${competitor.domain}` : '');
    const resolvedDomain =
      competitor.domain || matchedCandidate?.domain || normalizeCandidateDomain(resolvedUrl);

    pushSuggestion({
      name: competitor.name || matchedCandidate?.name || resolvedDomain,
      domain: resolvedDomain,
      url: resolvedUrl,
      snippet: matchedCandidate?.snippet || '',
      confidence: matchedCandidate?.confidence ?? 60,
      sources: matchedCandidate?.sources ?? [],
      whyRelevant:
        competitor.whyRelevant ||
        matchedCandidate?.snippet ||
        'Relevant competitor discovered from the same market and offering space.',
      themes: competitor.themes ?? [],
    });
  }

  for (const candidate of params.autoCompetitorCandidates) {
    pushSuggestion({
      ...candidate,
      whyRelevant:
        candidate.snippet || 'Relevant competitor discovered from the same market and offering space.',
      themes: [],
    });
  }

  return merged.slice(0, 10);
}

async function log(runId: string, stage: string, message: string, metadata?: Record<string, unknown>) {
  await addResearchLog({
    runId,
    stage,
    level: 'info',
    message,
    metadata,
  });
  await updateRunState(runId, { step: message });
  await heartbeatRun(runId);
}

export async function buildSiteEvidence(input: Pick<ResearchInputSnapshot, 'homepageUrl' | 'aboutUrl' | 'sitemapUrl'>) {
  const crawlLimits = getCrawlLimits();
  const concurrency = pLimit(4);

  // Try provided sitemap, fallback to auto-discovery
  let sitemapUrls = input.sitemapUrl ? await fetchSitemapUrls(input.sitemapUrl).catch(() => [] as string[]) : [];
  let sitemapSource = input.sitemapUrl ? 'provided' : 'none';
  if (sitemapUrls.length === 0 && input.homepageUrl) {
    const { discoverSitemapUrl } = await import('./discovery');
    const discovered = await discoverSitemapUrl(input.homepageUrl).catch(() => null);
    if (discovered) {
      sitemapUrls = await fetchSitemapUrls(discovered).catch(() => [] as string[]);
      sitemapSource = 'auto-discovered';
      console.info(`[discovery] Sitemap auto-discovered: ${discovered} (${sitemapUrls.length} URLs)`);
    }
  }

  // Try provided about page, fallback to auto-discovery  
  let aboutUrl = input.aboutUrl;
  let aboutSource = 'provided';
  if (aboutUrl) {
    const aboutTest = await fetchPageSnapshot(aboutUrl).catch(() => null);
    if (!aboutTest) {
      aboutUrl = '';
      aboutSource = 'provided-failed';
    }
  }
  if (!aboutUrl && input.homepageUrl) {
    const { discoverAboutPage } = await import('./discovery');
    const discovered = await discoverAboutPage(input.homepageUrl).catch(() => null);
    if (discovered) {
      aboutUrl = discovered;
      aboutSource = 'auto-discovered';
      console.info(`[discovery] About page auto-discovered: ${discovered}`);
    }
  }

  const baseEvidenceUrls = dedupeStrings(
    [input.homepageUrl, aboutUrl, ...sitemapUrls].filter(Boolean),
  ).slice(0, crawlLimits.maxPageFetches);

  const pageSnapshots = (
    await Promise.all(baseEvidenceUrls.map((url) => concurrency(() => fetchPageSnapshot(url).catch(() => null))))
  ).filter(keepPageSnapshot);

  if (pageSnapshots.length === 0) {
    console.warn('[discovery] WARNING: Zero page snapshots collected. AI analysis will be severely degraded.');
  }

  const existingContentMap = buildExistingContentMap(sitemapUrls, pageSnapshots);

  return {
    sitemapUrls,
    pageSnapshots,
    existingContentMap,
    discoveryMeta: { sitemapSource, aboutSource, aboutUrl, pageCount: pageSnapshots.length },
  };
}

async function buildSiteUnderstanding(
  input: ResearchInputSnapshot,
  pageSnapshots: PageSnapshot[],
  existingContentMap: ReturnType<typeof buildExistingContentMap>,
): Promise<SiteUnderstanding> {
  const response = await callAiJson({
    schema: siteUnderstandingSchema,
    system:
      'You are a senior SEO strategist. Only describe services, products, audiences, and market signals that are explicitly supported by the supplied site evidence. Never invent offerings.',
    prompt: JSON.stringify({
      task: 'Summarize the business, audience, coverage, exclusions, and market-relevant competitor search queries.',
      language: input.language,
      market: input.market,
      brandName: input.brandName,
      homepageUrl: input.homepageUrl,
      aboutUrl: input.aboutUrl,
      pageEvidence: pageSnapshots.map((snapshot) => ({
        url: snapshot.url,
        title: snapshot.title,
        description: snapshot.description,
        headings: snapshot.headings.slice(0, 8),
        bodyExcerpt: clip(snapshot.body, 1200),
      })),
      existingContentMap: {
        urlCount: existingContentMap.urlCount,
        sampledPageCount: existingContentMap.sampledPageCount,
        sampledTopics: existingContentMap.pages.slice(0, 20).map((page) => ({
          path: page.path,
          title: page.title,
          headings: page.headings.slice(0, 4),
        })),
      },
      outputContract: {
        businessSummary: 'short paragraph',
        offerings: 'array of real offerings',
        audiences: 'array of real audience segments',
        painPoints: 'array of pain points solved',
        differentiators: 'array of differentiators',
        geographySignals: 'array of market signals',
        coveredTopics: 'array of topics already covered',
        excludedTopics: 'array of things the business does not do',
        competitorQueries: 'array of search queries that would surface relevant competitors',
      },
    }),
    modelTier: 'opus',
  });
  return siteUnderstandingSchema.parse(response);
}

async function buildCompetitorIntelligence(params: {
  input: ResearchInputSnapshot;
  siteUnderstanding: SiteUnderstanding;
  competitorPageEvidence: PageSnapshot[];
  autoCompetitorCandidates: Array<{ name: string; url: string; domain: string; snippet: string }>;
}): Promise<CompetitorIntelligence> {
  const response = await callAiJson({
    schema: competitorIntelligenceSchema,
    system:
      'You are a keyword-research strategist. Select only competitors that are genuinely relevant to the same market and offering set. Reject tangential sites and directories.',
    prompt: JSON.stringify({
      task: 'Evaluate competitor evidence and extract useful inspiration themes without copying site structures blindly.',
      input: {
        language: params.input.language,
        market: params.input.market,
        brandName: params.input.brandName,
        businessSummary: params.siteUnderstanding.businessSummary,
        offerings: params.siteUnderstanding.offerings,
        audiences: params.siteUnderstanding.audiences,
      },
      candidateCompetitors: params.autoCompetitorCandidates,
      competitorPageEvidence: params.competitorPageEvidence.map((snapshot) => ({
        url: snapshot.url,
        title: snapshot.title,
        headings: snapshot.headings.slice(0, 8),
        bodyExcerpt: clip(snapshot.body, 1000),
      })),
      outputContract: {
        competitors: [
          {
            name: 'name',
            domain: 'domain',
            url: 'url',
            whyRelevant: 'why this competitor matters',
            themes: ['relevant content themes only'],
          },
        ],
        opportunityThemes: ['gaps or themes worth considering'],
      },
    }),
    modelTier: 'sonnet',
  });
  return competitorIntelligenceSchema.parse(response);
}

export async function analyzeCompetitiveLandscape(params: {
  input: ResearchInputSnapshot;
  pageSnapshots: PageSnapshot[];
  existingContentMap: ReturnType<typeof buildExistingContentMap>;
  aiState: AiAvailabilityState;
  manualCompetitorUrls?: string[];
  onAiFallback?: (stage: 'analysis' | 'competitors', error: unknown) => MaybePromise<void>;
}) {
  const handleAnalysisFallback = params.onAiFallback
    ? (error: unknown) => params.onAiFallback?.('analysis', error)
    : undefined;
  const handleCompetitorFallback = params.onAiFallback
    ? (error: unknown) => params.onAiFallback?.('competitors', error)
    : undefined;

  const siteUnderstanding = normalizeSiteUnderstanding(
    await resolveWithAiFallback({
      stage: 'analysis',
      aiState: params.aiState,
      task: () => buildSiteUnderstanding(params.input, params.pageSnapshots, params.existingContentMap),
      fallback: () =>
        buildSiteUnderstandingFallback({
          input: params.input,
          pageSnapshots: params.pageSnapshots,
          existingContentMap: params.existingContentMap,
        }),
      onFallback: handleAnalysisFallback ? (_stage, error) => handleAnalysisFallback(error) : undefined,
    }),
  );

  const manualCompetitorUrls = params.manualCompetitorUrls ?? params.input.competitorUrls;

  // Always run DuckDuckGo discovery — existing competitors are used for dedup only
  const discoveryQueries =
    siteUnderstanding.competitorQueries.length > 0
      ? siteUnderstanding.competitorQueries
      : siteUnderstanding.offerings.map((offering) => `${offering} ${params.input.market}`);

  const discoveredCompetitors = await discoverCompetitors({
    homepageUrl: params.input.homepageUrl,
    language: params.input.language,
    market: params.input.market,
    suggestedQueries: discoveryQueries,
  })
    .then((result) => result.candidates)
    .catch((error) => {
      console.warn('[competitors] DuckDuckGo discovery failed:', error instanceof Error ? error.message : error);
      return [] as CompetitorCandidate[];
    });

  if (discoveredCompetitors.length === 0 && manualCompetitorUrls.length === 0) {
    console.warn('[competitors] No competitors found from any source. Results will be limited.');
  }

  const competitorUrls = dedupeStrings([
    ...manualCompetitorUrls,
    ...discoveredCompetitors.map((entry) => entry.url),
  ]).slice(0, 10);

  // --- Swarm Agent: Site Profile Discovery ---
  let siteProfile: SiteProfile | null = null;
  try {
    siteProfile = await runSiteProfileAgent({
      homepage: params.input.homepageUrl,
      pageEvidence: params.pageSnapshots.map((s) => ({
        url: s.url,
        title: s.title ?? '',
        headings: s.headings ?? [],
        snippet: s.body?.slice(0, 500) ?? '',
      })),
    });
    console.info('[swarm] Site profile extracted:', siteProfile.businessName, '/', siteProfile.niche);
  } catch (error) {
    console.warn('[swarm] Site profile agent failed, continuing without:', error instanceof Error ? error.message : error);
  }

  // --- Swarm Agent: AI Competitor Candidate Generation ---
  if (siteProfile) {
    try {
      const existingDomains = new Set(discoveredCompetitors.map((c) => c.domain));
      const aiGenerated = await runCompetitorGenerationAgent({
        siteProfile: {
          businessName: siteProfile.businessName,
          businessType: siteProfile.businessType,
          primaryServices: siteProfile.primaryServices,
          serviceArea: siteProfile.serviceArea,
          niche: siteProfile.niche,
          city: siteProfile.city,
          state: siteProfile.state,
          country: siteProfile.country,
        },
        market: params.input.market,
        language: params.input.language,
        existingCompetitorDomains: [...existingDomains],
      });
      console.info(`[swarm] AI competitor generation: ${aiGenerated.competitors.length} candidates (strategy: ${aiGenerated.searchStrategy})`);

      for (const gen of aiGenerated.competitors) {
        if (gen.confidence >= 0.4 && !existingDomains.has(gen.domain)) {
          discoveredCompetitors.push({
            name: gen.name,
            url: gen.url,
            domain: gen.domain,
            snippet: gen.reasoning,
            confidence: Math.round(gen.confidence * 100),
            sources: ['ai-generation'],
          });
          existingDomains.add(gen.domain);
        }
      }
    } catch (error) {
      console.warn('[swarm] AI competitor generation failed (non-fatal):', error instanceof Error ? error.message : error);
    }
  }

  // --- Swarm Agent: Competitor Validation ---
  let validationResult: Awaited<ReturnType<typeof runCompetitorValidationAgent>> | null = null;
  if (siteProfile && discoveredCompetitors.length > 0) {
    try {
      validationResult = await runCompetitorValidationAgent({
        siteProfile: {
          businessName: siteProfile.businessName,
          businessType: siteProfile.businessType,
          primaryServices: siteProfile.primaryServices,
          serviceArea: siteProfile.serviceArea,
          niche: siteProfile.niche,
        },
        candidates: discoveredCompetitors.map((c) => ({
          url: c.url,
          domain: c.domain,
          name: c.name,
          snippet: c.snippet,
        })),
      });
      console.info('[swarm] Competitor validation:', validationResult.overallQuality, `(${validationResult.validatedCompetitors.filter((v) => v.isRelevant).length} relevant)`);

      // --- Swarm Agent: SERP Intent Similarity ---
      try {
        const relevantCompetitors = validationResult.validatedCompetitors.filter((v) => v.isRelevant);
        if (relevantCompetitors.length > 0) {
          const serpAnalysis = await runSerpIntentAgent({
            targetBusiness: {
              businessName: siteProfile.businessName,
              businessType: siteProfile.businessType,
              primaryServices: siteProfile.primaryServices,
              serviceArea: siteProfile.serviceArea,
              niche: siteProfile.niche,
            },
            competitors: relevantCompetitors.map((v) => {
              const matched = discoveredCompetitors.find((c) => c.domain === v.domain || c.url === v.url);
              return { url: v.url, domain: v.domain, name: matched?.name || v.domain, snippet: matched?.snippet };
            }),
            market: params.input.market,
            language: params.input.language,
          });
          console.info(`[swarm] SERP intent analysis: ${serpAnalysis.topKeywordThemes.length} contested themes`);

          // Boost confidence of competitors with high search intent overlap
          for (const scored of serpAnalysis.scoredCompetitors) {
            const match = validationResult.validatedCompetitors.find((v) => v.domain === scored.domain || v.url === scored.url);
            if (match && scored.intentOverlapScore > 0.6) {
              match.confidence = Math.min(1, match.confidence + 0.1);
            }
          }
        }
      } catch (error) {
        console.warn('[swarm] SERP intent agent failed (non-fatal):', error instanceof Error ? error.message : error);
      }

      // --- Swarm Agent: Judge / Quality Control ---
      let shouldRetryDiscovery = false;
      try {
        const judgment = await runJudgeAgent({
          siteProfile: {
            businessName: siteProfile.businessName,
            businessType: siteProfile.businessType,
            niche: siteProfile.niche,
            serviceArea: siteProfile.serviceArea,
          },
          competitors: validationResult.validatedCompetitors.map((v) => ({
            url: v.url,
            confidence: v.confidence,
            isRelevant: v.isRelevant,
          })),
          totalCandidatesBeforeFiltering: discoveredCompetitors.length,
        });
        console.info('[swarm] Judge verdict:', judgment.competitorQuality, `score=${judgment.overallScore}/10, passesGate=${judgment.passesQualityGate}`);
        shouldRetryDiscovery = judgment.shouldRetry === true && !judgment.passesQualityGate;
      } catch (error) {
        console.warn('[swarm] Judge agent failed (non-fatal):', error instanceof Error ? error.message : error);
      }

      // --- Retry: broader discovery when judge says quality is poor ---
      if (shouldRetryDiscovery) {
        console.info('[swarm] Judge triggered retry — running broader fallback discovery');
        try {
          const fallbackQueries = [
            ...siteUnderstanding.offerings.map((o) => `best ${o} ${params.input.market}`),
            ...siteUnderstanding.offerings.map((o) => `${o} companies near me`),
            `${siteProfile.businessType} ${params.input.market}`,
            `${siteProfile.niche} companies ${siteProfile.serviceArea || params.input.market}`,
          ].slice(0, 6);

          const retryResults = await discoverCompetitors({
            homepageUrl: params.input.homepageUrl,
            language: params.input.language,
            market: params.input.market,
            suggestedQueries: fallbackQueries,
          }).then((r) => r.candidates).catch(() => [] as CompetitorCandidate[]);

          if (retryResults.length > 0) {
            console.info(`[swarm] Fallback discovery found ${retryResults.length} additional candidates`);
            discoveredCompetitors.push(...retryResults);

            // Re-run validation on new candidates
            const newValidation = await runCompetitorValidationAgent({
              siteProfile: {
                businessName: siteProfile.businessName,
                businessType: siteProfile.businessType,
                primaryServices: siteProfile.primaryServices,
                serviceArea: siteProfile.serviceArea,
                niche: siteProfile.niche,
              },
              candidates: retryResults.map((c) => ({
                url: c.url,
                domain: c.domain,
                name: c.name,
                snippet: c.snippet,
              })),
            });

            // Merge new validated results
            const existingUrls = new Set(validationResult.validatedCompetitors.map((v) => v.url));
            for (const v of newValidation.validatedCompetitors) {
              if (!existingUrls.has(v.url)) {
                validationResult.validatedCompetitors.push(v);
              }
            }
          }
        } catch (retryError) {
          console.warn('[swarm] Retry discovery failed (non-fatal):', retryError instanceof Error ? retryError.message : retryError);
        }
      }
    } catch (error) {
      console.warn('[swarm] Competitor validation agent failed, continuing with unvalidated results:', error instanceof Error ? error.message : error);
    }
  }

  // Filter competitor URLs: prefer validated relevant ones, fall back to unvalidated
  const filteredCompetitorUrls = validationResult
    ? dedupeStrings([
        ...manualCompetitorUrls,
        ...validationResult.validatedCompetitors
          .filter((v) => v.isRelevant && v.confidence >= 0.3)
          .map((v) => v.url),
      ]).slice(0, 10)
    : competitorUrls;

  const concurrency = pLimit(4);
  const competitorPageEvidence = (
    await Promise.all(filteredCompetitorUrls.map((url) => concurrency(() => fetchPageSnapshot(url))))
  ).filter(keepPageSnapshot);

  const competitorIntelligence = normalizeCompetitorIntelligence(
    await resolveWithAiFallback({
      stage: 'competitors',
      aiState: params.aiState,
      task: () =>
        buildCompetitorIntelligence({
          input: params.input,
          siteUnderstanding,
          competitorPageEvidence,
          autoCompetitorCandidates: discoveredCompetitors,
        }),
      fallback: () =>
        buildCompetitorIntelligenceFallback({
          input: params.input,
          siteUnderstanding,
          competitorPageEvidence,
          autoCompetitorCandidates: discoveredCompetitors,
        }),
      onFallback: handleCompetitorFallback ? (_stage, error) => handleCompetitorFallback(error) : undefined,
    }),
  );

  return {
    siteUnderstanding,
    discoveredCompetitors,
    suggestedCompetitors: mergeSuggestedCompetitors({
      autoCompetitorCandidates: discoveredCompetitors,
      competitorIntelligence,
    }),
    competitorUrls: filteredCompetitorUrls,
    competitorPageEvidence,
    competitorIntelligence,
    siteProfile,
    validationResult,
  };
}

async function generatePillars(params: {
  input: ResearchInputSnapshot;
  siteUnderstanding: SiteUnderstanding;
  competitorIntelligence: CompetitorIntelligence;
  existingTopics: string[];
  desiredCount: number;
  modelTier?: 'opus' | 'sonnet' | 'haiku' | 'openai-fast' | 'openai-mini';
}): Promise<z.output<typeof pillarSchema>> {
  const response = await callAiJson({
    schema: pillarSchema,
    system:
      'You design pillar-and-cluster SEO architectures. Output only genuinely relevant new pillar opportunities tied to the real business. Avoid covered topics, duplicates, and cannibalization.',
    prompt: JSON.stringify({
      task: `Generate ${params.desiredCount} new pillar opportunities.`,
      language: params.input.language,
      market: params.input.market,
      brandName: params.input.brandName,
      mode: params.input.mode,
      existingResearchSummary: params.input.existingResearchSummary,
      businessSummary: params.siteUnderstanding.businessSummary,
      offerings: params.siteUnderstanding.offerings,
      audiences: params.siteUnderstanding.audiences,
      painPoints: params.siteUnderstanding.painPoints,
      coveredTopics: params.siteUnderstanding.coveredTopics,
      excludedTopics: params.siteUnderstanding.excludedTopics,
      competitorThemes: params.competitorIntelligence.opportunityThemes,
      existingTopics: params.existingTopics.slice(0, 80),
      rules: [
        'Only propose pillars that do not already exist on the site.',
        'Each pillar must map to a meaningful content opportunity connected to offerings, use cases, audience needs, or problems solved.',
        'Each pillar needs a distinct primary keyword and intent.',
        'Avoid near-duplicate pillar ideas.',
        'Do not invent services or products that are not supported by the supplied business evidence.',
      ],
      outputContract: {
        pillars: [
          {
            title: 'Pillar title',
            intent: 'Informational | Commercial | Transactional | Navigational',
            primaryKeyword: 'clear primary keyword',
            supportingKeywords: ['3-8 supporting keywords'],
            rationale: 'why this pillar is relevant and non-overlapping',
          },
        ],
      },
    }),
    maxTokens: 5000,
    modelTier: params.modelTier ?? 'sonnet',
  });
  return pillarSchema.parse(response);
}

async function runSwarmClusterGeneration(params: {
  input: ResearchInputSnapshot;
  siteUnderstanding: SiteUnderstanding;
  existingTopics: string[];
  pillars: PillarCandidate[];
  desiredClustersPerPillar: number;
  maxParallel?: number;
}): Promise<Array<PillarCandidate & { clusters: ClusterCandidate[] }>> {
  const limit = pLimit(params.maxParallel ?? 3);
  const modelTier = selectModelForTask('medium');

  const swarmTasks = params.pillars.map((pillar) =>
    limit(async () => {
      const taskId = `cluster-${pillar.title.replace(/\s+/g, '-').slice(0, 20)}`;

      const agentResult = await callSwarmAgent({
        agentId: taskId,
        agentRole: 'Cluster Generation Agent',
        phaseLabel: 'Cluster Generation',
        taskLabel: `Generate ${params.desiredClustersPerPillar} clusters for pillar: ${pillar.title}`,
        input: {
          language: params.input.language,
          market: params.input.market,
          brandName: params.input.brandName,
          mode: params.input.mode,
          existingResearchSummary: params.input.existingResearchSummary,
          businessSummary: params.siteUnderstanding.businessSummary,
          offerings: params.siteUnderstanding.offerings,
          audiences: params.siteUnderstanding.audiences,
          existingTopics: params.existingTopics.slice(0, 80),
          pillar,
          siblingPillars: params.pillars.filter((p) => p.title !== pillar.title).map((p) => ({
            title: p.title,
            primaryKeyword: p.primaryKeyword,
          })),
          desiredCount: params.desiredClustersPerPillar + 2,
        },
        outputContract: {
          clusters: [
            {
              title: 'Cluster title',
              intent: 'Informational | Commercial | Transactional | Navigational',
              primaryKeyword: 'cluster primary keyword',
              supportingKeywords: ['3-8 supporting keywords'],
              rationale: 'why this cluster is distinct',
              searchVolume: 'estimated monthly search volume (integer) or null if unavailable',
              cpc: 'estimated cost-per-click in USD or null if unavailable',
            },
          ],
        },
        modelTier,
        maxTokens: 4500,
      });

      if (agentResult.status === 'error' || !agentResult.output) {
        const fallback = buildClusterCandidatesFallback({
          input: params.input,
          pillar,
          desiredCount: params.desiredClustersPerPillar + 2,
        });
        return {
          ...pillar,
          clusters: fallback.slice(0, params.desiredClustersPerPillar),
        } as PillarCandidate & { clusters: ClusterCandidate[] };
      }

      const rawClusters = (agentResult.output.clusters as ClusterCandidate[]) ?? [];
      const filteredClusters = rawClusters.filter(
        (cluster, index, all) =>
          !overlapWithExisting(cluster, params.existingTopics) &&
          jaccardSimilarity(cluster.primaryKeyword, pillar.primaryKeyword) < 0.85 &&
          all.findIndex((entry) => entry.title.toLowerCase() === cluster.title.toLowerCase()) === index,
      );

      return {
        ...pillar,
        clusters: filteredClusters.slice(0, params.desiredClustersPerPillar),
      } as PillarCandidate & { clusters: ClusterCandidate[] };
    }),
  );

  const results = await Promise.allSettled(swarmTasks);
  const pillarBundles: Array<PillarCandidate & { clusters: ClusterCandidate[] }> = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      pillarBundles.push(result.value);
    }
  }

  return pillarBundles;
}

function buildRows(params: {
  input: ResearchInputSnapshot;
  pillars: Array<PillarCandidate & { clusters: ClusterCandidate[] }>;
}) {
  const rows: ResearchRow[] = [];
  const siteBaseUrl = new URL('/', params.input.homepageUrl).toString();

  for (const pillar of params.pillars) {
    const slugPath = buildSlugPath(pillar.title, params.input.language);
    rows.push({
      existingParentPage: '-',
      existingParentPageUrl: null,
      pillar: pillar.title,
      cluster: pillar.title,
      intent: pillar.intent as ResearchIntent,
      primaryKeyword: pillar.primaryKeyword,
      keywords: ensureBrandFirst(params.input.brandName, pillar.supportingKeywords),
      rowType: 'pillar',
      slugPath,
      notes: [pillar.rationale],
    });

    for (const cluster of pillar.clusters) {
      rows.push({
        existingParentPage: slugPath,
        existingParentPageUrl: buildParentUrl(siteBaseUrl, slugPath),
        pillar: pillar.title,
        cluster: cluster.title,
        intent: cluster.intent as ResearchIntent,
        primaryKeyword: cluster.primaryKeyword,
        keywords: ensureBrandFirst(params.input.brandName, cluster.supportingKeywords),
        rowType: 'cluster',
        slugPath,
        notes: [cluster.rationale],
        searchVolume: cluster.searchVolume ?? null,
        cpc: cluster.cpc ?? null,
      });
    }
  }

  return rows;
}

export async function runResearchPipeline(params: {
  runId: string;
  input: ResearchInputSnapshot;
}) {
  const { runId, input } = params;
  const aiState: AiAvailabilityState = { enabled: true };

  await log(runId, 'crawl', 'Fetching sitemap and required pages');
  const {
    sitemapUrls,
    pageSnapshots,
    existingContentMap,
  } = await buildSiteEvidence(input);

  await log(runId, 'analysis', 'Understanding the business and existing coverage', {
    sitemapUrls: sitemapUrls.length,
    pageEvidence: pageSnapshots.length,
  });

  await log(runId, 'competitors', 'Discovering relevant competitors');
  const {
    siteUnderstanding,
    discoveredCompetitors,
    suggestedCompetitors,
    competitorUrls,
    competitorIntelligence,
  } = await analyzeCompetitiveLandscape({
    input,
    pageSnapshots,
    existingContentMap,
    aiState,
    onAiFallback: async (stage, error) => {
      await addResearchLog({
        runId,
        stage,
        level: 'warning',
        message: 'AI generation failed. Switching to deterministic research fallback.',
        metadata: {
          reason: error instanceof Error ? error.message : 'Unknown AI error',
        },
      });
    },
  });

  const desiredPillarCount = clamp(Math.round(input.targetRows / 14), 10, 15);
  const desiredClustersPerPillar = clamp(
    Math.ceil((input.targetRows - desiredPillarCount) / desiredPillarCount) + 1,
    10,
    15,
  );

  await log(runId, 'pillars', 'Generating pillar opportunities', {
    desiredPillarCount,
    desiredClustersPerPillar,
  });

  const existingTopics = dedupeStrings([
    ...existingContentMap.pages.map((page) => page.topicFingerprint),
    ...siteUnderstanding.coveredTopics,
    ...(input.existingResearchSummary?.pillars ?? []),
    ...(input.existingResearchSummary?.clusters ?? []),
    ...(input.existingResearchSummary?.primaryKeywords ?? []),
  ]);

  const pillarCandidates = (await resolveWithAiFallback({
    stage: 'pillars',
    aiState,
    task: () =>
      generatePillars({
        input,
        siteUnderstanding,
        competitorIntelligence,
        existingTopics,
        desiredCount: desiredPillarCount + 3,
        modelTier: 'sonnet',
      }),
    fallback: () => ({
      pillars: buildPillarCandidatesFallback({
        input,
        siteUnderstanding,
        competitorIntelligence,
        desiredCount: desiredPillarCount + 3,
      }),
    }),
    onFallback: async (stage, error) => {
      await addResearchLog({
        runId,
        stage,
        level: 'warning',
        message: 'AI generation failed. Switching to deterministic research fallback.',
        metadata: {
          reason: error instanceof Error ? error.message : 'Unknown AI error',
        },
      });
    },
  })).pillars.filter(
    (pillar, index, all) =>
      !overlapWithExisting(pillar, existingTopics) &&
      all.findIndex((entry) => entry.title.toLowerCase() === pillar.title.toLowerCase()) === index,
  );

  const pillars = pillarCandidates.slice(0, desiredPillarCount);
  if (!pillars.length) {
    throw new Error('No viable pillar candidates were generated after overlap filtering.');
  }

  const pillarBundles: Array<PillarCandidate & { clusters: ClusterCandidate[] }> = [];

  await log(runId, 'clusters', `Generating clusters for ${pillars.length} pillars using swarm orchestration`);
  const swarmBundles = await runSwarmClusterGeneration({
    input,
    siteUnderstanding,
    existingTopics,
    pillars,
    desiredClustersPerPillar: desiredClustersPerPillar,
    maxParallel: 3,
  });

  for (const bundle of swarmBundles) {
    pillarBundles.push(bundle);
  }

  if (!pillarBundles.length) {
    throw new Error('All cluster generation tasks failed.');
  }

  const rawRows = buildRows({
    input,
    pillars: pillarBundles,
  });

  await log(runId, 'metrics', 'Enriching keyword metrics from real data sources');

  const primaryKeywords = dedupeStrings(rawRows.map((row) => row.primaryKeyword));
  const metricsMap = await fetchBulkKeywordMetrics({
    keywords: primaryKeywords,
    language: input.language,
    market: input.market,
  });

  for (const row of rawRows) {
    const metrics = metricsMap.get(row.primaryKeyword);
    if (metrics) {
      row.searchVolume = metrics.searchVolume;
      row.cpc = metrics.cpc;
    }
  }

  await log(runId, 'qa', 'Validating and normalizing generated rows');
  const normalized = validateAndNormalizeRows(rawRows, input.brandName);
  if (normalized.issues.length) {
    await addResearchLog({
      runId,
      stage: 'qa',
      level: 'warning',
      message: 'Validation adjusted or flagged generated rows.',
      metadata: { issues: normalized.issues.slice(0, 20) },
    });
  }

  await log(runId, 'synthesis', 'Generating premium report synthesis');
  const synthesis = await synthesizeReport({
    input,
    rows: normalized.rows,
    pillarCount: pillarBundles.length,
    clusterCount: normalized.rows.filter((r) => r.rowType === 'cluster').length,
  });

  await log(runId, 'export', 'Building the Excel workbook');
  const workbookBuffer = await buildWorkbook({
    input,
    rows: normalized.rows,
  });

  const workbookCheck = await verifyWorkbookBuffer(workbookBuffer);
  const safeBrand = sanitizeFilenameSegment(input.brandName);
  const workbookName = `${safeBrand || 'research'}-${runId}.xlsx`;
  const reportPath = await writeManagedReport({
    buffer: workbookBuffer,
    preferredName: workbookName,
  });

  const resultSummary = {
    rowCount: normalized.rows.length,
    pillarCount: pillarBundles.length,
    clusterCount: normalized.rows.filter((row) => row.rowType === 'cluster').length,
    workbookCheck,
    qaIssues: normalized.issues,
    aiUsed: aiState.enabled,
    metricsApplied: true,
  };

  await attachWorkbookToRun(runId, {
    workbookPath: reportPath,
    workbookName,
    workbookMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    rows: JSON.stringify(normalized.rows),
    summary: JSON.stringify(resultSummary),
    siteSnapshot: JSON.stringify({
      sitemapUrlCount: sitemapUrls.length,
      pageEvidenceCount: pageSnapshots.length,
      siteUnderstanding,
      existingContentMap,
    }),
    competitorSnapshot: JSON.stringify({
      competitorUrls,
      discoveredCompetitors,
      suggestedCompetitors,
      competitorIntelligence,
    }),
    synthesisSnapshot: JSON.stringify(synthesis),
  });

  await addResearchLog({
    runId,
    stage: 'completed',
    level: 'info',
    message: 'Workbook verified and stored successfully.',
    metadata: {
      workbookName,
      rowCount: normalized.rows.length,
    },
  });
}
