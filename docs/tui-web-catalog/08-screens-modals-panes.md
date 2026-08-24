# 08 画面、模态、侧栏

`views/` 每个模块一行。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| U-01 | Agent 主屏 | `views/agent.rs`：滚动 + composer + 底栏 | 三栏或经典 chat 布局 | 是 |
| U-02 | Agent 状态行 | `agent_status`：running/watching/blocked | 顶/底状态 | 是 |
| U-03 | Turn status | `turn_status`；与 prompt 可有 gap | 「正在想 / 跑工具」 | 是 |
| U-04 | Shortcuts bar | 随焦点变；窄屏修剪但阻塞卡回卡 hint 钉死 | 底栏 hint 或 `?` | 是 |
| U-05 | Shortcuts help | `Ctrl+.`，无 KKP 则 `Ctrl+X`；Dashboard `?` | 快捷键页 | 是 |
| U-06 | Command palette | `Ctrl+P` / `?`：快捷键+slash+skills | 模态模糊搜 | 是 |
| U-07 | Settings modal | F2 / `Ctrl+,` / `Cmd+,` | 见 14-settings | 是：齿轮 / Ctrl+, / `/settings` |
| U-08 | Theme picker | `/theme` 实时预览，Esc 还原 | 设置里即时换 CSS | 是：`/theme` + 设置即时换 CSS |
| U-09 | Model picker | `Ctrl+M`（非 prompt 焦点） | 顶栏下拉（接口列表） | 是 |
| U-10 | Session picker | U 见 S-06 | 全屏路由 `#/sessions` 主区列表 | 是 |
| U-11 | File search dropdown | I-11 | combobox | 是：composer `@` 下拉（I-11） |
| U-12 | File line viewer | `@` 结果看行 | modal | 否。**备注：@ 结果行查看器 待讨论后再做。** |
| U-13 | Slash dropdown | I-09 | combobox | 是 |
| U-14 | Completion dropdown | 通用补全 | 同 | 是：`x.ai/suggest` 补全 |
| U-15 | History search | `/history` | 同 | 是：`/history` |
| U-16 | Queue pane | I-20 | 侧栏 | 是 |
| U-17 | Todo pane | `Ctrl+T`；`[todo] badge_format` default/colon/comma | 侧栏 checklist；ACP plan entries → todo | 否。**备注：todo 侧栏 待讨论后再做。** |
| U-18 | Tasks pane | `Ctrl+G` 全屏 | 后台任务列表 | 部分：`/tasks` 菜单提示不做。**备注：见 16。** |
| U-19 | Workflows overlay | `/workflows` 运行中，非定义目录 | 见 X | 部分：`/workflows` 菜单提示不做。**备注：见 16。** |
| U-20 | Subagent catalog pane | 子 agent 目录 | 抽屉 | 部分：时间线有子 agent 行。**备注：目录抽屉见 16。** |
| U-21 | Goal detail | `goal_detail` | 页 | 否。**备注：goal 详情 待讨论后再做。** |
| U-22 | Persona detail | `persona_detail` | 页 | 否。**备注：persona 详情 待讨论后再做。** |
| U-23 | Agents modal | `/config-agents` 定义、默认、切换 | 设置页 | 否。**备注：agent 定义页 待讨论后再做。** |
| U-24 | Extensions modal | hooks/plugins/marketplace/skills 四 tab；非 VS Code `Ctrl+L` | 四 tab 页。VS Code 家族 TUI 把 Ctrl+L 给了 interject | 部分：slash 入口提示不做。**备注：四 tab 扩展页见 15。** |
| U-25 | MCP modal | `/mcps` | 见 E | 部分：slash 入口提示不做。**备注：见 15。** |
| U-26 | Memory modal | `/memory` 浏览文件 | 文件列表+内容 | 否。**备注：记忆文件浏览 待讨论后再做。** |
| U-27 | Usage modal | `/usage` | 额度/账单 | 是：`/usage` 用量弹层（额度账单另议） |
| U-28 | Privacy | `/privacy` | A-12 | 是：设置里隐私开关 + `/privacy` |
| U-29 | Import Claude modal | 权限/env/MCP/hooks/paths 多选确认 | 向导 | 否。**备注：导入 Claude 向导 待讨论后再做。** |
| U-30 | New worktree dialog | label、ref | 对话框 | 是：独立副本对话框（S-17） |
| U-31 | Rewind picker | 按 turn 列表 | 时间线选择 | 是 |
| U-32 | Jump overlay | `/jump` | 同 | 是 |
| U-33 | Block viewer | 全屏块 | modal | 是 |
| U-34 | Question view | B-10 | 同组件 | 是：提问卡（B-10） |
| U-35 | Permission view | B-01 | 同 | 是：权限卡（B-01） |
| U-36 | Plan approval | B-15 | 同 | 是：Plan 审批（B-15） |
| U-37 | Overlay 通用 | `overlay` / `overlay_list` / `picker` / `modal` / `modal_window` | 设计系统 Dialog | 是 |
| U-38 | List pane | 通用列表 | 同 | 否（N/A）：不单独做通用列表控件 |
| U-39 | Prompt widget | textarea 实现 | I- | 是：composer textarea（I-） |
| U-40 | Prompt suggestion | I-13 | 同 | 是：幽灵字（I-13） |
| U-41 | Suggestion controller | 补全状态机 | 同 | 是：slash/@/suggest 状态机 |
| U-42 | Context bar | 上下文占用 | 顶栏百分比 | 是：用量弹层（顶栏不画） |
| U-43 | Credit bar | 额度 | 顶栏 | 否。**备注：额度条 待讨论后再做。** |
| U-44 | Status bar | 模型、mode、YOLO 芯片、plan 芯片 | 顶栏 chips | 是：输入框模型/effort/模式芯片 |
| U-45 | Session title | 标题组件 | 顶栏 | 是 |
| U-46 | Privacy banner | 未同意时 | 横幅 | 是：同意横幅 |
| U-47 | Progress bar | 通用/终端 OSC 进度 | CSS；浏览器不画 OSC | 否（N/A）：不画 OSC 进度 |
| U-48 | Tutorial | `/tutorial` 多主题 `→` 下一篇 | 文档 | 否。**备注：tutorial 待讨论后再做。** |
| U-49 | Announcements | 公告 | modal | 否。**备注：公告 待讨论后再做。** |
| U-50 | Welcome | A-13 | 落地页 | 是：落地 Welcome |
| U-51 | Dashboard | 09 | 路由 `/dashboard` | 是：`#/dashboard` |
| U-52 | Debug style | 开发 | 不做 | 否（不做） |
| U-53 | FPS / scroll HUD | 开发 | 不做 | 否（不做） |
| U-54 | Arg picker | palette 里补 slash 参数 | 第二步表单 | 是 |
| U-55 | Login 屏 | A- | `/login` | 是：登录屏 |
| U-56 | Startup failure 屏 | 画失败原因 | 全页错误 | 是 |
| U-57 | Paywall 屏 | 订阅 | 卡片 | 是：额度卡 |
| U-58 | BTW overlay | C-11 | 同 | 是：BTW 卡 |
| U-59 | Image overlay | C-32 | 同 | 是：图片灯箱 |
| U-60 | Video overlay | C-32 | 同 | 是：视频控件 |
| U-61 | Preview overlay | 文件/图预览 | 同 | 否。**备注：通用文件预览 待讨论后再做。** |
| U-62 | Gboom overlay | 彩蛋 | 不做 | 否（不做） |
| U-63 | Doctor view | R- | 诊断页 | 是：连不上的 doctor 页 |
| U-64 | Status line view | H- | 底栏 | 否（不做）：不画 TUI status line 脚本 |
