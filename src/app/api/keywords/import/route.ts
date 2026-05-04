import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { addResearchLog, getRunForUser, updateRunState, listRunsForProject } from '@/server/research/repository';
import type { ResearchRow } from '@/lib/research';

const importKeywordSchema = z.object({
  keyword: z.string().min(1).max(200),
  volume: z.number().min(0).optional().nullable(),
  difficulty: z.number().min(0).max(100).optional().nullable(),
});

const importRequestSchema = z.object({
  projectId: z.string().min(1),
  keywords: z.array(importKeywordSchema).max(500),
  duplicateStrategy: z.enum(['skip', 'update']).optional().default('skip'),
});

type ImportKeyword = z.infer<typeof importKeywordSchema>;

/**
 * Get existing keyword texts for a given project from all its runs.
 */
async function getExistingKeywordsForProject(userId: string, projectId: string): Promise<Set<string>> {
  // Get the user's runs for the project
  const runs = await listRunsForProject(userId, projectId, 100);

  const existingLower = new Set<string>();

  for (const run of runs) {
    try {
      const detail = await getRunForUser(userId, run.id);
      if (detail?.rows) {
        for (const row of detail.rows) {
          if (row.primaryKeyword) {
            existingLower.add(row.primaryKeyword.toLowerCase());
          }
          if (row.keywords) {
            for (const kw of row.keywords) {
              existingLower.add(kw.toLowerCase());
            }
          }
        }
      }
    } catch {
      // Skip runs that can't be loaded
    }
  }

  return existingLower;
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = importRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request.',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { projectId, keywords, duplicateStrategy } = parsed.data;

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: 'At least one keyword is required.' },
        { status: 400 },
      );
    }

    if (keywords.length > 500) {
      return NextResponse.json(
        { error: 'Maximum 500 keywords per import.' },
        { status: 400 },
      );
    }

    // Gather existing keywords for deduplication
    const existingLower = await getExistingKeywordsForProject(user.id, projectId);

    // Determine which to import, skip, or update
    let imported = 0;
    let skipped = 0;
    let updated = 0;

    // Group keywords: new vs existing
    const newKeywords: ImportKeyword[] = [];
    const updateKeywords: ImportKeyword[] = [];

    for (const kw of keywords) {
      const lower = kw.keyword.toLowerCase();
      if (existingLower.has(lower)) {
        if (duplicateStrategy === 'update') {
          updateKeywords.push(kw);
        } else {
          skipped++;
        }
      } else {
        newKeywords.push(kw);
      }
    }

    // Build ResearchRow entries for new keywords
    const now = Date.now();
    const importRunId = `bulk-import-${projectId}-${now}`;

    const newRows: ResearchRow[] = newKeywords.map((kw) => ({
      existingParentPage: '',
      existingParentPageUrl: null,
      pillar: 'Imported',
      cluster: 'Bulk Import',
      intent: 'Informational' as const,
      primaryKeyword: kw.keyword,
      keywords: [kw.keyword],
      rowType: 'cluster' as const,
      slugPath: '',
      searchVolume: kw.volume ?? null,
      cpc: null,
      difficulty: kw.difficulty ?? null,
      notes: [`Imported ${new Date(now).toISOString().slice(0, 10)}`],
    }));

    imported = newKeywords.length;

    // For updates: we store them as new rows too but mark them differently
    if (duplicateStrategy === 'update' && updateKeywords.length > 0) {
      const updateRows: ResearchRow[] = updateKeywords.map((kw) => ({
        existingParentPage: '',
        existingParentPageUrl: null,
        pillar: 'Updated',
        cluster: 'Bulk Import Update',
        intent: 'Informational' as const,
        primaryKeyword: kw.keyword,
        keywords: [kw.keyword],
        rowType: 'cluster' as const,
        slugPath: '',
        searchVolume: kw.volume ?? null,
        cpc: null,
        difficulty: kw.difficulty ?? null,
        notes: [`Updated via import ${new Date(now).toISOString().slice(0, 10)}`],
      }));

      newRows.push(...updateRows);
      updated = updateKeywords.length;
    }

    // Store imported keywords in the database
    // Find the latest completed run for this project and append to its resultRows
    const runs = await listRunsForProject(user.id, projectId, 50);
    const completedRun = runs.find((r) => r.status === 'completed');

    if (completedRun && newRows.length > 0) {
      // Append to existing run's rows
      const run = await getRunForUser(user.id, completedRun.id);
      if (run) {
        const existingRows = run.rows || [];
        const updatedRows = [...existingRows, ...newRows];
        await updateRunState(completedRun.id, {
          resultRows: JSON.stringify(updatedRows),
        });
      }
    }

    // Log the import
    await addResearchLog({
      runId: completedRun?.id || importRunId,
      stage: 'bulk-import',
      level: 'info',
      message: `Bulk import: ${imported} imported, ${skipped} skipped, ${updated} updated.`,
      metadata: {
        projectId,
        imported,
        skipped,
        updated,
        duplicateStrategy,
        keywordSample: keywords.slice(0, 10).map((k) => k.keyword),
      },
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      updated,
      total: keywords.length,
    });
  } catch (error) {
    console.error('[keywords] Import error:', error);
    const message = error instanceof Error ? error.message : 'Import failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
