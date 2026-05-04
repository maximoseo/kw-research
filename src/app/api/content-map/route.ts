import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import {
  createContentMapping,
  deleteContentMapping,
  getContentMappingsForUser,
} from '@/server/research/content-map-repository';

export async function GET(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const mappings = await getContentMappingsForUser(user.id);
    return NextResponse.json({ mappings });
  } catch (error) {
    console.error('content-map GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { keywordId, pageUrl, pageTitle } = body;

    if (!keywordId || typeof keywordId !== 'string') {
      return NextResponse.json({ error: 'keywordId is required (string).' }, { status: 400 });
    }
    if (!pageUrl || typeof pageUrl !== 'string') {
      return NextResponse.json({ error: 'pageUrl is required (string).' }, { status: 400 });
    }

    const mapping = await createContentMapping(
      user.id,
      keywordId.trim(),
      pageUrl.trim(),
      pageTitle ? String(pageTitle).trim() : undefined,
    );

    return NextResponse.json({ mapping }, { status: 201 });
  } catch (error) {
    console.error('content-map POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required.' }, { status: 400 });
    }

    const deleted = await deleteContentMapping(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Mapping not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('content-map DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
