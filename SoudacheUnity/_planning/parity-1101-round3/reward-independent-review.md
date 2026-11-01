# 奖励片独立只读审查

结论：指定三个生产文件的本轮差异中未发现确证回归，无需提出生产修补。审查时三文件 SHA 与 `reward-freeze.json` 一致；没有运行测试、编译或 Unity，也没有编辑生产/测试源码。

## 核对结果

- **旧确认和保留行：** Organizer `Render` 每轮递增 revision，`Bind` 替换完整 ButtonClickedEvent 并捕获该轮 revision（`CurrentRewardCapacityOrganizer.cs:29–31,92–97`）。取消后或同一确认控件重新激活时，旧事件仍携带过期版本；确认另查 `_pending==uid`。关闭置 `_closed` 并递增版本（122），不会同帧穿透到替代页面。Live 同时检查 top、活动组件、owner 仍挂栈、RunState/seed/slot/node 与 pending 状态。保留 root/行/底部按钮没有放宽操作来源。
- **UID 与容量：** 行以当前堆首 UID 定位，命令捕获该轮堆 UID 集；移入安全格仍走正式 `TryMoveSafe`，确认丢弃仍走正式 `TryDiscard`。每 Render 新建 safePreview，预览同时沿用总容量、普通容量和安全格约束，没有跨库存缓存。当前命令仍在执行时重验 UID/来源/容量；这一片没有改变 UID、授予或 RNG 逻辑。
- **保存失败与焦点：** `Perform` 只在命令成功时清 pending 和写成功回执（119–120）。命令未选择 retainApplied，继续使用既有默认事务回滚；失败时该 UID 的确认态保留并重新绑定。焦点优先同 UID/动作，行消失后用原位置的当前行，末行耗尽回返回按钮（105–118）；恢复焦点之前再查 Live，已移除 owner 不会被旧页聚焦。此为静态调用判断，I/O/焦点实际行为留给集中原生检查。
- **旧 Tile：** `CurrentRewardTile.Set` 更换读卡/领取事件并绑定 revision 和 item 引用（`CurrentRewardScene.cs:111–127`）；OnDisable 再失效版本（95）。所以同 tile 重绑和移除旧 tile 都不能把旧 index 送入下一箱。现行消费者的键含来源索引/卡 ID 或实际复原行 key；新旧回调分流不重建现有面。领取继续检查 180ms、scene 当前性和实时 LiveState。
- **保留布局：** Scene.Sync 用输入顺序直接形成 `_ordered`，移除项先停用再销毁，导航只使用本轮有序列表；空列表不会执行取模。Flow 每一布局阶段仍重新测量宽高、普通/附赠边界和 spacing，只复用 Row/Items 容器，以 `_rowCount` 限定有效行（`CurrentRewardFlow.cs:15–30`），没有误用池中剩余行。Pop 分段插值与原 `[1,1.16,.98,1]` 三段数值一致。
- **读卡 owner：** `OwnerMounted` 的 Count/PanelAt 扫描保留栈成员身份检查并增加活动性；替代 CapturePanels().Contains 后不再复制整栈。补读当前 UiStack 确认覆盖页没有停用再启用奖励 tile 的路径，关闭才将页面 SetActive(false)，没有发现 OnDisable 版本失效导致正常覆盖返回失去事件的现行路径。

## 集中验收与范围

已只读核对正式 `CurrentRewardRound3Checks` 的覆盖：原生提交下的保留/确认/整堆安全格、滚动与焦点、保存故障回滚、关闭/替代/owner 移除、旧 UnityEvent 重放、保留 tile 与 Row 池。旧事件重放是独立构造，不等同物理用户输入。Root 仍需执行原生检查并核正常播放器画面；本报告不声称运行通过或 FPS/GC 数值改善。

只读补查限定为上述实际消费者、正式容器命令的事务入口、UiStack 的覆盖/关闭机制和既有原生检查源码；没有扩大到新玩法或其他窗口。

| 生产文件 | SHA256 |
| --- | --- |
| CurrentRewardCapacityOrganizer.cs | 974543d01b8c2a29ca8e499b5818fcbc08a936c7d73bb28ce55f08499534f457 |
| CurrentRewardScene.cs | 030d222ed3b9a57de6e1b531941b7500287e5f46bbdd9dbed971e2e7df4c5195 |
| CurrentRewardFlow.cs | 1f1f39a63bb77225554e66c774d343729f94936de18537bfeed3640bf7a4f721 |
