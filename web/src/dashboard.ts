import type { SessionListEntry } from "./startup";

export const DASH_TITLE = "运行中会话";
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
  needs: "Needs input",
  working: "Working",
  idle: "Idle",
  inactive: "Inactive",
  completed: "Completed",
  failed: "Failed",
};

export type DashLive = {
  currentSessionId: string | null;
  turnRunning: boolean;
  queued: boolean;
  blocked: boolean;
  backgroundIds: ReadonlySet<string>;
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

export function dashStatusRank(status: DashStatus): number {
  const i = DASH_GROUP_ORDER.indexOf(status);
  return i < 0 ? 99 : i;
}

export function parseUpdatedAt(raw: string | null | undefined): number | null {
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
  if (kind === "failed" || kind === "fail" || kind === "error") return "failed";
  if (kind === "completed" || kind === "complete" || kind === "done") return "completed";
  return null;
}

export function inferDashStatus(entry: SessionListEntry, live: DashLive): DashStatus {
  const terminal = listedTerminalStatus(entry);
  if (terminal) return terminal;
  const isCurrent = Boolean(live.currentSessionId && live.currentSessionId === entry.sessionId);
  if (isCurrent && live.blocked) return "needs";
  const bg = live.backgroundIds.has(entry.sessionId);
  if (isCurrent && (live.turnRunning || live.queued || bg)) return "working";
  if (bg) return "working";
  const updated = parseUpdatedAt(entry.updatedAt);
  const windowMs = live.recentMs ?? DASH_RECENT_MS;
  const recent = updated != null && live.now - updated < windowMs;
  if (isCurrent || recent) return "idle";
  return "inactive";
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
  return [...rows].sort((a, b) => {
    const pa = pins.has(a.sessionId) ? 0 : 1;
    const pb = pins.has(b.sessionId) ? 0 : 1;
    if (pa !== pb) return pa - pb;
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

export function parseDashboardHash(hash: string): boolean {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const path = (raw.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  return path === "/dashboard" || path === "dashboard";
}

export const DASH_HELP_SHORTCUTS = [
  { keys: "Ctrl+\\", title: "打开运行中会话" },
  { keys: "Ctrl+/", title: "搜索" },
  { keys: "Ctrl+R", title: "重命名" },
  { keys: "Ctrl+T", title: "置顶" },
  { keys: "Ctrl+G", title: "按目录排序" },
  { keys: "Ctrl+O", title: "YOLO（当前行）" },
  { keys: "Enter", title: "打开会话" },
  { keys: "Esc", title: "回列表 / 清过滤" },
  { keys: "?", title: "快捷键" },
] as const;
