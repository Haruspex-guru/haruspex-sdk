import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  HaruspexAuthError,
  HaruspexNotFoundError,
  HaruspexRateLimitError,
} from "@haruspex-guru-sdk/sdk";
import { handleToolCall, TOOL_DEFINITIONS } from "../src/tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = (name: string) =>
  resolve(__dirname, "../../js/test/fixtures", name);
const loadFixture = (name: string) =>
  JSON.parse(readFileSync(fixturePath(name), "utf-8"));

const SCORE = loadFixture("score.json");
const BATCH = loadFixture("batch.json");
const HISTORY = loadFixture("history.json");
const SEARCH = loadFixture("search.json");
const NEWS = loadFixture("news.json");

function makeClient(stub: Record<string, unknown>) {
  return stub as any;
}

describe("TOOL_DEFINITIONS", () => {
  it("registers exactly the five expected tools", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toEqual([
      "get_stock_score",
      "get_batch_scores",
      "get_stock_score_history",
      "search_stocks",
      "get_stock_news",
    ]);
  });
});

describe("get_stock_score", () => {
  it("formats a successful score with topic breakdown", async () => {
    const client = makeClient({
      scores: { get: vi.fn().mockResolvedValue({ ...SCORE.data, _meta: SCORE.meta }) },
    });
    const res = await handleToolCall(client, "get_stock_score", { symbol: "AAPL" });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain("AAPL");
    expect(res.content[0].text).toContain("Haruspex Score");
    expect(res.content[0].text).toContain(`${SCORE.data.score}/100`);
    expect(res.content[0].text).toContain("ai-exposure:");
  });

  it("returns isError on HaruspexNotFoundError", async () => {
    const client = makeClient({
      scores: {
        get: vi
          .fn()
          .mockRejectedValue(new HaruspexNotFoundError("nope", { status: 404 })),
      },
    });
    const res = await handleToolCall(client, "get_stock_score", { symbol: "ZZZZ" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/not found/i);
  });

  it("returns isError on HaruspexAuthError", async () => {
    const client = makeClient({
      scores: {
        get: vi
          .fn()
          .mockRejectedValue(new HaruspexAuthError("bad", { status: 401 })),
      },
    });
    const res = await handleToolCall(client, "get_stock_score", { symbol: "AAPL" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Authentication failed/i);
  });

  it("returns isError on HaruspexRateLimitError with retry seconds", async () => {
    const client = makeClient({
      scores: {
        get: vi.fn().mockRejectedValue(
          new HaruspexRateLimitError("slow", {
            status: 429,
            retryAfterMs: 30_000,
          }),
        ),
      },
    });
    const res = await handleToolCall(client, "get_stock_score", { symbol: "AAPL" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("30 seconds");
  });

  it("rejects empty symbol", async () => {
    const client = makeClient({ scores: { get: vi.fn() } });
    const res = await handleToolCall(client, "get_stock_score", { symbol: "" });
    expect(res.isError).toBe(true);
  });
});

describe("get_batch_scores", () => {
  it("formats multiple scores separated by blank lines", async () => {
    const client = makeClient({
      scores: { batch: vi.fn().mockResolvedValue({ ...BATCH.data, _meta: BATCH.meta }) },
    });
    const res = await handleToolCall(client, "get_batch_scores", {
      symbols: ["AAPL", "NVDA", "MSFT"],
    });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain("AAPL");
    expect(res.content[0].text).toContain("NVDA");
    expect(res.content[0].text).toContain("MSFT");
  });

  it("rejects empty array", async () => {
    const client = makeClient({ scores: { batch: vi.fn() } });
    const res = await handleToolCall(client, "get_batch_scores", { symbols: [] });
    expect(res.isError).toBe(true);
  });

  it("rejects > 50 symbols", async () => {
    const client = makeClient({ scores: { batch: vi.fn() } });
    const tooMany = Array.from({ length: 51 }, (_, i) => `T${i}`);
    const res = await handleToolCall(client, "get_batch_scores", { symbols: tooMany });
    expect(res.isError).toBe(true);
  });
});

describe("get_stock_score_history", () => {
  it("returns header plus per-day blocks", async () => {
    const client = makeClient({
      scores: {
        history: vi.fn().mockResolvedValue({ ...HISTORY.data, _meta: HISTORY.meta }),
      },
    });
    const res = await handleToolCall(client, "get_stock_score_history", {
      symbol: "AAPL",
      limit: 5,
    });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain("Historical scores for AAPL");
  });
});

describe("search_stocks", () => {
  it("formats a markdown table", async () => {
    const client = makeClient({
      search: vi.fn().mockResolvedValue({ ...SEARCH.data, _meta: SEARCH.meta }),
    });
    const res = await handleToolCall(client, "search_stocks", { query: "apple", limit: 3 });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain("| Symbol |");
    expect(res.content[0].text).toContain("AAPL");
  });
});

describe("get_stock_news", () => {
  it("formats a numbered list", async () => {
    const client = makeClient({
      news: vi.fn().mockResolvedValue({ ...NEWS.data, _meta: NEWS.meta }),
    });
    const res = await handleToolCall(client, "get_stock_news", { symbol: "AAPL", limit: 3 });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toMatch(/Recent news for/);
    expect(res.content[0].text).toContain(NEWS.data.articles[0].url);
  });
});

describe("unknown tool", () => {
  it("returns isError", async () => {
    const client = makeClient({});
    const res = await handleToolCall(client, "made_up_tool", {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Unknown tool/);
  });
});
