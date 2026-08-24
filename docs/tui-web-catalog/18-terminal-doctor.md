# 18 终端、Doctor、剪贴板（多数 Web N/A）

这些是 TUI 为终端世界准备的。Web 客户端**不要**复刻，除非做「连不上本机 serve」的自检。

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| R-01 | `/doctor` | 终端/tmux/颜色/键盘/剪贴板/通知焦点/sandbox/麦克风 | 页面：serve 是否可达、WS 鉴权、session 是否 initialize。不要查 tmux | 是：连不上 serve 的 doctor 页（进程未起 / secret / 401） |
| R-02 | `grok doctor --json` | 管道 | 可选调试 | 否（N/A） |
| R-03 | `/doctor fix` | tmux-clipboard、dcs-passthrough、extended-keys、truecolor；改 conf 不 source | **不做** | 否（不做） |
| R-04 | 终端品牌探测 | Apple/Ghostty/iTerm/Warp/Wez/Kitty/Alacritty/Rio/foot/VSCode 家族/JetBrains/Grok Desktop/VTE/Windows Terminal | `navigator.userAgent` 仅调试 | 否（N/A） |
| R-05 | tmux/SSH 限制 | 外层变量丢 | N/A | 否（N/A） |
| R-06 | OSC 52 剪贴板 | 远程拷 | Clipboard API | 是：Clipboard API |
| R-07 | 拷贝备份文件 | `~/.grok/last-copy.txt` / `GROK_COPY_FILE` | 失败则 `<a download>` | 是：复制失败则 download |
| R-08 | 未确认 OSC52 toast | 提示备份路径 | N/A | 否（N/A） |
| R-09 | `grok ssh` OSC 包装 | | N/A | 否（N/A） |
| R-10 | `grok wrap` | PTY 包装 | N/A | 否（N/A） |
| R-11 | DA2 / xtversion / Kitty kb | 探测 | N/A | 否（N/A） |
| R-12 | 真彩/256/16 | | 总是真彩 | 否（N/A） |
| R-13 | 麦克风探测 | doctor 不真正录音 | `getUserMedia` 权限条 | 否。**备注：麦克风探测 待讨论后再做。** |
| R-14 | CSI/XT 过滤器 | 防泄漏进输入 | N/A | 否（N/A） |
| R-15 | 启动 type-ahead | A-26 | N/A | 否（N/A） |
| R-16 | 退出恢复终端 | alt-screen、鼠标、光标 | 关页即可 | 否（N/A） |
| R-17 | `--no-alt-screen` | | N/A | 否（N/A） |
| R-18 | 小屏 tip | | 响应式 | 是：窄屏侧栏可折 |
| R-19 | `contextual_hints.ssh_wrap` | | 不暴露 | 否（N/A） |
| R-20 | 滚动 debug | | 不做 | 否（不做） |
| R-21 | PTY 内嵌编辑器 | `embedded_editor` | 外链 vscode:// | 否。**备注：vscode:// 待讨论后再做。** |
| R-22 | WaitForTerminalExit | pager/headless **拒绝**，轮询 | 同，不要实现该方法 | 运输层已有 |
| R-23 | `x.ai/terminal/*` | create/kill/output；clientTerminal 能力 | 除非做 IDE 型，否则不宣称 terminal | 否（不做）：不宣称 terminal |
| R-24 | hyperlinks 打开 | 系统浏览器 | `window.open` / `<a target=_blank>` | 是：`<a target=_blank>` / window.open |
| R-25 | 剪贴板信任 | `clipboard/trust.rs` | HTTPS/localhost 才有 Clipboard API | 否 |
