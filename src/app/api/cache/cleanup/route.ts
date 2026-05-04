import { NextResponse } from 'next/server';
import { deleteExpiredEntries } from '@/server/research/cache';

/**
 * POST /api/cache/cleanup
 *
 * Endpoint for cron-triggered cache cleanup.
 * Call this from an external cron service (e.g., Vercel Cron, GitHub Actions, curl).
 *
 * Optional: set CRON_SECRET in env and pass it as ?secret=... for protection.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const { searchParams } = new URL(request.url);
    const provided = searchParams.get('secret') || request.headers.get('x-cron-secret');
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const deleted = await deleteExpiredEntries();
    return NextResponse.json({
      ok: true,
      deleted,
      message: deleted > 0
        ? `Cleaned ${deleted} expired cache entries.`
        : 'No expired cache entries found.',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/cache/cleanup] Failed:', detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
