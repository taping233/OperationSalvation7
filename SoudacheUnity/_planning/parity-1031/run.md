# 局内源码对照与修改（2026-10-31）

当前集中验收已完成，见[本轮结果](../../../搜打撤/docs/evidence/2026-10-31-unity-parity/README.md)。以下为分片实施记录，待验/未运行等时态按记录当时理解。

状态：本片生产代码已冻结，等待主会话统一测试。没有执行编译、测试、Unity 或播放器；没有删除文件、修改 Vite 或提交。

## 已核实的缺失

| 来源与触发条件 | Unity 原差异 | 本轮修复 |
| --- | --- | --- |
| `game/src/run/node-reward-state.js:100` 的 `claimEntrySupply`，开局职业卡领取后移入安全格再主动放弃 | 源给补给卡写 `brought:1`；Unity 走普通 `GrantCard` 没有写标记，主动放弃会把该卡当局内获得卡抢运入库 | `GrantCard` 加可选带入标记，入城领取显式传入；首次领取时才设置 `classCard`，与 `game.run.class-choice.page.js:505` 及源领取函数一致。其余发卡默认保持原行为 |
| `game/src/run/game.run.altar.js:570` 的祭坛战利品经 `openFixedRewardsOnCell` 领取 `tt2-apollo`；附赠由 `game.run.scenes.js:603` 触发 | Unity 祭坛独立 `TryClaimAltarReward` 只发本体，漏掉随机附赠 | 在祭坛同一回执追加独立待领附赠，包含候选与同一奖励随机流；满包可整理后续领，已领本体不重发，回执在附赠完成后才完成。抽取函数与宝箱/神秘商品共用，移除三处重复抽取逻辑 |
| `game.run.altar.js` 的碎片能力卡、传说卡、装备卡均从 `SDT.Cards.all()` 选池 | Unity 三处仅查生成的 `CardDatabase.All`，忽略现行卡库覆盖与自定义卡 | 统一从 `CardLibrary.All()` 读取当前卡库，保留源的候选次序、过滤与随机次数 |

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

## 老板追加的既存冗余清理

生产与测试码再次冻结，仍未执行测试。保留原文件与 meta，只删除已查证不再使用的代码文本。

| 删除内容 | 不再可达的证据与保留入口 |
| --- | --- |
| `SceneTransitionScreen.cs` 中旧 `SceneTransitionScreen` / `RunTransitionScreen` 两套完整过场 | Assets 全域类型搜索只有本文件自建调用；脚本 GUID `b3f80d7f299384b42bd3e71793804ea1` 只出现在自身 meta。实际节点、区域和页面过场由 `CurrentRunFilm` 与 `RunLoopBridge` 分派。文件仅保留现行 owner 注释 |
| `EventDialogChoices` 内旧卡选构建、`EventDialogScreen` 旧 Ink 选择效果转译 | `Build` 已用同一 CardIds/CardKeys 条件提前进入 `BuildCardChoices`；当前内置事件先由 `EventDatabase` 的步骤处理。删除旧 `OnChoose/RunEffect` 及 Runtime 硬编码 `ApplyEventChoice` 表。Ink 现行介绍仍保留；实际自定义事件的单继续收尾走同一个保存命令，必要初始化/存档/战斗失败重试保留 |
| `AltarEntranceModal` / `AltarModal` 的旧 UI 与转发、旧首脑选择元数据 | 两类从未被实例化，旧 `Open` 只转交 `AltarRitualScreen`；唯一现行桥接已直接进入 `AltarRitualScreen.Open`。保留正式 `TryBeginBossGate` 使用的 `FightBoss` |
| Runtime 零调用接口：`Roll`、`EnterNode`、`ChainMove`、`FireRestoreOne/Left/Done`、`EventChoices`、`ApplyEventEffect`、`UseDoor`、`StayHere`、`EnterAltarArea`、`AltarBosses`、`LeaveAltar`、`PayEmergencyExit`、`RndDice`、`Weighted` | 当前源码与 Editor 消费者搜索无调用；旧链移除后复核无遗留符号。地图使用 `TryMoveToNode`；营火使用 `TryFireHeal/TryFireRestore`；闸门使用 `TryUseDoor`；事件使用 `ApplyCurrentEventChoice`；献祭撤离使用正式选择命令 |
| 旧 RollResult / RollCompleted、ShopOpened / PocketRestored 空通知、无消费者的 TransitionInfo 表和 FallbackTransition、紧急付币/火堆/祭坛 UI 数据、旧 CenterPos 与 NextDice | 现行桥接按 `NodeResult.Kind` 与持久回执读取；旧通知没有生产订阅者。去掉每次节点创建时无消费者的 fallback 元数据分配。`Saves.MigrateLegacy` 空调用也删除；Core 旧字段由主会话同步清理 |
| RunInstant 中旧宝箱分支与 OpenChestsOnCell / ChestDropText | `ResolveCell` 已提前以持久宝箱回执处理 chest；旧 OpenChestsOnCell 的唯一消费者是已退役硬编码事件表 |
| EventOptButton 旧通用按钮构建与 ShopScreen.PriceOf/PRICE | 全部实际 EventOptButton 调用均归 NodeShell 的 `CurrentIllustratedNode` / `CurrentNodeScene`，只留下正式两入口；商店价格按正式 `CardLibrary.Price`，私有旧 PriceOf 和重复 PRICE 没有引用 |
| 事件池为空时的旧 MapData.RandomEvents 兜底 | 当前生成的事件卡池固定非空，卡池耗尽已有正式见闻结束页，旧随机表与其唯一 Weighted 消费链移除 |

新增断言还覆盖：祭坛礼物本体占满最后普通格、附赠领取失败时同候选/回执/RNG保持、丢弃占位装备后领取同附赠。所有断言仍等主会话集中执行。旧历史快照中若引用退役接口，不为其添加兼容 wrapper；本轮列出的当前回归项目未引用这些接口。
