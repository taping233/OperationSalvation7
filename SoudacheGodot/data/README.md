# Godot 数据快照

这些 UTF-8 JSON 是 Godot 迁移使用的静态内容快照，唯一内容来源为原版
`搜打撤/game/src` 中的 `cards.js`、`characters.js`、`rules.js` 和 `mapData.js`。

在仓库根目录运行：

```text
node SoudacheGodot/tools/export_data.mjs
node SoudacheGodot/tools/validate_data.mjs
```

`export_data.mjs` 在隔离 Node VM 中读取原版模块。卡牌模块不是纯数据模块，依赖
`window.SDT`、图标命名空间和 `localStorage`；导出器提供最小的内存垫片，并在空存档
上运行原版播种、职业整合和词条回填。因此快照包含原版自有的 243 张正式卡牌，以及
单独的 `starterCards` 新手兜底表（原版这 3 张卡没有 ID，导出器为它们分配稳定适配器
ID）。快照不包含玩家制作坊或浏览器存档中的自定义卡。它只接受 `搜打撤/game/src` 下的输入，并明确
拒绝 `.tmp` / `sts2-reverse` 路径；没有复制反编译代码、资源、文本或 ID。

输出文件：

- `cards.json`：卡牌定义、3 张新手兜底卡、职业/类型/稀有度表、伤害和掉落规则。
- `characters.json`：五名角色及旧职业别名。
- `rules.json`：分组规则与兼容的顶层别名。
- `map.json`：三环地图、格子事件、怪物/首领、宝箱表、环坐标和确定性结点布局。
- `manifest.json`：来源文件 SHA-256、编码和当前快照数量。

Node 校验会检查 JSON 可读性、来源哈希、ID 唯一性、`tokenOf`/职业/遭遇/宝箱引用、
地图拓扑、五名角色、243 张正式卡牌（另有 3 张兜底卡）、类型分布以及关键规则常量。原版地图的外环只有
20 个显式事件条目；入口和门仍属于 28 格逻辑环，二者在 `map.json` 中分别由
`eventEntryCounts`（可由校验推导）与 `logicalCounts` 表示。
