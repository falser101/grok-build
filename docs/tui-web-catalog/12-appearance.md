# 12 外观、主题、Minimal、pager.toml

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| V-01 | 主题 GrokNight | 默认暗，16/256 可量化 | CSS 变量映射槽 | 部分：深色 token |
| V-02 | 主题 GrokDay | 亮 | `prefers-color-scheme` 或手动 | 是（浅色 token） |
| V-03 | TokyoNight | 需 truecolor | Web 真彩无压力 | 否 |
| V-04 | Rose Pine Moon | 需 truecolor | 同 | 否 |
| V-05 | Oscura Midnight | 需 truecolor | 同 | 否 |
| V-06 | theme=auto | 跟 OS：macOS/Linux portal/Windows；SSH `GROK_APPEARANCE`/`LC_*`；OSC 11 | `prefers-color-scheme` + 手动覆盖 | 是（默认跟随系统，设置可锁深色/浅色） |
| V-07 | auto_dark/light_theme | 映射具体主题 | 设置两套 | 否 |
| V-08 | `/theme` 预览 | 箭头即时预览，Esc 还原 | 悬停预览 | 否 |
| V-09 | GROK_THEME env | 强制 | Web 用 localStorage | 否 |
| V-10 | NO_COLOR | 单色 | 尊重；Web 少见 | 否 |
| V-11 | 颜色量化 | 启动按 16/256/truecolor | 不需要 | 否（N/A） |
| V-12 | 光标 OSC 12 | 会话中改终端光标为 accent_user，退出 OSC 112 | CSS caret-color | 否 |
| V-13 | Compact mode | `/compact-mode`，≤20 行自动开 | `--density compact` | 否 |
| V-14 | 主题槽 | bg_*、accent_*、text、gray、semantic、border、paste、diff、md_* | 一份 tokens.css | 否 |
| V-15 | 语法 tmTheme | 三套内置 | shiki 映射 | 否 |
| V-16 | screen_mode | fullscreen/minimal 默认，restart | Web 单一 DOM | 否（N/A） |
| V-17 | `/minimal` 重 exec | 环境变量一次性 | 不做 | 否（不做） |
| V-18 | Minimal 固定调色 | 终端 16 色，无视 theme | 不做 | 否（N/A） |
| V-19 | `--no-alt-screen` | 仍算 fullscreen 命令集 | N/A | 否（N/A） |
| V-20 | `[terminal] alt_screen` | auto/always/never | N/A | 否（N/A） |
| V-21 | pager.toml layout | outer_vpad、hpad、block_pad | CSS padding | 否 |
| V-22 | scrollbar 节 | | CSS | 否 |
| V-23 | scroll 节 | margin、min_page_fraction、follow_*、anchor_on_fold、respect_manual_folds | JS 滚动逻辑 | 否 |
| V-24 | display 节 | sticky、tab_width、›、❙、dim_accent、line_under、selection_buttons | CSS | 否 |
| V-25 | animation fps/wave | 1-60；TUI CPU | CSS 动画即可，不要 60fps 全页重绘 | 否 |
| V-26 | blocks.edit | indent、vpad、hunk_separator、dual_line_numbers、line_summary、bg | diff 组件 props | 否 |
| V-27 | blocks.thinking | accent、animate、truncated、bg_blend、header | details | 否 |
| V-28 | blocks.tool | muted_collapsed、dim_details、bullet 八种 | CSS | 否 |
| V-29 | blocks.execute | first/last lines、accent、header_style、muted_command | pre 折叠 | 否 |
| V-30 | blocks.prompt | vpad、bg、prefix、min_lines | 气泡 | 否 |
| V-31 | prompt 节 | collapse_unfocused、mouse_hover、show_prefix | CSS | 否 |
| V-32 | todo badge_format | default/colon/comma | 格式化函数 | 否 |
| V-33 | plugins UI disable | `disable_plugins` 藏命令与注解 | 同 | 否 |
| V-34 | max_thoughts_width | 40-500 列 | max-width ch | 否 |
| V-35 | show_thinking_blocks | | C-03 | 否 |
| V-36 | show_timestamps | | C-36 | 否 |
| V-37 | show_timeline | | C-24 | 否 |
| V-38 | page_flip_on_send | | C-27 | 否 |
| V-39 | group_tool_verbs | | C-37 | 否 |
| V-40 | collapsed_edit_blocks | | T-08 | 否 |
| V-41 | display_refresh_auto_cadence | 高刷 >60Hz；restart；Minimal 藏 | `requestAnimationFrame` 即可 | 否 |
| V-42 | Doctor 颜色级别 | 报告 truecolor/256/16 | Web 总是真彩 | 否（N/A） |
| V-43 | 系统外观轮询 5s | 桌面 API | matchMedia listener 一次即可 | 是（matchMedia change） |
| V-44 | wrap ssh 传 LC_GROK_APPEARANCE | SSH 主题 | N/A | 否（N/A） |
| V-45 | 小屏自动 compact | 20 行 | 窄视口 media query | 否 |
| V-46 | `contextual_hints.small_screen` | tip | 可做 | 否 |
