/* ------------------------------------------------------------------ */
/*  HTTP utilities – fetch with timeout, retry, and backoff           */
/* ------------------------------------------------------------------ */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1_000;

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Fetch with timeout using AbortController.
 * Does NOT retry — use fetchWithRetry for retry behavior.
 */
export async function fetchWithTimeout(
  url: string,
  opts: FetchOptions = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch with timeout AND retry with exponential backoff.
 * Retries on network errors and 429/5xx responses.
 */
export async function fetchWithRetry(
  url: string,
  opts: FetchOptions = {},
): Promise<Response> {
  const { maxRetries = DEFAULT_MAX_RETRIES, ...rest } = opts;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, rest);

      // Retry on rate limit or server errors
      if (response.status === 429 || (response.status >= 500 && attempt < maxRetries)) {
        const backoff = response.status === 429
          ? INITIAL_BACKOFF_MS * Math.pow(3, attempt) // longer for rate limits
          : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`[http] ${response.status} from ${url}, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(backoff);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`[http] Fetch error for ${url}: ${lastError.message}, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(backoff);
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
