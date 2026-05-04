import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getSerpData } from '@/server/research/serp';

export async function GET(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: 'keyword query parameter is required.' }, { status: 400 });
  }

  const trimmed = keyword.trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'keyword must not be empty.' }, { status: 400 });
  }

  try {
    const data = await getSerpData(trimmed);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[serp api] Error fetching SERP data:', err);
    return NextResponse.json(
      { error: 'Failed to fetch SERP data.' },
      { status: 500 },
    );
  }
}
