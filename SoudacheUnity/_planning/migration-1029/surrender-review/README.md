# 撤离语义独立复核

当前生产实现与现行 Vite 的撤离语义一致：普通主动撤离按失败终结远征，只抢运安全格；首脑战的主动撤离入口拒绝执行；烟雾弹按脱战豁免结算，保留正在进行的远征。独立隔离执行覆盖本轮源码，不沿用旧的通过报告。

## 执行与结果

在 `SoudacheUnity` 根目录运行：

```powershell
& ./_planning/migration-1029/surrender-review/run.ps1
```

脚本提取当前 `BattleBridge.cs` 的完整 `GameBattleHost` 类原文，与当前 Core、Run 和 `BattleSurrenderButton.cs` 一起编译到本目录的隔离工程。NuGet 源清空，构建与存档均留在本目录，不启动 Unity，不修改共享编译产物。`source-manifest.json` 记录输入 SHA256，并在执行后核对源文件保持一致；结果在每次唯一的 `run-*/result.json`。

本轮最新结果：`run-20261029-180714-359/result.json`，48 项断言通过，执行前后源码指纹一致。`run-20261029-180515-738/result.json` 是加入执行后指纹核对前的首次 48 项通过记录。两次都没有启动 Unity。

隔离执行覆盖：

- 普通按钮首次点击只确认，文案标明判负，文字/背景危险色升级。
- 2.6 秒前保留确认，超时由生产 `Update` 还原文案和颜色；尚未执行下一次 Update 的过期点击也只重新确认。
- 超时后首次点击重新确认，二次点击仅发出一次失败；重复 Surrender 不重复结算或抢运。
- 原样生产宿主完成失败结算、清战斗检查点、删除磁盘对局，落盘完整死亡回执；安全格身份与数量保留，普通背包与物资按失败损失。
- 首脑编组中和开战后的 Core 拒绝；生产按钮连续两击均拒绝、发出原因和拒绝音效，不创建结算回执。
- 使用当前烟雾弹的真实 Core `UseItem` 命令，结果为 null；已打出的火球和烟雾各进入消耗口袋一次，安全格和本局物资保留，对局继续且可续档。
- 效果级 `Retract` 仍是 null 脱战，保留远征。

隔离执行使用明确的替身：Unity 时间/文本/颜色/按钮事件容器、音频与 Resources 文件读取、宿主的页面关闭/奖励呈现钩子。它验证生产确认逻辑及 Core/Run 结算，不证明 Unity 原生生命周期、真实页面接线、指针派发、画面或操作系统输入。

## 后台原生入口

`Assets/Editor/DesktopSurrenderValidation.cs`，执行方法 `Sdt.Editor.DesktopSurrenderValidation.Run`。必须显式设置 `SDT_UNITY_CHECK_OUTPUT`；脚本为每次执行创建唯一隔离 profile，加载现有 Bootstrap 场景进入 Play。成功退出码 0，并写 `result.json`；失败退出码 2，写 `failure.json`，总上限 100 秒。由主会在各线冻结后统一执行，本审查代理没有启动 Unity。

原生脚本查找正式 `BattleScreen` 上的 `BattleSurrenderButton`，经真实 Button 的 `ExecuteEvents.pointerClickHandler` 派发程序指针事件。首次确认、等待真实 Play 循环超过 2.6 秒并自动复位、重新两击判负、磁盘失败回执、安全格身份/数量及正式失败页全部断言。首脑经过正式选牌命令完成编组后测试两次按钮点击、Core 拒绝与命令门面拒绝。烟雾通过正式战斗命令先打当前火球再使用当前烟雾弹，并断言消费、磁盘和退出战斗页面后的远征继续状态。

原生入口不移动鼠标、不聚焦窗口、不派发系统键鼠；程序事件不经过射线命中测试。因此即使原生通过，也只证明正式 Button 回调和 Unity Play 循环接线，真实鼠标命中与画面需要另列证据。

## 来源对照

- Vite `game/src/battle/core/battle.enemy-phase.domain.js` 的 `surrender` 调用 `finish(false)`，说明烟雾弹豁免。
- Vite `game/src/battle/view/battle.view.js` 的 `btFlee` 明确拒绝首脑，普通二次确认在 2600ms 后复位。
- Vite `game/src/battle/bag/battle.bag.domain.js` 的道具逃跑调用 `finish(null)`。
- Unity `BattleSession.Surrender` 调用 `Finish(false)`，首脑优先拒绝；`Retract` 调用 `Finish(null)`；`BattleItems.UseItem` 的 flee 操作也调用 `Finish(null)`。
- Unity `GameBattleHost.OnBattleEnd` 将 false 交给 `DoDeath`，null 分支持久化已用卡消耗并返回地图；`DoDeath` 通过 `CardContainerCommands.RescueCards` 抢运安全格。

本轮未发现新的生产缺陷。原生脚本在主会首次并发编译时暴露一处测试构造类型错误，已改为当前模型 `InvSlot`；它没有进入原生 Play，该次编译不算验证通过。原生执行结果由主会单独汇总。
