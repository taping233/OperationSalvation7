# 当前源码独立流程审查

本轮只读生产源码，直接对照 `搜打撤/game` 现行实现。未使用旧验收通过报告；未启动 Unity、操控前台或调用共享编译工具。独立运行器直接编译当前 Core/Run，使用独立 bin/obj 与新测试数据；资源通过真实 JSON 读盘，音频和 Unity 日志使用桩。以下运行结果不是原生 UI 输入证据。源码指纹见 `source-hashes.json`。

## 待修问题

1. **P1：战斗页主动撤退走烟雾弹脱战语义，首脑也能撤。** `BattleScreen.cs:454` → `BattleBridge.cs:187` 的 `BattleCommands.Flee` → `BattleSession.cs:1173–1178` 的 `Retract` → `Finish(null)`。`GameBattleHost.OnBattleEnd` 只对 `Win==false` 执行死亡；null 回到同局地图。现行 `game/src/battle/view/battle.view.js:654–667` 首脑禁撤、普通两次确认后调用 `surrender`，`battle.enemy-phase.domain.js:493–500` 执行 `finish(false)`。新测普通/首脑 `Retract` 均 `allowed=True, result=null, ended=True`。原生建议：普通主动撤退结束本局并仅抢运安全格；首脑不可主动撤退；烟雾弹仍保留独立脱战规则。

2. **P2：首次进入事件发布两次 NodeEntered，叠两张事件页。** `GameRuntime.cs:970` → `RunEventDeck` → `TriggerEventCard:1061` 已发布；`ResolveCell:791` 又 `Present`，`Present:798` 再发布。`RunLoopBridge.cs:71–72` 每次均新开 `EventDialogScreen`，无去重。独立运行器真实移动结算调用获得 `fresh_event_node_entered_count=2`。建议将呈现保留在一个入口；原生验证首入事件仅一页，结算或返回地图后无下层旧事件页。

3. **P2：跨层回边被拦，无法从第二层入口回第一层。** `GameRuntime.Map.cs:29–35` 搜路忽略跨层边、`:40` 只列本层、`:47` 拒绝不同层。生成器 `LayeredMapGenerator.cs:43,111` 保留真实双向跨层边且元数据只给向前闸门，所以向后没有另一动作可用。现行 `map-travel-path.js:43–49` 接受 next 的跨层直接边，`game.run.flow.js:85–95` 实际提交层号与位置。C# 新测确认回边存在而 `CanMoveToNode` 返回 false；现行 JS 同形输入实际返回可用路径。原生建议从二层入口返回一层出口，再经已用门回二层；普通节点内容不复刷，门继续通行。

4. **P2：成功出发未清基地消耗口袋。** `NewRunCore` 只在 `GameRuntime.cs:609` 重建本局 `State.usedPocket`，不清 `Base.pocket`；两个正式出发入口最终均走该方法。现行 `base-departure.commands.js:78` 成功提交时清 `draft.pocket`，`game-session-departure.js:278–280` 明确未复原牌在下一次出发消散。C# 新档先放2张基地消耗卡后出发，仍有2张；现行 JS 同一输入结果为空。影响：旧消耗牌跨多次远征保留，之后可在基地恢复。原生建议成功出发后口袋为空；出发保存失败时口袋与仓库携带均保留。

5. **P2：已离店节点仍可从 HUD 重新交易。** `GameRuntime.Map.cs:65–66` 实际离开写 closed；`DesktopRunHud.cs:153–154` 仅按节点类型提供直达营业入口；`ShopScreen.Open:80–99`、`Buy:237–254`、`Sell:278–288` 均不检查 closed。`ResolveCell:754` 的关闭守卫因此被绕过。现行 `node-reward-state.js:13–28` 与 `game.run.flow.js:201–209` 将离开后的店转普通节点；现行 `mapNodeStatus` 新测确认为 shop-closed。此项为完整调用链源码证据，未跑原生 UI。原生建议留一件未售商品→移动到邻点→返回原店，营业入口消失且交易命令拒绝。

## 本轮实际验证通过

- 新建档位和首次开局可保存。
- 独占锁住测试 profile.json.writing 后，`TryPersistMutation` 拒绝提交，Run/Base/RNG 回到操作前，原 profile 字节不变。
- 重复 `DoExtract` 不重复自动资源与撤离统计。
- sorting 撤离记录可通过 `LoadRun` 还原为整理状态。
- 重复入库和重复完成整理不重复发卡。
- 档2基地木材写入不污染档1。
- 新运行器输出见 `fresh-results.txt`；直接导入现行 JS 纯函数输出见 `primary-results.txt`。

## 覆盖与缺口

已审主 Boot 装配/退出保存、Run 事务与回滚、profile 读写与原子替换、slot 新建/读取/切换、节点移动/关闭/重入、事件阶段/骰子/奖励/开箱、战后奖励回执与开箱队列、商店购买/出售、死亡/放弃/撤离/整理与返回标题的当前源码。

该审查没有宣称穷尽全部卡牌效果、七首脑规则或画面；未执行完整后台原生流程。主会话应基于修复后源码补跑上述五项原生用例，以及事件选择/入场保存故障、箱子部分领取后重启、战后保存失败后重试、整理中退出进程再进入同档这四类恢复用例。
