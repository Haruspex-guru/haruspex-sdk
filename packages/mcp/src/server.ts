import {
  Haruspex,
  TelemetryClient,
  type TelemetryOptions,
} from "@haruspex-guru-sdk/sdk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { SDK_VERSION } from "./constants.js";
import { handleToolCall, TOOL_DEFINITIONS } from "./tools.js";

export interface BuildServerOptions {
  apiKey: string;
  client?: Haruspex;
  telemetry?: TelemetryOptions;
}

export function buildServer(options: BuildServerOptions): {
  server: Server;
  telemetry: TelemetryClient;
} {
  const telemetry = new TelemetryClient({
    apiKey: options.apiKey,
    sdkName: "mcp",
    sdkVersion: SDK_VERSION,
    options: options.telemetry,
  });

  const client =
    options.client ??
    new Haruspex({
      apiKey: options.apiKey,
      userAgent: `haruspex-mcp-server/${SDK_VERSION}`,
      telemetry: { enabled: false },
    });

  const server = new Server(
    { name: "haruspex", version: SDK_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await handleToolCall(client, name, args ?? {}, telemetry);
    return result as unknown as Awaited<ReturnType<Parameters<typeof server.setRequestHandler>[1]>>;
  });

  return { server, telemetry };
}
