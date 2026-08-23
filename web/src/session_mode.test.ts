import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSetModeParams,
  cycleSessionMode,
  parseCurrentModeUpdate,
  parseSessionPermMode,
  parseShowPlanChip,
  planChipVisible,
  sessionModeLabel,
} from "./session_mode.ts";

test("Shift+Tab cycles ask to plan to yolo", () => {
  assert.equal(cycleSessionMode("ask"), "plan");
  assert.equal(cycleSessionMode("plan"), "yolo");
  assert.equal(cycleSessionMode("yolo"), "ask");
  assert.equal(sessionModeLabel("ask"), "普通");
});

test("set_mode uses plan or default", () => {
  assert.deepEqual(buildSetModeParams("s1", "plan"), { sessionId: "s1", modeId: "plan" });
  assert.deepEqual(buildSetModeParams("s1", "ask"), { sessionId: "s1", modeId: "default" });
  assert.deepEqual(buildSetModeParams("s1", "yolo"), { sessionId: "s1", modeId: "default" });
});

test("show_plan_chip after exit", () => {
  assert.equal(parseShowPlanChip({ show_plan_chip: true }), true);
  assert.equal(parseShowPlanChip({ data: { showPlanChip: false } }), false);
  assert.equal(planChipVisible({ inPlan: true, showPlanChip: false }), true);
  assert.equal(planChipVisible({ inPlan: false, showPlanChip: true }), true);
  assert.equal(planChipVisible({ inPlan: false, showPlanChip: false }), false);
  assert.equal(planChipVisible({ inPlan: false, showPlanChip: null }), false);
});

test("parse mode from updates", () => {
  assert.equal(parseSessionPermMode("always-approve"), "yolo");
  assert.equal(
    parseCurrentModeUpdate({ sessionUpdate: "current_mode_update", modeId: "plan" }),
    "plan",
  );
});
