/**
 * SERP Feature Detection
 *
 * Detects special SERP features (featured snippets, PAA, video carousels, etc.)
 * from organic search results and keyword analysis.
 */

export type SerpFeature =
  | 'featured_snippet'
  | 'people_also_ask'
  | 'video_carousel'
  | 'knowledge_panel'
  | 'local_pack'
  | 'image_pack'
  | 'shopping_results'
  | 'top_stories'
  | 'reviews'
  | 'faq'
  | 'howto';

export const ALL_SERP_FEATURES: SerpFeature[] = [
  'featured_snippet',
  'people_also_ask',
  'video_carousel',
  'knowledge_panel',
  'local_pack',
  'image_pack',
  'shopping_results',
  'top_stories',
  'reviews',
  'faq',
  'howto',
];

export interface SerpFeatureInfo {
  feature: SerpFeature;
  label: string;
  icon: string; // emoji
  description: string;
}

export const SERP_FEATURE_META: Record<SerpFeature, SerpFeatureInfo> = {
  featured_snippet: {
    feature: 'featured_snippet',
    label: 'Featured Snippet',
    icon: '📝',
    description: 'A highlighted excerpt at the top of results (paragraph, list, or table)',
  },
  people_also_ask: {
    feature: 'people_also_ask',
    label: 'People Also Ask',
    icon: '❓',
    description: 'Expandable question boxes in search results',
  },
  video_carousel: {
    feature: 'video_carousel',
    label: 'Video Carousel',
    icon: '🎬',
    description: 'Horizontal row of video results (usually from YouTube)',
  },
  knowledge_panel: {
    feature: 'knowledge_panel',
    label: 'Knowledge Panel',
    icon: '📋',
    description: 'Information panel on the right side of results',
  },
  local_pack: {
    feature: 'local_pack',
    label: 'Local Pack',
    icon: '📍',
    description: 'Map with local business listings (Google Maps results)',
  },
  image_pack: {
    feature: 'image_pack',
    label: 'Image Pack',
    icon: '🖼️',
    description: 'Row of image results within search results',
  },
  shopping_results: {
    feature: 'shopping_results',
    label: 'Shopping Results',
    icon: '🛒',
    description: 'Product listings with prices and images',
  },
  top_stories: {
    feature: 'top_stories',
    label: 'Top Stories',
    icon: '📰',
    description: 'News article carousel for timely topics',
  },
  reviews: {
    feature: 'reviews',
    label: 'Reviews',
    icon: '⭐',
    description: 'Review stars and ratings in search results',
  },
  faq: {
    feature: 'faq',
    label: 'FAQ Rich Results',
    icon: '💬',
    description: 'FAQ accordion-style rich snippet results',
  },
  howto: {
    feature: 'howto',
    label: 'How-To Rich Results',
    icon: '📖',
    description: 'Step-by-step how-to instructional rich snippets',
  },
};

export interface SerpFeatureOpportunity {
  feature: SerpFeature;
  action: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface KeywordSerpFeatures {
  keyword: string;
  features: SerpFeature[];
  opportunities: SerpFeatureOpportunity[];
}

export interface SerpFeaturesSummary {
  mostCommonFeatures: SerpFeature[];
  keywordWithMostFeatures: string;
  totalFeatureTypesFound: number;
  totalKeywordsAnalyzed: number;
  keywordsWithFeatures: number;
}

export interface SerpFeaturesResult {
  results: KeywordSerpFeatures[];
  summary: SerpFeaturesSummary;
}

// ── Opportunity suggestions per feature ──

const OPPORTUNITY_ACTIONS: Record<SerpFeature, Omit<SerpFeatureOpportunity, 'feature'>> = {
  featured_snippet: {
    action: 'Structure content with clear headings, concise answers, and lists/tables to capture the featured snippet',
    difficulty: 'medium',
  },
  people_also_ask: {
    action: 'Include FAQ sections with question-based headings to appear in PAA boxes',
    difficulty: 'easy',
  },
  video_carousel: {
    action: 'Create and optimize YouTube videos targeting this keyword to appear in the video carousel',
    difficulty: 'medium',
  },
  knowledge_panel: {
    action: 'Build brand authority through Wikipedia, Wikidata, and structured entity markup',
    difficulty: 'hard',
  },
  local_pack: {
    action: 'Optimize Google Business Profile and build local citations to rank in the local pack',
    difficulty: 'medium',
  },
  image_pack: {
    action: 'Create unique, optimized images with descriptive alt text and filenames',
    difficulty: 'easy',
  },
  shopping_results: {
    action: 'List products on Google Merchant Center with optimized product feeds',
    difficulty: 'medium',
  },
  top_stories: {
    action: 'Publish timely news-style content and submit to Google News for fast indexing',
    difficulty: 'medium',
  },
  reviews: {
    action: 'Implement review schema markup and collect genuine customer reviews',
    difficulty: 'easy',
  },
  faq: {
    action: 'Add FAQPage schema markup with relevant Q&A pairs targeting this keyword',
    difficulty: 'easy',
  },
  howto: {
    action: 'Create step-by-step guides with HowTo schema markup for rich results',
    difficulty: 'medium',
  },
};

// ── SerpResult type from cache ──

interface SerpResult {
  position: number;
  url: string;
  title: string;
  snippet: string;
  content_type: string;
  domain: string;
}

// ── Detection Heuristics ──

/**
 * Detect SERP features from organic search results and keyword analysis.
 */
export function detectSerpFeatures(
  keyword: string,
  results: SerpResult[],
): SerpFeature[] {
  if (!results.length) return [];

  const features = new Set<SerpFeature>();
  const kwLower = keyword.toLowerCase();
  const allText = results.map((r) => `${r.title} ${r.snippet} ${r.url}`).join(' ').toLowerCase();
  const top3Text = results.slice(0, 3).map((r) => `${r.title} ${r.snippet}`).join(' ').toLowerCase();

  // 1. Featured Snippet detection
  // Signals: first result has very detailed/long snippet, or query is a definition-type question
  const firstResult = results[0];
  if (
    firstResult.snippet.length > 200 ||
    /^what is\b|^who is\b|^define\b|definition of\b|^meaning of\b/.test(kwLower) ||
    /\bdefinition\b|\bmeaning\b|\boverview\b/i.test(firstResult.title)
  ) {
    features.add('featured_snippet');
  }

  // 2. People Also Ask
  // Very common for informational and question-based queries
  if (
    kwLower.startsWith('what ') ||
    kwLower.startsWith('how ') ||
    kwLower.startsWith('why ') ||
    kwLower.startsWith('when ') ||
    kwLower.startsWith('where ') ||
    kwLower.startsWith('can ') ||
    kwLower.startsWith('do ') ||
    kwLower.startsWith('is ') ||
    kwLower.startsWith('are ') ||
    kwLower.includes('?') ||
    /\b(questions|answers|faq|people also ask)\b/i.test(allText)
  ) {
    features.add('people_also_ask');
  }

  // 3. Video Carousel
  const videoCount = results.filter((r) => r.content_type === 'video').length;
  if (videoCount >= 2) {
    features.add('video_carousel');
  }

  // 4. Knowledge Panel
  const knowledgeDomains = ['wikipedia.org', 'wikidata.org', 'dbpedia.org', 'britannica.com', 'imdb.com'];
  if (results.some((r) => knowledgeDomains.some((d) => r.domain.includes(d)))) {
    features.add('knowledge_panel');
  }

  // 5. Local Pack
  const localSignals = [
    'near me',
    'nearby',
    'in my area',
    'local',
    'closest',
    'google maps',
    'directions',
    'hours',
  ];
  const localDomains = ['yelp.com', 'tripadvisor.com', 'yellowpages.com', 'mapquest.com', 'foursquare.com'];
  if (
    localSignals.some((s) => kwLower.includes(s)) ||
    results.some((r) => localDomains.some((d) => r.domain.includes(d))) ||
    /\b(local|city|town|county|state|zip|address|location|near)\b/i.test(allText)
  ) {
    features.add('local_pack');
  }

  // 6. Image Pack
  const imageDomains = ['pinterest.com', 'instagram.com', 'flickr.com', 'unsplash.com', 'shutterstock.com', 'gettyimages.com'];
  if (
    results.some((r) => imageDomains.some((d) => r.domain.includes(d))) ||
    /\b(images|photos|pictures|gallery|wallpaper|screenshots)\b/i.test(kwLower) ||
    /pinterest\.com|instagram\.com/i.test(allText)
  ) {
    features.add('image_pack');
  }

  // 7. Shopping Results
  const shoppingDomains = ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com', 'bestbuy.com', 'homedepot.com'];
  if (
    results.some((r) => shoppingDomains.some((d) => r.domain.includes(d))) ||
    results.filter((r) => r.content_type === 'product').length >= 2 ||
    /\b(buy|shop|price|pricing|for sale|cheap|discount|deal|coupon|best price)\b/i.test(kwLower)
  ) {
    features.add('shopping_results');
  }

  // 8. Top Stories
  const newsCount = results.filter((r) => r.content_type === 'news').length;
  if (newsCount >= 2) {
    features.add('top_stories');
  }

  // 9. Reviews
  if (
    /\b(review|rating|rated|stars?\b|best\b.*\b\d{4}\b|top\s*\d+)\b/i.test(allText) ||
    /\b⭐⭐⭐|★|☆|rating\s*[:/]\s*\d/i.test(top3Text)
  ) {
    features.add('reviews');
  }

  // 10. FAQ
  if (
    /\b(faq|frequently asked|q&a|common questions)\b/i.test(allText) ||
    results.some((r) => /\/faq\b|\/questions?\b|\/help\b/i.test(r.url))
  ) {
    features.add('faq');
  }

  // 11. How-To
  if (
    kwLower.startsWith('how to ') ||
    kwLower.startsWith('how can ') ||
    kwLower.startsWith('how do ') ||
    /\b(step.by.step|tutorial|guide|walkthrough|instructions?)\b/i.test(top3Text) ||
    results.some((r) => /\b(how.to|guide|tutorial)\b/i.test(r.title))
  ) {
    features.add('howto');
  }

  return Array.from(features).sort(
    (a, b) => ALL_SERP_FEATURES.indexOf(a) - ALL_SERP_FEATURES.indexOf(b),
  );
}

/**
 * Determine opportunities (features NOT present but potentially valuable).
 */
export function detectOpportunities(
  keyword: string,
  presentFeatures: SerpFeature[],
  results: SerpResult[],
): SerpFeatureOpportunity[] {
  const kwLower = keyword.toLowerCase();
  const allText = results.map((r) => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
  const opportunities: SerpFeatureOpportunity[] = [];

  const relevantFor: Partial<Record<SerpFeature, () => boolean>> = {
    featured_snippet: () =>
      kwLower.startsWith('what ') || kwLower.startsWith('how ') || kwLower.startsWith('why ') || kwLower.startsWith('who ') || /\b(definition|meaning|guide|overview)\b/i.test(kwLower),

    people_also_ask: () =>
      kwLower.startsWith('how ') || kwLower.startsWith('what ') || kwLower.startsWith('why ') || kwLower.startsWith('can ') || /\b(best|top|guide|tips|strategies)\b/i.test(kwLower),

    video_carousel: () =>
      /\b(how to|tutorial|review|demo|walkthrough|setup|install)\b/i.test(kwLower) || /\b(video\b|youtube)\b/i.test(allText),

    knowledge_panel: () =>
      /\b(who is|what is|brand|company|person|celebrity|movie|book|definition)\b/i.test(kwLower),

    local_pack: () =>
      /\b(near|local|closest|nearby|in\s+\w+$|city|town)\b/i.test(kwLower) || /\b(restaurant|plumber|dentist|doctor|lawyer|store|shop)\b/i.test(kwLower),

    image_pack: () =>
      /\b(images?|photos?|pictures?|gallery|wallpaper|design|logo|icon|illustration)\b/i.test(kwLower),

    shopping_results: () =>
      /\b(buy|shop|price|pricing|for sale|cheap|discount|deal|best|review|comparison)\b/i.test(kwLower) || /\b(product|tool|software)\b/i.test(kwLower),

    top_stories: () =>
      /\b(news|latest|update|trending|announced|launch|breaking)\b/i.test(kwLower),

    reviews: () =>
      /\b(review|rating|best|top|comparison|vs|versus|alternative)\b/i.test(kwLower) || results.some((r) => r.content_type === 'product'),

    faq: () =>
      results.some((r) => r.content_type === 'forum') || /\b(question|how|what|why|when|where)\b/i.test(kwLower),

    howto: () =>
      /\b(how to|steps?|guide|tutorial|setup|install|configure|build|create)\b/i.test(kwLower),
  };

  for (const feature of ALL_SERP_FEATURES) {
    if (presentFeatures.includes(feature)) continue;
    const isRelevant = relevantFor[feature];
    if (isRelevant && isRelevant()) {
      opportunities.push({
        feature,
        ...OPPORTUNITY_ACTIONS[feature],
      });
    }
  }

  return opportunities;
}

/**
 * Build a summary from all keyword feature results.
 */
export function buildFeaturesSummary(
  results: KeywordSerpFeatures[],
): SerpFeaturesSummary {
  const featureCounts = new Map<SerpFeature, number>();
  let maxFeaturesCount = 0;
  let keywordWithMost = '';

  for (const r of results) {
    for (const f of r.features) {
      featureCounts.set(f, (featureCounts.get(f) || 0) + 1);
    }
    if (r.features.length > maxFeaturesCount) {
      maxFeaturesCount = r.features.length;
      keywordWithMost = r.keyword;
    }
  }

  const mostCommonFeatures = Array.from(featureCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([feature]) => feature);

  return {
    mostCommonFeatures,
    keywordWithMostFeatures: keywordWithMost,
    totalFeatureTypesFound: featureCounts.size,
    totalKeywordsAnalyzed: results.length,
    keywordsWithFeatures: results.filter((r) => r.features.length > 0).length,
  };
}
