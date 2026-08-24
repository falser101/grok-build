# 11 工具调用在 UI 上怎么画

ACP：`tool_call` + `tool_call_update` + `ToolCallDeltaChunk`（参数流）。`_meta["x.ai/tool"]` 有 name/kind。Web 按 **kind+name** 分流，未知走通用卡。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| T-01 | 通用工具卡 | `OtherToolCallBlock`：名、pending/running/done/error、折叠详情 | 卡片：图标、状态、耗时 | 是：状态 + 结束耗时 |
| T-02 | 参数流式 | `ToolCallDeltaChunk` 合并同一 tool_call_id | 参数区打字机；完整后 pretty JSON | 是 |
| T-03 | read_file | `ReadToolCallBlock`：路径、行范围 | 路径链接 + 行号；点开查看器 | 部分：路径链接 + 行范围 + 点路径读文件。**备注：独立查看器 {NOTE}。** |
| T-04 | 读图/PDF/PPT | `read_file` 子类型 | 预览缩略图/页 | 否。**备注：读图/PDF/PPT 预览 待讨论后再做。** |
| T-05 | list_dir | `ListDirToolCallBlock` | 文件树片段 | 部分：路径 + 截断 listing |
| T-06 | grep / search | `SearchToolCallBlock`：文件命中、行命中 | 可点跳转（路径+行） | 部分：path:line:text 命中，路径可点 |
| T-07 | search_replace / edit | `EditToolCallBlock` 见 C-05 | diff viewer | 部分：HTML hunk diff（C-05） |
| T-08 | 同文件连续 edit 合并 | `collapsed_edit_blocks` | 同 | 否。**备注：同文件连续 edit 合并 待讨论后再做。** |
| T-09 | bash / run_terminal_cmd | `ExecuteToolCallBlock` C-06 | 终端风格 `<pre>` | 部分：`$` + ANSI，长输出截断 |
| T-10 | 后台 bash | `TaskBackgrounded`：task_id、log 路径、description、monitor_description | 任务列表一行 + 跟日志 | 否。**备注：后台 bash 任务行见 16。** |
| T-11 | web_search | `web_search.rs` 块 | 结果列表外链 | 部分：query + citations 外链 |
| T-12 | web_fetch | `web_fetch.rs` | URL + 摘录 | 部分：URL + 截断摘录 |
| T-13 | x_search 等 | `_meta` kind search | 同搜索卡 | 是 |
| T-14 | use_tool / MCP | `UseToolCallBlock`；server + tool | 徽章 MCP | 部分：MCP 徽章 + 工具名。**备注：完整 args 表 {NOTE}。** |
| T-15 | memory_search / get | `memory_search.rs` | 记忆卡片 | 否。**备注：memory 卡 待讨论后再做。** |
| T-16 | todo write | plan entries → todo pane | U-17 | 否。**备注：todo pane 待讨论后再做。** |
| T-17 | ask_user_question | 不单是块，是 B-10 | 同 | 是：走 B-10 提问卡，不另画工具块 |
| T-18 | enter/exit_plan_mode | 审批 | B-15 | 是：走 B-15 审批卡 |
| T-19 | image_gen / image_edit | 图工具 | 生成图 `<img>` | 否。**备注：生图结果卡 待讨论后再做。** |
| T-20 | video_gen | | `<video>` | 否。**备注：生视频卡 待讨论后再做。** |
| T-21 | workflow 工具 | 宿主 workflow | X- | 部分：时间线 workflow 阶段条。**备注：见 16。** |
| T-22 | scheduler_create/delete/list | `/loop` | 调度行 | 否。**备注：scheduler 行见 16。** |
| T-23 | monitor | `MonitorEvent` 一行 stdout | 日志 tail | 否。**备注：monitor 日志见 16。** |
| T-24 | task / spawn_subagent | 子 agent 块 | X- | 部分：子 agent 行。**备注：见 16。** |
| T-25 | kill_task / task_output | 任务面板操作 | 按钮 | 否。**备注：杀任务按钮见 16。** |
| T-26 | lsp | 诊断/hover | 可折叠诊断列表 | 否。**备注：LSP 诊断列表 待讨论后再做。** |
| T-27 | codebase graph / code nav | 能力 `code_nav_enabled` | 引用列表 | 否。**备注：代码图引用 待讨论后再做。** |
| T-28 | apply_patch（codex harness） | 当 edit | diff | 部分：当 edit 用现有 diff |
| T-29 | glob / grep_files | 当 search | 同 T-06 | 是 |
| T-30 | skills 工具 | 加载 skill | 「使用了 skill X」 | 是 |
| T-31 | computer-use / 本机电脑 | 若启用：截图 overlay | `<img>` 流；Web 本机控制仍在 Agent 侧 | 否。**备注：computer-use 截图 待讨论后再做。** |
| T-32 | 只读工具分组 | `group_tool_verbs` | C-37 | 是：连续 read/search/list/fetch/websearch/memory 分组；edit/exec/mcp 不分组 |
| T-33 | Hook 挂工具 | C-43 | 同 | 是：工具卡 footer hook（C-43） |
| T-34 | Discovered MCP tool | `DiscoveredTool` | 动态名 | 是：未知 MCP 走通用卡 |
| T-35 | Integration search | `IntegrationSearchToolCallBlock` | 同搜索 | 是：当搜索卡 |
| T-36 | 失败/取消态 | status 色：红/灰 | 同 | 是 |
| T-37 | 运行中动画 | accent wave `wave_rows`/`fps` | CSS spinner，不要 TUI wave | 是：圆点 pulse，不要 TUI wave |
| T-38 | 工具路径可点 | `tool_paths` / OSC8 | `<a>` | 是（`x.ai/fs/read_file` 弹窗） |
| T-39 | 等待权限时的工具 | 卡打开时块显示 blocked | 状态「等待你批准」 | 是 |
| T-40 | bash 语法高亮命令 | header 高亮 | 轻量 highlight | 否。**备注：bash 命令语法高亮 待讨论后再做。** |
