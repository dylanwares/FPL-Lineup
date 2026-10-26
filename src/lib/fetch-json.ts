export interface FetchJsonOptions {
  /** Retries after the first attempt. */
  retries?: number;
  /** First backoff delay; doubles each retry, with jitter. */
  baseDelayMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class FetchJsonError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchJsonError";
  }
}

// The FPL API rejects some default server user agents.
const DEFAULT_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; FPLLineup/1.0; +https://fpllineup.com)",
  accept: "application/json",
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isRetryable(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * GET JSON with a timeout and exponential backoff on network errors, 429 and
 * 5xx. Honours Retry-After (seconds). 4xx other than 408/429 fail immediately.
 */
export function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  return fetchWithRetry(url, opts, (res) => res.json() as Promise<T>);
}

/** GET text (e.g. an RSS feed), with fetchJson's timeout and retries. Pass an `accept` header. */
export function fetchText(url: string, opts: FetchJsonOptions = {}): Promise<string> {
  return fetchWithRetry(url, opts, (res) => res.text());
}

async function fetchWithRetry<T>(
  url: string,
  opts: FetchJsonOptions,
  read: (res: Response) => Promise<T>,
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 500,
    timeoutMs = 15_000,
    headers,
    fetchImpl = fetch,
    sleep = defaultSleep,
  } = opts;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let retryAfterMs: number | null = null;
    try {
      const res = await fetchImpl(url, {
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await read(res);

      lastError = new FetchJsonError(`GET ${url} failed with ${res.status}`, url, res.status);
      if (!isRetryable(res.status)) throw lastError;
      const retryAfter = Number(res.headers.get("retry-after"));
      if (retryAfter > 0) retryAfterMs = retryAfter * 1000;
    } catch (err) {
      if (err instanceof FetchJsonError && err.status && !isRetryable(err.status)) throw err;
      lastError = err;
    }
    if (attempt < retries) {
      const backoff = baseDelayMs * 2 ** attempt * (0.75 + Math.random() * 0.5);
      await sleep(retryAfterMs ?? backoff);
    }
  }
  throw lastError instanceof Error ? lastError : new FetchJsonError(`GET ${url} failed`, url);
}
