export type LoginLimiter = {
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

export function createLoginLimiter(options: LimiterOptions): LoginLimiter {
  const attempts = new Map<string, number[]>();
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
    isLimited: (key) => recent(key).length >= options.limit,
    record: (key) => {
      attempts.set(key, [...recent(key), options.now()]);
    },
    reset: (key) => {
      attempts.delete(key);
    },
  };
}
