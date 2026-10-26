# 前往下一节点即结束上一节点

老板确认：成功前往下一节点后，上一节点内容结束，未领奖励和剩余火堆机会作废。关闭面板或整理背包仍停留当前地点。本项完成后收尾，停止持续推进，改动保留未提交，由老板统一验收。

状态：本项修改完成，编辑释放，待老板统一验收，全部保留未提交。原跨层/迎战排查仅保留相关读取，迎战代理未落补丁，本轮仅实施上述节点规则；按老板要求收尾停止后续推进。

范围：节点结束状态、实际移动/穿门提交、旧档已离开记录、当前节点入口与相关提示/规范。沿既有存档和通行条件，未获得内容作废，已获得卡牌/物资及通路保留；不运行测试、lint、构建、检查脚本或实页，不新增测试，不提交推送。

## 实施

- `node-reward-state.js`统一`endNodeContent/nodeContentEndedAt`，真实离开后写入现有`nodeRewards`的`{version:1,type:'closed'}`，标记已访问、结束源节点的待领宝箱/事件/物资/复原/休整及候选；已获得卡牌、钱币、激活和胜利事实保持原值，研究所待选符文继续由原领域负责。旧候选对象结束后不再领取。
- `moveTo`在每段实际提交目的坐标后结束源节点，取消或中断只停在已提交地点；原商店专用离开分支退出。明确穿门通过`enterLayer(...,{endPreviousNode:true})`使用同一入口，普通开局/初始化/重绘默认不触发。
- `endAbandonedNodeContent`只按已知节点收益、宝箱、真实visited和入口补给记录处理非当前位置旧内容，保留当前节点与仅揭示但未访问的地点。读档定位到当前地点后规范化，并在恢复奖励/战斗前让closed优先；移动起始也处理旧运行中可识别的离开记录。
- 主解析在恢复奖励、复原、补给和火堆之前处理closed；火堆、祭坛、迎战、节点宝箱/固定奖励/复原/物资入口同步拒绝结束内容。离开前延迟启动的战斗也检查节点结束事实，避免回到原位置后启动旧请求。
- 地图显示已结束/已离店，结束后的道路继续通行；真实闸门与门旁商店的通行入口保留，已离店商店不再交易。纯闸门与空白通路不增加内容结束标签。顶部目标不再提示返回已结束祭坛领奖，祭坛/首脑已结束而未完成时说明实际状态。
- 规则、移动、存档和二级界面规范，以及祭坛/火堆/物资相关提示同步“停留当前地点”与“前往下一地点”的区别。字段仍由原存档承载；现有强制入城补给、战斗和通行条件继续适用，未允许发生的移动不结束当前节点。

本批文件：`game/src/run/node-reward-state.js`、`game/src/core/map-node-state.js`、`game/src/hub/game.store.types.d.ts`、`game/src/run/game.run.flow.js`、`game/src/run/game.session.js`、`game/src/run/game.run.altar.js`、`game/src/run/game.run.scenes.js`、`game/src/run/game-session-restoration.js`、`game/src/run/expedition.view.js`、`game/src/run/game.run.resources.js`、`game/src/battle/battle-loader.js`、`game/src/ui/node-decision-view.js`、`game/src/ui/fire-rest-view.js`、`docs/rules.md`、`docs/map-travel.md`、`docs/save-format.md`、`docs/modules/secondary-ui-style.md`。

子代理6.1-sol/high分别维护节点状态、移动提交、现行提示规范，主会话接入口与旧档。保留其他会话事件D6、地图及此前所有相关增量；依据为源代码读取与相关diff，未取得本批运行通过结论。

## 老板统一验收

同节点关闭/整理后继续；移动成功后火堆、宝箱、事件、物资和祭坛待领内容结束；多段移动取消/中断；明确穿门及返回闸门；旧档非当前待领记录、当前进度保留；回到结束节点及迟到回调；门旁商店结束后闸门通行；已获得物资保持原数值。
