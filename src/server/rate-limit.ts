import 'server-only';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitOptions {
  user: string;
  perMinute: number;
}

const buckets = new Map<string, TokenBucket>();

/**
 * Simple token-bucket rate limiter.
 *
 * Returns true if the action is allowed, false if the rate limit has been exceeded.
 * Tokens refill at a rate of `perMinute` per 60 seconds.
 */
export function rateLimit(
  _action: string,
  options: RateLimitOptions,
): boolean {
  const now = Date.now();
  const key = `${options.user}:${_action}`;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: options.perMinute, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsedMs = now - bucket.lastRefill;
  const refillRate = options.perMinute / 60_000; // tokens per ms
  const newTokens = elapsedMs * refillRate;
  bucket.tokens = Math.min(options.perMinute, bucket.tokens + newTokens);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}
