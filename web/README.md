# Grok Web

本机浏览器客户端，经 ACP WebSocket 连 `grok agent serve`。和 TUI 共用同一个 `MvpAgent` 与 `~/.grok/sessions/`。

当前：运输层（Slice 0）+ 启动/鉴权/Welcome（catalog 02）。权限卡、slash、主题仍未做。

## 启动

终端 A — Agent（必须 `--always-approve`，否则工具会卡在权限请求；Slice 0 会把权限取消掉）：

```bash
grok agent --always-approve --no-leader serve --bind 127.0.0.1:2419 --secret slice0dev
```

stderr 会打印：

```
WebSocket URL: ws://127.0.0.1:2419/ws?server-key=slice0dev
```

终端 B — 前端：

```bash
cd web
npm install
npm run dev
```

打开 http://localhost:5173

- WebSocket 默认 `ws://127.0.0.1:2419/ws`
- Secret 填 `slice0dev`（只存在 localStorage，不进 git）
- cwd 默认本仓库路径

点「连接」，输入一句话发送。

## 验收

- 错误 secret / 进程未起：全页 doctor 文案（401 / 进程未起）
- 连上后 Welcome 或登录；未登录不能发送
- 对话能流式出来
- 同一 `session id` 可在 TUI 里 `/resume`
- 关掉标签再连（同一 secret），若 Agent 还在，会 `session/load`
- 两个浏览器标签同时连：后连的抢走流（serve 单连接限制）

## 鉴权与 Welcome

连接后第一条 ACP 一定是 `initialize`。有 cached 方法则 eager `authenticate`，直接进 Welcome（产品名、cwd、`grok-web` + agent version）。否则出登录页：按钮文案来自 `AuthMethod.name`，API key 粘贴走 `x.ai/setApiKey`（不写 localStorage），浏览器登录走 `x.ai/auth/get_url` + `window.open` + 贴 code。

「切换账号」回登录页并保持 WebSocket；「退出登录」还会调 `x.ai/auth/logout`。未登录或文件夹信任未确认时，composer 发送禁用（trust 不自动 YOLO）。

## Playwright 真人操作

起好 serve 和 `npm run dev` 之后：

```bash
npm test          # protocol + startup 决策 helper 单元测试
npm run drive     # Chromium 点选：doctor、Welcome/登录、logout 等价、重连、占用、pong
npm run test:e2e  # slice0 + startup spec
```

`GROK_WEB_HEADED=0` 无头。截图在 `e2e/artifacts/`。

## 下一步（P0）

权限卡、提问卡、cancel、Markdown/diff、slash。见 `docs/tui-web-catalog/`。
