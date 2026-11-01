# 照片与信箱原生检查独审

结论：对下列当前检查源及其正式消费者只读核对，未发现需要退回修正的确定夹具或断言错误。没有执行编译、测试或 Unity，也没有修改生产及检查源。本结论是静态独审，执行结果由 Root 的集中验证提供。

## 检查版本

| 检查源 | SHA256 | 当前成功路径断言数 |
| --- | --- | --- |
| `Assets/Editor/CurrentPhotoRound4Checks.cs` | `0c68b18159f28728dc873ea1a66334937812886fa3aaf5145b41bbe16f374e63` | 25 |
| `Assets/Editor/CurrentInboxRound4Checks.cs` | `cd60359fe56bc792f7825ac45f21ec248aaac9f95041f306c7dc9a8e18ac33de` | 12 |

## 夹具与入口

- `CurrentRound4Validation.Run` 设置独立 `SDT_UNITY_TEST_DATA` 后加载 Bootstrap，再于 App.Canvas 可用时运行顺序检查。两组检查都要求隔离环境，清理先取消 CurrentRunFilm 再弹出面板。
- 照片检查通过正式 `GameRuntime.ResetSlot(5)` 建立当前 Base。`GameRuntime.cs:905–907` 将状态置为 title、非活动局，不发送 RunStarted/HubOpened；`GameRuntime.Persistence.cs:37–38` 的 SaveCompleted 发出条件也排除这一状态。因此初始化和照片备注提交不会自动打开局内场景。
- `CardLibraryScreen.cs:43–48` 明确允许 title 入口；当前照片墙夹具显式取消其 PageEntry 幕布。照片详情通过正式 Open、Navigate、onEndEdit、UiStack.Close 及 PhotoClose 动画关闭触发真实保存和返回回调。
- 信箱通过正式 Global.SetJson 建立唯一记录，再用 UiStack.Show 构造真实页面。`UiStack.cs:107–110` 会为 HomeInboxScreen 创建 PageEntry；其动作及事件重放在同一 MoveNext 内同步完成。页面 Current 只检查活动状态与栈顶，不会因幕布自动失效；随后 Clear 会取消幕布。该夹具验证页面命令和所有权防护，不验证遮罩下的物理点击。

## 断言可靠性

- 照片旧 onValueChanged/onEndEdit/关闭事件分别在导航后、关闭后、同卡新实例打开后重放；检查磁盘、当前备注、草稿及栈顶。对应 `PhotoDetailScreen.Current(revision)`、OnClose 失效和保存前的当前卡身份，能够暴露旧事件误保存新卡或误关闭页面。
- 文件只读共享锁不允许 Windows 目标替换。当前 AtomicJsonFile 使用 File.Replace；照片保存失败走正式 TryPersistMutation 回滚，信箱保存失败走 Global.FlushGlobal 异常及 SaveSystem 内存快照恢复。断言同时检查磁盘和内存原值，再解除锁重试；照片另以全新 SaveSystem 读取落盘备注。
- 照片失败草稿的关闭、重开、原文重试经过当前 Pending 会话机制；正常 PhotoClose 的 .12 秒离场动画另行等待 .18 秒并检查返回墙上原 tile 的焦点。该检查需要集中原生执行确认时间与 EventSystem 行为。
- 照片墙过滤等待 .2 秒覆盖当前 .12 秒搜索延时；旧 tile 事件在过滤后及墙关闭后重放。空结果不能借旧 id 打开首张照片。100 次 UpdateTiles 用事先绑定并预热的委托同步调用，测量窗口内不经过反射 Invoke、断言或 player-loop yield；当前不变可见范围会在字典遍历及创建节点前返回。
- 信箱旧行事件在 Render 更新 revision 后重放；删除确认覆盖取消重放、确认一次及确认后重放；保存失败不更新当前 revision，使原行可正常重试；关闭后旧行不能作用于新信箱实例。被确认层覆盖时的返回按钮也检查栈顶所有权。

## 证据范围

当前检查源可证明的目标为独立数据目录中的真实保存、同进程会话重开、Unity 页面栈及构造事件。照片输入焦点和关闭动画包含原生 player-loop 等待；导航使用反射调用正式私有方法，按钮使用 UnityEvent.Invoke。检查不构成物理键盘/鼠标、幕布射线输入、跨进程恢复、自然玩家使用频次、全页 FPS 或全照片库滚动性能验收。照片与信箱其它生产行为由各自领域审查负责。
