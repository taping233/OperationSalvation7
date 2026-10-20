# 卡牌规格与迁移入口

卡牌修改先查[现行玩家规则](../rules.md)、[术语](../terminology.md)与 `game/src/cards/` 的运行数据、同步迁移和 schema；执行接线在 `game/src/battle/effects/`。数据生成关系见[代码与数据工作流](../production/engineering/CODE-DATA-WORKFLOW.md)。

图鉴由 `scripts/generate-compendium.mjs` 生成：数据表反映生成时点的卡库与 JSON，机制章节提供来源导航。更新用 `npm run docs:compendium`；原迁移矩阵的 150 张目标、51 张排除和各批次说明按对应日期阅读，当前能力从 schema、capability、解释器与测试核对。

共用卡面与各入口显示规则见[卡牌显示](card-display.md)。

## 新增招式候选

- [五十张招式简明重做版](MOVE-INNOVATIONS-50-2026-10-20.md)：编号 71 至 120，每张短卡文配一句玩法变化；去掉召唤和随从联动，沿用敌方无护盾、无法术攻击及武术无注能的边界，尚未实装。
- [二十张机制创新招式候选](MOVE-INNOVATIONS-20-2026-10-19.md)：新增编号 51 至 70，武术 8 张、法术 12 张；逐张列出独立用途、完整效果、旧牌对照与结算边界，尚未实装。
- [五十张招式原稿](MOVE-CANDIDATES-50-2026-10-19.md)：待修订；含不适用的敌方条件与武术注能设计，其余条目尚未通过机制差异审查。

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
