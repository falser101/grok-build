# 21 配置层、沙箱、记忆、规则、模型

Agent 侧能力；Web 主要是展示/开关，不重新实现。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| Z-01 | config 优先级 | CLI > env > config.toml > managed/requirements > 默认 | 只经 Agent；Web 设置写用户层 | Agent 已有；Web 不读 toml |
| Z-02 | `~/.grok/config.toml` | 主配置 | persist 扩展或文档「请改文件」P0 可只读 | 部分：设置写前端偏好。**备注：写回 config.toml {NOTE}。** |
| Z-03 | 项目 `.grok/config.toml` | MCP 等 | 同磁盘 | Agent 已有 |
| Z-04 | managed_config.toml | 组织 | 只读展示 | Agent 已有 |
| Z-05 | requirements.toml | 组织硬性 | 设置项灰掉 | Agent 已有 |
| Z-06 | pager.toml | 外观深定制 | CSS；不必兼容全部 key | 部分：CSS 密度/主题。**备注：不兼容全部 pager.toml。** |
| Z-07 | `.envrc` | `[session] load_envrc` | Agent bash 继承；Web 无 | Agent 已有 |
| Z-08 | 项目规则 | `12-project-rules.md` AGENTS.md 等 | Agent prompt；Web 可「已加载 N 条」 | Agent 已有 |
| Z-09 | `--rules` | 追加系统提示 | session `_meta.rules` | 否。**备注：session rules UI 待讨论后再做。** |
| Z-10 | systemPromptOverride | | 高级/内部 | 否（不做）：内部 |
| Z-11 | Memory 后端 | GROK_MEMORY / experimental | `/memory` 门闩 | 部分：`/memory` 发给 Agent |
| Z-12 | `/flush` `/dream` `/remember` | | 命令 | 是：`/flush` `/dream` 发给 Agent；`/remember` 发给 Agent |
| Z-13 | 记忆文件列表 | `MemoryFiles` 通知 | modal | 否。**备注：记忆文件列表 待讨论后再做。** |
| Z-14 | 记忆路径 | `~/.grok/memory/` | 只读打开 | 否。**备注：打开记忆文件 待讨论后再做。** |
| Z-15 | Compact 前 flush | 通知 MemoryFlush* | 进度 | 部分：compact 卡片。**备注：MemoryFlush 进度 {NOTE}。** |
| Z-16 | Session-end 记忆 | `MemorySessionSaved` | | Agent 已有 |
| Z-17 | Sandbox 档 | off 等；非 off 否决 leader | 展示当前档 | 否。**备注：sandbox 档展示 待讨论后再做。** |
| Z-18 | YOLO vs sandbox | 仍受 deny/hooks | 文案 | 是：YOLO 仍可能被 deny/hooks 拦（文案在权限卡） |
| Z-19 | 默认模型 | `[models] default` | G-18 | 是：当前会话模型下拉 |
| Z-20 | web_search 模型 | 可分开 | 高级设置 | 否。**备注：web_search 模型 待讨论后再做。** |
| Z-21 | 自定义 endpoint | GROK_MODELS_BASE_URL | 只读 | Agent 已有 |
| Z-22 | extra_headers / temperature 等 | 配置 | 高级 | 否。**备注：自定义 endpoint 表单 待讨论后再做。** |
| Z-23 | remote_fetch 模型目录 | `[features] remote_fetch` | 离线时目录冻结 | Agent 已有 |
| Z-24 | codebase_indexing | 代码图 | 开关 restart | 否。**备注：codebase indexing 开关 待讨论后再做。** |
| Z-25 | two_pass_compaction | | 开关 | 否。**备注：two_pass_compaction 待讨论后再做。** |
| Z-26 | respect_gitignore | 工具过滤 | 开关 | 否。**备注：respect_gitignore 开关 待讨论后再做。** |
| Z-27 | auto_compact_threshold_percent | 默认 85 | 设置 | 部分：用量弹层展示自动压缩阈值。**备注：设置里改阈值 {NOTE}。** |
| Z-28 | fork_secondary_model | G-49 | | 否。**备注：fork 副模型 待讨论后再做。** |
| Z-29 | Agent profile | `--agent-profile` / `_meta.agentProfile` | 选择器 | 否。**备注：agent profile 选择器 待讨论后再做。** |
| Z-30 | Chat 模式 `--chat` | kind=chat | 产品决定 | 是：新建默认 Build；列表 chat 徽章 |
| Z-31 | 存储模式 | `storage_mode` flag | 高级 | 否。**备注：storage_mode 待讨论后再做。** |
| Z-32 | todo_gate | reminder | 高级 | 否。**备注：todo_gate 待讨论后再做。** |
| Z-33 | laziness debug log | 原型 | 不做 | 否（不做） |
| Z-34 | installer 字段 | toml | N/A | 否（N/A） |
| Z-35 | 热重载 config | watcher 部分 live | `x.ai/settings/update` | 部分：听 `x.ai/settings/update` |
| Z-36 | SkillsFileWatcher | 热更技能 | 菜单刷新 | Agent 已有 |
| Z-37 | 模型 effort 覆盖 | CLI `--effort` | 设置 | 是：effort 芯片 |
| Z-38 | disable_web_search | flag | 设置 | 否。**备注：disable_web_search 待讨论后再做。** |
| Z-39 | subagents flag | CLI | 设置 | 否。**备注：subagents flag 设置 待讨论后再做。** |
| Z-40 | 磁盘 session 格式 JSONL | 与 Web 共用 | 不要自己写 JSONL | Agent 已有 |
| Z-41 | auth.json | | Agent 写；Web 不碰文件 | Agent 已有 |
| Z-42 | 自定义 MCP 在项目 | `.mcp.json` | E-32 | Agent 已有 |
| Z-43 | Workspace daemon / preview | 本地 workspace_server | 若 meta 出现再做 ACK | 部分：local_workspace ACK 卡已接 |
| Z-44 | Cloud workspace meta | 会被 scrub | 不要把 cloud_server_id 从 TUI 抄错到 Web | 是：不把 cloud id 抄进 Web |
| Z-45 | 反馈系统开关 | `[features] feedback` | 藏 /feedback | 否 |
| Z-46 | 诊断服务器 | `xai-grok-diag-server` | 不做用户功能 | 否（不做） |
