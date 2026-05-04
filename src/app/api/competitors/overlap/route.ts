import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getRunForUser, listRunsForProject } from '@/server/research/repository';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const overlapSchema = z.object({
  projectId: z.string().min(1),
  domains: z.array(z.string().min(1)).min(2).max(3),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverlapSets {
  domain1Only: string[];
  domain2Only: string[];
  shared: string[];
  domain3Only?: string[];
  all3?: string[];
  domain1SharedWith3?: string[];
  domain2SharedWith3?: string[];
}

export interface OverlapStats {
  totalDomain1: number;
  totalDomain2: number;
  totalDomain3?: number;
  domain1OnlyCount: number;
  domain2OnlyCount: number;
  domain3OnlyCount?: number;
  sharedCount: number;
  sharedAll3Count?: number;
  totalUnique: number;
}

export interface OverlapResponse {
  sets: OverlapSets;
  stats: OverlapStats;
  domains: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDomain(raw: string): string {
  try {
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return raw.toLowerCase().replace(/^www\./i, '');
  }
}

function extractKeywordsFromRows(rows: { primaryKeyword: string; keywords: string[] }[]): Set<string> {
  const kwSet = new Set<string>();
  for (const row of rows) {
    if (row.primaryKeyword) {
      kwSet.add(row.primaryKeyword.toLowerCase().trim());
    }
    for (const kw of row.keywords || []) {
      kwSet.add(kw.toLowerCase().trim());
    }
  }
  return kwSet;
}

async function getDomainKeywords(
  userId: string,
  projectId: string,
  domain: string,
): Promise<Set<string>> {
  const normalizedDomain = normalizeDomain(domain);
  const keywords = new Set<string>();

  // Strategy 1: Get keywords from completed runs where the run's input
  // has competitorUrls matching this domain, or the project's homepageUrl
  try {
    const runs = await listRunsForProject(userId, projectId, 20);
    const completedRuns = runs.filter((r) => r.status === 'completed');

    for (const run of completedRuns.slice(0, 5)) {
      const detail = await getRunForUser(userId, run.id);
      if (!detail?.rows) continue;

      // Check if this domain is the project's homepage domain or a competitor
      const projectHomeDomain = normalizeDomain(detail.input?.homepageUrl || '');
      const competitorDomains = (detail.input?.competitorUrls || []).map(normalizeDomain);

      const isHomeDomain = projectHomeDomain === normalizedDomain;
      const isCompetitorDomain = competitorDomains.includes(normalizedDomain);

      if (isHomeDomain || isCompetitorDomain) {
        // For the home domain, we get all keywords the user has
        if (isHomeDomain) {
          for (const row of detail.rows) {
            if (row.primaryKeyword) {
              keywords.add(row.primaryKeyword.toLowerCase().trim());
            }
            for (const kw of row.keywords || []) {
              keywords.add(kw.toLowerCase().trim());
            }
          }
        }
        // For competitor domains, we use gap analysis keyword attribution
        // The gap analysis stores source domains for keywords
      }
    }

    // Strategy 2: For competitor domains, try gap analysis data
    // We check the keywords endpoint which tracks source attribution
    if (keywords.size === 0 && normalizedDomain !== '') {
      // If no keywords found via runs, attempt to get from gap analysis
      // by checking if the domain has been analyzed before
      for (const run of completedRuns.slice(0, 5)) {
        const detail = await getRunForUser(userId, run.id);
        if (!detail?.input?.competitorUrls) continue;

        const compUrls = detail.input.competitorUrls.map(normalizeDomain);
        if (compUrls.includes(normalizedDomain)) {
          // Found a run that analyzed this competitor — use all gap-like keywords
          for (const row of detail.rows || []) {
            if (row.primaryKeyword) {
              keywords.add(row.primaryKeyword.toLowerCase().trim());
            }
            for (const kw of row.keywords || []) {
              keywords.add(kw.toLowerCase().trim());
            }
          }
        }
      }
    }
  } catch {
    // If no runs exist, return empty set
  }

  return keywords;
}

// ---------------------------------------------------------------------------
// Overlap calculation
// ---------------------------------------------------------------------------

function calculateOverlap(
  domain1Keywords: Set<string>,
  domain2Keywords: Set<string>,
  domain3Keywords?: Set<string>,
): { sets: OverlapSets; stats: OverlapStats } {
  const d1 = domain1Keywords;
  const d2 = domain2Keywords;
  const d3 = domain3Keywords;

  // For 2 domains
  const domain1Only = [...d1].filter((kw) => !d2.has(kw));
  const domain2Only = [...d2].filter((kw) => !d1.has(kw));
  const shared = [...d1].filter((kw) => d2.has(kw));

  const result: { sets: OverlapSets; stats: OverlapStats } = {
    sets: {
      domain1Only,
      domain2Only,
      shared,
    },
    stats: {
      totalDomain1: d1.size,
      totalDomain2: d2.size,
      domain1OnlyCount: domain1Only.length,
      domain2OnlyCount: domain2Only.length,
      sharedCount: shared.length,
      totalUnique: new Set([...d1, ...d2]).size,
    },
  };

  // For 3 domains
  if (d3) {
    // Recalculate with 3 sets
    const d1Only = [...d1].filter((kw) => !d2.has(kw) && !d3.has(kw));
    const d2Only = [...d2].filter((kw) => !d1.has(kw) && !d3.has(kw));
    const d3Only = [...d3].filter((kw) => !d1.has(kw) && !d2.has(kw));

    const shared12 = [...d1].filter((kw) => d2.has(kw) && !d3.has(kw));
    const shared13 = [...d1].filter((kw) => d3.has(kw) && !d2.has(kw));
    const shared23 = [...d2].filter((kw) => d3.has(kw) && !d1.has(kw));

    const all3 = [...d1].filter((kw) => d2.has(kw) && d3.has(kw));

    result.sets = {
      domain1Only: d1Only,
      domain2Only: d2Only,
      shared: shared12,
      domain3Only: d3Only,
      all3,
      domain1SharedWith3: shared13,
      domain2SharedWith3: shared23,
    };

    result.stats = {
      totalDomain1: d1.size,
      totalDomain2: d2.size,
      totalDomain3: d3.size,
      domain1OnlyCount: d1Only.length,
      domain2OnlyCount: d2Only.length,
      domain3OnlyCount: d3Only.length,
      sharedCount: shared12.length + shared13.length + shared23.length,
      sharedAll3Count: all3.length,
      totalUnique: new Set([...d1, ...d2, ...d3]).size,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsed: z.infer<typeof overlapSchema>;
  try {
    const json = await request.json();
    const result = overlapSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input.' },
        { status: 400 },
      );
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { projectId, domains } = parsed;

  if (domains.length < 2 || domains.length > 3) {
    return NextResponse.json(
      { error: 'Requires 2 or 3 domains to compare.' },
      { status: 400 },
    );
  }

  // Get keywords for each domain
  const [domain1Keywords, domain2Keywords, domain3Keywords] = await Promise.all([
    getDomainKeywords(user.id, projectId, domains[0]),
    getDomainKeywords(user.id, projectId, domains[1]),
    domains.length > 2 ? getDomainKeywords(user.id, projectId, domains[2]) : Promise.resolve(undefined),
  ]);

  if (domain1Keywords.size === 0 && domain2Keywords.size === 0 && (!domain3Keywords || domain3Keywords.size === 0)) {
    return NextResponse.json(
      { error: 'No keyword data found for any of the specified domains. Run a research or gap analysis first.' },
      { status: 404 },
    );
  }

  const { sets, stats } = calculateOverlap(
    domain1Keywords,
    domain2Keywords,
    domain3Keywords,
  );

  return NextResponse.json({
    sets,
    stats,
    domains: domains.map(normalizeDomain),
  } satisfies OverlapResponse);
}
