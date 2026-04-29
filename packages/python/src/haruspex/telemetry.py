"""Opt-in usage telemetry for the Haruspex Python SDK.

Disabled by default. Enable via env `HARUSPEX_TELEMETRY=1` or by passing
`telemetry=TelemetryOptions(enabled=True)` to the client. `DO_NOT_TRACK=1`
overrides everything.
"""

from __future__ import annotations

import atexit
import json
import os
import re
import threading
import time
import uuid
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import httpx

from haruspex.constants import TELEMETRY_DEFAULT_ENDPOINT

_DEFAULT_FLUSH_INTERVAL_S = 5.0
_DEFAULT_MAX_BATCH = 20
_POST_TIMEOUT_S = 2.0


@dataclass
class TelemetryOptions:
    enabled: Optional[bool] = None
    endpoint: Optional[str] = None
    flush_interval_s: float = _DEFAULT_FLUSH_INTERVAL_S
    max_batch_size: int = _DEFAULT_MAX_BATCH
    client_id_path: Optional[Path] = None
    http: Optional[httpx.Client] = None
    async_http: Optional[httpx.AsyncClient] = None


def _env_true(value: Optional[str]) -> bool:
    if not value:
        return False
    return value.strip().lower() in {"1", "true", "yes"}


def resolve_enabled(opt: Optional[bool], env: Mapping[str, str]) -> bool:
    if _env_true(env.get("DO_NOT_TRACK")):
        return False
    if opt is True:
        return True
    if opt is False:
        return False
    return _env_true(env.get("HARUSPEX_TELEMETRY"))


def _default_client_id_path() -> Path:
    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        return Path(xdg) / "haruspex" / "id"
    return Path.home() / ".haruspex" / "id"


_UUID_RE = re.compile(r"^[0-9a-fA-F-]{8,64}$")


def load_or_create_client_id(path: Optional[Path] = None) -> str:
    p = path or _default_client_id_path()
    try:
        if p.is_file():
            v = p.read_text(encoding="utf-8").strip()
            if _UUID_RE.match(v):
                return v
    except OSError:
        pass
    cid = str(uuid.uuid4())
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(cid, encoding="utf-8")
    except OSError:
        pass
    return cid


def templatize(method: str, path: str) -> str:
    raw = path.split("?", 1)[0]
    if re.fullmatch(r"/scores/batch", raw, re.IGNORECASE):
        templ = "/scores/batch"
    elif re.fullmatch(r"/scores/[^/]+/history", raw, re.IGNORECASE):
        templ = "/scores/{symbol}/history"
    elif re.fullmatch(r"/scores/[^/]+", raw, re.IGNORECASE):
        templ = "/scores/{symbol}"
    elif re.fullmatch(r"/stocks/[^/]+/news", raw, re.IGNORECASE):
        templ = "/stocks/{symbol}/news"
    elif re.fullmatch(r"/search", raw, re.IGNORECASE):
        templ = "/search"
    else:
        templ = raw
    return f"{method.upper()} {templ}"


def _make_event(
    *,
    client_id: str,
    sdk_name: str,
    sdk_version: str,
    event_type: str,
    endpoint: Optional[str] = None,
    tool_name: Optional[str] = None,
    symbol_or_query: Optional[str] = None,
    http_status: Optional[int] = None,
    latency_ms: float,
    error_type: Optional[str] = None,
) -> dict[str, Any]:
    ev: dict[str, Any] = {
        "anonymous_client_id": client_id,
        "sdk_name": sdk_name,
        "sdk_version": sdk_version,
        "event_type": event_type,
        "latency_ms": int(round(max(0.0, latency_ms))),
        "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z",
        "error_type": error_type,
    }
    if endpoint is not None:
        ev["endpoint"] = endpoint
    if tool_name is not None:
        ev["tool_name"] = tool_name
    if symbol_or_query is not None:
        ev["symbol_or_query"] = symbol_or_query
    if http_status is not None:
        ev["http_status"] = http_status
    return ev


@dataclass
class _Common:
    api_key: str
    sdk_name: str
    sdk_version: str
    options: TelemetryOptions = field(default_factory=TelemetryOptions)


class TelemetryClient:
    """Sync telemetry client. Daemon thread flusher."""

    def __init__(
        self,
        *,
        api_key: str,
        sdk_name: str,
        sdk_version: str,
        options: Optional[TelemetryOptions] = None,
    ) -> None:
        opts = options or TelemetryOptions()
        self.enabled = resolve_enabled(opts.enabled, os.environ)
        self._api_key = api_key
        self._sdk_name = sdk_name
        self._sdk_version = sdk_version
        self._endpoint = (
            opts.endpoint
            or os.environ.get("HARUSPEX_TELEMETRY_ENDPOINT")
            or TELEMETRY_DEFAULT_ENDPOINT
        )
        self._flush_interval = opts.flush_interval_s
        self._max_batch = opts.max_batch_size
        self._http = opts.http
        self._owns_http = self._http is None
        self._client_id = (
            load_or_create_client_id(opts.client_id_path) if self.enabled else ""
        )
        self._queue: list[dict[str, Any]] = []
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        if self.enabled:
            self._thread = threading.Thread(
                target=self._loop, name="haruspex-telemetry", daemon=True
            )
            self._thread.start()
            atexit.register(self.shutdown)

    def record(
        self,
        *,
        event_type: str,
        endpoint: Optional[str] = None,
        tool_name: Optional[str] = None,
        symbol_or_query: Optional[str] = None,
        http_status: Optional[int] = None,
        latency_ms: float,
        error_type: Optional[str] = None,
    ) -> None:
        if not self.enabled or self._stop.is_set():
            return
        ev = _make_event(
            client_id=self._client_id,
            sdk_name=self._sdk_name,
            sdk_version=self._sdk_version,
            event_type=event_type,
            endpoint=endpoint,
            tool_name=tool_name,
            symbol_or_query=symbol_or_query,
            http_status=http_status,
            latency_ms=latency_ms,
            error_type=error_type,
        )
        size_trigger = False
        with self._lock:
            self._queue.append(ev)
            if len(self._queue) >= self._max_batch:
                size_trigger = True
        if size_trigger:
            self._wake.set()

    def _drain(self) -> list[dict[str, Any]]:
        with self._lock:
            batch = self._queue
            self._queue = []
        return batch

    def _send(self, batch: list[dict[str, Any]]) -> None:
        if not batch:
            return
        http = self._http or httpx.Client(timeout=_POST_TIMEOUT_S)
        try:
            payload = json.dumps({"events": batch}).encode("utf-8")
            headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            }
            for attempt in range(2):
                try:
                    resp = http.request(
                        "POST",
                        self._endpoint,
                        content=payload,
                        headers=headers,
                        timeout=_POST_TIMEOUT_S,
                    )
                    if 500 <= resp.status_code < 600 and attempt == 0:
                        continue
                    return
                except httpx.HTTPError:
                    if attempt == 0:
                        continue
                    return
        finally:
            if self._owns_http and http is not self._http:
                try:
                    http.close()
                except Exception:
                    pass

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._wake.wait(self._flush_interval)
            self._wake.clear()
            batch = self._drain()
            if batch:
                try:
                    self._send(batch)
                except Exception:
                    pass

    def flush(self) -> None:
        batch = self._drain()
        if batch:
            try:
                self._send(batch)
            except Exception:
                pass

    def shutdown(self) -> None:
        if self._stop.is_set():
            return
        self._stop.set()
        self._wake.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        self.flush()


class AsyncTelemetryClient:
    """Async telemetry client. Schedules sends via asyncio."""

    def __init__(
        self,
        *,
        api_key: str,
        sdk_name: str,
        sdk_version: str,
        options: Optional[TelemetryOptions] = None,
    ) -> None:
        opts = options or TelemetryOptions()
        self.enabled = resolve_enabled(opts.enabled, os.environ)
        self._api_key = api_key
        self._sdk_name = sdk_name
        self._sdk_version = sdk_version
        self._endpoint = (
            opts.endpoint
            or os.environ.get("HARUSPEX_TELEMETRY_ENDPOINT")
            or TELEMETRY_DEFAULT_ENDPOINT
        )
        self._max_batch = opts.max_batch_size
        self._http = opts.async_http
        self._owns_http = self._http is None
        self._client_id = (
            load_or_create_client_id(opts.client_id_path) if self.enabled else ""
        )
        self._queue: list[dict[str, Any]] = []
        self._lock = threading.Lock()
        self._closed = False

    def record(
        self,
        *,
        event_type: str,
        endpoint: Optional[str] = None,
        tool_name: Optional[str] = None,
        symbol_or_query: Optional[str] = None,
        http_status: Optional[int] = None,
        latency_ms: float,
        error_type: Optional[str] = None,
    ) -> None:
        if not self.enabled or self._closed:
            return
        ev = _make_event(
            client_id=self._client_id,
            sdk_name=self._sdk_name,
            sdk_version=self._sdk_version,
            event_type=event_type,
            endpoint=endpoint,
            tool_name=tool_name,
            symbol_or_query=symbol_or_query,
            http_status=http_status,
            latency_ms=latency_ms,
            error_type=error_type,
        )
        flush_now = False
        with self._lock:
            self._queue.append(ev)
            if len(self._queue) >= self._max_batch:
                flush_now = True
        if flush_now:
            import asyncio

            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self.flush())
            except RuntimeError:
                pass

    async def flush(self) -> None:
        with self._lock:
            batch = self._queue
            self._queue = []
        if not batch:
            return
        http = self._http or httpx.AsyncClient(timeout=_POST_TIMEOUT_S)
        try:
            payload = json.dumps({"events": batch}).encode("utf-8")
            headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            }
            for attempt in range(2):
                try:
                    resp = await http.request(
                        "POST",
                        self._endpoint,
                        content=payload,
                        headers=headers,
                        timeout=_POST_TIMEOUT_S,
                    )
                    if 500 <= resp.status_code < 600 and attempt == 0:
                        continue
                    return
                except httpx.HTTPError:
                    if attempt == 0:
                        continue
                    return
        finally:
            if self._owns_http and http is not self._http:
                try:
                    await http.aclose()
                except Exception:
                    pass

    async def shutdown(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self.flush()


__all__ = [
    "TelemetryOptions",
    "TelemetryClient",
    "AsyncTelemetryClient",
    "resolve_enabled",
    "load_or_create_client_id",
    "templatize",
]
