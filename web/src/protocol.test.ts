import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLIENT_IDENTIFIER,
  CLIENT_TYPE,
  CLIENT_VERSION,
  PING_INTERVAL_MS,
  buildInitializeParams,
  buildJsonRpcNotification,
  buildSessionCancelParams,
  buildSessionLoadMeta,
  buildSessionLoadParams,
  buildWsUrl,
  initializeAdvertisesLocalFsOrTerminal,
  toWireMethod,
} from "./protocol.ts";

test("buildWsUrl puts secret on server-key and keeps /ws", () => {
  const url = buildWsUrl("ws://127.0.0.1:2419/ws", "slice0dev");
  assert.equal(url, "ws://127.0.0.1:2419/ws?server-key=slice0dev");
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

test("keepalive ping interval is 15s", () => {
  assert.equal(PING_INTERVAL_MS, 15_000);
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
