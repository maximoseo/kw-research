'use strict';

import { z } from 'zod';
import type { ResearchInputSnapshot, ResearchRow, ResearchIntent } from '@/lib/research';
import { callAiJson } from '../ai';

type IntentCount = {
  informational: number;
  commercial: number;
  transactional: number;
  navigational: number;
};

type Priority = 'high' | 'medium' | 'low';

type TopOpportunity = {
  keyword: string;
  rationale: string;
  recommendedIntent: string;
  priority: Priority;
};

const topOpportunitySchema: z.ZodType<TopOpportunity> = z.object({
  keyword: z.string(),
  rationale: z.string(),
  recommendedIntent: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
});

const reportSynthesisSchema = z.object({
  executiveSummary: z.object({
    title: z.string(),
    subtitle: z.string(),
    brandName: z.string(),
    language: z.string(),
    market: z.string(),
    generatedAt: z.string(),
    totalRows: z.number(),
    pillarCount: z.number(),
    clusterCount: z.number(),
  }),
  researchQuality: z.object({
    confidence: z.enum(['high', 'medium', 'low']),
    methodology: z.string(),
    dataSources: z.array(z.string()),
    limitations: z.array(z.string()),
  }),
  contentStrategy: z.object({
    topOpportunities: z.array(topOpportunitySchema),
    contentGaps: z.array(z.string()),
    competitivePositioning: z.string(),
    recommendedApproach: z.string(),
  }),
  metricsAnalysis: z.object({
    totalMonthlyVolume: z.number(),
    avgCpc: z.number(),
    highestVolumeKeyword: z.string().nullable(),
    highestCpcKeyword: z.string().nullable(),
    volumeDistribution: z.object({ high: z.number(), medium: z.number(), low: z.number() }),
    cpcDistribution: z.object({ high: z.number(), medium: z.number(), low: z.number() }),
  }),
  mainKeywordsTable: z.array(z.object({
    keyword: z.string(),
    searchVolume: z.number().nullable(),
    cpc: z.number().nullable(),
    intent: z.string(),
    pillar: z.string(),
    cluster: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })),
  intentDistribution: z.object({
    informational: z.number(),
    commercial: z.number(),
    transactional: z.number(),
    navigational: z.number(),
  }),
  keyInsights: z.array(z.string()),
  recommendedNextSteps: z.array(z.string()),
});

export type ReportSynthesis = z.infer<typeof reportSynthesisSchema>;

function computeMetrics(rows: ResearchRow[]) {
  const validVolumes: number[] = [];
  const validCpcs: number[] = [];
  for (const row of rows) {
    if (row.searchVolume != null && row.searchVolume > 0) {
      validVolumes.push(row.searchVolume);
    }
    if (row.cpc != null && row.cpc > 0) {
      validCpcs.push(row.cpc);
    }
  }

  const totalMonthlyVolume = validVolumes.reduce((s, v) => s + v, 0);
  const avgCpc =
    validCpcs.length > 0
      ? Math.round((validCpcs.reduce((s, c) => s + c, 0) / validCpcs.length) * 100) / 100
      : 0;

  const volumeSorted = [...validVolumes].sort((a, b) => b - a);
  const cpcSorted = [...validCpcs].sort((a, b) => b - a);

  const highVol = volumeSorted.filter((v) => v > 1000).length;
  const medVol = volumeSorted.filter((v) => v >= 100 && v <= 1000).length;
  const lowVol = volumeSorted.filter((v) => v < 100).length;

  const highCpc = cpcSorted.filter((v) => v > 3).length;
  const medCpc = cpcSorted.filter((v) => v >= 1 && v <= 3).length;
  const lowCpc = cpcSorted.filter((v) => v < 1).length;

  const intentCounts: IntentCount = {
    informational: 0,
    commercial: 0,
    transactional: 0,
    navigational: 0,
  };
  for (const row of rows) {
    if (row.intent === 'Informational') intentCounts.informational++;
    else if (row.intent === 'Commercial') intentCounts.commercial++;
    else if (row.intent === 'Transactional') intentCounts.transactional++;
    else if (row.intent === 'Navigational') intentCounts.navigational++;
  }

  const volumeRanked: ResearchRow[] = [];
  for (const row of rows) {
    if (row.searchVolume != null && row.searchVolume > 0) {
      volumeRanked.push(row);
    }
  }
  volumeRanked.sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));

  const cpcRanked: ResearchRow[] = [];
  for (const row of rows) {
    if (row.cpc != null && row.cpc > 0) {
      cpcRanked.push(row);
    }
  }
  cpcRanked.sort((a, b) => (b.cpc ?? 0) - (a.cpc ?? 0));

  const topOpportunities: TopOpportunity[] = volumeRanked.slice(0, 10).map((r) => ({
    keyword: r.primaryKeyword,
    rationale: `High volume keyword with ${(r.searchVolume ?? 0).toLocaleString()} monthly searches`,
    recommendedIntent: r.intent as string,
    priority: (r.searchVolume ?? 0) > 1000 ? 'high' : ('medium' as Priority),
  }));

  const mainKeywordsTable = rows.slice(0, 30).map((r) => ({
    keyword: r.primaryKeyword,
    searchVolume: r.searchVolume ?? null,
    cpc: r.cpc ?? null,
    intent: r.intent as string,
    pillar: r.pillar,
    cluster: r.cluster,
    priority: (r.searchVolume ?? 0) > 1000 ? 'high' : (r.searchVolume ?? 0) > 100 ? 'medium' : 'low' as Priority,
  }));

  return {
    totalMonthlyVolume,
    avgCpc,
    intentCounts,
    volumeRanked,
    cpcRanked,
    topOpportunities,
    mainKeywordsTable,
    highVol,
    medVol,
    lowVol,
    highCpc,
    medCpc,
    lowCpc,
  };
}

export async function synthesizeReport(params: {
  input: ResearchInputSnapshot;
  rows: ResearchRow[];
  pillarCount: number;
  clusterCount: number;
}): Promise<ReportSynthesis> {
  const { input, rows, pillarCount: pc, clusterCount: cc } = params;
  const metrics = computeMetrics(rows);

  try {
    const aiAnalysis = await callAiJson({
      schema: reportSynthesisSchema,
      system:
        `You are the Report Synthesis Agent for a keyword research pipeline. Your role is to transform raw research data into a premium, professional-grade SEO deliverable. The research is for a ${input.language}-language site in the ${input.market} market. Write insights and recommendations in English (report language), but reference keywords and topics in their original ${input.language} form.`,
      prompt: JSON.stringify({
        task: `Generate a premium SEO research synthesis report for a ${input.language} site`,
        researchInput: {
          brandName: input.brandName,
          language: input.language,
          market: input.market,
          homepageUrl: input.homepageUrl,
          mode: input.mode,
          targetRows: input.targetRows,
        },
        summaryStats: {
          totalRows: rows.length,
          pillarCount: pc,
          clusterCount: cc,
          totalMonthlyVolume: metrics.totalMonthlyVolume,
          avgCpc: metrics.avgCpc,
          highestVolumeKeyword: metrics.volumeRanked[0]?.primaryKeyword ?? null,
          highestCpcKeyword: metrics.cpcRanked[0]?.primaryKeyword ?? null,
          volumeDistribution: {
            high: metrics.highVol,
            medium: metrics.medVol,
            low: metrics.lowVol,
          },
          cpcDistribution: {
            high: metrics.highCpc,
            medium: metrics.medCpc,
            low: metrics.lowCpc,
          },
          intentDistribution: metrics.intentCounts,
        },
        topKeywords: metrics.volumeRanked.slice(0, 20).map((r) => ({
          keyword: r.primaryKeyword,
          searchVolume: r.searchVolume,
          cpc: r.cpc,
          intent: r.intent,
          pillar: r.pillar,
          cluster: r.cluster,
        })),
        mainKeywordsTable: metrics.mainKeywordsTable.map((r) => ({
          keyword: r.keyword,
          searchVolume: r.searchVolume,
          cpc: r.cpc,
          intent: r.intent,
          pillar: r.pillar,
          cluster: r.cluster,
          priority: r.priority,
        })),
      }),
      modelTier: 'opus',
      maxTokens: 5000,
    });
    return reportSynthesisSchema.parse(aiAnalysis);
  } catch (err) {
    console.warn('[synthesis] AI report synthesis failed, using fallback:', err instanceof Error ? err.message : err);
    return buildFallbackSynthesis(input, rows, pc, cc, metrics);
  }
}

function buildFallbackSynthesis(
  input: ResearchInputSnapshot,
  rows: ResearchRow[],
  pillarCount: number,
  clusterCount: number,
  metrics: ReturnType<typeof computeMetrics>,
): ReportSynthesis {
  return {
    executiveSummary: {
      title: 'Keyword Research Report',
      subtitle: 'Strategic SEO Content Opportunities',
      brandName: input.brandName,
      language: input.language,
      market: input.market,
      generatedAt: new Date().toISOString(),
      totalRows: rows.length,
      pillarCount,
      clusterCount,
    },
    researchQuality: {
      confidence: 'medium',
      methodology:
        'AI-assisted keyword generation with fallback estimation. Real metrics from Keywords Everywhere API where available; estimated values derived from keyword pattern analysis.',
      dataSources: [
        'Website crawl and sitemap analysis',
        'AI-generated keyword opportunities',
        'Keywords Everywhere API (real metrics where available)',
        'Estimation models for pattern-matched keywords',
      ],
      limitations: [
        'Search volumes are estimates unless sourced from Keywords Everywhere API',
        'CPC values reflect US market averages; actual CPCs vary by geographic targeting',
        'AI-generated keywords may not capture all long-tail opportunities',
      ],
    },
    contentStrategy: {
      topOpportunities: metrics.topOpportunities,
      contentGaps: [
        'High-volume informational queries with low competition',
        'Commercial keywords targeting mid-funnel prospects',
        'Long-tail transactional queries for specific use cases',
      ],
      competitivePositioning: `Focus on ${input.market} market with ${input.language === 'Hebrew' ? 'Hebrew' : 'English'} language content. Prioritize topics where the site has clear topical authority.`,
      recommendedApproach:
        'Build pillar pages for top-volume keywords, then develop cluster content for supporting long-tail queries. Use informational content to capture early-funnel traffic while building toward commercial conversion pages.',
    },
    metricsAnalysis: {
      totalMonthlyVolume: metrics.totalMonthlyVolume,
      avgCpc: metrics.avgCpc,
      highestVolumeKeyword: metrics.volumeRanked[0]?.primaryKeyword ?? null,
      highestCpcKeyword: metrics.cpcRanked[0]?.primaryKeyword ?? null,
      volumeDistribution: {
        high: metrics.highVol,
        medium: metrics.medVol,
        low: metrics.lowVol,
      },
      cpcDistribution: {
        high: metrics.highCpc,
        medium: metrics.medCpc,
        low: metrics.lowCpc,
      },
    },
    mainKeywordsTable: metrics.mainKeywordsTable,
    intentDistribution: metrics.intentCounts,
    keyInsights: [
      `${metrics.intentCounts.commercial} commercial intent keywords identified — ideal for conversion-focused content`,
      `${metrics.intentCounts.informational} informational keywords provide top-of-funnel opportunities`,
      `Total addressable monthly search volume: ${metrics.totalMonthlyVolume.toLocaleString()} queries`,
      `Average CPC of $${metrics.avgCpc.toFixed(2)} indicates ${metrics.avgCpc > 2 ? 'high commercial value' : 'accessible competition level'}`,
      `${metrics.highVol} high-volume keywords (>1,000 monthly searches) offer immediate ranking opportunities`,
    ],
    recommendedNextSteps: [
      'Prioritize pillar page creation for top 5 high-volume keywords',
      'Develop cluster content supporting each pillar',
      'Audit existing site content against generated opportunity list',
      'Create content calendar based on keyword priority and search intent',
    ],
  };
}

export async function runSwarmPipeline(params: {
  input: ResearchInputSnapshot;
  rows: ResearchRow[];
  pillarCount: number;
  clusterCount: number;
}) {
  const synthesis = await synthesizeReport(params);
  return { synthesis };
}
