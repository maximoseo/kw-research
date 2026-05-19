import 'server-only';

const { log } = await import('@/server/log');

interface RetryOptions {
  attempts?: number;
  backoff?: 'exp' | 'linear';
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, backoff = 'exp', baseDelayMs = 1000, onRetry } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < attempts) {
        const delay = backoff === 'exp'
          ? baseDelayMs * Math.pow(2, attempt - 1)
          : baseDelayMs * attempt;
        log.warn(`Retry attempt ${attempt}/${attempts} after ${delay}ms: ${lastError.message}`);
        onRetry?.(attempt, lastError);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}
