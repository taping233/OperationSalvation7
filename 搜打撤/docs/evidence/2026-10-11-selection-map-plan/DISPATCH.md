# GPT-6.1-sol 实施派工

2026-10-11，老板明确授权把本计划交给 GPT-6.1-sol 子代理实施。

- 代理三线：`/root/selection_map_implementation`（节点、奖励、局内商店）、`/root/roster_departure`（选人、卡池、整备、启程）、`/root/map_battle_art`（地图、战场与反馈）；模型均为`gpt-6.1-sol`。
- 批次：`WF-selection-map-implementation-1011`；主会话统一登记、协调与集成复核。
- 目标与验收：[总体修改计划](MODIFICATION-PLAN.md)，按骨架、完整样板、美术、动效声音和扩展验收推进，每项对应来源及实页证据。
- 首切片：F11收获/结果固定操作区、F12局内补给站查看/购买分离。
- 已核对无既有diff和活跃占用的首切片：`game/src/run/chests.js`、`game/src/run/game.run.shop.js`、`game/css/expedition-rewards.css`、`game/css/expedition-shop.css`；直接相关测试与本批次证据。
- 后续边界：`game.run.altar.js`由人物代理唯一编辑，节点需求由它协同应用；节点壳/奖励展示与结算摘要归节点代理；`renderer.js`仅节点图标/标签、新`expedition-feedback.js`及地图/战场专属CSS归地图代理。
- 子代理可连接隐藏内置tab，可见窗口操作受平台限制；最终真实当前窗口与视觉复核由根代理完成。
- 10-11老板明确允许保留原改动接手`game/src/run/expedition.view.js`：地图代理仅应用F07前进/回程方向、已探索状态与刷新缓存增量，原四层目标/阶段指引与未提交diff保留，旧测试/验收及服务现场不清理。
- 不接手基地独立交易所或照相馆，不覆盖在途角色播放器与原画。
- 回报：阶段状态、实际路径、来源与验证、未覆盖/阻塞、下一切片；完成未提交保留归属，不自动提交、推送或发布。

实施证据：[批次目录](../2026-10-11-WF-selection-map-implementation-1011/)（由任务工具创建）。
