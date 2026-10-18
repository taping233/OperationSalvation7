# 五份集成测试同步

指定的 14 个失败均由过期入口、呈现标记或布局预算断言造成。本轮只修改五份测试，生产源码、index 和共享文档未改；没有运行全量测试、构建或浏览器。五份改前原字节在 `baseline/*.txt`，前后 SHA256 在 `summary.json`。

| 测试文件 | 原失败 | 现行依据与修订 | 当前结果 |
| --- | ---: | --- | ---: |
| `hub-pages-rework.test.js` | 8 | 10-18 反馈第 13 项及 `hub.warehouse.js` 已规定普通卡单击打开特写；移除测试额外点击已退役“查看详情”按钮的步骤，并确认只打开一次、原库存索引和焦点来源正确。 | 11/11 |
| `pearl-storage-interface.test.js` | 2 | `docs/rules.md` 容器整理规则及 `game.container-store.view.js` 规定容量不足先显示原因并禁用；改为验证禁用按钮不调用动作，直接调用当前动作仍由执行层整叠拒收，卡牌和有效焦点均保留。 | 9/9 |
| `reward-action-clipping.test.js` | 1 | `chest-reward-overview.css` 已统一给有/无目标标签奖励预留 116px，而旧测试仍读 78px；同时验证二者卡宽公式相同、2:3 比例、领取按钮和多种内容高度预算。 | 5/5 |
| `xart-z1-batch2.test.js` | 2 | 死亡页关键损失仍来自 receipt，旧 `doom-loss-row` 已归入 `doom-details` 折叠说明；断言回执、转义关键卡名与明细插入绑定。撤离携入角标已由 `extraction-rewards-view.js` 输出 `exr-brought`，直接调用真实纯 view 验证数量及“并非剩余卡来源”的说明。 | 8/8 |
| `exp003-extraction-pocket-copy.test.js` | 1 | 背包主层说明已按 10-18 反馈第 5 项删除；保留概率/钥匙/不免费复原断言，转验当前帮助中的火堆/结晶规则，并实际渲染法术、道具、装备三类消耗区卡，确认数量与可否火堆复原角标。 | 5/5 |

仓库保存失败、保存抛错、在途重复点击只提交一次、响应前换档不改新档搜索/库存、收藏不消耗普通卡及特写返回焦点等业务断言全部保留，并恢复到现行真实入口执行。珍珠盒整叠拒收同时验证展示禁用与显式回调执行守卫，未放宽容量或存档边界。

基线单独复现：5 文件、24 通过、14 失败（`baseline-tests.json`），与冻结门分配的失败集合一致。修改后同一集合 38 项全通过（`targeted-tests.json`）；五份测试文件 ESLint 通过。结果与输入指纹汇总见 `summary.json`。

```powershell
node node_modules/vitest/vitest.mjs run tests/hub-pages-rework.test.js tests/pearl-storage-interface.test.js tests/reward-action-clipping.test.js tests/xart-z1-batch2.test.js tests/exp003-extraction-pocket-copy.test.js
```

未核项：父会话集成后的完整冻结门。本轮没有扩查或修改事件投骰在途文件。
