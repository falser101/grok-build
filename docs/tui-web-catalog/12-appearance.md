# 12 外观、主题、Minimal、pager.toml

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| V-01 | 主题 GrokNight | 默认暗，16/256 可量化 | CSS 变量映射槽 | 是：深色 token |
| V-02 | 主题 GrokDay | 亮 | `prefers-color-scheme` 或手动 | 是（浅色 token） |
| V-03 | TokyoNight | 需 truecolor | Web 真彩无压力 | 否。**备注：TokyoNight 第三主题 待讨论后再做。** |
| V-04 | Rose Pine Moon | 需 truecolor | 同 | 否。**备注：Rose Pine 待讨论后再做。** |
| V-05 | Oscura Midnight | 需 truecolor | 同 | 否。**备注：Oscura 待讨论后再做。** |
| V-06 | theme=auto | 跟 OS：macOS/Linux portal/Windows；SSH `GROK_APPEARANCE`/`LC_*`；OSC 11 | `prefers-color-scheme` + 手动覆盖 | 是：设置三钮「跟随系统 / 深色 / 浅色」即时整页换；默认 auto |
| V-07 | auto_dark/light_theme | 映射具体主题 | 设置两套 | 否（N/A）：Web 只有深/浅/跟随系统 |
| V-08 | `/theme` 预览 | 箭头即时预览，Esc 还原 | 悬停预览 | 是：`/theme` 同 store；点选预览，Esc 还原；设置三钮即时换 |
| V-09 | GROK_THEME env | 强制 | Web 用 localStorage | 是：localStorage `grok-web.theme`；`/theme` 与设置共用 `applyTheme` |
| V-10 | NO_COLOR | 单色 | 尊重；Web 少见 | 否（N/A） |
| V-11 | 颜色量化 | 启动按 16/256/truecolor | 不需要 | 否（N/A） |
| V-12 | 光标 OSC 12 | 会话中改终端光标为 accent_user，退出 OSC 112 | CSS caret-color | 是：CSS caret-color |
| V-13 | Compact mode | `/compact-mode`，≤20 行自动开 | `--density compact` | 是：`/compact-mode` 开关 `data-compact` + `grok-web.compact-mode` |
| V-14 | 主题槽 | bg_*、accent_*、text、gray、semantic、border、paste、diff、md_* | 一份 tokens.css | 是：style.css 变量；思考/工具/composer/侧栏走 token |
| V-15 | 语法 tmTheme | 三套内置 | shiki 映射 | 部分：轻量 tokenizer。**备注：不引入 shiki。** |
| V-16 | screen_mode | fullscreen/minimal 默认，restart | Web 单一 DOM | 否（N/A） |
| V-17 | `/minimal` 重 exec | 环境变量一次性 | 不做 | 否（不做） |
| V-18 | Minimal 固定调色 | 终端 16 色，无视 theme | 不做 | 否（N/A） |
| V-19 | `--no-alt-screen` | 仍算 fullscreen 命令集 | N/A | 否（N/A） |
| V-20 | `[terminal] alt_screen` | auto/always/never | N/A | 否（N/A） |
| V-21 | pager.toml layout | outer_vpad、hpad、block_pad | CSS padding | 部分：现有 padding。**备注：不暴露 pager.toml 细项。** |
| V-22 | scrollbar 节 | | CSS | 是：对话区隐藏原生条 |
| V-23 | scroll 节 | margin、min_page_fraction、follow_*、anchor_on_fold、respect_manual_folds | JS 滚动逻辑 | 是：follow / page_flip / 折叠锚点（C-） |
| V-24 | display 节 | sticky、tab_width、›、❙、dim_accent、line_under、selection_buttons | CSS | 部分：tab-size、折叠指示。**备注：不暴露全部 display 键。** |
| V-25 | animation fps/wave | 1-60；TUI CPU | CSS 动画即可，不要 60fps 全页重绘 | 是：CSS 动画，不全页 60fps 重绘 |
| V-26 | blocks.edit | indent、vpad、hunk_separator、dual_line_numbers、line_summary、bg | diff 组件 props | 部分：HTML diff（C-05） |
| V-27 | blocks.thinking | accent、animate、truncated、bg_blend、header | details | 是：thinking details（C-03） |
| V-28 | blocks.tool | muted_collapsed、dim_details、bullet 八种 | CSS | 是：工具卡 CSS |
| V-29 | blocks.execute | first/last lines、accent、header_style、muted_command | pre 折叠 | 是：execute 截断（C-06） |
| V-30 | blocks.prompt | vpad、bg、prefix、min_lines | 气泡 | 是：用户气泡 |
| V-31 | prompt 节 | collapse_unfocused、mouse_hover、show_prefix | CSS | 是：composer hover/焦点 |
| V-32 | todo badge_format | default/colon/comma | 格式化函数 | 否。**备注：todo badge 待讨论后再做。** |
| V-33 | plugins UI disable | `disable_plugins` 藏命令与注解 | 同 | 否。**备注：disable_plugins UI 待讨论后再做。** |
| V-34 | max_thoughts_width | 40-500 列 | max-width ch | 否。**备注：max_thoughts_width 设置 待讨论后再做。** |
| V-35 | show_thinking_blocks | | C-03 | 是：设置「显示思考」 |
| V-36 | show_timestamps | | C-36 | 是：设置时间戳 |
| V-37 | show_timeline | | C-24 | 是：设置时间线 |
| V-38 | page_flip_on_send | | C-27 | 是：发送置顶 |
| V-39 | group_tool_verbs | | C-37 | 是：设置合并只读工具 |
| V-40 | collapsed_edit_blocks | | T-08 | 否。**备注：collapsed_edit_blocks 待讨论后再做。** |
| V-41 | display_refresh_auto_cadence | 高刷 >60Hz；restart；Minimal 藏 | `requestAnimationFrame` 即可 | 否（N/A）：rAF 即可 |
| V-42 | Doctor 颜色级别 | 报告 truecolor/256/16 | Web 总是真彩 | 否（N/A） |
| V-43 | 系统外观轮询 5s | 桌面 API | matchMedia listener 一次即可 | 是：`prefers-color-scheme` change 时 auto 重 applyTheme |
| V-44 | wrap ssh 传 LC_GROK_APPEARANCE | SSH 主题 | N/A | 否（N/A） |
| V-45 | 小屏自动 compact | 20 行 | 窄视口 media query | 部分：窄屏侧栏可折。**备注：自动 compact 阈值 {NOTE}。** |
| V-46 | `contextual_hints.small_screen` | tip | 可做 | 否（不做）：不弹小屏 tip |
