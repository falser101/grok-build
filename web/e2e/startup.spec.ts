import { expect, test } from "@playwright/test";
import {
  AUTH_BAK,
  CWD,
  SECRET,
  WS,
  assertExtOk,
  attachRpc,
  backupAuth,
  connectWelcome,
  fillDock,
  findSent,
  restartServe,
  restoreAuth,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test("connecting indicator is recorded before a live session", async ({ page }) => {
  await fillDock(page, SECRET);
  await page.locator("#btn-connect").click();
  await expect(page.locator("#app")).toHaveAttribute("data-phases", /connecting/, {
    timeout: 15_000,
  });
  await expect(page.locator("#conn-label")).toHaveText("已连接", { timeout: 90_000 });
});

test("serve down shows doctor process-not-running copy", async ({ page }) => {
  await fillDock(page, SECRET, "ws://127.0.0.1:9/ws");
  await page.locator("#btn-connect").click();
  await expect(page.locator("#doctor")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#doctor-copy")).toContainText(/进程未起/);
  await expect(page.locator("#prompt")).toBeDisabled();
});

test("wrong secret foo on live serve shows doctor 401 copy", async ({ page }) => {
  await fillDock(page, "foo");
  await page.locator("#btn-connect").click();
  await expect(page.locator("#conn-label")).toHaveText("连接失败", { timeout: 15_000 });
  await expect(page.locator("#doctor")).toBeVisible();
  await expect(page.locator("#doctor-copy")).toContainText(/401|secret 错/);
});

test("eager auth lands on Welcome with version and cwd, or shows login", async ({
  page,
}) => {
  await fillDock(page, SECRET);
  await page.locator("#btn-connect").click();
  await expect(page.locator("#conn-label")).toHaveText("已连接", { timeout: 90_000 });
  const welcome = page.locator("#welcome");
  const login = page.locator("#login");
  await expect.poll(async () => {
    if (await welcome.isVisible()) return "welcome";
    if (await login.isVisible()) return "login";
    return "none";
  }).not.toBe("none");
  if (await welcome.isVisible()) {
    await expect(page.locator("#welcome-version")).toContainText("grok-web");
    await expect(page.locator("#welcome-cwd")).toContainText("grok-build");
    await expect(page.locator("#prompt")).toBeEnabled();
    const calls = await page.evaluate(() => window.__grokWebTest?.handshakeCalls() ?? []);
    expect(calls[0]).toBe("initialize");
  } else {
    await expect(page.locator("#btn-login-primary")).not.toHaveText(/^(Login|login)$/);
    await expect(page.locator("#prompt")).toBeDisabled();
  }
});

test("switch-account login keeps the socket and disables composer; API key stays out of localStorage", async ({
  page,
}) => {
  await fillDock(page, SECRET);
  await page.locator("#btn-connect").click();
  await expect(page.locator("#conn-label")).toHaveText("已连接", { timeout: 90_000 });
  if (await page.locator("#welcome").isVisible()) {
    await page.locator("#btn-switch-account").click();
  }
  await expect(page.locator("#login")).toBeVisible();
  await expect(page.locator("#prompt")).toBeDisabled();
  await expect(page.locator("#conn-label")).toHaveText("已连接");
  const label = (await page.locator("#btn-login-primary").innerText()).trim();
  expect(label.length).toBeGreaterThan(0);
  expect(label.toLowerCase()).not.toBe("login");

  await page.locator("#api-key").click();
  await page.keyboard.type("xai-playwright-must-not-persist", { delay: 4 });
  const dumped = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(dumped).not.toContain("xai-playwright-must-not-persist");
  await expect(page.locator("#ws-url")).toHaveValue(WS);
});

test("Welcome/login clicks send _x.ai extension frames that are not method_not_found", async ({
  page,
}) => {
  backupAuth();
  await page.addInitScript(() => {
    localStorage.removeItem("grok-web.consent-ack");
  });
  const cap = attachRpc(page);
  await fillDock(page, SECRET);
  await connectWelcome(page);

  const list = await assertExtOk(cap, "_x.ai/session/list");
  console.log("session/list", JSON.stringify(list.res.error ?? "ok"));
  await assertExtOk(cap, "_x.ai/auth/check_subscription");
  await assertExtOk(cap, "_x.ai/auth/info");

  const continueBtn = page.locator("#btn-continue");
  if (await continueBtn.isEnabled()) {
    await continueBtn.click();
    await expect(page.locator("#session-label")).not.toHaveText("无 session", {
      timeout: 30_000,
    });
    console.log("clicked 继续上次");
  } else {
    console.log("继续上次 still disabled after _x.ai/session/list");
  }

  await fillDock(page, SECRET);
  await connectWelcome(page);
  await page.locator("#btn-worktree").click();
  await assertExtOk(cap, "_x.ai/git/worktree/create");
  console.log("clicked 新 worktree");

  await fillDock(page, SECRET);
  await connectWelcome(page);
  if (await page.locator("#consent-banner").isVisible()) {
    await page.locator("#btn-consent-in").click();
    await assertExtOk(cap, "_x.ai/privacy/setCodingDataRetention");
    console.log("clicked Opt in");
  } else {
    console.log("consent banner hidden");
  }

  await page.locator("#btn-switch-account").click();
  await expect(page.locator("#login")).toBeVisible();
  await page.locator("#btn-login-primary").click();
  await expect(page.locator("#authenticating")).toBeVisible();
  await expect
    .poll(() => findSent(cap, "_x.ai/auth/get_url"), { timeout: 25_000 })
    .toBeTruthy();
  expect(findSent(cap, "_x.ai/auth/get_url")?.method).toBe("_x.ai/auth/get_url");
  await page.locator("#btn-auth-cancel").click();
  await assertExtOk(cap, "_x.ai/auth/cancel");
  console.log("clicked login + 取消");

  await page.locator("#api-key").click();
  await page.locator("#api-key").fill("");
  await page.keyboard.type("xai-playwright-must-not-persist", { delay: 3 });
  await page.locator("#btn-api-key").click();
  await assertExtOk(cap, "_x.ai/setApiKey");
  const dumped = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(dumped).not.toContain("xai-playwright-must-not-persist");
  console.log("clicked 用 API key 登录");

  await page.locator("#btn-logout").click();
  await expect(page.locator("#login")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#prompt")).toBeDisabled();
  await expect(page.locator("#conn-label")).toHaveText("已连接");
  await assertExtOk(cap, "_x.ai/auth/logout");
  console.log("clicked 退出登录");
  expect(CWD).toContain("grok-build");
});

test.afterAll(async () => {
  restoreAuth();
  await restartServe();
  console.log("auth restored, serve restarted", AUTH_BAK);
});
