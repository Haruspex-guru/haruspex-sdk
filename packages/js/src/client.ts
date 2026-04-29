import {
  BASE_URL,
  MAX_BATCH,
  MAX_HISTORY_LIMIT,
  MAX_NEWS_LIMIT,
  MAX_SEARCH_LIMIT,
  SDK_VERSION,
} from "./constants.js";
import { TelemetryClient, templatize, type TelemetryOptions } from "./telemetry.js";
import {
  HaruspexAuthError,
  HaruspexError,
  HaruspexNetworkError,
  HaruspexNotFoundError,
  HaruspexRateLimitError,
  HaruspexServerError,
  HaruspexValidationError,
} from "./errors.js";
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  BatchResponse,
  HistoryOptions,
  HistoryResponse,
  NewsOptions,
  NewsResponse,
  ResponseMeta,
  ScoreResponse,
  SearchOptions,
  SearchResponse,
  WithMeta,
} from "./types.js";

export interface HaruspexOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  userAgent?: string;
  telemetry?: TelemetryOptions;
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_BASE_MS = 250;
const RETRY_MAX_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const exp = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
  const jitter = Math.random() * 0.25 * exp;
  return exp + jitter;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return undefined;
}

function normalizeSymbol(symbol: string): string {
  if (typeof symbol !== "string" || symbol.trim().length === 0) {
    throw new HaruspexValidationError("symbol must be a non-empty string");
  }
  return symbol.trim().toUpperCase();
}

function clampLimit(name: string, value: number | undefined, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) {
    throw new HaruspexValidationError(`${name} must be a positive integer`);
  }
  if (value > max) {
    throw new HaruspexValidationError(`${name} must be <= ${max}`);
  }
  return value;
}

/**
 * Haruspex API client.
 *
 * @example
 * ```ts
 * import { Haruspex } from "@haruspex-guru-sdk/sdk";
 *
 * const client = new Haruspex({ apiKey: process.env.HARUSPEX_API_KEY });
 * const aapl = await client.scores.get("AAPL");
 * console.log(aapl.score, aapl.outlook, aapl._meta.rateLimit);
 * ```
 */
export class Haruspex {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;

  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private readonly telemetry: TelemetryClient;

  constructor(options: HaruspexOptions = {}) {
    const apiKey = options.apiKey ?? process.env.HARUSPEX_API_KEY;
    if (!apiKey) {
      throw new HaruspexValidationError(
        "Missing API key. Pass `apiKey` or set HARUSPEX_API_KEY. Get a free key at https://haruspex.guru/developers, or use the public demo key documented in the README to evaluate.",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.userAgent = options.userAgent ?? `haruspex-sdk-js/${SDK_VERSION}`;

    if (typeof this.fetchImpl !== "function") {
      throw new HaruspexValidationError(
        "No fetch implementation available. Pass `fetch` in options on Node < 18.",
      );
    }

    this.telemetry = new TelemetryClient({
      apiKey: this.apiKey,
      sdkName: "js",
      sdkVersion: SDK_VERSION,
      options: options.telemetry,
    });
  }

  readonly scores = {
    /** Latest score for one ticker. */
    get: (symbol: string): Promise<ScoreResponse> => {
      const sym = normalizeSymbol(symbol);
      return this.request<ScoreResponse>(
        "GET",
        `/scores/${encodeURIComponent(sym)}`,
        undefined,
        { symbolOrQuery: sym },
      );
    },

    /** Latest scores for up to 50 tickers. */
    batch: (symbols: string[]): Promise<BatchResponse> => {
      if (!Array.isArray(symbols) || symbols.length === 0) {
        throw new HaruspexValidationError("symbols must be a non-empty array");
      }
      if (symbols.length > MAX_BATCH) {
        throw new HaruspexValidationError(`symbols length must be <= ${MAX_BATCH}`);
      }
      const normalized = symbols.map(normalizeSymbol);
      return this.request<BatchResponse>(
        "POST",
        "/scores/batch",
        { symbols: normalized },
        { symbolOrQuery: normalized.join(",") },
      );
    },

    /** Historical daily scores. */
    history: (symbol: string, opts: HistoryOptions = {}): Promise<HistoryResponse> => {
      const sym = normalizeSymbol(symbol);
      const limit = clampLimit("limit", opts.limit, MAX_HISTORY_LIMIT);
      const query = new URLSearchParams();
      if (opts.from) query.set("from", opts.from);
      if (opts.to) query.set("to", opts.to);
      if (limit !== undefined) query.set("limit", String(limit));
      const qs = query.toString();
      const path = `/scores/${encodeURIComponent(sym)}/history${qs ? `?${qs}` : ""}`;
      return this.request<HistoryResponse>("GET", path, undefined, { symbolOrQuery: sym });
    },
  };

  /** Search tickers by symbol or company name. */
  search(query: string, opts: SearchOptions = {}): Promise<SearchResponse> {
    if (typeof query !== "string" || query.trim().length === 0) {
      throw new HaruspexValidationError("query must be a non-empty string");
    }
    const limit = clampLimit("limit", opts.limit, MAX_SEARCH_LIMIT);
    const params = new URLSearchParams({ q: query.trim() });
    if (limit !== undefined) params.set("limit", String(limit));
    return this.request<SearchResponse>("GET", `/search?${params.toString()}`, undefined, {
      symbolOrQuery: query.trim(),
    });
  }

  /** Recent news articles for a ticker. */
  news(symbol: string, opts: NewsOptions = {}): Promise<NewsResponse> {
    const sym = normalizeSymbol(symbol);
    const limit = clampLimit("limit", opts.limit, MAX_NEWS_LIMIT);
    const params = new URLSearchParams();
    if (limit !== undefined) params.set("limit", String(limit));
    const qs = params.toString();
    const path = `/stocks/${encodeURIComponent(sym)}/news${qs ? `?${qs}` : ""}`;
    return this.request<NewsResponse>("GET", path, undefined, { symbolOrQuery: sym });
  }

  private async request<T extends WithMeta<unknown>>(
    method: string,
    path: string,
    body?: unknown,
    meta?: { symbolOrQuery?: string },
  ): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        return await this.requestOnce<T>(method, path, body, meta);
      } catch (err) {
        lastError = err;
        const retryable = this.isRetryable(err);
        if (!retryable || attempt === this.maxRetries) {
          throw err;
        }
        const wait =
          err instanceof HaruspexRateLimitError && err.retryAfterMs !== undefined
            ? err.retryAfterMs
            : backoffMs(attempt);
        await sleep(wait);
        attempt += 1;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new HaruspexError("Unknown error", { status: 0 });
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof HaruspexRateLimitError) return true;
    if (err instanceof HaruspexNetworkError) return true;
    if (err instanceof HaruspexServerError && RETRYABLE_STATUSES.has(err.status)) return true;
    return false;
  }

  private async requestOnce<T extends WithMeta<unknown>>(
    method: string,
    path: string,
    body?: unknown,
    meta?: { symbolOrQuery?: string },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const start =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    const recordEvent = (status: number, errType: string | null): void => {
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      this.telemetry.record({
        event_type: "request",
        endpoint: templatize(method, path),
        symbol_or_query: meta?.symbolOrQuery,
        http_status: status,
        latency_ms: Math.max(0, Math.round(now - start)),
        error_type: errType,
      });
    };

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          "User-Agent": this.userAgent,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      recordEvent(0, "HaruspexNetworkError");
      throw new HaruspexNetworkError(
        err instanceof Error ? err.message : "Network request failed",
        { status: 0 },
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!response.ok) {
      const e = this.errorFor(response, parsed);
      recordEvent(response.status, e.name);
      throw e;
    }

    const envelope = parsed as ApiEnvelope<unknown> | undefined;
    if (!envelope || envelope.status !== "success") {
      recordEvent(response.status, "HaruspexError");
      throw new HaruspexError("Malformed response from server", {
        status: response.status,
        body: parsed,
      });
    }

    recordEvent(response.status, null);

    const meta2: ResponseMeta = envelope.meta;
    const data = envelope.data;

    if (data !== null && typeof data === "object") {
      return { ...(data as object), _meta: meta2 } as T;
    }
    return { _meta: meta2, value: data } as unknown as T;
  }

  private errorFor(response: Response, parsed: unknown): HaruspexError {
    const env = (parsed ?? {}) as ApiErrorEnvelope;
    const message =
      env.error?.message ?? env.message ?? `HTTP ${response.status} ${response.statusText}`;
    const code = env.error?.code;
    const requestId = env.meta?.requestId;
    const opts = { status: response.status, code, requestId, body: parsed };

    if (response.status === 401 || response.status === 403) {
      return new HaruspexAuthError(message, opts);
    }
    if (response.status === 404) {
      return new HaruspexNotFoundError(message, opts);
    }
    if (response.status === 429) {
      return new HaruspexRateLimitError(message, {
        ...opts,
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      });
    }
    if (response.status >= 400 && response.status < 500) {
      return new HaruspexValidationError(message, opts);
    }
    return new HaruspexServerError(message, opts);
  }
}
