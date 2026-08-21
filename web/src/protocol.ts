export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export const CLIENT_VERSION = "0.1.0";
/** Wire `clientType` for grok-shell `ClientType::GrokWeb`. */
export const CLIENT_TYPE = "grok_web";
/** Identifier fallback the agent also maps to GrokWeb. */
export const CLIENT_IDENTIFIER = "grok-web";
export const PING_INTERVAL_MS = 15_000;
export const DEFAULT_WS_URL = "ws://127.0.0.1:2419/ws";
export const TAB_LOCK_CHANNEL = "grok-web-serve-lock";

export function buildWsUrl(base: string, secret: string): string {
  const url = new URL(base);
  if (secret) url.searchParams.set("server-key", secret);
  return url.toString();
}

export function buildInitializeParams(version = CLIENT_VERSION): Json {
  return {
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
      _meta: {
        "x.ai/folderTrust": { interactive: true },
      },
    },
    _meta: {
      clientType: CLIENT_TYPE,
      clientIdentifier: CLIENT_IDENTIFIER,
      clientVersion: version,
    },
  };
}

export type SessionLoadMetaInput = {
  cursor: string | null;
  yoloMode: boolean;
  autoMode: boolean;
};

export function buildSessionLoadMeta(input: SessionLoadMetaInput): {
  [k: string]: Json;
} {
  const meta: { [k: string]: Json } = {
    yoloMode: input.yoloMode,
    autoMode: input.autoMode,
  };
  if (input.cursor) meta.cursor = input.cursor;
  return meta;
}

export function buildSessionLoadParams(input: {
  sessionId: string;
  cwd: string;
  cursor: string | null;
  yoloMode: boolean;
  autoMode: boolean;
}): Json {
  return {
    sessionId: input.sessionId,
    cwd: input.cwd,
    mcpServers: [],
    _meta: buildSessionLoadMeta({
      cursor: input.cursor,
      yoloMode: input.yoloMode,
      autoMode: input.autoMode,
    }),
  };
}

export function buildSessionCancelParams(sessionId: string): Json {
  return { sessionId };
}

/**
 * ACP `AgentSide::decode_request` only treats `_`-prefixed names as extensions.
 * Unprefixed `x.ai/*` is -32601. Standard methods (`initialize`, `session/*`) stay bare.
 */
export function toWireMethod(method: string): string {
  if (method.startsWith("x.ai/")) return `_${method}`;
  return method;
}

/** ACP client→agent notifications must not carry `id` (decode_request would  -32601). */
export function buildJsonRpcNotification(
  method: string,
  params: Json,
): { jsonrpc: "2.0"; method: string; params: Json } {
  return { jsonrpc: "2.0", method: toWireMethod(method), params };
}

export function initializeAdvertisesLocalFsOrTerminal(params: Json): boolean {
  const rec =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as { [k: string]: Json })
      : null;
  const caps =
    rec?.clientCapabilities &&
    typeof rec.clientCapabilities === "object" &&
    !Array.isArray(rec.clientCapabilities)
      ? (rec.clientCapabilities as { [k: string]: Json })
      : null;
  const fs =
    caps?.fs && typeof caps.fs === "object" && !Array.isArray(caps.fs)
      ? (caps.fs as { [k: string]: Json })
      : null;
  return (
    fs?.readTextFile === true ||
    fs?.writeTextFile === true ||
    caps?.terminal === true
  );
}
