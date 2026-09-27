# M5 卡牌规则化数据迁移 · D7 交付结果（B-M4 延迟/持续/形态批）

- 日期：2026-09-27；代理 D7
- 范围：B-M4 批 19 张中分派的 15 张（减去 XL 的 cc-rot-seed、cmtn1lbhbqi4 与混合交互的 tt3-magic-lamp、tt3-frostfall）
- 基线：工作区未提交现场（HEAD `a8e91e6` + 并行 M1/M2 契约落地），双门/schema/执行件均以实读工作区文件为准
- 依据：`docs/M-BATCH-CONTRACT-SPEC.md`（✅ 节）、`docs/M-BATCH-MATRIX.md` B-M4 行、`cards.sync.m1.js`/`m2.js` 模板
- 结果：**迁 6 张、跳 9 张**（宁跳勿造，未改任何既有文件、未动执行器、未碰 cards-sync.json）

## 一、已迁清单（6 张）

回填入口：`game/src/cards/cards.sync.m5.js` `ensureM5DelayedRules(deps?)`（保守语义照抄 m1/m2：指定 ID、无自有 rules 且整卡与 canonical 深相等才回填、marker `sdt-cards-m5-delayed-rules-v1-seeded` 一次性、异常不标记、写时复制、双门先校验后保存、复读确认；不接线，由主指挥统一接）。

| id | 名称 | rules 摘要 | 旧描述（卡面） |
| --- | --- | --- | --- |
| tt3-wave-slash | 破浪斩 | onPlay[damage amountField:'dmg' chosenEnemy, noDrawNext]；battle side:enemy | 攻（+3），下回合无法抽牌。 |
| tt3-noon-duel | 正午决战 | onPlay[damage amountField:'dmg' chosenEnemy, schedule:'nextTurnStart', hits:{count:4}]；**定版卡面改写 dmg:0→2、补 dmgType:'fixed'** | 下回合开始时，连开四枪！（每枪造成2点固定伤害）。 |
| tt8-curse1 | 禁咒I | onDraw[stealAtk amount:1 chosenEnemy]（duration 缺省 1，归还走 enemy-phase 管线）+ onPlay:[] | 抽到时施放：夺取 1 点攻击力。 |
| tt8-curse2 | 禁咒II | onDraw[curse freeze duration:1 chosenEnemy] + onPlay:[] | 抽到时施放：冰冻。 |
| tt8-curse3 | 禁咒III | onDraw[curse poison stacks:1, curse bleed stacks:1] + onPlay:[] | 抽到时施放：中毒，流血。 |
| tt8-curse4 | 禁咒IV | onDraw[curse silence duration:1 chosenEnemy] + onPlay:[] | 抽到时施放：沉默 1 回合。 |

执行链核实（全部实读工作区文件）：

- `schedule:'nextTurnStart'`：`battle.resolution.js:525` damage 分支延迟入队（delayed 管线 triggerOps 通道），`battle.engine.js:683` processDelayed 下回合开始以第一存活敌结算（沉默封印同口径）。
- `noDrawNext`：`effect-steps.m2.js:63`（注释点名破浪斩）→ runtime 旗标，`battle.enemy-phase.js:76,398` 回合管线消费。
- onDraw「抽到即施放」：`battle.engine.js:119-127` drawCards 结构化分支——抽到即结算、不占手牌、进弃牌堆、目标=第一存活敌；与文本 parts.onDraw 分支同门互斥，不双结算。
- `stealAtk`：`effect-steps.m2.js:34-59`（注释点名禁咒「夺取 1 点攻击力」），玩家侧 blessing atkUp 按 duration 到期扣回，敌方侧 `_stealRestore` 归还。

### 特殊处理：定版卡面改写（仅 noon-duel）

正午决战卡面 `dmg:0` 且无 `dmgType`，与描述「每枪造成2点固定伤害」冲突：schema 对 damage op 有卡面一致性门（`card.dmg` 有限且 dmgType ∈ attack/spell/fixed/true，`card-rules.schema.js:841-844`；amountField 引用要求 card.dmg 有限，`:167-175`）。按 A3 `canonicalFieldsById` 先例（`cards.sync.js:17` helper、`:484` ensureTT7MultiHitRules 对 thundergrudge/meteorrain/sneak 三卡改写 dmg+dmgType），在深相等校验通过后、双门校验前以描述定版值改写卡面 `dmg:2` / `dmgType:'fixed'`（FACE_FIELDS_BY_ID 机制）。

### 特殊处理：纯触发器卡的 onPlay:[] 空键

resolver 文本路径全部挂在 `!hasStructuredOnPlay`（`battle.resolution.js:1057-1111`）；禁咒卡面无 dmg/draw/heal 字段，携带 `triggers.onPlay: []` 空键合法（schema 空数组无卡面门可触发、capability 空循环 supported），杜绝任何路径下文本宿主误结算。

## 二、跳过清单（9 张）

| id | 名称 | 跳过原因（对照现场证据） |
| --- | --- | --- |
| tt7-swordimmortal | 剑仙形态 | 抑制键死锁：desc「本局对战中，回合开始时额外抽 1 张牌」分句落 immediate（`battle.effects.js` splitEffectClauses 的 battle 前缀是「本局对战**内**」），命中 `effect-steps.curse.js:205` buff.swordForm 正则设永久旗标（enemy-phase 每回合抽 1）——不带 onPlay 键则文本宿主与结构化 runner 双结算；带空 onPlay 键则被卡面一致性门拒（face `draw:1` 非零 → "onPlay must declare card.draw"，实测试跑复现）。卡面字段归零属破坏卡面语义的改写，超授权。待契约扩键（textSuppressed 标记 / 空数组豁免卡面门）后迁 |
| tt3-petal | 花瓣法阵 | 同上死锁：desc 分句落 turnStart → `battle.engine.js:634` registerTurnStart 队列（left=3）与 runner 登记双结算；空 onPlay 键被卡面门拒（face `draw:1`+`heal:2` 非零）。另卡面 `heal:2` 与描述「回复 3 点生命」相悖（实机文本宿主按句内数字回 3），schema heal.amount 有「必须等于 card.heal」门——迁前需口径拍板＋卡面定版修正 |
| cmtn1wnhhym | 江湖救急-改 | 契约缺临时卡生命周期：acquire dest:'hand' 的 act 域仅 dup/noInfuse（`card-rules.capability.js:32-36`），decay 仅 discover 域；「回合开始消耗」需 delayed 域登记。且宿主已有 id 专支（`battle.resolution.js:469` 随机 3 张 + consumeTemps 延迟消耗），迁 rules 反而双结算 |
| cmtn233trmeg | 不朽斩 | keepInHand/noInfuse 自指无 schema 位置：handOps 仅存在于 draw op（DAMAGE_ALLOWED_KEYS 无 handOps），capability 手牌操作仅放行 consumeHand/dumpHand（`SUPPORTED_HAND_OPS`）；「永远保留手牌/无法注能」宿主为 exec-play desc 正则（`battle.exec-play.js:199`），文本承载稳定 |
| cmtn2jc142dj | 刀剑形态 | copyRandom 键位在 HAND_OP_KEYS 但解释器未消费（`effect-steps.m1.js:89` 双保险仅 consumeHand/dumpHand；capability 同步拒绝），迁入即静默不结算 |
| cmtn1r10xnl1 | 黑暗形态 | registerRule 白名单 REGISTER_RULE_KEYS（`card-rules.schema.js:97`）无 'discoverPlus'，schema 拒；「发现可选项+1」作用于 discover 交互域，现无对应规则键 |
| tt7-elementstorm | 元素风暴 | registerRule 白名单无 'doubleNextSpell'，schema 拒；宿主 nextSpellTwice（`battle.exec-play.js:152`）已承载「下一张法术施放 2 次」 |
| tt7-provoke | 扰敌 | 敌对敌攻击域无 op：schema/capability 均无 foeFight 类表达；stealAtk 是敌→玩家偷取，非敌对敌交互。目标选择×2 + 敌方回合外交互无契约 |
| tt2-apollo | 阿猫的礼物 | onAcquire 不在 TRIGGER_KEYS（`card-rules.schema.js:13-14`），触发器集无获取时点（宿主 fireCatGift 在 `battle.bag.js:91`，属 bag 域挂点）；按任务指示跳过 |

以上 9 张的契约缺口已写成回归锁定用例（`tests/m5-data.test.js` 末组：按矩阵草案「最贴近表达」构造 rules，断言 schema/capability 现场确实拒绝），契约扩集后这组用例应随迁卡同步改写。

## 三、验证

- `tests/m5-data.test.js`：34 用例全绿（`npx vitest run tests/m5-data.test.js`）。
  - 每张迁卡 3 组：双门通过 / canonical 回填生效（rules 逐键一致、卡面符合定版、落库复读一致、marker 盖章、单次 saveAll）/ 三态保守跳过（改名、改字段、已有自有 rules）。
  - 批次级 7 条：marker 一次性、库内缺卡、缺 canonical 表（CARDS_SYNC）、saveAll false、无原库串、热缓存与原库不一致、noon-duel 卡面被改过时定版改写不生效。
  - 跳过卡契约缺口锁定 9 条。
- `node --check game/src/cards/cards.sync.m5.js` + 模块 import 验证通过。
- 未跑全量 vitest、未 build、未执行任何 git 写操作、未触碰 cards-sync.json。

## 四、交付物

- `game/src/cards/cards.sync.m5.js`（新建）：ensureM5DelayedRules(deps?)，6 张定义 + FACE_FIELDS_BY_ID 定版卡面改写 + 保守回填语义。
- `tests/m5-data.test.js`（新建）：34 用例。
- `docs/M5-D7-RESULT.md`（新建）：本文档。

## 五、未决事项（报主指挥）

1. ensureM5DelayedRules 未接线——需与 ensureA3*/ensureM1/ensureM2 在 cards.js ensure 层同位接入。
2. 剑仙形态/花瓣法阵的「空 onPlay 抑制键 vs 卡面一致性门」死锁需契约层面裁决（扩键或修 schema 豁免），两卡连同卡面 heal:2/描述 3 的口径一并定版后可补迁。
3. noon-duel/petal 的定版卡面改写若与设计者口径有出入，以设计者为准回滚 FACE_FIELDS_BY_ID 对应条目即可（回填器按深相等门自动停止改写）。
