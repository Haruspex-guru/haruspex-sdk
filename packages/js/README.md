# @haruspex/sdk

Official TypeScript / JavaScript SDK for the [Haruspex](https://haruspex.guru)
API. Stock intelligence scores (0–100) across 16 dimensions, with outlook,
trading signal, history, search, and news.

```bash
npm install @haruspex/sdk
```

Node 18+ (uses the global `fetch`). Zero runtime dependencies. Ships ESM,
CJS, and `.d.ts`.

## Quickstart

```ts
import { Haruspex } from "@haruspex/sdk";

const client = new Haruspex({
  apiKey: process.env.HARUSPEX_API_KEY,
});

const aapl = await client.scores.get("AAPL");
console.log(`${aapl.symbol}: ${aapl.score}/100 (${aapl.outlook})`);
console.log(`Rate-limit remaining: ${aapl._meta.rateLimit?.remaining}`);
```

Every response carries a `_meta` field with `requestId`, `creditsRemaining`,
and `rateLimit`, so you can observe credit/rate headroom without a separate
request.

## API

### `new Haruspex(options)`

| Option       | Type                  | Default                              |
| ------------ | --------------------- | ------------------------------------ |
| `apiKey`     | `string`              | `process.env.HARUSPEX_API_KEY`       |
| `baseUrl`    | `string`              | `https://haruspex.guru/api/v1`       |
| `timeoutMs`  | `number`              | `10000`                              |
| `maxRetries` | `number`              | `2`                                  |
| `fetch`      | `typeof fetch`        | `globalThis.fetch`                   |
| `userAgent`  | `string`              | `"haruspex-sdk-js/0.1.0"`            |

### `client.scores.get(symbol)`

Latest score for one ticker. Returns a `Score & { _meta }`.

### `client.scores.batch(symbols)`

Latest scores for up to 50 tickers in a single request. Returns
`{ count, scores, _meta }`.

### `client.scores.history(symbol, { from?, to?, limit? })`

Historical daily scores. `limit` is 1–90 (default 30). Returns
`{ symbol, from, to, count, scores, _meta }`.

### `client.search(query, { limit? })`

Search by ticker or company name. `limit` is 1–20 (default 10).

### `client.news(symbol, { limit? })`

Recent news articles for a ticker. `limit` is 1–20 (default 10).

## Errors

All thrown errors extend `HaruspexError`:

| Class                       | Trigger                                  |
| --------------------------- | ---------------------------------------- |
| `HaruspexAuthError`         | 401 / 403                                |
| `HaruspexNotFoundError`     | 404 — ticker not in the scoring universe |
| `HaruspexRateLimitError`    | 429 — carries `retryAfterMs`             |
| `HaruspexValidationError`   | 400 / client-side bad input              |
| `HaruspexServerError`       | 5xx                                      |
| `HaruspexNetworkError`      | timeout, DNS, connection reset           |

Every error carries `status`, `code`, `requestId`, and `body` when available.

## Retries

Retries automatically on 429, 502, 503, 504, and network errors with
exponential backoff (250ms × 2^attempt, capped at 4s, with jitter). Respects
the `Retry-After` header on 429. Default `maxRetries: 2`.

4xx errors other than 429 are never retried.

## Authentication

Get a free API key at [haruspex.guru/developers](https://haruspex.guru/developers).
For evaluation without signup, use the public demo key
(`hrspx_live_a7c52f9315a65c377fec9c30b53f266b`) documented in the [root README](../../README.md).

## License

MIT. The SDK source code in this repository is MIT-licensed; the Haruspex
scoring algorithm and data are proprietary and access is governed by the
Haruspex API Terms of Service.
