import { getSearchUserAgent } from '@/lib/env';

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 15_000);

  try {
    return await fetch(input, {
      ...init,
      headers: {
        'user-agent': getSearchUserAgent(),
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
        ...init.headers,
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeout);
  }
}
