# 02 — Score a stock (Python)

Same as example 01, in Python.

## Prerequisites

- Python 3.9+
- A Haruspex API key. Get a free one at
  [haruspex.guru/developers](https://haruspex.guru/developers), or omit
  `HARUSPEX_API_KEY` to fall back to the public demo key.

## Install & run

```bash
cd examples/02-score-a-stock-py
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
HARUSPEX_API_KEY=hrspx_... python main.py AAPL
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
