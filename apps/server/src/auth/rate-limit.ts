export type LoginLimiter = {
  readonly size: number;
  isLimited(key: string): boolean;
  record(key: string): void;
  reset(key: string): void;
};

export type LimiterOptions = {
  limit: number;
  windowMs: number;
  now: () => number;
};

export const LOGIN_LIMIT = { limit: 5, windowMs: 60_000 } as const;

export const MAX_TRACKED_KEYS = 10_000;

export function createLoginLimiter(options: LimiterOptions): LoginLimiter {
  const attempts = new Map<string, number[]>();
  const prune = () => {
    const threshold = options.now() - options.windowMs;
    for (const [key, times] of attempts) {
      if (!times.some((time) => time > threshold)) {
        attempts.delete(key);
      }
    }
  };
  const recent = (key: string) => {
    const threshold = options.now() - options.windowMs;
    const kept = (attempts.get(key) ?? []).filter((time) => time > threshold);
    if (kept.length === 0) {
      attempts.delete(key);
    } else {
      attempts.set(key, kept);
    }
    return kept;
  };
  return {
    get size() {
      return attempts.size;
    },
    isLimited: (key) => recent(key).length >= options.limit,
    record: (key) => {
      if (!attempts.has(key) && attempts.size >= MAX_TRACKED_KEYS) {
        prune();
      }
      attempts.set(key, [...recent(key), options.now()]);
    },
    reset: (key) => {
      attempts.delete(key);
    },
  };
}

export const RATE_LIMITS = {
  loginAddress: { limit: 30, windowMs: 60_000 },
  register: { limit: 5, windowMs: 600_000 },
  runs: { limit: 60, windowMs: 60_000 },
  writes: { limit: 300, windowMs: 60_000 },
} as const;

export type RateLimits = Record<keyof typeof RATE_LIMITS, LoginLimiter>;

export function createRateLimits(now: () => number): RateLimits {
  return {
    loginAddress: createLoginLimiter({ ...RATE_LIMITS.loginAddress, now }),
    register: createLoginLimiter({ ...RATE_LIMITS.register, now }),
    runs: createLoginLimiter({ ...RATE_LIMITS.runs, now }),
    writes: createLoginLimiter({ ...RATE_LIMITS.writes, now }),
  };
}

export function isOverLimit(limiter: LoginLimiter | undefined, key: string): boolean {
  if (!limiter) {
    return false;
  }
  if (limiter.isLimited(key)) {
    return true;
  }
  limiter.record(key);
  return false;
}
