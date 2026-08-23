# 09 Agent Dashboard

TUI Dashboard = **本 pager 进程**里的顶层 session 花名册（含 fork），不含子 agent。  
Web 不要抄「进程 roster」：serve 单连接。Web Dashboard = **磁盘 session 列表 + 当前 Agent 上的多 session**（`session/new` 多个 id，或 `x.ai/sessions/list`）。

进全页（D-16）：已实现。`#/dashboard` 选中行 Enter，或预览「打开会话」，进 `#/s/<id>` 全页。Esc / 「回列表」回 dashboard。

关：`GROK_AGENT_DASHBOARD=0`、`[dashboard].enabled=false`、Minimal 隐藏。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| D-01 | 打开 | `grok dashboard`、`/dashboard`、`Ctrl+\` | 路由 `/dashboard` | 是 |
| D-02 | 分组排序 | 默认状态：Needs input → Working → Idle → Inactive → Completed → Failed。`Ctrl+G` 切 cwd | 表头排序 | 是 |
| D-03 | 状态图标 | Working 动画 `⋅:/⸬/⁙`；Needs/Done/Fail/Blocked `●` 色；Idle/Inactive `○` | SVG/CSS 点 | 是 |
| D-04 | Working 含后台 | 有 monitor/loop/bg 即使 turn 完仍 Working，活动行写明 | 同语义（听 task/loop 通知） | 是 |
| D-05 | Inactive 折叠 | 其他 pager 的 roster 会话，默认折，`→`/点击展开 | Web 无「别的 pager」；可列出 serve 未 load 的磁盘会话为 Inactive | 是 |
| D-06 | Idle 折叠多余 | 只显示最近 8 条 + 1h 内活跃；其余「N more」 | 分页 | 是 |
| D-07 | 无组头 | 靠排序+颜色 | 可用 sticky 组头，更好 | 是 |
| D-08 | Peek | 选中行打开 peek 尾部对话 | 分栏预览 | 是 |
| D-09 | Peek 回复 | 输入发送/入队；Ctrl+S 发送并 attach | 同 | 是 |
| D-10 | Dispatch 新 agent | 底栏 prompt 与 agent chrome 相同 | 「新会话」输入 | 是 |
| D-11 | 搜索模式 | `Ctrl+/` 前缀变 Search 即时过滤 | 搜索框 | 是 |
| D-12 | 重命名 | `Ctrl+R` | 行内 | 是 |
| D-13 | 置顶 | `Ctrl+T`；Shift+↑↓ 调序 | 同 | 是 |
| D-14 | 停/删 | `Ctrl+X`：运行中取消 turn；否则 2s 内再按永久删。hover `[✗]` | 两按钮分开更清晰 | 是 |
| D-15 | YOLO per row | `Ctrl+O` 对选中 agent | 行菜单 | 是 |
| D-16 | 详情全宽 | Enter 空回复打开；顶栏 name `{i}/{n}` `[Dashboard]`；无边框 modal | 全页 conversation，选中 Enter 与预览打开进 `#/s/id` | 是 |
| D-17 | 详情里 Ctrl+X | 运行=取消；否则武装关会话 | 同 | 否 |
| D-18 | 详情 Esc | 只回 Dashboard；`/exit` 才关 session（toast Session closed） | 路由返回 | 是 |
| D-19 | 循环 agent | `[‹]` `[›]` | 快捷键 | 否 |
| D-20 | Esc 阶梯 | 搜→关 peek→清过滤→失焦 dispatch→取消选中→退出。不擦 dispatch 草稿 | 同 | 否 |
| D-21 | 分组折叠记忆 | 打开期间记；Inactive 每次启动默认折 | localStorage | 是 |
| D-22 | 点击 Inactive 标题 | 展开/折 | 同 | 是 |
| D-23 | 帮助 | `Ctrl+.` / `?` | 同 | 是 |
| D-24 | Peek 权限/提问 | 嵌 B- 卡；1-9 | 同组件 | 否 |
| D-25 | 禁用 | env/config/Minimal | Web 可始终有列表页 | 是 |
| D-26 | LastTurnSummary 副行 | 通知填活动说明 | 列表 subtitle | 是 |
| D-27 | FetchDashboardSessions / FetchRoster | ACP 拉列表 | `x.ai/sessions/list` + changed | 是 |
| D-28 | 与 `/config-agents` 区别 | 文档强调不是定义管理 | 导航文案分开「运行中」vs「Agent 定义」 | 是 |
