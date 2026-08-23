import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLIENT_IDENTIFIER,
  CLIENT_TYPE,
  CLIENT_VERSION,
  DEFAULT_WS_URL,
  DIRECT_AGENT_WS_URL,
  PING_INTERVAL_MS,
  buildInitializeParams,
  buildJsonRpcNotification,
  buildPickerSessionLoadParams,
  IMAGE_DISPLAY_NUMBER_META_KEY,
  SCREEN_MODE_WEB,
  buildPromptContentBlocks,
  buildSessionCancelParams,
  buildSessionLoadMeta,
  buildSessionLoadParams,
  buildSessionPromptMeta,
  buildSessionPromptParams,
  hasImagePlaceholder,
  imagePlaceholder,
  stripImagePlaceholders,
  pickerLoadOmitsCursor,
  buildWsUrl,
  defaultWsUrl,
  initializeAdvertisesLocalFsOrTerminal,
  resolveInitialWsUrl,
  stripPathsFromImagePlaceholders,
  toWireMethod,
  withImagePlaceholders,
} from "./protocol.ts";

test("buildWsUrl puts secret on server-key and keeps /ws", () => {
  const url = buildWsUrl("ws://127.0.0.1:2419/ws", "slice0dev");
  assert.equal(url, "ws://127.0.0.1:2419/ws?server-key=slice0dev");
});

test("defaultWsUrl is same-origin /ws so Vite can inject the serve secret", () => {
  assert.equal(
    defaultWsUrl({ protocol: "http:", host: "localhost:5173" }),
    "ws://localhost:5173/ws",
  );
  assert.equal(
    defaultWsUrl({ protocol: "https:", host: "example.test" }),
    "wss://example.test/ws",
  );
  assert.equal(defaultWsUrl(null), DEFAULT_WS_URL);
  assert.equal(resolveInitialWsUrl(null), DEFAULT_WS_URL);
  assert.equal(resolveInitialWsUrl(DIRECT_AGENT_WS_URL), DEFAULT_WS_URL);
  assert.equal(
    resolveInitialWsUrl("ws://127.0.0.1:9/ws"),
    "ws://127.0.0.1:9/ws",
  );
});

test("buildInitializeParams identifies grok-web and never advertises fs/terminal", () => {
  const params = buildInitializeParams();
  assert.equal(initializeAdvertisesLocalFsOrTerminal(params), false);
  const rec = params as {
    clientCapabilities: { fs: { readTextFile: boolean; writeTextFile: boolean }; terminal: boolean };
    _meta: { clientType: string; clientIdentifier: string; clientVersion: string };
  };
  assert.equal(rec.clientCapabilities.fs.readTextFile, false);
  assert.equal(rec.clientCapabilities.fs.writeTextFile, false);
  assert.equal(rec.clientCapabilities.terminal, false);
  const capsMeta = rec.clientCapabilities as {
    _meta?: { "x.ai/folderTrust"?: { interactive?: boolean } };
  };
  assert.equal(capsMeta._meta?.["x.ai/folderTrust"]?.interactive, true);
  assert.equal(rec._meta.clientType, CLIENT_TYPE);
  assert.equal(rec._meta.clientIdentifier, CLIENT_IDENTIFIER);
  assert.equal(rec._meta.clientVersion, CLIENT_VERSION);
});

test("buildSessionLoadMeta includes cursor and yolo/auto when an eventId exists", () => {
  const withCursor = buildSessionLoadMeta({
    cursor: "evt-99",
    yoloMode: true,
    autoMode: false,
  });
  assert.equal(withCursor.cursor, "evt-99");
  assert.equal(withCursor.yoloMode, true);
  assert.equal(withCursor.autoMode, false);

  const noCursor = buildSessionLoadMeta({
    cursor: null,
    yoloMode: false,
    autoMode: true,
  });
  assert.equal("cursor" in noCursor, false);
  assert.equal(noCursor.yoloMode, false);
  assert.equal(noCursor.autoMode, true);

  const load = buildSessionLoadParams({
    sessionId: "sess-1",
    cwd: "/repo",
    cursor: "evt-1",
    yoloMode: false,
    autoMode: false,
  }) as { sessionId: string; _meta: { cursor: string; yoloMode: boolean; autoMode: boolean } };
  assert.equal(load.sessionId, "sess-1");
  assert.equal(load._meta.cursor, "evt-1");
  assert.equal(load._meta.yoloMode, false);
  assert.equal(load._meta.autoMode, false);
});

test("picker load uses row cwd and never a reconnect cursor", () => {
  const picker = buildPickerSessionLoadParams({
    sessionId: "sess-row",
    cwd: "/home/user/other-project",
  }) as {
    sessionId: string;
    cwd: string;
    _meta: { cursor?: string; yoloMode: boolean };
  };
  assert.equal(picker.sessionId, "sess-row");
  assert.equal(picker.cwd, "/home/user/other-project");
  assert.equal("cursor" in picker._meta, false);
  assert.equal(pickerLoadOmitsCursor(picker), true);

  const reconnect = buildSessionLoadParams({
    sessionId: "sess-row",
    cwd: "/home/user/other-project",
    cursor: "evt-live",
    yoloMode: false,
    autoMode: false,
  }) as { _meta: { cursor: string } };
  assert.equal(reconnect._meta.cursor, "evt-live");
  assert.equal(pickerLoadOmitsCursor(reconnect), false);
});

test("keepalive ping interval is 15s", () => {
  assert.equal(PING_INTERVAL_MS, 15_000);
});

test("session/prompt content blocks are text then images; sendNow is _meta", () => {
  const textOnly = buildSessionPromptParams({
    sessionId: "sess-1",
    text: "wire-prompt-shape",
  }) as {
    sessionId: string;
    prompt: { type: string; text?: string; mimeType?: string; data?: string }[];
    _meta?: { promptId?: string; sendNow?: boolean };
  };
  assert.equal(textOnly.sessionId, "sess-1");
  assert.equal(textOnly.prompt.length, 1);
  assert.equal(textOnly.prompt[0]?.type, "text");
  assert.equal(textOnly.prompt[0]?.text, "wire-prompt-shape");
  assert.equal("_meta" in textOnly, false);

  assert.equal(stripImagePlaceholders("[Image #1] 看看这个"), "看看这个");
  assert.equal(stripImagePlaceholders("[Image #1: /tmp/a.png] x"), "x");
  assert.equal(imagePlaceholder(1), "[Image #1]");
  assert.equal(hasImagePlaceholder("[Image #1] extra", 1), true);
  assert.equal(hasImagePlaceholder("[Image #10]", 1), false);
  assert.equal(withImagePlaceholders("look", [1]), "look [Image #1]");
  assert.equal(withImagePlaceholders("[Image #1] already", [1]), "[Image #1] already");
  assert.equal(withImagePlaceholders("", [3]), "[Image #3]");
  assert.equal(
    stripPathsFromImagePlaceholders(
      "what is that?[Image #1: /Users/me/Desktop/x.png] thanks",
    ),
    "what is that?[Image #1] thanks",
  );
  assert.equal(
    stripPathsFromImagePlaceholders(
      "[Image #1: /tmp/a.png] mid [Image #2: /home/u/My Pictures/b.jpg] tail",
    ),
    "[Image #1] mid [Image #2] tail",
  );
  assert.equal(stripPathsFromImagePlaceholders("[Image #1]"), "[Image #1]");
  assert.equal(
    stripPathsFromImagePlaceholders("[Image #1:no-space.png]"),
    "[Image #1:no-space.png]",
  );

  const mixed = buildPromptContentBlocks({
    text: "look",
    images: [{ mimeType: "image/png", data: "abc", uri: "file:///tmp/a.png" }],
  });
  assert.equal(mixed[0]?.type, "text");
  if (mixed[0]?.type === "text") {
    assert.equal(mixed[0].text, "look [Image #1]");
  }
  assert.equal(mixed[1]?.type, "image");
  if (mixed[1]?.type === "image") {
    assert.equal(mixed[1].mimeType, "image/png");
    assert.equal(mixed[1].data, "abc");
    assert.equal(mixed[1].uri, "file:///tmp/a.png");
    assert.equal(mixed[1]._meta?.[IMAGE_DISPLAY_NUMBER_META_KEY], 1);
  }

  const imageOnly = buildSessionPromptParams({
    sessionId: "sess-2",
    images: [{ mimeType: "image/jpeg", data: "xyz", displayNumber: 3 }],
    promptId: "pid-1",
    sendNow: true,
  }) as {
    prompt: {
      type: string;
      text?: string;
      mimeType?: string;
      _meta?: { [k: string]: unknown };
    }[];
    _meta: { promptId: string; sendNow: boolean };
  };
  assert.equal(imageOnly.prompt[0]?.type, "text");
  assert.equal(imageOnly.prompt[0]?.text, "[Image #3]");
  assert.equal(imageOnly.prompt[1]?.type, "image");
  assert.equal(imageOnly.prompt[1]?.mimeType, "image/jpeg");
  assert.equal(imageOnly.prompt[1]?._meta?.[IMAGE_DISPLAY_NUMBER_META_KEY], 3);
  assert.equal(imageOnly._meta.promptId, "pid-1");
  assert.equal(imageOnly._meta.sendNow, true);

  const mixedParams = buildSessionPromptParams({
    sessionId: "sess-3",
    text: "look at this [Image #1: /tmp/a.png]",
    images: [{ mimeType: "image/png", data: "abc", uri: "file:///tmp/a.png" }],
    promptId: "pid-2",
  }) as {
    prompt: {
      type: string;
      text?: string;
      mimeType?: string;
      data?: string;
      uri?: string;
      _meta?: { [k: string]: unknown };
    }[];
    _meta: { promptId: string; sendNow?: boolean };
  };
  assert.equal(mixedParams.prompt.length, 2);
  assert.equal(mixedParams.prompt[0]?.type, "text");
  assert.equal(mixedParams.prompt[0]?.text, "look at this [Image #1]");
  assert.equal(mixedParams.prompt[1]?.type, "image");
  assert.equal(mixedParams.prompt[1]?.mimeType, "image/png");
  assert.equal(mixedParams.prompt[1]?.data, "abc");
  assert.equal(mixedParams.prompt[1]?.uri, "file:///tmp/a.png");
  assert.equal(mixedParams.prompt[1]?._meta?.[IMAGE_DISPLAY_NUMBER_META_KEY], 1);
  assert.equal(mixedParams._meta.promptId, "pid-2");
  assert.equal("sendNow" in mixedParams._meta, false);

  const withId = buildSessionPromptParams({
    sessionId: "sess-4",
    text: "wire-prompt-shape",
    promptId: "pid-plain",
    sendNow: false,
    screenMode: SCREEN_MODE_WEB,
  }) as { _meta: { promptId: string; sendNow?: boolean; screenMode?: string } };
  assert.deepEqual(withId._meta, { promptId: "pid-plain", screenMode: "web" });

  assert.equal(buildSessionPromptMeta({}), null);
  assert.deepEqual(buildSessionPromptMeta({ sendNow: true }), { sendNow: true });
  assert.deepEqual(buildSessionPromptMeta({ promptId: "p", screenMode: "web" }), {
    promptId: "p",
    screenMode: "web",
  });
  assert.equal(buildPromptContentBlocks({ text: "", images: [] }).length, 0);
});

test("session/cancel wire frame is a notification with no id", () => {
  const frame = buildJsonRpcNotification(
    "session/cancel",
    buildSessionCancelParams("sess-1"),
  );
  assert.equal(frame.jsonrpc, "2.0");
  assert.equal(frame.method, "session/cancel");
  assert.equal((frame.params as { sessionId: string }).sessionId, "sess-1");
  assert.equal("id" in frame, false);
});

test("session/cancel can carry cancelSubagents meta", () => {
  const params = buildSessionCancelParams("sess-1", { cancelSubagents: false });
  assert.deepEqual(params, {
    sessionId: "sess-1",
    _meta: { cancelSubagents: false },
  });
});

test("x.ai extension methods are _-prefixed on the wire; standard methods are not", () => {
  assert.equal(toWireMethod("initialize"), "initialize");
  assert.equal(toWireMethod("authenticate"), "authenticate");
  assert.equal(toWireMethod("session/cancel"), "session/cancel");
  assert.equal(toWireMethod("x.ai/auth/logout"), "_x.ai/auth/logout");
  assert.equal(toWireMethod("x.ai/setApiKey"), "_x.ai/setApiKey");
  assert.equal(toWireMethod("x.ai/session/list"), "_x.ai/session/list");
  assert.equal(toWireMethod("_x.ai/auth/logout"), "_x.ai/auth/logout");
  const ext = buildJsonRpcNotification("x.ai/auth/cancel", { request_seq: 1 });
  assert.equal(ext.method, "_x.ai/auth/cancel");
  assert.equal("id" in ext, false);
});
