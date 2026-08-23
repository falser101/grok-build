import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UNGROUPED_WORKSPACE_KEY,
  buildSessionDeleteParams,
  buildSessionForkParams,
  buildSessionRenameParams,
  buildSessionSearchParams,
  deepLinkSessionId,
  groupSessionsByWorkspace,
  readSessionCache,
  writeSessionCache,
  parseForkNewSessionId,
  parseRewindPoints,
  parseSearchHits,
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

test("rewind points accept camelCase and snake_case", () => {
  const pts = parseRewindPoints({
    rewind_points: [{ prompt_index: 2, prompt_preview: "hello" }],
  });
  assert.equal(pts[0]?.promptIndex, 2);
  assert.equal(pts[0]?.preview, "hello");
});
