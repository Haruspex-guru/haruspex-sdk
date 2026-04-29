# Haruspex SDK

> Stock intelligence scores (0–100) across 16 dimensions. Official SDK and API docs.

[![npm](https://img.shields.io/npm/v/%40haruspex-guru-sdk%2Fsdk?label=%40haruspex-guru-sdk%2Fsdk)](https://www.npmjs.com/package/@haruspex-guru-sdk/sdk)
[![PyPI](https://img.shields.io/pypi/v/haruspex-sdk?label=haruspex-sdk)](https://pypi.org/project/haruspex-sdk/)
[![npm mcp](https://img.shields.io/npm/v/%40haruspex-guru-sdk%2Fmcp-server?label=%40haruspex-guru-sdk%2Fmcp-server)](https://www.npmjs.com/package/@haruspex-guru-sdk/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/Haruspex-guru/haruspex-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Haruspex-guru/haruspex-sdk/actions/workflows/ci.yml)

## Try it in 5 seconds

```bash
curl -H "Authorization: Bearer hrspx_live_a7c52f9315a65c377fec9c30b53f266b" \
  https://haruspex.guru/api/v1/scores/AAPL
```

Real response (captured 2026-04-28, truncated):

```json
{
  "status": "success",
  "data": {
    "symbol": "AAPL",
    "score": 75,
    "previousScore": 79,
    "change": -4,
    "outlook": "bullish",
    "signal": "buy",
    "topicScores": {
      "earnings":   { "name": "earnings",   "score": 72, "change": 4 },
      "competitors":{ "name": "competitors","score": 68, "change": 0 },
      "macro":      { "name": "macro",      "score": 62, "change": -3 }
    },
    "date": "2026-04-28",
    "shareUrl": "https://haruspex.guru/s/Ib70IGTaXpXtFIj0D7_vrnrR"
  },
  "meta": {
    "requestId": "req_fixture_score",
    "creditsRemaining": 38624,
    "rateLimit": { "limit": 60, "remaining": 59, "resetAt": "2026-04-28T08:54:00.000Z" }
  }
}
```

## Install

**JavaScript / TypeScript:**

```bash
npm install @haruspex-guru-sdk/sdk
```

**Python:**

```bash
pip install haruspex-sdk
```

## Quickstart

```ts
// JS / TS
import { Haruspex } from "@haruspex-guru-sdk/sdk";

const client = new Haruspex({ apiKey: process.env.HARUSPEX_API_KEY });

const aapl    = await client.scores.get("AAPL");
const batch   = await client.scores.batch(["AAPL", "NVDA", "MSFT"]);
const history = await client.scores.history("AAPL", { limit: 30 });

console.log(aapl.score, aapl.outlook, aapl._meta.rateLimit);
```

```python
# Python
from haruspex import Haruspex

client = Haruspex(api_key=os.environ["HARUSPEX_API_KEY"])

aapl    = client.scores.get("AAPL")
batch   = client.scores.batch(["AAPL", "NVDA", "MSFT"])
history = client.scores.history("AAPL", limit=30)

print(aapl.score, aapl.outlook, aapl.meta.rate_limit)
```

Every SDK call returns a payload that also carries `_meta` (JS) or `.meta`
(Python) with `requestId`, `creditsRemaining`, and `rateLimit`. No second
request needed to read rate-limit headroom.

## What you get

Every score is an integer 0–100. Each ticker has:

- **`score`** — the headline Haruspex Score.
- **`previousScore`** and **`change`** — day-over-day move.
- **`outlook`** — `bullish`, `neutral`, or `bearish`.
- **`signal`** — `buy`, `hold`, or `sell`.
- **`topicScores`** — a breakdown of 16 dimensions (each is its own 0–100
  score plus day-over-day change).
- **`date`**, **`analyzedAt`**, **`tradingTimeline`**, **`shareUrl`**.

The 16 topic dimensions:

| Slug                  | Plain language                                     |
| --------------------- | -------------------------------------------------- |
| `ai-exposure`         | Exposure to AI as opportunity / risk               |
| `climate-risk`        | Physical and transition climate risk               |
| `competitors`         | Competitive position vs. peers                     |
| `concentration-risk`  | Customer / revenue concentration                   |
| `earnings`            | Recent earnings quality and surprises              |
| `esg`                 | Environmental, social, governance posture          |
| `github-activity`     | Open-source code activity (where relevant)         |
| `insider-trading`     | Insider buying / selling pattern                   |
| `institutional`       | Institutional flow and ownership                   |
| `macro`               | Sensitivity to macro conditions                    |
| `management`          | Management track record and changes                |
| `patents`             | Patent activity and IP trajectory                  |
| `regulatory`          | Regulatory risk and tailwinds                      |
| `supplychain`         | Supply-chain robustness                            |
| `us_china_official`   | Official US-China policy exposure                  |
| `us_china_unofficial` | Unofficial US-China dynamics                       |

How dimensions are combined into the headline score is proprietary.

## Use it in Claude Desktop / Cursor / Windsurf (no code)

The fastest way to evaluate Haruspex. Add this to
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "haruspex": {
      "command": "npx",
      "args": ["-y", "@haruspex-guru-sdk/mcp-server"],
      "env": { "HARUSPEX_API_KEY": "hrspx_live_a7c52f9315a65c377fec9c30b53f266b" }
    }
  }
}
```

Restart Claude Desktop, then ask:

- *"What's the Haruspex score for NVDA?"*
- *"Compare AAPL and MSFT."*
- *"Show me TSLA's 30-day score history."*

Cursor and Windsurf use the same JSON shape in their respective MCP config
files. Full setup details, tool list, and troubleshooting in
[`packages/mcp/README.md`](./packages/mcp/README.md).

## Authentication

Three tiers:

| Tier              | Limit               | How to get it                                                              |
| ----------------- | ------------------- | -------------------------------------------------------------------------- |
| **Demo**          | 20 req/hr per IP    | Use `hrspx_live_a7c52f9315a65c377fec9c30b53f266b` directly. No signup.                    |
| **Free**          | 1,000 req/month     | Sign up with GitHub at [haruspex.guru/developers](https://haruspex.guru/developers) |
| **Pro / Inst.**   | Volume + commercial | See [haruspex.guru/pricing](https://haruspex.guru/pricing)                 |

The SDKs do **not** default to the demo key. They throw a
`HaruspexValidationError` if `apiKey` is missing and `HARUSPEX_API_KEY`
isn't set, so you make a conscious choice. Quickstart examples show the
demo key as a literal string you can copy-paste to evaluate.

## Rate limits & credits

Every response carries `meta.rateLimit` (`limit`, `remaining`, `resetAt`)
and `meta.creditsRemaining`. The SDKs surface both via `_meta` (JS) /
`.meta` (Python) without a second request.

The `Cloud Functions` origin
(`us-central1-haruspex-base.cloudfunctions.net`) is blocked by network
egress; always route through `https://haruspex.guru/api/v1`.

## Errors

| Error class                  | HTTP    | When                                |
| ---------------------------- | ------- | ----------------------------------- |
| `HaruspexAuthError`          | 401/403 | Bad / missing key                   |
| `HaruspexNotFoundError`      | 404     | Ticker not in scoring universe      |
| `HaruspexRateLimitError`     | 429     | Carries `retryAfterMs`              |
| `HaruspexValidationError`    | 400     | Bad request or client-side input    |
| `HaruspexServerError`        | 5xx     | Internal server error               |
| `HaruspexNetworkError`       | 0       | Timeout, DNS, connection reset      |

The SDKs retry 429, 502, 503, 504, and network errors with exponential
backoff (250ms × 2^attempt, cap 4s, jitter), respecting `Retry-After`.
Default `maxRetries: 2`. Other 4xx errors are never retried.

## Examples

Five runnable examples in [`examples/`](./examples/):

1. [`01-score-a-stock-js`](./examples/01-score-a-stock-js/) — single-score CLI in Node.
2. [`02-score-a-stock-py`](./examples/02-score-a-stock-py/) — same in Python.
3. [`03-portfolio-watchlist-js`](./examples/03-portfolio-watchlist-js/) — batch from a JSON file, sorted table.
4. [`04-discord-bot-js`](./examples/04-discord-bot-js/) — `!score TSLA` Discord bot.
5. [`05-streamlit-dashboard-py`](./examples/05-streamlit-dashboard-py/) — Streamlit dashboard with history chart.

## OpenAPI spec

[`openapi.yaml`](./openapi.yaml) is the OpenAPI 3.1 source of truth. Use
it with [Stainless](https://stainless.com),
[Speakeasy](https://speakeasyapi.dev), or
[`openapi-generator`](https://openapi-generator.tech) to generate clients
in Go, Ruby, Rust, Java, etc.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Bug fixes, new examples, and
new-language clients welcome. PRs that try to modify scoring logic will be
closed — that engine is not in this repo.

## License

[MIT](./LICENSE).

> The SDK source code in this repository is MIT-licensed. The Haruspex
> scoring algorithm and data are proprietary; access is governed by the
> Haruspex API Terms of Service.
