import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  HaruspexNotFoundError,
  TelemetryClient,
} from "@haruspex-guru-sdk/sdk";
import { handleToolCall } from "../src/tools.js";

const SCORE_DATA = {
  symbol: "AAPL",
  score: 75,
  outlook: "bullish",
  signal: "buy",
  change: 0,
  topicScores: {},
  _meta: { requestId: "r" },
};

function makeStub(stub: Record<string, unknown>): any {
  return stub;
}

function makeTelemetry(dir: string, fetchMock: typeof fetch) {
  return new TelemetryClient({
    apiKey: "test-key",
    sdkName: "mcp",
    sdkVersion: "0.1.3",
    options: {
      enabled: true,
      maxBatchSize: 1,
      flushIntervalMs: 60_000,
      fetch: fetchMock,
      clientIdPath: join(dir, "id"),
    },
  });
}

describe("MCP telemetry", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "haruspex-mcp-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("records tool_call event on success", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const t = makeTelemetry(dir, fetchMock as unknown as typeof fetch);
    const client = makeStub({
      scores: { get: vi.fn().mockResolvedValue(SCORE_DATA) },
    });
    const res = await handleToolCall(client, "get_stock_score", { symbol: "AAPL" }, t);
    expect(res.isError).toBeUndefined();
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    const body = JSON.parse(String((call[1] as RequestInit).body));
    const ev = body.events[0];
    expect(ev.event_type).toBe("tool_call");
    expect(ev.tool_name).toBe("get_stock_score");
    expect(ev.symbol_or_query).toBe("AAPL");
    expect(ev.http_status).toBe(200);
    expect(ev.error_type).toBeNull();
    expect(ev.sdk_name).toBe("mcp");
    expect(typeof ev.latency_ms).toBe("number");
    await t.shutdown();
  });

  it("records error_type on HaruspexNotFoundError, isError preserved", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const t = makeTelemetry(dir, fetchMock as unknown as typeof fetch);
    const client = makeStub({
      scores: {
        get: vi.fn().mockRejectedValue(new HaruspexNotFoundError("nf", { status: 404 })),
      },
    });
    const res = await handleToolCall(client, "get_stock_score", { symbol: "ZZZZ" }, t);
    expect(res.isError).toBe(true);
    await new Promise((r) => setTimeout(r, 30));
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const ev = body.events[0];
    expect(ev.http_status).toBe(404);
    expect(ev.error_type).toBe("HaruspexNotFoundError");
    expect(ev.tool_name).toBe("get_stock_score");
    await t.shutdown();
  });

  it("disabled telemetry posts nothing", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const t = new TelemetryClient({
      apiKey: "test-key",
      sdkName: "mcp",
      sdkVersion: "0.1.3",
      options: {
        enabled: false,
        fetch: fetchMock as unknown as typeof fetch,
        clientIdPath: join(dir, "id"),
      },
    });
    const client = makeStub({
      scores: { get: vi.fn().mockResolvedValue(SCORE_DATA) },
    });
    await handleToolCall(client, "get_stock_score", { symbol: "AAPL" }, t);
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).not.toHaveBeenCalled();
    await t.shutdown();
  });

  it("search_stocks records query as symbol_or_query", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const t = makeTelemetry(dir, fetchMock as unknown as typeof fetch);
    const client = makeStub({
      search: vi.fn().mockResolvedValue({ results: [], _meta: { requestId: "r" } }),
    });
    await handleToolCall(client, "search_stocks", { query: "apple inc" }, t);
    await new Promise((r) => setTimeout(r, 30));
    const ev = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)).events[0];
    expect(ev.tool_name).toBe("search_stocks");
    expect(ev.symbol_or_query).toBe("apple inc");
    await t.shutdown();
  });
});
