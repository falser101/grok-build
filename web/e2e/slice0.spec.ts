import { expect, test, type Page } from "@playwright/test";
import { closeSettings } from "./helpers";

const SECRET = process.env.GROK_WEB_SECRET ?? "slice0dev";
const WS = process.env.GROK_WEB_WS ?? "ws://127.0.0.1:2419/ws";
const CWD = process.env.GROK_WEB_CWD ?? "/home/falser/Projects/grok-build";

async function fillDock(page: Page, secret: string) {
  await page.goto("/?noconnect=1");
  await page.locator("#btn-settings").click();
  await expect(page.locator("#settings-modal")).toBeVisible();
  await page.locator("#ws-url").click();
  await page.locator("#ws-url").fill(WS);
  await page.locator("#secret").click();
  await page.locator("#secret").fill(secret);
  await page.locator("#cwd").click();
  await page.locator("#cwd").fill(CWD);
}

async function waitConnected(page: Page) {
  await expect(page.locator("#conn-label")).toHaveText("已连接", {
    timeout: 90_000,
  });
  await closeSettings(page);
}

async function waitAuthedComposer(page: Page) {
  await waitConnected(page);
  const welcome = page.locator("#welcome");
  if (await welcome.isVisible()) {
    await expect(page.locator("#welcome-version")).toContainText("grok-web");
    await expect(page.locator("#welcome-cwd")).not.toHaveText("");
  }
  await expect(page.locator("#prompt")).toBeEnabled({ timeout: 30_000 });
}

async function ensureSession(page: Page) {
  await waitAuthedComposer(page);
  const label = (await page.locator("#session-label").innerText()).trim();
  if (label === "无 session") {
    await page.locator("#btn-new").click();
    await expect(page.locator("#session-label")).not.toHaveText("无 session", {
      timeout: 30_000,
    });
  }
}

function attachWsCapture(page: Page): string[] {
  const sent: string[] = [];
  page.on("websocket", (ws) => {
    ws.on("framesent", (event) => {
      sent.push(String(event.payload));
    });
  });
  return sent;
}

function isSessionCancelNotification(raw: string): boolean {
  if (raw === "ping" || raw === "pong") return false;
  try {
    const msg = JSON.parse(raw) as { method?: string; id?: unknown };
    return msg.method === "session/cancel" && !("id" in msg);
  } catch {
    return false;
  }
}

test.describe.configure({ mode: "serial" });

test("loads the slice 0 shell", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await expect(page.locator("h1")).toHaveText("Grok");
  await expect(page.locator("#conn-label")).toHaveText("未连接");
  await expect(page.locator("#thread .empty")).toBeVisible();
  await expect(page.locator("#prompt")).toBeDisabled();
});

test("wrong secret surfaces a connection error", async ({ page }) => {
  await fillDock(page, "foo");
  await page.locator("#btn-connect").click();
  await expect(page.locator("#conn-label")).toHaveText("连接失败", {
    timeout: 15_000,
  });
  await expect(page.locator("#doctor")).toBeVisible();
  await expect(page.locator("#doctor-copy")).toContainText(/401|secret|进程/);
  await expect(page.locator("#prompt")).toBeDisabled();
});

test("connects, reconnects after a drop, then a second tab steals the stream", async ({
  page,
  context,
}) => {
  await fillDock(page, SECRET);
  await page.locator("#btn-connect").click();
  await ensureSession(page);
  const session = await page.locator("#session-label").innerText();
  expect(session).not.toEqual("无 session");

  await page.evaluate(() => window.__grokWebTest?.dropSocket());
  await expect(page.locator("#banner")).toHaveAttribute("data-reason", "reconnect", {
    timeout: 10_000,
  });
  await waitConnected(page);
  await expect(page.locator("#session-label")).toHaveText(session);
  await expect(page.getByText("已重连 session")).toBeVisible();

  const page2 = await context.newPage();
  await fillDock(page2, SECRET);
  await page2.locator("#btn-connect").click();
  await waitAuthedComposer(page2);

  await expect(page.locator("#conn-label")).toHaveText("已被占用", {
    timeout: 15_000,
  });
  await expect(page.locator("#banner")).toHaveAttribute("data-reason", "stolen");

  await page2.locator("#btn-settings").click();
  await expect(page2.locator("#settings-modal")).toBeVisible();
  await page2.locator("#btn-disconnect").click();
  await expect(page2.locator("#conn-label")).toHaveText("已断开");
  await page2.close();
});

test("sends a prompt and streams an agent reply", async ({ page }) => {
  await fillDock(page, SECRET);
  await page.locator("#btn-connect").click();
  await waitAuthedComposer(page);

  await page.locator("#prompt").click();
  await page.keyboard.type("Reply with exactly the word pong and nothing else.", {
    delay: 8,
  });
  await page.locator("#btn-send").click();

  await expect(page.locator(".bubble.user .body")).toContainText("pong", {
    timeout: 15_000,
  });
  await expect(page.locator(".bubble.agent .body")).toContainText(/pong/i, {
    timeout: 90_000,
  });
});

test("disconnect while generating sends a no-id session/cancel notification", async ({
  page,
}) => {
  const sent = attachWsCapture(page);
  await fillDock(page, SECRET);
  await page.locator("#btn-connect").click();
  await waitAuthedComposer(page);

  await page.locator("#prompt").click();
  await page.keyboard.type(
    "Write a 40-line story about a lighthouse, slowly, with many details.",
  );
  await page.locator("#btn-send").click();
  await expect(page.locator("#hint")).toHaveText("生成中", { timeout: 15_000 });
  await page.locator("#btn-settings").click();
  await expect(page.locator("#settings-modal")).toBeVisible();
  await page.locator("#btn-disconnect").click();
  await expect(page.locator("#conn-label")).toHaveText("已断开");

  const cancel = sent.find(isSessionCancelNotification);
  expect(cancel, "expected outbound session/cancel notification without id").toBeTruthy();
  const parsed = JSON.parse(cancel!) as { method: string; id?: unknown; params: { sessionId: string } };
  expect(parsed.method).toBe("session/cancel");
  expect(parsed).not.toHaveProperty("id");
  expect(parsed.params.sessionId).toBeTruthy();
});
