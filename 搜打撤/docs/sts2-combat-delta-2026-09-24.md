# 塔2战斗系统对照审计（2026-09-24）

## 范围与工作区约束

对照对象是 `搜打撤` Vite 战斗域和本机 `sts2-decompiled` C# 反编译源码；不涉及 Godot、Unity、桌面 EXE、素材资产或骨骼动画管线。行号对应本次只读检查的工作区快照。

当前仓库有大量未提交修改，其中包括 `game/src/battle/battle.engine.js`、`battle.view.js`、`battle.aim.js`、`battle.frames.js`、`battle.vfx.js`、`game/src/audio/sound.js`、`sound.scape.js` 及战斗测试。`docs/NEXT-AI-HANDOFF-2026-09-20.md` § 当前状态说明这些战斗/卡牌改动归属与整体验收状态未知。根 `AGENTS.md` 规定有其他会话未提交改动时不覆盖共享文件、不 build。因此本次交付完成只读审计，没有改战斗代码、运行测试、构建或启动页面；以下“本次改进”均为建议切片，不代表已实现。

## 差距表

| 主题 | 已对齐 | 差距 | 本次改进 | 暂缓 / 验收边界 |
|---|---|---|---|---|
| 多段攻击与事件时序 | 我方已将文本/结构化的 `hitCount` 展开为逐击循环；每击对活目标调用 `hitFoe`，并可按配置转移目标。见 `game/src/battle/battle.resolution.js:61-85`、`:87-100`；每次命中单独执行 `Combat.dealDamage`、播放 `hit`、追加飘字，见 `game/src/battle/battle.engine.js:1769-1784`。塔2 `AttackCommand.Execute` 在逐击循环内等待前摇、生成 VFX、等待 before-damage 再结算，见 `MegaCrit.Sts2.Core.Commands.Builders/AttackCommand.cs:604-653`。 | 我方的逐击循环同步完成逻辑结算；随后 VFX 层按单位将飘字错开 320ms（倍速同步缩放），见 `game/src/battle/battle.vfx.js:295-296`、`game/src/battle/battle.feedback.js:5-30`。这不是包含前摇、命中、结算、音效、死亡/后续钩子的可等待逐击演出流，单击之间没有 await 的前摇拍点；后续演出也不会等待逐击反馈完成。塔2逐击等待及伤害在同一攻击 builder 循环内，见上述 `AttackCommand.cs:604-656`。 | 下一切片应把结构化伤害操作转为可取消的 hit event（目标、伤害、序号、前摇、反馈元数据）；由现有 action queue 中的执行器逐个 await 前摇→命中反馈→本击结算，再执行下一个事件。保持当前所有多段卡目标转移、死亡、钩子语义不变。 | 本次未改代码。需用真实多段卡确认每段数字、受击抖动、前摇均逐拍出现，且 2× 将等待压半；定向解析/结算测试不得只验证总伤害。 |
| 顿帧 | 有伤害分级，重击/终结反馈会把 60ms 传入受击抖动，见 `game/src/battle/battle.vfx.js:207-217`。塔2 `Cmd.Wait` 明确使用受尊重 TimeScale 的 SceneTreeTimer，见 `MegaCrit.Sts2.Core.Commands/Cmd.cs:27-42`；`NHitStop.DoHitStop` 把 `Engine.TimeScale` 降到 0.1 并逐帧恢复，见 `MegaCrit.Sts2.Core.Nodes.Vfx.Utilities/NHitStop.cs:61-91`。 | 我方 60ms 是受击元素自身的抖动参数，不是全局演出时钟；飘字仍走独立 CSS/WAAPI/timeout 反馈，后续事件也不受全局时钟控制（`battle.vfx.js:211-217, 286-296`）。因此达不到“全屏演出含飘字和后续事件一起停一拍”。 | 在命中事件执行器维护可暂停的演出时钟/等待器；终结命中暂挂当前队列并让该时钟统一冻结画面演出，再恢复此前倍率与剩余事件。避免直接修改全局 `window` 定时器或游戏规则时间。 | 本次未改代码。须在飘字已出现、后续 hit event 已排队的场景触发终结顿帧，验证同帧停顿后恢复、取消/战斗结束时不会遗留暂停或定时器。 |
| 不可出牌角色提示 | 已有原因计算和手牌禁用提示，见 `game/src/battle/battle.rules.js:82-101`、`battle.layers.js:93-110`；出牌拒绝也会写战斗日志，见 `battle.engine.js:1360`。塔2拖卡失败时取 `UnplayableReason` 对话文本并由 `NThoughtBubbleVfx.Create` 附到角色，见 `MegaCrit.Sts2.Core.Nodes.Combat/NMouseCardPlay.cs:275-284`。 | 当前原因出现在禁用卡 tooltip/日志，没有证据显示拖动失败时会在角色头顶显示气泡；`pendingHint` 仅在 `battle.view.js:111` 解构，DOM 引用搜索未发现其气泡渲染。塔2还会在可打出时 `AnimFlash` 卡片高亮，见 `NMouseCardPlay.cs:286-288`。 | 在能量不足且拖攻击卡失败的路径，用已有 `unplayableReason`/费用原因转换为角色化短文案，并挂载复用 `bt-fpreview` 气泡样式的临时气泡；不改规则或现有目标瞄准。 | 本次未改代码。必须实机拖动能量不足卡到战场，检查气泡锚点、文案、消失时机，以及能量足够和其他失败原因不误显示。 |
| 序列帧受击打断与循环错相 | 我方有帧序列和 hurt 动作入口；动作结束回 idle，见 `game/src/battle/battle.frames.js:317-350, 447-452`。塔2 `CreatureAnimator.SetTrigger` 先查 `_anyState` 再查当前状态，见 `MegaCrit.Sts2.Core.Animation/CreatureAnimator.cs:62-78`；循环动画入场时会错开 track 的时间比例，见 `CreatureAnimator.cs:94-102, 161-172`。 | 当前 `playSeq` 每次将帧索引重置到 0，见 `battle.frames.js:330-336`；播放非循环动作完成后固定回 idle（`346-347`）。没有 anyState 优先级/被打断动作记忆，也没有同类敌人独立循环起点的错相机制。当前 VFX 命中处调用 `playUnitFrames('hurt')` 只针对玩家角色，见 `battle.vfx.js:212-217`，敌方循环帧未接受击覆盖。 | 给帧播放器增加可配置优先级的 hurt interrupt：保存被覆盖循环动作，hurt 播完恢复；同一战斗实例按稳定敌人 ID 派生 idle 初始偏移，避免齐步。仅限已有序列帧能力，不引入骨骼资产。 | 本次未改代码。须验证敌人受击中断、伤害密集重入、播完恢复原动作、同屏同类错相、减动效/卸载时恢复。 |
| 命中音、破甲音、拿卡反馈 | 已有多组命中/受击音资源，且 `hit`/`hurt` 有不同音高和低通曲线，见 `game/src/audio/sound.js:183-223`；敌方回合破盾有 `shieldBreak` 调用，见 `game/src/battle/battle.enemy-phase.js:129-144`。卡牌成功打出有 `card` 声，见 `battle.engine.js:1555-1557`。 | 我方所有玩家命中都调用相同 `hit`（`battle.engine.js:1763-1777`），没有按伤害量选命中音；能量护甲/破甲状态应用位置未见玩家命中侧专属“破甲”音；`cardSelect` 资源已注册但当前战斗代码没有调用，拖起卡牌目前用 `hover`，见 `battle.aim.js:238-239`。 | 在逐击事件层依据实际最终伤害档位挑 hit 变体；破甲音只在实际破除敌方护甲/护盾时触发，避免每次施加 abreak 都播；拖起/选择卡使用现有 `cardSelect` 并沿用当前节流策略。 | 本次未改代码。须用轻/重/零伤命中、实际破甲、拖卡三组场景验音量、频率和反馈与视觉时序。 |
| 出牌瞄准与取消 | 已有拖曳/目标/点击确认/取消状态，以及越过取消区再返回触发取消的门槛；见 `game/src/battle/battle.aim.js:26, 293-314, 350-420`。塔2通过 `NTargetManager` hover 信号并等待 `SelectionFinished`，最后断开信号，见 `NMouseCardPlay.cs:335-372`。 | 我方仍由坐标命中检测驱动，而非可 await 的目标信号流；但本项已知交互线、取消区及抓取点已按反编译口径对齐，本次只记录架构差别，不重做已验收行为。 | 本次无改进；后续新目标交互可以把 hover/highlight/selection 封装成可 await 事务，但不属于当前首批行为修复。 | 暂缓架构迁移。当前工作区 `battle.aim.js` 已有未提交修改，先确认归属并完成原有交互回归。 |
| 1×/2×、队列及反馈基础 | 我方有 action queue，出牌在 resolving 状态排队执行，见 `game/src/battle/battle.engine.js:1494-1508`；倍率 `demoMs` 同步作用于序列帧/步进/反馈，见 `battle.pace.js:1-25`。 | queue 当前解决的是整卡串行，不是逐击事件等待；不得把现有 `busy`、取消、结算收尾语义改坏。 | 多段演出切片应复用队列与现有 1×/2× 时长函数，新增的 await 必须接收同一动作取消信号。 | 验收需检查连打防重扣费、战斗重启取消、结算和胜负结束状态；本轮没有运行测试。 |

## 当前交付状态

- **已完成**：只读比对和本报告；用户提供的 aim、队列、2×、伤害分级及抖动部分均重新核对了当前源码。
- **代码改进**：未落地。工作区中相关生产代码和测试已有并行未提交改动，归属未知；按根 `AGENTS.md` 不覆盖、不构建。
- **测试 / 页面验收**：未运行。不能据现有代码快照宣称多段逐拍、全局顿帧、思想泡泡、敌人 hurt interrupt 或音效完成；当前未提交状态也尚未进行 Vite 浏览器走查。

## 建议实施次序（解除文件归属约束后）

1. 先做可取消逐击演出事件（包含每击前摇、结果反馈和逐拍结算），同时添多段卡定向测试。
2. 在事件等待器上接入全局演出顿帧，并覆盖 1×/2×、取消及终局清理。
3. 接入不可打原因气泡与帧播放器 hurt interrupt/idle 错相。
4. 最后补命中档位、实际破甲及拿卡音效，然后启动 Vite 用内置浏览器逐项走查和相关测试。
