# 16 子 Agent、后台任务、Monitor、Loop、Goal、Workflow

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| X-01 | 子 agent 生成 | `SubagentSpawned` 在 parent 通道，先于 child prompt | 父时间线一行 + 可展开 | 部分：父时间线一行（类型徽章 + 描述） |
| X-02 | 子 agent 进度 | `SubagentProgress` ~2s：turns、tools、tokens、errors | 进度条 | 部分：同一 childSessionId 就地写 activity |
| X-03 | 子 agent 结束 | `SubagentFinished` completed/failed/cancelled + output | 结果折叠 | 是：三角展开 Finished 输出只读。本轮浏览器环境无子代理行，展开未测。 |
| X-04 | 点进子会话 | 映射 child_session_id | 抽屉 load 子 session（只读或可跟） | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-05 | 取消子 agent | `x.ai/subagent/cancel`；取消面板选项 | 按钮 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-06 | capability_mode | read-only 等 | 徽章 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-07 | persona/role/model 覆盖 | Spawned 字段 | 副文案 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-08 | workflow_run_id 挂接 | | 链到 workflow 行 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-09 | resumed_from | 恢复子 agent | 标注 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-10 | 分组进 tool verbs | 子 agent 行可折进组 | 同 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-11 | 后台 bash 任务 | `TaskBackgrounded` + tasks pane | 列表：命令、cwd、log | 是：听 `x.ai/task_backgrounded` + `x.ai/task/list`；顶栏右上角芯片；`/tasks` / Ctrl+G 列表。不做 TUI 自动弹出 overlay |
| X-12 | 任务完成 | `x.ai/task_completed` / `TaskCompleted` | 通知+行状态 | 是：完成后面板/芯片更新 |
| X-13 | 杀任务 | `x.ai/task/kill` | 按钮 | 是：列表「停止」 |
| X-14 | 跟日志 | output_file tail；`task_output` 工具 | `<pre>` 轮询或通知流 | 是：顶栏右上角芯片点开详情，读 snapshot / `output_file`；运行中每秒刷新。不做独立 event stream |
| X-15 | Ctrl+B 转后台 | 前台 execute → background | 按钮 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-16 | Monitor | 描述字段；`MonitorEvent` 行 | 「Monitor」标签 + 事件流 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-17 | Monitor 使 Dashboard Working | D-04 | 同 | 是：后台任务仍记 `backgroundIds`，Dashboard 保持「进行中」 |
| X-18 | `/loop` 调度 | interval ≥60s；7 天过期；`ScheduledTaskCreated/Fired/Deleted` | 表单 + 列表 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-19 | 调度 fire 当 prompt | `is_scheduler_fired_prompt` | 时间线标「定时」 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-20 | scheduler_delete | 工具/命令 | 取消按钮 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-21 | `/goal` | set/status/pause/resume/clear；token budget | 页 + `GoalUpdated` | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-22 | Goal 验证 | 独立 evidence review | 状态：active/paused/gaps | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-23 | `/deep-research` | 立刻返回 | toast + workflows | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-24 | `/workflow` launch | `.grok/workflows/*.rhai` + 用户目录；args JSON | picker + JSON 编辑 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-25 | workflow pause/resume/stop/save | 显示名非内部 id | 详情键 p/r/x/s | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-26 | budget 限制 resume | 不能裸 resume；要更高 agent_budget | 错误文案原样展示 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-27 | `/workflows` 面板 | 运行中+保留；非定义目录 | 表：phase、roster、progress | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-28 | WorkflowUpdated | 全量快照 revision | 按 revision 丢旧 | 部分：同 runId 阶段条。**备注：pause/stop 见上。** |
| X-29 | 并行 cap | 默认同时 32 子；逻辑预算 128 | 展示 remaining | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-30 | foreground workflow | 字段 | 阻塞 UI vs 后台 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-31 | `x.ai/workflows/list` | 拉列表 | 打开面板时调 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-32 | watching 状态 | 有后台时 turn 完仍 watching | 状态行 | 是：不画 TUI watching 底栏；顶栏任务芯片在 turn 结束后仍在 |
| X-33 | 取消 turn 留子 agent | B-13 选项 | 同 | 是：取消面板可留子 agent |
| X-34 | 子 agent 类型 explore/plan/general | | 图标 | 部分：类型徽章文字 |
| X-35 | worktree 隔离子 agent | Agent 侧 | 徽章「wt」 | Agent 已有 |
| X-36 | `will_wake` 字段 | TUI 不再消费；保留兼容 | 可忽略或「将自动继续」 | 否。**备注：子 agent/任务/工作流面板 待讨论后再做。** |
| X-37 | `/tasks` | 打开任务面板 | 路由 | 是：`/tasks` / 侧栏芯片 / Ctrl+G（会话页）；运行中命令可停；子代理仍只读 |
| X-38 | 任务排队 coordinator | 内部 | 只展示队列长度若有 | Agent 已有 |
