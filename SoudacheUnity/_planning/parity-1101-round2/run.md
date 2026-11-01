# 局内第二轮对齐与优化

状态：本片源码与回归源已冻结，等待主会话统一验证；没有编译、测试或启动 Unity。沿用 parity-1031 已核实的奖励回执、带入标记、可达 BFS 和容量口径，不重复处理旧历史计划。

## 已证实问题

1. `GameRuntime.Map.ReserveResourceReward` 仍读取生成的 `CardDatabase.All`。当前 Vite `game.run.resources.js` 从当前卡库 `all()` 筛资源，Unity 应使用 `CardLibrary.All()`，才能保留当前覆盖与自定义资源池。
2. 事件复原步骤用卡牌 ID 同时充当选择键；同 ID 不同变体的消耗区行产生相同卡格键，提交时也只取首个同 ID。Vite 当前复原选择按实际行、卡牌身份与数量校验。现按当前消耗区一次生成只读卡面投影与唯一行键，展示真实变体；键含档位、种子、节点、行号、原数量和卡牌身份，提交重新匹配实际行。`CardFaces` 只存在于运行期 Outcome，未增加存档字段。当前动态投影自然支持返回/读档后的真实消耗区，没有新增旧版回退。
3. 入口补给“全部收下”逐张执行完整保存事务。Vite 按候选顺序授予可接收卡牌后只保存一次。现由正式 `ClaimAllEntrySupply` 合并为一次既有事务，保留顺序、容量跳过、`brought`、首次领取的职业卡身份与 RNG 顺序。整次写失败原子回滚；这明确替代旧 UI 循环中“前几张已保存、后一张失败”的部分批次行为。
4. `AcceptEventOutcome` 原只检查结果非空。骰子演出结束后，旧页面即使被覆盖或来源已变仍可能继续开战/关闭。现绑定 State/档位/种子/节点，晚到结果必须仍归当前页面；被覆盖时由既有返回重建读取持久进度。补给也沿同一来源检查，避免保存通知切页后继续旧反馈。
5. 奖励整理页每堆复制整包、创建目标 OwnedCard 投影，再调用一次投影 Query 和两次 SafeUsed。现复用背包属地 `CreateSafeStoragePreview`，每次 Render 只读取一份共同容量分组，每堆 O(1) 判断；预览不跨库存变更缓存。普通格仍超限时给出明确原因，未放宽正式命令的容量边界。

## 收敛与复杂度依据

- 资源池读取/随机准入过滤从两次改为一次；候选层内顺序、同名去重、每次稀有度与卡牌各一次随机保持原顺序。
- 一键领取 p 张补给的完整状态快照、序列化和提交从 p 次改为一次；逐张容量判定仍按实际收到后的状态进行。当前正常入口通常两张，因此常见批次两次完整写盘收敛为一次。
- 事件 Build 已有完整 Outcome；渲染不再重新调用 GetEventChoices/GetCurrentEventOutcome，取消重复构造选项与候选。卡面快照每次 Outcome 只构造一次，UI 不按 ID 再找回基础卡面。
- S 堆、N 张持有卡的整理可存性从 O(S×N) 和 O(S×N) 临时投影分配，降为一次 O(N) 分组加 O(S) 查表。绘制行数、确认/取消/焦点顺序沿现有视图；没有 FPS 或内存峰值实测声明。
- 删除旧 UI 的逐张补给保存循环、重复事件查询和无意义空选项回退；不删除文件，不修改 GameRuntime 主文件、Persistence、CardContainer 实现或公共 Kit。

## 修改与集成

生产路径：`GameRuntime.Map.cs`、`GameRuntime.Events.cs`、`GameRuntime.EventRoutes.cs`、`EntrySupplyScreen.cs`、`EventDialogScreen.cs`、`EventDialogChoices.cs`、`CurrentRewardCapacityOrganizer.cs`。完整相对路径及 SHA256 见同目录 `run-files.json`。

共享依赖由背包属地维护：`CardContainerCommands.CreateSafeStoragePreview(GameRuntime)` → `BagCapacityQuery.SafeUsed` / `CanStore(CardDef,int,out int)`，沿当前容量规则判最终普通包和安全格。每次重建重新获取，未改其属地文件。

## 待集中验证

1. Unity 根目录运行 `dotnet run --project _planning/parity-1101-round2/run-check/RunRound2Checks.csproj`。独立 profile 在设置环境后才创建 Runtime。计划覆盖当前资源池/权重与 RNG、候选重进不重抽、批量补给一写/顺序/容量跳过/带入标记/读回/失败回滚与重试、复原变体/只读投影/数量与索引及种子变化拒绝/失败候选保留。程序输出 JSON 的 `assertions` 和本地 `result.json`；目前未运行。
2. 新原生入口 `CurrentRunRound2Checks.Run()` 返回 IEnumerator，由主会话 `CurrentRound2Validation` 驱动；`Assertions` 和 `Step` 可读，全部预期通过时 13 条 Require。覆盖真实事件卡面两行/变体文字、实际第二行 ISubmitHandler 领取、补给全部领取仅一次 SaveCompleted、被覆盖/换来源的晚到结果不关闭旧页或抢新焦点。
3. 同时复用既有完整 Run/地图/祭坛/商店/整理焦点与主会话三路回归。原生程序构造输入不声称物理键盘、自然路线或平衡；正常播放器画面由主会话统一核对。

## 覆盖边界

本片实施集中于以上已证实差异。地图 BFS、移动奖励收尾、商店 RNG/已成交保留、撤离持久回执均沿上一轮已验实现；没有据未运行源码推断其完整新一轮通过。商店整页重建仍是后续可定向评估的开销，本批未把它扩成通用视图框架。
