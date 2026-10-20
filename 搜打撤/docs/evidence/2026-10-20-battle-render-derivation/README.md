# 战斗渲染当次派生计算

已实现，不跨渲染缓存规则结果。生产命令混合链费用求值从188次降至103次（减少45.2%），有效手牌解析从174次降至89次（减少48.9%）。这是受控jsdom调用计数，不是浏览器耗时或帧率。

## 改动

- `battle.view.js`：行动提示复用本次已经解析的有效手牌，下一次渲染重新解析；仍实时判断合法性和费用。
- `battle.layers.js`：每叠的有效费用、注能数量只计算一次，费用显示与可访问名称使用同一结果；目标、注能选择与动态规则提示继续实时计算。
- `battle.hand.js`：以当次Map替代逐个扫描已有组，维持原分组键、首次卡面对象、UID顺序与注能主卡单独末组。
- 未改卡面全局缓存、伤害计算、结算队列或命令权限。

## 对照

同一测试、同一小副本，仅替换上述三个文件进行基线对照。九叠手牌依次执行：初始重绘，能量耗尽与恢复，详情确认选目标与取消，实际出牌，打开/关闭消耗牌堆，实际结束回合，再替换实时费用。每个输入边界只测一次同步新鲜重绘，排除按机器负载可能合并数量不同的动画队列重绘。每段记录生产导出 `effCostOf` / `findEffectiveCard` 的渲染侧调用次数；不统计引擎内部未通过这些导出转发的调用。卡牌出手、目标生命、下一回合、实时费用、禁用提示均有断言。

| 指标 | 基线 | 优化 |
| --- | ---: | ---: |
| 费用求值总数 | 188 | 103 |
| 有效卡解析总数 | 174 | 89 |
| 首次9叠普通重绘费用求值 | 19 | 10 |
| 首次9叠普通重绘有效卡解析 | 18 | 9 |

独立分组规模测试：99张不同牌旧算法4851次键比较，当前99次Map读取。80种长度、每种普通/注能/主卡不存在三种场景与旧算法逐项比较，包含同ID费用/描述差异、旧卡无ID与第一卡面引用保持。

## 验证

- 5文件118项通过：`battle-render-derivation`、`battle-hand-group-index`、`page-perf-battle`、`battle-hand-content-diff`、`battle-hand-inspector`。
- 三源码及两新测试ESLint通过。
- 新夹具排除异步动画重绘数量波动，基线与优化均通过同样的行为断言；最终按十个相同输入边界测量。
- `mixed-before.log` / `mixed-after.log` 为对照；`target-tests.log` 为集中回归。
- 已有回归覆盖注能、临时费用、法伤变化、动态规则提示、诅咒、回合切换、替换卡面和手牌节点保留。
- 本小副本未运行真实浏览器、未build、未同步用户电脑、未提交/推送/部署。玩家实页与整合全量由主会话统一验收，不把jsdom当实页。

复现：运行 `vitest run tests/battle-render-derivation.test.js tests/battle-hand-group-index.test.js tests/page-perf-battle.test.js tests/battle-hand-content-diff.test.js tests/battle-hand-inspector.test.js`。回放旧源码混合链需设置 `BATTLE_DERIVATION_BASELINE=1`，仅跳过优化计数上限，不跳过行为断言。

## 外部原始证据

对照和完整日志保留在独立工作目录，不随发布复制。

- /workspace/scratch/b7a53a06c872/battle-render-slice/docs/evidence/2026-10-20-battle-render-derivation/mixed-before.log，SHA256 2612066160828f33e62f63793940399acac6bf528a59dab1957ecb8d3c1b281f

- /workspace/scratch/b7a53a06c872/battle-render-slice/docs/evidence/2026-10-20-battle-render-derivation/mixed-after.log，SHA256 7467dd63d84d6b54d6ab577d930cee26c922c82359fffae2183c5db56bdf2244

- /workspace/scratch/b7a53a06c872/battle-render-slice/docs/evidence/2026-10-20-battle-render-derivation/target-tests.log，SHA256 31ad8d7cd477fab94dce34bc489f1ee8b425821ffee8996adcbc5ec495a867f7

- /workspace/scratch/b7a53a06c872/battle-render-slice/docs/evidence/2026-10-20-battle-render-derivation/eslint.log，SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
