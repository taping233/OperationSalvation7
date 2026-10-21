# RNG 边界定向实施与验证

2026-10-20，随机流实施子任务。

## 改动

- `game/src/battle/core/battle.foe-lifecycle.js`：击杀喝彩从 `battle` 改用现有随机服务的 `visual` 流。喝彩数量与候选文案不变，不再推进后续规则随机。
- `game/src/agent/agent.recorder.js`：终局记录 ID 后缀从 `gameplay` 改用独立 `recording` 流；ID 前缀、记录字段与导出形状不变。
- `game/src/agent/agent.policy.js`：按 RNG-01 协调结果，默认 `randomPolicy` 从 `gameplay` 改用独立 `agent-policy` 流，保留调用方传入随机函数的兼容入口；贪心策略不变。
- `tests/sts2-random-boundary.test.js`：通过真实击倒结算、终局记录及随机策略调用，对照相同快照的规则序列；另经实际 RunStorage 写入/读取验证新增流沿原 `seed/rngState` 结构恢复。

## 验证

命令：`node node_modules/vitest/vitest.mjs run tests/sts2-random-boundary.test.js tests/random.test.js tests/agent-recorder.test.js --reporter=dot`

- 最终退出码 0；3 个测试文件、18 个测试通过（22:12:34，Vitest 1.62s）。
- 新测试中，1 次或 7 次击倒喝彩，以及 1 次或 7 次终局记录，都不改变已初始化的 `battle/gameplay` 流状态或其后各 8 次抽样。
- 连续记录仍产生互不相同的 ID，既有记录和统计测试通过。
- 12 次真实默认随机策略决策不改变已初始化的 `battle/gameplay` 状态或后续序列；调用方传入抽样函数时不消费服务中的任何流。
- `visual/recording/agent-policy` 随机状态通过既有 RunStorage 字段写入、读取及 Random.restore 后准确续接；没有新增流的旧快照及仅有 seed 的恢复分支仍准确续接。
- 4 个改动 JS 文件的 `node --check`、定向 ESLint 均退出码 0。

## 边界

没有改随机算法、地图流、存档版本或存档格式；没有修改战斗 view/runtime、共享流程台账或现行文档。未运行 build、服务或实页；本轮验证的是随机流与存储契约。

`randomPolicy` 默认抽样流的变化会改变同 seed 的默认随机策略动作序列，旧自动策略对照结果应按本次边界区分。调用方传入抽样函数的行为不变；贪心策略未修改。回放线已收到 `agent-policy` 流名确认。

修复后，击倒或记录之后的规则抽样相对旧实现会少一次无关推进；这是本次去除耦合的预期结果。既有存档中的当前流位置直接沿用，不回溯补偿过去已消耗的随机数。
