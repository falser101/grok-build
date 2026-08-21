# 17 媒体、语音、通知、窗口标题

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| M-01 | `/imagine` | 文生图工具 | 时间线 `<img>`；prompt 可带图 | 否 |
| M-02 | `/imagine-video` | 分镜+image_to_video | `<video controls>` | 否 |
| M-03 | image_edit | | 同图 | 否 |
| M-04 | 粘贴/拖图 | I-24/25 | File/blob → ACP image | 否 |
| M-05 | 图压缩通知 | `ImageCompressed` | toast | 否 |
| M-06 | 图丢弃通知 | `ImageDropped` | toast | 否 |
| M-07 | Kitty 内联图 | 终端图形协议 | **不要**；用 `<img>` | 否（N/A） |
| M-08 | ffmpeg 内联视频 | pager worker | 浏览器解码 | 否 |
| M-09 | chip 预览 overlay | hover | hover | 否 |
| M-10 | 语音 `/voice` | STT；pager 用共享 AuthManager 直连 API，**不经 ACP session** | Web Audio MediaRecorder → 同一 STT API 或新增 ACP 扩展。不要假设现有 session 方法 | 否 |
| M-11 | Ctrl+Space / F8 | toggle 或 hold（要 key-release） | pointer 按住；移动端按钮 | 否 |
| M-12 | 关快捷键 | `voice_keybind_enabled` | 同 | 否 |
| M-13 | STT 语言 | G-41 | 同表 | 否 |
| M-14 | 录音行 [stop] | | 按钮 | 否 |
| M-15 | Esc 停录音 | steal-Esc | 同 | 否 |
| M-16 | 桌面通知 | TurnComplete、ApprovalRequired、SessionReady、TaskComplete、AgentError | `Notification` API + 焦点时抑制 | 否 |
| M-17 | 通知方法/协议 | OSC / 终端 / tmux / hook 命令 | 只用 Web Notification + 可选 hook（Agent 侧） | 否 |
| M-18 | 仅失焦通知 | `only_unfocused`；focus tracker | `document.hidden` | 否 |
| M-19 | 权限通知去重 | 一批一次 | 同 | 否 |
| M-20 | 窗口标题 | TitleManager 会话名/状态 | `document.title` | 否 |
| M-21 | OSC 9;4 进度 | Ghostty 进度条 5s keepalive | 不用 OSC；可用 `navigator.setAppBadge` | 否 |
| M-22 | 抑制睡眠 | SleepInhibitor 跑 turn 时 | Wake Lock API | 否 |
| M-23 | 通知 hook 命令 | 本机脚本 | 仍在 Agent/TUI 配置；Web 可不做 | Agent 已有 |
| M-24 | 离开再回来 recap | focus + `session_recap_threshold` | Visibility API | 否 |
| M-25 | `contextual_hints.image_input` | tip | 同 | 否 |
| M-26 | wrap clipboard image | 特殊粘贴路径 | paste 事件足够 | 否 |
| M-27 | 声音输出 TTS | 若有 | Web Speech / 音频 URL | 否 |
