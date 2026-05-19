import 'server-only';
import { log } from '@/server/log';

interface RetryOptions {
  /** Number of attempts (default: 3). */
  attempts?: number;
  /** Backoff strategy: 'exp' for exponential, 'linear' for fixed delay. */
  backoff?: 'exp' | 'linear';
  /** Base delay in milliseconds (default: 1000). */
  baseDelayMs?: number;
}

/**
 * Retry a function with configurable attempts and backoff.
 *
 * - `backoff: 'exp'` (default): delays double after each attempt (1s, 2s, 4s…).
 * - `backoff: 'linear'`: same delay between every attempt.
 *
 * Re-throws the last error if all attempts are exhausted.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const backoff = options.backoff ?? 'exp';
  const baseDelayMs = options.baseDelayMs ?? 1000;

  let lastError: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        const delay = backoff === 'exp'
          ? baseDelayMs * 2 ** i
          : baseDelayMs;
        log.warn(`[retry] Attempt ${i + 1}/${attempts} failed, retrying in ${delay}ms:`, String(err));
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
