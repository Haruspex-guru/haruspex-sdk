import { readFileSync } from "node:fs";
import { Haruspex } from "@haruspex-guru-sdk/sdk";

const DEMO_KEY = "hrspx_live_a7c52f9315a65c377fec9c30b53f266b";

async function main() {
  const file = process.argv[2] ?? "watchlist.json";
  const symbols = JSON.parse(readFileSync(file, "utf-8"));

  const client = new Haruspex({
    apiKey: process.env.HARUSPEX_API_KEY ?? DEMO_KEY,
  });

  const res = await client.scores.batch(symbols);
  const sorted = [...res.scores].sort((a, b) => b.score - a.score);

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`${pad("Symbol", 8)}${pad("Score", 8)}${pad("Outlook", 10)}${pad("Signal", 8)}Change`);
  console.log("-".repeat(40));
  for (const s of sorted) {
    const change = s.change >= 0 ? `+${s.change}` : `${s.change}`;
    console.log(
      `${pad(s.symbol, 8)}${pad(s.score, 8)}${pad(s.outlook, 10)}${pad(s.signal, 8)}${change}`,
    );
  }

  const rl = res._meta.rateLimit;
  if (rl) console.log(`\nCredits remaining: ${res._meta.creditsRemaining}, RL: ${rl.remaining}/${rl.limit}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
