# 17 媒体、语音、通知、窗口标题

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| M-01 | `/imagine` | 文生图工具 | 时间线 `<img>`；prompt 可带图 | 否。**备注：`/imagine` 时间线卡 待讨论后再做。** |
| M-02 | `/imagine-video` | 分镜+image_to_video | `<video controls>` | 否。**备注：视频生成卡 待讨论后再做。** |
| M-03 | image_edit | | 同图 | 否。**备注：image_edit 待讨论后再做。** |
| M-04 | 粘贴/拖图 | I-24/25 | File/blob → ACP image | 是：粘贴/拖图（I-24/25） |
| M-05 | 图压缩通知 | `ImageCompressed` | toast | 是：压缩静默（C-44） |
| M-06 | 图丢弃通知 | `ImageDropped` | toast | 是：丢弃进系统行 |
| M-07 | Kitty 内联图 | 终端图形协议 | **不要**；用 `<img>` | 否（N/A） |
| M-08 | ffmpeg 内联视频 | pager worker | 浏览器解码 | 是：`<video controls>` |
| M-09 | chip 预览 overlay | hover | hover | 是：待发图 hover 缩略图 |
| M-10 | 语音 `/voice` | STT；pager 用共享 AuthManager 直连 API，**不经 ACP session** | Web Audio MediaRecorder → 同一 STT API 或新增 ACP 扩展。不要假设现有 session 方法 | 否。**备注：语音听写 待讨论后再做。** |
| M-11 | Ctrl+Space / F8 | toggle 或 hold（要 key-release） | pointer 按住；移动端按钮 | 否。**备注：见上。** |
| M-12 | 关快捷键 | `voice_keybind_enabled` | 同 | 否。**备注：见上。** |
| M-13 | STT 语言 | G-41 | 同表 | 否。**备注：见上。** |
| M-14 | 录音行 [stop] | | 按钮 | 否。**备注：见上。** |
| M-15 | Esc 停录音 | steal-Esc | 同 | 否。**备注：见上。** |
| M-16 | 桌面通知 | TurnComplete、ApprovalRequired、SessionReady、TaskComplete、AgentError | `Notification` API + 焦点时抑制 | 部分：hidden 时 TurnComplete 走 Notification（标题会话名，正文「回合已结束」）。本轮测试机 Chrome 管理员锁 Block，未见到系统 toast。不做页内 toast。 |
| M-17 | 通知方法/协议 | OSC / 终端 / tmux / hook 命令 | 只用 Web Notification + 可选 hook（Agent 侧） | 是：只用 Web Notification，不走 OSC |
| M-18 | 仅失焦通知 | `only_unfocused`；focus tracker | `document.hidden` | 否。**备注：仅失焦通知 待讨论后再做。** |
| M-19 | 权限通知去重 | 一批一次 | 同 | 是：权限通知去重（B-17） |
| M-20 | 窗口标题 | TitleManager 会话名/状态 | `document.title` | 是：跑 turn 标题「运行中 · 会话名」，闲回会话名。 |
| M-21 | OSC 9;4 进度 | Ghostty 进度条 5s keepalive | 不用 OSC；可用 `navigator.setAppBadge` | 否（N/A） |
| M-22 | 抑制睡眠 | SleepInhibitor 跑 turn 时 | Wake Lock API | 否。**备注：Wake Lock 待讨论后再做。** |
| M-23 | 通知 hook 命令 | 本机脚本 | 仍在 Agent/TUI 配置；Web 可不做 | Agent 已有 |
| M-24 | 离开再回来 recap | focus + `session_recap_threshold` | Visibility API | 是：Visibility 触发 recap（S-21） |
| M-25 | `contextual_hints.image_input` | tip | 同 | 否（不做） |
| M-26 | wrap clipboard image | 特殊粘贴路径 | paste 事件足够 | 是：paste 事件 |
| M-27 | 声音输出 TTS | 若有 | Web Speech / 音频 URL | 否。**备注：TTS 待讨论后再做。** |
