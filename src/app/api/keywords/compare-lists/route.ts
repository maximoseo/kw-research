import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getRunForUser } from '@/server/research/repository';
import type { ResearchRow } from '@/lib/research';

const compareRequestSchema = z.object({
  runIdA: z.string().min(1),
  runIdB: z.string().min(1),
});

interface ComparedKeyword {
  keyword: string;
  volumeA: number | null;
  difficultyA: number | null;
  volumeB: number | null;
  difficultyB: number | null;
  bestSource: 'A' | 'B' | 'tie';
}

interface CompareResponse {
  shared: ComparedKeyword[];
  onlyA: ResearchRow[];
  onlyB: ResearchRow[];
  stats: {
    sharedCount: number;
    onlyACount: number;
    onlyBCount: number;
    mergedCount: number;
  };
}

function normalizeKeyword(kw: string): string {
  return kw.trim().toLowerCase();
}

function pickBestSource(
  a: { volume: number | null; difficulty: number | null },
  b: { volume: number | null; difficulty: number | null },
): 'A' | 'B' | 'tie' {
  // Score: higher volume + lower difficulty is better
  const scoreA =
    (a.volume ?? 0) * 1.0 - (a.difficulty ?? 50) * 0.5;
  const scoreB =
    (b.volume ?? 0) * 1.0 - (b.difficulty ?? 50) * 0.5;

  if (Math.abs(scoreA - scoreB) < 0.01) return 'tie';
  return scoreA > scoreB ? 'A' : 'B';
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = compareRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { runIdA, runIdB } = parsed.data;

  if (runIdA === runIdB) {
    return NextResponse.json(
      { error: 'Cannot compare a list with itself. Please select two different lists.' },
      { status: 400 },
    );
  }

  try {
    // Fetch both runs in parallel
    const [runA, runB] = await Promise.all([
      getRunForUser(user.id, runIdA),
      getRunForUser(user.id, runIdB),
    ]);

    if (!runA) {
      return NextResponse.json({ error: 'List A not found.' }, { status: 404 });
    }
    if (!runB) {
      return NextResponse.json({ error: 'List B not found.' }, { status: 404 });
    }

    // Build normalized keyword maps
    const rowsA = runA.rows ?? [];
    const rowsB = runB.rows ?? [];

    // Map: normalized keyword → ResearchRow
    const mapA = new Map<string, ResearchRow>();
    const mapB = new Map<string, ResearchRow>();

    for (const row of rowsA) {
      const nk = normalizeKeyword(row.primaryKeyword);
      if (nk && !mapA.has(nk)) {
        mapA.set(nk, row);
      }
    }

    for (const row of rowsB) {
      const nk = normalizeKeyword(row.primaryKeyword);
      if (nk && !mapB.has(nk)) {
        mapB.set(nk, row);
      }
    }

    // Compare
    const shared: ComparedKeyword[] = [];
    const onlyARows: ResearchRow[] = [];
    const onlyBRows: ResearchRow[] = [];

    const keysA = new Set(mapA.keys());
    const keysB = new Set(mapB.keys());

    // Shared
    for (const nk of keysA) {
      if (keysB.has(nk)) {
        const rowA = mapA.get(nk)!;
        const rowB = mapB.get(nk)!;
        const bestSource = pickBestSource(
          { volume: rowA.searchVolume ?? null, difficulty: rowA.difficulty ?? null },
          { volume: rowB.searchVolume ?? null, difficulty: rowB.difficulty ?? null },
        );
        shared.push({
          keyword: rowA.primaryKeyword,
          volumeA: rowA.searchVolume ?? null,
          difficultyA: rowA.difficulty ?? null,
          volumeB: rowB.searchVolume ?? null,
          difficultyB: rowB.difficulty ?? null,
          bestSource,
        });
      } else {
        onlyARows.push(mapA.get(nk)!);
      }
    }

    // Only in B
    for (const nk of keysB) {
      if (!keysA.has(nk)) {
        onlyBRows.push(mapB.get(nk)!);
      }
    }

    const stats = {
      sharedCount: shared.length,
      onlyACount: onlyARows.length,
      onlyBCount: onlyBRows.length,
      mergedCount: shared.length + onlyARows.length + onlyBRows.length,
    };

    const result: CompareResponse = { shared, onlyA: onlyARows, onlyB: onlyBRows, stats };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[compare-lists] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compare lists.' },
      { status: 500 },
    );
  }
}
