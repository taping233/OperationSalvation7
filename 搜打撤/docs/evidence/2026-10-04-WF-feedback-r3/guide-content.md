# 远征手册文案事实依据

本页对应的玩家文案在 `game/data/beginner-guide.json`。插图路径已按六页约定填写；图由负责绘制的代理提供。图注统一说明为机制示意，不是实机截图。

## 核对过的现行事实

- 档位与出征流程：运行代码 `game/src/run/game.session.modes.js:8-15` 当前只定义标准搜打撤、精英突袭两种模式（`docs/rules.md:7` 的悠闲行军为过时口径）；`game/src/hub/game.hub.depart.js:14-48` 在基地出发页选模式，`game/src/hub/game.hub.depart.js:126-183` 打开整备页并提供卡牌和宠物选择，`game/src/hub/game.hub.depart.js:339-355` 确认整备后调用职业选择；宠物也可在 `game/src/hub/game.hub.pages.js:158-197` 仓库页切换。初始攻击固定携带见 `game/src/hub/game.hub.depart.js:90-132`。
- 地图、节点和撤离差别：`docs/rules.md:7-13` 说明相邻移动、房间类型、前三层门、第三层紧急撤离与第四层终局撤离；实际节点结算见 `game/src/run/game.run.flow.js:16-25,111-162`。
- 战斗输入与卡牌去向：`docs/rules.md:43-50` 说明普通战和首脑战区别、每回合基础能量、目标牌拖放与群体/无目标牌点击；`game/src/battle/view/battle.view.js:401-421` 展示能量和结束回合入口，`game/src/battle/view/battle.view.js:416` 标注背包快捷键 B；`game/src/battle/core/battle.enemy-intent.js` 计算敌人意图；`docs/rules.md:32-33` 说明普通战打出的持有卡进入消耗口袋。文案限定为“符合条件的卡”可复原，避免误指初始攻击或其他不可复原卡。
- 宝箱选择与宠物蛋：`game/src/run/chests.js:60-74` 对每个宝箱投宠物蛋奖励，`game/src/core/rule-config.js:12` 将基础概率设为 0.007，`game/src/hub/base-pet-egg.commands.js:18-23` 说明连续 149 次未中后下一次保底；`game/src/run/chests.js:312-318` 说明选牌箱只收下一张所选牌；`game/src/run/chests.js:347-363` 呈现背包容量提醒和收取方式。
- 第三层紧急撤离、第四层祭坛和首脑：`game/src/run/game.run.altar.js:455-493` 说明第四层激活祭坛的献祭与奖励；`game/src/run/game.run.altar.js:595-627` 说明首脑门条件；`game/src/run/game.run.altar.js:685-751` 说明第三层撤离献祭三张、第四层击败首脑后撤离；`game/src/run/game.session.death.js:84-90,154-177` 说明失败结算与安全格抢运。
- 基地成长：`game/src/hub/base.js:374-405` 说明口粮升级宠物、木材相关基地扩建；`game/src/hub/game.hub.pages.js:124-130,418-484` 说明钥匙复原、材料卡用途与升级入口；`game/src/hub/game.hub.pages.js:183-190,291-313` 说明宠物蛋加 50 币孵化、职业卡与能力卡收藏会消耗卡并换熟练度；`docs/rules.md:34` 说明收藏室位置和进度奖励。

## 本轮文案范围

六页依次覆盖出发整备、地图节点、卡牌战斗、搜刮背包、撤离结算和基地成长。整备顺序按当前实现写为基地选择模式 → 整备卡牌/宠物 → 确认出发后选职业；没有沿用规则页的悠闲行军。元素灌注规则没有放入新手页；首脑编组、模式差异的详细数值与收藏奖励阶梯也未展开。

## 未核项

- SVG 插图尚由图稿代理制作，本文件仅给出约定路径。
- 按老板要求，本轮未运行测试、lint、build 或浏览器，也未做手册实页复核。
