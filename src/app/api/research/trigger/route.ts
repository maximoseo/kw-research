import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Supabase client (server-side, service role)
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://wtpczvyupmavzrxisvcm.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

/**
 * POST /api/research/trigger
 * Trigger a keyword research run from the dashboard.
 * Body: { projectId: string, agent?: "claude" | "manus" | "auto" }
 */
export async function POST(req: NextRequest) {
  try {
    const { projectId, agent = 'auto' } = await req.json();
    
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Verify project exists
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Create research run
    const runId = randomUUID();
    const now = Date.now();

    const { error: insertErr } = await supabase.from('research_runs').insert({
      id: runId,
      project_id: projectId,
      user_id: project.user_id,
      mode: 'fresh',
      status: 'queued',
      target_rows: 50,
      input_snapshot: JSON.stringify({
        brandName: project.brand_name,
        homepageUrl: project.homepage_url,
        language: project.language,
        market: project.market,
        competitors: project.competitor_urls,
        agent,
      }),
      queued_at: now,
      updated_at: now,
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      runId,
      projectId,
      agent,
      status: 'queued',
      message: 'Research run queued. The worker will process it shortly.',
      progressUrl: `/api/research/progress?runId=${runId}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/research/progress?runId=xxx
 * Get real-time progress of a research run
 */
export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('runId');
  if (!runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 });
  }

  const { data: run, error } = await supabase
    .from('research_runs')
    .select('id, status, step, progress, result_summary, error_message, started_at, completed_at')
    .eq('id', runId)
    .single();

  if (error || !run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const { data: logs } = await supabase
    .from('research_logs')
    .select('stage, level, message, created_at')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
    .limit(50);

  return NextResponse.json({ ...run, logs: logs || [] });
}
