import assert from "node:assert/strict";
import test from "node:test";
import { parseHashRoute, hashForDashboard } from "./palette.ts";
import {
  DASH_GROUP_LABEL,
  DASH_GROUP_ORDER,
  DASH_PAGE_TITLE,
  DASH_TITLE,
  applyRosterChanged,
  buildDashGroups,
  dashMatches,
  dashStatusRank,
  inferDashStatus,
  parseDashboardHash,
  parseRosterList,
  peekTailBubbles,
  rosterActivityToStatus,
  rosterToSessionEntry,
  sortDashRows,
  togglePinned,
  type DashLive,
} from "./dashboard.ts";
import type { SessionListEntry } from "./startup.ts";

function entry(partial: Partial<SessionListEntry> & { sessionId: string }): SessionListEntry {
  return {
    summary: partial.summary ?? partial.sessionId,
    cwd: partial.cwd ?? null,
    updatedAt: partial.updatedAt ?? null,
    source: partial.source ?? null,
    lastTurnSummary: partial.lastTurnSummary ?? null,
    sessionKind: partial.sessionKind ?? null,
    adminKind: partial.adminKind ?? "build",
    worktreeLabel: partial.worktreeLabel ?? null,
    gitRootDir: partial.gitRootDir ?? null,
    sourceWorkspaceDir: partial.sourceWorkspaceDir ?? null,
    repoName: partial.repoName ?? null,
    ...partial,
  };
}

const now = Date.parse("2026-08-24T00:00:00.000Z");

function live(over: Partial<DashLive> = {}): DashLive {
  return {
    currentSessionId: "live-1",
    turnRunning: false,
    queued: false,
    blocked: false,
    backgroundIds: new Set(),
    loadedIds: new Set(["live-1"]),
    now,
    ...over,
  };
}

test("status rank follows catalog group order", () => {
  assert.deepEqual(DASH_GROUP_ORDER, ["needs", "working", "idle", "inactive", "completed", "failed"]);
  assert.ok(dashStatusRank("needs") < dashStatusRank("working"));
  assert.ok(dashStatusRank("working") < dashStatusRank("idle"));
  assert.ok(dashStatusRank("idle") < dashStatusRank("inactive"));
  assert.ok(dashStatusRank("inactive") < dashStatusRank("completed"));
  assert.ok(dashStatusRank("completed") < dashStatusRank("failed"));
  assert.equal(DASH_GROUP_LABEL.needs, "需要输入");
  assert.equal(DASH_GROUP_LABEL.working, "进行中");
  assert.equal(DASH_GROUP_LABEL.idle, "空闲");
  assert.equal(DASH_GROUP_LABEL.inactive, "未加载");
  assert.equal(DASH_GROUP_LABEL.completed, "已完成");
  assert.equal(DASH_GROUP_LABEL.failed, "失败");
});

test("inferDashStatus uses live flags and disk inactivity", () => {
  const current = entry({ sessionId: "live-1", updatedAt: "2026-08-24T00:00:00.000Z" });
  const disk = entry({ sessionId: "old-1", updatedAt: "2026-08-20T00:00:00.000Z" });
  const recent = entry({ sessionId: "idle-1", updatedAt: "2026-08-23T23:30:00.000Z" });
  assert.equal(inferDashStatus(current, live({ blocked: true })), "needs");
  assert.equal(inferDashStatus(current, live({ turnRunning: true })), "working");
  assert.equal(inferDashStatus(current, live({ queued: true })), "working");
  assert.equal(
    inferDashStatus(disk, live({ currentSessionId: "live-1", backgroundIds: new Set(["old-1"]) })),
    "working",
  );
  assert.equal(
    inferDashStatus(current, live({ backgroundIds: new Set(["live-1"]) })),
    "idle",
  );
  assert.equal(inferDashStatus(current, live()), "idle");
  assert.equal(inferDashStatus(recent, live({ loadedIds: new Set(["live-1", "idle-1"]) })), "idle");
  assert.equal(inferDashStatus(recent, live()), "inactive");
  assert.equal(inferDashStatus(disk, live()), "inactive");
  assert.equal(
    inferDashStatus(entry({ sessionId: "need-1" }), live({ needsIds: new Set(["need-1"]) })),
    "needs",
  );
  assert.equal(inferDashStatus(entry({ sessionId: "d", sessionKind: "completed" }), live()), "completed");
  assert.equal(inferDashStatus(entry({ sessionId: "f", sessionKind: "failed" }), live()), "failed");
});

test("roster activity maps dormant to 未加载", () => {
  assert.equal(rosterActivityToStatus("needs_input", true), "needs");
  assert.equal(rosterActivityToStatus("working", true), "working");
  assert.equal(rosterActivityToStatus("idle", true), "idle");
  assert.equal(rosterActivityToStatus("dormant", false), "inactive");
  assert.equal(rosterActivityToStatus("idle", false), "inactive");
  assert.equal(rosterActivityToStatus("completed", false), "completed");
  assert.equal(rosterActivityToStatus("dead", false), "failed");
  const row = entry({ sessionId: "disk-9", summary: "旧会话" });
  const roster = new Map([["disk-9", { activity: "dormant" as const, resident: false }]]);
  assert.equal(inferDashStatus(row, live({ roster, currentSessionId: null, loadedIds: new Set() })), "inactive");
});

test("parseRosterList unwraps result envelope", () => {
  const rows = parseRosterList({
    result: {
      sessions: [
        {
          sessionId: "sess-abc",
          title: "修登录",
          cwd: "/repo",
          activity: "needs_input",
          lastTurnSummary: "需要你提供账号",
          resident: true,
          lastChangeUnixMs: 1_725_000_000_123,
        },
      ],
    },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.sessionId, "sess-abc");
  assert.equal(rows[0]?.title, "修登录");
  assert.equal(rows[0]?.activity, "needs_input");
  assert.equal(rows[0]?.resident, true);
  const mapped = rosterToSessionEntry(rows[0]!);
  assert.equal(mapped.summary, "修登录");
  assert.equal(mapped.lastTurnSummary, "需要你提供账号");
  const next = applyRosterChanged(rows, {
    upserted: [],
    removed: ["sess-abc"],
  });
  assert.equal(next.length, 0);
});

test("buildDashGroups orders groups and pins first within a group", () => {
  const sessions = [
    entry({ sessionId: "old-1", summary: "old", updatedAt: "2026-08-01T00:00:00.000Z" }),
    entry({ sessionId: "idle-a", summary: "alpha", updatedAt: "2026-08-23T23:40:00.000Z" }),
    entry({ sessionId: "idle-b", summary: "beta", updatedAt: "2026-08-23T23:50:00.000Z" }),
    entry({ sessionId: "live-1", summary: "now", updatedAt: "2026-08-24T00:00:00.000Z" }),
    entry({ sessionId: "done-1", summary: "done", sessionKind: "completed" }),
  ];
  const groups = buildDashGroups({
    sessions,
    live: live({ turnRunning: true, loadedIds: new Set(["live-1", "idle-a", "idle-b"]) }),
    pins: new Set(["idle-a"]),
  });
  assert.deepEqual(
    groups.map((g) => g.status),
    ["working", "idle", "inactive", "completed"],
  );
  assert.equal(groups[0]?.rows[0]?.sessionId, "live-1");
  const idle = groups.find((g) => g.status === "idle");
  assert.equal(idle?.rows[0]?.sessionId, "idle-a");
  assert.equal(DASH_TITLE, "运行中会话");
  assert.equal(DASH_PAGE_TITLE, "会话");
});

test("filter matches title, summary, and id", () => {
  const row = entry({
    sessionId: "abc-99",
    summary: "Fix login",
    lastTurnSummary: "patched oauth",
  });
  assert.equal(dashMatches(row, "login"), true);
  assert.equal(dashMatches(row, "oauth"), true);
  assert.equal(dashMatches(row, "abc-99"), true);
  assert.equal(dashMatches(row, "nope"), false);
  const groups = buildDashGroups({
    sessions: [row, entry({ sessionId: "other", summary: "zzz" })],
    live: live({ currentSessionId: null, loadedIds: new Set() }),
    pins: new Set(),
    query: "oauth",
  });
  assert.equal(groups.flatMap((g) => g.rows).map((r) => r.sessionId).join(), "abc-99");
});

test("toggle pin and sort pinned first", () => {
  let pins = new Set<string>();
  pins = togglePinned(pins, "b");
  assert.equal(pins.has("b"), true);
  pins = togglePinned(pins, "b");
  assert.equal(pins.has("b"), false);
  pins = togglePinned(pins, "b");
  const rows = sortDashRows(
    [
      entry({ sessionId: "a", updatedAt: "2026-08-23T23:50:00.000Z" }),
      entry({ sessionId: "b", updatedAt: "2026-08-23T23:10:00.000Z" }),
    ],
    pins,
    "status",
  );
  assert.equal(rows[0]?.sessionId, "b");
});

test("idle overflow beyond recent 8 / 1h", () => {
  const sessions = Array.from({ length: 12 }, (_, i) =>
    entry({
      sessionId: `idle-${i}`,
      updatedAt: new Date(now - (i + 1) * 60 * 1000).toISOString(),
    }),
  );
  const loadedIds = new Set(sessions.map((s) => s.sessionId));
  const groups = buildDashGroups({
    sessions,
    live: live({ currentSessionId: null, loadedIds }),
    pins: new Set(),
  });
  const idle = groups.find((g) => g.status === "idle");
  assert.ok(idle);
  assert.ok(idle!.overflow > 0);
  const expanded = buildDashGroups({
    sessions,
    live: live({ currentSessionId: null, loadedIds }),
    pins: new Set(),
    idleExpanded: true,
  });
  assert.equal(expanded.find((g) => g.status === "idle")?.overflow, 0);
  assert.equal(expanded.find((g) => g.status === "idle")?.rows.length, 12);
});

test("peek bubbles take conversation tail, not a dump", () => {
  const bubbles = peekTailBubbles(
    [
      { kind: "sys", text: "boot" },
      { kind: "agent", text: "我将写测试", timestamp: Date.parse("2026-08-24T10:15:00") },
      { kind: "user", text: "先从注册开始", timestamp: Date.parse("2026-08-24T10:16:00") },
    ],
    6,
  );
  assert.equal(bubbles.length, 2);
  assert.equal(bubbles[0]?.role, "assistant");
  assert.equal(bubbles[1]?.role, "user");
});

test("hash parse recognizes #/dashboard", () => {
  assert.equal(parseDashboardHash("#/dashboard"), true);
  assert.equal(parseDashboardHash("#/dashboard/"), true);
  assert.equal(parseDashboardHash("#/sessions"), false);
  assert.deepEqual(parseHashRoute("#/dashboard"), { kind: "dashboard" });
  assert.equal(hashForDashboard(), "#/dashboard");
});
