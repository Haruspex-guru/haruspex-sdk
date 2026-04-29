import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

const PUBLIC_DEMO_KEY = "hrspx_live_a7c52f9315a65c377fec9c30b53f266b";

async function main(): Promise<void> {
  let apiKey = process.env.HARUSPEX_API_KEY;
  if (!apiKey) {
    apiKey = PUBLIC_DEMO_KEY;
    process.stderr.write(
      "[haruspex-mcp] Using public demo key (20 req/hr per IP). Get a free key at https://haruspex.guru/developers\n",
    );
  }

  const { server, telemetry } = buildServer({ apiKey });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = (): void => {
    void telemetry.shutdown();
  };
  process.once("SIGINT", () => {
    shutdown();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    shutdown();
    process.exit(0);
  });
  process.once("beforeExit", shutdown);
}

main().catch((err) => {
  process.stderr.write(`[haruspex-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
