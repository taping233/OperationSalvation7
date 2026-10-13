# 战场布局线定向记录

2026-10-12。战斗舞台改用 `battle-ui-v13`：顶部显示遭遇、回合与当前阶段，战场保留冬日分层场景和常驻单位，底部固定能量、手牌与结束回合。阶段提示只描述当前操作。敌人按实际数量占独立列，复合意图逐项放在所属敌人的信息组中；单位名、生命、状态保留在各自名牌内。

`battle.view.js` 的舞台差分与场景生命周期未改写；`battle.layers.js` 保留手牌、单位节点复用。新增手牌状态 `data-hand-state`、受限原因 `data-block-reason` 与“规则”按钮，供手牌线的阅读面使用。按钮阻断出牌点击与拖拽起始。`battle.aim.js` 中的 `showHandCardDetails(uid)` 由手牌线提供。

定向检查：`node --check game/src/battle/view/battle.view.js`、`node --check game/src/battle/view/battle.layers.js`、`git diff --check` 均通过；`npm run test:target -- tests/battle-hand-selection-rules.test.js` 通过，1 文件 3 测试。当前窗口战斗实页由主会话统一验证；本记录不声明视觉或真实输入已通过。

## 远征地图增量

老板否决“下一步·N 条路线”列表后，本轮曾恢复的 `#routePanel` 动态创建与路线列表已撤除。点击地图节点只在地图下沿显示单个节点的紧凑预览；“进入该地点”调用原移动命令，当前位置使用原重入命令。不可达节点预览保留类别与受限状态，按钮禁用。选择记在当前地图位置的临时视图状态中，换节点后旧预览失效，不写存档。地图图面继续用既有迷雾过滤与拓扑边，只提高可达连线和所选合法边的对比；底部工具与顶部资源保持固定位置。

本段变更位于 `expedition.view.js`、`renderer.js`、`game.boot.js`（仅节点点击接线）和 `page-expedition-hud.css`，并沿用 `expedition-map.css` 中先前未提交的地图呈现。`node --check` 覆盖上述三个 JS，PostCSS 解析覆盖两个地图样式文件，`git diff --check` 通过。`tests/expedition-view.test.js` 已按单节点预览重写展示断言，覆盖不创建路线目录、可达/不可达/当前位置、移动中禁用、预览失效与 DOM 复用；保留 `r5b-route-overlay.test.js` 的拓扑与确定性用例。两文件定向运行通过 19 项。迷雾与连线关联的 `tests/r5a-map-snapshot.test.js tests/map-connectivity.test.js` 通过，2 文件 10 测试。真实鼠标点击、视觉与场景返回由主会话当前窗口验证。
