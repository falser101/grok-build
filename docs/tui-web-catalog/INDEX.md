# 功能点计数

共 **863** 行功能点（含明确「不做 / N/A」）。不含 README 说明行。

| 文件 | 行数 | 前缀 |
|---|---|---|
| [01-transport-runtime.md](01-transport-runtime.md) | 16 | W- |
| [02-startup-auth-welcome.md](02-startup-auth-welcome.md) | 26 | A- |
| [03-sessions.md](03-sessions.md) | 35 | S- |
| [04-conversation.md](04-conversation.md) | 51 | C- |
| [05-composer.md](05-composer.md) | 38 | I- |
| [06-blocking-cards.md](06-blocking-cards.md) | 22 | B- |
| [07-slash-commands.md](07-slash-commands.md) | 92 | /P- /S- /K- |
| [08-screens-modals-panes.md](08-screens-modals-panes.md) | 64 | U- |
| [09-dashboard.md](09-dashboard.md) | 28 | D- |
| [10-permissions-plan.md](10-permissions-plan.md) | 22 | P- |
| [11-tools-blocks.md](11-tools-blocks.md) | 40 | T- |
| [12-appearance.md](12-appearance.md) | 46 | V- |
| [13-keyboard-mouse.md](13-keyboard-mouse.md) | 55 | K- |
| [14-settings.md](14-settings.md) | 54 | G- |
| [15-extensions.md](15-extensions.md) | 35 | E- |
| [16-subagents-tasks-workflows.md](16-subagents-tasks-workflows.md) | 38 | X- |
| [17-media-voice-notify.md](17-media-voice-notify.md) | 27 | M- |
| [18-terminal-doctor.md](18-terminal-doctor.md) | 25 | R- |
| [19-acp-wire.md](19-acp-wire.md) | 71 | Q- |
| [20-status-chrome.md](20-status-chrome.md) | 32 | H- |
| [21-config-sandbox-memory.md](21-config-sandbox-memory.md) | 46 | Z- |
| **合计** | **863** | |

## P0 建议勾选（能聊 + 能批准）

W-02 W-03 W-04 W-05 W-06 W-10 W-11  
A-04 A-05 A-06 A-07  
S-01 S-03 S-06 S-16  
C-01 C-02 C-03 C-04 C-05 C-06 C-26 C-34 C-35  
I-01 I-02 I-09 I-18 I-22 I-24  
B-01 B-05 B-06 B-10 B-13 B-15  
/P-new /P-exit /P-model /P-always-approve /P-settings  
Q-01–Q-11 Q-20 Q-21 Q-62  

其余按 README 分期。

实现入口：仓库 [`web/`](../../web/)（Slice 0：`grok agent serve` + 流式对话）。

## 「Web 已实现」当前取值约定

- `否`：本仓库无 Web UI。
- `运输层已有`：`grok agent serve` 或 ACP 方法已在 shell 里。
- `Agent 已有`：后端已做，前端未接。
- `否（N/A）`：Web 无对应表面（tmux、OSC、alt-screen…）。
- `否（不做）`：明确不移植（gboom、FPS HUD、xterm 套 TUI…）。

实现某行后把该单元格改成 `是` 或 `部分：…`。
