import pLimit from 'p-limit';
import { z } from 'zod';
import type { ResearchInputSnapshot, ResearchIntent, ResearchRow, SiteLanguage } from '@/lib/research';
import { sanitizeFilenameSegment } from '@/lib/utils';
import { writeManagedReport } from '@/server/files/storage';
import { getCrawlLimits } from '@/lib/env';
import { callAiJson } from './ai';
import { discoverCompetitors } from './competitors';
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
      }),
    )
    .min(1),
});

type SiteUnderstanding = z.infer<typeof siteUnderstandingSchema>;
type CompetitorIntelligence = z.infer<typeof competitorIntelligenceSchema>;
type PillarCandidate = z.infer<typeof pillarSchema>['pillars'][number];
type ClusterCandidate = z.infer<typeof clusterSchema>['clusters'][number];
type AiAvailabilityState = { enabled: boolean };

function clip(value: string, limit: number) {
  return value.length <= limit ? value : `${value.slice(0, limit)}...`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
  });
  return competitorIntelligenceSchema.parse(response);
}

async function generatePillars(params: {
  input: ResearchInputSnapshot;
  siteUnderstanding: SiteUnderstanding;
  competitorIntelligence: CompetitorIntelligence;
  existingTopics: string[];
  desiredCount: number;
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
  });
  return pillarSchema.parse(response);
}

async function generateClusters(params: {
  input: ResearchInputSnapshot;
  siteUnderstanding: SiteUnderstanding;
  existingTopics: string[];
  pillar: PillarCandidate;
  siblingPillars: PillarCandidate[];
  desiredCount: number;
}): Promise<z.output<typeof clusterSchema>> {
  const response = await callAiJson({
    schema: clusterSchema,
    system:
      'You design non-overlapping SEO clusters. Each cluster must have a unique angle, distinct primary keyword, and supporting keywords that do not mirror the parent pillar or sibling clusters too closely.',
    prompt: JSON.stringify({
      task: `Generate ${params.desiredCount} clusters for the supplied pillar.`,
      language: params.input.language,
      market: params.input.market,
      brandName: params.input.brandName,
      mode: params.input.mode,
      existingResearchSummary: params.input.existingResearchSummary,
      businessSummary: params.siteUnderstanding.businessSummary,
      offerings: params.siteUnderstanding.offerings,
      audiences: params.siteUnderstanding.audiences,
      existingTopics: params.existingTopics.slice(0, 80),
      pillar: params.pillar,
      siblingPillars: params.siblingPillars.map((pillar) => ({
        title: pillar.title,
        primaryKeyword: pillar.primaryKeyword,
      })),
      rules: [
        'Clusters must be clearly subordinate to the parent pillar.',
        'Avoid repeating the pillar primary keyword set too closely.',
        'Avoid near-duplicate supporting keywords across siblings.',
        'Use real search phrasing that people would type.',
        'Do not propose content already clearly covered on the existing site or in the uploaded research.',
      ],
      outputContract: {
        clusters: [
          {
            title: 'Cluster title',
            intent: 'Informational | Commercial | Transactional | Navigational',
            primaryKeyword: 'cluster primary keyword',
            supportingKeywords: ['3-8 supporting keywords'],
            rationale: 'why this cluster is distinct',
          },
        ],
      },
    }),
    maxTokens: 4500,
  });
  return clusterSchema.parse(response);
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
  const crawlLimits = getCrawlLimits();
  const concurrency = pLimit(4);
  const aiState: AiAvailabilityState = { enabled: true };

  const resolveWithAiFallback = async <T>(stage: string, task: () => Promise<T>, fallback: () => T) => {
    if (!aiState.enabled) {
      return fallback();
    }

    try {
      return await task();
    } catch (error) {
      aiState.enabled = false;
      await addResearchLog({
        runId,
        stage,
        level: 'warning',
        message: 'AI generation failed. Switching to deterministic research fallback.',
        metadata: {
          reason: error instanceof Error ? error.message : 'Unknown AI error',
        },
      });
      return fallback();
    }
  };

  await log(runId, 'crawl', 'Fetching sitemap and required pages');
  const sitemapUrls = await fetchSitemapUrls(input.sitemapUrl);
  const baseEvidenceUrls = dedupeStrings([input.homepageUrl, input.aboutUrl, ...sitemapUrls]).slice(
    0,
    crawlLimits.maxPageFetches,
  );

  const pageSnapshots = (
    await Promise.all(baseEvidenceUrls.map((url) => concurrency(() => fetchPageSnapshot(url))))
  ).filter(keepPageSnapshot);
  const existingContentMap = buildExistingContentMap(sitemapUrls, pageSnapshots);

  await log(runId, 'analysis', 'Understanding the business and existing coverage', {
    sitemapUrls: sitemapUrls.length,
    pageEvidence: pageSnapshots.length,
  });
  const siteUnderstanding = normalizeSiteUnderstanding(
    await resolveWithAiFallback(
      'analysis',
      () => buildSiteUnderstanding(input, pageSnapshots, existingContentMap),
      () => buildSiteUnderstandingFallback({ input, pageSnapshots, existingContentMap }),
    ),
  );

  await log(runId, 'competitors', 'Discovering relevant competitors');
  const discoveredCompetitors = await discoverCompetitors({
    homepageUrl: input.homepageUrl,
    language: input.language,
    market: input.market,
    suggestedQueries:
      input.competitorUrls.length > 0
        ? []
        : siteUnderstanding.competitorQueries.length > 0
          ? siteUnderstanding.competitorQueries
          : siteUnderstanding.offerings.map((offering) => `${offering} ${input.market}`),
  }).catch(() => []);

  const competitorUrls = dedupeStrings([
    ...input.competitorUrls,
    ...discoveredCompetitors.map((entry) => entry.url),
  ]).slice(0, 5);

  const competitorPageEvidence = (
    await Promise.all(competitorUrls.map((url) => concurrency(() => fetchPageSnapshot(url))))
  ).filter(keepPageSnapshot);
  const competitorIntelligence = normalizeCompetitorIntelligence(
    await resolveWithAiFallback(
      'competitors',
      () =>
        buildCompetitorIntelligence({
          input,
          siteUnderstanding,
          competitorPageEvidence,
          autoCompetitorCandidates: discoveredCompetitors,
        }),
      () =>
        buildCompetitorIntelligenceFallback({
          input,
          siteUnderstanding,
          competitorPageEvidence,
          autoCompetitorCandidates: discoveredCompetitors,
        }),
    ),
  );

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

  const pillarCandidates = (await resolveWithAiFallback(
    'pillars',
    () =>
      generatePillars({
        input,
        siteUnderstanding,
        competitorIntelligence,
        existingTopics,
        desiredCount: desiredPillarCount + 3,
      }),
    () => ({
      pillars: buildPillarCandidatesFallback({
        input,
        siteUnderstanding,
        competitorIntelligence,
        desiredCount: desiredPillarCount + 3,
      }),
    }),
  )).pillars.filter(
    (pillar, index, all) =>
      !overlapWithExisting(pillar, existingTopics) &&
      all.findIndex((entry) => entry.title.toLowerCase() === pillar.title.toLowerCase()) === index,
  );

  const pillars = pillarCandidates.slice(0, desiredPillarCount);
  if (!pillars.length) {
    throw new Error('No viable pillar candidates were generated after overlap filtering.');
  }

  const pillarBundles: Array<PillarCandidate & { clusters: ClusterCandidate[] }> = [];

  for (const pillar of pillars) {
    await log(runId, 'clusters', `Generating clusters for ${pillar.title}`);
    const generated = await resolveWithAiFallback(
      'clusters',
      () =>
        generateClusters({
          input,
          siteUnderstanding,
          existingTopics,
          pillar,
          siblingPillars: pillars.filter((entry) => entry.title !== pillar.title),
          desiredCount: desiredClustersPerPillar + 2,
        }),
      () => ({
        clusters: buildClusterCandidatesFallback({
          input,
          pillar,
          desiredCount: desiredClustersPerPillar + 2,
        }),
      }),
    );

    const filteredClusters = generated.clusters.filter(
      (cluster, index, all) =>
        !overlapWithExisting(cluster, existingTopics) &&
        jaccardSimilarity(cluster.primaryKeyword, pillar.primaryKeyword) < 0.85 &&
        all.findIndex((entry) => entry.title.toLowerCase() === cluster.title.toLowerCase()) === index,
    );

    pillarBundles.push({
      ...pillar,
      clusters: filteredClusters.slice(0, desiredClustersPerPillar),
    });
  }

  const rawRows = buildRows({
    input,
    pillars: pillarBundles,
  });

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
      competitorIntelligence,
    }),
  });
}
