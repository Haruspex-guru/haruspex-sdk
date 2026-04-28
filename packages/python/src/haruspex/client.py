"""Sync and async Haruspex API clients."""

from __future__ import annotations

import os
import random
import time
from typing import Any, Optional, Union

import httpx

from haruspex.constants import (
    BASE_URL,
    MAX_BATCH,
    MAX_HISTORY_LIMIT,
    MAX_NEWS_LIMIT,
    MAX_SEARCH_LIMIT,
)
from haruspex.errors import (
    HaruspexAuthError,
    HaruspexError,
    HaruspexNetworkError,
    HaruspexNotFoundError,
    HaruspexRateLimitError,
    HaruspexServerError,
    HaruspexValidationError,
)
from haruspex.types import (
    BatchResponse,
    HistoryResponse,
    NewsResponse,
    ResponseMeta,
    ScoreResponse,
    SearchResponse,
    _attach_meta,
)

_RETRYABLE_STATUSES = {429, 502, 503, 504}
_RETRY_BASE_MS = 250
_RETRY_MAX_MS = 4000
_DEFAULT_USER_AGENT = "haruspex-sdk-py/0.1.0"


def _normalize_symbol(symbol: str) -> str:
    if not isinstance(symbol, str) or symbol.strip() == "":
        raise HaruspexValidationError("symbol must be a non-empty string")
    return symbol.strip().upper()


def _clamp_limit(name: str, value: Optional[int], max_value: int) -> Optional[int]:
    if value is None:
        return None
    if not isinstance(value, int) or value < 1:
        raise HaruspexValidationError(f"{name} must be a positive integer")
    if value > max_value:
        raise HaruspexValidationError(f"{name} must be <= {max_value}")
    return value


def _backoff_ms(attempt: int) -> int:
    exp = min(_RETRY_BASE_MS * (2 ** attempt), _RETRY_MAX_MS)
    jitter = random.random() * 0.25 * exp
    return int(exp + jitter)


def _parse_retry_after(header: Optional[str]) -> Optional[int]:
    if not header:
        return None
    try:
        return int(float(header) * 1000)
    except (TypeError, ValueError):
        return None


def _error_for(status: int, parsed: Any, retry_after_ms: Optional[int]) -> HaruspexError:
    env = parsed if isinstance(parsed, dict) else {}
    err = env.get("error") if isinstance(env.get("error"), dict) else {}
    message = err.get("message") or env.get("message") or f"HTTP {status}"
    code = err.get("code")
    request_id = (env.get("meta") or {}).get("requestId") if isinstance(env.get("meta"), dict) else None
    opts: dict[str, Any] = {
        "status": status,
        "code": code,
        "request_id": request_id,
        "body": parsed,
    }
    if status in (401, 403):
        return HaruspexAuthError(message, **opts)
    if status == 404:
        return HaruspexNotFoundError(message, **opts)
    if status == 429:
        return HaruspexRateLimitError(message, retry_after_ms=retry_after_ms, **opts)
    if 400 <= status < 500:
        return HaruspexValidationError(message, **opts)
    return HaruspexServerError(message, **opts)


def _is_retryable(err: HaruspexError) -> bool:
    if isinstance(err, HaruspexRateLimitError):
        return True
    if isinstance(err, HaruspexNetworkError):
        return True
    if isinstance(err, HaruspexServerError) and err.status in _RETRYABLE_STATUSES:
        return True
    return False


def _build_history_query(
    from_: Optional[str], to: Optional[str], limit: Optional[int]
) -> dict[str, str]:
    q: dict[str, str] = {}
    if from_:
        q["from"] = from_
    if to:
        q["to"] = to
    if limit is not None:
        q["limit"] = str(limit)
    return q


class _BaseClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = BASE_URL,
        timeout: float = 10.0,
        max_retries: int = 2,
        user_agent: Optional[str] = None,
    ) -> None:
        key = api_key or os.environ.get("HARUSPEX_API_KEY")
        if not key:
            raise HaruspexValidationError(
                "Missing API key. Pass `api_key` or set HARUSPEX_API_KEY. Get a free key at "
                "https://haruspex.guru/developers, or use the public demo key documented in the README to evaluate.",
            )
        self._api_key = key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self._user_agent = user_agent or _DEFAULT_USER_AGENT

    def _headers(self, has_body: bool) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
            "User-Agent": self._user_agent,
        }
        if has_body:
            h["Content-Type"] = "application/json"
        return h


class _Scores:
    def __init__(self, client: "Haruspex") -> None:
        self._c = client

    def get(self, symbol: str) -> ScoreResponse:
        sym = _normalize_symbol(symbol)
        data, meta = self._c._request("GET", f"/scores/{sym}")
        return ScoreResponse.model_validate(_attach_meta(data, meta))

    def batch(self, symbols: list[str]) -> BatchResponse:
        if not isinstance(symbols, list) or len(symbols) == 0:
            raise HaruspexValidationError("symbols must be a non-empty list")
        if len(symbols) > MAX_BATCH:
            raise HaruspexValidationError(f"symbols length must be <= {MAX_BATCH}")
        normalized = [_normalize_symbol(s) for s in symbols]
        data, meta = self._c._request("POST", "/scores/batch", json={"symbols": normalized})
        return BatchResponse.model_validate(_attach_meta(data, meta))

    def history(
        self,
        symbol: str,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> HistoryResponse:
        sym = _normalize_symbol(symbol)
        lim = _clamp_limit("limit", limit, MAX_HISTORY_LIMIT)
        params = _build_history_query(from_, to, lim)
        data, meta = self._c._request("GET", f"/scores/{sym}/history", params=params)
        return HistoryResponse.model_validate(_attach_meta(data, meta))


class _AsyncScores:
    def __init__(self, client: "AsyncHaruspex") -> None:
        self._c = client

    async def get(self, symbol: str) -> ScoreResponse:
        sym = _normalize_symbol(symbol)
        data, meta = await self._c._request("GET", f"/scores/{sym}")
        return ScoreResponse.model_validate(_attach_meta(data, meta))

    async def batch(self, symbols: list[str]) -> BatchResponse:
        if not isinstance(symbols, list) or len(symbols) == 0:
            raise HaruspexValidationError("symbols must be a non-empty list")
        if len(symbols) > MAX_BATCH:
            raise HaruspexValidationError(f"symbols length must be <= {MAX_BATCH}")
        normalized = [_normalize_symbol(s) for s in symbols]
        data, meta = await self._c._request("POST", "/scores/batch", json={"symbols": normalized})
        return BatchResponse.model_validate(_attach_meta(data, meta))

    async def history(
        self,
        symbol: str,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> HistoryResponse:
        sym = _normalize_symbol(symbol)
        lim = _clamp_limit("limit", limit, MAX_HISTORY_LIMIT)
        params = _build_history_query(from_, to, lim)
        data, meta = await self._c._request("GET", f"/scores/{sym}/history", params=params)
        return HistoryResponse.model_validate(_attach_meta(data, meta))


class Haruspex(_BaseClient):
    """Synchronous Haruspex API client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = BASE_URL,
        timeout: float = 10.0,
        max_retries: int = 2,
        user_agent: Optional[str] = None,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        super().__init__(api_key, base_url, timeout, max_retries, user_agent)
        self._http = httpx.Client(timeout=timeout, transport=transport)
        self.scores = _Scores(self)

    def __enter__(self) -> "Haruspex":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def search(self, query: str, limit: Optional[int] = None) -> SearchResponse:
        if not isinstance(query, str) or query.strip() == "":
            raise HaruspexValidationError("query must be a non-empty string")
        lim = _clamp_limit("limit", limit, MAX_SEARCH_LIMIT)
        params: dict[str, str] = {"q": query.strip()}
        if lim is not None:
            params["limit"] = str(lim)
        data, meta = self._request("GET", "/search", params=params)
        return SearchResponse.model_validate(_attach_meta(data, meta))

    def news(self, symbol: str, limit: Optional[int] = None) -> NewsResponse:
        sym = _normalize_symbol(symbol)
        lim = _clamp_limit("limit", limit, MAX_NEWS_LIMIT)
        params: dict[str, str] = {}
        if lim is not None:
            params["limit"] = str(lim)
        data, meta = self._request("GET", f"/stocks/{sym}/news", params=params)
        return NewsResponse.model_validate(_attach_meta(data, meta))

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, str]] = None,
        json: Optional[dict[str, Any]] = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        attempt = 0
        last: Optional[Exception] = None
        while attempt <= self.max_retries:
            try:
                return self._request_once(method, path, params=params, json=json)
            except HaruspexError as err:
                last = err
                if not _is_retryable(err) or attempt == self.max_retries:
                    raise
                wait_ms = (
                    err.retry_after_ms
                    if isinstance(err, HaruspexRateLimitError) and err.retry_after_ms is not None
                    else _backoff_ms(attempt)
                )
                time.sleep(wait_ms / 1000.0)
                attempt += 1
        raise last or HaruspexError("Unknown error", status=0)

    def _request_once(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, str]] = None,
        json: Optional[dict[str, Any]] = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        url = f"{self.base_url}{path}"
        headers = self._headers(has_body=json is not None)
        try:
            response = self._http.request(
                method, url, params=params, json=json, headers=headers
            )
        except httpx.HTTPError as exc:
            raise HaruspexNetworkError(str(exc), status=0) from exc
        return _process_response(response)


class AsyncHaruspex(_BaseClient):
    """Asynchronous Haruspex API client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = BASE_URL,
        timeout: float = 10.0,
        max_retries: int = 2,
        user_agent: Optional[str] = None,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        super().__init__(api_key, base_url, timeout, max_retries, user_agent)
        self._http = httpx.AsyncClient(timeout=timeout, transport=transport)
        self.scores = _AsyncScores(self)

    async def __aenter__(self) -> "AsyncHaruspex":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()

    async def close(self) -> None:
        await self._http.aclose()

    async def search(self, query: str, limit: Optional[int] = None) -> SearchResponse:
        if not isinstance(query, str) or query.strip() == "":
            raise HaruspexValidationError("query must be a non-empty string")
        lim = _clamp_limit("limit", limit, MAX_SEARCH_LIMIT)
        params: dict[str, str] = {"q": query.strip()}
        if lim is not None:
            params["limit"] = str(lim)
        data, meta = await self._request("GET", "/search", params=params)
        return SearchResponse.model_validate(_attach_meta(data, meta))

    async def news(self, symbol: str, limit: Optional[int] = None) -> NewsResponse:
        sym = _normalize_symbol(symbol)
        lim = _clamp_limit("limit", limit, MAX_NEWS_LIMIT)
        params: dict[str, str] = {}
        if lim is not None:
            params["limit"] = str(lim)
        data, meta = await self._request("GET", f"/stocks/{sym}/news", params=params)
        return NewsResponse.model_validate(_attach_meta(data, meta))

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, str]] = None,
        json: Optional[dict[str, Any]] = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        import asyncio

        attempt = 0
        last: Optional[Exception] = None
        while attempt <= self.max_retries:
            try:
                return await self._request_once(method, path, params=params, json=json)
            except HaruspexError as err:
                last = err
                if not _is_retryable(err) or attempt == self.max_retries:
                    raise
                wait_ms = (
                    err.retry_after_ms
                    if isinstance(err, HaruspexRateLimitError) and err.retry_after_ms is not None
                    else _backoff_ms(attempt)
                )
                await asyncio.sleep(wait_ms / 1000.0)
                attempt += 1
        raise last or HaruspexError("Unknown error", status=0)

    async def _request_once(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, str]] = None,
        json: Optional[dict[str, Any]] = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        url = f"{self.base_url}{path}"
        headers = self._headers(has_body=json is not None)
        try:
            response = await self._http.request(
                method, url, params=params, json=json, headers=headers
            )
        except httpx.HTTPError as exc:
            raise HaruspexNetworkError(str(exc), status=0) from exc
        return _process_response(response)


def _process_response(
    response: httpx.Response,
) -> tuple[dict[str, Any], ResponseMeta]:
    text = response.text
    parsed: Any = None
    if text:
        try:
            parsed = response.json()
        except ValueError:
            parsed = None

    if response.status_code >= 400:
        retry_after = _parse_retry_after(response.headers.get("retry-after"))
        raise _error_for(response.status_code, parsed, retry_after)

    if not isinstance(parsed, dict) or parsed.get("status") != "success":
        raise HaruspexError(
            "Malformed response from server",
            status=response.status_code,
            body=parsed,
        )

    data = parsed.get("data")
    meta_raw = parsed.get("meta") or {}
    if not isinstance(data, dict):
        data = {"value": data}
    meta = ResponseMeta.model_validate(meta_raw)
    return data, meta


__all__ = ["Haruspex", "AsyncHaruspex"]
