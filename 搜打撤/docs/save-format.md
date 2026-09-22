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
