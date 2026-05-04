import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { callAiJson } from '@/server/research/ai';
import {
  saveContentBrief,
  getContentBriefsForUser,
  deleteContentBrief,
  getContentBriefById,
} from '@/server/research/content-brief-repository';
import type { GeneratedContentBrief } from '@/server/research/content-brief-repository';

// ── Zod schemas ──

const generateBriefSchema = z.object({
  keywords: z.array(z.string()).min(1).max(20),
  clusterName: z.string().optional(),
  competitorUrls: z.array(z.string()).optional(),
});

const contentBriefAiSchema = z.object({
  targetKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  recommendedWordCount: z.number().min(500).max(10000),
  titles: z.array(z.string()).min(3).max(3),
  outline: z.array(
    z.object({
      heading: z.enum(['H2', 'H3']),
      text: z.string(),
    }),
  ),
  keyPoints: z.array(z.string()),
  competitorGap: z.string(),
  uniqueAngle: z.string(),
});

// ── AI Prompt ──

function buildContentBriefPrompt(
  keywords: string[],
  clusterName?: string,
  competitorUrls?: string[],
): string {
  const topic = clusterName || keywords[0];
  return JSON.stringify({
    task: `Generate a detailed content writing brief for the topic "${topic}".`,
    keywords: {
      primary: keywords[0],
      all: keywords,
    },
    competitorUrls: competitorUrls || [],
    requirements: {
      titles: 'Exactly 3 title variations — one SEO-optimized, one click-worthy/listicle style, one how-to/guide style.',
      outline: 'Create an H2/H3 heading structure that flows logically. Minimum 6 H2s, each with 1-2 H3 sub-headings where appropriate.',
      keyPoints: '5-10 specific points the article MUST cover to be comprehensive.',
      competitorGap: 'Analyze what the top competitors miss — be specific.',
      uniqueAngle: 'Based on the gap analysis, suggest a unique angle that will differentiate this content.',
      wordCount: 'Recommend a realistic word count that would thoroughly cover the topic.',
    },
    format: 'Return valid JSON matching the specified schema structure exactly.',
  });
}

// ── GET /api/content-briefs ──

export async function GET(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const brief = await getContentBriefById(id, user.id);
      if (!brief) {
        return NextResponse.json({ error: 'Brief not found.' }, { status: 404 });
      }
      return NextResponse.json({ brief });
    }

    const briefs = await getContentBriefsForUser(user.id);
    return NextResponse.json({ briefs });
  } catch (error) {
    console.error('content-briefs GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST /api/content-briefs ──

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = generateBriefSchema.parse(body);

    const aiBrief = await callAiJson({
      schema: contentBriefAiSchema,
      system: `You are an expert SEO content strategist and editor. You create detailed, actionable content writing briefs. Your briefs are practical, specific, and designed to help writers create content that ranks. Always provide concrete, specific recommendations — never generic advice.`,
      prompt: buildContentBriefPrompt(parsed.keywords, parsed.clusterName, parsed.competitorUrls),
      modelTier: 'opus',
      maxTokens: 4000,
    });

    const brief: GeneratedContentBrief = {
      targetKeyword: aiBrief.targetKeyword,
      secondaryKeywords: aiBrief.secondaryKeywords,
      recommendedWordCount: aiBrief.recommendedWordCount,
      titles: aiBrief.titles.slice(0, 3),
      outline: aiBrief.outline,
      keyPoints: aiBrief.keyPoints,
      competitorGap: aiBrief.competitorGap,
      uniqueAngle: aiBrief.uniqueAngle,
    };

    const title = parsed.clusterName || parsed.keywords[0];

    // Save to database
    await saveContentBrief(user.id, title, parsed.keywords, brief);

    return NextResponse.json({ brief }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('content-briefs POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

// ── DELETE /api/content-briefs ──

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

    const deleted = await deleteContentBrief(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Brief not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('content-briefs DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
