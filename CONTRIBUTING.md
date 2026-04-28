# Contributing

Thanks for considering a contribution to the Haruspex SDK. This repo is the
public client surface for the [Haruspex](https://haruspex.guru) API. The
scoring engine itself is closed-source and lives elsewhere; this repo only
contains the API client, OpenAPI spec, MCP server, and runnable examples.

## What this repo accepts

- Bug fixes in the JS, Python, or MCP packages.
- New examples that demonstrate real, runnable use cases.
- Improvements to docs, type signatures, error messages, retry logic.
- Updates to the OpenAPI spec when the live API surface changes.
- New language SDKs (Go, Ruby, Rust, etc.) — open an issue first to discuss.

## What this repo does not accept

Pull requests modifying scoring logic, dimension semantics, or proprietary
methodology will be closed. The scoring engine is not part of this repo and
any guesses at its behavior would be wrong. If you want to influence scoring,
[open an issue](https://github.com/Haruspex-guru/haruspex-sdk/issues) and tag it
`scoring-feedback`.

## Local development

```bash
git clone https://github.com/Haruspex-guru/haruspex-sdk
cd haruspex-sdk

# JS + MCP
pnpm install
pnpm -r build
pnpm -r test

# Python
cd packages/python
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

The JS SDK and MCP server are in a pnpm workspace; the MCP server depends on
`@haruspex/sdk` via `workspace:^` so changes to the SDK are picked up
immediately.

## Running tests

Tests use captured fixtures in `packages/{js,python}/test*/fixtures/`. They
do **not** call the live API. To re-capture fixtures (when the API surface
changes), run:

```bash
HARUSPEX_API_KEY=hrspx_... ./scripts/capture-fixtures.sh
```

Never hand-write fixture JSON. Every byte in those files must come from a
real API response.

## PR conventions

- Use [conventional commits](https://www.conventionalcommits.org) for commit
  messages and PR titles: `feat:`, `fix:`, `docs:`, `chore:`, `test:`,
  `refactor:`.
- Keep PRs focused. Prefer two small PRs over one big one.
- Add tests for any behavior change in the SDKs.
- Update `CHANGELOG.md` under the `[Unreleased]` section.

## Code style

- **JS/TS:** prettier + eslint. Run `pnpm -r lint` before pushing.
- **Python:** ruff + black. Run `ruff check . && black --check .` before
  pushing.

## Distribution targets

After a tagged release, the maintainer submits the MCP server to the
following discovery surfaces. Community PRs that nudge these submissions are
welcome:

- [`awesome-mcp-servers`](https://github.com/punkpeye/awesome-mcp-servers) —
  Finance category.
- [`mcp-get`](https://mcp-get.com).
- The official MCP servers list at
  [modelcontextprotocol.io](https://modelcontextprotocol.io).
- [Smithery.ai](https://smithery.ai).
- [LobeHub MCP marketplace](https://lobehub.com/mcp).

## Reporting security issues

Do not open a public issue. See [SECURITY.md](./SECURITY.md).
