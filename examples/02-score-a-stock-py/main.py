"""Print one ticker's score and top 3 topic dimensions."""

from __future__ import annotations

import os
import sys

from haruspex import Haruspex

DEMO_KEY = "hrspx_live_a7c52f9315a65c377fec9c30b53f266b"


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python main.py <SYMBOL>", file=sys.stderr)
        return 1

    symbol = sys.argv[1]
    api_key = os.environ.get("HARUSPEX_API_KEY", DEMO_KEY)

    with Haruspex(api_key=api_key) as client:
        res = client.scores.get(symbol)

    sign = "+" if res.change >= 0 else ""
    print(f"{res.symbol}: {res.score}/100 ({res.outlook}, signal={res.signal})")
    print(f"Day-over-day change: {sign}{res.change}")
    if res.share_url:
        print(f"Share: {res.share_url}")

    top = sorted(
        (t for t in res.topic_scores.values() if t is not None),
        key=lambda t: t.score,
        reverse=True,
    )[:3]
    print("\nTop 3 topic scores:")
    for t in top:
        print(f"  {t.name}: {t.score}/100")

    rl = res.meta.rate_limit
    if rl is not None:
        print(f"\nRate-limit remaining: {rl.remaining}/{rl.limit}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
