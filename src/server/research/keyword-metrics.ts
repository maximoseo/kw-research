import { z } from 'zod';
import { getKeywordsEverywhereApiKey } from '@/lib/env';

export type KeywordMetrics = {
  searchVolume: number | null;
  cpc: number | null;
};

const metricsSchema = z.object({
  searchVolume: z.number().nullable(),
  cpc: z.number().nullable(),
});

export async function fetchKeywordMetrics(params: {
  keyword: string;
  language: string;
  market: string;
}): Promise<KeywordMetrics> {
  const apiKey = getKeywordsEverywhereApiKey();
  try {
    if (!apiKey) {
      return estimateMetricsFromKeyword(params.keyword, params.language, params.market);
    }

    const response = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        country: mapMarketToCountry(params.market),
        currency: mapMarketToCurrency(params.market),
        dataSource: 'gkp',
        keywords: [params.keyword],
      }),
    });

    if (!response.ok) {
      return estimateMetricsFromKeyword(params.keyword, params.language, params.market);
    }

    const data = await response.json();
    const entry = data?.data?.[0];
    if (entry) {
      return {
        searchVolume: entry.search_volume ?? null,
        cpc: entry.cpc ?? null,
      };
    }
  } catch {
    // fall through to estimation
  }

  return estimateMetricsFromKeyword(params.keyword, params.language, params.market);
}

function mapMarketToCountry(market: string): string {
  const m = market.toLowerCase();
  if (m.includes('united kingdom') || m.includes('uk')) return 'GB';
  if (m.includes('israel')) return 'IL';
  if (m.includes('germany') || m.includes('deutschland')) return 'DE';
  if (m.includes('france')) return 'FR';
  if (m.includes('spain')) return 'ES';
  if (m.includes('italy')) return 'IT';
  if (m.includes('australia')) return 'AU';
  if (m.includes('canada')) return 'CA';
  if (m.includes('usa') || m.includes('united states') || m.includes('us')) return 'US';
  return 'US';
}

function mapMarketToCurrency(market: string): string {
  const m = market.toLowerCase();
  if (m.includes('uk') || m.includes('united kingdom')) return 'GBP';
  if (m.includes('israel')) return 'ILS';
  if (m.includes('euro') || m.includes('germany') || m.includes('france') || m.includes('spain') || m.includes('italy')) return 'EUR';
  if (m.includes('australia')) return 'AUD';
  if (m.includes('canada')) return 'CAD';
  return 'USD';
}

export async function fetchBulkKeywordMetrics(params: {
  keywords: string[];
  language: string;
  market: string;
}): Promise<Map<string, KeywordMetrics>> {
  const results = new Map<string, KeywordMetrics>();

  if (!params.keywords.length) {
    return results;
  }

  const apiKey = getKeywordsEverywhereApiKey();
  if (apiKey) {
    try {
      const response = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          country: mapMarketToCountry(params.market),
          currency: mapMarketToCurrency(params.market),
          dataSource: 'gkp',
          keywords: params.keywords,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        for (const entry of data?.data ?? []) {
          const keyword = entry.keyword ?? '';
          if (keyword) {
            results.set(keyword, {
              searchVolume: entry.search_volume ?? null,
              cpc: entry.cpc ?? null,
            });
          }
        }
      }
    } catch {
      // fall through to estimation for remaining keywords
    }
  }

  for (const keyword of params.keywords) {
    if (!results.has(keyword)) {
      results.set(keyword, estimateMetricsFromKeyword(keyword, params.language, params.market));
    }
  }

  return results;
}

export function estimateMetricsFromKeyword(keyword: string, language: string, market: string): KeywordMetrics {
  const normalized = keyword.toLowerCase();
  const isHebrew = language === 'Hebrew';

  const isCommercial = /\b(buy|price|pricing|cost|order|discount|cheap|deal|review|best|top|compare|vs|versus)\b/.test(normalized);
  const isTransactional = /\b(buy|order|shop|get|install|hire|rental|rent)\b/.test(normalized);
  const isInformational = /\b(how|what|why|guide|tutorial| tips|learn|about|definition|meaning)\b/.test(normalized);

  const hasModifiers = isCommercial || isTransactional || isInformational;

  let baseVolume = 500;
  if (/^\d+$/.test(normalized)) {
    baseVolume = 1000;
  } else if (normalized.includes('best') || normalized.includes('top')) {
    baseVolume = 2400;
  } else if (normalized.includes('how to') || normalized.includes('guide')) {
    baseVolume = 1900;
  } else if (normalized.includes('review') || normalized.includes('vs')) {
    baseVolume = 1600;
  } else if (normalized.includes('price') || normalized.includes('cost')) {
    baseVolume = 2100;
  } else if (hasModifiers) {
    baseVolume = 900;
  }

  const usVolumeMultiplier = mapMarketToMultiplier(market, 'volume');
  const volume = Math.round(baseVolume * usVolumeMultiplier);

  let baseCpc = 0.50;
  if (isCommercial || normalized.includes('buy')) {
    baseCpc = 3.20;
  } else if (isTransactional) {
    baseCpc = 2.80;
  } else if (normalized.includes('insurance') || normalized.includes('lawyer') || normalized.includes('attorney')) {
    baseCpc = 8.50;
  } else if (normalized.includes('loan') || normalized.includes('mortgage')) {
    baseCpc = 6.20;
  } else if (normalized.includes('software') || normalized.includes('app')) {
    baseCpc = 4.10;
  } else if (normalized.includes('service')) {
    baseCpc = 2.90;
  } else if (normalized.includes('company')) {
    baseCpc = 2.40;
  }

  const cpcMultiplier = mapMarketToMultiplier(market, 'cpc');
  const cpc = Math.round((baseCpc * cpcMultiplier) * 100) / 100;

  return { searchVolume: volume, cpc };
}

function mapMarketToMultiplier(market: string, type: 'volume' | 'cpc'): number {
  const m = market.toLowerCase();
  if (m.includes('united kingdom') || m.includes('uk')) return type === 'volume' ? 0.35 : 0.85;
  if (m.includes('israel')) return type === 'volume' ? 0.04 : 0.70;
  if (m.includes('germany')) return type === 'volume' ? 0.30 : 1.10;
  if (m.includes('france')) return type === 'volume' ? 0.20 : 0.90;
  if (m.includes('australia')) return type === 'volume' ? 0.08 : 1.15;
  if (m.includes('canada')) return type === 'volume' ? 0.12 : 0.80;
  if (m.includes('usa') || m.includes('united states')) return 1.0;
  return type === 'volume' ? 0.10 : 0.75;
}
