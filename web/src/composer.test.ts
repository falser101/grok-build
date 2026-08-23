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
  parseLocalSlash,
  parsePromptHistory,
  parseQueueChanged,
  parseSuggest,
  pasteTooLarge,
  atQuery,
  applyAtAccept,
  looksLikePlan,
  parseModelState,
  permissionChipLabel,
  effortChipLabel,
  composerIsFilled,
  shouldEnqueue,
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
