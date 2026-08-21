# 14 `/settings` 全量项

来源：`settings/defs.rs` `default_settings()`。Web 设置页按同一 key 分组。改 SHELL/SHARED 的应经 Agent 持久化到 `config.toml`；PAGER 会话级可只留前端。

| ID | key | 分类 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|---|
| G-01 | compact_mode | Appearance | 少 padding；≤20 行自动 | CSS density；persist `[ui]` | 否 |
| G-02 | screen_mode | Appearance | fullscreen/minimal，restart | **不要暴露** | 否（N/A） |
| G-03 | show_timestamps | Appearance | 时钟 | 前端+persist | 否 |
| G-04 | show_timeline | Appearance | 侧轨；Minimal 藏 | 可选 mini-map | 否 |
| G-05 | page_flip_on_send | Appearance | 发送置顶；Minimal 藏 | scrollIntoView | 否 |
| G-06 | combine_queued_prompts | Editor | 合并 follow-up，默认关 | 同 | 否 |
| G-07 | follow_up_behavior | Editor | queue / steer | 同 | 否 |
| G-08 | confirm_before_rewind | Editor | rewind 确认 | modal | 否 |
| G-09 | simple_mode | Appearance | true=readline 输入 | 忽略或「Vim 输入」关 | 否 |
| G-10 | vim_mode | Appearance | 滚动 vim | 可选 | 否 |
| G-11 | theme | Appearance | 含 auto；Minimal 藏；preview | CSS；preview | 否 |
| G-12 | auto_dark_theme | Appearance | | 同 | 否 |
| G-13 | auto_light_theme | Appearance | | 同 | 否 |
| G-14 | render_mermaid | Appearance | auto/on/off | mermaid.js | 否 |
| G-15 | permission_mode | Agent | 无 preview（切 YOLO 会排空队列） | 确认框 | 否 |
| G-16 | remember_tool_approvals | Agent | restart | 说明需新 session | 否 |
| G-17 | multiline_mode | Editor | 每会话，不持久 | 前端；Web 可持久 | 否 |
| G-18 | default_model | Models | 动态目录；也切当前会话；(no override) | 下拉 | 否 |
| G-19 | max_thoughts_width | Appearance | 40-500 | CSS | 否 |
| G-20 | show_thinking_blocks | Appearance | | 同 | 否 |
| G-21 | prompt_suggestions | Editor | 每回合小模型；env 可覆盖 | 同 | 否 |
| G-22 | respect_manual_folds | Appearance | pager.toml | 前端 | 否 |
| G-23 | group_tool_verbs | Appearance | | 同 | 否 |
| G-24 | collapsed_edit_blocks | Appearance | | 同 | 否 |
| G-25 | display_refresh_auto_cadence | Appearance | restart；Minimal 藏 | 不暴露 | 否（N/A） |
| G-26 | scroll_speed | Mouse | 1-100 | 少用 | 否 |
| G-27 | scroll_mode | Mouse | auto/wheel/trackpad | 不暴露 | 否（N/A） |
| G-28 | scroll_lines | Mouse | 1-10；未设跟终端 | 不暴露 | 否（N/A） |
| G-29 | invert_scroll | Mouse | | CSS | 否 |
| G-30 | keep_text_selection | Mouse | flash/hold/word_select | 部分 N/A | 否 |
| G-31 | coding_data_sharing | Privacy | auth metadata；ZDR 锁 | 同 ACP | 否 |
| G-32 | default_selected_permission | Agent | 首次权限光标 | 同 | 否 |
| G-33 | toolset.ask_user_question.timeout_enabled | Agent | restart | 同 | 否 |
| G-34 | plan_mode | Agent | 每会话 ACP | 同 | 否 |
| G-35 | show_tips | Advanced | restart | localStorage | 否 |
| G-36 | contextual_hints | Advanced | 组，进子页 | 子页 | 否 |
| G-37 | auto_update | Advanced | restart | 不暴露（管二进制） | 否（N/A） |
| G-38 | hunk_tracker_mode | Advanced | restart | 同 | 否 |
| G-39 | voice_keybind_enabled | Editor | 只关 Ctrl+Space/F8，`/voice` 仍可 | 关快捷键 | 否 |
| G-40 | voice_capture_mode | Editor | toggle/hold；无 key-release 藏 hold | Web 用 pointerdown/up 可做 hold | 否 |
| G-41 | voice_stt_language | Editor | 官方 STT 表 + auto | 下拉同一列表 | 否 |
| G-42 | contextual_hints.undo | Advanced | | 同 | 否 |
| G-43 | contextual_hints.plan_mode | Advanced | | 同 | 否 |
| G-44 | contextual_hints.image_input | Advanced | 图输入 tip | 同 | 否 |
| G-45 | contextual_hints.send_now | Advanced | 插话 tip | 同 | 否 |
| G-46 | contextual_hints.small_screen | Advanced | | 同 | 否 |
| G-47 | contextual_hints.word_select | Advanced | | 同 | 否 |
| G-48 | contextual_hints.ssh_wrap | Advanced | grok ssh tip | 不暴露 | 否（N/A） |
| G-49 | fork_secondary_model | Models | fork 用副模型 | 下拉 | 否 |
| G-50 | 设置搜索 | 关键字过滤 | 同 | 否 |
| G-51 | 设置 preview | theme 等 supports_preview 逐键预览，Enter 提交 | 同 | 否 |
| G-52 | 设置分类 | Appearance Editor Mouse Agent Models Privacy Advanced | 同 IA | 否 |
| G-53 | Minimal 藏行 | hidden_in_minimal | Web 用 N/A 列藏 | 否 |
| G-54 | persist 失败 toast | 写 toml 错 | 展示错误 | 否 |
