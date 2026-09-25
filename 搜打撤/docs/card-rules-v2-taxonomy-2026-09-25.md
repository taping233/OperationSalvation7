<!-- 由 A1 波只读盘点生成（2026-09-25）；数据源：node 实测播种管线（cards.data.js + cards-sync.json，272 张）。 -->
# 卡牌规则 schema v2 设计地基 —— 效果语义盘点（2026-09-25）

> 定位：为「卡牌规则化战役」A1 波 schema v2 设计提供实测地基。全文数字均由脚本实测（播种管线模拟 + 逐卡归组），非拍脑袋。
> 口径：**现役卡池** = 空库冷启动按 `cards.js ensureTabletop()` 顺序播种（TT1–TT8→TT9 图鉴→TT10 同步→CC 整合→TT11 同步→cards-sync live→EVENTS_0919→TT12）+ 各 `ensure*Rules` 规则回填后的库面（272 张）。cards-sync.json 只是同步/退役层，真源按批内联定义。
> `battle.layers.js` 正被另一代理在途修改：本文涉及它的结论仅 1 处（cc-cursed-blade），已标注「在途」。

## 0. 总量与结构（实测）

- 现役卡池总数：**272**。类型分布：武术 64 / 法术 79 / 装备 36 / 生物 25（图鉴）/ 道具 22 / 事件 19 / 资源 15 / 能力卡 12。
- 稀有度分布：稀有 55 / 职业 55 / 衍生 53 / 古朴 54 / 史诗 32 / 传说 12 / 棱彩 10 / 初始 1。
- 走结构化 `card.rules`（v1）：**21 张**（tt 系材料 8：keys/wood/rations 系；bag.use 3：能源结晶/复原药水/斗神酒；battle onPlay 10：包扎/坚守/偷袭/快意恩仇/流星箭雨/冰封千里/高端研发/屏障修复/违禁烟火/后备能源）。
- 可打出招式（武术+法术）：143 张，全部效果语义见 §2 分类表。
- 双重实现现状：v1 结构化路径（`battle.resolution.js` 结构化 onPlay 分支）与 desc 文本路径（`effect-steps.*.js` 有序步骤表 + `battle.resolution.js` 正则段）**并存**，同一效果语义在两处各有解释器；非结构化卡 251 张全部走文本路径。

## 1. v1 已有能力（复核基线）

| 域 | v1 键位 | 运行时消费点 |
|---|---|---|
| 目标声明 | `rules.battle.target {side, area}` | `battle.rules.js targetSideFor / isAreaEffect` |
| 出牌前置 | `rules.battle.requirements`（unplayable / deckOnly / handCards{count,type}） | `battle.rules.js unplayableReasonFor`、`battle.exec-play.js queueCardExecution`（手牌支付） |
| 费用修正 | `rules.battle.costModifiers`（previousCardTypeFree / martialPlayedDiscount / armorZeroFree / consumedSpellDiscount） | `battle.card-cost.js calculateEffectiveCardCost` |
| 出牌操作 | `rules.triggers.onPlay[]`：damage{amountField,target,hitCount,retarget} / armor / heal / draw / status:freeze{target:allEnemies,duration} / discover{count,pool{kind:'moves',cost},costDecayPerTurn} | `battle.resolution.js resolveCardSteps`（结构化分支） |
| 基地材料 | `rules.base.material {kind: wood\|rations\|keys, amount}` | `src/hub/base.js`（材料入库） |
| 背包使用 | `rules.bag.use[]`：heal{amountField} / restoreConsumed{amount} | `battle.bag.js restoreConsumed / useItem` |

v1 硬约束（v2 设计必须正视）：onPlay 各 op 用 `amountField` 锚定卡面数值字段；damage 只允许 武术/法术 四类 dmgType；heal/armor/draw 只能 self、不能与 damage 混排、op 不得重复；status 只支持 freeze+allEnemies；discover 池只支持 moves×cost。

## 2. 操作分类表（18 族，按频次排序）

| # | 操作族 | 频次 | 代表卡 | v1 能否承载 | v2 键位草案 |
|---|---|---|---|---|---|
| 1 | 伤害直结（攻/法/固定/真实、区间、条件增伤） | **33** | 射击/火球/重斩/斩杀/不稳定射线/龙焰射线 | 部分（damage op 只有 单体/全体×dmg，无区间/条件/随机目标） | ``onPlay: {op:'damage', dmgType, amount|range:[a,b], target: chosenEnemy|allEnemies|randomEnemy, cond?: {foeHpBelow, foeHpHalf, foeStatus, foeFullHp}, bonus?: {...}}`` |
| 2 | 卡牌获取与牌库（发现/随机获取/洗入/置入手牌） | **25** | 生命箭/寻宝/铁甲阵/三重火球/基础开发 | 极弱（discover 仅 moves×cost 单池） | ``{op:'acquire', n, pool:{kind:'any'|'moves'|'type:X'|'named:Y'|'class:cls'|'cost:N', filter}, dest:'hand'|'deck'|'discover', act?:'play'|'playKeep'|'dup'|'zeroCost'|'decay'}`` |
| 3 | 诅咒族（流血/中毒/冰冻/沉默/破甲/禁疗/灼烧/随机诅咒/毒爆） | **23** | 血箭/毒箭/冰封千里/致命射线/花鸩/深渊诅咒 | 极弱（仅 freeze+allEnemies） | ``{op:'curse', curse:'bleed'|'poison'|'burn'|'freeze'|'silence'|'abreak'|'healban', stacks|randomKinds, target, duration?, mult?:'double', burst?:n, extend?:n}`` |
| 4 | 多段与重复（hitCount/触发 N 次/额外施放） | **16** | 流星箭雨/连射/闪电链/快意恩仇/余烬爆裂/元素爆裂 | 部分（hitCount+retarget 有；触发N次/条件重放/每人释放/延迟段缺失） | ``{op:'damage', hits:{count|range|perFoe|untilKill}, recast?:{on:'kill'|'condition', times}, schedule?:'nextTurn'}`` |
| 5 | 增益·祝福·能量（攻/法伤/潜行/免疫/闪避/能量/上限/形态） | **10** | 狂暴药水/聚能/潜匿/邪能护体/元素符印 | 完全缺失 | ``{op:'blessing', key:'atkUp'|'spellUp'|'stealth'|'immune'|'dodge'|'reduce', stacks, duration, plus {op:'energy'|'energyCap'|'maxHp'|'deckCap', n}}`` |
| 6 | 护甲与防御（护甲/格挡/所受伤害降为） | **9** | 格挡/坚盾/圣盾/不变应万变/屏障修复 | 部分（armor op 仅卡面字段；无 guard/衰减/条件0费联动） | ``{op:'armor', amount, guard?:true, decayAtTurnEnd?:n}`` |
| 7 | 抽牌与手牌（抽 N/直到 N/消耗手牌/保留） | **8** | 摸索/精神药水/法力补给/金蝉脱壳/后备能源 | 部分（draw op 仅固定 N；无 until/手牌消耗/保留/免注能） | ``{op:'draw', count|untilHandN|normalModeGrantSha, handOps?: [{op:'consumeHand', n|all, then…}]}`` |
| 8 | 生命操作（治疗/吸血/回复至/自伤） | **8** | 包扎/噬血术/沐愈光辉/圣光治愈/恶魔之力 | 部分（heal op 仅卡面字段；无 lifesteal/upTo/selfDamage/按值折算） | ``{op:'heal', amount|upTo|perCost|lifesteal:true|selfDamage:true}`` |
| 9 | 费用操作（0 费/降费/1 费规则/换费） | **3** | 连击箭/追斩/银河之旅（全武术 1 费） | 部分（4 种 costModifiers；无全局规则旗/手牌变形 0 费） | ``costModifiers 增补：{kind:'typeCostRule', type, cost:1}（全局旗）、{kind:'movesPlayedDiscount', perMove:n}、{kind:'handMorphZeroFee'}`` |
| 10 | 变形与规则改写（杀化为 X/复制/成长/额外回合） | **3** | 骷髅王剑（杀化为不朽斩）/青龙化身/神灯/法力奔涌/不变应万变-改 | 完全缺失 | ``{op:'transform', what:'sha'|'self'|'handCard', into:{named|randomPool}, cost?:0, keepInHand?:true} / {op:'extraTurn'} / {op:'registerRule', rule:'consumeFireball'|'allSpellsInfused'|'growth'}`` |
| 11 | 消灭·击杀·墓地 | **3** | 吞噬/TNT/闪金之锤/扰敌 | 完全缺失 | ``{op:'execute', cap:{atk|maxHpBelow:9}, count, onKill?:{armor|coins|recast}}` + `{trigger:'onKill', …}`` |
| 12 | 召唤与场面物件 | **1** | 征召（步兵×2）——唯一结构化候选；随从模板在生物族 | 完全缺失 | ``{op:'summon', name, atk, hp, count, statless?:true, taunt?:true}`` |
| 13 | 装备·被动·主动技能·容器 | **37** | 长剑/深海印记/毒杖/连弩/珍珠盒 | 完全缺失（36 装备 + 法师锦囊，全靠 desc/equipment 层） | ``equip:{onEquip?:[op], passive?:{aura:{atk,spellPower}, cond:{hasCurse|vsFreeze}}, battleStart?:[op], skill?:{oncePerBattle, ops:[…]}, container?:{slots, accepts}}`` |
| 14 | 背包道具（地图/战斗道具栏） | **22** | 金疮药/能源结晶/复原药水/烟雾弹/精神药水 | 部分（bag.use heal/restoreConsumed 2 种） | ``bag.use 扩 op：{op:'heal'|'restoreConsumed'|'randomEffect'|'flee'|'grantCard'}`` |
| 15 | 资源·材料·经济 | **15** | 木材/口粮/钥匙系/钻石/铜币 | 能（base.material 已承载 8 张；经济 5 张走 sellPrice） | ``base.material 扩 kind 枚举；{op:'coins', n}`（击杀/事件侧）` |
| 16 | 事件卡（地图侧 eventChoiceSpec） | **19** | 隧道血契/黑箱调拨/地下商场黑市/暴雨劫道 | 完全缺失（地图侧 eventChoiceSpec V2 硬编码） | `v2 不覆盖：事件卡保留地图侧 spec（或单列 events schema）` |
| 17 | 生物图鉴（不可打出） | **25** | 联邦巡防兵/巨兽「荒渊」/肃清总督/变异巢母/异能领主 | 完全缺失（不可打出，敌性行为在 enemy-phase/mapData） | `v2 不覆盖：生物图鉴是敌方数据，非玩家牌效` |
| 18 | 能力卡与封印（英雄机制） | **12** | 白梅落影·妄/禁术解放/受缚之残影/深渊主宰·妲莉薇特 | 完全缺失 | `v2 首版豁免：封印/化形/全局规则为演出级机制，见 §6 白名单` |

> 注：频次按每卡**主操作族**计（副效果在逐卡表中另行体现）；后 6 族（装备/背包/资源/事件/图鉴/英雄）是类型域家族，其中事件/图鉴/英雄是「域级豁免」候选，不是 v2 首版目标。

## 3. 逐卡迁移清单（272 行，按操作族分组）

评级：**D**=直接迁（v1 或 v2 常规键即可）；**V**=需 v2 新键；**H**=建议保留手写。实现位置为当前真源（简写：resolution=battle.resolution.js、exec-play=battle.exec-play.js、engine=battle.engine.js、equipment=battle.equipment.js、bag=battle.bag.js、card-cost=battle.card-cost.js、rules=battle.rules.js、steps.<x>=effect-steps.<x>.js）。

### 伤害直结（攻/法/固定/真实、区间、条件增伤）（33 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt7-sneak` | 偷袭 | 武术 | 攻（-1）。 | resolution 结构化 onPlay（damage chosenEnemy） | 伤害直结 | D |
| `tt7-fullstrike` | 全力一击 | 武术 | 攻（+5），抽 1 张牌。 | resolution 伤害段 + draw.n | 伤害直结 | D |
| `starter-attack` | 初始攻击 | 武术 | 攻（+0）：造成等同于攻击力的伤害。 | resolution 伤害段（atk+0）+ grantSha 全链 | 伤害直结 | D |
| `tt2-shoot` | 射击 | 武术 | 造成 2 点伤害。 | resolution 伤害段（fixed） | 伤害直结 | D |
| `tt3-execute` | 斩杀 | 武术 | 对 9 血以下角色造成9点真实伤害。 | hpCap 阈值 | 伤害直结 | D |
| `tt7-whirlwind` | 旋风斩 | 武术 | 攻（+1），目标为敌方全体。 | resolution 伤害段（AOE attack） | 伤害直结 | D |
| `tt3-qi-wave` | 气功波 | 武术 | 抽 1 张牌，对全体敌人造成等同于其价格的固定伤害。 | dmg.priceAoe | 伤害直结 | V |
| `tt2-piercearrow` | 破甲箭 | 武术 | 攻（-1），获得 3 点护甲。 | resolution 伤害段 + steps.curse.js curse.abreak（TT10 版 +3 甲） | 伤害直结 | D |
| `tt3-skewer` | 穿刺 | 武术 | 攻（+2），附加破甲，持续 1 回合。 | resolution 伤害段（abreak 句 TT10） | 伤害直结 | D |
| `tt3-arrow-rain` | 箭雨 | 武术 | 攻（-1），目标为敌方全体。 | resolution 伤害段（AOE） | 伤害直结 | D |
| `tt3-fatal-pierce` | 致命穿刺 | 武术 | 攻（+1）；若对方处于流血状态，伤害 +2 并附加破甲，持续 1 回合。 | resolution pierceB（对流血 +2）+ curse.abreak | 伤害直结 | D |
| `tt2-swiftarrow` | 迅疾箭 | 武术 | 攻（-1），抽 1 张牌。 | resolution 伤害段 + draw.n | 伤害直结 | D |
| `tt3-reshot` | 重斩 | 武术 | 攻（+2）。 | resolution 伤害段 | 伤害直结 | D |
| `tt8-dragonblade` | 青龙偃月斩 | 武术 | 攻+6，附加破甲与 1 层流血。 | resolution 伤害段 + steps.curse.js curse.bleed/abreak | 伤害直结 | D |
| `tt7-throwblade` | 飞刃偷袭 | 武术 | 攻（-3），附加流血，抽 1 张牌。 | resolution 伤害段 + curse.bleed + draw.n | 伤害直结 | D |
| `tt3-fly-arrowhawk` | 飞身劈 | 武术 | 攻（+3），触发的流血伤害翻倍。 | engine hitFoe 流血伤害翻倍 | 伤害直结 | V |
| `tt7-ghostblade` | 鬼魅之刃 | 武术 | 攻（+1），破除隐身时伤害 +2，并抽 2 张牌。 | resolution 伤害段 + draw.n（「破除隐身 +2」无专支，仅动词识别） | 伤害直结 | V |
| `tt12-unstableray` | 不稳定射线 | 法术 | 造成4-6点法伤 | steps.damage.js dmg.direct（区间 4-6） | 伤害直结 | D |
| `cc-double-boom` | 二次爆炸 | 法术 | 对所有敌人造成 3 点法术伤害。 | resolution 伤害段（AOE） | 伤害直结 | D |
| `tt12-chargeray` | 充能射线 | 法术 | 造成5点法伤，本牌在你手牌中时每注能过1张卡牌，伤害+2 | resolution inhandM（每注能过 1 张伤害 +2） | 伤害直结 | V |
| `cmtn1lbhbqi4` | 充能火球 | 法术 | 4‘，回合开始时，本牌伤害+1 | dmg.growth 回合成长 | 伤害直结 | V |
| `tt12-freezeray` | 冷冻射线 | 法术 | 造成4点法伤；若此前其未曾受到过伤害，对其附加冰冻 | resolution hpAtCast 快照 + curse.freeze（未受伤才冻） | 伤害直结 | D |
| `tt7-arcanebolt` | 奥术弹 | 法术 | 1′，抽 1 张牌。 | resolution 伤害段 + draw.n | 伤害直结 | D |
| `tt7-smite` | 惩击 | 法术 | 10′，对血量一半及以下的敌人伤害增加50%。 | resolution halfB 半血增伤 | 伤害直结 | D |
| `tt7-meteorstrong` | 星陨之力 | 法术 | 注能(2)：施放 3 次火球。 | steps.damage.js dmg.fireballN（施放 3 次火球） | 伤害直结 | D |
| `cmtna0nb1yxt` | 法力光波 | 法术 | 5点法术伤害 | resolution 伤害段（spell） | 伤害直结 | D |
| `tt3-fireball` | 火球 | 法术 | 造成 4 点法术伤害。 | resolution 伤害段 | 伤害直结 | D |
| `tt7-burnharvest` | 爆燃火球 | 法术 | 5′，受法伤加成翻倍； | engine hitFoe（受法伤加成翻倍） | 伤害直结 | D |
| `tt12-firecracker` | 违禁烟火 | 法术 | 对全体敌人造成1点固定伤害 | resolution 结构化 onPlay（damage allEnemies） | 伤害直结 | D |
| `tt3sp-silverthorn` | 镭射 | 法术 | 造成5点法术伤害；注能(1)：伤害+3。 | resolution ibonus（注能伤害 +N） | 伤害直结 | D |
| `tt3-thunderblast` | 雷殛 | 法术 | 造成7点法术伤害；墓地中每有1 张法术牌，伤害+1。 | graveM 墓地增伤 | 伤害直结 | V |
| `tt3-flame-storm` | 风暴火球 | 法术 | 对全体敌人每人释放1次火球。 | steps.damage.js dmg.stormFireball（每人 1 次火球） | 伤害直结 | V |
| `tt12-raydragon` | 龙焰射线 | 法术 | 注能（1）：造成11点法伤 | resolution 注能「改为 11′」 | 伤害直结 | D |

### 多段与重复（hitCount/触发 N 次/额外施放）（16 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt7-thundergrudge` | 快意恩仇 | 武术 | 消耗 2 张初始攻击，攻击 3 次。 | resolution 结构化 onPlay + rules handCards 要求 | 多段与重复 | D |
| `tt7-marchrush` | 急行军 | 武术 | 抽 2张牌，+2甲；若本牌为最后一张手牌，效果触发2次。 | exec-play 最后一张手牌整卡重跑（+draw/armor） | 多段与重复 | D |
| `tt3-noon-duel` | 正午决战 | 武术 | 下回合开始时，连开四枪！（每枪造成2点固定伤害）。 | steps.damage.js dmg.fourShots（延迟段连开四枪） | 多段与重复 | H |
| `cmtn0pbkmnvc` | 流光照影 | 武术 | 对方身上每有一层诅咒，释放一次‘初始攻击’ | steps.rules.js release.curseLayers（每层诅咒释放一次杀） | 多段与重复 | V |
| `tt7-meteorrain` | 流星箭雨 | 武术 | 攻（-1）；触发 2 次。 | resolution 结构化 onPlay（hitCount=2+retarget） | 多段与重复 | D |
| `cc-last-stand` | 破釜沉舟 | 武术 | 攻（+3）；若本牌为最后一张手牌，效果触发 2 次。 | exec-play 最后一张手牌整卡重跑 | 多段与重复 | D |
| `tt7-bloodpoison` | 血毒双镖 | 武术 | 选择两个目标（可以重复）：攻（+1），附加流血；攻（+1），附加中毒。 | resolution 首段 + bag beginDartStrike/resolveDart（二段点选） | 多段与重复 | H |
| `tt3-double-shot` | 连射 | 武术 | 造成2 点固定伤害，触发 3 次。 | resolution times=3（TT10 版触发 3 次） | 多段与重复 | D |
| `cc-rapid-fire` | 连续射击 | 武术 | 本回合每打出一张其他招式，造成2点固定伤害（触发次数＝本回合已打出的招式数）。 | resolution 本回合每打出一张其他招式（playedMovesThisTurn 计数） | 多段与重复 | V |
| `cc-ember-burst` | 余烬爆裂 | 法术 | 对全体敌人造成 2 点法术伤害；若击杀敌人，再施放一次。 | resolution 击杀连锁（若击杀敌人再施放一次） | 多段与重复 | V |
| `tt12-elemburst` | 元素爆裂 | 法术 | 对随机敌人造成2点法伤，触发4-5次 | steps.damage.js dmg.randomRepeat（随机目标区间次数） | 多段与重复 | V |
| `tt7-elementstorm` | 元素风暴 | 法术 | 下一张法术施放 2 次。 | steps.kills.js cast.nextSpellTimes + exec-play 重放 | 多段与重复 | D |
| `tt3sp-shadowshot` | 暗影射击 | 法术 | 3′，若对手处于诅咒状态，额外施放 1 次。 | resolution sm 条件额外施放（诅咒状态） | 多段与重复 | V |
| `tt3sp-bloodstorm` | 血蝠风暴 | 法术 | 3′，目标为全体敌人，回复等量生命；注能(2)：触发 2 次。 | resolution 注能触发 2 次 + 吸血（AOE） | 多段与重复 | D |
| `tt3-chain-lightning` | 闪电链 | 法术 | 3′，触发 2 次。 | resolution times=2（2 段） | 多段与重复 | D |
| `tt12-saturate` | 饱和打击 | 法术 | 造成7点法伤，如果消灭敌人，额外释放一次 | resolution 击杀连锁（如果消灭敌人额外释放一次） | 多段与重复 | V |

### 诅咒族（流血/中毒/冰冻/沉默/破甲/禁疗/灼烧/随机诅咒/毒爆）（23 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt3-venom-arrow` | 毒箭 | 武术 | 攻（-1），附加 1层中毒。 | resolution 伤害段 + curse.poison | 诅咒族 | D |
| `tt3-wave-slash` | 破浪斩 | 武术 | 攻（+3），下回合无法抽牌。 | 伤害段 + draw.noDrawNext | 诅咒族 | D |
| `tt3-armor-rush` | 破甲急袭 | 武术 | 攻（+4），附加 2 层流血。 | resolution 伤害段 + curse.bleed ×2 | 诅咒族 | D |
| `tt3-blood-arrow` | 血箭 | 武术 | 攻（-1），附加流血。 | resolution 伤害段 + curse.bleed | 诅咒族 | D |
| `cc-cursed-blade` | 诅咒之刃 | 武术 | 攻（+3），附加手牌中的招式所具有的全部诅咒效果。 | steps.curse.js curse.handCurseAll（battle.layers.js 在途） | 诅咒族 | H |
| `tt3-frost-slash` | 霜月斩 | 武术 | 攻（+2），附加冰冻与禁疗，持续1回合。 | resolution 伤害段 + curse.freeze/healban | 诅咒族 | D |
| `tt3-ice-spike` | 冰刺 | 法术 | 2′，附加冰冻。 | resolution 伤害段 + curse.freeze | 诅咒族 | D |
| `tt7-frozenight` | 冰封千里 | 法术 | 冰冻所有敌人，持续 1 回合。 | resolution 结构化 onPlay（freeze allEnemies） | 诅咒族 | D |
| `tt3-firm-barrier` | 坚冰结界 | 法术 | 延长 1 名角色的冰冻 1 回合，抽1张牌。 | steps.damage.js curse.extendFreeze（延长冰冻） | 诅咒族 | D |
| `tt12-sporewall` | 孢子城墙 | 法术 | 对一名敌人附加2层中毒，自己获得6点护甲 | steps.curse.js curse.poison + def.armor | 诅咒族 | D |
| `tt12-infectray` | 感染射线 | 法术 | 造成4点法伤，附加一层随机诅咒 | resolution 伤害段 + curse.randomKinds | 诅咒族 | D |
| `tt3-thornfield` | 棘刺之地 | 法术 | 对所有敌人附加 2 层中毒，并立即触发1次毒伤。 | steps.curse.js curse.poison（AOE）+ curse.poisonBurstN | 诅咒族 | D |
| `cc-poison-burst` | 毒爆 | 法术 | 立即触发 2 次目标全部毒伤。 | steps.kills.js curse.poisonBurstN | 诅咒族 | D |
| `tt3-toxin` | 毒药 | 法术 | 附加 1 层中毒。抽 1 张牌。 | steps.curse.js curse.poison + draw.n | 诅咒族 | D |
| `tt7-abysscurse` | 深渊诅咒 | 法术 | 7′，附加禁疗；此时对方身上每有 1 种诅咒，抽 1 张牌。 | resolution 伤害段 + curse.healban + draw.n perCurseDraw | 诅咒族 | D |
| `tt8-curse1` | 禁咒I | 法术 | 抽到时施放：夺取 1 点攻击力。 | engine drawCards onDraw 抽到即施放 + steps.audit.js dmg.seizeAtk | 诅咒族 | D |
| `tt8-curse2` | 禁咒II | 法术 | 抽到时施放：冰冻。 | engine drawCards onDraw + steps.curse.js curse.freeze | 诅咒族 | D |
| `tt8-curse3` | 禁咒III | 法术 | 抽到时施放：中毒，流血。 | engine drawCards onDraw + steps.curse.js curse.enumeration | 诅咒族 | D |
| `tt8-curse4` | 禁咒IV | 法术 | 抽到时施放：沉默 1 回合。 | engine drawCards onDraw + steps.curse.js curse.silence | 诅咒族 | D |
| `tt7-silence` | 禁言术 | 法术 | 沉默 1 名角色 1 回合，抽 1 张牌。 | steps.curse.js curse.silence | 诅咒族 | D |
| `cc-rot-seed` | 腐化之种 | 法术 | 对 1 名敌人附加 2 层中毒；其死亡时，将中毒层数转移给另一名敌人。 | exec-play poisonLegacy + engine transferPoisonLegacy | 诅咒族 | H |
| `tt3-nuke-ray` | 致命射线 | 法术 | 造成8点法术伤害，对其附加3种随机诅咒 | resolution 伤害段 + curse.randomKinds（3 种随机诅咒） | 诅咒族 | D |
| `tt3sp-flowerzhen` | 花鸩 | 法术 | 使 1 名角色中毒层数翻倍并立即触发1次毒伤。 | steps.kills.js curse.poisonDouble（翻倍+引爆） | 诅咒族 | D |

### 生命操作（治疗/吸血/回复至/自伤）（8 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt3-bandage` | 包扎 | 武术 | +3 血，+3 甲。 | resolution 结构化 onPlay | 生命操作 | D |
| `tt2-bloodblade` | 嗜血刃 | 武术 | 攻（+2），回复等量生命。 | resolution 吸血（回复等量生命） | 生命操作 | D |
| `tt7-bloodpotion` | 噬血术 | 法术 | 3′，回复等量生命。 | resolution 伤害段 + steps.recovery.js heal.n | 生命操作 | D |
| `tt7-holyheal` | 圣光治愈 | 法术 | 注能（1）：回复 2 倍于被注能卡牌价格的血量。 | steps.gates.js pre.fuelPrice（N 倍于牺牲品价格） | 生命操作 | V |
| `cc-demon` | 恶魔之力 | 法术 | 4′，损失 2 点生命。 | resolution 伤害段 + steps.kills.js dmg.loseLife | 生命操作 | D |
| `tt7-holyglow` | 沐愈光辉 | 法术 | 将自身血量回复至 12 血。 | steps.kills.js heal.upTo（回复至 12） | 生命操作 | D |
| `tt3-holy-water` | 治愈 | 法术 | 回复 5 点生命，净化自身 | steps.recovery.js heal.n + buff.purify | 生命操作 | D |
| `tt3-petal` | 花瓣法阵 | 法术 | 回合开始时额外抽1张牌并回复 3 点生命，持续 3 回合。 | turnStart 回血 + draw | 生命操作 | D |

### 护甲与防御（护甲/格挡/所受伤害降为）（9 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `cc-unmoved` | 不变应万变 | 武术 | 本回合所受伤害降为 1，获得 4 点护甲。 | steps.recovery.js def.guard + def.armor | 护甲与防御 | D |
| `tt7-ironcharge` | 厉兵秣马 | 武术 | +12 甲，抽 2 张牌。 | steps.recovery.js def.armor + draw.n | 护甲与防御 | D |
| `tt3-hold-fast` | 坚守 | 武术 | +5 甲，抽 1 张牌。 | resolution 结构化 onPlay | 护甲与防御 | D |
| `tt7-bulwark` | 坚盾 | 武术 | 本回合获得 8点护甲，下回合开始时 -4 点。 | steps.recovery.js def.armor + def.armorLoss（回合结束 -4） | 护甲与防御 | D |
| `tt2-block` | 格挡 | 武术 | 本回合所受伤害降为 1。 | steps.recovery.js def.guard（所受伤害降为 1） | 护甲与防御 | D |
| `tt7-demonbreaker` | 破甲重斩 | 武术 | 攻5，附加破甲，持续 2 回合；击杀敌人时 +4 甲。 | engine applyKillRewards（击杀 +4 甲） | 护甲与防御 | V |
| `tt2-forestarrow` | 绿化箭 | 武术 | 攻（-1），+3 甲。 | resolution 伤害段 + steps.recovery.js def.armor | 护甲与防御 | D |
| `tt3-holy-shield` | 圣盾 | 法术 | 获得 6 点护甲；若你此时护甲为 0，本牌变为 0 费。 | steps.recovery.js def.armor + card-cost（护甲为 0 变 0 费） | 护甲与防御 | D |
| `tt12-barriermend` | 屏障修复 | 法术 | 获得6点护甲，如果你此时没有护甲，该牌变为0费 | resolution 结构化 onPlay + card-cost armorZeroFree | 护甲与防御 | D |

### 抽牌与手牌（抽 N/直到 N/消耗手牌/保留）（8 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `cmtn233trmeg` | 不朽斩 | 武术 | 攻（+1），永远被保留在手牌中，无法用于注能 | exec-play（永远保留在手牌/无法用于注能） | 抽牌与手牌 | V |
| `cmtn2jc142dj` | 刀剑形态 | 武术 | 回合开始时，获得一张随机手牌的复制 | steps.kills.js hand.copyRandom（回合开始经 delayed） | 抽牌与手牌 | V |
| `tt7-goldencicada` | 金蝉脱壳 | 武术 | 消耗所有手牌，抽 3 张。 | steps.damage.js hand.dumpAll + draw.n（消耗所有手牌抽 3） | 抽牌与手牌 | D |
| `tt2-turtlearmor` | 铸甲 | 武术 | 消耗1 张装备牌，+10甲。 | hand-cost-patterns.js 消耗装备 + steps.recovery.js def.armor | 抽牌与手牌 | D |
| `tt12-backupcell` | 后备能源 | 法术 | 抽2张牌并回复所有费用，消耗口袋中每有一张法术牌，本牌费用-1 | resolution 结构化 onPlay + card-cost consumedSpellDiscount | 抽牌与手牌 | D |
| `tt7-livingwater` | 圣光之源 | 法术 | 抽 5 张牌。 | draw.n 抽 5 | 抽牌与手牌 | D |
| `tt3-grope` | 摸索 | 法术 | 抽2-3张牌。 | steps.recovery.js draw.n（抽 2） | 抽牌与手牌 | D |
| `tt7-maxsupply` | 法力补给 | 法术 | 抽牌，直到有 4 张手牌。 | draw.untilN | 抽牌与手牌 | D |

### 增益·祝福·能量（攻/法伤/潜行/免疫/闪避/能量/上限/形态）（10 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt3-purify-arrow` | 净化箭 | 武术 | 攻（-1），净化自身。 | resolution 伤害段 + buff.purify | 增益·祝福·能量 | D |
| `tt7-swordimmortal` | 剑仙形态 | 武术 | 本局对战中，回合开始时额外抽 1 张牌。 | steps.curse.js buff.swordForm（回合开始额外抽 1） | 增益·祝福·能量 | V |
| `tt3wu-shike` | 割蚀 | 武术 | 降低 1 名敌人 2 攻，持续3回合；附加流血。 | steps.damage.js dmg.atkDown（降 2 攻）+ curse.bleed | 增益·祝福·能量 | V |
| `tt3sp-shadowbug` | 影噬 | 武术 | 本回合偷取 1 名敌人的攻击力至1点。 | steps.damage.js dmg.stealAtk（偷取攻击） | 增益·祝福·能量 | V |
| `tt7-stealth` | 潜匿 | 武术 | 进入潜行状态 1 回合，抽1张牌。 | steps.curse.js buff.stealth | 增益·祝福·能量 | D |
| `cmtn1ntxzoc4` | 火焰形态 | 法术 | 本局对战中，法伤+1 | buff.spellUp 本局 | 增益·祝福·能量 | D |
| `tt7-energize` | 聚能 | 法术 | 获得1点能量 。 | steps.tail.js res.energy | 增益·祝福·能量 | D |
| `tt3-nature-form` | 自然形态 | 法术 | 本局战斗中，能量上限 +1。 | buff.natureForm | 增益·祝福·能量 | V |
| `tt12-felguard` | 邪能护体 | 法术 | 注能（2）：抽3张牌，本回合免疫所有伤害和诅咒效果 | exec-play curseImmuneOff + steps.curse.js buff.immune | 增益·祝福·能量 | D |
| `tt3sp-dodge` | 闪避 | 法术 | 本回合避开第1段伤害。 | steps.damage.js buff.dodge（避开第 1 段伤害） | 增益·祝福·能量 | D |

### 卡牌获取与牌库（发现/随机获取/洗入/置入手牌）（25 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `cc-dual-wield` | 二刀流 | 武术 | 发现一张武术卡并额外获得1张复制。 | steps.kills.js discover.pool act=dup（额外获得复制） | 卡牌获取与牌库 | D |
| `tt3-frostfall` | 剑荡妖邪 | 武术 | 攻+5，选择手牌中 1 张武术卡直接释放。 | TT10：攻 5+手牌武术直接释放 | 卡牌获取与牌库 | V |
| `tt3-dig-treasure` | 挖宝 | 武术 | 从牌库底发现 1 张牌，并获得等同于其价格的护甲。 | discover.pool priceArmor | 卡牌获取与牌库 | D |
| `tt7-armup` | 武装 | 武术 | 从牌库中抽取 2 张装备牌。 | steps.kills.js draw.fromDeck（deckDraw） | 卡牌获取与牌库 | D |
| `tt2-jianghu` | 江湖救急 | 武术 | 发现 1 张其它职业的卡牌并直接施放。 | resolution tt2-jianghu 路径（发现并施放） | 卡牌获取与牌库 | V |
| `cmtn1wnhhym` | 江湖救急-改 | 武术 | 随机获得3张临时卡牌，回合开始时将其消耗。 | 专支随机 3 临时卡 | 卡牌获取与牌库 | H |
| `tt3-flux-slash` | 流光斩 | 武术 | 攻（-1），附加 2 层流血；将流光照影洗入牌库。 | 伤害段 + curse.bleed ×2 + deck.insert | 卡牌获取与牌库 | D |
| `tt3-life-arrow` | 生命箭 | 武术 | 攻（-1），获得 1 张随机卡牌。 | resolution 伤害段 + discover.pool（随机 1 张） | 卡牌获取与牌库 | D |
| `cmtn1i64j7y7` | 盗宝 | 武术 | 发现一张装备卡 | discover.pool 装备池 | 卡牌获取与牌库 | D |
| `tt7-ironphalanx` | 铁甲阵 | 武术 | +10 甲，将 5 张随机卡牌洗入牌库，并使其费用均-1。 | steps.deck.js deck.insert（随机 5 张费用-1） | 卡牌获取与牌库 | D |
| `tt7-twinfireball` | 三重火球 | 法术 | 4′，将2张‘火球’置入手牌。 | steps.deck.js deck.insertHand（2 张火球置入手牌） | 卡牌获取与牌库 | D |
| `cmtn1p9vb5au` | 千变万化 | 法术 | 发现一种形态并释放 | discover.form | 卡牌获取与牌库 | V |
| `cmtn1gfhczzj` | 厄运 | 法术 | 随机获取1张能施加诅咒的招式 | hand.curseCards | 卡牌获取与牌库 | D |
| `tt12-basicdev` | 基础开发 | 法术 | 随机获取两张0费招式 | steps.kills.js rand.getCostedMoves（两张 0 费招式） | 卡牌获取与牌库 | D |
| `tt3-treasure-hunt` | 寻宝 | 法术 | 造成4点法术伤害，发现 1 张牌。 | resolution 伤害段 + discover.pool | 卡牌获取与牌库 | D |
| `cmtn28jv33wx` | 搜索大宝箱 | 法术 | 随机获取3张卡牌 | 专支牌库底发现 | 卡牌获取与牌库 | H |
| `tt7-bladebloom` | 永恒绽放 | 法术 | 发现并直接施放 1 张牌，获取剩下两张。 | steps.kills.js discover.pool act=playKeep | 卡牌获取与牌库 | H |
| `cmtn1epgt20j` | 灵能召唤 | 法术 | 发现一张注能卡，使其无需注能 | steps.kills.js discover.infuseFree（免注能） | 卡牌获取与牌库 | D |
| `cc-lava-blast` | 熔岩爆破 | 法术 | 造成9点法术伤害，获得1张「二次爆炸」。 | steps.deck.js deck.gainNamed（获得「二次爆炸」） | 卡牌获取与牌库 | D |
| `cmtn125e1nk0` | 神秘召唤 | 法术 | 发现一张传说或能力卡。 | discover.pool 传说/能力卡 | 卡牌获取与牌库 | D |
| `tt12-breakthrough` | 突破进展 | 法术 | 随机获取1张0费，一张1费，一张2费招式 | steps.kills.js rand.getCostedMoves（0/1/2 费各一张） | 卡牌获取与牌库 | D |
| `tt3sp-magicoil` | 药水魔法 | 法术 | 发现1瓶药水并直接释放 | steps.kills.js discover.pool/rand.getCostedMoves | 卡牌获取与牌库 | V |
| `tt12-hitechrd` | 高端研发 | 法术 | 发现一张2费招式，在每个回合开始时，使其-1费 | resolution 结构化 onPlay（discover+costDecayPerTurn） | 卡牌获取与牌库 | D |
| `tt12-magicfind` | 魔法新发现 | 法术 | 发现1张1费招式，使其变为0费。 | steps.kills.js discover.pool zeroCost | 卡牌获取与牌库 | D |
| `cmtn1r10xnl1` | 黑暗形态 | 法术 | 本局对战中，每当你发现卡牌时，增加1个可选项 | 黑暗形态（发现可选项 +1，薄实现） | 卡牌获取与牌库 | H |

### 费用操作（0 费/降费/1 费规则/换费）（3 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt2-comboarrow` | 连击箭 | 武术 | 攻（-1）；如果你打出的上一张牌是武术牌，本牌变为0费。 | card-cost（上一张牌是武术→0 费） | 费用操作 | D |
| `cc-chase-slash` | 追斩 | 武术 | 攻（+0），本回合每打出一张其他武术，费用-1。 | card-cost（本回合每打出一张其他武术，费用-1） | 费用操作 | D |
| `tt5-galaxy-voyage` | 银河之旅 | 法术 | 本场对战中，你的所有武术均为 1 费。 | registerBattle spellCost1 | 费用操作 | H |

### 消灭·击杀·墓地（3 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `cmtn0xt0zr7` | 闪金之锤 | 武术 | 造成5点固定伤害，若击杀敌人，+2币。 | applyKillRewards 币钩子 | 消灭·击杀·墓地 | V |
| `tt3sp-devour` | 吞噬 | 法术 | 消灭 1 名 攻击力4 点及以下小怪。 | steps.kills.js kill.minions（攻击力门槛） | 消灭·击杀·墓地 | D |
| `tt7-provoke` | 扰敌 | 法术 | 选择2 名敌人，迫使其相互攻击一次。 | steps.kills.js dmg.taunt（迫使斗殴） | 消灭·击杀·墓地 | V |

### 召唤与场面物件（1 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt7-recruit` | 征召 | 法术 | 召唤步兵（4-4） ×2为你抵挡伤害并自动战斗。 | steps.audit.js summon.ally（步兵 4-4 ×2） | 召唤与场面物件 | V |

### 变形与规则改写（杀化为 X/复制/成长/额外回合）（3 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt7-imitate` | 不变应万变-改 | 武术 | 在手牌中时，本牌变为打出的上一张武术牌的1费复制。 | engine applyImitate（变为上一张武术 1 费复制） | 变形与规则改写 | H |
| `cc-mana-surge` | 法力奔涌 | 法术 | 对随机敌人释放4个随机法术（这些随机法术默认已注能）。 | resolution surgeM + engine castRandomSpells（慢动作演出） | 变形与规则改写 | H |
| `tt3-magic-lamp` | 神灯 | 法术 | 抉择：1° 发现 1 张牌并将其释放；2° 消灭 1 名受伤敌人（非 BOSS）；3° 冰冻 2 名角色，获得5 点护甲… | steps.gates.js gate.choice 抉择面板 + ensureChoiceFixes | 变形与规则改写 | H |

### 资源·材料·经济（15 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt-key` | 一把钥匙 | 资源 | 解锁大门。 | src/hub/base.js base.material 入库（v1 rules） | 资源·材料·经济 | D |
| `tt3-wood-bundle` | 一捆木材 | 资源 | 木材 ×3。 | src/hub/base.js base.material（v1 rules） | 资源·材料·经济 | D |
| `tt-key-one` | 三把钥匙 | 资源 | 钥匙 ×3。 | src/hub/base.js base.material 入库（v1 rules） | 资源·材料·经济 | D |
| `tt-keys-bunch` | 两把钥匙 | 资源 | 钥匙 ×2。 | src/hub/base.js base.material 入库（v1 rules） | 资源·材料·经济 | D |
| `tt3-ration-double` | 双份口粮 | 资源 | 口粮 ×2。 | src/hub/base.js base.material（v1 rules） | 资源·材料·经济 | D |
| `tt-rations` | 口粮 | 资源 | 升级宠物。 | src/hub/base.js base.material 入库（v1 rules） | 资源·材料·经济 | D |
| `tt-wood-lots` | 大量木材 | 资源 | 木材 ×2。 | src/hub/base.js base.material 入库（v1 rules） | 资源·材料·经济 | D |
| `pet-egg` | 宠物蛋 | 资源 | 可以孵化宠物。 | chests.js/meta.js（宠物孵化，游戏侧特殊资产） | 资源·材料·经济 | H |
| `tt-wood` | 木材 | 资源 | 木材 ×1。 | src/hub/base.js base.material 入库（v1 rules） | 资源·材料·经济 | D |
| `tt3-garnet-marble` | 石榴弹珠 | 资源 | 漂亮的小玩意，可出售。 | cards.rules.js sellPrice/isSellable | 资源·材料·经济 | D |
| `tt-econpack` | 经济卡包 | 资源 | 只能在仓库界面点击使用，获得5张随机卡牌 | game.bag.js 仓库使用 | 资源·材料·经济 | H |
| `tt-gold` | 金币 | 资源 | 贵重货币，可出售。 | cards.rules.js sellPrice/isSellable | 资源·材料·经济 | D |
| `tt3-diamond` | 钻石 | 资源 | 贵重货币，可出售。 | cards.rules.js sellPrice/isSellable | 资源·材料·经济 | D |
| `tt-copper` | 铜币 | 资源 | 可出售。 | cards.rules.js sellPrice/isSellable（SELLABLE_LEGACY_IDS） | 资源·材料·经济 | D |
| `tt-silver` | 银币 | 资源 | 可出售。 | cards.rules.js sellPrice/isSellable | 资源·材料·经济 | D |

### 装备·被动·主动技能·容器（37 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt7-stratagem` | 法师锦囊 | 法术 | 自带1*3空间，可以置入3张法术牌；打出时选择其中 1 张直接施放。 | engine queuePouchCast + steps.audit.js hand.pouchCast（pouch 容器） | 装备·被动·主动技能·容器 | H |
| `tt3-element-seal` | 元素符印 | 装备 | 本局对战中累计注能3张卡牌后解锁：法伤 +2，抽2张牌。 | gate.sealUnlock | 装备·被动·主动技能·容器 | V |
| `tt3-twinwater-mail` | 冰甲 | 装备 | 冰冻 1 名敌人后，+3甲。 | resolution 文本路径 def.armor（+3 甲；「冰冻后」条件句无专支） | 装备·被动·主动技能·容器 | V |
| `tt3-fate-wheel` | 命运钟表 | 装备 | 主动技能：消耗所有手牌，获得 1 个额外回合。 | hand.dumpAll + turn.extra | 装备·被动·主动技能·容器 | H |
| `tt3-holy-staff` | 圣杖 | 装备 | 主动技能：净化并回复5血 | useEquipSkill（净化并回复 5 血） | 装备·被动·主动技能·容器 | D |
| `tt3-master-staff` | 大法师之杖 | 装备 | 回合开始时法伤 +1。 | turnStart delayed 法伤 +1 | 装备·被动·主动技能·容器 | V |
| `tt8-heavensword` | 天启剑 | 装备 | 抽到该牌时额外抽 1 张牌；在你抽到天启剑与诛魔剑后…… | engine drawCards onDraw（额外抽 1）+ DESIGNER_BLANKS 留白尾句 | 装备·被动·主动技能·容器 | H |
| `tt8-archdemon` | 天启诛魔剑 | 装备 | 获得 1 点攻击力，获得3张重斩。 | steps.curse.js buff.atkUp + deck.gainNamed（获得 3 张重斩） | 装备·被动·主动技能·容器 | V |
| `tt3-wolf-bow` | 天狼长弓 | 装备 | 回合开始时，获得1张随机的‘箭矢’并将其变为0费。 | turnStart + summon.randomKeyedZero | 装备·被动·主动技能·容器 | V |
| `tt7-arcanescroll` | 奥术残卷 | 装备 | 消耗该牌时抽 3 张牌。 | fireConsumeTriggers 抽 3 | 装备·被动·主动技能·容器 | D |
| `tt2-frostsword` | 寒冰剑 | 装备 | 对冰冻角色伤害 +2。 | engine hitFoe frzM（对冰冻 +2） | 装备·被动·主动技能·容器 | V |
| `tt2-treasuremap` | 寻宝图 | 装备 | 主动技能：将 1张‘搜索大宝箱’洗入牌库，抽1张牌。 | steps.deck.js deck.insert（搜索大宝箱洗入+抽 1） | 装备·被动·主动技能·容器 | D |
| `tt12-raygun` | 射线枪 | 装备 | 主动技能：发现一张射线牌并直接释放 | equipment useEquipSkill（发现射线牌直接释放） | 装备·被动·主动技能·容器 | V |
| `tt3-light-mail` | 急速跑鞋 | 装备 | 主动技能：抽3张牌 | useEquipSkill 抽 3 | 装备·被动·主动技能·容器 | D |
| `tt2-venomstaff` | 毒杖 | 装备 | 每当你使用一张法术牌，为1名随机敌人附加中毒 | exec-play poisonOnSpell + engine poisonRandomFoe | 装备·被动·主动技能·容器 | V |
| `tt2-wreck` | 沉船宝盒 | 装备 | 消耗该牌时，获取 2张随机卡牌。 | engine fireConsumeTriggers（消耗该牌时获取随机卡） | 装备·被动·主动技能·容器 | D |
| `tt3-staff` | 法杖 | 装备 | 法伤 +1。 | 装备被动（法伤 +1，穿戴期生效） | 装备·被动·主动技能·容器 | V |
| `tt3-deep-seal` | 深海印记 | 装备 | 诅咒状态下，攻 +2，法伤 +2。 | equipment syncCurseCondEquips（诅咒条件装备） | 装备·被动·主动技能·容器 | V |
| `tt3-deep-diary` | 深海咒印 | 装备 | 自身处于诅咒状态时，获得 2 点攻击力且法伤 +2。 | syncCurseCondEquips | 装备·被动·主动技能·容器 | V |
| `tt3-crimson-pouch` | 深红丝袋 | 装备 | 主动技能：选择并复制你的 1 张手牌。 | equipment useEquipSkill（手牌校验）+ hand.selectFamily copy | 装备·被动·主动技能·容器 | V |
| `tt3-chaos-eye` | 混沌之眼 | 装备 | 对战开始时：血量上限 +10，牌库上限+5。 | 开战被动 + maxHpUp + capUp | 装备·被动·主动技能·容器 | V |
| `tt7-talisman` | 灵符 | 装备 | 对战开始时，额外抽 2 张牌。 | equipment applyBattleStartPassives（开战被动抽 2） | 装备·被动·主动技能·容器 | V |
| `tt2-pearlbox` | 珍珠盒 | 装备 | 内置3*3空间，可以容纳所有类型的资源卡牌。 | game.session.bag.js/game.bag.drag.js（背包扩容容器，战斗外） | 装备·被动·主动技能·容器 | H |
| `tt3-azure-sword` | 百炼青虹剑 | 装备 | 消耗该牌时立即释放一次’初始攻击‘。 | fireConsumeTriggers + release.oneSha | 装备·被动·主动技能·容器 | D |
| `tt3-sapper-bomb` | 矿工炸药 | 装备 | 消耗该牌时，造成 4 点固定伤害。 | fireConsumeTriggers | 装备·被动·主动技能·容器 | D |
| `tt7-naturestaff` | 自然法杖 | 装备 | 主动技能：选择 1 张卡牌，下回合将其变为 0 费。 | useEquipSkill（hand 校验）+ 选择 1 张变 0 费（hand.zeroCostSelect） | 装备·被动·主动技能·容器 | V |
| `tt3-grass-armor` | 草甲 | 装备 | 装备：装备时获得5点护甲。 | 装备时 +5 甲 | 装备·被动·主动技能·容器 | D |
| `tt3-silver-runesword` | 诅咒之剑 | 装备 | 获得 2 点攻击力；回合开始时，受到2点伤害 | steps.gates.js pre.turnNegExtract（回合开始 -2 血）+ buff.atkUp | 装备·被动·主动技能·容器 | V |
| `tt8-demonslay` | 诛魔剑 | 装备 | 抽到该牌时攻击全体敌人；···以天启诛魔剑覆盖你的所有武器。 | engine drawCards onDraw + steps.damage.js dmg.attackAll | 装备·被动·主动技能·容器 | H |
| `tt3-reverse-bow` | 连弩 | 装备 | 主动技能：直接释放手牌中的所有‘箭’，每释放1张，抽1张牌。 | release.handMatches | 装备·被动·主动技能·容器 | V |
| `tt3eq-mistbox` | 迷之匣 | 装备 | 主动技能：发现两张随机招式，交换其费用。 | engine queueSwapCostDiscover + battle.selection-flow.js swapCost（主动技能换费） | 装备·被动·主动技能·容器 | V |
| `tt3-longsword` | 长剑 | 装备 | +1 攻。 | 装备被动（+1 攻） | 装备·被动·主动技能·容器 | V |
| `tt2-apollo` | 阿猫的礼物 | 装备 | 发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌。 | engine fireCatGift（随机获取全局钩子）+ game.run.scenes.js 地图侧 | 装备·被动·主动技能·容器 | H |
| `tt3-blooddrinker` | 饮血剑 | 装备 | 本局对战内，每消灭 1 个敌人，+1 点攻击力。 | killAtkUp 被动 | 装备·被动·主动技能·容器 | V |
| `tt3-immortal-blade` | 骷髅王剑 | 装备 | 对战开始时，你的所有「初始攻击」化为 1 张不朽斩。 | rule.shaTransform | 装备·被动·主动技能·容器 | H |
| `tt3eq-boiler` | 魔法锅炉 | 装备 | 主动技能：注能(2)：随机获取 3 张卡牌。 | useEquipSkill 专支 | 装备·被动·主动技能·容器 | V |
| `tt7-darkfort` | 黑暗吊坠 | 装备 | 免疫 1 次致命伤害，并在该回合内处于无敌状态。 | buff.deathSave | 装备·被动·主动技能·容器 | D |

### 背包道具（地图/战斗道具栏）（22 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt3sp-doom` | TNT | 道具 | 消灭 2 名 攻击力5点及以下小怪 | steps.kills.js kill.minions（TNT，2 名） | 背包道具 | D |
| `tt3-iceheart-potion` | 冰冻药水 | 道具 | 附加冰冻，持续 1 回合。 | curse.freeze | 背包道具 | D |
| `tt3-turnabout-potion` | 剧毒药水 | 道具 | 对所有敌人附加1层中毒。 | curse.poison AOE | 背包道具 | D |
| `tt-token-color` | 员工通行证A | 道具 | 集齐两枚碎片，合成真正的员工通行证A：获取一张能力卡。 | game.bag.js 合成材料（集齐 2 碎片合成） | 背包道具 | H |
| `cmtmvq6ss84l` | 员工通行证A | 道具 | 获取本职业的能力卡 | game.bag.js（获取本职业能力卡，地图侧） | 背包道具 | H |
| `tt-token-gold` | 员工通行证B | 道具 | 随机获取 1 张传说卡（不含棱彩卡）。 | steps.kills.js hand.tokenPass / game.bag.js（抽传说卡） | 背包道具 | V |
| `tt4-shine-token` | 员工通行证C | 道具 | 发现 1 张传说卡。 | game.bag.js 发现传说 | 背包道具 | V |
| `cmtn6bge52qt` | 复原药水 | 道具 | 在背包中才能使用，复原最多两张卡牌 | restoreConsumed（v1 rules） | 背包道具 | D |
| `starter-emergency-bandage` | 应急绷带 | 道具 | 回复12 点生命。 | useItem heal | 背包道具 | D |
| `tt-medneedle` | 急救合剂 | 道具 | 回合开始时：回复 6点生命。持续 3 回合。 | useItem + turnStart（回复 6，持续 3） | 背包道具 | V |
| `tt3-blue-potion` | 恢复药水 | 道具 | 回复 5 点生命，回复1点能量。 | heal.n + res.energy | 背包道具 | D |
| `tt3-savior-elixir` | 斗神酒 | 道具 | 回复 99 点生命。 | useItem heal 99（v1 rules） | 背包道具 | D |
| `tt3-demon-potion` | 法力药水 | 道具 | 法伤 +2。持续 1 回合。 | buff.spellUp | 背包道具 | D |
| `tt3-mixed-potion` | 流血药水 | 道具 | 造成 2 点固定伤害，附加流血。 | dmg.direct + curse.bleed | 背包道具 | D |
| `tt3-python-potion` | 火焰药水 | 道具 | 对所有敌人造成2点法伤 | dmg.direct AOE | 背包道具 | D |
| `tt4-smoke-bomb` | 烟雾弹 | 道具 | 非 BOSS 战逃跑一次。 | misc.flee | 背包道具 | V |
| `tt3-houyi-potion` | 狂暴药水 | 道具 | 获得 2 点攻击力。持续 1 回合。 | buff.atkUp | 背包道具 | D |
| `tt3-mystery-potion` | 神秘药水 | 道具 | 回合开始时：变成1张随机招式卡牌，使其费用为0。 | steps.damage.js summon.morphRandom（回合开始变形）+ bag isPotion 兼容旧版三选一 | 背包道具 | H |
| `tt3-mind-potion` | 精神药水 | 道具 | 抽 2 张牌。 | draw.n | 背包道具 | D |
| `tt-crystal` | 能源结晶 | 道具 | 在背包中才能使用，可以复原最多 3 张卡牌。 | restoreConsumed（v1 rules） | 背包道具 | D |
| `tt4-woodify` | 能量饮料 | 道具 | 回复 6 点生命。 | useItem heal | 背包道具 | D |
| `tt-jinchuangyao` | 金疮药 | 道具 | 回复 20 点生命。 | bag useItem heal 正则 | 背包道具 | D |

### 事件卡（地图侧 eventChoiceSpec）（19 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt6-relief` | 临时救护站 | 事件 | 回复 6 点生命。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `ev19-fireballs` | 双焰走私 | 事件 | 获得两张「火球」。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `ev19-gamble` | 地下商场黑市 | 事件 | 每次投入 3 币，50% 获得预览的 1 张装备和 2 张招式；第 5 次必定成功，可随时放弃。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `tt6-goldmine` | 塌方采掘点 | 事件 | 稳妥取走 3 币，或冒险深挖获得 6 币并损失 3 血。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `tt6-mystery` | 实验室余粮 | 事件 | 获得员工通行证A碎片，+2 币。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `cmtn7qttxqo4` | 巷口修鞋匠 | 事件 | 获得员工通行证A碎片；复原 1 张卡牌。 | eventChoiceSpec | 事件卡 | H |
| `ev19-recode` | 故障重编 | 事件 | 选择 2 张招式或装备卡，随机变为同稀有度、同类型的卡牌。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `tt6-bandits` | 暴雨劫道 | 事件 | 反抗组织拾荒者 ×3~5（随层数增加）。奖励：密封物资箱 ×2。 | game.run.flow.js（battle:true 战斗触发） | 事件卡 | H |
| `tt6-systemsupply` | 末班配送无人机 | 事件 | 获得员工通行证A碎片和木材卡 ×1。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `tt6-airdrop` | 污染空投箱 | 事件 | 从木材、口粮、能量饮料、随机药水中选择一项。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `ev19-arrows` | 海堤箭库 | 事件 | 获得 2 张随机非职业箭系列卡牌。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `tt6-goldhammer` | 满电动力锤 | 事件 | 获得卡牌「闪金之锤」。 | game.run.flow.js eventChoiceSpec（+battle.core applyKillRewards 币钩子） | 事件卡 | H |
| `tt6-chestdraw` | 熔断双箱 | 事件 | 从大、中、小宝箱中随机抽取 1 个开启。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `ev19-quartermaster` | 装备征用令 | 事件 | 花费 3 币，从 3 张随机装备卡中选择 1 张获得。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `ev19-pearlbox` | 遗落的珍珠匣 | 事件 | 获得卡牌「珍珠盒」。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `ev19-potions` | 避难市集药摊 | 事件 | 从 3 瓶随机药水中选择 1 瓶获得。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `tt6-demondeal` | 隧道血契 | 事件 | -5 血，获得 1 个军用保险柜。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `ev19-vital` | 高压急救 | 事件 | 生命上限 +3，并回复 3 点生命。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |
| `ev19-classchest` | 黑箱调拨 | 事件 | 获得 1 个职业·密封物资箱。 | game.run.flow.js eventChoiceSpec | 事件卡 | H |

### 生物图鉴（不可打出）（25 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `foe-bandit` | 反抗组织拾荒者 | 生物 | 攻击 3 / 生命 3。反抗·第1层。普通近战，成群出现（盗匪横行 ×5）。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-orc_jav` | 反抗组织掷弹兵 | 生物 | 攻击 6 / 生命 4。反抗·第2层。远程投掷。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-boss_orc` | 变异巢母 | 生物 | 攻击 4 / 生命 45。BOSS·变异。词缀【狂乱】：每回合攻击两次，每次附加 1 层流血或中毒。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-wolf_rider` | 变异雪狼 | 生物 | 攻击 7 / 生命 6。变异·第3层。蓄力攻击：隔回合强化一击。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-esper_echo` | 回声 | 生物 | 攻击 9 / 生命 7。反抗能力者·第5层。声波叠伤：远程多段攻击。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `cmtn7err0a7` | 天国之门 | 生物 | 回合开始时随机获取一项祝福，对全体友方施放，优先不重复。（获得潜行，持续 1 回合。获得 1 点攻击力。法伤 +1。减伤… | steps.kills.js buff.randomBlessing（回合开始经 delayed） | 生物图鉴 | H |
| `tt8-curseimmune` | 封印肢体1 | 生物 | 受缚之残影的封印肢体。入手时无效果，无法打出；集齐 5 张封印之牌后破除封印。 | engine SEALED_LIMB（封印之牌，无独立效果） | 生物图鉴 | H |
| `tt8-energycap` | 封印肢体2 | 生物 | 受缚之残影的封印肢体。入手时无效果，无法打出；集齐 5 张封印之牌后破除封印。 | engine SEALED_LIMB（封印之牌，无独立效果） | 生物图鉴 | H |
| `tt8-nofocus` | 封印肢体3 | 生物 | 受缚之残影的封印肢体。入手时无效果，无法打出；集齐 5 张封印之牌后破除封印。 | engine SEALED_LIMB（封印之牌，无独立效果） | 生物图鉴 | H |
| `tt8-healplus` | 封印肢体4 | 生物 | 受缚之残影的封印肢体。入手时无效果，无法打出；集齐 5 张封印之牌后破除封印。 | engine SEALED_LIMB（封印之牌，无独立效果） | 生物图鉴 | H |
| `foe-dragon` | 巨兽「荒渊」 | 生物 | 攻击 7 / 生命 40。变异·第5层精英。重击/特殊；第一回合蓄力不会攻击。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-boss_elem` | 异能领主 | 生物 | 攻击 8 / 生命 48。BOSS·能力者。词缀【元素庇幕】：偶数回合减免所有伤害（破甲可克制）。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `cmtn79743r2n` | 末日浩劫之门 | 生物 | 回合开始时对所有敌方角色各施加一层随机诅咒，优先不重复。 | steps.kills.js curse.doomGate（回合开始经 delayed） | 生物图鉴 | H |
| `cmtn6ulm4boj` | 步兵 | 生物 | 攻击力4生命4，优先为主人承受伤害，自动攻击敌人 | 随从模板（engine summonAlly 引用） | 生物图鉴 | H |
| `foe-grass_el` | 滋生异变体 | 生物 | 攻击 5 / 生命 12。变异·第5层。攻击并施加诅咒。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-fire_el` | 灼热异变体 | 生物 | 攻击 10 / 生命 7。变异·第4层。攻击并灼烧。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-esper_candle` | 烛火 | 生物 | 攻击 9 / 生命 6。反抗能力者·第4层。掌心烈焰：攻击并灼烧。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-orc_axe` | 甲壳变异体 | 生物 | 攻击 4 / 生命 7。变异·第3层。防御/反击型，隔回合蓄势。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-esper_crow` | 白鸦 | 生物 | 攻击 8 / 生命 5。联邦能力者·第4层。碎晶齐射：远程多段攻击。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-archer` | 联邦射手 | 生物 | 攻击 5 / 生命 3。联邦·第1层。远程攻击。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-infantry` | 联邦巡防兵 | 生物 | 攻击 4 / 生命 4。联邦·第1层。普通近战，行动无特殊之处。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-cavalry` | 联邦机动兵 | 生物 | 攻击 5 / 生命 6。联邦·第2层。蓄力攻击：隔回合强化一击。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-boss_general` | 肃清总督 | 生物 | 攻击 5 / 生命 50。BOSS·联邦。词缀【军威】：每个回合结束时攻击力 +2。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-water_el` | 腐蚀异变体 | 生物 | 攻击 7 / 生命 10。变异·第4层。防御/反击型，隔回合蓄势。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |
| `foe-esper_silence` | 静默 | 生物 | 攻击 7 / 生命 9。联邦能力者·第5层。声场压制：攻击并施加诅咒。 | rules unplayableReasonFor（不可打出）+ battle.enemy-phase.js | 生物图鉴 | H |

### 能力卡与封印（英雄机制）（12 张）

| id | 名称 | 类型 | 效果一句话 | 当前实现位置 | 操作族 | 评级 |
|---|---|---|---|---|---|---|
| `tt8-hero-descender` | 充能火山 | 能力卡 | 寂灭苍穹：法伤 +1，本局对战中，每消耗 1 张卡牌，施放 1 次‘火球’。 | steps.rules.js rule.consumeFireball（每消耗施放火球注册） | 能力卡与封印 | H |
| `tt8-hero-mage` | 博览者的狂语 | 能力卡 | 万法乾坤：法伤 +1，回合开始时发现 1 张卡牌。 | steps.rules.js rule.turnStartDiscover + buff.spellUp（回合开始发现） | 能力卡与封印 | H |
| `tt8-hero-sealer` | 受缚之残影 | 能力卡 | 深海封印：对战开始时，将本牌与四张「封印肢体」洗入牌库；手牌中集齐这 5 张封印之牌后破除封印，化为深渊主宰·妲莉薇特。… | engine injectSealCards/checkSealTransformation（硬编码 id） | 能力卡与封印 | H |
| `tt8-hero-guardian` | 圣剑化身 | 能力卡 | 诛邪圣剑：本局对战中，能量上限 +1，装备上限 +1。 | steps.tail.js res.energyCap + 装备上限（equipment equipCap 正则） | 能力卡与封印 | H |
| `tt8-hero-ranger` | 天剑诛魔·云阳 | 能力卡 | 断念：将天启剑与诛魔剑洗入牌库。 | steps.deck.js deck.insert（天启剑/诛魔剑洗入） | 能力卡与封印 | H |
| `tt8-hero-sword` | 无量仙剑·云风 | 能力卡 | 万剑归宗：抽 5 张牌，直接释放其中武术。 | steps.recovery.js draw.n（抽 5+autoPlayHandType 释放武术） | 能力卡与封印 | H |
| `tt8-hero-priest` | 浪掷风吟 | 能力卡 | 甘霖降世：置入随机卡牌直至手牌达到 6 张；其中每置入1 张法术，回复 3 血。 | steps.kills.js hand.fillRandom（置入至 6 张+每法术回 3 血） | 能力卡与封印 | H |
| `tt8-abyss-sovereign` | 深渊主宰·妲莉薇特 | 能力卡 | 旧日再临：抽牌直到有 6 张手牌；免疫诅咒，能量上限 +1，法伤 +1，所有可注能与必须注能的招式均视为已注能；召唤 4… | exec-play execPlay 打出侧登记（免疫诅咒/均已注能/召唤封印肢体） | 能力卡与封印 | H |
| `tt8-hero-assassin` | 白梅落影·妄 | 能力卡 | 遁入虚空：净化自身，潜行 2 回合；破隐一击伤害翻倍。 | steps.curse.js buff.stealth/purify + rule.stealthStrike | 能力卡与封印 | H |
| `tt8-hero-warlock` | 禁术解放 | 能力卡 | 无定横行：将四张禁咒洗入牌库，然后抽 2 张牌。 | steps.deck.js deck.insert（禁咒×4 洗入+然后抽） | 能力卡与封印 | H |
| `tt8-hero-summoner` | 花开两面 | 能力卡 | 元素潮汐：抉择：打开‘末日浩劫之门’或者‘天国之门’。两回合后，开启未选择的那扇‘门’ | exec-play execPlay 打出侧登记 | 能力卡与封印 | H |
| `tt8-hero-warrior` | 青龙化身 | 能力卡 | 真龙降世：本局对战中，将‘初始攻击’化为‘青龙偃月斩’。 | steps.rules.js rule.shaTransform（初始攻击化为青龙偃月斩） | 能力卡与封印 | H |

## 4. schema v2 键位缺口清单（按需求频次降序）

| # | 缺口 | 影响卡数 | v2 草案 | Motivating 卡 |
|---|---|---|---|---|
| G1 | onPlay 伤害 op 的目标/条件/区间泛化 | ~18+ | ``damage.target` 增 `randomEnemy`、区间 `range:[a,b]`；条件增伤 `cond:{foeHpBelow, foeHpHalf, foeStatus:'bleed'|'freeze', foeFullHp, selfStealth}`` | 斩杀（对 9 血以下）、惩击（半血 +50%）、致命穿刺（对流血 +2）、寒冰剑（对冰冻 +2）、不稳定射线（4-6）、冷冻射线（满血才冻） |
| G2 | 诅咒 op 族泛化（v1 只有 freeze/allEnemies） | ~40+ | ``op:'curse'` 支持 7 种诅咒 × {stacks, duration, target: chosen|all|random|self}，扩展 `randomKinds:n`、`burst:n`（毒伤引爆）、`double:true`、`extend:n`` | 血箭/毒箭/致命射线/花鸩/棘刺之地/坚冰结界/深渊诅咒 |
| G3 | 卡牌获取 op（discover 池与去向泛化） | ~35+ | ``op:'acquire'`：池 kind 枚举扩（type/named/class/cost/curse-capable/legendary），去向 `hand|deck|discover`，动作 `play|playKeep|dup|zeroCost|decay|noInfuse`` | 生命箭/寻宝/永恒绽放/三重火球（置入手牌）/铁甲阵（洗入费用-1）/禁术解放（禁咒×4 洗入） |
| G4 | 增益/祝福/能量 op（完全缺失） | ~30+ | ``op:'blessing'`（atkUp/spellUp/stealth/immune/dodge/reduce × stacks × duration）+ `op:'energy'/'energyCap'/'maxHp'/'deckCap'`` | 狂暴药水/法力药水/潜匿/聚能/邪能护体/混沌之眼/圣剑化身 |
| G5 | 装备域 schema（passive/aura/skill/container） | ~36 | ``rules.equip`：onEquip/passive.aura/passive.cond/battleStart/skill(container)/container.slots` | 长剑（+1 攻）、深海印记（诅咒条件）、毒杖（每法术附加中毒）、珍珠盒（容器）、连弩（主动技能） |
| G6 | 多段/重复触发的触发语义 | ~15+ | ``hits:{count|range|perFoe}` + `recast:{on:'kill'|'condition'|'lastHand'|'infused', times}` + 延迟段 `schedule:'nextTurn'`` | 连射/流星箭雨/余烬爆裂/饱和打击/正午决战/风暴火球/血蝠风暴 |
| G7 | 治疗/生命 op 扩展 | ~12+ | ``lifesteal:true`、`upTo:N`、`selfDamage:n`、`perFuelCost:n`（N 倍牺牲品价格）、`perSpellHeal:n`` | 噬血术（吸血）/沐愈光辉（回复至）/恶魔之力（自伤）/圣光治愈（按燃料费折算）/诅咒之剑（回合开始 -2 血） |
| G8 | 费用修正扩展 | ~10+ | `costModifiers 增 `{kind:'typeCostRule', type, cost}`（全局旗）、`{kind:'movesPlayedDiscount', perMove}`；手牌变形 0 费/费用交换` | 银河之旅（全武术 1 费，registerBattle meleeCost1）、追斩/连击箭、魔法新发现（发现变 0 费）、迷之匣（发现两招式交换费用） |
| G9 | 消灭/击杀/墓地 op | ~8+ | ``op:'execute'`（atk/maxHp 阈值 × count）+ `trigger:'onKill'`（armor/coins/recast）+ 墓地计数 `graveyard:{type, perCard:+n}`` | 吞噬/TNT/斩杀/破甲重斩/闪金之锤/雷殛（墓地增伤） |
| G10 | 抽牌/手牌 op 扩展 | ~10+ | ``untilHandN`、普通战口径 `grantSha`、`handOps:[{op:'consumeHand'|'dumpHand'|'copyRandom'|'keepInHand'|'noInfuse'}]`` | 法力补给/金蝉脱壳/刀剑形态/不朽斩/血毒双镖（二次点选） |
| G11 | 召唤 op | ~3+ | ``op:'summon'`（name/atk/hp/count/statless）` | 征召（步兵 4-4 ×2）、受缚之残影（封印肢体 statless）、随从模板「步兵」（cmtn6ulm4boj） |
| G12 | 变形/规则改写 op | ~8+ | ``op:'transform'`（sha 化身/手牌复制/随机变形）+ `op:'registerRule'`（consumeFireball/allSpellsInfused/growth/nextSpellTimes/extraTurn）` | 不朽神剑/青龙化身/神秘药水/命运钟表/元素风暴/充能火球 |
| G13 | 时点触发器（onPlay 之外） | ~25+ | ``triggers` 增 `onTurnStart`（repeat/duration）、`onBattleStart`、`onConsume`、`onDraw`、`onInfused`、`onKill`、`onDiscover`` | 花瓣法阵/急救合剂/沉船宝盒/百炼青虹剑/禁咒系（抽到即施放）/迷之匣（对战开始） |
| G14 | 经济/材料扩展 | ~6 | ``base.material.kind` 扩枚举；`op:'coins'`` | 闪金之锤（击杀 +2 币）、金矿事件、经济卡包 |

> 影响卡数为「该缺口为其主或副效果实现依赖」的估算下限（按 §3 逐卡表统计），彼此有重叠。

## 5. 迁移分批建议（11 批，先易后难）

| 批 | 内容 | 张数 | 风险 | 前置缺口 | 备注 |
|---|---|---|---|---|---|
| B1 | 纯伤害招式（无副效果）：单体/全体/区间/条件增伤 | 22 | 低 | G1 | v1 damage op 泛化后批量迁；有 battle.preview.js 伤害预览回归兜底 |
| B2 | 多段与重复招式 | 14 | 低 | G6 | hitCount/retarget 语义 v1 已验证，扩展 recast/schedule |
| B3 | 治疗/护甲/自伤/吸血 | 16 | 低 | G7 | heal/armor op 扩展；注意 healban 禁疗口径统一 |
| B4 | 抽牌/手牌操作 | 12 | 中 | G10 | boss/普通战双口径（draw vs grantSha）必须结构化表达 |
| B5 | 诅咒族（含随机诅咒/毒爆/延长） | 22 | 中 | G2 | v2 最高频缺口；与 combat.js CURSE_META 枚举对齐 |
| B6 | 卡牌获取与牌库 | 25 | 中 | G3 | 池谓词复用 parsePoolNoun 语义；注意 isRandomObtainable 口径 |
| B7 | 增益/能量/形态 | 12 | 中 | G4 | blessing 与 duration 语义（持续 N 回合/本回合/本场） |
| B8 | 费用操作 | 8 | 中 | G8 | 与 battle.card-cost.js 的 4+3 种规则对齐，防双算 |
| B9 | 装备/容器/被动 | 36 | 高 | G5 | 涉及 equipment/bag/session 三层；建议拆 B9a（aura/passive）+ B9b（skill/container） |
| B10 | 消灭/召唤/墓地 | 8 | 高 | G9/G11 | execute 与 onKill 钩子涉及死亡结算顺序（stagedDeathFx） |
| B11 | 变形/规则改写（可结构化子集） | 6 | 高 | G12/G13 | 先迁 growth/nextSpellTimes/extraTurn；transform 类暂缓 |

批内合计约 181 张（可结构化目标面）；其余约 91 张落在 §6 白名单（事件/图鉴/英雄/演出/跨域联动）暂不迁移。批序原则：先纯函数效果（B1-B3），再带状态/池子（B4-B7），最后跨域（B8-B11）；每批迁移后跑 `npx vitest run --no-file-parallelism` + 对应回归（battle.resolution/effect-verbs 快照）。

## 6. 保留手写白名单建议（豁免结构化）

| 卡/组 | 豁免理由 |
|---|---|
| tt8-hero-*（11 张）+ tt8-abyss-sovereign + 封印肢体×4 | 封印/化形是编组-牌库-手牌三域联动演出（battle.engine.js 硬编码 id 检测），结构化收益≈0、回归风险极高 |
| foe-*（25 张生物图鉴） | 不可打出，行为在 enemy-phase/mapData/affix（军威/狂乱/元素庇幕），属于敌方数据域而非玩家牌效 |
| tt6-*/ev19-*/cmtn7qttxqo4（19 张事件） | 地图侧 eventChoiceSpec V2（game.run.flow.js）带 UI 抉择与跨系统写入（宝箱/币/材料），非战斗牌效 |
| tt3-magic-lamp / tt7-bladebloom | 抉择面板与 playKeep 流依赖 discovery UI 队列；结构化需引入 choice 子 schema，首版不划算 |
| cc-mana-surge / tt3-noon-duel / tt3-fate-wheel | 慢动作演出/延迟段演出/额外回合（staged playback、回合调度）与结算强耦合 |
| cmtn1wnhhym / tt2-jianghu / cmtn28jv33wx | battle.resolution.js 专支：随机临时卡+回合消耗、BOSS 牌库底真发现，语义独特且已稳定 |
| tt2-apollo（阿猫的礼物） | 全局 onAcquire 钩子（fireCatGift）横跨战斗/地图/商店三层 |
| tt2-pearlbox / tt7-stratagem / tt-econpack / tt-token-color / cmtmvq6ss84l | 容器/合成/仓库语义在 bag/session 域（战斗外），v2 战斗牌效 schema 边界外 |
| tt7-bloodpoison | 双段异目标点选（dart 交互态）是交互层机制，非纯牌效 |
| tt3-mystery-potion | 三随机分支 + 回合变形，等效微型抉择树 |
| cc-cursed-blade | 手牌诅咒聚合（在途：battle.layers.js 正被另一代理修改，结论以其实际改动为准） |
| pet-egg | 宠物孵化，独立游戏系统 |

## 7. 附注：统计口径与复现

- 卡池模拟：空 localStorage 冷启动按 `ensureTabletop()` 全序播种 + `ensure*BaseMaterialRules/OnPlayRules/MultiHitRules/StatusRules/BagUseRules/TT12*` 回填，得 272 张、21 张 v1 rules（与源定义 21 张一致）。
- 家族归属与实现位置：按 §3 每卡标注；`resolution/equipment/bag/engine/exec-play` 等为 `game/src/battle/` 下同名模块，`steps.*` 为 `effect-steps.*.js` 步骤表分节，`game.run.flow.js` 为 `game/src/run/`。
- 抽牌普通战口径：`drawCards`（BOSS）vs `grantSha`（普通战发初始攻击），v2 需把这一双口径显式化（G10）。
- 沉默门：`battle.resolution.js` 中沉默只封技能句不封伤害；结构化迁移需保留该语义。
- 在途文件：`battle.layers.js`（cc-cursed-blade 诅咒聚合，另一代理修改中）。
