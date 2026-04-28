import { Haruspex } from "@haruspex-guru-sdk/sdk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { handleToolCall, TOOL_DEFINITIONS } from "./tools.js";

export interface BuildServerOptions {
  apiKey: string;
  client?: Haruspex;
}

export function buildServer(options: BuildServerOptions): Server {
  const client =
    options.client ??
    new Haruspex({
      apiKey: options.apiKey,
      userAgent: "haruspex-mcp-server/0.1.3",
    });

  const server = new Server(
    { name: "haruspex", version: "0.1.3" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await handleToolCall(client, name, args ?? {});
    return result as unknown as Awaited<ReturnType<Parameters<typeof server.setRequestHandler>[1]>>;
  });

  return server;
}
