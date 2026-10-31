# 当前战斗 Core 独立审查

结论：当前原始源码与独立编译的 Unity Core 快照存在 3 个现行内置卡 P1 行为差距、3 个已支持结构化规则 P2 消费者缺口。没有使用历史 passed 作为结论；生产文件零修改。

## 方法与边界

- `source.mjs` 通过私有 Vite SSR 加载现行 `cards/cards.js` 并执行 ensure 链，重新导出 291 卡；通过现行 `createBattleEngineInstance` 的 start → submitCardPlay → payment picker → actionQueue 实际结算。
- `Audit.cs` 读取同一批源引擎输出的输入卡面与 rules，用 `snapshot/` 的真实 37 个 Core C# 源独立 net8 编译、Start/PlayCard/SelectDeckCard/ConfirmDeck 实际结算。输出、编译 obj/bin 均私有。没有镜像重写执行器。
- 固定 seed=123，角色 Atk=4、SpellPower=2、HP=30/60、能量=2；敌 HP=100、Atk=2。普通战通过自然携带手牌启动。首脑向量真实编组启动后，仅将已存在的合法牌 UID 条件化为指定手牌并从抽牌堆移走，测试同一有条件状态下支付规则，不声称验证随机开局抓到这些牌的概率。
- `source-results.json` 含完整输入卡、初始手牌/条件、实际输出；`core-results.json` 含同输入的实际 Core 输出。源 677 个 JS/JSON 输入与 Core 37 文件 SHA-256 在 `inputs-sha256.json`；Core 审查对象固定为 `snapshot/`，主会话之后修复不改变此历史证据。
- 仅后台审查；没有 Unity、前台、浏览器验收。没有全 291 卡全场景正确性结论；已完整导出目录并按候选定向实际执行。

## P1-1：快意恩仇在合法手牌下无法使用

向量 `grudge`、`grudge-boss`：o0=tt7-thundergrudge，o1/o2=starter-attack。

源：submitCardPlay(o0,0) 进入 mandatory payment，依次 pickHandSelect(o1/o2)；二者入 consumed；敌 HP 100→88，能量 2→1，手牌为空。

Core：PlayCard(o0,0,false) 返回 false / 手牌不满足使用条件；手牌3张保留，敌HP100，能量2。

原因：源 `battle.hand-selection.js:61-65` 将“初始攻击/杀”按卡名匹配；`battle.exec-play.domain.js:60-83,155-165` 与 `battle.selection-flow.domain.js:218-265` 共用合法支付判断。Core `snapshot/Battle/StructuredRules.cs:237-245` 将 requirement.type 与 card.type 直接比较，而初始攻击实际 type=武术。现行卡从入口就被永久拒绝。

## P1-2：铸甲不支付装备代价

向量 `armor`、`armor-boss`：o0=tt2-turtlearmor，o1=现行装备卡（完整输入见JSON）。

源：先选择支付装备，o1从手牌移除并入consumed，获得10甲，能量2→1。

Core：直接获得10甲，能量2→1，o1仍在手牌，consumed为空。装备可以继续使用，且源支付触发链不会发生。

原因：源 `battle.exec-play.domain.js:235-267` 在扣能量/打出卡前原子确认支付、移除牌、登记 consumed、调用 fireConsumeTriggers；Core `snapshot/Battle/BattleSession.cs:732-770` 只处理 infusion fuelUids，并无 handCards payment，StructuredRequirement 只是计数。与P1-1应统一移植支付入口，而非只放宽卡类型检查。

## P1-3：飞身劈本次流血附伤缺失

向量 `fly`：o0=tt3-fly-arrowhawk，敌bleed=3。

源：伤害=3+Atk4+bleed3+本次额外bleed3=13；敌剩87。Core：伤10；敌剩90。

源真实消费者：`battle.damage.domain.js:91-96` 对 `doublesLegacyBleed(card)` 本次补一份流血；现行规则只有damage操作，不能从rules JSON完整性推断已经迁移。Core `snapshot/Battle/StructuredRules.cs:495-540` → `BattleSession.cs:927-938` 没有该消费者。

该卡现行效果仅本次攻击翻倍流血附伤；不能修成持续注册bleedAmp。

## P2：schema已注册规则缺少真实消费者

这三项均用 schema 支持的最小自定义规则卡（0费法术、onPlay registerRule）经真实 submitCardPlay / PlayCard 注册，没有直接注入 flag。

| 向量 | 随后操作 | 源实际 | Core实际 |
| --- | --- | --- | --- |
| bleedAmp | 敌bleed3，打starter-attack | 伤10，敌剩90 | 伤7，敌剩93 |
| spellCost1 | 查询2费飞身劈、2费致命射线 | [2,1] | [2,2] |
| meleeCost1 | 查询同两张牌 | [1,2] | [2,2] |

源 `effect-steps.m2.domain.js:216-237` 设置真实效果字段，`battle.card-cost.js:40-41` 与 `battle.damage.domain.js:94-96` 消费。Core `snapshot/Battle/StructuredRules.cs:479-490` 仅加入persistentRules，费用仅对moveCost1分支设置共用布尔，伤害没有bleedAmp消费者。HUD的bleedAmp投影不证明结算生效。

鲜读291内置卡的现行rules没有使用这三个键；银河之旅现行为moveCost1，不能把旧meleeCost1快照当现行缺陷。这三项影响结构化执行器支持面/自定义卡，和上述现行内置卡P1分开判断。

## 重跑

本目录执行 `node source.mjs` 后 `dotnet run --project Audit.csproj --no-restore`。后者固定运行审查时快照；复验修复须另建私有生产快照并与这批源输出比较。首次构建可使用 `dotnet restore Audit.csproj --ignore-failed-sources`（无第三方包）。

首次测试过程中修正了夹具的源self目标参数（源为'self'，Core为-1）、普通战初始攻击需真实携带，以及Core选牌API名称。最终8向量两个进程均退出0。最终输出文件为判断依据，不采用早期夹具错误输出。
