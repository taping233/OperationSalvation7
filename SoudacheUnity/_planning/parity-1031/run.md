# 局内源码对照与修改（2026-10-31）

状态：本片生产代码已冻结，等待主会话统一测试。没有执行编译、测试、Unity 或播放器；没有删除文件、修改 Vite 或提交。

## 已核实的缺失

| 来源与触发条件 | Unity 原差异 | 本轮修复 |
| --- | --- | --- |
| `game/src/run/node-reward-state.js:100` 的 `claimEntrySupply`，开局职业卡领取后移入安全格再主动放弃 | 源给补给卡写 `brought:1`；Unity 走普通 `GrantCard` 没有写标记，主动放弃会把该卡当局内获得卡抢运入库 | `GrantCard` 加可选带入标记，入城领取显式传入；首次领取时才设置 `classCard`，与 `game.run.class-choice.page.js:505` 及源领取函数一致。其余发卡默认保持原行为 |
| `game/src/run/game.run.altar.js:570` 的祭坛战利品经 `openFixedRewardsOnCell` 领取 `tt2-apollo`；附赠由 `game.run.scenes.js:603` 触发 | Unity 祭坛独立 `TryClaimAltarReward` 只发本体，漏掉随机附赠 | 在祭坛同一回执追加独立待领附赠，包含候选与同一奖励随机流；满包可整理后续领，已领本体不重发，回执在附赠完成后才完成。抽取函数与宝箱/神秘商品共用，移除三处重复抽取逻辑 |

## 已清理的额外开销

- `GameRuntime.Map.GetReachableNodeIds` 原为每个地图节点分别 BFS，且 `FindNode` 每次扫描全节点。现一次遍历求全体可达终点，只有可中转节点进入队列；保留直接未揭示边、跨层直接返程、同层终点与待领奖阻断，按正式 `Map.Nodes` 顺序返回。移动命令仍通过当前 `TravelPath` 确定最短路径；共同中转判定只有一个入口。常用规范 ID 改字典查找，外部别名仍保留原映射。
- `CardContainerCommands.Query` 原复制全部持有卡，再两次分组、展开堆叠实体。现一次遍历按原稳定键与区域计数，保留装备一格/其余三张、同 ID 变体、安全格、stored/pouch 与全部容器资源扩展语义。`Stable` 不再创建临时 `StashStack`；`CanReceive` 不再重复复制已物化集合、重复计算目标键和重复读取容器规则。
- `CurrentNodeScene` 原凭据页每帧 `ForceRebuildLayoutImmediate`。现内容完成或尺寸变化才强制布局，其余仅在内容高度改变时更新矩形；普通节点也跳过尺寸、内容高度与页脚均未变化的布局。
- `CurrentNodeChoice` 原每帧解析多种颜色、重置所有矩形。现交互状态变化才刷新样式，宽度/文字高度变化才布局，悬停事件直接更新底色。继续观察实际高度变化，保留中文折行后下一帧调整。

## 修改路径

- `Assets/Scripts/Sdt.Run/GameRuntime.cs`
- `Assets/Scripts/Sdt.Run/GameRuntime.Map.cs`
- `Assets/Scripts/Sdt.Run/GameRuntime.Altar.cs`
- `Assets/Scripts/Sdt.Run/GameRuntime.CurrentNodeRewards.cs`
- `Assets/Scripts/Sdt.Run/GameRuntime.ShopAcquisition.cs`
- `Assets/Scripts/Sdt.Run/CardContainerCommands.cs`
- `Assets/Scripts/Sdt.UI/Screens/Run/CurrentNodeScene.cs`

## 集中验证入口

1. 从 Unity 工程目录运行 `dotnet run --project _planning/parity-1031/run-check/RunParityChecks.csproj`。本轮新断言覆盖带入标记/安全格放弃/读档、真实写失败回滚、祭坛礼物随机流/独立待领/重复回调/读档；三份地图多位置的整图可达结果对照正式逐目标路径；200组容量投影对照原正式堆叠展开。
2. 既有现行源向量回归：`_planning/migration-1029/travel-departure/TravelDepartureChecks.csproj`、`container/ContainerChecks.csproj`、`current-departure/DepartureChecks.csproj`、`run-finish/RunFinishChecks.csproj`。这些旧证据不直接当本轮结果，运行时使用当前 Assets。
3. 原生回归：普通节点、祭坛战利品领取/满包/背包往返、凭据两骰/折叠规则/免费商品的动态长文布局，商店随机与发牌附赠。实际绘制与领域命令证据分别记录。

## 边界

本片核对了当前地图移动、资源/入城补给、营火与祭坛、事件路线、宝箱、商店附赠的实际实现。没有声称穷举所有事件与内容组合或全游戏无差异。旧三环类的静态残留在当前入口被提前分派拦截，本片未据此删除文件。没有改变默认保存失败原子回滚边界；商店已成交保留规则维持原实现。
