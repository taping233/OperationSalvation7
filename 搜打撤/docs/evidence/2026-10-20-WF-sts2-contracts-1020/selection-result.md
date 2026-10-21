# 选牌候选契约交付

状态：选牌领域、快照与Agent接线完成，未提交。UI接线由root协调既有活跃会话，不在本子任务修改范围。

## 实现

- `battle.hand-selection.js` 新增纯 `buildHandSelectionContract(selection, handEntries)`，输出冻结的 `candidateUids` 与 `canCancel`。支付选择复用既有 `isHandPaymentCandidate`；非支付选择复用 `matchesHandSelectKey`，保留当前UID顺序、类型/初始攻击别名、已选/排除规则与可重复复制的现行语义。
- `battle.engine.factory.js` 在 `captureSnapshotInput` 中生成领域候选：资格来源依次为cardOverrides、ownedCards、granted，与原UI的findStoredCard/领域findCard先序一致；只读取name/type，避免findCard旧TT7卡修复产生写副作用。不使用effective卡面转换判资格；展示仍可按UID读取effective卡面。
- `battle.snapshot.js` 复制冻结候选数组，并公开可取消性；同步快照类型。
- `agent.state.js` 的观察与动作均消费该契约；不再给所有手牌发送pick，也不再向强制选择发送skip。
- `agent.runner.js` 在派发前只核对当前快照契约，候选过期返回 `HAND_SELECTION_UNAVAILABLE`，选择已结束返回 `HAND_SELECTION_STALE`，强制选择跳过返回 `HAND_SELECTION_MANDATORY`。拒绝不调用领域命令，不消耗卡牌/费用，不推进选择。
- 未修改 `battle.selection-flow.js`，最终提交时的整组支付复检仍保留。未修改 `battle.view.js`。

## 验证

2026-10-20执行：

- 目标ESLint通过：hand-selection、factory、snapshot、agent.state、agent.runner及新增专属测试。
- `npx tsc -p jsconfig.battle-snapshot.json --noEmit` 通过；`npx tsc -p jsconfig.strict-hand-selection.json --noEmit` 通过。
- `npx vitest run tests/sts2-hand-selection-contract.test.js tests/battle-hand-selection-rules.test.js tests/tt7-hand-payment.test.js tests/battle-selection-consumer.test.js tests/battle-snapshot.test.js tests/battle-snapshot-integration.test.js tests/battle-snapshot-types.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`：9文件89项通过，约5.04秒。
- 专属10项覆盖：冻结输入无副作用、真实支付候选与两步扣减、最终扣费与伤害、consume/copy/zero/play四类Agent候选逐个实际执行、强制不可跳过与可选跳过、过期/消失UID拒绝、重复消费拒绝、stored override资格及旧TT7卡读取不修写。
- 自有现有文件 `git diff --check` 通过。

未build、未启服、未提交。UI当前窗口实页及统一验证由root完成；本报告不宣称UI接线或实页已通过。

编辑前字节保存于本目录 `.tmp/selection-before-*.txt`；自有增量保存于 `selection-*.diff`。factory增量在释放给root接入事实记录前已保存为 `selection-factory-own.diff`，不纳入root后续改动。
