import type { Json } from "./protocol";
import { asRecord, type SessionListEntry } from "./startup";

export const DASH_TITLE = "运行中会话";
export const DASH_PAGE_TITLE = "会话";
export const DASH_PIN_KEY = "grok-web.dashboard-pins";
export const DASH_COLLAPSE_KEY = "grok-web.dashboard-collapsed";
export const DASH_IDLE_CAP = 8;
export const DASH_RECENT_MS = 60 * 60 * 1000;

export type DashStatus = "needs" | "working" | "idle" | "inactive" | "completed" | "failed";

export const DASH_GROUP_ORDER: DashStatus[] = [
  "needs",
  "working",
  "idle",
  "inactive",
  "completed",
  "failed",
];

export const DASH_GROUP_LABEL: Record<DashStatus, string> = {
  needs: "需要输入",
  working: "进行中",
  idle: "空闲",
  inactive: "未加载",
  completed: "已完成",
  failed: "失败",
};

export const DASH_STATUS_PHRASE: Record<DashStatus, string> = {
  needs: "需要输入",
  working: "正在进行中",
  idle: "空闲",
  inactive: "未加载",
  completed: "已完成",
  failed: "失败",
};

export type RosterActivity = "working" | "idle" | "needs_input" | "dormant" | "completed" | "dead";

export type RosterEntry = {
  sessionId: string;
  title: string | null;
  cwd: string | null;
  lastTurnSummary: string | null;
  activity: RosterActivity;
  resident: boolean;
  lastChangeUnixMs: number | null;
  yolo: boolean;
};

export type RosterHint = {
  activity: RosterActivity;
  resident: boolean;
};

export type DashLive = {
  currentSessionId: string | null;
  turnRunning: boolean;
  queued: boolean;
  blocked: boolean;
  backgroundIds: ReadonlySet<string>;
  loadedIds: ReadonlySet<string>;
  roster?: ReadonlyMap<string, RosterHint>;
  now: number;
  recentMs?: number;
};

export type DashGroup = {
  status: DashStatus;
  label: string;
  rows: SessionListEntry[];
  overflow: number;
};

export type DashSort = "status" | "cwd";

export type PeekBubble = {
  role: "user" | "assistant";
  text: string;
  time?: string;
};

export function dashStatusRank(status: DashStatus): number {
  const i = DASH_GROUP_ORDER.indexOf(status);
  return i < 0 ? 99 : i;
}

export function parseUpdatedAt(raw: string | null | undefined, now = Date.now()): number | null {
  void now;
  if (!raw) return null;
  const n = Date.parse(raw);
  if (Number.isFinite(n)) return n;
  const asNum = Number(raw);
  if (Number.isFinite(asNum)) {
    return asNum < 1e12 ? asNum * 1000 : asNum;
  }
  return null;
}

function listedTerminalStatus(entry: SessionListEntry): "completed" | "failed" | null {
  const kind = (entry.sessionKind ?? "").trim().toLowerCase();
  if (!kind) return null;
  if (kind === "failed" || kind === "fail" || kind === "error" || kind === "dead") return "failed";
  if (kind === "completed" || kind === "complete" || kind === "done") return "completed";
  return null;
}

export function rosterActivityToStatus(activity: RosterActivity, resident: boolean): DashStatus {
  if (activity === "needs_input") return "needs";
  if (activity === "working") return "working";
  if (activity === "completed") return "completed";
  if (activity === "dead") return "failed";
  if (activity === "dormant" || !resident) return "inactive";
  return "idle";
}

export function inferDashStatus(entry: SessionListEntry, live: DashLive): DashStatus {
  const hint = live.roster?.get(entry.sessionId);
  if (hint) return rosterActivityToStatus(hint.activity, hint.resident);
  const terminal = listedTerminalStatus(entry);
  if (terminal) return terminal;
  const isCurrent = Boolean(live.currentSessionId && live.currentSessionId === entry.sessionId);
  if (isCurrent && live.blocked) return "needs";
  const bg = live.backgroundIds.has(entry.sessionId);
  if (isCurrent && (live.turnRunning || live.queued || bg)) return "working";
  if (bg) return "working";
  const loaded = isCurrent || live.loadedIds.has(entry.sessionId);
  if (!loaded) return "inactive";
  const updated = parseUpdatedAt(entry.updatedAt, live.now);
  const windowMs = live.recentMs ?? DASH_RECENT_MS;
  const recent = updated != null && live.now - updated < windowMs;
  if (isCurrent || recent) return "idle";
  return "idle";
}

export function dashDotKind(status: DashStatus): "working" | "solid" | "hollow" {
  if (status === "working") return "working";
  if (status === "idle" || status === "inactive") return "hollow";
  return "solid";
}

export function dashMatches(entry: SessionListEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${entry.summary} ${entry.lastTurnSummary ?? ""} ${entry.sessionId} ${entry.cwd ?? ""}`.toLowerCase();
  return hay.includes(q);
}

export function loadIdSet(store: Pick<Storage, "getItem">, key: string): Set<string> {
  try {
    const raw = store.getItem(key);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveIdSet(store: Pick<Storage, "setItem">, key: string, ids: Iterable<string>): void {
  store.setItem(key, JSON.stringify([...ids]));
}

export function togglePinned(pins: Set<string>, sessionId: string): Set<string> {
  const next = new Set(pins);
  if (next.has(sessionId)) next.delete(sessionId);
  else next.add(sessionId);
  return next;
}

function cmpUpdatedDesc(a: SessionListEntry, b: SessionListEntry): number {
  const ta = parseUpdatedAt(a.updatedAt) ?? 0;
  const tb = parseUpdatedAt(b.updatedAt) ?? 0;
  if (tb !== ta) return tb - ta;
  return a.sessionId.localeCompare(b.sessionId);
}

export function sortDashRows(
  rows: SessionListEntry[],
  pins: ReadonlySet<string>,
  sort: DashSort,
): SessionListEntry[] {
  const pinOrder = [...pins];
  return [...rows].sort((a, b) => {
    const pa = pins.has(a.sessionId) ? 0 : 1;
    const pb = pins.has(b.sessionId) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (pins.has(a.sessionId) && pins.has(b.sessionId)) {
      const ia = pinOrder.indexOf(a.sessionId);
      const ib = pinOrder.indexOf(b.sessionId);
      if (ia !== ib) return ia - ib;
    }
    if (sort === "cwd") {
      const c = (a.cwd ?? "").localeCompare(b.cwd ?? "");
      if (c) return c;
    }
    return cmpUpdatedDesc(a, b);
  });
}

export function idleVisible(
  rows: SessionListEntry[],
  input: { now: number; expanded: boolean; cap?: number; recentMs?: number },
): { shown: SessionListEntry[]; overflow: number } {
  if (input.expanded) return { shown: rows, overflow: 0 };
  const cap = input.cap ?? DASH_IDLE_CAP;
  void input.now;
  void input.recentMs;
  const shown = rows.slice(0, cap);
  return { shown, overflow: Math.max(0, rows.length - shown.length) };
}

export function buildDashGroups(input: {
  sessions: SessionListEntry[];
  live: DashLive;
  pins: ReadonlySet<string>;
  query?: string;
  sort?: DashSort;
  idleExpanded?: boolean;
}): DashGroup[] {
  const query = input.query ?? "";
  const sort = input.sort ?? "status";
  const filtered = input.sessions.filter((s) => dashMatches(s, query));
  const buckets = new Map<DashStatus, SessionListEntry[]>();
  for (const status of DASH_GROUP_ORDER) buckets.set(status, []);
  for (const entry of filtered) {
    const status = inferDashStatus(entry, input.live);
    buckets.get(status)!.push(entry);
  }
  const groups: DashGroup[] = [];
  for (const status of DASH_GROUP_ORDER) {
    const raw = buckets.get(status) ?? [];
    if (!raw.length) continue;
    const sorted = sortDashRows(raw, input.pins, sort);
    if (status === "idle") {
      const slice = idleVisible(sorted, {
        now: input.live.now,
        expanded: Boolean(input.idleExpanded),
      });
      groups.push({
        status,
        label: DASH_GROUP_LABEL[status],
        rows: slice.shown,
        overflow: slice.overflow,
      });
    } else {
      groups.push({
        status,
        label: DASH_GROUP_LABEL[status],
        rows: sorted,
        overflow: 0,
      });
    }
  }
  return groups;
}

export function peekTailLines(
  items: { kind: string; text: string }[],
  n = 6,
): string {
  return items
    .filter((i) => i.text.trim())
    .slice(-n)
    .map((i) => `${i.kind}: ${i.text.trim()}`)
    .join("\n\n");
}

function formatPeekTime(ts: number | null | undefined): string | undefined {
  if (ts == null || !Number.isFinite(ts)) return undefined;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return undefined;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function peekTailBubbles(
  items: { kind: string; text: string; timestamp?: number | null }[],
  n = 6,
): PeekBubble[] {
  return items
    .filter((i) => (i.kind === "user" || i.kind === "agent") && i.text.trim())
    .slice(-n)
    .map((i) => ({
      role: i.kind === "user" ? "user" : "assistant",
      text: i.text.trim(),
      time: formatPeekTime(i.timestamp),
    }));
}

export function parseDashboardHash(hash: string): boolean {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const path = (raw.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  return path === "/dashboard" || path === "dashboard";
}

function asActivity(raw: unknown): RosterActivity | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "working" || v === "idle" || v === "needs_input" || v === "dormant" || v === "completed" || v === "dead") {
    return v;
  }
  if (v === "needsinput" || v === "needs-input") return "needs_input";
  if (v === "failed" || v === "fail" || v === "error") return "dead";
  if (v === "done" || v === "complete") return "completed";
  return null;
}

export function parseRosterEntry(raw: unknown): RosterEntry | null {
  const r = asRecord(raw as Json);
  if (!r) return null;
  const sessionId =
    (typeof r.sessionId === "string" && r.sessionId) ||
    (typeof r.session_id === "string" && r.session_id) ||
    null;
  if (!sessionId) return null;
  const activity = asActivity(r.activity) ?? "dormant";
  const lastMs =
    typeof r.lastChangeUnixMs === "number"
      ? r.lastChangeUnixMs
      : typeof r.last_change_unix_ms === "number"
        ? r.last_change_unix_ms
        : null;
  return {
    sessionId,
    title:
      (typeof r.title === "string" && r.title) ||
      (typeof r.summary === "string" && r.summary) ||
      null,
    cwd: typeof r.cwd === "string" && r.cwd ? r.cwd : null,
    lastTurnSummary:
      (typeof r.lastTurnSummary === "string" && r.lastTurnSummary) ||
      (typeof r.last_turn_summary === "string" && r.last_turn_summary) ||
      null,
    activity,
    resident: r.resident === true,
    lastChangeUnixMs: lastMs,
    yolo: r.yolo === true,
  };
}

export function parseRosterList(payload: unknown): RosterEntry[] {
  const rec = asRecord(payload as Json);
  const inner = asRecord((rec?.result as Json) ?? (payload as Json)) ?? rec;
  const rows = inner?.sessions;
  if (!Array.isArray(rows)) return [];
  const out: RosterEntry[] = [];
  for (const row of rows) {
    const parsed = parseRosterEntry(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function parseRosterChanged(payload: unknown): {
  upserted: RosterEntry[];
  removed: string[];
} {
  const rec = asRecord(payload as Json);
  const inner = asRecord((rec?.result as Json) ?? (payload as Json)) ?? rec;
  const upserted: RosterEntry[] = [];
  const rawUp = inner?.upserted;
  if (Array.isArray(rawUp)) {
    for (const row of rawUp) {
      const parsed = parseRosterEntry(row);
      if (parsed) upserted.push(parsed);
    }
  }
  const removed: string[] = [];
  const rawRm = inner?.removed;
  if (Array.isArray(rawRm)) {
    for (const id of rawRm) {
      if (typeof id === "string" && id) removed.push(id);
    }
  }
  return { upserted, removed };
}

export function applyRosterChanged(
  current: RosterEntry[],
  delta: { upserted: RosterEntry[]; removed: string[] },
): RosterEntry[] {
  const gone = new Set(delta.removed);
  const next = current.filter((e) => !gone.has(e.sessionId));
  for (const row of delta.upserted) {
    const i = next.findIndex((e) => e.sessionId === row.sessionId);
    if (i >= 0) next[i] = row;
    else next.push(row);
  }
  return next;
}

export function rosterToSessionEntry(row: RosterEntry): SessionListEntry {
  const kind =
    row.activity === "completed" ? "completed" : row.activity === "dead" ? "failed" : null;
  return {
    sessionId: row.sessionId,
    summary: row.title?.trim() || row.sessionId,
    cwd: row.cwd,
    updatedAt: row.lastChangeUnixMs != null ? String(row.lastChangeUnixMs) : null,
    source: row.resident ? "resident" : "disk",
    lastTurnSummary: row.lastTurnSummary,
    sessionKind: kind,
    adminKind: "build",
    worktreeLabel: null,
    gitRootDir: null,
    sourceWorkspaceDir: null,
    repoName: null,
  };
}

export const DASH_HELP_SHORTCUTS = [
  { keys: "Ctrl+\\", title: "打开运行中会话" },
  { keys: "Ctrl+/", title: "搜索" },
  { keys: "Ctrl+R", title: "重命名" },
  { keys: "Ctrl+T", title: "置顶" },
  { keys: "Ctrl+G", title: "按目录排序" },
  { keys: "Ctrl+O", title: "YOLO（当前行）" },
  { keys: "Ctrl+X", title: "停止 / 删除" },
  { keys: "Enter", title: "打开会话" },
  { keys: "Esc", title: "回列表 / 清过滤" },
  { keys: "?", title: "快捷键" },
] as const;
