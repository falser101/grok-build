export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export const CLIENT_VERSION = "0.1.0";
/** Wire `clientType` for grok-shell `ClientType::GrokWeb`. */
export const CLIENT_TYPE = "grok_web";
/** Identifier fallback the agent also maps to GrokWeb. */
export const CLIENT_IDENTIFIER = "grok-web";
export const PING_INTERVAL_MS = 15_000;
/** Direct agent socket. Kept for e2e / advanced dock; the page default is same-origin `/ws`. */
export const DIRECT_AGENT_WS_URL = "ws://127.0.0.1:2419/ws";
export const DEFAULT_WS_URL = "ws://127.0.0.1:5173/ws";
export const TAB_LOCK_CHANNEL = "grok-web-serve-lock";

export type HostLocation = { protocol: string; host: string };

/** Same-origin Vite proxy. Secret stays on the Node side. */
export function defaultWsUrl(loc?: HostLocation | null): string {
  const src =
    loc ??
    (typeof location !== "undefined" && location.host
      ? { protocol: location.protocol, host: location.host }
      : null);
  if (src?.host) {
    const proto = src.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${src.host}/ws`;
  }
  return DEFAULT_WS_URL;
}

/** Ignore a leftover direct-to-2419 URL from the pre-proxy dock. */
export function resolveInitialWsUrl(
  stored: string | null | undefined,
  loc?: HostLocation | null,
): string {
  if (!stored || stored === DIRECT_AGENT_WS_URL) return defaultWsUrl(loc);
  return stored;
}

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
        "x.ai/statusLine": true,
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

/** Picker open: row cwd, never a reconnect cursor (C-35 / S-03). */
export function buildPickerSessionLoadParams(input: {
  sessionId: string;
  cwd: string;
  yoloMode?: boolean;
  autoMode?: boolean;
}): Json {
  return buildSessionLoadParams({
    sessionId: input.sessionId,
    cwd: input.cwd,
    cursor: null,
    yoloMode: input.yoloMode ?? false,
    autoMode: input.autoMode ?? false,
  });
}

export function pickerLoadOmitsCursor(params: Json): boolean {
  const rec =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as { [k: string]: Json })
      : null;
  const meta =
    rec?._meta && typeof rec._meta === "object" && !Array.isArray(rec._meta)
      ? (rec._meta as { [k: string]: Json })
      : null;
  return Boolean(rec?.cwd) && !("cursor" in (meta ?? {}));
}

export function buildSessionCancelParams(
  sessionId: string,
  opts?: { cancelSubagents?: boolean },
): Json {
  const params: { [k: string]: Json } = { sessionId };
  if (opts && typeof opts.cancelSubagents === "boolean") {
    params._meta = { cancelSubagents: opts.cancelSubagents };
  }
  return params;
}

/** ACP `ContentBlock` values Web may put on `session/prompt`. */
export type PromptContentBlock =
  | { type: "text"; text: string; _meta?: { [k: string]: Json } }
  | {
      type: "image";
      mimeType: string;
      data: string;
      uri?: string;
      _meta?: { [k: string]: Json };
    };

export type PromptImageInput = {
  mimeType: string;
  data: string;
  uri?: string;
  displayNumber?: number;
};

/** Image-block `_meta` key the TUI stamps so `[Image #N]` resolves by number. */
export const IMAGE_DISPLAY_NUMBER_META_KEY = "xai.dev/imageDisplayNumber";

/** Web `_meta.screenMode` (telemetry allowlist collapses unknown values). */
export const SCREEN_MODE_WEB = "web";

export function imagePlaceholder(n: number): string {
  return `[Image #${n}]`;
}

/** Visible caption: drop `[Image #N]` / `[Image #N: path]` chips. */
export function stripImagePlaceholders(text: string): string {
  return text
    .replace(/\[Image #\d+(?:: [^\]]+)?\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** True for `[Image #N]` / `[Image #N: path]`, not `[Image #N0]`. */
export function hasImagePlaceholder(text: string, n: number): boolean {
  return new RegExp(`\\[Image #${n}(?::|\\])`).test(text);
}

/**
 * Same cap as TUI `MAX_PLACEHOLDERS_PER_PROMPT`: extra path-form tokens
 * stay as written so a huge paste cannot rewrite unbounded matches.
 */
export const MAX_PLACEHOLDERS_PER_PROMPT = 16;

/** TUI producer: `[Image #<n>: <path>]` with a literal `": "` separator. */
const IMAGE_PATH_PLACEHOLDER_RE = /\[Image #(\d+): ([^\]\r\n]+?)\]/g;

/**
 * Drop the path from `[Image #N: /abs/path]` so the model is not tempted
 * to `Read` a file that is already an image block (TUI
 * `strip_paths_from_image_placeholders`).
 */
export function stripPathsFromImagePlaceholders(text: string): string {
  if (!/\[Image #\d+: /.test(text)) return text;
  IMAGE_PATH_PLACEHOLDER_RE.lastIndex = 0;
  let seen = 0;
  return text.replace(IMAGE_PATH_PLACEHOLDER_RE, (whole, n: string) => {
    seen += 1;
    if (seen > MAX_PLACEHOLDERS_PER_PROMPT) return whole;
    return imagePlaceholder(Number(n));
  });
}

/**
 * TUI composer already embeds `[Image #N]` chips in the prompt text. Web chips
 * live outside the textarea, so the wire text gets the same tokens appended.
 * `numbers` are the 1-based display numbers stamped on each image block.
 */
export function withImagePlaceholders(text: string, numbers: number[]): string {
  let out = text;
  for (const n of numbers) {
    if (hasImagePlaceholder(out, n)) continue;
    const token = imagePlaceholder(n);
    out = out.length === 0 ? token : `${out.replace(/\s+$/, "")} ${token}`;
  }
  return out;
}

/**
 * Text block first, then images — same order the TUI builder uses so the
 * model sees the query before attachments (Q-05). Image blocks carry
 * `xai.dev/imageDisplayNumber` so `[Image #N]` tokens resolve by number.
 * Path-form placeholders are shortened to `[Image #N]` on the wire.
 */
export function buildPromptContentBlocks(input: {
  text?: string;
  images?: PromptImageInput[];
}): PromptContentBlock[] {
  const images = input.images ?? [];
  const numbers = images.map((img, i) => img.displayNumber ?? i + 1);
  const text = stripPathsFromImagePlaceholders(
    images.length
      ? withImagePlaceholders(input.text ?? "", numbers)
      : (input.text ?? ""),
  );
  const blocks: PromptContentBlock[] = [];
  if (text.length) blocks.push({ type: "text", text });
  images.forEach((img, i) => {
    const displayNumber = img.displayNumber ?? i + 1;
    const block: PromptContentBlock = {
      type: "image",
      mimeType: img.mimeType,
      data: img.data,
      _meta: { [IMAGE_DISPLAY_NUMBER_META_KEY]: displayNumber },
    };
    if (img.uri) block.uri = img.uri;
    blocks.push(block);
  });
  return blocks;
}

function promptBlocksToJson(blocks: PromptContentBlock[]): Json {
  return blocks.map((block) => {
    if (block.type === "text") {
      const text: { [k: string]: Json } = { type: "text", text: block.text };
      if (block._meta) text._meta = block._meta;
      return text;
    }
    const img: { [k: string]: Json } = {
      type: "image",
      mimeType: block.mimeType,
      data: block.data,
    };
    if (block.uri) img.uri = block.uri;
    if (block._meta) img._meta = block._meta;
    return img;
  });
}

export type SessionPromptMetaInput = {
  promptId?: string | null;
  sendNow?: boolean;
  screenMode?: string | null;
};

/**
 * `_meta` is omitted entirely when empty so a text-only prompt without
 * promptId/sendNow/screenMode stays legacy-shaped (TUI tests pin this).
 * `sendNow` is only present when true — false must not appear on the wire.
 */
export function buildSessionPromptMeta(
  input: SessionPromptMetaInput,
): { [k: string]: Json } | null {
  const meta: { [k: string]: Json } = {};
  if (input.promptId) meta.promptId = input.promptId;
  if (input.sendNow) meta.sendNow = true;
  if (input.screenMode) meta.screenMode = input.screenMode;
  return Object.keys(meta).length ? meta : null;
}

export function buildSessionPromptParams(input: {
  sessionId: string;
  text?: string;
  images?: PromptImageInput[];
  prompt?: PromptContentBlock[];
  promptId?: string | null;
  sendNow?: boolean;
  screenMode?: string | null;
}): Json {
  const prompt = input.prompt ?? buildPromptContentBlocks({
    text: input.text,
    images: input.images,
  });
  const params: { [k: string]: Json } = {
    sessionId: input.sessionId,
    prompt: promptBlocksToJson(prompt),
  };
  const meta = buildSessionPromptMeta({
    promptId: input.promptId,
    sendNow: input.sendNow,
    screenMode: input.screenMode,
  });
  if (meta) params._meta = meta;
  return params;
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
