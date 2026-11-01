# Hub 本轮独立只读审查

结论：在本轮指定的五个生产文件中未发现确证回归，未提出生产修改。容量、UID、过期按钮和保存失败路径的静态合同成立；运行结果由 Root 集中验证，本审查没有编译、测试或启动 Unity。

## 审查范围与依据

- `Assets/Scripts/Sdt.Run/CardContainerCommands.cs`
- `Assets/Scripts/Sdt.UI/Screens/Bag/BagScreen.cs`
- `Assets/Scripts/Sdt.UI/Screens/Bag/BagCurrentView.cs`
- `Assets/Scripts/Sdt.UI/Screens/Bag/BagCurrentCell.cs`
- `Assets/Scripts/Sdt.UI/Screens/Bag/ContainerScreen.cs`

以当前工作树相对 Unity 仓库 HEAD 的差异为边界，沿实际按钮→命令→既有 `TryPersistMutation` 调用读取。只补读 `GameRuntime.Persistence.cs` 的事务收尾以及本轮 `CurrentHubSaveRound2Checks.cs` 的覆盖范围，没有扩查其他系统。

## 已核实的行为

1. **安全格预览未放宽容量。** `CardContainerCommands.cs:30–41` 使用本次 Query 的同一组计数，以完整堆叠的向上取整差计算安全格新增格与普通包减少格，同时检查安全格、总占格和普通占格。装备仍为一张一格，其余三张一格；同 ID 的 variant 分组独立。资源扩展只增加总容量，普通占格超过基础容量时，移动资源进安全格无法修复普通超限，返回 false；移动普通卡只有真正释放足够普通格才可通过。`CanTakeFromContainer`（19–27）也同时检查总容量和普通容量。

2. **预览生命周期正确。** `BagCurrentView.cs:74–108` 每次刷新创建一份 Query 并传给布局；容器 `Build`（74–94）创建一份 Query 给整页选项使用，没有跨库存变更持有容量快照。预览不写卡牌、UID 或 RNG。

3. **整叠转移保留 UID 和来源。** `CardContainerCommands.cs:95–126` 对已观察 UID 做非空、重复、当前来源、数量和 Stable 身份验证。HashSet 仅用于成员查询，实际 entries 仍按 ownedCards 顺序；新投影只用于容量判定。全部验证后才更新原对象的 stored/pouchOf，未新造实际 UID。整叠取出从每个前缀投影改为一个最终投影；对于正式入口形成的 stored 卡组，容量随取出数量单调增加，最终检查保留整叠原子结果。

4. **旧容器按钮无法穿透当前页面。** `ContainerScreen.cs:53–55,163–167` 将 generation、运行时、RunState、Base、槽位、seed、顶层 owner、局内/非战斗状态一起绑定。重绘替换整个 ButtonClickedEvent，外部保留的旧事件仍携带旧 generation；关闭再加一代并置 closed。UI 复用没有让旧监听器指向新条目。Bag 的延迟详情沿既有 generation + owner/top 检查，刷新先取消拖拽和延迟详情（`BagCurrentView.cs:77`、`BagCurrentCell.cs:93–101`）。

5. **保存失败仍完整回滚。** 容器转移调用默认 `TryPersistMutation`，未选择 retainAppliedOnSaveFailure。既有事务在失败时恢复 State/Base/RNG/槽位并取消延迟事件（`GameRuntime.Persistence.cs:40–60`）。`ContainerScreen.Transfer`（191–197）随后从当前恢复的状态重建，失败回执不会宣称存入/取出成功；新 UI 闭包随重建重新绑定，不继续引用失败投影。

## 性能判断

- Safe/容器取出按钮预览复用 Query 分组，逐选项只作字典查询和整格差计算，避免每个选项复制全包并重新扫描。整页相关计算由重复的 O(S×N) 投影查询降为一次 O(N) Query 加 O(S) 预览；持久化快照本身仍有原有成本。
- 整叠取出从 K 次全包投影/Query 改为一次最终 Query，相关计算由 O(K×N) 降为 O(N+K)，没有改变状态顺序。
- 背包分组一次形成 bag/safe 两区，排序建立索引；散装资源目录在一轮刷新内仅过滤一次。容器保留页面、滚动器和 UID 集合未变的格子，卡面仅在现有九字段指纹变化时重建；每轮仍会更新按钮和布局，未声称零分配或零重绘。

以上为源码复杂度与对象创建路径依据，未进行耗时或分配测量。

## 集中验收提醒与限制

现有 `CurrentHubSaveRound2Checks.CapacityCases` 已有同名 variant、装备/普通/资源、safeCount 和堆边界矩阵，但矩阵 bagCount 最大 4，初始资源填满用例也是普通占格合法的状态。建议集中检查再直接构造 **ordinarySlots > baseCap 且 used <= totalCap**，分别验证资源移入 safe 仍拒绝、普通卡释放足够格后允许、容器取出仍拒绝，防止以后只检查总容量。当前生产公式已正确覆盖这一条件；这是验收覆盖提醒，不是确证生产缺陷。已即时通知 Root。

本审查没有模拟保存故障、执行旧 UnityEvent、真实鼠标/键盘输入或测量帧性能，不把静态结论写作运行通过。未改任何生产或测试源码。

## 审查时生产文件 SHA256

| 文件 | SHA256 |
| --- | --- |
| CardContainerCommands.cs | f3d634055035b267d379459240a915f50e02ba6d7e5f0ec55d2b86b40007a7d5 |
| BagCurrentView.cs | a2a4084a2ffd61b317804212e8d0517a5c2124daecf4671851cbd591f19b74d9 |
| BagScreen.cs | ca90cd3e4c8d1ba600563d1bfb8a7b1ae11218a10e6ef4cf1e3867a411d4c4da |
| ContainerScreen.cs | 6118c605c664ec53388104a5b71853d231c57cf3fb1cbe7d08958e84dc0627f2 |
| BagCurrentCell.cs | 482c82ad39e6fe05905af9504b5757fe36672bcac53d73735d21a5ce518f5564 |
