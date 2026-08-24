import assert from "node:assert/strict";
import test from "node:test";
import { nextEscAction, type EscAction } from "./esc.ts";

const base = {
  overlay: null as string | null,
  turnRunning: false,
  canceling: false,
  draft: "",
  hasMessages: false,
  lastArm: null as { kind: "clear" | "rewind"; at: number } | null,
  now: 10_000,
  graceMs: 1000,
};

function act(partial: Partial<typeof base>): EscAction {
  return nextEscAction({ ...base, ...partial });
}

test("Esc overlay wins over stop, recancel, and idle arms", () => {
  assert.deepEqual(act({ overlay: "settings", turnRunning: true, draft: "hi" }), { type: "overlay" });
  assert.deepEqual(act({ overlay: "findBar", canceling: true }), { type: "overlay" });
  assert.deepEqual(act({ overlay: "lightbox", draft: "x", hasMessages: true }), { type: "overlay" });
});

test("Esc stop while turn running keeps going to stop not clear", () => {
  assert.deepEqual(act({ turnRunning: true, draft: "keep me" }), { type: "stop" });
  assert.deepEqual(act({ turnRunning: true, canceling: true }), { type: "stop" });
});

test("Esc recancel while canceling, even inside grace after stop", () => {
  assert.deepEqual(act({ canceling: true, draft: "keep me" }), { type: "recancel" });
  assert.deepEqual(
    act({
      canceling: true,
      draft: "keep me",
      lastArm: { kind: "clear", at: 9500 },
    }),
    { type: "recancel" },
  );
});

test("idle nonempty draft arms then clears within 1s", () => {
  assert.deepEqual(act({ draft: "hello" }), { type: "arm-clear" });
  assert.deepEqual(
    act({ draft: "hello", lastArm: { kind: "clear", at: 9000 } }),
    { type: "clear" },
  );
  assert.deepEqual(
    act({ draft: "hello", lastArm: { kind: "clear", at: 8999 } }),
    { type: "arm-clear" },
  );
  assert.deepEqual(
    act({ draft: "hello", lastArm: { kind: "rewind", at: 9500 } }),
    { type: "arm-clear" },
  );
});

test("idle empty draft with messages arms then rewinds within 1s", () => {
  assert.deepEqual(act({ hasMessages: true }), { type: "arm-rewind" });
  assert.deepEqual(
    act({ hasMessages: true, lastArm: { kind: "rewind", at: 9000 } }),
    { type: "rewind" },
  );
  assert.deepEqual(
    act({ hasMessages: true, lastArm: { kind: "rewind", at: 8999 } }),
    { type: "arm-rewind" },
  );
  assert.deepEqual(
    act({ hasMessages: true, lastArm: { kind: "clear", at: 9500 } }),
    { type: "arm-rewind" },
  );
});

test("idle empty draft without messages is none", () => {
  assert.deepEqual(act({}), { type: "none" });
  assert.deepEqual(act({ lastArm: { kind: "clear", at: 9500 } }), { type: "none" });
});
