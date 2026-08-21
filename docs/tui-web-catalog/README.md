# TUI ↔ Web 功能对照目录

基准代码：本仓库 `main`（同步上游 `19d42e3` / `SOURCE_REV` 见仓库根）。  
范围：Grok Build **全屏 TUI + Minimal + `grok agent serve` 运输层**。不含 `grok -p` headless 脚本输出（那是另一套客户端）。

本目录把 TUI 现有能力拆成可勾选的功能点，共 **863** 行（见 [INDEX.md](INDEX.md)）。每一行都有：

| 列 | 含义 |
|---|---|
| **ID** | 稳定编号，跨文件唯一。`W-` 运输、`A-` 启动鉴权、`S-` 会话、`C-` 对话区、`I-` 输入、`B-` 阻塞卡、`/` 斜杠命令、`U-` 画面/面板、`D-` Dashboard、`P-` 权限/Plan、`T-` 工具块、`V-` 外观、`K-` 键鼠、`G-` 设置项、`E-` 扩展、`X-` 子 agent/任务/工作流、`M-` 媒体语音通知、`R-` 终端诊断、`Q-` ACP 线、`H-` 底栏状态、`Z-` 配置/沙箱/记忆 |
| **功能点** | 短名 |
| **TUI** | 现在怎么做（入口、行为、关键细节） |
| **Web 怎么做** | 建议实现（协议方法、前端组件、不要做的事） |
| **Web 已实现** | 本仓库 **没有 Web UI**。取值：`否` / `运输层已有`（`grok agent serve` 或 ACP 方法已存在，前端未做） |

## 怎么读

1. Web 第一期只盯 **P0**：`README` 下面这张优先级表，加上各文件里标了 P0 的行。
2. Agent 行为已经和 TUI 共用 `MvpAgent`。缺的是浏览器客户端，不是再写一套 Agent。
3. **像素级还原 TUI 不是目标。** 单元格栅格、Kitty 图形、终端改键特例不要 1:1。语义对齐（同一 session、同一权限卡、同一工具结果）才是 1:1。

## 架构对照（所有功能都落在这四层）

```
浏览器 DOM / React          ← 本目录「Web 怎么做」要写的层
ACP JSON-RPC over WebSocket ← grok agent serve（已有）
MvpAgent                    ← 不要重写
~/.grok/sessions 等磁盘     ← 与 TUI 共用
```

TUI 默认是同进程 typed ACP（`acp_channels`），不是 stdio。Web 换成 WS 文本帧，**方法名不变**。

硬限制（做 Web 前必须知道）：

- `serve` 的 `relay_dest` **同时只服务一条 WebSocket**。后连上的抢走通知。两个标签会串流。
- `serve` 默认 `127.0.0.1:2419`，鉴权 `Authorization: Bearer` 或 `?server-key=`（浏览器用 query）。
- 没有静态资源托管、没有 Origin 校验。前端自己起（Vite），连 loopback。
- 不要绑 `0.0.0.0`。Agent = 带工具的本机用户。

## 文件索引

| 文件 | 内容 |
|---|---|
| [INDEX.md](INDEX.md) | 计数、P0 勾选、状态约定 |
| [01-transport-runtime.md](01-transport-runtime.md) | 进程模型、serve、leader、重连、clientType |
| [02-startup-auth-welcome.md](02-startup-auth-welcome.md) | 启动、登录、信任、Welcome、付费墙 |
| [03-sessions.md](03-sessions.md) | 新建/恢复/fork/rewind/删除/标题/worktree |
| [04-conversation.md](04-conversation.md) | 滚动区、折叠、查找、块类型、Markdown/Mermaid |
| [05-composer.md](05-composer.md) | 输入框、队列、历史、@、slash 菜单、粘贴 |
| [06-blocking-cards.md](06-blocking-cards.md) | 权限卡、提问卡、取消 turn、plan 审批 |
| [07-slash-commands.md](07-slash-commands.md) | 全部 slash（pager 本地 + shell ACP） |
| [08-screens-modals-panes.md](08-screens-modals-panes.md) | 设置、palette、picker、侧栏、全屏查看器 |
| [09-dashboard.md](09-dashboard.md) | Agent Dashboard |
| [10-permissions-plan.md](10-permissions-plan.md) | 权限模式、YOLO、auto、plan、sandbox |
| [11-tools-blocks.md](11-tools-blocks.md) | 每种工具在滚动区怎么画 |
| [12-appearance.md](12-appearance.md) | 主题、compact、pager.toml、Minimal |
| [13-keyboard-mouse.md](13-keyboard-mouse.md) | 快捷键、鼠标、选区、Esc 阶梯 |
| [14-settings.md](14-settings.md) | `/settings` 每一项 |
| [15-extensions.md](15-extensions.md) | MCP / skills / hooks / plugins / marketplace |
| [16-subagents-tasks-workflows.md](16-subagents-tasks-workflows.md) | 子 agent、后台任务、monitor、loop、goal、workflow |
| [17-media-voice-notify.md](17-media-voice-notify.md) | 图/视频、语音、桌面通知、窗口标题 |
| [18-terminal-doctor.md](18-terminal-doctor.md) | doctor、tmux、剪贴板、终端探测（Web 多数 N/A） |
| [19-acp-wire.md](19-acp-wire.md) | ACP 标准方法 + `x.ai/*` 扩展（给实现对照） |
| [20-status-chrome.md](20-status-chrome.md) | 底栏、status line、credit/context bar、tips |
| [21-config-sandbox-memory.md](21-config-sandbox-memory.md) | config 层、记忆、规则、模型目录 |

## 建议分期（Web）

| 期 | 范围 | 对应 ID 前缀 |
|---|---|---|
| **P0** | WS 连接、initialize、session new/load、prompt 流、权限卡、提问卡、cancel、重连 | W, A 登录, S 基本, C 文本/工具, B, Q 标准方法 |
| **P1** | slash、@、队列、resume 列表、rewind、模型切换、plan、Markdown/diff | I, /, U picker, P plan, T |
| **P2** | Dashboard 语义（磁盘 session 列表，不要抄 pager 进程 roster）、workflows、tasks、MCP 模态、设置页 | D, X, E, G |
| **P3** | 主题 CSS、语音、通知、status line、高级外观 | V, M, H |
| **不做 1:1** | xterm 嵌 TUI、vim 全键位、Kitty 图形、gboom、终端改键矩阵、tmux doctor fix | R, K 特例, /gboom |

## Web 已实现列怎么填

当前全部前端为 **否**。实现某行后改成 `是` 或 `部分（说明缺口）`。运输相关行已标 `运输层已有`。
