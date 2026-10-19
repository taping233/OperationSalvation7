# M 批迁移矩阵（目标池 150 张，老板 2026-09-27 拍板）

本矩阵保留 09-27 的迁移目标、契约分类与 09-29 的批次复核。150 张目标及 51 张排除属于原始迁移集合，测试按本文件路径和稳定 id 读取；当前运行库与支持能力从[卡牌入口](cards/README.md)定位源码和测试。本页各段的能力、在途和验证描述按所注明的基线阅读。

- 基线：HEAD `a8e91e6`。数据源 `docs/evidence/e8-card-migration-2026-09-27/legacy-201-scratch.json` + `catalog-after.json`（150 张逐卡核对，缺失 0）。排除的 51 张见 `docs/M-BATCH-EXCLUSIONS.md`。
- `a8e91e6` 的能力快照（制定时点实读）：
  - schema 放行的 onPlay op 全集：damage / armor / heal / draw / status(仅 freeze+allEnemies) / discover / curse / acquire / blessing / energy / energyCap / maxHp / deckCap / coins（`game/src/cards/card-rules.schema.js:482-483,510-511`）；pending 键位已设计、解释器遇之 throw：execute / summon / transform / registerRule / extraTurn（`card-rules.schema.js:51-66`）。装备域 equip 全 pending（`card-rules.schema.js:71-76`），capability 对 rules.equip 一票否决（`game/src/cards/card-rules.capability.js:78-80`）。
  - 解释器已消费（HEAD `battle.resolution.js`）：curse double/burst/extend（:78,167-193）、damage lifesteal（:523）、recast on:'kill'（:532-536）、acquire/coins/blessing/energy/energyCap/maxHp/deckCap（:699-740）、heal perFuelCost（:797）、cond 四键 foeHpBelow/foeHpHalf/foeStatus/foeFullHp（:57-62）。
  - **基线尚未消费**（当时 capability 同步拒绝）：cleanse、draw.untilHandN、draw.handOps（基线 `battle.resolution.js:809` 守卫拦截；`card-rules.capability.js:100-102` 拒绝）、damage.graveyard/schedule（`capability.js:100-102`）。当时工作区的未提交 M1 扩展（`battle.resolution.js` +43/-11，新增 `effect-steps.m1.js`）已接线 cleanse/untilHandN/handOps，因此原矩阵将其标为「并行M1(在途)」。这是制定时点的分类，后续复核见第七节。
- 依赖契约取值：`现有能力` / `规格新增:<语义>`（见 `docs/cards/M-BATCH-CONTRACT-SPEC-2026-09-27.md`）/ `并行M1(在途)` / `混合实现`（schema+宿主命名分支）。
- 批次：B-M1 现集 / B-M2 onPlay 扩展 / B-M3 装备与trigger / B-M4 延迟持续形态 / B-M5 大招与大机制 / B-M6 bag道具。
- 复杂度：S 纯数据 / M 需新 op 或参数 / L 需新 trigger/lifecycle / XL 混合实现或大机制。

## 一、武术（38 张）

| id | 名称 | 类型 | 目标 rules 草案 | 依赖契约 | 复杂度 | 批次 | 备注 |
|---|---|---|---|---|---|---|---|
| starter-attack | 初始攻击 | 武术 | onPlay[damage amountField:dmg]（attack 型默认按攻击力结算） | 现有能力 | S | B-M1 | 系统基础卡：isStarterAttack 特判与 SHA 编组注入（battle.lifecycle.js:296-297）、击杀化形宿主（battle.core.js:75）都按卡名/id 识别；建议 B-M1 末位迁移并回归普通战/BOSS 编组数 |
| cc-chase-slash | 追斩 | 武术 | onPlay[damage amountField:dmg] + battle.costModifiers[{kind:'martialPlayedDiscount',amount:-1}] | 现有能力 | S | B-M1 | martialPlayedDiscount 在白名单（card-rules.schema.js:876）；计数器 playedMartialThisTurn 已存在（battle.lifecycle.js:286，回合开始清零） |
| cc-cursed-blade | 诅咒之刃 | 武术 | onPlay[damage amountField:dmg, curse:<hand-sweep 全部诅咒键>] | 规格新增:curse.source='handMoves'（运行时枚举手牌招式的 curse 键去重） | M | B-M2 | 「全部诅咒效果」动态收集；注意同种诅咒只取一次的口径需规格定死 |
| cc-last-stand | 破釜沉舟 | 武术 | onPlay[damage amountField:dmg, recast:{on:'lastHand',times:2}] | 规格新增:recast.on='lastHand'（现仅 on:'kill' 被消费，battle.resolution.js:532） | M | B-M2 | 「最后一张手牌」= hand.length===1，结算时点先于/后于本牌离手需规格明确 |
| cc-rapid-fire | 连续射击 | 武术 | onPlay[damage amount:2 dmgType:fixed, hits:{perPlayedMoves:1}] | 规格新增:damage.hits 动态源 perPlayedMoves | M | B-M2 | 计数器 playedMovesThisTurn 已有（battle.lifecycle.js:287）；capability 已拒 hits.perFoe（capability.js:104-106），新源需同步 capability 表 |
| cmtn0pbkmnvc | 流光照影 | 武术 | onPlay[damage 0 + execute:{what:'初始攻击', count:perCurseStacks}] | 规格新增:execute.count 动态源 perCurseStacks（execute 键位已设计 card-rules.schema.js:60，解释器 pending） | M | B-M2 | 衍生 unrandom（cards.data.js:620）；「释放初始攻击」走 starter 攻击路径，非伤害数值 |
| cmtn0xt0zr7 | 闪金之锤 | 武术 | onPlay[damage amount:5 dmgType:fixed, onKill:{coins:2}] | 规格新增:damage.onKill 奖励（现有 recast.on:'kill' 只能再施放伤害） | M | B-M2 | 击杀奖励管线 applyKillRewards 已有；事件侧同款效果先例 game.run.flow.js:806 |
| cmtn1wnhhym | 江湖救急-改 | 武术 | onPlay[acquire n:3 dest:hand act:tempDecay] + 回合开始消耗临时卡 | 规格新增:临时卡生命周期（act:'decay' 现仅在 discover 域，card-rules.capability.js:24-25） | M | B-M4 | 获取+延迟消耗两段；「回合开始消耗」需要 delayed 域登记 |
| cmtn233trmeg | 不朽斩 | 武术 | onPlay[damage amountField:dmg] + handOps:{keepInHand:true,noInfuse:true}（作用于自身） | 规格新增:handOps 自指语义（HAND_OP_KEYS 键位已有 card-rules.schema.js:69，消费域在 draw op 内） | M | B-M4 | 衍生 token（骷髅王剑化形产物）；killTransform 宿主注释 battle.core.js:75 |
| cmtn2jc142dj | 刀剑形态 | 武术 | onTurnStart[draw 1 + handOps:{copyRandom:true}] | 规格/接线:onTurnStart 触发器（TRIGGER_KEYS 已放行 schema:11，解释器 throw） | L | B-M4 | 「获得随机手牌的复制」=copyRandom 键位已有 |
| tt2-comboarrow | 连击箭 | 武术 | onPlay[damage amountField:dmg] + battle.costModifiers[{kind:'previousCardTypeFree',type:'武术'}] | 现有能力 | S | B-M1 | previousCardTypeFree 白名单内；lastCardType 状态已有（battle.core.js:78） |
| tt2-forestarrow | 绿化箭 | 武术 | onPlay[damage amountField:dmg, armor amount:3] | 现有能力 | S | B-M1 | v2 字面量 armor 可与 damage 混排（card-rules.schema.js:648-655 只限 amountField 锚定） |
| tt2-piercearrow | 破甲箭 | 武术 | onPlay[damage amountField:dmg, armor amount:3] | 现有能力 | S | B-M1 | 与 tt2-forestarrow 同构，可同测 |
| tt2-swiftarrow | 迅疾箭 | 武术 | onPlay[damage amountField:dmg, draw amountField:draw] | 现有能力 | S | B-M1 | 箭系列成员（连弩/天狼长弓联动对象） |
| tt2-jianghu | 江湖救急 | 武术 | onPlay[discover {count:1, pool:{kind:'otherClass'}, act:'play'}] | 规格新增:discover.pool.kind 跨职业池（现仅 kind:'moves'，card-rules.schema.js:503-505） | M | B-M2 | 「直接施放」=discover act play（现有） |
| tt2-turtlearmor | 铸甲 | 武术 | onPlay[armor amount:10] + cost:{consumeEquip:1} | 规格新增:onPlay 代价 consumeEquip | M | B-M2 | 消耗装备需玩家选择交互（装备≥2 时），handSelecting 域 |
| tt3-dig-treasure | 挖宝 | 武术 | onPlay[discover {pool:'deckBottom'}, armor amount:'priceOf(discovered)'] | 规格新增:discover 位置 deckBottom + armor 动态锚定 discovered 价格 | M | B-M2 | amountField 仅 dmg/heal/armor/draw 四个卡面字段（schema:15），跨操作动态值需新语义 |
| tt3-fatal-pierce | 致命穿刺 | 武术 | onPlay[damage amount:1, cond:{foeStatus:'bleed'}, bonus:{amount:2}, curse abreak duration:1] | 现有能力 | S | B-M1 | cond.foeStatus + bonus 条件增伤已消费（battle.resolution.js:494-500） |
| tt3-fly-arrowhawk | 飞身劈 | 武术 | onPlay[damage amountField:dmg] + 全局旗标 bleedAmp:2（本场流血伤害翻倍） | 规格新增:blessing/registerRule bleedAmp | M | B-M2 | 全局持续效果，宿主无现成旗标 |
| tt3-frostfall | 剑荡妖邪 | 武术 | onPlay[damage amount:5] + execute:{from:'hand', type:'武术', pick:'choose'} | 混合实现:execute pending + 手牌选择交互（handSelecting） | L | B-M4 | 选择+直接释放域未规则化 |
| tt3-noon-duel | 正午决战 | 武术 | onPlay[damage amount:2 dmgType:fixed, schedule:{nextTurnStart, times:4}] | 规格接线:damage.schedule（capability 拒绝 capability.js:100-102；delayed 队列宿主 battle.core.js:63） | L | B-M4 | 「下回合开始」延迟段 |
| tt3-purify-arrow | 净化箭 | 武术 | onPlay[damage amountField:dmg, cleanse target:self] | 并行M1(在途)（工作区 battle.resolution.js:723 已接线 cleanse；HEAD 无） | M | B-M2 | 洁净=移除自身全部诅咒；等 M1 合入后按现有能力收编 |
| tt3-qi-wave | 气功波 | 武术 | onPlay[draw amountField:draw, damage amount:'target.value' dmgType:fixed target:allEnemies] | 规格新增:damage.amount 动态锚定 perTarget 价格 | M | B-M2 | 「等同其价格」=value 字段；amountField 白名单外的新源 |
| tt3-skewer | 穿刺 | 武术 | onPlay[damage amountField:dmg, curse abreak duration:1] | 现有能力 | S | B-M1 | abreak=破甲（CURSE_KEYS schema:42） |
| tt3-wave-slash | 破浪斩 | 武术 | onPlay[damage amountField:dmg] + 规格新增:noDrawNextTurn | 规格新增:延迟禁抽（delayed 域） | M | B-M4 | 单回合资源剥夺，需回合开始消费点 |
| tt3sp-shadowbug | 影噬 | 武术 | onPlay[规格新增 op stealAtk {target:chosenEnemy, cap:1, dur:1}] | 规格新增:stealAtk（敌攻→1 且玩家本回合获得差额） | M | B-M2 | 攻击力操作域（降低/偷取）现无 op |
| tt3wu-shike | 割蚀 | 武术 | onPlay[curse {curse:'atkDown', stacks:2, duration:3}, curse bleed] | 规格新增:curse 枚举 atkDown（CURSE_KEYS 现七种，schema:42） | M | B-M2 | atkDown 与攻防词缀域共用 CURSE_META 单源 |
| tt7-armup | 武术 | 武术 | onPlay[draw amount:2, filter:{type:'装备', from:'deck'}] | 规格新增:draw.filter（acquire.filter 被 capability 拒 capability.js:107-110，draw 无 filter） | M | B-M2 | 「从牌库中抽取 2 张装备牌」 |
| tt7-bloodpoison | 血毒双镖 | 武术 | onPlay[damage amount:1 hitCount:2 retarget:true, curse bleed@seg1, curse poison@seg2] | 规格新增:多段 curse 与 hit 段绑定 | M | B-M2 | 「选择两个目标（可重复）」：hitCount/retarget 现有（键 schema:15），双 curse 各随其段是缺口 |
| tt7-demonbreaker | 破甲重斩 | 武术 | onPlay[damage amount:5, curse abreak duration:2, onKill:{armor:4}] | 规格新增:damage.onKill armor | M | B-M2 | onKill 与 recast.on:'kill' 语义不同（加甲 vs 再施放） |
| tt7-fullstrike | 全力一击 | 武术 | onPlay[damage amountField:dmg, draw amountField:draw] | 现有能力 | S | B-M1 | — |
| tt7-ghostblade | 鬼魅之刃 | 武术 | onPlay[damage amount:1, cond:{foeStatus:'stealth'}, bonus:{amount:2}, draw amountField:draw] | 现有能力 | S | B-M1 | 语义陷阱：cond.foeStatus 按 foe.status[键] 判（battle.resolution.js:61），「隐身」在敌侧的状态键名需先核实（见陷阱清单 T5） |
| tt7-goldencicada | 金蝉脱壳 | 武术 | onPlay[draw amount:3, handOps:{consumeHand:true}] | 并行M1(在途)（handOps 工作区已接线 battle.resolution.js:838；HEAD 守卫拦截 :809） | M | B-M2 | — |
| tt7-imitate | 不变应万变-改 | 武术 | hosted:imitate（手牌内常驻替换为上一张武术的 1 费复制） | 混合实现（宿主 imitateMap battle.core.js:115；常驻监听非 onPlay） | XL | B-M5 | 打出时以替身结算；手牌内动态变形无对应 trigger |
| tt7-marchrush | 急行军 | 武术 | onPlay[draw amountField:draw, armor amountField:armor, recast:{on:'lastHand',times:2}] | 规格新增:recast.on='lastHand'（同 cc-last-stand） | M | B-M2 | 与 cc-last-stand 同规格件，合并实现 |
| tt7-swordimmortal | 剑仙形态 | 武术 | onTurnStart[draw 1]（本局持续，打出时登记） | 规格/接线:onTurnStart 触发器 | L | B-M4 | 本局形态=打出后每回合生效 |
| tt7-throwblade | 飞刃偷袭 | 武术 | onPlay[damage amountField:dmg, curse bleed, draw amountField:draw] | 现有能力 | S | B-M1 | dmg:-3 负攻击词条（cards.view.js:84 支持负数） |
| tt8-dragonblade | 青龙偃月斩 | 武术 | onPlay[damage amountField:dmg, curse abreak, curse bleed] | 现有能力 | S | B-M1 | tt8-hero-warrior 衍生 token（cards.data.js:618）；双 curse 各一 op |

## 二、法术（48 张）

| id | 名称 | 类型 | 目标 rules 草案 | 依赖契约 | 复杂度 | 批次 | 备注 |
|---|---|---|---|---|---|---|---|
| cc-demon | 恶魔之力 | 法术 | onPlay[damage amountField:dmg dmgType:spell, heal amount:2 selfDamage:true] | 现有能力（2026-10-06 卡面 dmg 4→7，amountField 动态跟随，旧档 face-refresh 重刷） | S | B-M1 | selfDamage 键已有（HEAL_ALLOWED_KEYS schema:36） |
| cc-mana-surge | 法力奔涌 | 法术 | hosted:mana-surge（随机施放 4 个随机法术，默认已注能） | 混合实现（execute 域无「随机法术池」；注能默认化全场旗标） | XL | B-M5 | 与 allSpellsInfused 宿主旗标（battle.core.js:113）联动 |
| cc-poison-burst | 毒爆 | 法术 | onPlay[curse {burst:2}] | 现有能力 | S | B-M1 | burst 引爆已消费（battle.resolution.js:189-193），层数保留 |
| cc-rot-seed | 腐化之种 | 法术 | hosted:rot-seed（中毒 2 层 + 死亡时层数转移）onPlay[curse poison stacks:2] + onKill 转移 | 混合实现（宿主 poisonLegacy/transferPoisonLegacy battle.engine.js:171、battle.core.js:95） | XL | B-M4 | 敌人死亡钩子（onKill 系）+ 层数转移；宿主已实现，迁移=收编为 rules |
| cmtn1epgt20j | 灵能召唤 | 法术 | onPlay[acquire {n:1, pool:{kind:'注能'}, dest:'discover', act:'noInfuse'}] | 已接线：acquire.dest='discover' + act='noInfuse'，候选确认后仅所选实例免注能（M3 v5） | M | B-M2 | 「使其无需注能」=noInfuse；acquire.hand 已有同名词可对齐语义 |
| cmtn1lbhbqi4 | 充能火球 | 法术 | hosted:charge-fireball（onPlay[damage amount:4 dmgType:spell] + 手牌中每回合伤害+1） | 混合实现（宿主充能卡清单 battle.core.js:87） | XL | B-M4 | 手牌内成长是常驻回合钩子，非 onPlay |
| cmtn1p9vb5au | 千变万化 | 法术 | onPlay[discover {count:1, pool:{kind:'form'}, act:'play'}] | 规格新增:pool.kind='form'（形态卡池） | M | B-M2 | 形态=自然形态/剑仙形态/黑暗形态等场域卡的子集定义需规格 |
| cmtn1r10xnl1 | 黑暗形态 | 法术 | 规格新增 registerRule:{rule:'discoverPlus'}（本局每次发现可选项+1） | 规格/接线:registerRule（键位 schema:68 现三种，解释器 pending） | L | B-M4 | 本局全局规则；「增加可选项」作用于 discover 交互 |
| cmtn28jv33wx | 搜索大宝箱 | 法术 | onPlay[acquire {n:3, pool:random}] | 现有能力 | S | B-M1 | 与 tt2-treasuremap（寻宝图洗牌）和 ev19 生态联动 |
| tt12-breakthrough | 突破进展 | 法术 | onPlay[acquire n:1 pool{moves,cost:0}, acquire n:1 pool{moves,cost:1}, acquire n:1 pool{moves,cost:2}] | 现有能力 | S | B-M1 | acquire.pool{kind:'moves',cost} 现有（DISCOVER/acquire 池 schema:54） |
| tt12-chargeray | 充能射线 | 法术 | onPlay[damage amount:5 dmgType:spell, bonus amount:'perInfusedInHand×2'] | 规格新增:damage 动态源 perInfusedInHand | M | B-M2 | 「本牌在手牌中时每注能过 1 张」需手牌注能计数 |
| tt12-felguard | 邪能护体 | 法术 | onPlay[draw amountField:draw, blessing {key:'immune', duration:1}] | 现有能力 | S | B-M1 | 本回合临时免疫与深渊主宰永久免疫的文案差异宿主已有（battle.engine.js:1383-1388）；注能(2) 门由描述句承担（schema:661 不允许保留 infuse 字段） |
| tt12-freezeray | 冷冻射线 | 法术 | onPlay[damage amount:4 dmgType:spell, cond:{foeFullHp:true}, curse freeze] | 现有能力 | S | B-M1 | 语义陷阱：「未曾受到过伤害」用 foeFullHp 近似——被打后回满血的敌人会误判（陷阱 T2） |
| tt12-raydragon | 龙焰射线 | 法术 | onPlay[damage amount:11 dmgType:spell]（注能(1) 门在描述） | 现有能力 | S | B-M1 | 注能门=描述句+费用，不进 rules（schema:661） |
| tt12-sporewall | 孢子城墙 | 法术 | onPlay[curse poison stacks:2, armor amountField:armor] | 现有能力 | S | B-M1 | armor 字段=6 字面量/字段锚定均可 |
| tt3-firm-barrier | 坚冰结界 | 法术 | onPlay[curse {extend:1}, draw amountField:draw] | 现有能力 | S | B-M1 | extend「整体改走延长语义」已消费（battle.resolution.js:78） |
| tt3-flame-storm | 风暴火球 | 法术 | onPlay[damage amount:4 dmgType:spell target:allEnemies] | 现有能力 | S | B-M1 | 「每人一次火球」实作=4 点法伤全体；火球为衍生牌（tt3-fireball） |
| tt3-grope | 摸索 | 法术 | onPlay[draw {range:[2,3]}] | 规格新增:draw.range（damage 已有 range 键可复用形态，DRAW_ALLOWED_KEYS 无） | M | B-M2 | 随机 2-3 张 |
| tt3-holy-water | 治愈 | 法术 | onPlay[heal amountField:heal, cleanse target:self] | 并行M1(在途)（cleanse 工作区已接线） | M | B-M2 | — |
| tt3-magic-lamp | 神灯 | 法术 | 抉择 3 分支：discover act:play / execute{cap:'受伤非BOSS'} / curse freeze×2+armor 5 | 混合实现:抉择域（choiceQueue/pickChoice 宿主）+ execute pending | L | B-M4 | 「非 BOSS」条件需 execute 的 boss 排除语义 |
| tt3-nature-form | 自然形态 | 法术 | onPlay[energyCap n:1] | 现有能力 | S | B-M1 | 普通战固定 2 费（battle.lifecycle.js:261）与 BOSS 能量系统差异：energyCap 只在 BOSS 生效口径需备注 |
| tt3-petal | 花瓣法阵 | 法术 | 触发器 onTurnStart×3 回合[draw 1, heal 3] | 规格/接线:onTurnStart + 多回合 repeat | L | B-M4 | delayed 队列宿主（battle.core.js:63）可承载 |
| tt3-thunderblast | 雷殛 | 法术 | onPlay[damage amount:7 dmgType:spell, graveyard:{perSpell:1}] | 规格接线:damage.graveyard（capability 拒绝 capability.js:100-102） | M | B-M2 | 墓地计数：BOSS 战 grave 堆已有 |
| tt3-toxin | 毒药 | 法术 | onPlay[curse poison stacks:1, draw amountField:draw] | 现有能力 | S | B-M1 | — |
| tt5-galaxy-voyage | 银河之旅 | 法术 | m9 registerRule moveCost1（本场全部招式 1 费，招式=武术+法术；2026-10-06 改版） | 已迁移（m9 v2：marker 升版 + v1 旧版快照 previousRulesById 重放；文本路径双旗标同落） | XL | B-M5 | G8 typeCostRule 键位仍留白名单外，本卡走 REGISTER_RULE_KEYS moveCost1 |
| tt7-abysscurse | 深渊诅咒 | 法术 | onPlay[damage amount:7 dmgType:spell, curse healban, draw amount:'perCurseKindsOnFoe'] | 规格新增:draw 动态源 perCurseKinds（敌身上诅咒种类数） | M | B-M2 | 伤害与抽牌在同 op 组合时注意「damage+draw 不与 amountField 混排」契约（schema:649-651），用 v2 字面量 |
| tt7-arcanebolt | 奥术弹 | 法术 | onPlay[damage amountField:dmg dmgType:spell, draw amountField:draw] | 现有能力 | S | B-M1 | dmg:1、draw:1 字段锚定 |
| tt7-bladebloom | 永恒绽放 | 法术 | onPlay[discover {count:1, act:'play'} + acquire 2 dest:hand]（三张同组） | 规格新增:discover 组剩余卡转 acquire 的组合语义 | M | B-M2 | 「发现并直接施放 1 张，获取剩下两张」 |
| tt7-burnharvest | 爆燃火球 | 法术 | onPlay[damage amount:5 dmgType:spell, bonus {spellPowerMul:2}] | 规格新增:bonus 倍率型 spellPowerMul（现 bonus 为条件加值） | M | B-M2 | 「受法伤加成翻倍」 |
| tt7-elementstorm | 元素风暴 | 法术 | 规格新增 registerRule:{rule:'doubleNextSpell'}（下一张法术施放 2 次） | 规格/接线:registerRule（宿主 castOverrides/freeCast 相邻域 battle.core.js:280） | L | B-M4 | 「下一张」单次性规则，需消费后自清 |
| tt7-holyheal | 圣光治愈 | 法术 | onPlay[heal {perFuelCost:2}] | 现有能力 | S | B-M1 | perFuelCost 已消费（HEAD battle.resolution.js:797）；语义陷阱：「2 倍被注能卡价格」=2×value，需核对 perFuelCost 乘数即价格倍数（陷阱 T4） |
| tt7-livingwater | 圣光之源 | 法术 | onPlay[draw amountField:draw] | 现有能力 | S | B-M1 | draw:5 |
| tt7-maxsupply | 法力补给 | 法术 | onPlay[draw {untilHandN:4}] | 并行M1(在途)（untilHandN 工作区已接线 battle.resolution.js:839；HEAD 守卫拦截） | M | B-M2 | — |
| tt7-meteorstrong | 星陨之力 | 法术 | onPlay[execute {what:'火球', count:3}]（注能(2) 门在描述） | 规格/接线:execute（键位 schema:60，解释器 pending） | M | B-M2 | 火球=衍生牌引用 |
| tt7-provoke | 扰敌 | 法术 | 规格新增 op foeFight {targets:2}（迫使两敌相互攻击一次） | 规格新增:敌对敌攻击域 | L | B-M4 | 目标选择×2 + 敌方回合外交互 |
| tt7-recruit | 征召 | 法术 | onPlay[summon {name:'步兵', atk:4, hp:4, count:2, taunt:true}] | 规格/接线:summon（键位 schema:61，解释器 pending；随从位宿主 summonAlly battle.engine.js:904） | M | B-M2 | 数值直填，不引用排除卡 cmtn6ulm4boj；「为你抵挡伤害」=taunt 键位已有 |
| tt7-silence | 禁言术 | 法术 | onPlay[curse {curse:'silence', duration:1}, draw amountField:draw] | 现有能力 | S | B-M1 | 「1 名角色」实际选敌即可；curse target 集含 self（DAMAGE/CURSE_TARGET_KEYS schema:46）但 target side 只能单选（schema:675-692 交叉契约） |
| tt7-stratagem | 法师锦囊 | 法术 | hosted:pouch-container（1×3 置入法术，打出时选 1 张直接施放） | 混合实现（hub 容器 game.bag.js:361 pouchStore + 打出选取） | XL | B-M5 | 容器域（EQUIP_CONTAINER_KEYS）与战斗选取的跨域组合 |
| tt8-curse1 | 禁咒I | 法术 | 触发器 onDraw[execute:{what:'stealAtk 1'}]（抽到时施放） | 规格/接线:onDraw 触发器 + stealAtk | L | B-M4 | tt8-hero-warlock 衍生；「抽到时施放」=自动打出语义 |
| tt8-curse2 | 禁咒II | 法术 | 触发器 onDraw[curse freeze] | 规格/接线:onDraw 触发器 | L | B-M4 | 同上四张禁咒共享 onDraw 执行件 |
| tt8-curse3 | 禁咒III | 法术 | 触发器 onDraw[curse poison, curse bleed] | 规格/接线:onDraw 触发器 | L | B-M4 | — |
| tt8-curse4 | 禁咒IV | 法术 | 触发器 onDraw[curse silence duration:1] | 规格/接线:onDraw 触发器 | L | B-M4 | — |
| tt3sp-bloodstorm | 血蝠风暴 | 法术 | onPlay[damage amount:3 dmgType:spell target:allEnemies, lifesteal:true, recast:{times:2}]（注能(2) 门） | 现有能力 | S | B-M1 | lifesteal 已消费（HEAD battle.resolution.js:523）；recast 键放行，非 kill 条件的 recast 消费需验证（备注：若 recast 仅支持 on:'kill' 则降级 M） |
| tt3sp-devour | 吞噬 | 法术 | onPlay[execute {cap:4, count:1}] | 规格/接线:execute（cap=攻击力上限筛选） | M | B-M2 | 「小怪」=非 BOSS/精英，execute 需含 BOSS 排除语义 |
| tt3sp-flowerzhen | 花鸩 | 法术 | onPlay[curse {double:true, burst:1}] | 现有能力 | S | B-M1 | double（:167-170）与 burst（:189-193）均已消费，单 op 内顺序「翻倍→引爆」（:78） |
| tt3sp-magicoil | 药水魔法 | 法术 | onPlay[discover {count:1, pool:{kind:'potion'}, act:'play'}] | 规格新增:pool.kind='potion' | M | B-M2 | — |
| tt3sp-shadowshot | 暗影射击 | 法术 | onPlay[damage amount:3 dmgType:spell, cond:{anyCurse:true}, recast:{times:1}] | 规格新增:cond.anyCurse（foeStatus 需指名键，「处于诅咒状态」=任意诅咒） | M | B-M2 | — |
| tt3sp-silverthorn | 镭射 | 法术 | onPlay[damage amount:5 dmgType:spell, infuseBonus:{amount:3}] | 规格新增:注能加伤 infuseBonus（注能门费用在描述，注能后的加成需要新参数） | M | B-M2 | 与 tt12-raydragon 区分：后者注能只是费用门 |

## 三、装备（36 张）

| id | 名称 | 类型 | 目标 rules 草案 | 依赖契约 | 复杂度 | 批次 | 备注 |
|---|---|---|---|---|---|---|---|
| tt3-longsword | 长剑 | 装备 | equip.passive.aura {atk:1} | 规格/接线:装备域（EQUIP_AURA_KEYS atk schema:73，全域 pending） | M | B-M3 | 最简装备，B-M3 首卡试金石 |
| tt3-staff | 法杖 | 装备 | equip.passive.aura {spellPower:1} | 规格/接线:装备域 | M | B-M3 | 与长剑同批同构 |
| tt2-frostsword | 寒冰剑 | 装备 | equip.passive.cond {vsFreeze:true} aura {damage:2} | 规格/接线:装备域（EQUIP_COND_KEYS vsFreeze schema:74） | L | B-M3 | 「对冰冻角色伤害 +2」=伤害计算期条件 |
| tt3-deep-diary | 深海咒印 | 装备 | equip.passive.cond {hasCurse:true} aura {atk:2, spellPower:2} | 规格/接线:装备域（hasCurse schema:74） | L | B-M3 | — |
| tt3-deep-seal | 深海印记 | 装备 | equip.passive.cond {hasCurse:true} aura {atk:2, spellPower:2} | 规格/接线:装备域 | L | B-M3 | 与 deep-diary 效果全同（陷阱 T6）：同草案同测，建议规格里合并验收 |
| tt3-light-mail | 急速跑鞋 | 装备 | equip.skill {ops:[draw amount:3]}（每场一次口径待定） | 规格/接线:装备域（EQUIP_SKILL_KEYS oncePerBattle schema:75） | L | B-M3 | 「主动技能」统一走 skill 域 |
| tt3-holy-staff | 圣杖 | 装备 | equip.skill {ops:[cleanse self, heal 5]} | 规格/接线:装备域 + cleanse（并行M1 在途） | L | B-M3 | — |
| tt12-raygun | 射线枪 | 装备 | equip.skill {ops:[discover {pool:{kind:'ray'}, act:'play'}]} | 规格/接线:装备域 + pool.kind='ray'（射线系列） | L | B-M3 | 射线=tt12-*ray 系列子集，需规格成池 |
| tt2-treasuremap | 寻宝图 | 装备 | equip.skill {ops:[acquire {n:1, pool:named:'搜索大宝箱', dest:'deck'}, draw amountField:draw]} | 规格/接线:装备域 + pool.named（现有 pool 无指名） | L | B-M3 | 与 cmtn28jv33wx 联动 |
| tt3-crimson-pouch | 深红丝袋 | 装备 | equip.skill {ops:[handOps:{dup:'choose'}]} | 规格/接线:装备域 + 选择式复制交互 | L | B-M3 | — |
| tt3-fate-wheel | 命运钟表 | 装备 | equip.skill {ops:[draw handOps consumeHand, extraTurn]} | 规格/接线:extraTurn（键位 schema:64，解释器 pending；宿主 flag battle.core.js:91）+ handOps | L | B-M3 | 额外回合=跳过敌方阶段一次 |
| tt3eq-boiler | 魔法锅炉 | 装备 | equip.skill {ops:[acquire {n:3, pool:random}]}（注能(2) 门） | 规格/接线:装备域 | L | B-M3 | 注能门在描述 |
| tt2-wreck | 沉船宝盒 | 装备 | equip.onConsume [acquire {n:2, pool:random}] | 规格/接线:onConsume 触发器（TRIGGER_KEYS schema:11） | L | B-M3 | 「消耗该牌时」 |
| tt3-azure-sword | 百炼青虹剑 | 装备 | equip.onConsume [execute {what:'初始攻击', count:1}] | 规格/接线:onConsume + execute | L | B-M3 | — |
| tt3-sapper-bomb | 矿工炸药 | 装备 | equip.onConsume [damage amount:4 dmgType:fixed] | 规格/接线:onConsume 触发器 | L | B-M3 | 伤害目标（全体/指定）规格需定 |
| tt7-arcanescroll | 奥术残卷 | 装备 | equip.onConsume [draw amountField:draw]（draw:3） | 规格/接线:onConsume 触发器 | L | B-M3 | — |
| tt3-blooddrinker | 饮血剑 | 装备 | equip.onKill [blessing {key:'atkUp', stacks:1}]（本局累计） | 规格/接线:onKill 触发器（宿主 killAtkUp battle.core.js:93 迁移时收编删除） | L | B-M3 | 「本局对战内」跨回合持久 |
| tt3-chaos-eye | 混沌之眼 | 装备 | equip.battleStart [maxHp n:10, deckCap n:5] | 规格/接线:onBattleStart 触发器 + deckCap 的装备挂载点 | L | B-M3 | 语义陷阱：deckCap 现由 battle.lifecycle.js deckCapBonus() 读装备 desc 文本实现（battle.resolution.js HEAD:737-740 注释），迁 rules 后两读法必须二选一（陷阱 T3） |
| tt7-talisman | 灵符 | 装备 | equip.battleStart [draw amountField:draw]（draw:2） | 规格/接线:onBattleStart 触发器 | L | B-M3 | 「对战开始时装备持有即生效」（battle.lifecycle.js:252 注释） |
| tt3-immortal-blade | 骷髅王剑 | 装备 | equip.battleStart [transform {what:'初始攻击', into:'不朽斩', cost:1, keepInHand:false}] | 规格/接线:transform（键位 schema:62，解释器 pending；killTransform 宿主 battle.core.js:75） | L | B-M3 | 「所有初始攻击化为 1 张」——数量语义（合并为 1 张）规格需明确 |
| tt3-grass-armor | 草甲 | 装备 | equip.onEquip [armor amountField:armor]（armor:5） | 规格/接线:onEquip 触发器 | L | B-M3 | 装备时一次性 |
| tt3-master-staff | 大法师之杖 | 装备 | equip.onTurnStart [blessing {key:'spellUp', stacks:1}]（回合开始叠加） | 规格/接线:装备侧 onTurnStart | L | B-M3 | 「回合开始时法伤 +1」=永久叠加口径需规格（叠层 vs 临时） |
| tt3-silver-runesword | 诅咒之剑 | 装备 | equip.passive.aura {atk:2} + equip.onTurnStart [selfDamage 2] | 规格/接线:装备域 + onTurnStart | L | B-M3 | 双段组合 |
| tt3-wolf-bow | 天狼长弓 | 装备 | equip.onTurnStart [acquire {n:1, pool:{kind:'arrow'}, dest:'deck', act:'zeroCost'}] | 规格/接线:装备域 + pool.kind='arrow'（acquire.deck.act zeroCost 键现有 capability.js:23） | L | B-M3 | 「箭矢」系列成池 |
| tt3-reverse-bow | 连弩 | 装备 | equip.skill {ops:[executeHand type:'箭', perPlay draw 1]} | 混合实现:手牌系列批量释放（name 正则宿主 battle.engine.js:271） | L | B-M3 | 「所有‘箭’」按名称正则识别是现有宿主口径，规格化需成池 |
| tt3-twinwater-mail | 冰甲 | 装备 | equip.passive.cond {onFreezeDealt:true} onEquipArmor 3 | 规格新增:装备条件被动 onFreezeDealt（一次性触发型） | L | B-M3 | 「冰冻 1 名敌人后 +3 甲」=事件型被动 |
| tt3-element-seal | 元素符印 | 装备 | hosted:element-seal（本局累计注能 3 张后解锁 blessing spellUp 2 + draw 2） | 混合实现（宿主 infuseFuels/sealUnlocked battle.core.js:89-90） | XL | B-M3 | 进度型解锁；解锁后效果可用现有 blessing/draw 表达 |
| tt2-venomstaff | 毒杖 | 装备 | hosted:venom-staff（onSpell trigger：每打出 1 张法术→随机敌中毒） | 混合实现（宿主 poisonOnSpell battle.core.js:94；onSpell 非 onPlay 白名单） | XL | B-M3 | 迁移=把宿主旗标改读 rules（规格新增 onSpell 触发器），或保留宿主只迁开关 |
| tt3eq-mistbox | 迷之匣 | 装备 | hosted:cost-swap（发现两张随机招式并交换其费用） | 混合实现（无现有 op；卡对绑定费用交换） | XL | B-M3 | 交换是持久变异，回写卡面 cost 的口径需规格 |
| tt7-darkfort | 黑暗吊坠 | 装备 | hosted:dark-fort（免疫 1 次致命伤害 + 该回合无敌） | 混合实现（宿主 deathSave battle.core.js:92） | XL | B-M3 | 两段（充能消耗+当回合无敌）与 blessing immune 语义交叉 |
| tt7-naturestaff | 自然法杖 | 装备 | hosted:nature-staff（选择 1 张卡下回合 0 费） | 混合实现（宿主 zeroCostMap battle.core.js:114） | XL | B-M3 | 「下回合」时效=回合数映射 |
| tt2-apollo | 阿猫的礼物 | 装备 | 触发器 onAcquire[energy 1 + acquire 1]（发现或随机获取该牌时） | 规格新增:onAcquire 触发器（宿主 fireCatGift 已有调用点 battle.bag.js:91） | L | B-M4 | 获取时机触发，不在战斗流程内 |
| tt2-pearlbox | 珍珠盒 | 装备 | hosted:pearl-container（equip.container {slots:9, accepts:'资源'}） | 混合实现（容器键位 schema:76；hub 侧 game.bag.js:360 pearlStore） | XL | B-M6 | 跨 hub 背包/战斗两域的容器；装备域落地前保持宿主 |
| tt8-archdemon | 天启诛魔剑 | 装备 | equip.onEquip [blessing atkUp 1, acquire {n:3, pool:named:'重斩'}] | 规格/接线:装备域 + pool.named | L | B-M3 | 「重斩」不在 201 清单（衍生 token），池引用需规格兜底 |
| tt8-demonslay | 诛魔剑 | 装备 | hosted:ranger-chain（onDraw 全体攻击 + 天启诛魔剑覆盖所有武器） | 混合实现（onDraw 触发器 + 武器覆盖 transform，与 tt8-heavensword/tt8-hero-ranger 成链） | XL | B-M5 | 侠客英雄链核心件，链内三卡同批迁移 |
| tt8-heavensword | 天启剑 | 装备 | hosted:ranger-chain（onDraw 额外抽 1 + 集齐双剑后续效果） | 混合实现（同上链） | XL | B-M5 | 语义陷阱：desc 以「……」截断（cards.data.js:617），后半效果无文本，迁移前必须找设计者口径补全（陷阱 T1） |

## 四、能力卡（12 张，全部 B-M5）

| id | 名称 | 类型 | 目标 rules 草案 | 依赖契约 | 复杂度 | 批次 | 备注 |
|---|---|---|---|---|---|---|---|
| tt8-abyss-sovereign | 深渊主宰·妲莉薇特 | 能力卡 | hosted:sovereign（onPlay：draw untilHandN 6 + playerCurseImmune + energyCap 1 + spellUp 1 + allSpellsInfused + summon 封印肢体×4） | 混合实现（宿主旗标 battle.core.js:112-113；肢体召唤 effect-verbs.js:135；draw untilHandN 并行M1） | XL | B-M5 | 封印链终点；旧日再临六段效果一次打出引爆 |
| tt8-hero-assassin | 白梅落影·妄 | 能力卡 | onPlay[cleanse self, blessing {key:'stealth', duration:2}] + 规格新增 stealthAmp（破隐一击伤害翻倍） | 混合实现（潜行/破隐宿主与 blessing stealth 键交叉） | XL | B-M5 | 破隐倍率是全局旗标型 |
| tt8-hero-descender | 充能火山 | 能力卡 | hosted:consume-fireball（onPlay[blessing spellUp 1] + registerRule {rule:'consumeFireball'}） | 混合实现（registerRule consumeFireball 键位 schema:68 已设计、解释器 pending；宿主注释 battle.core.js:76） | XL | B-M5 | 「每消耗 1 张卡牌施放 1 次火球」=消耗钩子规则 |
| tt8-hero-guardian | 圣剑化身 | 能力卡 | onPlay[energyCap n:1] + 规格新增 equipCap 1（装备上限+1） | 规格新增:equipCap（装备上限域） | L | B-M5 | energyCap 现有 |
| tt8-hero-mage | 博览者的狂语 | 能力卡 | onPlay[blessing {key:'spellUp', stacks:1}] + onTurnStart[discover 1]（本局） | 规格/接线:onTurnStart 触发器 | L | B-M5 | — |
| tt8-hero-priest | 浪掷风吟 | 能力卡 | onPlay[draw {untilHandN:6}, heal {perSpellHeal:3}] | 规格接线:untilHandN（并行M1 在途）+ perSpellHeal 键消费（schema:23 已有键位） | L | B-M5 | 语义陷阱：「置入」≠抽牌（置入不进消耗堆、无抽牌动画），untilHandN 直拟需备注差异（陷阱 T7） |
| tt8-hero-ranger | 天剑诛魔·云阳 | 能力卡 | onPlay[acquire {n:2, pool:named:'天启剑+诛魔剑', dest:'deck'}] | 规格新增:pool.named（指名多卡） | M | B-M5 | 与 demonslay/heavensword 链联动 |
| tt8-hero-sealer | 受缚之残影 | 能力卡 | hosted:seal-chain + battle.requirements[{kind:'unplayable'}] | 混合实现（宿主全链 battle.engine.js:1315-1377；unplayable requirement 现有 schema:835） | XL | B-M5 | 普通战不可用（battle.lifecycle.js:253-261）；封印肢体为排除卡，链保持宿主 |
| tt8-hero-summoner | 花开两面 | 能力卡 | hosted:gate-choices（抉择开启两门之一，2 回合后开启另一扇） | 混合实现（抉择域 + summon 排除卡 cmtn79743r2n/cmtn7err0a7 + delayed 双段） | XL | B-M5 | 与两扇门排除卡强耦合，效果保持宿主 |
| tt8-hero-sword | 无量仙剑·云风 | 能力卡 | onPlay[draw amountField:draw, handOps:{executeMoves:true}]（抽 5 直接释放其中武术） | 规格接线:handOps（并行M1 在途）+ executeMoves 新键 | L | B-M5 | 宿主 lastDrawUid 概念已有（battle.core.js:77） |
| tt8-hero-warlock | 禁术解放 | 能力卡 | onPlay[acquire {n:4, pool:named:'禁咒I-IV', dest:'deck'}, draw amountField:draw]（draw:2） | 规格新增:pool.named | M | B-M5 | 与 tt8-curse1-4（B-M4）跨批联动：先迁禁咒本体再迁洗入 |
| tt8-hero-warrior | 青龙化身 | 能力卡 | hosted:kill-transform（本局打出「初始攻击」时化为 tt8-dragonblade） | 混合实现（transform 键位 schema:62 已设计；宿主 killTransform battle.core.js:75） | XL | B-M5 | 与 starter-attack 识别（B-M1）联动：初始攻击迁移后识别方式要稳 |

## 五、道具（16 张，全部 B-M6）

bag 结构化消费器现状（实读）：`game/src/hub/game.bag.js:26` useStructuredBagRule 支持 `bag.use` 的 **heal（:31，amountField:'heal'）与 restoreConsumed（:45）两 op**（不止 heal）；无 bag 规则的道具回退 id/文本识别分支（:134-175 觉醒/传说/药水等），再不行落「效果将在战斗中实装」兜底。战斗内道具：`game/src/battle/battle.bag.js:44` useItem 正则文本路径（回复 ：50 / 能源结晶 ：51 / 神秘药水 ：52 / 口粮木材 ：53-54），其余走 ：57 useBattleEffectItem → applyTextEffects（:134-135）。

| id | 名称 | 类型 | 目标 rules 草案 | 依赖契约 | 复杂度 | 批次 | 备注 |
|---|---|---|---|---|---|---|---|
| tt3-blue-potion | 恢复药水 | 道具 | bag.use[{op:'heal', amountField:'heal'}, {op:'energy', n:1}] | 规格新增:bag.use energy op（现有仅 heal/restoreConsumed） | M | B-M6 | battle 侧 healM 正则（battle.bag.js:50）先于 bag 规则命中，迁移需两域同步 |
| tt3-demon-potion | 法力药水 | 道具 | bag.use[{op:'blessing', key:'spellUp', stacks:2, duration:1}]（敌方目标无需选择） | 规格新增:bag.use blessing | M | B-M6 | 「持续 1 回合」时效在战斗域 |
| tt3-houyi-potion | 狂暴药水 | 道具 | bag.use[{op:'blessing', key:'atkUp', stacks:2, duration:1}] | 规格新增:bag.use blessing | M | B-M6 | 与 demon-potion 同构同测 |
| tt3-iceheart-potion | 冰冻药水 | 道具 | bag.use[{op:'curse', curse:'freeze', duration:1}]（敌方目标） | 规格新增:bag.use curse + 敌方指向（itemTargetSideFor 宿主已有） | M | B-M6 | 拖拽/点选敌人为目标（battle.bag.js:102-111） |
| tt3-mind-potion | 精神药水 | 道具 | bag.use[{op:'draw', amountField:'draw'}]（draw:2，仅战斗域生效） | 规格新增:bag.use draw | M | B-M6 | 地图侧抽牌无意义，bag 规则需 battle-only 作用域标记 |
| tt3-mixed-potion | 流血药水 | 道具 | bag.use[{op:'damage', amount:2, dmgType:'fixed'}, {op:'curse', curse:'bleed'}]（敌方目标） | 规格新增:bag.use damage/curse | M | B-M6 | — |
| tt3-python-potion | 火焰药水 | 道具 | bag.use[{op:'damage', amount:2, dmgType:'spell', target:'allEnemies'}] | 规格新增:bag.use damage | M | B-M6 | — |
| tt3-turnabout-potion | 剧毒药水 | 道具 | bag.use[{op:'curse', curse:'poison', stacks:1, target:'allEnemies'}] | 规格新增:bag.use curse | M | B-M6 | — |
| tt3sp-doom | TNT | 道具 | bag.use[{op:'execute', cap:5, count:2}] | 规格/接线:execute + bag.use | M | B-M6 | 与 tt3sp-devour 同 cap 语义（含 BOSS 排除） |
| cmtmvq6ss84l | 员工通行证A（直授版） | 道具 | bag.use[{op:'acquire', pool:{kind:'classAbility'}}] | 规格新增:bag.use acquire + classAbility 池（hosted 觉醒分支 game.bag.js:148-151 收编） | M | B-M6 | 语义陷阱：与 tt-token-color 同名「员工通行证A」两个 id（陷阱 T8），迁移时别合并 |
| tt-token-color | 员工通行证A（合成体） | 道具 | bag.use[{op:'acquire', pool:{kind:'classAbility'}}] + 合成链保持宿主 | 混合实现（觉醒 game.bag.js:148-151；两路合成 ：342-364；碎片计数 game.fragments） | M | B-M6 | 合成 UI/碎片协议保持宿主，仅「使用→获得能力卡」规则化 |
| tt-token-gold | 员工通行证B | 道具 | bag.use[{op:'acquire', pool:{kind:'legendary'}}] | 规格新增:bag.use acquire legendary 池（hosted game.bag.js:134-144 收编） | M | B-M6 | 棱彩排除由 isRandomObtainable 保证；3×B→A 合成在 tt-token-color 侧 |
| tt4-shine-token | 员工通行证C | 道具 | bag.use[{op:'discover', count:1, pool:{kind:'legendary'}}] | 规格新增:bag.use discover（hosted game.bag.js:159+ 收编） | M | B-M6 | 「发现」≠直接获得：discover 交互域 |
| tt4-smoke-bomb | 烟雾弹 | 道具 | bag.use[{op:'flee'}] + requirements BOSS 禁用 | 规格新增:bag.use flee；BOSS 禁用现由 ITEM_BOSS_FLEE_PATTERN 正则挡（battle.bag.js:36,40），迁移后改读 rules | M | B-M6 | 普通战限定（ BOSS 差异） |
| tt-medneedle | 急救合剂 | 道具 | bag.use[{op:'delayedHeal', amount:6, turns:3}]（回合开始回 6，持续 3 回合） | 规格新增:bag.use delayed + 回合钩子 | L | B-M6 | 语义陷阱：全库仅 cards.sync.js:647 注册引用，**未找到实际效果消费入口（未核实/疑似未实装）**——迁移前先确认设计者口径（陷阱 T9） |
| tt3-mystery-potion | 神秘药水 | 道具 | hosted:mystery-potion（三分之随机：回 8/得 3 币/随机获卡）+ 回合开始随机变形 0 费段 | 混合实现（battle.bag.js:52,76-93 三分随机；game.bag.js:175 地图侧） | XL | B-M6 | 变形段（回合开始变随机招式 0 费）与三分随机是两个宿主，规则化先做三分随机段 |

## 六、统计与自校验

### 批次张数

| 批次 | 张数 | 构成 |
|---|---|---|
| B-M1 现集 | 30 | 武术 12 + 法术 18（全 S） |
| B-M2 onPlay 扩展 | 34 | 武术 18 + 法术 16 |
| B-M3 装备与trigger | 32 | 装备 32 |
| B-M4 延迟持续形态 | 19 | 武术 7 + 法术 11 + 装备 1（tt2-apollo） |
| B-M5 大招与大机制 | 18 | 武术 1 + 法术 3 + 装备 2 + 能力卡 12（全部） |
| B-M6 bag道具 | 17 | 道具 16（全部）+ 装备 1（tt2-pearlbox） |
| **合计** | **150** | 与排除清单 51 张合计 201 ✓ |

### 复杂度分布

| 级别 | 张数 |
|---|---|
| S 纯数据 | 30 |
| M 需新 op/参数 | 55 |
| L 需新 trigger/lifecycle | 44 |
| XL 混合实现或大机制 | 21 |

### XL 清单（21 张）

武术（1）：tt7-imitate
法术（5）：cc-mana-surge、cc-rot-seed、cmtn1lbhbqi4、tt5-galaxy-voyage、tt7-stratagem
装备（8）：tt2-pearlbox、tt2-venomstaff、tt3-element-seal、tt3eq-mistbox、tt7-darkfort、tt7-naturestaff、tt8-demonslay、tt8-heavensword
能力卡（6）：tt8-abyss-sovereign、tt8-hero-assassin、tt8-hero-descender、tt8-hero-sealer、tt8-hero-summoner、tt8-hero-warrior
道具（1）：tt3-mystery-potion

### 语义陷阱 Top（迁移前必须核对）

1. **T1｜tt8-heavensword 描述截断**：desc 以「在你抽到天启剑与诛魔剑后……」结尾，后半效果无文本。迁移前必须拿设计者口径，禁止按推测补效果。
2. **T2｜tt12-freezeray 条件近似**：「若此前其未曾受到过伤害」用 cond.foeFullHp 表达会把「被打后回满血」误判为未受伤；接受近似或规格新增 foeUntouched 需拍板。
3. **T3｜tt3-chaos-eye deckCap 双读法**：牌库上限加成现由 deckCapBonus() 读迎战装备 **desc 文本**（battle.lifecycle.js，battle.resolution.js:737-740 注释指路），非 rules；迁 rules 后旧文本读法必须移除，否则双计/漏计。
4. **T4｜tt7-holyheal 乘数口径**：「2 倍于被注能卡牌价格」要求 perFuelCost 乘数 = 价格倍数（value 字段）；实现读的是燃料费还是价格需对齐，差一个口径就错结算。
5. **T5｜tt7-ghostblade 隐身键名**：cond.foeStatus 按 foe.status[键] 直查（battle.resolution.js:61）；「破除隐身」在敌侧的状态键名（stealth？）未在战斗敌侧状态中核实，写错即条件永假。
6. **T6｜tt3-deep-diary 与 tt3-deep-seal 效果全同**：不同 id 同效果（诅咒状态攻+2 法伤+2），建议同草案、同验收用例，防止两份实现漂移。
7. **T7｜tt8-hero-priest 置入 vs 抽牌**：「置入随机卡牌直至手牌 6 张」的置入不等于抽牌（来源、动画、消耗堆交互不同）；untilHandN 直拟会带抽牌副作用。
8. **T8｜双「员工通行证A」**：cmtmvq6ss84l（直授版）与 tt-token-color（碎片合成体）同名不同 id、不同获取链；规则化 acquire 池时不可合并 id。
9. **T9｜tt-medneedle 疑似无宿主**：全库仅 cards.sync.js:647 注册引用，未找到效果消费入口（未核实）；迁移前先确认它是死卡还是漏实装。
10. **T10｜初始攻击识别链**：starter-attack 被 isStarterAttack、SHA 编组注入、killTransform、骷髅王剑等多处按 id/卡名特判（battle.lifecycle.js:296-297、battle.core.js:75）；其 rules 迁移或改名都会震荡全链，建议 B-M1 末位 + 专项回归。
11. **T11｜注能门不进 rules**：schema 禁止 onPlay 保留 card.infuse 字段（card-rules.schema.js:661），注能(2) 之类费用门一律留在描述句；矩阵中 tt12-felguard/tt3eq-boiler 等草案已按此口径。
12. **T12｜capability 落后于工作区解释器**：HEAD capability 拒绝 cleanse/untilHandN/handOps/graveyard/schedule，而工作区并行 M1 已接线前三者；批次派工验收必须声明以 HEAD 还是以合入后的 M1 为准，否则「现有能力」口径漂移（本矩阵按 HEAD 标注「并行M1(在途)」）。

### 覆盖自校验

- 本矩阵 150 张 = 武术 38 + 法术 48 + 装备 36 + 能力卡 12 + 道具 16（类型统计与 legacy-201-scratch.json 的非排除子集一致）。
- 与 `docs/M-BATCH-EXCLUSIONS.md` 51 张按 id 求并 = 201，与 legacy-201-scratch.json 全量逐 id 相等、无重复、无遗漏（校验脚本输出见交付报告）。

## 七、2026-09-29 m3-m6 甄别（Friday · HEAD `47001e3`）

> 09-29 在 HEAD `47001e3` 的复核结果：B-M3~M6 共 86 张由此前批次接线；m4~m11 数据批随 `791b2c2` 落库，ensure 链当时包含 m1~m11。该轮记录为 0 张新增接线、0 张待拍板和 0 张已发现的玩家行为缺口。头部属于 `a8e91e6` 快照，本节属于后续复核；行内原批次标记保留，当前支持范围仍按源码与对应测试核对。

### 甄别方法（一切以源码为准）

`cards.js` ensure 链实读（m1~m11 全部 import+调用）→ 86 张逐卡定位回填载体 → `tests/m-batch-production.test.js` 生产闸门实测：150/150 目标卡有 rules、legacy 恰为 51 张排除卡、272 张逐卡过 schema+capability 双门（missing=[]）。

### A 类（可安全接线＝已接线落库，86/86）

**B-M3 装备 32 张**

| 载体 | 形态 | 卡 |
|---|---|---|
| m4 结构化 equip | passive.cond+aura | tt3-deep-diary 深海咒印、tt3-deep-seal 深海印记（T6 同草案同批） |
| m7 结构化 equip/trigger | 14 张 | tt3-longsword 长剑、tt3-staff 法杖、tt3-light-mail 急速跑鞋、tt3-holy-staff 圣杖、tt12-raygun 射线枪、tt2-treasuremap 寻宝图、tt2-wreck 沉船宝盒、tt3-blooddrinker 饮血剑、tt3-grass-armor 草甲、tt3-master-staff 大法师之杖、tt3-twinwater-mail 冰甲、tt7-arcanescroll 奥术残卷、tt7-talisman 灵符、tt8-archdemon 天启诛魔剑 |
| m9 hosted | 5 张 | tt3-element-seal=element-seal、tt2-venomstaff=venom-staff、tt3eq-mistbox=cost-swap、tt7-darkfort=dark-fort、tt7-naturestaff=nature-staff |
| m10 hosted | 11 张 | tt2-frostsword=frost-sword、tt3-crimson-pouch=crimson-pouch、tt3-fate-wheel=fate-wheel、tt3eq-boiler=boiler、tt3-azure-sword=azure-sword、tt3-chaos-eye=chaos-eye、tt3-immortal-blade=immortal-blade、tt3-sapper-bomb=sapper-bomb、tt3-silver-runesword=silver-runesword、tt3-wolf-bow=wolf-bow、tt3-reverse-bow=reverse-bow |

**B-M4 延迟持续 19 张**

| 载体 | 形态 | 卡 |
|---|---|---|
| m5 结构化 delayed/onDraw | 6 张 | tt3-noon-duel 正午决战、tt3-wave-slash 破浪斩、tt8-curse1~4 禁咒 I-IV |
| m8 结构化 triggers/registerRule | 5 张 | cmtn2jc142dj 刀剑形态、cmtn1r10xnl1 黑暗形态（discoverPlus）、tt3-petal 花瓣法阵（老板裁决 heal:2 定版）、tt7-elementstorm 元素风暴（doubleNextSpell）、tt7-swordimmortal 剑仙形态 |
| m7 结构化 onAcquire | 1 张 | tt2-apollo 阿猫的礼物 |
| m11 hosted | 5 张 | cmtn1wnhhym=temporary-hand-cards、cmtn233trmeg=keep-self-in-hand、tt3-frostfall=choose-and-cast-melee、tt3-magic-lamp=three-choice-lamp、tt7-provoke=foe-fight-select |
| m9 hosted | 2 张 | cc-rot-seed=rot-seed、cmtn1lbhbqi4=charge-fireball |

**B-M5 大招 18 张**

| 载体 | 形态 | 卡 |
|---|---|---|
| m9 结构化 registerRule | 1 张 | tt5-galaxy-voyage 银河之旅（registerRule moveCost1；2026-10-06 招式改版 marker v2 + v1 快照重放） |
| m9 hosted | 17 张 | tt7-imitate=imitate、cc-mana-surge=mana-surge、tt7-stratagem=pouch-container、tt8-demonslay=ranger-chain、tt8-heavensword=ranger-chain、tt8-abyss-sovereign=sovereign、tt8-hero-assassin=assassin、tt8-hero-descender=consume-fireball、tt8-hero-guardian=guardian、tt8-hero-mage=mage、tt8-hero-priest=priest、tt8-hero-ranger=ranger、tt8-hero-sealer=seal-chain、tt8-hero-summoner=gate-choices、tt8-hero-sword=sword、tt8-hero-warlock=warlock、tt8-hero-warrior=kill-transform |

**B-M6 bag 道具 17 张**

| 载体 | 形态 | 卡 |
|---|---|---|
| m6 结构化 bag.use | 13 张 | tt3-blue-potion、tt3-demon-potion、tt3-houyi-potion、tt3-iceheart-potion、tt3-mind-potion、tt3-mixed-potion、tt3-python-potion、tt3-turnabout-potion、tt3sp-doom TNT、cmtmvq6ss84l 员工通行证A（直授）、tt-token-gold 员工通行证B、tt4-shine-token 员工通行证C、tt4-smoke-bomb 烟雾弹 |
| m9 hosted | 2 张 | tt2-pearlbox=pearl-container、tt3-mystery-potion=mystery-potion |
| m11 hosted | 2 张 | tt-token-color=class-ability-acquire、tt-medneedle=delayed-heal-item |

### B 类（需老板拍板）

**无。** 原 5 项设计裁决（`docs/cards/M-BATCH-DECISIONS-2026-09-27.md`）逐条对照实现，均已落库：

| # | 卡 | 裁决 | 实现证据（2026-09-29 实读） |
|---|---|---|---|
| 1 | tt8-heavensword 天启剑 | 按现状保持，截断不实装 | m9 ranger-chain hosted；m-batch-behavior 绿 |
| 2 | tt8-demonslay 诛魔剑 | 覆盖武器留白不实装 | 同上 ranger-chain 链 |
| 3 | tt3-element-seal 元素符印 | 改持续监听 | `battle.engine.js:953` 每次注能检查 `infuseFuels>=3 && !sealUnlocked` |
| 4 | tt3-mystery-potion 神秘药水 | 回合开始变形为设计意图 | effect-steps `summon.morphRandom`（回合开始变 0 费）+ m9 hosted 三分随机段 |
| 5 | tt7-imitate 不变应万变-改 | 持续重变形 | `battle.engine.js applyImitate` 每打出一张武术即重变形；m-batch-behavior「imitate follows each newly played martial card」绿 |

### C 类（本轮不动）

**行为缺口：无。** 登记在案的「结构化纯化尾巴」（契约规格 ⏸ 项，宿主/hosted 路线已等价覆盖玩家行为，且纯结构化键位未在契约规格定版——按「没有规格不许自造键位」不动，留后续批）：`pick:'new'` 点选编排（tt7-bloodpoison，B-M2）、`acquire.untilHandN`（tt8-hero-priest 现走 hosted priest）、hand/deck 直发 play 通道、`onPlayCardFilter`、`deckCapBonus` desc 兜底移除（现为 rules 优先+desc 兜底，`battle.lifecycle.js:176-189`）、bag.use `escape/transform` 键位提案。

### 陷阱清单 T1-T12 复核（2026-09-29）

T1 已裁已落（DECISIONS #1）；T2 范围外（B-M1，m11 hosted untouched-target-freeze 按近似落库）；T3 已收编（deckCapBonus rules 优先、desc 仅无 rules 卡兜底）；T4/T5 范围外（B-M1，m11 hosted 承载）；T6 同批同草案（m4）；T7 hosted priest 承载；T8 双「员工通行证A」未合并（cmtmvq6ss84l=m6、tt-token-color=m11 分线接线）；T9 已消除（medneedle=m11 delayed-heal-item 落地，非死卡）；T10 范围外（B-M1 starter-attack 已迁，识别链回归在 m1/m-batch 测试内）；T11 口径维持（注能门不进 rules）；T12 已消除（capability 双门 272/272 过）。

### 等价验证（2026-09-29 定向）

22 文件：m1/m2/m3-contract、m1~m11-data、m7-battle、m-batch-production、m-batch-behavior、card-rules-schema、e6-card-rules-execution、structured-onplay-battle、a3-battle-rules、battle-resolution = **536 通过 / 1 skip（既有）/ 0 失败**。交接时记录的 4 条「预期红」（m5-data 3 + schema bag-mixed 1）已在落库前翻转，现为绿。
