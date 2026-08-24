import type { Json } from "./protocol";
import type { SessionListEntry } from "./startup";

function asRecord(value: Json): { [k: string]: Json } | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { [k: string]: Json })
    : null;
}

export function buildSessionRenameParams(input: {
  sessionId: string;
  title: string;
  cwd: string | null;
  kind: "build" | "chat";
  resetToAuto?: boolean;
}): Json {
  const params: { [k: string]: Json } = {
    sessionId: input.sessionId,
    title: input.resetToAuto ? "" : input.title,
    kind: input.kind,
    resetToAuto: Boolean(input.resetToAuto),
  };
  if (input.cwd) params.cwd = input.cwd;
  return params;
}

export function buildSessionDeleteParams(input: {
  sessionId: string;
  cwd: string | null;
  kind: "build" | "chat";
}): Json {
  const params: { [k: string]: Json } = {
    sessionId: input.sessionId,
    kind: input.kind,
  };
  if (input.cwd) params.cwd = input.cwd;
  return params;
}

export function buildSessionForkParams(input: {
  sourceSessionId: string;
  sourceCwd: string;
  newCwd: string;
}): Json {
  return {
    sourceSessionId: input.sourceSessionId,
    sourceCwd: input.sourceCwd,
    newCwd: input.newCwd,
    sessionKind: "fork",
  };
}

export function parseForkNewSessionId(payload: Json): string | null {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload);
  const id =
    (typeof inner?.newSessionId === "string" && inner.newSessionId) ||
    (typeof inner?.new_session_id === "string" && inner.new_session_id) ||
    (typeof inner?.sessionId === "string" && inner.sessionId) ||
    null;
  return id;
}

export function buildSessionInfoParams(sessionId: string): Json {
  return { sessionId };
}

export function buildSessionCloseParams(sessionId: string): Json {
  return { sessionId };
}

export function buildSessionSearchParams(input: {
  query: string;
  includeContent?: boolean;
}): Json {
  return {
    query: input.query,
    limit: 40,
    offset: 0,
    includeContent: input.includeContent ?? true,
  };
}

export function parseSearchHits(payload: Json): {
  sessionId: string;
  cwd: string | null;
  summary: string;
  snippet: string | null;
}[] {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload);
  const rows = inner?.results;
  if (!Array.isArray(rows)) return [];
  const out: {
    sessionId: string;
    cwd: string | null;
    summary: string;
    snippet: string | null;
  }[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    const sessionId =
      (typeof r?.sessionId === "string" && r.sessionId) ||
      (typeof r?.session_id === "string" && r.session_id) ||
      null;
    if (!sessionId) continue;
    out.push({
      sessionId,
      cwd: typeof r?.cwd === "string" && r.cwd ? r.cwd : null,
      summary:
        (typeof r?.summary === "string" && r.summary) ||
        (typeof r?.title === "string" && r.title) ||
        sessionId,
      snippet: typeof r?.snippet === "string" ? r.snippet : null,
    });
  }
  return out;
}

export function buildRewindPointsParams(sessionId: string): Json {
  return { sessionId };
}

export function parseRewindPoints(payload: Json): {
  promptIndex: number;
  preview: string;
}[] {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload);
  const rows = inner?.rewindPoints ?? inner?.rewind_points;
  if (!Array.isArray(rows)) return [];
  const out: { promptIndex: number; preview: string }[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    const idx =
      typeof r?.promptIndex === "number"
        ? r.promptIndex
        : typeof r?.prompt_index === "number"
          ? r.prompt_index
          : null;
    if (idx === null) continue;
    const preview =
      (typeof r?.promptPreview === "string" && r.promptPreview) ||
      (typeof r?.prompt_preview === "string" && r.prompt_preview) ||
      `#${idx}`;
    out.push({ promptIndex: idx, preview });
  }
  return out;
}

export function lastRewindPoint<T extends { promptIndex: number }>(points: T[]): T | null {
  if (!points.length) return null;
  return points.reduce((best, row) => (row.promptIndex >= best.promptIndex ? row : best));
}

export function buildRewindExecuteParams(input: {
  sessionId: string;
  targetPromptIndex: number;
}): Json {
  return {
    sessionId: input.sessionId,
    targetPromptIndex: input.targetPromptIndex,
    force: true,
  };
}

export function buildCompactParams(sessionId: string, userContext?: string): Json {
  const params: { [k: string]: Json } = { sessionId };
  if (userContext) params.userContext = userContext;
  return params;
}

export function buildRecapParams(sessionId: string, auto: boolean): Json {
  return { sessionId, auto };
}

export function buildShareParams(sessionId: string): Json {
  return { sessionId };
}

export function parseShareUrl(payload: Json): string | null {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload) ?? rec;
  if (!inner) return null;
  const url =
    (typeof inner.url === "string" && inner.url) ||
    (typeof inner.shareUrl === "string" && inner.shareUrl) ||
    (typeof inner.share_url === "string" && inner.share_url) ||
    null;
  return url;
}

function asNum(value: Json | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickNum(bag: { [k: string]: Json } | null, keys: string[]): number | null {
  if (!bag) return null;
  for (const key of keys) {
    const n = asNum(bag[key]);
    if (n != null) return n;
  }
  return null;
}

function pickStr(bag: { [k: string]: Json } | null, keys: string[]): string | null {
  if (!bag) return null;
  for (const key of keys) {
    const v = bag[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

export type ContextSlice = {
  key: string;
  label: string;
  tokens: number;
};

export type ContextCategory = {
  label: string;
  tokens: number;
  detail: string | null;
};

export type ContextBreakdown = {
  used: number | null;
  total: number | null;
  percent: number | null;
  free: number | null;
  autoCompactAt: number | null;
  turns: number | null;
  messageCount: number | null;
  slices: ContextSlice[];
  categories: ContextCategory[];
  sessionId: string | null;
  cwd: string | null;
  model: string | null;
};

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

/** Readable /context sheet — stacked bar + rows, not a pie. */
export function parseContextBreakdown(payload: Json): ContextBreakdown {
  const rec = asRecord(payload);
  const inner = asRecord((rec?.result ?? payload) as Json) ?? rec;
  const data = asRecord(inner?.data ?? null) ?? inner;
  const ctx = asRecord(data?.context ?? null) ?? asRecord(inner?.context ?? null) ?? data;
  const used = pickNum(ctx, ["used", "tokens", "usedTokens", "used_tokens"]);
  const total = pickNum(ctx, ["total", "contextWindow", "context_window", "limit"]);
  let percent = pickNum(ctx, ["usagePct", "usage_pct", "usedPercent", "used_percent"]);
  if (percent == null && used != null && total && total > 0) percent = (used / total) * 100;
  const free = pickNum(ctx, ["freeTokens", "free_tokens"]);
  const autoCompactAt = pickNum(ctx, [
    "autoCompactThresholdPercent",
    "auto_compact_threshold_percent",
  ]);
  const system = pickNum(ctx, ["systemPromptTokens", "system_prompt_tokens"]) ?? 0;
  const messages = pickNum(ctx, ["messageTokens", "message_tokens"]) ?? 0;
  const tools = pickNum(ctx, ["toolDefinitionsTokens", "tool_definitions_tokens"]) ?? 0;
  const slices: ContextSlice[] = [];
  if (messages > 0) slices.push({ key: "messages", label: "对话", tokens: messages });
  if (system > 0) slices.push({ key: "system", label: "系统说明", tokens: system });
  if (tools > 0) slices.push({ key: "tools", label: "工具定义", tokens: tools });
  const accounted = slices.reduce((sum, row) => sum + row.tokens, 0);
  if (used != null && used > accounted) {
    slices.push({ key: "other", label: "其它", tokens: used - accounted });
  } else if (!slices.length && used != null && used > 0) {
    slices.push({ key: "used", label: "已用", tokens: used });
  }
  const freeTokens =
    free != null ? free : total != null && used != null ? Math.max(0, total - used) : null;
  if (freeTokens != null && freeTokens > 0) {
    slices.push({ key: "free", label: "还能用", tokens: freeTokens });
  }
  const categories: ContextCategory[] = [];
  const rows = ctx?.usageCategories ?? ctx?.usage_categories;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const r = asRecord(row);
      if (!r) continue;
      const label = pickStr(r, ["label", "name"]);
      if (!label) continue;
      categories.push({
        label,
        tokens: pickNum(r, ["tokens"]) ?? 0,
        detail: pickStr(r, ["detail"]),
      });
    }
  }
  return {
    used,
    total,
    percent,
    free: freeTokens,
    autoCompactAt,
    turns: pickNum(data, ["turns", "turnCount", "turn_count"]),
    messageCount: pickNum(ctx, ["messageCount", "message_count"]),
    slices,
    categories,
    sessionId: pickStr(inner, ["sessionId", "session_id"]),
    cwd: pickStr(inner, ["cwd"]),
    model: pickStr(data, ["modelDisplayName", "model_display_name", "model"]),
  };
}

export function parseSessionInfoFields(payload: Json): { label: string; value: string }[] {
  const rec = asRecord(payload);
  const inner = asRecord((rec?.result ?? payload) as Json) ?? rec;
  const data = asRecord(inner?.data ?? null) ?? inner;
  const ctx = asRecord(data?.context ?? null);
  const fields: { label: string; value: string }[] = [];
  const id = pickStr(inner, ["sessionId", "session_id"]);
  const cwd = pickStr(inner, ["cwd"]);
  const model = pickStr(data, ["modelDisplayName", "model_display_name", "model"]);
  const turns = pickNum(data, ["turns"]);
  if (id) fields.push({ label: "会话", value: id });
  if (cwd) fields.push({ label: "工作目录", value: cwd });
  if (model) fields.push({ label: "模型", value: model });
  if (turns != null) fields.push({ label: "回合", value: String(turns) });
  if (ctx) {
    const used = ctx.usagePct ?? ctx.usage_pct ?? ctx.usedPercent ?? ctx.used_percent ?? ctx.used ?? ctx.tokens;
    const total = ctx.total ?? ctx.contextWindow ?? ctx.context_window;
    if (used !== undefined) {
      fields.push({
        label: "用量",
        value: total !== undefined ? `${String(used)} / ${String(total)}` : String(used),
      });
    }
  }
  return fields;
}

export function formatSessionInfo(payload: Json): string {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload) ?? rec;
  if (!inner) return "";
  const data = asRecord(inner.data) ?? inner;
  const ctx = asRecord(data.context);
  const lines = [
    `id: ${typeof inner.sessionId === "string" ? inner.sessionId : inner.session_id ?? ""}`,
    `cwd: ${typeof inner.cwd === "string" ? inner.cwd : ""}`,
    `model: ${data.modelDisplayName ?? data.model_display_name ?? data.model ?? ""}`,
    `turns: ${data.turns ?? ""}`,
  ];
  if (ctx) {
    const used = ctx.usagePct ?? ctx.usage_pct ?? ctx.usedPercent ?? ctx.used_percent ?? ctx.used ?? ctx.tokens;
    const total = ctx.total ?? ctx.contextWindow ?? ctx.context_window;
    if (used !== undefined) {
      lines.push(total !== undefined ? `context: ${String(used)} / ${String(total)}` : `context: ${String(used)}`);
    }
  }
  return lines.filter((l) => !l.endsWith(": ")).join("\n");
}

export function buildWorktreeSyncParams(input: {
  sourceWorktreePath: string;
  newSessionId: string;
  label?: string;
  gitRef?: string;
}): Json {
  const params: { [k: string]: Json } = {
    source_worktree_path: input.sourceWorktreePath,
    new_session_id: input.newSessionId,
  };
  if (input.label) params.label = input.label;
  if (input.gitRef) params.git_ref = input.gitRef;
  return params;
}

export function buildResumeInWorktreeParams(input: {
  sessionId: string;
  sourceCwd: string;
}): Json {
  return {
    sessionId: input.sessionId,
    sourceCwd: input.sourceCwd,
  };
}

export function buildWorktreeListParams(repo?: string): Json {
  return repo ? { repo, includeAll: true } : { includeAll: true };
}

export function parseWorktreePath(payload: Json): string | null {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload) ?? rec;
  if (!inner) return null;
  if (typeof inner.worktreePath === "string") return inner.worktreePath;
  if (typeof inner.worktree_path === "string") return inner.worktree_path;
  const creating = asRecord(inner.Creating ?? inner.creating ?? null);
  if (creating && typeof creating.worktreePath === "string") return creating.worktreePath;
  if (creating && typeof creating.worktree_path === "string") return creating.worktree_path;
  return null;
}

/** `x.ai/git/worktree/resume_session` — load this id in the new copy. */
export function parseResumeWorktreeResult(payload: Json): {
  sessionId: string | null;
  cwd: string | null;
  worktreePath: string | null;
} {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload) ?? rec;
  if (!inner) return { sessionId: null, cwd: null, worktreePath: null };
  const sessionId =
    (typeof inner.sessionId === "string" && inner.sessionId) ||
    (typeof inner.session_id === "string" && inner.session_id) ||
    null;
  const cwd =
    (typeof inner.effectiveCwd === "string" && inner.effectiveCwd) ||
    (typeof inner.effective_cwd === "string" && inner.effective_cwd) ||
    null;
  const worktreePath = parseWorktreePath(inner);
  return { sessionId, cwd: cwd || worktreePath, worktreePath };
}

export function deepLinkSessionId(search: string): string | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const id = new URLSearchParams(raw).get("session");
  return id && id.trim() ? id.trim() : null;
}

export const SESSION_CACHE_KEY = "grok-web.session-cache";
const SESSION_CACHE_MAX = 80;

export type SessionCache = {
  lastId: string | null;
  sessions: SessionListEntry[];
};

export function readSessionCache(storage: Pick<Storage, "getItem">): SessionCache | null {
  try {
    const raw = storage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as { lastId?: unknown; sessions?: unknown };
    if (!Array.isArray(rec.sessions)) return null;
    const sessions = rec.sessions.filter(
      (row): row is SessionListEntry =>
        Boolean(row && typeof row === "object" && typeof (row as SessionListEntry).sessionId === "string"),
    );
    return {
      lastId: typeof rec.lastId === "string" && rec.lastId ? rec.lastId : null,
      sessions: sessions.slice(0, SESSION_CACHE_MAX),
    };
  } catch {
    return null;
  }
}

export function writeSessionCache(
  storage: Pick<Storage, "setItem">,
  cache: SessionCache,
): void {
  const payload: SessionCache = {
    lastId: cache.lastId,
    sessions: cache.sessions.slice(0, SESSION_CACHE_MAX),
  };
  storage.setItem(SESSION_CACHE_KEY, JSON.stringify(payload));
}

/** Fields needed to bucket sessions under one workspace (git root, else cwd). */
export type WorkspaceSession = {
  sessionId: string;
  cwd: string | null;
  gitRootDir?: string | null;
  sourceWorkspaceDir?: string | null;
  repoName?: string | null;
  updatedAt?: string | null;
};

export const UNGROUPED_WORKSPACE_KEY = "__none__";

export function workspaceGroupKey(entry: WorkspaceSession): string {
  const raw =
    (entry.sourceWorkspaceDir && entry.sourceWorkspaceDir.trim()) ||
    (entry.gitRootDir && entry.gitRootDir.trim()) ||
    (entry.cwd && entry.cwd.trim()) ||
    "";
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || UNGROUPED_WORKSPACE_KEY;
}

export function workspaceGroupLabel(entry: WorkspaceSession): string {
  const named = entry.repoName?.trim();
  if (named) return named;
  const key = workspaceGroupKey(entry);
  if (key === UNGROUPED_WORKSPACE_KEY) return "其它";
  const parts = key.split("/").filter(Boolean);
  return parts[parts.length - 1] || key;
}

export function groupSessionsByWorkspace<T extends WorkspaceSession>(
  sessions: T[],
): { key: string; label: string; sessions: T[] }[] {
  const map = new Map<string, { label: string; sessions: T[] }>();
  for (const s of sessions) {
    const key = workspaceGroupKey(s);
    let g = map.get(key);
    if (!g) {
      g = { label: workspaceGroupLabel(s), sessions: [] };
      map.set(key, g);
    }
    g.sessions.push(s);
  }
  const groups = [...map.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    sessions: g.sessions.slice().sort((a, b) =>
      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    ),
  }));
  groups.sort((a, b) => {
    const maxA = a.sessions.reduce(
      (m, s) => ((s.updatedAt ?? "") > m ? (s.updatedAt ?? "") : m),
      "",
    );
    const maxB = b.sessions.reduce(
      (m, s) => ((s.updatedAt ?? "") > m ? (s.updatedAt ?? "") : m),
      "",
    );
    if (maxA !== maxB) return maxB.localeCompare(maxA);
    return a.label.localeCompare(b.label);
  });
  return groups;
}

/** TUI `FetchSessionList` page size — picker loads at most this many per cwd. */
export const PICKER_GROUP_LIMIT = 30;

/** TUI `parse_session_picker_entries`: drop Build rows older than this. */
export const PICKER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isChatPickerRow(entry: SessionListEntry): boolean {
  return entry.adminKind === "chat" || entry.source === "conversation";
}

/** TUI default source filter is Grok: Claude/Codex/Cursor stay off the list. */
export function isForeignPickerSource(source: string | null | undefined): boolean {
  const s = (source ?? "").trim().toLowerCase();
  return s === "claude" || s === "codex" || s === "cursor";
}

function isHiddenPickerSession(entry: SessionListEntry): boolean {
  if (entry.hidden) return true;
  const kind = (entry.sessionKind ?? "").trim().toLowerCase();
  return kind.startsWith("subagent");
}

function parsePickerTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Date.parse(raw);
  if (Number.isFinite(n)) return n;
  const asNum = Number(raw);
  if (!Number.isFinite(asNum)) return null;
  return asNum < 1e12 ? asNum * 1000 : asNum;
}

/**
 * Display title the TUI picker would use before dropping empty Build rows.
 * `firstPrompt` is the wire fallback when `summary` is blank.
 */
export function pickerDisplayTitle(entry: SessionListEntry): string {
  const summary = entry.summary.trim();
  if (summary && summary !== entry.sessionId) return summary;
  const fp = (entry.firstPrompt ?? "").trim();
  if (!fp) return "";
  const line = fp.split(/\r?\n/).find((l) => l.trim());
  return (line ?? "").trim();
}

/**
 * Same keep/drop rules as TUI `parse_session_picker_entries` + default Grok
 * source filter. Agent already hides `session_kind` subagent rows; this is
 * the client-side match so Web counts equal TUI in one working directory.
 */
export function pickerSessionVisible(entry: SessionListEntry, now = Date.now()): boolean {
  if (isHiddenPickerSession(entry)) return false;
  if (isForeignPickerSource(entry.source)) return false;
  const chat = isChatPickerRow(entry);
  const updated = parsePickerTime(entry.updatedAt);
  if (!chat) {
    if (updated == null) return false;
    if (now - updated > PICKER_MAX_AGE_MS) return false;
  }
  const title = pickerDisplayTitle(entry);
  if (title) return true;
  return chat;
}

/**
 * Filter a global `x.ai/session/list` into the rows TUI `/resume` would show,
 * grouped later by workspace. Each workspace is capped at
 * [`PICKER_GROUP_LIMIT`] (TUI fetches 30 for that cwd). `keepIds` stay even
 * when they would otherwise be dropped (the open session).
 */
export function selectVisiblePickerSessions(
  entries: SessionListEntry[],
  opts?: { now?: number; keepIds?: Iterable<string> },
): SessionListEntry[] {
  const now = opts?.now ?? Date.now();
  const keep = new Set(opts?.keepIds ?? []);
  const visible = entries.filter((e) => keep.has(e.sessionId) || pickerSessionVisible(e, now));
  const groups = new Map<string, SessionListEntry[]>();
  const order: string[] = [];
  for (const entry of visible) {
    const key = workspaceGroupKey(entry);
    let rows = groups.get(key);
    if (!rows) {
      rows = [];
      groups.set(key, rows);
      order.push(key);
    }
    rows.push(entry);
  }
  const out: SessionListEntry[] = [];
  for (const key of order) {
    const rows = groups.get(key);
    if (!rows) continue;
    rows.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    const top = rows.slice(0, PICKER_GROUP_LIMIT);
    const topIds = new Set(top.map((e) => e.sessionId));
    for (const entry of rows) {
      if (keep.has(entry.sessionId) && !topIds.has(entry.sessionId)) top.push(entry);
    }
    out.push(...top);
  }
  return out;
}
