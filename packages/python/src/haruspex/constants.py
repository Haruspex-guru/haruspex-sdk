"""Public constants for the Haruspex SDK."""

from typing import Final, Literal

BASE_URL: Final[str] = "https://haruspex.guru/api/v1"

SDK_VERSION: Final[str] = "0.1.3"

TELEMETRY_DEFAULT_ENDPOINT: Final[str] = "https://haruspex.guru/api/v1/telemetry/events"

TOPIC_SLUGS: Final[tuple[str, ...]] = (
    "ai-exposure",
    "climate-risk",
    "competitors",
    "concentration-risk",
    "earnings",
    "esg",
    "github-activity",
    "insider-trading",
    "institutional",
    "macro",
    "management",
    "patents",
    "regulatory",
    "supplychain",
    "us_china_official",
    "us_china_unofficial",
)

OUTLOOKS: Final[tuple[str, ...]] = ("bullish", "neutral", "bearish")
SIGNALS: Final[tuple[str, ...]] = ("buy", "hold", "sell")

Outlook = Literal["bullish", "neutral", "bearish"]
Signal = Literal["buy", "hold", "sell"]

MAX_BATCH: Final[int] = 50
MAX_HISTORY_LIMIT: Final[int] = 90
MAX_SEARCH_LIMIT: Final[int] = 20
MAX_NEWS_LIMIT: Final[int] = 20
