# 04 — Discord bot (JavaScript)

Minimal Discord bot. Replies to `!score <SYMBOL>` with the latest Haruspex
score, outlook, and signal.

## Prerequisites

- Node 18+
- A Discord application + bot token. Create one at
  [discord.com/developers/applications](https://discord.com/developers/applications)
  and enable the **Message Content Intent** under "Bot".
- A Haruspex API key (or rely on the demo-key fallback).

## Install & run

```bash
cd examples/04-discord-bot-js
npm install
DISCORD_TOKEN=... HARUSPEX_API_KEY=hrspx_... node index.js
```

Invite the bot to a server with `Send Messages` and `Read Message History`
permissions, then post `!score TSLA` in any channel.

## Expected interaction

Captured response shape (the body is what the bot replies; values change daily):

```
You: !score AAPL
Bot: **AAPL** — Haruspex Score: **75/100** (bullish)
     Signal: buy | Change: -4
     https://haruspex.guru/s/Ib70IGTaXpXtFIj0D7_vrnrR
```
