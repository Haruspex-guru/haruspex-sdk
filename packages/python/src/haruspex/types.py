"""Pydantic models mirroring the Haruspex API response shapes."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class TopicScore(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str
    score: int
    change: int


class RateLimit(BaseModel):
    model_config = ConfigDict(extra="allow")
    limit: Optional[int] = None
    remaining: Optional[int] = None
    reset_at: Optional[str] = Field(default=None, alias="resetAt")


class ResponseMeta(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    request_id: str = Field(alias="requestId")
    timestamp: str
    credits_used: Optional[int] = Field(default=None, alias="creditsUsed")
    credits_remaining: Optional[int] = Field(default=None, alias="creditsRemaining")
    rate_limit: Optional[RateLimit] = Field(default=None, alias="rateLimit")


class Score(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    symbol: str
    name: Optional[str] = None
    score: int
    previous_score: Optional[int] = Field(default=None, alias="previousScore")
    change: int
    outlook: str
    signal: str
    topic_scores: dict[str, TopicScore] = Field(default_factory=dict, alias="topicScores")
    date: str
    analyzed_at: Optional[str] = Field(default=None, alias="analyzedAt")
    trading_timeline: Optional[str] = Field(default=None, alias="tradingTimeline")
    cached: Optional[bool] = None
    version: Optional[str] = None
    share_url: Optional[str] = Field(default=None, alias="shareUrl")


class _WithMeta(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    meta: ResponseMeta = Field(alias="_meta")


class ScoreResponse(Score):
    """A `Score` plus a `meta` accessor (`response.meta.rate_limit`, etc.)."""

    meta: ResponseMeta = Field(alias="_meta")


class BatchResult(BaseModel):
    model_config = ConfigDict(extra="allow")
    count: int
    scores: list[Score]


class BatchResponse(BatchResult):
    meta: ResponseMeta = Field(alias="_meta")


class HistoryResult(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    symbol: str
    from_: Optional[str] = Field(default=None, alias="from")
    to: Optional[str] = None
    count: int
    scores: list[Score]


class HistoryResponse(HistoryResult):
    meta: ResponseMeta = Field(alias="_meta")


class SearchResultItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    symbol: str
    name: str
    exchange: Optional[str] = None
    type: Optional[str] = None


class SearchResult(BaseModel):
    model_config = ConfigDict(extra="allow")
    results: list[SearchResultItem]


class SearchResponse(SearchResult):
    meta: ResponseMeta = Field(alias="_meta")


class NewsArticle(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    title: str
    url: str
    published_at: Optional[str] = Field(default=None, alias="publishedAt")
    source: Optional[str] = None
    image: Optional[str] = None


class NewsResult(BaseModel):
    model_config = ConfigDict(extra="allow")
    symbol: str
    articles: list[NewsArticle]


class NewsResponse(NewsResult):
    meta: ResponseMeta = Field(alias="_meta")


def _attach_meta(data: dict[str, Any], meta: ResponseMeta) -> dict[str, Any]:
    out = dict(data)
    out["_meta"] = meta.model_dump(by_alias=True)
    return out
