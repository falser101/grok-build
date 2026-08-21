# 01 运输与进程模型

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| W-01 | 默认同进程 Agent | `spawn_grok_shell`：`acp_channels()` 内存 mpsc，worker 线程名 `acp-agent-worker`，`impl acp::Agent for MvpAgent`。RPC 经 `Rc` 直达，不经 JSON。 | 不要同进程嵌进浏览器。浏览器连本机 `grok agent serve`。 | 否（不做） |
| W-02 | `grok agent serve` WebSocket | 子命令 `Serve`：默认 `127.0.0.1:2419`，`--secret` / `GROK_AGENT_SECRET`，省略则生成 12 位。Axum upgrade。实现：`xai-grok-shell/src/agent/server.rs`。路径是 **`/ws`**。 | 启动：`grok agent --always-approve --no-leader serve --bind 127.0.0.1:2419 --secret $TOKEN`。前端 `ws://127.0.0.1:2419/ws?server-key=`。见仓库 `web/`。 | 是 |
| W-03 | WS 鉴权 | Header `Authorization: Bearer <secret>`，或 query `server-key`（注释写明给浏览器）。失败 401。无 Origin/CORS 检查。 | 浏览器用 query `server-key`。错误 secret 显示「连接失败」。勿把 secret 打进 git。 | 是 |
| W-04 | JSON-RPC 文本帧 | serve 把每条 WS Text/Binary 当一行 JSON（去 CR/LF）。文本 `"ping"` 或空行丢弃。写出也是 Text 帧。15s WebSocket Ping。 | 每条 JSON-RPC 一帧。客户端每 15s 发文本 `"ping"`（`PING_INTERVAL_MS`）。 | 是 |
| W-05 | 常驻 Agent、断线保活 | `MvpAgent` 在 `agent-persistent` 线程创建一次。WS 断了 session actor 还在。重连把 `relay_dest` 指到新连接，进行中的 turn 继续流。 | 意外断线：指数退避 → `initialize` → `authenticate` → `session/load`，`_meta` 带 `cursor`（上次 eventId）+ `yoloMode`/`autoMode`。 | 是 |
| W-06 | 单连接 fan-in | `relay_dest: Option<Sender>`，**后连上的覆盖前一条**。无连接时 outbound 丢弃。 | 同 origin 第二标签 `BroadcastChannel` 通知第一标签「已被占用」，不自动互抢重连。shell 仍单播。 | 是 |
| W-07 | `grok agent stdio` | JSON-RPC stdin/stdout。IDE/Zed/桌面。 | 浏览器不能 spawn。桌面壳以后可走 stdio。Web 用 serve。 | 否（不做） |
| W-08 | Leader Unix socket | `~/.grok/leader.sock`，多客户端共享一个 Agent。 | 本机 Web 不接 leader。 | 否（不做） |
| W-09 | `grok agent headless --grok-ws-url` | Agent **出站**连 grok.com 中继。 | 远程 Web / P3。不要把 serve 暴露公网。 | 否（不做） |
| W-10 | `clientType` / `clientVersion` | TUI `initialize.meta.clientType = grok-pager`。 | `_meta.clientType = grok_web`，`clientIdentifier = grok-web`，`clientVersion` 随 `web/`。 | 是 |
| W-11 | `clientCapabilities` | TUI：`fs.read/write`、`terminal`、statusLine 等。 | 本机 Web **不**宣称 `fs.readTextFile` / `fs.writeTextFile` / `terminal: true`。 | 是 |
| W-12 | `--no-leader` / sandbox 否决 leader | CLI/config。 | serve 自带 Agent。Web 不处理此 flag。 | 否（N/A） |
| W-13 | Agent 线程退出 join | `AgentShutdownGuard`。 | 用户点「断开」：若 turn 进行中先 `session/cancel`，再关 WS。serve 进程由本机管。 | 是 |
| W-14 | 8MiB 行缓冲 | serve simplex 8MiB；ACP 读行上限 64MiB。 | 前端不改 buffer；Slice 0 只发短文本。大图以后用 content block。 | 运输层已有 |
| W-15 | 静态站点托管 | serve **只** WS，不 serve HTML。 | Vite/静态服务器另起（`web/` `npm run dev`）。不把 HTML 塞进 serve。 | 否（不做） |
| W-16 | `--remote` proxy serve | `ServeArgs.remote` 代理远端 agent。 | 不实现。 | 否（不做） |
