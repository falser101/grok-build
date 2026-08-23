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
| U-07 | Settings modal | F2 / `Ctrl+,` / `Cmd+,` | 见 14-settings | 入口 |
| U-08 | Theme picker | `/theme` 实时预览，Esc 还原 | 设置里即时换 CSS | 否 |
| U-09 | Model picker | `Ctrl+M`（非 prompt 焦点） | 顶栏下拉 | 是 |
| U-10 | Session picker | U 见 S-06 | 全屏路由 `/sessions` | 是 |
| U-11 | File search dropdown | I-11 | combobox | 否 |
| U-12 | File line viewer | `@` 结果看行 | modal | 否 |
| U-13 | Slash dropdown | I-09 | combobox | 是 |
| U-14 | Completion dropdown | 通用补全 | 同 | 否 |
| U-15 | History search | `/history` | 同 | 否 |
| U-16 | Queue pane | I-20 | 侧栏 | 是 |
| U-17 | Todo pane | `Ctrl+T`；`[todo] badge_format` default/colon/comma | 侧栏 checklist；ACP plan entries → todo | 否 |
| U-18 | Tasks pane | `Ctrl+G` 全屏 | 后台任务列表 | 入口 |
| U-19 | Workflows overlay | `/workflows` 运行中，非定义目录 | 见 X | 入口 |
| U-20 | Subagent catalog pane | 子 agent 目录 | 抽屉 | 入口 |
| U-21 | Goal detail | `goal_detail` | 页 | 否 |
| U-22 | Persona detail | `persona_detail` | 页 | 否 |
| U-23 | Agents modal | `/config-agents` 定义、默认、切换 | 设置页 | 否 |
| U-24 | Extensions modal | hooks/plugins/marketplace/skills 四 tab；非 VS Code `Ctrl+L` | 四 tab 页。VS Code 家族 TUI 把 Ctrl+L 给了 interject | 入口 |
| U-25 | MCP modal | `/mcps` | 见 E | 入口 |
| U-26 | Memory modal | `/memory` 浏览文件 | 文件列表+内容 | 否 |
| U-27 | Usage modal | `/usage` | 额度/账单 | 否 |
| U-28 | Privacy | `/privacy` | A-12 | 否 |
| U-29 | Import Claude modal | 权限/env/MCP/hooks/paths 多选确认 | 向导 | 否 |
| U-30 | New worktree dialog | label、ref | 对话框 | 否 |
| U-31 | Rewind picker | 按 turn 列表 | 时间线选择 | 是 |
| U-32 | Jump overlay | `/jump` | 同 | 是 |
| U-33 | Block viewer | 全屏块 | modal | 是 |
| U-34 | Question view | B-10 | 同组件 | 否 |
| U-35 | Permission view | B-01 | 同 | 否 |
| U-36 | Plan approval | B-15 | 同 | 否 |
| U-37 | Overlay 通用 | `overlay` / `overlay_list` / `picker` / `modal` / `modal_window` | 设计系统 Dialog | 是 |
| U-38 | List pane | 通用列表 | 同 | 否 |
| U-39 | Prompt widget | textarea 实现 | I- | 否 |
| U-40 | Prompt suggestion | I-13 | 同 | 否 |
| U-41 | Suggestion controller | 补全状态机 | 同 | 否 |
| U-42 | Context bar | 上下文占用 | 顶栏百分比 | 是 |
| U-43 | Credit bar | 额度 | 顶栏 | 否 |
| U-44 | Status bar | 模型、mode、YOLO 芯片、plan 芯片 | 顶栏 chips | 是 |
| U-45 | Session title | 标题组件 | 顶栏 | 是 |
| U-46 | Privacy banner | 未同意时 | 横幅 | 否 |
| U-47 | Progress bar | 通用/终端 OSC 进度 | CSS；浏览器不画 OSC | 否 |
| U-48 | Tutorial | `/tutorial` 多主题 `→` 下一篇 | 文档 | 否 |
| U-49 | Announcements | 公告 | modal | 否 |
| U-50 | Welcome | A-13 | 落地页 | 否 |
| U-51 | Dashboard | 09 | 路由 `/dashboard` | 入口 |
| U-52 | Debug style | 开发 | 不做 | 否（不做） |
| U-53 | FPS / scroll HUD | 开发 | 不做 | 否（不做） |
| U-54 | Arg picker | palette 里补 slash 参数 | 第二步表单 | 是 |
| U-55 | Login 屏 | A- | `/login` | 否 |
| U-56 | Startup failure 屏 | 画失败原因 | 全页错误 | 是 |
| U-57 | Paywall 屏 | 订阅 | 卡片 | 否 |
| U-58 | BTW overlay | C-11 | 同 | 否 |
| U-59 | Image overlay | C-32 | 同 | 入口 |
| U-60 | Video overlay | C-32 | 同 | 入口 |
| U-61 | Preview overlay | 文件/图预览 | 同 | 否 |
| U-62 | Gboom overlay | 彩蛋 | 不做 | 否（不做） |
| U-63 | Doctor view | R- | 诊断页 | 入口 |
| U-64 | Status line view | H- | 底栏 | 否 |
