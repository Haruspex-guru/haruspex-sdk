# @haruspex/mcp-server

Official Haruspex [Model Context Protocol](https://modelcontextprotocol.io)
server. Brings stock intelligence scores into any MCP-compatible
application — Claude Desktop, Cursor, Windsurf, Zed, Continue.dev, and
others — with no code.

This package is a thin server process. All HTTP logic is delegated to
[`@haruspex/sdk`](../js/README.md).

## Quickstart — Claude Desktop

Edit your `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "haruspex": {
      "command": "npx",
      "args": ["-y", "@haruspex/mcp-server"],
      "env": { "HARUSPEX_API_KEY": "hrspx_live_a7c52f9315a65c377fec9c30b53f266b" }
    }
  }
}
```

Quit and re-open Claude Desktop. Try asking:

- *"What's the Haruspex score for NVDA?"*
- *"Compare AAPL and MSFT using Haruspex."*
- *"Show me TSLA's 30-day Haruspex score history."*
- *"Search for Apple stocks."*
- *"What's driving the latest move in NVDA?"*

## Quickstart — Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "haruspex": {
      "command": "npx",
      "args": ["-y", "@haruspex/mcp-server"],
      "env": { "HARUSPEX_API_KEY": "hrspx_live_a7c52f9315a65c377fec9c30b53f266b" }
    }
  }
}
```

## Quickstart — Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "haruspex": {
      "command": "npx",
      "args": ["-y", "@haruspex/mcp-server"],
      "env": { "HARUSPEX_API_KEY": "hrspx_live_a7c52f9315a65c377fec9c30b53f266b" }
    }
  }
}
```

## Other MCP clients

Any client that speaks MCP over stdio can use:

| Field   | Value                              |
| ------- | ---------------------------------- |
| Command | `npx`                              |
| Args    | `-y @haruspex/mcp-server`          |
| Env     | `HARUSPEX_API_KEY=hrspx_...`       |

## Tools

| Tool                       | Example prompt                                          |
| -------------------------- | ------------------------------------------------------- |
| `get_stock_score`          | "What is the Haruspex score for NVDA?"                  |
| `get_batch_scores`         | "Compare AAPL, MSFT, and GOOGL on Haruspex."            |
| `get_stock_score_history`  | "Show TSLA's last 30 days of Haruspex scores."          |
| `search_stocks`            | "Find the ticker for Apple Hospitality."                |
| `get_stock_news`           | "What recent news might be moving NVDA's score?"        |

## Authentication

Three tiers, same as the SDK:

- **Demo key** (`hrspx_live_a7c52f9315a65c377fec9c30b53f266b`): 20 req/hr per IP, no
  signup. Right for evaluation. The server falls back to this key with a
  one-line stderr warning if `HARUSPEX_API_KEY` is unset.
- **Free key**: 1,000 req/month. Sign up with GitHub at
  [haruspex.guru/developers](https://haruspex.guru/developers).
- **Pro / Institutional**: see the pricing page.

## Troubleshooting

- **The server doesn't appear in my client's tool list.** Quit and reopen
  the application — most clients only read MCP config at startup.
- **"Authentication failed"** in tool output. Your `HARUSPEX_API_KEY` is
  invalid or empty. Get a free one at
  [haruspex.guru/developers](https://haruspex.guru/developers).
- **"Rate limit exceeded"** in tool output. The demo key is 20 req/hr per
  IP. A free key is 1,000 req/month.

## Privacy

This server makes HTTP requests only to `haruspex.guru`. No telemetry, no
analytics, no third-party calls. Source is in this repository — audit it.

## License

MIT.
