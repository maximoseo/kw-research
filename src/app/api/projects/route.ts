import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { createProject, deleteProject, listProjectsForUser } from '@/server/research/repository';
import { parseProjectInput, validateProjectSources } from '@/server/research/preflight';

export async function GET() {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projects = await listProjectsForUser(user.id);
  return NextResponse.json({ projects });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId parameter.' }, { status: 400 });
  }

  const deleted = await deleteProject(projectId, user.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const parsed = parseProjectInput({
      homepageUrl: formData.get('homepageUrl'),
      aboutUrl: formData.get('aboutUrl'),
      sitemapUrl: formData.get('sitemapUrl'),
      brandName: formData.get('brandName'),
      language: formData.get('language'),
      market: formData.get('market'),
      competitorUrls: formData.get('competitorUrls'),
      notes: formData.get('notes'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input.' }, { status: 400 });
    }

    const issues = await validateProjectSources(parsed.data);
    if (issues.length) {
      return NextResponse.json({ error: issues[0], issues }, { status: 400 });
    }

    const projectName = `${parsed.data.brandName} - ${parsed.data.market}`;
    const created = await createProject({
      userId: user.id,
      projectName,
      brandName: parsed.data.brandName,
      language: parsed.data.language,
      market: parsed.data.market,
      homepageUrl: parsed.data.homepageUrl,
      aboutUrl: parsed.data.aboutUrl,
      sitemapUrl: parsed.data.sitemapUrl,
      competitorUrls: parsed.data.competitorUrls,
      notes: parsed.data.notes,
    });

    return NextResponse.json({
      ok: true,
      projectId: created.projectId,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create the project.' }, { status: 500 });
  }
}
