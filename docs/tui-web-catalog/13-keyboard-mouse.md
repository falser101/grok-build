# 13 键盘、鼠标、选区、Esc

Web **不要** 1:1 复制终端改键矩阵。语义对齐 + 屏幕按钮。下表每条仍列出 TUI 和弦，便于对照。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| K-01 | Simple 滚动导航 | ↑↓ 条目；Shift+←→ turn；PgUp/Dn 页；Ctrl+J/K 行；Ctrl+U/D 半页（VS Code 半页下是 Shift+D） | 原生滚动为主；可选 j/k | 否 |
| K-02 | Vim 滚动 | `vim_mode`：j/k、H/L turn、J/K 回复、g/G、h/l 折、e/E、y/Y、o/O、r、x、i 插入 | 可选 keymap 包。默认关 | 否 |
| K-03 | 字母抢焦点 | simple 下滚动焦点按字母 → 聚焦 prompt 并输入 | 底部输入常驻，不需要 | 否（N/A） |
| K-04 | Tab 焦点 | 见 I-05、B- | 浏览器 Tab 走焦点环；卡打开时 trap | 否 |
| K-05 | Esc 阶梯 | 文档 03：overlay 先吃；再 cancel/clear/rewind。全屏 vim 运行中 Esc **不**取消。Minimal/非 vim Esc 立即取消并留草稿。取消中 Esc 重发 cancel。idle 非空双 Esc 清。idle 空+有消息双 Esc rewind。grace 1s。 | 实现同一状态机，快捷键可用 Esc 或按钮 | 否 |
| K-06 | Ctrl+C | 非空先清草稿；空取消；取消中再按趋向退出 | Stop 按钮 ≠ 清输入 | 否 |
| K-07 | Ctrl+P palette | | ⌘/Ctrl+K 更符合 Web | 否 |
| K-08 | Ctrl+M | prompt：multiline；否则模型 picker | 拆两个按钮 | 否 |
| K-09 | Ctrl+O YOLO | | 按钮 | 否 |
| K-10 | Ctrl+S picker | | 会话列表路由 | 否 |
| K-11 | Ctrl+; 队列 | macOS VS Code：Ctrl+4 | 侧栏 | 否 |
| K-12 | Shift+Tab 模式 | | 分段控件 | 否 |
| K-13 | Ctrl+B 后台 | 前台命令转后台 | 任务按钮 | 否 |
| K-14 | Ctrl+T todos | | 侧栏 | 否 |
| K-15 | Ctrl+G | 全屏 tasks；Minimal 外编 | 任务页 | 否 |
| K-16 | Ctrl+L | 非 VS Code：扩展模态；VS Code 家族：interject | 永不绑 Ctrl+L（浏览器焦点地址栏）。按钮 | 否 |
| K-17 | Ctrl+. / Ctrl+X 速查 | 无 KKP 用 Ctrl+X | `?` | 否 |
| K-18 | F2 设置 | Ctrl+, / Cmd+, | `g ,` 或齿轮 | 否 |
| K-19 | Ctrl+N 新会话 | 双击 1s | 按钮 | 否 |
| K-20 | Ctrl+\ Dashboard | | 路由 | 否 |
| K-21 | Ctrl+Q / Ctrl+D 退出 | VS Code 只用 Ctrl+D | 关页 | 否 |
| K-22 | Send now 和弦 | Ctrl+Enter / Ctrl+I / Apple Ctrl+O / VS Code Ctrl+L | Ctrl+Enter | 否 |
| K-23 | WezTerm Kitty kb | 文档长段 | N/A | 否（N/A） |
| K-24 | 双击确认破坏操作 | 1s 内两次：新会话、退出 | modal confirm | 否 |
| K-25 | Welcome 专用键 | Ctrl+S/W/I/Shift+I | 按钮 | 否 |
| K-26 | Dashboard 键 | 见 D- | 同 | 否 |
| K-27 | 提问卡键 | 见 B-10 | 同 | 否 |
| K-28 | 权限卡键 | 见 B- | 同 | 否 |
| K-29 | 取消面板键 | 见 B-13 | 同 | 否 |
| K-30 | 块 Enter 全屏 | | 双击块 | 否 |
| K-31 | y/Y 复制 | | 按钮/⌘C | 否 |
| K-32 | 鼠标点选条目 | | click | 否 |
| K-33 | 滚轮 | scroll_speed 1-100；scroll_mode auto/wheel/trackpad；scroll_lines 1-10；invert_scroll | 浏览器原生；invert 用 CSS | 否 |
| K-34 | 点 prompt 聚焦 | | 同 | 否 |
| K-35 | 中键 PRIMARY | Linux | 不做 | 否（N/A） |
| K-36 | 文本选择 flash | 松开闪一下；双击折 | 浏览器选区 | 否 |
| K-37 | 选择 hold | 保持到 Esc/点/滚 | 同 | 否 |
| K-38 | word_select | 双击词、三击段；复制 | 浏览器默认接近 | 否 |
| K-39 | Shift 拖 = 终端原生选 | 绕过 app 鼠标 | 浏览器无此层 | 否（N/A） |
| K-40 | `/toggle-mouse-reporting` | | N/A | 否（N/A） |
| K-41 | 点击超链接 | | `<a>` | 否 |
| K-42 | 点击折叠 › | | chevron | 否 |
| K-43 | hover 高亮 | | CSS | 否 |
| K-44 | 拖图片进 prompt | | drop | 否 |
| K-45 | macOS 修饰键 | `macos_modifiers` | Web 用 metaKey | 否 |
| K-46 | Kitty keyboard protocol | 探测 DA | N/A | 否（N/A） |
| K-47 | 键绑定不可重映射 | 文档写死 | Web 可后期做 keymap；P0 固定 | 否 |
| K-48 | 窄 shortcuts bar | 阻塞卡回卡 hint 不可剪 | 移动端底栏固定「返回提问」 | 否 |
| K-49 | PageUp/Dn 在 prompt 也滚对话 | 下拉开着则给下拉 | 输入聚焦时 PageUp 滚时间线 | 否 |
| K-50 | `contextual_hints.word_select` | 双击折时 tip 去设置 | 可做 | 否 |
| K-51 | SSH wrap clipboard | `grok ssh` OSC52 | N/A | 否（N/A） |
| K-52 | Windows Alt+V 图 | WT 拦截 Ctrl+V | paste 事件即可 | 否 |
| K-53 | Cmd+A Ghostty only | | 原生全选 | 否 |
| K-54 | 鼠标点 Dashboard `[✗]` | 确认删 | 同 | 否 |
| K-55 | 滚动飞行记录 `/debug log` | JSONL | 不做 | 否（不做） |
