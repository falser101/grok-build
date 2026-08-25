# 15 MCP、Skills、Hooks、Plugins、Marketplace

| ID | 功能点 | TUI | Web 怎么做 | Web 已实现 |
|---|---|---|---|---|
| E-01 | MCP 列表 | `/mcps`；`x.ai/mcp/list` | 表：名、状态、工具数 | 是：只读列表名、状态点、工具数。空则「还没有」。 |
| E-02 | MCP 开关 | `toggle` / `toggle_tool` | 开关 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-03 | MCP upsert/delete | 配置增删 | 表单；stdio command 在本机执行 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-04 | MCP setup/auth | `auth_status` `auth_trigger` `setup` | OAuth 弹层 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-05 | MCP 进度 | `init_progress` `server_status` `servers_updated` `tools_changed` | 状态点 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-06 | MCP 资源读 | `read_resource` | 查看器 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-07 | SDK MCP 经 ACP | `x.ai/mcp/sdk_call` 反向；`_meta["x.ai/mcp/servers"]` | 本机 Web 通常不用（Agent 侧跑） | Agent 已有 |
| E-08 | MCP call 正向 | `x.ai/mcp/call` | 调试用 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-09 | Skills 列表 | `/skills` tab | 列表 on/off、来源 local/user/plugin | 是：只读名、来源、开/关文字。空则「还没有」。 |
| E-10 | Skills 发现目录 | 用户/项目/plugin；watcher 热更 | 听 reload | 否。**备注：扩展管理页 待讨论后再做。** |
| E-11 | Skills slash | /K- | 动态 | 是：availableCommands 动态 skills slash |
| E-12 | Hooks 列表 | `/hooks`；`hooks-list` | 表 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-13 | Hooks trust | 项目信任与 folder trust 分 | 确认 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-14 | Hooks add/remove 路径 | | 文件选择（本机路径输入） | 否。**备注：扩展管理页 待讨论后再做。** |
| E-15 | HooksChanged | 通知刷新模态 | 同 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-16 | Hook 跑在工具上 | C-43 | 同 | 是：工具卡 hook footer |
| E-17 | `x.ai/hooks/event` `run` | 内部 | 一般不直接调 | Agent 已有 |
| E-18 | Plugins 列表 | `/plugins` | 表 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-19 | Plugin install marketplace | `install` source `--trust` | 商店安装 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-20 | Plugin uninstall | `--confirm` | 确认 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-21 | Plugin update | 全部或具名 | 按钮 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-22 | Plugin reload | | 按钮 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-23 | Plugin trust | path | 确认 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-24 | PluginsChanged | 刷新 | 同 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-25 | PluginUpdatesInstalled | 启动自动更新通知 | toast | 否。**备注：扩展管理页 待讨论后再做。** |
| E-26 | Marketplace 浏览 | `/marketplace` `x.ai/marketplace/list` `action` | 商店 UI | 否。**备注：扩展管理页 待讨论后再做。** |
| E-27 | `notify-updates` | `x.ai/plugins/notify-updates` | toast | 否。**备注：扩展管理页 待讨论后再做。** |
| E-28 | Agent 定义 | `/config-agents` | 列表+默认 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-29 | Personas | `/personas` CRUD | 表单 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-30 | Bundle 状态 | personas/roles/agents/skills 打包 | 若产品有 bundle | 否。**备注：扩展管理页 待讨论后再做。** |
| E-31 | disable_plugins | 藏 UI | 同 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-32 | `.mcp.json` / Claude 兼容 | Agent 读 | 导入向导 U-29 | Agent 已有 |
| E-33 | 项目 `.grok/` skills/plugins/hooks | 热更 watcher | 同磁盘 | Agent 已有 |
| E-34 | LSP 工具开关 | `[features] lsp_tools` | 设置 | 否。**备注：扩展管理页 待讨论后再做。** |
| E-35 | 自定义模型 | `[models]` extra headers 等 | 设置表单或只读展示 | 否。**备注：扩展管理页 待讨论后再做。** |
