# 20 底栏、Status Line、Credit、Tips

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| H-01 | Shortcuts bar | U-04 | 底 hint | 否 |
| H-02 | Status bar chips | 模型、effort、YOLO、plan、mode | 顶栏 | 否 |
| H-03 | Context bar | 占用 % | 顶栏；amber 在 compact 阈值或 80% | 部分：解析仍在；顶栏不画（模型/effort 在输入框） |
| H-04 | Credit bar | 额度 | 同 | 否 |
| H-05 | Turn status | 与 prompt 间距 | 「正在跑」 | 否 |
| H-06 | Watching 行 | 后台仍活 | 「1 monitor · 2 loops」 | 否 |
| H-07 | Status line 关 | `[ui.status_line] type=disabled` 默认 | 默认不画 | 否 |
| H-08 | Status line builtin | items: cwd, model, context, cost, turn-timer, session-name | 底栏拼段；cost&lt;$0.005 藏 | 否 |
| H-09 | Status line command | 脚本 stdin JSON，stdout ANSI/OSC8，最多 5 行，10s 超时，64KiB | **Web 跑用户脚本有 XSS 风险**。P3 才做；做则 iframe sandbox 或只 builtin | 否 |
| H-10 | Status line padding/refresh_interval | 见 user-guide 25 | builtin 够用 | 否 |
| H-11 | SessionStatus 通知 | 不持久 | 更新 H-08 | 部分：更新顶栏上下文 % |
| H-12 | 能力 x.ai/statusLine | 不宣称则 Agent 不推 | 要画就 initialize 宣称 | 是 |
| H-13 | Tips 启动 | G-35 | | 否 |
| H-14 | 情境 hints | G-42–48 | toast 一次 | 否 |
| H-15 | Send now tip | 队列 hold 时 | I-18 | 否 |
| H-16 | 小屏 tip | | | 否 |
| H-17 | Word select tip | | | 否 |
| H-18 | Plan nudge | | | 否 |
| H-19 | Undo tip | | | 否 |
| H-20 | Image input tip | | | 否 |
| H-21 | SSH wrap tip | | 不暴露 | 否（N/A） |
| H-22 | Clipboard focus tip | | | 否 |
| H-23 | Ephemeral tips | 见即门控 | localStorage seen | 否 |
| H-24 | Welcome toast | | | 否 |
| H-25 | 复制成功 toast | Copied! | | 否 |
| H-26 | Reconnecting 提示 | 「Reconnecting, please wait...」禁发送 | 顶条 | 否 |
| H-27 | 版本不匹配横幅 | leader | toast 升级 grok | 否 |
| H-28 | Privacy banner | | | 否 |
| H-29 | Startup warning | | | 否 |
| H-30 | Plugin 更新 toast | E-25 | | 否 |
| H-31 | 双 Esc 提示 | 「再按清输入」 | | 否 |
| H-32 | 破坏操作确认条 | 再按退出 | modal | 否 |
