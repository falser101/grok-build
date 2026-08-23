# 07 Slash 命令（全量）

两类：

- **P** = pager 本地（`xai-grok-pager` `builtin_commands()`）。多数不经过 Agent。
- **S** = shell ACP（`slash_commands.rs` `BUILTIN_COMMANDS` + skills）。`session/prompt` 文本 `/foo` 或 `availableCommands`。

Pager 会先拦截同名。Web 必须自己实现所有 **P**，**S** 发给 Agent。

可见性：Minimal 隐藏 dashboard/find/jump/timeline/theme/tutorial/workflows；全屏隐藏 expand/edit-prompt。

## Pager 本地

| ID | 命令 | 别名 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|---|
| /P-exit | `/exit` | `/quit` | 退出进程 | 关 WS / 关页；不要杀用户机器上的别的 grok | 是 |
| /P-help | `/help` | | 帮助 | 打开本目录或内置帮助页 | 是 |
| /P-docs | `/docs` | `/howto` `/guides` | 指南 picker；`web` 开 docs.x.ai；标题跳转 | iframe 或外链 | 是 |
| /P-home | `/home` | `/welcome` | 回 Welcome | 回会话列表 | 是 |
| /P-delete | `/delete` | | 确认后删历史 | S-10 | 是 |
| /P-new | `/new` | `/clear` | 新会话 | S-01 | 是 |
| /P-fork | `/fork` | | 分支 | S-12 | 是 |
| /P-compact | `/compact` | | 也是 S；pager 包装 | 发给 Agent | 是 |
| /P-copy | `/copy` | | C-21 | 剪贴板/下载 | 是 |
| /P-find | `/find` | | 全屏搜索 | C-22 | 是 |
| /P-history | `/history` | | 历史模糊 | I-15 | 是 |
| /P-export | `/export` | | 导出 | S-22 | 是 |
| /P-transcript | `/transcript` | | 原始记录 | S-23 | 是 |
| /P-edit-prompt | `/edit-prompt` | | Minimal 外部编辑空草稿 | I-26；全屏可藏 | 否 |
| /P-expand | `/expand` | | Minimal 展开块 | 全屏用折叠手势 | 否 |
| /P-context | `/context` | | 也是 S | 发给 Agent 或画 `/context` UI | 是 |
| /P-minimal | `/minimal` | | 重 exec Minimal | **Web 不做**双渲染模式 | 否（不做） |
| /P-fullscreen | `/fullscreen` | `/full` | 重 exec 全屏 | 不做 | 否（不做） |
| /P-model | `/model` `/m` | | picker 或名字+effort | `session/setModel`；下拉 | 是 |
| /P-effort | `/effort` | | low/medium/high/xhigh | 发给 Agent | 是 |
| /P-always-approve | `/always-approve` | `/yolo` | toggle；已开再跑则关。与 `/auto` 互切 | S 命令 + 徽章 | 是 |
| /P-auto | `/auto` | | classifier 模式；功能关则菜单藏 | 同 | 是 |
| /P-multiline | `/multiline` | `/ml` | I-02 | 前端 toggle | 是 |
| /P-compact-mode | `/compact-mode` | | 少 padding，写 `[ui].compact_mode` | CSS 密度 | 是 |
| /P-vim-mode | `/vim-mode` | | 滚动 vim 键，写 `[ui].vim_mode` | 可选；P0 否 | 否（不做） |
| /P-hooks | `/hooks` | | 扩展模态 Hooks 页 | E- | 菜单可见/轻提示 |
| /P-plugins | `/plugins` | | Plugins 页 | E- | 菜单可见/轻提示 |
| /P-marketplace | `/marketplace` | | Marketplace 页 | E- | 菜单可见/轻提示 |
| /P-skills | `/skills` | | Skills 页 | E- | 菜单可见/轻提示 |
| /P-share | `/share` | | S-24 | 扩展 | 是 |
| /P-session-info | `/session-info` | `/status` `/info` | S-07 | 同 | 是 |
| /P-rename | `/rename` | `/title` | S-08 | 同 | 是 |
| /P-dashboard | `/dashboard` | `/agents-dashboard` `/sessions` | D-；Minimal 藏；`GROK_AGENT_DASHBOARD=0` 关 | 会话列表页（磁盘而非进程 roster） | 菜单可见/轻提示 |
| /P-cd | `/cd` | | S-31 | 慎 | 是 |
| /P-theme | `/theme` `/t` | | picker 实时预览；无参循环；Minimal 无 | CSS 主题切换 | 是 |
| /P-feedback | `/feedback` | | 也是 S；无参开面板 | B-16 | 是 |
| /P-announcements | `/announcements` | | 公告 modal | 拉远程公告或静态 | 否 |
| /P-remember | `/remember` | | 立即记一条（不经 summary） | 发给 Agent | 否 |
| /P-plan | `/plan` | | 进 plan 模式 | `session/set_mode` / 工具 | 否 |
| /P-view-plan | `/view-plan` | `/show-plan` `/plan-view` | 预览已存计划 | modal | 否 |
| /P-resume | `/resume` | | picker | S-06 | 是 |
| /P-mcps | `/mcps` | | MCP 模态 | E- | 菜单可见/轻提示 |
| /P-workflows | `/workflows` | | 运行中 dashboard | X- | 菜单可见/轻提示 |
| /P-btw | `/btw` | | 旁路问；Minimal 面板 | C-11 | 是 |
| /P-recap | `/recap` | | S-21 | 扩展 `x.ai/recap` | 是 |
| /P-doctor | `/doctor` | `/terminal-setup` 等 | R- | Web 只做「连不上 serve」诊断 | 是 |
| /P-voice | `/voice` | | 开听写 | M- | 菜单可见/轻提示 |
| /P-loop | `/loop` | | 也是 S prompt 命令 | 发给 Agent | 是 |
| /P-imagine | `/imagine` | | 文生图 | 当 prompt/工具 | 菜单可见/轻提示 |
| /P-imagine-video | `/imagine-video` | | 文生视频 | 同 | 否 |
| /P-timestamps | `/timestamps` | | C-36 | 前端 | 是 |
| /P-timeline | `/timeline` | | C-24 | 前端 | 是 |
| /P-mouse | `/toggle-mouse-reporting` | | 关鼠标上报 | N/A | 否（N/A） |
| /P-settings | `/settings` | `/config` `/preferences` `/prefs` | F2 | 设置页 G- | 是 |
| /P-privacy | `/privacy` | | coding data | A-12 | 否 |
| /P-rewind | `/rewind` | `/undo` | S-13 | 同 | 是 |
| /P-jump | `/jump` | | C-23 | 同 | 是 |
| /P-login | `/login` | | A-07 | 同 | 是 |
| /P-logout | `/logout` | | A-07 | 同 | 是 |
| /P-import-claude | `/import-claude` | | 导入模态 | U- | 菜单可见/轻提示 |
| /P-usage | `/usage` | `/cost` | 额度；`manage` 开计费 | 扩展 `x.ai` usage/billing | 否 |
| /P-queue | `/queue` | | I-20 | 同 | 是 |
| /P-tasks | `/tasks` | | 任务面板 Ctrl+G | X- | 菜单可见/轻提示 |
| /P-release-notes | `/release-notes` | `/changelog` | 当前版本说明 | 静态/远程 | 否 |
| /P-tutorial | `/tutorial` | `/tour` `/onboarding` | 主题列表 ~30s；不自动弹 | 文档页 | 否 |
| /P-config-agents | `/config-agents` | `/agents` | 定义/persona，不是 Dashboard | U-agents modal | 菜单可见/轻提示 |
| /P-personas | `/personas` | | 建/改/删 persona | 同 | 菜单可见/轻提示 |
| /P-gboom | `/gboom` | | 隐藏 Kitty 射线彩蛋，不进菜单 | **不要做** | 否（不做） |
| /P-scroll-debug | `/scroll-debug` | | 隐藏 HUD | 不做 | 否（不做） |
| /P-debug | `/debug` | | scroll/fps/log；仅 debug 二进制进菜单 | 不做 | 否（不做） |

## Shell ACP（发给 Agent）

| ID | 命令 | 别名 | 门闩 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|---|---|
| /S-compact | `/compact` | | Always | 压缩上下文 | session prompt | 是 |
| /S-yolo | `/always-approve` | `/yolo` | Always | on\|off | 同 | 是 |
| /S-flush | `/flush` | | Memory | 立刻写记忆 | 同 | 是 |
| /S-dream | `/dream` | | Memory | 记忆整理 | 同 | 是 |
| /S-memory | `/memory` | `/mem` | MemoryConfigured | on\|off 或浏览模态 | 同 | 是 |
| /S-context | `/context` | | Always | token 分解 | 同 | 是 |
| /S-hooks-trust | `/hooks-trust` | | Hooks | pager 折进 `/hooks` | 模态或原命令 | 否 |
| /S-hooks-list | `/hooks-list` | | Hooks | 上 | 同 | 否 |
| /S-hooks-add | `/hooks-add` | | Hooks | 路径 | 同 | 否 |
| /S-hooks-remove | `/hooks-remove` | | Hooks | 路径 | 同 | 否 |
| /S-hooks-untrust | `/hooks-untrust` | | Hooks | | 同 | 否 |
| /S-plugins | `/plugins` | `/plugin` | Plugins | list/reload/trust/add/remove/install/uninstall/update | 模态为主 | 否 |
| /S-reload-plugins | `/reload-plugins` | | Plugins | = plugins reload | 同 | 否 |
| /S-session-info | `/session-info` | `/status` `/info` | Always | | 同 | 是 |
| /S-feedback | `/feedback` | | Feedback | 关则藏 | 同 | 是 |
| /S-deep-research | `/deep-research` | | WorkflowLaunches | 立刻返回，进度 `/workflows` | 同 | 否 |
| /S-workflow | `/workflow` | | WorkflowManagement | launch / pause/resume/stop/save | 同 | 否 |
| /S-goal | `/goal` | | Goal | objective、`--budget`、status/pause/resume/clear | 同 | 否 |
| /S-loop | `/loop` | | Scheduler | 走 PROMPT_COMMANDS 特殊路径 | 同 | 是 |

## Skills 作为 slash

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| /K-01 | user-invocable skill | SKILL.md `user-invocable: true` 出现在菜单。关 skill 则消失。 | 用 `availableCommands` 动态列表，不要写死。 | 是 |
| /K-02 | 名字碰撞 | 内置赢短名；skill `/local:name` `/user:name` `/plugin:name`。双徽章。 | 同规则。 | 是 |
| /K-03 | AvailableCommandsUpdate | 会话中途技能变化会推更新。 | 订阅更新刷新菜单。 | 是 |
