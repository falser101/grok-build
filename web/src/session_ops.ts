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
    const used = ctx.usedPercent ?? ctx.used_percent ?? ctx.tokens;
    if (used !== undefined) lines.push(`context: ${String(used)}`);
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
