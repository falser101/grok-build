# 11 工具调用在 UI 上怎么画

ACP：`tool_call` + `tool_call_update` + `ToolCallDeltaChunk`（参数流）。`_meta["x.ai/tool"]` 有 name/kind。Web 按 **kind+name** 分流，未知走通用卡。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| T-01 | 通用工具卡 | `OtherToolCallBlock`：名、pending/running/done/error、折叠详情 | 卡片：图标、状态、耗时 | 否 |
| T-02 | 参数流式 | `ToolCallDeltaChunk` 合并同一 tool_call_id | 参数区打字机；完整后 pretty JSON | 否 |
| T-03 | read_file | `ReadToolCallBlock`：路径、行范围 | 路径链接 + 行号；点开查看器 | 否 |
| T-04 | 读图/PDF/PPT | `read_file` 子类型 | 预览缩略图/页 | 否 |
| T-05 | list_dir | `ListDirToolCallBlock` | 文件树片段 | 否 |
| T-06 | grep / search | `SearchToolCallBlock`：文件命中、行命中 | 可点跳转（路径+行） | 否 |
| T-07 | search_replace / edit | `EditToolCallBlock` 见 C-05 | diff viewer | 否 |
| T-08 | 同文件连续 edit 合并 | `collapsed_edit_blocks` | 同 | 否 |
| T-09 | bash / run_terminal_cmd | `ExecuteToolCallBlock` C-06 | 终端风格 `<pre>` | 否 |
| T-10 | 后台 bash | `TaskBackgrounded`：task_id、log 路径、description、monitor_description | 任务列表一行 + 跟日志 | 否 |
| T-11 | web_search | `web_search.rs` 块 | 结果列表外链 | 否 |
| T-12 | web_fetch | `web_fetch.rs` | URL + 摘录 | 否 |
| T-13 | x_search 等 | `_meta` kind search | 同搜索卡 | 否 |
| T-14 | use_tool / MCP | `UseToolCallBlock`；server + tool | 徽章 MCP | 否 |
| T-15 | memory_search / get | `memory_search.rs` | 记忆卡片 | 否 |
| T-16 | todo write | plan entries → todo pane | U-17 | 否 |
| T-17 | ask_user_question | 不单是块，是 B-10 | 同 | 否 |
| T-18 | enter/exit_plan_mode | 审批 | B-15 | 否 |
| T-19 | image_gen / image_edit | 图工具 | 生成图 `<img>` | 否 |
| T-20 | video_gen | | `<video>` | 否 |
| T-21 | workflow 工具 | 宿主 workflow | X- | 否 |
| T-22 | scheduler_create/delete/list | `/loop` | 调度行 | 否 |
| T-23 | monitor | `MonitorEvent` 一行 stdout | 日志 tail | 否 |
| T-24 | task / spawn_subagent | 子 agent 块 | X- | 否 |
| T-25 | kill_task / task_output | 任务面板操作 | 按钮 | 否 |
| T-26 | lsp | 诊断/hover | 可折叠诊断列表 | 否 |
| T-27 | codebase graph / code nav | 能力 `code_nav_enabled` | 引用列表 | 否 |
| T-28 | apply_patch（codex harness） | 当 edit | diff | 否 |
| T-29 | glob / grep_files | 当 search | 同 T-06 | 否 |
| T-30 | skills 工具 | 加载 skill | 「使用了 skill X」 | 否 |
| T-31 | computer-use / 本机电脑 | 若启用：截图 overlay | `<img>` 流；Web 本机控制仍在 Agent 侧 | 否 |
| T-32 | 只读工具分组 | `group_tool_verbs` | C-37 | 否 |
| T-33 | Hook 挂工具 | C-43 | 同 | 否 |
| T-34 | Discovered MCP tool | `DiscoveredTool` | 动态名 | 否 |
| T-35 | Integration search | `IntegrationSearchToolCallBlock` | 同搜索 | 否 |
| T-36 | 失败/取消态 | status 色：红/灰 | 同 | 否 |
| T-37 | 运行中动画 | accent wave `wave_rows`/`fps` | CSS spinner，不要 TUI wave | 否 |
| T-38 | 工具路径可点 | `tool_paths` / OSC8 | `<a>` | 否 |
| T-39 | 等待权限时的工具 | 卡打开时块显示 blocked | 状态「等待你批准」 | 否 |
| T-40 | bash 语法高亮命令 | header 高亮 | 轻量 highlight | 否 |
