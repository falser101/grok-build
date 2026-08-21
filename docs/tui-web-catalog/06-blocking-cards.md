# 06 阻塞卡片（权限 / 提问 / 取消 / Plan 审批）

没有这些，ask 模式的 Web 客户端会卡住。P0。

共用契约（TUI）：Tab/Shift+Tab 只在卡内循环；Esc 先清卡内再「停键盘到滚动区」（卡还在）；快捷键条显示持卡者。多卡同时：权限 > 取消 turn > 提问。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| B-01 | 权限请求 | ACP `session/request_permission`（及 xAI 包装）。选项：Allow once / Always this command / Always all sessions（开 YOLO）/ Reject。默认光标 `default_selected_permission`（默认 always_allow_all_sessions 那一行，不是 index 0）。确认后光标粘上次 kind。 | modal 必做。选项按 payload 渲染，不要写死四行。回 JSON-RPC **response**，否则 Agent 挂起。 | 否 |
| B-02 | Always 范围左右键 | `←/→` 扩/缩 always 记忆范围。bash 可 `e` 手改 pattern。 | 「始终允许」下拉：精确命令 / 模式 / 本 session 全开。可编辑 glob。 | 否 |
| B-03 | 展开完整参数 | `Ctrl+F` 展开/折 tool args。 | 「显示完整命令」toggle。MCP args 有行数/列数截断（pager 常量）。 | 否 |
| B-04 | 权限卡开 YOLO | `Ctrl+O`。 | 按钮「此后全部允许」= `/always-approve`。 | 否 |
| B-05 | 权限卡 Esc | **不**回答、不 dismiss。焦点停到滚动区，Tab 回来。 | Esc 缩小卡但仍 pending；主按钮仍在。不要 Esc = Reject（和 TUI 不同语义，Reject 是显式）。 | 否 |
| B-06 | 权限卡 Ctrl+C | 取消该请求（reject/cancel）。 | 「拒绝」按钮。 | 否 |
| B-07 | No 行打字回 agent | 在 No 行输入消息，Enter 发给 agent。 | 「拒绝并留言」输入框。 | 否 |
| B-08 | `remember_tool_approvals` | 关则没有 Always 本命令。restart 才生效。ask 和 auto 都适用。 | 设置项；选项列表以服务端给的为准。 | 否 |
| B-09 | 数字快捷 | `1–9` 直接选。 | 可做；也要鼠标。 | 否 |
| B-10 | 提问卡 `ask_user_question` | 反向 `x.ai/ask_user_question`。单选/多选/自由文本。多问：`←/→` 上/下题。`1-9 a-f` 直选。`z` 到自由行。Space 多选 toggle。Enter 选并前进，末题提交。`y` 复制。`Shift+X` dismiss（agent 无答案继续）。`Ctrl+F` 全屏。超时可选 `toolset.ask_user_question.timeout_enabled`。 | 步进表单。必须 JSON-RPC 回 `AskUserQuestionExtResponse`（含 Cancelled）。Headless 直接 Cancelled——Web 不要学。 | 否 |
| B-11 | 提问卡 Esc | 先取消本题选择；再停到滚动区。Dashboard overlay 第一题再 Esc 回 Dashboard。 | 多层：清选择 → 最小化卡 → 回列表。 | 否 |
| B-12 | 提问超时 | 设置开则一段时间后工具超时。 | 显示倒计时（若 payload 有）。 | 否 |
| B-13 | 取消 turn 面板 | 运行中 Ctrl+C/Esc（非 vim 全屏）。选项最多 4：停全部 / 留子 agent 等。Esc = 继续跑（关面板）。`1-4`。 | Stop 按钮 → 选项 modal。Esc/点外面 = keep running。 | 否 |
| B-14 | 取消后 grace | ~1s 内再 Esc 不会误开 rewind。 | Stop 后短 debounce。 | 否 |
| B-15 | Plan 审批 | `plan_approval_view`；`x.ai/exit_plan_mode` 反向。用户改计划可 interject。 | 计划 markdown + Approve / 改意见 / 退出 plan。 | 否 |
| B-16 | `/feedback` 无选项面板 | 无答案可走；Enter 发送；Esc 关。 | textarea modal。 | 否 |
| B-17 | 权限通知抑制 | 一批权限只桌面通知一次，队列空清。 | 浏览器 Notification 同样去重。 | 否 |
| B-18 | Auto 模式仍可能提问 | classifier 过不了的仍弹。 | UI 不能假设 auto 无卡。 | 否 |
| B-19 | YOLO 跳过全部 | 包括危险。Shift+Tab 循环含 Always-approve。 | 危险模式徽章。 | 否 |
| B-20 | Dashboard peek 里答题 | peek 显示选项时 `1-9` 答。 | peek 面板内嵌同一卡组件。 | 否 |
| B-21 | 子 agent 权限信息 | 卡上可带 `SubagentInfo`。 | 标明「来自子 agent X」。 | 否 |
| B-22 | MCP 权限 scope | `McpScope` 状态。 | 展示 server/tool 名。 | 否 |
