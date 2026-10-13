# B 线增补：格挡持续时间与后备能源费用

本次只读定位支持两项判断：格挡旗标没有在新回合清除，会让“本回合”减伤延续；后备能源只按本场战斗的 `consumed` 法术计数，不读取远征累计消耗口袋。未重玩 B 档、未改游戏、未运行测试或组合验证；B 通关报告与末态不变。

## 格挡：回合重置遗漏，P1 玩法缺陷

现行格挡规则是 `armor` 操作的 `guard:true`（`game/src/cards/cards.sync.js:920`），卡面明确“本回合所受伤害降为1”（`game/src/cards/cards.data.js:387`，可读文案由 `card-description-text.js:18` 转为“每段伤害降为1点”）。

实际链路：

1. `game/src/battle/core/battle.resolution.js:1082` 调用 `addArmor(0,{guard:true})`，`battle.engine.js:592` 把 `pdef.guard` 置为 true。旧描述执行路径 `effects/effect-steps.recovery.js:102` 也设置同一旗标。
2. `game/src/battle/core/combat.js:115` 检查此旗标，将非真实、未破甲的每段伤害先压至1；随后 `combat.js:132` 按护盾→护甲吸收剩余伤害。`battle.engine.js:1366` 的玩家受击传入真实 `pdef`，因此这是伤害结算状态，UI“格挡中”并非独立装饰。
3. 敌方阶段完成后，`battle.enemy-phase.js:318` 调用 `tickDurationsLog(pstat,'你')`；该函数在440行转调 `Combat.tickDurations`。`combat.js:232` 只递减 `status` 计时键与 `__timedBuffs`，不处理 `defense.guard`。
4. `battle.enemy-phase.js:341` 增加回合，随后重置能量和出牌计数，没有清除 `pdef.guard`。额外回合分支79行也没有清除。全 `game/src` 写点检索仅见入场置 false、读档恢复和置 true；入场重置在 `runtime/battle.runtime.session.js:92`，不能承担回合重置。

与 D 真实输入的对应：D 在 T2、T4 使用格挡，T5只用猛击；T6稳定AX仍显示35/35、“格挡中”（[D28证据](../D/28-boss-round6-ax.txt)）。根记录 T3结束时尚有2甲；按上述伤害顺序，T4和T5的每次攻击先降1，再各扣1甲，足以解释到T6仍满血。此推导依赖根保存的牌序和护甲起点；本增补不替代 D 玩家日志，也不从敌方15攻击角标直接推断应扣15血。源码已经证明格挡没有到期重置，D无新防牌回合的连续状态提供运行证据。

现有测试只覆盖格挡规则形状（`tests/a3-battle-rules.test.js:144`）、效果刚施放时 `pdef.guard===true`（同文件242行的不变应万变用例）和单次减伤（`combat.js:362`内置断言）。本次窄查没有找到“施放格挡→敌方阶段→下一玩家回合→未再格挡受击”的到期断言；未运行测试。

## 后备能源：只按本场 consumed 法术降费，P2 说明/契约缺口

- `game/src/cards/cards.data.js:634` 定义基础6费，结构化费用修饰为 `consumedSpellDiscount:1`。
- `effects/battle.card-inspection.js:47` 从本场 `state.consumed` 遍历UID，用 `findCard` 识别 `card.type==='法术'`，取得数量；这里没有读取 `state.game.usedPocket`。
- `effects/battle.card-cost.js:46` 按 `max(0, card.cost - consumedSpellCount × amount)` 返回费用。因此本场没有消耗法术时仍6费，不会因为之前普通战远征口袋已有17张而降费。
- `core/battle.lifecycle.js:340` 在首脑开战调用 `clearBattlePiles`；`runtime/battle.runtime.piles.js:27` 同时清空 `consumed`、`grave` 等本场区。远征累计 `game.usedPocket` 与本场区分开。
- 首脑注能在 `core/battle.exec-play.js:135` 将燃料UID加入 `consumed`，137行同步加入 `grave`；正常打出主牌在151行进入弃牌，不因此降后备能源费用。不能把“法术已使用”当作“法术已消耗”。

`consumed` 与首脑墓地并不完全等价：`battle.exec-play.js:102` 的手牌支付写 consumed；`battle.enemy-phase.js:383` 的火球符文消耗牌库底写 grave，却未同步 consumed。故精确契约应称“本场 consumed 中的法术数”，不能简化为“墓地法术数”。D28墓地0且后备能源6费符合本场未消耗燃料的可见状态，跨战斗口袋本就不参与现行计算。

可读卡面使用“你的消耗口袋中每有1张法术牌”（`cards/card-description-text.js:225`），玩家此前能打开的远征消耗口袋也叫这个名称；目前文案没有说明仅本场计算。按现行代码归为边界说明缺口；要改为累计远征口袋还是保持本场消耗，需要沿玩法授权确认，审查不代为改机制。

测试 `tests/tt12-structured-battle.test.js:108` 虽题为“按真实消耗口袋快照折费”，实际先开普通战，再把一张法术作为本场注能燃料，验证6→5费；并未覆盖开战前 `game.usedPocket`。`tests/battle-pure-rules.test.js:63` 只测试调用方提供的 `consumedSpellCount`。这些用例不能证明跨战斗累计口袋降费已支持。
