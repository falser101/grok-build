import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("permission card answers with selected optionId", async ({ page }) => {
  await page.goto("/?noconnect=1");
  const pending = page.evaluate(() =>
    window.__grokWebTest!.offerPermission({
      sessionId: "s1",
      toolCall: { toolCallId: "t1", title: "Execute `ls`", kind: "execute", rawInput: { command: "ls" } },
      options: [
        { optionId: "always-allow", name: "always allow", kind: "allow_always" },
        { optionId: "allow-once", name: "Yes", kind: "allow_once" },
        { optionId: "reject-once", name: "No", kind: "reject_once" },
      ],
    }),
  );
  await expect(page.locator("#block-card")).toBeVisible();
  await expect(page.locator(".block-title")).toContainText("Execute `ls`");
  await expect(page.locator(".block-opt")).toHaveCount(3);
  await page.locator(".block-opt").nth(1).click();
  await page.locator(".block-primary").click();
  await expect(pending).resolves.toEqual({
    outcome: { outcome: "selected", optionId: "allow-once" },
  });
  await expect(page.locator("#block-card")).toBeHidden();
});

test("Esc minimizes permission card without answering", async ({ page }) => {
  await page.goto("/?noconnect=1");
  const pending = page.evaluate(() =>
    window.__grokWebTest!.offerPermission({
      sessionId: "s1",
      toolCall: { title: "Read a.ts", kind: "read" },
      options: [{ optionId: "allow-once", name: "Yes", kind: "allow_once" }],
    }),
  );
  await expect(page.locator("#block-card")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#block-card")).toBeHidden();
  await expect(page.locator("#block-pill")).toBeVisible();
  await page.locator("#block-pill").click();
  await expect(page.locator("#block-card")).toBeVisible();
  await page.keyboard.press("1");
  await expect(pending).resolves.toEqual({
    outcome: { outcome: "selected", optionId: "allow-once" },
  });
});

test("question card submits accepted answers", async ({ page }) => {
  await page.goto("/?noconnect=1");
  const pending = page.evaluate(() =>
    window.__grokWebTest!.offerQuestion({
      sessionId: "s1",
      toolCallId: "q1",
      mode: "default",
      questions: [
        {
          question: "Which one?",
          options: [
            { label: "Alpha", description: "first" },
            { label: "Beta", description: "second" },
          ],
        },
      ],
    }),
  );
  await expect(page.locator("#block-card")).toBeVisible();
  await page.locator(".block-opt").nth(1).click();
  await page.getByRole("button", { name: "提交" }).click();
  const result = await pending;
  expect(result).toMatchObject({ outcome: "accepted" });
  await expect(page.locator("#block-card")).toBeHidden();
});

test("plan card can approve", async ({ page }) => {
  await page.goto("/?noconnect=1");
  const pending = page.evaluate(() =>
    window.__grokWebTest!.offerPlan({
      sessionId: "s1",
      toolCallId: "p1",
      planContent: "# Do the thing\n\n- step",
    }),
  );
  await expect(page.locator("#block-card")).toBeVisible();
  await expect(page.locator(".block-plan")).toContainText("Do the thing");
  await page.getByRole("button", { name: "批准" }).click();
  await expect(pending).resolves.toEqual({ outcome: "approved" });
});

test("always-allow chips send command_parts meta", async ({ page }) => {
  await page.goto("/?noconnect=1");
  const pending = page.evaluate(() =>
    window.__grokWebTest!.offerPermission({
      sessionId: "s1",
      toolCall: {
        toolCallId: "t1",
        title: "Execute `git status --short extra`",
        kind: "execute",
        rawInput: { command: "git status --short extra" },
      },
      options: [
        { optionId: "allow-always-command", name: "Always allow:", kind: "allow_always" },
        { optionId: "allow-once", name: "Yes", kind: "allow_once" },
        { optionId: "reject-once", name: "No", kind: "reject_once" },
      ],
      _meta: { highlighted_words: ["git", "status", "--short", "extra"] },
    }),
  );
  await expect(page.locator("#block-card")).toBeVisible();
  await expect(page.locator(".block-chip")).toHaveCount(4);
  await page.locator(".block-chip").nth(0).click();
  await expect(page.locator(".block-opt").first()).toContainText("始终允许：git");
  await page.locator(".block-primary").click();
  await expect(pending).resolves.toEqual({
    outcome: { outcome: "selected", optionId: "allow-always-command" },
    _meta: { command_parts: ["git"], is_glob: false },
  });
});

test("mcp always-allow can switch to server scope", async ({ page }) => {
  await page.goto("/?noconnect=1");
  const pending = page.evaluate(() =>
    window.__grokWebTest!.offerPermission({
      sessionId: "s1",
      toolCall: { toolCallId: "t1", title: "List issues", name: "linear__list_issues", kind: "other" },
      options: [
        {
          optionId: "allow-always-mcp",
          name: "Always allow:",
          kind: "allow_always",
          _meta: { tool_name: "linear__list_issues", server_prefix: "linear" },
        },
        { optionId: "allow-once", name: "Yes", kind: "allow_once" },
      ],
    }),
  );
  await expect(page.locator(".block-chip")).toHaveCount(2);
  await page.locator(".block-chip").nth(1).click();
  await expect(page.locator(".block-opt").first()).toContainText("linear");
  await page.locator(".block-primary").click();
  await expect(pending).resolves.toEqual({
    outcome: { outcome: "selected", optionId: "allow-always-mcp" },
    _meta: { kind: "server", server: "linear" },
  });
});

test("stop opens a keep-running cancel card", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => window.__grokWebTest?.setTurnRunning(true));
  await page.locator("#btn-stop").click();
  await expect(page.locator("#block-card")).toBeVisible();
  await expect(page.locator(".block-title")).toContainText("停");
  await expect(page.locator(".block-opt")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.locator("#block-card")).toBeHidden();
});

test("stop with a live subagent asks whether to kill it", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "subagent_spawned",
        childSessionId: "child-1",
        status: "running",
        description: "explore",
      },
      _meta: { eventId: "sa1" },
    });
    window.__grokWebTest?.setTurnRunning(true);
  });
  await page.locator("#btn-stop").click();
  await expect(page.locator("#block-card")).toBeVisible();
  await expect(page.locator(".block-title")).toContainText("子 agent");
  await expect(page.locator(".block-opt")).toHaveCount(4);
  await page.locator(".block-opt").nth(1).click();
  await expect(page.locator("#block-card")).toBeHidden();
});
