import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getRunForUser } from '@/server/research/repository';
import type { ResearchRow } from '@/lib/research';

export interface SerpResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

export interface ContentTypeDistribution {
  type: string;
  count: number;
  label: string;
}

export interface KeywordDetail {
  keyword: ResearchRow;
  serpResults: SerpResult[];
  contentTypes: ContentTypeDistribution[];
  relatedKeywords: string[];
  questions: string[];
}

// ── Deterministic pseudo-random helper seeded by keyword text ──
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash - 1) / 2147483646;
  };
}

function generateSerpResults(keyword: ResearchRow): SerpResult[] {
  const rng = seededRandom(keyword.primaryKeyword + '_serp');
  const domainTemplates = [
    'ahrefs.com', 'semrush.com', 'moz.com', 'searchenginejournal.com',
    'backlinko.com', 'neilpatel.com', 'hubspot.com', 'contentmarketinginstitute.com',
    'yoast.com', 'wordstream.com', 'searchengineland.com', 'marketingprofs.com',
  ];

  const serpAngles: Record<string, string[]> = {
    Informational: [
      '{keyword}: The Ultimate Guide',
      'How to Master {keyword} in 2025',
      '{keyword} Explained: Everything You Need to Know',
      'The Complete Beginner\u2019s Guide to {keyword}',
      '10 {keyword} Strategies That Actually Work',
      '{keyword} Best Practices for 2025',
      'Understanding {keyword}: A Comprehensive Overview',
      '{keyword} Tips from Industry Experts',
      'The Science Behind {keyword}',
      'Why {keyword} Matters More Than Ever',
    ],
    Commercial: [
      'Best {keyword} Tools Compared',
      '{keyword} Pricing: Which Plan Is Right for You?',
      'Top 10 {keyword} Solutions Reviewed',
      '{keyword} Comparison: Features, Pricing & More',
      'Is {keyword} Worth It? An Honest Review',
      '{keyword} vs Alternatives: Head-to-Head',
      'How to Choose the Best {keyword} Platform',
      '{keyword} Buyer\u2019s Guide 2025',
      '{keyword} Demo: See It in Action',
      '{keyword} Pros and Cons: What to Know',
    ],
    Transactional: [
      'Buy {keyword} Online \u2014 Best Deals',
      '{keyword} Sale: Get Started Today',
      'Get {keyword} Now \u2014 Limited Offer',
      '{keyword} Pricing Plans',
      'Sign Up for {keyword} Free Trial',
      '{keyword} Discount Code 2025',
      'Order {keyword} with Free Shipping',
      '{keyword} Official Site',
      'Join {keyword} Today',
      'Shop {keyword} \u2014 Best Prices Guaranteed',
    ],
    Navigational: [
      '{keyword} \u2014 Official Website',
      '{keyword} Login Page',
      '{keyword} Support Center',
      '{keyword} Documentation',
      'About {keyword}',
      '{keyword} Blog',
      '{keyword} Resources',
      '{keyword} API Reference',
      '{keyword} Community Forum',
      '{keyword} System Status',
    ],
  };

  const angles = serpAngles[keyword.intent] || serpAngles.Informational;

  return Array.from({ length: 10 }, (_, i) => {
    const domain = domainTemplates[i % domainTemplates.length];
    const title = angles[i].replace(/\{keyword\}/g, keyword.primaryKeyword);
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);
    const url = `https://${domain}/blog/${slug}`;

    const snippetTemplates = [
      `Learn everything about ${keyword.primaryKeyword} in this comprehensive article covering key strategies...`,
      `Discover how ${keyword.primaryKeyword} can transform your approach to ${keyword.cluster.toLowerCase()}...`,
      `${keyword.primaryKeyword} is essential for modern ${keyword.pillar.toLowerCase()} strategies. This guide covers...`,
      `A deep dive into ${keyword.primaryKeyword}, with practical tips on ${keyword.cluster.toLowerCase()}...`,
      `Explore the latest trends in ${keyword.primaryKeyword} and how they impact your ${keyword.pillar.toLowerCase()}...`,
    ];
    const snippet = snippetTemplates[i % snippetTemplates.length];

    return { title, url, snippet, position: i + 1 };
  });
}

function generateContentTypes(keyword: ResearchRow): ContentTypeDistribution[] {
  const rng = seededRandom(keyword.primaryKeyword + '_ct');

  // Deterministic base counts from the keyword metrics and intent
  const volume = keyword.searchVolume ?? 100;
  const total = Math.max(10, Math.round(volume / 50));

  const baseDist: Record<string, number> = {
    'Blog Post': 0.35,
    'Product Page': 0.08,
    'Video': 0.12,
    'News/PR': 0.10,
    'How-to Guide': 0.15,
    'Listicle': 0.10,
    'Comparison': 0.05,
    'Forum/QA': 0.05,
  };

  if (keyword.intent === 'Commercial') {
    baseDist['Product Page'] = 0.18;
    baseDist['Comparison'] = 0.12;
    baseDist['Blog Post'] = 0.25;
    baseDist['How-to Guide'] = 0.10;
    baseDist['Video'] = 0.08;
    baseDist['Listicle'] = 0.12;
  } else if (keyword.intent === 'Transactional') {
    baseDist['Product Page'] = 0.35;
    baseDist['Blog Post'] = 0.15;
    baseDist['Comparison'] = 0.15;
    baseDist['Video'] = 0.08;
    baseDist['How-to Guide'] = 0.05;
    baseDist['News/PR'] = 0.05;
  } else if (keyword.intent === 'Navigational') {
    baseDist['Blog Post'] = 0.15;
    baseDist['Product Page'] = 0.30;
    baseDist['News/PR'] = 0.20;
    baseDist['Forum/QA'] = 0.10;
    baseDist['Video'] = 0.05;
    baseDist['How-to Guide'] = 0.05;
    baseDist['Comparison'] = 0.05;
  }

  const entries: ContentTypeDistribution[] = [];
  let remaining = total;

  for (const [type, ratio] of Object.entries(baseDist)) {
    const count = Math.max(0, Math.round(total * ratio * (0.8 + rng() * 0.4)));
    entries.push({ type, count, label: type });
    remaining -= count;
  }

  // Distribute remaining to the largest entry
  if (remaining > 0 && entries.length > 0) {
    entries.sort((a, b) => b.count - a.count);
    entries[0].count += remaining;
  }

  return entries.filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
}

function generateRelatedKeywords(keyword: ResearchRow, allRows: ResearchRow[]): string[] {
  // Find keywords in same cluster or pillar, plus some random ones
  const sameCluster = allRows
    .filter((r) => r.cluster === keyword.cluster && r.primaryKeyword !== keyword.primaryKeyword)
    .map((r) => r.primaryKeyword);

  const samePillar = allRows
    .filter((r) => r.pillar === keyword.pillar && r.cluster !== keyword.cluster && r.primaryKeyword !== keyword.primaryKeyword)
    .map((r) => r.primaryKeyword);

  const others = allRows
    .filter((r) => r.pillar !== keyword.pillar && r.primaryKeyword !== keyword.primaryKeyword)
    .map((r) => r.primaryKeyword);

  // Shuffle deterministically
  const rng = seededRandom(keyword.primaryKeyword);
  const shuffle = <T>(arr: T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const selected: string[] = [];
  const addUnique = (arr: string[]) => {
    for (const k of arr) {
      if (!selected.includes(k) && selected.length < 10) {
        selected.push(k);
      }
    }
  };

  addUnique(shuffle(sameCluster));
  addUnique(shuffle(samePillar));
  addUnique(shuffle(others));

  // If we still don't have enough, generate synthetic related keywords
  const rng2 = seededRandom(keyword.primaryKeyword + '_synth');
  const prefixes = ['best', 'how to', 'what is', 'top', 'affordable', 'professional', 'advanced', 'simple'];
  const suffixes = ['guide', 'tips', 'strategies', 'tools', 'examples', 'tutorial', 'review', 'comparison', 'checklist'];

  while (selected.length < 10) {
    const prefix = prefixes[Math.floor(rng2() * prefixes.length)];
    const suffix = suffixes[Math.floor(rng2() * suffixes.length)];
    const synth = `${prefix} ${keyword.primaryKeyword.toLowerCase()} ${suffix}`;
    if (!selected.includes(synth)) {
      selected.push(synth);
    }
  }

  return selected.slice(0, 10);
}

function generateQuestions(keyword: ResearchRow): string[] {
  const rng = seededRandom(keyword.primaryKeyword + '_q');

  const questionTemplates: Record<string, string[]> = {
    Informational: [
      'What is {keyword}?',
      'How does {keyword} work?',
      'Why is {keyword} important?',
      'What are the benefits of {keyword}?',
      'How to get started with {keyword}?',
      'What are the best practices for {keyword}?',
      'How to measure {keyword} success?',
      'What tools are needed for {keyword}?',
      'How long does it take to see results from {keyword}?',
      'What are common mistakes with {keyword}?',
      'How does {keyword} compare to alternatives?',
      'Is {keyword} worth learning in 2025?',
    ],
    Commercial: [
      'What is the best {keyword} tool?',
      'How much does {keyword} cost?',
      'Is {keyword} worth the investment?',
      'What features should I look for in {keyword}?',
      'How does {keyword} compare to competitors?',
      'What are the pros and cons of {keyword}?',
      'Which {keyword} plan is best for small businesses?',
      'Can I try {keyword} for free?',
      'What do users say about {keyword}?',
      'How does {keyword} pricing work?',
      'Is there an alternative to {keyword}?',
      'How scalable is {keyword}?',
    ],
    Transactional: [
      'Where can I buy {keyword}?',
      'How much does {keyword} cost?',
      'Is there a discount for {keyword}?',
      'What\u2019s included with {keyword}?',
      'How fast is {keyword} delivery?',
      'Does {keyword} offer a money-back guarantee?',
      'How to set up {keyword} after purchase?',
      'What payment methods does {keyword} accept?',
      'Is {keyword} available in my country?',
      'How to cancel {keyword} subscription?',
      'What\u2019s the best deal on {keyword}?',
      'Can I get a demo of {keyword}?',
    ],
    Navigational: [
      'What is the official site for {keyword}?',
      'How to log into {keyword}?',
      'Where is {keyword} support?',
      'How to contact {keyword}?',
      'What is {keyword} company background?',
      'Where are {keyword} offices?',
      'Who owns {keyword}?',
      'What products does {keyword} offer?',
      'How to find {keyword} documentation?',
      'Where to download {keyword}?',
      'How to join {keyword} community?',
      'What is {keyword} API status?',
    ],
  };

  const templates = questionTemplates[keyword.intent] || questionTemplates.Informational;

  // Deterministic shuffle
  const shuffled = [...templates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, 8).map((t) => t.replace(/\{keyword\}/g, keyword.primaryKeyword));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: keywordId } = await params;

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  if (!runId) {
    return NextResponse.json({ error: 'runId is required.' }, { status: 400 });
  }

  const run = await getRunForUser(user.id, runId);
  if (!run) {
    return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
  }

  // keywordId is the index (or a composite key) of the row within the run
  const rows: ResearchRow[] = run.rows ?? [];

  // Try to find by index first, then by primaryKeyword match
  let keyword: ResearchRow | undefined;

  const indexMatch = /^\d+$/.test(keywordId);
  if (indexMatch) {
    const idx = parseInt(keywordId, 10);
    keyword = rows[idx] ?? undefined;
  }

  if (!keyword) {
    keyword = rows.find(
      (r) =>
        r.primaryKeyword === decodeURIComponent(keywordId) ||
        r.primaryKeyword.toLowerCase() === decodeURIComponent(keywordId).toLowerCase(),
    );
  }

  if (!keyword) {
    return NextResponse.json({ error: 'Keyword not found.' }, { status: 404 });
  }

  // Simulate a small delay for realistic lazy-load feel
  // (removed - client handles loading states)

  const detail: KeywordDetail = {
    keyword,
    serpResults: generateSerpResults(keyword),
    contentTypes: generateContentTypes(keyword),
    relatedKeywords: generateRelatedKeywords(keyword, rows),
    questions: generateQuestions(keyword),
  };

  return NextResponse.json(detail);
}
