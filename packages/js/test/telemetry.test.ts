import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import {
  Haruspex,
  TelemetryClient,
  telemetryResolveEnabled as resolveEnabled,
  telemetryLoadOrCreateClientId as loadOrCreateClientId,
  telemetryTemplatize as templatize,
} from "../src/index.js";

describe("resolveEnabled", () => {
  it("DO_NOT_TRACK wins over everything", () => {
    expect(
      resolveEnabled(true, {
        DO_NOT_TRACK: "1",
        HARUSPEX_TELEMETRY: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });
  it("ctor true enables", () => {
    expect(resolveEnabled(true, {} as NodeJS.ProcessEnv)).toBe(true);
  });
  it("ctor false disables even with env on", () => {
    expect(resolveEnabled(false, { HARUSPEX_TELEMETRY: "1" } as NodeJS.ProcessEnv)).toBe(false);
  });
  it("env enables when ctor undefined", () => {
    expect(resolveEnabled(undefined, { HARUSPEX_TELEMETRY: "1" } as NodeJS.ProcessEnv)).toBe(
      true,
    );
  });
  it("default off", () => {
    expect(resolveEnabled(undefined, {} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("loadOrCreateClientId", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "haruspex-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates a uuid file then returns same value", () => {
    const p = join(dir, "id");
    const a = loadOrCreateClientId(p);
    const b = loadOrCreateClientId(p);
    expect(a).toBe(b);
    expect(readFileSync(p, "utf-8").trim()).toBe(a);
  });

  it("returns existing valid uuid", () => {
    const p = join(dir, "id");
    writeFileSync(p, "abcdef01-2345-6789-abcd-ef0123456789", "utf-8");
    expect(loadOrCreateClientId(p)).toBe("abcdef01-2345-6789-abcd-ef0123456789");
  });

  it("falls back to in-memory when fs unwritable", () => {
    const id = loadOrCreateClientId("/proc/this-is-not-writable/id");
    expect(id).toMatch(/^[0-9a-f-]{8,}$/);
  });
});

describe("templatize", () => {
  it.each([
    ["GET", "/scores/AAPL", "GET /scores/{symbol}"],
    ["GET", "/scores/aapl/history?limit=5", "GET /scores/{symbol}/history"],
    ["POST", "/scores/batch", "POST /scores/batch"],
    ["GET", "/stocks/MSFT/news", "GET /stocks/{symbol}/news"],
    ["GET", "/search?q=apple", "GET /search"],
  ])("%s %s -> %s", (m, p, want) => {
    expect(templatize(m, p)).toBe(want);
  });
});

describe("TelemetryClient + Haruspex integration", () => {
  const SCORE = {
    status: "success",
    data: { symbol: "AAPL", score: 75, outlook: "bullish", signal: "buy", topicScores: {}, change: 0 },
    meta: { requestId: "req_x", rateLimit: { limit: 60, remaining: 59, resetAt: "2026-01-01T00:00:00Z" } },
  };
  const TELEMETRY_URL = "https://haruspex.guru/api/v1/telemetry/events";
  const API_BASE = "https://haruspex.guru/api/v1";
  const server = setupServer();

  beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.close());

  it("disabled by default: no telemetry POST", async () => {
    const telemetryFetch = vi.fn();
    server.use(
      http.get(`${API_BASE}/scores/AAPL`, () => HttpResponse.json(SCORE)),
      http.post(TELEMETRY_URL, telemetryFetch),
    );
    const c = new Haruspex({ apiKey: "test-key", maxRetries: 0 });
    await c.scores.get("AAPL");
    expect(telemetryFetch).not.toHaveBeenCalled();
  });

  it("enabled posts an event with full schema after flush", async () => {
    let captured: unknown = null;
    server.use(
      http.get(`${API_BASE}/scores/AAPL`, () => HttpResponse.json(SCORE)),
      http.post(TELEMETRY_URL, async ({ request }) => {
        captured = await request.json();
        expect(request.headers.get("authorization")).toBe("Bearer test-key");
        return HttpResponse.json({ ok: true });
      }),
    );
    const dir = mkdtempSync(join(tmpdir(), "haruspex-test-"));
    try {
      const c = new Haruspex({
        apiKey: "test-key",
        maxRetries: 0,
        telemetry: { enabled: true, clientIdPath: join(dir, "id"), maxBatchSize: 1 },
      });
      await c.scores.get("aapl");
      await new Promise((r) => setTimeout(r, 50));
      const body = captured as { events: Array<Record<string, unknown>> };
      expect(body.events).toHaveLength(1);
      const ev = body.events[0];
      expect(ev.event_type).toBe("request");
      expect(ev.endpoint).toBe("GET /scores/{symbol}");
      expect(ev.sdk_name).toBe("js");
      expect(ev.symbol_or_query).toBe("AAPL");
      expect(ev.http_status).toBe(200);
      expect(ev.error_type).toBeNull();
      expect(typeof ev.latency_ms).toBe("number");
      expect(typeof ev.timestamp_iso).toBe("string");
      expect(typeof ev.anonymous_client_id).toBe("string");
      expect((ev.anonymous_client_id as string).length).toBeGreaterThan(8);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("404 records error_type=HaruspexNotFoundError", async () => {
    let captured: { events: Array<Record<string, unknown>> } | null = null;
    server.use(
      http.get(`${API_BASE}/scores/ZZZZ`, () =>
        HttpResponse.json({ status: "error", error: { message: "nf" } }, { status: 404 }),
      ),
      http.post(TELEMETRY_URL, async ({ request }) => {
        captured = (await request.json()) as { events: Array<Record<string, unknown>> };
        return HttpResponse.json({ ok: true });
      }),
    );
    const dir = mkdtempSync(join(tmpdir(), "haruspex-test-"));
    try {
      const c = new Haruspex({
        apiKey: "test-key",
        maxRetries: 0,
        telemetry: { enabled: true, clientIdPath: join(dir, "id"), maxBatchSize: 1 },
      });
      await expect(c.scores.get("ZZZZ")).rejects.toBeDefined();
      await new Promise((r) => setTimeout(r, 50));
      expect(captured).not.toBeNull();
      const ev = captured!.events[0];
      expect(ev.http_status).toBe(404);
      expect(ev.error_type).toBe("HaruspexNotFoundError");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("telemetry endpoint failure is swallowed and primary call still resolves", async () => {
    server.use(
      http.get(`${API_BASE}/scores/AAPL`, () => HttpResponse.json(SCORE)),
      http.post(TELEMETRY_URL, () => HttpResponse.json({ err: 1 }, { status: 500 })),
    );
    const dir = mkdtempSync(join(tmpdir(), "haruspex-test-"));
    try {
      const c = new Haruspex({
        apiKey: "test-key",
        maxRetries: 0,
        telemetry: { enabled: true, clientIdPath: join(dir, "id"), maxBatchSize: 1 },
      });
      const res = await c.scores.get("AAPL");
      expect(res.score).toBe(75);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("standalone TelemetryClient batches at maxBatchSize", async () => {
    const dir = mkdtempSync(join(tmpdir(), "haruspex-test-"));
    try {
      const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
      const tc = new TelemetryClient({
        apiKey: "k",
        sdkName: "js",
        sdkVersion: "0.1.3",
        options: {
          enabled: true,
          maxBatchSize: 3,
          flushIntervalMs: 60_000,
          fetch: fetchMock as unknown as typeof fetch,
          clientIdPath: join(dir, "id"),
        },
      });
      tc.record({ event_type: "request", latency_ms: 1 });
      tc.record({ event_type: "request", latency_ms: 1 });
      expect(fetchMock).not.toHaveBeenCalled();
      tc.record({ event_type: "request", latency_ms: 1 });
      await new Promise((r) => setTimeout(r, 30));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await tc.shutdown();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
