export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeKeyword(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, ' ')
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
  if (language === 'Hebrew') {
    const slug = normalizeWhitespace(value)
      .replace(/[^\u0590-\u05ff0-9\s-]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `/${slug || 'pillar'}/`;
  }

  const slug = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]+/g, '')
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
