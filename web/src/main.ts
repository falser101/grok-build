import { AcpClient, buildWsUrl, type Json, type SessionUpdate } from "./acp";
import {
  CLIENT_IDENTIFIER,
  CLIENT_VERSION,
  DEFAULT_WS_URL,
  TAB_LOCK_CHANNEL,
  buildInitializeParams,
  buildSessionCancelParams,
  buildSessionLoadParams,
} from "./protocol";
import {
  CONNECTING_COPY,
  ackConsent,
  afterEagerAuthFailure,
  asRecord,
  buildApiKeySetParams,
  buildAuthCancelParams,
  buildAuthenticateParams,
  buildFolderTrustResponse,
  buildLogoutParams,
  buildPrivacyParams,
  buildSessionListParams,
  buildSessionNewParams,
  buildSubmitCodeParams,
  buildWorktreeCreateParams,
  claudeImportVisible,
  classifyConnectFailure,
  composerSendAllowed,
  consentAlreadyAcked,
  doctorCopy,
  extResultPayload,
  folderTrustOutcomeFromUser,
  handshakePlan,
  loginLabel as loginLabelFromMethods,
  parseConsent,
  parseInitialize,
  parsePaywall,
  parseSessionList,
  persistDockFields,
  startupAuthDecision,
  welcomeVersionLine,
  type AuthMethodInfo,
  type FolderTrustOutcome,
  type InitializeSnapshot,
  type PaywallInfo,
  type SessionListEntry,
  type StartupAuthDecision,
} from "./startup";

const DEFAULT_WS = DEFAULT_WS_URL;
const DEFAULT_CWD = "/home/falser/Projects/grok-build";
const TAB_ID = crypto.randomUUID();

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

const app = $("app");
const wsUrl = $<HTMLInputElement>("ws-url");
const secret = $<HTMLInputElement>("secret");
const cwd = $<HTMLInputElement>("cwd");
const btnConnect = $<HTMLButtonElement>("btn-connect");
const btnDisconnect = $<HTMLButtonElement>("btn-disconnect");
const btnNew = $<HTMLButtonElement>("btn-new");
const btnLogout = $<HTMLButtonElement>("btn-logout");
const btnSwitch = $<HTMLButtonElement>("btn-switch-account");
const btnSend = $<HTMLButtonElement>("btn-send");
const promptEl = $<HTMLTextAreaElement>("prompt");
const thread = $<HTMLElement>("thread");
const banner = $<HTMLElement>("banner");
const warningsEl = $("startup-warnings");
const connDot = $("conn-dot");
const connLabel = $("conn-label");
const sessionLabel = $("session-label");
const hint = $("hint");
const composer = $<HTMLFormElement>("composer");
const connecting = $("connecting");
const connectingCopy = $("connecting-copy");
const doctor = $("doctor");
const doctorCopyEl = $("doctor-copy");
const loginEl = $("login");
const loginHint = $("login-hint");
const btnLoginPrimary = $<HTMLButtonElement>("btn-login-primary");
const loginBrowserHint = $("login-browser-hint");
const apiKeyInput = $<HTMLInputElement>("api-key");
const authCodeInput = $<HTMLInputElement>("auth-code");
const authenticating = $("authenticating");
const authProviderName = $("auth-provider-name");
const welcomeEl = $("welcome");
const welcomeCwd = $("welcome-cwd");
const welcomeVersion = $("welcome-version");
const versionBadge = $("version-badge");
const planBadge = $("plan-badge");
const consentBanner = $("consent-banner");
const paywallEl = $("paywall");
const paywallCopy = $("paywall-copy");
const paywallLink = $<HTMLAnchorElement>("paywall-link");
const workspaceAck = $("workspace-ack");
const trustDialog = $("trust-dialog");
const trustCopy = $("trust-copy");
const btnContinue = $<HTMLButtonElement>("btn-continue");
const btnWelcomeNew = $<HTMLButtonElement>("btn-welcome-new");
const btnWorktree = $<HTMLButtonElement>("btn-worktree");
const btnImportClaude = $<HTMLButtonElement>("btn-import-claude");

const acp = new AcpClient();

let sessionId: string | null = null;
let lastEventId: string | null = null;
let wantOpen = false;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
let liveAgent: HTMLElement | null = null;
let liveThink: HTMLElement | null = null;
let follow = true;
let turnRunning = false;
let yoloMode = false;
let autoMode = false;
let stolen = false;
let authenticated = false;
let trustPending = false;
let workspaceAckPending = false;
let paywallBlocked = false;
let snapshot: InitializeSnapshot | null = null;
let authMethods: AuthMethodInfo[] = [];
let authDecision: StartupAuthDecision | null = null;
let paywall: PaywallInfo | null = null;
let recentSessions: SessionListEntry[] = [];
let handshakeCalls: string[] = [];
let initialized = false;
let authRequestSeq = 1;
let authInFlight: Promise<Json> | null = null;
let trustResolve: ((outcome: FolderTrustOutcome) => void) | null = null;
let localWorkspaceAcked = false;

const tabLock =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(TAB_LOCK_CHANNEL)
    : null;

wsUrl.value = localStorage.getItem("grok-web.ws") ?? DEFAULT_WS;
secret.value = localStorage.getItem("grok-web.secret") ?? "";
cwd.value = localStorage.getItem("grok-web.cwd") ?? DEFAULT_CWD;
connectingCopy.textContent = CONNECTING_COPY;
showEmpty();
applyComposerGate();

function markPhase(phase: string) {
  const prev = app.getAttribute("data-phases") ?? "";
  const parts = prev ? prev.split(",") : [];
  if (parts[parts.length - 1] !== phase) parts.push(phase);
  app.setAttribute("data-phases", parts.join(","));
  app.dataset.surface = phase;
}

function showSurface(
  name: "idle" | "connecting" | "doctor" | "login" | "welcome" | "session",
) {
  connecting.hidden = name !== "connecting";
  doctor.hidden = name !== "doctor";
  loginEl.hidden = name !== "login";
  welcomeEl.hidden = name !== "welcome";
  markPhase(name);
}

function setState(state: "idle" | "busy" | "live" | "error", label: string) {
  connDot.dataset.state = state;
  connLabel.textContent = label;
}

function showBanner(text: string | null, reason: string | null = null) {
  if (!text) {
    banner.hidden = true;
    banner.textContent = "";
    banner.removeAttribute("data-reason");
    return;
  }
  banner.hidden = false;
  banner.textContent = text;
  if (reason) banner.setAttribute("data-reason", reason);
  else banner.removeAttribute("data-reason");
}

function showWarnings(items: string[]) {
  if (!items.length) {
    warningsEl.hidden = true;
    warningsEl.textContent = "";
    return;
  }
  warningsEl.hidden = false;
  warningsEl.textContent = items.join(" · ");
}

function showEmpty() {
  thread.replaceChildren();
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = "连上本机 grok agent serve 之后，从 Welcome 开会话或直接在输入框说话。";
  thread.append(p);
}

function appendBubble(kind: string, who: string, text: string): HTMLElement {
  if (thread.querySelector(".empty")) thread.replaceChildren();
  const el = document.createElement("article");
  el.className = `bubble ${kind}`;
  const w = document.createElement("span");
  w.className = "who";
  w.textContent = who;
  const body = document.createElement("div");
  body.className = "body";
  body.textContent = text;
  el.append(w, body);
  thread.append(el);
  if (follow) el.scrollIntoView({ block: "end" });
  return el;
}

function bodyOf(el: HTMLElement): HTMLElement {
  return el.querySelector(".body") ?? el;
}

thread.addEventListener("scroll", () => {
  const gap = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
  follow = gap < 48;
});

function persistFields() {
  persistDockFields(
    {
      url: wsUrl.value.trim(),
      secret: secret.value,
      cwd: cwd.value.trim(),
    },
    localStorage,
  );
}

function applyComposerGate() {
  const allowed =
    acp.connected &&
    composerSendAllowed({
      authenticated,
      trustPending,
      workspaceAckPending,
      paywallBlocked,
    });
  promptEl.disabled = !allowed;
  btnSend.disabled = !allowed;
  btnNew.disabled = !acp.connected || !authenticated || trustPending || workspaceAckPending;
  btnWelcomeNew.disabled = !acp.connected || !authenticated || workspaceAckPending;
  btnWorktree.disabled = !acp.connected || !authenticated || workspaceAckPending;
  btnContinue.disabled = !acp.connected || !authenticated || recentSessions.length === 0;
  btnLogout.hidden = !acp.connected;
  btnSwitch.hidden = !acp.connected || !authenticated;
}

async function acpCall(method: string, params: Json): Promise<Json> {
  handshakeCalls.push(method);
  return acp.request(method, params);
}

acp.onNotification = (method, params) => {
  handleAgentEvent(method, params);
};

acp.onRequest = async (req) => {
  handleAgentEvent(req.method, req.params);
  if (req.method === "x.ai/folder_trust/request") {
    return await promptFolderTrust(req.params);
  }
  if (req.method === "session/request_permission") {
    appendBubble(
      "sys",
      "system",
      "Agent 要权限。Slice 0 会取消这次请求。请用 --always-approve 启动 serve。",
    );
    return { outcome: { outcome: "cancelled" } } as Json;
  }
  if (req.method === "x.ai/ask_user_question") {
    appendBubble("sys", "system", "提问卡：Slice 0 回复 cancelled。");
    return { outcome: "cancelled" };
  }
  if (req.method === "x.ai/exit_plan_mode") {
    return { outcome: "approved" };
  }
  return {};
};

acp.onClose = (ev) => {
  applyComposerGate();
  if (!wantOpen || stolen) {
    return;
  }
  showBanner(
    `连接断开 (${ev.code})。正在重连（initialize → authenticate → session/load）…`,
    "reconnect",
  );
  scheduleReconnect();
};

tabLock?.addEventListener("message", (ev: MessageEvent) => {
  const data = ev.data as { type?: string; tabId?: string } | null;
  if (data?.type !== "claimed" || data.tabId === TAB_ID) return;
  if (!wantOpen && !acp.connected) return;
  markStolen();
});

function markStolen() {
  stolen = true;
  wantOpen = false;
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  turnRunning = false;
  acp.disconnect();
  setConnectedUi(false);
  applyComposerGate();
  setState("error", "已被占用");
  showBanner(
    "连接已被其他标签占用。serve 同时只转发一条 WebSocket。点「连接」可抢回。",
    "stolen",
  );
}

function claimTabLock() {
  tabLock?.postMessage({ type: "claimed", tabId: TAB_ID });
}

function handleAgentEvent(method: string, params: Json) {
  if (method !== "session/update" && method !== "x.ai/session/update") {
    if (method === "x.ai/session/prompt_complete") {
      liveAgent = null;
      liveThink = null;
      setState("live", "已连接");
      hint.textContent = "Enter 发送 · Shift+Enter 换行";
    }
    return;
  }
  const rec = asRecord(params);
  const update = (rec?.update ?? rec) as SessionUpdate["update"];
  const meta = asRecord(rec?._meta ?? rec?.meta ?? null);
  const eventId =
    (meta && typeof meta.eventId === "string" && meta.eventId) ||
    (meta && typeof meta.event_id === "string" && meta.event_id) ||
    null;
  if (eventId) lastEventId = eventId;

  const kind = update?.sessionUpdate;
  if (kind === "agent_message_chunk") {
    const chunk = textFromUpdate(update);
    if (!liveAgent) liveAgent = appendBubble("agent", "grok", "");
    bodyOf(liveAgent).textContent += chunk;
    if (follow) liveAgent.scrollIntoView({ block: "end" });
  } else if (kind === "agent_thought_chunk") {
    const chunk = textFromUpdate(update);
    if (!liveThink) liveThink = appendBubble("think", "thinking", "");
    bodyOf(liveThink).textContent += chunk;
    if (follow) liveThink.scrollIntoView({ block: "end" });
  } else if (kind === "tool_call" || kind === "tool_call_update") {
    const title =
      (typeof update?.title === "string" && update.title) ||
      (typeof update?.kind === "string" && update.kind) ||
      "tool";
    const status = typeof update?.status === "string" ? update.status : kind;
    appendBubble("tool", "tool", `${title} · ${status}`);
  }
}

function textFromUpdate(update: SessionUpdate["update"]): string {
  const content = update?.content;
  if (content && typeof content === "object" && "text" in content) {
    return String(content.text ?? "");
  }
  return "";
}

async function promptFolderTrust(params: Json): Promise<Json> {
  trustPending = true;
  applyComposerGate();
  const rec = asRecord(params);
  const folder =
    (typeof rec?.cwd === "string" && rec.cwd) ||
    (typeof rec?.workspace === "string" && rec.workspace) ||
    cwd.value.trim();
  trustCopy.textContent = `首次在此文件夹运行（${folder}）。是否信任？默认不自动 YOLO。`;
  trustDialog.hidden = false;
  if (app.dataset.surface !== "session") showSurface("welcome");
  const outcome = await new Promise<FolderTrustOutcome>((resolve) => {
    trustResolve = resolve;
  });
  trustDialog.hidden = true;
  trustPending = false;
  applyComposerGate();
  return buildFolderTrustResponse(folderTrustOutcomeFromUser(outcome));
}

function renderLogin() {
  const label =
    authDecision?.loginLabel ||
    loginLabelFromMethods(authMethods) ||
    "grok.com";
  btnLoginPrimary.textContent = label;
  loginBrowserHint.hidden = authDecision?.authStartMode !== "command";
  loginHint.textContent = `用「${label}」登录，或粘贴 API key。API key 不会写入 localStorage。`;
  authenticating.hidden = true;
  showSurface("login");
  authenticated = false;
  setConnectedUi(acp.connected);
  applyComposerGate();
  hint.textContent = "未登录，发送已禁用";
}

function renderWelcome() {
  const directory =
    snapshot?.cwd || cwd.value.trim() || DEFAULT_CWD;
  welcomeCwd.textContent = directory;
  const version = welcomeVersionLine(
    snapshot?.agentVersion ?? null,
    CLIENT_VERSION,
    CLIENT_IDENTIFIER,
  );
  welcomeVersion.textContent = version;
  versionBadge.textContent = version;
  btnImportClaude.hidden = !(snapshot && claudeImportVisible(snapshot));
  showWarnings(snapshot?.startupWarnings ?? []);
  workspaceAck.hidden = !workspaceAckPending;
  showSurface("welcome");
  setConnectedUi(true);
  applyComposerGate();
  hint.textContent = "已登录。继续上次、开新会话，或直接输入。";
}

async function afterAuthenticated(authMeta: Json | null) {
  authenticated = true;
  authenticating.hidden = true;
  applyComposerGate();
  try {
    const sub = asRecord(
      extResultPayload(await acpCall("x.ai/auth/check_subscription", {})),
    );
    const meta = (sub?.meta as Json | undefined) ?? authMeta;
    applyAuthMeta(meta ?? authMeta);
  } catch {
    applyAuthMeta(authMeta);
  }
  try {
    const info = extResultPayload(await acpCall("x.ai/auth/info", {}));
    applyAuthMeta(info);
  } catch {
    /* optional */
  }
  try {
    recentSessions = parseSessionList(
      await acpCall("x.ai/session/list", buildSessionListParams(cwd.value.trim() || DEFAULT_CWD)),
    );
  } catch {
    recentSessions = [];
  }
  applyComposerGate();
}

function applyAuthMeta(raw: Json | null) {
  if (!raw) return;
  paywall = parsePaywall(raw);
  paywallBlocked = paywall.blocked;
  if (paywall.blocked) {
    paywallEl.hidden = false;
    paywallCopy.textContent = paywall.message ?? "额度用尽";
    paywallLink.href = paywall.url;
  } else {
    paywallEl.hidden = true;
  }
  if (paywall.subscriptionTier) {
    planBadge.hidden = false;
    planBadge.textContent = paywall.subscriptionTier;
  }
  const consent = parseConsent(raw);
  const showConsent = !consentAlreadyAcked(localStorage, consent.email);
  consentBanner.hidden = !showConsent;
  $("btn-consent-in").toggleAttribute("disabled", consent.zdr);
  $("btn-consent-out").toggleAttribute("disabled", consent.zdr);
  applyComposerGate();
}

async function handshake(resume: boolean): Promise<void> {
  handshakeCalls = [];
  if (!initialized) {
    setState("busy", "initialize…");
    markPhase("initialize");
    const init = await acpCall("initialize", buildInitializeParams(CLIENT_VERSION));
    if (handshakeCalls[0] !== "initialize") {
      throw new Error("连接后第一条必须是 initialize");
    }
    snapshot = parseInitialize(init);
    initialized = true;
  }
  if (!snapshot) throw new Error("missing initialize snapshot");
  authMethods = snapshot.authMethods;
  cwd.value = cwd.value.trim() || snapshot.cwd || DEFAULT_CWD;
  workspaceAckPending = snapshot.localWorkspace !== null && !localWorkspaceAcked;
  const planned = startupAuthDecision(authMethods, snapshot.defaultAuthMethodId);
  authDecision = planned;
  void handshakePlan(planned);

  if (!planned.needsLogin && planned.eagerMethodId) {
    try {
      const auth = await acpCall(
        "authenticate",
        buildAuthenticateParams(planned.eagerMethodId, { headless: true }),
      );
      await afterAuthenticated(auth);
      if (resume && sessionId) {
        await loadSession(sessionId);
        return;
      }
      renderWelcome();
      setState("live", "已连接");
      return;
    } catch (e) {
      authDecision = afterEagerAuthFailure(authMethods);
      if (!authDecision.needsLogin) {
        renderLogin();
        showBanner(e instanceof Error ? e.message : String(e));
        setState("live", "已连接");
        return;
      }
    }
  }

  if (resume && sessionId && authenticated) {
    await loadSession(sessionId);
    return;
  }
  renderLogin();
  setState("live", "已连接");
}

async function loadSession(id: string): Promise<void> {
  const directory = cwd.value.trim() || DEFAULT_CWD;
  setState("busy", "session/load…");
  const loaded = asRecord(
    await acpCall(
      "session/load",
      buildSessionLoadParams({
        sessionId: id,
        cwd: directory,
        cursor: lastEventId,
        yoloMode,
        autoMode,
      }),
    ),
  );
  if (!loaded) throw new Error("session/load 失败");
  setSession(id);
  showSurface("session");
  appendBubble("sys", "system", `已重连 session ${id}`);
}

async function newSession(): Promise<void> {
  if (workspaceAckPending) {
    renderWelcome();
    workspaceAck.hidden = false;
    throw new Error("请先确认 local workspace");
  }
  liveAgent = null;
  liveThink = null;
  lastEventId = null;
  const directory = cwd.value.trim() || DEFAULT_CWD;
  setState("busy", "session/new…");
  const created = asRecord(
    await acpCall(
      "session/new",
      buildSessionNewParams({
        cwd: directory,
        localWorkspace: localWorkspaceAcked ? snapshot?.localWorkspace : null,
      }),
    ),
  );
  const id =
    (typeof created?.sessionId === "string" && created.sessionId) ||
    (typeof created?.session_id === "string" && created.session_id) ||
    null;
  if (!id) throw new Error("session/new 没有返回 sessionId");
  setSession(id);
  showSurface("session");
  appendBubble("sys", "system", `新 session ${id}`);
}

function setSession(id: string) {
  sessionId = id;
  sessionLabel.textContent = id;
  setState("live", "已连接");
  hint.textContent = "Enter 发送 · Shift+Enter 换行";
  applyComposerGate();
}

function setConnectedUi(on: boolean) {
  btnConnect.disabled = on && authenticated;
  btnDisconnect.disabled = !on;
}

function showDoctor(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const kind = classifyConnectFailure({ message });
  const copy = doctorCopy(kind, message);
  doctorCopyEl.textContent = copy;
  showBanner(copy, kind);
  showSurface("doctor");
  setState("error", "连接失败");
  applyComposerGate();
}

async function connect(): Promise<void> {
  persistFields();
  stolen = false;
  wantOpen = true;
  reconnectAttempt = 0;
  authenticated = false;
  showBanner(null);
  showSurface("connecting");
  setState("busy", CONNECTING_COPY);
  const url = buildWsUrl(wsUrl.value.trim() || DEFAULT_WS, secret.value.trim());
  try {
    if (!acp.connected) {
      await acp.connect(url);
      initialized = false;
    }
    await handshake(Boolean(sessionId));
    claimTabLock();
    setConnectedUi(true);
    applyComposerGate();
  } catch (e) {
    wantOpen = false;
    acp.disconnect();
    setConnectedUi(false);
    showDoctor(e);
    throw e;
  }
}

async function disconnect(): Promise<void> {
  wantOpen = false;
  stolen = false;
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (turnRunning && sessionId && acp.connected) {
    try {
      acp.notify("session/cancel", buildSessionCancelParams(sessionId));
    } catch {
      /* socket may already be dying */
    }
    turnRunning = false;
  }
  acp.disconnect();
  initialized = false;
  authenticated = false;
  applyComposerGate();
  setConnectedUi(false);
  showSurface("idle");
  setState("idle", "已断开");
  hint.textContent = "已断开";
}

function scheduleReconnect(): void {
  if (!wantOpen) return;
  if (reconnectTimer !== null) return;
  const delay = Math.min(10_000, 1000 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  setState("busy", `${Math.round(delay / 1000)}s 后重连`);
  reconnectTimer = window.setTimeout(async () => {
    reconnectTimer = null;
    try {
      const url = buildWsUrl(wsUrl.value.trim() || DEFAULT_WS, secret.value.trim());
      await acp.connect(url);
      initialized = false;
      await handshake(true);
      claimTabLock();
      setConnectedUi(true);
      showBanner(null);
      reconnectAttempt = 0;
      applyComposerGate();
    } catch (e) {
      showBanner(e instanceof Error ? e.message : String(e));
      scheduleReconnect();
    }
  }, delay);
}

async function sendPrompt(text: string): Promise<void> {
  if (!text.trim()) return;
  if (
    !composerSendAllowed({
      authenticated,
      trustPending,
      workspaceAckPending,
      paywallBlocked,
    })
  ) {
    return;
  }
  if (!sessionId) await newSession();
  if (!sessionId) return;
  liveAgent = null;
  liveThink = null;
  appendBubble("user", "you", text);
  setState("busy", "session/prompt…");
  hint.textContent = "生成中";
  turnRunning = true;
  try {
    await acp.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text }],
    });
  } finally {
    turnRunning = false;
  }
  setState("live", "已连接");
  hint.textContent = "Enter 发送 · Shift+Enter 换行";
}

async function startInteractiveLogin(): Promise<void> {
  const methodId =
    authDecision?.loginMethodId ||
    authMethods.find((m) => m.id === "grok.com" || m.id === "oidc")?.id ||
    "grok.com";
  const seq = authRequestSeq++;
  authProviderName.textContent = authDecision?.loginLabel || methodId;
  authenticating.hidden = false;
  try {
    authInFlight = acpCall(
      "authenticate",
      buildAuthenticateParams(methodId, {
        use_oauth: true,
        request_seq: seq,
      }),
    );
    try {
      const urlInfo = asRecord(
        extResultPayload(await acp.request("x.ai/auth/get_url", {})),
      );
      const authUrl = typeof urlInfo?.auth_url === "string" ? urlInfo.auth_url : null;
      if (authUrl) {
        window.open(authUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      /* paste-code path still works */
    }
    const auth = await authInFlight;
    authInFlight = null;
    await afterAuthenticated(auth);
    renderWelcome();
    setState("live", "已连接");
  } catch (e) {
    authInFlight = null;
    authenticating.hidden = true;
    showBanner(e instanceof Error ? e.message : String(e));
  }
}

async function submitApiKey(): Promise<void> {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  await acpCall("x.ai/setApiKey", buildApiKeySetParams(key));
  apiKeyInput.value = "";
  const auth = await acpCall("authenticate", buildAuthenticateParams("xai.api_key"));
  await afterAuthenticated(auth);
  renderWelcome();
  setState("live", "已连接");
}

async function submitAuthCode(): Promise<void> {
  const code = authCodeInput.value.trim();
  if (!code) return;
  await acpCall("x.ai/auth/submit_code", buildSubmitCodeParams(code));
  authCodeInput.value = "";
}

async function cancelAuth(): Promise<void> {
  try {
    await acp.request("x.ai/auth/cancel", buildAuthCancelParams(authRequestSeq - 1));
  } catch {
    /* ignore */
  }
  authenticating.hidden = true;
}

function clearSessionView() {
  sessionId = null;
  lastEventId = null;
  liveAgent = null;
  liveThink = null;
  sessionLabel.textContent = "无 session";
  showEmpty();
}

async function logout(opts: { acp: boolean }): Promise<void> {
  if (opts.acp && acp.connected) {
    try {
      await acp.request("x.ai/auth/logout", buildLogoutParams());
    } catch (e) {
      showBanner(e instanceof Error ? e.message : String(e));
    }
  }
  authenticated = false;
  paywallBlocked = false;
  paywallEl.hidden = true;
  consentBanner.hidden = true;
  clearSessionView();
  renderLogin();
  setState("live", "已连接");
  hint.textContent = "已退出。WebSocket 仍保持。";
}

btnConnect.addEventListener("click", () => {
  connect().catch(() => {
    /* doctor already shown */
  });
});
btnDisconnect.addEventListener("click", () => {
  disconnect().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnNew.addEventListener("click", () => {
  showEmpty();
  newSession().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
$("btn-doctor-retry").addEventListener("click", () => {
  connect().catch(() => {
    /* doctor */
  });
});
btnLoginPrimary.addEventListener("click", () => {
  startInteractiveLogin().catch((e) =>
    showBanner(e instanceof Error ? e.message : String(e)),
  );
});
$("btn-api-key").addEventListener("click", () => {
  submitApiKey().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
$("btn-submit-code").addEventListener("click", () => {
  submitAuthCode().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
$("btn-auth-cancel").addEventListener("click", () => {
  cancelAuth().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnLogout.addEventListener("click", () => {
  logout({ acp: true }).catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnSwitch.addEventListener("click", () => {
  logout({ acp: false }).catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnContinue.addEventListener("click", () => {
  const first = recentSessions[0];
  if (!first) return;
  loadSession(first.sessionId).catch((e) =>
    showBanner(e instanceof Error ? e.message : String(e)),
  );
});
btnWelcomeNew.addEventListener("click", () => {
  newSession().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnWorktree.addEventListener("click", () => {
  (async () => {
    await newSession();
    if (!sessionId) return;
    await acpCall(
      "x.ai/git/worktree/create",
      buildWorktreeCreateParams({
        sessionId,
        sourcePath: cwd.value.trim() || DEFAULT_CWD,
      }),
    );
    appendBubble("sys", "system", "已请求新 worktree");
  })().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnImportClaude.addEventListener("click", () => {
  sendPrompt("/import-claude").catch((e) =>
    showBanner(e instanceof Error ? e.message : String(e)),
  );
});
$("btn-consent-in").addEventListener("click", () => {
  acp
    .request("x.ai/privacy/setCodingDataRetention", buildPrivacyParams(false))
    .then(() => {
      ackConsent(localStorage, null);
      consentBanner.hidden = true;
    })
    .catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
$("btn-consent-out").addEventListener("click", () => {
  acp
    .request("x.ai/privacy/setCodingDataRetention", buildPrivacyParams(true))
    .then(() => {
      ackConsent(localStorage, null);
      consentBanner.hidden = true;
    })
    .catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
$("btn-workspace-ack").addEventListener("click", () => {
  localWorkspaceAcked = true;
  workspaceAckPending = false;
  workspaceAck.hidden = true;
  applyComposerGate();
});
$("btn-trust-yes").addEventListener("click", () => {
  trustResolve?.("trust");
  trustResolve = null;
});
$("btn-trust-no").addEventListener("click", () => {
  trustResolve?.("reject");
  trustResolve = null;
});

composer.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const text = promptEl.value;
  promptEl.value = "";
  sendPrompt(text).catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});

promptEl.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    composer.requestSubmit();
  }
});

secret.addEventListener("change", persistFields);
wsUrl.addEventListener("change", persistFields);
cwd.addEventListener("change", persistFields);

setConnectedUi(false);

declare global {
  interface Window {
    __grokWebTest?: {
      dropSocket: () => void;
      sessionId: () => string | null;
      lastEventId: () => string | null;
      surface: () => string;
      authenticated: () => boolean;
      loginLabel: () => string;
      handshakeCalls: () => string[];
      enterLogin: () => void;
    };
  }
}

window.__grokWebTest = {
  dropSocket: () => acp.dropSocket(),
  sessionId: () => sessionId,
  lastEventId: () => lastEventId,
  surface: () => app.dataset.surface ?? "idle",
  authenticated: () => authenticated,
  loginLabel: () => btnLoginPrimary.textContent ?? "",
  handshakeCalls: () => [...handshakeCalls],
  enterLogin: () => {
    void logout({ acp: false });
  },
};
