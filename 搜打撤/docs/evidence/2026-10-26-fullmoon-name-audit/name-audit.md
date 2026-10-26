# 现行卡名引用核对

2026-10-26，Friday；本项为只读检查，按稳定ID对照当前有效卡库。

核对 291 张有效卡、65 个已知历史别名，扫描 767 个源码/文档文件；复核 40 处命中，其中 31 处仍为当前引用旧名（涉及 20 个旧名），另 9 处属于历史说明或旧召唤名兼容。非已知别名的新拼写错误、自定义卡与实际玩家存档未覆盖。

满月形态已按同轮老板授权删除立即获得能量的文案与结算；下列其他问题只记录检查结果。

| 旧称 → 当前卡名 | 当前引用位置 |
| --- | --- |
| 一串钥匙 → 两把钥匙 | `game/src/hub/base.js:743` |
| 不朽神剑 → 骷髅王剑 | `game/src/battle/core/battle.core.js:103`、`game/src/battle/effects/effect-steps.rules.js:9`、`game/src/run/game.run.altar.js:524` |
| 恶魔交易 → 受困运输队 | `docs/terminology.md:15` |
| 盗匪横行 → 武装截查 | `docs/game-compendium.md:355`、`game/src/core/art.js:23`、`game/src/hub/game.bag.settle.js:347` |
| 反抗组织拾荒者 → 截道拾荒者 | `docs/rules.md:46` |
| 灼热异变体 → 灼囊畸变体 | `docs/rules.md:93` |
| 滋生异变体 → 囊生畸变体 | `docs/rules.md:28`、`game/src/battle/core/battle.enemy-phase.domain.js:338`、`game/src/battle/core/battle.engine.factory.domain.js:841` |
| 巨兽「荒渊」 → 封街巨躯 | `docs/rules.md:35`、`game/src/run/chests.js:254` |
| 肃清总督 → 封控指挥官 | `docs/rules.md:45`、`game/src/battle/core/battle.enemy-phase.domain.js:385` |
| 变异巢母 → 囊巢母体 | `docs/rules.md:45`、`game/src/battle/core/battle.engine.factory.domain.js:833` |
| 异能领主 → 隔离区看守 | `docs/rules.md:45`、`game/src/battle/core/battle.damage.domain.js:14` |
| 隧道血契 → 受困运输队 | `docs/rules.md:98` |
| 暴雨劫道 → 武装截查 | `docs/rules.md:46` |
| 实验室余粮 → 失联配给柜 | `docs/rules.md:126` |
| 塌方采掘点 → 塌陷地下库 | `docs/rules.md:98` |
| 满电动力锤 → 中断的接应 | `docs/rules.md:127` |
| 临时救护站 → 隔离线急救 | `docs/rules.md:126` |
| 熔断物资箱 → 封存储备库 | `docs/rules.md:128` |
| 故障重编 → 异常改装台 | `docs/rules.md:128`、`docs/rules.md:129` |
| 地下商场黑市 → 暗巷赌约 | `docs/save-format.md:83` |

## 影响与排除

- 玩家可见：截道拾荒者的卡牌描述仍写“盗匪横行”，全书由该源描述生成；源头为 `game/src/cards/cards.data.js:326`。
- 现行说明：玩家规则、术语、存档说明仍引用部分旧事件名、旧怪物名；引用对象已按稳定ID明确，可以据表统一。
- 工程说明：若干注释与效果调试标签仍写旧名，不等于当前卡面仍显示旧名，也未据此判定结算错误。
- 明确保留：`battle.layers.js` 的旧召唤名是兼容形象索引；`cards.consts.js` 对旧迁移版本的说明、模块交付记录、卡牌迁移链和 `class-consolidation.md` 的09-05历史名单不计入现行卡名错误。当前同名的另一张卡也排除，例如“闪金之锤”“一把钥匙”仍各有有效ID，不能全局替换。
- 本检查没有发现“满月形态”当前卡面仍叫“自然形态”的证据；此前是我的称呼沿用了测试ID，当前有效卡库与全书均已叫“满月形态”。

原始匹配、当前ID与逐条分类见 `name-audit.json`。
