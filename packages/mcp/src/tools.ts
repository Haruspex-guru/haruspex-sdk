import {
  Haruspex,
  HaruspexAuthError,
  HaruspexError,
  HaruspexNotFoundError,
  HaruspexRateLimitError,
  TelemetryClient,
  type Score,
  type SearchResultItem,
  type NewsArticle,
} from "@haruspex-guru-sdk/sdk";

export const TOOL_DEFINITIONS = [
  {
    name: "get_stock_score",
    description:
      "Get the latest Haruspex Score (0-100) for a stock. Returns score, outlook, trading signal, topic breakdowns, and a shareable URL.",
    inputSchema: {
      type: "object",
      required: ["symbol"],
      properties: {
        symbol: {
          type: "string",
          description: "Ticker symbol, e.g. AAPL or NVDA.",
        },
      },
    },
  },
  {
    name: "get_batch_scores",
    description:
      "Get latest Haruspex Scores for multiple stocks at once (up to 50). Great for comparing several tickers or building a watchlist overview.",
    inputSchema: {
      type: "object",
      required: ["symbols"],
      properties: {
        symbols: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 50,
          description: "Up to 50 ticker symbols.",
        },
      },
    },
  },
  {
    name: "get_stock_score_history",
    description:
      "Get historical daily Haruspex Scores for a stock over a date range. Useful for trend analysis and identifying momentum shifts.",
    inputSchema: {
      type: "object",
      required: ["symbol"],
      properties: {
        symbol: { type: "string" },
        from: { type: "string", description: "Start date YYYY-MM-DD." },
        to: { type: "string", description: "End date YYYY-MM-DD." },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 90,
          description: "Max number of days. Default 30.",
        },
      },
    },
  },
  {
    name: "search_stocks",
    description:
      "Search for stocks by symbol or company name. Use this to find the correct ticker symbol before fetching a score.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
  },
  {
    name: "get_stock_news",
    description:
      "Get recent news articles for a stock. Useful for understanding what's driving score changes.",
    inputSchema: {
      type: "object",
      required: ["symbol"],
      properties: {
        symbol: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
  },
] as const;

interface TextContent {
  type: "text";
  text: string;
}

interface ToolResult {
  content: TextContent[];
  isError?: boolean;
}

function text(content: string): ToolResult {
  return { content: [{ type: "text", text: content }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function changeMarker(change: number): string {
  if (change > 0) return `+${change}`;
  if (change < 0) return `${change}`;
  return "=0";
}

function formatScore(s: Score): string {
  const lines = [
    `**${s.symbol}** — Haruspex Score: **${s.score}/100** (${s.outlook})`,
    `Signal: ${s.signal} | Change: ${changeMarker(s.change)}`,
  ];
  if (s.shareUrl) lines.push("", `Share URL: ${s.shareUrl}`);

  const topics = Object.values(s.topicScores)
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (topics.length > 0) {
    lines.push("", "Topic Scores:");
    for (const t of topics) {
      lines.push(`  ${t.name}: ${t.score}/100 (${changeMarker(t.change)})`);
    }
  }
  return lines.join("\n");
}

function formatSearch(results: SearchResultItem[]): string {
  if (results.length === 0) return "No results.";
  const header = "| Symbol | Name | Exchange | Type |\n| --- | --- | --- | --- |";
  const rows = results.map(
    (r) => `| ${r.symbol} | ${r.name} | ${r.exchange ?? ""} | ${r.type ?? ""} |`,
  );
  return [header, ...rows].join("\n");
}

function formatNews(symbol: string, articles: NewsArticle[]): string {
  if (articles.length === 0) return `No recent news for ${symbol}.`;
  const lines = [`Recent news for **${symbol}**:`, ""];
  articles.forEach((a, i) => {
    lines.push(`${i + 1}. **${a.title}**`);
    lines.push(`   ${a.url}`);
    if (a.source) lines.push(`   ${a.source}${a.publishedAt ? ` — ${a.publishedAt}` : ""}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

function rateLimitMessage(err: HaruspexRateLimitError): string {
  const seconds = err.retryAfterMs ? Math.ceil(err.retryAfterMs / 1000) : 60;
  return `Rate limit exceeded. Try again in ${seconds} seconds, or upgrade at https://haruspex.guru/developers.`;
}

function mapError(err: unknown): ToolResult {
  if (err instanceof HaruspexNotFoundError) {
    return errorResult(
      `Symbol not found in Haruspex scoring universe.${err.requestId ? ` (request ${err.requestId})` : ""}`,
    );
  }
  if (err instanceof HaruspexAuthError) {
    return errorResult(
      "Authentication failed. Check HARUSPEX_API_KEY. Get a free key at https://haruspex.guru/developers.",
    );
  }
  if (err instanceof HaruspexRateLimitError) {
    return errorResult(rateLimitMessage(err));
  }
  if (err instanceof HaruspexError) {
    return errorResult(err.message);
  }
  return errorResult(err instanceof Error ? err.message : String(err));
}

function asString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function asStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array of strings`);
  if (value.length === 0) throw new Error(`${name} must contain at least one symbol`);
  if (value.length > 50) throw new Error(`${name} must contain at most 50 symbols`);
  return value.map((s, i) => asString(s, `${name}[${i}]`));
}

function asOptionalInt(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }
  return value;
}

function asOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function symbolOrQueryFromArgs(name: string, args: Record<string, unknown>): string | undefined {
  if (name === "search_stocks" && typeof args.query === "string") return args.query;
  if (typeof args.symbol === "string") return args.symbol.toUpperCase();
  if (Array.isArray(args.symbols)) return (args.symbols as unknown[]).filter((s) => typeof s === "string").join(",");
  return undefined;
}

export async function handleToolCall(
  client: Haruspex,
  name: string,
  args: Record<string, unknown>,
  telemetry?: TelemetryClient,
): Promise<ToolResult> {
  const start =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  const recordEvent = (status: number, errType: string | null): void => {
    if (!telemetry) return;
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    telemetry.record({
      event_type: "tool_call",
      tool_name: name,
      symbol_or_query: symbolOrQueryFromArgs(name, args),
      http_status: status,
      latency_ms: Math.max(0, Math.round(now - start)),
      error_type: errType,
    });
  };
  try {
    let result: ToolResult;
    switch (name) {
      case "get_stock_score": {
        const symbol = asString(args.symbol, "symbol");
        const res = await client.scores.get(symbol);
        result = text(formatScore(res));
        break;
      }
      case "get_batch_scores": {
        const symbols = asStringArray(args.symbols, "symbols");
        const res = await client.scores.batch(symbols);
        const blocks = res.scores.map(formatScore);
        result = text(blocks.join("\n\n"));
        break;
      }
      case "get_stock_score_history": {
        const symbol = asString(args.symbol, "symbol");
        const from = asOptionalString(args.from, "from");
        const to = asOptionalString(args.to, "to");
        const limit = asOptionalInt(args.limit, "limit");
        const res = await client.scores.history(symbol, { from, to, limit });
        const header = `Historical scores for ${res.symbol} (${res.count} days):`;
        const blocks = res.scores.map(formatScore);
        result = text([header, "", ...blocks].join("\n\n"));
        break;
      }
      case "search_stocks": {
        const query = asString(args.query, "query");
        const limit = asOptionalInt(args.limit, "limit");
        const res = await client.search(query, { limit });
        result = text(formatSearch(res.results));
        break;
      }
      case "get_stock_news": {
        const symbol = asString(args.symbol, "symbol");
        const limit = asOptionalInt(args.limit, "limit");
        const res = await client.news(symbol, { limit });
        result = text(formatNews(res.symbol, res.articles));
        break;
      }
      default:
        recordEvent(0, "UnknownTool");
        return errorResult(`Unknown tool: ${name}`);
    }
    recordEvent(200, null);
    return result;
  } catch (err) {
    const status = err instanceof HaruspexError ? err.status : 0;
    const errType =
      err instanceof Error && err.constructor && err.constructor.name
        ? err.constructor.name
        : "Error";
    recordEvent(status, errType);
    return mapError(err);
  }
}
