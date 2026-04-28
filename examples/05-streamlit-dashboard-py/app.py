"""Streamlit dashboard: watchlist scores plus a 30-day history chart."""

from __future__ import annotations

import os

import pandas as pd
import streamlit as st

from haruspex import Haruspex, HaruspexError

DEMO_KEY = "hrspx_live_a7c52f9315a65c377fec9c30b53f266b"
DEFAULT_WATCHLIST = ["AAPL", "NVDA", "MSFT", "GOOGL", "TSLA"]


@st.cache_resource
def get_client() -> Haruspex:
    return Haruspex(api_key=os.environ.get("HARUSPEX_API_KEY", DEMO_KEY))


@st.cache_data(ttl=300)
def load_watchlist(symbols: tuple[str, ...]) -> pd.DataFrame:
    client = get_client()
    res = client.scores.batch(list(symbols))
    rows = [
        {
            "symbol": s.symbol,
            "score": s.score,
            "change": s.change,
            "outlook": s.outlook,
            "signal": s.signal,
            "share": s.share_url,
        }
        for s in res.scores
    ]
    return pd.DataFrame(rows).sort_values("score", ascending=False).reset_index(drop=True)


@st.cache_data(ttl=300)
def load_history(symbol: str, limit: int = 30) -> pd.DataFrame:
    client = get_client()
    res = client.scores.history(symbol, limit=limit)
    return pd.DataFrame(
        [{"date": s.date, "score": s.score} for s in res.scores]
    ).sort_values("date")


st.set_page_config(page_title="Haruspex watchlist", layout="wide")
st.title("Haruspex watchlist")

watchlist_input = st.sidebar.text_area(
    "Watchlist (comma-separated tickers)",
    value=",".join(DEFAULT_WATCHLIST),
)
symbols = tuple(s.strip().upper() for s in watchlist_input.split(",") if s.strip())

if not symbols:
    st.info("Add at least one ticker to the sidebar.")
    st.stop()

try:
    df = load_watchlist(symbols)
except HaruspexError as exc:
    st.error(f"Lookup failed: {exc.message}")
    st.stop()

st.subheader("Latest scores")
st.dataframe(df, use_container_width=True, hide_index=True)

st.subheader("30-day score history")
selected = st.selectbox("Pick a ticker", df["symbol"].tolist())
try:
    history = load_history(selected, limit=30)
except HaruspexError as exc:
    st.error(f"History lookup failed: {exc.message}")
else:
    st.line_chart(history, x="date", y="score", height=300)
