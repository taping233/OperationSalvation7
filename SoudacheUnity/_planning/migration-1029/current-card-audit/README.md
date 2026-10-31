# 当前卡牌与关键首脑行为独立审查

结论：当前 Unity 291 张卡牌的定义与本轮从现行 Vite 执行导出的定义一致，但战斗执行仍存在 11 组语义缺陷。85 条状态断言中 18 条失败，另外 64 条关键首脑状态断言全部通过。此结论不能解释为 291 张卡的全部玩法均已验收。

审查于 2026-10-30 冻结。仅写本目录；生产源码只读。未运行 Unity、共享 compile、前台程序或浏览器，未修改 Agent、旧档或研究地图。修复由主会与 card-semantics-fix 接手。

## 证据与复现

- `first-failures.json`：首批四组失败，保留原始输出。
- `nine-group-failures.json`：扩展至九组的原始失败。
- `unity-with-boss-vectors.json` / `unity-final-baseline.json`：85 条语义断言，18 失败，11 组问题；均为修复前当前源码独立编译执行。
- `source-results.json` / `source-oracle.mjs`：直接加载现行 Vite 模块执行的语义对照，含随机置入、弃牌、同类型转换、伤害事实、星盘相位、偷攻归还、毒伤、火焰形态叠加、抽到时牌区、毒伤封顶与死灵倍率。
- `boss-source-vectors.json`：复用现有 exporter，在本目录重新从现行 Vite 执行取得；`BossAudit.cs` 独立按实际状态比较。
- `catalog-comparison.json`：现行 Vite 291 张与编译后的 Unity 291 张逐张比较 17 个字段，包括完整 rules，零差异。它验证定义同步，不验证执行完整性。
- `first-source-hashes.json` / `final-baseline-source-hashes.json`：修复前生产输入指纹。

复现命令（工作目录 `SoudacheUnity`）：

```powershell
dotnet run --project _planning/migration-1029/current-card-audit/Audit.csproj --configuration Release --no-restore --verbosity quiet
node _planning/migration-1029/current-card-audit/source-oracle.mjs
node _planning/migration-1029/current-card-audit/compare-catalog.mjs
```

`Audit.cs` 对每条断言输出 actual / expected / equal，便于一次查看全部差异；发现差异时程序本身仍退出 0，因此必须检查 equal，不能以退出码代替验收。夹具将卡牌运行时费用设为 0，以隔离效果状态；星盘检查单独比较能量增量。需要精确设置毒层、护甲、敌攻或单一抽牌来源时使用反射设置夹具，不替代生产效果实现。

## 确认缺陷

位置对应冻结前源码；修复后行号可能变化。以下除明确标注静态源码对照者，均已执行 Unity 状态断言与相应 Vite 模块对照。

| 组 | 玩家条件与 Unity 实际结果 | 现行 Vite 期望 / 建议修点 |
| --- | --- | --- |
| 1 护身 | 初始攻击命中后打出 `tt13-guard`，仍获得 10 甲 | 应 6 甲。`StructuredRules.ApplyRuleOperation(armor)` 的伤害事实当前仅在 `OnStructuredPlayerDamaged` 写入，需记录本回合对敌有效伤害。 |
| 2 双相星盘 | 同回合装备后依次武术、法术、武术，回能 `[1,1,1]` | 应 `[1,0,0]`，按装备首回合的武术相位、后续逐回合法术/武术相位，每回合首张匹配牌回能一次；修 `CompleteRuleCast`。 |
| 3 浪掷风吟 | `tt8-hero-priest` 从原牌库抽出 5 张初始攻击，耗尽后只有 5 张手牌 | 应随机置入至 6 张，牌库不变，每置入一张法术治 3。修 `fillHand`；源夹具强制随机池返回火球时，得到 6 火球、回复 18、抽牌 0 次。 |
| 4 混乱套牌 | 其他手牌进入 consumed；5 张武术转换中出现 2 张法术，费用直接采用旧牌费用 | `trigger:false` 应弃至 discard；转换保持招式/装备同类型，稀有度高一级至传说，再交换替换结果的费用。修 `consumeHand` 与 `TransformRuleCards`。 |
| 5 偷攻到期 | 影噬使敌 8 攻变 1；回合结束仍为 1，玩家 atkUp 仍为 7 | 敌攻归还 8、玩家临时攻击归零。修 `stealAtk` 的两侧到期记录。源运行覆盖敌方归还，玩家到期参数由 `resolveStealAtk` 调用 `addBlessing(..., duration)` 的静态链确认，未重造整个 Vite 回合引擎。 |
| 6 毒爆/花鸩 | 敌 100 血、毒 3、甲 5，毒爆后 99 血、甲 0 | 两次真实毒结算应为 94 血、甲 5。`adjustCurse` 当前调用普通固定伤害，应复用毒伤结算入口并维护死亡状态。 |
| 7 火焰形态叠加 | 打出两个火焰形态后支付 2 张注能材料，spellUp 为 3 | 应为 4；每个形态独立累计自身生效后的材料数。当前 registerInfusionBonus 单例字段覆盖多个实例。 |
| 8 直接释放牌区 | 剑荡妖邪选择初始攻击释放后，子牌已离手且不在 played | 应走正式出牌记账；手选、release、castDrawn、castOnDraw 等统一维护 UID、played、discard 与结算归属。此组 Unity 运行失败，Vite 对照为 `selection-flow`→`queueCardExecution`→`execPlay` 的静态正式源码链，未搭建完整 Vite 动作队列夹具。 |
| 9 抽到时衍生牌 | 禁咒 I 抽到触发后仍留手且未进入 discard | 非双剑的 onDraw 牌应触发后进入 discard；双剑保留在手用于组合。修 `OnStructuredDraw`，源 drawCards 实测 hand 空、discard 含禁咒、触发一次。 |
| 10 毒伤封顶/死灵倍率 | 毒 5、damageCap 2 结算 5；毒 3、necroticExposure 4 结算 3 | 应分别为 2 与 12。修 `CombatResolver.TickPoison`，应用当前伤害封顶与死灵最终承伤倍率；自然回合毒伤同样受影响。 |
| 11 狂乱无伤附咒 | 50 甲吸收狂乱两击后，仍附加 2 层诅咒 | 应为 0。Unity `EndTurn` 应像 Vite `enemy-phase` 一样，仅在 dealt > 0 时调用 frenzyCurse。本组源对照为现行源码明确条件，Unity 已执行零伤害状态复现。 |

## 已覆盖与未覆盖

当前卡库无 rules 的 60 张均为资源 7、事件 19、生物 34；可打出的非装备卡均有结构化 onPlay，装备由结构化装备入口拦截，因此 `BattleSession` 中“M1 后续实装”日志不是现行卡库已证实缺陷，保留为历史代码可达性说明。

64 条关键首脑断言包括：见证会教皇 32 组伤害类型/沉默/禁疗/致死后状态；直接伤害封顶及死灵倍率 18 组；畸变母体标准/精英模式第 2/4/6 回合共 6 次召唤实体状态；死灵第 3/6/9 回合牌堆与墓地共 3 组；将军增长、拦路人全场开咒与清除一层、看守偶数回合免伤和破甲穿透。对应状态全部通过。狂乱零伤与自然毒伤的补充失败见上表。

未覆盖：291 卡逐卡所有选择组合、所有结构化操作参数与嵌套交互、长期战斗/完整局结算、卡牌 UI 与输入流程、原生 Unity 编辑器及播放器、实际 Unity 编译 DLL 的行为。测试编译输入为当时当前 Core 源码；未采用旧报告结论，也未验证修复后版本。页面和首页现行版本差异不在本次后台 Core 审查范围。
