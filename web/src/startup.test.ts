import assert from "node:assert/strict";
import { test } from "node:test";
import { CLIENT_IDENTIFIER } from "./protocol.ts";
import {
  CONNECTING_COPY,
  FIRST_ACP_METHOD,
  afterEagerAuthFailure,
  buildApiKeySetParams,
  buildAuthenticateParams,
  buildFolderTrustResponse,
  buildLogoutParams,
  buildPrivacyParams,
  buildSessionNewParams,
  claudeImportVisible,
  classifyConnectFailure,
  composerSendAllowed,
  consentAlreadyAcked,
  defaultFolderTrustOutcome,
  doctorCopy,
  folderTrustOutcomeFromUser,
  handshakePlan,
  isApiKeyStorageKey,
  loginLabel,
  parseAuthMethods,
  parseConsent,
  parseInitialize,
  parsePaywall,
  parseSessionList,
  autoConnectEnabled,
  persistDockFields,
  persistableDockFields,
  parseSessionListPage,
  notificationSessionId,
  timelineEventIsForeign,
  isFrontSessionStream,
  buildSessionListParams,
  sessionListParamsAreGlobal,
  SESSION_LIST_PAGE_SIZE,
  selectEagerAuthMethod,
  startupAuthDecision,
  storageContainsApiKey,
  welcomeVersionLine,
} from "./startup.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage = {
    get length() {
      return map.size;
    },
    key(i: number) {
      return [...map.keys()][i] ?? null;
    },
    getItem(k: string) {
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k: string, v: string) {
      map.set(k, v);
    },
    map,
  };
  return storage;
}

test("handshake plan always starts with initialize", () => {
  const login = startupAuthDecision(
    [{ id: "grok.com", name: "grok.com", description: null, externalProvider: false }],
    null,
  );
  assert.deepEqual(handshakePlan(login), [FIRST_ACP_METHOD]);
  const eager = startupAuthDecision(
    [
      { id: "cached_token", name: "cached_token", description: null, externalProvider: false },
      { id: "grok.com", name: "grok.com", description: null, externalProvider: false },
    ],
    "cached_token",
  );
  assert.deepEqual(handshakePlan(eager), [FIRST_ACP_METHOD, "authenticate"]);
  assert.equal(handshakePlan(eager)[0], "initialize");
});

test("eager vs login follows first advertised method and defaultAuthMethodId", () => {
  const methods = parseAuthMethods({
    authMethods: [
      { id: "xai.api_key", name: "xai.api_key" },
      { id: "cached_token", name: "cached_token" },
      { id: "grok.com", name: "grok.com", _meta: { external_provider: false } },
    ],
    _meta: { defaultAuthMethodId: "cached_token" },
  });
  const decision = startupAuthDecision(methods, "cached_token");
  assert.equal(decision.needsLogin, false);
  assert.equal(decision.eagerMethodId, "cached_token");
  assert.equal(selectEagerAuthMethod(methods, "cached_token"), "cached_token");

  const interactive = startupAuthDecision(
    [{ id: "grok.com", name: "Acme Corp", description: null, externalProvider: true }],
    null,
  );
  assert.equal(interactive.needsLogin, true);
  assert.equal(interactive.loginLabel, "Acme Corp");
  assert.equal(interactive.loginMethodId, "grok.com");
  assert.equal(interactive.authStartMode, "command");
  assert.equal(interactive.eagerMethodId, null);

  const empty = startupAuthDecision([], null);
  assert.equal(empty.needsLogin, true);
  assert.equal(empty.eagerMethodId, null);
});

test("login label comes from AuthMethod.name, never a hardcoded Login", () => {
  const label = loginLabel([
    { id: "cached_token", name: "cached_token", description: null, externalProvider: false },
    { id: "grok.com", name: "grok.com", description: null, externalProvider: false },
  ]);
  assert.equal(label, "grok.com");
  assert.notEqual(label, "Login");
  assert.notEqual(label, "login");
});

test("eager auth failure with api_key advertised does not promote browser login", () => {
  const fallback = afterEagerAuthFailure([
    { id: "xai.api_key", name: "xai.api_key", description: null, externalProvider: false },
    { id: "grok.com", name: "grok.com", description: null, externalProvider: false },
  ]);
  assert.equal(fallback.needsLogin, false);
  assert.equal(fallback.loginMethodId, null);
});

test("composer send is gated on auth and never auto-YOLO trust", () => {
  assert.equal(
    composerSendAllowed({
      authenticated: false,
      trustPending: false,
      workspaceAckPending: false,
      paywallBlocked: false,
    }),
    false,
  );
  assert.equal(
    composerSendAllowed({
      authenticated: true,
      trustPending: true,
      workspaceAckPending: false,
      paywallBlocked: false,
    }),
    false,
  );
  assert.equal(
    composerSendAllowed({
      authenticated: true,
      trustPending: false,
      workspaceAckPending: true,
      paywallBlocked: false,
    }),
    false,
  );
  assert.equal(
    composerSendAllowed({
      authenticated: true,
      trustPending: false,
      workspaceAckPending: false,
      paywallBlocked: true,
    }),
    false,
  );
  assert.equal(
    composerSendAllowed({
      authenticated: true,
      trustPending: false,
      workspaceAckPending: false,
      paywallBlocked: false,
    }),
    true,
  );
  assert.equal(defaultFolderTrustOutcome(), "reject");
  assert.equal(folderTrustOutcomeFromUser(null), "reject");
  assert.equal(folderTrustOutcomeFromUser("trust"), "trust");
  const auto = buildFolderTrustResponse(defaultFolderTrustOutcome());
  assert.deepEqual(auto, { outcome: "reject" });
});

test("auto-connect is on unless noconnect=1", () => {
  assert.equal(autoConnectEnabled(""), true);
  assert.equal(autoConnectEnabled("?foo=1"), true);
  assert.equal(autoConnectEnabled("?noconnect=1"), false);
  assert.equal(autoConnectEnabled("noconnect=1&x=1"), false);
});

test("API key is not a persistable dock field and never written to localStorage", () => {
  const storage = memoryStorage();
  persistDockFields(
    { url: "ws://127.0.0.1:2419/ws", secret: "slice0dev", cwd: "/tmp/repo" },
    storage,
  );
  assert.equal(storageContainsApiKey(storage), false);
  assert.equal(isApiKeyStorageKey("grok-web.apiKey"), true);
  assert.equal(isApiKeyStorageKey("grok-web.secret"), false);
  const fields = persistableDockFields({
    url: "ws://127.0.0.1:2419/ws",
    secret: "slice0dev",
    cwd: "/tmp/repo",
  });
  assert.equal("apiKey" in fields, false);
  storage.setItem("prompt", "hello");
  assert.equal(storageContainsApiKey(storage), false);
  const keyParams = buildApiKeySetParams("xai-not-for-localStorage");
  assert.deepEqual(keyParams, { key: "xai-not-for-localStorage" });
  for (const key of storage.map.keys()) {
    assert.equal(isApiKeyStorageKey(key), false);
    assert.notEqual(key, "apiKey");
  }
});

test("doctor copy names 401 and process-not-running", () => {
  assert.equal(CONNECTING_COPY, "正在连接本机 grok…");
  assert.equal(classifyConnectFailure({ message: "WebSocket closed (401)" }), "unauthorized");
  assert.equal(
    classifyConnectFailure({
      message: "WebSocket error connecting to ws://127.0.0.1:2419/ws?server-key=foo",
    }),
    "unauthorized",
  );
  assert.equal(
    classifyConnectFailure({
      message: "WebSocket closed during connect (1006)",
      url: "ws://127.0.0.1:2419/ws?server-key=foo",
      code: 1006,
    }),
    "unauthorized",
  );
  assert.equal(
    classifyConnectFailure({
      message: "WebSocket error connecting to ws://127.0.0.1:9/ws?server-key=slice0dev",
    }),
    "process-down",
  );
  const unauthorized = doctorCopy("unauthorized", "closed 401");
  assert.match(unauthorized, /401/);
  assert.match(unauthorized, /secret/);
  const down = doctorCopy("process-down");
  assert.match(down, /进程未起/);
});

test("welcome snapshot parses version cwd commands and hides claude import when absent", () => {
  const snap = parseInitialize({
    authMethods: [{ id: "grok.com", name: "grok.com" }],
    _meta: {
      grokShell: true,
      agentVersion: "1.2.3",
      currentWorkingDirectory: "/home/falser/Projects/grok-build",
      defaultAuthMethodId: "grok.com",
      availableCommands: [{ name: "new", description: "new session" }],
    },
  });
  assert.equal(snap.agentVersion, "1.2.3");
  assert.equal(snap.cwd, "/home/falser/Projects/grok-build");
  assert.equal(claudeImportVisible(snap), false);
  const withClaude = parseInitialize({
    _meta: { availableCommands: [{ name: "import-claude" }] },
  });
  assert.equal(claudeImportVisible(withClaude), true);
  assert.match(welcomeVersionLine("1.2.3"), new RegExp(CLIENT_IDENTIFIER));
  assert.match(welcomeVersionLine("1.2.3"), /1\.2\.3/);
});

test("paywall consent session list and session/new workspace ACK helpers", () => {
  const paywall = parsePaywall({
    gate: { message: "credits exhausted", url: "https://grok.com", label: "Upgrade" },
    subscription_tier: "Free",
  });
  assert.equal(paywall.blocked, true);
  assert.equal(paywall.url, "https://grok.com");
  const consent = parseConsent({ coding_data_retention_opt_out: true, is_zdr: true });
  assert.equal(consent.optOut, true);
  assert.equal(consent.zdr, true);
  const storage = memoryStorage();
  assert.equal(consentAlreadyAcked(storage, "a@x.ai"), false);
  const sessions = parseSessionList({
    sessions: [{ sessionId: "s1", summary: "hello", cwd: "/repo" }],
  });
  assert.equal(sessions[0]?.sessionId, "s1");
  const empty = parseSessionList({
    sessions: [
      {
        sessionId: "019fa13f-5c60-7e80-bde0-7b2a67427cf0",
        summary: "",
        session_kind: "subagent",
        numMessages: 0,
        hidden: true,
        first_prompt: "Investigate the JSON packet",
      },
    ],
  });
  assert.equal(empty[0]?.summary, "");
  assert.equal(empty[0]?.sessionKind, "subagent");
  assert.equal(empty[0]?.numMessages, 0);
  assert.equal(empty[0]?.hidden, true);
  assert.equal(empty[0]?.firstPrompt, "Investigate the JSON packet");
  const page = parseSessionListPage({
    sessions: [{ sessionId: "s1", summary: "hello", cwd: "/other" }],
    nextCursor: "p2",
  });
  assert.equal(page.nextCursor, "p2");
  const globalList = buildSessionListParams();
  assert.equal(sessionListParamsAreGlobal(globalList), true);
  assert.equal((globalList as { limit: number }).limit, SESSION_LIST_PAGE_SIZE);
  const filtered = buildSessionListParams({ cwd: "/home/falser/Projects/grok-build" });
  assert.equal(sessionListParamsAreGlobal(filtered), false);
  const paged = parseSessionListPage({
    result: {
      sessions: [{ session_id: "s2", title: "t", cwd: "/a" }],
      next_cursor: "page-2",
    },
  });
  assert.equal(paged.sessions[0]?.sessionId, "s2");
  assert.equal(paged.nextCursor, "page-2");
  const newParams = buildSessionNewParams({ cwd: "/real/local/path" }) as {
    cwd: string;
    mcpServers: unknown[];
  };
  assert.equal(newParams.cwd, "/real/local/path");
  const created = buildSessionNewParams({
    cwd: "/repo",
    localWorkspace: { mode: "own" },
  }) as { _meta: { "x.ai/local_workspace": { mode: string } } };
  assert.equal(created._meta["x.ai/local_workspace"].mode, "own");
  assert.deepEqual(buildLogoutParams(), {});
  assert.deepEqual(buildPrivacyParams(true), { codingDataRetentionOptOut: true });
  assert.equal(
    (buildAuthenticateParams("cached_token") as { methodId: string }).methodId,
    "cached_token",
  );
});

test("session notifications for another id are foreign to the visible timeline", () => {
  assert.equal(notificationSessionId({ sessionId: "a" }), "a");
  assert.equal(notificationSessionId({ session_id: "b" }), "b");
  assert.equal(notificationSessionId({ update: { sessionUpdate: "agent_message_chunk" } }), null);
  assert.equal(timelineEventIsForeign("a", "b"), true);
  assert.equal(timelineEventIsForeign("a", "a"), false);
  assert.equal(timelineEventIsForeign(null, "a"), false);
  assert.equal(
    isFrontSessionStream({
      method: "session/update",
      eventSessionId: "bg",
      currentSessionId: "front",
    }),
    false,
  );
  assert.equal(
    isFrontSessionStream({
      method: "session/update",
      eventSessionId: "front",
      currentSessionId: "front",
    }),
    true,
  );
});
