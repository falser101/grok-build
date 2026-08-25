export type SlashKind = "pager" | "shell" | "skill";

export type SlashCommand = {
  name: string;
  description: string | null;
  argumentHint: string | null;
  kind?: SlashKind;
};

export type LocalSlash = { name: string; args: string };

/** Canonical pager-local names (and aliases) we intercept before session/prompt. */
export type LocalAction =
  | "exit"
  | "help"
  | "docs"
  | "home"
  | "new"
  | "delete"
  | "fork"
  | "copy"
  | "find"
  | "jump"
  | "history"
  | "export"
  | "transcript"
  | "model"
  | "effort"
  | "always-approve"
  | "plan"
  | "auto"
  | "multiline"
  | "compact-mode"
  | "theme"
  | "timestamps"
  | "timeline"
  | "queue"
  | "rename"
  | "session-info"
  | "login"
  | "logout"
  | "rewind"
  | "resume"
  | "context"
  | "feedback"
  | "settings"
  | "share"
  | "recap"
  | "doctor"
  | "cd"
  | "dashboard"
  | "usage"
  | "privacy"
  | "skills"
  | "mcps"
  | "tasks";

export type SlashPlan =
  | { kind: "local"; name: LocalAction; args: string }
  | { kind: "send"; name: string; args: string; text: string }
  | { kind: "later"; name: string; args: string }
  | { kind: "forbidden"; name: string }
  | { kind: "pass" };

const ALIAS: Record<string, string> = {
  quit: "exit",
  welcome: "home",
  clear: "new",
  yolo: "always-approve",
  ml: "multiline",
  t: "theme",
  title: "rename",
  status: "session-info",
  info: "session-info",
  undo: "rewind",
  m: "model",
  howto: "docs",
  guides: "docs",
  full: "fullscreen",
  "agents-dashboard": "dashboard",
  sessions: "dashboard",
  "show-plan": "view-plan",
  "plan-view": "view-plan",
  config: "settings",
  preferences: "settings",
  prefs: "settings",
  cost: "usage",
  changelog: "release-notes",
  tour: "tutorial",
  onboarding: "tutorial",
  agents: "config-agents",
  plugin: "plugins",
  mem: "memory",
  "terminal-setup": "doctor",
};

const FORBIDDEN = new Set([
  "minimal",
  "fullscreen",
  "gboom",
  "scroll-debug",
  "debug",
  "toggle-mouse-reporting",
  "vim-mode",
]);

/** Later catalog pages — toast unless an existing surface is mapped as local. */
const LATER = new Set([
  "hooks",
  "plugins",
  "marketplace",
  "workflows",
  "voice",
  "import-claude",
  "personas",
  "config-agents",
  "imagine",
]);

const LOCAL_ACTIONS = new Set<string>([
  "exit",
  "help",
  "docs",
  "home",
  "new",
  "delete",
  "fork",
  "copy",
  "find",
  "jump",
  "history",
  "export",
  "transcript",
  "model",
  "effort",
  "always-approve",
  "plan",
  "auto",
  "multiline",
  "compact-mode",
  "theme",
  "timestamps",
  "timeline",
  "queue",
  "rename",
  "session-info",
  "login",
  "logout",
  "rewind",
  "resume",
  "context",
  "feedback",
  "settings",
  "share",
  "recap",
  "doctor",
  "cd",
  "dashboard",
  "usage",
  "privacy",
  "skills",
  "mcps",
  "tasks",
]);

/** Always-on S commands: send `/name` via session/prompt (pager does not consume these). */
const SEND_ALWAYS = new Set(["compact", "flush", "dream", "memory", "remember", "loop"]);

export const LATER_TOAST = "这一档不做";

export const COMPACT_MODE_KEY = "grok-web.compact-mode";

export function canonicalSlashName(raw: string): string {
  const name = raw.toLowerCase();
  return ALIAS[name] ?? name;
}

export function parseSlashToken(text: string): LocalSlash | null {
  const m = /^\/([a-z][\w:-]*)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!m) return null;
  return { name: canonicalSlashName(m[1]!), args: (m[2] ?? "").trim() };
}

export function planSlash(text: string): SlashPlan {
  const parsed = parseSlashToken(text);
  if (!parsed) return { kind: "pass" };
  const { name, args } = parsed;
  if (FORBIDDEN.has(name)) return { kind: "forbidden", name };
  if (LATER.has(name)) return { kind: "later", name, args };
  if (LOCAL_ACTIONS.has(name)) return { kind: "local", name: name as LocalAction, args };
  if (SEND_ALWAYS.has(name) || name.includes(":")) {
    const body = args ? `/${name} ${args}` : `/${name}`;
    return { kind: "send", name, args, text: body };
  }
  const body = args ? `/${name} ${args}` : `/${name}`;
  return { kind: "send", name, args, text: body };
}

/** Colon-form skill send, e.g. `/bundled:imagine …`. Bare `/imagine` stays later-toast. */
export function skillUsedFromPrompt(text: string): string | null {
  const plan = planSlash(text);
  if (plan.kind === "send" && plan.name.includes(":")) return plan.name;
  return null;
}

/** Intercept pager-local / later / forbidden so they never leak as a user prompt. */
export function parseLocalSlash(text: string): LocalSlash | null {
  const plan = planSlash(text);
  if (plan.kind === "local" || plan.kind === "later" || plan.kind === "forbidden") {
    return { name: plan.name, args: plan.kind === "forbidden" ? "" : plan.args };
  }
  return null;
}

export const LOCAL_SLASH: SlashCommand[] = [
  { name: "exit", description: "断开本页连接", argumentHint: null },
  { name: "quit", description: "断开本页连接", argumentHint: null },
  { name: "help", description: "打开命令帮助", argumentHint: null },
  { name: "docs", description: "打开 docs.x.ai", argumentHint: null },
  { name: "howto", description: "打开 docs.x.ai", argumentHint: null },
  { name: "guides", description: "打开 docs.x.ai", argumentHint: null },
  { name: "home", description: "回到会话列表", argumentHint: null },
  { name: "welcome", description: "回到会话列表", argumentHint: null },
  { name: "new", description: "新会话", argumentHint: null },
  { name: "clear", description: "新会话", argumentHint: null },
  { name: "delete", description: "删除当前会话", argumentHint: null },
  { name: "fork", description: "分支当前会话", argumentHint: null },
  { name: "copy", description: "复制最近回复", argumentHint: "n | path" },
  { name: "find", description: "在对话里查找", argumentHint: "query" },
  { name: "jump", description: "跳到某一轮", argumentHint: null },
  { name: "history", description: "提示历史", argumentHint: null },
  { name: "export", description: "导出对话", argumentHint: null },
  { name: "transcript", description: "下载原始记录", argumentHint: null },
  { name: "model", description: "切换模型", argumentHint: "id" },
  { name: "m", description: "切换模型", argumentHint: "id" },
  { name: "effort", description: "思考强度", argumentHint: "low|medium|high|xhigh" },
  { name: "always-approve", description: "始终允许工具", argumentHint: null },
  { name: "plan", description: "进出 Plan 模式", argumentHint: null },
  { name: "yolo", description: "始终允许工具", argumentHint: null },
  { name: "auto", description: "自动权限模式", argumentHint: null },
  { name: "multiline", description: "开关多行输入", argumentHint: null },
  { name: "ml", description: "开关多行输入", argumentHint: null },
  { name: "compact-mode", description: "紧凑密度", argumentHint: null },
  { name: "theme", description: "切换主题", argumentHint: "auto|dark|light" },
  { name: "t", description: "切换主题", argumentHint: "auto|dark|light" },
  { name: "timestamps", description: "开关时间戳", argumentHint: null },
  { name: "timeline", description: "开关时间线", argumentHint: null },
  { name: "queue", description: "打开队列", argumentHint: null },
  { name: "rename", description: "重命名会话", argumentHint: "title" },
  { name: "title", description: "重命名会话", argumentHint: "title" },
  { name: "session-info", description: "会话信息", argumentHint: null },
  { name: "status", description: "会话信息", argumentHint: null },
  { name: "info", description: "会话信息", argumentHint: null },
  { name: "login", description: "登录", argumentHint: null },
  { name: "logout", description: "退出登录", argumentHint: null },
  { name: "rewind", description: "回退到上一轮", argumentHint: null },
  { name: "undo", description: "回退到上一轮", argumentHint: null },
  { name: "resume", description: "打开会话列表", argumentHint: null },
  { name: "context", description: "上下文用量", argumentHint: null },
  { name: "feedback", description: "发送反馈", argumentHint: null },
  { name: "settings", description: "打开设置", argumentHint: null },
  { name: "share", description: "分享会话", argumentHint: null },
  { name: "recap", description: "回顾会话", argumentHint: null },
  { name: "doctor", description: "连接诊断", argumentHint: null },
  { name: "cd", description: "更改 cwd", argumentHint: "path" },
  { name: "usage", description: "这次对话用了多少", argumentHint: null },
  { name: "privacy", description: "编码数据与隐私", argumentHint: null },
  { name: "btw", description: "旁路提问", argumentHint: "question" },
  { name: "compact", description: "压缩上下文（发给 Agent）", argumentHint: "note" },
  { name: "loop", description: "发给 Agent", argumentHint: null },
  { name: "memory", description: "发给 Agent", argumentHint: null },
  { name: "mem", description: "发给 Agent", argumentHint: null },
  { name: "flush", description: "发给 Agent", argumentHint: null },
  { name: "dream", description: "发给 Agent", argumentHint: null },
  { name: "remember", description: "发给 Agent", argumentHint: null },
  { name: "hooks", description: "这一档不做", argumentHint: null },
  { name: "plugins", description: "这一档不做", argumentHint: null },
  { name: "marketplace", description: "这一档不做", argumentHint: null },
  { name: "skills", description: "Skills", argumentHint: null },
  { name: "mcps", description: "MCP", argumentHint: null },
  { name: "dashboard", description: "运行中会话", argumentHint: null },
  { name: "workflows", description: "这一档不做", argumentHint: null },
  { name: "tasks", description: "任务", argumentHint: null },
  { name: "voice", description: "这一档不做", argumentHint: null },
  { name: "import-claude", description: "这一档不做", argumentHint: null },
  { name: "personas", description: "这一档不做", argumentHint: null },
  { name: "config-agents", description: "这一档不做", argumentHint: null },
  { name: "imagine", description: "这一档不做", argumentHint: null },
];

export function slashKind(name: string, source: "local" | "available" = "local"): SlashKind {
  if (name.includes(":")) return "skill";
  const canonical = canonicalSlashName(name);
  if (canonical.includes(":")) return "skill";
  if (source === "available") return "shell";
  if (LOCAL_ACTIONS.has(canonical) || LATER.has(canonical)) return "pager";
  return "shell";
}

export function slashBadgeLabel(kind: SlashKind): "P" | "S" | "skill" {
  if (kind === "pager") return "P";
  if (kind === "shell") return "S";
  return "skill";
}

export function annotateSlash(cmd: SlashCommand, source: "local" | "available"): SlashCommand {
  return { ...cmd, kind: cmd.kind ?? slashKind(cmd.name, source) };
}

/** Composer / palette shortlist. Hand-typed names stay in LOCAL_SLASH. */
export const SLASH_MENU_NAMES = [
  "compact",
  "rewind",
  "recap",
  "btw",
  "find",
  "jump",
  "history",
  "copy",
  "export",
  "loop",
  "tasks",
] as const;

const SLASH_MENU = new Set<string>(SLASH_MENU_NAMES);
const SLASH_MENU_SHELL = new Set(["compact", "loop"]);

export function isCallableSkillName(name: string): boolean {
  return name.includes(":") || canonicalSlashName(name).includes(":");
}

export function menuSlashKind(name: string): SlashKind {
  const canonical = canonicalSlashName(name);
  if (isCallableSkillName(name) || isCallableSkillName(canonical)) return "skill";
  if (SLASH_MENU_SHELL.has(canonical)) return "shell";
  if (SLASH_MENU.has(canonical)) return "pager";
  return slashKind(name);
}

export function menuSlashCommands(
  local: SlashCommand[],
  available: SlashCommand[] = [],
): SlashCommand[] {
  const byName = new Map<string, SlashCommand>();
  for (const cmd of local) byName.set(cmd.name.toLowerCase(), cmd);
  const out: SlashCommand[] = [];
  const seen = new Set<string>();
  for (const name of SLASH_MENU_NAMES) {
    const cmd = byName.get(name);
    if (!cmd) continue;
    const key = cmd.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...cmd, kind: menuSlashKind(cmd.name) });
  }
  for (const cmd of available) {
    if (!isCallableSkillName(cmd.name)) continue;
    const key = cmd.name.toLowerCase();
    if (seen.has(key) || SLASH_MENU.has(canonicalSlashName(cmd.name))) continue;
    seen.add(key);
    out.push({ ...cmd, kind: "skill" });
  }
  return out;
}

export function mergeSlashMenu(
  local: SlashCommand[],
  available: SlashCommand[],
): SlashCommand[] {
  const seen = new Set<string>();
  const out: SlashCommand[] = [];
  for (const cmd of local) {
    const key = cmd.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(annotateSlash(cmd, "local"));
  }
  for (const cmd of available) {
    const key = cmd.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(annotateSlash(cmd, "available"));
  }
  return out;
}

export function slashRunsOnAccept(command: SlashCommand): boolean {
  const plan = planSlash(`/${command.name}`);
  if (plan.kind === "later" || plan.kind === "forbidden" || plan.kind === "local") {
    return !command.argumentHint;
  }
  return false;
}

export function nextThemePref(current: "auto" | "dark" | "light"): "auto" | "dark" | "light" {
  if (current === "auto") return "dark";
  if (current === "dark") return "light";
  return "auto";
}

export function parseThemeArg(args: string): "auto" | "dark" | "light" | null {
  const v = args.trim().toLowerCase();
  if (!v) return null;
  if (v === "auto" || v === "system" || v === "跟随系统" || v === "跟随" || v === "系统") return "auto";
  if (v === "dark" || v === "深" || v === "深色") return "dark";
  if (v === "light" || v === "浅" || v === "浅色") return "light";
  return null;
}

export function parseEffortArg(args: string): string | null {
  const v = args.trim().toLowerCase();
  if (v === "low" || v === "medium" || v === "high" || v === "xhigh") return v;
  return null;
}

export function applyCompactMode(
  on: boolean,
  root: { dataset: { compact?: string } } = document.documentElement,
  store?: Pick<Storage, "setItem">,
): boolean {
  root.dataset.compact = on ? "1" : "0";
  store?.setItem(COMPACT_MODE_KEY, on ? "1" : "0");
  return on;
}

export function loadCompactMode(store: Pick<Storage, "getItem">): boolean {
  return store.getItem(COMPACT_MODE_KEY) === "1";
}

export const HELP_FOOTER = "注：本目录，不是外站。";

/** Built-in commands grok-web actually wires (skip later/forbidden stubs). */
export function wiredHelpCommands(commands: SlashCommand[] = LOCAL_SLASH): SlashCommand[] {
  const seen = new Set<string>();
  const out: SlashCommand[] = [];
  for (const cmd of commands) {
    const canon = canonicalSlashName(cmd.name);
    if (seen.has(canon)) continue;
    if (cmd.description === LATER_TOAST) continue;
    if (LATER.has(canon) || FORBIDDEN.has(canon)) continue;
    seen.add(canon);
    out.push(annotateSlash(cmd, cmd.name.includes(":") ? "available" : "local"));
  }
  return out;
}

export function helpLines(commands: SlashCommand[] = LOCAL_SLASH): string {
  const lines = ["Slash 命令（本页拦截优先，其余发给 Agent）", ""];
  for (const cmd of wiredHelpCommands(commands)) {
    const hint = cmd.argumentHint ? ` ${cmd.argumentHint}` : "";
    const badge = slashBadgeLabel(cmd.kind ?? slashKind(cmd.name));
    lines.push(`/${cmd.name}${hint}  [${badge}]  —  ${cmd.description ?? ""}`);
  }
  lines.push("", HELP_FOOTER);
  return lines.join("\n");
}
