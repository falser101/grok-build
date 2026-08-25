import assert from "node:assert/strict";
import test from "node:test";
import {
  PASTE_TEXT_LIMIT,
  applySlashAccept,
  buildPromptBlocks,
  combineQueuedTexts,
  drainQueueHead,
  filterSlashCommands,
  mapComposerKey,
  parseFuzzyOpen,
  parseFuzzyStatus,
  buildFuzzyOpenParams,
  relativizeFuzzyPath,
  scopeFuzzyMatches,
  parseLocalSlash,
  parsePromptHistory,
  parseQueueChanged,
  parseSuggest,
  pasteTooLarge,
  atQuery,
  applyAtAccept,
  fileRefPath,
  normalizeLineRange,
  parseReadFileContent,
  previewFileLines,
  looksLikePlan,
  parseModelState,
  permissionChipLabel,
  effortChipLabel,
  composerIsFilled,
  nextComposerTextareaHeight,
  shouldEnqueue,
  composerSubmitIntent,
  slashQuery,
} from "./composer.ts";

const none = { shift: false, ctrl: false, meta: false, alt: false };

test("Enter sends when enterSends; Shift+Enter newlines", () => {
  assert.equal(
    mapComposerKey("Enter", none, {
      enterSends: true,
      promptEmpty: false,
      slashOpen: false,
      historyOpen: false,
    }),
    "send",
  );
  assert.equal(
    mapComposerKey("Enter", { ...none, shift: true }, {
      enterSends: true,
      promptEmpty: false,
      slashOpen: false,
      historyOpen: false,
    }),
    "newline",
  );
});

test("multiline mode: Enter newlines, Ctrl+Enter sends", () => {
  assert.equal(
    mapComposerKey("Enter", none, {
      enterSends: false,
      promptEmpty: false,
      slashOpen: false,
      historyOpen: false,
    }),
    "newline",
  );
  assert.equal(
    mapComposerKey("Enter", { ...none, ctrl: true }, {
      enterSends: false,
      promptEmpty: false,
      slashOpen: false,
      historyOpen: false,
    }),
    "send-now",
  );
  assert.equal(
    mapComposerKey("Enter", { ...none, ctrl: true }, {
      enterSends: true,
      promptEmpty: false,
      slashOpen: false,
      historyOpen: false,
    }),
    "send-now",
  );
});

test("empty prompt ArrowUp opens history; Ctrl+K clears", () => {
  assert.equal(
    mapComposerKey("ArrowUp", none, {
      enterSends: true,
      promptEmpty: true,
      slashOpen: false,
      historyOpen: false,
    }),
    "history-prev",
  );
  assert.equal(
    mapComposerKey("k", { ...none, meta: true }, {
      enterSends: true,
      promptEmpty: false,
      slashOpen: false,
      historyOpen: false,
    }),
    "clear-draft",
  );
});

test("slash query and fuzzy filter", () => {
  assert.equal(slashQuery("/com", 4), "com");
  assert.equal(slashQuery("/compact extra", 14), null);
  assert.equal(slashQuery("hello", 5), null);
  const hits = filterSlashCommands(
    [
      { name: "compact", description: "shrink", argumentHint: null },
      { name: "copy", description: "clipboard", argumentHint: "n" },
      { name: "new", description: "session", argumentHint: null },
    ],
    "co",
  );
  assert.deepEqual(
    hits.map((h) => h.name),
    ["compact", "copy"],
  );
  assert.equal(applySlashAccept("/c", hits[0]!), "/compact ");
  const badged = filterSlashCommands(
    [
      { name: "help", description: "打开命令帮助", argumentHint: null, kind: "pager" },
      { name: "user:review", description: "skill", argumentHint: null, kind: "skill" },
      { name: "compact", description: "shrink", argumentHint: null, kind: "shell" },
    ],
    "rev",
  );
  assert.equal(badged.length, 1);
  assert.equal(badged[0]?.name, "user:review");
  assert.equal(badged[0]?.kind, "skill");
});

test("memory slash hits itself before implement", () => {
  const hits = filterSlashCommands(
    [
      { name: "implement", description: "from memory", argumentHint: null },
      { name: "memory", description: "发给 Agent", argumentHint: null },
      { name: "flush", description: "发给 Agent", argumentHint: null },
      { name: "dream", description: "发给 Agent", argumentHint: null },
      { name: "remember", description: "发给 Agent", argumentHint: null },
    ],
    "memory",
  );
  assert.equal(hits[0]?.name, "memory");
  const mem = filterSlashCommands(
    [
      { name: "implement", description: "from memory", argumentHint: null },
      { name: "memory", description: "发给 Agent", argumentHint: null },
      { name: "mem", description: "发给 Agent", argumentHint: null },
    ],
    "mem",
  );
  assert.equal(mem[0]?.name, "mem");
  assert.ok(mem.some((c) => c.name === "memory"));
});

test("queue drain and combine stop at slash", () => {
  assert.equal(shouldEnqueue(true, false), true);
  assert.equal(shouldEnqueue(true, true), false);
  const { next, rest } = drainQueueHead([
    { id: "1", text: "a", images: [] },
    { id: "2", text: "b", images: [] },
  ]);
  assert.equal(next?.text, "a");
  assert.equal(rest.length, 1);
  assert.equal(combineQueuedTexts(["one", "two", "/compact"], true), "one\ntwo");
});

test("composer submit intent queues during a turn and send-now drains the head", () => {
  assert.equal(shouldEnqueue(true, false), true);
  assert.equal(shouldEnqueue(true, true), false);
  assert.equal(
    composerSubmitIntent({
      hasDraft: true,
      turnRunning: true,
      sendNow: false,
      hasQueue: false,
      emptyRepeat: false,
    }),
    "queue",
  );
  assert.equal(
    composerSubmitIntent({
      hasDraft: true,
      turnRunning: true,
      sendNow: true,
      hasQueue: true,
      emptyRepeat: false,
    }),
    "send-now",
  );
  assert.equal(
    composerSubmitIntent({
      hasDraft: false,
      turnRunning: true,
      sendNow: true,
      hasQueue: true,
      emptyRepeat: false,
    }),
    "drain-head",
  );
  assert.equal(
    composerSubmitIntent({
      hasDraft: false,
      turnRunning: true,
      sendNow: false,
      hasQueue: true,
      emptyRepeat: false,
    }),
    "noop",
  );
});

test("paste limit and prompt blocks include text then images", () => {
  assert.equal(pasteTooLarge(PASTE_TEXT_LIMIT + 1, 0), true);
  assert.equal(pasteTooLarge(10, 10), false);
  const blocks = buildPromptBlocks("hi", [
    { id: "1", mimeType: "image/png", data: "abc", name: "a.png" },
  ]);
  assert.equal(blocks[0]?.type, "text");
  if (blocks[0]?.type === "text") assert.equal(blocks[0].text, "hi [Image #1]");
  assert.equal(blocks[1]?.type, "image");
});

test("local slash at-query plan nudge and suggest parsers", () => {
  assert.deepEqual(parseLocalSlash("/copy 2"), { name: "copy", args: "2" });
  assert.equal(parseLocalSlash("/not-a-local"), null);
  assert.equal(atQuery("see @src/ma", 12), "src/ma");
  assert.equal(applyAtAccept("see @src/ma", 12, "src/main.ts"), "see @src/main.ts ");
  assert.equal(
    applyAtAccept("see @src/ma", 12, "src/main.ts", { start: 10, end: 10 }),
    "see @src/main.ts:10 ",
  );
  assert.equal(
    applyAtAccept("see @src/ma", 12, "src/main.ts", { start: 12, end: 10 }),
    "see @src/main.ts:10-12 ",
  );
  assert.equal(looksLikePlan("1. one\n2. two"), true);
  assert.equal(looksLikePlan("hi"), false);
  const sug = parseSuggest({
    ghost: { suffix: " file" },
    completions: [{ display: "main.ts", insertText: "src/main.ts" }],
  });
  assert.equal(sug.ghost, " file");
  assert.equal(sug.completions[0]?.insertText, "src/main.ts");
  assert.equal(parseFuzzyOpen({ searchId: "abc" }), "abc");
  assert.equal(parseFuzzyStatus({ matches: [{ path: "a.ts", score: 9 }] })[0]?.path, "a.ts");
  assert.equal(parseFuzzyStatus({ matches: [{ path: "a.ts", score: 9 }] })[0]?.kind, "file");
  assert.equal(
    parseFuzzyStatus({ matches: [{ path: "src", type: "directory", score: 1 }] })[0]?.kind,
    "directory",
  );
  const open = buildFuzzyOpenParams({
    sessionId: "s1",
    cwd: "/home/falser/Projects/grok-build",
    hidden: false,
  });
  assert.equal(open.sessionId, "s1");
  assert.equal(open.cwd, "/home/falser/Projects/grok-build");
  assert.equal(open.hidden, false);
  assert.equal(
    relativizeFuzzyPath("/home/falser/Projects/grok-build/web/src/a.ts", "/home/falser/Projects/grok-build"),
    "web/src/a.ts",
  );
  assert.equal(relativizeFuzzyPath("/etc/passwd", "/home/falser/Projects/grok-build"), null);
  const scoped = scopeFuzzyMatches(
    [
      { path: "/home/falser/Projects/grok-build/README.md", score: 1, kind: "file" },
      { path: "/home/falser/.bashrc", score: 2, kind: "file" },
    ],
    "/home/falser/Projects/grok-build",
  );
  assert.deepEqual(scoped.map((r) => r.path), ["README.md"]);
  assert.equal(scoped[0]?.kind, "file");
});

test("@ file ref range and read_file preview helpers", () => {
  assert.deepEqual(normalizeLineRange(12, 4), { start: 4, end: 12 });
  assert.equal(fileRefPath("web/src/main.ts"), "web/src/main.ts");
  assert.equal(fileRefPath("web/src/main.ts", { start: 8, end: 8 }), "web/src/main.ts:8");
  assert.equal(fileRefPath("web/src/main.ts", { start: 8, end: 12 }), "web/src/main.ts:8-12");
  const text = parseReadFileContent({ content: "a\nb\n", type: "text/plain" });
  assert.equal(text.binary, false);
  assert.deepEqual(previewFileLines("one\ntwo\nthree", 2, 10), ["one", "two"]);
  assert.equal(previewFileLines("x".repeat(12), 1, 4)[0], "xxxx…");
  const bin = parseReadFileContent({
    content: "",
    content_base64: "AAAA",
    type: "application/octet-stream",
  });
  assert.equal(bin.binary, true);
  const nested = parseReadFileContent({ result: { content: "hi", type: "text/plain" } });
  assert.equal(nested.content, "hi");
});

test("prompt history and queue/changed parsers", () => {
  assert.deepEqual(parsePromptHistory({ prompts: ["a", "b", ""] }), ["a", "b"]);
  const q = parseQueueChanged({
    sessionId: "s1",
    entries: [{ id: "q1", text: "later", version: 2 }],
    runningText: "now",
  });
  assert.equal(q.sessionId, "s1");
  assert.equal(q.runningText, "now");
  assert.equal(q.entries[0]?.id, "q1");
});

test("composer chrome labels and model state parse", () => {
  assert.equal(permissionChipLabel("ask"), "每次询问");
  assert.equal(permissionChipLabel("always-approve"), "始终允许");
  assert.equal(effortChipLabel("high"), "高");
  assert.equal(composerIsFilled("", []), false);
  assert.equal(composerIsFilled("hi", []), true);
  assert.equal(nextComposerTextareaHeight(48, 180), 48);
  assert.equal(nextComposerTextareaHeight(240, 180), 180);
  const parsed = parseModelState({
    currentModelId: "grok-4",
    availableModels: [{ modelId: "grok-4", name: "Grok 4", _meta: { supportsReasoningEffort: true } }],
    reasoningEffort: "high",
  });
  assert.equal(parsed.currentId, "grok-4");
  assert.equal(parsed.currentName, "Grok 4");
  assert.equal(parsed.effort, "high");
  assert.equal(parsed.models[0]?.supportsEffort, true);
});


test("slash Tab completes, Enter accepts", () => {
  const open = {
    enterSends: true,
    promptEmpty: false,
    slashOpen: true,
    historyOpen: false,
  };
  assert.equal(mapComposerKey("Tab", none, open), "slash-complete");
  assert.equal(mapComposerKey("Enter", none, open), "slash-accept");
});

test("Shift+Tab cycles session mode when slash closed", () => {
  assert.equal(
    mapComposerKey("Tab", { ...none, shift: true }, {
      enterSends: true,
      promptEmpty: false,
      slashOpen: false,
      historyOpen: false,
    }),
    "cycle-mode",
  );
  assert.equal(
    mapComposerKey("Tab", { ...none, shift: true }, {
      enterSends: true,
      promptEmpty: false,
      slashOpen: true,
      historyOpen: false,
    }),
    "slash-complete",
  );
});

test("ghost does not eat Shift+Tab", () => {
  assert.equal(
    mapComposerKey("Tab", { ...none, shift: true }, {
      enterSends: true,
      promptEmpty: false,
      slashOpen: false,
      historyOpen: false,
      ghost: "/plan",
    }),
    "cycle-mode",
  );
});
