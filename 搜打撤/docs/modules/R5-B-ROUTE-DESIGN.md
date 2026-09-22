# R5-b L2 补给支路 / 交战支路设计门

## 玩家结果与固定样本

新开的普通远征在第二层一个四格回路上形成真实二选一：**补给支路**先到现有物资点，**交战支路**先进入现有遭遇战，随后在同一节点汇合。相邻路线按钮只说明已可见节点类型和风险，不显示具体卡牌、掉落或事件结果。两路使用现有 chest/battle 结算；不新增奖励池、撤离费用、职业收藏来源、层数或节点。

以下索引均为零基，节点号为 UI 的一基显示。交换整个 `def` 内容，节点 id、坐标、边不动；总配额保持 `battle3/chest2/event2/resource1/fire1/shop1/entrance1/door1`。

| 固定 seed | 分支起点 → 汇合点 | 补给支路 | 交战支路 | 有界类型交换 |
| --- | --- | --- | --- | --- |
| `r5-route-a` | `L2_N3` idx2 `(1,0)` → `L2_N5` idx4 `(2,1)` | `N3 → L2_N6` idx5 `(2,0)`，`resource→chest` → `N5` | `N3 → L2_N4` idx3 `(1,1)`，保持 `battle` → `N5` | `L2_N6` idx5 与 `L2_N9` idx8 `(4,-1)` 交换；N9 `chest→resource` |
| `r5-route-b` | `L2_N7` idx6 `(3,-1)` fire → `L2_N9` idx8 `(4,-2)` shop | `N7 → L2_N8` idx7 `(3,-2)`，`event→chest` → `N9` | `N7 → L2_N10` idx9 `(4,-1)`，保持 `battle` → `N9` | `L2_N8` idx7 与 `L2_N3` idx2 `(1,-1)` 交换；N3 `chest→event` |

这两组都改变实际节点类型，且分支走到的正式结算不同，不是给原路线换名字。fire/shop 不移动，因此既有设施位置和设施互不相邻约束不变；交换只在 battle/chest/event/resource 之间进行。

## 生成接口与快照合同

新增纯模块：

```js
applyRouteOverlay({
  seed, generatorVersion:3, layoutVersion:9, layerData,
  routeVersion:'r5-routes-v1'
})
  -> Result<{ layerData, routeVersion, routePlan, status:'applied'|'fallback' }>

routePlan = {
  layerIndex:1, startNodeId, rejoinNodeId,
  supplyNodeId, riskNodeId,
  swaps:[{ aNodeId, bNodeId, beforeA, beforeB }],
  fallbackReason:null|'NO_MUTABLE_BRANCH_PAIR'
}
```

本版无额外剧情条件，也不添加奖励或改结算。算法只在新局的现行 3/9 `createLayeredMap(seed)` 之后运行：枚举 L2 简单四格回路及两组对角端点，按节点索引规范排序；分支中间节点不得是 entrance/door/fire/shop/extraction/altar/boss/emergencyExit。选中候选后，在全层可交换普通节点中稳定寻找 chest donor，以实际类型不同的有限置换令一支为 battle、另一支为 chest；若 supply 本来就是 chest，不把同类型交换算作 applied。所有选择只由原图和排序决定，无 seed 特例、额外 RNG 或无限重掷。应用后调用 `validateGeneratedMap`，并独立检查每个 battle 的同层 battle 邻接数不超过 1；任何失败丢弃草稿，返回原始深拷贝图和可追溯 fallbackReason。异常也回退并记录，不让新局失去原图。

对根样本 `r5-check-0..99`，几何扫描 L2 全部有四格回路；按“不移动 fire/shop/门”的内容门，完整质量门（含 `validateGeneratedMap` 与战斗节点同层战斗邻接数 ≤ 1）实测 63 个应用、37 个有限回退；其中 9 个为 `NO_MUTABLE_BRANCH_PAIR`，28 个为 `QUALITY_GATE_REJECTED`。验收测试钉死 100 个结果均连通、节点/边/层数不变、配额不变、设施 id/坐标/间距不变；applied 必须同时存在可达的 chest 与 battle 分支，fallback 必须保持原图深相等且只尝试一次。

R5-a `snapshotVersion:1` 继续表示无路线覆盖的旧快照。R5-b 新局写严格 `snapshotVersion:2`，新增必填 `routeVersion` 和 `routePlan`；外层 run 同时保存 `routeVersion` 便于选档摘要，并与 snapshot 不一致时拒绝。v1 snapshot 和无 snapshot 的旧 3/9 恢复绝不调用 `applyRouteOverlay`；它们保持原拓扑。v2 恢复只读 snapshot 内已经落定的节点/routePlan，不重新选择或交换。未知 routeVersion、伪造 node id、plan 与实际节点类型/边不一致均保留原串拒绝。

`expeditionRoutes(game)` 复用当前真实相邻节点按钮，只在玩家正位于 `routePlan.startNodeId` 且目标恰为 supply/risk 节点时增加路线角色，不把已有类型提示改名冒充新路线：

- `补给支路 · 物资点`：`已知物资节点 · 具体收获进入后决定`。
- `交战支路 · 遭遇战`：`已知战斗风险 · 胜利后按现有规则结算`。

离开分支起点后恢复普通节点文案；未探索的远端节点不从 routePlan 泄露。动作仍使用原 `li/idx`，展示层不拥有合法性或奖励。`renderExpeditionPanel` 对 snapshot 可变的层名、路线名、hint 与 aria 文本统一 HTML 转义后再插值，不能把存档字符串写成任意 HTML；只收紧该视图，不扩成安全专项。

## 文件范围、失败标准与验收

实施范围：新增 `game/src/route-overlay.js`、`tests/r5b-route-overlay.test.js`、交付文档；最小修改 `game/src/map-snapshot.js`（v1/v2并存）、`game/src/game.session.js`（仅新局应用、保存/恢复 routePlan）、`game/src/expedition.view.js`（起点两按钮标签）、`game/src/game.run.dev.js`（开发控制台只读诊断行）、`tests/r5a-*.test.js` 与定向 view/session/dev 呈现测试、`docs/save-format.md`。不改 `map-generator.js`、`layeredMap.js`、`map-graph.js` 的 3/9 基础生成，不改场景奖励、战斗、撤离、经济或 QA05 当前存档。开发控制台只显示已生成的 mapSeed、snapshot/routeVersion、status 与 fallbackReason，所有值转义；不提供 seed 输入、强制重生成或玩家默认 UI。

正常：两个固定 seed 的矩阵逐项相等；100 seed 满足上述 applied/fallback 约束；新局 snapshot v2 刷新后 routePlan、类型和位置不变。失败：覆盖候选或验证异常时只回退本次新局的原 3/9 图并记录原因，不留下半交换；存档 v2 损坏时沿用 R5-a 可见阻断，不降级重生。重试：同 seed/routeVersion 结果深相等，载入不再随机奖励或重做覆盖。

IAB 验收分两条正式流程：用固定 `r5-route-a` 到 L2_N3，分别进入 N6 物资支路与 N4 战斗支路；用 `r5-route-b` 到 L2_N7，确认按钮为 N8 补给与 N10 战斗并各走一支。每条在分支稳定节点刷新一次，节点类型、按钮标签、位置与已结算状态不变；具体掉落只记录实际结果，不预设。固定 seed 仅由自动化直接调用与所有新局相同的纯覆盖算法，逐项验证矩阵、快照与刷新恢复；生产代码不识别验收 seed，也不增加 seed UI 或 `newRun` 特例。IAB 另以 `http://localhost:4179/` 空档来源创建一场真实随机新局，走到实际分叉后分别验证两支及刷新；这项证据不伪称固定 seed 实机。`http://127.0.0.1:4179/` 的 QA05 旧 v1 火堆局只作兼容对照，不读取、不覆盖。

停止点：实现、定向自动化与交付文档完成后停写，等待 Friday 在独立 `localhost` 来源做真实随机新局刷新验收；不扩到 L1/L3/L4 或批量新地图。

