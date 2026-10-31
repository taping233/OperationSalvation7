# 第二轮：现行内置声明与实际消费者审查

结论：对现行291卡重新读取声明后，新发现5组现行卡行为缺口，7条真实源引擎/独立Core进程向量全部完成。这里不重复第一轮正在修复的支付与飞身劈向量，也不将“存在同名case”当作实现完整。

## 覆盖边界

`coverage-round2.json` 是291卡的轻量声明清单：231卡有rules、166卡声明onPlay、8卡声明onTurnStart、6卡声明onDraw、4卡声明onConsume、各1卡声明onAcquire/onFreezeDealt/onKill，另1卡duration/replay。现行内置没有onInfused、onPlayCard、onTurnEnd声明；onConsume承载消耗/被注能的直接触发，不能因旧注释出现onInfused而另判漏迁。60张无rules卡另有文本/物品等执行路径，本轮没有声称其全覆盖。

| 当前声明类别 | 当前真实入口/消费者核对 | 结果边界 |
| --- | --- | --- |
| battle.setup / collection | Core BeginBoss→ApplyRuleBattleSetup→CheckRuleCombinations，源 lifecycle/setup机制 | 确有注入与组合消费者；未对所有五件集齐时序重跑 |
| handTransform | 当前ApplyHandTransforms调用CompleteRuleCast，源applyImitate | 有真实消费者；第一轮外的旧historical passed未作为结论，本轮不重复向量 |
| costModifiers | Core EffCostOf→StructuredCost覆盖当前4种kind，源card-cost | 静态核对当前5卡声明，未做所有交叉费用场景 |
| requirements | infused/unplayable有入口，handCards第一轮已报 | handCards修复进行中，不重复 |
| persistent规则 | moveCost1/doubleNextSpell/stealthStrike/growth/discoverPlus/playerCurseImmune/allSpellsInfused/consumeFireball均有读取路径 | 具体组合与时序未全部重跑；第一轮三个纯schema键单列 |
| onAcquire | AddTempCard/AddDeckCard→FireRuleAcquire→RunStructuredTrigger | 当前阿猫的礼物有实际消费者，循环递归守卫存在 |
| onDraw | DrawCards/DrawFiltered→OnStructuredDraw；移区、触发、castOnDraw、组合检查 | 有入口；本轮新增逆鳞抽牌使用实际完整敌方回合 |
| onConsume | infusion fuel、ConsumeRuleHand→RunStructuredTrigger；源onHandConsumed→fireConsumeTriggers | 金蝉的上游handOps缺失导致实际未到消费者，见R2-1 |
| onTurnStart/Freeze/Kill | 注册卡与装备→FireStructuredTrigger，源trigger runner | 当前声明入口均存在；只读核对，不能据此宣称所有状态效果一致 |
| 装备被动 | aura/cond/infusionUnlock/heroSkillCost/alternatingRefund/damageResponse | 逆鳞damageResponse实际目标与RNG消费错误，见R2-2；其它按当前字段读取路径核对 |
| 发现/卡区组合 | Acquire/Discover→AddTempCard/Deck→Acquire、CheckRuleCombinations；castOnDraw→CastRuleHandCard | 有实际消费者；未重新穷举所有随机发现/组合 |
| keepInHand/fuelAllowed、pick:new/two | 必须沿主出牌与交互入口读取 | Core完全缺消费者，新增R2-3/4/5 |

## R2-1 P1 金蝉脱壳丢失前置手牌消耗

向量cicada/cicada-boss：[金蝉脱壳tt7-goldencicada、矿工炸药tt3-sapper-bomb、初始攻击starter-attack]，打o0。

源：先消费o1/o2，炸药onConsume真实造成4伤，敌HP96，consumed=[o1,o2]，然后抽牌。普通手牌3；首脑条件化向量手牌1（此前开局抓取后牌库实际只剩1）。

Core：只抽牌，炸药与初始攻击留手，consumed空，敌HP100；普通手牌5、首脑手牌3。抽牌数量取决于真实剩余牌库，缺陷在前置消费，不以总牌数代替调用链证据。

源 `effect-steps.m1.domain.js:105-138 resolveDrawHandOps` 先清手牌，登记consumed/grave，再yield onHandConsumed；`battle.engine.factory.domain.js:609-613` 转fireConsumeTriggers和consumeFireball。Core `snapshot-round2/Battle/StructuredRules.cs:371-378` 的draw仅处理数量/过滤，完全未读handOps。

## R2-2 P1 逆鳞护甲打错反击目标并使用错误随机流

向量scale：seed=1，携带装备tt13-scale-armor，2敌HP100/Atk2；真实装备后完整EndTurn。

源：玩家HP26，敌HP=[94,100]，新增初始攻击1张。Core：玩家HP26，敌HP=[97,97]，新增初始攻击2张。

源 `equipment-semantic-operations.js:20-32 playerDamaged` 每次受伤从全部活敌随机挑反击目标；反击选择 `random('target')`，抽牌概率 `random()`；工厂`:169-170` 映射到 `Random.random('battle', purpose)`，purpose默认generation。Core `StructuredRules.cs:784-794` 固定反击attacker并以rng.Random('reward')抽牌，因此目标分配和后续随机流都不同。seed1源两次target随机均落敌0，能清楚区分固定攻击者行为。

## R2-3 P1 不朽斩留手与禁止注能均未迁移

向量immortal：[cmtn233trmeg]，同UID连续打两次。源每次都留手，敌HP100→95→90、能量2→0。Core第一次后手牌空，敌95；第二次返回“卡牌已不在手牌中”、能量1。

向量fuel：[镭射tt3sp-silverthorn、不朽斩cmtn233trmeg、初始攻击]，先进入镭射注能选择，再选择不朽斩。源picked=[]、返回本牌无法用于注能；Core SelectInfusion(o1)真实将o1放入picked。

源 `battle.exec-play.domain.js:429-442` 消费battle.keepInHand；`battle.card-inspection.domain.js:108` 消费fuelAllowed=false。Core `BattleSession.cs:679-730` 仅排除当前施放UID，`ExecPlay:732-770` 移除施放牌后无keepInHand恢复。全Scripts相关搜索也未找到其它消费者。

## R2-4 P1 血毒双镖第二镖不能重选目标

向量dart：2敌HP100，Atk4；tt7-bloodpoison第一镖选敌0，第二镖明确resolveDart(1)。源第一段结束pending=true；最终HP=[95,95]，敌0流血1/中毒0，敌1流血0/中毒1。

Core PlayCard(o0,0,false)立即把全部4段执行到同一目标，HP=[89,100]；敌0流血1/中毒1，敌1无诅咒，缺第二段点选。第二次伤害因同敌已流血多1伤，进一步改变数值。

源 `battle.exec-play.domain.js:423-427` 收集pick:new并开启dart；`battle.bag.domain.js:464-488` 在玩家第二次点选后通过runner结算；`battle.status-operations.domain.js:37-46` 绑定前次命中。Core RunRuleOps→ApplyRuleDamage/ApplyRuleCurse未读取pick或bindTarget，BattleSession只有单个pendingTarget。

## R2-5 P1 扰敌忽略玩家选择的两名敌人

向量provoke：3敌Atk=[2,2,6]、HP均100；源先submitCardPlay(o0,1)返回needs-input，再submitCardPlay(o0,2)，最终HP=[100,94,98]。

Core PlayCard(o0,1,false)直接结算Alive.Take(2)，最终HP=[98,98,100]；选中的第三敌未参与。

源 `battle.card-play.domain.js:221-236` 保留foeFightFirst、拒绝重复、等待第二名并withFoeFightTargets；`effect-steps.m2.domain.js:373-400` 从所选两敌、敌方实际攻击者按正常攻击链结算。Core `StructuredRules.cs:437-438` 固定首二敌，且使用FIXED伤害而非敌方正常攻击链。当前向量已确认目标分配差异；护盾/流血/攻击修正等更深差异未另建数值向量，不能视作已证实具体数值。

## 产物与复验

- `source-round2.mjs` / `Round2.cs` / `Round2.csproj`：轻量真实入口夹具。
- `source-round2-results.json` / `core-round2-results.json`：7条最终实际结果，两个进程最终退出0。
- `snapshot-round2/`：本轮真实Core37源码私有快照，后续Root修复不会改动此证据。
- `coverage-round2.json`：291卡的每种opcode字段集合、卡ID及触发器/装备/battle字段引用。
- `inputs-round2-sha256.json`：相对上一轮677源输入的定向重哈希差异、37个Core源码及结果夹具SHA。源变化数组为空则复用第一轮源证据。

运行本目录 `node source-round2.mjs` 和 `dotnet run --project Round2.csproj --no-restore`。source脚本每次重新加载现行Cards并覆盖fresh-catalog.json；Core固定运行此历史快照。当前是审查差异证据，不是生产修复后验收通过声明。未进行前台、Unity、浏览器或全291卡全状态验收。
