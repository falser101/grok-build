import assert from "node:assert/strict";
import test from "node:test";
import {
  HELP_FOOTER,
  LATER_TOAST,
  LOCAL_SLASH,
  applyCompactMode,
  loadCompactMode,
  canonicalSlashName,
  helpLines,
  mergeSlashMenu,
  nextThemePref,
  parseEffortArg,
  parseLocalSlash,
  parseThemeArg,
  planSlash,
  skillUsedFromPrompt,
  slashBadgeLabel,
  slashKind,
  slashRunsOnAccept,
  wiredHelpCommands,
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
  assert.deepEqual(planSlash("/dashboard"), { kind: "local", name: "dashboard", args: "" });
  assert.deepEqual(planSlash("/usage"), { kind: "local", name: "usage", args: "" });
  assert.deepEqual(planSlash("/privacy"), { kind: "local", name: "privacy", args: "" });
  assert.deepEqual(planSlash("/cost"), { kind: "local", name: "usage", args: "" });
  assert.deepEqual(planSlash("/sessions"), { kind: "local", name: "dashboard", args: "" });
  assert.deepEqual(planSlash("/agents-dashboard"), { kind: "local", name: "dashboard", args: "" });
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
  applyCompactMode(false, root, {
    setItem: (k, v) => store.set(k, v),
  });
  assert.equal(root.dataset.compact, "0");
  assert.equal(store.get("grok-web.compact-mode"), "0");
  assert.equal(loadCompactMode({ getItem: (k) => store.get(k) ?? null }), false);
});

test("canonical aliases and help listing", () => {
  assert.equal(canonicalSlashName("QUIT"), "exit");
  assert.equal(canonicalSlashName("m"), "model");
  const help = helpLines();
  assert.match(help, /\/exit/);
  assert.match(help, /\/help/);
  assert.doesNotMatch(help, /gboom/);
  assert.match(help, /\/dashboard/);
  assert.match(help, /运行中会话/);
});

test("slashKind badges: local pager, available shell, scoped skill", () => {
  assert.equal(slashKind("help", "local"), "pager");
  assert.equal(slashKind("theme", "local"), "pager");
  assert.equal(slashKind("hooks", "local"), "pager");
  assert.equal(slashKind("compact", "local"), "shell");
  assert.equal(slashKind("flush", "available"), "shell");
  assert.equal(slashKind("user:review", "available"), "skill");
  assert.equal(slashKind("plugin:foo", "local"), "skill");
  assert.equal(slashBadgeLabel("pager"), "P");
  assert.equal(slashBadgeLabel("shell"), "S");
  assert.equal(slashBadgeLabel("skill"), "skill");
});

test("mergeSlashMenu stamps P/S/skill and keeps scoped skill names", () => {
  const merged = mergeSlashMenu(LOCAL_SLASH, [
    { name: "copy", description: "agent copy", argumentHint: null },
    { name: "user:review", description: "skill", argumentHint: null },
    { name: "flush", description: "write memory", argumentHint: null },
  ]);
  assert.equal(merged.find((c) => c.name === "help")?.kind, "pager");
  assert.equal(merged.find((c) => c.name === "copy")?.kind, "pager");
  assert.equal(merged.find((c) => c.name === "compact")?.kind, "shell");
  assert.equal(merged.find((c) => c.name === "flush")?.kind, "shell");
  const skill = merged.find((c) => c.name === "user:review");
  assert.equal(skill?.kind, "skill");
  assert.equal(skill?.name, "user:review");
});

test("wired help lists built-ins we ship, not an external site", () => {
  const wired = wiredHelpCommands();
  assert.ok(wired.some((c) => c.name === "help"));
  assert.ok(wired.some((c) => c.name === "model"));
  assert.ok(wired.some((c) => c.name === "theme"));
  assert.ok(!wired.some((c) => c.name === "hooks"));
  assert.ok(!wired.some((c) => c.name === "gboom"));
  const help = helpLines();
  assert.match(help, /\/help  \[P\]/);
  assert.match(help, new RegExp(HELP_FOOTER));
  assert.match(help, /不是外站/);
  assert.doesNotMatch(help, /gboom/);
});

test("skillUsedFromPrompt only matches colon skill send", () => {
  assert.equal(skillUsedFromPrompt("/bundled:imagine 用一句话总结这个 skill"), "bundled:imagine");
  assert.equal(skillUsedFromPrompt("/imagine"), null);
  assert.equal(skillUsedFromPrompt("imagine"), null);
  assert.equal(skillUsedFromPrompt("/compact"), null);
});
