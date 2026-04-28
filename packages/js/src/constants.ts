/**
 * Default base URL for the Haruspex API. The Cloud Functions origin is not
 * publicly reachable; always route through `haruspex.guru`.
 */
export const BASE_URL = "https://haruspex.guru/api/v1";

/**
 * Topic dimensions returned in `Score.topicScores`. Treated as a const tuple
 * so callers can iterate them; the API may add new topics over time.
 */
export const TOPIC_SLUGS = [
  "ai-exposure",
  "climate-risk",
  "competitors",
  "concentration-risk",
  "earnings",
  "esg",
  "github-activity",
  "insider-trading",
  "institutional",
  "macro",
  "management",
  "patents",
  "regulatory",
  "supplychain",
  "us_china_official",
  "us_china_unofficial",
] as const;

export type TopicSlug = (typeof TOPIC_SLUGS)[number];

export const OUTLOOKS = ["bullish", "neutral", "bearish"] as const;
export type Outlook = (typeof OUTLOOKS)[number];

export const SIGNALS = ["buy", "hold", "sell"] as const;
export type Signal = (typeof SIGNALS)[number];

export const MAX_BATCH = 50;
export const MAX_HISTORY_LIMIT = 90;
export const MAX_SEARCH_LIMIT = 20;
export const MAX_NEWS_LIMIT = 20;
