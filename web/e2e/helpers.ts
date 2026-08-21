import { expect, type Page } from "@playwright/test";
import { copyFileSync, existsSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { homedir } from "node:os";

export const SECRET = process.env.GROK_WEB_SECRET ?? "slice0dev";
export const WS = process.env.GROK_WEB_WS ?? "ws://127.0.0.1:2419/ws";
export const CWD = process.env.GROK_WEB_CWD ?? "/home/falser/Projects/grok-build";
export const AUTH_PATH = `${homedir()}/.grok/auth.json`;
export const AUTH_BAK = "/tmp/grok-goal-eddab546d778/implementer/auth.json.bak";

export type RpcCapture = { sent: string[]; received: string[] };

export function attachRpc(page: Page): RpcCapture {
  const cap: RpcCapture = { sent: [], received: [] };
  page.on("websocket", (ws) => {
    ws.on("framesent", (event) => {
      cap.sent.push(String(event.payload));
    });
    ws.on("framereceived", (event) => {
      cap.received.push(String(event.payload));
    });
  });
  return cap;
}

export function parseRpc(raw: string): {
  method?: string;
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string };
} | null {
  if (raw === "ping" || raw === "pong") return null;
  try {
    return JSON.parse(raw) as {
      method?: string;
      id?: number;
      result?: unknown;
      error?: { code?: number; message?: string };
    };
  } catch {
    return null;
  }
}

export function findSent(cap: RpcCapture, method: string) {
  return cap.sent.map(parseRpc).find((m) => m?.method === method) ?? null;
}

export function resultFor(cap: RpcCapture, method: string) {
  const req = findSent(cap, method);
  if (!req || req.id === undefined) return null;
  for (const raw of cap.received) {
    const msg = parseRpc(raw);
    if (msg && msg.id === req.id) return msg;
  }
  return null;
}

export async function assertExtOk(cap: RpcCapture, method: string) {
  await expect
    .poll(() => findSent(cap, method), { timeout: 20_000 })
    .toBeTruthy();
  const req = findSent(cap, method)!;
  expect(req.method, `wire method ${method}`).toBe(method);
  await expect
    .poll(() => resultFor(cap, method), { timeout: 20_000 })
    .toBeTruthy();
  const res = resultFor(cap, method)!;
  expect(res.error?.code, JSON.stringify(res.error)).not.toBe(-32601);
  return { req, res };
}

export async function fillDock(page: Page, secret: string, ws = WS) {
  await page.goto("/");
  await page.locator("#ws-url").click();
  await page.locator("#ws-url").fill(ws);
  await page.locator("#secret").click();
  await page.locator("#secret").fill(secret);
  await page.locator("#cwd").click();
  await page.locator("#cwd").fill(CWD);
}

export async function connectWelcome(page: Page) {
  await page.locator("#btn-connect").click();
  await expect(page.locator("#conn-label")).toHaveText("已连接", { timeout: 90_000 });
  await expect(page.locator("#welcome")).toBeVisible({ timeout: 30_000 });
}

export function backupAuth() {
  if (existsSync(AUTH_PATH)) copyFileSync(AUTH_PATH, AUTH_BAK);
}

export function restoreAuth() {
  if (existsSync(AUTH_BAK)) copyFileSync(AUTH_BAK, AUTH_PATH);
}

export async function restartServe(secret = SECRET) {
  try {
    execSync("fuser -k 2419/tcp", { stdio: "ignore" });
  } catch {
    /* nothing listening */
  }
  await new Promise((r) => setTimeout(r, 400));
  restoreAuth();
  const child = spawn(
    "grok",
    [
      "agent",
      "--always-approve",
      "--no-leader",
      "serve",
      "--bind",
      "127.0.0.1:2419",
      "--secret",
      secret,
    ],
    {
      detached: true,
      stdio: "ignore",
      cwd: "/home/falser/Projects/grok-build",
    },
  );
  child.unref();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      execSync("bash -lc 'echo >/dev/tcp/127.0.0.1/2419'", { stdio: "ignore" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error("grok agent serve did not come back on 2419");
}
