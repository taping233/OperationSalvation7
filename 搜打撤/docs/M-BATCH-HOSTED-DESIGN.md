# M 批 XL 卡混合实现设计（M-BATCH-HOSTED-DESIGN）

- 日期：2026-09-27（代理H，只读预研产出）
- 基线：HEAD `a8e91e6` + **工作区在途未提交的 M1/M2 契约扩展**（`card-rules.schema.js`、`card-rules.capability.js`、`battle.resolution.js`、`battle.exec-play.js`、`battle.equipment.js`、`battle.card-cost.js`、`battle.rule-guard.js`、新增 `effect-steps.m1.js`/`effect-steps.m2.js`/`battle.triggers.m2.js`/`cards.sync.m1.js`/`cards.sync.m2.js` 等）。本文全部「文件:行号」为 2026-09-27 工作区实读核实，非 HEAD、非矩阵转抄；实现代理开工时若在途件已合入/再漂移，以语义定位为准。
- 设计对象：矩阵 `docs/M-BATCH-MATRIX.md` 的 21 张 XL 卡（§六 XL 清单）。逐卡给出现状链路、rules 形状草案、宿主命名分支（`hosted:<name>`）、触发链路、风险与口径。
- 配套口径：`docs/M-BATCH-CONTRACT-SPEC.md`（Wave1 已实现 + Wave2 设计）、`docs/M-BATCH-EXCLUSIONS.md`（排除卡，本文多处引用其"不得合并/不得规则化"约束）。

---

## 〇、架构警报（实现代理必读）

1. **battle.core.js 已是垫片**：宿主状态旗标的声明体已迁出（矩阵里 `battle.core.js:73-115` 一带现在只剩注释）。现行旗标真身：
   - `battle.runtime.effects.js:2-36`——stealthStrike(:2)、spellCost1(:4)、meleeCost1(:5)、shaTransform(:6)、consumeFireballN(:7)、growthNames/growth(:11-12)、infuseFuels(:13)、sealUnlocked(:14)、extraTurn(:15)、deathSave(:16)、killAtkUp(:17)、poisonOnSpell(:18)、poisonLegacy(:19)、playerCurseImmune(:35)、allSpellsInfused(:36)；回填/重置 `restoreEffectState`(:79+)。
   - `battle.runtime.piles.js:8-9`——zeroFeeUntil(:8)、cardOverrides(:9)，重置 :53。
2. **在途 M2 已大量接线**（capability `card-rules.capability.js:13-25`）：execute/summon/transform/registerRule/extraTurn/stealAtk/noDrawNext 全放行，七时点触发器放行（:96-99），装备域除 container 外放行（:91-95），graveyard/schedule 已消费（pendingKeys 数组已空，:113-116）。**transform 是例外**：capability 放行了（:24），但 `battle.resolution.js:846-868` 结构化 op 循环**没有 transform 分支**——遇之静默掉出循环（:923 的 throw 白名单只有 heal/armor/draw），只落 :1098 占位日志。实现批必须二选一：补 resolver 分支，或 capability 收回 transform。
3. **回填器模式已定型**：`cards.sync.m1.js`/`cards.sync.m2.js` 的 `ensureM2OnplayRules`（cards.sync.m2.js:145-232）——marker 一次性、canonical 整卡深相等才回填、schema+capability 双门先校验后保存、不碰 cards-sync.json；接线点 `cards.js` ensureTabletop 尾部（cards.js:276-277）。本文所有"数据回填"均指照此模式**新建 cards.sync.mX-hosted.js 类文件**，不改共享回填器。
4. **迁卡验收三件套**（沿用 M2 口径）：validateCardRules ok + inspectCardRuleCapability supported + 真实 BattleSession 结算与卡面一致。

---

## 一、总体设计框架

### 1.1 `hosted` 键机制（本文统一推荐的结构声明）

老板已授权"rules 结构 + 宿主命名分支"混合实现。统一落法：

```js
rules: { version: 1, battle: { hosted: ['<name>'] } }   // <name> 即 hosted:<name> 分支名
```

- schema：`BATTLE_KEYS`（card-rules.schema.js:1）加 `'hosted'`，校验分支照 requirements 模式（card-rules.schema.js:994-1017）：字符串数组、白名单枚举。
- capability：`inspectCardRuleCapability` 加 hosted 分支——**已接线的分支名放行，未接线的拒绝**（沿用"未消费键必拒"口径，防静默错结算）。
- 语义：`battle.hosted` 只做"该卡依赖宿主命名分支 X"的声明与识别锚点；宿主按 `card.rules?.battle?.hosted?.includes(name)` 识别，**不再依赖 desc 正则/id 直等**（id 兜底可保留）。rules 里没有 onPlay ops 时 `hasStructuredOnPlay` 为 false（battle.resolution.js:809），文本路径照常——这正是"宿主保持型"卡的迁移形态。

### 1.2 三档策略

| 档 | 判据 | 做法 |
| --- | --- | --- |
| A 纯结构化（XL 降级） | 在途 M2 已把语义全部接线 | 只做数据回填，零宿主改动 |
| B 旗标收编 | 宿主是一个布尔/计数旗标，登记点在打出侧 | rules 用 `registerRule`（扩 REGISTER_RULE_KEYS）或 hosted 标记 + 登记点改读 rules |
| C 宿主保持 | 宿主是跨域流程（容器/封印链/抉择/免死/换费），无 op 可表达 | `battle.hosted` 标记（或保持 legacy），宿主一行不动 |

### 1.3 挂接原则

- 新文件优先：执行件新建 `effect-steps.m3-hosted.js`（或并入 m2）、回填新建 `cards.sync.mH.js`；共享文件只允许"一行调用/一行条件"级 diff。
- 必碰共享文件时，逐卡在 §四 冲突表列明文件与预计 diff 规模；同文件归同批串行。

---

## 二、逐卡设计（21 张）

### 2.1 tt7-imitate 不变应万变-改（武术｜B 档）

**现状链路**（全部实读）：
- 定义：cards.data.js:667（cls 侠客，desc「在手牌中时，本牌变为打出的上一张武术牌的1费复制」，职业卡 sellable:false）。
- 替身写入：`applyImitate` battle.engine.js:1063-1072——打出武术后，手牌中 `card.id === 'tt7-imitate'` 且尚无 override 的牌，`cardOverrides.set(uid, {...playedMartial, cost: 1})`。
- 打出侧触发：battle.exec-play.js:187-188（`card.type === '武术'` → `applyImitate(card)`）。
- 替身生效：`findCard` 优先读 cardOverrides（battle.engine.js:440-441）；费用即复制卡 cost=1（`effCostOf` battle.engine.js:448-468 → calculateEffectiveCardCost battle.card-cost.js:20 直读 card.cost）；打出时 execPlay 收到的就是替身卡（play 入口 battle.engine.js:1144 queueCardExecution(uid, playCard…)）。
- 生命周期：cardOverrides 战斗结束重置（battle.runtime.piles.js:53；lifecycle 重置链 battle.lifecycle.js:282 一带）。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['imitate'] } }`。无 onPlay ops（打出时结算的是替身的内容，不是本卡的）。
- 分支名：`hosted:imitate`。宿主本体（applyImitate）**不动**，仅把识别条件从 `card.id === 'tt7-imitate'`（battle.engine.js:1067）扩为「id 直等 **或** rules.battle.hosted 含 'imitate'」——预计 diff 1 行。
- 挂接点：battle.engine.js applyImitate（1 行）+ 数据回填新文件（canonical 深相等口径下 desc 不改，rules 追加）。

**触发链路**：打出任一武术 → queueCardExecution(battle.exec-play.js:24) → execPlay(:56) 结算主体 → :187-188 applyImitate → cardOverrides 写入 → 玩家打出替身时 findCard(:440-441) 返回替身 → effCostOf(:91) 按 1 费 → resolveCardWithFeedback(:128) 按替身内容结算。

**风险与口径**：
- 替身继承被复制武术的 rules（spread 复制），若被复制卡已结构化，替身自动走结构化路径——需回归验证 rejectUnsupportedCard 对替身放行。
- **只换一次**：battle.engine.js:1067 `!cardOverrides.has(h)` 守卫——已变形的 imitate 不随后续武术再变形。与卡面"变为打出的上一张"的持续语义有出入，现行口径即如此（需老板确认，见 §五.5）。
- 替身打出后 cardOverrides 残留到战斗结束才清——与现有 reset 口径一致，无泄漏。

---

### 2.2 cc-mana-surge 法力奔涌（法术｜B 档）

**现状链路**：
- 定版：cards-sync.json:117（cost 2，「对随机敌人释放4个随机法术（这些随机法术默认已注能）。」）。
- 结算入口：battle.resolution.js:1041-1047——`!hasStructuredOnPlay && (surgeM 正则 || card.id==='cc-mana-surge' || 名称含法力奔涌)` → `startSurge(castRandomSpells(4, card.id))`。
- 执行体：`castRandomSpells` battle.engine.js:909-935——池=法术且 isRandomObtainable 且排除自身(:911-912)；每发对随机存活敌 `resolveCardWithFeedback(spell, t, true, 0, …)`（infused=true，:926）；全灭截停(:921)；慢动作 850ms（vitest=0，:892）+ 演出事件（battle.anim.js:143,180-189）。
- 演出等待：execPlay 内 `takeSurge`（battle.exec-play.js:129；engine:903-908）。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['mana-surge'] } }`。「随机施放 N 张」无 op 可表达（acquire.act:'play' 是发现面板交互，非全自动）。
- 分支名：`hosted:mana-surge`。两条实现路径：
  - 最小（推荐）：保留 battle.resolution.js:1044 的 id/名称兜底不动（迁移不改 id，永不失配），数据回填仅加 hosted 声明。**零执行端 diff**。
  - 显式：resolution 结构化 op 循环加 hosted 分支调 `startSurge(castRandomSpells(...))` 端口（resolution +8 行）。仅当后续要把 id 兜底拆掉时才需要。
- 挂接点：数据回填新文件；共享文件零改动（最小路径）。

**触发链路**：打出 → queueCardExecution(exec-play:24) → execPlay(:56) → resolveCardWithFeedback(:128) → resolveCardSteps → :1041-1047 识别 → startSurge → castRandomSpells(engine:909) 逐发 infused 直结 → execPlay :129 takeSurge 等演出完。

**风险与口径**：
- 「默认已注能」= 第 4 参 infused=true（engine:926），随机法术的「注能(N)」加成句照常生效且无需燃料——被随机到的法术若已结构化，走 resolveCard 结构化路径的 infused 语义，已贯通（exec-play:126 同源口径）。
- 慢动作依赖 signal/abort（engine:894-901）——任何改造不得绕开 startSurge/takeSurge 通道同步裸调。
- 随机法术结算**不经过 execPlay 打出侧登记**（直接 resolveCard）——不触发毒杖/imitate 等打出侧联动（现行口径，毒杖卡有备注，见 §2.8）。

---

### 2.3 cc-rot-seed 腐化之种（法术｜B 档）

**现状链路**：
- 定版：cards-sync.json:147（「对 1 名敌人附加 2 层中毒；其死亡时，将中毒层数转移给另一名敌人。」）。
- 登记（打出侧）：battle.exec-play.js:155 正则 `/死亡时[^。；]*中毒层数转移/` → `set$poisonLegacy(true)`（旗标 battle.runtime.effects.js:19）。
- 结算：`transferPoisonLegacy` battle.engine.js:182-190——死亡敌人身上全部中毒层数转给 `alive()` 顺位下一名(:184)，Combat.addCurse 叠加。
- 死亡钩子统一入口：`resolveFoeDefeat` battle.engine.js:158-178（:166 调 transferPoisonLegacy）——hitFoe 直伤、sweepDead 补扫(:179-181)、毒发死亡三条路径全部汇聚于此。
- 动词登记表：effect-verbs.js:130（poisonLegacy，impl battle.core）。

**设计**：
- rules 形状（规则部分纯结构化）：
```js
rules: { version:1,
  battle: { target: { side:'enemy', area:false } },
  triggers: { onPlay: [
    { op:'curse', curse:'poison', stacks:2, target:'chosenEnemy' },
    { op:'registerRule', rule:'poisonLegacy' },
  ] } }
```
- `registerRule:'poisonLegacy'` 需扩键：schema REGISTER_RULE_KEYS（card-rules.schema.js:95-97）+1 词；capability registerRule 已全放行（:24）；`resolveRegisterRule`（effect-steps.m2.js:78-96）加一个 if 分支调 set$poisonLegacy 端口（+4 行）——与既有 bleedAmp 分支（:80-84）同模式。
- 分支名：`hosted:rot-seed`（转移结算宿主保持 transferPoisonLegacy 不动；exec-play:155 文本正则保留，兼容旧档文本克隆）。
- 挂接点：effect-steps.m2.js（+4 行）、card-rules.schema.js（+1 词）、engine 的 resolution 装配处补 set$poisonLegacy 端口（+1 行）。

**触发链路**：打出 → execPlay(:56) → resolveCardWithFeedback(:128) → 结构化循环（resolution:833-836 curse op → :865-868 registerRule op）→ 登记旗标 → 任一敌人死亡 → resolveFoeDefeat(engine:158) → transferPoisonLegacy(:166→:182)。

**风险与口径**：
- **必须挂死亡链、不得挂 onKill 触发器**：M2 triggers.onKill 走 applyKillRewards（engine:1009），毒发死亡不经过击杀奖励管线——挂在 onKill 会漏"毒发致死"这一主场景。
- 「另一名敌人」=存活顺位下一名（engine:184），非随机；全灭时转移不发生（:186 return）——现行口径。
- 2 层中毒由结构化 curse op 承接后，文本路径的 CURSE_SCAN（engine:470-478）与结构化并存不双叠（hasStructuredOnPlay 时文本 immediate 不跑，resolution:1053）。

---

### 2.4 cmtn1lbhbqi4 充能火球（法术｜B 档）

**现状链路**：
- 定义：cards.data.js:677（cls 降临者，cost 1，dmg:4 dmgType:spell，desc「4‘，回合开始时，本牌伤害+1」）。
- 登记（打出侧）：battle.exec-play.js:152 正则 `/回合开始时[，,]?\s*本牌伤害\s*\+/ && card.name` → `growthNames.add(card.name)`；另一入口 effect-steps.audit.js:60-67（dmg.growth step → registerGrowthCard）——双入口幂等（Set）。
- 成长：`accrueGrowth` battle.engine.js:711-717——手牌/牌库/弃牌/墓地全部**同名**副本按 uid +1；调用点 battle.enemy-phase.js:324（回合开始）。
- 消费：结构化伤害路径 battle.resolution.js:519（dmgVal += getGrowth(uid)，区间掷骰同段）；文本伤害路径 :668（`(+card.dmg||0) + getGrowth(uid)`）。
- 旗标：battle.runtime.effects.js:11-12（growthNames/growth），restore :84。

**设计**：
- rules 形状：
```js
rules: { version:1,
  battle: { target: { side:'enemy', area:false } },
  triggers: { onPlay: [
    { op:'damage', amountField:'dmg', target:'chosenEnemy' },
    { op:'registerRule', rule:'growth' },
  ] } }
```
- `'growth'` 键**已在** schema REGISTER_RULE_KEYS（card-rules.schema.js:97），但 effect-steps.m2.js:95 注释明确「growth 走引擎既有专支端口」——即 resolveRegisterRule 尚未消费。补分支：`rule==='growth'` → `deps.addGrowthName(card.name)`（+4 行），m2Deps 增端口（engine 装配 +1 行）。
- 分支名：`hosted:charge-fireball`（成长累积与消费宿主 accrueGrowth/getGrowth 不动；exec-play:152 文本正则保留兜底）。
- 挂接点：effect-steps.m2.js、battle.engine.js 装配、schema 零改（键已在）。

**触发链路**：打出登记（exec-play:152 或结构化 registerRule）→ 每回合开始 enemy-phase:324 → accrueGrowth(engine:711) → 打出时 resolution:519/:668 读 getGrowth(uid) 叠加伤害。

**风险与口径**：
- 成长按**卡名**累积、按 **uid** 消费——同名副本全部成长（engine:713-716），卡名变更即断链（与 T10 初始攻击识别链同族风险）。
- 普通战/BOSS 战回合管线都调 accrueGrowth（enemy-phase:324），两模式行为一致；普通战无牌库/墓地时其副本自然不成长，实现批定向验证一次普通战回合开始。
- damage op 用 amountField:'dmg' 锚定卡面 4，成长叠在其上（:519）——与矩阵草案一致，无需新键。

---

### 2.5 tt5-galaxy-voyage 银河之旅（法术｜A 档，XL→实为 S）

**现状链路**：
- 定版：cards-sync.json:608（cost 2，「本场对战中，你的所有武术均为 1 费。」——**注意** cards.data.js:229 的 TT5 旧行是「所有法术 1 费 cost 4」，CARDS_SYNC 后播覆盖（cards.js:259 ensureCardsSyncLive 晚于 :245 ensureTabletopSync），现行卡面=武术）。
- 文本路径登记：resolveCard 文本段（battle.resolution.js:1096 parts.battle）→ `registerBattle` battle.engine.js:720-735——正则 `/所有(?:法术|招式|武术)[^。]*?1\s*费/`(:725)，招式/武术→`set$meleeCost1(true)`(:727)，法术→`set$spellCost1(true)`(:730)。
- 消费：`calculateEffectiveCardCost` battle.card-cost.js:27-28（spellCost1→法术 1 费；meleeCost1→武术 1 费），由 effCostOf（battle.engine.js:448-468）传入。
- 旗标：battle.runtime.effects.js:4-5。

**设计**：
- **在途 M2 已把这条路铺平，纯结构化即可迁移**：`resolveRegisterRule` 已消费 meleeCost1/spellCost1（effect-steps.m2.js:85-94），schema REGISTER_RULE_KEYS 已含（card-rules.schema.js:97），capability registerRule 全放行（:24）。
```js
rules: { version:1,
  battle: { target: { side:'self', area:false } },
  triggers: { onPlay: [ { op:'registerRule', rule:'meleeCost1' } ] } }
```
- 分支名：`hosted:galaxy` 不再需要——本文保留命名以对齐矩阵，但实现为 A 档。registerBattle 文本路径保留（兼容旧档文本克隆）。
- 挂接点：仅数据回填新文件。共享文件零改动。

**触发链路**：打出 → execPlay(:56) → resolveCardWithFeedback(:128) → 结构化循环 registerRule 分支（resolution:865-868）→ m2 setMeleeCost1 → 之后每张武术 effCostOf（exec-play:91）→ battle.card-cost.js:28 → 1 费。

**风险与口径**：
- 优先级链（battle.card-cost.js:22-28）：unlimitedRune > zeroFeeUntil > 宇宙形态 cosmosForm > spellCost1/meleeCost1——银河之旅被宇宙形态压制的现行口径不变。
- desc 两代文本并存（法术版/武术版），canonical 深相等回填以 CARDS_SYNC 为准（cards.sync.m2.js CANONICAL_TABLE_BY_ID 模式，:110-127）；矩阵"迁移路径二选一"的 typeCostRoute 路线**不必再等**。

---

### 2.6 tt7-stratagem 法师锦囊（法术｜C 档）

**现状链路**：
- 定版：cards.data.js:578（TT10：「自带1*3空间，可以置入3张法术牌；打出时选择其中 1 张直接施放。」；TT7 旧行 :306 文本不同，被 TT10 覆盖）。
- hub 存取（背包域）：game.bag.js:346 按钮 → `openPouchStore` game.bag.js:389-445——存/取以 `pouchOf==='tt7-stratagem'` + `stored` 标记（:394-403，:430，:438），上限 3 张。
- 战斗载入+选放：`queuePouchCast` battle.engine.js:1041-1060——打出锦囊时把 G.ownedCards 中 pouchOf 法术读入 `_pouch`（:1046-1056），空则无效果(:1057)；`set$discovering({ act:'pouch', pouchUid })`(:1058)。打出触发点=文本 step `hand.pouchCast`（effect-steps.audit.js:109-113，desc 正则「自带1*3空间|可以置入3张法术牌」+ ctx.flags.uid）。
- 选 1 张施放：pickDiscover act==='pouch'（battle.selection-flow.js:303-312）——从 `_pouch` 移除(:306-309)→addTempCard→queueCardExecution 免费打出。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['pouch-container'] } }`。容器语义 schema 有 EQUIP_CONTAINER_KEYS（card-rules.schema.js:107，slots/accepts）但 capability 对 rules.equip.container 一票否决（card-rules.capability.js:91-95），且锦囊是法术不是装备——equip 域不适用。
- 分支名：`hosted:pouch-container`。**C 档：hub 与战斗两侧宿主全链保持不动**（背包 pouchOf 协议、_pouch 载入、act:'pouch' 选放），数据回填仅加 hosted 声明；识别文本 step 保留（desc 不改，深相等回填天然满足）。
- 挂接点：数据回填新文件；共享文件零改动。

**触发链路**：背包存入（game.bag.js:389-445，存档持久化）→ 对战中打出锦囊 → execPlay(:56) → resolveCardWithFeedback(:128) → 文本 steps → hand.pouchCast（audit.js:109）→ queuePouchCast(engine:1041) → 发现面板 act:'pouch' → pickDiscover(selection-flow:303) → queueCardExecution 免费施放所选。

**风险与口径**：
- `stored` 与珍珠盒共用标记、pouchOf 优先判定（game.bag.js:455 注释，:394 口径注释）——任何一侧改协议两边崩，C 档不碰即无险。
- 锦囊为空时打出无效果（engine:1057「锦囊是空的」）——卡面语义自洽。
- 锦囊内旧牌经 fireCatGift 排除（selection-flow:286 `act !== 'pouch'` 才触发阿猫的礼物）——保持。

---

### 2.7 tt2-pearlbox 珍珠盒（装备｜C 档，B-M6）

**现状链路**：
- 定版：cards.data.js:463（TT10：「内置3*3空间，可以容纳所有类型的资源卡牌。」）。
- hub 容器：game.bag.js:345 按钮 → `openPearlStore` game.bag.js:450 起——容量 = 珍珠盒数 ×9（:453-454），存取以 `stored && !pouchOf` 判定（:456，:460），pearlPut :488 / pearlTake :502；背包格点击直达 :711。背包格容量口径在 cardStacks 排除 o.stored（:448-449 注释）。
- 战斗域：无（资源卡不进战斗）；文本 step `hand.pouchPassive`（effect-steps.audit.js:115-119）仅识别日志。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['pearl-container'] } }`（或本期干脆保持 legacy）。
- 分支名：`hosted:pearl-container`。**C 档：保持宿主**（矩阵口径「装备域落地前保持宿主」）；结构化 equip.container {slots:9, accepts:'资源'} 键位已有（card-rules.schema.js:107）但 capability 拒（capability.js:91-95），消费域在 hub 背包（battle 域无容器消费器）——等未来容器域规格化再升级。
- 挂接点：数据回填新文件（可选）；共享文件零改动。

**触发链路**：无战斗链路。背包页（game.bag.js:345/711）→ openPearlStore(:450) → stored 标记读写 → 容量按 cardStacks 口径。

**风险与口径**：
- stored/pouchOf 双标记共用（game.bag.js:455-456）——与法师锦囊（§2.6）同一张冲突表。
- 多盒叠加 cap=boxes*9（:453-454）——结构化 slots 若未来落地需定义多件叠加语义（口径留档）。
- 安全部联动：盒入安全格时盒中卡同受保护（:449 注释）——纯 hub 语义，规则化永不涉及。

---

### 2.8 tt2-venomstaff 毒杖（装备｜B 档）

**现状链路**：
- 定版：cards.data.js:465（TT10：「每当你使用一张法术牌，为1名随机敌人附加中毒」；TT2 旧行 :69「毒木杖」已被覆盖）。
- 登记（打出即穿戴，exec-play:131）：battle.exec-play.js:154 正则 `/每当你使用一张法术牌[^。]*中毒/` → `set$poisonOnSpell(true)`（旗标 battle.runtime.effects.js:18）。
- 消费：battle.exec-play.js:186——每次有法术被打出（execPlay 内）→ `poisonRandomFoe()`（battle.engine.js:963-969，随机存活敌 addCurse poison 1）。
- 动词表：毒杖无独立 verb（poisonOnSpell 是旗标型）。

**设计**：
- rules 形状（矩阵两条路线的落地版，推荐路线一）：
  - **路线一（保留宿主只迁开关）**：`{ version:1, battle:{ hosted:['venom-staff'] } }`；battle.exec-play.js:154 登记条件扩为「desc 正则 **或** rules.battle.hosted 含 'venom-staff'」——**diff 1 行**。消费端 :186 不动。
  - 路线二（全结构化，规格依赖）：`rules.triggers.onPlayCard:[{op:'curse',curse:'poison',stacks:1,target:'randomEnemy'}]`——M2 onPlayCard 触发器已接线（battle.triggers.m2.js:16,:92；登记/广播在 exec-play:207-210），容器级 duration 不填即永久（triggers.m2.js:47 left=null）。**缺口**：firePlayCard 不区分所打出牌的类型（triggers.m2.js:90-92 注释明说类型过滤留给后续 onPlayCardFilter 键）——毒杖需要「仅法术时触发」。需 schema/capability/runner 三处扩 onPlayCardFilter（约 +20 行，规格件）。
- 挂接点：路线一=battle.exec-play.js（1 行）+ 回填新文件；路线二=另立规格批。
- 分支名：`hosted:venom-staff`。

**触发链路**：打出毒杖 → execPlay(:56) → :131 registerEquip（穿戴）+ :154 登记旗标 → 此后每张法术打出 → execPlay :186 poisonRandomFoe → engine:963-969。

**风险与口径**：
- 法力奔涌连发的随机法术走 resolveCard 直结（engine:926），**不经过 execPlay** → 不触发毒杖（现行口径）；锦囊 act:'pouch' 施放走 queueCardExecution → 会触发——两种"非手动打出"口径不一，实现批定向验证并留档。
- 多张毒杖重复登记幂等（布尔旗标）。
- 装备穿戴不消耗技能次数（无主动技能）；被沉默不影响本旗标（登记型非结算型）。

---

### 2.9 tt3-element-seal 元素符印（装备｜B/C 档，口径待拍板）

**现状链路**：
- 定版：cards.data.js:546（TT10：「本局对战中累计注能3张卡牌后解锁：法伤 +2，抽2张牌。」draw:2 字段；TT3 旧行 :181「注能 2 张法术牌」被覆盖）。
- 计数：每次注能牺牲 `set$infuseFuels(+1)`（battle.exec-play.js:116；旗标 battle.runtime.effects.js:13）。
- 解锁判定：文本门 `gate.sealUnlock`（effect-steps.gates.js:27-44）——正则「累计注能 N 张…解锁」→ fuels>=need 时 `unlockSeal` 端口（battle.engine.js:422）→ `tryUnlockSeal` battle.engine.js:993-999：set$sealUnlocked(true)（防重，:994）+ spellUp 2 + 抽 2（BOSS drawCards(2)/普通 grantSha(2)，:997）；不足则 HALT（:39-41）。
- **判定时点**：unlockSeal 全库仅 gates.js:34 一个调用点——即只有符印的 desc 被文本执行（打出装备时的 resolveCardWithFeedback，exec-play:128）那一刻判定一次；此后注能数涨到 3 **不会**再触发判定（exec-play:116 只计数不判定）。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['element-seal'] } }`（进度型解锁无 op/trigger 可表达；equip.passive 语义不符）。
- 分支名：`hosted:element-seal`。实现分两步走：
  - 第一步（口径确认前）：C 档保持现状，数据回填加 hosted 声明，gate.sealUnlock 文本门与 tryUnlockSeal 全部不动。
  - 第二步（若老板拍板"持续监听"）：battle.exec-play.js:116 注能计数后追加判定 `if (hosted 含 element-seal 的已穿戴/已打出卡 && infuseFuels>=3 && !sealUnlocked) tryUnlockSeal(...)`——diff 约 +5 行。
- 挂接点：第一步零共享文件改动；第二步 battle.exec-play.js。

**触发链路**：注能任何卡 → execPlay 燃料循环（exec-play:104-119，:116 计数）→ 符印 desc 被执行时（打出时）gate.sealUnlock（gates.js:27）→ tryUnlockSeal（engine:993）。

**风险与口径**：
- **解锁时点是口径问题**（§五.3）：现行=打出符印那一刻判定一次；若注能数在打出后才达到 3，按现行代码永不解锁——与卡面「累计注能 3 张后解锁」的直觉语义有出入，需拍板。
- cards.data.js:546 带 `draw: 2` 字段——字段兜底抽卡（battle.resolution.js:1082）只在 `!hasStructuredOnPlay && !drawn && !skillOnly` 时跑；符印走文本 gate 路径 drawn=false，**若 gate HALT 前 desc 未含「抽 2 张牌」句则字段兜底会双抽**——实现批需实测打出未解锁态是否多抽（现行 gate 返回 FRESH_RESULT(true) 截断后续 steps，字段兜底在 resolution 层不受 steps 截断影响，理论上有双抽窗口，实测确认）。
- spellUp 2 走 Combat.addBlessing（永久叠层型，engine:996）——与 blessing op 的 BLESSING_VALUE_KEYS 语义一致（battle.resolution.js:37）。

---

### 2.10 tt3eq-mistbox 迷之匣（装备｜C 档）

**现状链路**：
- 定版：cards-sync.json:282（「主动技能：发现两张随机招式，交换其费用。」）。
- 主动技能入口：`useEquipSkill` battle.equipment.js:107-174——equipSkillText 剥「主动技能：」后文本（:20-24），走 applyTextEffects steps(:159-173)；desc 含主动技能时不读 rules.equip.skill（:113 结构化技能仅无文本时生效）。
- 换费编排：`queueSwapCostDiscover` battle.engine.js:501-512——discoverQueue 压两次 `act:'swapCost'` 任务、共享 swapPair；文本识别 step 见 effect-steps.curse.js:56（curse.swapCostDiscover）。
- 两张到齐：pickDiscover 普通分支 swapPair.push(uid)（battle.selection-flow.js:330）→ 尾部 `swapCardCosts(swapPair[0], swapPair[1])`（:351-353）→ `swapCardCosts` battle.engine.js:513-519——cardOverrides 互换 cost（持久变异到战斗结束，battle.runtime.piles.js:53 重置）。
- 旧版「对战开始时将 2 张杀替换为随机卡牌」：`replaceShaInDeck` battle.engine.js:937-954（BOSS-only :939），文本 step 仍在（effect-steps.audit.js:69-77）——现行 sync desc 无此句，不触发（休眠兼容）。
- 池口径：「招式」=武术+法术（engine:502,508），randomDiscoverCard pred 池（battle.selection-flow.js:27,31）。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['cost-swap'] } }`。
- 分支名：`hosted:cost-swap`。**C 档保持宿主**：swapCost 是"两次发现共享累加器 + 面板收尾回调"的编排，结构化 discover op 无 act:'swapCost'，equip.skill.ops 也表达不了。数据回填加 hosted 声明；主动技能文本链、oncePerBattle（e.used，equipment.js:115）全保持。
- 挂接点：数据回填新文件；共享文件零改动。

**触发链路**：打出穿戴（exec-play:131）→ 点技能按钮 → useEquipSkill（equipment.js:107）→ 文本 steps → queueSwapCostDiscover（engine:501）→ 两次发现面板 → pickDiscover（selection-flow:273）收齐 swapPair → swapCardCosts（engine:513）写 cardOverrides → 后续打出按新费（battle.card-cost.js:49 card.cost 直读 override 值）。

**风险与口径**：
- 与 imitate（§2.1）共用 cardOverrides Map——不同 uid 无冲突；战斗结束统一重置（piles:53）。
- 交换写死在卡面 cost 上（复制对象），`_baseCost` 不参与（与发现零费 :332-334 的 `_baseCost` 绿色角标口径不同）——换费后费用角标显示口径留档。
- replaceShaInDeck 休眠兼容层保留，不删（删除需另行报批）。

---

### 2.11 tt7-darkfort 黑暗吊坠（装备｜C 档，规格依赖）

**现状链路**：
- 定义：cards.data.js:662（cls 降临者，「免疫 1 次致命伤害，并在该回合内处于无敌状态。」）。
- 登记：文本 step `buff.deathSave`（effect-steps.curse.js:169-177，正则「免疫 N 次致命伤害」→ setDeathSave 端口 engine:419 → 旗标 battle.runtime.effects.js:16）；装备打出结算（exec-play:128）时生效，:131 穿戴。同句「无敌」被 buff.immune 的 dsave 守卫排除（effect-steps.curse.js:179-183），不双结算。
- 消费（两处死亡保险口）：`damagePlayer` battle.engine.js:302-309（自伤/非攻击伤害）与 `playerTakeHit` battle.engine.js:1554-1558（敌方攻击）——deathSave-1 + `Combat.addBlessing(pstat,'immune',1)`（该回合无敌）。

**设计**：
- rules 形状：**本期不迁 rules，保持 legacy**。免死充能（消耗型计数）+ 触发后当回合无敌是两段复合语义：blessing immune（timed）只覆盖第二段；第一段需新 op（规格 Wave2 二.9 已预留「darkfort 免死与 counter 语义一并定版」口子）。
- 若要数据锚定：`{ version:1, battle:{ hosted:['dark-fort'] } }`，分支名 `hosted:dark-fort`，宿主全链（buff.deathSave step + 两消费点）不动。
- 挂接点：零（保持 legacy）；仅当老板要求统一声明形态时做数据回填。

**触发链路**：打出穿戴（exec-play:128 文本结算 → :131 registerEquip）→ 致死伤害两条入口（engine:302-309 / :1554-1558）→ deathSave-1 + immune 1 回合。

**风险与口径**：
- 「该回合内无敌」=immune timed 1（回合结束衰减）；与邪能护体的本回合临时诅咒免疫（exec-play:165-170 delayed curseImmuneOff）是两条独立管线，同场叠加时日志措辞有中性化处理（engine:1454-1459）——保持。
- immune 免疫的是**伤害**；诅咒免疫走 playerCurseImmune/圣洁符文（engine:1452-1467）——两概念不混。

---

### 2.12 tt7-naturestaff 自然法杖（装备｜C 档）

**现状链路**：
- 定版：cards-sync.json:538（「主动技能：选择 1 张卡牌，下回合将其变为 0 费。」）。
- 技能入口：useEquipSkill battle.equipment.js:107-174（手牌空不耗次数 :125-127）；文本 steps → handSelectQueue act:'zero' → `pickHandSelect` battle.selection-flow.js:141-149——`zeroFeeUntil.set(uid, turn+1)`。
- 消费：calculateEffectiveCardCost battle.card-cost.js:25（zeroFeeTurn>=turn → 0）；effCostOf 传入（battle.engine.js:456）；快照字段 zeroFeeTurn（engine:456）。
- 旗标：battle.runtime.piles.js:8（Map），重置 :53。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['nature-staff'] } }`。规格 Wave2 二.8 提的「registerRule 扩键或独立 op + cardOverrides 承载」属后续批；本期**C 档保持宿主**（handSelecting 交互域 + 回合数映射无 op 表达）。
- 分支名：`hosted:nature-staff`；数据回填可选。
- 挂接点：零共享文件改动。

**触发链路**：点技能 → useEquipSkill（equipment.js:107）→ 选牌面板 act:'zero' → zeroFeeUntil.set（selection-flow:143）→ 下回合打出该牌 effCostOf（exec-play:91）→ battle.card-cost.js:25 → 0 费。

**风险与口径**：
- 「下回合」=turn+1（含当刻之后的所有时点直到下回合结束判定 `>=turn`，battle.card-cost.js:25）——与额外回合（extraTurn，命运钟表）交互：extraTurn 跳过敌方阶段是否推进 turn 需定向验证（若不推进，0 费窗口延长一拍）——留档口径。
- zeroFeeUntil 按uid 记账，卡离手再回手仍有效（uid 不变）——现行口径保持。

---

### 2.13 tt8-demonslay 诛魔剑（装备｜C 档，侠客链核心件）

**现状链路**：
- 定版：cards.data.js:616（TABLETOP10：「抽到该牌时攻击全体敌人；···以天启诛魔剑覆盖你的所有武器。」；TT8 旧行 :366 无「···」；cards-sync.json 无此 id，TABLETOP10 后播为准）。
- 抽到结算：`drawCards` 文本 onDraw 分支 battle.engine.js:128-139——「抽到时」句剥出（splitClauses）→ 牌进 discard(:130) → applyTextEffects「攻击全体敌人」（不占手牌）。
- 「以天启诛魔剑覆盖你的所有武器」：**DESIGNER_BLANKS 设计者留白，无结算**（effect-verbs.js:139-142，weaponCover）。
- 来源：天剑诛魔·云阳（tt8-hero-ranger，矩阵 M 级不在本批）洗入牌库；tokenOf 绑定（cards.data.js:616）。

**设计**：
- rules 形状（链内统一草案，本批仅锚定）：`{ version:1, battle:{ hosted:['ranger-chain'] } }`。
- 分支名：`hosted:ranger-chain`。**C 档**：
  - 「抽到时攻击全体」：结构化 `triggers.onDraw` 已接线（battle.triggers.m2.js:96-99 fireDrawn；drawCards 结构化分支 battle.engine.js:119-127，先于文本分支 :128）——但「攻击」=攻击力伤害，damage op 无 `amountField:'atk'` 源（DAMAGE_ALLOWED_KEYS card-rules.schema.js:41-45 无此键），需规格扩键或 hosted 分支。在键位定版前保持文本 onDraw。
  - 「覆盖武器」句：保持 DESIGNER_BLANKS 留白，禁止自创效果（§五.2）。
- 挂接点：数据回填新文件（hosted 标记可选）；共享文件零改动。

**触发链路**：抽牌（engine:103 drawCards）→ :128-139 onDraw 文本分支 → discard + applyTextEffects 全体攻击 → sweepDead(:136)。

**风险与口径**：
- 两代 desc 并存（:366/:616，「···」差异）——canonical 以 TABLETOP10 :616 为准；「···」是省略修饰，与 heavensword 的「……」**真截断**性质不同（T1 只点名后者），但两者同链迁移，务必分开对待。
- onDraw 触发后装备进 discard（:130）——「抽到即结算即离手」的现行口径（BOSS 战 discard 洗回、普通战 discard 即本场不可再用）；规则化 onDraw 分支同口径（structured :119-127 同样 discard）。
- 与 tt8-heavensword/tt8-hero-ranger 成链——**链内三卡同批迁移**（矩阵口径），云阳（M 级）的 pool.named 未定前，本卡先行不阻塞（洗入来源不变）。

---

### 2.14 tt8-heavensword 天启剑（装备｜C 档，T1 阻断）

**现状链路**：
- 定版：cards.data.js:618（TABLETOP10：「抽到该牌时额外抽 1 张牌；在你抽到天启剑与诛魔剑后……」，draw:1 字段；TT8 旧行 :368 文本近似）。
- onDraw 额外抽 1：同 §2.13 通道（engine:128-139）→ applyTextEffects「抽 1 张牌」→ 递归 drawCards。
- 「集齐双剑后续」：**无文本、无宿主**（T1 真截断陷阱，矩阵 §七.1）。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['ranger-chain'], … } }`——**迁移被 T1 阻断**：后半效果必须先拿设计者口径，禁止按推测补（硬约束）。
- 本批可先行的安全段：onDraw 段结构化为 `triggers.onDraw:[{ op:'draw', amount:1 }]`（M2 已接线：structured 分支 battle.engine.js:119-127 优先于文本 :128，天然单次不双抽）；draw:1 字段在结构化后不再参与兜底（resolution:1082 兜底仅 !hasStructuredOnPlay）——无双抽。**但**深相等回填要求 desc 与 canonical 一致，截断句「在你抽到……后……」会被 hasStructuredOnPlay 跳过文本结算（:1053 immediate 不跑）——语义上等于"后半留白"，与现状一致，安全。
- 分支名：`hosted:ranger-chain`（与 demonslay 同链同批）。
- 挂接点：数据回填新文件；共享文件零改动。

**触发链路**：抽牌 → structured onDraw（engine:119-127）→ resolveOps 合成卡走 resolveCard（triggers.m2.js:24-36）→ draw op（resolution:1028-1035）。

**风险与口径**：
- **T1 阻断项**：后半效果口径未定前，本卡最多迁到"onDraw 段结构化 + hosted 标记"，禁止实现任何"集齐双剑"推断效果。
- 递归抽牌（天启剑抽到→抽 1→再抽到天启剑…）由牌库自然耗尽截停（engine:113-114）——现行口径。
- 与 demonslay 的 desc 两代文本并存同链处理（§2.13）。

---

### 2.15 tt8-abyss-sovereign 深渊主宰·妲莉薇特（能力卡｜B 档为主）

**现状链路**：
- 定版：cards-sync.json:352（cost 2，「旧日再临：抽牌直到有 6 张手牌；免疫诅咒，能量上限 +1，法伤 +1，所有可注能与必须注能的招式均视为已注能；召唤 4 名封印肢体。」）。
- 打出登记（battle.exec-play.js:156-178，文本正则逐段）：
  - 免疫诅咒 :157-160 → set$playerCurseImmune(true)（消费：addPlayerCurse battle.engine.js:1452-1461）；
  - 均已注能 :171-174 → set$allSpellsInfused(true)（消费：infusedBase 贯通 exec-play:126）；
  - 召唤 4 名封印肢体 :175-178 → `summonAlly('封印肢体',0,0,4,true)`（statless，engine:956-962）。
  - 「抽牌直到有 6 张手牌」「能量上限 +1」「法伤 +1」走文本 immediate（hasStructuredOnPlay=false 时）。
- 化形来源：受缚之残影封印链 addTempCard 深渊主宰（battle.engine.js:1444-1446）。
- 旗标：battle.runtime.effects.js:35-36。

**设计**：
- rules 形状（onPlay 数组序即结算序）：
```js
rules: { version:1,
  battle: { target: { side:'self', area:false } },
  triggers: { onPlay: [
    { op:'draw', untilHandN:6 },                       // M1 已接线 effect-steps.m1.js:53-73
    { op:'blessing', key:'spellUp', stacks:1 },        // A3 已接线
    { op:'energyCap', n:1 },                           // A3 已接线
    { op:'registerRule', rule:'playerCurseImmune' },   // 扩键（见下）
    { op:'registerRule', rule:'allSpellsInfused' },    // 键已在 schema:97，m2 待消费
    { op:'summon', name:'封印肢体', statless:true, count:4 },  // M2 已接线 effect-steps.m2.js:175-179
  ] } }
```
- 扩键清单：REGISTER_RULE_KEYS（card-rules.schema.js:95-97）加 `'playerCurseImmune'`（allSpellsInfused 已在）；`resolveRegisterRule`（effect-steps.m2.js:78-96）加两分支（调 set$allSpellsInfused / set$playerCurseImmune 端口，+8 行）；engine 装配补端口（+2 行）。
- 分支名：`hosted:sovereign`（登记型旗标的宿主 exec-play:157-174 保留文本兜底，但需加 hasStructuredOnPlay 门防双日志，diff 约 4 行，见风险）。
- 挂接点：effect-steps.m2.js、card-rules.schema.js、battle.engine.js 装配、battle.exec-play.js（可选防重门）、回填新文件。

**触发链路**：打出（普通战不可用能力卡，battle.engine.js:1405-1407 注释口径；BOSS 手牌可打出）→ execPlay(:56) → 结构化循环按序：draw untilHandN（resolution:1005-1006 → m1:53，BOSS 逐张抽）→ blessing/energyCap（resolution:887-904）→ registerRule 两旗标（:865-868）→ summon（:861-864 → m2:175 → engine summonAlly statless）→ 此后所有可注能招式免燃料按已注能（exec-play:126）。

**风险与口径**：
- **双登记双日志**：迁移后 desc 未变，exec-play:157-174 文本正则与结构化 registerRule 都会命中——旗标 set 幂等无叠层，但日志双打。推荐登记段加 `!hasStructuredOnPlay` 门（diff 4 行）。
- 召唤物「封印肢体」是排除卡（M-BATCH-EXCLUSIONS 组 2）——结构化 summon 只填数值（name/statless/count），**不引用卡 id**（规格 §二.12 定版口径）；与征召（B-M2）共用 resolveSummon。
- untilHandN 普通战降级 grantSha（effect-steps.m1.js:68-70）——深渊主宰普通战打不出，降级分支实际不可达（备注即可）。
- 化形链依赖：受缚之残影（§2.18）化形产物 addTempCard({...tpl}) 会带上本卡 rules——**建议本卡先于 sealer 链验收**（无硬阻塞：未迁时化形产物走文本路径同样正确）。

---

### 2.16 tt8-hero-assassin 白梅落影·妄（能力卡｜B 档）

**现状链路**：
- 定版：cards.data.js:601（TABLETOP10）与 :695（TABLETOP11）双行一致（cost 2，「遁入虚空：净化自身，潜行 2 回合；破隐一击伤害翻倍。」）；TT8 旧行 :349 文本不同（「潜入夺宝…破隐一连击开弹幕」，重辨存疑）被后播覆盖。
- 净化自身：文本 buff.purify；结构化 cleanse 已接线（M1，effect-steps.m1.js:30-42）。
- 潜行 2 回合：blessing stealth（timed 型，combat.js:25 BUFFS 含 stealth、:29 词条「无法成为被攻击对象；造成伤害会破除潜行」；blessing op 的 BLESSING_TIMED_KEYS battle.resolution.js:38）。
- 破隐登记：文本 rule step `rule.stealthStrike`（effect-steps.rules.js:39-47）→ setStealthStrike(true)（旗标 battle.runtime.effects.js:2）。
- 破隐消费：hitFoe battle.engine.js:1295-1300——`stealthStrike && Combat.isStealthed(pstat)（:1296 攻击前判定）&& amount>0` → 伤害 ×2；造成伤害破隐在 combat.js:88-89/:300-304。

**设计**：
- rules 形状：
```js
rules: { version:1,
  battle: { target: { side:'self', area:false } },
  triggers: { onPlay: [
    { op:'cleanse', target:'self' },
    { op:'blessing', key:'stealth', duration:2 },
    { op:'registerRule', rule:'stealthStrike' },
  ] } }
```
- `'stealthStrike'` 需扩 REGISTER_RULE_KEYS（schema:95-97 +1 词）+ resolveRegisterRule 分支（m2 +4 行，调 setStealthStrike 端口，engine 装配 +1 行）。
- 分支名：`hosted:assassin`（文本 rule.stealthStrike step 保留兼容旧文本克隆）。
- 挂接点：effect-steps.m2.js、card-rules.schema.js、battle.engine.js 装配、回填新文件。

**触发链路**：打出 → execPlay(:56) → 结构化循环 cleanse（resolution:875-878）→ blessing stealth（:887-889，timed 2 回合）→ registerRule（:865-868）→ 之后玩家从潜行中发动攻击 → hitFoe（engine:1295-1300）×2 → 伤害落地破隐（combat.js:88-89）。

**风险与口径**：
- 破隐判定时点=攻击前（:1296 stealthedBefore），本场每一击都重判——「破隐一击」只在潜行中的第一击翻倍（打完即破隐），现行口径自洽。
- stealth timed 衰减在敌方回合管线（tickDurations）；「潜行 2 回合」与矩阵备注「stealthAmp 全局旗标」实为同一 stealthStrike 旗标（矩阵草案词与代码现名不一致，以代码为准）。
- 旧文本重辨（§五.7）：TT8 行「破隐一连击开弹幕」是废弃口径，实现勿参考。

---

### 2.17 tt8-hero-descender 充能火山（能力卡｜B 档，接近 A）

**现状链路**：
- 定版：cards-sync.json:401（cost 2，「寂灭苍穹：法伤 +1，本局对战中，每消耗 1 张卡牌，施放 1 次'火球'。」）。
- 法伤 +1：blessing spellUp（文本或结构化均可）。
- 火球规则登记：文本 rule step `rule.consumeFireball`（effect-steps.rules.js:19-27，正则「每消耗 1 张卡牌…施放 N 次 火球」→ setConsumeFireball(N)，旗标 consumeFireballN battle.runtime.effects.js:7）。
- 火球结算（两个消耗入口）：注能牺牲 battle.exec-play.js:118、手选消耗 `consumeHandUids` battle.engine.js:1034 → `consumeFireballSteps` battle.engine.js:852-869——对存活首位 4 点法伤（dealDamage SPELL 4，spellPower 只算一次 :860）。

**设计**：
- rules 形状：
```js
rules: { version:1,
  battle: { target: { side:'self', area:false } },
  triggers: { onPlay: [
    { op:'blessing', key:'spellUp', stacks:1 },
    { op:'registerRule', rule:'consumeFireball' },
  ] } }
```
- `'consumeFireball'` 键**已在** schema REGISTER_RULE_KEYS（card-rules.schema.js:97），m2 :95 注释「consumeFireball 走引擎既有专支端口」——补 resolveRegisterRule 分支（m2 +4 行，setConsumeFireball 端口）。
- 分支名：`hosted:consume-fireball`（矩阵命名保留；实际实现=registerRule 扩消费）。文本 rule.consumeFireball step 保留兼容。
- 挂接点：effect-steps.m2.js、battle.engine.js 装配、回填新文件；schema 零改。

**触发链路**：打出 → 结构化循环（resolution:887-889 + :865-868）→ 此后每张卡被注能牺牲（exec-play:104-119，:118）或手选消耗（engine:1023-1039，:1034）→ consumeFireballSteps（engine:852）→ 4 点法伤。

**风险与口径**：
- 火球目标=存活首位（engine:854 `alive()[0]`），非随机非点选——现行口径留档。
- 「施放 1 次'火球'」是内联 4 点法伤（engine:858-862），**不是**衍生牌 tt3-fireball 引用——与星陨之力（execute what:'火球'，B-M2）的"火球"语义不同源，两口径不得合并。
- 双登记：迁移后 exec-play 打出侧不再有本卡的文本正则登记点（:117-118 只消费），登记走结构化 op——无双日志问题（rule.consumeFireball 文本 step 仅在文本路径跑，hasStructuredOnPlay 时跳过）。
- **高危同名坑**：cards.data.js:358 的 TT8 旧行把 tt8-hero-sealer 写成「邪渊主宰」并带同款火球文本——该行已被 cards.sync.js:754/:757 覆盖为「受缚之残影」封印链。**严禁**按 :358 给 sealer 配火球规则（§2.18）。

---

### 2.18 tt8-hero-sealer 受缚之残影（能力卡｜C 档，链保持宿主）

**现状链路**：
- 定版：cards.sync.js:754（名字覆盖「受缚之残影」，sync v21+ 定版重做）与 :757（desc 覆盖：「深海封印：对战开始时，将本牌与四张「封印肢体」洗入牌库；手牌中集齐这 5 张封印之牌后破除封印，化为深渊主宰·妲莉薇特。无法打出。」）。cards.data.js:358 的「邪渊主宰」行是被覆盖的过时基线。
- 全链宿主 battle.engine.js:1386-1449：SEALED_HERO_ID :1392、SEAL_LIMB_IDS :1393（四张排除卡 tt8-curseimmune/energycap/nofocus/healplus）、SOVEREIGN_ID :1394；`isSealHeroSelected` :1398-1403（编组 sel 域判定）；`injectSealCards` :1405-1419（BOSS-only :1407、编组带着才发动 :1408-1409、肢体洗入牌库+洗牌 :1410-1417），调用点 battle.lifecycle.js:339；`checkSealTransformation` :1421-1449（每次抽牌后调用 battle.engine.js:155；集齐 → 5 张消耗 :1434-1442 → addTempCard 深渊主宰 :1444-1446）。
- 无法打出：「无法打出」词条拦截（battle.rules.js:86 一带 unplayableReasonFor；effect-verbs.js:133）；结构化 requirements 键已有（card-rules.schema.js:994-1017，kind: unplayable/deckOnly/handCards；消费 battle.rules.js:89 structuredRequirements）。
- 普通战：能力卡不可用，封印不发动（engine:1405-1407）。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['seal-chain'], requirements:[{ kind:'unplayable' }] } }`。
- 分支名：`hosted:seal-chain`。**C 档：封印流程全链保持宿主**（矩阵口径：封印肢体是排除卡、化形是完整场面流程、编组判定是 sel 域）；规则化收益仅两点：① requirements unplayable 数据化（键位/消费均已就绪，纯数据）；② hosted 标记让宿主识别与 id 解耦（可选，SEALED_HERO_ID 直等保留亦可）。
- 挂接点：数据回填新文件；共享文件零改动。
- **依赖**：化形产物深渊主宰（§2.15）建议先行迁移——addTempCard({...tpl}) 继承 rules，保证化形后打出体验一致（非硬阻塞）。

**触发链路**：BOSS 开战（lifecycle:339）→ injectSealCards（engine:1405）洗入 4 肢体 → 历次抽牌（engine:155）→ checkSealTransformation（:1421）集齐化形 → 打出深渊主宰 → 旧日再临（§2.15 链路）。

**风险与口径**：
- requirements unplayable 与 desc「无法打出」文本拦截**双通道并存**——迁移后是否移除文本拦截（battle.rules.js unplayableReasonFor 的该分支）需拍板（§五.9）；推荐保留双通道（旧档文本克隆仍被拦）。
-SEALED_HERO_ID/SEAL_LIMB_IDS 硬编码 id 与排除清单强耦合——禁止在回填时合并/改名排除卡（M-BATCH-EXCLUSIONS 组 2 口径）。
- 化形消耗的 5 张进 consumed/grave（:1435-1442）——BOSS 战墓地查看口径，保持。

---

### 2.19 tt8-hero-summoner 花开两面（能力卡｜C 档）

**现状链路**：
- 定版：cards-sync.json:501（cost 2，「元素潮汐：抉择：打开'末日浩劫之门'或者'天国之门'。两回合后，开启未选择的那扇'门'」）。
- 抉择宿主：`pickChoice` battle.selection-flow.js:172-223——引号门名解析(:180-181)→生物卡引用(:182)→门的 turnStart 段注册 delayed repeat:true(:184-192)；secondDoor 补实装(:206-216)：未选之门 notBeforeTurn=turn+2。另一挂点 effect-steps.gates.js:85（secondDoor 注释）。
- 门卡效果：末日浩劫之门回合诅咒 effect-steps.damage.js:190（curse.doomGate）；天国之门随机祝福 effect-steps.kills.js:222（buff.randomBlessing）——两门是排除卡（M-BATCH-EXCLUSIONS 组 2：cmtn79743r2n/cmtn7err0a7）。
- 抉择域结构化：无 op（choiceQueue 是文本路径 queueChoice 端口；神灯同样归混合实现，矩阵 tt3-magic-lamp L 级）。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['gate-choices'] } }`。
- 分支名：`hosted:gate-choices`。**C 档：全宿主保持**（矩阵口径「与两扇门排除卡强耦合，效果保持宿主」）；数据回填可选。
- 挂接点：零共享文件改动。

**触发链路**：打出 → resolveCardWithFeedback(:128) → 文本抉择句 → choiceQueue → processChoice（selection-flow:166-171）→ pickChoice(:172) 注册门 delayed → 每回合开始 processDelayed（engine:648 起，repeat/notBeforeTurn 消费）。

**风险与口径**：
- 门名解析依赖引号字符集正则（:180 `[‘“「]…[’”」]`）——desc 措辞或引号全半角变动即断链（卡面文本冻结口径留档）。
- notBeforeTurn=turn+2 与 extraTurn（跳过敌方阶段）交互：turn 推进时点需定向验证（同 §2.12 备注）。
- 抉择域规格化（choice op）是后续批课题——若落地，本卡与神灯同批收编，本期不动。

---

### 2.20 tt8-hero-warrior 青龙化身（能力卡｜C 档）

**现状链路**：
- 定版：cards.data.js:611（TABLETOP10：「真龙降世：本局对战中，将‘初始攻击’化为‘青龙偃月斩’。」cost 2；TT8 旧行 :352「攻 +2 的青龙偃月斩」被覆盖；cards-sync.json 无此 id）。
- 登记：文本 rule step `rule.shaTransform`（effect-steps.rules.js:9-17，正则「‘杀/初始攻击’化为 X」→ setShaTransform('青龙偃月斩')，旗标 battle.runtime.effects.js:6）——打出能力卡时 resolveCard 文本路径生效。
- 消费：play 入口 battle.engine.js:1140-1143——打出的「初始攻击/杀」以目标卡形态结算（`playCard = {...tpl}`，uid 沿用、弃牌簿记不变）；编组侧 :245 同名查找；快照/预览（engine:554、battle.core.js:299）。
- 衍生：青龙偃月斩 tt8-dragonblade（cards.data.js:370，dmg:6 破甲流血）。

**设计**：
- rules 形状（规格二.11 已定键位）：`onPlay:[{ op:'transform', what:'sha', into:'青龙偃月斩' }]`（transform 键集 card-rules.schema.js:85）。
- **在途缺口（本文最重要发现之一）**：capability 已放行 transform（card-rules.capability.js:24），但 battle.resolution.js 结构化循环**无 transform 分支**（:846-868 无、:923 throw 白名单不含）——结构化 transform 会被静默忽略，仅落 :1098 占位日志。实现批必须先补 resolver 分支（照 setShaTransform 端口写，m2 或 resolution +8 行）或 capability 收回 transform。
- 分支名：`hosted:kill-transform`。稳妥路线（推荐）：**C 档保持文本宿主**（rule.shaTransform step + play :1140-1143 已稳），数据回填仅 hosted 标记；transform resolver 补齐与骷髅王剑（tt3-immortal-blade，B-M3）共用规格件后再切结构化。
- 挂接点：数据回填新文件；共享文件零改动（稳妥路线）。

**触发链路**：打出青龙化身 → resolveCardWithFeedback(:128) → rule.shaTransform（rules.js steps :9-17）→ 此后每次打出初始攻击 → play（engine:1140-1143）替换 playCard → queueCardExecution(:1144) 按青龙偃月斩结算（含其 desc 的破甲流血）。

**风险与口径**：
- **T10 联动**：初始攻击识别（isStarterAttack engine:96：id 或卡名「初始攻击」）+ :1140 按卡名判断——starter-attack（B-M1 末位迁移）改名/改 id 会震荡本链；青龙化身迁移回归必须带「普通战/BOSS 各打一张初始攻击」用例。
- 新旧口径（§五.6）：「攻+2」（TT8）已废弃，现行=化形（青龙偃月斩 dmg:6 本体含攻击面）；矩阵草案按化形走，与现行定版一致。
- 「化为」按**卡名**找 tpl（:1141 `find(c => c.name === shaTransform)`）——青龙偃月斩改名即断链（同族风险留档）。

---

### 2.21 tt3-mystery-potion 神秘药水（道具｜C 档，口径冲突最尖锐）

**现状链路**：
- **两代文本并存**：cards.data.js:121（TABLETOP3，cost 3，「随机神秘效果。」）与 :496（TABLETOP10，cost 0，「回合开始时：变成1张随机招式卡牌，使其费用为0。」）。TT10 后播覆盖（cards.js:245 晚于 :238），cards-sync.json 无此 id——**现行定版=回合开始变形段**。
- 三分随机宿主（旧文本消费端，靠 **id 直等** 仍活着）：
  - 战斗：battle.bag.js:52（`isPotion = card.id==='tt3-mystery-potion' || /随机神秘效果/`）→ :76-93 三分之一回 8 / 三分之一 +3 币 / 三分之一随机获卡（BOSS addDeckCard、普通 addTempCard + fireCatGift :91）。
  - 地图：game.bag.js:174-208（同三分结构 + 阿猫礼物链 :192-201 + canReceiveCard 背包满拦截 :185-188）。
- 回合开始变形段宿主：文本动词 `summon.morphRandom`（effect-steps.damage.js:205-218）——「变成 1 张随机招式卡牌」→ addTempCard({...c, cost:0, _baseCost})（绿色降费角标 :213）；经道具在普通战被打出时 resolveCard 的 parts.turnStart → registerTurnStart（battle.resolution.js:1094）→ delayed 回合开始管线。

**设计**：
- rules 形状：`{ version:1, battle:{ hosted:['mystery-potion'] } }`。
- 分支名：`hosted:mystery-potion`。**C 档：双宿主现状保持**。矩阵口径「规则化先做三分随机段」与**现行定版文本是变形段**直接冲突（且 battle.bag.js:52 的 id 直等使 BOSS 背包使用至今仍走三分随机）——先拍板再动（§五.4）。
- 若拍板后迁移：三分随机段 → `rules.bag.use`（heal/coins/acquire 组合；coins 与 acquire op 已有，bag 域消费点 battle.bag.js/hub bag——规格二.13）；变形段 → `triggers.onTurnStart:[{ op:'transform', what:'self', into:{pool:'随机招式'}, cost:0 }]`（transform resolver 缺口同 §2.20；道具使用后注册 trigger 的作用域需规格定义）。
- 挂接点：拍板前零改动；拍板后 battle.bag.js/game.bag.js/bag 域消费器（B-M6 批）。

**触发链路**（现行）：
- 普通战打出道具 → execPlay(:56) → resolveCardWithFeedback(:128) → parts.turnStart 注册（resolution:1094）→ 下一回合开始 delayed → morphRandom（effect-steps.damage.js:206）。
- 战斗背包使用（任意模式）→ useItem（battle.bag.js:44）→ id 直等 isPotion(:52) → 三分随机(:76-93)。
- 地图背包使用 → game.bag.js:175 → 三分随机(:177-204)。

**风险与口径**：
- 一张卡、两代文本、三条宿主路径并存（§五.4 列口径问题）：任何"规则化一段"的动作都会让另一段的行为差异显性化。
- morphRandom 的池=武术（:209-210 want 默认武术）+衍生排除——与「招式=武术+法术」（设计者定版口径，exec-play:202 注释）不一致，实现批拍板时一并核对。
- `_baseCost` 角标、fireCatGift、canReceiveCard 三个联动保持。

---

## 三、实现顺序建议（依赖拓扑）

```
H0 契约基建（1 个串行批，先行）
 ├─ schema：BATTLE_KEYS+hosted 校验（schema:1,994 模式）+ REGISTER_RULE_KEYS 扩 playerCurseImmune/stealthStrike/poisonLegacy
 ├─ capability：hosted 白名单分支（已接线放行/未接线拒绝）
 ├─ effect-steps.m2.js：resolveRegisterRule 补 5 分支（poisonLegacy/growth/consumeFireball/allSpellsInfused/playerCurseImmune/stealthStrike 中未接线的）
 ├─ battle.resolution.js / battle.engine.js：m2Deps 端口补装配（set$poisonLegacy/set$allSpellsInfused/set$playerCurseImmune/setStealthStrike/setConsumeFireball/addGrowthName）
 └─ transform 静默缺口决断（补分支或 capability 收回）——阻塞 §2.20/§2.21 的结构化路线
H1 规则旗标批（依赖 H0；6 卡，共享 m2/schema/engine，串行提交、卡间可并行测试）
 ├─ tt5-galaxy-voyage（A 档，最简试金石）
 ├─ cc-rot-seed
 ├─ cmtn1lbhbqi4 充能火球
 ├─ tt8-hero-descender 充能火山
 ├─ tt8-hero-assassin
 └─ tt8-abyss-sovereign（含 exec-play 防重门，+4 行）
H2 打出侧登记批（依赖 H0；3 卡，共享 battle.exec-play.js，串行）
 ├─ tt7-imitate（宿主 1 行识别扩条件）
 ├─ tt2-venomstaff（exec-play:154 +1 行）
 └─ tt3-element-seal（口径拍板后：exec-play:116 后 +5 行；拍板前仅数据标记）
H3 宿主保持批（无代码依赖，9 卡可全并行，各自独立回填新文件）
 ├─ tt7-stratagem / tt2-pearlbox / tt3eq-mistbox / tt7-darkfort / tt7-naturestaff
 ├─ tt8-hero-summoner / tt8-hero-warrior / tt3-mystery-potion（三者与 H0 transform 决断联动：结构化路线被否即纯标记）
 └─ tt8-hero-sealer（requirements unplayable 数据化；建议在 H1 soveriegn 验收后做化形链回归）
H4 侠客链批（口径阻断，最后）
 ├─ tt8-demonslay（等 damage 'atk' 源键位 or 保持文本）
 └─ tt8-heavensword（T1 设计者口径未到前最多迁 onDraw 段）
```

- 每卡验收三件套（§〇.4）+ 定向结算（BOSS/普通两模式按各卡风险节列的用例）。
- tt8-hero-warrior 的回归必须与 B-M1 starter-attack 迁移联动（T10）。

## 四、共享文件冲突表（同文件归同批串行）

| 共享文件 | 涉及卡 | 批次 | 预计 diff 规模 |
| --- | --- | --- | --- |
| game/src/cards/card-rules.schema.js | H0 全部 21 张（hosted 键 + registerRule 扩词） | H0 一次改完 | +25 行内 |
| game/src/cards/card-rules.capability.js | 同上（hosted 白名单；transform 收回与否） | H0 | +15 行内 |
| game/src/battle/effect-steps.m2.js | galaxy/rot-seed/charge-fireball/descender/sovereign/assassin（registerRule 分支） | H0+H1 | +30 行内 |
| game/src/battle/battle.resolution.js | H1（hosted 分支或 surge 条件扩，可选）+ engine 装配配合 | H0/H1 | +10 行内 |
| game/src/battle/battle.engine.js | m2Deps 端口装配（H1）；applyImitate 识别（H2 imitate，1 行） | H1/H2 | +8 行内 |
| game/src/battle/battle.exec-play.js | venomstaff(:154 +1)、element-seal(:116 后 +5)、sovereign 防重门(:157-174 +4) | H2/H1 | +10 行内 |
| game/src/cards/cards.js | 各批回填器接线（ensureTabletop 尾部 :276-277 模式，每批 +1 行） | 每批 | 每批 +1 行 |
| 新文件 cards.sync.mH*.js / effect-steps.m3-hosted.js | 各批各自新建，互不冲突 | 全部 | — |
| game/src/battle/battle.bag.js、game/src/hub/game.bag.js | mystery-potion（拍板后才碰） | B-M6 | 拍板后另估 |

- 不碰清单：battle.core.js（垫片）、battle.triggers.m2.js（本期无需改）、combat.js、battle.selection-flow.js、battle.equipment.js、battle.card-cost.js、battle.lifecycle.js、cards-sync.json。
- 并行会话约束：本设计期间工作区已有他代理未提交改动（git status 实见），实现代理开工前须重查 git status/log，不覆盖共享文件、不顺手提交。

## 五、需老板拍板的口径清单

1. **tt8-heavensword（T1，阻断）**：desc「在你抽到天启剑与诛魔剑后……」后半效果无文本无宿主——需设计者口径，未到前禁止实现任何推断效果。
2. **tt8-demonslay**：「以天启诛魔剑覆盖你的所有武器」是登记在案的设计者留白（effect-verbs.js:142 weaponCover，无结算）——保持留白还是实装？实装需定义"覆盖"结算语义。
3. **tt3-element-seal 解锁时点**：现行代码只在打出符印那一刻判定一次注能数（effect-steps.gates.js:27-44 无再判入口），注能数后达到 3 永不解锁——与卡面「累计注能3张后解锁」直觉不符。接受现口径，还是改为每次注能后重判（exec-play +5 行）？
4. **tt3-mystery-potion 双文本双宿主**：现行定版文本是「回合开始变形段」（TABLETOP10 cards.data.js:496），但矩阵要求"先做三分随机段"，且 battle.bag.js:52 的 id 直等使 BOSS 背包使用至今仍走三分随机——三分随机是否仍是设计意图？两段都保留还是收敛为一段？
5. **tt7-imitate 重变形**：已变形的替身不随后续武术再变形（battle.engine.js:1067 守卫）——卡面「变为打出的上一张武术牌的1费复制」是否应持续重变形？
6. **tt8-hero-warrior 新旧口径**：TT8 旧行「攻+2 的青龙偃月斩」（cards.data.js:352）已废弃、现行=化形（:611）——确认化形为唯一口径（涉及旧档文本克隆玩家的体验）。
7. **tt8-hero-assassin 旧文本重辨**：TT8 行「潜入夺宝：净化陷阱，潜行 2 回合；破隐一连击开弹幕」（cards.data.js:349，注释标"重辨存疑"）vs 现行「遁入虚空…破隐一击伤害翻倍」——确认现行为准，旧口径归档。
8. **tt8-abyss-sovereign 双登记日志**：迁移后文本正则（exec-play:157-174）与结构化 registerRule 并存会双打日志——批准登记段加 hasStructuredOnPlay 门（共享文件 +4 行）？
9. **tt8-hero-sealer 双拦截**：requirements unplayable 结构化后，desc「无法打出」文本拦截是否保留双通道（推荐保留，兼容旧档文本克隆）？
10. **（实现批前置检查，非新决策）transform 静默缺口**：capability 放行了 transform 但 resolver 无分支——补分支（+8 行）还是 capability 收回？影响 §2.20/§2.21 结构化路线选型。

---

## 六、自校验

- 21 张卡全覆盖：武术 1（tt7-imitate）+ 法术 5（cc-mana-surge、cc-rot-seed、cmtn1lbhbqi4、tt5-galaxy-voyage、tt7-stratagem）+ 装备 8（tt2-pearlbox、tt2-venomstaff、tt3-element-seal、tt3eq-mistbox、tt7-darkfort、tt7-naturestaff、tt8-demonslay、tt8-heavensword）+ 能力卡 6（tt8-abyss-sovereign、tt8-hero-assassin、tt8-hero-descender、tt8-hero-sealer、tt8-hero-summoner、tt8-hero-warrior）+ 道具 1（tt3-mystery-potion）= 21 ✓（与矩阵 §六 XL 清单一致）。
- 本文全部行号为 2026-09-27 工作区实读；矩阵中已漂移的旧引用（battle.core.js:73-115 宿主旗标、battle.engine.js:1315-1377 封印链、battle.engine.js:904 summonAlly 等）已在本文更新为现行位置（battle.runtime.effects.js:2-36、battle.runtime.piles.js:8-9、battle.engine.js:1386-1449、battle.engine.js:956-962）。
- 档位分布：A 档 1（galaxy）、B 档 7（rot-seed、charge-fireball、mana-surge、venomstaff、sovereign、assassin、descender）、C 档 13（其余，含 2 个口径阻断 heavensword/mystery-potion、1 个规格依赖 darkfort）。
