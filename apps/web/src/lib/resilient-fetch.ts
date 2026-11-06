export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type Wait = (ms: number) => Promise<void>;

export const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 3000] as const;
export const RETRY_SAFE_HEADER = "x-retry-safe";

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const SAFE_METHODS = new Set(["GET", "HEAD"]);

const sleep: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const globalFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

function isRetryable(response: Response, isSafe: boolean): boolean {
  if (!RETRYABLE_STATUS.has(response.status)) {
    return false;
  }
  return isSafe || response.headers.get(RETRY_SAFE_HEADER) === "1";
}

type ResilientOptions = {
  base?: FetchLike;
  wait?: Wait;
  delays?: readonly number[];
};

export function createResilientFetch({
  base = globalFetch,
  wait = sleep,
  delays = RETRY_DELAYS_MS,
}: ResilientOptions = {}): FetchLike {
  return async (input, init) => {
    const isSafe = SAFE_METHODS.has(methodOf(input, init));
    for (const delay of delays) {
      try {
        const response = await base(input, init);
        if (!isRetryable(response, isSafe)) {
          return response;
        }
      } catch (error) {
        if (!isSafe || init?.signal?.aborted) {
          throw error;
        }
      }
      await wait(delay);
    }
    return base(input, init);
  };
}

export const resilientFetch = createResilientFetch({
  delays: import.meta.env.MODE === "test" ? [] : RETRY_DELAYS_MS,
});
