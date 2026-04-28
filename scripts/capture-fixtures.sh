#!/usr/bin/env bash
# Re-capture test fixtures from the live Haruspex API.
#
# Usage:
#   HARUSPEX_API_KEY=hrspx_... ./scripts/capture-fixtures.sh
#
# Each fixture is the verbatim JSON response from the live API, pretty-printed,
# with meta.requestId scrubbed to a stable value so diffs stay small across runs.
# Fixtures are written to both packages/js/test/fixtures and
# packages/python/tests/fixtures.

set -euo pipefail

if [[ -z "${HARUSPEX_API_KEY:-}" ]]; then
  echo "error: HARUSPEX_API_KEY env var is required" >&2
  exit 1
fi

BASE_URL="${HARUSPEX_BASE_URL:-https://haruspex.guru/api/v1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JS_DIR="$ROOT/packages/js/test/fixtures"
PY_DIR="$ROOT/packages/python/tests/fixtures"

mkdir -p "$JS_DIR" "$PY_DIR"

capture() {
  local name="$1"
  local stable_id="req_fixture_${name}"
  shift
  local out
  out=$(curl -sS --fail-with-body "$@" -H "Authorization: Bearer $HARUSPEX_API_KEY")
  echo "$out" | jq ".meta.requestId = \"$stable_id\"" > "$JS_DIR/$name.json"
  cp "$JS_DIR/$name.json" "$PY_DIR/$name.json"
  echo "captured $name.json ($(wc -c < "$JS_DIR/$name.json") bytes)"
}

capture score "$BASE_URL/scores/AAPL"
capture batch -X POST -H "Content-Type: application/json" \
  -d '{"symbols":["AAPL","NVDA","MSFT"]}' "$BASE_URL/scores/batch"
capture history "$BASE_URL/scores/AAPL/history?limit=5"
capture search "$BASE_URL/search?q=apple&limit=3"
capture news "$BASE_URL/stocks/AAPL/news?limit=3"

echo "done."
