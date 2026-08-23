import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelOptionsFor,
  cancelSubagentsForChoice,
  parseCancelSubagentsPref,
  prefFromCancelChoice,
  bashGlobIsCatchall,
  bashPatternMatches,
  defaultAllowCount,
  defaultDenyCount,
  defaultPermissionIndex,
  firstAllowOnceId,
  optionLabel,
  parsePermissionRequest,
  parsePlanRequest,
  parseQuestionRequest,
  permissionSelected,
  permissionSelectionMeta,
  planApproved,
  questionAccepted,
  rejectOption,
  scopedOptionLabel,
  stepAllowCount,
  tokenizeCommand,
} from "./blocking_cards.ts";

test("parsePermissionRequest reads options and command from toolCall", () => {
  const req = parsePermissionRequest({
    sessionId: "s1",
    toolCall: {
      toolCallId: "t1",
      title: "Execute `ls`",
      kind: "execute",
      rawInput: { command: "ls -la" },
    },
    options: [
      { optionId: "always-allow", name: "always allow", kind: "allow_always" },
      { optionId: "allow-once", name: "Yes", kind: "allow_once" },
      { optionId: "reject-once", name: "No", kind: "reject_once" },
    ],
  });
  assert.equal(req.sessionId, "s1");
  assert.equal(req.detail, "ls -la");
  assert.equal(req.options.length, 3);
  assert.equal(defaultPermissionIndex(req.options, null), 0);
  assert.equal(firstAllowOnceId(req.options), "allow-once");
  assert.equal(rejectOption(req.options)?.optionId, "reject-once");
  assert.equal(optionLabel(req.options[1]!), "允许一次");
});

test("sticky kind wins over always-allow default", () => {
  const options = parsePermissionRequest({
    options: [
      { optionId: "always-allow", kind: "allow_always", name: "a" },
      { optionId: "allow-once", kind: "allow_once", name: "b" },
    ],
  }).options;
  assert.equal(defaultPermissionIndex(options, "allow_once"), 1);
});

test("permissionSelected matches ACP selected outcome", () => {
  assert.deepEqual(permissionSelected("allow-once"), {
    outcome: { outcome: "selected", optionId: "allow-once" },
  });
});

test("parseQuestionRequest supports multi_select alias and builds accepted answers", () => {
  const req = parseQuestionRequest({
    sessionId: "s",
    toolCallId: "q1",
    mode: "plan",
    questions: [
      {
        question: "Which?",
        multi_select: true,
        options: [{ label: "A", description: "one" }, { label: "B", description: "two" }],
      },
    ],
  });
  assert.equal(req.mode, "plan");
  assert.equal(req.questions[0]?.multi, true);
  const body = questionAccepted({ "Which?": ["A"] }, { "Which?": { notes: "hi" } });
  assert.equal(body.outcome, "accepted");
});

test("tokenize and default allow scope pin dangerous commands", () => {
  assert.deepEqual(tokenizeCommand("git push origin main"), ["git", "push", "origin", "main"]);
  assert.equal(defaultAllowCount(["ls", "src"]), 1);
  assert.equal(defaultAllowCount(["git", "status", "--short"]), 2);
  assert.equal(defaultAllowCount(["git", "push", "origin"]), 3);
  assert.equal(defaultDenyCount(["git", "push", "origin"]), 2);
  assert.equal(stepAllowCount(["git", "status", "x"], 2, true), 3);
});

test("glob catchall is refused; prefix match works", () => {
  assert.equal(bashGlobIsCatchall("*"), true);
  assert.equal(bashGlobIsCatchall("gh api repos/*"), false);
  assert.equal(bashPatternMatches("git push", "git push origin"), true);
  assert.equal(bashPatternMatches("gh api repos/*", "gh api repos/foo"), true);
});

test("bash always-allow selection meta uses command_parts", () => {
  const req = parsePermissionRequest({
    toolCall: { title: "Execute `git push origin`", kind: "execute", rawInput: { command: "git push origin" } },
    options: [{ optionId: "allow-always-command", kind: "allow_always", name: "Always allow:" }],
    _meta: { highlighted_words: ["git", "push", "origin"] },
  });
  assert.deepEqual(req.bashWords, ["git", "push", "origin"]);
  const opt = req.options[0]!;
  assert.equal(scopedOptionLabel(opt, req, { bashAllowCount: 2 }), "始终允许：git push");
  assert.deepEqual(permissionSelectionMeta(opt, req, { bashAllowCount: 2 }), {
    command_parts: ["git", "push"],
    is_glob: false,
  });
  assert.deepEqual(
    permissionSelectionMeta(opt, req, { patternOpen: true, patternDirty: true, patternBuffer: "gh api repos/*" }),
    { command_parts: ["gh api repos/*"], is_glob: true },
  );
});

test("reject-always meta uses deny count; mcp meta uses kind tag", () => {
  const bash = parsePermissionRequest({
    toolCall: { kind: "execute", rawInput: { command: "cargo test --lib" } },
    options: [{ optionId: "reject-always", kind: "reject_always" }],
  });
  assert.deepEqual(permissionSelectionMeta(bash.options[0]!, bash, { bashDenyCount: 2 }), {
    command_parts: ["cargo", "test"],
    is_glob: false,
  });
  const mcp = parsePermissionRequest({
    toolCall: { name: "linear__list_issues", kind: "other" },
    options: [
      {
        optionId: "allow-always-mcp",
        kind: "allow_always",
        _meta: { tool_name: "linear__list_issues", server_prefix: "linear" },
      },
    ],
  });
  assert.equal(mcp.mcpServer, "linear");
  assert.deepEqual(permissionSelectionMeta(mcp.options[0]!, mcp, { mcpScope: "server" }), {
    kind: "server",
    server: "linear",
  });
});

test("permissionSelected attaches _meta when given", () => {
  assert.deepEqual(permissionSelected("allow-once"), {
    outcome: { outcome: "selected", optionId: "allow-once" },
  });
  assert.deepEqual(permissionSelected("allow-always-command", { command_parts: ["ls"], is_glob: false }), {
    outcome: { outcome: "selected", optionId: "allow-always-command" },
    _meta: { command_parts: ["ls"], is_glob: false },
  });
});

test("cancel options expand when subagents are running", () => {
  assert.equal(cancelOptionsFor(0).length, 2);
  assert.equal(cancelOptionsFor(2).length, 4);
  assert.equal(cancelSubagentsForChoice("keep"), null);
  assert.equal(cancelSubagentsForChoice("stop"), true);
  assert.equal(cancelSubagentsForChoice("leave-subagents"), false);
  assert.equal(prefFromCancelChoice("always-stop"), "always_stop");
  assert.equal(parseCancelSubagentsPref("always_continue"), "always_continue");
  assert.equal(parseCancelSubagentsPref("nope"), "ask");
});

test("parsePlanRequest and approved outcome", () => {
  const req = parsePlanRequest({ sessionId: "s", toolCallId: "p", planContent: "# go" });
  assert.equal(req.planContent, "# go");
  assert.deepEqual(planApproved(), { outcome: "approved" });
});
