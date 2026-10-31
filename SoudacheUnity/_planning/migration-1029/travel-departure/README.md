# 跨层通行、出发清消耗区与事件重入回归

2026-10-30 核对现行源后修复，生产改动限 `Sdt.Run`；未启动 Unity、未进行前台操作、未运行共享编译。

## 现行行为

- 地图先接受脚下节点的直接边，包括跨层返回边。更长路线限定本层，只穿过已知入口、空白节点或已消费普通节点；闸门、祭坛、首脑不能成为自动中转点。
- 每经过一格都关闭来源内容、提交目标层位与位置、记录首探并增加一次行动。整个 Unity 移动仍由现有保存事务提交，写入失败恢复原位置与全部计数。
- 新出发与仓库扣卡、局内新局状态一并清空基地消耗区。容量拒绝或落盘失败保留原消耗区。
- 首次事件落脚仅呈现一次；公共 `TriggerEventCard` 仍能独立呈现。事件战斗完成同步事件完成凭据；已完成收据拒绝旧的开战回调。

## 来源与验证

`source-vectors.mjs` 直接导入现行 `findMapTravelPath`、`createBaseDepartureCommands` 和 `settleEventCommand`，不复制其实现。保存了来源 SHA256，四个种子的当前 JS 地图用作路径输入；合成三节点图只补充新地图配额中没有的空白节点及待领奖边界。

依据：`map-travel-path.js` 的直接边及中转规则；`game.run.flow.js` 的逐格提交；`base-departure.commands.js` 的清空消耗区与失败返回；`game-session-departure.js` 的出发候选和清空说明；`game.run.events.js` 的统一事件入口；`event-commands.js` 的单次结算凭据。

执行（项目根目录）：

```powershell
node _planning/migration-1029/travel-departure/source-vectors.mjs
dotnet run --project _planning/migration-1029/travel-departure/TravelDepartureChecks.csproj --no-launch-profile
```

已通过：`data-20261029-172934-842/result.json`，9590 项断言；4704 个实际 JS 路径向量、44 个中转边界、4 个迷雾/补给向量、4 个出发向量；3 次真实文件写入失败。覆盖跨层返回、逐格行动和首探、保存失败完整回滚、出发容量拒绝、成功后读档、事件单次呈现与结算后拒绝再次开战。

纯 Run/Core 验证使用独立输出目录及隔离存档；Unity 原生画面/输入验证由主会话集中执行。
