export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeKeyword(value: string) {
  // Keep: Latin, Hebrew, Arabic, Cyrillic, CJK, digits, spaces
  // Strip: punctuation, symbols, special chars
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9\u00C0-\u024F\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\s]+/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function keywordTokens(value: string) {
  return normalizeKeyword(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

export function jaccardSimilarity(left: string, right: string) {
  const leftTokens = new Set(keywordTokens(left));
  const rightTokens = new Set(keywordTokens(right));
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))];
}

export function ensureBrandFirst(brandName: string, keywords: string[]) {
  const cleaned = dedupeStrings(keywords.filter(Boolean));
  const withoutBrand = cleaned.filter((value) => normalizeKeyword(value) !== normalizeKeyword(brandName));
  return [brandName, ...withoutBrand];
}

export function buildSlugPath(value: string, language: 'English' | 'Hebrew') {
  const normalized = normalizeWhitespace(value);

  if (language === 'Hebrew') {
    const slug = normalized
      .replace(/[^\u0590-\u05ff0-9\s-]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `/${slug || 'pillar'}/`;
  }

  const slug = normalized
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `/${slug || 'pillar'}/`;
}

export function topKeywordFingerprint(values: string[]) {
  return dedupeStrings(values.map((value) => normalizeKeyword(value)))
    .filter(Boolean)
    .sort()
    .join('|');
}

export function ngramTokens(value: string, n = 3): Set<string> {
  const norm = normalizeKeyword(value).replace(/\s+/g, '');
  const grams = new Set<string>();
  for (let i = 0; i <= norm.length - n; i++) {
    grams.add(norm.slice(i, i + n));
  }
  return grams;
}

export function ngramSimilarity(left: string, right: string, n = 3): number {
  const leftGrams = ngramTokens(left, n);
  const rightGrams = ngramTokens(right, n);
  if (!leftGrams.size || !rightGrams.size) return 0;

  const intersection = [...leftGrams].filter((g) => rightGrams.has(g)).length;
  const union = new Set([...leftGrams, ...rightGrams]).size;
  return union === 0 ? 0 : intersection / union;
}

export function containsAny(haystack: string, needles: string[]): string | null {
  const lower = haystack.toLowerCase();
  for (const needle of needles) {
    if (needle && lower.includes(needle.toLowerCase())) {
      return needle;
    }
  }
  return null;
}
