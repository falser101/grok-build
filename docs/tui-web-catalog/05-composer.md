# 05 输入框、队列、补全

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| I-01 | 普通发送 | prompt 焦点 Enter。空则不发。 | textarea Enter 发送（可配置）。 | 是 |
| I-02 | 多行 | `/multiline` `/ml`；`Ctrl+M` 在 prompt 焦点。开：Enter 换行，Shift/Alt+Enter 发。会话级，不写 toml。 | 默认 textarea 多行：Enter 换行，Ctrl/Cmd+Enter 发送（Web 习惯）。提供「Enter 发送」开关对齐 TUI。 | 是（设置里 Enter 发送开关） |
| I-03 | Shift+Enter 换行 | 非 multiline 时插入换行。 | 与 I-02 统一一套映射，设置里写清楚。 | 是 |
| I-04 | Readline vs vim 输入 | `simple_mode` 默认 true = readline。false = 输入框 vim。与滚动 `vim_mode` 分开。 | Web 用普通 textarea；可选 CodeMirror vim。P0 不做输入 vim。 | 否（明确不做输入 vim） |
| I-05 | 焦点 Tab | 滚动 ↔ prompt。Space/字母在 simple 滚动焦点会聚焦并输入。阻塞卡时 Tab 只在卡片内走。 | 输入框常驻底部。点击时间线不偷键盘除非选块。 | 是（常驻输入；slash/@ 时 Tab 选；PageUp/Dn 滚时间线） |
| I-06 | 折叠未聚焦 prompt | `[prompt] collapse_unfocused`。 | 可选缩小输入区。 | 是 |
| I-07 | 前缀字符 | `show_prefix`。 | 可用 `❯`。 | 是：默认不画 `❯`（Web 输入框自己能看出来）；`!` / `#` 模式仍有前缀 |
| I-08 | 鼠标悬停高亮 | `mouse_hover`。 | CSS :hover。 | 是 |
| I-09 | Slash 下拉 | `/` 打开，模糊匹配，Tab/Enter 选。来源：shell builtins + pager builtins + skills。碰撞：内置占短名，skill 用 `scope:name`，菜单打徽章。 | 弹出 combobox。数据 = initialize `availableCommands` + 前端本地命令（theme 等）。 | 是 |
| I-10 | Slash 参数 hint | 条目可有 argument_hint。 | 补全第二列。 | 是 |
| I-11 | `@` 文件搜索 | 下拉 + `x.ai/search/fuzzy/open|change`，通知 `fuzzy/status`。行查看器。 | 弹层列表；选中插入路径 chip 或 `@path`。 | 是：根为当前会话 cwd；相对路径插入；列表旁预览文件行，点行插入 `@path:N` / Shift 点选 `@path:N-M`。不做 TUI vim visual / `/` 搜索 |
| I-12 | 路径/shell token 补全 | `extensions/suggest`：file、path、history、ai、shell_token。 | 输入 debounce 调 suggest 扩展。 | 是（`x.ai/suggest` debounce） |
| I-13 | Prompt 建议幽灵字 | `prompt_suggestions` 默认开。回合结束后小模型预测，Tab 接受。 | ghost text overlay。可关。 | 是（`x.ai/suggestPrompt` + Tab） |
| I-14 | Follow-up 芯片 | `SubmitFollowUp`：**字面**发送，禁止当 slash 执行。 | 芯片 click = 原文 prompt。 | 是 |
| I-15 | 历史 ↑ | 空 prompt ↑ 打开，填最近一条；↑↓ 走；↓ 过最新关闭；输入即改。`!` 历史回 shell 模式。`/history` 模糊。 | 历史 popover。 | 是（`x.ai/prompt_history` + 本地回退） |
| I-16 | Shell 模式 `!` | 空 prompt 打 `!`。`SendBashCommand` 绕过 agent。Esc 空时退回。 | 前缀 `!` 或模式切换。Web 仍经 Agent 的 bash 工具更安全；若要 1:1 再做直通。 | 是（空输入 `!` 进模式，仍走 `session/prompt`） |
| I-17 | Remember 模式 `#` | 空 prompt `#`。Esc 退出。 | 同，调 `/remember` 语义。 | 是 |
| I-18 | 本地队列 | 默认 `follow_up_behavior=queue`。turn 中 Enter 入队。双 Enter 空 composer 发队首。阻塞等后台时 hint。steer：仍显示队列，在下个 tool/model gap 注入。 | 队列组件 + 同一 ACP `x.ai/queue/*`。 | 是 |
| I-19 | 共享队列 | leader 下 `x.ai/queue/changed` 为真源。remove/reorder/clear/edit/hold/interject。version 乐观锁。 | 多客户端必须走 server 队列。单 Web 也建议用 server 队列以免刷新丢失。 | 部分：听 `x.ai/queue/changed` 并覆盖本地队列。**备注：拖拽重排 / 编辑条目待讨论（单标签够用）。** |
| I-20 | 队列面板 | `Ctrl+;`（macOS VS Code 家族 `Ctrl+4`）。非空才有。Send now 按钮。 | 侧栏。 | 是：右栏队列 + 「立即发送」+ Ctrl+; |
| I-21 | Combine queued | `combine_queued_prompts` 默认关。合并连续纯文本 follow-up；遇 bash/slash/cron/skill/图/编辑中则停。 | 跟设置。 | 是（设置开关） |
| I-22 | Send now / 插话 | 默认 `Ctrl+Enter`（Apple Terminal `Ctrl+O` 主、VS Code 家族 `Ctrl+L`）。非空：取消当前 turn 再发（后台/子 agent/队列其余继续）。空+队列：发队首。idle 空：noop。`x.ai/interject` 是**不**取消的插入（计划评论等）。 | Web：`Ctrl+Enter` = send now。单独「插入」按钮走 interject。 | 是（Ctrl+Enter；回复上方芯片「插入 / 立即发送」；队列卡片上立即发送；输入框不放这两钮） |
| I-23 | 粘贴文本 | Ctrl/Cmd+V CLIPBOARD。Linux 中键 PRIMARY（需 DISPLAY；XWayland 要 xclip）。Shift+Insert 终端原生。 | `paste` 事件。无 PRIMARY。 | 是 |
| I-24 | 粘贴图片 | macOS/Linux Ctrl+V；Windows `Alt+V`（WT 吃掉 Ctrl+V 图）。chip `[Image #N]`，路径只在预览。 | `clipboardData.files` + drag-drop。ACP image block。注意压缩/丢弃通知。 | 是（待发图/视频横排缩略图；`+` 选文件） |
| I-25 | 拖入文件 | 图 → chip；非图 → 绝对路径文本。 | drop 区。 | 是（图/视频缩略图；非图插入 `cwd/name`） |
| I-26 | 外部编辑器 | Minimal：`Ctrl+G` / `/edit-prompt`。`$VISUAL`/`$EDITOR`/vi。有 chip 的草稿拒绝拍扁。 | Web：「在编辑器打开」可 download 或 `vscode://`。非 P0。 | 否。**备注：Web 用大输入框即可；外开编辑器待讨论。** |
| I-27 | 清空草稿 | idle 非空，双 Esc 800ms；先 toast。Ctrl+C 一下清空。入 history。 | Ctrl+K 或按钮。可做撤销（见 hints.undo）。 | 是（Ctrl/Cmd+K） |
| I-28 | Undo 清稿 | Ctrl+Z 恢复；`contextual_hints.undo`。 | 标准 undo 栈。 | 是：textarea 原生 Ctrl/Cmd+Z |
| I-29 | Plan nudge | 输入像规划时 tip「Shift+Tab plan mode」。 | 可做。 | 是 |
| I-30 | 队列里编辑后变 slash | `RunEditedQueuedCommand`：存的是完整 slash 则出队并执行。失败留在队列。 | 同语义。 | 是（出队时本地 slash 先执行） |
| I-31 | `/queue` | slash 管队列。 | 打开队列面板。 | 是 |
| I-32 | Select all | Ghostty 才处理 Cmd+A（含 image chips）。 | textarea 原生全选。 | 是 |
| I-33 | Prompt 图片预览 | 光标在 chip 上 overlay。 | hover 缩略图。 | 是 |
| I-34 | 发送中 disable | turn 跑仍可输入（队列）。 | 不要 disabled 整个框。 | 是 |
| I-35 | 草稿与 cancel | Esc 取消 turn **保留**草稿；Ctrl+C 先清草稿再取消。 | 对齐：Stop 按钮保留输入。 | 是 |
| I-36 | 粘贴过大 | 有大小限制与提示。 | 同样拒绝并 toast。 | 是 |
| I-37 | 命令 palette 发 slash 保草稿 | `SendSlashCommandPreservingDraft`。 | palette 执行命令不擦 textarea。 | 是：Ctrl+P 跑本地 slash 不擦输入框；发给 Agent 的 slash 也不清空草稿 |
| I-38 | 组合键被终端偷 | 大量 VS Code/tmux/WezTerm 特例。 | Web 只有浏览器抢键（Ctrl+W 关标签等）。能用就用，抢不到就按钮。 | 否（N/A） |
