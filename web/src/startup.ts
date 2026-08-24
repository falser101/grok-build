import type { Json } from "./protocol";

export const CONNECTING_COPY = "正在连接本机 grok…";
export const FIRST_ACP_METHOD = "initialize";

/** Tests that fill the dock first use `?noconnect=1`. */
export function autoConnectEnabled(search = ""): boolean {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw).get("noconnect") !== "1";
}

export const DOCK_STORAGE_KEYS = {
  url: "grok-web.ws",
  secret: "grok-web.secret",
  cwd: "grok-web.cwd",
} as const;

const CONSENT_STORAGE_KEY = "grok-web.consent-ack";

export type AuthMethodKind =
  | "xai.api_key"
  | "cached_token"
  | "grok.com"
  | "oidc"
  | "unknown";

export type AuthStartMode = "command" | "pending";

export type AuthMethodInfo = {
  id: string;
  name: string;
  description: string | null;
  externalProvider: boolean;
};

export type StartupAuthDecision = {
  needsLogin: boolean;
  loginLabel: string | null;
  loginMethodId: string | null;
  authStartMode: AuthStartMode;
  eagerMethodId: string | null;
};

export type ComposerGate = {
  authenticated: boolean;
  trustPending: boolean;
  workspaceAckPending: boolean;
  paywallBlocked: boolean;
};

export type ConnectFailureKind = "unauthorized" | "process-down" | "generic";

export type AvailableCommand = {
  name: string;
  description: string | null;
  argumentHint: string | null;
};

export type InitializeSnapshot = {
  grokShell: boolean;
  agentVersion: string | null;
  cwd: string | null;
  availableCommands: AvailableCommand[];
  authMethods: AuthMethodInfo[];
  defaultAuthMethodId: string | null;
  localWorkspace: Json | null;
  startupWarnings: string[];
};

export type PaywallInfo = {
  blocked: boolean;
  message: string | null;
  url: string;
  label: string | null;
  subscriptionTier: string | null;
};

export type ConsentInfo = {
  optOut: boolean;
  zdr: boolean;
  email: string | null;
};

export type SessionListEntry = {
  sessionId: string;
  summary: string;
  cwd: string | null;
  updatedAt: string | null;
  source: string | null;
  lastTurnSummary: string | null;
  sessionKind: string | null;
  adminKind: "build" | "chat";
  worktreeLabel: string | null;
  gitRootDir: string | null;
  sourceWorkspaceDir: string | null;
  repoName: string | null;
  numMessages?: number;
  firstPrompt?: string | null;
  createdAt?: string | null;
  hidden?: boolean;
};

export type FolderTrustOutcome = "trust" | "reject";

export function asRecord(value: Json): { [k: string]: Json } | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { [k: string]: Json })
    : null;
}

/** ACP `SessionNotification.sessionId` (also snake_case). */
export function notificationSessionId(params: Json): string | null {
  const rec = asRecord(params);
  if (!rec) return null;
  if (typeof rec.sessionId === "string" && rec.sessionId) return rec.sessionId;
  if (typeof rec.session_id === "string" && rec.session_id) return rec.session_id;
  return null;
}

/** Updates for another session must not paint the visible timeline. */
export function timelineEventIsForeign(
  eventSessionId: string | null,
  currentSessionId: string | null,
): boolean {
  return Boolean(eventSessionId && currentSessionId && eventSessionId !== currentSessionId);
}

const STREAM_METHODS = new Set([
  "session/update",
  "x.ai/session/update",
  "x.ai/session_notification",
  "x.ai/session/prompt_complete",
]);

/**
 * Front session owns the conversation pane. A background session may only
 * update sidebar/dashboard status — never the visible timeline.
 */
export function isFrontSessionStream(input: {
  method: string;
  eventSessionId: string | null;
  currentSessionId: string | null;
}): boolean {
  if (!STREAM_METHODS.has(input.method)) return true;
  if (!input.eventSessionId || !input.currentSessionId) return true;
  return input.eventSessionId === input.currentSessionId;
}

export function authMethodKind(id: string): AuthMethodKind {
  switch (id) {
    case "xai.api_key":
      return "xai.api_key";
    case "cached_token":
      return "cached_token";
    case "grok.com":
      return "grok.com";
    case "oidc":
      return "oidc";
    default:
      return "unknown";
  }
}

export function needsInteractiveLogin(id: string): boolean {
  const kind = authMethodKind(id);
  return kind === "grok.com" || kind === "oidc";
}

export function parseAuthMethods(init: Json): AuthMethodInfo[] {
  const rec = asRecord(init);
  const raw = rec?.authMethods ?? rec?.auth_methods;
  if (!Array.isArray(raw)) return [];
  const out: AuthMethodInfo[] = [];
  for (const item of raw) {
    const m = asRecord(item);
    if (!m || typeof m.id !== "string") continue;
    const meta = asRecord(m._meta ?? m.meta ?? null);
    out.push({
      id: m.id,
      name: typeof m.name === "string" && m.name.trim() ? m.name : m.id,
      description: typeof m.description === "string" ? m.description : null,
      externalProvider: meta?.external_provider === true,
    });
  }
  return out;
}

export function parseDefaultAuthMethodId(init: Json): string | null {
  const rec = asRecord(init);
  const meta = asRecord(rec?._meta ?? rec?.meta ?? null);
  if (typeof meta?.defaultAuthMethodId === "string") return meta.defaultAuthMethodId;
  if (typeof rec?.defaultAuthMethodId === "string") return rec.defaultAuthMethodId;
  return null;
}

export function selectEagerAuthMethod(
  methods: AuthMethodInfo[],
  defaultAuthMethodId: string | null,
): string | null {
  if (
    defaultAuthMethodId &&
    methods.some((m) => m.id === defaultAuthMethodId)
  ) {
    return defaultAuthMethodId;
  }
  const cached = methods.find((m) => m.id === "cached_token");
  if (cached) return cached.id;
  return methods[0]?.id ?? null;
}

/** Match TUI `startup_auth_metadata`: first advertised method decides interactive vs eager. */
export function startupAuthDecision(
  methods: AuthMethodInfo[],
  defaultAuthMethodId: string | null,
): StartupAuthDecision {
  if (methods.length === 0) {
    return {
      needsLogin: true,
      loginLabel: null,
      loginMethodId: null,
      authStartMode: "pending",
      eagerMethodId: null,
    };
  }
  const first = methods[0];
  const interactive = needsInteractiveLogin(first.id);
  if (interactive) {
    return {
      needsLogin: true,
      loginLabel: first.name,
      loginMethodId: first.id,
      authStartMode: first.externalProvider ? "command" : "pending",
      eagerMethodId: null,
    };
  }
  return {
    needsLogin: false,
    loginLabel: null,
    loginMethodId: null,
    authStartMode: "pending",
    eagerMethodId: selectEagerAuthMethod(methods, defaultAuthMethodId),
  };
}

/** When eager authenticate fails: do not auto-open a browser if api_key was advertised. */
export function afterEagerAuthFailure(
  methods: AuthMethodInfo[],
): StartupAuthDecision {
  if (methods.some((m) => m.id === "xai.api_key")) {
    return {
      needsLogin: false,
      loginLabel: null,
      loginMethodId: null,
      authStartMode: "pending",
      eagerMethodId: null,
    };
  }
  const interactive = methods.find((m) => needsInteractiveLogin(m.id));
  if (!interactive) {
    return {
      needsLogin: true,
      loginLabel: null,
      loginMethodId: null,
      authStartMode: "pending",
      eagerMethodId: null,
    };
  }
  return {
    needsLogin: true,
    loginLabel: interactive.name,
    loginMethodId: interactive.id,
    authStartMode: interactive.externalProvider ? "command" : "pending",
    eagerMethodId: null,
  };
}

export function loginLabel(methods: AuthMethodInfo[]): string | null {
  const interactive = methods.find((m) => needsInteractiveLogin(m.id));
  if (interactive) return interactive.name;
  return methods[0]?.name ?? null;
}

export function handshakePlan(decision: StartupAuthDecision): string[] {
  if (decision.needsLogin || !decision.eagerMethodId) return [FIRST_ACP_METHOD];
  return [FIRST_ACP_METHOD, "authenticate"];
}

export function composerSendAllowed(gate: ComposerGate): boolean {
  return (
    gate.authenticated &&
    !gate.trustPending &&
    !gate.workspaceAckPending &&
    !gate.paywallBlocked
  );
}

/** Fail closed: never auto-YOLO a folder-trust prompt. */
export function defaultFolderTrustOutcome(): FolderTrustOutcome {
  return "reject";
}

export function folderTrustOutcomeFromUser(
  choice: FolderTrustOutcome | null | undefined,
): FolderTrustOutcome {
  return choice === "trust" ? "trust" : "reject";
}

function parseMaybeWsUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  const token = raw.match(/wss?:\/\/[^\s]+/i)?.[0] ?? raw;
  try {
    return new URL(token.replace(/^ws/i, "http"));
  } catch {
    return null;
  }
}

/** Default grok agent serve bind. Live-host WS failures are 401, not "process down". */
export function isLiveServeUrl(url: string, liveWs = "ws://127.0.0.1:2419/ws"): boolean {
  const got = parseMaybeWsUrl(url);
  const live = parseMaybeWsUrl(liveWs);
  if (!got || !live) return false;
  const gotPort = got.port || "80";
  const livePort = live.port || "2419";
  return got.hostname === live.hostname && gotPort === livePort;
}

export function classifyConnectFailure(input: {
  code?: number | null;
  message?: string | null;
  url?: string | null;
}): ConnectFailureKind {
  const message = (input.message ?? "").toLowerCase();
  const code = input.code ?? 0;
  const parsed = parseMaybeWsUrl(input.url) ?? parseMaybeWsUrl(input.message);
  const live = parsed ? isLiveServeUrl(parsed.href.replace(/^http/i, "ws")) : false;
  if (
    message.includes("401") ||
    message.includes("unauthorized") ||
    code === 1008 ||
    code === 4401
  ) {
    return "unauthorized";
  }
  const refused =
    message.includes("econnrefused") || message.includes("failed to connect");
  const errorConnecting = message.includes("error connecting");
  const closedOnOpen =
    message.includes("closed during connect") ||
    message.includes("closed (1") ||
    code === 1006;
  if (parsed && !live && (errorConnecting || refused || closedOnOpen)) {
    return "process-down";
  }
  if (live && (errorConnecting || closedOnOpen || refused)) {
    return "unauthorized";
  }
  if (closedOnOpen) return "unauthorized";
  if (refused || errorConnecting || message.includes("process")) {
    return "process-down";
  }
  return "generic";
}

export function doctorCopy(
  kind: ConnectFailureKind,
  detail?: string | null,
): string {
  const extra = detail?.trim() ? ` 详情：${detail.trim()}` : "";
  const checklist = " /doctor：进程未起、secret 错、401。";
  if (kind === "unauthorized") {
    return (
      "连接失败：secret 错或 401。确认 grok agent serve 的 --secret / GROK_AGENT_SECRET 与页面一致。" +
      checklist +
      extra
    );
  }
  if (kind === "process-down") {
    return (
      "连接失败：本机 grok 进程未起。请先运行 grok agent --always-approve --no-leader serve。" +
      checklist +
      extra
    );
  }
  return `连接失败。${checklist}${extra}`;
}

export function isApiKeyStorageKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes("api-key") ||
    k.includes("apikey") ||
    k.includes("api_key") ||
    k === "xai_api_key" ||
    k.endsWith(".apiKey")
  );
}

export type DockFields = { url: string; secret: string; cwd: string };

export function persistableDockFields(fields: DockFields): DockFields {
  return {
    url: fields.url,
    secret: fields.secret,
    cwd: fields.cwd,
  };
}

/** Writes only dock fields. API keys must never land here. */
export function persistDockFields(
  fields: DockFields,
  storage: Pick<Storage, "setItem">,
): void {
  const allowed = persistableDockFields(fields);
  storage.setItem(DOCK_STORAGE_KEYS.url, allowed.url);
  storage.setItem(DOCK_STORAGE_KEYS.secret, allowed.secret);
  storage.setItem(DOCK_STORAGE_KEYS.cwd, allowed.cwd);
}

export function storageContainsApiKey(storage: Pick<Storage, "length" | "key" | "getItem">): boolean {
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (isApiKeyStorageKey(key)) return true;
    const value = storage.getItem(key) ?? "";
    if (value.startsWith("xai-") && key !== DOCK_STORAGE_KEYS.secret) return true;
  }
  return false;
}

export function parseInitialize(init: Json): InitializeSnapshot {
  const rec = asRecord(init);
  const meta = asRecord(rec?._meta ?? rec?.meta ?? null);
  const warningsRaw = meta?.startupWarnings ?? rec?.startupWarnings;
  const warnings: string[] = [];
  if (Array.isArray(warningsRaw)) {
    for (const w of warningsRaw) {
      if (typeof w === "string") warnings.push(w);
      else {
        const wr = asRecord(w);
        if (typeof wr?.message === "string") warnings.push(wr.message);
      }
    }
  }
  const commandsRaw = meta?.availableCommands;
  const availableCommands: AvailableCommand[] = [];
  if (Array.isArray(commandsRaw)) {
    for (const c of commandsRaw) {
      const cr = asRecord(c);
      if (cr && typeof cr.name === "string") {
        availableCommands.push({
          name: cr.name,
          description: typeof cr.description === "string" ? cr.description : null,
          argumentHint:
            (typeof cr.argumentHint === "string" && cr.argumentHint) ||
            (typeof cr.argument_hint === "string" && cr.argument_hint) ||
            null,
        });
      }
    }
  }
  const localWorkspace =
    (meta && (meta["x.ai/local_workspace"] as Json | undefined)) ??
    (rec && (rec["x.ai/local_workspace"] as Json | undefined)) ??
    null;
  return {
    grokShell: meta?.grokShell === true,
    agentVersion: typeof meta?.agentVersion === "string" ? meta.agentVersion : null,
    cwd:
      (typeof meta?.currentWorkingDirectory === "string" &&
        meta.currentWorkingDirectory) ||
      null,
    availableCommands,
    authMethods: parseAuthMethods(init),
    defaultAuthMethodId: parseDefaultAuthMethodId(init),
    localWorkspace: localWorkspace === undefined ? null : localWorkspace,
    startupWarnings: warnings,
  };
}

export function claudeImportVisible(snapshot: InitializeSnapshot): boolean {
  return snapshot.availableCommands.some((c) => c.name === "import-claude");
}

export function welcomeVersionLine(
  agentVersion: string | null,
  webVersion = "0.1.0",
  identifier = "grok-web",
): string {
  const agent = agentVersion ?? "unknown";
  return `${identifier} ${webVersion} · agent ${agent}`;
}

export function parsePaywall(authMeta: Json | null): PaywallInfo {
  const rec = asRecord(authMeta);
  const gate = asRecord(rec?.gate ?? null);
  const message = typeof gate?.message === "string" ? gate.message : null;
  const url =
    (typeof gate?.url === "string" && gate.url) || "https://grok.com";
  const label = typeof gate?.label === "string" ? gate.label : null;
  const subscriptionTier =
    typeof rec?.subscription_tier === "string"
      ? rec.subscription_tier
      : typeof rec?.subscriptionTier === "string"
        ? rec.subscriptionTier
        : null;
  return {
    blocked: Boolean(message),
    message,
    url,
    label,
    subscriptionTier,
  };
}

export function parseConsent(authMeta: Json | null): ConsentInfo {
  const rec = asRecord(authMeta);
  const optOut =
    rec?.coding_data_retention_opt_out === true ||
    rec?.codingDataRetentionOptOut === true;
  return {
    optOut,
    zdr: rec?.is_zdr === true || rec?.isZdr === true,
    email: typeof rec?.email === "string" ? rec.email : null,
  };
}

export function consentAlreadyAcked(
  storage: Pick<Storage, "getItem">,
  email: string | null,
): boolean {
  const raw = storage.getItem(CONSENT_STORAGE_KEY);
  if (!raw) return false;
  if (!email) return raw === "1" || raw.length > 0;
  return raw === email || raw === "1";
}

export function ackConsent(storage: Pick<Storage, "setItem">, email: string | null): void {
  storage.setItem(CONSENT_STORAGE_KEY, email ?? "1");
}

export function parseSessionList(payload: Json): SessionListEntry[] {
  return parseSessionListPage(payload).sessions;
}

/** One `x.ai/session/list` page. Omit cwd on the request to list every directory. */
export function parseSessionListPage(payload: Json): {
  sessions: SessionListEntry[];
  nextCursor: string | null;
} {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload);
  const rows = inner?.sessions;
  const sessions: SessionListEntry[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const r = asRecord(row);
      const sessionId =
        (typeof r?.sessionId === "string" && r.sessionId) ||
        (typeof r?.session_id === "string" && r.session_id) ||
        null;
      if (!sessionId) continue;
      const meta = asRecord(r?._meta ?? r?.meta ?? null);
      const sessionMeta = asRecord(meta?.["x.ai/session"] ?? null);
      const kindRaw =
        (typeof sessionMeta?.kind === "string" && sessionMeta.kind) ||
        (typeof r?.sessionKind === "string" && r.sessionKind) ||
        "build";
      const rawSummary =
        (typeof r?.summary === "string" && r.summary) ||
        (typeof r?.title === "string" && r.title) ||
        "";
      const numRaw = r?.numMessages ?? r?.num_messages;
      sessions.push({
        sessionId,
        // TUI picker drops empty-summary Build rows. Do not fill UUID here.
        summary: rawSummary,
        cwd: typeof r?.cwd === "string" && r.cwd ? r.cwd : null,
        updatedAt:
          (typeof r?.updatedAt === "string" && r.updatedAt) ||
          (typeof r?.updated_at === "string" && r.updated_at) ||
          (typeof r?.lastActiveAt === "string" && r.lastActiveAt) ||
          (typeof r?.last_active_at === "string" && r.last_active_at) ||
          null,
        source: typeof r?.source === "string" ? r.source : null,
        lastTurnSummary:
          (typeof r?.lastTurnSummary === "string" && r.lastTurnSummary) ||
          (typeof r?.last_turn_summary === "string" && r.last_turn_summary) ||
          null,
        sessionKind:
          (typeof r?.sessionKind === "string" && r.sessionKind) ||
          (typeof r?.session_kind === "string" && r.session_kind) ||
          null,
        adminKind: kindRaw === "chat" ? "chat" : "build",
        worktreeLabel:
          (typeof r?.worktreeLabel === "string" && r.worktreeLabel) ||
          (typeof r?.worktree_label === "string" && r.worktree_label) ||
          null,
        gitRootDir:
          (typeof r?.gitRootDir === "string" && r.gitRootDir) ||
          (typeof r?.git_root_dir === "string" && r.git_root_dir) ||
          null,
        sourceWorkspaceDir:
          (typeof r?.sourceWorkspaceDir === "string" && r.sourceWorkspaceDir) ||
          (typeof r?.source_workspace_dir === "string" && r.source_workspace_dir) ||
          null,
        repoName:
          (typeof r?.repoName === "string" && r.repoName) ||
          (typeof r?.repo_name === "string" && r.repo_name) ||
          null,
        numMessages: typeof numRaw === "number" && Number.isFinite(numRaw) ? numRaw : 0,
        firstPrompt:
          (typeof r?.firstPrompt === "string" && r.firstPrompt) ||
          (typeof r?.first_prompt === "string" && r.first_prompt) ||
          null,
        createdAt:
          (typeof r?.createdAt === "string" && r.createdAt) ||
          (typeof r?.created_at === "string" && r.created_at) ||
          null,
        hidden: r?.hidden === true,
      });
    }
  }
  const nextCursor =
    (typeof inner?.nextCursor === "string" && inner.nextCursor) ||
    (typeof inner?.next_cursor === "string" && inner.next_cursor) ||
    null;
  return { sessions, nextCursor };
}

export function localWorkspaceRequiresAck(snapshot: InitializeSnapshot): boolean {
  return snapshot.localWorkspace !== null && snapshot.localWorkspace !== undefined;
}

export function buildAuthenticateParams(
  methodId: string,
  extraMeta?: { [k: string]: Json },
): Json {
  return {
    methodId,
    _meta: extraMeta ?? { headless: true },
  };
}

export function buildApiKeySetParams(key: string): Json {
  return { key };
}

export function buildPrivacyParams(optOut: boolean): Json {
  return { codingDataRetentionOptOut: optOut };
}

export function buildFolderTrustResponse(outcome: FolderTrustOutcome): Json {
  return { outcome: folderTrustOutcomeFromUser(outcome) };
}

export function buildLogoutParams(): Json {
  return {};
}

export function buildAuthCancelParams(requestSeq: number): Json {
  return { request_seq: requestSeq };
}

export function buildSubmitCodeParams(code: string): Json {
  return { code };
}

/** Page size for the sidebar. Shell default is 30; we ask for more so one call covers most disks. */
export const SESSION_LIST_PAGE_SIZE = 200;

/**
 * Global picker: **no `cwd`**. `list_summaries(None)` walks all of `~/.grok/sessions`.
 * Passing a cwd only returns that directory (or relaxes if empty).
 */
export function buildSessionListParams(input?: {
  cwd?: string;
  cursor?: string | null;
  limit?: number;
  query?: string;
}): Json {
  const params: { [k: string]: Json } = {
    limit: input?.limit ?? SESSION_LIST_PAGE_SIZE,
  };
  if (input?.cwd) params.cwd = input.cwd;
  if (input?.cursor) params.cursor = input.cursor;
  if (input?.query) params.query = input.query;
  return params;
}

/** Picker must not send cwd — shell then lists every `~/.grok/sessions` directory. */
export function sessionListParamsAreGlobal(params: Json): boolean {
  const rec = asRecord(params);
  return rec !== null && !("cwd" in rec);
}

export function buildWorktreeCreateParams(input: {
  sessionId: string;
  sourcePath: string;
}): Json {
  return {
    sessionId: input.sessionId,
    sourcePath: input.sourcePath,
  };
}

export function buildSessionNewParams(input: {
  cwd: string;
  localWorkspace?: Json | null;
}): Json {
  const params: { [k: string]: Json } = {
    cwd: input.cwd,
    mcpServers: [],
  };
  if (input.localWorkspace) {
    params._meta = { "x.ai/local_workspace": input.localWorkspace };
  }
  return params;
}

export function extResultPayload(result: Json): Json {
  const rec = asRecord(result);
  if (!rec) return result;
  if (rec.result !== undefined) return rec.result as Json;
  return result;
}
