import assert from "node:assert/strict";
import test from "node:test";
import {
  TURN_COMPLETE_BODY,
  turnCompleteNotify,
  shouldNotifyTurnComplete,
  windowTitle,
} from "./notify.ts";

test("windowTitle dashboard ignores running and session name", () => {
  assert.equal(
    windowTitle({
      surface: "dashboard",
      running: true,
      sessionName: "foo",
      dashTitle: "会话",
    }),
    "会话 · Grok Web",
  );
  assert.equal(
    windowTitle({
      surface: "dashboard",
      running: false,
      sessionName: "foo",
      dashTitle: "会话",
    }),
    "会话 · Grok Web",
  );
});

test("windowTitle session idle is the session name", () => {
  assert.equal(
    windowTitle({
      surface: "session",
      running: false,
      sessionName: "my chat",
      dashTitle: "会话",
    }),
    "my chat",
  );
});

test("windowTitle session running prefixes 运行中", () => {
  assert.equal(
    windowTitle({
      surface: "session",
      running: true,
      sessionName: "my chat",
      dashTitle: "会话",
    }),
    "运行中 · my chat",
  );
});

test("windowTitle other surfaces stay Grok Web", () => {
  assert.equal(
    windowTitle({
      surface: "welcome",
      running: true,
      sessionName: "x",
      dashTitle: "会话",
    }),
    "Grok Web",
  );
});

test("shouldNotifyTurnComplete only when hidden and granted", () => {
  assert.equal(shouldNotifyTurnComplete({ hidden: true, permission: "granted" }), true);
  assert.equal(shouldNotifyTurnComplete({ hidden: false, permission: "granted" }), false);
  assert.equal(shouldNotifyTurnComplete({ hidden: true, permission: "default" }), false);
  assert.equal(shouldNotifyTurnComplete({ hidden: true, permission: "denied" }), false);
  assert.equal(shouldNotifyTurnComplete({ hidden: false, permission: "default" }), false);
});

test("turn-complete notify title is session name, body 回合已结束", () => {
  assert.equal(TURN_COMPLETE_BODY, "回合已结束");
  assert.deepEqual(turnCompleteNotify("my chat"), { title: "my chat", body: "回合已结束" });
});
