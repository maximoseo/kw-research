import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getRunForUser } from '@/server/research/repository';
import type { ResearchRow } from '@/lib/research';

type SortField = 'volume' | 'cpc' | 'primaryKeyword' | 'pillar' | 'cluster' | 'intent';
type SortOrder = 'asc' | 'desc';

interface KeywordsQueryParams {
  runId: string;
  page: number;
  limit: number;
  sort: SortField;
  order: SortOrder;
}

const VALID_SORT_FIELDS: Set<string> = new Set([
  'volume',
  'cpc',
  'primaryKeyword',
  'pillar',
  'cluster',
  'intent',
]);

const VALID_SORT_ORDERS: Set<string> = new Set(['asc', 'desc']);

function parseKeywordsParams(searchParams: URLSearchParams): { data: KeywordsQueryParams } | { error: string; status: number } {
  const runId = searchParams.get('runId');
  if (!runId) {
    return { error: 'runId is required.', status: 400 };
  }

  const pageRaw = searchParams.get('page');
  const page = pageRaw ? parseInt(pageRaw, 10) : 1;
  if (!Number.isFinite(page) || page < 1) {
    return { error: 'page must be a positive integer.', status: 400 };
  }

  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    return { error: 'limit must be between 1 and 100.', status: 400 };
  }

  const sort = (searchParams.get('sort') || 'volume') as SortField;
  if (!VALID_SORT_FIELDS.has(sort)) {
    return { error: `Invalid sort field. Must be one of: ${[...VALID_SORT_FIELDS].join(', ')}`, status: 400 };
  }

  const order = (searchParams.get('order') || 'desc') as SortOrder;
  if (!VALID_SORT_ORDERS.has(order)) {
    return { error: 'order must be asc or desc.', status: 400 };
  }

  return {
    data: { runId, page, limit, sort, order },
  };
}

function sortRows(rows: ResearchRow[], sort: SortField, order: SortOrder): ResearchRow[] {
  const multiplier = order === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    switch (sort) {
      case 'volume': {
        const aVal = a.searchVolume ?? -1;
        const bVal = b.searchVolume ?? -1;
        return (aVal - bVal) * multiplier;
      }
      case 'cpc': {
        const aVal = a.cpc ?? -1;
        const bVal = b.cpc ?? -1;
        return (aVal - bVal) * multiplier;
      }
      case 'primaryKeyword':
        return (a.primaryKeyword || '').localeCompare(b.primaryKeyword || '') * multiplier;
      case 'pillar':
        return (a.pillar || '').localeCompare(b.pillar || '') * multiplier;
      case 'cluster':
        return (a.cluster || '').localeCompare(b.cluster || '') * multiplier;
      case 'intent':
        return (a.intent || '').localeCompare(b.intent || '') * multiplier;
      default:
        return 0;
    }
  });
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseKeywordsParams(searchParams);

  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { runId, page, limit, sort, order } = parsed.data;

  const run = await getRunForUser(user.id, runId);
  if (!run) {
    return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
  }

  const allRows: ResearchRow[] = run.rows ?? [];
  const sorted = sortRows(allRows, sort, order);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const data = sorted.slice(offset, offset + limit);

  return NextResponse.json({
    data,
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  });
}
