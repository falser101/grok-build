import assert from "node:assert/strict";
import test from "node:test";
import {
  ConversationTimeline,
  formatCompactElapsed,
  formatCompactTokens,
  isReplayMeta,
  railPreview,
  textFromContent,
} from "./conversation.ts";

test("textFromContent walks nested and array blocks", () => {
  assert.equal(textFromContent({ type: "text", text: "hi" }), "hi");
  assert.equal(textFromContent([{ text: "a" }, { text: "b" }]), "ab");
});

test("isReplayMeta reads params._meta.isReplay", () => {
  assert.equal(isReplayMeta({ _meta: { isReplay: true } }), true);
  assert.equal(isReplayMeta({ update: { sessionUpdate: "agent_message_chunk" } }), false);
});

test("live eventId is de-duplicated; replay is not", () => {
  const t = new ConversationTimeline();
  const chunk = (id: string, replay: boolean, text: string) =>
    t.apply("session/update", {
      update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
      _meta: { eventId: id, isReplay: replay },
    });
  chunk("e1", false, "a");
  chunk("e1", false, "b");
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0]?.text, "a");
  t.beginReplay();
  chunk("e1", true, "old");
  chunk("e2", true, "old2");
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0]?.text, "oldold2");
});

test("image-only user chunk merges onto the previous user bubble", () => {
  const t = new ConversationTimeline();
  t.insertUser("[Image #1] caption");
  t.apply("session/update", {
    update: {
      sessionUpdate: "user_message_chunk",
      content: [
        { type: "text", text: "" },
        { type: "image", mimeType: "image/png", data: "aaa" },
      ],
    },
    _meta: { eventId: "img1" },
  });
  const users = t.items.filter((i) => i.kind === "user");
  assert.equal(users.length, 1);
  assert.equal(users[0]?.images?.length, 1);
});

test("image-only user chunk merges across an image_compressed sys row", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "这是什么" } },
    _meta: { eventId: "u-text" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "image_compressed" },
    _meta: { eventId: "u-cmp" },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "user_message_chunk",
      content: [
        { type: "text", text: "" },
        { type: "image", mimeType: "image/png", data: "aaa" },
      ],
    },
    _meta: { eventId: "u-img" },
  });
  const users = t.items.filter((i) => i.kind === "user");
  assert.equal(users.length, 1);
  assert.equal(users[0]?.text, "这是什么");
  assert.equal(users[0]?.images?.length, 1);
  assert.equal(t.items.filter((i) => i.kind === "sys").length, 0);
});

test("caption after an image-only user bubble stays on the same turn", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "user_message_chunk",
      content: [
        { type: "text", text: "" },
        { type: "image", mimeType: "image/png", data: "aaa" },
      ],
    },
    _meta: { eventId: "u-img" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "这是什么" } },
    _meta: { eventId: "u-text" },
  });
  const users = t.items.filter((i) => i.kind === "user");
  assert.equal(users.length, 1);
  assert.equal(users[0]?.text, "这是什么");
  assert.equal(users[0]?.images?.length, 1);
});

test("optimistic images are replaced, not duplicated, by the server echo", () => {
  const t = new ConversationTimeline();
  t.insertUser("这是什么", [{ src: "data:image/png;base64,local", alt: "shot.png" }]);
  t.apply("session/update", { update: { sessionUpdate: "image_compressed" }, _meta: { eventId: "cmp" } });
  t.apply("session/update", {
    update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "这是什么" } },
    _meta: { eventId: "echo-text" },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "user_message_chunk",
      content: [
        { type: "text", text: "" },
        { type: "image", mimeType: "image/png", data: "server" },
      ],
    },
    _meta: { eventId: "echo-img" },
  });
  const users = t.items.filter((i) => i.kind === "user");
  assert.equal(users.length, 1);
  assert.equal(users[0]?.images?.length, 1);
  assert.equal(users[0]?.images?.[0]?.src, "data:image/png;base64,server");
});

test("optimistic user bubble is not duplicated by echo", () => {
  const t = new ConversationTimeline();
  t.insertUser("hello");
  t.apply("session/update", {
    update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "hello" } },
    _meta: { eventId: "u1" },
  });
  assert.equal(t.items.filter((i) => i.kind === "user").length, 1);
});

test("insertUser ends replay so the chip can paint", () => {
  const t = new ConversationTimeline();
  t.beginReplay();
  assert.equal(t.replayActive, true);
  t.insertUser("visible-user-bubble");
  assert.equal(t.replayActive, false);
  assert.equal(t.items[0]?.kind, "user");
  assert.equal(t.items[0]?.text, "visible-user-bubble");
});

test("live user_message_chunk with _meta on update becomes a user item", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    sessionId: "s1",
    update: {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "visible-user-bubble" },
      _meta: { eventId: "s1-2", agentTimestampMs: 1 },
    },
  });
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0]?.kind, "user");
  assert.equal(t.items[0]?.text, "visible-user-bubble");
  assert.equal(t.lastEventId, "s1-2");
});

test("user chunk prefers content._meta.displayText", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "user_message_chunk",
      content: {
        type: "text",
        text: "wrapped <system-reminder> hide",
        _meta: { displayText: "visible-user-bubble" },
      },
    },
  });
  assert.equal(t.items[0]?.text, "visible-user-bubble");
});

test("hideFromScrollback drops internal user echoes", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "user_message_chunk",
      content: {
        type: "text",
        text: "secret",
        _meta: { hideFromScrollback: true },
      },
    },
  });
  assert.equal(t.items.length, 0);
});

test("replay user messages are kept", () => {
  const t = new ConversationTimeline();
  t.beginReplay();
  t.apply("session/update", {
    update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "from history" } },
    _meta: { isReplay: true, eventId: "h1" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "**hi**" } },
    _meta: { isReplay: true, eventId: "h2" },
  });
  t.endReplay(0);
  assert.equal(t.items[0]?.kind, "user");
  assert.equal(t.items[1]?.kind, "agent");
  assert.equal(t.items[1]?.text, "**hi**");
  assert.equal(t.items[1]?.replay, true);
});

test("tool_call updates merge by toolCallId", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "t1",
      title: "read f.ts",
      kind: "execute",
      status: "pending",
    },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId: "t1",
      status: "completed",
      content: [{ type: "content", content: { type: "text", text: "ok" } }],
    },
  });
  assert.equal(t.items.filter((i) => i.kind === "tool").length, 1);
  assert.equal(t.items[0]?.status, "completed");
  assert.match(t.items[0]?.html ?? "", /tool-output/);
});

test("read tools collapse into one group when enabled", () => {
  const t = new ConversationTimeline();
  t.opts.groupTools = true;
  t.apply("session/update", {
    update: { sessionUpdate: "tool_call", toolCallId: "a", kind: "read", title: "a.ts" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "tool_call", toolCallId: "b", kind: "read", title: "b.ts" },
  });
  const tools = t.items.filter((i) => i.kind === "tool");
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.groupCount, 2);
  assert.match(tools[0]?.title ?? "", /读了 2/);
});

test("edits and executes stay as their own rows; only reads group", () => {
  const t = new ConversationTimeline();
  t.opts.groupTools = true;
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "e1",
      kind: "edit",
      title: "Edit `docs/a.md`",
      status: "completed",
      content: [{ type: "diff", path: "docs/a.md", oldText: "a", newText: "b" }],
    },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "e2",
      kind: "edit",
      title: "Edit `web/src/style.css`",
      status: "completed",
    },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "x1",
      kind: "execute",
      title: "Execute `npx tsc --noEmit`",
      status: "completed",
    },
  });
  const tools = t.items.filter((i) => i.kind === "tool");
  assert.equal(tools.length, 3);
  assert.match(tools[0]?.title ?? "", /编辑 a.md/);
  assert.equal(tools[0]?.open, true);
  assert.match(tools[0]?.html ?? "", /diff-table/);
  assert.match(tools[1]?.title ?? "", /编辑 style.css/);
  assert.match(tools[2]?.title ?? "", /运行 npx tsc --noEmit/);
  assert.equal(tools[2]?.open, false);
});

test("think, reply, tools, think, tools, reply stay in arrival order", () => {
  const t = new ConversationTimeline();
  t.opts.groupTools = true;
  t.apply("session/update", {
    update: { sessionUpdate: "agent_thought_chunk", content: { text: "plan" } },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "agent_message_chunk", content: { text: "first" } },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "tool_call", toolCallId: "r1", kind: "read", title: "a.ts" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "tool_call", toolCallId: "r2", kind: "read", title: "b.ts" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "agent_thought_chunk", content: { text: "again" } },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "tool_call", toolCallId: "e1", kind: "edit", title: "Edit `a.ts`" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "agent_message_chunk", content: { text: "second" } },
  });
  assert.deepEqual(
    t.items.map((i) => i.kind),
    ["think", "agent", "tool", "think", "tool", "agent"],
  );
  assert.equal(t.items[1]?.text, "first");
  assert.equal(t.items[2]?.groupCount, 2);
  assert.match(t.items[2]?.title ?? "", /读了 2/);
  assert.equal(t.items[4]?.title, "编辑 a.ts");
  assert.equal(t.items[5]?.text, "second");
});

test("search after read still groups; execute stays separate", () => {
  const t = new ConversationTimeline();
  t.opts.groupTools = true;
  t.apply("session/update", {
    update: { sessionUpdate: "tool_call", toolCallId: "a", kind: "read", title: "Read `a.ts`" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "tool_call", toolCallId: "b", kind: "search", title: "Grep `TODO`" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "tool_call", toolCallId: "c", kind: "execute", title: "Execute `ls`" },
  });
  const tools = t.items.filter((i) => i.kind === "tool");
  assert.equal(tools.length, 2);
  assert.match(tools[0]?.title ?? "", /读取/);
  assert.match(tools[0]?.title ?? "", /搜索/);
  assert.match(tools[1]?.title ?? "", /运行 ls/);
});

test("workflow updates merge onto the same run id", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "workflow_updated",
      runId: "w1",
      name: "review",
      status: "running",
      phases: [{ title: "gather", state: "active" }],
    },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "workflow_updated",
      runId: "w1",
      name: "review",
      status: "done",
      phases: [
        { title: "gather", state: "done" },
        { title: "review", state: "done" },
      ],
    },
  });
  const rows = t.items.filter((i) => i.kind === "workflow");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, "done");
  assert.equal(rows[0]?.phases?.length, 2);
  assert.match(rows[0]?.html ?? "", /phase-trail/);
});

test("subagent progress updates the spawned row", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "subagent_spawned",
      childSessionId: "child-1",
      description: "explore ui",
      subagentType: "explore",
      status: "running",
    },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "subagent_progress",
      childSessionId: "child-1",
      activity: "Reading style.css",
    },
  });
  const rows = t.items.filter((i) => i.kind === "subagent");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.activity, "Reading style.css");
  assert.equal(rows[0]?.subType, "explore");
});

test("runningSubagentCount ignores finished and workflow children", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "subagent_spawned",
      childSessionId: "live",
      status: "running",
    },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "subagent_spawned",
      childSessionId: "done",
      status: "completed",
    },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "subagent_spawned",
      childSessionId: "wf",
      status: "running",
      workflowRunId: "run-1",
    },
  });
  assert.equal(t.runningSubagentCount(), 1);
});

test("compact token and duration labels", () => {
  assert.equal(formatCompactTokens(48800), "48.8k");
  assert.equal(formatCompactTokens(27100), "27.1k");
  assert.equal(formatCompactElapsed(21000), "21 秒");
  assert.equal(formatCompactElapsed(170000), "2 分 50 秒");
});

test("dropped images become system rows; compressed images do not", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", { update: { sessionUpdate: "image_dropped" } });
  t.apply("session/update", { update: { sessionUpdate: "image_compressed" } });
  assert.equal(t.items.filter((i) => i.kind === "sys").length, 1);
  assert.equal(t.items.some((i) => i.text.includes("已压缩")), false);
});

test("compaction started and completed reuse one card", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: { sessionUpdate: "auto_compact_started", percentage: 85, tokens_used: 48800 },
  });
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0]?.kind, "compact");
  assert.equal(t.items[0]?.status, "running");
  assert.equal(t.items[0]?.text, "正在压缩上下文");
  assert.match(t.items[0]?.html ?? "", /85%/);
  t.apply("session/update", {
    update: {
      sessionUpdate: "auto_compact_completed",
      tokens_before: 48800,
      tokens_after: 27100,
      elapsed_ms: 170000,
    },
  });
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0]?.status, "done");
  assert.equal(t.items[0]?.text, "上下文已压缩");
  assert.match(t.items[0]?.html ?? "", /48\.8k/);
  assert.match(t.items[0]?.html ?? "", /27\.1k/);
  assert.match(t.items[0]?.html ?? "", /2 分 50 秒/);
});

test("a later compaction starts a new card after the previous one finished", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", { update: { sessionUpdate: "compaction_started" } });
  t.apply("session/update", { update: { sessionUpdate: "compaction_completed" } });
  t.apply("session/update", { update: { sessionUpdate: "compaction_started" } });
  assert.equal(t.items.filter((i) => i.kind === "compact").length, 2);
  assert.equal(t.items[0]?.status, "done");
  assert.equal(t.items[1]?.status, "running");
});

test("compaction failure updates the running card", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", { update: { sessionUpdate: "auto_compact_started", percentage: 90 } });
  t.apply("session/update", {
    update: { sessionUpdate: "auto_compact_failed", error: "out of credits" },
  });
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0]?.status, "failed");
  assert.equal(t.items[0]?.text, "压缩失败");
  assert.match(t.items[0]?.html ?? "", /out of credits/);
});

test("replay settles a compact card that never completed", () => {
  const t = new ConversationTimeline();
  t.beginReplay();
  t.apply("session/update", { update: { sessionUpdate: "compaction_started" } });
  assert.equal(t.items[0]?.status, "running");
  t.endReplay(0);
  assert.equal(t.items[0]?.status, "done");
  assert.equal(t.items[0]?.text, "上下文已压缩");
});

test("expandDetail shows full execute output", () => {
  const t = new ConversationTimeline();
  const body = Array.from({ length: 12 }, (_, i) => `row-${i}`).join("\n");
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "x1",
      kind: "execute",
      title: "Execute `seq`",
      rawInput: { command: "seq" },
      content: { type: "text", text: body },
    },
  });
  assert.match(t.items[0]?.html ?? "", /行省略/);
  t.expandDetail(t.items[0]!.id);
  assert.equal(t.items[0]?.html.includes("行省略"), false);
  assert.match(t.items[0]?.html ?? "", /row-11/);
});

test("streaming chunks dirty only the live agent bubble", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: { sessionUpdate: "agent_message_chunk", content: { text: "Hello" } },
    _meta: { eventId: "a1" },
  });
  const first = t.takePaint();
  assert.equal(first.dirty.size, 1);
  t.apply("session/update", {
    update: { sessionUpdate: "agent_message_chunk", content: { text: " world" } },
    _meta: { eventId: "a2" },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "agent_message_chunk", content: { text: "!" } },
    _meta: { eventId: "a3" },
  });
  const next = t.takePaint();
  assert.equal(next.full, false);
  assert.equal(next.dirty.size, 1);
  assert.equal(t.items[0]?.text, "Hello world!");
});

test("retry_state does not enter the timeline", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: { sessionUpdate: "retry_state", type: "retrying", attempt: 4, maxRetries: 5 },
  });
  t.apply("session/update", {
    update: { sessionUpdate: "auto_recovery_started" },
  });
  assert.equal(t.items.length, 0);
});

test("thinking is skipped when hidden; prompt_complete folds it", () => {
  const t = new ConversationTimeline();
  t.opts.showThinking = false;
  t.apply("session/update", {
    update: { sessionUpdate: "agent_thought_chunk", content: { text: "secret" } },
  });
  assert.equal(t.items.length, 0);
  t.opts.showThinking = true;
  t.apply("session/update", {
    update: { sessionUpdate: "agent_thought_chunk", content: { text: "plan" } },
  });
  t.apply("x.ai/session/prompt_complete", {});
  assert.equal(t.items[0]?.open, false);
});

test("model switch does not clutter the timeline", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: { sessionUpdate: "model_changed", modelId: "grok-4" },
  });
  assert.equal(t.items.length, 0);
});

test("context btw jump copy and find helpers", () => {
  const t = new ConversationTimeline();
  t.insertUser("q1");
  t.apply("session/update", {
    update: { sessionUpdate: "agent_message_chunk", content: { text: "answer-one" } },
    _meta: { eventId: "a1" },
  });
  t.insertContext("ctx 42%");
  t.nextAgentIsBtw = true;
  t.apply("session/update", {
    update: { sessionUpdate: "agent_message_chunk", content: { text: "aside" } },
    _meta: { eventId: "a2" },
  });
  assert.equal(t.items.some((i) => i.kind === "context"), true);
  assert.equal(t.items.some((i) => i.kind === "btw"), true);
  assert.equal(t.nthAgent(1)?.text, "aside");
  assert.equal(t.nthAgent(2)?.text, "answer-one");
  assert.equal(t.findHits("answer").length, 1);
  t.select(t.items[0]!.id);
  assert.equal(t.items[0]?.selected, true);
  const id = t.selectDelta(1);
  assert.ok(id);
});

test("userTurns and railPreview for the history axis", () => {
  const t = new ConversationTimeline();
  t.insertUser("first prompt");
  t.apply("session/update", {
    update: { sessionUpdate: "agent_message_chunk", content: { text: "ok" } },
    _meta: { eventId: "a" },
  });
  t.insertUser("second\nline");
  assert.equal(t.userTurns().length, 2);
  assert.equal(t.userTurns()[0]?.text, "first prompt");
  assert.equal(railPreview("hello\nworld"), "hello world");
  assert.equal(railPreview("x".repeat(200)).endsWith("…"), true);
});

test("hook footer and credit link", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "h1",
      kind: "execute",
      title: "run",
      hook: "pre",
      content: { text: "\u001b[31mfail\u001b[0m" },
    },
  });
  assert.equal(t.items[0]?.hook, "pre");
  assert.match(t.items[0]?.html ?? "", /ansi-red/);
  t.apply("session/update", {
    update: { sessionUpdate: "credit_limit_block", content: { text: "out" } },
  });
  const credit = t.items.find((i) => i.kind === "credit");
  assert.equal(credit?.href, "https://grok.com");
});

test("edit tool renders a diff table", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "e1",
      kind: "edit",
      title: "patch",
      content: [{ type: "diff", path: "a.ts", oldText: "a", newText: "b" }],
    },
  });
  assert.match(t.items[0]?.html ?? "", /diff-table/);
  assert.equal(t.items[0]?.open, true);
});

test("edit diff can come from rawInput old_string/new_string", () => {
  const t = new ConversationTimeline();
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "e1",
      kind: "edit",
      title: "Edit `web/e2e/conversation.spec.ts`",
      rawInput: {
        path: "web/e2e/conversation.spec.ts",
        old_string: "foo",
        new_string: "bar",
      },
    },
  });
  assert.match(t.items[0]?.html ?? "", /diff-table/);
  assert.match(t.items[0]?.html ?? "", /foo/);
  assert.match(t.items[0]?.html ?? "", /bar/);
});

test("tool args stream then pretty; elapsed and pending_user", () => {
  const t = new ConversationTimeline();
  t.opts.groupTools = false;
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "p1",
      kind: "other",
      title: "custom",
      status: "in_progress",
      rawInput: { a: 1 },
    },
  });
  assert.match(t.items[0]?.html ?? "", /"a":1/);
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call_delta_chunk",
      toolCallId: "p1",
      status: "in_progress",
      delta: '{"b":2}',
    },
  });
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId: "p1",
      status: "completed",
      elapsed_ms: 1500,
    },
  });
  assert.match(t.items[0]?.html ?? "", /"a": 1/);
  assert.equal(t.items[0]?.elapsedMs, 1500);
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "p2",
      kind: "other",
      title: "need yes",
      status: "pending_user",
    },
  });
  assert.equal(t.items[1]?.status, "pending_user");
});

test("skill tool titles 使用了 skill", () => {
  const t = new ConversationTimeline();
  t.opts.groupTools = false;
  t.apply("session/update", {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "sk1",
      name: "skill",
      title: "my-skill",
      status: "completed",
    },
  });
  assert.match(t.items[0]?.title ?? "", /使用了 skill/);
});
