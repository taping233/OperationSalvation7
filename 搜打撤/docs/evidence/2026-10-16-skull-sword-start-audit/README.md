# 骷髅王剑开战审查

## 结论

普通战持有骷髅王剑而未触发，符合现有模式门，不足以认定奖励丢失或开战流程漏执行。实际门槛是 BOSS 战且编入本场牌库；地图首脑沿用旧编组后按背包顺序补齐，持有不保证编入。卡面和库存大图未表达该限制，易产生错误预期。

已确认另外两项缺口：

1. BOSS 编入后规则实际生效，但原有初始攻击仅在提交出牌时被替换为不朽斩，手牌名称、卡面、详情与交互仍查询原卡，未表现开战逐张变形
2. 同一原卡仍可被选作注能材料，违反不朽斩“无法用于注能”，这是实际合法性缺口，并非单纯视觉问题

本轮审查没有编辑生产文件、既有测试、浏览器状态或真实存档，没有启动服务、build 或提交。后续修复已经获父级授权，但在 R6 快照解冻前不得编辑生产与既有测试。

## 真实模块实验

自有诊断测试 `skull-sword.audit.test.js` 使用 jsdom 新的 localStorage 和内存 game 夹具，直接调用真实 `BattleSession.start/commands`；没有 mock 卡效执行器。基准规则为攻4、10能量、4张初始攻击，以便消除抽牌随机性。

- 普通战：剑不入手，shaTransform=null；4张初始攻击保留原形，打出1张造成4伤害并离手
- BOSS 编入：开战装备与变形日志出现，shaTransform=不朽斩；开手仍是4张初始攻击，0张可见不朽斩；同UID打两次各造成5伤害，均回手，背包原卡仍为初始攻击
- BOSS 未编入：仅持有剑，无被动装配、无变形规则
- 地图首脑自动编入：清空此前编组后，剑处于自动编组容量内即生效。旧编组占满时不会强制把新获得的剑换入
- 禁注能：变形规则已生效时，以正式卡“镭射”的注能入口选取初始攻击UID，实际picked包含该UID；原始不朽斩卡文明确禁注能
- 展示卡文为“对战开始时，你的每张「初始攻击」变为 1 张「不朽斩」。”，未注明 BOSS 或编入条件；执行文仍为旧“化为”句式，来自 hosted canonical，不应直接更改原始描述

最终运行：3文件11测试通过（5个自有诊断、boss-equip-select 3个、battle-card-inspection 3个），见 `probe-with-existing-tests.log`。5个诊断用例断言的是缺陷存在时的当前事实，不是修复后行为验收；修复后应保留该基准证据，不应将其改写为“游戏全部正确”。

首两次自有夹具错误也已原样保留：第一次用了错误展示函数名且未清除跨场lastDeckSel，第二次误认为自动编组会替换已满旧编组。修正夹具后11项全过，不将这些夹具错误报告为产品缺陷。

运行命令：

```sh
./node_modules/.bin/vitest run --config docs/evidence/2026-10-16-skull-sword-start-audit/vitest.audit.config.mjs --reporter=verbose
```

## 证据链与影响范围

- `game/src/battle/bag/battle.equipment.js:223-227`：applyBattleStartPassives 对非boss直接return，筛选sel中的开战装备，注释记有2026-09-10需求
- `game/src/battle/core/battle.lifecycle.js:267-280`：普通战把开战装备排除手牌，仍调用被动入口但被模式门拒绝
- 同文件 `:311-323`：地图首脑保留旧有效编组并按背包顺序补齐
- 同文件 `:353-388`：BOSS独立UID初始牌、抽牌、被动登记；没有实际替换背包或战斗牌实例
- `game/src/battle/effects/effect-steps.rules.js:9-18`：文本规则只设置shaTransform
- `game/src/battle/core/battle.engine.js:951-955`：仅在play末尾把当前名为初始攻击/杀的卡替换成目标模板；UID沿用
- 同文件 `:963-977`：材料合法性查询findCard原卡desc，而非变形后卡
- `game/src/battle/effects/battle.card-inspection.js:31-38`：findCard现有顺序为cardOverrides→owned→granted；不理解shaTransform
- `game/src/battle/core/battle.exec-play.js:249-257`：不朽斩回手逻辑按结算卡执行，保留原UID
- `game/src/cards/card-description-text.js:78`：展示改写没有BOSS限定，原描述与展示描述分离
- `docs/rules.md:52`和现有boss-equip-select专测支持“编入即生效”，现行规则尚未直述普通战不触发

源文件SHA256见 `source-sha256.txt`，基于审查时工作树，包含父级此前未提交改动。审查不把历史需求注释直接视作最新用户对玩法的重新授权；本次修复应保持现有普通战模式门。

## 已批准但待解冻实施的最小方案

生产范围共10个既有文件：

- `battle/effects/battle.card-inspection.js`：统一findEffectiveCard与材料合法性；原findCard保留用于底层实例/存档/费用交换，不回写原卡或cardOverrides
- `battle/core/battle.engine.js`：注入shaTransform，同源解析用于出牌/注能选择、可用数、确认；保留变换生效顺序
- `battle/core/battle.core.js`：转发新查询端口
- `battle/view/battle.view.js`：手牌分组使用effective-entry
- `battle/view/battle.hand-inspector.js`：详情/aria/材料按钮与相同effective-entry一致
- `battle/view/battle.aim.js`：选择说明、目标提示、拖拽采用同一卡面
- `battle/view/battle.overlays.js`：牌库/墓地列表与详情一致
- `battle/view/battle.layers.js`：禁止材料的可见状态与原因；为opaque consumer，完整delta交父级审，不自行刷新守卫指纹
- `battle/core/battle.exec-play.js`：在扣费/移牌前最后复核材料合法性，堵住队列期间规则变化
- `ui/inventory-zoom.js`：库存/背包大图增加生效条件说明

另新增纯展示说明模块 `cards/card-battle-start-explanation.js`，不修改原卡库描述；不需要改ui.js，也不碰珍珠盒UI占用的game.bag.js。

保持契约：原UID/boss临时初始UID不变；已存在cardOverrides先解析，非初始名的变身不能再次变为不朽斩；后登记shaTransform仍胜出；同UID重复回手、伤害、费用优先级、旧编组容量与普通战限制保持；变形只在战斗查询层，离战和重开不污染背包。目标模板不存在应fail-closed，显示明确不可用原因，不静默退回普通攻击结算。

待补的真实回归：普通/BOSS编入/未编入/自动编入、4→4逐UID、临时初始牌、同UID连续回手2次、禁注能无扣费无移牌、排队前后复核、卡面/名称/aria/详情/指向一致、原UID费用override和青龙化身先后顺序、缺模板阻断、战后/重开无泄漏。近邻专测包含battle-card-inspection、battle-hand-inspector、n1-infuse-uid-toggle、hero-cards、boss-equip-select及模块架构门。

修复实施与最终验收记录见 [REPAIR.md](REPAIR.md)；本页上文保留修复前诊断基准。
