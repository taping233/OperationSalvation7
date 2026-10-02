# 内置浏览器入口复核（2026-10-02 08:20 UTC 起）
- 老板授权本地对话拉起内部浏览器后，重新检查本轮工具清单；仍无 node_repl/js_repl/cua/桌面控制或工具加载入口。
- 本机 config.toml 中 browser、unified-computer-use、computer-use 均 enabled=true，并注册 mcp_servers.node_repl；仅核对相关非敏感字段，未改配置。
- 官方 Browser 插件 manifest 提供 @browser、@browser-use 别名，描述为应用内本地页面导航/点击/截图；该插件 skills 目录为空，本轮技能清单未提供其启动技能。
- 官方 Computer Use SKILL/guidance 要求在 node_repl 中 import @oai/sky，所有控制经 node_repl；禁止自行启动 helper 或编造协议。本次没有该调用工具。
- 项目 iab-drive 的 openGame 是 ZCode node_repl 桥接封装；两个插件根变量均不存在。未伪造环境，未直接调用桥。
- handoff 经正式权限流程只读重试成功，编辑占用 0；未启动服务、未打开页面、未改存档；实机覆盖仍为 0。
- 最小接续入口：在本机普通对话选择 Browser/@browser，要求调用内置浏览器工具检查本项目；先确认实际暴露的工具，再启隔离 Vite 服务与测试档。本轮不能验证新会话是否成功获得工具。
- 本记录仅本地留证，未重复上传 Library；无截图、无视觉/玩法修改、无提交。
