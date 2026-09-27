# 存档兼容契约

## localStorage 键

| 键 | 作用 |
|---|---|
| `sdt-save-v2-slot1..5` | 五个档位的进行中对局 |
| `sdt-base-v2-slot1..5` | 五个档位的基地与局外成长 |
| `sdt-save-v1` | 旧单档对局；启动时迁入档位 1 后删除 |
| `sdt-base-v1` | 旧全局基地；启动时复制到尚无基地数据的档位后删除 |

设置项、卡牌库和格子备注仍使用各自已有键，不与档位存档合并。

每个普通进行中对局保存顶层 `seed`、`mapSeed`、`generatorVersion`、`layoutVersion`、`geometryVersion` 与 canonical `mapSnapshot`；`rngState` 保存各命名随机流的位置。读档先纯校验快照和当前位置，再恢复随机流并重建四层地图的运行时派生字段。`geometryVersion` 只用于渲染缓存失效，不参与玩法判定。龙巢 `nestActive=true` 使用独立的 `nestPos` 等字段，不要求普通四层快照。

地图版本字段的职责如下：

- `mapSeed`：本局地图的唯一重建输入。新局在确定运行 seed 后立即生成；不允许在应用启动时用临时随机数替代。
- `generatorVersion`：生成该拓扑的算法版本，不再在读档时静默升级。
- `layoutVersion`：网格到世界坐标的布局版本。节点中心距由布局层固定为约 120 世界像素，避免把旧的全局横移公式带入新图。
- `geometryVersion`：当前地图几何缓存签名；换 seed 或布局版本时改变。
- `mapSnapshot`：`snapshotVersion=1` 的普通 JSON 数据，保存四层节点 id/type/网格坐标、双向边、入口、出口和 forward door 描述。它是进行中普通地图的拓扑真源；`toLogical`、世界坐标、bounds 缓存、扁平节点表和 `Map` 对象均在校验后重建，不入存档。

无 `mapSnapshot` 的旧普通图只有在明确记录 `generatorVersion=3`、`layoutVersion=9`，并且存在真实 `mapSeed` 或 `seed` 时才允许由保留的 3/9 生成器重建并冻结。缺 seed、缺地图版本、未知版本或位置越界均拒绝恢复，原 run 串保留；不再制造 `legacy-slot-*` seed，也不把位置 clamp 到另一个节点。快照存在时，它与外层 seed/version 任一冲突都拒绝，不悄悄选择一侧。读取旧档不会保存动画中间态。

移动事务只在稳定节点落点后保存：对局进入 `moving` 状态时不写档；页面刷新、退出或崩溃后恢复到上一次已完成的 `layerIdx` / `trackPos`。动画完成后才递增 `turn`、结算节点事件并写入存档。

## 兼容要求

- RunStorage 顶层仍是可扩展对象：与地图无关的旧缺失字段可由现有迁移/default 补齐，未知顶层字段可保留或忽略。`mapSnapshot` 是独立的严格 schema；未知键、非 JSON 值、重复/越界/单向边、额外跨层传送边、重复坐标和未知快照版本均拒绝，不能用“顶层可扩展”绕过。
- 迁移必须先成功写入目标键，再删除旧键。
- 删除档位只删除对应对局与基地数据，不影响其他档位。
- 重构允许移动函数和模块，不允许静默更改字段含义、资源数量、卡牌归属或安全格规则。

固定兼容样本位于 `tests/fixtures/`，由 `tests/save-compat.test.js` 覆盖 RunStorage v1/v2 字段迁移、跨档隔离、未完成对局、基地、职业、成就和卡背。这些 fixture 没有地图版本，证明不了原地图可恢复；地图恢复契约另由 R5 快照测试覆盖。任何存档格式变更都必须同步更新相应样本与迁移测试。

## R5-b 路线快照 v2

新开的普通远征在现行 3/9 地图生成后尝试一次 `r5-routes-v1` 覆盖。成功或有诊断回退的新局均保存 `snapshotVersion: 2`、外层 `routeVersion`，以及严格的 `routePlan`；应用计划必须与快照内起点、汇合点、补给 chest、交战 battle 和四条分支边一致。回退计划只保存状态与原因，不宣称存在双路线。

旧 `snapshotVersion: 1` 与无快照的旧 3/9 对局仍走原恢复逻辑，绝不补做覆盖。未知路线版本、外层与快照版本冲突、计划节点/边/类型不符时保留原始存档并拒绝载入。顶层 run 仍允许既有扩展字段；`mapSnapshot` v1/v2 各自执行严格字段合同。

## E5 装载与回写结果

读档顶层必须是普通记录，不能是数组或标量。缺失 `version` 仍按历史版本 0 迁移；显式版本须为非负整数，字符串、空值、小数及其他非法形状视为损坏，合法但高于当前版本的整数单独报告版本过新。原始存档键保留，损坏备份失败时只承诺原档保留，不声称备份成功。

业务预检复用现有地图、撤离身份和恢复日志检查，只验证真实装载消费者需要的容器与记录形状；不按当前卡库过滤未知卡 ID，不丢弃坏数组元素后重存，也不新增资源数量或平衡限制。固定旧档迁移样本与可恢复的旧 3/9 地图分别验证，前者不代表能恢复原地图。

| 字段 | 结构前提与兼容默认 |
|---|---|
| `inventory`、`cardBox` | 数组元素为记录；顶层缺失/null 仍归为空数组 |
| `ownedCards`、`usedPocket` | 数组元素及其 `card` 都是记录；顶层缺失/null 仍归为空数组 |
| `cardOrder`、`eventLog`、`discovered` | 数组；缺失/null 仍使用既有空集合默认 |
| `visited`、`seen`、`shopStocks` | 记录；缺失/null 使用空记录。已有商店货架为数组，普通在售项要求 `card` 记录，空位/售罄/神秘项保留原语义 |
| 龙巢 `nestRunes`、`nestEquipped`、`pendingRunePick` | 缺失/null 保留原默认；存在的符文为记录且 `attrs` 是数组。只有严格 `nestActive === true` 采用龙巢分支 |
| `battle` | 缺失/null 保留；存在时为记录。按真实恢复分支校验其直接消费集合，不另建完整战斗 schema |
| `battle.run` | 重启检查点直接应用到运行态，因此同名集合存在时必须满足消费形状；不会套用顶层装载的 null→空数组默认 |

结构拒绝返回 `INVALID_RUN_STRUCTURE` 并指出字段路径。读取缓存与返回给装载者的嵌套对象隔离，运行态修改卡实例或地图不会污染同一原串的下次读取。正常重读或缺档清除陈旧读取异常；列表与菜单预检均不推进写入基线。

实际装载先取得与读入原串绑定的内部凭据，完成全部纯预检后，才在运行态副作用前采纳该原串为写入基线。采纳时当前串已变则返回 `STALE_SLOT`，读取异常则返回 `STORAGE_READ_FAILED`，原写入基线保持。拒绝坏结构、坏地图或坏撤离记录后，仍在运行的旧局不能因此获准覆盖另一标签的替换档；菜单对替换档的成功预检也不授予这种覆盖权限。实际成功装载最新合法档后，才可基于它继续保存。既有 `readForLoad` 直接消费者保持兼容，生产预检不再用它提前接纳基线。

`loadGame` 的 `ok` 继续表示装载分支是否成功。返回的 `persistence` 单独描述本次同步装载中实际调用的保存，不代表整个档位的事务保证：

```js
{
  status: 'not_attempted' | 'succeeded' | 'failed',
  attempts: [{ target: 'base' | 'run', reason: '保存原因', ok: true /* 或 false */, code: '可选失败码' }]
}
```

零次保存调用为 `not_attempted`，所有调用成功为 `succeeded`，任一调用失败为 `failed`；后一次成功不能抹掉先前失败。保存明细包括原有术语迁移、时长迁移、普通地图 `enterLayer` 的保存及战斗恢复回写；不为生成结果增加保存次数。常规保存被运行态守卫提前拦住时不算写入尝试。

`reason` 为 `card_rename`、`elapsed_migration`、`play_time_sync` 或 `save_game`。基地失败码为 `BASE_SAVE_FAILED`；对局失败码优先采用存储层的 `STALE_SLOT`、`RECOVERY_REQUIRED` 或 `STORAGE`，否则为 `RUN_SAVE_FAILED`。正常返回、预检拒绝和抛错都会释放本次收集上下文，后续保存不再修改已返回的结果。

已经可以继续的装载，即使回写失败仍可返回 `ok: true`，同时明确提示本次部分进度未保存。菜单进入与 Agent `enterSlot` 的成功仍只说明进入完成，不升级为持久化承诺；E4 的转场归属、战斗加载身份及完成凭据保持原语义。预检拒绝返回 `preserveRun: true`，原 run/base/journal 串保留，且不会先修改随机流、安装地图、调用 `Base.use` 或赋值运行态。
