# 卡牌规格与迁移入口

卡牌修改先查[现行玩家规则](../rules.md)、[术语](../terminology.md)与 `game/src/cards/` 的运行数据、同步迁移和 schema；执行接线在 `game/src/battle/effects/`。数据生成关系见[代码与数据工作流](../production/engineering/CODE-DATA-WORKFLOW.md)。

图鉴由 `scripts/generate-compendium.mjs` 生成：数据表反映生成时点的卡库与 JSON，机制章节提供来源导航。更新用 `npm run docs:compendium`；原迁移矩阵的 150 张目标、51 张排除和各批次说明按对应日期阅读，当前能力从 schema、capability、解释器与测试核对。

共用卡面与各入口显示规则见[卡牌显示](card-display.md)。

## 新增卡牌候选

- [按老板十三张标准新设计的五十张](MOVE-STANDARD-50-2026-10-20.md)：独立编号 01—50，含武术、法术与装备；只以现行卡库和老板十三张设计为依据，未实装、数值待平衡。

## 已否决候选

以下三份旧稿均已被老板否决，只保留历史，不得作为后续设计参考。

- [前五十张旧稿](MOVE-CANDIDATES-50-2026-10-19.md)。
- [二十张机制旧稿](MOVE-INNOVATIONS-20-2026-10-19.md)。
- [五十张简明重做旧稿](MOVE-INNOVATIONS-50-2026-10-20.md)。

## 穷鬼套餐

古朴装备，0费。穿戴后，当前手牌数小于等于3时，英雄技能费用为0；手牌超过3张或移除装备后恢复原费用。五职业技能及牧师翻面技能均适用，每回合一次的次数限制不变。卡牌按普通古朴装备进入随机获取池。

## 抽到施放的回合接续

星辰占卜生成的「抽到时施放」副本在满手时仍走正式出牌队列。逆鳞护甲受到伤害后抽到这类副本时，自动施放与其产生的发现、抉择或支付选择先完成，再继续尚未结束的敌方行动；选择期间不能额外开始出牌或再次结束回合。回合开始抽到的副本也须结算完毕，才恢复普通玩家操作。

触发施放中的治疗或伤害保留实际生命值，中毒结算不以旧快照覆盖。战斗结束或重开会取消旧回合接续。对应回归见 `tests/reactive-draw-cast-continuation.test.js`。

## 制定时点的规格与决策

以下资料保留原设计、契约与裁决。实施时核对当前字段、解释器支持范围及相关测试，任务阶段名称只作定位。

- [M 批契约规格](M-BATCH-CONTRACT-SPEC-2026-09-27.md)
- [M 批裁决](M-BATCH-DECISIONS-2026-09-27.md)
- [XL hosted 设计](M-BATCH-HOSTED-DESIGN-2026-09-27.md)
- [schema v2 分类](card-rules-v2-taxonomy-2026-09-25.md)

[迁移矩阵](../M-BATCH-MATRIX.md)与[排除清单](../M-BATCH-EXCLUSIONS.md)保留在 `docs/` 根目录，因为测试按原路径读取；[M 批结果](../archive/card-migration-2026-09-27/README.md)和[09-23 卡牌规则计划](../archive/card-rules-2026-09-23/)属于历史记录。
