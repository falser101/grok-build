import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UNGROUPED_WORKSPACE_KEY,
  buildSessionDeleteParams,
  buildSessionForkParams,
  buildSessionRenameParams,
  buildSessionSearchParams,
  deepLinkSessionId,
  formatTokenCount,
  groupSessionsByWorkspace,
  PICKER_GROUP_LIMIT,
  pickerDisplayTitle,
  pickerSessionVisible,
  readSessionCache,
  selectVisiblePickerSessions,
  writeSessionCache,
  parseContextBreakdown,
  parseForkNewSessionId,
  parseResumeWorktreeResult,
  parseRewindPoints,
  lastRewindPoint,
  parseSearchHits,
  parseSessionInfoFields,
  workspaceGroupKey,
  workspaceGroupLabel,
} from "./session_ops.ts";

test("rename/delete carry row cwd and admin kind", () => {
  const rename = buildSessionRenameParams({
    sessionId: "s1",
    title: "Hello",
    cwd: "/repo",
    kind: "build",
  }) as { cwd: string; kind: string; resetToAuto: boolean };
  assert.equal(rename.cwd, "/repo");
  assert.equal(rename.kind, "build");
  assert.equal(rename.resetToAuto, false);
  const del = buildSessionDeleteParams({
    sessionId: "s1",
    cwd: "/repo",
    kind: "chat",
  }) as { kind: string };
  assert.equal(del.kind, "chat");
});

test("fork uses source cwd as newCwd", () => {
  const fork = buildSessionForkParams({
    sourceSessionId: "a",
    sourceCwd: "/x",
    newCwd: "/x",
  }) as { newCwd: string; sessionKind: string };
  assert.equal(fork.newCwd, "/x");
  assert.equal(fork.sessionKind, "fork");
  assert.equal(parseForkNewSessionId({ newSessionId: "b" }), "b");
});

test("content search parser and deep link", () => {
  const params = buildSessionSearchParams({ query: "auth" }) as {
    query: string;
    includeContent: boolean;
  };
  assert.equal(params.query, "auth");
  assert.equal(params.includeContent, true);
  const hits = parseSearchHits({
    results: [{ sessionId: "s", cwd: "/a", summary: "t", snippet: "hit" }],
  });
  assert.equal(hits[0]?.snippet, "hit");
  assert.equal(deepLinkSessionId("?session=abc-123"), "abc-123");
  assert.equal(deepLinkSessionId(""), null);
});

test("session cache round-trips last id and list", () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };
  writeSessionCache(storage, {
    lastId: "abc",
    sessions: [
      {
        sessionId: "abc",
        summary: "hello",
        cwd: "/tmp",
        updatedAt: null,
        source: null,
        lastTurnSummary: null,
        sessionKind: null,
        adminKind: "build",
        worktreeLabel: null,
        gitRootDir: "/tmp",
        sourceWorkspaceDir: "/tmp",
        repoName: "tmp",
      },
    ],
  });
  const read = readSessionCache(storage);
  assert.equal(read?.lastId, "abc");
  assert.equal(read?.sessions[0]?.summary, "hello");
});

test("sessions group by git root (workspace), falling back to cwd", () => {
  const groups = groupSessionsByWorkspace([
    {
      sessionId: "a",
      cwd: "/home/me/proj/web",
      gitRootDir: "/home/me/proj",
      repoName: "proj",
      updatedAt: "2026-01-02",
    },
    {
      sessionId: "b",
      cwd: "/home/me/proj/.worktrees/wt",
      gitRootDir: "/home/me/proj",
      repoName: "proj",
      updatedAt: "2026-01-03",
    },
    {
      sessionId: "c",
      cwd: "/tmp/other",
      gitRootDir: null,
      updatedAt: "2026-01-01",
    },
    { sessionId: "d", cwd: null, updatedAt: null },
  ]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0]?.key, "/home/me/proj");
  assert.equal(groups[0]?.label, "proj");
  assert.deepEqual(
    groups[0]?.sessions.map((s) => s.sessionId),
    ["b", "a"],
  );
  assert.equal(workspaceGroupKey({ sessionId: "x", cwd: null }), UNGROUPED_WORKSPACE_KEY);
  assert.equal(workspaceGroupLabel({ sessionId: "x", cwd: null }), "其它");
});

test("picker visibility matches TUI resume list", () => {
  const now = Date.parse("2026-08-24T00:00:00.000Z");
  const base = {
    cwd: "/home/falser/Projects/grok-build",
    updatedAt: "2026-08-20T00:00:00.000Z",
    source: "local" as const,
    lastTurnSummary: null,
    sessionKind: null,
    adminKind: "build" as const,
    worktreeLabel: null,
    gitRootDir: "/home/falser/Projects/grok-build",
    sourceWorkspaceDir: null,
    repoName: "grok-build",
  };
  const titled = {
    ...base,
    sessionId: "titled-1",
    summary: "Git Pull and Upstream Code Update",
  };
  const empty = {
    ...base,
    sessionId: "019fa13f-5c60-7e80-bde0-7b2a67427cf0",
    summary: "",
  };
  const subagent = {
    ...base,
    sessionId: "child-1",
    summary: "Investigate the JSON-encoded question below",
    sessionKind: "subagent",
  };
  const old = {
    ...base,
    sessionId: "old-1",
    summary: "Ancient work",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
  const noTs = {
    ...base,
    sessionId: "no-ts",
    summary: "no timestamp",
    updatedAt: null,
  };
  const chat = {
    ...base,
    sessionId: "conv-1",
    summary: "",
    source: "conversation",
    adminKind: "chat" as const,
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
  const claude = {
    ...base,
    sessionId: "claude-1",
    summary: "Claude leftover",
    source: "claude",
  };
  const fromPrompt = {
    ...base,
    sessionId: "fp-1",
    summary: "",
    firstPrompt: "Fix the auth bug\nmore",
  };

  assert.equal(pickerSessionVisible(titled, now), true);
  assert.equal(pickerSessionVisible(empty, now), false);
  assert.equal(pickerSessionVisible(subagent, now), false);
  assert.equal(pickerSessionVisible({ ...subagent, sessionKind: "subagent_resume" }, now), false);
  assert.equal(pickerSessionVisible(old, now), false);
  assert.equal(pickerSessionVisible(noTs, now), false);
  assert.equal(pickerSessionVisible(chat, now), true);
  assert.equal(pickerDisplayTitle(chat), "");
  assert.equal(pickerSessionVisible(claude, now), false);
  assert.equal(pickerSessionVisible(fromPrompt, now), true);
  assert.equal(pickerDisplayTitle(fromPrompt), "Fix the auth bug");

  const kept = selectVisiblePickerSessions(
    [titled, empty, subagent, old, noTs, chat, claude, fromPrompt],
    { now, keepIds: [empty.sessionId] },
  );
  assert.deepEqual(
    kept.map((e) => e.sessionId).sort(),
    [chat.sessionId, empty.sessionId, fromPrompt.sessionId, titled.sessionId].sort(),
  );

  const cwd = "/repo";
  const many = Array.from({ length: PICKER_GROUP_LIMIT + 5 }, (_, i) => ({
    ...base,
    cwd,
    gitRootDir: cwd,
    sessionId: `s-${String(i).padStart(2, "0")}`,
    summary: `row ${i}`,
    updatedAt: `2026-08-${String(10 + (i % 14)).padStart(2, "0")}T00:00:00.000Z`,
  }));
  const capped = selectVisiblePickerSessions(many, { now });
  assert.equal(capped.length, PICKER_GROUP_LIMIT);
});

test("rewind points accept camelCase and snake_case", () => {
  const pts = parseRewindPoints({
    rewind_points: [{ prompt_index: 2, prompt_preview: "hello" }],
  });
  assert.equal(pts[0]?.promptIndex, 2);
  assert.equal(pts[0]?.preview, "hello");
});

test("last rewind point is the newest promptIndex", () => {
  assert.equal(lastRewindPoint([]), null);
  const last = lastRewindPoint([
    { promptIndex: 1, preview: "a" },
    { promptIndex: 3, preview: "c" },
    { promptIndex: 2, preview: "b" },
  ]);
  assert.equal(last?.promptIndex, 3);
  assert.equal(last?.preview, "c");
});

test("context breakdown prefers a stacked bar over a single dump", () => {
  const b = parseContextBreakdown({
    sessionId: "abc",
    cwd: "/repo",
    data: {
      modelDisplayName: "Grok 4.6",
      turns: 4,
      context: {
        used: 2500,
        total: 10000,
        usagePct: 25,
        systemPromptTokens: 400,
        messageTokens: 1800,
        toolDefinitionsTokens: 300,
        freeTokens: 7500,
        autoCompactThresholdPercent: 85,
        usageCategories: [{ label: "Skills", tokens: 120, detail: "3 skills" }],
      },
    },
  });
  assert.equal(b.percent, 25);
  assert.equal(b.sessionId, "abc");
  assert.equal(b.autoCompactAt, 85);
  assert.deepEqual(
    b.slices.map((s) => s.key),
    ["messages", "system", "tools", "free"],
  );
  assert.equal(b.categories[0]?.label, "Skills");
  assert.equal(formatTokenCount(1800), "1.8k");
  const fields = parseSessionInfoFields({
    sessionId: "abc",
    cwd: "/repo",
    data: { model: "grok-4", turns: 4, context: { used: 25, total: 100 } },
  });
  assert.equal(fields[0]?.label, "会话");
  assert.ok(fields.some((f) => f.label === "用量"));
});

test("resume worktree result prefers the forked session and effective cwd", () => {
  const r = parseResumeWorktreeResult({
    sessionId: "fork-1",
    effectiveCwd: "/tmp/wt",
    worktreePath: "/tmp/wt",
  });
  assert.equal(r.sessionId, "fork-1");
  assert.equal(r.cwd, "/tmp/wt");
});
