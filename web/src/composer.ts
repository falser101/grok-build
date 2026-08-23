import { buildPromptContentBlocks, type Json } from "./protocol.ts";
import { LOCAL_SLASH, parseLocalSlash, type LocalSlash, type SlashCommand } from "./slash.ts";

export const PASTE_TEXT_LIMIT = 200_000;
export const PASTE_IMAGE_LIMIT = 8 * 1024 * 1024;
export const ENTER_SENDS_KEY = "grok-web.enter-sends";
export const SHOW_THINKING_KEY = "grok-web.show-thinking";
export const GROUP_TOOLS_KEY = "grok-web.group-tools";

export type { SlashCommand, LocalSlash };
export { LOCAL_SLASH, parseLocalSlash };

export type PromptBlock =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string };

export type ImageChip = {
  id: string;
  mimeType: string;
  data: string;
  name: string;
  kind?: "image" | "video";
};

export type QueueItem = {
  id: string;
  text: string;
  images: ImageChip[];
};

export type ComposerPrefs = {
  enterSends: boolean;
  showThinking: boolean;
  groupTools: boolean;
  combineQueued: boolean;
  showTimestamps: boolean;
  showRail: boolean;
};

export const COMBINE_QUEUED_KEY = "grok-web.combine-queued";
export const SHOW_TIMESTAMPS_KEY = "grok-web.show-timestamps";
export const SHOW_RAIL_KEY = "grok-web.show-rail";

export function loadComposerPrefs(store: Storage): ComposerPrefs {
  return {
    enterSends: store.getItem(ENTER_SENDS_KEY) !== "0",
    showThinking: store.getItem(SHOW_THINKING_KEY) !== "0",
    groupTools: store.getItem(GROUP_TOOLS_KEY) !== "0",
    combineQueued: store.getItem(COMBINE_QUEUED_KEY) === "1",
    showTimestamps: store.getItem(SHOW_TIMESTAMPS_KEY) === "1",
    showRail: store.getItem(SHOW_RAIL_KEY) !== "0",
  };
}

export function persistComposerPrefs(prefs: ComposerPrefs, store: Storage): void {
  store.setItem(ENTER_SENDS_KEY, prefs.enterSends ? "1" : "0");
  store.setItem(SHOW_THINKING_KEY, prefs.showThinking ? "1" : "0");
  store.setItem(GROUP_TOOLS_KEY, prefs.groupTools ? "1" : "0");
  store.setItem(COMBINE_QUEUED_KEY, prefs.combineQueued ? "1" : "0");
  store.setItem(SHOW_TIMESTAMPS_KEY, prefs.showTimestamps ? "1" : "0");
  store.setItem(SHOW_RAIL_KEY, prefs.showRail ? "1" : "0");
}

export type ComposerKeyAction =
  | "send"
  | "newline"
  | "send-now"
  | "history-prev"
  | "history-next"
  | "slash-next"
  | "slash-prev"
  | "slash-accept"
  | "slash-close"
  | "clear-draft"
  | "accept-ghost"
  | "at-next"
  | "at-prev"
  | "at-accept"
  | "mode-shell"
  | "mode-remember"
  | "none";

export function mapComposerKey(
  key: string,
  mods: { shift: boolean; ctrl: boolean; meta: boolean; alt: boolean },
  state: {
    enterSends: boolean;
    promptEmpty: boolean;
    slashOpen: boolean;
    historyOpen: boolean;
    atOpen?: boolean;
    ghost?: string;
  },
): ComposerKeyAction {
  const cmd = mods.ctrl || mods.meta;
  if (key === "Escape") return state.slashOpen || state.historyOpen || state.atOpen ? "slash-close" : "none";
  if (key === "k" && cmd) return "clear-draft";
  if (key === "Enter" && cmd) return "send-now";
  if (state.atOpen && key === "ArrowDown") return "at-next";
  if (state.atOpen && key === "ArrowUp") return "at-prev";
  if (state.atOpen && (key === "Tab" || (key === "Enter" && !mods.shift))) return "at-accept";
  if (state.ghost && key === "Tab" && !state.slashOpen && !state.atOpen) return "accept-ghost";
  if (state.slashOpen && key === "ArrowDown") return "slash-next";
  if (state.slashOpen && key === "ArrowUp") return "slash-prev";
  if (state.slashOpen && key === "Tab") return "slash-accept";
  if (state.slashOpen && key === "Enter" && !mods.shift) return "slash-accept";
  if (state.historyOpen && key === "ArrowDown") return "history-next";
  if (state.historyOpen && key === "ArrowUp") return "history-prev";
  if (state.historyOpen && key === "Enter" && !mods.shift) return "send";
  if (key === "ArrowUp" && state.promptEmpty && !mods.shift) return "history-prev";
  if (key === "!" && state.promptEmpty) return "mode-shell";
  if (key === "#" && state.promptEmpty) return "mode-remember";
  if (key !== "Enter") return "none";
  if (state.enterSends) return mods.shift ? "newline" : "send";
  return mods.shift || cmd ? "send" : "newline";
}

export function slashQuery(text: string, caret: number): string | null {
  if (!text.startsWith("/")) return null;
  const before = text.slice(0, caret);
  if (before.includes("\n")) return null;
  const token = before.slice(1);
  if (token.includes(" ")) return null;
  return token;
}

export function filterSlashCommands(
  commands: SlashCommand[],
  query: string,
): SlashCommand[] {
  const q = query.toLowerCase();
  const scored = commands
    .filter((c) => c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q))
    .sort((a, b) => {
      const as = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return as - bs || a.name.localeCompare(b.name);
    });
  return scored.slice(0, 40);
}

export function applySlashAccept(text: string, command: SlashCommand): string {
  const rest = text.includes(" ") ? text.slice(text.indexOf(" ")) : "";
  return `/${command.name}${rest || " "}`;
}

export function shouldEnqueue(turnRunning: boolean, sendNow: boolean): boolean {
  return turnRunning && !sendNow;
}

export function drainQueueHead(items: QueueItem[]): {
  next: QueueItem | null;
  rest: QueueItem[];
} {
  if (!items.length) return { next: null, rest: [] };
  return { next: items[0]!, rest: items.slice(1) };
}

export function combineQueuedTexts(texts: string[], enabled: boolean): string {
  if (!enabled || texts.length < 2) return texts.join("\n");
  const stop = texts.findIndex((t) => /^(\/|!|#)/.test(t.trim()));
  if (stop === 0) return texts[0] ?? "";
  const take = stop === -1 ? texts : texts.slice(0, stop);
  return take.join("\n");
}

export function pasteTooLarge(chars: number, bytes: number): boolean {
  return chars > PASTE_TEXT_LIMIT || bytes > PASTE_IMAGE_LIMIT;
}

/** Text first, then images — delegates to the Q-05 wire builder. */
export function buildPromptBlocks(text: string, images: ImageChip[]): PromptBlock[] {
  return buildPromptContentBlocks({
    text,
    images: images.map((img, i) => ({
      mimeType: img.mimeType,
      data: img.data,
      displayNumber: i + 1,
    })),
  }).map((block) =>
    block.type === "text"
      ? { type: "text", text: block.text }
      : { type: "image", mimeType: block.mimeType, data: block.data },
  );
}

export function parsePromptHistory(payload: Json): string[] {
  const rec =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { [k: string]: Json })
      : null;
  const inner = rec?.result && typeof rec.result === "object" ? (rec.result as { [k: string]: Json }) : rec;
  const raw = inner?.prompts;
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === "string" && p.trim() !== "");
}

export function buildPromptHistoryParams(input: {
  cwd: string;
  filterSessionId?: string | null;
}): Json {
  const params: { [k: string]: Json } = { cwd: input.cwd };
  if (input.filterSessionId) params.filter_session_id = input.filterSessionId;
  return params;
}

export function parseQueueChanged(params: Json): {
  sessionId: string | null;
  entries: { id: string; text: string; version: number }[];
  runningText: string | null;
} {
  const rec =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as { [k: string]: Json })
      : null;
  const sessionId =
    (typeof rec?.sessionId === "string" && rec.sessionId) ||
    (typeof rec?.session_id === "string" && rec.session_id) ||
    null;
  const runningText =
    (typeof rec?.runningText === "string" && rec.runningText) ||
    (typeof rec?.running_text === "string" && rec.running_text) ||
    null;
  const entriesRaw = rec?.entries;
  const entries: { id: string; text: string; version: number }[] = [];
  if (Array.isArray(entriesRaw)) {
    for (const row of entriesRaw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as { [k: string]: Json };
      if (typeof r.id === "string") {
        entries.push({
          id: r.id,
          text: typeof r.text === "string" ? r.text : "",
          version: typeof r.version === "number" ? r.version : 0,
        });
      }
    }
  }
  return { sessionId, entries, runningText };
}

export function isFollowUpLiteral(text: string): boolean {
  return text.trim().length > 0;
}


export function atQuery(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const m = /(?:^|\s)@([^\s]*)$/.exec(before);
  return m ? m[1]! : null;
}

export function applyAtAccept(text: string, caret: number, path: string): string {
  const before = text.slice(0, caret);
  const after = text.slice(caret);
  const replaced = before.replace(/@([^\s]*)$/, `@${path} `);
  return replaced + after;
}

export function looksLikePlan(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false;
  return /^(plan|规划|步骤)\b/i.test(t) || /^\d+\.\s+.+\n\d+\.\s+/m.test(t);
}

export function parseSuggest(payload: Json): {
  ghost: string | null;
  completions: { display: string; insertText: string; description: string }[];
} {
  const rec =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { [k: string]: Json })
      : null;
  const inner = rec?.result && typeof rec.result === "object" ? (rec.result as { [k: string]: Json }) : rec;
  const ghostRec = inner && typeof inner.ghost === "object" && inner.ghost ? (inner.ghost as { [k: string]: Json }) : null;
  const ghost = ghostRec && typeof ghostRec.suffix === "string" ? ghostRec.suffix : null;
  const completions: { display: string; insertText: string; description: string }[] = [];
  const raw = inner?.completions;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as { [k: string]: Json };
      if (typeof r.insertText === "string" || typeof r.display === "string") {
        completions.push({
          display: typeof r.display === "string" ? r.display : String(r.insertText ?? ""),
          insertText: typeof r.insertText === "string" ? r.insertText : String(r.display ?? ""),
          description: typeof r.description === "string" ? r.description : "",
        });
      }
    }
  }
  return { ghost, completions };
}

export function parseSuggestPrompt(payload: Json): string | null {
  const rec =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { [k: string]: Json })
      : null;
  const inner = rec?.result && typeof rec.result === "object" ? (rec.result as { [k: string]: Json }) : rec;
  return inner && typeof inner.suggestion === "string" ? inner.suggestion : null;
}

export function parseFuzzyOpen(payload: Json): string | null {
  const rec =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { [k: string]: Json })
      : null;
  const inner = rec?.result && typeof rec.result === "object" ? (rec.result as { [k: string]: Json }) : rec;
  const id =
    (inner && typeof inner.searchId === "string" && inner.searchId) ||
    (inner && typeof inner.search_id === "string" && inner.search_id) ||
    null;
  return id;
}

export function parseFuzzyStatus(params: Json): { path: string; score: number }[] {
  const rec =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as { [k: string]: Json })
      : null;
  const matches = rec?.matches;
  if (!Array.isArray(matches)) return [];
  const out: { path: string; score: number }[] = [];
  for (const row of matches) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as { [k: string]: Json };
    if (typeof r.path === "string") {
      out.push({ path: r.path, score: typeof r.score === "number" ? r.score : 0 });
    }
  }
  return out;
}

export function isQueuedSlash(text: string): boolean {
  return parseLocalSlash(text) !== null || /^\/[a-z]/i.test(text.trim());
}

export function composerIsFilled(text: string, images: { length: number }): boolean {
  return Boolean(text.trim()) || images.length > 0;
}

export function permissionChipLabel(mode: string): string {
  if (mode === "always-approve") return "始终允许";
  if (mode === "auto") return "自动";
  return "每次询问";
}

export const EFFORT_OPTIONS: { id: string; label: string }[] = [
  { id: "low", label: "低" },
  { id: "medium", label: "中" },
  { id: "high", label: "高" },
  { id: "xhigh", label: "很高" },
];

export function effortChipLabel(id: string | null | undefined): string {
  return EFFORT_OPTIONS.find((o) => o.id === id)?.label ?? "思考";
}

export type CatalogModel = {
  id: string;
  name: string;
  supportsEffort: boolean;
};

export function parseModelState(params: Json): {
  currentId: string | null;
  currentName: string | null;
  effort: string | null;
  models: CatalogModel[];
} {
  const rec =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as { [k: string]: Json })
      : null;
  const inner =
    rec?.result && typeof rec.result === "object" && !Array.isArray(rec.result)
      ? (rec.result as { [k: string]: Json })
      : rec;
  const data =
    inner?.data && typeof inner.data === "object" && !Array.isArray(inner.data)
      ? (inner.data as { [k: string]: Json })
      : inner;
  const modelsRaw =
    (Array.isArray(data?.availableModels) && data.availableModels) ||
    (Array.isArray(data?.available_models) && data.available_models) ||
    (Array.isArray(inner?.availableModels) && inner.availableModels) ||
    [];
  const models: CatalogModel[] = [];
  for (const row of modelsRaw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as { [k: string]: Json };
    const id =
      (typeof r.modelId === "string" && r.modelId) ||
      (typeof r.model_id === "string" && r.model_id) ||
      (typeof r.id === "string" && r.id) ||
      "";
    if (!id) continue;
    const meta =
      r._meta && typeof r._meta === "object" && !Array.isArray(r._meta)
        ? (r._meta as { [k: string]: Json })
        : r.meta && typeof r.meta === "object" && !Array.isArray(r.meta)
          ? (r.meta as { [k: string]: Json })
          : null;
    models.push({
      id,
      name: (typeof r.name === "string" && r.name) || id,
      supportsEffort: meta?.supportsReasoningEffort === true || meta?.supports_reasoning_effort === true,
    });
  }
  const currentId =
    (typeof data?.currentModelId === "string" && data.currentModelId) ||
    (typeof data?.current_model_id === "string" && data.current_model_id) ||
    (typeof inner?.currentModelId === "string" && inner.currentModelId) ||
    (typeof data?.modelId === "string" && data.modelId) ||
    (typeof data?.model === "string" && data.model) ||
    models[0]?.id ||
    null;
  const currentName =
    (typeof data?.modelDisplayName === "string" && data.modelDisplayName) ||
    (typeof data?.model_display_name === "string" && data.model_display_name) ||
    models.find((m) => m.id === currentId)?.name ||
    currentId;
  const effort =
    (typeof data?.reasoningEffort === "string" && data.reasoningEffort) ||
    (typeof data?.reasoning_effort === "string" && data.reasoning_effort) ||
    (typeof data?.effort === "string" && data.effort) ||
    null;
  return { currentId, currentName, effort, models };
}
