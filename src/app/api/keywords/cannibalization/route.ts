import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { listRunsForProject, getRunForUser } from '@/server/research/repository';
import type { ResearchRow, ResearchIntent } from '@/lib/research';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

export interface CannibalGroup {
  keywords: string[];
  overlapScore: number;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
  intent?: ResearchIntent;
  pillar?: string;
  cluster?: string;
}

export interface CannibalizationResponse {
  cannibalGroups: CannibalGroup[];
  totalAffectedKeywords: number;
  totalGroups: number;
}

/* ─────────────────────────────────────────────
   Jaccard similarity helper (server-side)
   ───────────────────────────────────────────── */

function keywordSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

/* ─────────────────────────────────────────────
   Cannibalization analysis
   ───────────────────────────────────────────── */

function getSeverity(score: number): 'high' | 'medium' | 'low' {
  if (score > 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function getSuggestion(severity: 'high' | 'medium' | 'low', count: number): string {
  switch (severity) {
    case 'high':
      return count <= 3
        ? 'Merge these into one comprehensive pillar page covering all variations'
        : 'Pick 1-2 strongest keywords as a pillar and redirect the rest, or merge into one exhaustive guide';
    case 'medium':
      return 'Consider creating a single pillar page that targets the primary keyword, with the others as H2 subtopics';
    case 'low':
      return 'These keywords share some overlap but may serve different subtopics. Review manually to decide if separate pages are justified.';
  }
}

/**
 * Method A: Group keywords by semantic (word-overlap) similarity.
 * Uses Jaccard similarity on word sets. Two keywords are "cannibalizing" if
 * they share significant word overlap.
 */
function groupByWordOverlap(rows: ResearchRow[]): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();

  // Process keywords pairwise (still O(n²) but scans only for meaningful overlap)
  const keywords = rows.map((r) => r.primaryKeyword);

  // Use a representative as the group key
  for (let i = 0; i < keywords.length; i++) {
    let added = false;
    for (const [rep, group] of groups.entries()) {
      const sim = keywordSimilarity(rep, keywords[i]);
      if (sim >= 0.4) {
        group.add(keywords[i]);
        added = true;
        break;
      }
    }
    if (!added) {
      groups.set(keywords[i], new Set([keywords[i]]));
    }
  }

  return groups;
}

/**
 * Method B: Group by intent + pillar/cluster overlap.
 * Keywords with the same intent classification AND overlapping parent topic
 * (pillar or cluster) are potential cannibalization candidates.
 */
function groupByIntentAndTopic(rows: ResearchRow[]): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();

  for (const row of rows) {
    const intent = row.intent || 'Unknown';
    const topic = row.pillar || row.cluster || '';
    const key = `${intent}::${topic.toLowerCase().trim()}`;

    const existing = groups.get(key);
    if (existing) {
      existing.add(row.primaryKeyword);
    } else {
      groups.set(key, new Set([row.primaryKeyword]));
    }
  }

  return groups;
}

/**
 * Combine results from both methods, deduplicate, and score.
 */
function buildCannibalGroups(rows: ResearchRow[]): CannibalGroup[] {
  // Build a lookup for keyword → row metadata
  const rowMap = new Map<string, ResearchRow>();
  for (const row of rows) {
    rowMap.set(row.primaryKeyword, row);
  }

  const overlapGroups = groupByWordOverlap(rows);
  const intentGroups = groupByIntentAndTopic(rows);

  const allCannibalGroups: CannibalGroup[] = [];
  const seenKeywords = new Set<string>();

  // Process word-overlap groups
  for (const [rep, kwSet] of overlapGroups.entries()) {
    if (kwSet.size < 2) continue; // skip singletons

    const kwList = [...kwSet];
    const allSeen = kwList.every((k) => seenKeywords.has(k));
    if (allSeen && kwList.length <= 2) continue; // fully covered by a larger group

    // Compute average pairwise similarity within this group
    let totalSim = 0;
    let pairCount = 0;
    for (let i = 0; i < kwList.length; i++) {
      for (let j = i + 1; j < kwList.length; j++) {
        totalSim += keywordSimilarity(kwList[i], kwList[j]);
        pairCount++;
      }
    }
    const avgSim = pairCount > 0 ? totalSim / pairCount : 0;
    const severity = getSeverity(avgSim);

    // Get representative metadata
    const rep = kwList[0];
    const row = rowMap.get(rep);

    allCannibalGroups.push({
      keywords: kwList,
      overlapScore: Math.round(avgSim * 100) / 100,
      severity,
      suggestion: getSuggestion(severity, kwList.length),
      intent: row?.intent,
      pillar: row?.pillar,
      cluster: row?.cluster,
    });

    for (const k of kwList) seenKeywords.add(k);
  }

  // Process intent+piller groups — only those with multiple keywords
  for (const [key, kwSet] of intentGroups.entries()) {
    if (kwSet.size < 2) continue;

    const kwList = [...kwSet];
    // Check if this group is already substantially covered by overlap groups
    const alreadyGroupCount = kwList.filter((k) => seenKeywords.has(k)).length;
    if (alreadyGroupCount >= kwList.length) continue; // fully covered

    // Filter to keywords not already in an overlap group
    const newKws = kwList.filter((k) => !seenKeywords.has(k));
    if (newKws.length < 2) continue;

    // Compute pairwise similarity
    let totalSim = 0;
    let pairCount = 0;
    for (let i = 0; i < newKws.length; i++) {
      for (let j = i + 1; j < newKws.length; j++) {
        totalSim += keywordSimilarity(newKws[i], newKws[j]);
        pairCount++;
      }
    }
    const avgSim = pairCount > 0 ? totalSim / pairCount : 0;
    const severity = getSeverity(avgSim);

    const row = rowMap.get(newKws[0]);

    allCannibalGroups.push({
      keywords: newKws,
      overlapScore: Math.round(avgSim * 100) / 100,
      severity,
      suggestion: getSuggestion(severity, newKws.length),
      intent: row?.intent,
      pillar: row?.pillar,
      cluster: row?.cluster,
    });

    for (const k of newKws) seenKeywords.add(k);
  }

  // Sort by severity (high first), then by group size
  allCannibalGroups.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.keywords.length - a.keywords.length;
  });

  return allCannibalGroups;
}

/* ─────────────────────────────────────────────
   POST handler
   ───────────────────────────────────────────── */

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.projectId) {
    return NextResponse.json({ error: 'projectId is required.' }, { status: 400 });
  }

  // Fetch all completed runs for the project
  const runs = await listRunsForProject(user.id, body.projectId);
  const completedRuns = runs.filter((r) => r.status === 'completed');

  if (completedRuns.length === 0) {
    return NextResponse.json({
      cannibalGroups: [],
      totalAffectedKeywords: 0,
      totalGroups: 0,
    } as CannibalizationResponse);
  }

  // Collect all keywords from all completed runs
  const allRows: ResearchRow[] = [];
  const seenKeywords = new Set<string>();

  for (const runSummary of completedRuns) {
    const runDetail = await getRunForUser(user.id, runSummary.id);
    if (!runDetail) continue;

    for (const row of runDetail.rows) {
      const kw = row.primaryKeyword?.trim();
      if (!kw || seenKeywords.has(kw.toLowerCase())) continue;
      seenKeywords.add(kw.toLowerCase());
      allRows.push(row);
    }
  }

  if (allRows.length < 2) {
    return NextResponse.json({
      cannibalGroups: [],
      totalAffectedKeywords: 0,
      totalGroups: 0,
    } as CannibalizationResponse);
  }

  // Run analysis
  const cannibalGroups = buildCannibalGroups(allRows);

  // Only return groups (non-singletons)
  const filtered = cannibalGroups.filter((g) => g.keywords.length >= 2);

  const totalAffectedKeywords = filtered.reduce(
    (sum, g) => sum + g.keywords.length,
    0,
  );

  const response: CannibalizationResponse = {
    cannibalGroups: filtered,
    totalAffectedKeywords,
    totalGroups: filtered.length,
  };

  return NextResponse.json(response);
}
