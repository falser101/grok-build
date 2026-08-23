import assert from "node:assert/strict";
import test from "node:test";
import {
  diffLines,
  formatToolHtml,
  parseSearchHits,
  prettyToolArgs,
  renderDiff,
  splitHunks,
  toolFamily,
  toolStatusLabel,
  toolSummary,
  formatToolElapsed,
  mergeArgStream,
  truncateLines,
  workflowSnapshot,
} from "./tool_blocks.ts";

test("toolFamily splits search list fetch from read and keeps edit/exec out of groups", () => {
  assert.equal(toolFamily("read", "Read `a.ts`"), "read");
  assert.equal(toolFamily("read", "Grep `TODO`"), "search");
  assert.equal(toolFamily("search", "pattern"), "search");
  assert.equal(toolFamily("read", "List `web`"), "list");
  assert.equal(toolFamily("execute", "Execute `ls`"), "exec");
  assert.equal(toolFamily("edit", "Edit `a.ts`"), "edit");
  assert.equal(toolFamily("read", "Web Search cats"), "websearch");
  assert.equal(toolFamily("", "use_tool", "linear__save_issue"), "mcp");
});

test("toolSummary uses chinese nouns per family", () => {
  assert.match(toolSummary("read", 2, "a.ts"), /读了 2/);
  assert.match(toolSummary("search", 2, "TODO"), /搜索了 2/);
  assert.match(toolSummary("exec", 1, "Execute `ls`"), /运行 ls/);
});

test("truncateLines keeps head and tail", () => {
  const src = Array.from({ length: 10 }, (_, i) => `L${i}`).join("\n");
  const cut = truncateLines(src, 2, 3);
  assert.equal(cut.omitted, 5);
  assert.match(cut.text, /^L0\nL1\n… 5 行省略\nL7\nL8\nL9$/);
});

test("diffLines then splitHunks inserts an unchanged gap", () => {
  const oldText = ["keep-a", "x", "keep-b", "old", "keep-c"].join("\n");
  const newText = ["keep-a", "x", "keep-b", "new", "keep-c"].join("\n");
  const lines = diffLines(oldText, newText);
  const hunks = splitHunks(lines, 1);
  assert.ok(hunks.some((h) => h.lines.some((l) => l.text === "old" && l.kind === "del")));
  assert.ok(hunks.some((h) => h.lines.some((l) => l.text === "new" && l.kind === "add")));
  const html = renderDiff("a.ts", oldText, newText);
  assert.match(html, /diff-gap/);
  assert.match(html, /行未改/);
  assert.match(html, /\+1 −1/);
});

test("parseSearchHits reads path:line:text", () => {
  const hits = parseSearchHits("web/src/a.ts:12: hello\nweb/src/b.ts:3- world");
  assert.equal(hits.length, 2);
  assert.equal(hits[0]?.path, "web/src/a.ts");
  assert.equal(hits[0]?.line, 12);
});

test("formatToolHtml execute truncates and keeps ansi", () => {
  const body = `${"line\n".repeat(8)}\x1b[31merr\x1b[0m`;
  const html = formatToolHtml("execute", body, {
    kind: "execute",
    title: "Execute `ls`",
    rawInput: { command: "ls" },
  });
  assert.match(html, /tool-cmd/);
  assert.match(html, /\$ ls/);
  assert.match(html, /行省略/);
  assert.match(html, /ansi-red/);
  assert.match(html, /tool-more/);
});

test("formatToolHtml read uses path link and range", () => {
  const html = formatToolHtml("read", "alpha", {
    kind: "read",
    title: "Read `a.ts`",
    rawInput: { path: "src/a.ts", offset: 10, limit: 20 },
  });
  assert.match(html, /tool-path/);
  assert.match(html, /src\/a.ts/);
  assert.match(html, /10:30/);
});

test("workflowSnapshot builds a phase trail", () => {
  const snap = workflowSnapshot(
    {
      runId: "w1",
      name: "review",
      status: "running",
      phases: [
        { title: "gather", state: "done" },
        { title: "review", state: "active" },
      ],
    },
    "look at diffs",
  );
  assert.equal(snap.runId, "w1");
  assert.match(snap.html, /phase-trail/);
  assert.match(snap.html, /gather/);
  assert.match(snap.title, /review/);
});

test("unknown search kind and glob use search family", () => {
  assert.equal(toolFamily("weird", "look up", "glob"), "search");
  assert.equal(toolFamily("", "files", "grep_files"), "search");
  assert.equal(toolFamily("other", "q", "x_search"), "search");
  assert.equal(toolFamily("custom", "q", "foo", "search"), "search");
});

test("skill summary is 使用了 skill", () => {
  assert.equal(toolSummary("skill", 1, "deploy"), "使用了 skill deploy");
  const html = formatToolHtml("skill", "", { name: "deploy", title: "skill deploy" });
  assert.match(html, /使用了 skill deploy/);
});

test("pending_user label and pretty args", () => {
  assert.equal(toolStatusLabel("pending_user"), "等待你批准");
  assert.equal(formatToolElapsed(1200), "1.2s");
  assert.equal(prettyToolArgs('{"a":1}'), '{\n  "a": 1\n}');
  assert.equal(mergeArgStream('{"a":1}', '{"b":2}'), '{"a":1,"b":2}');
});
