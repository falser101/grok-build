/**
 * Drive the web client in Chromium: click/type like a person.
 *
 *   npm run dev
 *   npm run drive
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const SECRET = process.env.GROK_WEB_SECRET ?? "slice0dev";
const WS = process.env.GROK_WEB_WS ?? "ws://127.0.0.1:2419/ws";
const CWD = process.env.GROK_WEB_CWD ?? "/home/falser/Projects/grok-build";
const BASE = process.env.GROK_WEB_BASE ?? "http://127.0.0.1:5173";
const PROMPT =
  process.env.GROK_WEB_PROMPT ??
  "Reply with exactly the word pong and nothing else.";
const SHOT_DIR = process.env.GROK_WEB_SHOTS;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = SHOT_DIR ?? join(root, "e2e", "artifacts");
mkdirSync(shots, { recursive: true });

function isSessionCancelNotification(raw) {
  if (raw === "ping" || raw === "pong") return false;
  try {
    const msg = JSON.parse(raw);
    return msg && msg.method === "session/cancel" && !("id" in msg);
  } catch {
    return false;
  }
}

const headed = process.env.GROK_WEB_HEADED !== "0";

const browser = await chromium.launch({
  headless: !headed,
  slowMo: headed ? 120 : 40,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.setDefaultTimeout(90_000);

async function shot(name, target = page) {
  const path = join(shots, `${name}.png`);
  await target.screenshot({ path, fullPage: true });
  console.log(`shot ${path}`);
}

async function fillDock(target, secret) {
  await target.goto(`${BASE}/?noconnect=1`);
  await target.locator("#btn-settings").click();
  await target.locator("#settings-modal").waitFor({ state: "visible" });
  await target.locator("#ws-url").click();
  await target.locator("#ws-url").fill("");
  await target.keyboard.type(WS, { delay: 8 });
  await target.locator("#secret").click();
  await target.locator("#secret").fill("");
  await target.keyboard.type(secret, { delay: 12 });
  await target.locator("#cwd").click();
  await target.locator("#cwd").fill("");
  await target.keyboard.type(CWD, { delay: 6 });
  await target.locator("#btn-settings-close").click();
}

async function waitConnected(target) {
  await target.waitForFunction(
    () => document.querySelector("#conn-label")?.textContent === "已连接",
    null,
    { timeout: 90_000 },
  );
}

async function waitAuthedComposer(target) {
  await waitConnected(target);
  const welcome = target.locator("#welcome");
  if (await welcome.isVisible()) {
    await target.locator("#welcome-version").waitFor();
  }
  await target.waitForFunction(
    () => !document.querySelector("#prompt")?.disabled,
    null,
    { timeout: 90_000 },
  );
}

async function ensureSession(target) {
  await waitAuthedComposer(target);
  const label = (await target.locator("#session-label").innerText()).trim();
  if (label === "无 session") {
    await target.locator("#btn-welcome-new").click();
    await target.waitForFunction(
      () => document.querySelector("#session-label")?.textContent !== "无 session",
      null,
      { timeout: 30_000 },
    );
  }
}

const sentFrames = [];
const receivedFrames = [];
page.on("websocket", (ws) => {
  ws.on("framesent", (ev) => {
    sentFrames.push(String(ev.payload));
  });
  ws.on("framereceived", (ev) => {
    receivedFrames.push(String(ev.payload));
  });
});

function parseRpc(raw) {
  if (raw === "ping" || raw === "pong") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function assertExtOk(method) {
  const req = sentFrames.map(parseRpc).find((m) => m?.method === method);
  if (!req) {
    throw new Error(`missing outbound ${method}; last=${JSON.stringify(sentFrames.slice(-6))}`);
  }
  const res = receivedFrames.map(parseRpc).find((m) => m && m.id === req.id);
  if (!res) {
    throw new Error(`no response for ${method} id=${req.id}`);
  }
  if (res.error?.code === -32601) {
    throw new Error(`${method} method_not_found: ${JSON.stringify(res.error)}`);
  }
  console.log(`ext-ok ${method} error=${JSON.stringify(res.error ?? null)}`);
  return res;
}

try {
  console.log(`open ${BASE}`);
  await page.goto(BASE);
  await page.getByRole("heading", { name: "Grok Web" }).waitFor();
  await shot("01-idle");

  console.log("serve down");
  await fillDock(page, SECRET);
  await page.locator("#ws-url").click();
  await page.locator("#ws-url").fill("");
  await page.keyboard.type("ws://127.0.0.1:9/ws", { delay: 6 });
  await page.locator("#btn-connect").click();
  await page.locator("#doctor").waitFor();
  const downCopy = await page.locator("#doctor-copy").innerText();
  if (!/进程未起/.test(downCopy)) {
    throw new Error(`expected process-not-running doctor copy, got ${downCopy}`);
  }
  await shot("02-serve-down");
  console.log("serve-down-ok");

  console.log("wrong secret");
  await fillDock(page, "foo");
  await page.locator("#btn-connect").click();
  await page.waitForFunction(
    () => document.querySelector("#conn-label")?.textContent === "连接失败",
  );
  const doctorText = await page.locator("#doctor-copy").innerText();
  if (!/401|secret/.test(doctorText)) {
    throw new Error(`expected 401/secret doctor copy, got ${doctorText}`);
  }
  await shot("02-bad-secret");
  console.log("bad-secret-ok");

  console.log("good connect");
  await fillDock(page, SECRET);
  await page.locator("#btn-connect").click();
  await page.waitForFunction(
    () => /connecting/.test(document.querySelector("#app")?.getAttribute("data-phases") ?? ""),
  );
  await waitConnected(page);
  const welcomeVisible = await page.locator("#welcome").isVisible();
  const loginVisible = await page.locator("#login").isVisible();
  if (welcomeVisible) {
    const version = await page.locator("#welcome-version").innerText();
    const welcomeCwd = await page.locator("#welcome-cwd").innerText();
    console.log(`welcome version=${version} cwd=${welcomeCwd}`);
    if (!/grok-web/.test(version)) {
      throw new Error(`expected grok-web in version line, got ${version}`);
    }
    assertExtOk("_x.ai/session/list");
    assertExtOk("_x.ai/auth/check_subscription");
    assertExtOk("_x.ai/auth/info");
  } else if (loginVisible) {
    const loginName = (await page.locator("#btn-login-primary").innerText()).trim();
    console.log(`login label=${loginName}`);
    if (/^login$/i.test(loginName)) {
      throw new Error("login button must use AuthMethod.name, not Login");
    }
  } else {
    throw new Error("expected Welcome or login after connect");
  }
  await shot("03-connected");

  if (welcomeVisible) {
    console.log("switch-account login (keep WS)");
    await page.locator("#btn-switch-account").click();
    await page.locator("#login").waitFor();
    const loginName = (await page.locator("#btn-login-primary").innerText()).trim();
    if (/^login$/i.test(loginName)) {
      throw new Error("login button must use AuthMethod.name, not Login");
    }
    const promptDisabled = await page.locator("#prompt").isDisabled();
    if (!promptDisabled) throw new Error("composer must stay disabled while logged out");
    const stillConnected = await page.locator("#conn-label").innerText();
    if (stillConnected !== "已连接") {
      throw new Error(`expected WS kept after logout-equivalent, got ${stillConnected}`);
    }
    await page.locator("#api-key").click();
    await page.keyboard.type("xai-drive-must-not-persist", { delay: 4 });
    const dumped = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    if (dumped.includes("xai-drive-must-not-persist")) {
      throw new Error("API key was written to localStorage");
    }
    await shot("03b-login");
    console.log("login-surface-ok");
    await page.locator("#btn-disconnect").click();
    await page.waitForFunction(
      () => document.querySelector("#conn-label")?.textContent === "已断开",
    );
    await page.locator("#btn-connect").click();
    await page.locator("#welcome").waitFor({ timeout: 90_000 });
    await waitAuthedComposer(page);
  }

  await ensureSession(page);
  const session = await page.locator("#session-label").innerText();
  console.log(`connected session=${session}`);

  console.log("drop socket → reconnect");
  await page.evaluate(() => window.__grokWebTest?.dropSocket());
  await page.waitForFunction(
    () => document.querySelector("#banner")?.getAttribute("data-reason") === "reconnect",
  );
  await waitConnected(page);
  const sessionAfter = await page.locator("#session-label").innerText();
  console.log(`reconnected session=${sessionAfter}`);
  if (sessionAfter !== session) {
    throw new Error(`session changed on reconnect: ${session} -> ${sessionAfter}`);
  }
  await shot("04-reconnected");

  console.log("second tab steals");
  const page2 = await context.newPage();
  page2.on("websocket", (ws) => {
    ws.on("framesent", (ev) => {
      sentFrames.push(String(ev.payload));
    });
  });
  await fillDock(page2, SECRET);
  await page2.locator("#btn-connect").click();
  await waitAuthedComposer(page2);
  await page.waitForFunction(
    () => document.querySelector("#conn-label")?.textContent === "已被占用",
  );
  const reason = await page.locator("#banner").getAttribute("data-reason");
  if (reason !== "stolen") throw new Error(`expected stolen banner, got ${reason}`);
  await shot("05-stolen", page);
  await shot("05b-thief", page2);
  console.log("stolen-ok");

  console.log("prompt on owner tab");
  await waitAuthedComposer(page2);
  await page2.locator("#prompt").click();
  await page2.keyboard.type(PROMPT, { delay: 10 });
  await page2.locator("#btn-send").click();
  await page2.locator(".bubble.user .body").waitFor();
  await page2.locator(".bubble.agent .body").waitFor({ timeout: 90_000 });
  await page2.waitForFunction(() => {
    const el = document.querySelector(".bubble.agent .body");
    return (el?.textContent ?? "").trim().length > 0;
  });
  await page2.waitForTimeout(800);
  const reply = (await page2.locator(".bubble.agent .body").innerText()).trim();
  console.log(`agent reply: ${JSON.stringify(reply)}`);
  await shot("06-reply", page2);
  if (!/pong/i.test(reply)) {
    throw new Error(`expected pong in agent reply, got: ${reply}`);
  }

  console.log("mid-turn disconnect → session/cancel notify");
  await page2.locator("#prompt").click();
  await page2.keyboard.type(
    "Write a 40-line story about a lighthouse, slowly, with many details.",
    { delay: 6 },
  );
  await page2.locator("#btn-send").click();
  await page2.waitForFunction(
    () => document.querySelector("#hint")?.textContent === "生成中",
  );
  await page2.locator("#btn-disconnect").click();
  await page2.waitForFunction(
    () => document.querySelector("#conn-label")?.textContent === "已断开",
  );
  const cancelFrame = sentFrames.find(isSessionCancelNotification);
  if (!cancelFrame) {
    throw new Error(
      `expected no-id session/cancel notification, frames=${JSON.stringify(sentFrames.slice(-8))}`,
    );
  }
  console.log("cancel-frame", cancelFrame);
  await shot("07-disconnected", page2);

  console.log("DRIVE_OK");
} catch (err) {
  await shot("fail").catch(() => {});
  console.error("DRIVE_FAIL", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
