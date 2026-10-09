# 卡牌规格与迁移入口

卡牌修改先查[现行玩家规则](../rules.md)、[术语](../terminology.md)与 `game/src/cards/` 的运行数据、同步迁移和 schema；执行接线在 `game/src/battle/effects/`。数据生成关系见[代码与数据工作流](../production/engineering/CODE-DATA-WORKFLOW.md)。

图鉴由 `scripts/generate-compendium.mjs` 生成：数据表反映生成时点的卡库与 JSON，机制章节提供来源导航。更新用 `npm run docs:compendium`；原迁移矩阵的 150 张目标、51 张排除和各批次说明按对应日期阅读，当前能力从 schema、capability、解释器与测试核对。

## 制定时点的规格与决策

以下资料保留原设计、契约与裁决。实施时核对当前字段、解释器支持范围及相关测试，任务阶段名称只作定位。

- [M 批契约规格](M-BATCH-CONTRACT-SPEC-2026-09-27.md)
- [M 批裁决](M-BATCH-DECISIONS-2026-09-27.md)
- [XL hosted 设计](M-BATCH-HOSTED-DESIGN-2026-09-27.md)
- [schema v2 分类](card-rules-v2-taxonomy-2026-09-25.md)

[迁移矩阵](../M-BATCH-MATRIX.md)与[排除清单](../M-BATCH-EXCLUSIONS.md)保留在 `docs/` 根目录，因为测试按原路径读取；[M 批结果](../archive/card-migration-2026-09-27/README.md)和[09-23 卡牌规则计划](../archive/card-rules-2026-09-23/)属于历史记录。
