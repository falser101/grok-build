# Grok Web

本机浏览器客户端，经 ACP WebSocket 连 `grok agent serve`。和 TUI 共用同一个 `MvpAgent` 与 `~/.grok/sessions/`。

浏览器不能当 Agent（它要跑 bash、读仓库、写 session）。TUI 启动时会在同进程里拉起 Agent；Web 则由 `npm run dev` 自动起一个 `grok agent serve`，页面连 **同源** `/ws`，Vite 把 secret 注进代理。你不用填 Secret，也不用另开终端。

当前：运输层 + 启动/鉴权/Welcome + 会话/对话 + 阻塞卡（权限 / 提问 / Plan / 停止）。本地 `npm run dev` 仍带 `--always-approve`，ask 模式现在可以在 Web 里点批准。

## 启动

```bash
cd web
npm install
npm run dev
```

打开 http://localhost:5173 — 页面会自己连本机 grok。左侧是会话列表（点开 / 新建）；连接与 Secret 在左下「设置」弹窗。

`npm run dev` 做的事：

1. 若 `127.0.0.1:2419` 空闲，启动 **PATH 上已安装的 `grok`**（不是本仓库 cargo 产物），工作目录是 `$HOME`，会话来自 `~/.grok/sessions/`
2. 侧栏 `x.ai/session/list` **不带 cwd**，列出本机全部会话，不限本仓库
3. 起 Vite，把 `/ws` 代理到 serve（带 `server-key`）
4. Ctrl+C 停 Vite；若这次是它拉起的 Agent，一并停掉

覆盖：`GROK_BIN`、`GROK_AGENT_CWD`（默认家目录）、`GROK_AGENT_BIND`（默认 `127.0.0.1:2419`）、`GROK_AGENT_SECRET`。

只起前端、自己管 Agent：`npm run dev:vite`。

## 验收

- 错误 secret / 进程未起：全页 doctor 文案（401 / 进程未起）。e2e 用 `?noconnect=1` 再填高级连接。
- 连上后 Welcome 或登录；未登录不能发送
- 对话能流式出来
- 同一 `session id` 可在 TUI 里 `/resume`
- 关掉标签再连（同一 secret），若 Agent 还在，会 `session/load`
- 两个浏览器标签同时连：后连的抢走流（serve 单连接限制）

## 鉴权与 Welcome

连接后第一条 ACP 一定是 `initialize`。有 cached 方法则 eager `authenticate`，直接进 Welcome（产品名、cwd、`grok-web` + agent version）。否则出登录页：按钮文案来自 `AuthMethod.name`，API key 粘贴走 `x.ai/setApiKey`（不写 localStorage），浏览器登录走 `x.ai/auth/get_url` + `window.open` + 贴 code。

「切换账号」回登录页并保持 WebSocket；「退出登录」还会调 `x.ai/auth/logout`。未登录或文件夹信任未确认时，composer 发送禁用（trust 不自动 YOLO）。

## Playwright 真人操作

起好 `npm run dev` 之后：

```bash
npm test          # protocol + startup 决策 helper 单元测试
npm run drive     # Chromium 点选：doctor、Welcome/登录、logout 等价、重连、占用、pong
npm run test:e2e  # slice0 + startup spec
```

`GROK_WEB_HEADED=0` 无头。截图在 `e2e/artifacts/`。

## 下一步（P0）

权限卡、提问卡、cancel、Markdown/diff、slash。见 `docs/tui-web-catalog/`。
