import type { Outlook, Signal, TopicSlug } from "./constants.js";

/** Per-topic score and day-over-day change. */
export interface TopicScore {
  name: string;
  score: number;
  change: number;
}

/**
 * A single intelligence score record. Returned directly for `scores.get`,
 * inside `data.scores[]` for batch and history responses.
 *
 * `topicScores` is keyed by the topic slug. The 16 known slugs are exported
 * as `TOPIC_SLUGS`; treat any unknown key as a future addition rather than
 * an error.
 */
export interface Score {
  symbol: string;
  name: string | null;
  score: number;
  previousScore?: number;
  change: number;
  outlook: Outlook;
  signal: Signal;
  topicScores: Partial<Record<TopicSlug, TopicScore>> & Record<string, TopicScore>;
  date: string;
  analyzedAt: string;
  tradingTimeline: string;
  cached: boolean;
  version: string;
  shareUrl: string;
}

export interface RateLimit {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  creditsUsed?: number;
  creditsRemaining?: number;
  rateLimit?: RateLimit;
}

export interface BatchResult {
  count: number;
  scores: Score[];
}

export interface HistoryResult {
  symbol: string;
  from?: string;
  to?: string;
  count: number;
  scores: Score[];
}

export interface SearchResultItem {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

export interface SearchResult {
  results: SearchResultItem[];
}

export interface NewsArticle {
  title: string;
  url: string;
  publishedAt?: string;
  source?: string;
  image?: string;
  [k: string]: unknown;
}

export interface NewsResult {
  symbol: string;
  articles: NewsArticle[];
}

/** Adds `_meta` carrying request-id, credits, and rate-limit headroom. */
export type WithMeta<T> = T & { _meta: ResponseMeta };

export type ScoreResponse = WithMeta<Score>;
export type BatchResponse = WithMeta<BatchResult>;
export type HistoryResponse = WithMeta<HistoryResult>;
export type SearchResponse = WithMeta<SearchResult>;
export type NewsResponse = WithMeta<NewsResult>;

export interface HistoryOptions {
  from?: string;
  to?: string;
  limit?: number;
}

export interface SearchOptions {
  limit?: number;
}

export interface NewsOptions {
  limit?: number;
}

/** Raw envelope returned by every API endpoint. */
export interface ApiEnvelope<T> {
  status: "success";
  data: T;
  meta: ResponseMeta;
}

export interface ApiErrorEnvelope {
  status: "error";
  error?: { code?: string; message?: string };
  message?: string;
  meta?: Partial<ResponseMeta>;
}
