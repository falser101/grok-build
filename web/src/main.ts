import { AcpClient, buildWsUrl, type Json } from "./acp";
import {
  CLIENT_IDENTIFIER,
  CLIENT_VERSION,
  TAB_LOCK_CHANNEL,
  buildInitializeParams,
  buildPickerSessionLoadParams,
  buildSessionCancelParams,
  buildSessionLoadParams,
  buildSessionPromptParams,
  defaultWsUrl,
  resolveInitialWsUrl,
  SCREEN_MODE_WEB,
} from "./protocol";
import {
  CONNECTING_COPY,
  ackConsent,
  afterEagerAuthFailure,
  asRecord,
  autoConnectEnabled,
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
  parseSessionListPage,
  persistDockFields,
  notificationSessionId,
  isFrontSessionStream,
  startupAuthDecision,
  welcomeVersionLine,
  type AuthMethodInfo,
  type FolderTrustOutcome,
  type InitializeSnapshot,
  type PaywallInfo,
  type SessionListEntry,
  type StartupAuthDecision,
} from "./startup";
import { ConversationTimeline, isTurnTerminalKind, railPreview } from "./conversation";
import { enhanceMermaid, patchTimelineItem, renderTimelineItem } from "./conversation_view";
import {
  EFFORT_OPTIONS,
  LOCAL_SLASH,
  applyAtAccept,
  applySlashAccept,
  atQuery,
  buildPromptHistoryParams,
  composerIsFilled,
  nextComposerTextareaHeight,
  drainQueueHead,
  effortChipLabel,
  filterSlashCommands,
  isFollowUpLiteral,
  isQueuedSlash,
  loadComposerPrefs,
  looksLikePlan,
  mapComposerKey,
  parseFuzzyOpen,
  parseFuzzyStatus,
  buildFuzzyOpenParams,
  scopeFuzzyMatches,
  parseLocalSlash,
  parseModelState,
  parsePromptHistory,
  permissionChipLabel,
  parseQueueChanged,
  parseSuggest,
  parseSuggestPrompt,
  pasteTooLarge,
  persistComposerPrefs,
  composerSubmitIntent,
  slashQuery,
  type CatalogModel,
  type ImageChip,
  type QueueItem,
  type SlashCommand,
} from "./composer";
import { applyTheme, loadThemePref, persistThemePref } from "./theme";
import {
  buildSetModeParams,
  cycleSessionMode,
  keepLocalYolo,
  parseCurrentModeUpdate,
  parseSessionPermMode,
  parseShowPlanChip,
  planChipVisible,
  type SessionPermMode,
} from "./session_mode";
import {
  HELP_SHORTCUTS,
  buildPaletteItems,
  closeDialog,
  contextChipText,
  filterPaletteItems,
  formatSlashSubmit,
  groupPaletteItems,
  hashForSession,
  hashForSessions,
  hashForDashboard,
  hintForFocus,
  inferTurnPhase,
  isTypingTarget,
  mapGlobalHotkey,
  openDialog,
  parseContextUsage,
  parseHashRoute,
  turnStatusLabel,
  type PaletteItem,
} from "./palette";
import {
  LATER_TOAST,
  applyCompactMode,
  loadCompactMode,
  mergeSlashMenu,
  parseEffortArg,
  parseThemeArg,
  planSlash,
  slashBadgeLabel,
  slashKind,
  slashRunsOnAccept,
  wiredHelpCommands,
  type SlashKind,
} from "./slash";
import { BlockHost } from "./blocking_view";
import {
  CANCEL_SUBAGENTS_PREF_KEY,
  parseCancelSubagentsPref,
  yoloChangedParams,
} from "./blocking_cards";
import {
  buildCompactParams,
  buildRecapParams,
  buildResumeInWorktreeParams,
  buildRewindExecuteParams,
  buildRewindPointsParams,
  buildSessionCloseParams,
  buildSessionDeleteParams,
  buildSessionForkParams,
  buildSessionInfoParams,
  buildSessionRenameParams,
  buildSessionSearchParams,
  buildShareParams,
  buildWorktreeListParams,
  buildWorktreeSyncParams,
  deepLinkSessionId,
  formatTokenCount,
  groupSessionsByWorkspace,
  pickerDisplayTitle,
  readSessionCache,
  selectVisiblePickerSessions,
  writeSessionCache,
  parseContextBreakdown,
  parseForkNewSessionId,
  parseResumeWorktreeResult,
  parseRewindPoints,
  parseSearchHits,
  parseSessionInfoFields,
  parseShareUrl,
  parseWorktreePath,
} from "./session_ops";
import {
  billingChipText,
  billingIsLow,
  formatPrepaidDollars,
  parseBilling,
  type BillingSnapshot,
} from "./billing";
import {
  DASH_COLLAPSE_KEY,
  DASH_GROUP_LABEL,
  DASH_HELP_SHORTCUTS,
  DASH_PAGE_TITLE,
  DASH_PIN_KEY,
  DASH_STATUS_PHRASE,
  DASH_TITLE,
  applyRosterChanged,
  buildDashGroups,
  dashDotKind,
  inferDashStatus,
  loadIdSet,
  parseRosterChanged,
  parseRosterList,
  peekTailBubbles,
  rosterToSessionEntry,
  saveIdSet,
  togglePinned,
  type DashLive,
  type DashSort,
  type RosterEntry,
} from "./dashboard";
/** Old Slice-0 default; treating it as unset so we don't pin the list to this repo. */
const LEGACY_REPO_CWD = "/home/falser/Projects/grok-build";

function initialCwd(): string {
  const stored = localStorage.getItem("grok-web.cwd") ?? "";
  if (!stored || stored === LEGACY_REPO_CWD) return "";
  return stored;
}

function workspaceCwd(): string {
  return cwd.value.trim() || snapshot?.cwd || "";
}
const TAB_ID = crypto.randomUUID();

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

const app = $("app");
const btnSidebarToggle = $<HTMLButtonElement>("btn-sidebar-toggle");
const btnSidebarOpen = $<HTMLButtonElement>("btn-sidebar-open");
const sidebarResizer = $("sidebar-resizer");
const wsUrl = $<HTMLInputElement>("ws-url");
const secret = $<HTMLInputElement>("secret");
const cwd = $<HTMLInputElement>("cwd");
const btnConnect = $<HTMLButtonElement>("btn-connect");
const btnDisconnect = $<HTMLButtonElement>("btn-disconnect");
const btnNew = $<HTMLButtonElement>("btn-new");
const btnHome = $<HTMLButtonElement>("btn-home");
const sessionTools = $<HTMLDetailsElement>("session-tools");
const sessionSearch = $<HTMLInputElement>("session-search");
const btnInfo = $<HTMLButtonElement>("btn-info");
const btnRename = $<HTMLButtonElement>("btn-rename");
const btnDelete = $<HTMLButtonElement>("btn-delete");
const btnFork = $<HTMLButtonElement>("btn-fork");
const btnRewind = $<HTMLButtonElement>("btn-rewind");
const btnCompact = $<HTMLButtonElement>("btn-compact");
const btnContext = $<HTMLButtonElement>("btn-context");
const btnRecap = $<HTMLButtonElement>("btn-recap");
const btnExport = $<HTMLButtonElement>("btn-export");
const btnTranscript = $<HTMLButtonElement>("btn-transcript");
const btnShare = $<HTMLButtonElement>("btn-share");
const btnCd = $<HTMLButtonElement>("btn-cd");
const btnWorktreeNew = $<HTMLButtonElement>("btn-worktree-new");
const btnWorktreeResume = $<HTMLButtonElement>("btn-worktree-resume");
const btnWorktreeList = $<HTMLButtonElement>("btn-worktree-list");
const btnWorktreeGc = $<HTMLButtonElement>("btn-worktree-gc");
const worktreeOut = $("worktree-out");
const actionModal = $("action-modal");
const actionTitle = $("action-title");
const actionBody = $("action-body");
const actionList = $("action-list");
const btnLogout = $<HTMLButtonElement>("btn-logout");
const btnSwitch = $<HTMLButtonElement>("btn-switch-account");
const btnSend = $<HTMLButtonElement>("btn-send");
const btnAttach = $<HTMLButtonElement>("btn-attach");
const filePick = $<HTMLInputElement>("file-pick");
const btnPermissionChip = $<HTMLButtonElement>("btn-permission-chip");
const modeSeg = $("mode-seg");

const btnModelChip = $<HTMLButtonElement>("btn-model-chip");
const btnEffortChip = $<HTMLButtonElement>("btn-effort-chip");
const composerMenu = $("composer-menu");
const promptEl = $<HTMLTextAreaElement>("prompt");
const thread = $<HTMLElement>("thread");
const banner = $<HTMLElement>("banner");
const warningsEl = $("startup-warnings");
const connDot = $("conn-dot");
const connLabel = $("conn-label");
const sessionLabel = $("session-label");
const hint = $("hint");
const composer = $<HTMLFormElement>("composer");
const queueStrip = $("queue-strip");
const followUpsEl = $("follow-ups");
const imageChipsEl = $("image-chips");
const slashMenu = $("slash-menu");
const slashPicker = $("slash-picker");
const helpCard = $("slash-help-card");
const helpList = $("slash-help-list");
const promptHistoryEl = $("prompt-history");
const btnStop = $<HTMLButtonElement>("btn-stop");
const btnFollow = $<HTMLButtonElement>("btn-follow");
const btnExpandAll = $<HTMLButtonElement>("btn-expand-all");
const btnCollapseAll = $<HTMLButtonElement>("btn-collapse-all");
const enterSendsEl = $<HTMLInputElement>("enter-sends");
const showThinkingEl = $<HTMLInputElement>("show-thinking");
const groupToolsEl = $<HTMLInputElement>("group-tools");
const showTimestampsEl = $<HTMLInputElement>("show-timestamps");
const showRailEl = $<HTMLInputElement>("show-rail");
const combineQueuedEl = $<HTMLInputElement>("combine-queued");
const themePrefEl = $<HTMLSelectElement>("theme-pref");
const threadRail = $("thread-rail");
const railTrack = $("rail-track");
const railPreviewEl = $("rail-preview");
const railPreviewText = $("rail-preview-text");
const railUp = $<HTMLButtonElement>("rail-up");
const railDown = $<HTMLButtonElement>("rail-down");
const railPrevChip = $<HTMLButtonElement>("rail-prev-chip");
const findBar = $("find-bar");
const findInput = $<HTMLInputElement>("find-input");
const findCount = $("find-count");
const jumpPanel = $("jump-panel");
const selectionBar = $("selection-bar");
const atMenu = $("at-menu");
const ghostEl = $("ghost");
const planNudge = $("plan-nudge");
const blockCard = $("block-card");
const blockPill = $<HTMLButtonElement>("block-pill");
const yoloBadge = $("yolo-badge");
const permissionModeEl = $<HTMLSelectElement>("permission-mode");
const cancelSubagentsPrefEl = $<HTMLSelectElement>("cancel-subagents-pref");
const composerPrefix = $("composer-prefix");
const composerWrap = document.querySelector(".composer-input-wrap") as HTMLElement;
const btnInterject = $<HTMLButtonElement>("btn-interject");
const btnSendNow = $<HTMLButtonElement>("btn-send-now");
const turnActionsEl = $("turn-actions");
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
const billingChip = $<HTMLButtonElement>("billing-chip");
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
const sessionListEl = $("session-list");
const sessionPopover = $("session-popover");
const settingsModal = $("settings-modal");
const btnSettings = $<HTMLButtonElement>("btn-settings");
const btnSettingsClose = $<HTMLButtonElement>("btn-settings-close");
const btnHeaderModel = $<HTMLButtonElement>("btn-header-model");
const headerModelMenu = $("header-model-menu");
const headerContext = $<HTMLButtonElement>("header-context");
const headerYolo = $<HTMLButtonElement>("header-yolo");
const headerPlan = $<HTMLButtonElement>("header-plan");
const turnStatusEl = $("turn-status");
const sessionIndex = $("session-index");
const sessionIndexList = $("session-index-list");
const dashboardEl = $("dashboard");
const dashList = $("dash-list");
const dashSearch = $<HTMLInputElement>("dash-search");
const dashPeek = $("dash-peek");
const dashPeekBody = $("dash-peek-body");
const dashPeekMeta = $("dash-peek-meta");
const dashPeekSub = $("dash-peek-sub");
const dashPeekInput = $<HTMLInputElement>("dash-peek-input");
const dashNewInput = $<HTMLInputElement>("dash-new-input");
const appDialog = $("app-dialog");
const appDialogTitle = $("app-dialog-title");
const appDialogBody = $("app-dialog-body");
const appDialogEsc = $("app-dialog-esc");

const acp = new AcpClient();

let sessionId: string | null = null;
let pendingResumeId: string | null = null;
let lastEventId: string | null = null;
let wantOpen = false;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
let turnRunning = false;
let promptEpoch = 0;
let yoloMode = false;
let sessionPermMode: SessionPermMode = "ask";
let showPlanChip: boolean | null = null;

let autoMode = false;
let currentModelId = "";
let currentModelName = "";
let currentEffort = "high";
let catalogModels: CatalogModel[] = [];
let stolen = false;
let authenticated = false;
let trustPending = false;
let workspaceAckPending = false;
let paywallBlocked = false;
let snapshot: InitializeSnapshot | null = null;
let authMethods: AuthMethodInfo[] = [];
let authDecision: StartupAuthDecision | null = null;
let paywall: PaywallInfo | null = null;
let lastBilling: BillingSnapshot | null = null;
let recentSessions: SessionListEntry[] = [];
/** Unfiltered `x.ai/session/list` pages. Visibility is applied in `applyPickerList`. */
let listedSessionsRaw: SessionListEntry[] = [];
let handshakeCalls: string[] = [];
let initialized = false;
let authRequestSeq = 1;
let authInFlight: Promise<Json> | null = null;
let trustResolve: ((outcome: FolderTrustOutcome) => void) | null = null;
let localWorkspaceAcked = false;
let listQuery = "";
let listSearchTimer: number | null = null;
let titlePinned = false;
let lastRecapAt = 0;
const timeline = new ConversationTimeline();
const timelineNodes = new Map<string, HTMLElement>();
const composerPrefs = loadComposerPrefs(localStorage);
let themePref = loadThemePref(localStorage);
applyTheme(themePref);
let compactModeOn = loadCompactMode(localStorage);
applyCompactMode(compactModeOn, document.documentElement, localStorage);
let queuePinned = false;
let queueSelectedId: string | null = null;
let hashSyncing = false;
let sessionListCursor: string | null = null;
let dashSelectedId: string | null = null;
let dashQuery = "";
let dashIdleExpanded = false;
let dashSort: DashSort = "status";
let dashPins = loadIdSet(localStorage, DASH_PIN_KEY);
let dashCollapsed = loadIdSet(localStorage, DASH_COLLAPSE_KEY);
if (!localStorage.getItem(DASH_COLLAPSE_KEY)) dashCollapsed.add("inactive");
const backgroundIds = new Set<string>();
const needsInputIds = new Set<string>();
const loadedIds = new Set<string>();
type ParkedBlock = {
  method: string;
  params: Json;
  resolve: (value: Json) => void;
};
const parkedBlocks = new Map<string, ParkedBlock[]>();
let dashRoster: RosterEntry[] = [];
let dashDeleteArmed: { id: string; at: number } | null = null;
let paletteItems: PaletteItem[] = [];
let paletteIndex = 0;
let paletteQuery = "";
type AppDialogKind = "palette" | "shortcuts" | "args" | "later" | "block" | "sheet" | null;
let appDialogKind: AppDialogKind = null;
timeline.opts.showThinking = composerPrefs.showThinking;
timeline.opts.groupTools = composerPrefs.groupTools;
timeline.opts.showTimestamps = composerPrefs.showTimestamps;
timeline.opts.showRail = composerPrefs.showRail;
let imageChips: ImageChip[] = [];
let localQueue: QueueItem[] = [];
let slashItems: SlashCommand[] = [];
let slashIndex = 0;
type PickerMode = "model" | "theme";
type PickerItem = { id: string; label: string; meta?: string; current?: boolean };
let pickerMode: PickerMode | null = null;
let pickerItems: PickerItem[] = [];
let pickerIndex = 0;
let themePreviewOrig: typeof themePref | null = null;
let historyItems: string[] = [];
let historyIndex = -1;
let sentHistory: string[] = [];
let lastEmptyEnterAt = 0;
let queueIdSeq = 1;
let composerMode: "" | "shell" | "remember" = "";
let ghostText = "";
let atItems: { path: string; score: number }[] = [];
let atIndex = 0;
let fuzzySearchId: string | null = null;
let fuzzySearchKey = "";
let findHits: { id: string; index: number }[] = [];
let findCursor = 0;

const tabLock =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(TAB_LOCK_CHANNEL)
    : null;

const SIDEBAR_WIDTH_KEY = "grok-web.sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "grok-web.sidebar-collapsed";
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 260;

function clampSidebarWidth(n: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

function narrowOverlay() {
  return window.matchMedia("(max-width: 960px)").matches;
}

function applySidebarLayout() {
  const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  const collapsed =
    stored === "1" || (stored === null && narrowOverlay());
  app.dataset.sidebar = collapsed ? "collapsed" : "open";
  const storedWidth = Number.parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? "", 10);
  const width = Number.isFinite(storedWidth) ? clampSidebarWidth(storedWidth) : SIDEBAR_DEFAULT;
  app.style.setProperty("--sidebar-width", `${width}px`);
  btnSidebarToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  btnSidebarToggle.title = collapsed ? "展开侧栏" : "折叠侧栏";
  btnSidebarToggle.setAttribute("aria-label", collapsed ? "展开侧栏" : "折叠侧栏");
}

/** Narrow viewports use a drawer overlay; close it so the user chip is on screen. */
function uncoverChatIfOverlay() {
  if (!narrowOverlay()) return;
  if (app.dataset.sidebar !== "open") return;
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
  applySidebarLayout();
}

function toggleSidebar() {
  const collapsed = app.dataset.sidebar === "collapsed";
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "0" : "1");
  applySidebarLayout();
}

function bindSidebarResize() {
  sidebarResizer.addEventListener("pointerdown", (ev) => {
    if (app.dataset.sidebar === "collapsed") {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "0");
      applySidebarLayout();
      return;
    }
    ev.preventDefault();
    sidebarResizer.setPointerCapture(ev.pointerId);
    app.classList.add("is-resizing");
    const startX = ev.clientX;
    const startW =
      Number.parseInt(getComputedStyle(app).getPropertyValue("--sidebar-width"), 10) ||
      SIDEBAR_DEFAULT;
    const onMove = (e: PointerEvent) => {
      const next = clampSidebarWidth(startW + (e.clientX - startX));
      app.style.setProperty("--sidebar-width", `${next}px`);
    };
    const onUp = (e: PointerEvent) => {
      sidebarResizer.releasePointerCapture(e.pointerId);
      sidebarResizer.removeEventListener("pointermove", onMove);
      sidebarResizer.removeEventListener("pointerup", onUp);
      app.classList.remove("is-resizing");
      const w = Number.parseInt(getComputedStyle(app).getPropertyValue("--sidebar-width"), 10);
      if (Number.isFinite(w)) localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
    };
    sidebarResizer.addEventListener("pointermove", onMove);
    sidebarResizer.addEventListener("pointerup", onUp);
  });
  sidebarResizer.addEventListener("dblclick", () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(SIDEBAR_DEFAULT));
    applySidebarLayout();
  });
  sidebarResizer.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    ev.preventDefault();
    if (app.dataset.sidebar === "collapsed") return;
    const current =
      Number.parseInt(getComputedStyle(app).getPropertyValue("--sidebar-width"), 10) ||
      SIDEBAR_DEFAULT;
    const next = clampSidebarWidth(current + (ev.key === "ArrowRight" ? 16 : -16));
    app.style.setProperty("--sidebar-width", `${next}px`);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next));
  });
}

wsUrl.value = resolveInitialWsUrl(localStorage.getItem("grok-web.ws"));
secret.value = localStorage.getItem("grok-web.secret") ?? "";
cwd.value = initialCwd();
connectingCopy.textContent = CONNECTING_COPY;
applySidebarLayout();
bindSidebarResize();
btnSidebarToggle.addEventListener("click", () => toggleSidebar());
window.matchMedia("(max-width: 960px)").addEventListener("change", () => {
  applySidebarLayout();
  if (app.dataset.surface === "session") uncoverChatIfOverlay();
});
btnSidebarOpen.addEventListener("click", () => toggleSidebar());
enterSendsEl.checked = composerPrefs.enterSends;
showThinkingEl.checked = composerPrefs.showThinking;
groupToolsEl.checked = composerPrefs.groupTools;
showTimestampsEl.checked = composerPrefs.showTimestamps;
showRailEl.checked = composerPrefs.showRail;
combineQueuedEl.checked = composerPrefs.combineQueued;
themePrefEl.value = themePref;
cancelSubagentsPrefEl.value = parseCancelSubagentsPref(
  localStorage.getItem(CANCEL_SUBAGENTS_PREF_KEY),
);
app.dataset.timestamps = composerPrefs.showTimestamps ? "1" : "0";
app.dataset.rail = "0";
showEmpty();
applyComposerGate();
syncComposerChips();
syncComposerFilled();

function recordPhase(phase: string) {
  const prev = app.getAttribute("data-phases") ?? "";
  const parts = prev ? prev.split(",") : [];
  if (parts[parts.length - 1] !== phase) parts.push(phase);
  app.setAttribute("data-phases", parts.join(","));
}

function markPhase(phase: string) {
  recordPhase(phase);
  app.dataset.surface = phase;
}

function showSurface(
  name: "idle" | "connecting" | "doctor" | "login" | "welcome" | "session" | "sessions" | "dashboard",
) {
  connecting.hidden = name !== "connecting";
  doctor.hidden = name !== "doctor";
  loginEl.hidden = name !== "login";
  welcomeEl.hidden = name !== "welcome";
  sessionIndex.hidden = name !== "sessions";
  dashboardEl.hidden = name !== "dashboard";
  markPhase(name);
  if (name === "session") uncoverChatIfOverlay();
  updateComposerDock();
}

function showSessionIndex() {
  renderSessionIndex();
  showSurface("sessions");
  hint.textContent = "已回到列表。连接仍保持。";
  applyComposerGate();
  writeSessionHash();
}

function dashLive(): DashLive {
  const roster = new Map(dashRoster.map((row) => [row.sessionId, { activity: row.activity, resident: row.resident }]));
  const loaded = new Set(loadedIds);
  if (sessionId) loaded.add(sessionId);
  for (const row of dashRoster) {
    if (row.resident) loaded.add(row.sessionId);
  }
  return {
    currentSessionId: sessionId,
    turnRunning,
    queued: localQueue.length > 0,
    blocked: blockHost.busy,
    backgroundIds,
    loadedIds: loaded,
    needsIds: needsInputIds,
    roster: roster.size ? roster : undefined,
    now: Date.now(),
  };
}

function dashSessionRows(): SessionListEntry[] {
  if (dashRoster.length) {
    const mapped = dashRoster.map(rosterToSessionEntry);
    const seen = new Set(mapped.map((s) => s.sessionId));
    for (const extra of recentSessions) {
      if (seen.has(extra.sessionId)) continue;
      mapped.push(extra);
    }
    return mapped;
  }
  return recentSessions;
}

function parkCurrentTurn(): void {
  if (sessionId && (turnRunning || blockHost.busy)) {
    backgroundIds.add(sessionId);
    if (blockHost.busy) needsInputIds.add(sessionId);
    turnRunning = false;
    syncTurnButtons();
    syncTurnStatus();
    renderSessionList();
    if (app.dataset.surface === "dashboard") renderDashboard();
  }
}

function offerBlockMethod(method: string, params: Json): Promise<Json> {
  if (method === "session/request_permission") {
    if (yoloMode) {
      const once = firstAllowOnceFrom(params);
      if (once) return Promise.resolve({ outcome: { outcome: "selected", optionId: once } });
    }
    return blockHost.offerPermission(params);
  }
  if (method === "x.ai/ask_user_question") return blockHost.offerQuestion(params);
  if (method === "x.ai/exit_plan_mode") return blockHost.offerPlan(params);
  if (method === "x.ai/enter_plan_mode" || method === "enter_plan_mode") {
    const rec = asRecord(params) ?? {};
    if (!rec.planContent && !rec.plan_content) {
      rec.planContent = "Agent 请求进入 Plan mode。";
    }
    return blockHost.offerPlan(rec).then((out) => {
      const recOut = asRecord(out);
      if (recOut?.outcome === "approved") void setSessionMode("plan");
      return out;
    });
  }
  return Promise.resolve({});
}

function flushParkedBlocks(sid: string): void {
  const list = parkedBlocks.get(sid);
  if (!list?.length) return;
  parkedBlocks.delete(sid);
  needsInputIds.delete(sid);
  void (async () => {
    for (const item of list) {
      try {
        item.resolve(await offerBlockMethod(item.method, item.params));
      } catch (e) {
        item.resolve({
          error: { message: e instanceof Error ? e.message : String(e) },
        });
      }
    }
    renderSessionList();
    if (app.dataset.surface === "dashboard") renderDashboard();
  })();
}

function noteBackgroundWork(method: string, params: unknown) {
  const rec =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as { [k: string]: unknown })
      : null;
  const hay = `${method} ${JSON.stringify(rec ?? {})}`.toLowerCase();
  const hit =
    hay.includes("task_backgrounded") ||
    hay.includes("task/background") ||
    hay.includes("loop") ||
    hay.includes("monitor") ||
    /\btask\b/.test(hay);
  if (!hit) return;
  const sid =
    (typeof rec?.sessionId === "string" && rec.sessionId) ||
    (typeof rec?.session_id === "string" && rec.session_id) ||
    sessionId;
  if (sid && sid !== sessionId) backgroundIds.add(sid);
}

function endTurn(sid: string | null) {
  if (sid) {
    backgroundIds.delete(sid);
    needsInputIds.delete(sid);
  }
  if (!sid || sid === sessionId) {
    turnRunning = false;
    syncTurnButtons();
    syncTurnStatus();
    if (sessionId) void refreshContextChip(sessionId);
  }
  scheduleSidebarStatus(true);
}

function syncTurnFromRoster() {
  if (!sessionId) return;
  const row = dashRoster.find((r) => r.sessionId === sessionId);
  if (!row) return;
  if (row.activity === "working") return;
  if (row.activity === "needs_input") {
    needsInputIds.add(sessionId);
    scheduleSidebarStatus();
    return;
  }
  if (turnRunning || backgroundIds.has(sessionId)) endTurn(sessionId);
}

function selectedDashEntry(): SessionListEntry | null {
  if (!dashSelectedId) return null;
  return dashSessionRows().find((s) => s.sessionId === dashSelectedId) ?? null;
}

function paintDashPeek() {
  const entry = selectedDashEntry();
  dashPeek.hidden = !entry;
  const body = dashboardEl.querySelector(".dash-body");
  if (body instanceof HTMLElement) body.dataset.peek = entry ? "1" : "0";
  dashPeekBody.replaceChildren();
  if (!entry) {
    dashPeekMeta.textContent = "";
    dashPeekSub.textContent = "";
    return;
  }
  const status = inferDashStatus(entry, dashLive());
  const title = sessionTitle(entry);
  dashPeekMeta.replaceChildren();
  const metaDot = document.createElement("span");
  metaDot.className = "dash-dot";
  metaDot.dataset.kind = dashDotKind(status);
  metaDot.dataset.status = status;
  dashPeekMeta.append(metaDot, document.createTextNode(` ${title} · ${DASH_STATUS_PHRASE[status]}`));
  dashPeekSub.textContent = entry.lastTurnSummary || "";
  const bubbles = entry.sessionId === sessionId
    ? peekTailBubbles(timeline.items, 6)
    : entry.lastTurnSummary
      ? [{ role: "assistant" as const, text: entry.lastTurnSummary }]
      : [];
  if (!bubbles.length) {
    const empty = document.createElement("p");
    empty.className = "dash-empty";
    empty.textContent = "暂无尾部对话。";
    dashPeekBody.append(empty);
    return;
  }
  for (const bubble of bubbles) {
    const el = document.createElement("div");
    el.className = "dash-bubble";
    el.dataset.role = bubble.role;
    if (bubble.time) {
      const time = document.createElement("time");
      time.textContent = bubble.time;
      el.append(time);
    }
    el.append(document.createTextNode(bubble.text));
    dashPeekBody.append(el);
  }
}

function showDashboard() {
  renderDashboard();
  showSurface("dashboard");
  hint.textContent = `${DASH_PAGE_TITLE} · ${DASH_TITLE} · Ctrl+/ 搜索 · Enter 打开 · Esc 回列表`;
  document.title = `${DASH_PAGE_TITLE} · Grok Web`;
  applyComposerGate();
  const next = hashForDashboard();
  if (location.hash !== next) {
    hashSyncing = true;
    history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
    hashSyncing = false;
  }
  void refreshRoster();
}

function renderDashboard() {
  dashList.replaceChildren();
  const rows = dashSessionRows();
  if (!authenticated) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.className = "dash-empty";
    td.textContent = "登录后可查看运行中会话。";
    tr.append(td);
    dashList.append(tr);
    paintDashPeek();
    return;
  }
  const groups = buildDashGroups({
    sessions: rows,
    live: dashLive(),
    pins: dashPins,
    query: dashQuery,
    sort: dashSort,
    idleExpanded: dashIdleExpanded,
  });
  if (!groups.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.className = "dash-empty";
    td.textContent = rows.length ? "没有匹配的会话。" : "还没有会话。用底栏开新会话。";
    tr.append(td);
    dashList.append(tr);
    paintDashPeek();
    return;
  }
  if (dashSelectedId && !rows.some((s) => s.sessionId === dashSelectedId)) {
    dashSelectedId = groups[0]?.rows[0]?.sessionId ?? null;
  }
  for (const group of groups) {
    const collapsed = dashCollapsed.has(group.status);
    const head = document.createElement("tr");
    head.className = "dash-group-row";
    head.dataset.status = group.status;
    head.dataset.collapsed = collapsed ? "1" : "0";
    const cell = document.createElement("td");
    cell.colSpan = 3;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dash-group-toggle";
    const chev = document.createElement("span");
    chev.className = "dash-chevron";
    chev.textContent = "▾";
    btn.append(chev, document.createTextNode(`${group.label} (${group.rows.length + group.overflow})`));
    btn.addEventListener("click", () => {
      dashCollapsed = togglePinned(dashCollapsed, group.status);
      saveIdSet(localStorage, DASH_COLLAPSE_KEY, dashCollapsed);
      renderDashboard();
    });
    cell.append(btn);
    head.append(cell);
    dashList.append(head);
    if (collapsed) continue;
    for (const entry of group.rows) {
      dashList.append(renderDashRow(entry, inferDashStatus(entry, dashLive())));
    }
    if (group.overflow > 0) {
      const moreTr = document.createElement("tr");
      const moreTd = document.createElement("td");
      moreTd.colSpan = 3;
      const more = document.createElement("button");
      more.type = "button";
      more.className = "dash-more";
      more.textContent = `${group.overflow} more`;
      more.addEventListener("click", () => {
        dashIdleExpanded = true;
        renderDashboard();
      });
      moreTd.append(more);
      moreTr.append(moreTd);
      dashList.append(moreTr);
    }
  }
  if (sessionListCursor && !dashRoster.length) {
    const moreTr = document.createElement("tr");
    const moreTd = document.createElement("td");
    moreTd.colSpan = 3;
    const more = document.createElement("button");
    more.type = "button";
    more.className = "dash-load-more";
    more.textContent = "加载更多";
    more.addEventListener("click", () => {
      void loadMoreSessions();
    });
    moreTd.append(more);
    moreTr.append(moreTd);
    dashList.append(moreTr);
  }
  paintDashPeek();
}

function renderDashRow(entry: SessionListEntry, status: ReturnType<typeof inferDashStatus>): HTMLElement {
  const row = document.createElement("tr");
  row.className = "dash-row";
  row.dataset.sessionId = entry.sessionId;
  row.setAttribute("aria-selected", entry.sessionId === dashSelectedId ? "true" : "false");
  const statusTd = document.createElement("td");
  const dot = document.createElement("span");
  dot.className = "dash-dot";
  dot.dataset.kind = dashDotKind(status);
  dot.dataset.status = status;
  dot.title = DASH_GROUP_LABEL[status];
  statusTd.append(dot);
  const mainTd = document.createElement("td");
  const title = document.createElement("span");
  title.className = "dash-row-title";
  title.textContent = `${dashPins.has(entry.sessionId) ? "★ " : ""}${sessionTitle(entry)}`;
  const sub = document.createElement("span");
  sub.className = "dash-row-sub";
  sub.textContent = entry.lastTurnSummary || "";
  mainTd.append(title, sub);
  const actsTd = document.createElement("td");
  const acts = document.createElement("div");
  acts.className = "dash-row-actions";
  const mk = (label: string, fn: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      dashSelectedId = entry.sessionId;
      fn();
    });
    return b;
  };
  acts.append(
    mk("停", () => {
      void stopDashSession(entry);
    }),
    mk("删", () => {
      void deleteSession(entry, true);
    }),
  );
  actsTd.append(acts);
  row.append(statusTd, mainTd, actsTd);
  row.addEventListener("click", (ev) => {
    if (ev.target instanceof HTMLElement && ev.target.closest("button")) return;
    dashSelectedId = entry.sessionId;
    renderDashboard();
  });
  row.addEventListener("dblclick", () => {
    void openDashSession(entry);
  });
  return row;
}

async function openDashSession(entry: SessionListEntry) {
  dashSelectedId = entry.sessionId;
  await openListedSession(entry);
  showSurface("session");
  writeSessionHash();
  applyComposerGate();
}

async function stopDashSession(entry: SessionListEntry) {
  try {
    acp.notify("session/cancel", buildSessionCancelParams(entry.sessionId));
  } catch {
    /* ignore */
  }
  if (entry.sessionId === sessionId) {
    turnRunning = false;
    syncTurnButtons();
    syncTurnStatus();
  }
  backgroundIds.delete(entry.sessionId);
  renderDashboard();
}

async function refreshRoster(): Promise<void> {
  if (!acp.connected || !authenticated) return;
  try {
    dashRoster = parseRosterList(await acpCall("x.ai/sessions/list", {}));
    for (const row of dashRoster) {
      if (row.resident) loadedIds.add(row.sessionId);
    }
    syncTurnFromRoster();
    if (app.dataset.surface === "dashboard") renderDashboard();
  } catch {
    /* serve without roster: fall back to disk list already in recentSessions */
  }
}

function applyPickerList(entries: SessionListEntry[]): SessionListEntry[] {
  return selectVisiblePickerSessions(entries, {
    keepIds: sessionId ? [sessionId] : [],
  });
}

async function loadMoreSessions() {
  if (!sessionListCursor || !acp.connected) return;
  try {
    const { sessions, nextCursor } = parseSessionListPage(
      await acpCall("x.ai/session/list", buildSessionListParams({ cursor: sessionListCursor })),
    );
    const seen = new Set(listedSessionsRaw.map((s) => s.sessionId));
    for (const entry of sessions) {
      if (seen.has(entry.sessionId)) continue;
      seen.add(entry.sessionId);
      listedSessionsRaw.push(entry);
    }
    recentSessions = applyPickerList(listedSessionsRaw);
    sessionListCursor = nextCursor;
    renderDashboard();
    persistSessionCache();
  } catch (e) {
    showBanner(e instanceof Error ? e.message : String(e), "dashboard");
  }
}

async function peekSend(text: string) {
  const entry = selectedDashEntry();
  if (!entry) {
    showBanner("先选中一行再发送", "dashboard");
    return;
  }
  if (entry.sessionId !== sessionId) {
    await openListedSession(entry);
  }
  await submitComposer({ text });
}

function renderSessionIndex() {
  sessionIndexList.replaceChildren();
  if (!authenticated) {
    const p = document.createElement("p");
    p.className = "session-list-empty";
    p.textContent = "登录后，这里会列出工作区会话。";
    sessionIndexList.append(p);
    return;
  }
  if (!recentSessions.length) {
    const p = document.createElement("p");
    p.className = "session-list-empty";
    p.textContent = "还没有会话。点侧栏「新会话」。";
    sessionIndexList.append(p);
    return;
  }
  for (const entry of recentSessions) sessionIndexList.append(renderSessionRow(entry));
}

function updateComposerDock() {
  const dock =
    app.dataset.surface === "session" || timeline.items.some((item) => item.kind === "user" || item.kind === "agent");
  app.dataset.composer = dock ? "dock" : "center";
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
  timeline.clear();
  syncThread();
}

function noteSys(text: string, who = "system") {
  timeline.note(text, who);
  syncThread();
}

const itemHandlers = {
  onCopy: (item: (typeof timeline.items)[number]) => {
    void navigator.clipboard.writeText(item.raw || item.text).catch(() => {
      downloadText("block.txt", item.raw || item.text);
    });
  },
  onToggleRaw: () => {
    syncThread();
  },
  onToggle: (item: (typeof timeline.items)[number]) => {
    if (item.kind === "think") {
      timeline.toggle(item.id);
      return;
    }
    const el = timelineNodes.get(item.id);
    const before = el ? el.getBoundingClientRect().top : 0;
    timeline.toggle(item.id);
    syncThread();
    const afterEl = timelineNodes.get(item.id);
    if (el && afterEl) {
      const delta = afterEl.getBoundingClientRect().top - before;
      thread.scrollTop += delta;
    }
  },
  onView: (item: (typeof timeline.items)[number]) => {
    openBlockPreview(item);
  },
  onFeedback: (item: (typeof timeline.items)[number], text: string) => {
    item.status = "sent";
    item.text = "已记下，谢谢";
    timeline.mark(item);
    syncThread();
    if (!sessionId) return;
    const params: { [k: string]: Json } = { sessionId, feedbackText: text };
    const requestId = item.source?.requestId;
    if (typeof requestId === "string" && requestId) params.requestId = requestId;
    acp.request("x.ai/feedback", params).catch(() => {
      showBanner("反馈没发出去", "feedback");
    });
  },
  onSelect: (item: (typeof timeline.items)[number]) => {
    timeline.select(item.id);
    syncThread();
  },
  onDismissBtw: (item: (typeof timeline.items)[number]) => {
    timeline.dismissBtw(item.id);
    syncThread();
  },
  onOpenImage: (gallery: { src: string; alt: string }[], index: number) =>
    openLightbox(gallery, index),
  onOpenPath: (path: string) => {
    void openToolPath(path);
  },
  onExpandTool: (item: (typeof timeline.items)[number]) => {
    timeline.expandDetail(item.id);
    syncThread();
  },
};

function paintReplayPlaceholder() {
  if (thread.querySelector(".loading-history")) return;
  timelineNodes.clear();
  thread.replaceChildren();
  const p = document.createElement("p");
  p.className = "loading-history";
  p.textContent = "正在载入最新对话…";
  thread.append(p);
  btnFollow.hidden = true;
  threadRail.hidden = true;
}

function scrollToLatest() {
  thread.scrollTop = thread.scrollHeight;
  requestAnimationFrame(() => {
    thread.scrollTop = thread.scrollHeight;
  });
}

let paintQueued = false;
let mermaidTimer = 0;

function requestPaint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(flushPaint);
}

function flushPaint() {
  paintQueued = false;
  syncThread();
}

function syncThread() {
  if (timeline.replayActive) {
    paintReplayPlaceholder();
    return;
  }
  thread.querySelector(".loading-history")?.remove();
  if (!timeline.items.length) {
    timelineNodes.clear();
    thread.replaceChildren();
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "从左侧打开会话，或点「新会话」。";
    thread.append(p);
    attachHelpCard();
    btnFollow.hidden = true;
    threadRail.hidden = true;
    return;
  }
  thread.querySelector(".empty")?.remove();
  const { dirty, full } = timeline.takePaint();
  const keep = new Set<string>();
  let userChanged = full;
  let prev: HTMLElement | null = null;
  for (const item of timeline.items) {
    keep.add(item.id);
    if (item.kind === "user") userChanged = userChanged || dirty.has(item.id);
    let el = timelineNodes.get(item.id);
    if (!el) {
      el = renderTimelineItem(item, itemHandlers);
      timelineNodes.set(item.id, el);
    } else if (full || dirty.has(item.id)) {
      patchTimelineItem(el, item, itemHandlers);
    }
    const before: ChildNode | null = prev ? prev.nextSibling : thread.firstChild;
    if (el !== before) thread.insertBefore(el, before);
    prev = el;
  }
  for (const [id, el] of timelineNodes) {
    if (keep.has(id)) continue;
    el.remove();
    timelineNodes.delete(id);
  }
  btnFollow.hidden = timeline.follow;
  if (timeline.follow) scrollToLatest();
  if (userChanged) renderRail();
  else if (!threadRail.hidden) markActiveRailTick();
  if (turnRunning || timeline.liveAgentId || timeline.liveThinkId) scheduleMermaid();
  else void enhanceMermaid(thread);
  attachHelpCard();
  updateComposerDock();
}

function scheduleMermaid() {
  if (mermaidTimer) window.clearTimeout(mermaidTimer);
  mermaidTimer = window.setTimeout(() => {
    mermaidTimer = 0;
    if (!turnRunning) void enhanceMermaid(thread);
  }, 400);
}

const RAIL_MAX_TICKS = 6;
let lastRailKey = "";

function activeUserId(users: { id: string }[]): string | null {
  if (!users.length) return null;
  const threadBox = thread.getBoundingClientRect();
  let active = users[0]!.id;
  let best = Infinity;
  for (const item of users) {
    const el = timelineNodes.get(item.id);
    if (!el) continue;
    const gap = Math.abs(el.getBoundingClientRect().top - threadBox.top);
    if (gap < best) {
      best = gap;
      active = item.id;
    }
  }
  return active;
}

function windowedUsers<T extends { id: string }>(users: T[], activeId: string | null, max = RAIL_MAX_TICKS): T[] {
  if (users.length <= max) return users;
  const idx = Math.max(0, users.findIndex((u) => u.id === activeId));
  const start = Math.min(Math.max(0, idx - Math.floor((max - 1) / 2)), users.length - max);
  return users.slice(start, start + max);
}

function renderRail() {
  const users = timeline.userTurns();
  const show = timeline.opts.showRail && users.length >= 2;
  threadRail.hidden = !show;
  app.dataset.rail = show ? "1" : "0";
  if (!show) {
    lastRailKey = "";
    railPreviewEl.hidden = true;
    return;
  }
  const active = activeUserId(users);
  const visible = windowedUsers(users, active);
  const key = `${visible.map((u) => u.id).join(",")}|${active ?? ""}`;
  if (key !== lastRailKey) {
    lastRailKey = key;
    railTrack.replaceChildren();
    for (const item of visible) {
      const tick = document.createElement("button");
      tick.type = "button";
      tick.className = "rail-tick";
      tick.dataset.id = item.id;
      tick.addEventListener("mouseenter", (ev) => showRailPreview(item, ev.currentTarget as HTMLElement));
      tick.addEventListener("mouseleave", () => {
        railPreviewEl.hidden = true;
      });
      tick.addEventListener("click", () => jumpToTurn(item.id));
      railTrack.append(tick);
    }
  }
  markActiveRailTick();
}

function showRailPreview(item: { id: string; text: string }, tick: HTMLElement) {
  railPreviewText.textContent = railPreview(item.text);
  railPreviewEl.hidden = false;
  railPreviewEl.dataset.id = item.id;
  const railBox = threadRail.getBoundingClientRect();
  const tickBox = tick.getBoundingClientRect();
  railPreviewEl.style.bottom = "auto";
  railPreviewEl.style.top = `${Math.max(0, tickBox.top - railBox.top - 10)}px`;
}

function jumpToTurn(id: string) {
  timeline.follow = false;
  timeline.select(id);
  timelineNodes.get(id)?.scrollIntoView({ block: "start" });
  markActiveRailTick();
}

function markActiveRailTick() {
  const users = timeline.userTurns();
  if (!users.length) return;
  const active = activeUserId(users);
  for (const tick of railTrack.querySelectorAll<HTMLElement>(".rail-tick")) {
    tick.classList.toggle("active", tick.dataset.id === active);
  }
  const idx = users.findIndex((u) => u.id === active);
  const atStart = idx <= 0;
  const atEnd = idx >= users.length - 1;
  railUp.disabled = atStart;
  railDown.disabled = atEnd;
  railPrevChip.hidden = atStart;
}

function stepRail(dir: number) {
  const users = timeline.userTurns();
  if (!users.length) return;
  const active = railTrack.querySelector(".rail-tick.active") as HTMLElement | null;
  const idx = users.findIndex((u) => u.id === active?.dataset.id);
  const next = users[Math.min(users.length - 1, Math.max(0, (idx < 0 ? 0 : idx) + dir))];
  if (next) jumpToTurn(next.id);
}

thread.addEventListener("scroll", () => {
  const gap = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
  timeline.follow = gap < 48;
  btnFollow.hidden = timeline.follow || timeline.items.length === 0;
  markActiveRailTick();
});

let lightboxGallery: { src: string; alt: string }[] = [];
let lightboxIndex = 0;

function openLightbox(gallery: { src: string; alt: string }[], index: number) {
  if (!gallery.length) return;
  lightboxGallery = gallery;
  lightboxIndex = Math.max(0, Math.min(index, gallery.length - 1));
  paintLightbox();
}

function paintLightbox() {
  const box = $("image-lightbox");
  const img = $<HTMLImageElement>("lightbox-img");
  const count = $("lightbox-count");
  const current = lightboxGallery[lightboxIndex];
  if (!current) {
    box.hidden = true;
    img.src = "";
    return;
  }
  img.src = current.src;
  img.alt = current.alt || "";
  count.textContent = lightboxGallery.length > 1 ? `${lightboxIndex + 1} / ${lightboxGallery.length}` : "";
  box.dataset.single = lightboxGallery.length > 1 ? "0" : "1";
  box.hidden = false;
}

function stepLightbox(dir: number) {
  if (lightboxGallery.length < 2) return;
  lightboxIndex = (lightboxIndex + dir + lightboxGallery.length) % lightboxGallery.length;
  paintLightbox();
}

function closeLightbox() {
  $("image-lightbox").hidden = true;
  $<HTMLImageElement>("lightbox-img").src = "";
  lightboxGallery = [];
  lightboxIndex = 0;
}

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

function syncTurnButtons() {
  btnStop.hidden = !turnRunning;
  turnActionsEl.hidden = !turnRunning;
  btnSend.hidden = false;
  btnSend.setAttribute("aria-label", turnRunning ? "加入队列" : "发送");
  btnSend.title = turnRunning ? "加入队列，当前回复结束后再发（Enter）" : "发送";
  if (turnRunning) {
    hint.textContent = composerPrefs.enterSends
      ? "正在生成 · Enter 入队 · Ctrl+Enter 立即发送"
      : "正在生成 · 点发送入队 · Ctrl+Enter 立即发送";
  }
}

function syncComposerFilled() {
  const filled = composerIsFilled(promptEl.value, imageChips);
  composer.dataset.filled = filled ? "1" : "0";
  promptEl.style.height = "auto";
  const cssMax = parseFloat(getComputedStyle(promptEl).maxHeight);
  promptEl.style.height = `${nextComposerTextareaHeight(
    promptEl.scrollHeight,
    Number.isFinite(cssMax) ? cssMax : undefined,
  )}px`;
}

function syncComposerChips() {
  const mode = yoloMode ? "always-approve" : permissionModeEl.value || "ask";
  btnPermissionChip.textContent = permissionChipLabel(mode);
  btnModelChip.textContent = currentModelName || "模型";
  btnEffortChip.textContent = effortChipLabel(currentEffort);
  const supports = catalogModels.find((m) => m.id === currentModelId)?.supportsEffort ?? true;
  btnEffortChip.hidden = !supports && !currentEffort;
  syncHeaderChips();
}

function syncHeaderChips() {
  btnHeaderModel.textContent = currentModelName || "模型";
  const yoloOn = sessionPermMode === "yolo" || yoloMode;
  headerYolo.hidden = !yoloOn;
  headerYolo.dataset.on = yoloOn ? "1" : "0";
  headerYolo.dataset.danger = yoloOn ? "1" : "0";
  headerYolo.textContent = "YOLO";
  const inPlan = sessionPermMode === "plan";
  headerPlan.hidden = !planChipVisible({ inPlan, showPlanChip });
  headerPlan.dataset.on = inPlan ? "1" : "0";
  headerPlan.textContent = "plan";
  planNudge.hidden = !inPlan;
  if (modeSeg) {
    for (const btn of modeSeg.querySelectorAll<HTMLButtonElement>("button[data-mode]")) {
      btn.setAttribute("aria-selected", btn.dataset.mode === sessionPermMode ? "true" : "false");
    }
  }
  if (!headerContext.textContent?.includes("%")) headerContext.textContent = "上下文 —%";
}

async function setSessionMode(next: SessionPermMode) {
  const prev = sessionPermMode;
  sessionPermMode = next;
  if (next === "yolo") {
    setYoloMode(true);
  } else if (yoloMode) {
    setYoloMode(false);
  }
  if (sessionId && acp.connected && (next === "plan" || prev === "plan")) {
    try {
      await acpCall("session/set_mode", buildSetModeParams(sessionId, next));
    } catch (e) {
      showBanner(e instanceof Error ? e.message : String(e), "plan");
    }
  }
  sessionPermMode = next;
  if (next === "yolo") setYoloMode(true);
  syncComposerChips();
}

function cycleComposerMode() {
  void setSessionMode(cycleSessionMode(sessionPermMode));
}

function applyContextUsage(raw: Json) {
  const usage = parseContextUsage(raw);
  if (usage.percent == null && usage.tokens == null) return;
  headerContext.hidden = false;
  headerContext.textContent = contextChipText(usage);
  headerContext.dataset.hot = usage.percent != null && usage.percent >= 80 ? "1" : "0";
  headerContext.title =
    usage.tokens != null ? `${usage.tokens.toLocaleString()} tokens · ${usage.label}` : usage.label;
  const chip = parseShowPlanChip(raw);
  if (chip != null) showPlanChip = chip;
  const bag =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { [k: string]: unknown })
      : null;
  const mode = parseSessionPermMode(bag?.permission_mode ?? bag?.permissionMode);
  if (mode === "plan" || mode === "yolo") sessionPermMode = mode;
  syncHeaderChips();
}

function writeSessionHash() {
  const next =
    app.dataset.surface === "dashboard"
      ? hashForDashboard()
      : sessionId
        ? hashForSession(sessionId)
        : hashForSessions();
  if (location.hash === next) return;
  hashSyncing = true;
  history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
  hashSyncing = false;
}

function applyHashRoute() {
  if (hashSyncing) return;
  const route = parseHashRoute(location.hash);
  if (route.kind === "dashboard") {
    if (authenticated) showDashboard();
    return;
  }
  if (route.kind === "sessions") {
    if (app.dataset.sidebar !== "open") {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "0");
      applySidebarLayout();
    }
    if (sessionId) leaveSession();
    else if (authenticated) showSessionIndex();
    return;
  }
  if (route.kind === "session" && route.id && route.id !== sessionId) {
    const row = recentSessions.find((s) => s.sessionId === route.id);
    if (row) {
      void openListedSession(row);
      return;
    }
    if (workspaceCwd()) {
      void loadSession(route.id, { cwd: workspaceCwd(), reconnect: false }).catch(() => {
        /* banner */
      });
    }
  }
}

function applyModelState(params: Json) {
  const parsed = parseModelState(params);
  if (parsed.models.length) catalogModels = parsed.models;
  if (parsed.currentId) currentModelId = parsed.currentId;
  if (parsed.currentName) currentModelName = parsed.currentName;
  if (parsed.effort) currentEffort = parsed.effort;
  syncComposerChips();
}

function closeComposerMenu() {
  composerMenu.hidden = true;
  composerMenu.replaceChildren();
}

function openComposerMenu(
  anchor: HTMLElement,
  items: { id: string; label: string; selected?: boolean }[],
  onPick: (id: string) => void,
) {
  composerMenu.replaceChildren();
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "menuitem");
    btn.textContent = item.label;
    if (item.selected) btn.setAttribute("aria-selected", "true");
    btn.addEventListener("click", () => {
      closeComposerMenu();
      onPick(item.id);
    });
    composerMenu.append(btn);
  }
  composerMenu.hidden = false;
  const box = anchor.getBoundingClientRect();
  const host = composer.getBoundingClientRect();
  composerMenu.style.left = `${Math.max(8, box.left - host.left)}px`;
  composerMenu.style.bottom = `${host.bottom - box.top + 6}px`;
  composerMenu.style.top = "auto";
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
  btnSendNow.disabled = !allowed;
  btnAttach.disabled = !allowed;
  btnNew.disabled = !acp.connected || !authenticated || trustPending || workspaceAckPending;
  btnHome.disabled = !acp.connected || !sessionId;
  const hasSession = Boolean(sessionId && acp.connected && authenticated);
  for (const b of [
    btnInfo,
    btnRename,
    btnDelete,
    btnFork,
    btnRewind,
    btnCompact,
    btnContext,
    btnRecap,
    btnExport,
    btnTranscript,
    btnShare,
    btnCd,
    btnWorktreeNew,
    btnWorktreeResume,
    btnExpandAll,
    btnCollapseAll,
  ]) {
    b.disabled = !hasSession;
  }
  syncTurnButtons();
  btnWorktreeList.disabled = !acp.connected || !authenticated;
  btnWorktreeGc.disabled = !acp.connected || !authenticated;
  btnWelcomeNew.disabled = !acp.connected || !authenticated || workspaceAckPending;
  btnWorktree.disabled = !acp.connected || !authenticated || workspaceAckPending;
  btnContinue.disabled = !acp.connected || !authenticated || recentSessions.length === 0;
  btnLogout.hidden = !acp.connected;
  btnSwitch.hidden = !acp.connected || !authenticated;
  sessionListEl.toggleAttribute("inert", !authenticated);
  renderSessionList();
}

async function acpCall(method: string, params: Json): Promise<Json> {
  handshakeCalls.push(method);
  return acp.request(method, params);
}

acp.onNotification = (method, params) => {
  handleAgentEvent(method, params);
};

let lastStopAt = 0;
const blockHost = new BlockHost(blockCard, blockPill, {
  onYolo: () => setYoloMode(true),
  onRejectNote: (text) => {
    if (!sessionId) return;
    acp.request("x.ai/interject", { sessionId, text }).catch(() => {
      /* still rejected */
    });
  },
  onFeedback: (text) => {
    if (!sessionId) return;
    acp.request("x.ai/feedback", { sessionId, feedbackText: text }).catch(() => {
      showBanner("反馈没发出去", "feedback");
    });
  },
  onStop: (cancelSubagents) => stopTurn(cancelSubagents),
  onCancelPref: (pref) => {
    localStorage.setItem(CANCEL_SUBAGENTS_PREF_KEY, pref);
    cancelSubagentsPrefEl.value = pref;
  },
});
syncTurnStatus();

function stopTurn(cancelSubagents: boolean) {
  if (!sessionId) return;
  try {
    acp.notify("session/cancel", buildSessionCancelParams(sessionId, { cancelSubagents }));
  } catch {
    /* ignore */
  }
  turnRunning = false;
  syncTurnButtons();
  syncTurnStatus();
  lastStopAt = Date.now();
  hint.textContent = cancelSubagents ? "已停止，草稿保留" : "已停止这次，子 agent 还在跑";
}

function setYoloMode(on: boolean) {
  yoloMode = on;
  if (on) autoMode = false;
  yoloBadge.hidden = !on;
  permissionModeEl.value = on ? "always-approve" : autoMode ? "auto" : "ask";
  syncComposerChips();
  if (on) {
    try {
      acp.notify("x.ai/yolo_mode_changed", yoloChangedParams(CLIENT_IDENTIFIER));
    } catch {
      /* disconnected */
    }
    blockHost.drainAllowOnce();
  }
}

acp.onRequest = async (req) => {
  if (req.method === "x.ai/folder_trust/request") {
    handleAgentEvent(req.method, req.params);
    return await promptFolderTrust(req.params);
  }
  const blockMethods = new Set([
    "session/request_permission",
    "x.ai/ask_user_question",
    "x.ai/exit_plan_mode",
    "x.ai/enter_plan_mode",
    "enter_plan_mode",
  ]);
  if (blockMethods.has(req.method)) {
    const sid = notificationSessionId(req.params) || sessionId;
    if (sid && sessionId && sid !== sessionId) {
      needsInputIds.add(sid);
      backgroundIds.add(sid);
      renderSessionList();
      if (app.dataset.surface === "dashboard") renderDashboard();
      return await new Promise<Json>((resolve) => {
        const list = parkedBlocks.get(sid) ?? [];
        list.push({ method: req.method, params: req.params, resolve });
        parkedBlocks.set(sid, list);
      });
    }
    return await offerBlockMethod(req.method, req.params);
  }
  handleAgentEvent(req.method, req.params);
  return {};
};

function firstAllowOnceFrom(params: Json): string | null {
  const rec = asRecord(params);
  const options = rec?.options;
  if (!Array.isArray(options)) return null;
  for (const row of options) {
    const o = asRecord(row);
    if (!o) continue;
    const kind = String(o.kind ?? "").toLowerCase().replace(/-/g, "_");
    if (kind === "allow_once" || kind === "allowonce") {
      return (typeof o.optionId === "string" && o.optionId) || (typeof o.option_id === "string" && o.option_id) || null;
    }
  }
  return null;
}

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

function liveToolRunning(): boolean {
  return timeline.items.some((item) => {
    if (item.kind !== "tool" && item.kind !== "subagent" && item.kind !== "workflow") return false;
    const st = (item.status ?? "").toLowerCase().replace(/-/g, "_");
    return st === "pending" || st === "in_progress" || st === "running" || st === "inprogress";
  });
}

function syncTurnStatus() {
  const phase = inferTurnPhase({
    connected: acp.connected && authenticated,
    turnRunning,
    liveTool: liveToolRunning(),
    blocked: blockHost.busy,
  });
  turnStatusEl.textContent = turnStatusLabel(phase);
  turnStatusEl.dataset.phase = phase;
  turnStatusEl.hidden = phase === "idle";
}

let sidebarStatusTimer = 0;
function scheduleSidebarStatus(immediate = false) {
  if (immediate) {
    if (sidebarStatusTimer) {
      window.clearTimeout(sidebarStatusTimer);
      sidebarStatusTimer = 0;
    }
    renderSessionList();
    if (app.dataset.surface === "dashboard") renderDashboard();
    return;
  }
  if (sidebarStatusTimer) return;
  sidebarStatusTimer = window.setTimeout(() => {
    sidebarStatusTimer = 0;
    renderSessionList();
    if (app.dataset.surface === "dashboard") renderDashboard();
  }, 250);
}

function recordBackgroundStream(method: string, params: Json, eventSid: string) {
  const rec = asRecord(params);
  const update = asRecord((rec?.update as Json) ?? rec);
  const kind = typeof update?.sessionUpdate === "string" ? update.sessionUpdate : "";
  if (method === "x.ai/session/prompt_complete" || isTurnTerminalKind(kind)) {
    endTurn(eventSid);
    return;
  }
  const live =
    kind.includes("agent_message") ||
    kind.includes("agent_thought") ||
    kind.startsWith("tool_call") ||
    kind.includes("thought_chunk") ||
    kind === "user_message_chunk";
  if (live) backgroundIds.add(eventSid);
  if (kind === "session_summary_generated" || rec?.session_summary || rec?.sessionSummary) {
    const title =
      (typeof rec?.session_summary === "string" && rec.session_summary) ||
      (typeof rec?.sessionSummary === "string" && rec.sessionSummary) ||
      (typeof rec?.title === "string" && rec.title) ||
      (typeof update?.title === "string" && update.title) ||
      null;
    if (title) {
      const row = recentSessions.find((s) => s.sessionId === eventSid);
      if (row) row.summary = title;
    }
  }
  scheduleSidebarStatus();
}

function handleAgentEvent(method: string, params: Json) {
  noteBackgroundWork(method, params);
  const eventSid = notificationSessionId(params);
  if (
    !isFrontSessionStream({
      method,
      eventSessionId: eventSid,
      currentSessionId: sessionId,
    })
  ) {
    if (eventSid) recordBackgroundStream(method, params, eventSid);
    return;
  }
  if (method === "x.ai/yolo_mode_changed" || method === "x.ai/settings/update") {
    const rec = asRecord(params);
    const mode = rec && (typeof rec.permission_mode === "string" ? rec.permission_mode : typeof rec.permissionMode === "string" ? rec.permissionMode : "");
    const yolo =
      rec?.yolo_mode === true ||
      rec?.yoloMode === true ||
      mode === "always-approve";
    if (yolo || mode === "ask" || mode === "auto") {
      yoloMode = yolo;
      yoloBadge.hidden = !yolo;
      if (mode === "auto" || mode === "ask" || mode === "always-approve") permissionModeEl.value = mode;
      else if (yolo) permissionModeEl.value = "always-approve";
      syncComposerChips();
    }
  }
  if (method === "x.ai/models/update") {
    applyModelState(params);
    return;
  }
  if (method === "session/update" || method === "x.ai/session/update") {
    const rec = asRecord(params);
    const update = asRecord((rec?.update as Json) ?? rec);
    const kind = typeof update?.sessionUpdate === "string" ? update.sessionUpdate : "";
    if (kind === "current_mode_update" || kind === "mode_update") {
      const next = parseCurrentModeUpdate(update ?? params);
      if (next) {
        sessionPermMode = keepLocalYolo(sessionPermMode, next);
        if (sessionPermMode === "yolo") setYoloMode(true);
        else if (yoloMode) setYoloMode(false);
        syncComposerChips();
      }
    }
    if (kind === "session_status") {
      applyContextUsage((update ?? params) as Json);
    }
    if (kind === "model_changed" || kind === "model_auto_switched") {
      const id =
        (typeof update?.modelId === "string" && update.modelId) ||
        (typeof update?.model_id === "string" && update.model_id) ||
        "";
      if (id) {
        currentModelId = id;
        currentModelName = catalogModels.find((m) => m.id === id)?.name || id;
      }
      const effort =
        (typeof update?.reasoningEffort === "string" && update.reasoningEffort) ||
        (typeof update?.reasoning_effort === "string" && update.reasoning_effort) ||
        (typeof update?.effort === "string" && update.effort) ||
        "";
      if (effort) currentEffort = effort;
      syncComposerChips();
      if (kind === "model_auto_switched") {
        showBanner(`模型已自动换成 ${currentModelName || id}（原来的不可用）`, "model");
      }
    }
  }
  if (method === "x.ai/sessions/changed") {
    const delta = parseRosterChanged(params);
    if (delta.upserted.length || delta.removed.length) {
      dashRoster = applyRosterChanged(dashRoster, delta);
      syncTurnFromRoster();
    }
    void refreshRoster();
    void refreshSessions();
    return;
  }
  if (method === "x.ai/search/fuzzy/status") {
    const root = currentEntry()?.cwd || workspaceCwd();
    atItems = scopeFuzzyMatches(parseFuzzyStatus(params), root);
    renderAtMenu();
    return;
  }
  const effects = timeline.apply(method, params);
  lastEventId = timeline.lastEventId;
  let redraw = false;
  for (const effect of effects) {
    if (effect.type === "redraw") redraw = true;
    if (effect.type === "title") applyTitleNotification(effect.rec, effect.meta);
    if (effect.type === "banner") showBanner(effect.text, effect.reason);
    if (effect.type === "commands") {
      if (snapshot) snapshot.availableCommands = effect.commands;
      if (!slashMenu.hidden) renderSlashMenu();
    }
    if (effect.type === "queue") applyQueueChanged(effect.params);
    if (effect.type === "follow-ups") renderFollowUps(effect.texts);
    if (effect.type === "prompt-complete") {
      endTurn(eventSid || sessionId);
      if (!timeline.replayActive) {
        setState("live", "已连接");
        hint.textContent = composerPrefs.enterSends
          ? "Enter 发送 · Shift+Enter 换行"
          : "Ctrl+Enter 发送 · Enter 换行";
        void drainLocalQueue();
        void fetchGhost();
      }
    }
  }
  if (redraw) requestPaint();
  syncTurnStatus();
  if (app.dataset.surface === "dashboard") renderDashboard();
}

function applyQueueChanged(params: Json) {
  const parsed = parseQueueChanged(params);
  if (parsed.sessionId && parsed.sessionId !== sessionId) return;
  localQueue = parsed.entries.map((e) => ({ id: e.id, text: e.text, images: [] }));
  renderQueue();
}

function renderQueue() {
  const open = localQueue.length > 0 || queuePinned;
  queueStrip.hidden = !open;
  app.dataset.queue = open ? "1" : "0";
  queueStrip.replaceChildren();
  const head = document.createElement("div");
  head.className = "queue-pane-head";
  const title = document.createElement("span");
  title.textContent = "队列";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "清空";
  clear.title = "清空";
  clear.addEventListener("click", () => {
    localQueue = [];
    queueSelectedId = null;
    queuePinned = false;
    renderQueue();
  });
  head.append(title, clear);
  queueStrip.append(head);
  if (localQueue.length === 0) {
    const empty = document.createElement("div");
    empty.className = "queue-empty";
    empty.textContent = "队列为空";
    queueStrip.append(empty);
    return;
  }
  if (!queueSelectedId || !localQueue.some((q) => q.id === queueSelectedId)) {
    queueSelectedId = localQueue[0]?.id ?? null;
  }
  for (const item of localQueue) {
    const row = document.createElement("div");
    row.className = "queue-card";
    row.setAttribute("aria-selected", item.id === queueSelectedId ? "true" : "false");
    const name = document.createElement("div");
    name.className = "queue-card-title";
    name.textContent = item.text.slice(0, 80) || "(queued)";
    const st = document.createElement("div");
    st.className = "queue-card-status";
    st.textContent = "等待中";
    const sendNow = document.createElement("button");
    sendNow.type = "button";
    sendNow.className = "queue-card-send-now";
    sendNow.textContent = "立即发送";
    sendNow.title = "打断当前回复，立刻发这条";
    sendNow.addEventListener("click", (ev) => {
      ev.stopPropagation();
      queueSelectedId = item.id;
      promoteSelectedQueueItem();
      cancelCurrentTurnForSendNow();
      void drainLocalQueue();
    });
    const more = document.createElement("button");
    more.type = "button";
    more.className = "queue-card-more";
    more.textContent = "⋯";
    more.title = "移除";
    more.addEventListener("click", (ev) => {
      ev.stopPropagation();
      localQueue = localQueue.filter((q) => q.id !== item.id);
      if (queueSelectedId === item.id) queueSelectedId = null;
      renderQueue();
    });
    row.append(name, st, sendNow, more);
    row.addEventListener("click", () => {
      queueSelectedId = item.id;
      renderQueue();
    });
    queueStrip.append(row);
  }
}

function renderFollowUps(texts: string[]) {
  followUpsEl.hidden = texts.length === 0;
  followUpsEl.replaceChildren();
  for (const text of texts) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "follow-up-chip";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      if (!isFollowUpLiteral(text)) return;
      void submitComposer({ text, literal: true });
    });
    followUpsEl.append(chip);
  }
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
  const directory = cwd.value.trim() || snapshot?.cwd || "";
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

async function afterAuthenticated(authMeta: Json | null, resume = false) {
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
  void refreshBilling();
  applyComposerGate();
  if (resume) {
    await refreshSessions();
    return;
  }
  const route = parseHashRoute(location.hash);
  const deep = deepLinkSessionId(location.search);
  const cachedLast = readSessionCache(localStorage)?.lastId ?? null;
  const target =
    route.kind === "sessions" || route.kind === "dashboard"
      ? null
      : route.kind === "session"
        ? route.id
        : deep || pendingResumeId || cachedLast;
  pendingResumeId = null;
  const listed = target ? recentSessions.find((s) => s.sessionId === target) : undefined;
  const loadTarget =
    target && (listed || workspaceCwd())
      ? loadSession(target, {
          cwd: listed?.cwd ?? workspaceCwd(),
          reconnect: false,
        }).catch(() => {
          /* banner already shown */
        })
      : Promise.resolve();
  await Promise.all([refreshSessions(), loadTarget]);
  if (route.kind === "dashboard") {
    showDashboard();
  } else if (route.kind === "sessions") {
    writeSessionHash();
    showSessionIndex();
  }
}

function applyTitleNotification(
  rec: { [k: string]: Json } | null,
  meta: { [k: string]: Json } | null,
) {
  const title =
    (typeof rec?.session_summary === "string" && rec.session_summary) ||
    (typeof rec?.sessionSummary === "string" && rec.sessionSummary) ||
    (typeof rec?.title === "string" && rec.title) ||
    null;
  const manual = meta?.["x.ai/titleIsManual"];
  if (manual === true) {
    titlePinned = true;
    if (title && sessionId) {
      sessionLabel.textContent = title;
      const row = recentSessions.find((s) => s.sessionId === sessionId);
      if (row) row.summary = title;
      renderSessionList();
    }
    return;
  }
  if (manual === false) {
    titlePinned = false;
    return;
  }
  if (!titlePinned && title && sessionId) {
    sessionLabel.textContent = title;
    const row = recentSessions.find((s) => s.sessionId === sessionId);
    if (row) row.summary = title;
    renderSessionList();
  }
}

async function refreshSessions(): Promise<void> {
  const q = listQuery.trim();
  if (q.startsWith("?")) {
    try {
      const hits = parseSearchHits(
        await acpCall(
          "x.ai/session/search",
          buildSessionSearchParams({ query: q.slice(1).trim() || q }),
        ),
      );
      recentSessions = hits.map((h) => ({
        sessionId: h.sessionId,
        summary: h.snippet ? `${h.summary} — ${h.snippet}` : h.summary,
        cwd: h.cwd,
        updatedAt: null,
        source: "search",
        lastTurnSummary: h.snippet,
        sessionKind: null,
        adminKind: "build" as const,
        worktreeLabel: null,
        gitRootDir: h.cwd,
        sourceWorkspaceDir: h.cwd,
        repoName: null,
      }));
    } catch (e) {
      showBanner(e instanceof Error ? e.message : String(e), "search");
    }
    renderSessionList();
    return;
  }
  const all: SessionListEntry[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  try {
    for (let page = 0; page < 20; page += 1) {
      const { sessions, nextCursor } = parseSessionListPage(
        await acpCall(
          "x.ai/session/list",
          buildSessionListParams({ cursor, query: q || undefined }),
        ),
      );
      for (const entry of sessions) {
        if (seen.has(entry.sessionId)) continue;
        seen.add(entry.sessionId);
        all.push(entry);
      }
      sessionListCursor = nextCursor;
      if (!nextCursor) break;
      cursor = nextCursor;
    }
    listedSessionsRaw = all;
    recentSessions = applyPickerList(all);
  } catch {
    listedSessionsRaw = all.length ? all : [];
    recentSessions = applyPickerList(listedSessionsRaw);
  }
  renderSessionList();
  if (app.dataset.surface === "sessions") renderSessionIndex();
  if (app.dataset.surface === "dashboard") renderDashboard();
  persistSessionCache();
}

function sessionTitle(entry: SessionListEntry): string {
  const title = pickerDisplayTitle(entry);
  if (title) return title;
  if (entry.adminKind === "chat" || entry.source === "conversation") return "Untitled";
  return entry.sessionId.slice(0, 8);
}

const WORKSPACE_COLLAPSE_KEY = "grok-web.workspace-collapsed";

function loadCollapsedWorkspaces(): Set<string> {
  try {
    const raw = localStorage.getItem(WORKSPACE_COLLAPSE_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveCollapsedWorkspaces(keys: Set<string>) {
  localStorage.setItem(WORKSPACE_COLLAPSE_KEY, JSON.stringify([...keys]));
}

function renderSessionRow(entry: SessionListEntry): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "session-row-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "session-row";
  btn.dataset.sessionId = entry.sessionId;
  if (entry.cwd) btn.dataset.cwd = entry.cwd;
  if (entry.sessionId === sessionId) btn.setAttribute("aria-current", "true");
  const titleLine = document.createElement("span");
  titleLine.className = "row-title-line";
  const live = dashLive();
  const status = inferDashStatus(entry, live);
  if (status === "working" || status === "needs") {
    const dot = document.createElement("span");
    dot.className = "dash-dot";
    dot.dataset.kind = dashDotKind(status);
    dot.dataset.status = status;
    dot.title = status === "needs" ? "需要输入" : "进行中";
    titleLine.append(dot);
  }
  const title = document.createElement("span");
  title.className = "row-title";
  title.textContent = sessionTitle(entry);
  titleLine.append(title);
  const meta = document.createElement("span");
  meta.className = "row-meta";
  const bits = [
    entry.source && entry.source !== "local" ? entry.source : "",
    entry.worktreeLabel ? `wt:${entry.worktreeLabel}` : "",
    entry.updatedAt ? entry.updatedAt.slice(0, 16) : "",
    entry.cwd || entry.sessionId.slice(0, 8),
  ].filter(Boolean);
  meta.textContent = bits.join(" · ");
  if (entry.lastTurnSummary) {
    const sub = document.createElement("span");
    sub.className = "row-meta";
    sub.textContent = entry.lastTurnSummary;
    btn.append(titleLine, meta, sub);
  } else {
    btn.append(titleLine, meta);
  }
  if (entry.source === "conversation" || entry.adminKind === "chat") {
    const badge = document.createElement("span");
    badge.className = "row-badge";
    badge.textContent = "chat";
    btn.append(badge);
  }
  btn.addEventListener("click", () => {
    openListedSession(entry).catch((e) =>
      showBanner(e instanceof Error ? e.message : String(e)),
    );
  });
  const more = document.createElement("button");
  more.type = "button";
  more.className = "row-menu-btn";
  more.setAttribute("aria-haspopup", "menu");
  more.setAttribute("aria-expanded", "false");
  more.setAttribute("aria-label", "会话操作");
  more.textContent = "⋯";
  more.addEventListener("click", (ev) => {
    ev.stopPropagation();
    toggleSessionPopover(more, entry, ev);
  });
  wrap.append(btn, more);
  return wrap;
}

function closeSessionPopover() {
  sessionPopover.hidden = true;
  sessionPopover.style.display = "none";
  sessionPopover.replaceChildren();
  delete sessionPopover.dataset.sessionId;
  for (const btn of sessionListEl.querySelectorAll<HTMLElement>(".row-menu-btn")) {
    btn.setAttribute("aria-expanded", "false");
  }
}

function styleSessionPopover() {
  const s = sessionPopover.style;
  s.position = "fixed";
  s.zIndex = "50";
  s.display = "flex";
  s.flexDirection = "column";
  s.gap = "2px";
  s.width = "11.5rem";
  s.margin = "0";
  s.padding = "0.35rem";
  s.background = "var(--popover)";
  s.border = "1px solid var(--line)";
  s.borderRadius = "12px";
  s.boxShadow = "0 16px 48px var(--shadow)";
}

function toggleSessionPopover(anchor: HTMLElement, entry: SessionListEntry, ev?: MouseEvent) {
  if (!sessionPopover.hidden && sessionPopover.dataset.sessionId === entry.sessionId) {
    closeSessionPopover();
    return;
  }
  const acts: [string, () => void][] = [
    ["打开", () => void openListedSession(entry)],
    ["重命名", () => void renameSession(entry)],
    ["删除", () => void deleteSession(entry, true)],
    ["分支", () => void forkSession(entry)],
    ["复制 id", () => void navigator.clipboard.writeText(entry.sessionId)],
    ["在独立副本打开", () => void resumeWorktree(entry)],
  ];
  sessionPopover.replaceChildren();
  for (const [label, fn] of acts) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.textContent = label;
    b.style.display = "block";
    b.style.width = "100%";
    b.style.textAlign = "left";
    b.addEventListener("click", (click) => {
      click.stopPropagation();
      closeSessionPopover();
      fn();
    });
    sessionPopover.append(b);
  }
  sessionPopover.dataset.sessionId = entry.sessionId;
  sessionPopover.hidden = false;
  styleSessionPopover();
  for (const btn of sessionListEl.querySelectorAll<HTMLElement>(".row-menu-btn")) {
    btn.setAttribute("aria-expanded", btn === anchor ? "true" : "false");
  }
  const place = () => {
    const r = anchor.getBoundingClientRect();
    const box = sessionPopover.getBoundingClientRect();
    const pad = 8;
    let left = ev?.clientX ?? r.right;
    let top = ev?.clientY ?? r.bottom;
    if (left + box.width > innerWidth - pad) left = Math.max(pad, r.left - box.width - 4);
    if (top + box.height > innerHeight - pad) top = Math.max(pad, innerHeight - pad - box.height);
    if (left < pad) left = pad;
    sessionPopover.style.left = `${Math.round(left)}px`;
    sessionPopover.style.top = `${Math.round(top)}px`;
  };
  place();
  requestAnimationFrame(place);
}

function renderSessionList(): void {
  closeSessionPopover();
  sessionListEl.replaceChildren();
  if (!authenticated) {
    const p = document.createElement("p");
    p.className = "session-list-empty";
    p.textContent = "登录后，这里会按工作区列出会话。";
    sessionListEl.append(p);
    return;
  }
  if (!recentSessions.length) {
    const p = document.createElement("p");
    p.className = "session-list-empty";
    p.textContent = "还没有会话。点「新会话」，或直接在右边说话。";
    sessionListEl.append(p);
    return;
  }
  const collapsed = loadCollapsedWorkspaces();
  const groups = groupSessionsByWorkspace(recentSessions);
  for (const group of groups) {
    const details = document.createElement("details");
    details.className = "workspace-group";
    details.dataset.workspaceKey = group.key;
    const hasCurrent = group.sessions.some((s) => s.sessionId === sessionId);
    details.open = hasCurrent || !collapsed.has(group.key);
    const summary = document.createElement("summary");
    summary.className = "workspace-head";
    const name = document.createElement("span");
    name.className = "workspace-name";
    name.textContent = group.label;
    const count = document.createElement("span");
    count.className = "workspace-count";
    count.textContent = String(group.sessions.length);
    summary.append(name, count);
    const body = document.createElement("div");
    body.className = "workspace-sessions";
    for (const entry of group.sessions) body.append(renderSessionRow(entry));
    details.append(summary, body);
    details.addEventListener("toggle", () => {
      const next = loadCollapsedWorkspaces();
      if (details.open) next.delete(group.key);
      else next.add(group.key);
      saveCollapsedWorkspaces(next);
    });
    sessionListEl.append(details);
  }
}

function applyBilling(raw: Json) {
  const snap = parseBilling(raw);
  lastBilling = snap;
  if (!snap) {
    billingChip.hidden = true;
    return;
  }
  billingChip.hidden = false;
  billingChip.textContent = billingChipText(snap);
  billingChip.dataset.hot = billingIsLow(snap) ? "1" : "0";
  billingChip.title = `${snap.periodLabel} · 已用 ${Math.floor(snap.usedPercent)}%`;
  if (snap.subscriptionTier) {
    planBadge.hidden = false;
    planBadge.textContent = snap.subscriptionTier;
  }
}

async function refreshBilling() {
  if (!acp.connected || !authenticated) return;
  try {
    applyBilling(extResultPayload(await acpCall("x.ai/billing", {})));
  } catch {
    /* optional: API key / team accounts may have no consumer billing */
  }
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
  syncHeaderChips();
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
    recordPhase("initialize");
    const init = await acpCall("initialize", buildInitializeParams(CLIENT_VERSION));
    if (handshakeCalls[0] !== "initialize") {
      throw new Error("连接后第一条必须是 initialize");
    }
    snapshot = parseInitialize(init);
    initialized = true;
  }
  if (!snapshot) throw new Error("missing initialize snapshot");
  authMethods = snapshot.authMethods;
  cwd.value = cwd.value.trim() || snapshot.cwd || "";
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
      await afterAuthenticated(auth, resume);
      if (resume && sessionId) {
        await loadSession(sessionId, { reconnect: true });
        return;
      }
      if (sessionId) {
        setState("live", "已连接");
        return;
      }
      if (parseHashRoute(location.hash).kind === "dashboard") showDashboard();
      else if (parseHashRoute(location.hash).kind === "sessions") showSessionIndex();
      else renderWelcome();
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
    await loadSession(sessionId, { reconnect: true });
    return;
  }
  renderLogin();
  setState("live", "已连接");
}

async function openListedSession(entry: SessionListEntry): Promise<void> {
  if (entry.sessionId === sessionId && !timeline.replayActive && timeline.items.length) {
    showSurface("session");
    writeSessionHash();
    applyComposerGate();
    return;
  }
  parkCurrentTurn();
  await loadSession(entry.sessionId, {
    cwd: entry.cwd,
    cursor: null,
    reconnect: false,
  });
}

async function loadSession(
  id: string,
  opts?: { cwd?: string | null; cursor?: string | null; reconnect?: boolean },
): Promise<void> {
  const reconnect = opts?.reconnect === true;
  const directory =
    (opts?.cwd && opts.cwd.trim()) ||
    recentSessions.find((s) => s.sessionId === id)?.cwd ||
    cwd.value.trim() ||
    workspaceCwd();
  if (!directory) {
    showBanner("无法打开会话：缺少 cwd", "load-failed");
    throw new Error("session/load 缺少 cwd");
  }
  const cursor = reconnect ? (opts?.cursor ?? lastEventId) : null;
  const params = reconnect
    ? buildSessionLoadParams({
        sessionId: id,
        cwd: directory,
        cursor,
        yoloMode,
        autoMode,
      })
    : buildPickerSessionLoadParams({
        sessionId: id,
        cwd: directory,
        yoloMode,
        autoMode,
      });
  if (!reconnect) {
    lastEventId = null;
    showSurface("session");
    setSession(id);
    timeline.beginReplay();
    syncThread();
    renderSessionList();
  }
  setState("busy", "session/load…");
  try {
    const loaded = asRecord(await acpCall("session/load", params));
    if (!loaded) throw new Error("session/load 失败");
    applyModelState(loaded);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    showBanner(`无法打开会话：${message}`, "load-failed");
    setState("live", "已连接");
    if (!reconnect) {
      timeline.endReplay(0);
      syncThread();
    }
    throw e;
  }
  setSession(id);
  showSurface("session");
  if (!reconnect) {
    timeline.endReplay();
    timeline.follow = true;
    syncThread();
    scrollToLatest();
  }
  void refreshComposerModel(id);
  if (reconnect) noteSys(`已重连 session ${id}`);
  if (backgroundIds.has(id)) {
    turnRunning = true;
    syncTurnButtons();
    syncTurnStatus();
  }
  flushParkedBlocks(id);
  renderSessionList();
}

async function newSession(): Promise<void> {
  parkCurrentTurn();
  if (workspaceAckPending) {
    renderWelcome();
    workspaceAck.hidden = false;
    throw new Error("请先确认 local workspace");
  }
  lastEventId = null;
  timeline.clear();
  syncThread();
  const directory = workspaceCwd();
  if (!directory) {
    showBanner("无法新建会话：未设置 cwd", "load-failed");
    throw new Error("session/new 缺少 cwd");
  }
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
  noteSys(`新 session ${id}`);
  await refreshSessions();
}

async function refreshComposerModel(id: string) {
  try {
    const info = extResultPayload(await acpCall("x.ai/session/info", buildSessionInfoParams(id)));
    applyModelState(info);
    applyContextUsage(info);
  } catch {
    /* optional */
  }
}

async function setSessionModel(modelId: string, effort = currentEffort) {
  if (modelId) {
    currentModelId = modelId;
    currentModelName = catalogModels.find((m) => m.id === modelId)?.name || modelId;
  }
  if (effort) currentEffort = effort;
  syncComposerChips();
  if (!sessionId || !acp.connected || !currentModelId) return;
  const params: { [k: string]: Json } = { sessionId, modelId: currentModelId };
  if (effort) params._meta = { reasoningEffort: effort };
  try {
    await acpCall("session/set_model", params);
  } catch (e) {
    showBanner(e instanceof Error ? e.message : String(e), "model");
  }
}

function persistSessionCache(lastId: string | null = sessionId) {
  writeSessionCache(localStorage, { lastId, sessions: recentSessions });
}

function setSession(id: string) {
  if (sessionId && sessionId !== id) void closeFuzzy();
  sessionId = id;
  loadedIds.add(id);
  const row = recentSessions.find((s) => s.sessionId === id);
  const summary = row?.summary.trim();
  sessionLabel.textContent = summary && summary !== id ? summary : id;
  setState("live", "已连接");
  hint.textContent = hintForFocus("composer", composerPrefs.enterSends);
  applyComposerGate();
  persistSessionCache(id);
  writeSessionHash();
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
  recordPhase("connecting");
  setState("busy", CONNECTING_COPY);
  const keepShell = recentSessions.length > 0 || Boolean(sessionId) || app.dataset.surface === "session";
  if (!keepShell) showSurface("connecting");
  const url = buildWsUrl(wsUrl.value.trim() || defaultWsUrl(), secret.value.trim());
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
      const url = buildWsUrl(wsUrl.value.trim() || defaultWsUrl(), secret.value.trim());
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
      if (reconnectAttempt >= 4) {
        wantOpen = false;
        showDoctor(e);
        return;
      }
      scheduleReconnect();
    }
  }, delay);
}

function cancelCurrentTurnForSendNow() {
  if (!turnRunning || !sessionId || !acp.connected) {
    turnRunning = false;
    return;
  }
  try {
    acp.notify("session/cancel", buildSessionCancelParams(sessionId));
  } catch {
    /* keep going */
  }
  turnRunning = false;
  syncTurnButtons();
  syncTurnStatus();
}

function promoteSelectedQueueItem() {
  if (!queueSelectedId) return;
  const idx = localQueue.findIndex((q) => q.id === queueSelectedId);
  if (idx <= 0) return;
  const item = localQueue[idx]!;
  localQueue = [item, ...localQueue.filter((q) => q.id !== item.id)];
}

async function drainLocalQueue(): Promise<void> {
  if (turnRunning) return;
  const { next, rest } = drainQueueHead(localQueue);
  localQueue = rest;
  renderQueue();
  if (!next) return;
  if (isQueuedSlash(next.text)) {
    const local = parseLocalSlash(next.text);
    if (local && (await runLocalSlash(local))) {
      await drainLocalQueue();
      return;
    }
  }
  await sendPrompt(next.text, next.images);
}

async function submitComposer(opts: {
  sendNow?: boolean;
  text?: string;
  literal?: boolean;
} = {}): Promise<void> {
  const rawText = opts.text ?? promptEl.value;
  const images = imageChips;
  const pics = images.filter((c) => (c.kind ?? "image") === "image" && c.mimeType.startsWith("image/"));
  const extra = images
    .filter((c) => (c.kind ?? "image") !== "image" || !c.mimeType.startsWith("image/"))
    .map((c) => `${workspaceCwd() || ""}/${c.name}`.replace(/\/+/g, "/"))
    .join(" ");
  const text = extra ? `${rawText} ${extra}`.trim() : rawText;
  const hasDraft = Boolean(text.trim() || pics.length);
  const intent = composerSubmitIntent({
    hasDraft,
    turnRunning,
    sendNow: Boolean(opts.sendNow),
    hasQueue: localQueue.length > 0,
    emptyRepeat: Date.now() - lastEmptyEnterAt < 800,
  });
  if (intent === "noop") {
    lastEmptyEnterAt = hasDraft ? 0 : Date.now();
    return;
  }
  lastEmptyEnterAt = 0;
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
  if (hasDraft && !opts.literal) {
    const local = parseLocalSlash(text);
    if (local && (await runLocalSlash(local))) {
      promptEl.value = "";
      hidePopovers();
      return;
    }
  }
  if (intent === "queue") {
    localQueue = [
      ...localQueue,
      { id: `q-${queueIdSeq++}`, text, images: [...pics] },
    ];
    promptEl.value = "";
    imageChips = [];
    renderImageChips();
    renderQueue();
    return;
  }
  if (intent === "drain-head") {
    if (opts.sendNow) {
      promoteSelectedQueueItem();
      cancelCurrentTurnForSendNow();
    }
    await drainLocalQueue();
    return;
  }
  if (composerMode === "remember" && !text.startsWith("/")) {
    await sendPrompt(`/remember ${text}`, pics, opts);
    composerMode = "";
    setComposerMode("");
    return;
  }
  if (intent === "send-now") cancelCurrentTurnForSendNow();
  promptEl.value = "";
  imageChips = [];
  renderImageChips();
  hidePopovers();
  if (composerMode === "shell" && !text.startsWith("!")) {
    await sendPrompt(`!${text}`, pics, { sendNow: Boolean(opts.sendNow) });
    composerMode = "";
    setComposerMode("");
    return;
  }
  if (text.trim().startsWith("/btw ")) {
    timeline.nextAgentIsBtw = true;
  }
  await sendPrompt(text, pics, { sendNow: Boolean(opts.sendNow) });
}

async function runLocalSlash(local: { name: string; args: string }): Promise<boolean> {
  const plan = planSlash(`/${local.name}${local.args ? ` ${local.args}` : ""}`);
  if (plan.kind === "send" || plan.kind === "pass") return false;
  if (plan.kind === "later") {
    showBanner(LATER_TOAST, "slash-later");
    return true;
  }
  if (plan.kind === "forbidden") return true;
  const name = plan.name;
  const args = plan.args;
  const entry = currentEntry();
  if (name === "exit") {
    await disconnect();
    try {
      window.close();
    } catch {
      /* browsers ignore unless script-opened */
    }
    showBanner("已断开本页。其它 grok 进程未动。", "exit");
    return true;
  }
  if (name === "help") {
    openHelpCard();
    return true;
  }
  if (name === "docs") {
    window.open("https://docs.x.ai", "_blank", "noopener,noreferrer");
    return true;
  }
  if (name === "home" || name === "resume") {
    leaveSession();
    return true;
  }
  if (name === "dashboard") {
    showDashboard();
    return true;
  }
  if (name === "new") {
    showEmpty();
    await newSession();
    return true;
  }
  if (name === "delete") {
    if (!entry) {
      showBanner("没有可删除的会话", "delete");
      return true;
    }
    await deleteSession(entry, false);
    return true;
  }
  if (name === "fork") {
    if (!entry) {
      showBanner("没有可分支的会话", "fork");
      return true;
    }
    await forkSession(entry);
    return true;
  }
  if (name === "copy") {
    const n = args && /^\d+$/.test(args) ? Number(args) : 0;
    const path = args && !/^\d+$/.test(args) ? args : "";
    const item = timeline.nthAgent(n);
    if (!item) {
      showBanner("没有可复制的回复", "copy");
      return true;
    }
    if (path) downloadText(path.split("/").pop() || "copy.md", item.raw || item.text);
    else void navigator.clipboard.writeText(item.raw || item.text);
    noteSys(path ? `已导出 ${path}` : "已复制最近回复");
    return true;
  }
  if (name === "find") {
    openFind(args);
    return true;
  }
  if (name === "jump") {
    openJump();
    return true;
  }
  if (name === "history") {
    await openPromptHistory();
    return true;
  }
  if (name === "export") {
    openExportSheet();
    return true;
  }
  if (name === "transcript") {
    openExportSheet();
    return true;
  }
  if (name === "queue") {
    queuePinned = true;
    renderQueue();
    return true;
  }
  if (name === "context") {
    if (!entry) return true;
    await showContext(entry);
    return true;
  }
  if (name === "timestamps") {
    composerPrefs.showTimestamps = !composerPrefs.showTimestamps;
    timeline.opts.showTimestamps = composerPrefs.showTimestamps;
    showTimestampsEl.checked = composerPrefs.showTimestamps;
    app.dataset.timestamps = composerPrefs.showTimestamps ? "1" : "0";
    persistComposerPrefs(composerPrefs, localStorage);
    syncThread();
    return true;
  }
  if (name === "feedback") {
    blockHost.offerFeedback();
    return true;
  }
  if (name === "timeline") {
    composerPrefs.showRail = !composerPrefs.showRail;
    timeline.opts.showRail = composerPrefs.showRail;
    showRailEl.checked = composerPrefs.showRail;
    persistComposerPrefs(composerPrefs, localStorage);
    syncThread();
    return true;
  }
  if (name === "model") {
    if (args) {
      const hit =
        catalogModels.find((m) => m.id === args || m.name === args) ||
        catalogModels.find(
          (m) =>
            m.id.toLowerCase().includes(args.toLowerCase()) ||
            m.name.toLowerCase().includes(args.toLowerCase()),
        );
      if (!hit) {
        showBanner(`没有匹配的模型：${args}`, "model");
        return true;
      }
      await setSessionModel(hit.id);
      return true;
    }
    openModelPicker();
    return true;
  }
  if (name === "effort") {
    const effort = parseEffortArg(args);
    if (effort) {
      await setSessionModel(currentModelId || catalogModels[0]?.id || "", effort);
      return true;
    }
    if (args) {
      await sendPrompt(`/effort ${args}`);
      return true;
    }
    btnEffortChip.click();
    return true;
  }
  if (name === "always-approve") {
    const next = !yoloMode;
    if (next && !window.confirm("此后本会话的工具不再询问。确定？")) return true;
    await setSessionMode(next ? "yolo" : sessionPermMode === "plan" ? "plan" : "ask");
    await sendPrompt(next ? "/always-approve" : "/always-approve off");
    return true;
  }
  if (name === "plan") {
    const next = sessionPermMode === "plan" ? "ask" : "plan";
    await setSessionMode(next);
    return true;
  }
  if (name === "auto") {
    const next = permissionModeEl.value === "auto" ? "ask" : "auto";
    permissionModeEl.value = next;
    permissionModeEl.dispatchEvent(new Event("change"));
    return true;
  }
  if (name === "multiline") {
    composerPrefs.enterSends = !composerPrefs.enterSends;
    enterSendsEl.checked = composerPrefs.enterSends;
    persistComposerPrefs(composerPrefs, localStorage);
    hint.textContent = composerPrefs.enterSends
      ? "Enter 发送 · Shift+Enter 换行"
      : "Ctrl+Enter 发送 · Enter 换行";
    return true;
  }
  if (name === "compact-mode") {
    compactModeOn = !compactModeOn;
    applyCompactMode(compactModeOn, document.documentElement, localStorage);
    showBanner(compactModeOn ? "已开紧凑模式" : "已关紧凑模式", "compact-mode");
    return true;
  }
  if (name === "theme") {
    const named = parseThemeArg(args);
    if (named) {
      applyThemeChoice(named, true);
      return true;
    }
    openThemePicker();
    return true;
  }
  if (name === "rename") {
    if (!entry) {
      showBanner("没有可重命名的会话", "rename");
      return true;
    }
    if (args) {
      await acpCall(
        "x.ai/session/rename",
        buildSessionRenameParams({
          sessionId: entry.sessionId,
          title: args,
          cwd: entry.cwd,
          kind: entry.adminKind,
        }),
      );
      await refreshSessions();
      return true;
    }
    await renameSession(entry);
    return true;
  }
  if (name === "session-info") {
    if (!entry) {
      showBanner("没有会话信息", "info");
      return true;
    }
    await showInfo(entry);
    return true;
  }
  if (name === "login") {
    if (authenticated) {
      showBanner("已经登录", "login");
      return true;
    }
    renderLogin();
    await startInteractiveLogin();
    return true;
  }
  if (name === "logout") {
    await logout({ acp: true });
    return true;
  }
  if (name === "rewind") {
    if (!entry) {
      await sendPrompt(args ? `/rewind ${args}` : "/rewind");
      return true;
    }
    await rewindSession(entry);
    return true;
  }
  if (name === "settings") {
    openSettings();
    return true;
  }
  if (name === "usage") {
    await showUsage(entry);
    return true;
  }
  if (name === "privacy") {
    openSettings();
    return true;
  }
  if (name === "share") {
    if (!entry) {
      showBanner(LATER_TOAST, "slash-later");
      return true;
    }
    await shareSession(entry);
    return true;
  }
  if (name === "recap") {
    if (!entry) {
      showBanner(LATER_TOAST, "slash-later");
      return true;
    }
    await recapSession(entry, false);
    return true;
  }
  if (name === "doctor") {
    if (acp.connected) {
      showBanner("连接正常。连不上 serve 时这里会做诊断。", "doctor");
      return true;
    }
    showDoctor(new Error("未连接"));
    return true;
  }
  if (name === "cd") {
    if (args) {
      if (!window.confirm("改 cwd 只影响之后的新会话，不会移动当前 session。继续？")) return true;
      cwd.value = args;
      persistFields();
      showBanner(`新会话将使用 ${cwd.value}`, "cwd");
      return true;
    }
    await changeCwd();
    return true;
  }
  return false;
}

async function sendPrompt(
  text: string,
  images: ImageChip[] = [],
  opts: { sendNow?: boolean } = {},
): Promise<void> {
  if (!text.trim() && images.length === 0) return;
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
  const promptSid = sessionId;
  const epoch = ++promptEpoch;
  timeline.endReplay(0);
  showSurface("session");
  const item = timeline.insertUser(
    text,
    images.map((img) => ({ src: `data:${img.mimeType};base64,${img.data}`, alt: img.name })),
  );
  syncThread();
  const el = timelineNodes.get(item.id);
  el?.scrollIntoView({ block: "start" });
  if (text.trim()) sentHistory.unshift(text.trim());
  setState("busy", "session/prompt…");
  turnRunning = true;
  syncTurnButtons();
  syncTurnStatus();
  followUpsEl.hidden = true;
  try {
    await acp.request(
      "session/prompt",
      buildSessionPromptParams({
        sessionId: promptSid,
        text,
        images: images.map((img, i) => ({
          mimeType: img.mimeType,
          data: img.data,
          displayNumber: i + 1,
        })),
        promptId: crypto.randomUUID(),
        sendNow: opts.sendNow,
        screenMode: SCREEN_MODE_WEB,
      }),
      0,
    );
  } finally {
    if (epoch === promptEpoch && sessionId === promptSid) {
      turnRunning = false;
      syncTurnButtons();
      syncTurnStatus();
    }
    renderSessionList();
    if (app.dataset.surface === "dashboard") renderDashboard();
  }
  setState("live", "已连接");
  hint.textContent = composerPrefs.enterSends
    ? "Enter 发送 · Shift+Enter 换行"
    : "Ctrl+Enter 发送 · Enter 换行";
  await drainLocalQueue();
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
    if (parseHashRoute(location.hash).kind === "dashboard") showDashboard();
    else if (parseHashRoute(location.hash).kind === "sessions") showSessionIndex();
    else if (!sessionId) renderWelcome();
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
  if (parseHashRoute(location.hash).kind === "sessions") showSessionIndex();
  else if (!sessionId) renderWelcome();
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
  sessionLabel.textContent = "无 session";
  showEmpty();
}

function leaveSession() {
  const id = sessionId;
  void closeFuzzy();
  parkCurrentTurn();
  if (id && acp.connected && !backgroundIds.has(id) && !needsInputIds.has(id)) {
    acp.request("x.ai/session/close", buildSessionCloseParams(id)).catch(() => {
      /* close is best-effort */
    });
  }
  if (id && !backgroundIds.has(id)) loadedIds.delete(id);
  titlePinned = false;
  clearSessionView();
  persistSessionCache(null);
  showSessionIndex();
}

function currentEntry(): SessionListEntry | null {
  if (!sessionId) return null;
  return recentSessions.find((s) => s.sessionId === sessionId) ?? {
    sessionId,
    summary: sessionId,
    cwd: workspaceCwd() || null,
    updatedAt: null,
    source: null,
    lastTurnSummary: null,
    sessionKind: null,
    adminKind: "build",
    worktreeLabel: null,
    gitRootDir: null,
    sourceWorkspaceDir: null,
    repoName: null,
  };
}

function openAction(title: string, body: string, listHtml?: HTMLElement[]) {
  actionTitle.textContent = title;
  actionBody.textContent = body;
  actionList.replaceChildren(...(listHtml ?? []));
  openDialog(actionModal);
}

async function openToolPath(path: string) {
  openAction(path, "读取中…");
  try {
    const raw = extResultPayload(
      await acp.request("x.ai/fs/read_file", {
        path,
        sessionId,
        cwd: workspaceCwd(),
        max_lines: 400,
      }),
    );
    const rec = asRecord(raw);
    const content =
      (rec && typeof rec.content === "string" && rec.content) ||
      (typeof raw === "string" ? raw : "");
    openAction(path, content || JSON.stringify(raw, null, 2));
  } catch (err) {
    openAction(path, err instanceof Error ? err.message : String(err));
  }
}

function closeAction() {
  closeDialog(actionModal);
}

function threadText(): string {
  return [...thread.querySelectorAll(".bubble")]
    .map((el) => {
      const who = el.querySelector(".who")?.textContent ?? "";
      const body = el.querySelector(".body")?.textContent ?? el.textContent ?? "";
      return `## ${who}\n${body}`;
    })
    .join("\n\n");
}

function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function renameSession(entry: SessionListEntry) {
  const next = window.prompt("新标题（空 = 恢复自动标题）", sessionTitle(entry));
  if (next === null) return;
  const reset = next.trim() === "";
  if (reset && entry.adminKind === "chat") {
    showBanner("chat 会话没有自动标题可恢复", "rename");
    return;
  }
  await acpCall(
    "x.ai/session/rename",
    buildSessionRenameParams({
      sessionId: entry.sessionId,
      title: next.trim(),
      cwd: entry.cwd,
      kind: entry.adminKind,
      resetToAuto: reset,
    }),
  );
  await refreshSessions();
}

async function deleteSession(entry: SessionListEntry, fromList: boolean) {
  if (!window.confirm(`删除会话 ${sessionTitle(entry)}？`)) return;
  if (entry.sessionId === sessionId) {
    if (turnRunning && acp.connected) {
      acp.notify("session/cancel", buildSessionCancelParams(entry.sessionId));
      turnRunning = false;
    }
  }
  await acpCall(
    "x.ai/session/delete",
    buildSessionDeleteParams({
      sessionId: entry.sessionId,
      cwd: entry.cwd,
      kind: entry.adminKind,
    }),
  );
  if (entry.sessionId === sessionId) leaveSession();
  await refreshSessions();
  if (fromList) hint.textContent = "已删除";
}

async function forkSession(entry: SessionListEntry) {
  const sourceCwd = entry.cwd || workspaceCwd();
  if (!sourceCwd) throw new Error("fork 需要 cwd");
  const created = await acpCall(
    "x.ai/session/fork",
    buildSessionForkParams({
      sourceSessionId: entry.sessionId,
      sourceCwd,
      newCwd: sourceCwd,
    }),
  );
  const id = parseForkNewSessionId(created);
  await refreshSessions();
  if (id) await loadSession(id, { cwd: sourceCwd, reconnect: false });
}

function closeSessionTools() {
  sessionTools.open = false;
}

function sheetCopy(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "sheet-copy";
  p.textContent = text;
  return p;
}

function sheetFoot(primary: string, onPrimary: () => void, opts?: { danger?: boolean }): HTMLElement {
  const foot = document.createElement("div");
  foot.className = "sheet-foot";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "取消";
  cancel.addEventListener("click", () => closeAppDialog());
  const go = document.createElement("button");
  go.type = "button";
  go.className = opts?.danger ? "sheet-primary" : "sheet-primary";
  go.textContent = primary;
  go.addEventListener("click", onPrimary);
  foot.append(cancel, go);
  return foot;
}

function appendBillingSection(stack: HTMLElement) {
  if (!lastBilling) return;
  const snap = lastBilling;
  const h = document.createElement("p");
  h.className = "sheet-section";
  h.textContent = snap.subscriptionTier
    ? `${snap.periodLabel} · ${snap.subscriptionTier}`
    : snap.periodLabel;
  stack.append(h);
  stack.append(sheetCopy("这是账号额度。下面那场对话用了多少字，是另一回事。"));
  const hero = document.createElement("div");
  hero.className = "sheet-hero";
  const pct = document.createElement("strong");
  pct.textContent = `${snap.remainingPercent}%`;
  const sub = document.createElement("span");
  sub.textContent = "还剩";
  hero.append(pct, sub);
  stack.append(hero);
  const bar = document.createElement("div");
  bar.className = "usage-bar";
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", snap.periodLabel);
  const used = document.createElement("span");
  used.dataset.key = "used";
  used.style.flex = String(Math.max(snap.usedPercent, 0.5));
  const free = document.createElement("span");
  free.dataset.key = "free";
  free.style.flex = String(Math.max(snap.remainingPercent, 0.5));
  bar.append(used, free);
  stack.append(bar);
  const rows = document.createElement("div");
  rows.className = "usage-rows";
  const usedRow = document.createElement("div");
  usedRow.className = "usage-row";
  usedRow.append("已用", Object.assign(document.createElement("span"), {
    className: "muted",
    textContent: `${Math.floor(snap.usedPercent)}%`,
  }));
  rows.append(usedRow);
  if (snap.resetLabel) {
    const reset = document.createElement("div");
    reset.className = "usage-row";
    reset.append("重置", Object.assign(document.createElement("span"), {
      className: "muted",
      textContent: snap.resetLabel,
    }));
    rows.append(reset);
  }
  if (snap.prepaidDollars != null) {
    const pre = document.createElement("div");
    pre.className = "usage-row";
    pre.append(
      "已购额度",
      Object.assign(document.createElement("span"), {
        className: "muted",
        textContent: formatPrepaidDollars(Math.round(snap.prepaidDollars * 100)),
      }),
    );
    rows.append(pre);
  }
  stack.append(rows);
}

function openUsageSheet(raw: Json | null, entry: SessionListEntry | null) {
  appDialogBody.replaceChildren();
  const stack = document.createElement("div");
  stack.className = "sheet-stack";
  appendBillingSection(stack);
  if (!raw) {
    if (!lastBilling) stack.append(sheetCopy("暂时拿不到额度数字。登录 grok.com 账号后会出现。"));
    appDialogBody.append(stack);
    showAppDialog("账户额度", "sheet");
    return;
  }
  const b = parseContextBreakdown(raw);
  const ctxHead = document.createElement("p");
  ctxHead.className = "sheet-section";
  ctxHead.textContent = "这场对话";
  stack.append(ctxHead);
  stack.append(
    sheetCopy("模型一次能记住的内容有限。满了以后，较早的对话会被收成摘要。"),
  );
  const hero = document.createElement("div");
  hero.className = "sheet-hero";
  const pct = document.createElement("strong");
  pct.textContent = b.percent != null ? `${Math.round(b.percent)}%` : "—";
  const sub = document.createElement("span");
  sub.textContent =
    b.used != null && b.total != null
      ? `已用 · ${formatTokenCount(b.used)} / ${formatTokenCount(b.total)}`
      : "还没有用量数字";
  hero.append(pct, sub);
  stack.append(hero);
  const totalTokens = b.slices.reduce((sum, row) => sum + row.tokens, 0);
  if (totalTokens > 0) {
    const bar = document.createElement("div");
    bar.className = "usage-bar";
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", "上下文用量");
    for (const slice of b.slices) {
      const seg = document.createElement("span");
      seg.dataset.key = slice.key;
      seg.style.flex = String(Math.max(slice.tokens, 0));
      seg.title = `${slice.label} ${formatTokenCount(slice.tokens)}`;
      bar.append(seg);
    }
    stack.append(bar);
    const rows = document.createElement("div");
    rows.className = "usage-rows";
    for (const slice of b.slices.filter((s) => s.key !== "free")) {
      const row = document.createElement("div");
      row.className = "usage-row";
      const name = document.createElement("span");
      name.textContent = slice.label;
      const val = document.createElement("span");
      val.className = "muted";
      val.textContent = formatTokenCount(slice.tokens);
      row.append(name, val);
      rows.append(row);
    }
    if (b.free != null) {
      const row = document.createElement("div");
      row.className = "usage-row";
      const name = document.createElement("span");
      name.textContent = "还能用";
      const val = document.createElement("span");
      val.className = "muted";
      val.textContent = formatTokenCount(b.free);
      row.append(name, val);
      rows.append(row);
    }
    stack.append(rows);
  }
  if (b.categories.length) {
    const extra = document.createElement("div");
    extra.className = "usage-rows";
    for (const cat of b.categories) {
      const row = document.createElement("div");
      row.className = "usage-row";
      const name = document.createElement("span");
      name.textContent = cat.detail ? `${cat.label} · ${cat.detail}` : cat.label;
      const val = document.createElement("span");
      val.className = "muted";
      val.textContent = formatTokenCount(cat.tokens);
      row.append(name, val);
      extra.append(row);
    }
    stack.append(extra);
  }
  const threshold = b.autoCompactAt ?? 85;
  if (entry && b.percent != null && b.percent >= Math.max(60, threshold - 15)) {
    stack.append(sheetCopy(`接近上限（约 ${threshold}% 会自动压缩）。也可以现在压缩较早对话。`));
    const go = document.createElement("button");
    go.type = "button";
    go.className = "sheet-cta";
    go.textContent = "压缩较早对话";
    go.addEventListener("click", () => {
      closeAppDialog();
      openCompactSheet(entry);
    });
    stack.append(go);
  }
  appDialogBody.append(stack);
  showAppDialog(lastBilling ? "用量" : "这次对话用了多少", "sheet");
}

function openInfoSheet(raw: Json) {
  appDialogBody.replaceChildren();
  const stack = document.createElement("div");
  stack.className = "sheet-stack";
  const rows = document.createElement("div");
  rows.className = "info-rows";
  for (const field of parseSessionInfoFields(raw)) {
    const row = document.createElement("div");
    row.className = "info-row";
    const label = document.createElement("span");
    label.className = "muted";
    label.textContent = field.label;
    const val = document.createElement("span");
    val.textContent = field.value;
    row.append(label, val);
    if (field.label === "会话") {
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "复制";
      copy.addEventListener("click", () => {
        void navigator.clipboard.writeText(field.value).then(
          () => {
            copy.textContent = "已复制";
          },
          () => undefined,
        );
      });
      row.append(copy);
    }
    rows.append(row);
  }
  stack.append(rows, sheetCopy("点标题可以改名字。删除在会话菜单里。"));
  appDialogBody.append(stack);
  showAppDialog("会话信息", "sheet");
}

function openCompactSheet(entry: SessionListEntry) {
  appDialogBody.replaceChildren();
  const stack = document.createElement("div");
  stack.className = "sheet-stack";
  stack.append(
    sheetCopy("把前面的对话收成摘要，给后面腾出空间。压缩后不能完整回看那些原文。"),
  );
  const field = document.createElement("label");
  field.className = "sheet-field";
  field.textContent = "附加说明（可空）";
  const note = document.createElement("textarea");
  note.placeholder = "例如：请保留接口约定";
  field.append(note);
  stack.append(field);
  stack.append(
    sheetFoot("压缩", () => {
      closeAppDialog();
      void (async () => {
        await acpCall(
          "x.ai/compact_conversation",
          buildCompactParams(entry.sessionId, note.value.trim()),
        );
        showBanner("已开始压缩", "compact");
      })().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
    }),
  );
  appDialogBody.append(stack);
  showAppDialog("压缩较早对话", "sheet");
  note.focus();
}

function openExportSheet() {
  if (!sessionId) {
    showBanner("没有可导出的会话", "export");
    return;
  }
  appDialogBody.replaceChildren();
  const stack = document.createElement("div");
  stack.className = "sheet-stack";
  stack.append(sheetCopy("下载这次对话。Markdown 方便分享，纯文本更像完整记录。"));
  const md = document.createElement("button");
  md.type = "button";
  md.className = "export-choice";
  md.innerHTML = "<strong>下载 Markdown</strong><span>适合贴到文档或发给别人</span>";
  md.addEventListener("click", () => {
    downloadText(`${sessionId}.md`, threadText());
    closeAppDialog();
  });
  const txt = document.createElement("button");
  txt.type = "button";
  txt.className = "export-choice";
  txt.innerHTML = "<strong>下载纯文本</strong><span>同一份内容，.txt 文件</span>";
  txt.addEventListener("click", () => {
    downloadText(`${sessionId}.txt`, threadText());
    closeAppDialog();
  });
  stack.append(md, txt);
  appDialogBody.append(stack);
  showAppDialog("导出这次对话", "sheet");
}

async function showInfo(entry: SessionListEntry) {
  const info = await acpCall("x.ai/session/info", buildSessionInfoParams(entry.sessionId));
  openInfoSheet(info);
}

async function showContext(entry: SessionListEntry) {
  await showUsage(entry);
}

async function showUsage(entry: SessionListEntry | null) {
  await refreshBilling();
  if (!entry) {
    openUsageSheet(null, null);
    return;
  }
  try {
    const info = extResultPayload(
      await acpCall("x.ai/session/info", buildSessionInfoParams(entry.sessionId)),
    );
    applyModelState(info);
    applyContextUsage(info);
    openUsageSheet(info, entry);
  } catch {
    openUsageSheet(null, entry);
  }
}

async function rewindSession(entry: SessionListEntry) {
  const raw = await acpCall("x.ai/rewind/points", buildRewindPointsParams(entry.sessionId));
  const points = parseRewindPoints(raw);
  if (!points.length) {
    showBanner("没有可回退的 turn", "rewind");
    return;
  }
  const buttons = points.map((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${p.promptIndex}: ${p.preview.slice(0, 80)}`;
    b.addEventListener("click", () => {
      void (async () => {
        if (!window.confirm(`回退到 turn ${p.promptIndex}？`)) return;
        closeAction();
        await acpCall(
          "x.ai/rewind/execute",
          buildRewindExecuteParams({
            sessionId: entry.sessionId,
            targetPromptIndex: p.promptIndex,
          }),
        );
        await loadSession(entry.sessionId, { cwd: entry.cwd, reconnect: false });
      })().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
    });
    return b;
  });
  openAction("回退到", "选择一个用户 turn", buttons);
}

async function compactSession(entry: SessionListEntry) {
  openCompactSheet(entry);
}

async function recapSession(entry: SessionListEntry, auto: boolean) {
  lastRecapAt = Date.now();
  await acpCall("x.ai/recap", buildRecapParams(entry.sessionId, auto));
  hint.textContent = auto ? "自动回顾中" : "回顾中";
}

async function shareSession(entry: SessionListEntry) {
  const raw = await acpCall("x.ai/share_session", buildShareParams(entry.sessionId));
  const url = parseShareUrl(raw);
  if (url) {
    await navigator.clipboard.writeText(url).catch(() => undefined);
    openAction("分享链接", url);
  } else {
    openAction("分享", JSON.stringify(raw, null, 2));
  }
}

async function newWorktree() {
  const source = workspaceCwd();
  if (!source) throw new Error("需要工作目录");
  appDialogBody.replaceChildren();
  const stack = document.createElement("div");
  stack.className = "sheet-stack";
  stack.append(
    sheetCopy("会复制一份当前仓库，在副本里开新会话。你正在改的文件不会被碰到。"),
  );
  const labelField = document.createElement("label");
  labelField.className = "sheet-field";
  labelField.textContent = "标签（可空）";
  const label = document.createElement("input");
  label.placeholder = "例如：修登录";
  labelField.append(label);
  const refField = document.createElement("label");
  refField.className = "sheet-field";
  refField.textContent = "基于哪个提交（可空，默认当前）";
  const gitRef = document.createElement("input");
  gitRef.placeholder = "main 或某个 commit";
  gitRef.spellcheck = false;
  refField.append(gitRef);
  stack.append(labelField, refField);
  stack.append(
    sheetFoot("创建副本", () => {
      closeAppDialog();
      void (async () => {
        const newId = crypto.randomUUID();
        const raw = await acpCall(
          "x.ai/git/worktree/create_from_worktree_sync",
          buildWorktreeSyncParams({
            sourceWorktreePath: source,
            newSessionId: newId,
            label: label.value.trim() || undefined,
            gitRef: gitRef.value.trim() || undefined,
          }),
        );
        const path = parseWorktreePath(raw) || source;
        cwd.value = path;
        persistFields();
        await newSession();
      })().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
    }),
  );
  appDialogBody.append(stack);
  showAppDialog("新建独立副本", "sheet");
  label.focus();
}

async function resumeWorktree(entry: SessionListEntry) {
  const sourceCwd = entry.cwd || workspaceCwd();
  if (!sourceCwd) throw new Error("需要工作目录");
  appDialogBody.replaceChildren();
  const stack = document.createElement("div");
  stack.className = "sheet-stack";
  stack.append(
    sheetCopy("会复制一份仓库，这次会话在副本里继续。你现在的文件不会被改掉。"),
  );
  stack.append(
    sheetFoot("打开副本", () => {
      closeAppDialog();
      void (async () => {
        const raw = await acpCall(
          "x.ai/git/worktree/resume_session",
          buildResumeInWorktreeParams({ sessionId: entry.sessionId, sourceCwd }),
        );
        const result = parseResumeWorktreeResult(raw);
        await refreshSessions();
        if (result.sessionId) {
          if (result.cwd) {
            cwd.value = result.cwd;
            persistFields();
          }
          await loadSession(result.sessionId, {
            cwd: result.cwd || sourceCwd,
            reconnect: false,
          });
        } else {
          showBanner("已创建副本，请在左侧打开新会话", "worktree");
        }
      })().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
    }),
  );
  appDialogBody.append(stack);
  showAppDialog("在独立副本里打开", "sheet");
}

async function changeCwd() {
  appDialogBody.replaceChildren();
  const stack = document.createElement("div");
  stack.className = "sheet-stack";
  stack.append(sheetCopy("这只影响之后的新会话。当前这场对话不会搬家。"));
  const field = document.createElement("label");
  field.className = "sheet-field";
  field.textContent = "工作目录";
  const input = document.createElement("input");
  input.value = workspaceCwd();
  input.spellcheck = false;
  field.append(input);
  stack.append(field);
  stack.append(
    sheetFoot("保存", () => {
      const next = input.value.trim();
      if (!next) return;
      cwd.value = next;
      persistFields();
      closeAppDialog();
      showBanner(`之后的新会话会用 ${next}`, "cwd");
    }),
  );
  appDialogBody.append(stack);
  showAppDialog("下次会话的工作目录", "sheet");
  input.focus();
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
  lastBilling = null;
  billingChip.hidden = true;
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
btnHome.addEventListener("click", () => {
  showDashboard();
});
$("btn-action-close").addEventListener("click", () => closeAction());
actionModal.addEventListener("click", (ev) => {
  if (ev.target === actionModal) closeAction();
});
sessionSearch.addEventListener("input", () => {
  if (listSearchTimer !== null) window.clearTimeout(listSearchTimer);
  listSearchTimer = window.setTimeout(() => {
    listQuery = sessionSearch.value;
    void refreshSessions();
  }, 280);
});
function withEntry(fn: (e: SessionListEntry) => Promise<void>) {
  return () => {
    const e = currentEntry();
    if (!e) return;
    fn(e).catch((err) => showBanner(err instanceof Error ? err.message : String(err)));
  };
}
sessionTools.addEventListener("click", (ev) => {
  if ((ev.target as HTMLElement | null)?.closest("button")) closeSessionTools();
});
document.addEventListener("pointerdown", (ev) => {
  if (!sessionTools.open) return;
  if (sessionTools.contains(ev.target as Node)) return;
  closeSessionTools();
});
btnInfo.addEventListener("click", withEntry(showInfo));
btnRename.addEventListener("click", withEntry(renameSession));
btnDelete.addEventListener("click", withEntry((e) => deleteSession(e, false)));
btnFork.addEventListener("click", withEntry(forkSession));
btnRewind.addEventListener("click", withEntry(rewindSession));
btnCompact.addEventListener("click", withEntry(compactSession));
btnContext.addEventListener("click", withEntry(showContext));
btnRecap.addEventListener("click", withEntry((e) => recapSession(e, false)));
btnExport.addEventListener("click", () => {
  openExportSheet();
});
btnTranscript.addEventListener("click", () => {
  openExportSheet();
});
btnShare.addEventListener("click", withEntry(shareSession));
btnCd.addEventListener("click", () => {
  changeCwd().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnWorktreeNew.addEventListener("click", () => {
  newWorktree().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnWorktreeResume.addEventListener("click", withEntry(resumeWorktree));
btnWorktreeList.addEventListener("click", () => {
  acpCall("x.ai/git/worktree/list", buildWorktreeListParams(workspaceCwd() || undefined))
    .then((raw) => {
      worktreeOut.textContent = JSON.stringify(raw, null, 2);
    })
    .catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnWorktreeGc.addEventListener("click", () => {
  acpCall("x.ai/git/worktree/gc", { dryRun: true })
    .then((raw) => {
      worktreeOut.textContent = JSON.stringify(raw, null, 2);
    })
    .catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !sessionId || !acp.connected) return;
  if (Date.now() - lastRecapAt < 60_000) return;
  const e = currentEntry();
  if (e) void recapSession(e, true).catch(() => undefined);
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
  closeSettings();
  logout({ acp: true }).catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
btnSwitch.addEventListener("click", () => {
  closeSettings();
  logout({ acp: false }).catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
function openSettings() {
  openDialog(settingsModal);
}

function closeSettings() {
  closeDialog(settingsModal);
}

function closeAppDialog() {
  appDialogKind = null;
  appDialog.removeAttribute("data-kind");
  appDialogEsc.hidden = true;
  closeDialog(appDialog);
  appDialogBody.replaceChildren();
}

function showAppDialog(title: string, kind: AppDialogKind) {
  appDialogTitle.textContent = title;
  appDialogKind = kind;
  if (kind) appDialog.dataset.kind = kind;
  else appDialog.removeAttribute("data-kind");
  appDialogEsc.hidden = kind !== "block";
  openDialog(appDialog);
}

function showLaterStub(name: string) {
  appDialogBody.replaceChildren();
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = LATER_TOAST;
  const extra = document.createElement("p");
  extra.className = "muted";
  extra.textContent = name;
  appDialogBody.append(p, extra);
  showAppDialog(name, "later");
}

function paletteSlashList() {
  return mergeSlashMenu(
    LOCAL_SLASH,
    (snapshot?.availableCommands ?? []).map((c) => ({
      name: c.name,
      description: c.description,
      argumentHint: c.argumentHint,
    })),
  );
}

function paletteIcon(kind: PaletteItem["kind"]): string {
  if (kind === "shortcut") return "⌘";
  if (kind === "skill") return "▣";
  return "/";
}

function paintPaletteRows(list: HTMLElement) {
  const menu = paletteSlashList();
  const slash = menu.filter((c) => (c.kind ?? slashKind(c.name)) !== "skill");
  const skills = menu.filter((c) => (c.kind ?? slashKind(c.name)) === "skill");
  const extras: PaletteItem[] = [
    { id: "entry:image", kind: "shortcut", title: "图片预览", hint: "入口", run: "lightbox" },
    { id: "entry:video", kind: "shortcut", title: "视频预览", hint: "入口", run: "lightbox" },
  ];
  paletteItems = filterPaletteItems(
    [...buildPaletteItems({ slash, skills }), ...extras],
    paletteQuery,
  );
  paletteIndex = Math.min(Math.max(0, paletteIndex), Math.max(0, paletteItems.length - 1));
  list.replaceChildren();
  let offset = 0;
  for (const group of groupPaletteItems(paletteItems.slice(0, 48))) {
    const lab = document.createElement("div");
    lab.className = "palette-group-label";
    lab.textContent = group.label;
    list.append(lab);
    for (const item of group.items) {
      const i = offset;
      offset += 1;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "palette-row";
      b.setAttribute("aria-selected", i === paletteIndex ? "true" : "false");
      const ico = document.createElement("span");
      ico.className = "palette-ico";
      ico.textContent = paletteIcon(item.kind);
      const title = document.createElement("span");
      title.textContent = item.title;
      const hintEl = document.createElement("span");
      hintEl.className = "slash-hint";
      hintEl.textContent = item.hint;
      const cmd = menu.find((c) => c.name === item.run);
      const kind = item.kind === "shortcut" ? null : (cmd?.kind ?? slashKind(item.run, item.kind === "skill" ? "available" : "local"));
      if (kind) {
        const badge = document.createElement("span");
        badge.className = `slash-badge slash-badge-${kind}`;
        badge.textContent = slashBadgeLabel(kind);
        b.append(ico, title, hintEl, badge);
      } else {
        b.append(ico, title, hintEl);
      }
      b.addEventListener("click", () => {
        void acceptPalette(item);
      });
      list.append(b);
    }
  }
}

function openPalette() {
  paletteQuery = "";
  paletteIndex = 0;
  appDialogBody.replaceChildren();
  const wrap = document.createElement("label");
  wrap.className = "palette-search-wrap";
  wrap.innerHTML =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9.8 9.8 13.2 13.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const input = document.createElement("input");
  input.className = "palette-search";
  input.placeholder = "搜索快捷键、slash、skills";
  wrap.append(input);
  const list = document.createElement("div");
  list.id = "palette-list";
  const foot = document.createElement("p");
  foot.className = "palette-foot";
  foot.textContent = "Ctrl+P 打开 · Esc 关";
  input.addEventListener("input", () => {
    paletteQuery = input.value;
    paletteIndex = 0;
    paintPaletteRows(list);
  });
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      paletteIndex = Math.min(paletteItems.length - 1, paletteIndex + 1);
      paintPaletteRows(list);
    }
    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      paletteIndex = Math.max(0, paletteIndex - 1);
      paintPaletteRows(list);
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      const item = paletteItems[paletteIndex];
      if (item) void acceptPalette(item);
    }
  });
  appDialogBody.append(wrap, list, foot);
  showAppDialog("命令", "palette");
  paintPaletteRows(list);
  input.focus();
}

function openShortcutsHelp() {
  appDialogBody.replaceChildren();
  const grid = document.createElement("div");
  grid.className = "shortcut-grid";
  const extra = app.dataset.surface === "dashboard" ? DASH_HELP_SHORTCUTS : [];
  for (const row of [...HELP_SHORTCUTS, ...extra]) {
    const line = document.createElement("div");
    line.className = "shortcut-row";
    const keys = document.createElement("kbd");
    keys.textContent = row.keys;
    const title = document.createElement("span");
    title.textContent = row.title;
    line.append(keys, title);
    grid.append(line);
  }
  appDialogBody.append(grid);
  showAppDialog("快捷键", "shortcuts");
}

function openBlockPreview(item: (typeof timeline.items)[number]) {
  appDialogBody.replaceChildren();
  const status = document.createElement("div");
  status.className = "block-status";
  const label = item.title || item.who || item.kind;
  const st = item.status || (item.kind === "tool" ? "done" : item.kind);
  const done = /complete|done|ok|success|completed/i.test(st) || item.kind !== "tool";
  const elapsed = item.elapsedMs != null ? `${(item.elapsedMs / 1000).toFixed(1)}s` : "";
  status.textContent = done ? `${item.kind === "tool" ? `function ${label}` : label} 已完成` : `${label} ${st}`;
  if (elapsed) {
    const time = document.createElement("span");
    time.style.marginLeft = "auto";
    time.textContent = elapsed;
    status.append(time);
  }
  const code = document.createElement("div");
  code.className = "block-code";
  const body = item.raw || item.text || "";
  const lines = body.split("\n");
  const gutter = document.createElement("div");
  gutter.className = "block-gutter";
  gutter.textContent = lines.map((_, i) => String(i + 1)).join("\n");
  const pre = document.createElement("pre");
  pre.className = "block-code-body";
  pre.textContent = body;
  code.append(gutter, pre);
  const actions = document.createElement("div");
  actions.className = "block-actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "复制内容";
  copy.addEventListener("click", () => {
    void navigator.clipboard.writeText(body).catch(() => downloadText("block.txt", body));
  });
  actions.append(copy);
  appDialogBody.append(status, code, actions);
  showAppDialog(`块预览 · ${label}`, "block");
}

function openArgStep(name: string, hintText: string) {
  appDialogBody.replaceChildren();
  const label = document.createElement("label");
  label.textContent = hintText;
  const input = document.createElement("input");
  input.className = "arg-input";
  input.placeholder = hintText;
  const go = document.createElement("button");
  go.type = "button";
  go.textContent = "执行";
  const run = () => {
    const text = formatSlashSubmit(name, input.value);
    closeAppDialog();
    void submitComposer({ text }).catch((e) =>
      showBanner(e instanceof Error ? e.message : String(e)),
    );
  };
  go.addEventListener("click", run);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      run();
    }
  });
  appDialogBody.append(label, input, go);
  showAppDialog(`/${name}`, "args");
  input.focus();
}

async function acceptPalette(item: PaletteItem) {
  if (item.run === "lightbox") {
    closeAppDialog();
    showLaterStub("音视频");
    return;
  }
  if (item.kind === "shortcut") {
    closeAppDialog();
    if (item.run === "palette") openPalette();
    else if (item.run === "shortcuts") openShortcutsHelp();
    else if (item.run === "settings") openSettings();
    else if (item.run === "model") openModelPicker();
    return;
  }
  const cmd =
    paletteSlashList().find((c) => c.name === item.run) ?? {
      name: item.run,
      description: item.hint,
      argumentHint: item.argumentHint ?? null,
    };
  const plan = planSlash(`/${cmd.name}`);
  if (plan.kind === "later") {
    closeAppDialog();
    showLaterStub(cmd.name);
    return;
  }
  if (cmd.argumentHint) {
    openArgStep(cmd.name, cmd.argumentHint);
    return;
  }
  closeAppDialog();
  const handled = await runLocalSlash({ name: cmd.name, args: "" });
  if (!handled) await sendPrompt(`/${cmd.name}`);
}

billingChip.addEventListener("click", () => {
  void showUsage(currentEntry()).catch((e) =>
    showBanner(e instanceof Error ? e.message : String(e)),
  );
});
btnSettings.addEventListener("click", () => openSettings());
btnSettingsClose.addEventListener("click", () => closeSettings());
$("btn-app-dialog-close").addEventListener("click", () => closeAppDialog());
appDialog.addEventListener("click", (ev) => {
  if (ev.target === appDialog) closeAppDialog();
});
sessionLabel.addEventListener("click", () => {
  const entry = currentEntry();
  if (entry) void renameSession(entry);
});
btnHeaderModel.addEventListener("click", (ev) => {
  ev.stopPropagation();
  void openHeaderModelMenu();
});
headerYolo.addEventListener("click", () => {
  void setSessionMode(sessionPermMode === "yolo" ? "ask" : "yolo");
});
headerPlan.addEventListener("click", () => {
  void setSessionMode(sessionPermMode === "plan" ? "ask" : "plan");
});
modeSeg.addEventListener("click", (ev) => {
  const btn = ev.target instanceof HTMLElement ? ev.target.closest("button[data-mode]") : null;
  const mode = btn?.getAttribute("data-mode");
  if (mode === "ask" || mode === "plan" || mode === "yolo") void setSessionMode(mode);
});
headerContext.addEventListener("click", () => {
  const entry = currentEntry();
  if (entry) void refreshContextChip(entry.sessionId);
});
document.addEventListener("click", (ev) => {
  if (headerModelMenu.hidden) return;
  const t = ev.target;
  if (t instanceof Node && (headerModelMenu.contains(t) || btnHeaderModel.contains(t))) return;
  headerModelMenu.hidden = true;
});
$("image-lightbox").addEventListener("click", (ev) => {
  if (ev.target === $("image-lightbox")) closeLightbox();
});
$("lightbox-prev").addEventListener("click", (ev) => {
  ev.stopPropagation();
  stepLightbox(-1);
});
$("lightbox-next").addEventListener("click", (ev) => {
  ev.stopPropagation();
  stepLightbox(1);
});
document.addEventListener("keydown", (ev) => {
  if ($("image-lightbox").hidden) return;
  if (ev.key === "Escape") {
    ev.preventDefault();
    closeLightbox();
    return;
  }
  if (ev.key === "ArrowLeft") {
    ev.preventDefault();
    stepLightbox(-1);
  }
  if (ev.key === "ArrowRight") {
    ev.preventDefault();
    stepLightbox(1);
  }
});
settingsModal.addEventListener("click", (ev) => {
  if (ev.target === settingsModal) closeSettings();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !settingsModal.hidden) {
    ev.preventDefault();
    closeSettings();
  }
  if (ev.key === "Escape" && !appDialog.hidden) {
    ev.preventDefault();
    closeAppDialog();
  }
});

btnContinue.addEventListener("click", () => {
  const first = recentSessions[0];
  if (!first) return;
  openListedSession(first).catch((e) =>
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
        sourcePath: workspaceCwd(),
      }),
    );
    noteSys("已请求新 worktree");
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

function hidePopovers() {
  slashMenu.hidden = true;
  promptHistoryEl.hidden = true;
  atMenu.hidden = true;
  closeComposerMenu();
  syncComposerHint();
}

function setComposerMode(mode: "" | "shell" | "remember") {
  composerMode = mode;
  composerWrap.dataset.mode = mode;
  composerPrefix.textContent = mode === "shell" ? "!" : mode === "remember" ? "#" : "❯";
}

function openFind(query: string) {
  findBar.hidden = false;
  findInput.value = query;
  runFind(query);
  findInput.focus();
}

function runFind(query: string) {
  findHits = timeline.findHits(query);
  findCursor = 0;
  findCount.textContent = findHits.length ? `${findHits.length}` : "0";
  for (const el of thread.querySelectorAll("mark.find-hit")) {
    const parent = el.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(el.textContent ?? ""), el);
    parent.normalize();
  }
  const hit = findHits[0];
  if (hit) timelineNodes.get(hit.id)?.scrollIntoView({ block: "center" });
}

function openJump() {
  jumpPanel.hidden = false;
  jumpPanel.replaceChildren();
  const head = document.createElement("div");
  head.className = "queue-pane-head";
  head.textContent = "跳到某一轮";
  jumpPanel.append(head);
  const turns = timeline.turns();
  if (!turns.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "还没有 turn";
    jumpPanel.append(empty);
    return;
  }
  turns.forEach((item, i) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "history-row";
    row.textContent = `${i + 1}. ${item.who}: ${item.text.slice(0, 80)}`;
    row.addEventListener("click", () => {
      timeline.select(item.id);
      timelineNodes.get(item.id)?.scrollIntoView({ block: "start" });
      jumpPanel.hidden = true;
      syncThread();
    });
    jumpPanel.append(row);
  });
}

function renderAtMenu() {
  atMenu.hidden = atItems.length === 0;
  atMenu.replaceChildren();
  atItems.forEach((row, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slash-row";
    b.setAttribute("aria-selected", i === atIndex ? "true" : "false");
    b.textContent = row.path;
    b.addEventListener("click", () => acceptAt(row.path));
    atMenu.append(b);
  });
}

function acceptAt(path: string) {
  const caret = promptEl.selectionStart ?? promptEl.value.length;
  promptEl.value = applyAtAccept(promptEl.value, caret, path);
  hidePopovers();
  promptEl.focus();
}

function atSearchRoot(): string {
  return (currentEntry()?.cwd || workspaceCwd()).trim();
}

async function closeFuzzy() {
  const id = fuzzySearchId;
  fuzzySearchId = null;
  fuzzySearchKey = "";
  if (!id || !acp.connected) return;
  try {
    await acp.request("x.ai/search/fuzzy/close", { searchId: id });
  } catch {
    /* already gone */
  }
}

async function ensureFuzzy(query: string) {
  const root = atSearchRoot();
  const hidden = query.startsWith("!");
  const key = `${root}\0${hidden ? "1" : "0"}`;
  try {
    if (fuzzySearchId && fuzzySearchKey !== key) await closeFuzzy();
    if (!fuzzySearchId) {
      const raw = await acp.request(
        "x.ai/search/fuzzy/open",
        buildFuzzyOpenParams({ sessionId, cwd: root, hidden }),
      );
      fuzzySearchId = parseFuzzyOpen(raw);
      fuzzySearchKey = key;
    }
    if (fuzzySearchId) {
      await acp.request("x.ai/search/fuzzy/change", {
        searchId: fuzzySearchId,
        query: hidden ? query.slice(1) : query,
        limit: 30,
      });
    }
  } catch {
    atItems = [];
    renderAtMenu();
  }
}

function hintFocus(): "composer" | "thread" | "slash" | "other" {
  if (slashPopoverOpen()) return "slash";
  const ae = document.activeElement;
  if (ae === promptEl) return "composer";
  if (ae instanceof Node && thread.contains(ae)) return "thread";
  return "other";
}

function defaultComposerHint(): string {
  return hintForFocus(hintFocus(), composerPrefs.enterSends);
}

function syncComposerHint() {
  if (turnRunning) {
    hint.textContent = turnStatusEl.textContent || "生成中";
    return;
  }
  if (!slashMenu.hidden) {
    hint.textContent = hintForFocus("slash", composerPrefs.enterSends);
    return;
  }
  if (!slashPicker.hidden && pickerMode === "model") {
    hint.textContent = "Enter 应用模型 · ? 快捷键";
    return;
  }
  if (!slashPicker.hidden && pickerMode === "theme") {
    hint.textContent = "点选即预览 · Esc 还原";
    return;
  }
  hint.textContent = defaultComposerHint();
}

function slashPopoverOpen(): boolean {
  return !slashMenu.hidden || !slashPicker.hidden;
}

function applyThemeChoice(pref: "auto" | "dark" | "light", persist: boolean) {
  themePref = pref;
  themePrefEl.value = pref;
  applyTheme(pref);
  if (persist) persistThemePref(pref, localStorage);
}

function closeSlashPicker(revertTheme: boolean) {
  if (revertTheme && themePreviewOrig) {
    applyThemeChoice(themePreviewOrig, false);
  }
  themePreviewOrig = null;
  pickerMode = null;
  pickerItems = [];
  pickerIndex = 0;
  slashPicker.hidden = true;
  slashPicker.replaceChildren();
}

function renderPicker() {
  slashPicker.replaceChildren();
  const title = document.createElement("div");
  title.className = "slash-picker-title";
  title.textContent = pickerMode === "theme" ? "主题" : "模型";
  slashPicker.append(title);
  if (!pickerItems.length) {
    const empty = document.createElement("div");
    empty.className = "slash-hint";
    empty.style.padding = "0.45rem 0.75rem";
    empty.textContent = pickerMode === "model" ? "暂无模型快照" : "无主题";
    slashPicker.append(empty);
    slashPicker.hidden = false;
    syncComposerHint();
    return;
  }
  pickerItems.forEach((item, i) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "slash-row";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", i === pickerIndex ? "true" : "false");
    if (pickerMode === "theme") {
      const swatch = document.createElement("span");
      swatch.className = `theme-swatch theme-swatch-${item.id}`;
      row.append(swatch);
    }
    const name = document.createElement("span");
    name.className = "slash-name";
    name.textContent = item.label;
    const meta = document.createElement("span");
    meta.className = "slash-hint";
    meta.textContent = item.current ? `${item.meta ?? ""} 当前`.trim() : (item.meta ?? "");
    row.append(name, meta);
    row.addEventListener("click", () => acceptPicker(item));
    slashPicker.append(row);
  });
  slashPicker.hidden = false;
  syncComposerHint();
}

function openModelPicker() {
  void openHeaderModelMenu();
}

async function refreshContextChip(id: string) {
  try {
    const info = extResultPayload(await acpCall("x.ai/session/info", buildSessionInfoParams(id)));
    applyModelState(info);
    applyContextUsage(info);
  } catch {
    if (!/\d/.test(headerContext.textContent ?? "")) headerContext.textContent = "上下文 —%";
  }
}

async function openHeaderModelMenu() {
  headerModelMenu.hidden = false;
  if (!catalogModels.length && sessionId) {
    try {
      const info = await acpCall("x.ai/session/info", buildSessionInfoParams(sessionId));
      applyModelState(info);
      applyContextUsage(info);
    } catch {
      /* keep empty */
    }
  }
  const effort = effortChipLabel(currentEffort);
  headerModelMenu.replaceChildren();
  if (!catalogModels.length) {
    const empty = document.createElement("div");
    empty.className = "header-model-item";
    empty.textContent = "没有模型列表";
    headerModelMenu.append(empty);
    return;
  }
  for (const m of catalogModels) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "header-model-item";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", m.id === currentModelId ? "true" : "false");
    const name = document.createElement("span");
    name.textContent = m.name;
    const meta = document.createElement("span");
    meta.className = "model-effort";
    meta.textContent = m.id === currentModelId ? `${effort} 当前`.trim() : effort;
    row.append(name, meta);
    row.addEventListener("click", () => {
      headerModelMenu.hidden = true;
      void setSessionModel(m.id);
    });
    headerModelMenu.append(row);
  }
}

function openThemePicker() {
  closeSlashPicker(false);
  slashMenu.hidden = true;
  pickerMode = "theme";
  themePreviewOrig = themePref;
  pickerItems = [
    { id: "light", label: "浅", current: themePref === "light" },
    { id: "dark", label: "暗", current: themePref === "dark" },
    { id: "auto", label: "系统", current: themePref === "auto" },
  ];
  pickerIndex = Math.max(0, pickerItems.findIndex((m) => m.current));
  renderPicker();
  const cur = pickerItems[pickerIndex];
  if (cur && (cur.id === "auto" || cur.id === "dark" || cur.id === "light")) {
    applyThemeChoice(cur.id, false);
  }
}

function acceptPicker(item: PickerItem) {
  if (pickerMode === "model") {
    closeSlashPicker(false);
    promptEl.value = "";
    void setSessionModel(item.id);
    syncComposerHint();
    return;
  }
  if (pickerMode === "theme" && (item.id === "auto" || item.id === "dark" || item.id === "light")) {
    applyThemeChoice(item.id, true);
    themePreviewOrig = null;
    closeSlashPicker(false);
    promptEl.value = "";
    syncComposerHint();
  }
}

function previewPicker(index: number) {
  pickerIndex = index;
  renderPicker();
  const item = pickerItems[pickerIndex];
  if (pickerMode === "theme" && item && (item.id === "auto" || item.id === "dark" || item.id === "light")) {
    applyThemeChoice(item.id, false);
  }
}

function openHelpCard() {
  helpList.replaceChildren();
  const extras = (snapshot?.availableCommands ?? [])
    .filter((c) => c.name.includes(":"))
    .map((c) => ({
      name: c.name,
      description: c.description,
      argumentHint: c.argumentHint,
      kind: "skill" as SlashKind,
    }));
  const cmds = wiredHelpCommands(mergeSlashMenu(LOCAL_SLASH, extras));
  for (const cmd of cmds) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "slash-name";
    name.textContent = `/${cmd.name}`;
    const desc = document.createElement("span");
    desc.className = "slash-hint";
    desc.textContent = cmd.description ?? "";
    const badge = document.createElement("span");
    const kind = cmd.kind ?? slashKind(cmd.name);
    badge.className = `slash-badge slash-badge-${kind}`;
    badge.textContent = slashBadgeLabel(kind);
    li.append(name, desc, badge);
    helpList.append(li);
  }
  helpCard.hidden = false;
  attachHelpCard();
  helpCard.scrollIntoView({ block: "nearest" });
}

function attachHelpCard() {
  if (helpCard.hidden) return;
  if (helpCard.parentElement !== thread) thread.append(helpCard);
}

function closeHelpCard() {
  helpCard.hidden = true;
}

function renderSlashMenu() {
  const q = slashQuery(promptEl.value, promptEl.selectionStart ?? promptEl.value.length);
  if (q !== null && !slashPicker.hidden) closeSlashPicker(true);
  if (!slashPicker.hidden) {
    slashMenu.hidden = true;
    syncComposerHint();
    return;
  }
  if (q === null) {
    slashMenu.hidden = true;
    syncComposerHint();
    return;
  }
  const commands: SlashCommand[] = mergeSlashMenu(
    LOCAL_SLASH,
    (snapshot?.availableCommands ?? []).map((c) => ({
      name: c.name,
      description: c.description,
      argumentHint: c.argumentHint,
    })),
  );
  slashItems = filterSlashCommands(commands, q);
  slashIndex = Math.min(slashIndex, Math.max(0, slashItems.length - 1));
  slashMenu.hidden = slashItems.length === 0;
  slashMenu.replaceChildren();
  slashItems.forEach((cmd, i) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "slash-row";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", i === slashIndex ? "true" : "false");
    const name = document.createElement("span");
    name.className = "slash-name";
    name.textContent = `/${cmd.name}`;
    const desc = document.createElement("span");
    desc.className = "slash-hint";
    desc.textContent = cmd.description ?? cmd.argumentHint ?? "";
    const badge = document.createElement("span");
    const kind = cmd.kind ?? slashKind(cmd.name);
    badge.className = `slash-badge slash-badge-${kind}`;
    badge.textContent = slashBadgeLabel(kind);
    row.append(name, desc, badge);
    row.addEventListener("click", () => acceptSlash(cmd));
    slashMenu.append(row);
  });
  syncComposerHint();
}

function acceptSlash(cmd: SlashCommand) {
  if (slashRunsOnAccept(cmd)) {
    hidePopovers();
    promptEl.value = "";
    void submitComposer({ text: `/${cmd.name}` }).catch((e) =>
      showBanner(e instanceof Error ? e.message : String(e)),
    );
    return;
  }
  promptEl.value = applySlashAccept(promptEl.value, cmd);
  hidePopovers();
  promptEl.focus();
}

function renderHistoryMenu() {
  promptHistoryEl.hidden = historyItems.length === 0;
  promptHistoryEl.replaceChildren();
  historyItems.forEach((text, i) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "history-row";
    row.setAttribute("aria-selected", i === historyIndex ? "true" : "false");
    row.textContent = text;
    row.addEventListener("click", () => {
      promptEl.value = text;
      hidePopovers();
    });
    promptHistoryEl.append(row);
  });
}

async function openPromptHistory() {
  historyItems = [...sentHistory];
  try {
    const raw = await acp.request(
      "x.ai/prompt_history",
      buildPromptHistoryParams({
        cwd: workspaceCwd() || "",
        filterSessionId: sessionId,
      }),
    );
    const remote = parsePromptHistory(raw);
    if (remote.length) historyItems = remote;
  } catch {
    /* local fallback */
  }
  historyIndex = 0;
  if (historyItems[0]) promptEl.value = historyItems[0];
  renderHistoryMenu();
}

function renderImageChips() {
  imageChipsEl.replaceChildren();
  for (const chip of imageChips) {
    const el = document.createElement("div");
    el.className = "image-chip";
    const src = `data:${chip.mimeType};base64,${chip.data}`;
    if ((chip.kind ?? "image") === "video") {
      const node = document.createElement("video");
      node.className = "thumb";
      node.src = src;
      node.muted = true;
      el.append(node);
    } else {
      const thumb = document.createElement("img");
      thumb.className = "thumb";
      thumb.alt = chip.name;
      thumb.src = src;
      el.append(thumb);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "image-chip-remove";
    remove.setAttribute("aria-label", `移除 ${chip.name}`);
    remove.title = "移除";
    remove.innerHTML =
      '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M3 3l6 6M9 3L3 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    remove.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      imageChips = imageChips.filter((c) => c.id !== chip.id);
      renderImageChips();
    });
    el.append(remove);
    imageChipsEl.append(el);
  }
  syncComposerFilled();
}

function addImageFile(file: File) {
  if (pasteTooLarge(0, file.size)) {
    showBanner("粘贴过大", "paste");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result ?? "");
    const comma = url.indexOf(",");
    const data = comma >= 0 ? url.slice(comma + 1) : url;
    imageChips = [
      ...imageChips,
      {
        id: `img-${queueIdSeq++}`,
        mimeType: file.type || "image/png",
        data,
        name: file.name || "image",
        kind: file.type.startsWith("video/") ? "video" : "image",
      },
    ];
    renderImageChips();
  };
  reader.readAsDataURL(file);
}

composer.addEventListener("submit", (ev) => {
  ev.preventDefault();
  submitComposer().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});

promptEl.addEventListener("input", () => {
  if (!promptHistoryEl.hidden) hidePopovers();
  ghostText = "";
  ghostEl.hidden = true;
  renderSlashMenu();
  const q = atQuery(promptEl.value, promptEl.selectionStart ?? promptEl.value.length);
  if (q !== null) {
    atIndex = 0;
    void ensureFuzzy(q);
  } else {
    atMenu.hidden = true;
  }
  planNudge.hidden = !looksLikePlan(promptEl.value);
  syncComposerFilled();
  if (q === null && slashQuery(promptEl.value, promptEl.selectionStart ?? 0) === null) {
    void fetchSuggest(promptEl.value);
  }
});

let suggestTimer: number | null = null;
async function fetchSuggest(text: string) {
  if (suggestTimer !== null) window.clearTimeout(suggestTimer);
  suggestTimer = window.setTimeout(async () => {
    if (!workspaceCwd() || !text.trim()) return;
    try {
      const raw = await acp.request("x.ai/suggest", {
        text,
        cursor: promptEl.selectionStart ?? text.length,
        cwd: workspaceCwd(),
        sessionId: sessionId ?? "",
        limit: 8,
        generation: Date.now(),
      });
      const parsed = parseSuggest(raw);
      if (parsed.ghost && promptEl.value === text) {
        ghostText = parsed.ghost;
        ghostEl.hidden = false;
        ghostEl.textContent = text + parsed.ghost;
      }
    } catch {
      /* optional */
    }
  }, 280);
}

promptEl.addEventListener("paste", (ev) => {
  const files = [...(ev.clipboardData?.files ?? [])];
  const images = files.filter((f) => f.type.startsWith("image/"));
  if (images.length) {
    ev.preventDefault();
    for (const f of images) addImageFile(f);
    return;
  }
  const text = ev.clipboardData?.getData("text") ?? "";
  if (pasteTooLarge(text.length, 0)) {
    ev.preventDefault();
    showBanner("粘贴过大", "paste");
  }
});

composer.addEventListener("dragover", (ev) => {
  ev.preventDefault();
});
composer.addEventListener("drop", (ev) => {
  ev.preventDefault();
  const files = [...(ev.dataTransfer?.files ?? [])];
  for (const file of files) {
    if (file.type.startsWith("image/")) addImageFile(file);
    else {
      const abs = `${workspaceCwd() || ""}/${file.name}`.replace(/\/+/g, "/");
      promptEl.value = `${promptEl.value}${promptEl.value ? "\n" : ""}${abs}`;
    }
  }
});

promptEl.addEventListener("keydown", (ev) => {
  const action = mapComposerKey(
    ev.key,
    { shift: ev.shiftKey, ctrl: ev.ctrlKey, meta: ev.metaKey, alt: ev.altKey },
    {
      enterSends: composerPrefs.enterSends,
      promptEmpty: promptEl.value === "",
      slashOpen: slashPopoverOpen(),
      historyOpen: !promptHistoryEl.hidden,
      atOpen: !atMenu.hidden,
      ghost: ghostText,
    },
  );
  if (action === "cycle-mode") {
    ev.preventDefault();
    cycleComposerMode();
    return;
  }
  if (action === "none") return;
  ev.preventDefault();
  if (action === "newline") {
    const start = promptEl.selectionStart ?? promptEl.value.length;
    const end = promptEl.selectionEnd ?? start;
    promptEl.value = `${promptEl.value.slice(0, start)}\n${promptEl.value.slice(end)}`;
    promptEl.selectionStart = promptEl.selectionEnd = start + 1;
    return;
  }
  if (action === "send" || action === "send-now") {
    submitComposer({ sendNow: action === "send-now" }).catch((e) =>
      showBanner(e instanceof Error ? e.message : String(e)),
    );
    return;
  }
  if (action === "slash-next") {
    if (!slashPicker.hidden) {
      previewPicker(Math.min(pickerItems.length - 1, pickerIndex + 1));
    } else {
      slashIndex = Math.min(slashItems.length - 1, slashIndex + 1);
      renderSlashMenu();
    }
  }
  if (action === "slash-prev") {
    if (!slashPicker.hidden) {
      previewPicker(Math.max(0, pickerIndex - 1));
    } else {
      slashIndex = Math.max(0, slashIndex - 1);
      renderSlashMenu();
    }
  }
  if (action === "slash-complete") {
    if (slashPicker.hidden && slashItems[slashIndex]) {
      promptEl.value = applySlashAccept(promptEl.value, slashItems[slashIndex]!);
      hidePopovers();
      promptEl.focus();
    }
  }
  if (action === "slash-accept") {
    if (!slashPicker.hidden && pickerItems[pickerIndex]) acceptPicker(pickerItems[pickerIndex]!);
    else if (slashItems[slashIndex]) acceptSlash(slashItems[slashIndex]!);
  }
  if (action === "slash-close") {
    closeSlashPicker(true);
    hidePopovers();
  }
  if (action === "accept-ghost" && ghostText) {
    promptEl.value += ghostText;
    ghostText = "";
    ghostEl.hidden = true;
  }
  if (action === "at-next") {
    atIndex = Math.min(atItems.length - 1, atIndex + 1);
    renderAtMenu();
  }
  if (action === "at-prev") {
    atIndex = Math.max(0, atIndex - 1);
    renderAtMenu();
  }
  if (action === "at-accept" && atItems[atIndex]) acceptAt(atItems[atIndex]!.path);
  if (action === "mode-shell") {
    setComposerMode("shell");
    promptEl.value = "";
  }
  if (action === "mode-remember") {
    setComposerMode("remember");
    promptEl.value = "";
  }
  if (action === "clear-draft") {
    if (promptEl.value.trim()) sentHistory.unshift(promptEl.value);
    promptEl.value = "";
    hidePopovers();
  }
  if (action === "history-prev") {
    if (promptHistoryEl.hidden) {
      void openPromptHistory();
      return;
    }
    historyIndex = Math.min(historyItems.length - 1, historyIndex + 1);
    promptEl.value = historyItems[historyIndex] ?? promptEl.value;
    renderHistoryMenu();
  }
  if (action === "history-next") {
    historyIndex = Math.max(0, historyIndex - 1);
    promptEl.value = historyItems[historyIndex] ?? "";
    if (historyIndex === 0 && !historyItems.length) hidePopovers();
    renderHistoryMenu();
  }
});

promptEl.addEventListener("keydown", (ev) => {
  if (ev.key === "PageUp" || ev.key === "PageDown") {
    ev.preventDefault();
    thread.scrollTop += ev.key === "PageDown" ? thread.clientHeight * 0.8 : -thread.clientHeight * 0.8;
  }
  if ((ev.key === "ArrowUp" || ev.key === "ArrowDown") && ev.altKey) {
    ev.preventDefault();
    const id = timeline.selectDelta(ev.key === "ArrowDown" ? 1 : -1);
    if (id) timelineNodes.get(id)?.scrollIntoView({ block: "nearest" });
    syncThread();
  }
}, true);

btnStop.addEventListener("click", () => {
  if (!turnRunning) return;
  const running = timeline.runningSubagentCount();
  const pref = parseCancelSubagentsPref(localStorage.getItem(CANCEL_SUBAGENTS_PREF_KEY));
  if (running > 0 && pref === "always_stop") {
    stopTurn(true);
    return;
  }
  if (running > 0 && pref === "always_continue") {
    stopTurn(false);
    return;
  }
  void blockHost.offerCancel(running);
});

btnFollow.addEventListener("click", () => {
  timeline.follow = true;
  syncThread();
});
railUp.addEventListener("click", () => stepRail(-1));
railPrevChip.addEventListener("click", () => stepRail(-1));
railDown.addEventListener("click", () => stepRail(1));

btnExpandAll.addEventListener("click", () => {
  timeline.setAllOpen(true);
  syncThread();
});
btnCollapseAll.addEventListener("click", () => {
  timeline.setAllOpen(false);
  syncThread();
});

enterSendsEl.addEventListener("change", () => {
  composerPrefs.enterSends = enterSendsEl.checked;
  persistComposerPrefs(composerPrefs, localStorage);
});
showThinkingEl.addEventListener("change", () => {
  composerPrefs.showThinking = showThinkingEl.checked;
  timeline.opts.showThinking = showThinkingEl.checked;
  persistComposerPrefs(composerPrefs, localStorage);
});
groupToolsEl.addEventListener("change", () => {
  composerPrefs.groupTools = groupToolsEl.checked;
  timeline.opts.groupTools = groupToolsEl.checked;
  persistComposerPrefs(composerPrefs, localStorage);
});
showTimestampsEl.addEventListener("change", () => {
  composerPrefs.showTimestamps = showTimestampsEl.checked;
  timeline.opts.showTimestamps = showTimestampsEl.checked;
  app.dataset.timestamps = showTimestampsEl.checked ? "1" : "0";
  persistComposerPrefs(composerPrefs, localStorage);
  syncThread();
});
showRailEl.addEventListener("change", () => {
  composerPrefs.showRail = showRailEl.checked;
  timeline.opts.showRail = showRailEl.checked;
  persistComposerPrefs(composerPrefs, localStorage);
  renderRail();
});
cancelSubagentsPrefEl.addEventListener("change", () => {
  localStorage.setItem(CANCEL_SUBAGENTS_PREF_KEY, parseCancelSubagentsPref(cancelSubagentsPrefEl.value));
});
permissionModeEl.addEventListener("change", () => {
  const mode = permissionModeEl.value;
  if (mode === "always-approve") {
    if (!window.confirm("此后本会话的工具不再询问。确定？")) {
      permissionModeEl.value = yoloMode ? "always-approve" : "ask";
      return;
    }
    setYoloMode(true);
    return;
  }
  yoloMode = false;
  yoloBadge.hidden = true;
  try {
    acp.notify("x.ai/yolo_mode_changed", {
      yolo_mode: false,
      permission_mode: mode,
      auto_mode: mode === "auto",
      clientIdentifier: CLIENT_IDENTIFIER,
    });
  } catch {
    /* ignore */
  }
  autoMode = mode === "auto";
  syncComposerChips();
});
btnPermissionChip.addEventListener("click", () => {
  const mode = yoloMode ? "always-approve" : permissionModeEl.value || "ask";
  openComposerMenu(
    btnPermissionChip,
    [
      { id: "ask", label: "每次询问", selected: mode === "ask" },
      { id: "auto", label: "自动", selected: mode === "auto" },
      { id: "always-approve", label: "始终允许", selected: mode === "always-approve" },
    ],
    (id) => {
      permissionModeEl.value = id;
      permissionModeEl.dispatchEvent(new Event("change"));
    },
  );
});
btnModelChip.addEventListener("click", () => {
  const items = catalogModels.length
    ? catalogModels.map((m) => ({ id: m.id, label: m.name, selected: m.id === currentModelId }))
    : [{ id: currentModelId || "current", label: currentModelName || "当前模型", selected: true }];
  openComposerMenu(btnModelChip, items, (id) => {
    void setSessionModel(id);
  });
});
btnEffortChip.addEventListener("click", () => {
  openComposerMenu(
    btnEffortChip,
    EFFORT_OPTIONS.map((o) => ({ id: o.id, label: o.label, selected: o.id === currentEffort })),
    (id) => {
      void setSessionModel(currentModelId || catalogModels[0]?.id || "", id);
    },
  );
});
btnAttach.addEventListener("click", () => filePick.click());
filePick.addEventListener("change", () => {
  for (const file of [...filePick.files ?? []]) {
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) addImageFile(file);
    else {
      const abs = `${workspaceCwd() || ""}/${file.name}`.replace(/\/+/g, "/");
      promptEl.value = promptEl.value ? `${promptEl.value} ${abs}` : abs;
    }
  }
  filePick.value = "";
  syncComposerFilled();
});
document.addEventListener("click", (ev) => {
  const t = ev.target as Node | null;
  if (!composerMenu.hidden) {
    if (t && (composerMenu.contains(t) || btnPermissionChip.contains(t) || btnModelChip.contains(t) || btnEffortChip.contains(t))) {
      /* keep chip menu */
    } else {
      closeComposerMenu();
    }
  }
  if (!slashPicker.hidden && t && !slashPicker.contains(t) && t !== promptEl) {
    closeSlashPicker(true);
    syncComposerHint();
  }
});
combineQueuedEl.addEventListener("change", () => {
  composerPrefs.combineQueued = combineQueuedEl.checked;
  persistComposerPrefs(composerPrefs, localStorage);
});
themePrefEl.addEventListener("change", () => {
  const next = themePrefEl.value;
  themePref = next === "dark" || next === "light" ? next : "auto";
  persistThemePref(themePref, localStorage);
  applyTheme(themePref);
});
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if (themePref === "auto") applyTheme(themePref);
});

document.addEventListener("pointerdown", (ev) => {
  if (sessionPopover.hidden) return;
  const t = ev.target;
  if (!(t instanceof Node)) return;
  if (sessionPopover.contains(t)) return;
  if (t instanceof Element && t.closest(".row-menu-btn")) return;
  closeSessionPopover();
});
sessionListEl.addEventListener("scroll", () => closeSessionPopover(), { passive: true });
window.addEventListener("resize", () => closeSessionPopover());
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape" || sessionPopover.hidden) return;
  ev.preventDefault();
  closeSessionPopover();
});

btnInterject.addEventListener("click", () => {
  const text = promptEl.value.trim();
  if (!text || !sessionId) {
    promptEl.focus();
    showBanner("先输入要插入的内容", "interject");
    return;
  }
  promptEl.value = "";
  acp
    .request("x.ai/interject", { sessionId, text })
    .catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});

btnSendNow.addEventListener("click", () => {
  void submitComposer({ sendNow: true }).catch((e) =>
    showBanner(e instanceof Error ? e.message : String(e)),
  );
});


$("btn-help-close").addEventListener("click", () => closeHelpCard());
$("btn-find-close").addEventListener("click", () => {
  findBar.hidden = true;
});
findInput.addEventListener("input", () => runFind(findInput.value));
findInput.addEventListener("keydown", (ev) => {
  if (ev.key !== "Enter" || !findHits.length) return;
  ev.preventDefault();
  findCursor = (findCursor + 1) % findHits.length;
  const hit = findHits[findCursor];
  if (hit) timelineNodes.get(hit.id)?.scrollIntoView({ block: "center" });
  findCount.textContent = `${findCursor + 1}/${findHits.length}`;
});
$("btn-sel-copy").addEventListener("click", () => {
  const sel = document.getSelection()?.toString() ?? "";
  void navigator.clipboard.writeText(sel);
  selectionBar.hidden = true;
});
document.addEventListener("mouseup", () => {
  const sel = document.getSelection();
  const text = sel?.toString() ?? "";
  if (!text || !thread.contains(sel?.anchorNode ?? null)) {
    selectionBar.hidden = true;
    return;
  }
  const range = sel!.getRangeAt(0).getBoundingClientRect();
  selectionBar.hidden = false;
  selectionBar.style.left = `${range.left + window.scrollX}px`;
  selectionBar.style.top = `${range.top + window.scrollY - 36}px`;
});

promptEl.addEventListener("focus", () => {
  composer.classList.remove("unfocused");
  syncComposerHint();
});
promptEl.addEventListener("blur", () => {
  composer.classList.add("unfocused");
  queueMicrotask(syncComposerHint);
});
thread.addEventListener("focusin", () => syncComposerHint());

document.addEventListener(
  "keydown",
  (ev) => {
    if (blockHost.busy && blockHost.handleKey(ev)) ev.stopImmediatePropagation();
  },
  true,
);
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (Date.now() - lastStopAt < 1000) {
    ev.preventDefault();
    return;
  }
  if (!appDialog.hidden) {
    ev.preventDefault();
    closeAppDialog();
    return;
  }
  if (!actionModal.hidden) {
    ev.preventDefault();
    closeAction();
    return;
  }
  if (!findBar.hidden) {
    findBar.hidden = true;
    ev.preventDefault();
    return;
  }
  if (!jumpPanel.hidden) {
    jumpPanel.hidden = true;
    ev.preventDefault();
    return;
  }
  if (!helpCard.hidden) {
    closeHelpCard();
    ev.preventDefault();
    return;
  }
  const btw = timeline.items.find((it) => it.kind === "btw" && it.open !== false);
  if (btw) {
    timeline.dismissBtw(btw.id);
    syncThread();
    ev.preventDefault();
    return;
  }
  if (app.dataset.surface === "dashboard") {
    if (dashQuery) {
      dashQuery = "";
      dashSearch.value = "";
      renderDashboard();
    } else if (dashSelectedId) {
      dashSelectedId = null;
      renderDashboard();
    }
    ev.preventDefault();
    return;
  }
  if (app.dataset.surface === "session") {
    ev.preventDefault();
    showDashboard();
  }
});

async function fetchGhost() {
  if (!sessionId || promptEl.value.trim()) return;
  try {
    const raw = await acp.request("x.ai/suggestPrompt", { sessionId, generation: Date.now() });
    const suggestion = parseSuggestPrompt(raw);
    if (suggestion && !promptEl.value.trim()) {
      ghostText = suggestion;
      ghostEl.hidden = false;
      ghostEl.textContent = suggestion;
    }
  } catch {
    ghostText = "";
    ghostEl.hidden = true;
  }
}

secret.addEventListener("change", persistFields);
wsUrl.addEventListener("change", persistFields);
cwd.addEventListener("change", persistFields);

setConnectedUi(false);

{
  const cached = readSessionCache(localStorage);
  const bootRoute = parseHashRoute(location.hash);
  if (cached?.sessions.length) {
    recentSessions = selectVisiblePickerSessions(cached.sessions, {
      keepIds: cached.lastId ? [cached.lastId] : [],
    });
    pendingResumeId = cached.lastId;
    renderSessionList();
    if (bootRoute.kind === "dashboard") {
      showDashboard();
    } else if (cached.lastId && bootRoute.kind !== "sessions") {
      const row = cached.sessions.find((s) => s.sessionId === cached.lastId);
      sessionLabel.textContent = row ? sessionTitle(row) : cached.lastId;
      showSurface("session");
      timeline.beginReplay();
      syncThread();
    }
  } else if (bootRoute.kind === "dashboard") {
    showDashboard();
  }
}

window.addEventListener("hashchange", () => applyHashRoute());
dashSearch.addEventListener("input", () => {
  dashQuery = dashSearch.value;
  renderDashboard();
});
$("dash-peek-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const text = dashPeekInput.value.trim();
  if (!text) return;
  dashPeekInput.value = "";
  void peekSend(text).catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
$("dash-peek-open").addEventListener("click", () => {
  const entry = selectedDashEntry();
  if (entry) void openDashSession(entry);
});
$("dash-peek-stop").addEventListener("click", () => {
  const entry = selectedDashEntry();
  if (entry) void stopDashSession(entry);
});
dashPeekInput.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && (ev.key === "s" || ev.key === "S")) {
    ev.preventDefault();
    const text = dashPeekInput.value.trim();
    if (!text) return;
    dashPeekInput.value = "";
    void peekSend(text).catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
  }
});
$("dash-new-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const text = dashNewInput.value.trim();
  dashNewInput.value = "";
  void (async () => {
    await newSession();
    if (text) await submitComposer({ text });
  })().catch((e) => showBanner(e instanceof Error ? e.message : String(e)));
});
document.addEventListener(
  "keydown",
  (ev) => {
    if (app.dataset.surface !== "dashboard") return;
    if (ev.key !== "Enter") return;
    const t = ev.target;
    if (t === dashSearch || t === dashPeekInput || t === dashNewInput) return;
    const entry = selectedDashEntry();
    if (!entry) return;
    ev.preventDefault();
    ev.stopPropagation();
    void openDashSession(entry);
  },
  true,
);
document.addEventListener("keydown", (ev) => {
  const cmd = ev.ctrlKey || ev.metaKey;
  if (cmd && (ev.key === "\\" || ev.code === "Backslash")) {
    ev.preventDefault();
    showDashboard();
    return;
  }
  if (cmd && (ev.key === "x" || ev.key === "X") && app.dataset.surface === "dashboard") {
    ev.preventDefault();
    const entry = selectedDashEntry();
    if (!entry) return;
    const status = inferDashStatus(entry, dashLive());
    if (status === "working" || (entry.sessionId === sessionId && turnRunning)) {
      void stopDashSession(entry);
      return;
    }
    const nowTs = Date.now();
    if (dashDeleteArmed && dashDeleteArmed.id === entry.sessionId && nowTs - dashDeleteArmed.at < 2000) {
      dashDeleteArmed = null;
      void deleteSession(entry, true);
    } else {
      dashDeleteArmed = { id: entry.sessionId, at: nowTs };
      showBanner("再按一次 Ctrl+X 永久删除", "dashboard");
    }
    return;
  }
  if (cmd && ev.key === "/" && app.dataset.surface === "dashboard") {
    ev.preventDefault();
    dashSearch.focus();
    return;
  }
  if (app.dataset.surface !== "dashboard") return;
  if (cmd && (ev.key === "r" || ev.key === "R") && !isTypingTarget(ev.target)) {
    ev.preventDefault();
    const entry = selectedDashEntry();
    if (entry) void renameSession(entry);
    return;
  }
  if (cmd && (ev.key === "t" || ev.key === "T") && !isTypingTarget(ev.target)) {
    ev.preventDefault();
    if (!dashSelectedId) return;
    dashPins = togglePinned(dashPins, dashSelectedId);
    saveIdSet(localStorage, DASH_PIN_KEY, dashPins);
    renderDashboard();
    return;
  }
  if (cmd && (ev.key === "g" || ev.key === "G") && !isTypingTarget(ev.target)) {
    ev.preventDefault();
    dashSort = dashSort === "status" ? "cwd" : "status";
    renderDashboard();
    return;
  }
  if (cmd && (ev.key === "o" || ev.key === "O") && !isTypingTarget(ev.target)) {
    const entry = selectedDashEntry();
    if (entry && entry.sessionId === sessionId) {
      ev.preventDefault();
      setYoloMode(!yoloMode);
      renderDashboard();
    }
    return;
  }
  if ((ev.key === "ArrowDown" || ev.key === "ArrowUp") && !isTypingTarget(ev.target)) {
    ev.preventDefault();
    const ids = [...dashList.querySelectorAll<HTMLElement>(".dash-row")]
      .map((el) => el.dataset.sessionId)
      .filter((id): id is string => Boolean(id));
    if (!ids.length) return;
    const i = Math.max(0, ids.indexOf(dashSelectedId ?? ""));
    const next = ev.key === "ArrowDown" ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1);
    const nextId = ids[next] ?? null;
    if (ev.shiftKey && nextId && dashSelectedId && dashPins.has(dashSelectedId)) {
      const order = [...dashPins];
      const a = order.indexOf(dashSelectedId);
      const b = order.indexOf(nextId);
      if (a >= 0) {
        if (b >= 0) {
          const tmp = order[a]!;
          order[a] = order[b]!;
          order[b] = tmp;
        } else {
          const dest = ev.key === "ArrowDown" ? Math.min(order.length, a + 1) : Math.max(0, a - 1);
          const [moved] = order.splice(a, 1);
          if (moved) order.splice(dest, 0, moved);
        }
        dashPins = new Set(order);
        saveIdSet(localStorage, DASH_PIN_KEY, dashPins);
      }
    }
    dashSelectedId = nextId;
    renderDashboard();
  }
});
document.addEventListener("keydown", (ev) => {
  if (app.dataset.surface === "dashboard" && (ev.ctrlKey || ev.metaKey) && (ev.key === "x" || ev.key === "X")) {
    return;
  }
  const action = mapGlobalHotkey(
    ev.key,
    { ctrl: ev.ctrlKey, meta: ev.metaKey, shift: ev.shiftKey },
    isTypingTarget(ev.target),
  );
  if (!action) return;
  if (action === "palette" && appDialogKind === "palette") return;
  ev.preventDefault();
  if (action === "palette") openPalette();
  else if (action === "settings") openSettings();
  else if (action === "model") openModelPicker();
  else if (action === "queue") {
    queuePinned = !queuePinned;
    renderQueue();
  } else openShortcutsHelp();
});
railPreviewEl.addEventListener("click", () => {
  const id = railPreviewEl.dataset.id;
  const item = timeline.items.find((row) => row.id === id);
  if (item) openBlockPreview(item);
});
if (autoConnectEnabled(location.search)) {
  connect().catch(() => {
    /* doctor already shown */
  });
}

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
      connected: () => boolean;
      leaveSession: () => void;
      loadWithCwd: (id: string, cwdOverride: string) => Promise<void>;
      enterLogin: () => void;
      applyUpdate: (method: string, params: Json) => void;
      beginReplay: () => void;
      endReplay: () => void;
      timelineKinds: () => string[];
      queueTexts: () => string[];
      setTurnRunning: (value: boolean) => void;
      runLocalSlash: (name: string, args: string) => Promise<boolean>;
      insertContext: (text: string) => void;
      insertUser: (text: string) => void;
      nthAgentText: (n: number) => string | null;
      offerPermission: (params: Json) => Promise<Json>;
      offerQuestion: (params: Json) => Promise<Json>;
      offerPlan: (params: Json) => Promise<Json>;
      blockBusy: () => boolean;
      addComposerImage: (input: { mimeType: string; data: string; name?: string }) => void;
      openExportSheet: () => void;
      openCompactSheet: () => void;
      openUsageSheet: () => void;
      applyBilling: (payload: Json) => void;
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
  connected: () => acp.connected,
  leaveSession: () => {
    leaveSession();
  },
  loadWithCwd: (id: string, cwdOverride: string) =>
    loadSession(id, { cwd: cwdOverride, reconnect: false }),
  enterLogin: () => {
    void logout({ acp: false });
  },
  applyUpdate: (method, params) => {
    handleAgentEvent(method, params);
  },
  beginReplay: () => {
    timeline.beginReplay();
    syncThread();
  },
  endReplay: () => {
    timeline.endReplay(0);
    syncThread();
  },
  timelineKinds: () => timeline.items.map((i) => i.kind),
  queueTexts: () => localQueue.map((q) => q.text),
  setTurnRunning: (value) => {
    turnRunning = value;
    syncTurnButtons();
    syncTurnStatus();
  },
  runLocalSlash: (name, args) => runLocalSlash({ name, args }),
  insertContext: (text) => {
    timeline.insertContext(text);
    syncThread();
  },
  insertUser: (text) => {
    timeline.endReplay(0);
    showSurface("session");
    timeline.insertUser(text);
    syncThread();
  },
  addComposerImage: (input) => {
    imageChips = [
      ...imageChips,
      {
        id: `img-${queueIdSeq++}`,
        mimeType: input.mimeType,
        data: input.data,
        name: input.name || "image",
        kind: "image",
      },
    ];
    renderImageChips();
  },
  nthAgentText: (n) => timeline.nthAgent(n)?.text ?? null,
  offerPermission: (params) => blockHost.offerPermission(params),
  offerQuestion: (params) => blockHost.offerQuestion(params),
  offerPlan: (params) => blockHost.offerPlan(params),
  blockBusy: () => blockHost.busy,
  openExportSheet: () => {
    const had = sessionId;
    if (!sessionId) sessionId = "demo";
    openExportSheet();
    if (!had) sessionId = had;
  },
  openCompactSheet: () => {
    openCompactSheet({
      sessionId: sessionId || "demo",
      summary: "demo",
      cwd: workspaceCwd() || null,
      updatedAt: null,
      source: null,
      lastTurnSummary: null,
      sessionKind: null,
      adminKind: "build",
      worktreeLabel: null,
      gitRootDir: null,
      sourceWorkspaceDir: null,
      repoName: null,
    });
  },
  applyBilling: (payload) => {
    applyBilling(payload);
  },
  openUsageSheet: () => {
    openUsageSheet(
      {
        sessionId: "demo",
        cwd: "/tmp/project",
        data: {
          modelDisplayName: "Grok 4.6",
          turns: 3,
          context: {
            used: 8200,
            total: 10000,
            usagePct: 82,
            systemPromptTokens: 400,
            messageTokens: 7000,
            toolDefinitionsTokens: 800,
            freeTokens: 1800,
            autoCompactThresholdPercent: 85,
          },
        },
      },
      {
        sessionId: sessionId || "demo",
        summary: "demo",
        cwd: "/tmp/project",
        updatedAt: null,
        source: null,
        lastTurnSummary: null,
        sessionKind: null,
        adminKind: "build",
        worktreeLabel: null,
        gitRootDir: null,
        sourceWorkspaceDir: null,
        repoName: null,
      },
    );
  },
};
