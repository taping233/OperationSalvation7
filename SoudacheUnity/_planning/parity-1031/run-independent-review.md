# 局内变更独立只读审查

本次审查覆盖 `CardContainerCommands.Query/CanReceive`、`GameRuntime.Map.GetReachableNodeIds/TravelPath`、入城 `ClaimEntrySupply/GrantCard`、祭坛回赠和共用附赠抽取。没有运行测试或改写局内属地代码。当前代码审查未发现这四组修改引入的确定 P1/P2 回归；以下判断不替代待运行的断言和原生流程。

## 一次可达遍历

原逐终点算法先保留脚下直连（包括未知与跨层返程），其余终点限定当前层且已知；中间节点必须满足 Passable。新实现从脚下展开一次，同样先把脚下直连加入结果，只在当前层沿 Passable继续入队；已知但不可中转的点作为终点加入结果，不入队。start自己被排除，输出继续按Map.Nodes顺序排列。未发现“把可达终点误当中转点”或“允许经内部节点跨层”的回归。

依据：当前 `GameRuntime.Map.cs:48–78`，Vite `map-travel-path.js` 的 `findMapTravelPath`；旧当前快照的逐目标筛选仅用于确认被替代算法，不作为验收passed。待跑 `run-check/Program.cs` 以当前正式 TravelPath逐目标比较，不以新BFS自己产生expected；补充待领奖的火堆/宝箱/事件中转受阻状态更能覆盖Passable分支。

## 容量单遍计数

分组键继续为safe区域+稳定id/variant；第一次遇到同组卡时锁定StackCap/资源类型，与原ZoneStacks取组首卡一致。每满一组容量增加一格，等价于原展开堆叠的ceil(count/cap)。stored仍不占普通/安全格；资源容器扩展仍在过滤stored前统计，符合原ResourceBonus及源 `resourceContainerBonus`；非卡inventory仍按三件一格计普通格。CanReceive保留未满同堆优先接收，物化不可重枚举集合后再查询。未发现本次精简改变这些既有语义。

依据：当前 `CardContainerCommands.cs:15–56`、同文件ZoneStacks/ResourceBonus；Vite `core/card-capacity.js`。本轮200组断言以原正式ZoneStacks展开作expected，包含变体、stored、安全格和资源扩展。它验证本次计数优化等价，不宣称Vite所有同名卡任意组合均穷举。

## 入城带入标记

Vite `node-reward-state.js` 的 claimEntrySupply把每张补给标为brought:1且只有classCard为空时设置首张引用。Unity领取显式传true、GrantCard克隆并写带入标记、领取回执和首张引用置于同一TryPersistMutation，恢复了主动放弃时“安全格中的带入卡仍丢失”的来源契约。旧普通发卡默认不是带入卡，消费判断仍使用brought==1。重复领取在事务前拒绝；文件失败后再进方法会重新读取当前回执，未看到旧回执被重用导致重复领取的路径。

待跑现有断言已覆盖真实写失败、领取一次、安全格、保存/加载和主动放弃；可在原生流程确认领取呈现和实际数量。

## 祭坛独立附赠

Vite `game.run.scenes.js` 的grantEventCard在成功发本体后才对tt2-apollo抽附赠，候选来自当前Cards.all+随机资格，排除自身，消耗loot/reward。新共用RollAcquiredCardBonus保持该池顺序与随机流。祭坛在同一个原子事务追加rewardCardIds，先记录本体索引已领取；因总候选数增加，回执保持未完成。下次GetAltarRewardCards重建列表可独立领取附赠，重复本体索引在抽取前拒绝，附赠池排除自身避免递归。未发现重复抽取或“本体回执提前完成”回归。

现有定向断言覆盖本体写失败、抽取次数、重复回调、保存/加载和附赠领取完成。满包附赠独立保留需要追加或在原生检查中覆盖：本体占满最后空格、附赠不可并堆时领取失败，整理后再次领取仍为同一候选。该项是验证缺口，静态路径已保留候选并按GrantCard结果拒绝索引变更。

## 额外现行差异线索

`GameRuntime.Altar.TrySelectAltarReward`原有传说/装备池仍用CardDatabase.All，而Vite祭坛选择用Cards.all。该差异早于本轮附赠抽取；当前静态内置库行为不受影响，但Unity已存在自定义覆盖时可能继续抽到被覆盖前的静态定义。没有在只读审查中实施，需要主会话按当前自定义卡支持边界判断并协调局内作者。
