import { expect, test, type Page } from "@playwright/test";
import { SECRET, attachRpc, closeSettings, fillDock, findLastSent } from "./helpers";

test.describe.configure({ mode: "serial" });

async function waitAuthed(page: Page) {
  await fillDock(page, SECRET);
  await page.locator("#btn-connect").click();
  await expect(page.locator("#conn-label")).toHaveText("已连接", { timeout: 90_000 });
  await closeSettings(page);
  await expect(page.locator("#prompt")).toBeEnabled({ timeout: 30_000 });
}

async function assertUserBubbleVisible(page: Page, text = "visible-user-bubble") {
  const bubble = page.locator(".bubble.user").last();
  const body = page.locator(".bubble.user .body").last();
  await expect(body).toBeVisible();
  await expect(body).toHaveText(text);
  const box = await bubble.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(40);
  expect(box!.height).toBeGreaterThan(20);
  const threadBox = await page.locator("#thread").boundingBox();
  expect(threadBox).toBeTruthy();
  expect(box!.x + box!.width).toBeGreaterThan(threadBox!.x + threadBox!.width * 0.45);
  const uncovered = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".bubble.user");
    const el = nodes[nodes.length - 1];
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return Boolean(top && el.contains(top));
  });
  expect(uncovered, "user bubble must be the topmost pixel at its center").toBe(true);
}

test("appearance follows the theme select", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    const el = document.getElementById("theme-pref") as HTMLSelectElement | null;
    if (!el) return;
    el.value = "light";
    el.dispatchEvent(new Event("change"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.evaluate(() => {
    const el = document.getElementById("theme-pref") as HTMLSelectElement | null;
    if (!el) return;
    el.value = "dark";
    el.dispatchEvent(new Event("change"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("optimistic user bubble is visible on the right", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.insertUser("visible-user-bubble");
  });
  await assertUserBubbleVisible(page);
});

test("optimistic user bubble is uncovered on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?noconnect=1");
  await page.locator("#btn-sidebar-open").click();
  await expect(page.locator("#sidebar")).toBeVisible();
  await page.evaluate(() => {
    window.__grokWebTest?.insertUser("visible-user-bubble");
  });
  await expect(page.locator("#app")).toHaveAttribute("data-sidebar", "collapsed");
  await assertUserBubbleVisible(page);
});

test("replay stays on a loader until endReplay then lands on the latest", async ({
  page,
}) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.beginReplay();
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "oldest-turn" },
      },
      _meta: { isReplay: true, eventId: "r1" },
    });
  });
  await expect(page.locator(".loading-history")).toBeVisible();
  await expect(page.locator(".bubble.user")).toHaveCount(0);
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "newest-turn" },
      },
      _meta: { isReplay: true, eventId: "r2" },
    });
    window.__grokWebTest?.endReplay();
  });
  await expect(page.locator(".loading-history")).toHaveCount(0);
  const users = page.locator(".bubble.user .body");
  await expect(users).toHaveCount(2);
  await expect(users.last()).toContainText("newest-turn");
});

test("latest user bubble stays in the thread viewport while the tail grows", async ({
  page,
}) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.insertUser("visible-user-bubble");
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: `${"agent line\n".repeat(80)}tail` },
      },
      _meta: { eventId: "long-agent" },
    });
  });
  const user = page.locator(".bubble.user");
  await expect(user).toBeVisible();
  await expect(user.locator(".body")).toContainText("visible-user-bubble");
  const [userBox, threadBox] = await Promise.all([
    user.boundingBox(),
    page.locator("#thread").boundingBox(),
  ]);
  expect(userBox).toBeTruthy();
  expect(threadBox).toBeTruthy();
  expect(userBox!.y + userBox!.height).toBeGreaterThan(threadBox!.y);
  expect(userBox!.y).toBeLessThan(threadBox!.y + threadBox!.height);
});

test("injected replay history renders user markdown agent thinking and tools", async ({
  page,
}) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.beginReplay();
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "hist-user" },
      },
      _meta: { isReplay: true, eventId: "h1" },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "ponder" },
      },
      _meta: { isReplay: true, eventId: "h2" },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "# hello **x**" },
      },
      _meta: { isReplay: true, eventId: "h3" },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "t1",
        kind: "execute",
        title: "ls",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "ok" } }],
      },
      _meta: { isReplay: true, eventId: "h4" },
    });
    window.__grokWebTest?.endReplay();
  });
  await expect(page.locator(".bubble.user .body")).toContainText("hist-user");
  await expect(page.locator(".bubble.user")).toHaveAttribute("data-replay", "true");
  await expect(page.locator(".bubble.think")).toBeVisible();
  await expect(page.locator(".bubble.agent .body strong")).toHaveText("x");
  await expect(page.locator(".bubble.agent .body h1")).toHaveText("hello x");
  await expect(page.locator(".bubble.agent")).not.toContainText("复制");
  await expect(page.locator(".bubble.agent")).not.toContainText("查看");
  await expect(page.locator(".bubble.agent")).not.toContainText("源");
  await expect(page.locator(".bubble.tool")).toBeVisible();
  await expect(page.locator(".bubble.tool .tool-line")).toContainText("运行 ls");
  await expect(page.locator(".bubble.tool")).not.toContainText("completed");
  const kinds = await page.evaluate(() => window.__grokWebTest?.timelineKinds() ?? []);
  expect(kinds).toEqual(["user", "think", "agent", "tool"]);
});

test("header does not show model chip or session tools", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await expect(page.locator("#header-status")).toBeHidden();
  await expect(page.locator(".header-model-wrap")).toBeHidden();
  await expect(page.locator("#btn-header-model")).toBeHidden();
  await expect(page.locator(".header-right")).toBeHidden();
  await expect(page.locator("#session-tools")).toBeHidden();
  await expect(page.locator("#composer #btn-model-chip")).toBeVisible();
});

test("session overflow menu sits next to the title", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    document.getElementById("app")?.setAttribute("data-surface", "session");
  });
  await expect(page.locator("#session-tools")).toBeVisible();
  await expect(page.locator(".header-right")).toBeHidden();
  await page.locator("#session-tools summary").click();
  await expect(page.locator("#btn-context")).toHaveText("用量");
  await expect(page.locator("#btn-compact")).toHaveText("压缩较早对话");
  await expect(page.locator("#btn-export")).toHaveText("导出");
  await expect(page.locator("#btn-worktree-resume")).toHaveText("在独立副本打开");
});

test("usage export and compact sheets are readable", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => window.__grokWebTest?.openUsageSheet());
  await expect(page.locator("#app-dialog")).toBeVisible();
  await expect(page.locator("#app-dialog-title")).toHaveText("这次对话用了多少");
  await expect(page.locator("#app-dialog")).toContainText("82%");
  await expect(page.locator("#app-dialog")).toContainText("对话");
  await expect(page.locator("#app-dialog")).toContainText("还能用");
  await expect(page.locator("#app-dialog")).toContainText("压缩较早对话");
  await page.locator("#btn-app-dialog-close").click();
  await page.evaluate(() => window.__grokWebTest?.openExportSheet());
  await expect(page.locator("#app-dialog-title")).toHaveText("导出这次对话");
  await expect(page.locator("#app-dialog")).toContainText("下载 Markdown");
  await expect(page.locator("#app-dialog")).toContainText("下载纯文本");
  await page.locator("#btn-app-dialog-close").click();
  await page.evaluate(() => window.__grokWebTest?.openCompactSheet());
  await expect(page.locator("#app-dialog-title")).toHaveText("压缩较早对话");
  await expect(page.locator("#app-dialog")).toContainText("不能完整回看");
});

test("model_auto_switched tells the user the model changed", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: { sessionUpdate: "model_auto_switched", modelId: "grok-4" },
    });
  });
  await expect(page.locator("#banner")).toContainText("模型已自动换成");
});

test("header context chip shows percent from session_status", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await expect(page.locator("#header-context")).toHaveText("上下文 —%");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "session_status",
        context_window: {
          used_percentage: 17,
          context_tokens: 2000,
          context_window_size: 12000,
        },
      },
    });
  });
  await expect(page.locator("#header-context")).toHaveText("上下文 17%");
});

test("turn_completed clears thinking status and stop button", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => window.__grokWebTest?.setTurnRunning(true));
  await expect(page.locator("#turn-status")).toHaveText("正在想");
  await expect(page.locator("#turn-actions")).toBeVisible();
  await expect(page.locator("#btn-interject")).toBeVisible();
  await expect(page.locator("#btn-stop")).toBeVisible();
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: { sessionUpdate: "turn_completed", prompt_id: "p-done", stop_reason: "end_turn" },
    });
  });
  await expect(page.locator("#turn-status")).toBeHidden();
  await expect(page.locator("#turn-actions")).toBeHidden();
  await expect(page.locator("#btn-stop")).toBeHidden();
  await expect(page.locator("#composer #btn-send-now")).toHaveCount(0);
  await expect(page.locator("#composer #btn-interject")).toHaveCount(0);
  await expect(page.locator("#btn-send")).toBeVisible();
});

test("thinking expands in the thread instead of opening a modal", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "secret-plan" },
      },
      _meta: { eventId: "th1" },
    });
    window.__grokWebTest?.applyUpdate("x.ai/session/prompt_complete", {});
  });
  const think = page.locator(".bubble.think");
  await expect(think).toBeVisible();
  await expect(think).not.toHaveJSProperty("open", true);
  await think.locator("summary").click();
  await expect(think).toHaveJSProperty("open", true);
  await expect(think.locator(".body")).toContainText("secret-plan");
  await expect(page.locator("#action-modal")).toBeHidden();
  await expect(page.locator("#btn-sel-view")).toHaveCount(0);
});

test("agent and thinking markdown render as HTML not source", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "**plan** the fix" },
      },
      _meta: { eventId: "md-th" },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "# Hello\n\nUse `code` and **bold**.\n" },
      },
      _meta: { eventId: "md-ag" },
    });
  });
  await expect(page.locator(".bubble.agent .body h1")).toHaveText("Hello");
  await expect(page.locator(".bubble.agent .body strong")).toHaveText("bold");
  await expect(page.locator(".bubble.agent .body code")).toHaveText("code");
  await expect(page.locator(".bubble.think .body strong")).toHaveText("plan");
});

test("streaming markdown freezes closed blocks and only rewrites the live tail", async ({
  page,
}) => {
  await page.goto("/?noconnect=1");
  const chunk = async (eventId: string, text: string) => {
    await page.evaluate(
      ({ eventId, text }) => {
        window.__grokWebTest?.applyUpdate("session/update", {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text },
          },
          _meta: { eventId },
        });
      },
      { eventId, text },
    );
  };

  await chunk("md-stream-1", "# Title\n\nHello");
  const body = page.locator(".bubble.agent .body");
  await expect(body.locator(":scope > h1")).toHaveText("Title");
  await expect(body.locator(":scope > .md-live")).toContainText("Hello");
  await body.locator(":scope > h1").evaluate((el) => {
    (el as HTMLElement).dataset.frozen = "1";
  });

  await chunk("md-stream-2", " **world**");
  await expect(body.locator(":scope > h1")).toHaveAttribute("data-frozen", "1");
  await expect(body.locator(":scope > .md-live strong")).toHaveText("world");
  await expect(body.locator(":scope > .md-live")).toContainText("Hello");

  await chunk("md-stream-3", "\n\n```js\nconst x = 1");
  await expect(body.locator(":scope > h1")).toHaveAttribute("data-frozen", "1");
  await expect(body.locator(":scope > p")).toContainText("Hello");
  await expect(body.locator(":scope > p strong")).toHaveText("world");
  const liveFence = body.locator(":scope > .md-live pre code");
  await expect(liveFence).toHaveText("const x = 1");
  await expect(liveFence.locator(".tok-k")).toHaveCount(0);

  await chunk("md-stream-4", "\n```\n\nDone.");
  await expect(body.locator(":scope > h1")).toHaveAttribute("data-frozen", "1");
  await expect(body.locator(":scope > pre code .tok-k")).toHaveText("const");
  await expect(body.locator(":scope > .md-live")).toHaveText("Done.");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(body.locator(":scope > h1")).toBeVisible();
  await expect(body.locator(":scope > pre")).toBeVisible();
  await expect(body.locator(":scope > .md-live")).toContainText("Done.");
});

test("ordered list items number 1 2 3 not 1 1 1", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: {
          type: "text",
          text: "1. first item\ncontinuation\n\n2. second item\n\n3. third item",
        },
      },
      _meta: { eventId: "md-ol" },
    });
  });
  const ol = page.locator(".bubble.agent .body ol");
  await expect(ol).toHaveCount(1);
  await expect(ol.locator(":scope > li")).toHaveCount(3);
  await expect(ol.locator(":scope > li").nth(0)).toContainText("first item");
  await expect(ol.locator(":scope > li").nth(1)).toHaveText("second item");
  await expect(ol.locator(":scope > li").nth(2)).toHaveText("third item");
  const start = await ol.evaluate((node) => (node as HTMLOListElement).start);
  expect(start).toBe(1);
});

test("edit and execute tools stay as their own rows without completed", async ({
  page,
}) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "e1",
        kind: "edit",
        title: "Edit `docs/a.md`",
        status: "completed",
        content: [{ type: "diff", path: "docs/a.md", oldText: "old-line", newText: "new-line" }],
      },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "e2",
        kind: "edit",
        title: "Edit `web/src/style.css`",
        status: "completed",
      },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "x1",
        kind: "execute",
        title: "Execute `npx tsc --noEmit`",
        status: "completed",
      },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: { sessionUpdate: "retry_state", type: "retrying", attempt: 3 },
    });
  });
  await expect(page.locator(".bubble.tool")).toHaveCount(3);
  await expect(page.locator(".bubble.tool .tool-line").nth(0)).toContainText("编辑 a.md");
  await expect(page.locator(".diff-table")).toBeVisible();
  await expect(page.locator(".diff-table")).toContainText("old-line");
  await expect(page.locator(".diff-table")).toContainText("new-line");
  const editBoxes = await page.locator(".bubble.tool[data-family='edit'] .diff-block").all();
  expect(editBoxes.length).toBeGreaterThanOrEqual(1);
  const widths = [];
  for (const box of await page.locator(".bubble.tool").all()) {
    const r = await box.boundingBox();
    if (r) widths.push(Math.round(r.width));
  }
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(8);
  await expect(page.locator(".bubble.tool .tool-line").nth(2)).toContainText("运行 npx tsc --noEmit");
  await expect(page.locator(".bubble.sys")).toHaveCount(0);
  await expect(page.locator("#thread")).not.toContainText("completed");
});

test("tool cards show path, truncated shell, and diff hunk gaps", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    const apply = (update: Record<string, unknown>, eventId: string) =>
      window.__grokWebTest?.applyUpdate("session/update", { update, _meta: { eventId } });
    apply(
      {
        sessionUpdate: "tool_call",
        toolCallId: "r1",
        kind: "read",
        title: "Read `src/a.ts`",
        rawInput: { path: "src/a.ts", offset: 1, limit: 10 },
        content: { type: "text", text: "export const x = 1;\n" },
      },
      "r1",
    );
    apply(
      {
        sessionUpdate: "tool_call",
        toolCallId: "x1",
        kind: "execute",
        title: "Execute `seq 20`",
        rawInput: { command: "seq 20" },
        content: {
          type: "text",
          text: Array.from({ length: 20 }, (_, i) => String(i)).join("\n"),
        },
      },
      "x1",
    );
    apply(
      {
        sessionUpdate: "tool_call",
        toolCallId: "e1",
        kind: "edit",
        title: "Edit `a.ts`",
        content: [
          {
            type: "diff",
            path: "a.ts",
            oldText: "a\nb\nc\nd\nold\ne\nf",
            newText: "a\nb\nc\nd\nnew\ne\nf",
          },
        ],
      },
      "e1",
    );
    apply(
      {
        sessionUpdate: "workflow_updated",
        runId: "w1",
        name: "review",
        status: "running",
        objective: "look over the diff",
        phases: [
          { title: "gather", state: "done" },
          { title: "review", state: "active" },
        ],
      },
      "w1",
    );
  });
  await page.locator(".bubble.tool[data-family='read'] .tool-line").click();
  await expect(page.locator(".bubble.tool[data-family='read'] .tool-path")).toContainText("src/a.ts");
  await page.locator(".bubble.tool[data-family='exec'] .tool-line").click();
  await expect(page.locator(".tool-cmd")).toContainText("$ seq 20");
  await expect(page.locator(".bubble.tool[data-family='exec']")).toContainText("行省略");
  await page.locator(".tool-more").click();
  await expect(page.locator(".bubble.tool[data-family='exec']")).toContainText("19");
  await expect(page.locator(".diff-gap")).toContainText("行未改");
  await expect(page.locator(".phase-trail")).toContainText("gather");
  await expect(page.locator(".bubble.workflow")).toContainText("review");
});

test("think reply tools think edit reply interleave in arrival order", async ({
  page,
}) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    const apply = (update, eventId) =>
      window.__grokWebTest?.applyUpdate("session/update", { update, _meta: { eventId } });
    apply({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "plan" } }, "t1");
    apply({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "first" } }, "a1");
    apply({ sessionUpdate: "tool_call", toolCallId: "r1", kind: "read", title: "a.ts" }, "r1");
    apply({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "again" } }, "t2");
    apply({ sessionUpdate: "tool_call", toolCallId: "e1", kind: "edit", title: "Edit `a.ts`" }, "e1");
    apply({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "second" } }, "a2");
  });
  const kinds = await page.evaluate(() => window.__grokWebTest?.timelineKinds() ?? []);
  expect(kinds).toEqual(["think", "agent", "tool", "think", "tool", "agent"]);
  await expect(page.locator(".bubble.agent .body").nth(0)).toHaveText("first");
  await expect(page.locator(".bubble.agent .body").nth(1)).toHaveText("second");
  const [threadBox, agentBox] = await Promise.all([
    page.locator("#thread").boundingBox(),
    page.locator(".bubble.agent").first().boundingBox(),
  ]);
  expect(threadBox).toBeTruthy();
  expect(agentBox).toBeTruthy();
  expect(agentBox!.width).toBeGreaterThan(threadBox!.width * 0.72);
});

test("live eventId is ignored the second time", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "one" },
      },
      _meta: { eventId: "dup" },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "two" },
      },
      _meta: { eventId: "dup" },
    });
  });
  await expect(page.locator(".bubble.agent .body")).toContainText("one");
  await expect(page.locator(".bubble.agent .body")).not.toContainText("two");
});

test("Enter sends, Shift+Enter inserts a newline, empty Enter does not send", async ({
  page,
}) => {
  await waitAuthed(page);
  await page.locator("#btn-new").click();
  await expect(page.locator("#session-label")).not.toHaveText("无 session", {
    timeout: 30_000,
  });
  await page.locator("#prompt").fill("line");
  await page.locator("#prompt").press("Shift+Enter");
  await expect(page.locator("#prompt")).toHaveValue("line\n");
  await page.locator("#prompt").fill("");
  await page.locator("#prompt").press("Enter");
  await expect(page.locator(".bubble.user")).toHaveCount(0);
  await page.locator("#prompt").fill("visible-user-bubble");
  await page.locator("#prompt").press("Enter");
  const userBubble = page.locator(".bubble.user .body");
  await expect(userBubble).toBeVisible({ timeout: 15_000 });
  await expect(userBubble).toContainText("visible-user-bubble");
  await expect(page.locator(".bubble.user")).toBeVisible();
  await expect(page.locator("#prompt")).toHaveValue("");
  const stop = page.locator("#btn-stop");
  if (await stop.isVisible()) {
    await stop.click();
    const halt = page.getByRole("button", { name: "停止这次" });
    if (await halt.isVisible()) await halt.click();
  }
});

test("slash menu lists initialize availableCommands", async ({ page }) => {
  await waitAuthed(page);
  await page.locator("#prompt").fill("/");
  await expect(page.locator("#slash-menu")).toBeVisible();
  await expect(page.locator(".slash-row").first()).toBeVisible();
  await page.locator("#prompt").press("Tab");
  await expect(page.locator("#slash-menu")).toBeHidden();
  await expect(page.locator("#prompt")).toHaveValue(/^\//);
});

test("queue captures a follow-up while a turn is marked running", async ({ page }) => {
  await waitAuthed(page);
  await page.locator("#btn-new").click();
  await expect(page.locator("#session-label")).not.toHaveText("无 session", {
    timeout: 30_000,
  });
  await page.evaluate(() => window.__grokWebTest?.setTurnRunning(true));
  await page.locator("#prompt").fill("queued-follow-up");
  await page.locator("#prompt").press("Enter");
  await expect.poll(() => page.evaluate(() => window.__grokWebTest?.queueTexts() ?? [])).toEqual([
    "queued-follow-up",
  ]);
  await expect(page.locator("#queue-strip")).toBeVisible();
  await expect(page.locator(".queue-item")).toContainText("queued-follow-up");
});

test("opening a listed session hydrates replayed bubbles", async ({ page }) => {
  await waitAuthed(page);
  const withSummary = page.locator(".session-row").filter({ has: page.locator(".row-meta").nth(1) });
  const row = (await withSummary.count()) ? withSummary.first() : page.locator(".session-row").first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page.locator("#app")).toHaveAttribute("data-surface", "session");
  await expect(page.locator(".bubble")).not.toHaveCount(0, { timeout: 30_000 });
});

test("session/prompt content blocks include text; Ctrl+Enter is send-now", async ({
  page,
}) => {
  const cap = attachRpc(page);
  await waitAuthed(page);
  await page.locator("#btn-new").click();
  await expect(page.locator("#session-label")).not.toHaveText("无 session", {
    timeout: 30_000,
  });
  await page.locator("#prompt").fill("wire-prompt-shape");
  await page.locator("#prompt").press("Control+Enter");
  await expect(page.locator(".bubble.user .body").last()).toContainText(
    "wire-prompt-shape",
  );
  const stop = page.locator("#btn-stop");
  if (await stop.isVisible()) await stop.click();
  await expect
    .poll(() => findLastSent(cap, "session/prompt"), { timeout: 20_000 })
    .toBeTruthy();
  const msg = findLastSent(cap, "session/prompt") as {
    params?: {
      prompt?: { type?: string; text?: string }[];
      _meta?: { sendNow?: boolean; promptId?: string; screenMode?: string };
    };
  } | null;
  expect(msg?.params?.prompt?.[0]?.type).toBe("text");
  expect(msg?.params?.prompt?.[0]?.text).toBe("wire-prompt-shape");
  expect(msg?.params?.prompt?.every((b) => b.type !== "image")).toBe(true);
  expect(msg?.params?._meta?.sendNow).toBe(true);
  expect(msg?.params?._meta?.promptId).toBeTruthy();
  expect(msg?.params?._meta?.screenMode).toBe("web");
});

test("feedback request card can be answered in the thread", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "feedback_request",
        content: { type: "text", text: "这条回答有帮助吗？" },
      },
    });
  });
  const card = page.locator(".bubble.feedback");
  await expect(card).toContainText("这条回答有帮助吗？");
  await card.getByRole("button", { name: "有帮助" }).click();
  await expect(card).toContainText("已记下，谢谢");
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("local /copy /find /jump /context and mermaid/btw blocks", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "```mermaid\ngraph TD; A-->B\n```\nkeep-me" },
      },
      _meta: { eventId: "m1" },
    });
    window.__grokWebTest?.insertContext("ctx-line");
  });
  await expect(page.locator(".bubble.context")).toContainText("ctx-line");
  await expect(page.locator("pre.mermaid-block, .mermaid-out")).toBeVisible();
  await page.evaluate(() => window.__grokWebTest?.runLocalSlash("find", "keep-me"));
  await expect(page.locator("#find-bar")).toBeVisible();
  await page.evaluate(() => window.__grokWebTest?.runLocalSlash("jump", ""));
  await expect(page.locator("#jump-panel")).toBeVisible();
  const copied = await page.evaluate(() => window.__grokWebTest?.nthAgentText(1));
  expect(copied).toContain("keep-me");
});

test("user images render as thumbs above caption without Image # tokens", async ({
  page,
}) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: [
          { type: "text", text: "[Image #1] 看看布局" },
          { type: "image", mimeType: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" },
        ],
      },
      _meta: { eventId: "img-user" },
    });
  });
  await expect(page.locator(".user-thumbs")).toBeVisible();
  await expect(page.locator(".user-thumb img")).toBeVisible();
  await expect(page.locator(".bubble.user .body")).toHaveText("看看布局");
  await expect(page.locator(".bubble.user .body")).not.toContainText("[Image #1]");
  const [thumbsBox, bodyBox, bubbleBox] = await Promise.all([
    page.locator(".user-thumbs").boundingBox(),
    page.locator(".bubble.user .body").boundingBox(),
    page.locator(".bubble.user").boundingBox(),
  ]);
  expect(thumbsBox).toBeTruthy();
  expect(bodyBox).toBeTruthy();
  expect(bubbleBox).toBeTruthy();
  expect(thumbsBox!.y + thumbsBox!.height).toBeLessThanOrEqual(bubbleBox!.y + 6);
  expect(bodyBox!.y).toBeGreaterThanOrEqual(bubbleBox!.y - 1);
  expect(bodyBox!.x).toBeGreaterThanOrEqual(bubbleBox!.x - 1);
  expect(bodyBox!.y + bodyBox!.height).toBeLessThanOrEqual(bubbleBox!.y + bubbleBox!.height + 2);
  expect(thumbsBox!.height).toBeLessThan(90);
});

test("compressed image stays on the caption bubble, not a stray thumb with 刚刚", async ({
  page,
}) => {
  const pixel =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  await page.goto("/?noconnect=1");
  await page.evaluate((data) => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "这是什么" },
      },
      _meta: { eventId: "split-text" },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: { sessionUpdate: "image_compressed" },
      _meta: { eventId: "split-cmp" },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: [
          { type: "text", text: "" },
          { type: "image", mimeType: "image/png", data },
        ],
      },
      _meta: { eventId: "split-img" },
    });
  }, pixel);
  await expect(page.locator(".turn-user")).toHaveCount(1);
  await expect(page.locator(".bubble.user:not([hidden])")).toHaveCount(1);
  await expect(page.locator(".user-thumb img")).toBeVisible();
  await expect(page.locator(".bubble.user .body")).toHaveText("这是什么");
  await expect(page.locator(".turn-user .ts")).not.toBeVisible();
  await expect(page.locator("#thread")).not.toContainText("图片已压缩");
  const [thumbsBox, bubbleBox] = await Promise.all([
    page.locator(".user-thumbs").boundingBox(),
    page.locator(".bubble.user").boundingBox(),
  ]);
  expect(thumbsBox).toBeTruthy();
  expect(bubbleBox).toBeTruthy();
  expect(thumbsBox!.y + thumbsBox!.height).toBeLessThanOrEqual(bubbleBox!.y + 6);
});

test("user image overflow shows +N on the last thumb and opens a gallery", async ({
  page,
}) => {
  const pixel =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  await page.goto("/?noconnect=1");
  await page.evaluate((data) => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: [
          { type: "text", text: "五张图" },
          ...[0, 1, 2, 3, 4].map(() => ({
            type: "image" as const,
            mimeType: "image/png",
            data,
          })),
        ],
      },
      _meta: { eventId: "img-five" },
    });
  }, pixel);
  await expect(page.locator(".user-thumb")).toHaveCount(4);
  await expect(page.locator(".user-thumb-more")).toHaveText("+1");
  await page.locator(".user-thumb").first().click();
  await expect(page.locator("#image-lightbox")).toBeVisible();
  await expect(page.locator("#lightbox-count")).toHaveText("1 / 5");
  await page.locator("#lightbox-next").click();
  await expect(page.locator("#lightbox-count")).toHaveText("2 / 5");
  await page.keyboard.press("Escape");
  await expect(page.locator("#image-lightbox")).toBeHidden();
  await page.locator(".user-thumb-overflow").click();
  await expect(page.locator("#image-lightbox")).toBeVisible();
  await expect(page.locator("#lightbox-count")).toHaveText("4 / 5");
  await page.locator("#lightbox-next").click();
  await expect(page.locator("#lightbox-count")).toHaveText("5 / 5");
});

test("composer input aligns with the conversation column", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.insertUser("align-user");
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "align-agent-copy" },
      },
      _meta: { eventId: "align-a" },
    });
  });
  const [thread, input, agent] = await Promise.all([
    page.locator("#thread").boundingBox(),
    page.locator(".composer-main").boundingBox(),
    page.locator(".bubble.agent").boundingBox(),
  ]);
  expect(thread).toBeTruthy();
  expect(input).toBeTruthy();
  expect(agent).toBeTruthy();
  expect(Math.abs(thread!.x - input!.x)).toBeLessThan(6);
  expect(Math.abs(thread!.x + thread!.width - (input!.x + input!.width))).toBeLessThan(6);
  expect(Math.abs(agent!.x - input!.x)).toBeLessThan(6);
});

test("composer image chips sit inside the box with a hover remove control", async ({
  page,
}) => {
  const pixel =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  await page.goto("/?noconnect=1");
  await page.evaluate((data) => {
    const prompt = document.getElementById("prompt") as HTMLTextAreaElement;
    prompt.disabled = false;
    window.__grokWebTest?.addComposerImage({
      mimeType: "image/png",
      data,
      name: "shot.png",
    });
  }, pixel);
  await expect(page.locator("#composer")).toHaveAttribute("data-filled", "1");
  const chips = page.locator("#image-chips");
  await expect(chips).toBeVisible();
  await expect(page.locator(".composer-main #image-chips")).toHaveCount(1);
  const [mainBox, chipsBox] = await Promise.all([
    page.locator(".composer-main").boundingBox(),
    chips.boundingBox(),
  ]);
  expect(mainBox).toBeTruthy();
  expect(chipsBox).toBeTruthy();
  expect(chipsBox!.y).toBeGreaterThanOrEqual(mainBox!.y - 1);
  expect(chipsBox!.y + chipsBox!.height).toBeLessThanOrEqual(mainBox!.y + mainBox!.height + 1);
  const promptBox = await page.locator("#prompt").boundingBox();
  expect(promptBox).toBeTruthy();
  expect(chipsBox!.y + chipsBox!.height).toBeLessThanOrEqual(promptBox!.y + 8);
  const chip = page.locator(".image-chip").first();
  const remove = chip.locator(".image-chip-remove");
  await expect(remove).toHaveCSS("opacity", "0");
  await chip.hover();
  await expect(remove).toHaveCSS("opacity", "1");
  await page.locator("#prompt").click();
  await expect(page.locator("#prompt")).toHaveCSS("outline-style", "none");
  await expect(page.locator("#prompt")).toHaveCSS("border-width", "0px");
  await chip.hover();
  await remove.click();
  await expect(page.locator(".image-chip")).toHaveCount(0);
});

test("composer starts tall and only grows when text wraps, then scrolls at the cap", async ({
  page,
}) => {
  await page.goto("/?noconnect=1");
  await expect(page.locator("#btn-attach")).toBeVisible();
  await expect(page.locator("#btn-model-chip")).toBeVisible();
  const emptyBox = await page.locator(".composer-main").boundingBox();
  expect(emptyBox).toBeTruthy();
  expect(emptyBox!.height).toBeGreaterThan(90);
  expect(emptyBox!.height).toBeLessThan(170);
  await page.evaluate(() => {
    const prompt = document.getElementById("prompt") as HTMLTextAreaElement;
    prompt.disabled = false;
    prompt.value = "短句不换行";
    prompt.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const shortBox = await page.locator(".composer-main").boundingBox();
  expect(shortBox).toBeTruthy();
  expect(Math.abs(shortBox!.height - emptyBox!.height)).toBeLessThan(4);
  await page.evaluate(() => {
    const prompt = document.getElementById("prompt") as HTMLTextAreaElement;
    prompt.value = "第一行\n第二行\n第三行\n第四行\n第五行";
    prompt.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const wrapBox = await page.locator(".composer-main").boundingBox();
  expect(wrapBox).toBeTruthy();
  expect(wrapBox!.height).toBeGreaterThan(emptyBox!.height + 8);
  await page.evaluate(() => {
    const prompt = document.getElementById("prompt") as HTMLTextAreaElement;
    prompt.value = Array.from({ length: 40 }, (_, i) => `行 ${i + 1}`).join("\n");
    prompt.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const capBox = await page.locator("#prompt").boundingBox();
  expect(capBox).toBeTruthy();
  expect(capBox!.height).toBeLessThanOrEqual(200);
  const overflow = await page.locator("#prompt").evaluate((el) => {
    const node = el as HTMLTextAreaElement;
    const style = getComputedStyle(node);
    return {
      overflow: style.overflowY,
      scroll: node.scrollHeight > node.clientHeight + 1,
    };
  });
  expect(overflow.overflow === "auto" || overflow.overflow === "scroll").toBeTruthy();
  expect(overflow.scroll).toBe(true);
});

test("during a turn send stays for queue and send-now appears", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await expect(page.locator("#btn-send")).toBeVisible();
  await expect(page.locator("#btn-stop")).toBeHidden();
  await expect(page.locator("#turn-actions")).toBeHidden();
  await expect(page.locator("#composer #btn-send-now")).toHaveCount(0);
  await page.evaluate(() => window.__grokWebTest?.setTurnRunning(true));
  await expect(page.locator("#btn-send")).toBeVisible();
  await expect(page.locator("#btn-send")).toHaveAttribute("aria-label", "加入队列");
  await expect(page.locator("#btn-stop")).toBeVisible();
  await expect(page.locator("#turn-actions")).toBeVisible();
  await expect(page.locator("#turn-actions #btn-send-now")).toBeVisible();
  await expect(page.locator("#turn-actions #btn-interject")).toBeVisible();
});

test("composer docks to the bottom after history or a user bubble", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await expect(page.locator("#app")).toHaveAttribute("data-composer", "center");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "dock-me" },
      },
      _meta: { eventId: "d1" },
    });
  });
  await expect(page.locator("#app")).toHaveAttribute("data-composer", "dock");
});

test("right history axis previews the user message on hover", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "axis-user-hello" },
      },
      _meta: { eventId: "u1" },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "axis-agent" },
      },
      _meta: { eventId: "a1" },
    });
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "axis-user-second" },
      },
      _meta: { eventId: "u2" },
    });
  });
  await expect(page.locator("#thread-rail")).toBeVisible();
  await expect(page.locator(".rail-tick")).toHaveCount(2);
  await expect(page.locator("#rail-up")).toBeVisible();
  await expect(page.locator("#rail-down")).toBeVisible();
  const [railBox, threadBox] = await Promise.all([
    page.locator("#thread-rail").boundingBox(),
    page.locator("#thread").boundingBox(),
  ]);
  expect(railBox).toBeTruthy();
  expect(threadBox).toBeTruthy();
  expect(railBox!.height).toBeLessThan(220);
  expect(railBox!.height).toBeLessThan(threadBox!.height * 0.45);
  const railMid = railBox!.y + railBox!.height / 2;
  const threadMid = threadBox!.y + threadBox!.height / 2;
  expect(Math.abs(railMid - threadMid)).toBeLessThan(threadBox!.height * 0.15);
  await expect(page.locator("#rail-prev-chip")).not.toBeVisible();
  await page.evaluate(() => {
    const chip = document.getElementById("rail-prev-chip");
    if (chip) chip.hidden = false;
  });
  await expect(page.locator("#rail-prev-chip")).toHaveCSS("opacity", "0");
  await page.locator("#rail-up").hover();
  await expect(page.locator("#rail-prev-chip")).toHaveCSS("opacity", "1");
  await page.locator(".rail-tick").first().hover();
  await expect(page.locator("#rail-preview")).toBeVisible();
  await expect(page.locator("#rail-preview-text")).toContainText("axis-user-hello");
});

test("compaction is one card that animates then settles", async ({ page }) => {
  await page.goto("/?noconnect=1");
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: { sessionUpdate: "auto_compact_started", percentage: 85 },
      _meta: { eventId: "c-start" },
    });
  });
  const card = page.locator(".bubble.compact");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-status", "running");
  await expect(card).toContainText("正在压缩上下文");
  await expect(card).toContainText("85%");
  await expect(card.locator(".compact-track")).toBeVisible();
  await expect(card.locator(".compact-spinner")).toBeVisible();
  await page.evaluate(() => {
    window.__grokWebTest?.applyUpdate("session/update", {
      update: {
        sessionUpdate: "auto_compact_completed",
        tokens_before: 48800,
        tokens_after: 27100,
        elapsed_ms: 170000,
      },
      _meta: { eventId: "c-done" },
    });
  });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-status", "done");
  await expect(card).toContainText("上下文已压缩");
  await expect(card).toContainText("48.8k");
  await expect(card).toContainText("27.1k");
  await expect(card).toContainText("2 分 50 秒");
  await expect(card.locator(".compact-track")).toHaveCount(0);
  await expect(page.locator(".bubble.sys")).toHaveCount(0);
  const [cardBox, threadBox] = await Promise.all([
    card.boundingBox(),
    page.locator("#thread").boundingBox(),
  ]);
  expect(cardBox).toBeTruthy();
  expect(threadBox).toBeTruthy();
  expect(cardBox!.width).toBeGreaterThan(threadBox!.width * 0.92);
});

test("slash menu includes local copy command", async ({ page }) => {
  await waitAuthed(page);
  await page.locator("#prompt").fill("/cop");
  await expect(page.locator("#slash-menu")).toBeVisible();
  await expect(page.locator(".slash-row").filter({ hasText: "/copy" })).toBeVisible();
});
