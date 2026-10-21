# 受控战斗命令复现交付

状态：代码完成，尚未提交。范围为开发复现用受控战斗入口；不修改普通玩家的游玩流程，不自动捕获玩家整局。

## 接入与使用

真实入口为 `SDT.Agent.replay.capture` / `SDT.Agent.replay.play`，二者经既有 Agent.step → act → Battle.commands 执行；重放消费记录命令，不重新调用策略。

```js
const fixture = { id: 'my-battle-fixture-v1', params: { seed: 72831 } };
const fingerprint = { version: '当前版本', code: '调用方核实的代码/规则指纹' };
// prepare 是本地可信适配：按白名单id和纯JSON参数，重建无玩家存档的开发测试局。
// capture也会先调用prepare，明确重置该受控测试场景；不会恢复任意战斗中途快照。
const recording = await SDT.Agent.replay.capture({
  fixture, fingerprint, prepare, decide, maxCommands: 100,
});
const result = await SDT.Agent.replay.play(recording.packet, { prepare, fingerprint });
```

`fixture.params` 与命令包只允许纯数据，禁止函数、访问器、环与特殊对象；包内不执行脚本。prepare由本地调用方提供，必须拒绝未知fixture id。版本/指纹不匹配在prepare和任何命令执行前拒绝。指纹标注 `caller-provided`，未声称自动获取代码hash。

记录包括fixture描述、入场检查点诊断数据、初始上下文、动作与目标选择、逐命令前后状态/摘要、RNG前后状态、结果回执。重放在初始、命令前、结果或命令后首次差异停止，报告index/stage/path/expected/actual/executed。

BattleSession新增只读 `getReplayState()`；比较公共战斗快照、有序牌堆、持有卡完整规则数据、当前规则、显式runtime的piles/effects/interaction字段和生成卡序号。诊断对Map/Set/嵌套对象深拷贝并冻结；回放不写私有规则态。

策略 `agent-policy`、记录 `recording` 与表现 `visual` 流从规则RNG比较中显式排除，但完整RNG仍留在包内供诊断；不恢复玩法随机流以掩盖分歧。decide改动任何已投影的规则态或规则RNG会在命令派发前拒绝。命令失败、抛错、未完成或等稳超时立即停，包标记不可重放。

## 验证

2026-10-20本轮执行：

- `npx eslint game/src/agent/agent.replay.js game/src/agent/agent.replay-state.js game/src/battle/core/battle.core.js tests/sts2-agent-replay.test.js`：通过。
- `npx vitest run tests/sts2-agent-replay.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`：3文件65项通过，约29.91秒。
- 回放集成11项：真实初始攻击待选目标→选目标出牌→结束回合敌方行动成功重放；改目标在第1号命令后停止、后续endTurn不执行；隐藏牌堆和freeCast初态差异在0命令拒绝；指纹在prepare前拒绝；decide消费规则RNG拒绝；第1回合已出牌必须显式prepare重建；ACTION_THREW只执行1条即停；诊断冻结且无共享引用；函数和访问器包拒绝且不调用getter。
- `git diff --check`：本轮改动的现有agent.js与battle.core.js通过。

ACTION_THREW测试输出一条预期注入错误日志 `injected command failure`；该用例通过，验证引擎异常会收口。

## 覆盖边界

只支持本地可信prepare可重建的静止第1回合战斗入口，命令限battle型。无通用整局存档恢复；入场checkpoint只作诊断/适配参数，不自动恢复私有状态。普通玩家运行不自动开启记录。

规则诊断覆盖公共快照和列明runtime状态；引擎闭包内的触发器registry持续次数等尚无只读投影。本轮不能宣称覆盖全部内部规则态；若相关闭包状态改变后尚未影响已投影状态，只会在后续可观察的命令结果分歧处报出。callbackSource仅用作惰性诊断文本，不能恢复闭包。

未build、未启服务、未提交；实页与统一验收由root完成。

现有文件编辑前字节与本轮增量保存在 `replay-before-agent.js.txt`、`replay-before-battle.core.js.txt`、`replay-agent-own.diff`、`replay-battle-core-own.diff`，不包含后续他人修改。
