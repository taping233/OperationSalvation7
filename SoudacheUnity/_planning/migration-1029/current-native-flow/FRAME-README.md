# 五角色原生帧补充验收

`CurrentUnitFrameValidation.cs` 是独立 Editor 入口，尚待 Root 的 current-visual-8 后台窗口退出后安装。不会修改或调用冻结的 CurrentMigrationFlowValidation 三入口。

执行入口：`Sdt.Editor.CurrentUnitFrameValidation.Run`。Root 使用独立 `SDT_UNITY_CHECK_OUTPUT` 并统一运行现有后台 runner。本脚本内部上限 175 秒；隔离存档在输出内 `profile-frames-<UTC时间>`，唯一参考尺寸为1920×1080。失败写 role/action/frame/index/stage 与原异常到 failure.txt，退出2；成功输出 result.json、frames-trace.json 与约32张PNG，退出0。

真实生产链：每角色以 NewRun + BattleRequested 建立原生 BattleScreen，读实际常驻 BattleUnitFrames。无的真实 starter-attack 出牌与 EndTurn 敌方行动分别确认 ActorPresentation cue→正式队列→atk/hurt 实际帧绘制。其他动作调用生产 actor.Play，清楚记录为 presentation fixture，不声称出牌或硬件输入触发。

检查五角色264个唯一源帧经当前 Resources/Lease 实际载入后的纹理原尺寸、完整sprite.rect与脚底pivot；各动作中帧检查 CurrentFrame 与 Image.sprite.name 一致、固定画布尺寸/底部锚定、GPU回读alpha同时含透明区与主体像素；每角色 death末帧达到 DeathComplete 后等待250毫秒确认保持并截图。无和黑香的单帧cast按现行源 neutral记录，不增造动画。长无语使用现行2×设置；无atk中帧调用当前组件 OnApplicationPause(true/false) 作明确的生命周期fixture，检查暂停期间帧保留与恢复后推进。

本补充只检验原生资源、painting与正式队列的代表接线；复用 current-unit-frames 已有1813+25纯时序对照，不重新构造库，也不把手动Play当作完整卡牌事件链证明。图片中的实际视觉质量由 Root 读取输出后判断。

私有当前源码与Editor类型检查已通过，执行日志见 type-check.log；尚未运行Unity。
