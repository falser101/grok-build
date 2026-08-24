export type HashRoute =
  | { kind: "sessions" }
  | { kind: "dashboard" }
  | { kind: "session"; id: string }
  | { kind: "other"; raw: string };

export function parseHashRoute(hash: string): HashRoute {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const path = (raw.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  if (path === "/sessions" || path === "sessions") return { kind: "sessions" };
  if (path === "/dashboard" || path === "dashboard") return { kind: "dashboard" };
  const m = /^\/?s\/([^/]+)$/.exec(path);
  if (m?.[1]) {
    try {
      return { kind: "session", id: decodeURIComponent(m[1]) };
    } catch {
      return { kind: "session", id: m[1] };
    }
  }
  return { kind: "other", raw };
}

export function hashForSessions(): string {
  return "#/sessions";
}

export function hashForDashboard(): string {
  return "#/dashboard";
}

export function hashForSession(id: string): string {
  return `#/s/${encodeURIComponent(id)}`;
}

export type PaletteKind = "shortcut" | "slash" | "skill";

export type PaletteItem = {
  id: string;
  kind: PaletteKind;
  title: string;
  hint: string;
  run: string;
  argumentHint?: string | null;
};

export type ShortcutRow = {
  id: string;
  keys: string;
  title: string;
  run: string;
};

export const APP_SHORTCUTS: ShortcutRow[] = [
  { id: "send-now", keys: "Ctrl+Enter", title: "立即发送", run: "send-now" },
  { id: "mode", keys: "Shift+Tab", title: "模式", run: "mode" },
  { id: "queue", keys: "Ctrl+;", title: "队列", run: "queue" },
  { id: "settings", keys: "Ctrl+,", title: "设置", run: "settings" },
  { id: "dashboard", keys: "Ctrl+\\", title: "Dashboard", run: "dashboard" },
  { id: "shortcuts", keys: "?", title: "速查", run: "shortcuts" },
  { id: "shortcuts-dot", keys: "Ctrl+.", title: "速查", run: "shortcuts" },
  { id: "palette", keys: "Ctrl+P", title: "命令面板", run: "palette" },
  { id: "esc", keys: "Esc", title: "关浮层 / Stop / 清输入 / rewind", run: "esc" },
  { id: "model", keys: "Ctrl+M", title: "模型", run: "model" },
  { id: "enter", keys: "Enter", title: "发送 / 执行 slash", run: "enter" },
  { id: "tab", keys: "Tab", title: "补全 slash（不执行）", run: "tab" },
  { id: "newline", keys: "Shift+Enter", title: "换行", run: "newline" },
];

/** Palette 快捷键组：少量可搜条目，避免刷屏。 */
export const PALETTE_SHORTCUTS: ShortcutRow[] = APP_SHORTCUTS.filter((row) =>
  ["palette", "shortcuts-dot", "settings", "model"].includes(row.id),
);

/** U-05 快捷键页：真实绑定，与 APP_SHORTCUTS 同一份。 */
export const HELP_SHORTCUTS: ShortcutRow[] = APP_SHORTCUTS;

export const PALETTE_GROUP_LABEL: Record<PaletteKind, string> = {
  shortcut: "快捷键",
  slash: "slash",
  skill: "skill",
};

export type SlashLike = {
  name: string;
  description: string | null;
  argumentHint: string | null;
};

export function buildPaletteItems(input: {
  slash: SlashLike[];
  skills?: SlashLike[];
}): PaletteItem[] {
  const items: PaletteItem[] = [];
  for (const row of PALETTE_SHORTCUTS) {
    items.push({
      id: `key:${row.id}`,
      kind: "shortcut",
      title: row.title,
      hint: row.keys,
      run: row.run,
    });
  }
  const seen = new Set<string>();
  for (const cmd of input.slash) {
    const key = cmd.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: `slash:${cmd.name}`,
      kind: "slash",
      title: `/${cmd.name}`,
      hint: cmd.description ?? "",
      run: cmd.name,
      argumentHint: cmd.argumentHint,
    });
  }
  for (const cmd of input.skills ?? []) {
    const key = cmd.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: `skill:${cmd.name}`,
      kind: "skill",
      title: cmd.name,
      hint: cmd.description ?? "",
      run: cmd.name,
      argumentHint: cmd.argumentHint,
    });
  }
  return items;
}

function fuzzyScore(hay: string, q: string): number {
  if (!q) return 1;
  const h = hay.toLowerCase();
  if (h.startsWith(q)) return 4;
  if (h.includes(q)) return 2;
  let i = 0;
  for (const ch of h) {
    if (ch === q[i]) i += 1;
    if (i === q.length) return 1;
  }
  return 0;
}

export function groupPaletteItems(items: PaletteItem[]): { kind: PaletteKind; label: string; items: PaletteItem[] }[] {
  const order: PaletteKind[] = ["shortcut", "slash", "skill"];
  return order
    .map((kind) => ({
      kind,
      label: PALETTE_GROUP_LABEL[kind],
      items: items.filter((item) => item.kind === kind),
    }))
    .filter((g) => g.items.length > 0);
}

export function filterPaletteItems(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase().replace(/^\//, "");
  if (!q) return items;
  return items
    .map((item) => {
      const hay = `${item.title} ${item.hint} ${item.run}`.toLowerCase();
      return { item, score: fuzzyScore(hay, q) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .map((row) => row.item);
}

export type HintFocus = "composer" | "thread" | "slash" | "other";

export function hintForFocus(focus: HintFocus, enterSends: boolean): string {
  if (focus === "slash") return "Tab 补全 · Enter 执行 · ? 快捷键";
  if (focus === "thread") return "? 快捷键 · Ctrl+P 命令";
  if (focus === "composer") {
    return enterSends
      ? "Enter 发送 · Shift+Enter 换行 · ? 快捷键 · Ctrl+P 命令"
      : "Ctrl+Enter 发送 · Enter 换行 · ? 快捷键 · Ctrl+P 命令";
  }
  return "? 快捷键 · Ctrl+P 命令面板";
}

export type TurnPhase = "idle" | "thinking" | "tool" | "blocked" | "watching";

export function inferTurnPhase(input: {
  connected: boolean;
  turnRunning: boolean;
  liveTool: boolean;
  blocked: boolean;
}): TurnPhase {
  if (input.blocked) return "blocked";
  if (input.turnRunning && input.liveTool) return "tool";
  if (input.turnRunning) return "thinking";
  if (input.connected) return "watching";
  return "idle";
}

export function turnStatusLabel(phase: TurnPhase): string {
  if (phase === "thinking") return "正在想";
  if (phase === "tool") return "跑工具";
  if (phase === "blocked") return "blocked";
  if (phase === "watching") return "watching";
  return "idle";
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function firstNum(bags: Array<{ [k: string]: unknown } | null>, keys: string[]): number | null {
  for (const bag of bags) {
    if (!bag) continue;
    for (const key of keys) {
      const n = asNum(bag[key]);
      if (n != null) return n;
    }
  }
  return null;
}

function asObj(value: unknown): { [k: string]: unknown } | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { [k: string]: unknown })
    : null;
}

export function parseContextUsage(payload: unknown): {
  percent: number | null;
  tokens: number | null;
  label: string;
} {
  const rec = asObj(payload);
  const inner = asObj(rec?.result) ?? rec;
  const data = asObj(inner?.data) ?? inner;
  const update = asObj(inner?.update) ?? asObj(data?.update) ?? asObj(rec?.update);
  const ctx =
    asObj(data?.context) ?? asObj(inner?.context) ?? asObj(update?.context) ?? null;
  const win =
    asObj(data?.context_window) ??
    asObj(data?.contextWindow) ??
    asObj(inner?.context_window) ??
    asObj(update?.context_window) ??
    asObj(ctx?.context_window) ??
    null;
  const bags = [ctx, win, data, inner, rec, update];
  let percent = firstNum(bags, [
    "usedPercent",
    "used_percent",
    "usagePct",
    "usage_pct",
    "used_percentage",
    "usedPercentage",
    "percent",
    "contextPercent",
    "context_percent",
  ]);
  const tokens = firstNum(bags, [
    "used",
    "tokens",
    "usedTokens",
    "used_tokens",
    "tokensUsed",
    "tokens_used",
    "context_tokens",
    "contextTokens",
  ]);
  const limit = firstNum(bags, [
    "total",
    "limit",
    "maxTokens",
    "max_tokens",
    "contextWindow",
    "context_window",
    "context_window_size",
    "contextWindowSize",
    "window",
    "tokenLimit",
    "token_limit",
  ]);
  if (percent == null && tokens != null && limit && limit > 0) percent = (tokens / limit) * 100;
  if (percent != null) return { percent, tokens, label: `${Math.round(percent)}%` };
  return { percent: null, tokens, label: "—%" };
}

export function contextChipText(usage: { percent: number | null; tokens: number | null; label: string }): string {
  return `上下文 ${usage.label}`;
}

export function formatSlashSubmit(name: string, args: string): string {
  const a = args.trim();
  return a ? `/${name} ${a}` : `/${name}`;
}

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export function openDialog(root: HTMLElement): void {
  root.hidden = false;
  root.setAttribute("data-open", "1");
  const panel = root.querySelector<HTMLElement>("[role='dialog']");
  panel?.focus?.();
}

export function closeDialog(root: HTMLElement): void {
  root.hidden = true;
  root.removeAttribute("data-open");
}

export function dialogIsOpen(root: HTMLElement): boolean {
  return !root.hidden;
}

export type GlobalHotkey =
  | "palette"
  | "settings"
  | "model"
  | "shortcuts"
  | "queue"
  | null;

export function mapGlobalHotkey(
  key: string,
  mods: { ctrl: boolean; meta: boolean; shift: boolean },
  typing: boolean,
): GlobalHotkey {
  const cmd = mods.ctrl || mods.meta;
  if (cmd && (key === "p" || key === "P")) return "palette";
  if (cmd && key === ",") return "settings";
  if (key === "F2" && !typing) return "settings";
  if (cmd && (key === "m" || key === "M")) return "model";
  if (!typing && key === "?") return "shortcuts";
  if (!typing && cmd && key === ".") return "shortcuts";
  if (cmd && key === ";") return "queue";
  return null;
}
