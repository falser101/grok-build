# 19 ACP 线协议清单（实现对照）

Web 客户端按方法接。TUI 已全部使用或可使用。标准方法见 [ACP](https://agentclientprotocol.com)。

## 标准 ACP

| ID | 方法 | 方向 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|---|
| Q-01 | `initialize` | C→A | W-11 A-04 | 第一条 | 否 |
| Q-02 | `authenticate` | C→A | A-05 | 登录 | 否 |
| Q-03 | `session/new` | C→A | S-01 | | 否 |
| Q-04 | `session/load` | C→A | S-03 重连 | `_meta.cursor` yolo/auto | 否 |
| Q-05 | `session/prompt` | C→A | I-01 | content blocks 含 text/image；`[Image #N]` + displayNumber `_meta`；请求 `_meta.promptId`/`sendNow`/`screenMode` | 是 |
| Q-06 | `session/cancel` | C→A | B-13 | Stop | 否 |
| Q-07 | `session/set_mode` | C→A | plan | P-06 | 否 |
| Q-08 | `session/setModel`? / 模型扩展 | C→A | `/model` | 以 initialize 与实测为准 | 否 |
| Q-09 | `session/update` notif | A→C | 流 | 分发 C-/T- | 否 |
| Q-10 | `session/request_permission` | A→C 请求 | B-01 | **必须回 response** | 是 |
| Q-11 | `session/close` | C→A | 退出 | | 否 |
| Q-12 | fs/readTextFile 反向 | A→C | 若能力开 | 本机 Web 不要宣称 | 否（N/A） |
| Q-13 | fs/writeTextFile 反向 | A→C | 若能力开 | 不要宣称 | 否（N/A） |
| Q-14 | terminal 反向 | A→C | flags.terminal | 不要宣称 | 否（N/A） |
| Q-15 | AvailableCommandsUpdate | A→C | slash 刷新 | /K-03 | 否 |

`session/update.sessionUpdate` 标准值：`agent_message_chunk`、`agent_thought_chunk`、`tool_call`、`tool_call_update`、`plan`、`current_mode_update` 等。

## x.ai 扩展（请求 C→A）

| ID | 方法 | TUI 用途 | Web | Web 已实现 |
|---|---|---|---|---|
| Q-20 | `x.ai/ask_user_question` | **反向** B-10 | 必须实现 handler | 是 |
| Q-21 | `x.ai/exit_plan_mode` | **反向** B-15 | 必须 | 是 |
| Q-22 | `x.ai/session/fork` | S-12 | | 否 |
| Q-23 | `x.ai/session/list` | picker/dashboard | | 否 |
| Q-24 | `x.ai/session/info` | /session-info | | 否 |
| Q-25 | `x.ai/session/close` | | | 否 |
| Q-26 | `x.ai/sessions/list` | roster | | 否 |
| Q-27 | `x.ai/session_search` | 搜内容 | | 否 |
| Q-28 | `x.ai/session/resolve_local_for_worktree_resume` | S-18 | | 否 |
| Q-29 | `x.ai/recap` | S-21 | | 否 |
| Q-30 | `x.ai/queue/remove` `reorder` `clear` `edit` `hold` `interject` | I-19 | | 否 |
| Q-31 | `x.ai/interject` | 不取消的插入 | | 否 |
| Q-32 | `x.ai/rewind/*` | S-13 | 按扩展实际子方法 | 否 |
| Q-33 | `x.ai/prompt_history` | I-15 | | 否 |
| Q-34 | `x.ai/compact_conversation` | compact | | 否 |
| Q-35 | `x.ai/fs/list` `exists` `read_file` `write_file` | 文件 UI | @ 搜索后端之一 | 否 |
| Q-36 | `x.ai/search/fuzzy/open` `change` | @ | | 否 |
| Q-37 | `x.ai/search/content` | | | 否 |
| Q-38 | `x.ai/git/status` `stage` `commit` `diffs` `discard` | | 可选 Git 面板 | 否 |
| Q-39 | `x.ai/git/worktree/*` | S-17 | | 否 |
| Q-40 | `x.ai/git/worktree/db/stats` `path` `rebuild` | CLI | 高级 | 否 |
| Q-41 | `x.ai/mcp/*` | E- | | 否 |
| Q-42 | `x.ai/auth/get_url` `submit_code` `check_subscription` | A- | | 否 |
| Q-43 | `x.ai/feedback` | /feedback | | 否 |
| Q-44 | `x.ai/models/list` | 模型目录 | | 否 |
| Q-45 | `x.ai/marketplace/list` `action` | E-26 | | 否 |
| Q-46 | `x.ai/plugins/notify-updates` | | | 否 |
| Q-47 | `x.ai/subagent/cancel` | X-05 | | 否 |
| Q-48 | `x.ai/task/kill` | X-13 | | 否 |
| Q-49 | `x.ai/workflows/list` | X-31 | | 否 |
| Q-50 | `x.ai/code/status` | 代码状态 | 可选 | 否 |
| Q-51 | `x.ai/debug/agent` | 内部 | 不要对用户暴露 | 否（不做） |
| Q-52 | `x.ai/yolo_mode_changed` | 同步 YOLO | 听或发 | 是 |
| Q-53 | `x.ai/terminal/create` `kill` `output` `wait_for_exit` | 后者拒绝 | 不宣称 terminal | 否 |
| Q-54 | `x.ai/session/repair` | 历史修复 | 高级 | 否 |
| Q-55 | `x.ai/suggest/*` | 补全 | I-12 | 否 |

## x.ai 通知 A→C

| ID | 方法/update | TUI | Web | Web 已实现 |
|---|---|---|---|---|
| Q-60 | `x.ai/session_notification` | 大包 SessionUpdate 见下 | 按 tag 分发 | 否 |
| Q-61 | `x.ai/session/update` | 与标准并行/replay | 同 C-34 | 否 |
| Q-62 | `x.ai/session/prompt_complete` | 回合结束 | 停 spinner、drain 队列 | 否 |
| Q-63 | `x.ai/queue/changed` | 共享队列真源 | I-19 | 否 |
| Q-64 | `x.ai/sessions/changed` | roster | D-27 | 否 |
| Q-65 | `x.ai/search/fuzzy/status` | @ 结果 | I-11 | 否 |
| Q-66 | `x.ai/search/content/status` | | | 否 |
| Q-67 | `x.ai/git/worktree/status` | 进度 | | 否 |
| Q-68 | `x.ai/fs_notify` `fs/index` `fs/index/delta` | 文件树 | @ 缓存 | 否 |
| Q-69 | `x.ai/mcp/server_status` 等 | E- | | 否 |
| Q-70 | `x.ai/task_backgrounded` | X-11 | | 否 |
| Q-71 | `x.ai/task_completed` | X-12 | | 否 |
| Q-72 | `x.ai/monitor_event` | X-16 | | 否 |
| Q-73 | `x.ai/leader/version_mismatch` | 横幅 | toast 升级本机 grok | 否 |
| Q-74 | `x.ai/leader_reconnected` | 重连 | W-05 | 否 |
| Q-75 | `x.ai/models/update` | 目录变 | 刷新下拉 | 否 |
| Q-76 | `x.ai/settings/update` | 远程设置 | 刷新设置页 | 否 |
| Q-77 | `x.ai/log` | 统一日志 | 不要在 UI 刷 | 否 |
| Q-78 | `x.ai/statusLine` 能力 | H- | 可选 | 否 |
| Q-79 | `x.ai/session/interjection` | 插话回声 | I-22 | 否 |

## `sessionUpdate` tag（xAI SessionUpdate）

DiffReview, RetryState, AutoCompact*, MemoryFlush*, MemoryDreamCompleted, MemorySessionSaved, AutoContinueCompleted, FeedbackRequest, RelaySyncStatus, AutoRecovery*, HookAnnotation, HookExecution, HooksChanged, PluginsChanged, PluginUpdatesInstalled, SessionStatus, SessionSummaryGenerated, SessionRecap, SessionRecapUnavailable, LastTurnSummary, TaskCompleted, SubagentSpawned/Progress/Finished, TaskBackgrounded, ScheduledTask*, MonitorEvent, ModelAutoSwitched, ModelChanged, ToolCallDeltaChunk, ImageCompressed, ImageDropped, MemoryFiles, WorkflowUpdated, GoalUpdated, …

每条对应 C-/X-/M-/E- 行，Web 未处理的 tag 应打进「未实现更新」日志，不要丢崩。

## session/new `_meta` 常用

`yoloMode` `autoMode` `rules` `systemPromptOverride` `agentProfile` `x.ai/session.kind` `x.ai/hunkTracker` `x.ai/pluginDirs` `x.ai/mcp/servers` `x.ai/local_workspace` `x.ai/restore_code` `x.ai/runningPromptId`（load 响应）`x.ai/schedulerBackgroundLoops` `x.ai/facetFilters` `x.ai/listScope` `x.ai/titleIsManual` `x.ai/partial`
