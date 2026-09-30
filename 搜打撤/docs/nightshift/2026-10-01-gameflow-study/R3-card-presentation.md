# R3 · 外部调研②:卡牌呈现、敌人意图可读性与新手教学

> 轮次:R3(2026-10-01 凌晨,夜班)。方法:本地 STS2 v0.107.1 反编译源码实证(`D:\素材\杀戮尖塔2源码\sts2-decompiled\`,仓库外只读)+ WebSearch 外部文章。只记录机制学习,不复制任何资产或文本。目的:为搜打撤的卡牌信息层次、意图系统、教学节奏提供可对照的成熟做法。

## 一、卡牌信息层次

1. **稳定版式是可读性的前提**(STS 通用版式,置信度中:通识+wiki):费用固定左上、名称固定顶部、类型横条固定底部、规则文本固定中部——位置即语义,玩家扫一眼就知道去哪找哪个信息。对照:搜打撤 VISUAL-BIBLE 已有信息层级 1-5 规范(当前决策>对象身份>关键数值>解释>装饰)与「卡牌等级、类型、费用、名称、规则正文和局内状态都要有稳定位置」条款(production/art/VISUAL-BIBLE.md),方向一致;差距在**验收执行**——BIBLE 的「一页式验收」没有按卡面逐项跑过的记录。
2. **「 readily perceive future problems」**(Cloudfall Studios 逆向工程文章):好的卡牌 UI 让玩家**预读到未来的麻烦**,而不只是解释当前这张牌——比如费用与当前能量的对比着色。来源:[Game Design Tips from Slay the Spire](https://www.cloudfallstudios.com/blog/2020/11/2/game-design-tips-reverse-engineering-slay-the-spires-decisions)。
3. **UI 是迭代出来的,初版差点杀掉游戏**(社区 postmortem):STS 的界面从原始版大幅重设计才达到「最小、一眼可读」。来源:[How Slay the Spire's Original Interface Almost Killed the Game](https://www.reddit.com/r/slaythespire/comments/bjwaav/how_slay_the_spires_original_interface_almost/)。启示:搜打撤的卡面/战斗 HUD 应把「实页可读性验收」当成迭代环节而不是一次性门槛。

## 二、敌人意图可读性(STS2 本地源码实证)

1. **意图是一个封闭分类学,不是自由文本**。`MegaCrit.Sts2.Core.MonsterMoves.Intents/IntentType.cs` 定义 15 种意图:Attack、Buff、Debuff、**DebuffStrong**、Defend、Escape、Heal、Hidden、Summon、Sleep、Stun、StatusCard、CardDebuff、**DeathBlow**、Unknown——每种意图一个图标语义,玩家学一次全会。
2. **危险分级**:Debuff 与 DebuffStrong 分开(普通/强警示两档);`DeathBlowIntent` 独立成类,且 `MonsterModel.cs:241-244` 的 `IntendsToAttack` 特判 `IntentType.Attack || DeathBlow`——**必杀意图比普通攻击更显眼**是写进类型系统的,不靠文案。
3. **连「不知道」也是显式状态**:`UnknownIntent`/`HiddenIntent` 有专门的类与图标(STS2 指南:灰色图标=意图存在但内容未知)。对照:搜打撤冰冻敌人已有「冰冻·无法行动」专用图标替代攻击预告(rules.md §4)——同构正确,但搜打撤意图词汇目前只有攻击预告与冰冻两类,扩敌种时建议直接按封闭枚举设计(借鉴分类学,不必照抄取值)。
4. **图标语义细分到「对玩家牌组做什么」**(STS2 指南:灰卡橙边=给你的牌上 debuff)。来源:[How to Read Enemy Intent in Slay the Spire 2](https://sts2.untapped.gg/en/guides/how-to-read-enemy-intent)、[Intent wiki](https://slay-the-spire.fandom.com/wiki/Intent)。攻击意图直接显示**具体伤害数字**(STS1 起的传统),把「我能不能扛住这一下」变成一眼算术。
5. **意图系统被开发者社区视为可复制的可读性范式**(RPG Maker 论坛开发者专门讨论实现)。来源:[Forecasting Enemy Intent](https://forums.rpgmakerweb.com/threads/forecasting-enemy-intent-slay-the-spire-like-battle-flow.113080/)。

## 三、新手教学节奏(STS2 FTUE 系统实证)

1. **教学按「首次遭遇系统」逐个触发,不做开场大课**。`MegaCrit.Sts2.Core.Nodes.Ftue/` 下 16 个独立教学节点,文件名即课程表:CombatRules、CanPlayCards、**CannotPlayCard**、PowerCard、Shuffle、MapSelect、Merchant、CombatReward、ObtainPotion、RelicReward、RestSite、AcceptTutorials 等——玩家第一次走到该系统才弹对应教学。
2. **负面状态也有专属教学**:`NCannotPlayCardFtue`(费用不够/不能出牌时)单独成课——失败与受限状态恰是新玩家最懵的时刻。对照老板流程第 13 节「失败说明」与第 12 节交互状态表的「禁用/失败」态。
3. **每个教学节点结构统一**(源码实证:`NCanPlayCardsFtue.cs` 的 `_header/_description/_confirmButton` 字段与 `CloseFtue` 方法):标题+一段说明+确认按钮,可关闭;`NAcceptTutorialsFtue` 提供教学开关。结构统一=成本低、风格一致。
4. 对照搜打撤:GDD 自认「新手引导…验证后再定」(production/design/GDD.md),现状无教学系统。FTUE 的**节点化清单**可以直接当搜打撤教学需求清单的模板:基地出征→移动→遭遇→出牌→不能出牌→背包→撤离→结算,每个一个最小课。

## 四、对搜打撤的三条直接行动建议(转 R4/R5)

1. 意图系统扩展时先定**封闭枚举**(攻击/强化/诅咒/防御/未知…),每种一个图标语义,DeathBlow 类危险意图显式升级——数据侧 `battle.intent.js` 已是纯计算模块(architecture.md),加类型字段成本低。
2. 教学按 FTUE 节点清单立项:**逐系统首次触发**,负面状态(费用不足、背包满、不能撤)必列,统一标题+正文+确认结构。
3. 卡面与战斗 HUD 把 VISUAL-BIBLE 的一页式验收落成**迭代检查单**,每次 UI 改动跑一遍(与 WF-acceptance-scenes 剧本库可合并)。

## 五、方法限制

- STS2 源码为反编译产物,仅用于机制学习;本报告只记录设计模式,不复制代码/文本/资产,亦不构成对商业作品的逆向建议。
- Balatro、Monster Train 的对应做法本次未深挖(时间与限流),R7 机动轮可补。
- 「卡牌信息层次」节的 STS 通用版式为通识级(置信度中),未逐条溯源。

## 来源

- [Cloudfall Studios:逆向工程 STS 设计决策](https://www.cloudfallstudios.com/blog/2020/11/2/game-design-tips-reverse-engineering-slay-the-spires-decisions)
- [How Slay the Spire's Original Interface Almost Killed the Game(r/slaythespire)](https://www.reddit.com/r/slaythespire/comments/bjwaav/how_slay_the_spires_original_interface_almost/)
- [Intent – Slay the Spire Wiki](https://slay-the-spire.fandom.com/wiki/Intent)
- [How to Read Enemy Intent in STS2(untapped.gg)](https://sts2.untapped.gg/en/guides/how-to-read-enemy-intent)
- [STS2 Intent(wiki.gg)](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Intent)
- [Forecasting Enemy Intent(RPG Maker Forums)](https://forums.rpgmakerweb.com/threads/forecasting-enemy-intent-slay-the-spire-like-battle-flow.113080/)
- 本地源码:`D:\素材\杀戮尖塔2源码\sts2-decompiled\MegaCrit.Sts2.Core.MonsterMoves.Intents\IntentType.cs`、`MegaCrit.Sts2.Core.Nodes.Ftue\`(16 节点)、`MegaCrit.Sts2.Core.Models\MonsterModel.cs`
