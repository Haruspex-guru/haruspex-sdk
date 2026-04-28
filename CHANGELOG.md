# Changelog

All notable changes to this project are documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-04-28

### Changed

- Switch publish workflow from `pnpm publish` to `npm publish` for the JS
  packages. pnpm publish does not currently surface the GitHub OIDC token
  to the npm registry, which caused the 0.1.1 npm publish to return a
  misleading 404. PyPI 0.1.1 published successfully via OIDC; this bump
  realigns all three packages on a single working version.

## [0.1.1] - 2026-04-28

### Changed

- First release published from the GitHub Actions `publish` workflow via
  npm and PyPI trusted publishing (OIDC). PyPI succeeded; npm failed due
  to the pnpm/OIDC issue resolved in 0.1.2. PyPI release available at
  https://pypi.org/project/haruspex-sdk/0.1.1/ but no matching npm
  package — use 0.1.2 or later.

## [0.1.0] - 2026-04-28

### Added

- Initial public release.
- TypeScript SDK (`@haruspex-guru-sdk/sdk`) with sync API for `scores.get`,
  `scores.batch`, `scores.history`, `search`, and `news`. ESM + CJS builds,
  bundled `.d.ts`, zero runtime dependencies, Node 18+.
- Python SDK (`haruspex-sdk`) exposing both `Haruspex` (sync) and
  `AsyncHaruspex` (async) with identical surface. Built on `httpx` and
  `pydantic` v2, Python 3.9+.
- MCP server (`@haruspex-guru-sdk/mcp-server`) exposing five tools — `get_stock_score`,
  `get_batch_scores`, `get_stock_score_history`, `search_stocks`,
  `get_stock_news` — over stdio for use in Claude Desktop, Cursor, Windsurf,
  and any MCP-compatible client.
- OpenAPI 3.1 specification (`openapi.yaml`) covering all five endpoints.
- Five runnable examples: single-score CLI (JS, Python), portfolio
  watchlist, Discord bot, Streamlit dashboard.
- Captured-response test fixtures and `scripts/capture-fixtures.sh` for
  re-capturing them against the live API.

[Unreleased]: https://github.com/Haruspex-guru/haruspex-sdk/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/Haruspex-guru/haruspex-sdk/releases/tag/v0.1.2
[0.1.1]: https://github.com/Haruspex-guru/haruspex-sdk/releases/tag/v0.1.1
[0.1.0]: https://github.com/Haruspex-guru/haruspex-sdk/releases/tag/v0.1.0
