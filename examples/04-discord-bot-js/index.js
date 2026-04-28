import { Client, GatewayIntentBits } from "discord.js";
import { Haruspex, HaruspexNotFoundError, HaruspexRateLimitError } from "@haruspex-guru-sdk/sdk";

const DEMO_KEY = "hrspx_live_a7c52f9315a65c377fec9c30b53f266b";

const haruspex = new Haruspex({
  apiKey: process.env.HARUSPEX_API_KEY ?? DEMO_KEY,
});

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

bot.once("ready", () => {
  console.log(`Logged in as ${bot.user.tag}`);
});

bot.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  const match = msg.content.match(/^!score\s+([A-Za-z0-9.\-]{1,12})$/);
  if (!match) return;

  const symbol = match[1].toUpperCase();
  try {
    const s = await haruspex.scores.get(symbol);
    const sign = s.change >= 0 ? `+${s.change}` : `${s.change}`;
    const lines = [
      `**${s.symbol}** — Haruspex Score: **${s.score}/100** (${s.outlook})`,
      `Signal: ${s.signal} | Change: ${sign}`,
      s.shareUrl,
    ];
    await msg.reply(lines.join("\n"));
  } catch (err) {
    if (err instanceof HaruspexNotFoundError) {
      await msg.reply(`Symbol \`${symbol}\` not found in the Haruspex universe.`);
    } else if (err instanceof HaruspexRateLimitError) {
      await msg.reply("Rate limit hit. Try again in a minute.");
    } else {
      await msg.reply(`Lookup failed: ${err.message}`);
    }
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN");
  process.exit(1);
}
bot.login(token);
