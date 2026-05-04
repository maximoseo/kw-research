import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { callAiJson } from '@/server/research/ai';
import { db } from '@/server/db/client';
import { searchCache } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { createHash, randomUUID } from 'crypto';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

type TrendDirection = 'rising' | 'falling' | 'stable' | 'seasonal';

interface MonthlyDataPoint {
  month: string; // "YYYY-MM"
  volume: number;
}

interface VolumeTrend {
  keyword: string;
  monthlyData: MonthlyDataPoint[];
  trend: TrendDirection;
  changePercent: number;
  changePeriod: '3 months' | '6 months' | 'YoY';
  seasonality: string | null;
}

/* ─────────────────────────────────────────────
   Request schema
   ───────────────────────────────────────────── */

const trendRequestSchema = z.object({
  keywords: z.array(z.string().min(1).max(200)).min(1).max(10),
});

/* ─────────────────────────────────────────────
   AI response schema
   ───────────────────────────────────────────── */

const trendResponseSchema = z.object({
  trends: z.array(
    z.object({
      keyword: z.string(),
      monthlyData: z.array(
        z.object({
          month: z.string(),
          volume: z.number(),
        }),
      ),
      trend: z.enum(['rising', 'falling', 'stable', 'seasonal']),
      changePercent: z.number(),
      changePeriod: z.enum(['3 months', '6 months', 'YoY']),
      seasonality: z.string().nullable(),
    }),
  ),
});

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function generateMonthLabels(count: number, endDate?: Date): string[] {
  const now = endDate ?? new Date();
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    labels.push(`${y}-${m}`);
  }
  return labels;
}

function detectTrendDirection(data: number[]): TrendDirection {
  if (data.length < 6) return 'stable';

  const firstHalf = data.slice(0, Math.ceil(data.length / 3));
  const lastHalf = data.slice(-Math.ceil(data.length / 3));

  const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / (firstHalf.length || 1);
  const lastAvg = lastHalf.reduce((s, v) => s + v, 0) / (lastHalf.length || 1);

  if (firstAvg === 0 && lastAvg === 0) return 'stable';

  const pctChange = firstAvg === 0 ? lastAvg * 100 : ((lastAvg - firstAvg) / firstAvg) * 100;

  // Check for seasonal pattern: alternating peaks and valleys
  const hasSeasonalPattern = data.length >= 12 && checkSeasonalPattern(data);

  if (hasSeasonalPattern) return 'seasonal';
  if (pctChange > 15) return 'rising';
  if (pctChange < -15) return 'falling';
  return 'stable';
}

function checkSeasonalPattern(data: number[]): boolean {
  if (data.length < 12) return false;

  // Check if there are at least 2 peaks in the data that are >30% above baseline
  const avg = data.reduce((s, v) => s + v, 0) / data.length;
  let peaks = 0;
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > avg * 1.3) {
      peaks++;
    }
  }
  return peaks >= 2;
}

function describeSeasonality(data: number[], monthLabels: string[]): string | null {
  if (data.length < 12) return null;

  // Find peak months
  const avg = data.reduce((s, v) => s + v, 0) / data.length;
  const threshold = avg * 1.25;

  const peakIndices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= threshold) {
      peakIndices.push(i);
    }
  }

  if (peakIndices.length === 0) return null;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const peakMonths = [...new Set(peakIndices.map((i) => monthLabels[i]?.split('-')[1]).filter(Boolean).map((m) => monthNames[parseInt(m, 10) - 1] ?? m))];

  if (peakMonths.length > 0) {
    return `Peaks in ${peakMonths.join('-')}`;
  }

  return null;
}

function computeChangeMetrics(data: number[]): { changePercent: number; changePeriod: '3 months' | '6 months' | 'YoY' } {
  const len = data.length;

  // Prefer YoY if we have 12+ months
  if (len >= 12) {
    const current = data[len - 1];
    const yearAgo = data[len - 12];
    if (yearAgo > 0) {
      const pct = Math.round(((current - yearAgo) / yearAgo) * 100);
      return { changePercent: pct, changePeriod: 'YoY' };
    }
  }

  // Fall back to 6-month change
  if (len >= 6) {
    const currentAvg = data.slice(-3).reduce((s, v) => s + v, 0) / 3;
    const pastAvg = data.slice(-6, -3).reduce((s, v) => s + v, 0) / 3;
    if (pastAvg > 0) {
      const pct = Math.round(((currentAvg - pastAvg) / pastAvg) * 100);
      return { changePercent: pct, changePeriod: '3 months' };
    }
  }

  // Fall back to basic trend
  const currentAvg = data.slice(-3).reduce((s, v) => s + v, 0) / 3;
  const pastAvg = data.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
  if (pastAvg > 0) {
    const pct = Math.round(((currentAvg - pastAvg) / pastAvg) * 100);
    return { changePercent: pct, changePeriod: '6 months' };
  }

  return { changePercent: 0, changePeriod: '3 months' };
}

function generateMockTrendData(
  keyword: string,
  volumeHint: number,
): { monthlyData: MonthlyDataPoint[]; trend: TrendDirection } {
  const months = generateMonthLabels(12);
  const kw = keyword.toLowerCase();

  // Infer seasonality from keyword text
  let seasonalPeakMonths: number[] | null = null;
  if (
    kw.includes('christmas') ||
    kw.includes('holiday') ||
    kw.includes('gift')
  ) {
    seasonalPeakMonths = [11, 12]; // Nov-Dec
  } else if (kw.includes('summer') || kw.includes('beach')) {
    seasonalPeakMonths = [6, 7, 8]; // Jun-Aug
  } else if (kw.includes('tax') || kw.includes('taxes')) {
    seasonalPeakMonths = [3, 4]; // Mar-Apr
  } else if (kw.includes('black friday') || kw.includes('cyber monday')) {
    seasonalPeakMonths = [11]; // Nov
  } else if (kw.includes('valentine')) {
    seasonalPeakMonths = [1, 2]; // Feb
  } else if (kw.includes('back to school')) {
    seasonalPeakMonths = [7, 8]; // Jul-Aug
  } else if (kw.includes('halloween') || kw.includes('costume')) {
    seasonalPeakMonths = [9, 10]; // Sep-Oct
  } else if (kw.includes('spring') || kw.includes('easter')) {
    seasonalPeakMonths = [3, 4, 5]; // Mar-May
  } else if (kw.includes('winter')) {
    seasonalPeakMonths = [12, 1, 2]; // Dec-Feb
  } else if (kw.includes('football') || kw.includes('super bowl')) {
    seasonalPeakMonths = [1, 2]; // Jan-Feb
  }

  // Determine trend direction
  const isTrending = kw.includes('ai') || kw.includes('2025') || kw.includes('2026') || kw.includes('tiktok');
  const isDeclining = kw.includes('flash') || kw.includes('blackberry') || kw.includes('myspace');
  const isSeasonal = seasonalPeakMonths !== null;

  const baseVolume = volumeHint > 0 ? volumeHint : Math.max(100, 100 + hashToNumber(kw) % 20000);

  const monthlyData: MonthlyDataPoint[] = months.map((month, i) => {
    let vol = baseVolume;

    // Apply seasonal pattern
    if (seasonalPeakMonths) {
      const monthNum = parseInt(month.split('-')[1], 10);
      if (seasonalPeakMonths.includes(monthNum)) {
        vol *= 1.5 + Math.random() * 0.8; // 1.5x to 2.3x
      } else if (
        seasonalPeakMonths.some((pm) => Math.abs(monthNum - pm) === 1)
      ) {
        vol *= 1.1 + Math.random() * 0.3; // slight shoulder
      }
    }

    // Apply trend
    if (isTrending) {
      const progress = i / (months.length - 1);
      vol *= 0.6 + progress * 1.4; // trending up 60% to 140%
    } else if (isDeclining) {
      const progress = i / (months.length - 1);
      vol *= 1.4 - progress * 0.8; // declining from 140% to 60%
    }

    // Random noise ±15%
    vol *= 0.85 + Math.random() * 0.3;

    return {
      month,
      volume: Math.max(10, Math.round(vol)),
    };
  });

  const trend = isSeasonal ? 'seasonal' : isTrending ? 'rising' : isDeclining ? 'falling' : 'stable';

  return { monthlyData, trend };
}

function hashToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/* ─────────────────────────────────────────────
   AI-based trend estimation
   ───────────────────────────────────────────── */

async function estimateTrendsWithAI(
  keywords: string[],
): Promise<VolumeTrend[]> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const prompt = keywords
    .map((k, i) => `${i + 1}. "${k}"`)
    .join('\n');

  const result = await callAiJson<z.infer<typeof trendResponseSchema>>({
    schema: trendResponseSchema,
    system: `You are an SEO analyst specializing in search volume trend estimation.

For each keyword, estimate 12 months of monthly search volume data ending with ${currentMonth}.

Guidelines:
- Base your estimates on real keyword seasonality patterns and market knowledge
- Consider the keyword type:
  * Seasonal (tax software, Christmas gifts, swimwear) → significant spikes in relevant months
  * Trending (AI tools, new technologies) → steady growth over the period
  * Evergreen (how to tie a tie, what is photosynthesis) → stable with minor fluctuations
  * Declining (old technology, discontinued products) → gradual decrease
  * Event-based (Super Bowl, Olympics) → sharp spike in event month
- For seasonal keywords, peak months should be 1.5x-3x baseline
- Include realistic month-to-month noise (±5-15%)
- "trend" should be one of: rising, falling, stable, seasonal
- "changePercent" is the % change over the specified period:
  * For 12-month data, prefer YoY (comparing latest month vs same month last year)
  * "changePeriod" should be "3 months", "6 months", or "YoY" depending on data range
- "seasonality" should describe the pattern (e.g., "Peaks in Nov-Dec") or null if not seasonal

Return valid JSON only — no prose before or after.`,
    prompt: `Estimate 12-month search volume trends for these keywords through ${currentMonth}:\n\n${prompt}`,
    modelTier: 'haiku',
    maxTokens: 8192,
  });

  return result.trends.map((t) => ({
    keyword: t.keyword,
    monthlyData: t.monthlyData,
    trend: t.trend,
    changePercent: t.changePercent,
    changePeriod: t.changePeriod,
    seasonality: t.seasonality,
  }));
}

/* ─────────────────────────────────────────────
   Cache helpers
   ───────────────────────────────────────────── */

const TREND_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function trendCacheKey(keyword: string): string {
  return createHash('md5')
    .update(`volume-trend:v1:${keyword.toLowerCase().trim()}`)
    .digest('hex');
}

async function getTrendCacheEntry(queryHash: string): Promise<VolumeTrend | null> {
  const row = await db
    .select({ results: searchCache.results, expiresAt: searchCache.expiresAt })
    .from(searchCache)
    .where(eq(searchCache.queryHash, queryHash))
    .get();

  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    await db.delete(searchCache).where(eq(searchCache.queryHash, queryHash));
    return null;
  }

  try {
    return JSON.parse(row.results);
  } catch {
    return null;
  }
}

async function setTrendCacheEntry(
  userId: string,
  queryHash: string,
  result: VolumeTrend,
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + TREND_CACHE_TTL_MS;

  const existing = await db
    .select({ id: searchCache.id })
    .from(searchCache)
    .where(eq(searchCache.queryHash, queryHash))
    .get();

  const payload = JSON.stringify(result);

  if (existing) {
    await db
      .update(searchCache)
      .set({ results: payload, expiresAt, createdAt: now })
      .where(eq(searchCache.id, existing.id));
  } else {
    await db.insert(searchCache).values({
      id: randomUUID(),
      userId,
      queryHash,
      results: payload,
      createdAt: now,
      expiresAt,
    });
  }
}

/* ─────────────────────────────────────────────
   POST handler
   ───────────────────────────────────────────── */

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = trendRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request. Provide keywords array (1-10 keyword strings).' },
        { status: 400 },
      );
    }

    const { keywords } = parsed.data;
    if (keywords.length === 0) {
      return NextResponse.json({ trends: [] });
    }

    const trends: VolumeTrend[] = [];
    const uncached: string[] = [];

    // Check cache first
    for (const kw of keywords) {
      const hash = trendCacheKey(kw);
      const cached = await getTrendCacheEntry(hash);
      if (cached) {
        trends.push(cached);
      } else {
        uncached.push(kw);
      }
    }

    // Process uncached keywords
    if (uncached.length > 0) {
      let aiResults: VolumeTrend[] = [];

      try {
        aiResults = await estimateTrendsWithAI(uncached);
      } catch (err) {
        console.warn('[volume-trends] AI estimation failed, using fallback:', err);
        // Fallback: generate reasonable mock data
        aiResults = uncached.map((kw) => {
          const { monthlyData, trend } = generateMockTrendData(kw, 1000);
          const metrics = computeChangeMetrics(monthlyData.map((d) => d.volume));
          const seasonality = describeSeasonality(
            monthlyData.map((d) => d.volume),
            monthlyData.map((d) => d.month),
          );
          return {
            keyword: kw,
            monthlyData,
            trend,
            changePercent: metrics.changePercent,
            changePeriod: metrics.changePeriod,
            seasonality,
          };
        });
      }

      // Cache results
      for (const r of aiResults) {
        const hash = trendCacheKey(r.keyword);
        await setTrendCacheEntry(user.id, hash, r).catch((err) => {
          console.warn('[volume-trends] Cache write failed:', err);
        });
        trends.push(r);
      }
    }

    return NextResponse.json({ trends });
  } catch (error) {
    console.error('[volume-trends] Error:', error);
    const message = error instanceof Error ? error.message : 'Volume trend estimation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
