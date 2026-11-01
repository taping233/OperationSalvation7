# 原生回合前置超时诊断

2026-11-01，Root 确认 `native-round4-3` Unity进程退出后，仅修改 `CurrentBattleRound4Checks.cs` 与本片记录；没有运行检查或改生产。

本次 `result.json` 为失败，Battle Assertions=6；日志只报 `reactive native choice absent`。6项刚好确认隔离、减动效、Bridge、装备、提交目标可用及 ISubmitHandler 存在，未证明 EndTurn 命令执行。此前 Preparation31/Photo25/Inbox12/Run29不构成本片成功证据。

现役 `CurrentEndTurnHold.Install` 重绑按钮，即使长按设置关闭，点击仍要求 Available；其中包括 Application.isFocused。后台检查的 Ready 与 Button.IsInteractable/ISubmitHandler 不包含真实窗口焦点，因而“提交处理器返回 true”不能证明命令执行。该次旧日志未记录 focus，不补写其实际值；新检查仅记录实际焦点，不增加自适应输入路径或额外后台 Submit 试验。

RNG静态来源为 `BattleBridge` 的 context.rng=game.Rng，`BattleSession.Start` 保留 ctx.rng 引用。新检查记录 ReferenceEquals 会话私有 rng 与 game.Rng，并在实际会话对象上 LoadState；引用身份只作诊断，不改随机规则、不安装替代 RNG。旧事件前后随机状态检查也读取实际会话对象。之前未观测引用身份，因此不把静态合同写成上次运行已证明。

回合前置改为现有正式 `BattleView.Commands.EndTurn()`，立即要求 turnEndPending、实际 choice、回合仍1、HP997。随后仍等待原 Ready 与当前快照状态，实际选择/旧事件/UI锁/冻结后的续接均保留原断言。超时及回合命令前后记录紧凑诊断：focus/hold、实际 turn/phase/busy/over、choice、hand/draw、会话与游戏 RNG状态/同引用、展示队列 Busy/数量、顶部页面和两 token。

这份检查证明的成功范围仍需 Root 复跑；不宣称后台结束按钮能够成功输入，不激活窗口、不放宽 Ready、不修改生产焦点守卫或随机参数，也没有测试 fallback。
