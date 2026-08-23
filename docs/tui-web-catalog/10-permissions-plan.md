# 10 权限、Plan、安全

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| P-01 | Ask 模式 | 默认。每工具可问。 | 默认。B-01 必做。 | 是（B-01 权限卡） |
| P-02 | Auto 模式 | LLM classifier；危险仍问或拒。`/auto`、设置。feature 关则无命令。 | `_meta.autoMode` session/new；Shift+Tab 循环 | 否 |
| P-03 | Always-approve / YOLO | `/always-approve`、Ctrl+O、Shift+Tab。跳过全部提示。deny 规则和 hooks 仍可拦。 | 明确危险徽章 | 是：顶栏 YOLO 危险徽章 + 分段 YOLO |
| P-04 | Default 权限模式 | 设置 `permission_mode` default/ask/auto/always-approve。磁盘 default 现等于 ask。 | 设置页 | 否 |
| P-05 | Shift+Tab 循环 | Prompt 焦点：Normal → Plan → Always-approve | 分段控件 | 是：普通 → Plan → YOLO |
| P-06 | Plan mode | `/plan`、设置 `plan_mode`（pager 每会话，不写 toml）。Ask 模式只经 Shift+Tab 到 plan，设置里不暴露 Ask。 | `session/set_mode` | 是 |
| P-07 | Plan 芯片 | `show_plan_chip`：退出 plan 后是否仍显示 | 顶栏 chip | 是 |
| P-08 | `--allow` / `--deny` glob | CLI 规则。leader 不支持 per-client。 | Web 经 config.toml 或扩展；不要在浏览器造规则 DSL 除非有 UI | 否 |
| P-09 | `.claude/settings.json` defaultMode | deny-by-default 兼容 | Agent 读；Web 无特殊 | Agent 已有 |
| P-10 | Sandbox profile | `--sandbox`；非 off 否决 leader | 设置展示当前 profile；改了可能要新 session | 否 |
| P-11 | YOLO 种子 | `ConnectFlags.default_yolo_mode` 进每个新 session | serve 启动带 `--always-approve` 则全跳过——本地 Web 调试才用 | 运输层已有 |
| P-12 | 权限规则 CLI 不进 leader | 文档/代码警告 | Web+leader 时规则在 leader 启动定 | 否 |
| P-13 | Folder trust | A-11 | 同 | 否 |
| P-14 | Hooks project trust | 与 folder trust 分开。模态不授权 trust | 单独确认 | 否 |
| P-15 | 编码数据共享 | `/privacy`；auth metadata 非 toml；ZDR/admin | 同 | 否 |
| P-16 | Telemetry 开关 | `[features] telemetry` 与 privacy 独立 | 设置；不要和 P-15 混 | 否 |
| P-17 | 外部 OTEL | `GROK_EXTERNAL_OTEL` 双 opt-in | 企业功能；Web 只展示状态 | 否 |
| P-18 | Hunk tracker | agent_only / all_dirty / off；关则无 LOC。initialize 能力。restart | 设置 | 否 |
| P-19 | 浏览器验证 prompt | agent `browser_verification` 模板 | 若工具打开本机浏览器，Web 显示「已在系统浏览器打开」 | 否 |
| P-20 | 权限审计 | telemetry permission events | 不做 UI 也可 | Agent 已有 |
| P-21 | Always 记忆 per project | remember_tool_approvals | 项目级；换仓要再批 | 否 |
| P-22 | 进入/退出 plan 工具 | `enter_plan_mode` / `exit_plan_mode` | 听工具调用 + 审批卡 | 是：enter + exit 审批卡 |
