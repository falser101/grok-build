# 04 对话区（Scrollback）

TUI 把 ACP `session/update` + `x.ai/session_notification` 收成 `RenderBlock`。Web 用 DOM 时间线，**不要**移植 cell 布局。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| C-01 | 用户气泡 | `UserPromptBlock`；`[scrollback.blocks.prompt]` vpad/bg/prefix/min_lines。sticky header 可钉。 | 右/左气泡。发送时可乐观插入，以 server echo/`eventId` 去重。 | 是 |
| C-02 | 助手 Markdown | `AgentMessageBlock` + 流式 markdown（`xai-grok-markdown`）。heading/code/table/task/link。 | `react-markdown` 等流式追加。代码块高亮用 highlight.js/shiki，对齐主题。 | 部分：助手/思考按 Markdown 排版；流式冻住已闭合块、只重绘 live 尾（未闭合 fence 先纯文本，闭合后高亮一次）；无 shiki |
| C-03 | Thinking 块 | `ThinkingBlock`；`show_thinking_blocks`；accent 动画；truncated_lines；`Ctrl+E` 全开合。header「Thinking...」。 | 可折叠 `<details>`。流式时自动展开，结束可折。关设置则不渲染。 | 是 |
| C-04 | 工具块分型 | 见 [11-tools-blocks.md](11-tools-blocks.md)。`group_tool_verbs` 把连续 read/search/list/子 agent/已完成 thinking 收成一行。 | 同：连续只读工具折叠为「读了 N 个文件」。 | 部分：连续 read/search/list/fetch/websearch/memory 收成一行；edit/exec/mcp 各成一块；展开后按 kind 画 path/hits/`$`/MCP 徽章 |
| C-05 | Edit diff | `EditToolCallBlock`；语法高亮 diff；可选 dual line numbers；hunk `…`；`collapsed_edit_blocks` 时 +N/-M 一行，同文件合并。 | Monaco/CodeMirror 只读 diff 或 HTML table。折叠默认跟设置。 | 部分：每条 edit 单独展开 HTML hunk diff（`… N 行未改` + +N/−M）；无 Monaco / 同文件合并 |
| C-06 | Shell 输出 | `ExecuteToolCallBlock`：截断 first_lines/last_lines；运行中 accent 动画；header `label` 或 `$`。后台见 X-。 | `<pre>` + 折叠。ANSI → HTML（`ansi-to-html`）。 | 部分：`$` 命令头 + ANSI；默认 first 2 / last 3，可「显示全部」；运行中圆点动画 |
| C-07 | 系统/会话事件 | `SystemMessageBlock`、`SessionEventBlock`（compact、rewind、model switch…）。 | 居中灰色系统行。 | 部分：compact 独立卡片（进行中挤压动画，完成后就地变成已压缩+用量/耗时）；recap/relay/失败/图片丢弃进系统行；图片压缩不刷屏；model/retry 仍不刷屏 |
| C-08 | 引用条 | `quote_bar` | blockquote 样式。 | 是（助手/思考 blockquote 左边条） |
| C-09 | Context info 块 | `/context` 结果入滚动区。 | 卡片。 | 是（`/context` → `x.ai/session/info` 卡片） |
| C-10 | Credit limit 卡 | `CreditLimitBlock` + 行动按钮。 | 卡片 + 升级链接。 | 是 |
| C-11 | BTW 块 | `/btw` 旁路问答。Minimal 里 dismissible 面板。 | 侧注卡片，Esc 关；结束写入时间线。 | 是 |
| C-12 | Workflow 块 | `WorkflowBlock` 阶段/状态。 | 见 X-workflow。时间线内嵌进度。 | 部分：同 runId 就地更新 + 阶段条；无 pause/stop 面板 |
| C-13 | Subagent 块 | `SubagentBlock` 类型/描述/进度。 | 可点开子会话抽屉。 | 部分：类型徽章 + activity 就地更新；无子会话抽屉 |
| C-14 | Mermaid | `mermaid_content`；`render_mermaid` auto/on/off；点击行打开图（Kitty graphics / 外部）。worker 超时可杀。 | mermaid.js 渲染 SVG。off 则代码块。 | 是（CDN mermaid，失败则代码块） |
| C-15 | 表格几何 | `table_geometry` 算列宽。 | HTML table，横向滚动。 | 是 |
| C-16 | 折叠单块 | vim `h/l` `e`；simple 左右箭头。`respect_manual_folds` 钉住手折，streaming 不拉开。 | 每块 chevron。local state。 | 是 |
| C-17 | 全开/全关 | `⇧E`；thinking `Ctrl+E`。⇧E 清 pin。 | 工具条按钮。 | 是 |
| C-18 | 原始 Markdown | vim `r` 切 raw。 | 「查看源」toggle。 | 部分：气泡上不放「源」；`/copy` 仍可用 |
| C-19 | 全屏块查看器 | Enter / `Ctrl+F`。`block_viewer`。 | modal 全宽。 | 部分：Thinking 在对话里展开；无「查看」弹窗 |
| C-20 | 复制块 | `y` 内容；`⇧Y` metadata（如命令）。OSC 52 + 备份 `~/.grok/last-copy.txt`。 | Clipboard API；失败提供下载。 | 部分：气泡上不放「复制」；选区工具条 + `/copy` |
| C-21 | `/copy [n\|path]` | 最近回复；数字=倒数第 n；路径写文件。toast。 | 同。 | 是 |
| C-22 | `/find` | 滚动区搜索（全屏 only）。 | `Ctrl+F` 浏览器原生或自绘高亮跳转（自绘才能搜折叠块）。 | 是（`/find` 条 + 浏览器 Ctrl+F） |
| C-23 | `/jump` | 按 turn 跳。 | 时间线点击 / 快捷面板。 | 是 |
| C-24 | Timeline 侧轨 | `/timeline`、`show_timeline`。tick、悬停预览、点击跳。换 scrollbar。Minimal 无。 | 右侧 mini-map 或 turn 列表。 | 是（右侧垂直居中、固定高度：上一个响应 + 上/下圆钮 + 短刻度最多 6，悬停预览，点击跳转） |
| C-25 | Sticky 用户头 | `sticky_headers`。滚过用户 prompt 钉顶。 | `position: sticky`。 | 否（会挡住回复；用右侧历史轴跳转） |
| C-26 | Follow 尾部 | `follow_indicator` center/none；`follow_auto_select`；`follow_by_overscroll`；发送 page_flip。展开手折块会停 follow。`⇧G`/滚过底/新 prompt 恢复。 | IntersectionObserver：距底 < N px 则 stick。用户上滚断开，按钮「回到最新」。 | 是 |
| C-27 | Page flip on send | `page_flip_on_send`：发送后把 prompt 顶到视口。 | 发送后 `scrollIntoView` 用户气泡到顶。可关。 | 是 |
| C-28 | 滚动条 | `[scrollback.scrollbar]` enabled/gap/颜色。 | CSS overlay scrollbar。 | 部分：对话区隐藏原生滚动条，仍可滚轮/触控板滚动 |
| C-29 | 可展开指示 | `›`、`expandable_indicator`；折叠 accent `❙`。 | CSS 三角形即可。 | 部分：`<details>` / 展开按钮 |
| C-30 | 选区 | 见 K- 文本选择。选区可出 copy/view 按钮（`selection_buttons`）。 | 浏览器选区 + 悬浮工具条。 | 部分：选区只留复制 |
| C-31 | OSC-8 链接 | 工具路径、http、语义链接（`OpenLink`）。`OpenNextLink`/`OpenPrevLink`。 | 真 `<a>`。文件路径点了调 `x.ai/fs` 或告诉用户在编辑器打开（Web 无 IDE 则下载/新页展示）。 | 部分：点 `.tool-path` 调 `x.ai/fs/read_file` 弹窗；无下一/上一链接 |
| C-32 | 图片/视频 overlay | Kitty graphics；ffmpeg 内联；hover chip 预览。 | `<img>`/`<video>`。blob URL。 | 部分：用户图缩略图横排在同一条文字气泡上方，最多 4 张，超出最后一张 +N，点击进灯箱可左右翻；压缩/回放拆开发的图会合回该气泡；助手图仍内联 |
| C-33 | 语法高亮主题 | grok-night / grok-day / tokyo-night `.tmTheme` 随主题。 | shiki 主题映射这三套。 | 部分：轻量 tokenizer，无 shiki 主题包 |
| C-34 | 流式 debounce | chunk 合并；`eventId` 去重（live 才用 highwater；replay 豁免）。leader 重放不截断。 | 按 `eventId` Map。replay（load）清高水或忽略去重。 | 是 |
| C-35 | Replay vs live | `meta.isReplay`。load 时整段历史当 replay。 | load 时 skeleton → 填历史 → 再接 live。 | 是（回放不逐条刷屏，完成后落到最新一条） |
| C-36 | Timestamps | `/timestamps`、`show_timestamps`。用户/助手旁时钟。 | 相对时间 + hover 绝对。 | 是 |
| C-37 | 分组 verb | `group_tool_verbs` 默认开。 | 默认开，设置可关。 | 是 |
| C-38 | 行下划线 | `line_under_last_entry`。 | CSS border。 | 否（产品去掉末条下划线） |
| C-39 | Tab 宽度 | `tab_width`。 | CSS `tab-size`。 | 是 |
| C-40 | 锚点折叠 | `anchor_on_fold`：折时块头屏幕位置不变。 | 记录 scrollTop 补偿。 | 是 |
| C-41 | 选择跟随 | 方向键改选中条目；PageUp/Down 在 prompt 焦点也可滚对话。 | 点击选中；键盘可选。 | 是（点击 / Alt+↑↓；PageUp/Dn 滚时间线） |
| C-42 | Quote / 回复摘录 | 部分块带引用条。 | 同上。 | 部分：blockquote |
| C-43 | Hook 注解 | `HookAnnotation` / `HookExecution` 挂在工具块上。 | 工具卡 footer「hook: pre/post」。 | 是 |
| C-44 | ImageCompressed / Dropped | 通知：图被压缩或丢弃。 | toast + 时间线系统行。 | 部分：丢弃进系统行；压缩静默（不刷「图片已压缩」） |
| C-45 | Feedback 请求 | `FeedbackRequest` 启发式。 | 小调查卡。 | 部分：feedback 卡片，未接提交 RPC |
| C-46 | Retry / AutoRecovery | `RetryState`、`AutoRecoveryStarted/Exhausted`。 | 状态条「正在重试 2/5」。 | 是（不进滚动区，避免刷屏；与 TUI 一样不写 session event） |
| C-47 | Relay 同步状态 | `RelaySyncStatus`。 | 远程模式才显示。 | 是 |
| C-48 | 模型切条 | 滚动区一条「Switched to X」。 | 系统行。 | 部分：不刷系统行，避免回放噪声 |
| C-49 | Minimal 截断 | `minimal_max_commit_rows`、thinking 默认折。 | Web 不做 Minimal 模式（见 V-screen）。 | 否（N/A） |
| C-50 | 滚动 debug HUD | `/scroll-debug`、`/debug scroll`。 | 不要做。 | 否（不做） |
| C-51 | FPS HUD | `/debug fps`。 | 不要做。 | 否（不做） |
