# 03 — Portfolio watchlist (JavaScript)

Reads a JSON list of tickers, calls the batch endpoint, prints a sorted
table by score.

## Prerequisites

- Node 18+
- A Haruspex API key (or rely on the demo-key fallback).

## Install & run

```bash
cd examples/03-portfolio-watchlist-js
npm install

# Default watchlist:
HARUSPEX_API_KEY=hrspx_... node index.js

# Or supply your own:
HARUSPEX_API_KEY=hrspx_... node index.js my-watchlist.json
```

`watchlist.json` is a flat JSON array of ticker symbols (max 50).

## Expected output

Captured against the live API on 2026-04-28 with the included `watchlist.json`
(`["AAPL", "NVDA", "MSFT"]`):

```
Symbol  Score   Outlook   Signal  Change
----------------------------------------
AAPL    75      bullish   buy     -4
NVDA    72      bullish   buy     +10
MSFT    67      bullish   buy     -10

Credits remaining: 38621, RL: 58/60
```

Your output will differ — scores update daily.
