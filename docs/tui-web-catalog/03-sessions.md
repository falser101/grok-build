# 03 会话生命周期

磁盘：`~/.grok/sessions/`（按 cwd 组织）。TUI / Web / stdio **同一份**。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| S-01 | 新建 session | `session/new` + cwd + mcpServers + `_meta`（yoloMode、autoMode、modelId、kind=chat、rules…）。Welcome/Ctrl+N/`/new`/`/clear`。 | 落地页发送或 `POST` 等价：`session/new`。cwd 用 query/选择器（本机路径）。 | 否 |
| S-02 | `--session-id` 指定 UUID | `NewSessionWithId`，已存在则错。 | 高级；URL `?session=` 只用于 load，创建用 Agent 生成 id。 | 否 |
| S-03 | Resume by id | `session/load`。cwd 必须对上存储 key；worktree 会话用自己的 cwd。 | 列表点选 → load。失败展示 shell 错误。 | 否 |
| S-04 | Resume by title | `/resume` 标题匹配，忽略大小写；唯一手动改名胜出；UUID 形永远走 id。 | 搜索框；展示 id 避免歧义。 | 否 |
| S-05 | Continue 最近 | `-c` / Welcome 默认。当前目录最近一条。 | 「继续」按钮 = 列表按 mtime 第一条。 | 否 |
| S-06 | Session picker | Ctrl+S / `/resume`。欢迎页列表 + 会话内 overlay。源过滤、卡片展开、复制 id、worktree 里打开。`x.ai/session/list`（facet `_meta["x.ai/facetFilters"].kind`）。`x.ai/partial` 时降级。 | 全屏列表：标题、时间、cwd、状态。搜索走 `x.ai/session_search` 若有。 | 否 |
| S-07 | 会话信息 | `/session-info` `/status` `/info`：auth、model、turns、context。可点选复制；`c` 复制 id，`y` 复制整块。 | 侧栏或 modal。 | 否 |
| S-08 | 重命名 | `/rename` `/title`；`--auto` 取消钉住、恢复自动标题。Dashboard Ctrl+R。fan-out `SessionSummaryGenerated` + `x.ai/titleIsManual`。 | 行内编辑标题。`--auto` 做一个按钮。 | 否 |
| S-09 | 自动标题 | 首条 prompt 后 LLM 生成；`SessionSummaryGenerated`。手动标题不覆盖。 | 听通知更新标题栏。 | 否 |
| S-10 | 删除当前 | `/delete` 先确认；停 turn/后台/子 agent；清历史。回到 Welcome，或从 Dashboard 进来则回 Dashboard。 | confirm() 后扩展删除；回到列表。 | 否 |
| S-11 | 删除列表项 | picker `d` 然后 `y`；Dashboard `Ctrl+X` 两次或点 `[✗]` 再确认。 | 列表项删除 + 确认。 | 否 |
| S-12 | Fork | `/fork`：历史到此，新 agent。`x.ai/session/fork`。CLI `--fork-session`。 | 「分支会话」按钮。 | 否 |
| S-13 | Rewind / undo | `/rewind` `/undo`；空 prompt 双 Esc。picker 选 turn。`confirm_before_rewind`。跨 compact 边界有 checkpoint。persist-only `RewindMarker`。 | 时间线点某条用户消息 → 确认 → rewind 扩展。reload 滚动区。 | 否 |
| S-14 | Compact | `/compact [context]`；阈值默认 85% `[session] auto_compact_threshold_percent`。通知：AutoCompactStarted/Completed/Failed/Cancelled、MemoryFlush*、AutoContinueCompleted。 | 命令 + 进度条。听通知。 | 否 |
| S-15 | `/context` | 分类：系统、消息、reasoning、空闲；工具定义/skills/MCP 估 token。 | modal 饼图或表。 | 否 |
| S-16 | 退出会话回 Welcome | `/home` `/welcome`。无快捷键。 | 回会话列表。不要关 WS（serve 常驻）。 | 否 |
| S-17 | Worktree 新会话 | Welcome Ctrl+W；Ctrl+N 二次选择；`--worktree`/`-w`/`--ref`。`x.ai/git/worktree/create`。 | 对话框：label、base ref。 | 否 |
| S-18 | Worktree 里 resume | picker「在 worktree 打开」。`x.ai/session/resolve_local_for_worktree_resume`。 | 选项「在新 worktree 恢复」。 | 否 |
| S-19 | Worktree GC/list | CLI `grok worktree`；扩展 `x.ai/git/worktree/list|remove|gc|db/*`。auto_gc 政策。 | 设置或 `/worktree` 页。非 P0。 | 否 |
| S-20 | Chat vs Build kind | `--chat` / `_meta["x.ai/session"].kind`。`--chat` 下拒绝本地 Build 行 resume。 | 若产品要聊天模式，session/new 打 kind。默认 Build。 | 否 |
| S-21 | Recap | `/recap`；离开终端再回来自动（focus tracker + `sessionRecap` capability）。`SessionRecap` / `SessionRecapUnavailable`。auto recap 去重。 | 按钮；Page Visibility API 触发 `x.ai/recap`。 | 否 |
| S-22 | 导出 | `/export` 文件或剪贴板。 | 下载 markdown/jsonl。 | 否 |
| S-23 | Transcript | `/transcript` 查看原始记录。 | 只读页或下载。 | 否 |
| S-24 | Share | `/share`。 | 调 `x.ai` share 扩展；给链接。 | 否 |
| S-25 | 活动会话登记 | `xai-grok-active-sessions` JSON，崩溃恢复。 | Web 不登记 TUI 锁。serve 进程活着即可。 | 否（N/A） |
| S-26 | 崩溃恢复 / 外源会话 | `ScanForeignSessions`、Claude/Codex 外源。Welcome 可 resume foreign。 | 列表若 Agent 返回 foreign 行则展示来源徽章。 | 否 |
| S-27 | Session close | 退出路径 `session/close` 或 `x.ai/session/close`。 | 离开某会话时 close（若协议要求）。Dashboard 删会话同。 | 否 |
| S-28 | Last turn summary | `LastTurnSummary` 给 Dashboard 副行；不入 updates.jsonl。 | 列表副标题。 | 否 |
| S-29 | 模型自动切换 | `ModelAutoSwitched`：持久化模型不可用。 | toast + 更新模型下拉。 | 否 |
| S-30 | 模型手动切换同步 | `ModelChanged` 广播；发起者靠自己的 response，follower 才 apply。 | 多客户端时忽略自己的回声。单 Web 连接直接 apply。 | 否 |
| S-31 | `/cd` | 改 session cwd。 | 危险；要确认。调对应扩展或新 session。 | 否 |
| S-32 | Restore code | load `_meta["x.ai/restore_code"]`。 | 高级 git restore；设置项。 | 否 |
| S-33 | 双击 Ctrl+N 确认 | 1000ms 内两次防误开。然后选 normal/worktree。 | 按钮不需要双击；用对话框选模式。 | 否 |
| S-34 | 会话搜索 | `x.ai/session_search` 内容检索。 | picker 搜索框 debounce。 | 否 |
| S-35 | Roster | `x.ai/sessions/list` + `sessions/changed`。Dashboard 用。 | 列表实时刷新。 | 否 |
