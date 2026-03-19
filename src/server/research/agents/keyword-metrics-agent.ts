'use strict';

import { z } from 'zod';
import type { ResearchInputSnapshot } from '@/lib/research';
import { callAiJson } from '../ai';
import type { ModelTier } from '../ai';
import { fetchBulkKeywordMetrics } from '../keyword-metrics';
import { dedupeStrings } from '../utils';

const keywordEnrichmentSchema = z.object({
  enrichedKeywords: z.array(
    z.object({
      keyword: z.string(),
      searchVolume: z.number().nullable(),
      cpc: z.number().nullable(),
      competition: z.enum(['low', 'medium', 'high']).nullable().optional(),
      confidence: z.enum(['high', 'medium', 'low']),
      opportunities: z.array(z.string()).default([]),
    }),
  ),
  summary: z.object({
    totalVolume: z.number(),
    avgCpc: z.number(),
    highValueKeywords: z.array(z.string()),
    emergingTopics: z.array(z.string()),
    budgetConsiderations: z.string(),
  }),
});

export type KeywordEnrichmentResult = z.infer<typeof keywordEnrichmentSchema>;

export async function enrichKeywordMetrics(params: {
  keywords: string[];
  input: ResearchInputSnapshot;
  modelTier?: ModelTier;
}): Promise<KeywordEnrichmentResult> {
  const primaryKeywords = dedupeStrings(params.keywords);
  const metricsMap = await fetchBulkKeywordMetrics({
    keywords: primaryKeywords,
    language: params.input.language,
    market: params.input.market,
  });

  const enrichedKeywords = primaryKeywords.map((keyword) => {
    const metrics = metricsMap.get(keyword);
    const searchVolume = metrics?.searchVolume ?? null;
    const cpc = metrics?.cpc ?? null;

    const opportunities: string[] = [];
    if (searchVolume && searchVolume > 1000) {
      opportunities.push('High volume keyword — strong organic potential');
    }
    if (cpc && cpc > 2.0) {
      opportunities.push('High commercial intent — valuable for paid strategies');
    }
    if (searchVolume && cpc && searchVolume > 500 && cpc < 1.0) {
      opportunities.push('Low competition opportunity — good for quick wins');
    }

    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (searchVolume && cpc) {
      confidence = searchVolume > 100 && cpc > 0 ? 'high' : 'medium';
    } else if (!searchVolume && !cpc) {
      confidence = 'low';
    }

    return {
      keyword,
      searchVolume,
      cpc,
      confidence,
      opportunities,
    };
  });

  const validVolumes = enrichedKeywords
    .map((k) => k.searchVolume)
    .filter((v): v is number => v !== null);
  const validCpcs = enrichedKeywords.map((k) => k.cpc).filter((v): v is number => v !== null);

  const totalVolume = validVolumes.reduce((sum, v) => sum + v, 0);
  const avgCpc = validCpcs.length
    ? Math.round((validCpcs.reduce((sum, c) => sum + c, 0) / validCpcs.length) * 100) / 100
    : 0;

  const highValueKeywords = enrichedKeywords
    .filter((k) => k.searchVolume && k.searchVolume > 1000)
    .map((k) => k.keyword);

  const emergingTopics: string[] = [];

  return {
    enrichedKeywords,
    summary: {
      totalVolume,
      avgCpc,
      highValueKeywords,
      emergingTopics,
      budgetConsiderations: `Estimated total monthly search volume: ${totalVolume.toLocaleString()}. Average CPC across keywords: $${avgCpc.toFixed(2)}.`,
    },
  };
}

export async function generateKeywordAnalysisWithAI(params: {
  keywords: string[];
  input: ResearchInputSnapshot;
  modelTier?: ModelTier;
}) {
  try {
    const response = await callAiJson({
      schema: keywordEnrichmentSchema,
      system: `You are a Keyword Intelligence Agent. Your role is to analyze keywords and provide strategic insights about their potential.

Analyze the supplied keywords and provide:
- Volume, CPC, and competition estimates
- High-value opportunities
- Strategic groupings
- Budget considerations`,
      prompt: JSON.stringify({
        task: 'Analyze keyword strategic value and grouping',
        keywords: params.keywords.slice(0, 50),
        language: params.input.language,
        market: params.input.market,
        brandName: params.input.brandName,
        outputContract: keywordEnrichmentSchema.shape,
      }),
      modelTier: params.modelTier ?? 'sonnet',
      maxTokens: 3500,
    });
    return keywordEnrichmentSchema.parse(response);
  } catch {
    return enrichKeywordMetrics({ keywords: params.keywords, input: params.input });
  }
}
