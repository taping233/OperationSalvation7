# 奖励公共路径第三轮

状态：主会话已确认三组最小方案并授权正式原生检查源；生产与检查源已实现、静态收口，冻结等待集中验证。未编译、测试或启动 Unity。生产可写边界仅 `Assets/Scripts/Sdt.UI/Screens/Run/CurrentReward*.cs`；既有第二轮 Organizer 容量预览改动保留。Vite 只读，不转译在途动作帧/idle 改动。

基线：Unity HEAD `81b87cbd5f7b6bb7de48b0973c534ba494cb84a9`，Vite HEAD `f966e859043b7ab3703839005029ef090a4677b5`。上轮实际播放器 buildGUID `a529e27adc834c58a21f47beebe94436` 仅是已验收基线，不替代这轮变更验证。

已核对生产入口：`ChestOpenScreen.Build/Take`、`EntrySupplyScreen.Build/Take`、`EventDialogScreen` 的奖励分支与 `EventDialogChoices` 的腾位入口，公共卡片读卡与 Organizer；不修改这些调用方。来源为现行 `reward-scene-view.js`、`reward-capacity-organizer.js`、`reward-interaction.js`、`reward-card-feedback.js`、`game.reward-organizer.js` 及 `docs/single-reward-flow.md`。

明确发现和最小方案：

1. Organizer 每次 Render 新建列表和 actions，但旧“确认丢弃”事件只经过 Live/_busy，未校验本轮版本或 `_pending==uid`。在取消丢弃后重放旧事件、页面仍置顶时，旧 uid 仍存在即可进入正式 TryDiscard。源 Organizer 同时检查 revision、活动 root、按钮归属及 pending uid。已增加渲染版本和当前确认守卫；每次绑定更换 ButtonClickedEvent，旧事件保留过期 revision，确认另查 pending uid；关闭递增版本，覆盖/关闭/换节点/档位/owner 移除均拒绝。正式事务和失败回执保持。
2. “丢弃→保留”只改变一行决策，原先全量销毁所有行及 footer。源采用 keyed syncViewChildren。现按首 uid 保留轻量行和现有文本/按钮，确认控件首用时创建、之后只切换显隐；只有消失的堆销毁行。每次 Render 仍读取真实库存并建一份 safePreview，footer/容量/文字就地更新。不缓存跨状态容量，不另建公共框架。
3. CurrentRewardFlow 四个布局阶段分别 MakeRows，原先均 new Row 和 List；Tile.Pop 每个动画帧 new float[4]；Scene.Sync 对已保留的卡面还做 LINQ 过滤、排序及数组快照；读卡 SourceCurrent 每次 CapturePanels().Contains 复制完整栈。现复用布局行与有序临时容器、直接分段计算固定动画、用既有 Count/PanelAt 同步扫描，缓存卡面纸层和按钮文本引用，删去未使用的 card 字段。卡面本身已经保留，没有重写资源机制，也没有改变四阶段重新测量的布局时序。

同组回调补口：`ChestOpenScreen` 在同一 Panel 推进下一箱，Scene.Sync 移除旧 tile 后，旧 tile 的 Claim 仅查父 scene.CanSubmit 和旧 State；构造旧事件仍可把旧 index 送入当前箱 Take。Tile 现每次 Set 更换领取/读卡事件并捕获版本和 item 身份，OnDisable 递增失效；领取仍查 180ms、当前页面与真实 LiveState。正常玩家输入不可点击已失活旧对象，旧 UnityEvent 重放单独记录，不把二者混称。

正式回归源：`Assets/Editor/CurrentRewardRound3Checks.cs` + meta，入口 `Sdt.Editor.CurrentRewardRound3Checks.Run()` / `Assertions`，由主会话集中驱动。检查真实 EventSystem submit 的丢弃/保留/确认/安全格、焦点与滚动、I/O 失败回滚/回执；旧确认在保留后及同控件重新激活后重放，旧安全格、关闭/替换/owner 移除后的事件；同 uid 行/footer/scroll/卡面的身份；旧 tile 绑定和移除回调、当前保留 tile 的领取分发；普通/附赠分行与布局池复用。planning 中同名文件是首次准备稿，正式维护仅 Assets/Editor 版本。

本轮生产 3 文件：CurrentRewardCapacityOrganizer.cs、CurrentRewardFlow.cs、CurrentRewardScene.cs。其余 CurrentRewardAcquisition.cs / CurrentRewardState.cs 未改。冻结指纹见 `reward-freeze.json`；新旧完整流程、读卡返回/容量与实际画面由主会话集中验证。

收益边界：这里只依据分配点和对象重建路径说明减少重复工作；未测帧率、CPU 或 GC 数值，不声称性能百分比。

集中原生第三次在旧 Tile 回调合并断言失败（40 assertions）；结果只有 `claimed==0 && UiStack.Top==owner` 的合并布尔值，没有实际计数/顶层页面。静态源码的事件替换与独立版本守卫仍成立，现有证据不足以改生产。仅把同一回归源拆分为：重绑前页面前置条件、确证新事件/版本替换、等待后页面前置条件、分别重放旧 claim/read，并在失败消息记录实际 claimed、顶层类型/实例和版本。原等待、旧回调重放、当前真实 submit 及玩家结果断言均保留；待主会话下一次集中原生定位。生产指纹未改，本线未自行运行测试。

第五次集中原生已在回放旧事件前的前置断言定位：claimed=0、Top 为 EntrySupplyScreen，owner 仍是中性 reward-r3-scene-owner、tile revision=1。保存失败回滚重建地图后，HUD 正确重新提示未完成入城补给，覆盖夹具，并非旧 Tile 回调执行。现仅在中性 Tile 场景前把 `entrySupply=null` 并正式 SaveCurrent，断言保存成功且无待领补给，再 Clear 后挂 owner。保留既有 .2s 等待、前序 claimed 值及全部新旧事件结果断言；生产未改，等待主会话重跑。
