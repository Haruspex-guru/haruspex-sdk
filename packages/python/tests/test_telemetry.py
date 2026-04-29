"""Tests for opt-in telemetry in the Haruspex Python SDK."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from haruspex import AsyncHaruspex, Haruspex, TelemetryClient, TelemetryOptions
from haruspex.telemetry import (
    load_or_create_client_id,
    resolve_enabled,
    templatize,
)

FIXTURES = Path(__file__).parent / "fixtures"
BASE = "https://haruspex.guru/api/v1"
TELEMETRY_URL = "https://haruspex.guru/api/v1/telemetry/events"


def load(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


SCORE = load("score.json")


def test_resolve_enabled_truth_table() -> None:
    assert resolve_enabled(True, {"DO_NOT_TRACK": "1", "HARUSPEX_TELEMETRY": "1"}) is False
    assert resolve_enabled(True, {}) is True
    assert resolve_enabled(False, {"HARUSPEX_TELEMETRY": "1"}) is False
    assert resolve_enabled(None, {"HARUSPEX_TELEMETRY": "1"}) is True
    assert resolve_enabled(None, {}) is False


def test_load_or_create_client_id_roundtrip(tmp_path: Path) -> None:
    p = tmp_path / "id"
    a = load_or_create_client_id(p)
    b = load_or_create_client_id(p)
    assert a == b
    assert p.read_text(encoding="utf-8").strip() == a


def test_load_or_create_client_id_existing(tmp_path: Path) -> None:
    p = tmp_path / "id"
    p.write_text("abcdef01-2345-6789-abcd-ef0123456789", encoding="utf-8")
    assert load_or_create_client_id(p) == "abcdef01-2345-6789-abcd-ef0123456789"


def test_load_or_create_client_id_falls_back_when_unwritable() -> None:
    cid = load_or_create_client_id(Path("/proc/this-is-not-writable/id"))
    assert len(cid) >= 8


def test_templatize_paths() -> None:
    assert templatize("GET", "/scores/AAPL") == "GET /scores/{symbol}"
    assert templatize("GET", "/scores/aapl/history?limit=5") == "GET /scores/{symbol}/history"
    assert templatize("POST", "/scores/batch") == "POST /scores/batch"
    assert templatize("GET", "/stocks/MSFT/news") == "GET /stocks/{symbol}/news"
    assert templatize("GET", "/search?q=apple") == "GET /search"


@respx.mock
def test_disabled_by_default_no_telemetry_post() -> None:
    score_route = respx.get(f"{BASE}/scores/AAPL").mock(
        return_value=httpx.Response(200, json=SCORE)
    )
    telemetry_route = respx.post(TELEMETRY_URL).mock(return_value=httpx.Response(200, json={}))
    with Haruspex(api_key="test-key", max_retries=0) as c:
        c.scores.get("AAPL")
    assert score_route.called
    assert not telemetry_route.called


@respx.mock
def test_enabled_posts_event_with_full_schema(tmp_path: Path) -> None:
    captured: list[dict[str, Any]] = []
    respx.get(f"{BASE}/scores/AAPL").mock(return_value=httpx.Response(200, json=SCORE))

    def telemetry_handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        captured.append(body)
        assert request.headers.get("authorization") == "Bearer test-key"
        return httpx.Response(200, json={"ok": True})

    respx.post(TELEMETRY_URL).mock(side_effect=telemetry_handler)

    with Haruspex(
        api_key="test-key",
        max_retries=0,
        telemetry=TelemetryOptions(
            enabled=True, client_id_path=tmp_path / "id", max_batch_size=1
        ),
    ) as c:
        c.scores.get("aapl")
        time.sleep(0.05)
    # close() in __exit__ flushes
    assert len(captured) >= 1
    ev = captured[0]["events"][0]
    assert ev["event_type"] == "request"
    assert ev["endpoint"] == "GET /scores/{symbol}"
    assert ev["sdk_name"] == "python"
    assert ev["symbol_or_query"] == "AAPL"
    assert ev["http_status"] == 200
    assert ev["error_type"] is None
    assert isinstance(ev["latency_ms"], int)
    assert isinstance(ev["timestamp_iso"], str)
    assert isinstance(ev["anonymous_client_id"], str)
    assert len(ev["anonymous_client_id"]) >= 8


@respx.mock
def test_404_records_error_type(tmp_path: Path) -> None:
    captured: list[dict[str, Any]] = []
    respx.get(f"{BASE}/scores/ZZZZ").mock(
        return_value=httpx.Response(
            404,
            json={"status": "error", "error": {"message": "nf"}, "meta": {"requestId": "r"}},
        )
    )

    def telemetry_handler(request: httpx.Request) -> httpx.Response:
        captured.append(json.loads(request.content))
        return httpx.Response(200, json={})

    respx.post(TELEMETRY_URL).mock(side_effect=telemetry_handler)

    from haruspex import HaruspexNotFoundError

    with Haruspex(
        api_key="test-key",
        max_retries=0,
        telemetry=TelemetryOptions(
            enabled=True, client_id_path=tmp_path / "id", max_batch_size=1
        ),
    ) as c:
        with pytest.raises(HaruspexNotFoundError):
            c.scores.get("ZZZZ")
        time.sleep(0.05)
    assert len(captured) >= 1
    ev = captured[0]["events"][0]
    assert ev["http_status"] == 404
    assert ev["error_type"] == "HaruspexNotFoundError"


@respx.mock
def test_telemetry_failure_swallowed(tmp_path: Path) -> None:
    respx.get(f"{BASE}/scores/AAPL").mock(return_value=httpx.Response(200, json=SCORE))
    respx.post(TELEMETRY_URL).mock(return_value=httpx.Response(500, json={"err": 1}))
    with Haruspex(
        api_key="test-key",
        max_retries=0,
        telemetry=TelemetryOptions(
            enabled=True, client_id_path=tmp_path / "id", max_batch_size=1
        ),
    ) as c:
        res = c.scores.get("AAPL")
        assert res.score == SCORE["data"]["score"]


@pytest.mark.asyncio
async def test_async_enabled_posts_event(tmp_path: Path) -> None:
    captured: list[dict[str, Any]] = []
    with respx.mock(assert_all_called=False) as mock:
        mock.get(f"{BASE}/scores/MSFT").mock(return_value=httpx.Response(200, json=SCORE))

        def telemetry_handler(request: httpx.Request) -> httpx.Response:
            captured.append(json.loads(request.content))
            return httpx.Response(200, json={})

        mock.post(TELEMETRY_URL).mock(side_effect=telemetry_handler)

        async with AsyncHaruspex(
            api_key="test-key",
            max_retries=0,
            telemetry=TelemetryOptions(
                enabled=True, client_id_path=tmp_path / "id", max_batch_size=1
            ),
        ) as c:
            await c.scores.get("msft")
        # close() flushes
    assert len(captured) >= 1
    ev = captured[0]["events"][0]
    assert ev["sdk_name"] == "python"
    assert ev["endpoint"] == "GET /scores/{symbol}"
    assert ev["symbol_or_query"] == "MSFT"


def test_standalone_client_batches_at_max(tmp_path: Path) -> None:
    captured: list[dict[str, Any]] = []
    with respx.mock(assert_all_called=False) as mock:
        def telemetry_handler(request: httpx.Request) -> httpx.Response:
            captured.append(json.loads(request.content))
            return httpx.Response(200, json={})

        mock.post(TELEMETRY_URL).mock(side_effect=telemetry_handler)
        tc = TelemetryClient(
            api_key="k",
            sdk_name="python",
            sdk_version="0.1.3",
            options=TelemetryOptions(
                enabled=True,
                client_id_path=tmp_path / "id",
                max_batch_size=3,
                flush_interval_s=60,
            ),
        )
        tc.record(event_type="request", latency_ms=1)
        tc.record(event_type="request", latency_ms=1)
        assert len(captured) == 0
        tc.record(event_type="request", latency_ms=1)
        # daemon thread flushes
        deadline = time.time() + 1.5
        while time.time() < deadline and not captured:
            time.sleep(0.05)
        tc.shutdown()
    assert len(captured) >= 1
    assert len(captured[0]["events"]) == 3
