# Agent既有缺陷动态复核

本轮不是三项新发现：来源为 `../2026-10-23-backend-audit/run-agent.md` 的 A1–A3，当前代码仍有相同问题。

| 既有项 | 当前代码 | 最小执行结果 |
| --- | --- | --- |
| A1 卡牌分类落后 | `game/src/agent/agent.policy.js:57-60`、`:152-156`、`:749-760` | 编组把古朴与稀有同分，输入古朴在前即先选古朴；同为稀有时先丢武术牌而非资源。现行类型为武术/法术/装备/能力卡。 |
| A2 出售读取错误字段 | `game/src/agent/agent.policy.js:863`，投影在 `agent.state.js:317-322` | observe给扁平rarity，排序却读card.rarity；传说输入在前时先卖传说，留下稀有。 |
| A3 非战斗死亡误归战斗 | `game/src/agent/agent.stats.js:73-75` | 一局先撤退过、后事件死亡，fought=2/won=1；仍计入L2N4/战斗中。累计场数差不能证明本次死因。 |

`node docs/evidence/2026-10-23-project-bug-audit/agent-reproduce.mjs` 退出0；脚本断言错误结果以锁定复现，不表示正确行为通过。结果见 `agent-reproduction-results.json`。

另运行现有21份Agent测试，154项通过、退出0，完整命令及退出码见 `agent-tests.log`，结构化结果见 `agent-tests.json`。没有改Agent业务或现有测试。
