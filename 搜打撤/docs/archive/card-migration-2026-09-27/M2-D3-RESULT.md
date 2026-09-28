# M2 批迁移结果（代理 D3，2026-09-27）

- 使命：B-M1 现集批次剩余 26 张 S 级卡迁结构化 rules（D1 已迁 starter-attack / tt3-skewer / tt8-dragonblade / tt7-livingwater，不含在内）。
- 基线：HEAD `a8e91e6`；**判定以工作区现场为准**（schema / capability / battle.resolution.js 存在并行 M1 未提交扩展，本次逐卡核实的都是实时代码，行号以本日工作区为准）。远端差异未核实。
- 交付：`game/src/cards/cards.sync.m2.js`（ensureM2OnplayRules，保守语义照抄 m1：指定 ID、无自有 rules 且整卡与 canonical 深相等才回填、marker 一次性、异常不标记、写时复制、双门先校验后保存、复读确认；**未接线**，由主指挥统一接入 cards.js ensure 层）、`tests/m2-data.test.js`（54 用例）。
- 验证：`npx vitest run tests/m2-data.test.js` → 54/54 通过（每卡 3 用例 + 批次级 6 用例）；`node --input-type=module` 独立导入 cards.sync.m2.js 通过。未跑全量 vitest、未 build、无 git 写操作。

## 一、已迁清单（16 张）

rules 均为 `version:1` + onPlay 有序 ops；「混合」指敌方主体 battle.target + 自身域字面量效果 op（M1 混合放行：field-anchored 仍禁混排，故一律用与卡面字段一致的 amount 字面量）。

| id | 名称 | rules op 摘要 | 旧描述 |
|---|---|---|---|
| cc-chase-slash | 追斩 | damage amountField:dmg + costModifiers martialPlayedDiscount amount:1 | 攻（+0），本回合每打出一张其他武术，费用-1。 |
| tt2-comboarrow | 连击箭 | damage amountField:dmg + costModifiers previousCardTypeFree type:'武术' | 攻（-1）；如果你打出的上一张牌是武术牌，本牌变为0费。 |
| tt2-forestarrow | 绿化箭 | damage + armor amount:3（混合） | 攻（-1），+3 甲。 |
| tt2-piercearrow | 破甲箭 | damage + armor amount:3（混合） | 攻（-1），获得 3 点护甲。 |
| tt2-swiftarrow | 迅疾箭 | damage + draw amount:1（混合） | 攻（-1），抽 1 张牌。 |
| tt7-fullstrike | 全力一击 | damage + draw amount:1（混合） | 攻（+5），抽 1 张牌。 |
| tt7-throwblade | 飞刃偷袭 | damage + curse bleed stacks:1 + draw amount:1（混合） | 攻（-3），附加流血，抽 1 张牌。 |
| cc-demon | 恶魔之力 | damage(amountField:dmg, spell) + heal selfDamage:2（混合） | 4′，损失 2 点生命。 |
| cmtn28jv33wx | 搜索大宝箱 | acquire n:3 pool:'随机' dest:hand（SELF） | 随机获取3张卡牌 |
| tt12-breakthrough | 突破进展 | 三段 acquire pool:'0费/1费/2费招式' dest:hand（SELF；A3 时「三段费用无键」被排除，M1 acquire 落地后可迁） | 随机获取1张0费，一张1费，一张2费招式 |
| tt12-sporewall | 孢子城墙 | curse poison stacks:2 + armor amount:6（混合） | 对一名敌人附加2层中毒，自己获得6点护甲 |
| tt3-firm-barrier | 坚冰结界 | curse freeze duration:1 + extend:1（只延长不施加，duration 仅为 schema 计时诅咒必填）+ draw amount:1（混合） | 延长 1 名角色的冰冻 1 回合，抽1张牌。 |
| tt3-flame-storm | 风暴火球 | damage amount:4 target:allEnemies（enemy/area:true） | 对全体敌人每人释放1次火球。 |
| tt3-nature-form | 自然形态 | energyCap n:1（SELF） | 本局战斗中，能量上限 +1。 |
| tt3-toxin | 毒药 | curse poison stacks:1 + draw amount:1（混合） | 附加 1 层中毒。抽 1 张牌。 |
| tt7-silence | 禁言术 | curse silence duration:1 + draw amount:1（混合） | 沉默 1 名角色 1 回合，抽 1 张牌。 |

canonical 源表：cc-chase-slash → CARDS_SYNC（cards-sync.json cards[0]）；cc-demon → TABLETOP7；10 张 → TABLETOP10；cmtn28jv33wx / tt3-flame-storm → TABLETOP11；tt12-breakthrough / tt12-sporewall → TABLETOP12。16 张均无 ensure 链改字段记录，深相等守卫可满足。

与矩阵草案的三处口径修正（均以工作区执行器/schema 实况为准）：
1. cc-chase-slash 折扣量：草案 `-1` 过不了 schema 正整数校验（card-rules.schema.js costModifiers 分支），消费端 `battle.card-cost.js:36` 语义为 `cost - playedMartialThisTurn × amount`，定 `amount:1`。
2. 混合卡抽/甲：草案写 `amountField`，但 field-anchored 效果 op 与 damage/curse 混排被 schema 拒；改用与卡面字段一致的 amount 字面量（A3 铁甲阵/潜匿先例，declaresField 契约仍满足）。
3. cc-demon：草案 `heal amount:2 selfDamage:true` 形状非法（heal 源六选一且 selfDamage 须正整数）；按执行器 heal 分支注释点名的恶魔之力语义定 `heal selfDamage:2`（自伤非治疗、不受禁疗影响）。

## 二、跳过清单（10 张）

| id | 名称 | 原因（核实证据） |
|---|---|---|
| tt3-fatal-pierce | 致命穿刺 | 破甲在宿主受**流血门条件生效**（effect-steps.curse.js curse.bleedGate → curse.abreak `!ctx.bleedGateFail`，伤害+2 同条件，battle.resolution.js:626-630）；结构化 curse op 无 cond 键（CURSE_ALLOWED_KEYS），迁后会对未流血目标也挂破甲——行为偏差。矩阵草案的 damage 级 cond 另有问题：执行器语义是「整段无效」而非条件增伤（battle.resolution.js castSegment），正确形状应为 bonus.if，但破甲条件仍无键。 |
| tt7-ghostblade | 鬼魅之刃 | T5 判死，但死因与矩阵预设不同：敌侧隐身键**已核实**为 `status.stealth`（combat.js:88/300），运行时能查；卡在 schema `validateCondition` 把 foeStatus 值域收死为七种诅咒键（card-rules.schema.js），'stealth' 直接校验失败。扩值域=改 schema，本批禁改。 |
| cc-poison-burst | 毒爆 | 宿主为**纯引爆**不施加（effect-steps.kills.js curse.poisonBurstN）；结构化 curse 强制 curse 键且叠层诅咒必带 stacks≥1（先施加后引爆）→ 会白嫖 1 层中毒，行为偏差。 |
| tt3sp-flowerzhen | 花鸩 | 同上：宿主纯「翻倍现有层数+引爆」（curse.poisonDouble），结构化强制施加 1 层，行为偏差。 |
| tt12-felguard | 邪能护体 | 卡面带 `infuse:2`（catalog-after 实测）；schema 禁 onPlay 保留 card.infuse≠0，注能门无 schema 表达（T11，比矩阵「注能门在描述句」的预设更严——门实际在卡面字段）。 |
| tt12-raydragon | 龙焰射线 | 卡面 `infuse:1`，同上 T11。 |
| tt7-holyheal | 圣光治愈 | 卡面 `infuse:1`，同上 T11。（perFuelCost 消费端本身无碍：battle.resolution.js heal 段按 `perFuelCost × fuelCost` 折算、注释即点名圣光治愈，与「2 倍被注能卡价格」口径一致——非阻塞项，仅记录。） |
| tt3sp-bloodstorm | 血蝠风暴 | 卡面 `infuse:2`（T11）+ 第二层缺口：「注能(2)：触发 2 次」的次数门在 damage 域无 recast 表达，recast 仅 `{on:'kill'}`（schema 严格校验），矩阵备注的降级条件命中。 |
| tt12-freezeray | 冷冻射线 | T2 误判**实锤**：敌方会回血——远古龙尊每回合回复 10 点（battle.enemy-phase.js:227-228），受伤回满血后会被 foeFullHp 误判为「未曾受伤」遭冰冻。接受近似或新增 foeUntouched 需老板拍板，本批不迁。 |
| tt7-arcanebolt | 奥术弹 | 能力本身够（damage+draw），卡在 canonical 守卫：存储卡被 ensureEffectFields 动态补 `draw` 字段（catalog observedInitChanges 实测），源表 TABLETOP7 定版无该字段，深相等永假；内联手写补丁快照违背 m1「不另存可漂移数值表」先例。若主指挥愿意接受「canonical+声明式补字段」扩展守卫可补迁。 |

## 三、未核实项 / 备注

- 工作区 battle.core.js / battle.layers.js / game.run.* 等其他并行改动未逐一核对（与本批无交集，仅 battle.resolution.js / schema / capability 属本批判定依据，均已实读）。
- 若主指挥后续把 tt3-deep-diary 类「诅咒条件」、cond 扩值域（stealth）、curse 条件键、pure-burst 诅咒形、注能门 schema 表达任一落地，上表 tt7-ghostblade / tt3-fatal-pierce / cc-poison-burst / tt3sp-flowerzhen / 注能四卡可按本文件记录的口径补迁。
- cards-sync.json 本次只读（canonical 对照），未写。
