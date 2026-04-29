"""Official Haruspex SDK for Python.

Stock intelligence scores (0-100) across 16 dimensions.
"""

from haruspex.client import AsyncHaruspex, Haruspex
from haruspex.constants import (
    BASE_URL,
    MAX_BATCH,
    MAX_HISTORY_LIMIT,
    MAX_NEWS_LIMIT,
    MAX_SEARCH_LIMIT,
    OUTLOOKS,
    SDK_VERSION,
    SIGNALS,
    TELEMETRY_DEFAULT_ENDPOINT,
    TOPIC_SLUGS,
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
from haruspex.telemetry import (
    AsyncTelemetryClient,
    TelemetryClient,
    TelemetryOptions,
)
from haruspex.types import (
    BatchResponse,
    BatchResult,
    HistoryResponse,
    HistoryResult,
    NewsArticle,
    NewsResponse,
    NewsResult,
    RateLimit,
    ResponseMeta,
    Score,
    ScoreResponse,
    SearchResponse,
    SearchResult,
    SearchResultItem,
    TopicScore,
)

__version__ = "0.1.3"

__all__ = [
    "AsyncHaruspex",
    "AsyncTelemetryClient",
    "BASE_URL",
    "BatchResponse",
    "BatchResult",
    "Haruspex",
    "HaruspexAuthError",
    "HaruspexError",
    "HaruspexNetworkError",
    "HaruspexNotFoundError",
    "HaruspexRateLimitError",
    "HaruspexServerError",
    "HaruspexValidationError",
    "HistoryResponse",
    "HistoryResult",
    "MAX_BATCH",
    "MAX_HISTORY_LIMIT",
    "MAX_NEWS_LIMIT",
    "MAX_SEARCH_LIMIT",
    "NewsArticle",
    "NewsResponse",
    "NewsResult",
    "OUTLOOKS",
    "RateLimit",
    "ResponseMeta",
    "SDK_VERSION",
    "SIGNALS",
    "Score",
    "ScoreResponse",
    "SearchResponse",
    "SearchResult",
    "SearchResultItem",
    "TELEMETRY_DEFAULT_ENDPOINT",
    "TOPIC_SLUGS",
    "TelemetryClient",
    "TelemetryOptions",
    "TopicScore",
    "__version__",
]
