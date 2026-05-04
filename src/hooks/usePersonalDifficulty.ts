'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PersonalDifficultyData } from '@/components/research/PersonalDifficultyBadge';

const STORAGE_KEY = 'kw-research:personal-diff-cache';

interface CacheEntry {
  data: PersonalDifficultyData;
  cachedAt: number;
}

/* ─────────────────────────────────────────────
   localStorage cache (survives page refresh)
   ───────────────────────────────────────────── */

function loadCache(): Map<string, CacheEntry> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const map = new Map<string, CacheEntry>();
    for (const [key, entry] of Object.entries(parsed)) {
      // Expire after 24h
      if (Date.now() - entry.cachedAt < 24 * 60 * 60 * 1000) {
        map.set(key, entry);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveCache(map: Map<string, CacheEntry>) {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, CacheEntry> = {};
    for (const [key, entry] of map) {
      obj[key] = entry;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* quota exceeded */
  }
}

/* ─────────────────────────────────────────────
   Hook
   ───────────────────────────────────────────── */

interface UsePersonalDifficultyOptions {
  /** User's domain */
  domain: string;
  /** Keywords to analyze */
  keywords: string[];
  /** Batch size for parallel requests */
  batchSize?: number;
  /** Delay between batches (ms) */
  batchDelayMs?: number;
}

interface UsePersonalDifficultyResult {
  /** Map of keyword → personal difficulty data */
  dataMap: Map<string, PersonalDifficultyData>;
  /** Whether the initial fetch is in progress */
  loading: boolean;
  /** Number of keywords still being fetched */
  pendingCount: number;
  /** Refetch all keywords (clears cache and re-fetches) */
  refetch: () => void;
}

function cacheKey(keyword: string, domain: string): string {
  return `${keyword.toLowerCase().trim()}|||${domain.toLowerCase().trim()}`;
}

export function usePersonalDifficulty({
  domain,
  keywords,
  batchSize = 5,
  batchDelayMs = 300,
}: UsePersonalDifficultyOptions): UsePersonalDifficultyResult {
  const [dataMap, setDataMap] = useState<Map<string, PersonalDifficultyData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const domainRef = useRef(domain);

  const fetchOne = useCallback(
    async (keyword: string, signal: AbortSignal): Promise<PersonalDifficultyData | null> => {
      try {
        const res = await fetch('/api/keywords/personal-difficulty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, domain }),
          signal,
        });
        if (!res.ok) return null;
        const json = await res.json();
        return {
          personalDifficulty: json.personalDifficulty,
          genericDifficulty: json.genericDifficulty,
          explanation: json.explanation,
          confidence: json.confidence,
          gapToTop3: json.gapToTop3,
        };
      } catch (err) {
        if ((err as Error).name === 'AbortError') return null;
        return null;
      }
    },
    [domain],
  );

  const fetchAll = useCallback(async () => {
    // Abort previous fetch
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    // Load from localStorage cache
    const localCache = loadCache();

    // Determine which keywords need fetching
    const toFetch: string[] = [];
    const initialMap = new Map<string, PersonalDifficultyData>();

    for (const kw of keywords) {
      const key = cacheKey(kw, domain);
      const cached = localCache.get(key);
      if (cached) {
        initialMap.set(kw, cached.data);
      } else {
        toFetch.push(kw);
      }
    }

    setDataMap(initialMap);

    if (toFetch.length === 0) {
      setLoading(false);
      setPendingCount(0);
      return;
    }

    setLoading(true);
    setPendingCount(toFetch.length);

    // Process in batches
    const newMap = new Map(initialMap);
    const updatedLocalCache = new Map(localCache);

    for (let i = 0; i < toFetch.length; i += batchSize) {
      if (signal.aborted) break;

      const batch = toFetch.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((kw) => fetchOne(kw, signal)),
      );

      for (let j = 0; j < batch.length; j++) {
        const kw = batch[j];
        const result = results[j];
        if (result.status === 'fulfilled' && result.value) {
          newMap.set(kw, result.value);
          const key = cacheKey(kw, domain);
          updatedLocalCache.set(key, { data: result.value, cachedAt: Date.now() });
        }
      }

      // Update UI progressively
      setDataMap(new Map(newMap));
      setPendingCount(toFetch.length - i - batch.length);

      // Save to localStorage progressively
      saveCache(updatedLocalCache);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < toFetch.length && !signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }

    if (!signal.aborted) {
      setLoading(false);
      setPendingCount(0);
    }
  }, [keywords, domain, batchSize, batchDelayMs, fetchOne]);

  useEffect(() => {
    // Only refetch if domain or keywords changed
    if (domain !== domainRef.current || keywords.length > 0) {
      domainRef.current = domain;
      fetchAll();
    }

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [domain, keywords, fetchAll]);

  const refetch = useCallback(() => {
    // Clear localStorage cache for this domain
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
          const prefix = `|||${domain.toLowerCase().trim()}`;
          for (const key of Object.keys(parsed)) {
            if (key.endsWith(prefix)) delete parsed[key];
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      } catch {
        /* ignore */
      }
    }
    fetchAll();
  }, [domain, fetchAll]);

  return { dataMap, loading, pendingCount, refetch };
}
