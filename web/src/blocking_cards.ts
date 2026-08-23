import type { Json } from "./protocol.ts";

function asRecord(value: Json): { [k: string]: Json } | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { [k: string]: Json })
    : null;
}

function str(value: Json | undefined): string {
  return typeof value === "string" ? value : "";
}

export type PermissionKind = "allow_once" | "allow_always" | "reject_once" | "reject_always" | "other";

export type PermissionOption = {
  optionId: string;
  name: string;
  kind: PermissionKind;
  promptPrefix?: string;
  toolName?: string;
  serverPrefix?: string | null;
};

export type PermissionRequest = {
  sessionId: string;
  toolCallId: string;
  title: string;
  kind: string;
  detail: string;
  options: PermissionOption[];
  subagent: string | null;
  mcp: string | null;
  command: string;
  bashWords: string[];
  mcpTool: string | null;
  mcpServer: string | null;
};

export type PermissionScopeState = {
  bashAllowCount: number;
  bashDenyCount: number;
  patternOpen: boolean;
  patternBuffer: string;
  patternDirty: boolean;
  mcpScope: "tool" | "server";
};

export type QuestionOption = {
  id: string | null;
  label: string;
  description: string;
  preview: string | null;
};

export type QuestionItem = {
  id: string;
  question: string;
  options: QuestionOption[];
  multi: boolean;
};

export type QuestionRequest = {
  sessionId: string;
  toolCallId: string;
  mode: "default" | "plan";
  questions: QuestionItem[];
  timeoutMs: number | null;
};

export type PlanRequest = {
  sessionId: string;
  toolCallId: string;
  planContent: string;
};

export function normalizePermissionKind(raw: string): PermissionKind {
  const k = raw.toLowerCase().replace(/-/g, "_");
  if (k === "allow_once" || k === "allowonce") return "allow_once";
  if (k === "allow_always" || k === "allowalways") return "allow_always";
  if (k === "reject_once" || k === "rejectonce") return "reject_once";
  if (k === "reject_always" || k === "rejectalways") return "reject_always";
  return "other";
}

export function parsePermissionRequest(params: Json): PermissionRequest {
  const rec = asRecord(params) ?? {};
  const tool = asRecord(rec.toolCall ?? rec.tool_call ?? null) ?? {};
  const rawInput = asRecord(tool.rawInput ?? tool.raw_input ?? rec.rawInput ?? null);
  const meta = asRecord(tool._meta ?? rec._meta ?? null);
  const optionsRaw = rec.options;
  const options: PermissionOption[] = [];
  if (Array.isArray(optionsRaw)) {
    for (const row of optionsRaw) {
      const o = asRecord(row);
      if (!o) continue;
      const optionId = str(o.optionId) || str(o.option_id) || str(o.id);
      if (!optionId) continue;
      const oMeta = asRecord(o._meta ?? o.meta ?? null);
      options.push({
        optionId,
        name: str(o.name) || str(o.label) || optionId,
        kind: normalizePermissionKind(str(o.kind)),
        promptPrefix: str(oMeta?.prompt_prefix) || str(oMeta?.promptPrefix) || undefined,
        toolName: str(oMeta?.tool_name) || str(oMeta?.toolName) || undefined,
        serverPrefix: str(oMeta?.server_prefix) || str(oMeta?.serverPrefix) || null,
      });
    }
  }
  const command =
    (rawInput ? str(rawInput.command) || str(rawInput.cmd) : "") ||
    (str(tool.title).match(/`([^`]+)`/)?.[1] ?? "");
  const path = rawInput ? str(rawInput.path) || str(rawInput.file_path) : "";
  const reqMeta = asRecord(rec._meta ?? rec.meta ?? null);
  const wordsRaw = reqMeta?.highlighted_words ?? reqMeta?.highlightedWords ?? meta?.highlighted_words;
  const bashWords = Array.isArray(wordsRaw)
    ? wordsRaw.map((w) => str(w)).filter(Boolean)
    : tokenizeCommand(command);
  const mcpOpt = options.find((o) => o.optionId === "allow-always-mcp");
  const toolName = str(tool.name) || mcpOpt?.toolName || "";
  const parsedMcp = parseMcpName(toolName);
  const mcpServer =
    mcpOpt?.serverPrefix ||
    parsedMcp?.server ||
    str(meta?.mcpServer) ||
    str(meta?.server) ||
    null;
  const mcpTool = mcpOpt?.toolName || parsedMcp?.tool || (toolName.includes("__") ? toolName : null);
  const mcp = mcpServer || mcpTool || (toolName.includes("__") ? toolName : "");
  const subagent =
    str(meta?.subagentDescription) ||
    str(meta?.description) ||
    str(rec.subagentDescription) ||
    null;
  const detail =
    command ||
    path ||
    (typeof rec.rawInput === "string" ? rec.rawInput : "") ||
    (rawInput ? JSON.stringify(rawInput, null, 2) : "");
  return {
    sessionId: str(rec.sessionId) || str(rec.session_id),
    toolCallId: str(tool.toolCallId) || str(tool.tool_call_id) || str(rec.toolCallId),
    title: str(tool.title) || str(rec.title) || str(tool.kind) || "工具",
    kind: str(tool.kind) || str(rec.kind),
    detail,
    options,
    subagent: subagent || null,
    mcp: mcp || null,
    command,
    bashWords,
    mcpTool: mcpTool || null,
    mcpServer: mcpServer || null,
  };
}

export function defaultPermissionIndex(options: PermissionOption[], stickyKind: PermissionKind | null): number {
  if (stickyKind) {
    const hit = options.findIndex((o) => o.kind === stickyKind && o.optionId !== "enable-always-approve");
    if (hit >= 0) return hit;
  }
  const always = options.findIndex(
    (o) => o.kind === "allow_always" && o.optionId !== "enable-always-approve",
  );
  if (always >= 0) return always;
  const once = options.findIndex((o) => o.kind === "allow_once");
  if (once >= 0) return once;
  return 0;
}

export function permissionSelected(optionId: string, meta?: { [k: string]: Json } | null): Json {
  const body: { [k: string]: Json } = { outcome: { outcome: "selected", optionId } };
  if (meta && Object.keys(meta).length) body._meta = meta;
  return body;
}

export function permissionCancelled(): Json {
  return { outcome: { outcome: "cancelled" } };
}

export function firstAllowOnceId(options: PermissionOption[]): string | null {
  return options.find((o) => o.kind === "allow_once")?.optionId ?? null;
}

export function rejectOption(options: PermissionOption[]): PermissionOption | null {
  return options.find((o) => o.kind === "reject_once") ?? options.find((o) => o.kind === "reject_always") ?? null;
}

export function optionLabel(opt: PermissionOption): string {
  const byId: Record<string, string> = {
    "allow-once": "允许一次",
    "always-allow": "始终允许",
    "reject-once": "拒绝",
    "reject-always": "永远拒绝",
    "allow-edits-session": "本会话允许所有编辑",
    "enable-always-approve": "此后全部允许",
    "allow-always-command": "始终允许这条命令",
    "reject-always-command": "永远拒绝这条命令",
    "allow-always-mcp": "始终允许这个 MCP 工具",
    "reject-always-mcp": "永远拒绝这个 MCP 工具",
    "allow-always-domain": "始终允许这个域名",
    "reject-always-domain": "永远拒绝这个域名",
  };
  return byId[opt.optionId] ?? opt.name;
}

const DANGEROUS_HEAD = new Set([
  "rm",
  "chmod",
  "chown",
  "chgrp",
  "chattr",
  "pkill",
  "kill",
  "killall",
]);
const EXEC_HEAD = new Set([
  "sudo",
  "ssh",
  "python",
  "python3",
  "node",
  "nodejs",
  "bash",
  "sh",
  "zsh",
  "ruby",
  "perl",
  "php",
  "java",
  "go",
  "cargo",
  "npm",
  "npx",
  "pnpm",
  "yarn",
  "bun",
  "deno",
  "docker",
]);
const SAFE_ONE = new Set([
  "ls",
  "cat",
  "head",
  "tail",
  "grep",
  "rg",
  "find",
  "echo",
  "pwd",
  "which",
  "true",
  "false",
  "date",
  "wc",
  "sort",
  "uniq",
]);

export function tokenizeCommand(cmd: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|`([^`]*)`|[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) out.push(m[1] ?? m[2] ?? m[3] ?? m[0]);
  return out;
}

function parseMcpName(name: string): { server: string; tool: string } | null {
  const i = name.indexOf("__");
  if (i <= 0) return null;
  return { server: name.slice(0, i), tool: name };
}

export function allowScopePinned(words: string[]): boolean {
  const head = words[0] ?? "";
  if (DANGEROUS_HEAD.has(head) || EXEC_HEAD.has(head)) return true;
  return head === "git" && words[1] === "push";
}

export function defaultAllowCount(words: string[]): number {
  if (!words.length) return 0;
  if (allowScopePinned(words)) return words.length;
  return baseScope(words);
}

export function defaultDenyCount(words: string[]): number {
  if (!words.length) return 0;
  return baseScope(words);
}

function baseScope(words: string[]): number {
  const head = words[0] ?? "";
  if (SAFE_ONE.has(head)) return 1;
  if (head === "git" && words[1] && words[1] !== "push") return Math.min(2, words.length);
  if (head === "kubectl" && words[1] === "get") return Math.min(2, words.length);
  let n = Math.min(2, words.length);
  while (n < words.length && words[n]!.startsWith("-")) n += 1;
  return n;
}

export function allowScopePersists(words: string[], n: number): boolean {
  if (n < 1 || n > words.length) return false;
  if (n < (allowScopePinned(words) ? words.length : 1)) return false;
  const slice = words.slice(0, n);
  if (slice.some((w) => /\s/.test(w))) return n === words.length;
  return true;
}

export function stepAllowCount(words: string[], current: number, right: boolean): number {
  if (right) {
    for (let n = current + 1; n <= words.length; n += 1) {
      if (allowScopePersists(words, n)) return n;
    }
  } else {
    for (let n = current - 1; n >= 1; n -= 1) {
      if (allowScopePersists(words, n)) return n;
    }
  }
  return current;
}

export function stepDenyCount(words: string[], current: number, right: boolean): number {
  if (right) return Math.min(words.length, current + 1);
  return Math.max(1, current - 1);
}

export function bashGlobIsCatchall(pattern: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  return p === "*" || p === "**" || p === "?*" || /^[\s*?]+$/.test(p);
}

export function bashPatternMatches(pattern: string, command: string): boolean {
  const p = pattern.trim();
  const c = command.trimStart();
  if (!p) return false;
  if (p === "*") return true;
  if (c === p || (c.startsWith(p) && c.charAt(p.length) === " ")) return true;
  try {
    const re = new RegExp(
      `^${p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
    );
    return re.test(c);
  } catch {
    return false;
  }
}

export function isBashAllowScope(id: string): boolean {
  return id === "allow-always-command" || id === "always-allow";
}

export function isBashDenyScope(id: string): boolean {
  return id === "reject-always-command" || id === "reject-always";
}

export function isMcpAllowScope(id: string): boolean {
  return id === "allow-always-mcp" || id === "always-allow";
}

export function scopedOptionLabel(
  opt: PermissionOption,
  req: PermissionRequest,
  scope: Partial<PermissionScopeState>,
): string {
  const words = req.bashWords;
  if (isBashAllowScope(opt.optionId) && words.length) {
    const n = Math.max(1, Math.min(scope.bashAllowCount || words.length, words.length));
    const prefix = opt.promptPrefix || "始终允许：";
    return `${prefix.replace(/[:：]\s*$/, "")}：${words.slice(0, n).join(" ")}`;
  }
  if (isBashDenyScope(opt.optionId) && words.length) {
    const n = Math.max(1, Math.min(scope.bashDenyCount || words.length, words.length));
    const prefix = opt.promptPrefix || "永远拒绝：";
    return `${prefix.replace(/[:：]\s*$/, "")}：${words.slice(0, n).join(" ")}`;
  }
  if (isMcpAllowScope(opt.optionId) && (req.mcpTool || req.mcpServer) && opt.optionId !== "always-allow") {
    if (scope.mcpScope === "server" && req.mcpServer) return `始终允许：${req.mcpServer} 的全部工具`;
    return `始终允许：${req.mcpTool || opt.toolName || "这个工具"}`;
  }
  if (opt.optionId === "always-allow" && req.mcpTool && !words.length) {
    if (scope.mcpScope === "server" && req.mcpServer) return `始终允许：${req.mcpServer} 的全部工具`;
    return `始终允许：${req.mcpTool}`;
  }
  return optionLabel(opt);
}

export function permissionSelectionMeta(
  opt: PermissionOption,
  req: PermissionRequest,
  scope: Partial<PermissionScopeState>,
): { [k: string]: Json } | null {
  if (isMcpAllowScope(opt.optionId) && (req.mcpTool || req.mcpServer) && !req.bashWords.length) {
    if (scope.mcpScope === "server" && req.mcpServer) return { kind: "server", server: req.mcpServer };
    if (req.mcpTool) return { kind: "tool", tool_name: req.mcpTool };
  }
  const words = req.bashWords;
  if (!words.length) return null;
  const deny = isBashDenyScope(opt.optionId);
  const allow = isBashAllowScope(opt.optionId);
  if (!deny && !allow) return null;
  if (allow && scope.patternOpen && scope.patternDirty) {
    const pattern = (scope.patternBuffer ?? "").trim();
    if (!pattern || bashGlobIsCatchall(pattern)) return null;
    return { command_parts: [pattern], is_glob: true };
  }
  const count = deny
    ? Math.max(1, Math.min(scope.bashDenyCount || words.length, words.length))
    : Math.max(1, Math.min(scope.bashAllowCount || words.length, words.length));
  return { command_parts: words.slice(0, count), is_glob: false };
}

export function parseQuestionRequest(params: Json): QuestionRequest {
  const rec = asRecord(params) ?? {};
  const rawQs = rec.questions;
  const questions: QuestionItem[] = [];
  if (Array.isArray(rawQs)) {
    rawQs.forEach((row, i) => {
      const q = asRecord(row);
      if (!q) return;
      const options: QuestionOption[] = [];
      if (Array.isArray(q.options)) {
        for (const opt of q.options) {
          const o = asRecord(opt);
          if (!o) continue;
          options.push({
            id: str(o.id) || null,
            label: str(o.label),
            description: str(o.description),
            preview: str(o.preview) || null,
          });
        }
      }
      questions.push({
        id: str(q.id) || str(q.question) || `q${i}`,
        question: str(q.question),
        options,
        multi: q.multiSelect === true || q.multi_select === true,
      });
    });
  }
  const timeout =
    (typeof rec.timeoutMs === "number" && rec.timeoutMs) ||
    (typeof rec.timeout_ms === "number" && rec.timeout_ms) ||
    (typeof rec.timeoutSeconds === "number" && rec.timeoutSeconds * 1000) ||
    null;
  const mode = str(rec.mode).toLowerCase() === "plan" ? "plan" : "default";
  return {
    sessionId: str(rec.sessionId) || str(rec.session_id),
    toolCallId: str(rec.toolCallId) || str(rec.tool_call_id),
    mode,
    questions,
    timeoutMs: timeout,
  };
}

export function questionAccepted(
  answers: { [k: string]: string[] },
  annotations: { [k: string]: { notes?: string; preview?: string } } | null,
): Json {
  const payload: { [k: string]: Json } = { outcome: "accepted", answers };
  if (annotations && Object.keys(annotations).length) {
    payload.annotations = annotations;
  }
  return payload;
}

export function questionCancelled(): Json {
  return { outcome: "cancelled" };
}

export function questionChat(partial: { [k: string]: string }): Json {
  return { outcome: "chat_about_this", partialAnswers: partial };
}

export function questionSkip(partial: { [k: string]: string }): Json {
  return { outcome: "skip_interview", partialAnswers: partial };
}

export function parsePlanRequest(params: Json): PlanRequest {
  const rec = asRecord(params) ?? {};
  return {
    sessionId: str(rec.sessionId) || str(rec.session_id),
    toolCallId: str(rec.toolCallId) || str(rec.tool_call_id),
    planContent: str(rec.planContent) || str(rec.plan_content),
  };
}

export function planApproved(): Json {
  return { outcome: "approved" };
}

export function planCancelled(feedback?: string): Json {
  return feedback?.trim()
    ? { outcome: "cancelled", feedback: feedback.trim() }
    : { outcome: "cancelled" };
}

export function planAbandoned(): Json {
  return { outcome: "abandoned" };
}

export function yoloChangedParams(clientIdentifier: string): Json {
  return {
    yolo_mode: true,
    permission_mode: "always-approve",
    auto_mode: false,
    clientIdentifier,
  };
}

export type CancelChoice =
  | "stop"
  | "keep"
  | "stop-all"
  | "leave-subagents"
  | "always-stop"
  | "always-continue";

export const CANCEL_SUBAGENTS_PREF_KEY = "grok-web.cancel_subagents";
export type CancelSubagentsPref = "ask" | "always_stop" | "always_continue";

export const CANCEL_OPTIONS: { id: CancelChoice; label: string; hint: string }[] = [
  { id: "stop", label: "停止这次", hint: "取消当前回合，草稿保留" },
  { id: "keep", label: "继续运行", hint: "关掉面板，Agent 接着做" },
];

export const SUBAGENT_CANCEL_OPTIONS: { id: CancelChoice; label: string; hint: string }[] = [
  { id: "stop-all", label: "停止这次，连子 agent 一起停", hint: "父回合和子任务都取消" },
  { id: "leave-subagents", label: "停止这次，留子 agent 跑", hint: "只停当前回合" },
  { id: "always-stop", label: "以后都停子 agent", hint: "记住选择，下次 Stop 不再问" },
  { id: "always-continue", label: "以后都留子 agent", hint: "记住选择，下次 Stop 不再问" },
];

export function parseCancelSubagentsPref(raw: string | null | undefined): CancelSubagentsPref {
  if (raw === "always_stop" || raw === "always_continue") return raw;
  return "ask";
}

export function cancelOptionsFor(runningSubagents: number): typeof CANCEL_OPTIONS {
  return runningSubagents > 0 ? SUBAGENT_CANCEL_OPTIONS : CANCEL_OPTIONS;
}

export function cancelSubagentsForChoice(choice: CancelChoice): boolean | null {
  if (choice === "keep") return null;
  if (choice === "leave-subagents" || choice === "always-continue") return false;
  return true;
}

export function prefFromCancelChoice(choice: CancelChoice): "always_stop" | "always_continue" | null {
  if (choice === "always-stop") return "always_stop";
  if (choice === "always-continue") return "always_continue";
  return null;
}
