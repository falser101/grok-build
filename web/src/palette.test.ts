import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_SHORTCUTS,
  HELP_SHORTCUTS,
  buildPaletteItems,
  contextChipText,
  filterPaletteItems,
  formatSlashSubmit,
  groupPaletteItems,
  hashForSession,
  hashForSessions,
  hashForDashboard,
  hintForFocus,
  inferTurnPhase,
  parseContextUsage,
  parseHashRoute,
  turnStatusLabel,
  mapGlobalHotkey,
} from "./palette.ts";

test("parse hash routes for sessions and session id", () => {
  assert.deepEqual(parseHashRoute("#/sessions"), { kind: "sessions" });
  assert.deepEqual(parseHashRoute("#/dashboard"), { kind: "dashboard" });
  assert.equal(hashForDashboard(), "#/dashboard");
  assert.deepEqual(parseHashRoute("#/s/abc-1"), { kind: "session", id: "abc-1" });
  assert.deepEqual(parseHashRoute("#/s/a%2Fb"), { kind: "session", id: "a/b" });
  assert.equal(parseHashRoute("#/other").kind, "other");
  assert.equal(hashForSessions(), "#/sessions");
  assert.equal(hashForSession("x y"), "#/s/x%20y");
});

test("filter palette items over shortcuts slash and skills", () => {
  const items = buildPaletteItems({
    slash: [
      { name: "jump", description: "跳到某一轮", argumentHint: null },
      { name: "model", description: "切换模型", argumentHint: "id" },
    ],
    skills: [{ name: "user:review", description: "review skill", argumentHint: null }],
  });
  assert.ok(items.some((i) => i.kind === "shortcut" && i.run === "palette"));
  assert.ok(items.some((i) => i.kind === "slash" && i.run === "jump"));
  assert.ok(items.some((i) => i.kind === "skill" && i.run === "user:review"));
  const hits = filterPaletteItems(items, "rev");
  assert.equal(hits[0]?.run, "user:review");
  const keys = filterPaletteItems(items, "ctrl+p");
  assert.ok(keys.some((i) => i.run === "palette"));
  const models = filterPaletteItems(items, "model");
  assert.ok(models.some((i) => i.run === "model"));
});

test("hint focus and turn status", () => {
  assert.match(hintForFocus("composer", true), /Enter 发送/);
  assert.match(hintForFocus("slash", true), /Tab 补全/);
  assert.match(hintForFocus("thread", true), /\? 快捷键/);
  assert.equal(turnStatusLabel(inferTurnPhase({ connected: true, turnRunning: true, liveTool: false, blocked: false })), "正在想");
  assert.equal(turnStatusLabel(inferTurnPhase({ connected: true, turnRunning: true, liveTool: true, blocked: false })), "跑工具");
  assert.equal(turnStatusLabel(inferTurnPhase({ connected: true, turnRunning: false, liveTool: false, blocked: true })), "blocked");
  assert.equal(turnStatusLabel(inferTurnPhase({ connected: true, turnRunning: false, liveTool: false, blocked: false })), "watching");
  assert.equal(turnStatusLabel(inferTurnPhase({ connected: false, turnRunning: false, liveTool: false, blocked: false })), "idle");
});

test("context usage and slash args", () => {
  assert.equal(parseContextUsage({ data: { context: { usedPercent: 42 } } }).label, "42%");
  assert.equal(parseContextUsage({ context: { tokens: 1500, contextWindow: 3000 } }).label, "50%");
  assert.equal(parseContextUsage({ context: { used: 200, total: 800, usagePct: 25 } }).label, "25%");
  assert.equal(
    parseContextUsage({
      sessionUpdate: "session_status",
      context_window: { used_percentage: 8, context_tokens: 1000, context_window_size: 128000 },
    }).label,
    "8%",
  );
  assert.equal(parseContextUsage({}).label, "—%");
  assert.equal(formatSlashSubmit("find", "foo"), "/find foo");
  assert.equal(formatSlashSubmit("jump", "  "), "/jump");
  assert.ok(APP_SHORTCUTS.some((s) => s.keys === "Ctrl+P"));
  assert.equal(contextChipText(parseContextUsage({ data: { context: { usedPercent: 42 } } })), "上下文 42%");
  assert.equal(contextChipText(parseContextUsage({})), "上下文 —%");
  const grouped = groupPaletteItems(
    buildPaletteItems({
      slash: [{ name: "help", description: "帮助", argumentHint: null }],
      skills: [{ name: "user:review", description: "review skill", argumentHint: null }],
    }),
  );
  assert.deepEqual(grouped.map((g) => g.label), ["快捷键", "slash", "skill"]);
  assert.equal(HELP_SHORTCUTS.length, 7);
  assert.ok(HELP_SHORTCUTS.some((s) => s.keys === "Ctrl+." && s.title === "本页"));
});


test("global hotkeys do not invent commands", () => {
  const none = { ctrl: false, meta: false, shift: false };
  assert.equal(mapGlobalHotkey("p", { ...none, ctrl: true }, true), "palette");
  assert.equal(mapGlobalHotkey(",", { ...none, meta: true }, true), "settings");
  assert.equal(mapGlobalHotkey("?", none, false), "shortcuts");
  assert.equal(mapGlobalHotkey("?", none, true), null);
  assert.equal(mapGlobalHotkey(".", { ...none, ctrl: true }, false), "shortcuts");
  assert.equal(mapGlobalHotkey("m", { ...none, ctrl: true }, false), "model");
  assert.equal(mapGlobalHotkey("m", { ...none, ctrl: true }, true), null);
});
