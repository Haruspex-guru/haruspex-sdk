"""Tests for the Haruspex Python SDK using captured fixtures."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from haruspex import (
    AsyncHaruspex,
    Haruspex,
    HaruspexAuthError,
    HaruspexNotFoundError,
    HaruspexRateLimitError,
    HaruspexValidationError,
    TOPIC_SLUGS,
)

FIXTURES = Path(__file__).parent / "fixtures"
BASE = "https://haruspex.guru/api/v1"


def load(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


SCORE = load("score.json")
BATCH = load("batch.json")
HISTORY = load("history.json")
SEARCH = load("search.json")
NEWS = load("news.json")


def make_client(**kwargs: Any) -> Haruspex:
    kwargs.setdefault("api_key", "test-key")
    kwargs.setdefault("max_retries", 0)
    return Haruspex(**kwargs)


def test_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HARUSPEX_API_KEY", raising=False)
    with pytest.raises(HaruspexValidationError):
        Haruspex()


def test_reads_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HARUSPEX_API_KEY", "from-env")
    c = Haruspex()
    assert isinstance(c, Haruspex)
    c.close()


@respx.mock
def test_scores_get_returns_parsed_score_with_meta() -> None:
    respx.get(f"{BASE}/scores/AAPL").mock(return_value=httpx.Response(200, json=SCORE))
    with make_client() as client:
        res = client.scores.get("aapl")
    assert res.symbol == "AAPL"
    assert res.score == SCORE["data"]["score"]
    assert res.outlook == SCORE["data"]["outlook"]
    assert res.meta.request_id == SCORE["meta"]["requestId"]
    assert res.meta.rate_limit is not None
    assert res.meta.rate_limit.limit == 60


def test_scores_get_rejects_empty_symbol() -> None:
    with make_client() as client:
        with pytest.raises(HaruspexValidationError):
            client.scores.get("")


@respx.mock
def test_404_maps_to_not_found() -> None:
    respx.get(f"{BASE}/scores/ZZZZ").mock(
        return_value=httpx.Response(
            404,
            json={"status": "error", "error": {"message": "not found"}, "meta": {"requestId": "req_t"}},
        )
    )
    with make_client() as client:
        with pytest.raises(HaruspexNotFoundError):
            client.scores.get("ZZZZ")


@respx.mock
def test_401_maps_to_auth() -> None:
    respx.get(f"{BASE}/scores/AAPL").mock(
        return_value=httpx.Response(401, json={"status": "error", "error": {"message": "bad"}})
    )
    with make_client() as client:
        with pytest.raises(HaruspexAuthError):
            client.scores.get("AAPL")


@respx.mock
def test_429_maps_to_rate_limit_with_retry_after() -> None:
    respx.get(f"{BASE}/scores/AAPL").mock(
        return_value=httpx.Response(
            429,
            headers={"retry-after": "5"},
            json={"status": "error", "error": {"message": "slow"}},
        )
    )
    with make_client() as client:
        with pytest.raises(HaruspexRateLimitError) as exc:
            client.scores.get("AAPL")
    assert exc.value.retry_after_ms == 5000


@respx.mock
def test_batch_posts_and_returns_scores() -> None:
    route = respx.post(f"{BASE}/scores/batch").mock(return_value=httpx.Response(200, json=BATCH))
    with make_client() as client:
        res = client.scores.batch(["aapl", "nvda", "msft"])
    sent = json.loads(route.calls.last.request.content)
    assert sent == {"symbols": ["AAPL", "NVDA", "MSFT"]}
    assert res.count == BATCH["data"]["count"]
    assert len(res.scores) == len(BATCH["data"]["scores"])
    assert res.scores[0].symbol == "AAPL"


def test_batch_rejects_empty() -> None:
    with make_client() as client:
        with pytest.raises(HaruspexValidationError):
            client.scores.batch([])


def test_batch_rejects_too_many() -> None:
    with make_client() as client:
        with pytest.raises(HaruspexValidationError):
            client.scores.batch([f"T{i}" for i in range(51)])


@respx.mock
def test_history_forwards_limit() -> None:
    route = respx.get(f"{BASE}/scores/AAPL/history").mock(
        return_value=httpx.Response(200, json=HISTORY)
    )
    with make_client() as client:
        res = client.scores.history("AAPL", limit=5)
    assert "limit=5" in str(route.calls.last.request.url)
    assert res.count == HISTORY["data"]["count"]


def test_history_rejects_oversized_limit() -> None:
    with make_client() as client:
        with pytest.raises(HaruspexValidationError):
            client.scores.history("AAPL", limit=100)


@respx.mock
def test_search_returns_results() -> None:
    route = respx.get(f"{BASE}/search").mock(return_value=httpx.Response(200, json=SEARCH))
    with make_client() as client:
        res = client.search("apple", limit=3)
    url = str(route.calls.last.request.url)
    assert "q=apple" in url
    assert "limit=3" in url
    assert len(res.results) == len(SEARCH["data"]["results"])
    assert res.results[0].symbol == "AAPL"


@respx.mock
def test_news_returns_articles() -> None:
    respx.get(f"{BASE}/stocks/AAPL/news").mock(return_value=httpx.Response(200, json=NEWS))
    with make_client() as client:
        res = client.news("AAPL", limit=3)
    assert res.symbol == "AAPL"
    assert len(res.articles) > 0
    assert res.articles[0].url.startswith("http")


def test_topic_slugs_count() -> None:
    assert len(TOPIC_SLUGS) == 16
    assert "ai-exposure" in TOPIC_SLUGS
    assert "us_china_unofficial" in TOPIC_SLUGS


@respx.mock
def test_retries_on_503_then_succeeds() -> None:
    calls = {"n": 0}

    def responder(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(
                503, json={"status": "error", "error": {"message": "boom"}}
            )
        return httpx.Response(200, json=SCORE)

    respx.get(f"{BASE}/scores/AAPL").mock(side_effect=responder)
    with Haruspex(api_key="test-key", max_retries=2) as client:
        res = client.scores.get("AAPL")
    assert res.symbol == "AAPL"
    assert calls["n"] == 2


@respx.mock
@pytest.mark.asyncio
async def test_async_client_get_score() -> None:
    respx.get(f"{BASE}/scores/AAPL").mock(return_value=httpx.Response(200, json=SCORE))
    async with AsyncHaruspex(api_key="test-key", max_retries=0) as client:
        res = await client.scores.get("AAPL")
    assert res.symbol == "AAPL"
    assert res.meta.request_id == SCORE["meta"]["requestId"]
