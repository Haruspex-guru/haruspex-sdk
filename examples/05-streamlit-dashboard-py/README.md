# 05 — Streamlit dashboard (Python)

Streamlit app showing a watchlist sorted by score, with a 30-day history
chart for whichever ticker you select.

## Prerequisites

- Python 3.9+
- A Haruspex API key (or rely on the demo-key fallback).

## Install & run

```bash
cd examples/05-streamlit-dashboard-py
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
HARUSPEX_API_KEY=hrspx_... streamlit run app.py
```

Streamlit opens at <http://localhost:8501>.

## Expected behavior

The default watchlist is `AAPL, NVDA, MSFT, GOOGL, TSLA`. On a real run on
2026-04-28 the table shows scores roughly in this shape (AAPL/NVDA/MSFT
values come straight from the live batch endpoint):

```
symbol  score  change  outlook  signal
AAPL    75     -4      bullish  buy
NVDA    72     +10     bullish  buy
MSFT    67     -10     bullish  buy
GOOGL   ...    ...     ...      ...
TSLA    ...    ...     ...      ...
```

Selecting a ticker renders a line chart of its last 30 days of scores from
the `/scores/{SYMBOL}/history` endpoint. On 2026-04-28 a sample 5-day slice
of AAPL history was:

```
date         score
2026-04-24   51
2026-04-25   67
2026-04-26   68
2026-04-27   79
2026-04-28   75
```

Your data will differ — scores update daily.
