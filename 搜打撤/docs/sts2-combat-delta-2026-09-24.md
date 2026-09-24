# 塔2战斗系统对照审计（2026-09-24，实施更新）

## 范围

只涉及 `搜打撤` Vite 战斗域、相关音效调用和本报告；为实机验收修复了开发者侧栏入口 `game/src/hub/game.notes.js:203-206`。未改美术资产、骨骼绑定动画、Godot/Unity 或桌面 EXE。源码对照来自本机 `D:\素材\杀戮尖塔2源码\sts2-decompiled\`。仓库原有未提交修改仍保留；HEAD 在本次实施时为 `b1de402`。

## 差距、改进与验收状态

| 主题 | 对照证据 | 本次改进 | 状态与边界 |
|---|---|---|---|
| 多段攻击与时序 | 我方结构化多段结算在 `game/src/battle/battle.resolution.js:70-85` 逐段调用命中，但结算同步完成；塔2 `MegaCrit.Sts2.Core.Commands.Builders/AttackCommand.cs:604-653` 在每击间 await 前摇、VFX、伤害前等待并逐段结算。 | `game/src/battle/battle.vfx.js:217-246,335-359` 将飘字按单位分拍排入反馈队列，加入命中前闪光、按击更新显示血量与受击反馈；重复命中会取消前一抖动，并将抖动时长限制在拍点间隔内。`game/src/battle/battle.engine.js:832-841,1604-1663,1735-1790` 在卡牌结算后等待队列，并为每次命中附血量快照。间隔走 `demoMs`，支持 1×/2×。 | **视觉实机已验，逻辑部分完成**：在独立站点的 Boss 战打出「流星箭雨」，1× 页面采样依次出现 `44/50 → 41/50 → 38/50` 和 `-3 → -3|-3`，两次命中各有受击状态与特效；普通遭遇战第 2 段也转向了下一名敌人。2× 战斗设置开启后再次打出该牌，出现两条 `-3` 飘字并降至 `44/50`；短暂采样未取得两拍时间戳，倍率间隔缩放仍以定向测试为证。内部 HP/击杀钩子仍在整张牌同步结算时运行完，尚未变成塔2式“每击演出完成后才结算本击”的完整事件流。 |
| 全局顿帧 | 我方原有受击停顿只写入单元素关键帧；塔2 `MegaCrit.Sts2.Core.Commands/Cmd.cs:27-42` 的等待受 TimeScale 影响，`MegaCrit.Sts2.Core.Nodes.Vfx.Utilities/NHitStop.cs:61-91` 调整全局 `Engine.TimeScale`。 | `game/src/battle/battle.vfx.js:198-210,245-247,333-334` 对重击/终结暂停页面当前 Web Animations 与战斗序列帧 ticker 一拍，按演出倍率缩放；下一条反馈继续等待队列。 | **部分完成**：实机打出 10 点「惩击」，采样到 Boss `44/50 → 34/50`、`-10` 飘字、命中特效与受击状态，触发了重击代码路径；短暂全屏冻结未被页面采样直接测出，终结一击也未单独走查。JS `setTimeout` 不会冻结，因此飘字清理等计时器不完全等同于全局游戏时钟。 |
| 不可出牌提示 | 我方原因计算位于 `game/src/battle/battle.rules.js:82-101`；塔2 `MegaCrit.Sts2.Core.Nodes.Combat/NMouseCardPlay.cs:275-288` 拖牌失败时把原因显示为 `NThoughtBubbleVfx` 并闪卡。 | `game/src/battle/battle.aim.js:215-251,330` 为能量不足的拖牌保存原因，进入瞄准区时由 `game/src/battle/battle.hover.js:59-80` 在角色上方生成安全文本气泡，取消时清除。 | **已实机验**：Boss 开发战消耗至 0 能量后，将 1 费攻击拖向敌人，角色头顶显示“能量不足：需要 1 点能量，当前 0”；截图确认位置与文案。 |
| 受击打断与循环错相 | 塔2 `MegaCrit.Sts2.Core.Animation/CreatureAnimator.cs:62-78,94-102,161-172` 支持 AnyState 优先级及循环错相。 | 我方 `game/src/battle/battle.frames.js:342-363,454-484` 保存被单次动作打断的循环时间轴/帧并随机 idle 初相；`game/src/battle/battle.layers.js:557` 给敌人 idle 设置个体延迟；`game/src/battle/battle.vfx.js:47-62,250-256` 命中时播放 CSS hurt 覆盖。 | **部分完成**：玩家帧播放器的循环恢复/随机相位已落地；敌方没有序列帧资产，本次仅有静态立绘上的 CSS 受击动作与循环浮动，不能报告为敌方序列帧 AnyState。 |
| 命中、破甲、拿卡音 | 我方原来卡选择没有 `cardSelect`；所有命中音一致，音效表在 `game/src/audio/sound.js:183-223`。塔2攻击 builder 的音效/VFX 链在 `AttackCommand.cs:604-677`。 | `game/src/battle/battle.aim.js:171-195,215-251` 在卡选择/拖起时播 `cardSelect` 并闪卡；`battle.engine.js:1775-1781` 检测护盾实际归零并发 `shieldBreak`；`battle.vfx.js:245-247` 根据本次伤害选命中音变速档；`battle.engine.js:822` 成功施加破甲状态播新增 `armorBreak` 合成音，`sound.policy.js:10-17` 配节流和优先级。 | **代码已接入，听感未实机验**：浏览器未录听音频；破甲状态音是状态成功施加触发，盾耗尽走 `shieldBreak`。 |
| 瞄准/取消 | 我方 `game/src/battle/battle.aim.js:293-420` 已有拖曳、悬停、取消区和点击确认；塔2 `NMouseCardPlay.cs:335-372` 使用可 await 的目标信号。 | 本次沿用现有指向线、取消区、抓取点逻辑，只扩展能量原因气泡和卡反馈，不迁移目标总线。 | **架构差别暂缓**：按本任务已知事实保留现有交互。 |
| 开发战斗入口 | 我方 `game/index.html:72-78` 的地图侧栏 `devPanel` 默认隐藏，`game/src/hub/game.notes.js:203-206` 原来只切换其子元素；开发模式开启后按钮仍不可见。 | `game/src/hub/game.notes.js:205` 同步切换父面板显隐，使现有「强制遭遇战 / 强制 BOSS 战」按钮在测试局可操作。 | **已实机验**：在独立站点启用开发模式后，地图侧栏出现两个按钮；携带指定测试卡直接进入 Boss 战。此项仅修改开发工具入口，不改变常规战斗规则。 |

## 验证记录

- 定向测试：覆盖 `tests/multi-hit-retarget.test.js`、`structured-onplay-battle.test.js`、`tt7-hand-payment.test.js`、`battle-presentation.test.js`、`battle-resolution.test.js`、`combat-feedback.test.js`、`battle-frames-lifecycle.test.js`、`r7b-feedback.test.js`、`battle-pace.test.js`、`sound-policy.test.js`、`soundscape.test.js`，11 个文件、63 项通过；新增检查 1×/2× 连击抖动时长不超过拍间隔。
- `git diff --check` 覆盖本次相关 JS/CSS 文件通过；仅有 Git 关于 LF/CRLF 的提示。
- Vite 页面走查：Codex 内置浏览器在隔离的 `localhost:52791` 站点（标题显示“暂无档案”）启用开发模式，开发控制台给测试局发「流星箭雨」和「惩击」，经地图侧栏按钮进入 Boss 战。普通遭遇战日志显示双段各造成 3 点、首名敌人倒下后转向次名。Boss 战 1× 页面采样显示血条 `44/50 → 41/50 → 38/50`、飘字 `-3 → -3|-3`、两次受击状态和命中特效；切换 2× 后再次打出该牌，出现两条 `-3` 飘字、Boss `50/50 → 44/50`。10 点「惩击」显示 `44/50 → 34/50`、`-10` 飘字及受击特效。该站点与原有端口存档隔离，页面控制台无 error；测试 Vite 服务已停止。此前的能量不足角色气泡与普通单段攻击走查仍成立。
- 实机未完成项：2× 下两拍间隔的直接计时、100ms 全屏冻结的直接测量、终结一击、音效听感、敌人真实序列帧打断。不要把代码路径或定向测试写成这些已实机验收。

## 交付结论

已实现分拍呈现与队列等待、页面动画顿帧、拖牌能量原因气泡、玩家序列帧打断/随机 idle 相位、敌方 CSS 受击反馈、卡拿起/命中分级/护盾破碎/破甲音；另修复了开发模式侧栏入口。真实多段牌的分拍血条和飘字已在 Boss 页面采样确认。完整逐击逻辑结算、敌人序列帧和上列剩余瞬时效果的实机验收仍未完成，不声称完全满足全部验收标准。

## 后续代码进展（2026-09-24 11:26 +08:00）

上文是此前实施和页面走查的时间快照。之后 `game/src/battle/battle.engine.js:854-940,1593-1617` 加入受战斗 token 和取消信号约束的 `runStagedSteps`、`queueBattleAction`；`battle.resolution.js`、`effect-steps.damage.js`、`effect-steps.kills.js` 的逐击生成器将前摇、单次结算、反馈等待交错执行。卡牌、部分衍生伤害、敌方逐击行动和若干选卡后续效果已接入该流程；死亡贴纸保留一拍后收尾。`battle.aim.js`、`battle.view.js` 和 `battle.layers.js` 补了待选目标的取消及提示。故上文“内部 HP/击杀钩子仍在整张牌同步结算”的表述只适用于当时版本，不再概括当前逐击路径。

仍有同步例外：`battle.engine.js:1227-1255` 回合开始临时卡消耗触发的火球仍在 `consumeHandUids` 中同步结算；`effect-steps.kills.js` 的直接击杀沿用已有死亡反馈语义。`battle.vfx.js:202-217,373` 的顿帧暂停当前 Web Animations 和序列帧 ticker，独立 JS 计时器尚未接入同一时钟；敌方受击仍使用 CSS 反馈，没有敌方序列帧资源。目标交互已集中清理 pending 状态，但尚非塔2的可等待目标信号流。

这批后续代码按老板最新要求只做源码完善，未重新运行测试、构建或浏览器走查；上文 11 文件 / 63 项和页面采样是更早批次的证据，不覆盖本节代码。完整逐击体验、顿帧、音效和取消边界均待实机验收。
