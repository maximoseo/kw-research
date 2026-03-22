import { describe, it, expect } from 'vitest';
import { competitorDiscoverySchema } from '@/lib/validation';

describe('competitorDiscoverySchema', () => {
  const basePayload = {
    homepageUrl: 'https://example.com',
    brandName: 'Test Brand',
    language: 'English' as const,
    market: 'New York',
    competitorUrls: '',
  };

  it('accepts valid input with all URLs', () => {
    const result = competitorDiscoverySchema.safeParse({
      ...basePayload,
      aboutUrl: 'https://example.com/about',
      sitemapUrl: 'https://example.com/sitemap.xml',
    });
    expect(result.success).toBe(true);
  });

  it('accepts input with empty aboutUrl and sitemapUrl', () => {
    const result = competitorDiscoverySchema.safeParse({
      ...basePayload,
      aboutUrl: '',
      sitemapUrl: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aboutUrl).toBe('');
      expect(result.data.sitemapUrl).toBe('');
    }
  });

  it('accepts input with missing aboutUrl and sitemapUrl', () => {
    const result = competitorDiscoverySchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aboutUrl).toBe('');
      expect(result.data.sitemapUrl).toBe('');
    }
  });

  it('rejects missing homepageUrl', () => {
    const result = competitorDiscoverySchema.safeParse({
      ...basePayload,
      homepageUrl: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid homepageUrl', () => {
    const result = competitorDiscoverySchema.safeParse({
      ...basePayload,
      homepageUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('parses competitor URLs from newline-delimited string', () => {
    const result = competitorDiscoverySchema.safeParse({
      ...basePayload,
      competitorUrls: 'https://comp1.com\nhttps://comp2.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.competitorUrls).toEqual(['https://comp1.com', 'https://comp2.com']);
    }
  });

  it('handles empty competitor URLs string', () => {
    const result = competitorDiscoverySchema.safeParse({
      ...basePayload,
      competitorUrls: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.competitorUrls).toEqual([]);
    }
  });
});
