import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  Haruspex,
  HaruspexAuthError,
  HaruspexNotFoundError,
  HaruspexRateLimitError,
  HaruspexValidationError,
  TOPIC_SLUGS,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = (name: string) => resolve(__dirname, "fixtures", name);
const loadFixture = (name: string) => JSON.parse(readFileSync(fixturePath(name), "utf-8"));

const SCORE_FIXTURE = loadFixture("score.json");
const BATCH_FIXTURE = loadFixture("batch.json");
const HISTORY_FIXTURE = loadFixture("history.json");
const SEARCH_FIXTURE = loadFixture("search.json");
const NEWS_FIXTURE = loadFixture("news.json");

const BASE = "https://haruspex.guru/api/v1";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function newClient(extra: Partial<ConstructorParameters<typeof Haruspex>[0]> = {}) {
  return new Haruspex({ apiKey: "test-key", maxRetries: 0, ...extra });
}

describe("Haruspex client construction", () => {
  it("requires an API key", () => {
    const previous = process.env.HARUSPEX_API_KEY;
    delete process.env.HARUSPEX_API_KEY;
    try {
      expect(() => new Haruspex()).toThrow(HaruspexValidationError);
    } finally {
      if (previous !== undefined) process.env.HARUSPEX_API_KEY = previous;
    }
  });

  it("reads from env if no apiKey passed", () => {
    process.env.HARUSPEX_API_KEY = "from-env";
    try {
      const c = new Haruspex();
      expect(c).toBeInstanceOf(Haruspex);
    } finally {
      delete process.env.HARUSPEX_API_KEY;
    }
  });
});

describe("scores.get", () => {
  it("returns the parsed score object plus _meta", async () => {
    server.use(
      http.get(`${BASE}/scores/AAPL`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer test-key");
        return HttpResponse.json(SCORE_FIXTURE);
      }),
    );
    const client = newClient();
    const res = await client.scores.get("aapl");
    expect(res.symbol).toBe("AAPL");
    expect(res.score).toBe(SCORE_FIXTURE.data.score);
    expect(res.outlook).toBe(SCORE_FIXTURE.data.outlook);
    expect(res._meta.requestId).toBe(SCORE_FIXTURE.meta.requestId);
    expect(res._meta.rateLimit?.limit).toBe(60);
  });

  it("uppercases the symbol", async () => {
    let captured = "";
    server.use(
      http.get(`${BASE}/scores/:sym`, ({ params }) => {
        captured = String(params.sym);
        return HttpResponse.json(SCORE_FIXTURE);
      }),
    );
    await newClient().scores.get("aapl");
    expect(captured).toBe("AAPL");
  });

  it("rejects an empty symbol client-side", () => {
    expect(() => newClient().scores.get("")).toThrow(HaruspexValidationError);
  });

  it("maps 404 to HaruspexNotFoundError", async () => {
    server.use(
      http.get(`${BASE}/scores/ZZZZ`, () =>
        HttpResponse.json(
          { status: "error", error: { message: "not found" }, meta: { requestId: "req_test" } },
          { status: 404 },
        ),
      ),
    );
    await expect(newClient().scores.get("ZZZZ")).rejects.toBeInstanceOf(HaruspexNotFoundError);
  });

  it("maps 401 to HaruspexAuthError", async () => {
    server.use(
      http.get(`${BASE}/scores/AAPL`, () =>
        HttpResponse.json({ status: "error", error: { message: "bad key" } }, { status: 401 }),
      ),
    );
    await expect(newClient().scores.get("AAPL")).rejects.toBeInstanceOf(HaruspexAuthError);
  });

  it("maps 429 to HaruspexRateLimitError with retryAfterMs", async () => {
    server.use(
      http.get(`${BASE}/scores/AAPL`, () =>
        HttpResponse.json(
          { status: "error", error: { message: "slow down" } },
          { status: 429, headers: { "retry-after": "5" } },
        ),
      ),
    );
    try {
      await newClient().scores.get("AAPL");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HaruspexRateLimitError);
      const rl = err as HaruspexRateLimitError;
      expect(rl.retryAfterMs).toBe(5000);
    }
  });
});

describe("scores.batch", () => {
  it("posts symbols and returns count + scores", async () => {
    server.use(
      http.post(`${BASE}/scores/batch`, async ({ request }) => {
        const body = (await request.json()) as { symbols: string[] };
        expect(body.symbols).toEqual(["AAPL", "NVDA", "MSFT"]);
        return HttpResponse.json(BATCH_FIXTURE);
      }),
    );
    const res = await newClient().scores.batch(["aapl", "nvda", "msft"]);
    expect(res.count).toBe(BATCH_FIXTURE.data.count);
    expect(res.scores).toHaveLength(BATCH_FIXTURE.data.scores.length);
    expect(res.scores[0].symbol).toBe("AAPL");
    expect(res._meta.requestId).toBe(BATCH_FIXTURE.meta.requestId);
  });

  it("rejects empty array client-side", () => {
    expect(() => newClient().scores.batch([])).toThrow(HaruspexValidationError);
  });

  it("rejects > 50 symbols client-side", () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `T${i}`);
    expect(() => newClient().scores.batch(tooMany)).toThrow(HaruspexValidationError);
  });
});

describe("scores.history", () => {
  it("forwards from/to/limit and returns scores[]", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/scores/AAPL/history`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(HISTORY_FIXTURE);
      }),
    );
    const res = await newClient().scores.history("AAPL", { limit: 5 });
    expect(url).toContain("limit=5");
    expect(res.count).toBe(HISTORY_FIXTURE.data.count);
    expect(res.scores).toHaveLength(HISTORY_FIXTURE.data.scores.length);
  });

  it("rejects limit > 90 client-side", () => {
    expect(() => newClient().scores.history("AAPL", { limit: 100 })).toThrow(
      HaruspexValidationError,
    );
  });
});

describe("search", () => {
  it("returns results array", async () => {
    server.use(
      http.get(`${BASE}/search`, ({ request }) => {
        const u = new URL(request.url);
        expect(u.searchParams.get("q")).toBe("apple");
        expect(u.searchParams.get("limit")).toBe("3");
        return HttpResponse.json(SEARCH_FIXTURE);
      }),
    );
    const res = await newClient().search("apple", { limit: 3 });
    expect(res.results).toHaveLength(SEARCH_FIXTURE.data.results.length);
    expect(res.results[0].symbol).toBe("AAPL");
  });
});

describe("news", () => {
  it("returns articles array", async () => {
    server.use(
      http.get(`${BASE}/stocks/AAPL/news`, () => HttpResponse.json(NEWS_FIXTURE)),
    );
    const res = await newClient().news("AAPL", { limit: 3 });
    expect(res.symbol).toBe("AAPL");
    expect(res.articles.length).toBeGreaterThan(0);
    expect(res.articles[0].url).toMatch(/^https?:\/\//);
  });
});

describe("constants", () => {
  it("TOPIC_SLUGS contains the 16 documented slugs", () => {
    expect(TOPIC_SLUGS).toHaveLength(16);
    expect(TOPIC_SLUGS).toContain("ai-exposure");
    expect(TOPIC_SLUGS).toContain("us_china_unofficial");
  });
});

describe("retries", () => {
  it("retries on 503 then succeeds", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/scores/AAPL`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ status: "error", error: { message: "boom" } }, { status: 503 });
        }
        return HttpResponse.json(SCORE_FIXTURE);
      }),
    );
    const client = new Haruspex({ apiKey: "test-key", maxRetries: 2 });
    const res = await client.scores.get("AAPL");
    expect(res.symbol).toBe("AAPL");
    expect(calls).toBe(2);
  });
});
