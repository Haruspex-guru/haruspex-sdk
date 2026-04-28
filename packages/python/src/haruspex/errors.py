"""Exception hierarchy for the Haruspex SDK."""

from __future__ import annotations

from typing import Any, Optional


class HaruspexError(Exception):
    """Base error for all SDK failures."""

    def __init__(
        self,
        message: str,
        *,
        status: int = 0,
        code: Optional[str] = None,
        request_id: Optional[str] = None,
        body: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.request_id = request_id
        self.body = body


class HaruspexAuthError(HaruspexError):
    """401 / 403 — missing or invalid API key."""


class HaruspexNotFoundError(HaruspexError):
    """404 — ticker not present in the scoring universe."""


class HaruspexRateLimitError(HaruspexError):
    """429 — per-minute or per-key rate limit exceeded."""

    def __init__(
        self,
        message: str,
        *,
        retry_after_ms: Optional[int] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(message, **kwargs)
        self.retry_after_ms = retry_after_ms


class HaruspexValidationError(HaruspexError):
    """400 / client-side input validation failure."""

    def __init__(self, message: str, **kwargs: Any) -> None:
        kwargs.setdefault("status", 400)
        super().__init__(message, **kwargs)


class HaruspexServerError(HaruspexError):
    """5xx — internal server error."""


class HaruspexNetworkError(HaruspexError):
    """Timeout, DNS, connection reset."""
