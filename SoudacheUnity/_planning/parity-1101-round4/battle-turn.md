# 敌方回合交互续接

2026-11-01。基线为已验收 GUID `cfbe07ccdc1147f28801339933512ee0`，780脚本/元数据、3945构建输入。Root 已确认本片最小续接方案及一个快照字段；生产与领域/原生检查源码已冻结，未编译、测试或启动 Unity。本记录不把源码条件当运行复现，最终字节清单见 `battle-turn-freeze.json`。

## 合法实卡链与当前提前推进条件

牧师可用本职业 **星辰占卜**（tt13-stellar-divination，1费法术），发现非职业的 **神灯**（tt3-magic-lamp，史诗法术），将两张具有“抽到时施放”的复制洗入牌库。再装备可随机获得的非职业 **逆鳞护甲**（tt13-scale-armor，史诗装备）。敌人造成非致命实际伤害后，逆鳞反击并以50%概率抽一张；抽到上述复制时自动施放神灯，出现正式三项抉择。无需自定义规则、跨职业拥有或假接口。

来源：

- Vite `src/cards/builtin-card-execution.js:167`、`builtin-equipment-execution.js:45`；当前卡面见 `cards.data.js:429,735-770`。Unity 对应 `CardDatabase.cs:71,290,293`。
- Vite `battle/effects/card-semantic-operations.js:26-29` 将 discoverCopies 限定为可随机获得的法术；神灯无 cls/unrandom，符合当前正式池。Unity `StructuredRules.cs:499-501` 同样从该池发现并 AddDeckCard+castOnDraw 标记。
- Vite `equipment-semantic-operations.js:18-30` 同步完成各装备反击和抽签；`battle.draw.domain.js:175-185` 将抽到副本送正式出牌队列。Unity `StructuredRules.cs:843-855,886-899` 现在在受伤响应内部同步 ExecPlay，因此会立即产生抉择。
- Vite `battle.enemy-phase.domain.js:307-343` 在命中及附加行为后等待反馈与 awaitTriggeredActions；`battle.turn-continuation.js:30-60` 等待正式队列、automatic batch、choice/discover/handSelect/interaction，再恢复归属敌方阶段。挂起期间临时 player/busy=false，但 turnEndPending 阻止普通独立操作。`battle.draw.domain.js:47-87` 同样等当前交互和队列完成才取下一实体。
- Unity `BattleSession.cs:1091-1131` 的 hit/敌人外层没有检查这些待选输入，继续下一 hit/敌人，并进入 `AfterEnemies`；`:1171-1199` 会递增回合、补能、结算回合开始与抽牌。即使 RuleChoice 仍存在，外层也已推进。该条件是当前源码事实，尚未运行本片复现。

从上述神灯还可合法延伸至 rulePick：选“发现招式并释放”→非职业史诗武术 **江湖救急**（tt2-jianghu）→明确的其它职业池选战士 **血毒双镖**。牧师不是战士，后者在这个特指池内合法（`cards.sync.m3.js:29`；Unity `CurrentBattlePools.cs:20-21`）。不以直接伪造牧师永久拥有战士卡代替此链。

## 已确认最小方案

保留通常同步推进，不建立每帧轮询/线程/通用异步框架。只有真实待选输入出现时，保存该回合的 acting 快照、当前敌人/原 plan/下一 hit 与后续位置，续接排在该命中产生的子链之下。确认或取消交互后恢复 enemy/busy，先重检死亡、冰冻与战斗终局，再继续同一回合。

私有 turn owner 持续拥有结束回合，阻止普通出牌、再次结束、装备主动、职业技能和道具抢占；当前归属的 choice、发现、手牌与 rulePick 保持可操作。Finish、逃跑与新会话清除旧续接和归属。

仅增加 `BattleSnapshot.TurnEndPending`，不加 Bridge 接口。HUD 在该 flag 且真实输入待选时显示“正在结束回合 · 等待选择”；常规 enemy/busy 继续显示敌方行动。普通独立控件呈现锁定，当前手选与选敌控件保留。

同批多件逆鳞要先完成正式装备反击/抽签，再按到达顺序执行抽到副本，不能简单在 equipment foreach 中途暂停而让玩家抉择的随机操作插到后续装备 RNG 前。现行同步自动施放还会让同次多抽覆盖上一抉择，因此抽到副本需要一个归属当前战斗的实体 UID 待执行队列；待执行实体不进入手选/注能候选，终局清理。这是保存现行队列语义所需的局部机制，不能制造替身卡或复制新的随机事实。

## 实装与性能边界

`BattleTurnContinuation.cs` 保存原 acting/plan/hit；每次恢复重检 current.dead/hp/freeze 与终局，避免已死狂乱敌人打出余下 hit。默认无输入时仍在同一同步循环中完成，没有每帧调度。只有实际输入暂停才分配外层 continuation。中毒实际伤害按现役 Vite notifyPlayerDamaged 接同一反应钩，在敌人行动前等待。

`BattleDrawnCasts.cs` 只持有真实到达 UID/目标/token；同次受伤的反击、抽签和命中附加行为先完成，再排入自动副本。其余副本不会在待选期间成为材料，完成或终局清队列。首脑满手时，抽到施放副本按 source 在手牌容量门之前处理，不以无须入手的复制占用手牌格。没有扫描全卡库；队列处理与真实复制数成正比。新增终局检查用 List.Exists，取首个活目标用 List.Find，保持原 Alive 的 `!dead` 顺序，避免每个检查创建 Alive 列表。

回合开始的正式花瓣法阵 draw→heal 也可遇到星辰副本：注册触发器与 due jobs 在输入点排续接，先完成该子链再推进下个容器/余下回合开始步骤。非交互路径仍按原数组顺序执行。没有把未核实的旧文本 Discover/任意自定义触发组合改成新框架。

界面使用 `TurnEndPending` 锁普通手牌、回合按钮、道具、职业技能和装备主动，归属选择正常可用。同标签连续神灯抉择以 RuleChoice 引用与 token 重绑，旧 UnityEvent 不能消费下一抉择。取消 rulePick 继续原 owner；Finish/强制逃跑/新会话清 owner，续接另有 token/over 守卫。

## 已写回归源码，尚未运行

- 领域入口保持 `_planning/parity-1031/battle-check/BattleChecks.csproj`，增加 `Round4Checks.cs` 与 Program 调用。先以完整现役卡库确认星辰的神灯池、神灯的江湖救急池和牧师的其它职业血毒池合法，再仅裁剪测试候选目录，保留所有内建定义，正式执行星辰发现、复制洗入、逆鳞受伤、神灯抉择及嵌套发现/二段目标。裁剪仅为确定性分支，不证明自然候选分布。
- 同敌多 hit/多敌、同批两逆鳞与两真实副本、完整 RNG 次序、独立命令拒绝不扣费、冻结后跳过余下 hit、执行当前已伤狂乱敌人后另敌只继续一次、首脑满手副本、花瓣 draw→待选→heal、rulePick 取消/迟到目标、毒伤反应、终局/强制逃跑/旧 token 均有必要断言。装备始终遵守正式容量2：双逆鳞组只装备两件，主动丝袋锁由单逆鳞+丝袋组验证。
- 原生为全局 `CurrentBattleRound4Checks.Run()`（IEnumerator），公开 `Assertions` / `Step`；由 Root 的统一 driver 调用。沿正式 BattleRequested/Bridge/Session/UI，明确构造合法星辰结果的两个 granted 神灯 UID 与 castOnDraw 标记，不改全局卡库/规则或增加生产接口。回合前置总由正式 BattleView.Commands.EndTurn 构造，立即断言 turnEndPending/choice/HP；后续抉择走真实 ISubmitHandler，核等待文字、普通手牌/结束/技能/物品/装备锁、当前选择可用、同标签新抉择旧事件失效、冻结后恢复、跨场旧按钮及强制退出清理。不宣称结束按钮的成功点击或物理输入已验，不按焦点切换输入路径。严格分双逆鳞与单逆鳞+丝袋两个合法装备场景；实际会话 RNG 引用、焦点、快照和队列仅记诊断。

Root 集中运行领域后，再执行全局原生入口；本片没有运行。构造不证明自然掉落/牌序、物理鼠标射线、完整九回合或全卡组合。独审分别见 `battle-turn-independent-review.md`（Hub）及 Run 的检查源审查记录；已采纳死敌余下 hit 和装备容量夹具两项确证修正。

Root 首次原生到达 Battle 的 `native-round4-3` 在等待 reactive choice 时超时；该结果不是领域通过可替代的成功。诊断与最小夹具修正见 `native-reactive-choice-diagnosis.md`。生产与 Ready 判据保持冻结；只修正后台回合前置并加现场事实断言，等待 Root 再统一运行。

## 注能赋值闭包

当前只有 `BattleSession.PlayCard` 的两处赋值能创建非 null infusing；其入口在 turnEndPending 时拒绝，而 EndTurn 也拒绝已有 infusing。generated/release/handSelect/acquire-play 都走 CastRuleHandCard→ExecPlay，不创建该状态；抽到复制的强制注能未满足则保留原手牌。因此本片正式 owner 链内 Infusing 不可达，等待文案不包含它，也没有制造假入口或回退。真实可达 choice/discover/hand/rulePick 均维持可交互。

不接缺失的可选 Nest 符文：当前 Unity 读取已明确该状态不存在，不能为了“不屈符文”构造本机未实现入口。也不把所有自定义触发器、旧网页规则或全场任意组合纳入本片完成证明。
