# 完整玩家流程：下一片最高价值核查

2026-11-01，只读审查完成；未编译、测试或启动 Unity。依据现行 MIGRATION.md、24类页面版本矩阵的入口索引、parity-1031 与第二轮实施/验收记录及当前源码。矩阵是迁移前指纹基线，不是24类页面所有动作已完成的证明；896项领域、既有/新增原生和61图构造流程也不能推导所有规则组合与失败分支均已验证。

本轮先收敛三项。主会话随后授权 Battle 继续实施第2/3项；第1项由 Root 持有。下述代码判断与尚未运行的复现分别注明。

## 1. 单档备份与自定义卡候选的定义闭包

归属：Root（SaveSystem.SlotArchive / CardLibrary），Run 协助未领奖励凭据；Battle 不修改。

当前源码证据：

- `Assets/Scripts/Sdt.Run/SaveSystem.cs:154-156` 把自定义卡存在 profile global 的 `sdt-cards-v1`；`GameRuntime.cs:157-158` 接入 CardLibrary loader/saver；`Cards.cs:91-109` 将自定义卡纳入当前 All / FindById。
- `GameRuntime.Map.cs:169-178` 的资源奖励从当前 CardLibrary.All 抽取，但凭据只保存 rewardCardIds；回显重新 FindById，`:179-184` 领取也从 ID 重新取卡。箱子同类路径见 `GameRuntime.CurrentNodeRewards.cs:47-60`。
- `SaveSystem.SlotArchive.cs:19-22` 仅打包 base/run/settlement，`:60-78` 导入也只写三分区，不带自定义库。该行为保全目标 global 是正确边界，但不保证包内尚未领取的 ID 都能独立解析。
- 第二轮 `_planning/parity-1101-round2/run-check/Program.cs:60-75` 已证明自定义资源卡进入现役候选及保留 RNG，但仅替换内存 catalog，未执行跨 profile 的备份闭包。`Assets/Editor/CurrentSlotArchiveValidation.cs:22-26` 主要验证同一 profile 跨档及内置“冰刺”，并刻意保全 global；不能替代本项。

具体下一步：构造合法本机自定义资源卡，进入资源节点并保留未领候选；导出该档，在没有该自定义库的干净目标 profile 预检/导入，再打开/领取。另以同 ID 不同定义的目标库核冲突。源码已显示定义闭包缺失条件；尚未运行这个复现，不将所有自定义档都判为损坏。

完成标准：本档所需候选可按原卡面/规则继续，或导入前给出明确阻断；不能误报“背包需腾位”、显示空候选或永久丢失待领内容。只处理该包的必要定义与冲突，不整体覆盖目标 global 设置、自定义库或其它档位。新档同机恢复与旧网页版兼容无关。

## 2. 自动释放批次遇“下一段另选目标”的续接闸门

归属：Battle（Core/Battle，必要 BattleUI），Root 已授权本片继续实现；当前审查结论尚未经过运行。

现行真实来源：`../搜打撤/game/src/cards/builtin-card-execution.js:145` 的无量仙剑·云风（tt8-hero-sword）抽5张并 castDrawn 武术；`:110-115` 的血毒双镖（tt7-bloodpoison）先命中/流血，再 pick:new 伤害/中毒。`cards.data.js:495,521` 给出当前真实卡面与类型。另有 `cc-mana-surge` 的四次随机法术和装备 release hand/eachDraw 连续释放，须沿正式来源挑可达组合。

闸门差异：

- Vite `battle/core/battle.draw.domain.js:47-52` 的 automaticCastsReady 等待 interaction；同域批次还等真实 action promise、选择队列与会话 token，下一 UID 不抢跑。
- Unity `StructuredRules.cs:66` 的 RuleInputPending 只含 choice/hand/discover。`BattleTargetSelections.cs:42-56` 的 BeginDeferredTarget 以 pendingTarget.Kind=rulePick 和 deferredTargetAction 持有下一目标；它不进入上述闸门。
- `StructuredRules.cs:759-785` 的手牌/生成批次只在 RuleInputPending 时暂停；`BattleSession.cs:783-788` 在完成当前卡的尾部建立 deferred target。因此批次存在已经交还下一段目标、却继续后续 UID 的代码条件；第二张也建立目标时还会覆盖前一目标身份。
- 不能直接把 rulePick 无差别加进 RuleInputPending：`BattleTargetSelections.cs:50` 的 SelectRuleTarget 入口也拒绝该谓词，会把当前合法选择一起锁死。需要区分“必须暂停继续”和“可以接受当前归属目标”。

具体下一步：先核真实 castDrawn/血毒双镖调用链及可共存卡来源，再分别走选择第二目标、Esc取消、目标死亡、旧 token/id 回调、下一张又需选择及批次中终局。记录每 UID 释放一次、延续先后、费用/抽牌/RNG与结束边界。不要用旅程脚本的 ChooseRuleOption(0) / PickDiscover(0) 代替多层分支验证（`CurrentMigrationFlowValidation.Journey.cs:181-194`）。

完成标准：前一交互未结算不释放后一张；取消按源仅取消当前归属步骤并正确继续/结束；旧选择不能改新场战斗；无重复施放、补抽或随机推进。保持原实体 UID 和本轮已有同 UID 目标保留逻辑。

## 3. 晚回合真实敌人机制的玩家反馈

归属：Battle（CurrentBossMechanics 与必要战斗呈现），Root 已授权继续实现。

具体已确认缺口：Vite `battle/core/battle.boss-mechanics.js:40-48` 在死灵能力者第3/6/9回合移走牌库顶最多2张、增加 necroticExposure，同时写明“撕掉N张、最终承伤×倍率”的战斗日志，并产生 burn 事实。Unity 修复前 `CurrentBossMechanics.cs:37-40` 只移 grave 并改倍率，没有对应原因/倍率日志。后续已确认当前 `view/battle.anim.view.js:136-142` 活跃消费 burn 音效，消融仅对旧真实手牌矩形生效；本片补日志与一次音效，不制造牌库卡的手牌卡影。

具体下一步：按同种种子/牌堆在第3/6/9回合核顶牌 UID、墓地、倍率、静默时跳过和同回合只触发一次；比较当前日志与呈现消费者。并把畸变母体第2/4/6回合召唤作为相邻核对点：Vite 同文件`:27-38`，Unity`:22-35`。本片优先修确定缺失，不为覆盖数量扩大实现。

完成标准：玩家能从实际战斗提示查明牌库少牌原因与当前倍率；撕牌不触发消耗、不删除永久所有权、不改变抽签/随机顺序；反馈只随已发生事实出现一次。真实敌人立绘与新召唤单位布局若取图，单列证据。

## 已有成果与本次排除

`NativeDisplayReview.Parity.cs:24-36` 的选材图把HP设为1000、使用10000HP/0攻白块受控敌人，且把部分候选 cost/dmg/rules 改为受控值；这些图有效证明页面实际绘制及选材状态，不证明上述实卡组合或晚回合机制。第二轮 visual-battle.json 已明确不含原费变体 UI 专测、物理输入或真实敌人立绘。

没有把已有死亡结算重复列为缺口：`CurrentMigrationFlowValidation.Receipts.cs:116-125` 已从真实致命 EndTurn 到 DeathScreen，检查持久化与两张安全卡保留；单档损坏保全、文件锁与战斗/撤离跨档恢复也已有专门源码和验收。本审查没有要求再兼容旧网页存档、旧三环、Agent、研究所第二图或关闭制作坊。

24类页面矩阵仍用于入口覆盖索引；这三项对应保存跨边界、实际卡牌动作续接、真实敌人后期状态，优先于再增一批静态截图。第2/3项后续授权实施已完成源码，见 `battle.md` 与 `battle-freeze.json`；仍未运行验证，不能把本文当完成验收。
