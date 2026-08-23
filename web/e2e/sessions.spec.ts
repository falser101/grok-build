import { expect, test, type Page } from "@playwright/test";
import {
  CWD,
  SECRET,
  attachRpc,
  connectWelcome,
  fillDock,
  findSent,
  parseRpc,
  type RpcCapture,
} from "./helpers";

test.describe.configure({ mode: "serial" });

async function waitAuthed(page: Page) {
  await fillDock(page, SECRET);
  await connectWelcome(page);
  await expect(page.locator("#prompt")).toBeEnabled({ timeout: 30_000 });
}

function listParams(cap: RpcCapture) {
  const msg = findSent(cap, "_x.ai/session/list");
  return (msg?.params ?? null) as { cwd?: string; cursor?: string; limit?: number } | null;
}

function lastLoad(cap: RpcCapture) {
  const loads = cap.sent
    .map(parseRpc)
    .filter((m) => m?.method === "session/load");
  return loads.at(-1) as {
    method: string;
    params?: {
      sessionId?: string;
      cwd?: string;
      _meta?: { cursor?: string };
    };
  } | undefined;
}

test("global list omits cwd; new session uses settings cwd and appears in the list", async ({
  page,
}) => {
  const cap = attachRpc(page);
  await waitAuthed(page);
  await expect
    .poll(() => listParams(cap), { timeout: 20_000 })
    .toBeTruthy();
  expect(listParams(cap), "picker list must not filter by repo cwd").not.toHaveProperty("cwd");

  await page.locator("#btn-new").click();
  await expect(page.locator("#session-label")).not.toHaveText("无 session", {
    timeout: 30_000,
  });
  const id = (await page.locator("#session-label").innerText()).trim();
  expect(id.length).toBeGreaterThan(8);

  const created = findSent(cap, "session/new") as {
    params?: { cwd?: string };
  } | null;
  expect(created?.params?.cwd).toBe(CWD);

  await expect(page.locator(`.session-row[data-session-id="${id}"]`)).toBeVisible({
    timeout: 30_000,
  });
});

test("clicking a list row loads with that row cwd and no reconnect cursor", async ({
  page,
}) => {
  const cap = attachRpc(page);
  await waitAuthed(page);
  await page.locator("#btn-new").click();
  await expect(page.locator("#session-label")).not.toHaveText("无 session", {
    timeout: 30_000,
  });
  const id = (await page.locator("#session-label").innerText()).trim();
  await expect(page.locator(`.session-row[data-session-id="${id}"]`)).toBeVisible({
    timeout: 30_000,
  });

  await page.locator("#btn-home").click();
  await expect(page.locator("#session-label")).toHaveText("无 session");
  await expect(page.locator("#conn-label")).toHaveText("已连接");
  await expect(page.locator("#welcome")).toBeVisible();

  const row = page.locator(`.session-row[data-session-id="${id}"]`);
  const rowCwd = (await row.getAttribute("data-cwd")) ?? CWD;
  await row.click();
  await expect(page.locator("#session-label")).toHaveText(id, { timeout: 30_000 });

  await expect
    .poll(() => lastLoad(cap)?.params?.sessionId, { timeout: 20_000 })
    .toBe(id);
  const load = lastLoad(cap)!;
  expect(load.params?.cwd).toBe(rowCwd);
  expect(load.params?._meta ?? {}).not.toHaveProperty("cursor");
});

test("session row menu opens as a floating popover", async ({ page }) => {
  await waitAuthed(page);
  await page.locator("#btn-new").click();
  await expect(page.locator("#session-label")).not.toHaveText("无 session", {
    timeout: 30_000,
  });
  const id = (await page.locator("#session-label").innerText()).trim();
  await page.locator("#btn-home").click();
  const row = page.locator(`.session-row[data-session-id="${id}"]`);
  await expect(row).toBeVisible();
  const wrap = page.locator(".session-row-wrap").filter({ has: row });
  await wrap.locator(".row-menu-btn").click();
  const pop = page.locator("#session-popover");
  await expect(pop).toBeVisible();
  await expect(pop.getByRole("menuitem", { name: "打开", exact: true })).toBeVisible();
  const metrics = await page.evaluate(() => {
    const menu = document.getElementById("session-popover");
    const r = menu?.getBoundingClientRect();
    return {
      hidden: Boolean(menu?.hidden),
      items: menu?.querySelectorAll("button").length ?? 0,
      width: r?.width ?? 0,
      position: menu ? getComputedStyle(menu).position : "",
    };
  });
  expect(metrics.hidden).toBe(false);
  expect(metrics.items).toBe(6);
  expect(metrics.width).toBeGreaterThan(80);
  expect(metrics.position).toBe("fixed");
  const stacked = await page.evaluate(() => {
    const ys = [...document.querySelectorAll("#session-popover button")].map(
      (b) => b.getBoundingClientRect().y,
    );
    return ys.length > 1 && ys.slice(1).every((y, i) => y > ys[i]! + 8);
  });
  expect(stacked).toBe(true);
  await page.keyboard.press("Escape");
  await expect(pop).toBeHidden();
});

test("leave session returns to the list without closing the WebSocket", async ({
  page,
}) => {
  const cap = attachRpc(page);
  await waitAuthed(page);
  await page.locator("#btn-new").click();
  await expect(page.locator("#session-label")).not.toHaveText("无 session", {
    timeout: 30_000,
  });

  const socketsBefore = cap.sent.length;
  await page.locator("#btn-home").click();
  await expect(page.locator("#session-label")).toHaveText("无 session");
  await expect(page.locator("#conn-label")).toHaveText("已连接");
  await expect(page.locator("#welcome")).toBeVisible();

  const stillUp = await page.evaluate(() => window.__grokWebTest?.connected() === true);
  expect(stillUp).toBe(true);
  const disconnects = cap.sent.map(parseRpc).filter((m) => m?.method === "disconnect");
  expect(disconnects).toEqual([]);
  expect(cap.sent.length).toBeGreaterThanOrEqual(socketsBefore);
});

test("mismatched cwd load shows a visible error and keeps the socket", async ({
  page,
}) => {
  const cap = attachRpc(page);
  await waitAuthed(page);
  await page.locator("#btn-new").click();
  await expect(page.locator("#session-label")).not.toHaveText("无 session", {
    timeout: 30_000,
  });
  const id = (await page.locator("#session-label").innerText()).trim();

  const rejected = await page.evaluate(async (sessionId) => {
    try {
      await window.__grokWebTest?.loadWithCwd(
        sessionId,
        "/tmp/grok-web-no-such-cwd-adversarial",
      );
      return false;
    } catch {
      return true;
    }
  }, id);
  expect(rejected).toBe(true);
  await expect(page.locator("#banner")).toHaveAttribute("data-reason", "load-failed");
  await expect(page.locator("#banner")).toContainText(/无法打开会话/);
  await expect(page.locator("#conn-label")).toHaveText("已连接");
  const stillUp = await page.evaluate(() => window.__grokWebTest?.connected() === true);
  expect(stillUp).toBe(true);

  const load = lastLoad(cap);
  expect(load?.params?.cwd).toBe("/tmp/grok-web-no-such-cwd-adversarial");
});
