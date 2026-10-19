# M 批卡牌规则化 · 契约规格（M-BATCH-CONTRACT-SPEC）

- 日期：2026-09-27（代理E）；M2 Wave2 全量落地同日完成（实现状态逐节标注 ✅ / ⏸）
- 依据：legacy 201 张清单 `docs/evidence/e8-card-migration-2026-09-27/legacy-201-scratch.json` 全量归纳（HEAD a8e91e6，272 张卡库 / 71 结构化 / 201 legacy）
- 进度对齐方式（沿用 A3 先例）：**schema 键位先行放行并逐键校验；能力门 `card-rules.capability.js` 反映解释器真实消费进度；解释器未接线的键遇卡即拒（`battle.rule-guard.js` 完整清单门），防静默错结算**
- 回填器先例：`cards.sync.js` ensureA3*（marker 机制、保守排除、不碰 cards-sync.json）——后续批次按此模式迁卡

语义键位一经本规格定版，后续批次不得改义，只能扩集或接线。

---

## 一、需求归纳（legacy-201 全量 → 效果语义类目）

| 类目 | 先例卡（legacy id） | 对应契约 |
| --- | --- | --- |
| 净化 | tt3-holy-water 治愈、tt3-purify-arrow 净化箭、tt3-holy-staff 圣杖、tt8-hero-assassin 白梅落影 | `cleanse`（Wave1） |
| 自伤 | cc-demon 恶魔之力、tt3-silver-runesword 诅咒之剑（回合触发部分） | `heal.selfDamage`（既有） |
| 随机段数/随机量 | tt12-elemburst 元素爆发、tt3-grope 摸索 | `damage.hits.range` / `damage.range`（既有）、`draw.range`（Wave1） |
| 抽到目标手牌数 | tt7-maxsupply 法力补给、tt8-abyss-sovereign（旧日再临抽到 6 张） | `draw.untilHandN`（Wave1） |
| 手牌批操作 | tt7-goldencicada 金蝉脱壳、tt3-fate-wheel 命运钟表 | `draw.handOps`（Wave1：consumeHand/dumpHand） |
| 敌我混排（混合目标） | tt12-sporewall 孢子城墙、cc-demon、tt3-firm-barrier 坚冰结界、tt7-silence 禁言术、tt3-toxin 毒药 | battle.target 混合放行（Wave1） |
| 多目标可重复点选 | tt7-bloodpoison 血毒双镖、tt3-magic-lamp 神灯 | `pick` 段级点选（Wave2 §二.1） |
| 扰敌两名不同目标 | tt7-provoke 扰敌 | 当前已接卡牌目标会话：依次选择两名不同存活敌人；首选不扣费，第二选后一次扣费。先选者攻击后选者，后者存活才反击；取消不消费。 |
| 获取过滤 | tt7-armup 武装、ev19-arrows 箭系列、tt12-breakthrough 突破进展 | `acquire.filter`（Wave1：cost/costMax） |
| 禁疗/破甲诅咒 | tt7-abysscurse 深渊诅咒、tt3-skewer 穿刺、tt8-dragonblade 青龙偃月斩 | `curse: healban / abreak`（v2 既有） |
| 毒伤引爆/层数翻倍 | cc-poison-burst 毒爆、tt3sp-flowerzhen 花鸩、tt3-fly-arrowhawk | `curse.burst / double`（v2 既有） |
| 击杀奖励 | cmtn0xt0zr7 闪金之锤（+币）、tt7-demonbreaker 破甲重斩（+甲）、tt3-blooddrinker 饮血剑 | `damage.onKill`（Wave2 §二.2） |
| 条件乘数 | cc-last-stand 破釜沉舟（末手×2）、cc-rapid-fire 连续射击（已打出计数）、tt2-comboarrow | exec-play 侧修饰（Wave2 §二.3） |
| 注能交互 | tt12-chargeray 充能射线、tt12-felguard 邪能护体、tt7-holyheal 圣光治愈、tt3-element-seal 元素符印 | `perFuelCost`（既有）/ 其余 Wave2 §二.4 |
| 消灭低攻目标 | tt3sp-devour 吞噬、tt3sp-doom TNT | `execute`（键位已定 pending，Wave2 §二.5） |
| 随机/点选施放已有牌 | tt2-jianghu 江湖救急、tt3-frostfall 剑荡妖邪、tt3-reverse-bow 连弩、tt8-hero-sword 万剑归宗 | `acquire.act play/playKeep` + 手牌施放通道（Wave2 §二.6） |
| 墓地计数伤害 | tt3-thunderblast 雷殛 | `damage.graveyard`（键位已定 pending，Wave2 §二.7） |
| 下回合延迟 | tt3-noon-duel 正午决战、tt3-wave-slash 破浪斩、tt7-naturestaff | `damage.schedule` + noDrawNext 键（Wave2 §二.8） |
| 持续 N 回合 | tt3-petal 花瓣法阵、tt3-master-staff、tt-medneedle | 时点 triggers（Wave2 §二.9） |
| 时点触发 | 禁咒 I-IV（抽到）、tt3-chaos-eye（对战开始）、tt2-venomstaff（打出法术）、tt7-demonbreaker（击杀时）、tt2-wreck（消耗时） | `triggers.onDraw/onBattleStart/onTurnStart/onConsume/onKill`（Wave2 §二.9） |
| 装备槽 | tt3-longsword（静态+攻）、tt3-staff（静态法伤）、tt2-frostsword（条件被动）、tt3-deep-diary、tt12-raygun（主动技能）、tt3-azure-sword（消耗时） | `rules.equip`（G5 键位已定，Wave2 §二.10） |
| 形态/全局修饰 | tt3-nature-form（能量上限）、tt7-swordimmortal、tt5-galaxy-voyage（全局费用）、tt7-burnharvest（法伤乘数）、tt8-hero-warrior（转化） | energyCap/spellUp（既有）+ `costModifiers` G8 + `registerRule/transform`（Wave2 §二.11） |
| 召唤物 | tt7-recruit 征召、tt8-abyss-sovereign 封印肢体 | `summon`（键位已定 pending，Wave2 §二.12） |
| 额外回合 | tt3-fate-wheel 命运钟表 | `extraTurn`（键位已定 pending，Wave2 §二.12） |
| 药水/背包使用 | tt3-blue-potion 回复、tt3-turnabout-potion 剧毒、tt3-python-potion AOE、tt3-mind-potion 抽牌、tt4-smoke-bomb 逃跑、tt3-mystery-potion 变形、tt3-houyi-potion 增益 | `rules.bag.use` op 扩展（Wave2 §二.13） |
| 随机置入至手牌数 | tt8-hero-priest 浪掷风吟 | `acquire.untilHandN`（Wave2 §二.6） |

---

## 二、Wave1 本次实现（onPlay 框架内，已接线可执行）

> schema＝`card-rules.schema.js`；能力门＝`card-rules.capability.js`；执行＝`battle.resolution.js` 注册点 + `battle.effect-steps.m1.js`（新挂接件）。每个键的放行与消费同步收口，回填器按 A3 ensure* 模式迁卡时无需再动执行端。

### 1. `cleanse` — 净化

- 字段：`{ op: 'cleanse', target: 'self' }`（Wave1 仅 `self`，净化敌方无卡面需求）
- 语义：清除自身全部诅咒（叠层与计时全部归零），`combat.purify` 与文本路径 buff.purify 同源；沉默门之后结算（被沉默封印）
- 混排：与敌方 op 混排时免 `battle.target.side==='self'` 强制（见本节 6）；单卡至多声明一次
- 表达例（治愈 tt3-holy-water）：

```js
rules: { version: 1,
  battle: { target: { side: 'self', area: false } },
  triggers: { onPlay: [
    { op: 'heal', amount: 5 },
    { op: 'cleanse', target: 'self' },
  ] } }
```

- 执行入口：`effect-steps.m1.js` `resolveCleanseOperation`（注册点 `battle.resolution.js` 结构化 op 循环 cleanse 分支）

### 2. 自伤 loseHp — 由既有 `heal.selfDamage` 承接

- 字段：`{ op: 'heal', selfDamage: <正整数> }`
- 语义：「损失 N 点生命」非治疗，不走禁疗门，`damagePlayer` 命令（与文本路径 dmg.loseLife 同底层）；本批补规格、能力门与实战测试，无新键
- 表达例（恶魔之力 cc-demon，见本节 6 混排）：

```js
{ op: 'heal', selfDamage: 2 }
```

### 3. 随机段数/随机张数 randomCount 族

- 已有（规格收口）：`{ op: 'damage', hits: { range: [min, max] } }`（段数每次施放掷一次）、`{ op: 'damage', range: [min, max] }`（伤害值区间，必须包含 card.dmg 保预览真实）
- 新增：`{ op: 'draw', range: [min, max] }`——抽取张数区间（摸索「抽2-3张牌」），与 amountField/amount/untilHandN 四选一；BOSS 战 drawCards、普通战 grantSha（同既有 draw 口径）
- 执行入口：`battle.resolution.js` draw 分支 `rollRange`（区间掷骰与 dmg.direct 同口径）
- 表达例（摸索）：

```js
{ op: 'draw', range: [2, 3] }
```

### 4. `draw.untilHandN` — 抽牌直到手牌 N 张

- 字段：`{ op: 'draw', untilHandN: <正整数> }`
- 语义：BOSS 战逐张 drawCards(1)，牌库空或手牌达 battleHandMax 自然截停；普通战无牌库，按差额获得【初始攻击】（「补齐到 N 张」）；抽到的法术计入 perSpellHeal 折算基数
- 能力门：由 pending 放行转 supported
- 执行入口：`effect-steps.m1.js` `resolveDrawUntilHandN`
- 表达例（法力补给 tt7-maxsupply）：

```js
{ op: 'draw', untilHandN: 4 }
```

### 5. `draw.handOps` — 抽牌前置手牌操作

- 字段：`{ op: 'draw', amount|range|untilHandN|amountField: …, handOps: [{ op: 'consumeHand' | 'dumpHand' }, …] }`
- 语义：**先按数组序执行 handOps，再执行主抽牌**（金蝉脱壳「消耗所有手牌，抽 3 张」的卡面语序即结算序）
  - `consumeHand` 消耗：进 consumed，BOSS 战进墓地（与 engine dumpHand 端口同款）
  - `dumpHand` 弃置：BOSS 战进弃牌堆（可洗回）；普通战无弃牌循环，降级为消耗并日志注明
  - `copyRandom / keepInHand / noInfuse` 键位保留（HAND_OP_KEYS），能力门仍拒，Wave2 接线
- 执行入口：`effect-steps.m1.js` `resolveDrawHandOps`
- 表达例（金蝉脱壳）：

```js
{ op: 'draw', amount: 3, handOps: [{ op: 'consumeHand' }] }
```

### 6. 混合目标契约（Wave1：side 混排放行）

- 缺口：一张卡既有敌方域 op（damage / curse target≠self）又有自身域效果 op（heal/armor/draw 字面量源、cleanse）时，v1 交叉契约要求整卡 side 一致，必然矛盾（A3 排除记账 5 张即此缺口）
- Wave1 语义：`battle.target` 按**主体效果**声明（通常 `side:'enemy'`）；自身域效果 op 满足以下全部条件时免 side/area 强制——
  1. onPlay 同时存在敌方域 op；
  2. 自身域 op 为**字面量源**（amount/upTo/selfDamage/perFuelCost/perSpellHeal/guard/untilHandN/range；field-anchored 的 amountField 不参与，沿用「damage 不能与 heal/armor/draw 混排」v1 口径）；
  3. 结算本就自指（heal/armor/draw/cleanse 恒作用于玩家），解释器无需分支
- 表达例（孢子城墙 tt12-sporewall）：

```js
rules: { version: 1,
  battle: { target: { side: 'enemy', area: false } },
  triggers: { onPlay: [
    { op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy' },
    { op: 'armor', amount: 6 },
  ] } }
```

- 注：**多目标可重复点选**（血毒双镖「选择两个目标（可以重复）」）需要出牌流程二次点选交互，归 Wave2 §二.1；血毒双镖现状走专支（`battle.exec-play.js` beginDartStrike）不变

### 7. `acquire.filter` 基础扩展

- 键位（schema 放行+逐键校验）：`filter: { type?: 卡牌类型, cost?: 非负整数, costMax?: 非负整数 }`，至少一键
- 能力门（消费进度）：Wave1 只消费 `cost / costMax`；`type` 过滤与池名词单源 parsePoolNoun（'装备'/'法术'…）重叠，保持拒绝——E6 回归锁定「未消费的 filter 必须在结算前拒绝」
- 语义：filter 在池谓词上叠加约束（AND）；named 具体卡名直取不受 filter 影响；filter 存在时随机抽卡走指定池口径（randomDiscoverCard pred 分支，排除生物/事件/资源/衍生）
- 执行入口：`battle.resolution.js` `resolveAcquireOperation` filter 谓词叠加
- 表达例（零费招式获取）：

```js
{ op: 'acquire', n: 6, pool: { kind: '招式' }, dest: 'hand', filter: { cost: 0 } }
```

### 8. 禁疗 / 破甲诅咒（既有，规格收口）

- `curse: 'healban'`（禁疗，计时型必填 duration）/ `curse: 'abreak'`（破甲，计时型必填 duration），target 可 chosenEnemy/allEnemies/randomEnemy/self
- 执行已接线：`battle.resolution.js` `resolveCurseOperation`（combat.addCurse 同一状态袋）；禁疗治疗门 `healban` 在 heal/lifesteal 路径既有
- 表达例（深渊诅咒 tt7-abysscurse）：

```js
{ op: 'curse', curse: 'healban', duration: 1, target: 'chosenEnemy' }
```

---

## 三、后续批次实现（M2 已于 2026-09-27 落地，状态逐节标注）

> **M2 落地总述**：块1（onPlay 剩余）与块2（triggers/lifecycle/装备域）已全部实现——执行件
> `effect-steps.m2.js` + 时点 runner `battle.triggers.m2.js`；engine 端口装配扩展与触发挂点
> （drawCards/processDelayed/playerTakeHit/applyKillRewards/fireConsumeTriggers）、exec-play
> 打出登记与剥离、equipment 结构化域、card-cost movesPlayedDiscount、enemy-phase onTurnEnd
> 与 atkDown 归还。resolver 新守卫：非 onPlay 时点容器必须经 runner 登记管线（直接喂 resolver
> 即 throw——防绕过管线静默不结算）。未落地例外仅 2 项（见 ⏸ 标注）。

### 二.1 `pick` 段级点选 / `bindTarget` 段绑定（✅ M2 落地 bindTarget；pick:'new' 交互仍挂 bag 域，未落地 ⏸）

```js
// 血毒双镖：两段各自点选，可重复
{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', pick: 'new' },
{ op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy', pick: 'new' }
```
- `pick: 'new'`：该 op 结算前请求玩家重新点选（缺省沿用本牌目标）；需要出牌流程的交互挂接（target-session/interaction 域）与 staged-playback 等待段。消费点：`battle.exec-play.js`（点选编排）+ interaction 层；血毒双镖专支（beginDartStrike）为既有参照

### 二.2 `damage.onKill` 击杀奖励（✅ M2 已实现——effect-steps.m2.js applyDamageOnKill，注册点 resolution damage 分支尾部）

```js
{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', onKill: { coins: 2 } }      // 闪金之锤
{ op: 'damage', amount: 5, target: 'chosenEnemy', onKill: { armor: 4 } }               // 破甲重斩
```
- 语义：本 op 造成击杀时按键结算（coins 走 addCoins、armor 走 addArmor）；键集 `{coins, armor}`，正整数。消费点：`battle.resolution.js` damage 分支（foesHit.some(dead) 处，与 recast 判定同位）

### 二.3 条件乘数（✅ M2 落地：hits.perPlayedMoves 段数动态源 + recast.on:'lastHand' 末手重施；lastHandMultiplier 未设键⏸）

```js
{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', lastHandMultiplier: 2 }     // 破釜沉舟「最后一张手牌触发2次」
{ op: 'damage', amount: 2, target: 'chosenEnemy', perPlayedMove: { type: '招式' } }    // 连续射击
```
- 语义：末手判定与打出计数器（playedMovesThisTurn）在 exec-play 侧（结算后自增口径不变）；建议消费点 `battle.exec-play.js`（末手整卡重跑已有文本路径先例）。命名在实现批定版，本条锁定语义

### 二.4 注能交互（✅ M2 落地 damage.perInfusedInHand + damage.infuseBonus；perFuelCost 既有；allSpellsInfused 仍走 registerRule 专支⏸）

- 已有：`perFuelCost`（圣光治愈「N 倍于被注能卡牌价格」）、`infuseFuels` 计数（充能射线文本路径）
- Wave2：`charged: true`（视为已注能——`registerRule: 'allSpellsInfused'` 卡面族）、注能作为代价（魔法锅炉「注能(2)：随机获取3张」）、「本牌在手时每注能过 N 张」结构化（`perInfused`）。高危：邪能护体式注能门卡（N1 明星卡白嫖风险）单独验收

### 二.5 `execute` 消灭低攻目标（✅ M2 已接线——cap.atk/maxHpBelow 筛选、count/perCurseKinds 动态数量、onKill 奖励；hitFoe 真伤致死走完整死亡流程）

```js
{ op: 'execute', cap: { atk: 4 }, count: 1 }        // 吞噬：消灭攻4及以下小怪
{ op: 'execute', cap: { atk: 5 }, count: 2 }        // TNT
{ op: 'execute', cap: { maxHpBelow: 20 }, onKill: {…} }
```
- 消费点：battle.resolution.js execute 分支（非 BOSS 免疫口径沿用文本路径）
- 单敌明确目标只结算该敌，失效或不满足 cap 不转杀其他敌。仅含普通 execute 的单敌卡在手动出牌前校验：具体目标不合格或场上全无合格敌人时拒绝且不扣费/耗牌；仍有合格敌人时可进入选靶。无明确目标的自动结算与无目标多敌效果保留原候选顺序和 count；混合效果不提前套用此纯 execute 预检。

### 二.6 施放已有牌 / acquire 组合扩展（✅ 部分：discover playKeep「施放1张其余入手」既有支持=永恒绽放口径；pool.kind 注能/其它职业/形态/药水/牌库底 已通；hand/deck 直发 play 通道仍 pending ⏸；acquire.untilHandN ⏸）

```js
{ op: 'acquire', n: 1, pool: { kind: '射线' }, dest: 'discover', act: 'play' }          // 射线枪（已有组合）
{ op: 'acquire', n: 2, pool: { kind: '随机' }, dest: 'hand', untilHandN: 6 }            // 浪掷风吟（新键位）
```
- Wave2：`acquire.untilHandN`（随机置入直至手牌 N 张，perAcquired 类折算挂接）；hand/deck 的 `act: 'play'/'playKeep'/'zeroCost'/'decay'` 直接施放通道（现 capability 拒，先例：江湖救急专支、发现面板 act）

- 已支持 `acquire {n, pool:{kind:'注能'}, dest:'discover', act:'noInfuse'}`：沿既有发现队列展示候选，确认后仅选中实例复制并携带 `_noInfuse:true`；不在候选生成时授予或改全局模板。连续发现保留 `act`，每轮独立实例；灵能召唤结构化与旧文本路径对齐此契约。M3 v5 仅对精确匹配旧 `dest:'hand'` 规则和定版卡面的存档迁移，玩家自改卡保留。

### 二.7 `damage.graveyard` 墓地计数伤害（✅ M2 已接线——damage 分支 grave 计数×perCard，普通战无墓地不生效）

```js
{ op: 'damage', amount: 7, target: 'chosenEnemy', graveyard: { type: '法术', perCard: 1 } }   // 雷殛
```
- 普通战无墓地不生效（文本路径同口径）

### 二.8 下回合延迟效果（✅ M2 已接线——schedule:'nextTurn'/'nextTurnStart' 经 delayed 管线 triggerOps 通道；noDrawNext 新 op 接 markNoDrawNext）

```js
{ op: 'damage', amount: 2, target: 'chosenEnemy', schedule: 'nextTurn', hits: { count: 4 } }  // 正午决战
```
- `schedule:'nextTurn'` 键位已定（pending throw）；破浪斩「下回合无法抽牌」需 `noDrawNext: true` 新键位（runtime 有承载 noDrawNext，卡面结构化待批）；自然法杖「下回合变 0 费」走 cardOverrides 承载，建议 `registerRule` 扩键或独立 op，实现批定版

### 二.9 时点触发 triggers（✅ M2 已接线——七时点 onTurnStart/onTurnEnd/onBattleStart/onConsume/onDraw/onKill/onDamaged/onPlayCard + 容器级 duration；runner=battle.triggers.m2.js，登记=打出/穿戴，触发=回合管线/抽牌/受击/击杀/消耗；onPlayCardFilter 类型过滤 ⏸）

- 键位已定：`triggers.onTurnStart / onBattleStart / onConsume / onDraw / onKill`（schema 放行、capability 拒、resolveCardSteps 遇非 onPlay 即 throw）
- 持续 N 回合（花瓣法阵）= `onTurnStart` + `duration` 修饰（实现批定版：建议 op 级 `lastTurns` 注册到期回收，走 delayed 管线）
- 「抽到即施放」（禁咒族）已有文本承载（drawCards parts.onDraw）；结构化即 onDraw 容器接线
- 「打出牌时」（毒杖）/「击杀时」（饮血剑）/「对战开始时」（混沌之眼、灵符）/「受到伤害时」——onDamaged 为新键位提案，实现批与 counter 语义（darkfort 免死）一并定版

### 二.10 装备域（✅ M2 已接线——onEquip/battleStart 穿戴即结算、passive.aura atk/spellPower/focus（focus 每回合能量）、passive.cond.hasCurse 动态核算、skill.ops 主动技能；container 容量声明属 bag 域 ⏸ capability 保持拒绝）

```js
equip: {
  onEquip: [ { op: 'armor', amount: 5 } ],                    // 草甲：装备时
  battleStart: [ { op: 'maxHp', n: 10 }, { op: 'deckCap', n: 5 } ],   // 混沌之眼
  passive: { aura: { atk: 1 } },                              // 长剑
  passive: { cond: { hasCurse: true }, aura: { atk: 2, spellPower: 2 } },   // 深海咒印
  skill: { oncePerBattle: true, ops: [ { op: 'cleanse', target: 'self' }, { op: 'heal', amount: 5 } ] },   // 圣杖
  container: { slots: 3, accepts: '法术' }                    // 法师锦囊
}
```
- 消费点：battle.equipment.js（registerEquip 已挂）+「消耗该牌时」走 onConsume trigger（沉船宝盒/百炼青虹剑/矿工炸药/奥术残卷）

### 二.11 形态/全局修饰（✅ M2 落地 registerRule bleedAmp/meleeCost1/spellCost1 + costModifiers movesPlayedDiscount（card-cost）；energyCap/spellUp/atkUp/maxHp 既有；transform 键位已定仍 pending ⏸）

- 已有：`energyCap`（自然形态「本局能量上限+1」）、`blessing spellUp/atkUp`（法伤/攻击加成）、`maxHp`
- Wave2：`costModifiers` G8 三键（typeCostRule / movesPlayedDiscount / handMorphZeroFee——schema 注释已留名，消费点 battle.card-cost.js）；`registerRule: 'allSpellsInfused'`（旧日再临）/`'growth'`（回合成长）/`'consumeFireball'`（深渊降焰）接线；`transform`（what: sha/self/handCard——青龙化身「初始攻击化为青龙偃月斩」= what:'sha' 换名改卡）

### 二.12 召唤物 / 额外回合（✅ M2 已接线——summon 走 engine summonAlly 随从位；extraTurn 置 runtime extraTurn 旗标（enemy-phase 消费））

```js
{ op: 'summon', name: '步兵', atk: 4, hp: 4, count: 2, taunt: true }   // 征召
{ op: 'extraTurn' }                                                     // 命运钟表（配套 handOps consumeHand）
```

### 二.13 `rules.bag.use` 药水/背包使用扩展（⏸ 未落地——bag.use op 消费点 battle.bag.js 属禁改域，本轮未动；schema 键位仍仅 heal/restoreConsumed）

```js
bag: { use: [ { op: 'curse', curse: 'poison', stacks: 2, target: 'allEnemies' } ] }   // 剧毒药水
bag: { use: [ { op: 'damage', amount: 2, dmgType: 'spell', target: 'allEnemies' } ] } // 火焰药水
bag: { use: [ { op: 'draw', amount: 2 } ] }                                            // 精神药水
bag: { use: [ { op: 'energy', n: 1 } ] }                                               // 恢复药水（回复+能量）
bag: { use: [ { op: 'escape' } ] }                                                     // 烟雾弹（非BOSS战逃跑一次）
bag: { use: [ { op: 'transform', what: 'self', into: { pool: '随机招式' }, cost: 0 } ] } // 神秘药水
bag: { use: [ { op: 'blessing', key: 'atkUp', stacks: 2, duration: 1 } ] }             // 狂暴药水
```
- 消费点：battle.bag.js `usePotion`（BOSS 战道具禁打出口径沿用）；`escape`/`transform` 为新 op 键位提案，实现批定版（escape 需 finish(false) 通道，transform 需卡牌替换动画）

---

## 四、验收与测试索引

- M1 测试：`tests/m1-contract.test.js`——21 用例（schema/能力门契约 + 真实 BattleSession 集成 + boss 分支单元）
- M2 测试：`tests/m2-contract.test.js`——22 用例（块1 schema/能力门契约 7 + 真实 BattleSession 集成 10 + runner/单元 5）
- 回归基线：`tests/card-rules-schema.test.js`、`tests/e6-card-rules-execution.test.js`、`tests/structured-onplay-battle.test.js`（E6「未消费 filter 组合必须先拒后结」与「未消费键必拒」口径对本规格有约束力，扩键时保持）
- 关联定向：`tests/a3-battle-rules.test.js`（A3 回填先例）、`tests/battle-resolution.test.js`
- 迁卡批次验收口径：新迁移卡 validateCardRules ok + inspectCardRuleCapability supported + 真实 BattleSession 结算与卡面描述一致（structured-onplay 模式），marker 幂等回填不碰 cards-sync.json
