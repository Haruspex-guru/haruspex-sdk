# haruspex-sdk

Official Python SDK for the [Haruspex](https://haruspex.guru) API. Stock
intelligence scores (0–100) across 16 dimensions, with outlook, trading
signal, history, search, and news.

```bash
pip install haruspex-sdk
```

Python 3.9+. Built on `httpx` and `pydantic` v2. Both sync and async
clients ship in the same package.

## Quickstart

```python
import os
from haruspex import Haruspex

client = Haruspex(api_key=os.environ.get("HARUSPEX_API_KEY"))

aapl = client.scores.get("AAPL")
print(f"{aapl.symbol}: {aapl.score}/100 ({aapl.outlook})")
print(f"Rate-limit remaining: {aapl.meta.rate_limit.remaining}")
```

Async:

```python
import asyncio
from haruspex import AsyncHaruspex

async def main():
    async with AsyncHaruspex() as client:
        scores = await client.scores.batch(["AAPL", "NVDA", "MSFT"])
        for s in scores.scores:
            print(s.symbol, s.score, s.outlook)

asyncio.run(main())
```

Every response carries a `.meta` accessor with `request_id`,
`credits_remaining`, and `rate_limit`, so you can observe credit/rate
headroom without a separate request.

## API

### `Haruspex(api_key=None, base_url=..., timeout=10.0, max_retries=2)`

If `api_key` is omitted, reads `HARUSPEX_API_KEY` from the environment.
Throws `HaruspexValidationError` if neither is present.

`AsyncHaruspex` exposes the same constructor and methods as `async`
coroutines.

### Methods

| Method                                            | Returns            |
| ------------------------------------------------- | ------------------ |
| `client.scores.get(symbol)`                       | `ScoreResponse`    |
| `client.scores.batch(symbols)`                    | `BatchResponse`    |
| `client.scores.history(symbol, from_=, to=, limit=)` | `HistoryResponse` |
| `client.search(query, limit=)`                    | `SearchResponse`   |
| `client.news(symbol, limit=)`                     | `NewsResponse`     |

`from_` is the keyword for the historical range start (Python keyword
`from` is reserved).

## Errors

All exceptions extend `HaruspexError`:

| Class                       | Trigger                                  |
| --------------------------- | ---------------------------------------- |
| `HaruspexAuthError`         | 401 / 403                                |
| `HaruspexNotFoundError`     | 404 — ticker not in the scoring universe |
| `HaruspexRateLimitError`    | 429 — carries `retry_after_ms`           |
| `HaruspexValidationError`   | 400 / client-side bad input              |
| `HaruspexServerError`       | 5xx                                      |
| `HaruspexNetworkError`      | timeout, DNS, connection reset           |

Every error carries `status`, `code`, `request_id`, and `body` when
available.

## Retries

Retries automatically on 429, 502, 503, 504, and network errors with
exponential backoff (250ms × 2^attempt, capped at 4s, with jitter).
Respects `Retry-After` on 429. Default `max_retries=2`.

## Authentication

Get a free API key at
[haruspex.guru/developers](https://haruspex.guru/developers). For
evaluation without signup, use the public demo key
(`hrspx_live_a7c52f9315a65c377fec9c30b53f266b`) documented in the
[root README](../../README.md).

## License

MIT. The SDK source code in this repository is MIT-licensed; the Haruspex
scoring algorithm and data are proprietary and access is governed by the
Haruspex API Terms of Service.
