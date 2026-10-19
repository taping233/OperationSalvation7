# 获取卡池、费用与寒冰剑修复

状态：父会话已完成集中验证，本组没有待改生产项。最终结果见 [统一验证记录](../verification.md)。下文保留各阶段交接记录，其中“尚未运行”指交接时点。没有build、提交、推送或删除。

## 按卡牌 ID 的修改

| ID | 修复 |
| --- | --- |
| tt7-ironphalanx | acquire 声明从 zeroCost 改 costMinusOne；仅 deck 目的地放行，获取副本原费用减 1、最低 0，不改变随机池模板。文本“费用均减少 1 点”也可识别。 |
| tt12-basicdev | 0 费招式池包括武术与法术，仍获取两张 0 费牌。 |
| tt12-breakthrough | 0/1/2 费各一张的招式池包括武术与法术，保留分费用获取。 |
| tt12-magicfind | 1 费招式发现池包括武术与法术，选中后仍变 0 费。 |
| tt12-hitechrd | 结构化 moves 发现池包括武术与法术，仍限定 2 费并保留逐回合降费。 |
| cmtn1gfhczzj | 能施加诅咒的招式包括武术与法术，仍排除没有诅咒描述的牌和其他类型；文本专支同步。 |
| tt2-frostsword | m10 声明增加 equip.passive.cond.vsFreeze:2，迁移 marker 升 v2，可将与 canonical 精确匹配的旧版 hosted 声明迁移；结构化伤害走 engine 既有装备增伤，文本 makeHitFoe 通过新增端口增伤，各路径只消费一次。 |

## 跨组接口

- card_lifecycle_fix 在 engine 提供 `getFrozenTargetBonus(target)`，只供文本 makeHitFoe 使用；结构化伤害继续通过 engine 原装备被动分支。
- 充能射线在 resolution 的结构化和文本两处改读 `getHandInfuseCount(uid)`，端口由 card_lifecycle_fix 装配；不再使用全局 infuseFuels。
- resolution 延迟结构化伤害任务携带 `targetIndex:getFoeIndex(target)`，文本 `registerTurnStart` 追加第三参数 target，生命周期组负责保存及回放目标。
- kills 随机祝福调用 card_target_effects_fix 新增的 `random-blessings.js`；兼容随机获取/获得/施加祝福。resolution 过滤天国之门候选说明，避免当作立即效果执行。
- makeHitFoe 的飞身劈文本攻击仅为当前攻击补一份目标流血，不登记持续规则；cards.sync.m3.js 与 engine 对应实现归 card_target_effects_fix。
- schema 的 bag.use 允许 damage 操作指定合法 dmgType（attack/spell/fixed/true），其他操作携带该字段拒绝；火焰药水声明和消费由父会话负责。

## 本组文件

生产：

- game/src/battle/effects/effect-steps.ctx.js
- game/src/battle/effects/effect-steps.deck.js
- game/src/battle/effects/effect-steps.kills.js
- game/src/battle/effects/battle.discover-flow.js
- game/src/battle/core/battle.resolution.js
- game/src/cards/cards.sync.js
- game/src/cards/cards.sync.m10.js
- game/src/cards/card-rules.schema.js
- game/src/cards/card-rules.capability.js
- game/src/cards/card-rules.capability.types.d.ts

测试（均尚未运行）：

- tests/card-description-fix-pools.test.js：新增，实际生产声明和消费者，覆盖 7 张卡、费用模板不可变、费用动作目的地、文本冰冻伤害、bag 伤害类型边界。
- tests/m10-data.test.js：更新寒冰剑声明，增加旧版声明升级回归。
- tests/e6-card-rules-capability.test.js：补 deck/costMinusOne 支持组合。
- tests/tt12-hitechrd-structured.test.js：2 费招式断言接受武术/法术。
- tests/tt12-hitechrd-battle-baseline.test.js：选择 2 费招式候选，避免池扩展后强求武术。

父会话集中验证还应包含共享 card-description-audit-battle、A3、schema/capability、m10 和两组生命周期/目标效果测试。共享审查 catalog 是历史快照，铁甲阵和寒冰剑应取当前生产迁移后的声明。

## 旧库匹配静态核对

已对照审查 `catalog.json`、`cards.data.js` 当前 TABLETOP10 行、`cards.sync.backfiller.js` 的精确比较分支及 `cards.sync.js` 的 `ensureEffectFields`；没有运行测试。

- 寒冰剑历史审查行去掉旧 rules 后，与 TABLETOP10 定版行字段和值一致：id/name/cost/rarity/type/desc/dmg/value；其中 dmg 已为 0，历史行不存在额外 draw/infuse/heal/armor 默认 0 字段。因此现有 previousRulesById 的 canonical+旧 rules 精确比较可以命中该历史行。
- 火焰药水历史行也是同一组字段，去掉旧 rules 后与 TABLETOP10 定版行一致，dmg 已为 0；旧 bag damage 声明与父会话 M6 v2 的 previousRulesById 完全一致。因此同样不存在此默认字段导致的匹配失败。
- `ensureEffectFields` 的 tryFill 只在推导值为真值时写入，推导为 0 不补字段；两张卡当前描述均不推导出 draw/infuse/heal/armor。此前“启动可能补默认 0 影响比较”的疑点没有现行代码或历史快照依据，已排除。

本轮不修改 M10/M6 迁移逻辑，不增加字段归一化或放宽自定义卡覆盖条件。结论针对已保留的历史审查快照和当前播种流程；自行添加额外字段的卡仍由现有精确比较保守跳过。

## 首轮集中验证后的定向修订

父会话集中反馈发现 `battle.discover-flow.js` 的候选类型可为 undefined，已将 includes 的输入显式兜底为空串；合法类型的池行为不变。

高端研发测试仅出现武术的原因为夹具随机端口恒返回 0：生产发现消费器对同一候选池有放回抽样，以 ID/名称去重并重试，恒定随机值只会抽到首张武术，法术并未被过滤。测试随机端口改为交替 0/0.75，保留最终必须同时出现武术和法术的断言；未修改生产抽样算法。以上定向修订尚未补跑测试或类型检查，由父会话统一补验。
