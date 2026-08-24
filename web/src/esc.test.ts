import assert from "node:assert/strict";
import test from "node:test";
import {
  ESC_OVERLAY_ORDER,
  firstOpenEscOverlay,
  nextEscAction,
  type EscAction,
} from "./esc.ts";

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

test("overlay order is lightbox through btw", () => {
  assert.deepEqual([...ESC_OVERLAY_ORDER], [
    "lightbox",
    "settings",
    "appDialog",
    "actionModal",
    "find",
    "jump",
    "help",
    "slash",
    "history",
    "sessionPopover",
    "btw",
  ]);
  assert.equal(
    firstOpenEscOverlay({ btw: true, slash: true, lightbox: true, settings: true }),
    "lightbox",
  );
  assert.equal(firstOpenEscOverlay({ history: true, slash: true, btw: true }), "slash");
  assert.equal(firstOpenEscOverlay({ sessionPopover: true, btw: true }), "sessionPopover");
  assert.equal(firstOpenEscOverlay({}), null);
});

test("Esc overlay wins over stop, recancel, and idle arms", () => {
  assert.deepEqual(act({ overlay: "settings", turnRunning: true, draft: "hi" }), {
    type: "overlay",
    overlay: "settings",
  });
  assert.deepEqual(act({ overlay: "find", canceling: true }), { type: "overlay", overlay: "find" });
  assert.deepEqual(act({ overlay: "lightbox", draft: "x", hasMessages: true }), {
    type: "overlay",
    overlay: "lightbox",
  });
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
  assert.deepEqual(act({ draft: "hello", lastArm: { kind: "clear", at: 9000 } }), { type: "clear" });
  assert.deepEqual(act({ draft: "hello", lastArm: { kind: "clear", at: 8999 } }), {
    type: "arm-clear",
  });
  assert.deepEqual(act({ draft: "hello", lastArm: { kind: "rewind", at: 9500 } }), {
    type: "arm-clear",
  });
});

test("idle empty draft with messages arms then rewinds within 1s", () => {
  assert.deepEqual(act({ hasMessages: true }), { type: "arm-rewind" });
  assert.deepEqual(act({ hasMessages: true, lastArm: { kind: "rewind", at: 9000 } }), {
    type: "rewind",
  });
  assert.deepEqual(act({ hasMessages: true, lastArm: { kind: "rewind", at: 8999 } }), {
    type: "arm-rewind",
  });
  assert.deepEqual(act({ hasMessages: true, lastArm: { kind: "clear", at: 9500 } }), {
    type: "arm-rewind",
  });
});

test("idle empty draft without messages is none (no dashboard hop)", () => {
  assert.deepEqual(act({}), { type: "none" });
  assert.deepEqual(act({ lastArm: { kind: "clear", at: 9500 } }), { type: "none" });
});

test("graceMs defaults to 1000", () => {
  const { graceMs: _g, ...rest } = base;
  assert.deepEqual(
    nextEscAction({ ...rest, draft: "hello", lastArm: { kind: "clear", at: 9000 } }),
    { type: "clear" },
  );
  assert.deepEqual(
    nextEscAction({ ...rest, draft: "hello", lastArm: { kind: "clear", at: 8999 } }),
    { type: "arm-clear" },
  );
});
