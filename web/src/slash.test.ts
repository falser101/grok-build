import assert from "node:assert/strict";
import test from "node:test";
import {
  LATER_TOAST,
  LOCAL_SLASH,
  applyCompactMode,
  canonicalSlashName,
  helpLines,
  mergeSlashMenu,
  nextThemePref,
  parseEffortArg,
  parseLocalSlash,
  parseThemeArg,
  planSlash,
  slashRunsOnAccept,
} from "./slash.ts";

test("parseLocalSlash intercepts pager locals and aliases", () => {
  assert.deepEqual(parseLocalSlash("/copy 2"), { name: "copy", args: "2" });
  assert.deepEqual(parseLocalSlash("/quit"), { name: "exit", args: "" });
  assert.deepEqual(parseLocalSlash("/welcome"), { name: "home", args: "" });
  assert.deepEqual(parseLocalSlash("/clear"), { name: "new", args: "" });
  assert.deepEqual(parseLocalSlash("/yolo"), { name: "always-approve", args: "" });
  assert.deepEqual(parseLocalSlash("/ml"), { name: "multiline", args: "" });
  assert.deepEqual(parseLocalSlash("/t dark"), { name: "theme", args: "dark" });
  assert.deepEqual(parseLocalSlash("/title Hello"), { name: "rename", args: "Hello" });
  assert.deepEqual(parseLocalSlash("/status"), { name: "session-info", args: "" });
  assert.deepEqual(parseLocalSlash("/undo"), { name: "rewind", args: "" });
  assert.deepEqual(parseLocalSlash("/howto"), { name: "docs", args: "" });
  assert.equal(parseLocalSlash("hello"), null);
});

test("parseLocalSlash does not intercept S-send commands", () => {
  assert.equal(parseLocalSlash("/compact"), null);
  assert.equal(parseLocalSlash("/compact please"), null);
  assert.equal(parseLocalSlash("/flush"), null);
  assert.equal(parseLocalSlash("/dream"), null);
  assert.equal(parseLocalSlash("/user:foo"), null);
});

test("planSlash classifies local, send, later, forbidden", () => {
  assert.deepEqual(planSlash("/exit"), { kind: "local", name: "exit", args: "" });
  assert.deepEqual(planSlash("/compact extra"), {
    kind: "send",
    name: "compact",
    args: "extra",
    text: "/compact extra",
  });
  assert.deepEqual(planSlash("/hooks"), { kind: "later", name: "hooks", args: "" });
  assert.deepEqual(planSlash("/gboom"), { kind: "forbidden", name: "gboom" });
  assert.deepEqual(planSlash("/minimal"), { kind: "forbidden", name: "minimal" });
  assert.deepEqual(planSlash("/vim-mode"), { kind: "forbidden", name: "vim-mode" });
  assert.equal(planSlash("/skills").kind, "later");
  assert.equal(planSlash("/imagine").kind, "later");
  assert.equal(planSlash("/settings").kind, "local");
  assert.equal(planSlash("/share").kind, "local");
  assert.equal(planSlash("not a slash").kind, "pass");
});

test("builtin names win over availableCommands; skills stay dynamic", () => {
  const merged = mergeSlashMenu(LOCAL_SLASH, [
    { name: "copy", description: "agent copy", argumentHint: null },
    { name: "user:review", description: "skill", argumentHint: null },
    { name: "compact", description: "agent compact", argumentHint: "note" },
  ]);
  const copies = merged.filter((c) => c.name === "copy");
  assert.equal(copies.length, 1);
  assert.equal(copies[0]?.description, "复制最近回复");
  assert.ok(merged.some((c) => c.name === "user:review"));
  assert.ok(merged.some((c) => c.name === "compact"));
});

test("accept immediately when local and no argument hint", () => {
  assert.equal(slashRunsOnAccept({ name: "help", description: null, argumentHint: null }), true);
  assert.equal(slashRunsOnAccept({ name: "copy", description: null, argumentHint: "n" }), false);
  assert.equal(slashRunsOnAccept({ name: "compact", description: null, argumentHint: "note" }), false);
  assert.equal(slashRunsOnAccept({ name: "hooks", description: LATER_TOAST, argumentHint: null }), true);
});

test("theme cycle, effort parse, compact mode persist", () => {
  assert.equal(nextThemePref("auto"), "dark");
  assert.equal(nextThemePref("dark"), "light");
  assert.equal(nextThemePref("light"), "auto");
  assert.equal(parseThemeArg("Light"), "light");
  assert.equal(parseThemeArg("nope"), null);
  assert.equal(parseEffortArg("xhigh"), "xhigh");
  assert.equal(parseEffortArg("max"), null);
  const store = new Map<string, string>();
  const root = { dataset: {} as { compact?: string } };
  applyCompactMode(true, root, {
    setItem: (k, v) => store.set(k, v),
  });
  assert.equal(root.dataset.compact, "1");
  assert.equal(store.get("grok-web.compact-mode"), "1");
});

test("canonical aliases and help listing", () => {
  assert.equal(canonicalSlashName("QUIT"), "exit");
  assert.equal(canonicalSlashName("m"), "model");
  const help = helpLines();
  assert.match(help, /\/exit/);
  assert.match(help, /\/help/);
  assert.doesNotMatch(help, /gboom/);
});
