# 目标与当次效果修复

状态：父会话已完成集中验证；本组最终相关4文件118项通过。结果和实页范围见 [统一验证记录](../verification.md)。下文保留各阶段交接记录，“等待验证”指当时状态。未build、提交。

| 卡牌 ID | 实现行为 |
| --- | --- |
| `cmtn7err0a7` 天国之门 | 玩家和存活、有状态、有生命的随从分别随机取得祝福；死亡、空血、无攻血场面物件排除。优先角色尚未持有的状态/护甲；有诅咒时净化也进入优先池，优先池为空时回退完整六候选。直开时保留完整候选，并重复回合开始效果。 |
| `tt8-hero-summoner` 花开两面 | 两扇门共用候选补全逻辑；未选门仍以 `notBeforeTurn = turn + 2` 延后，天国之门不再遗漏括号内候选。兼容“祝福包括”说明。 |
| `tt3-fly-arrowhawk` 飞身劈 | 攻击命中时只追加一份流血层数；移除本卡 `registerRule bleedAmp`，不再给后续攻击留下持续增伤。保留其他来源持续旗标。 |
| `tt3sp-dodge` 闪避 | 每层避开下一段合法伤害，覆盖攻击/法术/固定/真实伤害；保留原免疫、潜行检查顺序和回合末过期。未改生命代价扣除入口。 |

自有生产改动：`game/src/battle/core/combat.js`、`game/src/battle/core/battle.selection-flow.js`、`game/src/battle/effects/effect-steps.damage.js`、新增 `game/src/battle/effects/random-blessings.js`，以及经协调自行修改 `game/src/cards/cards.sync.m3.js` 的飞身劈单行规则和对应说明。

跨组接口：

- `card_lifecycle_fix` 在 `battle.engine.js` 注入 `getAllies`；命中入口按卡 ID/旧描述识别飞身劈，限定攻击类型；直接登记门效果时使用 `withBlessingChoices` 并令天国之门持续重复。
- `card_pools_rules_fix` 在 `effect-steps.kills.js` 接入 `applyRandomBlessings` 并兼容随机获取/获得/施加；`effect-steps.ctx.js` 的文本伤害入口补飞身劈当次流血加成；`battle.resolution.js` 对天国之门剥离纯候选说明后分句，避免将候选误当立即效果。完整候选仍由登记入口附回。
- 父会话更新 `tests/card-description-audit-battle.test.js` 中原错误现状断言。本代理仅同步 `combat.js` 内置自测；`tests/combat.test.js` 是该自测包装，无需修改。

准备的回归：`tests/card-description-fix-target-effects.test.js`。

- 真战斗飞身劈后初始攻击：攻击力 5、目标流血 2，依次造成 12 / 7，未残留 `bleedAmp`。
- 闪避分别避开四种类型的首段；层数消耗后下一段固定伤害正常结算。
- 每个友方独立随机、按自身状态优先，排除死亡/空血/无攻血物件；全部持有时仍可从完整六候选选择净化。
- 花开两面两种选择均检查天国之门候选、第二门提前不触发、到期后玩家和活随从实际获益。
- 直开天国之门登记与连续回合实际效果；新描述无括号时仍有完整六候选。

未验证项：上述回归与现有战斗相关测试尚未执行；玩家可见变化尚未用当前平台内置浏览器实际复核。集中验证结果由父会话补入本任务总证据。

收口补充：`cards.sync.m3.js` 升至 v6，并在既有 `previousRulesById` 中加入飞身劈完整旧规则快照，使已盖 v5 章、卡面仍与 canonical 一致的存库删除旧持续 `bleedAmp`。不匹配的自定义名称、描述、数值和规则保持原样。已核对充能射线历史审查快照及当前源码，其声明原本就是 `perInfusedInHand: 2`，本轮没有该卡声明迁移。

接管并同步 `tests/m3-data.test.js`：新声明与 v6 章、v5 飞身劈精确升级、卡面与其余卡及射线保持、重复执行不再写库、自定义四种差异保护、保存 false/抛错不盖新章且可恢复重试。未运行测试。

另接管 `tests/card-description-audit-battle.test.js`，将九组十六张错误现状断言改为卡面正确结果；取卡改为当前生产播种迁移后的 `Cards.all()`，保留待裁定口径。默认不写证据，显式 `CARD_DESCRIPTION_FIX_EVIDENCE=1` 时仅写本修复轮 `battle-observations.json`；原审查 catalog、报告与 75/75 证据保持历史含义。

集中验证反馈后的修正：测试中冻结的 `Random` facade 不能直接 spy，改用生产 `setRandomService` 接口注入固定随机服务，并在用例结束后恢复正常服务与原随机快照。随后三项门集成回归暴露生产顺序缺陷：完整候选中的潜行、攻击力等先被通用 `always` 步骤实际发给玩家，使后置的随机祝福步骤被跳过，友方没有获益。已将整句随机祝福从 `effect-steps.kills.js` 移至 `effect-steps.gates.js` 的抉择后、候选说明跳过前，并在随机动作后收口，避免逐项执行候选。`getAllies` 接线无需修改。回归进一步断言每名友方每次只得到一项，连续两轮累计两项。本次静态 diff 检查通过，补验仍由父会话统一执行。
