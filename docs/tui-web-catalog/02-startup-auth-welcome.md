# 02 启动、鉴权、Welcome

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| A-01 | 启动阶段探测 | `StartupTimer` 阶段：LoadConfig、ManagedPolicy、SpawnWorker、AcpInitialize、EagerAuth。失败有 `startup_failure` 全屏。 | 连 WS 前显示「正在连接本机 grok…」。initialize/auth 失败用页面错误，带 `/doctor` 等价信息（进程未起、secret 错、401）。 | 是 |
| A-02 | 配置加载 | `load_effective_config`：CLI > env > `~/.grok/config.toml` > managed/requirements > 默认。 | Web 不读 toml。设置经 ACP/`x.ai/settings` 或让用户继续改文件。展示值从 initialize / session 通知来。 | Agent 已有 |
| A-03 | Managed policy 同步 | connect 前 `ensure_managed_policy_present`。失败不挡启动。 | 无 UI。Agent 在 serve 进程里自己做。 | Agent 已有 |
| A-04 | initialize | `InitializeRequest` V1 + capabilities + meta（clientType、rules、systemPromptOverride、hunkTracker、statusLine…）。响应：`grokShell`、`modelState`、`availableCommands`、`authMethods`、`cancelRewind`、`sessionRecap`、`defaultAuthMethodId`。 | 连接后第一条必须是 initialize。缓存 `availableCommands` 做 slash 菜单。 | 是 |
| A-05 | 鉴权方法列表 | `AuthMethod`：grok.com OAuth/设备码、API key、external provider。`AuthStartMode::Command` 表示会开浏览器。 | 登录页：若 `external_provider` 显示「即将打开浏览器」；否则 token/API key 粘贴。走 ACP `authenticate` + `x.ai/auth/get_url` / `submit_code`。 | 是 |
| A-06 | Eager auth | 已有 `auth.json` 则启动时静默 `authenticate`，拿 `team_name` 等 meta。失败则 `needs_login`。 | 同样：initialize 后若有 cached 方法先 authenticate；401/需交互再出登录页。 | 是 |
| A-07 | `/login` `/logout` | 会话内重登；logout 回登录屏。 | 登录页 + 设置里退出。logout 后清前端 session 视图，WS 可保持，再 authenticate。 | 是 |
| A-08 | 设备码 / 浏览器登录 | Welcome 可出按钮；Command 模式自动开浏览器。 | `window.open` 授权 URL；轮询或用户贴 code。不要在 Web 里嵌无第三方 cookie 的完整 OAuth 除非用同样 ACP 扩展。 | 部分：已发 `_x.ai/auth/get_url` 并可取消；未走完 IdP 贴码 |
| A-09 | API key 登录 | 粘贴 `xai-...`。 | 密码框 + authenticate params。不要存到 localStorage 明文；本机 Web 让 Agent 写 `~/.grok/auth.json`。 | 是 |
| A-10 | 订阅 / 付费墙 | `CheckSubscription`、`OpenSupergrokUrl`、credit limit 块、`SchedulePaywallCheck`。滚动区 `CreditLimitBlock`。 | 额度用尽画卡片 + 链到 grok.com。听 session 通知/usage 扩展。 | 部分：已调 `_x.ai/auth/check_subscription`；本次无额度用尽卡 |
| A-11 | 文件夹信任 | 首次在某 cwd 跑会问 trust。`TrustState`。hooks 另有 project trust。 | 本机 Web 的 cwd 由 `session/new` 传入。若 Agent 回信任请求，做确认对话框。不要默认 YOLO。 | 部分：对话框已接、默认 reject；本次无 `folder_trust/request` |
| A-12 | Consent / 隐私横幅 | Welcome `consent.rs`；`/privacy` 打开 coding data 选择。ZDR/admin 托管时行不可改。 | 首次显示同意；设置里 Opt in/out。调 `x.ai` privacy 扩展（TUI `/privacy`）。 | 是 |
| A-13 | Welcome 布局 | 顶栏 repo:branch + 版本；居中 logo（shimmer）；菜单；底部 prompt。边距保留。 | 落地页：产品名、cwd、最近 session 列表、主输入。Logo 可用 SVG，不必 ASCII。 | 部分：有产品名/cwd/版本/主输入；最近 session 是「继续上次」不是列表 |
| A-14 | Welcome 菜单项 | Resume（Ctrl+S）、New worktree（Ctrl+W，仅 git 仓库）、Import Claude（Ctrl+I）、Dismiss import（Ctrl+Shift+I）、Quit。 | 按钮：继续上次、新会话、新 worktree、导入 Claude。退出 = 关 WS 或关应用。 | 是 |
| A-15 | Welcome 直接打字 | 已登录且已信任时，启动 type-ahead 会进 composer。未登录时丢掉，避免误答登录框。 | 落地页输入框即 composer。未登录禁用发送。 | 是 |
| A-16 | Startup warnings | 配置/主题/doctor 类警告画在 Welcome。 | toast 或横幅。 | 部分：横幅已接；本次 initialize 未带 startupWarnings |
| A-17 | 版本徽章 | Welcome 顶栏右侧 version。 | 页脚显示 `grok-web` + agent version（initialize meta）。 | 是 |
| A-18 | 本地 workspace ACK | feature `local-workspace`：Welcome 确认后再写 ack、开 session。 | 若 initialize/session meta 带 `x.ai/local_workspace`，出说明+确认。 | 部分：ACK 卡已接；本次 meta 无 local_workspace |
| A-19 | Claude 导入入口 | 检测到 `~/.claude` 时 Welcome 一行。hash 已 seen 则藏。内容变了再出现。 | 同等探测由 Agent/扩展做；Web 听通知或 Welcome 拉状态。模态见 U-ImportClaude。 | 部分：随 `availableCommands` 含 import-claude 显示；未点导入确认 |
| A-20 | 认证中子屏 | Authenticating 显示 provider 名 + quit 键（VS Code 家族 Ctrl+D，否则 Ctrl+Q）。 | spinner + 取消回到登录。 | 是 |
| A-21 | `x.ai/auth/check_subscription` | 登录后/周期检查 SuperGrok。 | 登录成功后调一次，画计划徽章。 | 是 |
| A-22 | Switch account | `Effect::SwitchAccount`：OAuth 或指定 method。 | 设置 → 切换账号 → authenticate 另一 method。 | 是 |
| A-23 | 登录按钮文案 | `login_label` 来自 `AuthMethod.name`（grok.com / 企业名）。 | 按钮用同一 name，不要写死「Login」。 | 是 |
| A-24 | Tips of the day | `[ui] show_tips`，启动横幅。restart 才生效。 | 可选；localStorage 已看过。非 P0。 | 否（不做） |
| A-25 | 更新检查 | `[cli] auto_update`；TUI 可 `QuitForUpdate` 重 exec。 | Web 不管二进制更新。可提示「本机 grok 有新版本」若有 ACP 通知。 | 否（不做） |
| A-26 | 启动 type-ahead 过滤 | 丢掉 mouse/focus/DA2/OSC 泄漏；Esc 截断批次。 | Web 无此问题。 | 否（N/A） |
