# Examples

Five runnable examples. Each lives in its own directory with its own
`README.md`, dependencies, and `expected output` block.

| # | Directory | What it does | Stack |
| - | --------- | ------------ | ----- |
| 1 | [`01-score-a-stock-js`](./01-score-a-stock-js/) | CLI: print one ticker's score and top 3 dimensions | Node, `@haruspex-guru-sdk/sdk` |
| 2 | [`02-score-a-stock-py`](./02-score-a-stock-py/) | Same, in Python | Python, `haruspex-sdk` |
| 3 | [`03-portfolio-watchlist-js`](./03-portfolio-watchlist-js/) | Read tickers from JSON, batch, print sorted table | Node, `@haruspex-guru-sdk/sdk` |
| 4 | [`04-discord-bot-js`](./04-discord-bot-js/) | `!score TSLA` Discord bot | Node, `discord.js`, `@haruspex-guru-sdk/sdk` |
| 5 | [`05-streamlit-dashboard-py`](./05-streamlit-dashboard-py/) | Watchlist dashboard with 30-day history chart | Python, Streamlit, `haruspex-sdk` |

All examples use the public demo key (`hrspx_live_a7c52f9315a65c377fec9c30b53f266b`) as a
fallback so you can run them without signup. Real usage should set
`HARUSPEX_API_KEY` from a free key at
[haruspex.guru/developers](https://haruspex.guru/developers).

The `Expected output` block in each example's README is a real response
captured against the live Haruspex API on 2026-04-28 — the same day each
fixture was captured. Output you see when you run the example will differ
because scores update daily.
