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
    SIGNALS,
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
    "SIGNALS",
    "Score",
    "ScoreResponse",
    "SearchResponse",
    "SearchResult",
    "SearchResultItem",
    "TOPIC_SLUGS",
    "TopicScore",
    "__version__",
]
