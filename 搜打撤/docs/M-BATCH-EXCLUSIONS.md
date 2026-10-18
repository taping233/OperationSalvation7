# M 批排除清单（51 张，老板 2026-09-27 拍板）

- 基线：HEAD `a8e91e6`，生产卡库 272 张（71 有 rules / 201 legacy）。数据源 `docs/evidence/e8-card-migration-2026-09-27/legacy-201-scratch.json`（201 张全量）。
- 排除口径：这 51 张的效果**已由各自专属系统实现**，不进规则化（card-rules schema/解释器）目标池；其余 150 张见 `docs/M-BATCH-MATRIX.md`。两清单合计 201，与 legacy-201-scratch.json 逐 id 对齐（末节自校验）。
- 行号均按 HEAD `a8e91e6` 工作区实读核实（rg/读码），非转抄。注意：工作区另有并行未提交改动（`game/src/battle/battle.core.js`、`battle.layers.js`、`battle.resolution.js`、`game/src/hub/game.hub.depart.js`、新增 `game/src/battle/effect-steps.m1.js`），本文引用不受其影响，但若行号漂移以语义定位为准。

## 组 1：foe-* 敌人定义卡（18 张）

排除理由（全组通用）：`type:'生物'` 卡是**敌人图鉴**，`unrandom` + `衍生`稀有度双重排除，不进商店/发现/随机池，也无法在对战中打出（`game/src/cards/cards.data.js:377-381` 注释；随机池口径 `game/src/cards/cards.js:45` isRandomObtainable；编组/手牌过滤 `game/src/battle/battle.lifecycle.js:240,254,295`）。敌人真实数值与行为消费在 **`game/data/map.json` 的 `monsters` 表（id 无 `foe-` 前缀）与 `bosses` 表**，普通怪经 `game/src/run/game.run.scenes.js:206,217`、`game/src/run/game.run.flow.js:794,802` 读取；BOSS 词缀宿主旗标在 `game/src/battle/battle.core.js:131-133`。

| id | 名称 | 排除理由 | 效果真实消费入口（文件:行号） |
|---|---|---|---|
| foe-infantry | 联邦巡防兵 | 敌人图鉴；敌人数值由 monsters 表实现 | map.json `monsters.infantry`（atk4/hp4/behavior:strike）；选取 game.run.scenes.js:217 |
| foe-archer | 联邦射手 | 敌人图鉴（远程攻击） | map.json `monsters.archer`；行为结算 game/src/battle/battle.enemy-phase.js |
| foe-bandit | 反抗组织拾荒者 | 敌人图鉴（成群出现） | map.json `monsters.bandit`；成群：game.run.flow.js:794（暴雨劫道 ×3~5） |
| foe-cavalry | 联邦机动兵 | 敌人图鉴（蓄力攻击） | map.json `monsters.cavalry`；蓄力行为 battle.enemy-phase.js |
| foe-orc_jav | 反抗组织掷弹兵 | 敌人图鉴（远程投掷） | map.json `monsters.orc_jav` |
| foe-wolf_rider | 变异雪狼 | 敌人图鉴（蓄力攻击） | map.json `monsters.wolf_rider` |
| foe-orc_axe | 甲壳变异体 | 敌人图鉴（防御/反击型） | map.json `monsters.orc_axe` |
| foe-fire_el | 灼热异变体 | 敌人图鉴（普通攻击） | map.json `monsters.fire_el` |
| foe-water_el | 腐蚀异变体 | 敌人图鉴（防御/反击型） | map.json `monsters.water_el` |
| foe-grass_el | 滋生异变体 | 敌人图鉴（攻击并施加诅咒） | map.json `monsters.grass_el` |
| foe-esper_crow | 白鸦 | 敌人图鉴（远程多段） | map.json `monsters.esper_crow` |
| foe-esper_candle | 烛火 | 敌人图鉴（普通攻击） | map.json `monsters.esper_candle` |
| foe-esper_silence | 静默 | 敌人图鉴（攻击并施加诅咒） | map.json `monsters.esper_silence` |
| foe-esper_echo | 回声 | 敌人图鉴（远程多段） | map.json `monsters.esper_echo` |
| foe-dragon | 巨兽「荒渊」 | 敌人图鉴（精英；首回合蓄力） | map.json `monsters.dragon`（elite:true/behavior:dragon）；选取 game.run.scenes.js:206 |
| foe-boss_elem | 异能领主 | BOSS 定义卡；词缀【元素庇幕】已宿主实现 | map.json `bosses` 表（:470 起）；aegis 结算 game/src/battle/battle.engine.js:1205-1226,1480 |
| foe-boss_general | 肃清总督 | BOSS 定义卡；词缀【军威】已宿主实现 | map.json bosses（军威 :482）；回合结算 game/src/battle/battle.enemy-phase.js:285-289 |
| foe-boss_orc | 变异巢母 | BOSS 定义卡；词缀【狂乱】已宿主实现 | map.json bosses（狂乱 :497）；双重攻击结算 game/src/battle/battle.engine.js:1503 |

## 组 2：召唤物 / 封印肢体等配件卡（7 张）

排除理由：不作为独立卡被玩家打出，是宿主机制的**衍生场面物件/合成材料**，效果在宿主命名分支中实现。

| id | 名称 | 排除理由 | 效果真实消费入口（文件:行号） |
|---|---|---|---|
| cmtn6ulm4boj | 步兵 | 召唤物配件；由「征召」等文本召唤，非玩家打出 | 召唤实现 game/src/battle/battle.engine.js:904 summonAlly（随从位承伤/自动攻击）；召唤动词 game/src/battle/effect-verbs.js:66；卡注册 game/src/cards/cards.data.js:624 |
| cmtn79743r2n | 末日浩劫之门 | 召唤物配件（tt8-hero-summoner 抉择开启） | 门类卡选择注册 game/src/battle/battle.selection-flow.js:178；回合诅咒结算 game/src/battle/effect-steps.damage.js:190（curse.doomGate） |
| cmtn7err0a7 | 天国之门 | 召唤物配件（同上） | 选择注册 battle.selection-flow.js:178,186；祝福结算 game/src/battle/effect-steps.kills.js:222（buff.randomBlessing） |
| tt8-curseimmune | 封印肢体1 | 封印之牌配件；无法打出，集齐 5 张破封 | game/src/battle/battle.engine.js:1321（SEAL_LIMB_IDS）、1339（injectSealCards 洗入牌库）、1350-1377（checkSealTransformation 化形） |
| tt8-energycap | 封印肢体2 | 同上 | 同上（SEAL_LIMB_IDS 四元组） |
| tt8-nofocus | 封印肢体3 | 同上 | 同上 |
| tt8-healplus | 封印肢体4 | 同上 | 同上 |

## 组 3：事件卡（19 张，type='事件' 全部）

排除理由（全组通用）：事件卡只能经地图事件格触发，由**事件系统**消费（卡池过滤 `game/src/run/game.run.flow.js:268`，触发入口 `:280` → `triggerEventCard :421`）；V2 七事件+ev19 九事件的选项结算集中在 `eventChoiceSpec`（game.run.flow.js:661，V2 表 :672-754），ink 叙事分支效果在 ：756-817，旧版单按钮路径 `applyEventEffect :822`。各卡落点如下。

| id | 名称 | 排除理由 | 效果真实消费入口（文件:行号） |
|---|---|---|---|
| cmtn7qttxqo4 | 巷口修鞋匠 | 事件系统消费 | game.run.flow.js:824（applyEventEffect 唯一 case：碎片+复原） |
| tt6-mystery | 实验室余粮 | 事件系统消费 | game.run.flow.js:673（V2 表：碎片+2币） |
| tt6-systemsupply | 末班配送无人机 | 事件系统消费 | game.run.flow.js:676（碎片+木材卡） |
| tt6-demondeal | 隧道血契 | 事件系统消费 | game.run.flow.js:683（-5血+军用保险柜） |
| tt6-airdrop | 污染空投箱 | 事件系统消费 | game.run.flow.js:691（木材/口粮/能量饮料/药水四选一） |
| tt6-chestdraw | 熔断双箱 | 事件系统消费 | game.run.flow.js:703（大中小箱随机开） |
| tt6-goldhammer | 满电动力锤 | 事件系统消费 | game.run.flow.js:710（V2 表）与 ：799（goldhammer_strike 战斗分支） |
| tt6-goldmine | 塌方采掘点 | 事件系统消费 | game.run.flow.js:762-763（goldmine_safe/deep ink 分支） |
| tt6-bandits | 暴雨劫道 | 事件系统消费 | game.run.flow.js:786-797（bandits_fight：monsters.bandit ×3~5 战斗） |
| tt6-relief | 临时救护站 | 事件系统消费 | game.run.flow.js:771（relief_heal：回复 6 点） |
| ev19-vital | 高压急救 | 事件系统消费 | game.run.flow.js:713（生命上限+3 并回复） |
| ev19-pearlbox | 遗落的珍珠匣 | 事件系统消费 | game.run.flow.js:719（给予 tt2-pearlbox） |
| ev19-fireballs | 双焰走私 | 事件系统消费 | game.run.flow.js:724（给予火球×2） |
| ev19-classchest | 黑箱调拨 | 事件系统消费 | game.run.flow.js:730（职业密封物资箱） |
| ev19-recode | 故障重编 | 事件系统消费 | game.run.flow.js:735（openEventRecode 转换台） |
| ev19-potions | 避难市集药摊 | 事件系统消费 | game.run.flow.js:738（openEventPotions 三选一） |
| ev19-arrows | 海堤箭库 | 事件系统消费 | game.run.flow.js:741（随机非职业箭×2） |
| ev19-gamble | 地下商场黑市 | 事件系统消费 | game.run.flow.js:747（openEventGamble 赌博页） |
| ev19-quartermaster | 装备征用令 | 事件系统消费 | game.run.flow.js:750（openEventQuartermaster 三选一） |

## 组 4：资源卡（7 张，type='资源' 全部）

排除理由：资源卡是**经济/基地物资/孵化材料**，由仓库出售、宝箱掉落与基地系统消费，不走战斗规则引擎。

| id | 名称 | 排除理由 | 效果真实消费入口（文件:行号） |
|---|---|---|---|
| tt-copper | 铜币 | 货币卡，仓库出售变现 | 卖出价 game/src/cards/cards.js:103 sellPrice；仓库卖出弹窗 game/src/hub/game.hub.pages.js:276 |
| tt-silver | 银币 | 同上 | 同上（sellPrice/hub 卖出） |
| tt-gold | 金币 | 同上；且在收藏特殊名单 | game.hub.pages.js:22（SPECIAL_COLLECT_IDS 含 tt-gold）+ :276 卖出 |
| tt3-diamond | 钻石 | 同上 | 同上（sellPrice/hub 卖出） |
| tt3-garnet-marble | 石榴弹珠 | 同上（unrandom 修正见 cards.sync.js:356-366） | 同上（sellPrice/hub 卖出） |
| tt-econpack | 经济卡包 | 仓库界面专用使用入口 | game.hub.pages.js:22（SPECIAL_COLLECT_IDS）、:303（使用按钮）、:318,334（econpackUse 结算：5 张随机卡） |
| pet-egg | 宠物蛋 | 孵化材料，基地宠物系统消费 | 宝箱掉落 game/src/run/chests.js:111（保底爆率）；孵化弹窗 game.hub.pages.js:197-227（hatchEgg→B.hatchPet）；meta.js:177 |

## 自校验

- 组 1（18）+ 组 2（7）+ 组 3（19）+ 组 4（7）= **51**。
- 与 `docs/M-BATCH-MATRIX.md`（150）合计 **201**，与 `legacy-201-scratch.json` 全量 id 一一对应（差额 0，校验脚本见交付报告）。
