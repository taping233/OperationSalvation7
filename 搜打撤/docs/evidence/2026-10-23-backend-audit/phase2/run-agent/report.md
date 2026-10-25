# 第二轮：Run / Agent 纯业务冗余精简

2026-10-23。业务源码本轮相对 `before.json` 的基线合计 **+1 / -16 行，净删 15 行**，涉及 3 个文件。没有整文件删除，没有改上轮记录的 bug，没有测试、构建或游戏实页运行。

## 已实施

| 文件 | 本轮增删 | 改动 |
| --- | ---: | --- |
| `game/src/run/map-route-v2.js` | +1 / -10 | 删除私有重复 BFS `distances`，从现有 `map-generation-rules.js` 导入 `graphDistances as distances`。 |
| `game/src/agent/agent.runner.runtime.js` | +0 / -2 | 删除 `firstCheckMs` 的声明与赋值。 |
| `game/src/agent/agent.replay.runtime.js` | +0 / -4 | 删除 `play` 内被紧随其后的完整结果比较覆盖的重复失败分支。 |

### 路线距离算法合并的等价依据

改前 `map-route-v2.js:52-60` 与 `map-generation-rules.js:42-56` 都以 Infinity 初始化、起点距离设 0，以相同邻边顺序做 BFS，对 blocked 或已发现邻点跳过，返回逐节点距离数组。两者均不修改输入或消费随机数。

公共函数对不存在的起点多一道返回 Infinity 数组的守卫；路线模块的所有起点都是当前层 `entry` 或当前图邻接表中的 `fork`。`applyGuardedRoute` 与 `validateGuardedRoute` 都先通过 `validateCurrentGeneratedMap`，进入后只改节点类型或删除边，保留节点编号。`fork` 由 `next[guard]` 或经 `byId` 存在性检查取得。所有原调用的有效起点都有同一输出，blocked 起点也同样返回全 Infinity。未移动候选枚举、排序、赋型、指纹或诊断计数。

未改旧 `map-generator.js`、`createLayeredMap`、3/9 重建入口和随机流。

### Agent 等待循环的死状态

改前 `agent.runner.runtime.js:148` 声明 `firstCheckMs`，`:162` 只在自身为 0 时赋当前时间；全文件没有其他消费者。实际退出依赖 `idleStuckMs`、`deadline`、签名与引擎 busy/queue 状态，全部保留。没有删除任何超时、取消、归属或熔断保护。

### 回放结果重复检查

改前 `agent.replay.runtime.js:119-122` 对实际命令的 `ok/completed/stopReason/error/settleStalled` 提前判断，然后调用 `firstDifference(entry.result, resultState(result))` 构造失败诊断；随后 `:123-124` 无条件做同一个比较，并返回相同 code、executed、index、stage、difference。

包的入口校验已要求每条 `entry.result.ok === true`、`completed !== false`，且 stopReason / stalled / error 为空；`step` 的 `settleStalled` 是布尔值，`resultState` 记录同一组字段。因此实际失败会在完整结果比较中产生差异，同样返回 `REPLAY_DIVERGED` 的 `result` 阶段。保留完整比较后，也继续检查 code、async 等其余诊断字段。capture 的失败处理、输入校验、回放边界、指纹检查、executed 计数和诊断字段均保留。

## 静态验证与证据

- 三个修改文件分别通过 `node --check`，退出码均为 0；只解析语法，不执行模块。
- 限定三文件的 `git diff --check` 退出码 0。
- 静态引用核对确认 `firstCheckMs` 仅有已删除的声明/自赋值，路线所有 `distances` 调用均通过新增 import 绑定；回放公开导出仍为 capture / play。
- `*.before` 是动作前的完整原文；`before.json` 记录源文件/备份 SHA256。备份写完后逐份复核哈希一致，之后再次核对基线未变化。
- `*.diff` 是本轮相对备份的逐文件差异，`after.json` 为当前 SHA256 与准确本轮增删统计。已有 `agent.replay.runtime.js` 非规则流修改保留，未计入本轮 +1/-16。

## 本轮覆盖与保留

定向核对当前地图生成器 v4 的赋型、删节点与候选/保底循环，当前地图规则、v2 路线生成/逆变换/距离算法、地图连通性与纯路径查询；完整阅读 Agent runner runtime 的等待、命令交棒、取消与各类熔断以及 replay runtime 的捕获/执行/结果比较。场景运行器仅核对 BFS、执行器与各剧本驱动流程，未编辑 DOM、页面动作与表现部分。

未将不同用途的 BFS 强行合并：场景 BFS 返回实际下一步，地图旅行 BFS 带可通行/已清理/奖励门限制，连通性检查有旧环和方向兼容；它们不是当前重复距离函数的等价替代。旧/新 layeredMap 映射存在重复，但旧 3/9 适配函数明文要求逐字冻结，本轮保留。生成器涉及候选顺序与子流调用的实现没有证据证明冗余，保留。没有足以提议整文件删除的候选。
