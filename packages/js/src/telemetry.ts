import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { TELEMETRY_DEFAULT_ENDPOINT } from "./constants.js";

export interface TelemetryOptions {
  enabled?: boolean;
  endpoint?: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  fetch?: typeof fetch;
  clientIdPath?: string;
}

export type TelemetrySdkName = "js" | "mcp" | "python";
export type TelemetryEventType = "request" | "tool_call";

export interface TelemetryEvent {
  anonymous_client_id: string;
  sdk_name: TelemetrySdkName;
  sdk_version: string;
  event_type: TelemetryEventType;
  endpoint?: string;
  tool_name?: string;
  symbol_or_query?: string;
  http_status?: number;
  latency_ms: number;
  error_type?: string | null;
  timestamp_iso: string;
}

export type TelemetryRecordInput = Omit<
  TelemetryEvent,
  "anonymous_client_id" | "sdk_name" | "sdk_version" | "timestamp_iso"
>;

const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_BATCH = 20;
const POST_TIMEOUT_MS = 2000;

function envTrue(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function resolveEnabled(
  opt: boolean | undefined,
  env: NodeJS.ProcessEnv,
): boolean {
  if (envTrue(env.DO_NOT_TRACK)) return false;
  if (opt === true) return true;
  if (opt === false) return false;
  return envTrue(env.HARUSPEX_TELEMETRY);
}

function defaultClientIdPath(): string {
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg) return join(xdg, "haruspex", "id");
  return join(homedir(), ".haruspex", "id");
}

function isUuidLike(s: string): boolean {
  return /^[0-9a-f-]{8,}$/i.test(s.trim()) && s.trim().length <= 64;
}

function makeUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function loadOrCreateClientId(path?: string): string {
  const p = path ?? defaultClientIdPath();
  try {
    if (existsSync(p)) {
      const v = readFileSync(p, "utf-8").trim();
      if (isUuidLike(v)) return v;
    }
  } catch {}
  const id = makeUuid();
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, id, "utf-8");
  } catch {}
  return id;
}

export function templatize(method: string, path: string): string {
  const raw = path.split("?")[0];
  let p = raw;
  if (/^\/scores\/batch$/i.test(raw)) p = "/scores/batch";
  else if (/^\/scores\/[^/]+\/history$/i.test(raw)) p = "/scores/{symbol}/history";
  else if (/^\/scores\/[^/]+$/i.test(raw)) p = "/scores/{symbol}";
  else if (/^\/stocks\/[^/]+\/news$/i.test(raw)) p = "/stocks/{symbol}/news";
  else if (/^\/search$/i.test(raw)) p = "/search";
  return `${method.toUpperCase()} ${p}`;
}

export class TelemetryClient {
  enabled: boolean;
  private readonly apiKey: string;
  private readonly sdkName: TelemetrySdkName;
  private readonly sdkVersion: string;
  private readonly endpoint: string;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly fetchImpl: typeof fetch;
  private readonly clientId: string;
  private queue: TelemetryEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private shuttingDown = false;
  private inFlight: Promise<void> | null = null;

  constructor(opts: {
    apiKey: string;
    sdkName: TelemetrySdkName;
    sdkVersion: string;
    options?: TelemetryOptions;
  }) {
    const o = opts.options ?? {};
    this.enabled = resolveEnabled(o.enabled, process.env);
    this.apiKey = opts.apiKey;
    this.sdkName = opts.sdkName;
    this.sdkVersion = opts.sdkVersion;
    this.endpoint =
      o.endpoint ?? process.env.HARUSPEX_TELEMETRY_ENDPOINT ?? TELEMETRY_DEFAULT_ENDPOINT;
    this.flushIntervalMs = o.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBatchSize = o.maxBatchSize ?? DEFAULT_MAX_BATCH;
    this.fetchImpl = o.fetch ?? globalThis.fetch;
    this.clientId = this.enabled ? loadOrCreateClientId(o.clientIdPath) : "";
    if (this.enabled) {
      this.startTimer();
    }
  }

  private startTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    if (typeof this.timer === "object" && this.timer !== null && "unref" in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  record(ev: TelemetryRecordInput): void {
    if (!this.enabled || this.shuttingDown) return;
    const full: TelemetryEvent = {
      anonymous_client_id: this.clientId,
      sdk_name: this.sdkName,
      sdk_version: this.sdkVersion,
      timestamp_iso: new Date().toISOString(),
      ...ev,
    };
    this.queue.push(full);
    if (this.queue.length >= this.maxBatchSize) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    if (this.inFlight) {
      try {
        await this.inFlight;
      } catch {}
    }
    const batch = this.queue.splice(0, this.queue.length);
    this.inFlight = this.send(batch).finally(() => {
      this.inFlight = null;
    });
    try {
      await this.inFlight;
    } catch {}
  }

  private async send(batch: TelemetryEvent[]): Promise<void> {
    if (typeof this.fetchImpl !== "function") return;
    const attempt = async (): Promise<Response | null> => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS);
      try {
        const r = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ events: batch }),
          signal: ctrl.signal,
        });
        return r;
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
    };
    try {
      let res = await attempt();
      if (!res || (res.status >= 500 && res.status < 600)) {
        res = await attempt();
      }
      try {
        if (res && res.body) {
          const reader = (res as unknown as { body: { cancel?: () => void } }).body;
          reader.cancel?.();
        }
      } catch {}
    } catch {}
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
    if (this.inFlight) {
      try {
        await this.inFlight;
      } catch {}
    }
  }
}
