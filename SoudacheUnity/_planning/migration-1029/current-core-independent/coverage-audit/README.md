# 有界架构完整性审查（只读，已结束）

结论：现行291卡共231卡含rules、47种实际opcode，均已建立实际消费者映射；复杂类别没有整族缺少入口，但仍有3组明确可达的消费者语义缺口。它们来自读取真实源/目标调用链，不是把未准备卡拒绝或投影差异当作bug。本轮未新增运行扫描、未重复129卡场景，也没有把正在修改中的生产Core冻结为最终版本。

## 证据范围

- 声明来源复用final-review/fresh-catalog.json与coverage-round2.json，对应先前fresh source677输入manifest。源码只读。
- `opcode-field-map.json`逐项记录47 opcode、全部实际字段集合、引用卡ID、C#真实消费者函数，以及battle/triggers/equip声明索引。该文件是导航映射，标有consumer-present表示执行链存在，不表示任意组合都与原版等价；当前常量值由固定语义处理时不强求逐字读取同名JSON键。
- 基准消费者可在final-review/snapshot复查；本轮又定向读取生产StructuredRules/BattleItems/CurrentBattlePools/DeckBottomDiscovery及源相关模块核对新增缺口。这些生产文件正由Root授权修复，`observed-inputs.json`仅表示读取时文件SHA，不是最终freeze、通过凭证或交付快照。
- 本轮3项为静态完整链证据，附真实内置可达例子；未声称完成新增双引擎数值复现。此前5组扫描缺口已经交付实施，本轮不重复归为新增。

## 复杂域逐一映射与边界

| 当前实际声明 | 源执行路径 | C#实际消费者与结果边界 |
| --- | --- | --- |
| handCards支付、infused/unplayable | card-play/exec-play/hand-selection | PaymentPreflight→BeginHandPayment→ConfirmRuleHandPayment，Requirements/InfuseOf；此前15向量已闭环 |
| discover/acquire pool、filter、dest、act、expire | resolution→discover-flow/card-semantic-operations | CurrentBattlePools→AcquireRuleCards/StartStructuredDiscover→AddTempCard/AddDeckCard；到期ruleJobs→ConsumeRuleHand，费用衰减costDecayCards；noInfuse后续条件存在C2缺口 |
| 牌库底发现与价格甲 | deck discovery→moveDeckCardToHand | AcquireRuleCards→StartDeckBottomDiscovery→UID移牌/恢复未选，lastAcquired→CardPrice；未再次枚举全部牌库顺序 |
| choice options.ops/repeat/otherAfterTurns | choice-semantic-operations→selectChoice→delayed choiceOps | StartRuleChoice→RunRuleOps或重复ruleJobs；randomBlessing当前声明有C1缺口 |
| summon/statless/taunt | resolution召唤→enemy-plan/phase随从挡伤/攻击 | RuleAlly→TryRuleAllyGuard/ResolveRuleAllyAttacks/RuleAllySnapshots；源enemy-plan同样选择首个可见有血随从，不因taunt字段未被显式读取就误报 |
| recruitEnemy wounded/excludeBoss | card-semantic-operations克隆受伤敌人 | ApplyRuleOperation→RuleAlly；有C3状态保留缺口 |
| transform starterAttacks | source shaTransform/卡面执行入口 | ApplyRuleOperation(transform)→cardOverrides覆盖已有初始攻击；需要按开战初始化顺序理解，不能只看case |
| transformCards source/raritySteps/ceiling/swapCosts | requested-card-batch transformChaosDeck | TransformRuleCards→稀有度阶梯、同类型随机候选、费用交换、cardOverrides；当前source/ceiling均固定drawPile/传说，有固定语义消费者 |
| boss setup.injectIds/mode/collection | lifecycle→setup injection/collection检查 | BeginBoss→ApplyRuleBattleSetup→AddDeckCard→CheckRuleCombinations→合并卡；battleStart装备在InitializeStructuredBattle应用；存在真实入口，未本轮穷举五件集齐时序 |
| castDrawn/release/castRandomSpells | 源生成/抽到/手牌批量施放 | CastRuleHandBatch/CastRuleGeneratedBatch→CastRuleHandCard→ExecPlay，ruleContinuations恢复；不据入口存在宣称所有嵌套选择都通过 |
| castStored/container.slots/accepts | 源锦囊存牌后选择→消费容器原UID→直接施放 | CastStoredRuleCard→BattleContainerHost.ConsumeStoredCard→CastRuleCard；slots/accepts属于背包宿主域，未将它当战斗opcode或无消费者缺陷 |
| markEnemy event/dest/status/multiplier/recursive:false | source propagated damage/death marks | enemyMarks→FireEnemyMarks→HitFoe，非递归行为为固定消费者；不是每个传播命中再触发根标记 |
| onAcquire/onDraw/onConsume/onTurnStart/onFreezeDealt/onKill/replay | source trigger runner与直接事件 | RegisterCard/FireStructuredTrigger、FireRuleAcquire、OnStructuredDraw、ResolveInfusedFuel；replay时点属于上一轮在修项 |
| bag.use | source bag操作域 | BattleItems.UseItem→ResolveBattleBagOperations，甲盾/抽牌/诅咒/获取/发现/复原等分支存在；本轮未再逐道具实测 |
| base.material | source基地材料宿主 | 属非战斗卡域，不应交给RunRuleOps；本轮不扩展基地宿主审查，也不据战斗无case报缺陷 |

所有47 opcode的具体卡ID/字段在JSON中；上表归并的是调用链，不替代逐项列表。

## C1：花开两面“天国之门”没有向全部友军发放正确祝福

真实声明：tt8-hero-summoner choice options[1] repeat=turnStart，randomBlessing target=allAllies、preferMissing=true、choices=[stealth,atkUp,spellUp,reduce,armor,purify]。

源 `battle/effects/choice-semantic-operations.js:22-37`：目标是玩家加所有存活有数值随从；按每个目标已有状态选择缺失项；armor分支加5；随机走ports.randomBattle()。C#生产 `StructuredRules.cs:866-873 RandomRuleBlessing`：仅对玩家pstat操作，不消费target/allAllies与preferMissing；armor只加1，并使用reward随机流。`RandomRuleCurse`同一门的另一选项也应对照源randomBattle流，不能直接继承其target流正确性。

真实可达例：先使用征召tt7-recruit得到2个步兵，再使用花开两面选择天国之门，进入下一回合。源逐目标发祝福，C#随从完全收不到；即使没有随从，已有祝福优先补缺/armor数量/随机流也有语义差距。此为消费者静态证据，未本轮抽取固定seed逐目标数值。

## C2：灵能召唤免材料后没有按“已注能”结算

真实声明：cmtn1epgt20j acquire dest=discover、pool=注能、act=noInfuse。源 `battle.discover-flow.js:183` 产出_noInfuse；`battle.infusion.js:4-5 hasInfusionWaiver`确认该实例免注能；`battle.exec-play.domain.js:326` 将waiver并入infusedBase，再执行when:infused/infuseBonus。

C# StartStructuredDiscover赋acquired.noInfuse=true，BattleSession.InfuseOf返回0；但 `StructuredRules.cs:196-201 BeginRuleCast` 的infused只认实际fuel或allSpellsInfused，不认card.noInfuse。免材料的实例能通过材料门，后续Condition(when.infused)仍为false。

真实可达例：灵能召唤发现并保留龙焰射线tt12-raydragon（当前注能池内的稀有法术），之后正常打出。源无材料也执行注能伤害；C#已免材料却跳过唯一when.infused伤害段。镭射等infuseBonus卡也受影响。该链不依赖自定义schema键。

## C3：精神控制丢失被招募敌人的战斗状态与防御

真实声明：tt13-mind-control recruitEnemy chosenEnemy、wounded=true、excludeBoss=true。

源 `card-semantic-operations.js:126-134` clone整个目标，保留status/defense等战斗数值，仅删除intent/传播标记并清boss标志后加入allies。C# `StructuredRules.cs:469-471` new RuleAlly只复制name/hp/maxHp/atk，status与defense恢复为新对象默认值。

真实可达例：先让有护甲/护盾的普通敌人受伤，或给受伤敌人施加poison/atkUp等状态，再用精神控制。成为随从后，源延续这些防御/状态，C#清空；随后的挡伤、攻击或回合末状态结算会变化。此为实体状态语义缺口，非snapshot投影字段位置差异。未本轮新增双进程血量向量。

## self curse / extend专门核对

遍历291卡全部rules嵌套操作，**target:self的curse声明0处**；不能把Core generic curse/self空路径直接当成现行内置卡bug。bag.use当前也没有显式self curse；冰冻药水为无target的敌方点选，不能误读为玩家自冻。

extend仅1处：tt3-firm-barrier的freeze延长，是真实可达且已在final-review扫描证明的“未冰冻也新挂freeze”差异，交由当前扫描修复片。没有发现第二张内置extend声明。纯schema扩展和当前内置影响明确分开。

## 收官

本轮完成有界只读架构检查，47种实际opcode均建立消费者路径，未发现还需继续扩展的整族未接入口；上述3组已立即报告Root，由Root决定实施与专项双引擎验收。生产未编辑、未提交、未启服务/Unity/前台。报告自身冻结；正在修改的生产文件不在本报告中宣称最终冻结或通过。
