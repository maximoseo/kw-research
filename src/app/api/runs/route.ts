import path from 'path';
import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import {
  createProjectAndRun,
  createRunForProject,
  getProjectForUser,
  listRunsForProject,
  listRunsForUser,
} from '@/server/research/repository';
import { parseProjectRunInput, parseResearchInput, validateResearchSources } from '@/server/research/preflight';
import { parseUploadedWorkbook } from '@/server/research/uploaded-workbook';
import { startResearchWorker } from '@/server/research/worker';
import { writeManagedUpload } from '@/server/files/storage';

export async function GET(request: Request) {
  startResearchWorker();
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (projectId) {
    const project = await getProjectForUser(user.id, projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const runs = await listRunsForProject(user.id, projectId);
    return NextResponse.json({ runs });
  }

  const runs = await listRunsForUser(user.id);
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  startResearchWorker();
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const fileEntry = formData.get('existingResearch');
    let uploadedFile: Awaited<ReturnType<typeof parseUploadedWorkbook>>['parsed'] | null = null;

    if (fileEntry instanceof File && fileEntry.size > 0) {
      const parsedFile = await parseUploadedWorkbook(fileEntry);
      if (parsedFile.error || !parsedFile.parsed) {
        return NextResponse.json({ error: parsedFile.error || 'Unable to parse the uploaded workbook.' }, { status: 400 });
      }

      uploadedFile = parsedFile.parsed;
    }

    const storedUpload = uploadedFile
      ? {
          originalName: (fileEntry as File).name,
          storedPath: await writeManagedUpload({
            buffer: uploadedFile.buffer,
            originalName: (fileEntry as File).name,
            extension: uploadedFile.extension || path.extname((fileEntry as File).name) || '.xlsx',
          }),
          mimeType: uploadedFile.mimeType,
          sizeBytes: uploadedFile.buffer.length,
          summary: uploadedFile.summary,
        }
      : null;

    const projectId = formData.get('projectId');
    if (typeof projectId === 'string' && projectId.trim()) {
      const parsedRun = parseProjectRunInput({
        competitorUrls: formData.get('competitorUrls'),
        notes: formData.get('notes'),
        mode: formData.get('mode'),
        targetRows: formData.get('targetRows'),
      });

      if (!parsedRun.success) {
        return NextResponse.json({ error: parsedRun.error.issues[0]?.message || 'Invalid input.' }, { status: 400 });
      }

      const created = await createRunForProject({
        userId: user.id,
        projectId: projectId.trim(),
        competitorUrls: parsedRun.data.competitorUrls,
        notes: parsedRun.data.notes,
        targetRows: parsedRun.data.targetRows,
        mode: parsedRun.data.mode,
        uploadedFile: storedUpload,
      });

      if (!created) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      }

      startResearchWorker();

      return NextResponse.json({
        ok: true,
        runId: created.runId,
        projectId: created.projectId,
      });
    }

    const parsed = parseResearchInput({
      homepageUrl: formData.get('homepageUrl'),
      aboutUrl: formData.get('aboutUrl'),
      sitemapUrl: formData.get('sitemapUrl'),
      brandName: formData.get('brandName'),
      language: formData.get('language'),
      market: formData.get('market'),
      competitorUrls: formData.get('competitorUrls'),
      notes: formData.get('notes'),
      mode: formData.get('mode'),
      targetRows: formData.get('targetRows'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input.' }, { status: 400 });
    }

    const issues = await validateResearchSources(parsed.data);
    if (issues.length) {
      return NextResponse.json({ error: issues[0], issues }, { status: 400 });
    }

    const projectName = `${parsed.data.brandName} - ${parsed.data.market}`;
    const created = await createProjectAndRun({
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
      targetRows: parsed.data.targetRows,
      mode: parsed.data.mode,
      uploadedFile: storedUpload,
    });

    startResearchWorker();

    return NextResponse.json({
      ok: true,
      runId: created.runId,
      projectId: created.projectId,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/runs] Failed to create research run:', detail, error);
    return NextResponse.json({ error: `Unable to create the research run: ${detail}` }, { status: 500 });
  }
}
