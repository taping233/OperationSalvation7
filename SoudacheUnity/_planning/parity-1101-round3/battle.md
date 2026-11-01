# 战斗第三片：自动批次交互与死灵撕牌反馈

2026-11-01，生产与回归源码已完成，交 Root 集中验证。本片未编译、未运行领域测试、未启动 Unity/Player；仅静态读取与 diff 格式检查。最终字节/标准化 LF SHA 见 `battle-freeze.json`。

## 当前来源与修复

1. 自动批次必须等待当前实体卡的全部交互。Vite `battle/core/battle.draw.domain.js:47-52,60-87` 的 automaticCastsReady 包含 interaction，并在 eachDraw 后再次检查；其 batch 保持物理 UID、最大计数、卡片回调完成后才取下一张。真实 `builtin-card-execution.js:110-115,145` 提供血毒双镖的 pick:new 与无量仙剑·云风的 castDrawn。

   Unity `StructuredRules.cs:66-67` 将“其它选择”与“全部输入等待”分开：rulePick 阻止新牌、技能、装备和自动批次抢占，但 `SelectRuleTarget` 仍接受当前 token/selectionId 的合法选择。`CastRuleHandBatch` 在子卡与 eachDraw 之后各检查一次；如果抽牌触发 onDraw 选择，续接在该交互完成后才取下一 UID。生成批次使用同一个保留 RuleContext 的续接入口；只有实际暂停时分配闭包，不增加每帧扫描、随机抽签或快照。

2. 选择/取消/终局恢复顺序。`BattleTargetSelections.cs:50-55` 在二段命中后先判终局，再恢复后续批次，避免最后一名敌人死亡后仍释放下一 UID。`BattleSession.cs:1286-1309` 取消二段后清掉该二段并恢复原批次，普通拿牌取消仍只解除目标；已有待续接输入时其它手牌不能重新 LockPendingTarget。`Finish` 清除续接和所有待选动作，`ResumeRules` 与外层 ExecPlay 在终局停止，防止已结束批次又补抽、继续生成或重新触发选择。

   保留源卡计数时点：Vite `battle.exec-play.domain.js:422-452` 建立 pick:new 后，仍立即执行回手、lastPlayedType 和 recordCompletedBattleCard；本片没有将这些计数延迟到二段选敌之后。未改变费用、原实体 UID、候选数组快照、max 计数和随机流。

3. 战斗提示栏采用目标身份。`BattlePresentation.cs:327,338-346` 的签名加入 battle token/kind/selectionId；取消按钮确认当前仍是其归属目标。前一张二段留下的按钮不能清除下一张的新目标，也不能跨战斗/终局回调。沿用现行取消命令，没有增加兼容接口。

4. 死灵能力者反馈。Vite `battle.boss-mechanics.js:40-48` 撕掉牌库顶最多两张并记录数量/最终承伤倍率；`view/battle.anim.view.js:136-142` 将同次 burn 事实合为一声。`view/battle.card-consumption-fx.js:140-149` 只对真实旧手牌矩形做卡片消融，死灵撕的是牌库 UID，因此本片没有制造手牌卡影。

   `CurrentBossMechanics.cs:18-45` 保留原撕牌/倍率/静默/同回合只触发一次规则，只补明确数量和倍率日志；一批确实撕到牌时沿现有 ActorPresentation 音频事件发送一次 burn，空库仍记录零张与倍率但不播虚构燃烧音。没有增加永久删除、消耗触发或 RNG 调用。原转移复杂度不变，新增反馈判断每敌人 O(1)。

## 新增回归源码与证据范围

入口仍为 `_planning/parity-1031/battle-check/BattleChecks.csproj`。项目增加 `Round3Checks.cs`，Program 的 Host 仅添加真实日志/结束回执记录。新增检查尚未运行：

- 真实无量仙剑·云风 + 两张血毒双镖，控制物理手牌/牌库顺序与耐久目标，核第一目标归属、后续 UID 暂停、费用/计数、不同/相同第二目标、死亡目标拒绝、旧 selectionId/token 拒绝、取消恢复、二段胜利停止下一张、跨新场 token、RNG 不变。这是受控拥有牌组合，不声称已经通过从职业获取到战斗的完整跨职业旅程。
- 真实剑荡妖邪 + 战士血毒双镖，核手选直接释放后继续等待二段，再完成父卡；该组合不依赖跨职业拥有牌前提。
- 明确构造 release.eachDraw → onDraw.choice 的结构化卡，沿真实生产 resolver 检查抽后选择暂停、只抽一次、效果/下一 UID 只执行一次；待选择时结束战斗拒绝迟到选择；逃跑子卡停止父批次。
- 直接调用正式生成批次并注入确定性卡供应器，检查等待期间不请求第二张、恢复后仅请求一次；不将该构造称为完整随机卡池覆盖。
- 直接调用正式回合开始机制，核死灵3/6/9回合、墓地 UID 顺序、永久拥有/消耗/随机不变、静默/同回合去重、空库/只剩一张和同批多死灵合并音效。该方法级检查不等于真实九回合画面或听音验收。

Root 集中运行可用 `dotnet run --project _planning/parity-1031/battle-check/BattleChecks.csproj`。建议原生补核：连续两个二段目标的提示与取消；捕获旧取消按钮、进入下一目标后调用旧事件，状态不变；死灵实际第3回合日志显示数量与倍率且一声燃烧。领域不证明按钮实际射线/物理输入或音频设备听感。

Root 后续授权的必要原生检查源已补：全局类 `Assets/Editor/CurrentBattleRound3Checks.cs`，入口 `static IEnumerator Run()`，公开 `Assertions` / `Step`，由统一 driver 在已启动的原生 PlayMode 执行，本片没有启动或运行。沿正式 BattleRequested → BattleBridge → GameBattleHost/Session → BattleScreen；仅以反射放置已知拥有 UID 的手牌/牌库顺序，不改卡规则/伤害/费用，不增加生产接口。先点实际英雄卡，再 submit 实际敌人/取消按钮；核首个二段等待时当前提示与按钮保持，选敌后才出现下一 UID、旧取消 UnityEvent 不影响新目标、当前取消完成批次、旧场取消不能跨 token，以及最后一敌人二段致命后不再构造下一目标。检查要求隔离 profile，显式减动效并在结束恢复原偏好；这份构造不证明自然牌序、完整跨职业获取或物理鼠标/射线命中。

## 后续边界

`completion-audit.md` 第1项由 Root 持有：单档自定义定义闭包，Battle 未修改 Save/SlotArchive/CardLibrary。该报告保留准确来源与冲突/目标 global 不可整体覆盖的要求。

Unity 敌方大循环/回合时点仍是同步容器：`BattleSession.cs:1032-1040,1087-1127,1176` 与 `StructuredRules.cs:861-887`。本片修复自动释放/结构化 RunRuleOps 的等待，不据此宣称所有回合时点外层调度均已经等候任意嵌套输入。是否存在现役 onDamaged/回合延迟组合导致外层抢跑，需要先以真实可达卡和现役触发器确认，再单独派片；没有在本片把整回合改写为新状态机。

未修改 Vite、公共 Kit、存档或资源；未删除文件；未 stage/commit/push。
