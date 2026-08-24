import { ansiToHtml, highlightCode } from "./highlight.ts";
import type { Json } from "./protocol.ts";

export type ToolFamily =
  | "read"
  | "search"
  | "list"
  | "fetch"
  | "websearch"
  | "memory"
  | "skill"
  | "edit"
  | "exec"
  | "mcp"
  | "other";

const GROUPABLE = new Set<ToolFamily>([
  "read",
  "search",
  "list",
  "fetch",
  "websearch",
  "memory",
  "skill",
]);

const FAMILY_ORDER: ToolFamily[] = [
  "read",
  "skill",
  "search",
  "list",
  "fetch",
  "websearch",
  "memory",
  "edit",
  "exec",
  "mcp",
  "other",
];

const READ_FIRST = 5;
const READ_LAST = 3;
const EXEC_FIRST = 2;
const EXEC_LAST = 3;
const HUNK_CONTEXT = 2;
const DIFF_DP_CAP = 80_000;

function asRecord(value: Json): { [k: string]: Json } | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { [k: string]: Json })
    : null;
}

export function escapePre(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function str(value: Json | undefined): string {
  return typeof value === "string" ? value : "";
}

function titleHasVerb(title: string, verb: string): boolean {
  return new RegExp(`^${verb}(?:\\s|\`|$)`, "i").test(title.trim());
}

export function isGroupableFamily(family: ToolFamily): boolean {
  return GROUPABLE.has(family);
}

export function asToolFamily(value: string): ToolFamily {
  return FAMILY_ORDER.includes(value as ToolFamily) ? (value as ToolFamily) : "other";
}

export function toolFamily(kind: string, title: string, name = "", metaKind = ""): ToolFamily {
  const k = kind.toLowerCase();
  const t = title.toLowerCase();
  const n = name.toLowerCase();
  const mk = metaKind.toLowerCase();
  const blob = `${k} ${t} ${n} ${mk}`;
  if (
    k.includes("exec") ||
    k.includes("bash") ||
    k.includes("shell") ||
    k.includes("terminal") ||
    titleHasVerb(t, "execute") ||
    titleHasVerb(t, "ran")
  ) {
    return "exec";
  }
  if (
    k.includes("edit") ||
    k.includes("write") ||
    k.includes("patch") ||
    n.includes("search_replace") ||
    titleHasVerb(t, "edit") ||
    titleHasVerb(t, "wrote") ||
    titleHasVerb(t, "write")
  ) {
    return "edit";
  }
  if (
    k.includes("use_tool") ||
    n.includes("use_tool") ||
    /\bmcp\b/.test(blob) ||
    (n.includes("__") && !n.includes("/"))
  ) {
    return "mcp";
  }
  if (
    k.includes("grep") ||
    k.includes("glob") ||
    n.includes("grep") ||
    n.includes("glob") ||
    n.includes("grep_files") ||
    n.includes("x_search") ||
    mk === "search" ||
    titleHasVerb(t, "search") ||
    titleHasVerb(t, "grep") ||
    k === "search"
  ) {
    return "search";
  }
  if (k.includes("list") || n.includes("list_dir") || titleHasVerb(t, "list")) {
    return "list";
  }
  if ((blob.includes("web_search") || t.includes("web search")) && !n.includes("x_search")) {
    return "websearch";
  }
  if (blob.includes("web_fetch") || titleHasVerb(t, "fetch") || k.includes("fetch")) {
    return "fetch";
  }
  if (blob.includes("memory")) return "memory";
  if (n.includes("skill") || t.includes("skill") || k.includes("skill")) return "skill";
  if (
    k.includes("read") ||
    n.includes("read") ||
    titleHasVerb(t, "read")
  ) {
    return "read";
  }
  return "other";
}

export function isGenericToolLabel(label: string): boolean {
  const s = label.trim().toLowerCase();
  return !s || s === "tool" || s === "other" || s === "unknown" || s === "工具";
}

/** Prefer a real title/name; ACP Other often arrives as kind/title `"tool"`. */
export function toolDisplayTitle(kind: string, name: string, title: string): string {
  const t = title.trim();
  if (t && !isGenericToolLabel(t)) return t;
  const n = name.trim();
  if (n && !isGenericToolLabel(n)) return n;
  const k = kind.trim();
  if (k && !isGenericToolLabel(k)) return k;
  return "工具";
}

export function shortToolLabel(title: string): string {
  const quoted = /`([^`]+)`/.exec(title);
  const raw =
    quoted?.[1] ??
    title.replace(/^(read|edit|wrote|write|execute|ran|search|list|fetch)\s+/i, "").trim();
  const base = raw.split("/").filter(Boolean).pop() ?? raw;
  return base.length > 48 ? `${base.slice(0, 45)}…` : base;
}

export function toolSummary(family: ToolFamily, count: number, title: string): string {
  const label = shortToolLabel(title);
  if (family === "read") return count > 1 ? `读了 ${count} 个文件` : `读取 ${label}`;
  if (family === "skill") return count > 1 ? `使用了 ${count} 个 skill` : `使用了 skill ${label}`;
  if (family === "search") return count > 1 ? `搜索了 ${count} 个模式` : `搜索 ${label}`;
  if (family === "list") return count > 1 ? `列出 ${count} 个目录` : `列出 ${label}`;
  if (family === "fetch") return count > 1 ? `获取了 ${count} 个网页` : `获取 ${label}`;
  if (family === "websearch") return count > 1 ? `检索了 ${count} 个网站` : `检索 ${label}`;
  if (family === "memory") return count > 1 ? `检索了 ${count} 条记忆` : "检索记忆";
  if (family === "edit") return count > 1 ? `编辑了 ${count} 个文件` : `编辑 ${label}`;
  if (family === "exec") return count > 1 ? `执行了 ${count} 条命令` : `运行 ${label}`;
  if (family === "mcp") return count > 1 ? `调用了 ${count} 个 MCP 工具` : `调用 ${label}`;
  return count > 1 ? `用了 ${count} 个工具` : isGenericToolLabel(label) ? "工具" : label;
}

export function mixedToolSummary(members: { family: string; title: string }[]): string {
  const lastByFamily: { [k in ToolFamily]?: string } = {};
  const counts = Object.fromEntries(FAMILY_ORDER.map((f) => [f, 0])) as Record<ToolFamily, number>;
  for (const member of members) {
    const family = asToolFamily(member.family);
    counts[family] += 1;
    lastByFamily[family] = member.title;
  }
  const parts: string[] = [];
  for (const family of FAMILY_ORDER) {
    const count = counts[family];
    if (!count) continue;
    parts.push(toolSummary(family, count, lastByFamily[family] ?? ""));
  }
  return parts.join(" · ") || "工具";
}

export function membersHtml(members: { family: string; title: string }[]): string {
  const items = members
    .map((m) => `<li>${escapePre(toolSummary(asToolFamily(m.family), 1, m.title))}</li>`)
    .join("");
  return `<ul class="tool-members">${items}</ul>`;
}

export function pathFromUpdate(update: { [k: string]: Json }): string | null {
  const raw = asRecord(update.rawInput ?? update.raw_input ?? null);
  if (raw) {
    for (const key of ["path", "file_path", "filePath", "target_file", "targetFile"]) {
      if (typeof raw[key] === "string" && raw[key]) return String(raw[key]);
    }
  }
  if (typeof update.path === "string" && update.path) return update.path;
  const locs = update.locations;
  if (Array.isArray(locs)) {
    for (const loc of locs) {
      const rec = asRecord(loc);
      if (rec && typeof rec.path === "string" && rec.path) return rec.path;
    }
  }
  return null;
}

function commandFromUpdate(update: { [k: string]: Json }): string | null {
  const raw = asRecord(update.rawInput ?? update.raw_input ?? null);
  if (raw) {
    for (const key of ["command", "cmd", "command_line", "commandLine"]) {
      if (typeof raw[key] === "string" && raw[key]) return String(raw[key]);
    }
  }
  const title = str(update.title);
  const quoted = /`([^`]+)`/.exec(title);
  if (quoted?.[1]) return quoted[1];
  return null;
}

function urlFromUpdate(update: { [k: string]: Json }): string | null {
  const raw = asRecord(update.rawInput ?? update.raw_input ?? null);
  if (raw) {
    for (const key of ["url", "uri", "href"]) {
      if (typeof raw[key] === "string" && raw[key]) return String(raw[key]);
    }
  }
  if (typeof update.url === "string") return update.url;
  return null;
}

function num(value: Json | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rangeFromUpdate(update: { [k: string]: Json }): string | null {
  const raw = asRecord(update.rawInput ?? update.raw_input ?? null);
  if (!raw) return null;
  const start = num(raw.offset) ?? num(raw.start_line) ?? num(raw.startLine);
  const endLine = num(raw.end_line) ?? num(raw.endLine);
  const limit = num(raw.limit);
  if (start != null && endLine != null) return `${start}:${endLine}`;
  if (start != null && limit != null) return `${start}:${start + limit}`;
  if (start != null) return String(start);
  return null;
}

function queryFromUpdate(update: { [k: string]: Json }): string | null {
  const raw = asRecord(update.rawInput ?? update.raw_input ?? null);
  if (raw) {
    for (const key of ["pattern", "query", "q"]) {
      if (typeof raw[key] === "string" && raw[key]) return String(raw[key]);
    }
  }
  return null;
}

function langFromPath(path: string | null): string {
  if (!path) return "";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "ts",
    tsx: "ts",
    js: "js",
    jsx: "js",
    py: "py",
    rs: "rs",
    go: "go",
    css: "css",
    json: "json",
    sh: "sh",
    bash: "sh",
    zsh: "sh",
    md: "md",
    toml: "toml",
  };
  return map[ext] ?? "";
}

export function truncateLines(
  src: string,
  first: number,
  last: number,
): { text: string; omitted: number; total: number } {
  const lines = src.split("\n");
  const total = src === "" ? 0 : lines.length;
  if (total <= first + last + 1) return { text: src, omitted: 0, total };
  const omitted = total - first - last;
  const text = [...lines.slice(0, first), `… ${omitted} 行省略`, ...lines.slice(-last)].join("\n");
  return { text, omitted, total };
}

export type SearchHit = { path: string; line: number; text: string };

export function parseSearchHits(body: string): SearchHit[] {
  const out: SearchHit[] = [];
  for (const line of body.split("\n")) {
    const m = /^(.*?):(\d+)[:\-]\s?(.*)$/.exec(line);
    if (!m) continue;
    out.push({ path: m[1]!, line: Number(m[2]), text: m[3] ?? "" });
  }
  return out;
}

function citationsFrom(update: { [k: string]: Json }, body: string): string[] {
  const raw = update.citations ?? update.sources;
  const out: string[] = [];
  if (Array.isArray(raw)) {
    for (const c of raw) {
      if (typeof c === "string" && /^https?:/i.test(c)) out.push(c);
      const rec = asRecord(c);
      const url = rec && (str(rec.url) || str(rec.uri) || str(rec.href));
      if (url) out.push(url);
    }
  }
  if (!out.length) {
    const re = /\bhttps?:\/\/[^\s)<]+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) out.push(m[0]!.replace(/[),.;]+$/, ""));
  }
  return [...new Set(out)].slice(0, 8);
}

export type DiffLine = {
  kind: "eq" | "del" | "add";
  text: string;
  oldNo: number | null;
  newNo: number | null;
};

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText === "" ? [] : oldText.split("\n");
  const b = newText === "" ? [] : newText.split("\n");
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];
  if (n * m > DIFF_DP_CAP) {
    const out: DiffLine[] = [];
    for (let i = 0; i < n; i += 1) out.push({ kind: "del", text: a[i]!, oldNo: i + 1, newNo: null });
    for (let j = 0; j < m; j += 1) out.push({ kind: "add", text: b[j]!, oldNo: null, newNo: j + 1 });
    return out;
  }
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      dp[i]![j] = a[i - 1] === b[j - 1] ? (dp[i - 1]![j - 1]! + 1) : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push({ kind: "eq", text: a[i - 1]!, oldNo: i, newNo: j });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      out.push({ kind: "del", text: a[i - 1]!, oldNo: i, newNo: null });
      i -= 1;
    } else {
      out.push({ kind: "add", text: b[j - 1]!, oldNo: null, newNo: j });
      j -= 1;
    }
  }
  while (i > 0) {
    out.push({ kind: "del", text: a[i - 1]!, oldNo: i, newNo: null });
    i -= 1;
  }
  while (j > 0) {
    out.push({ kind: "add", text: b[j - 1]!, oldNo: null, newNo: j });
    j -= 1;
  }
  out.reverse();
  return out;
}

type Hunk = { gap: number; lines: DiffLine[] };

export function splitHunks(lines: DiffLine[], context = HUNK_CONTEXT): Hunk[] {
  if (!lines.length) return [];
  const changeAt: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]!.kind !== "eq") changeAt.push(i);
  }
  if (!changeAt.length) {
    return [{ gap: 0, lines }];
  }
  const ranges: { start: number; end: number }[] = [];
  for (const idx of changeAt) {
    const start = Math.max(0, idx - context);
    const end = Math.min(lines.length, idx + context + 1);
    const prev = ranges.at(-1);
    if (prev && start <= prev.end) prev.end = Math.max(prev.end, end);
    else ranges.push({ start, end });
  }
  const hunks: Hunk[] = [];
  let cursor = 0;
  for (const range of ranges) {
    const gap = range.start > cursor ? range.start - cursor : 0;
    hunks.push({ gap, lines: lines.slice(range.start, range.end) });
    cursor = range.end;
  }
  return hunks;
}

export function renderDiff(path: string, oldText: string, newText: string): string {
  const lines = diffLines(oldText, newText);
  const plus = lines.filter((l) => l.kind === "add").length;
  const minus = lines.filter((l) => l.kind === "del").length;
  const hunks = splitHunks(lines);
  const rows: string[] = [];
  for (const hunk of hunks) {
    if (hunk.gap > 0) {
      rows.push(
        `<tr class="diff-gap"><td></td><td>… ${hunk.gap} 行未改</td></tr>`,
      );
    }
    for (const line of hunk.lines) {
      const no = line.kind === "add" ? line.newNo : line.oldNo;
      const prefix = line.kind === "add" ? "+ " : line.kind === "del" ? "- " : "";
      const cls = line.kind === "eq" ? "diff-eq" : line.kind === "del" ? "diff-del" : "diff-add";
      rows.push(
        `<tr class="${cls}"><td>${no ?? ""}</td><td>${prefix}${escapePre(line.text)}</td></tr>`,
      );
    }
  }
  const stat = `<span class="diff-stat">+${plus} −${minus}</span>`;
  return `<div class="diff-block"><div class="diff-path">${escapePre(path)} ${stat}</div><table class="diff-table">${rows.join("")}</table></div>`;
}

export function extractDiff(update: { [k: string]: Json }): {
  path: string;
  oldText: string;
  newText: string;
} | null {
  const walk = (node: Json | undefined): { path: string; oldText: string; newText: string } | null => {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const hit = walk(n);
        if (hit) return hit;
      }
      return null;
    }
    const rec = asRecord(node);
    if (!rec) return null;
    if (rec.type === "diff" || rec.oldText !== undefined || rec.newText !== undefined) {
      return {
        path: typeof rec.path === "string" ? rec.path : "",
        oldText:
          typeof rec.oldText === "string"
            ? rec.oldText
            : typeof rec.old_text === "string"
              ? rec.old_text
              : "",
        newText:
          typeof rec.newText === "string"
            ? rec.newText
            : typeof rec.new_text === "string"
              ? rec.new_text
              : "",
      };
    }
    return walk(rec.content);
  };
  return walk(update.content) ?? walk(update.diff as Json | undefined) ?? diffFromRawInput(update);
}

function diffFromRawInput(update: { [k: string]: Json }): {
  path: string;
  oldText: string;
  newText: string;
} | null {
  const raw = asRecord(update.rawInput ?? update.raw_input ?? null);
  if (!raw) return null;
  const oldText =
    (typeof raw.oldText === "string" && raw.oldText) ||
    (typeof raw.old_text === "string" && raw.old_text) ||
    (typeof raw.old_string === "string" && raw.old_string) ||
    (typeof raw.oldString === "string" && raw.oldString) ||
    "";
  const newText =
    (typeof raw.newText === "string" && raw.newText) ||
    (typeof raw.new_text === "string" && raw.new_text) ||
    (typeof raw.new_string === "string" && raw.new_string) ||
    (typeof raw.newString === "string" && raw.newString) ||
    "";
  if (!oldText && !newText) return null;
  const path =
    (typeof raw.path === "string" && raw.path) ||
    (typeof raw.file_path === "string" && raw.file_path) ||
    (typeof raw.filePath === "string" && raw.filePath) ||
    (typeof raw.target_file === "string" && raw.target_file) ||
    "";
  return { path, oldText, newText };
}

function pathLink(path: string | null): string {
  if (!path) return "";
  return `<a class="tool-path" href="#" data-path="${escapePre(path)}">${escapePre(path)}</a>`;
}

function moreButton(omitted: number, total: number): string {
  if (omitted <= 0) return "";
  return `<button type="button" class="tool-more">显示全部 ${total} 行</button>`;
}

export function formatToolHtml(
  kind: string,
  body: string,
  update: { [k: string]: Json },
  opts: { full?: boolean; args?: string; streaming?: boolean } = {},
): string {
  const title = str(update.title);
  const name = str(update.name);
  const family = toolFamily(kind, title, name);
  const argsHtml =
    family === "skill"
      ? ""
      : formatToolArgsHtml(resolveToolArgs(opts, update, body), Boolean(opts.streaming));
  const diff = extractDiff(update);
  if (diff && (diff.oldText || diff.newText)) {
    return `${argsHtml}${renderDiff(diff.path || pathFromUpdate(update) || "", diff.oldText, diff.newText)}`;
  }
  const path = pathFromUpdate(update);
  if (family === "exec") {
    const cmd = commandFromUpdate(update);
    const cut = opts.full ? { text: body, omitted: 0, total: body.split("\n").length } : truncateLines(body, EXEC_FIRST, EXEC_LAST);
    const head = cmd ? `<div class="tool-cmd">$ ${escapePre(cmd)}</div>` : "";
    return `${argsHtml}${head}<pre class="tool-output">${ansiToHtml(cut.text)}</pre>${moreButton(cut.omitted, cut.total)}`;
  }
  if (family === "skill") {
    const skill = name || shortToolLabel(title);
    return `<div class="tool-skill">使用了 skill ${escapePre(skill)}</div>`;
  }
  if (family === "read") {
    const range = rangeFromUpdate(update);
    const cut = opts.full ? { text: body, omitted: 0, total: body.split("\n").length } : truncateLines(body, READ_FIRST, READ_LAST);
    const lang = langFromPath(path);
    const shown = path && cut.text === path ? "" : highlightCode(cut.text, lang);
    const meta = [pathLink(path), range ? `<span class="tool-range">${escapePre(range)}</span>` : ""]
      .filter(Boolean)
      .join(" ");
    const pre = shown ? `<pre class="tool-output">${shown}</pre>` : "";
    return `${argsHtml}${meta}${pre}${moreButton(cut.omitted, cut.total)}`;
  }
  if (family === "search") {
    const query = queryFromUpdate(update);
    const hits = parseSearchHits(body);
    const q = query ? `<div class="tool-query">${escapePre(query)}</div>` : "";
    if (hits.length) {
      const items = hits
        .slice(0, opts.full ? hits.length : 24)
        .map(
          (h) =>
            `<li><a class="tool-path" href="#" data-path="${escapePre(h.path)}">${escapePre(h.path)}</a><span class="tool-line-no">:${h.line}</span> ${escapePre(h.text)}</li>`,
        )
        .join("");
      return `${argsHtml}${q}<ol class="search-hits">${items}</ol>`;
    }
    return `${argsHtml}${q}${pathLink(path)}<pre class="tool-output">${escapePre(body)}</pre>`;
  }
  if (family === "list") {
    const cut = opts.full ? { text: body, omitted: 0, total: body.split("\n").length } : truncateLines(body, 12, 4);
    return `${argsHtml}${pathLink(path)}<pre class="tool-output tool-tree">${escapePre(cut.text)}</pre>${moreButton(cut.omitted, cut.total)}`;
  }
  if (family === "websearch") {
    const query = queryFromUpdate(update) || title;
    const cites = citationsFrom(update, body);
    const links = cites
      .map((u) => `<li><a href="${escapePre(u)}" target="_blank" rel="noreferrer">${escapePre(u)}</a></li>`)
      .join("");
    const list = links ? `<ul class="tool-cites">${links}</ul>` : "";
    const cut = opts.full ? { text: body, omitted: 0, total: 0 } : truncateLines(body, 8, 0);
    return `${argsHtml}<div class="tool-query">${escapePre(query)}</div>${list}<pre class="tool-output">${escapePre(cut.text)}</pre>`;
  }
  if (family === "fetch") {
    const url = urlFromUpdate(update) || path;
    const href = url && /^https?:/i.test(url) ? `<a href="${escapePre(url)}" target="_blank" rel="noreferrer">${escapePre(url)}</a>` : pathLink(url);
    const cut = opts.full ? { text: body, omitted: 0, total: body.split("\n").length } : truncateLines(body, 8, 3);
    return `${argsHtml}${href}<pre class="tool-output">${escapePre(cut.text)}</pre>${moreButton(cut.omitted, cut.total)}`;
  }
  if (family === "mcp") {
    const tool = name || shortToolLabel(title);
    const badge = `<span class="tool-badge">MCP</span> ${escapePre(tool)}`;
    const cut = opts.full ? { text: body, omitted: 0, total: body.split("\n").length } : truncateLines(body, 10, 3);
    return `${argsHtml}<div class="tool-mcp">${badge}</div><pre class="tool-output">${escapePre(cut.text)}</pre>${moreButton(cut.omitted, cut.total)}`;
  }
  const linked = pathLink(path);
  const cut = opts.full ? { text: body, omitted: 0, total: body.split("\n").length } : truncateLines(body, 10, 3);
  const echo =
    isGenericToolLabel(body) ||
    body === title ||
    body === name ||
    body === kind ||
    Boolean(argsHtml && looksLikeJson(body));
  const output = body && !echo ? `<pre class="tool-output">${escapePre(cut.text)}</pre>${moreButton(cut.omitted, cut.total)}` : "";
  return `${argsHtml}${linked}${output}`;
}


export function toolStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "pending_user" || s === "waiting" || s === "waiting_permission" || s === "blocked") {
    return "等待你批准";
  }
  if (s === "pending" || s === "in_progress" || s === "running") return "运行中";
  if (s === "completed" || s === "complete" || s === "done" || s === "ok" || s === "success") return "完成";
  if (s === "failed" || s === "error") return "失败";
  if (s === "cancelled" || s === "canceled") return "已取消";
  return status;
}

export function isBusyToolStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "pending" || s === "in_progress" || s === "running";
}

export function isBlockedToolStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "pending_user" || s === "waiting" || s === "waiting_permission" || s === "blocked";
}

export function isDoneToolStatus(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s === "completed" ||
    s === "complete" ||
    s === "done" ||
    s === "ok" ||
    s === "success" ||
    s === "failed" ||
    s === "error" ||
    s === "cancelled" ||
    s === "canceled"
  );
}

export function formatToolElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  const secs = ms / 1000;
  if (secs < 10) return `${secs.toFixed(1)}s`;
  return `${Math.round(secs)}s`;
}

export function prettyToolArgs(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}

export function mergeArgStream(prev: string, chunk: string): string {
  if (!chunk) return prev;
  if (!prev) return chunk;
  if (prev.trim().startsWith("{") && chunk.trim().startsWith("{")) {
    try {
      const a = JSON.parse(prev);
      const b = JSON.parse(chunk);
      if (a && typeof a === "object" && b && typeof b === "object") {
        return JSON.stringify({ ...a, ...b });
      }
    } catch {
      /* append */
    }
  }
  return prev + chunk;
}

export function argChunkFromUpdate(update: { [k: string]: Json }): string {
  if (typeof update.delta === "string") return update.delta;
  if (typeof update.rawInputDelta === "string") return update.rawInputDelta;
  if (typeof update.raw_input_delta === "string") return update.raw_input_delta;
  if (typeof update.chunk === "string") return update.chunk;
  const rec = asRecord(update.content ?? null);
  if (rec) {
    if (typeof rec.text === "string" && (rec.type === "raw_input" || rec.type === "input")) return rec.text;
    if (typeof rec.json === "string") return rec.json;
  }
  return argSnapshot(update);
}

function argSnapshot(update: { [k: string]: Json }): string {
  for (const key of ["rawInput", "raw_input", "arguments", "input", "params"] as const) {
    const raw = update[key];
    if (typeof raw === "string" && raw.trim()) return raw;
    if (raw && typeof raw === "object") return JSON.stringify(raw);
  }
  return "";
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

function resolveToolArgs(
  opts: { args?: string },
  update: { [k: string]: Json },
  body: string,
): string {
  const fromOpts = (opts.args ?? "").trim();
  if (fromOpts) return fromOpts;
  const snap = argSnapshot(update);
  if (snap) return snap;
  if (looksLikeJson(body)) return body;
  return "";
}

export function formatToolArgsHtml(args: string, streaming: boolean): string {
  if (!args) return "";
  const text = streaming ? `${args}|` : prettyToolArgs(args);
  return `<div class="tool-args-block"><div class="tool-args-label">参数</div><pre class="tool-args">${escapePre(text)}</pre></div>`;
}

export function elapsedFromUpdate(update: { [k: string]: Json }): number | null {
  const raw = update.elapsed_ms ?? update.elapsedMs ?? update.duration_ms ?? update.durationMs ?? update.duration;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 0 && raw < 100 ? raw * 1000 : raw;
  }
  return null;
}

export type Phase = { title: string; state: string };

export function renderPhases(phases: Phase[]): string {
  if (!phases.length) return "";
  const items = phases
    .map((p) => {
      const mark = p.state === "done" || p.state === "completed" ? "✓" : p.state === "active" || p.state === "running" ? "●" : "○";
      return `<li data-state="${escapePre(p.state)}">${mark} ${escapePre(p.title)}</li>`;
    })
    .join("");
  return `<ol class="phase-trail">${items}</ol>`;
}

function parsePhases(raw: Json | undefined): Phase[] {
  if (!Array.isArray(raw)) return [];
  const out: Phase[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const title = str(rec.title) || str(rec.name) || str(rec.phase) || str(rec.id);
    if (!title) continue;
    const state = str(rec.state) || str(rec.status) || "";
    out.push({ title, state });
  }
  return out;
}

export function workflowSnapshot(
  update: { [k: string]: Json },
  contentText: string,
): {
  runId: string;
  name: string;
  status: string;
  objective: string;
  phases: Phase[];
  html: string;
  title: string;
} {
  const runId =
    str(update.runId) ||
    str(update.run_id) ||
    str(update.workflowRunId) ||
    str(update.workflow_run_id) ||
    str(update.id);
  const name = str(update.name) || str(update.title) || "workflow";
  const status = str(update.status);
  const objective = str(update.objective) || contentText;
  const phases = parsePhases(update.phases ?? update.roster);
  const current = str(update.currentPhase) || str(update.current_phase);
  if (current && !phases.some((p) => p.title === current)) {
    phases.push({ title: current, state: "active" });
  }
  const html = renderPhases(phases);
  const title = status ? `Workflow ${name} · ${status}` : `Workflow ${name}`;
  return { runId, name, status, objective, phases, html, title };
}

export function subagentSnapshot(
  update: { [k: string]: Json },
  kind: string,
  contentText: string,
): {
  childSessionId: string;
  description: string;
  subType: string;
  activity: string;
  status: string;
  title: string;
  workflowRunId: string;
} {
  const childSessionId =
    str(update.childSessionId) ||
    str(update.child_session_id) ||
    str(update.subagentId) ||
    str(update.subagent_id) ||
    str(update.sessionId);
  const description =
    str(update.description) || str(update.title) || contentText || kind.replace(/_/g, " ");
  const subType =
    str(update.subagentType) || str(update.subagent_type) || str(update.type) || str(update.agentType);
  const activity =
    str(update.activity) ||
    str(update.activityLabel) ||
    str(update.activity_label) ||
    str(update.label);
  let status = str(update.status);
  if (!status) {
    if (kind.includes("fail")) status = "failed";
    else if (kind.includes("cancel")) status = "cancelled";
    else if (kind.includes("finish") || kind.includes("complete")) status = "completed";
    else if (kind.includes("progress") || kind.includes("spawn")) status = "running";
  }
  const workflowRunId = str(update.workflowRunId) || str(update.workflow_run_id);
  return {
    childSessionId,
    description,
    subType,
    activity,
    status,
    title: description,
    workflowRunId,
  };
}
