import { Haruspex } from "@haruspex/sdk";

const DEMO_KEY = "hrspx_live_a7c52f9315a65c377fec9c30b53f266b";

async function main() {
  const symbol = process.argv[2];
  if (!symbol) {
    console.error("usage: node index.js <SYMBOL>");
    process.exit(1);
  }

  const client = new Haruspex({
    apiKey: process.env.HARUSPEX_API_KEY ?? DEMO_KEY,
  });

  const res = await client.scores.get(symbol);

  console.log(`${res.symbol}: ${res.score}/100 (${res.outlook}, signal=${res.signal})`);
  console.log(`Day-over-day change: ${res.change >= 0 ? "+" : ""}${res.change}`);
  console.log(`Share: ${res.shareUrl}`);

  const top = Object.values(res.topicScores)
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  console.log("\nTop 3 topic scores:");
  for (const t of top) {
    console.log(`  ${t.name}: ${t.score}/100`);
  }

  const rl = res._meta.rateLimit;
  if (rl) {
    console.log(`\nRate-limit remaining: ${rl.remaining}/${rl.limit}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
