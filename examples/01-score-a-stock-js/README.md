# 01 — Score a stock (JavaScript)

CLI that prints one ticker's score and top 3 topic dimensions.

## Prerequisites

- Node 18+
- A Haruspex API key. Get a free one at
  [haruspex.guru/developers](https://haruspex.guru/developers), or omit
  `HARUSPEX_API_KEY` to fall back to the public demo key.

## Install & run

```bash
cd examples/01-score-a-stock-js
npm install
HARUSPEX_API_KEY=hrspx_... node index.js AAPL
```

## Expected output

Captured against the live API on 2026-04-28:

```
AAPL: 75/100 (bullish, signal=buy)
Day-over-day change: -4
Share: https://haruspex.guru/s/Ib70IGTaXpXtFIj0D7_vrnrR

Top 3 topic scores:
  earnings: 72/100
  competitors: 68/100
  institutional: 65/100

Rate-limit remaining: 59/60
```

Your output will differ — scores update daily.
