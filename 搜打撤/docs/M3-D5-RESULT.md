# M3 批迁移结果（代理 D5，2026-09-27）

- 使命：B-M2 onPlay 扩展批 33 张（全批 34 张减 tt7-bloodpoison）迁结构化 rules。实迁 **24 张，跳过 9 张**。
- 基线：HEAD `a8e91e6`；**判定以工作区现场为准**（M2 Wave2 已落地：schema/capability/effect-steps.m1.m2/battle.triggers.m2/battle.resolution 均为未提交实时代码，行号以本日工作区为准）。远端差异未核实。
- 交付：`game/src/cards/cards.sync.m3.js`（ensureM3OnplayRules，保守语义照抄 m1/m2：指定 ID、无自有 rules 且整卡与 canonical 深相等才回填、marker 一次性、异常不标记、写时复制、双门先校验后保存、复读确认；**未接线**，由主指挥统一接入 cards.js ensure 层）、`tests/m3-data.test.js`（78 用例）。
- 验证：`npx vitest run tests/m3-data.test.js --no-file-parallelism` → **78/78 通过**（每卡 3 用例 = 双门 / 回填+marker / 三态保守跳过，另批次级 6 用例）；`node --input-type=module` 独立导入 cards.sync.m3.js 通过；另以 catalog-after 全量 272 张观测态卡做集成演练：恰 24 张目标卡新增 rules（71 张既有结构化卡不动）、saveAll 1 次、marker 盖章、二次运行幂等。未跑全量 vitest、未 build、无 git 写操作。
- canonical 定表：24 张逐一与 catalog-after 观测态深相等比对后定表——cc-cursed-blade / cc-last-stand / cc-rapid-fire / tt3-holy-water → CARDS_SYNC（cards-sync.json 实机覆盖批，m2 cc-chase-slash 同款）；16 张 → TABLETOP10（TABLETOP2/3/7 旧批次同名卡已被其按 id 整卡覆盖）；cmtn0xt0zr7 / cmtn1p9vb5au / tt7-maxsupply → TABLETOP11；tt12-chargeray → TABLETOP12。tt7-demonbreaker / tt7-meteorstrong 虽也在 cards-sync，但两卡均跳过（见下）。

## 一、已迁清单（24 张）

rules 均为 `version:1` + onPlay 有序 ops；「混合」指敌方主体 battle.target + 自身域字面量效果 op（M1 混合放行）。

| id | 名称 | rules op 摘要 | 旧描述 |
|---|---|---|---|
| cc-cursed-blade | 诅咒之刃 | damage amountField:dmg + curse source:'handMoves'（手牌招式诅咒聚合，混合） | 攻（+3），附加手牌中的招式所具有的全部诅咒效果。 |
| cc-last-stand | 破釜沉舟 | damage amountField:dmg + recast{on:'lastHand',times:2} | 攻（+3）；若本牌为最后一张手牌，效果触发 2 次。 |
| cc-rapid-fire | 连续射击 | damage amount:2 + hits{perPlayedMoves:true}（amount=卡面 dmg） | 本回合每打出一张其他招式，造成2点固定伤害（触发次数＝本回合已打出的招式数）。 |
| cmtn0xt0zr7 | 闪金之锤 | damage amount:5 + onKill{coins:2} | 造成5点固定伤害，若击杀敌人，+2币。 |
| tt2-jianghu | 江湖救急 | acquire n:1 pool{kind:'其它职业'} dest:discover act:play（SELF） | 发现 1 张其它职业的卡牌并直接施放。 |
| tt2-turtlearmor | 铸甲 | armor amount:10 + consumeEquip:true（SELF；付不出装备则无效） | 消耗1 张装备牌，+10甲。 |
| tt3-dig-treasure | 挖宝 | acquire n:1 pool{kind:'牌库底'} + armor priceOf:'discovered'（SELF） | 从牌库底发现 1 张牌，并获得等同于其价格的护甲。 |
| tt3-fly-arrowhawk | 飞身劈 | damage amountField:dmg + registerRule bleedAmp（混合） | 攻（+3），触发的流血伤害翻倍。 |
| tt3-purify-arrow | 净化箭 | damage amountField:dmg（负攻需 dmgType attack）+ cleanse self（混合） | 攻（-1），净化自身。 |
| tt3sp-shadowbug | 影噬 | stealAtk capTo:1（偷取至 1 点，缺省 1 回合后归还） | 本回合偷取 1 名敌人的攻击力至1点。 |
| tt3wu-shike | 割蚀 | curse atkDown amount:2 duration:3 + curse bleed stacks:1 | 降低 1 名敌人 2 攻，持续3回合；附加流血。 |
| tt7-armup | 武装 | draw amount:2 filter{type:'装备'}（SELF；BOSS 战 deckDraw 定向，普通战降级获初始攻击） | 从牌库中抽取 2 张装备牌。 |
| cmtn1epgt20j | 灵能召唤 | acquire n:1 pool{kind:'注能'} dest:hand act:noInfuse（SELF） | 发现一张注能卡，使其无需注能 |
| cmtn1p9vb5au | 千变万化 | acquire n:1 pool{kind:'形态'} dest:discover act:play（SELF） | 发现一种形态并释放 |
| tt12-chargeray | 充能射线 | damage amount:5 + perInfusedInHand:2 | 造成5点法伤，本牌在你手牌中时每注能过1张卡牌，伤害+2 |
| tt3-holy-water | 治愈 | heal amountField:heal + cleanse self（SELF） | 回复 5 点生命，净化自身 |
| tt3-thunderblast | 雷殛 | damage amount:7 + graveyard{type:'法术',perCard:1} | 造成7点法术伤害；墓地中每有1 张法术牌，伤害+1。 |
| tt7-bladebloom | 永恒绽放 | acquire n:3 pool:'随机' dest:discover act:playKeep（SPEC §二.6 本卡口径：施放 1 张其余入手） | 发现并直接施放 1 张牌，获取剩下两张。 |
| tt7-burnharvest | 爆燃火球 | damage amount:5 + spellPowerMul:2 | 5′，受法伤加成翻倍； |
| tt7-maxsupply | 法力补给 | draw untilHandN:4（SELF） | 抽牌，直到有 4 张手牌。 |
| tt7-recruit | 征召 | summon{name:'步兵',atk:4,hp:4,count:2,taunt:true}（SELF；engine summonAlly 随从位） | 召唤步兵（4-4） ×2为你抵挡伤害并自动战斗。 |
| tt3sp-devour | 吞噬 | execute cap{atk:4} count:1（SPEC §二.5 同款） | 消灭 1 名 攻击力4 点及以下小怪。 |
| tt3sp-magicoil | 药水魔法 | acquire n:1 pool{kind:'药水'} dest:discover act:play（SELF） | 发现1瓶药水并直接释放 |
| tt3sp-shadowshot | 暗影射击 | 两段 damage amount:3：基础段无条件 + 条件段 cond{anyCurse:true}（见下方口径修正 3） | 3′，若对手处于诅咒状态，额外施放 1 次。 |

与矩阵草案的四处口径修正（均以工作区 schema/执行器实况为准）：
1. **op 不携带 dmgType**：草案「dmgType:fixed/spell」是卡面字段描述；damage op 键集无 dmgType，类型由卡面 `card.dmgType` 承载（cc-rapid-fire / cmtn0xt0zr7 / tt12-chargeray / tt3-thunderblast / tt7-burnharvest / tt3sp-shadowshot 六卡按此修正）。
2. **discover 域改走 acquire**：schema discover op 仅接受 pool{kind:'moves'} 且必须单独声明；矩阵草案的 pool:'otherClass'/'potion'/'form'/'infusable' 均改写为 acquire + 中文池名词直透 parsePoolNoun（'其它职业'/'药水'/'形态'/'注能'，执行器 acquirePoolPred 同一单源）。灵能召唤按执行器注释点名「文本先例实为随机直发」定 dest:'hand' 而非 discover。
3. **暗影射击条件重施**：矩阵草案 recast{times:1} 非法——recast 必须带 on:'kill'|'lastHand'；以「无条件段 + cond.anyCurse 条件段」两段 damage 等价表达（未诅咒 3 点 / 诅咒 6 点，与卡面逐状态一致），cond.anyCurse 为 M2 已接线键。
4. **挖宝两段组合**：schema discover op 必须单独声明，故「牌库底发现」用 acquire pool{kind:'牌库底'}（执行器入口专支）+ armor priceOf:'discovered'（锚定发现牌价格）组合表达；armor 为字面量源（priceOf 无 amountField），与 acquire 同卡不触 field-anchored 混排禁令。

## 二、跳过清单（9 张）

| id | 名称 | 原因（核实证据） |
|---|---|---|
| cmtn0pbkmnvc | 流光照影 | 「对方身上每有一层诅咒，释放一次‘初始攻击’」需 execute 携带 what 键——schema execute 键集仅 {cap,count,onKill,perCurseKinds}（card-rules.schema.js PENDING_OP_ALLOWED_KEYS）；execute 域语义是「消灭 cap 内敌人」（effect-steps.m2.js resolveExecute），与文本路径专支 release.curseLayers（effect-steps.rules.js:49「每有 1 层诅咒释放一次‘杀’」）完全错配。矩阵草案 execute.count=perCurseStacks 与已实现的 perCurseKinds（按种类计数）也与「按层数」口径不一致。宁跳勿造。 |
| tt7-goldencicada | 金蝉脱壳 | 能力本身够（draw amount:3 + handOps consumeHand 双门可过），卡在 canonical 守卫：存储卡被 ensureEffectFields 按描述运行时注入 `draw:3`（catalog-after 观测态实测：live 卡带 draw:3，TABLETOP10 定版无该字段），深相等永假——m2 tt7-arcanebolt 同款先例；内联手写补丁快照违背 m1「不另存可漂移数值表」先例。 |
| tt7-marchrush | 急行军 | 「抽 2张牌，+2甲；若本牌为最后一张手牌，效果触发2次」——recast 键仅存在于 damage op 键集（DAMAGE_ALLOWED_KEYS），本牌只有 draw+armor 两段、无伤害段可挂 recast；整体「效果触发2次」无承载。 |
| tt7-demonbreaker | 破甲重斩 | onKill{armor:4} 本身已接线，但卡面 `armor:4` 触发 schema 字段一致性契约「onPlay must declare card.armor」（card-rules.schema.js declaresField，双门实测命中）；补 {op:'armor',amount:4} 会把击杀奖励错成即时加甲——行为偏差，宁跳勿造。 |
| tt3-qi-wave | 气功波 | 「抽 1 张牌，对全体敌人造成等同于其价格的固定伤害」——damage 交叉契约要求「damage requires a supported dmgType and a damage-capable card type」，而卡面**无 dmgType 字段**（TABLETOP10 定版即无，双门实测报错）；为迁卡补字段会破坏深相等守卫。perTargetPrice 键本身已接线，卡面补 dmgType 后可按草案（draw amount:1 + damage perTargetPrice）补迁。 |
| tt3-grope | 摸索 | 「抽2-3张牌」——衍生 `draw:2`（deriveDraw 取区间下限）触发 declaresField 契约「onPlay must declare card.draw」：range 源不算声明字段（双门实测报错）；改 amount:2 又丢「2-3 随机」语义。需 schema 放行「range 含 card.draw 即算声明」后方可迁。 |
| tt7-abysscurse | 深渊诅咒 | 「7′，附加禁疗；此时对方身上每有 1 种诅咒，抽 1 张牌」——衍生 `draw:1` 触发 declaresField：perCurseKinds 源不算声明字段（双门实测报错），amount:1 与 perCurseKinds 又是 draw 五源选一互斥。perCurseKinds 抽牌键本身已接线，同上需 schema 口径扩展后补迁。 |
| tt7-meteorstrong | 星陨之力 | 卡面 `infuse:2`，schema 禁 onPlay 保留 card.infuse≠0（T11，双门实测命中）——注能门在卡面字段而非描述句，迁任何 onPlay rules 必被拒；且「施放 3 次火球」需 execute.what 键（键集无 what），execute 域语义是消灭而非施放衍生牌。双重缺口。 |
| tt3sp-silverthorn | 镭射 | 卡面 `infuse:1`，同上 T11（双门实测命中）；infuseBonus:3 执行器虽已接线（battle.resolution.js damage 分支），但卡面注能字段过不了 schema 门。「注能(1)：伤害+3」的加成本身可表达，阻塞项与 tt12-felguard 族完全同款。 |

## 三、未核实项 / 备注

- 派单注明「tt3sp-silverthorn/tt12-chargeray 的注能动态源已实现（infuseBonus/perInfusedInHand）」——执行器侧核实属实（battle.resolution.js damage 分支），但 silverthorn 卡面 infuse:1 被 schema 岔死，属「键位已通、数据不可表达」，非执行器缺口。
- 派单注明「tt7-meteorstrong 的 execute 键位已接线」「tt7-recruit 的 summon 走 engine summonAlly 已接线」「tt3sp-shadowshot 的 cond.anyCurse 已实现」「cmtn0pbkmnvc 的 execute.count=perCurseKinds 以 SPEC 标注为准」——均已逐条实读核实：summon/execute/anyCurse/perCurseKinds 确已接线并为本批 devour/recruit/shadowshot 所用；但 meteorstrong（T11 + execute 无 what）、流光照影（execute 语义错配）仍不可迁，口径见上表。
- 工作区其他并行改动（battle.view.js / camera.js / game.run.* 等）与本批无交集，未逐一核对。
- cards-sync.json 本次只读（canonical 对照），未写；cards.sync.m3.js 未接入 cards.js 启动链（由主指挥统一接线，建议与 ensureM1/ensureM2 同位追加一行）。
