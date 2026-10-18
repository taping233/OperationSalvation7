# 背包单次渲染重复分组

当前源码只在一次 `showBackpack` 内复用普通区和安全格的堆列表；两区张数、安全格格数、顺序同步和当前分区格子读取同一快照。拖放/排序等独立操作的 `syncCardOrder()` 仍默认实时查询；`usedSlots`、`safeUsed`、容量文案、道具状态与执行容量检查未改，快照不跨刷新保留。

变更源码：`game/src/hub/game.bag.js`（12 行增加、10 行移除）。新增定向测试：`tests/bag-render-snapshot.test.js`。

## 可复现证据

运行 `node docs/evidence/2026-10-18-WF-perf-budgets-1018/entry/bag-render-probe.mjs`。脚本从原字节基线和实际修改后源码提取当前函数，使用真实堆叠/容量/道具规则与整页模板；卡面渲染器受控，未进行浏览器耗时测量。`bag-render-probe.json` 保存 54 组结果：3 分区 × 6 筛选 × 混合/空库存/容量上限；整页 HTML、模型和顺序全部相等。每组再原地增加同数组卡牌，下一次刷新仍保持等价。

13 张混合库存（11 张普通区、1 张安全格、1 张容器内卡）结果如下。次数包含真实容量和道具状态查询；每次分组遍历整个 ownedCards。

| 分区 | 分组次数前→后 | 卡牌访问次数前→后 |
| --- | --- | --- |
| 普通区 | 9→5 | 117→65 |
| 安全格 | 8→4 | 104→52 |
| 消耗区 | 7→4 | 91→52 |

尚无可见长卡顿证据；收益结论仅为重复分组与临时 Map/堆数组创建下降。

## 定向验证

`node node_modules/vitest/vitest.mjs run tests/bag-render-snapshot.test.js tests/bag-page-lifecycle-review.test.js tests/bag-architecture.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=default --reporter=json --outputFile=docs/evidence/2026-10-18-WF-perf-budgets-1018/entry/bag-targeted-tests.json`

5 文件、110 项通过、0 失败、0 跳过。新增 11 项覆盖每次刷新两区只请求各一份堆、同名多堆、装备逐张、顺序、物资拆格、张数、筛选、零卡、原地修改和详情打开后容量变化的实时拒绝。既有生命周期 53 项与结构边界哨兵通过。`git diff --check` 通过。

当前窗口实页由主会话验收，入口：局内 B 打开背包→筛选→安全格/消耗区→点卡返回→使用或移格后刷新→满容量复原禁用。本代理未操作浏览器、未 build、未改 index 或提交。

## 已有 DEV 入口与真输入步骤（源码只读核对）

`http://127.0.0.1:5319/dev/feedback-1018-review.html` 的「构造背包」确实调用真实 `showBackpack()`：普通区有员工通行证C×2、草甲×2、初始攻击×5及木材×4；安全格和消耗区初始均空。它可测普通区筛选与移入安全格，不能直接覆盖非空消耗区。

覆盖三分区优先使用既有 `http://127.0.0.1:5319/dev/restore-capacity-review.html`。该页覆写 localStorage/sessionStorage 为当前页内存，真实导入会话、背包壳、视图与规则；默认自动进入「满包·结晶2张」，消耗区已有法术×2，普通区含同堆能源结晶×2及填满其余格的物资。无需新增 fixture。

1. 点击普通区「道具」筛选，确认只剩能源结晶×2，容量数字保持满包。
2. 点击能源结晶，确认当前「使用」因同堆2张无法腾格而禁用；点击「移入安全格」。
3. 点击左栏「安全格」，确认能源结晶×2占1格；点击卡牌，再点「移回背包」，确认普通区容量恢复满包。
4. 点击左栏「消耗区」，确认法术×2；点击卡牌打开已消耗详情，再点击特写返回按钮或遮罩关闭。
5. 点击左栏「背包」，确认筛选复位、能源结晶×2仍在，普通区/安全格数字反映刚才的移动。可再次点卡确认满包复原依然禁用。

这些步骤由源码和既有按钮文案推导；浏览器真输入与截图由主会话执行后另记，不计为本代理已通过实页。

## SHA256

- 原字节基线 `baseline/game.bag.js.txt`：`B001C2BBC3F7239A057967154500B27DC69DD3FE8DE9C38CB9E2A4355A418A62`
- 修改后 `game/src/hub/game.bag.js`：`8F084AAB911B137D20C27490EAA6806CFEFA07079BF6A361D68B45BB2BC742A3`
- 新测试 `tests/bag-render-snapshot.test.js`：`974388B0353E1B76119BB2A6EE4435D74467B1DAFDE18379C874ADD68E8EA83B`
