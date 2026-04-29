export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export type FixedWindowRateLimiter = {
  consume: (key: string, now?: Date) => RateLimitResult;
};

type FixedWindowRateLimiterOptions = {
  windowSeconds: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAtMs: number;
};

export function createFixedWindowRateLimiter(options: FixedWindowRateLimiterOptions): FixedWindowRateLimiter {
  const windowMs = Math.max(1, options.windowSeconds) * 1000;
  const max = Math.max(1, options.max);
  const buckets = new Map<string, Bucket>();

  return {
    consume(key: string, now = new Date()) {
      const nowMs = now.getTime();
      let bucket = buckets.get(key);

      if (!bucket || bucket.resetAtMs <= nowMs) {
        bucket = {
          count: 0,
          resetAtMs: nowMs + windowMs,
        };
        buckets.set(key, bucket);
      }

      bucket.count += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000));

      if (bucket.count > max) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(bucket.resetAtMs),
          retryAfterSeconds,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, max - bucket.count),
        resetAt: new Date(bucket.resetAtMs),
        retryAfterSeconds,
      };
    },
  };
}
