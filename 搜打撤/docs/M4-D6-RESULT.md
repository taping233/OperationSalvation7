# M4 卡牌规则化数据迁移 · 代理D6 结果（B-M3 装备批）

- 日期：2026-09-27（代理D6）；基线：HEAD `a8e91e6` + 工作区在途未提交契约扩展（以工作区现场为准实读）
- 派工：B-M3 装备批 27 张（全 32 张减 5 张 XL：tt3-element-seal、tt2-venomstaff、tt3eq-mistbox、tt7-darkfort、tt7-naturestaff）
- 结果：**实迁 2 张，跳过 25 张**（每张跳过均有执行器实读证据，宁跳勿造；未改任何既有文件）
- 交付：`game/src/cards/cards.sync.m4.js`（ensureM4EquipRules，保守语义照抄 m1/m2，未接线）、`tests/m4-data.test.js`（12 用例全绿）

## 一、核心结论：装备批数据迁移的三个结构性缺口

本批 27 张中 25 张不可安全迁移，全部归因于以下三个缺口（均需改执行器才能收编，本批禁改既有文件）：

1. **rules.equip 不抑制文本路径（双算缺口）**：`battle.resolution.js` 的文本立即句结算只被
   `hasStructuredOnPlay`（存在 `rules.triggers.onPlay` 键）抑制；`rules.equip.*` 的消费点
   （`battle.equipment.js` registerEquip / syncCurseCondEquips）与 desc 文本结算**并存叠加**。
   例如长剑「+1 攻」被文本 `buff.atkUp` 步骤（effect-steps.curse.js，含 `/\+\s*(\d+)\s*攻/` 分支）
   结算 atkUp+1，迁 `passive.aura {atk:1}` 后穿戴再 +1 → 攻+2。
2. **主动技能文本优先（skill 死数据缺口）**：desc 带「主动技能：」时 `useEquipSkill` 走文本路径
   （battle.equipment.js `!text && structuredSkill` 门，:113）；`rules.equip.skill` 仅对无技能文本
   的装备生效——对存量带文本装备迁入即死数据（M-BATCH-HOSTED-DESIGN.md :284 已记录同一事实）。
3. **消耗/时点触发双路径并存**：`fireConsumeTriggers`（battle.engine.js:986-993）对
   `rules.triggers.onConsume` 与 `consumeTriggerTexts(desc)` 无条件先后结算；打出侧文本宿主
   （killAtkUp 登记、turnStart 句 registerTurnStartText）与 `registerCard`+runner 结构化触发并存。

## 二、已迁清单（2 张）

| id | 名称 | rules 摘要 | 旧描述（TABLETOP10 定版） |
|---|---|---|---|
| tt3-deep-diary | 深海咒印 | `equip.passive { cond:{hasCurse:true}, aura:{atk:2, spellPower:2} }` | 自身处于诅咒状态时，获得 2 点攻击力且法伤 +2。 |
| tt3-deep-seal | 深海印记 | 同上（矩阵陷阱 T6：与 deep-diary 同草案同测） | 诅咒状态下，攻 +2，法伤 +2。 |

- canonical：`cards.data.js` TABLETOP10（:549 / :535；TABLETOP3 旧行「深衍日记/深解印记」已被后表覆盖，m1 同款口径）。
- 单源性论证（为何这两张无双算）：
  - 穿戴文本路径：desc 命中 `gate.curseCond`（effect-steps.gates.js「诅咒状态[下时]」装备分支）→ 只打提示日志并 HALT，**不结算数值**；
  - 动态核算：`syncCurseCondEquips` 的 rules 分支（`passive.cond.hasCurse`）命中后 **return**，短路 desc 正则旧读法——rules 迁入即收编，诅咒解除自动收回；
  - registerEquip 的 aura 立即结算被 `!rules.passive.cond` 门排除，无第二次叠加。
- **行为修复标注（deep-diary）**：desc 正则旧读法的攻加成提取式 `/攻\s*\+\s*\d/`（及 `/攻击\s*\+\s*\d/`）匹配不到「获得 2 点攻击力」，文本版诅咒期间只 +2 法伤；rules 版按卡面攻+2、法伤+2 全生效。deep-seal 文本正则本就正确，迁移前后数值一致。
- 消费点（既有，未改）：`battle.equipment.js` registerEquip/syncCurseCondEquips；诅咒变化重核算钩子在 `battle.enemy-phase.js:318`。

## 三、跳过清单（25 张，按缺口归组）

### A. 穿戴/光环双算（5 张）——缺口 1

| id | 名称 | 旧描述 | 跳过原因 |
|---|---|---|---|
| tt3-longsword | 长剑 | +1 攻。 | 文本 `buff.atkUp`（`/\+\s*(\d+)\s*攻/` 分支命中）结算 atkUp+1；迁 `aura{atk:1}` 后叠加成攻+2 |
| tt3-staff | 法杖 | 法伤 +1。 | 文本 `buff.spellUp`（`/法伤\s*\+\s*\d/`）结算；与 `aura{spellPower:1}` 双算 |
| tt3-grass-armor | 草甲 | 装备：装备时获得5点护甲。 | desc 无「装备时」分句门 → immediate 文本 armor+5；与 `onEquip[armor 5]` 双算 |
| tt3-silver-runesword | 诅咒之剑 | 获得 2 点攻击力；回合开始时，受到2点伤害 | 「获得 2 点攻击力」文本 buff.atkUp 与 `aura{atk:2}` 双算；回合自伤段另有时点双路径（缺口 3） |
| tt8-archdemon | 天启诛魔剑 | 获得 1 点攻击力，获得3张重斩。 | 文本 buff.atkUp + getRandomCard（「获得3张重斩」命中）与 `onEquip[blessing, acquire]` 双算；另系 tt8-hero-ranger 衍生 token（B-M5 侠客链），矩阵备注 pool 引用需规格兜底 |

### B. 消耗触发双算（4 张）——缺口 3

| id | 名称 | 旧描述 | 跳过原因 |
|---|---|---|---|
| tt2-wreck | 沉船宝盒 | 消耗该牌时，获取 2张随机卡牌。 | fireConsumeTriggers 双路径无条件并存：rules onConsume + consumeTriggerTexts 各结算一次 |
| tt3-azure-sword | 百炼青虹剑 | 消耗该牌时立即释放一次'初始攻击'。 | 同上；另 execute 键集（cap/count/onKill/perCurseKinds）无「释放初始攻击」表达（what 键属 transform） |
| tt3-sapper-bomb | 矿工炸药 | 消耗该牌时，造成 4 点固定伤害。 | 同上双算 |
| tt7-arcanescroll | 奥术残卷 | 消耗该牌时抽 3 张牌。 | 同上双算 |

### C. 主动技能死数据（8 张）——缺口 2

| id | 名称 | 旧描述 | 跳过原因 |
|---|---|---|---|
| tt3-light-mail | 急速跑鞋 | 主动技能：抽3张牌 | desc 带技能文本 → useEquipSkill 走文本，rules.equip.skill 死数据 |
| tt3-holy-staff | 圣杖 | 主动技能：净化并回复5血 | 同上 |
| tt12-raygun | 射线枪 | 主动技能：发现一张射线牌并直接释放 | 同上；另 discover op 的 pool 被 schema 限定 `{kind:'moves'}`，射线池只能走 `acquire dest:discover act:play` 组合 |
| tt2-treasuremap | 寻宝图 | 主动技能：将 1张'搜索大宝箱'洗入牌库，抽1张牌。 | 同上 |
| tt3-crimson-pouch | 深红丝袋 | 主动技能：选择并复制你的 1 张手牌。 | 同上；另选择式复制无 op 表达（handOps.copyRandom 未被 capability 放行，pick 交互域未落地） |
| tt3-fate-wheel | 命运钟表 | 主动技能：消耗所有手牌，获得 1 个额外回合。 | 同上；另 skill.ops 无法表达「只消耗手牌不抽牌」（handOps 是 draw op 的附属键，draw 必须带抽牌源）；extraTurn op 本身已接线 |
| tt3eq-boiler | 魔法锅炉 | 主动技能：注能(2)：随机获取 3 张卡牌。 | 同上；另注能代价（消耗 2 张手牌）无 op 键（宿主专支 battle.equipment.js:131） |
| tt3-reverse-bow | 连弩 | 主动技能：直接释放手牌中的所有'箭'，每释放1张，抽1张牌。 | 同上；另「execute from:hand byType」手牌系列批量释放无 schema 表达（SPEC/execute 键集均无此键，矩阵已标混合实现） |

### D. 时点触发双路径（3 张）——缺口 3

| id | 名称 | 旧描述 | 跳过原因 |
|---|---|---|---|
| tt3-blooddrinker | 饮血剑 | 本局对战内，每消灭 1 个敌人，+1 点攻击力。 | 打出侧文本登记 `killAtkUp`（battle.exec-play.js:168 正则命中）与 rules onKill（registerCard 登记 + fireKill）双算（每杀+2 攻） |
| tt3-master-staff | 大法师之杖 | 回合开始时法伤 +1。 | equip 键集（EQUIP_KEYS）无 onTurnStart；走 triggers.onTurnStart 则与文本 turnStart 句（registerTurnStartText 管线）双算 |
| tt3-wolf-bow | 天狼长弓 | 回合开始时，获得1张随机的'箭矢'并将其变为0费。 | 同上（文本 turnStart 箭矢宿主 ARROW_TOKEN 与 runner 并存）；acquire 表达层本身可行（`pool{kind:'箭'} dest:deck act:zeroCost` capability 放行） |

### E. 开战被动双读法（3 张）——缺口 1 变体

| id | 名称 | 旧描述 | 跳过原因 |
|---|---|---|---|
| tt3-chaos-eye | 混沌之眼 | 对战开始时：血量上限 +10，牌库上限+5。 | 迎战路径 applyBattleStartPassives 只走文本（rules.equip.battleStart 死数据）；战斗中穿戴补发又与文本 immediate 叠加；另见下方 T3 收编点 |
| tt7-talisman | 灵符 | 对战开始时，额外抽 2 张牌。 | 同上（无 T3 因素） |
| tt3-immortal-blade | 骷髅王剑 | 对战开始时，你的所有「初始攻击」化为 1 张不朽斩。 | 同上；另 transform「化为 1 张」（多张合并为 1 张）的数量合并语义未规格（transform what:'sha' 键位已有） |

### F. 表达缺口（2 张）

| id | 名称 | 旧描述 | 跳过原因 |
|---|---|---|---|
| tt2-frostsword | 寒冰剑 | 对冰冻角色伤害 +2。 | schema 无伤害加成 aura 键（EQUIP_AURA_KEYS 仅 atk/spellPower/focus）；`passive.cond.vsFreeze` 被 schema/capability 放行但**无结构化消费点**（battle.equipment.js 无 vsFreeze 分支，现行为走 effect-verbs vsFreezeBonus 文本路径） |
| tt3-twinwater-mail | 冰甲 | 冰冻 1 名敌人后，+3甲。 | 「冰冻后 +3 甲」事件型被动无 cond 键（EQUIP_COND_KEYS 仅 hasCurse/vsFreeze） |

## 四、T3 双读法收编点标注（混沌之眼·牌库上限）

- 现状：BOSS 战牌库上限加成由 `battle.lifecycle.js` `deckCapBonus()` 读迎战装备 **desc 文本**
  （「牌库上限+N」正则）实现；结构化侧 `rules.equip.battleStart` 的 `deckCap` op 已接线
  （battle.resolution.js 消费，battle.equipment.js 战斗中穿戴补发）。
- 收编口径（后续批次执行，需改 battle.lifecycle.js——本批禁改）：chaos-eye 迁
  `equip.battleStart [{op:'maxHp',n:10},{op:'deckCap',n:5}]` 时，必须**同批移除 deckCapBonus()
  的 desc 文本读法**，以 rules 为唯一源；否则迎战装备两条读法双计牌库上限。
- 连带前提：开战被动的 rules 结算通道需先补齐（缺口 E：applyBattleStartPassives 目前只走文本，
  迎战装备的 rules.equip.battleStart 无人消费），否则「以 rules 源为准」会直接失去加成。

## 五、验收与验证

- `npx vitest run tests/m4-data.test.js --no-file-parallelism`：**12 passed**（2 卡 × 3 用例 + 批次级 6 用例）。
- 每张迁卡用例：双门（validateCardRules + inspectCardRuleCapability）/ canonical 回填生效
  （rules 逐键一致、卡面不动、落库复读一致、marker 盖章）/ 三态保守跳过（改名/改字段/已有 rules）。
- 批次级：marker 一次性、缺卡/缺 canonical/saveAll 失败/无原库串整体退出、单卡被改仅跳过该卡。
- `node --check` 两文件语法通过；未跑全量 vitest、未 build、零 git 写操作、未碰 cards-sync.json。
- 新建文件：`game/src/cards/cards.sync.m4.js`、`tests/m4-data.test.js`、`docs/M4-D6-RESULT.md`（本文件）。
- 接线提醒：ensureM4EquipRules 未接入启动链，由主指挥在 cards.js ensure 层与 ensureA3*/ensureM1/ensureM2 同位调用。
