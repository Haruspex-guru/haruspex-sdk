# Test fixtures

Each `*.json` file in this directory is a verbatim response captured from the
live Haruspex API at `https://haruspex.guru/api/v1`. Captured 2026-04-28.

**Do not hand-edit.** Re-capture by running:

```bash
HARUSPEX_API_KEY=hrspx_... ./scripts/capture-fixtures.sh
```

The only field that has been modified is `meta.requestId`, which is replaced
with a stable per-endpoint identifier (`req_fixture_<endpoint>`) so diffs stay
small across re-captures.

| File | Captured from |
| --- | --- |
| `score.json` | `GET /scores/AAPL` |
| `batch.json` | `POST /scores/batch` with body `{"symbols":["AAPL","NVDA","MSFT"]}` |
| `history.json` | `GET /scores/AAPL/history?limit=5` |
| `search.json` | `GET /search?q=apple&limit=3` |
| `news.json` | `GET /stocks/AAPL/news?limit=3` |
