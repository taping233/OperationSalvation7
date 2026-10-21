# 02 — 战斗引擎用例拆分

状态：实施与定向自动回归完成，等待主代理集中完成类型/架构守卫与当前内置窗口验收。未构建、安装、提交或推送。

## 结果

本轮初始精确备份 `../.tmp/framework-sequential-1020/baseline/game/src/battle/core/battle.engine.js` 为 1702 行，当前为 1180 行，减少 522 行。按完整用例拆成四个工厂，保持引擎原有 78 个导出：

| 模块 | 行数 | 职责与端口 |
| --- | ---: | --- |
| `game/src/battle/core/battle.card-play.js` | 279 | 可用性检查、目标会话、注能燃料选择及提交；通过 live `readState`、执行可用性/提交、目标原因、音效与状态命令端口接入。保留旧 `play` 与新 `submitCardPlay` 的同步返回差异、选目标续接燃料、freeCast 归属清理。 |
| `game/src/battle/core/battle.turn-continuation.js` | 56 | 结束回合等待、触发动作选择等待、相同 token/phase 的 promise 去重。执行 session 经端口传入，原代次取消所有权继续由同一个 session 持有。 |
| `game/src/battle/core/battle.turn-start.js` | 121 | 回合开始延迟任务批次、重复任务、费用递减和按 uid 成长；异步后重读 runtime，保留 token 检查、取消信号与 finally 任务合并。取消检查由引擎注入既有函数，不导入 staged playback。 |
| `game/src/battle/core/battle.damage.js` | 159 | 所有敌方伤害的保护门、心数转换、卡牌命中加成、伤害提交及反馈顺序；共享原 Combat 规则核。requested 伤害记录与击败处理以端口连接，保留伤害记录先于击败处理。 |

四模块不访问 `window`、`document`、`SDT`，不直接导入 runtime 状态或引擎。卡牌目标原因函数由装配端口注入，避免引入 requested-card-runtime 或 effect-steps.m2 的运行态依赖。实际状态仍归 runtime 活绑定；新增闭包只持有等待 promise 去重簿记。

## 相对本轮初始基线的文件清单

- 修改：`game/src/battle/core/battle.engine.js`。
- 新增：上述四个独立模块。
- 新增：`tests/battle-engine-decomposition.test.js`（node 环境，8 项端口行为测试）。
- 新增：本证据文件。

未修改 battle.resolution.js、battle.trigger-source.js、card-trigger-contract.js、schema/capability、game/src/run、架构脚本或类型配置。保留本轮初始现场的全部既有改动；不以 git HEAD 差异计算本轮归属。

## 验证

1. `npx vitest run tests/battle-engine-decomposition.test.js tests/battle-engine-facade.test.js tests/battle-architecture.test.js tests/battle-execution-continuation.test.js tests/battle-action-runner-readiness.test.js tests/battle-trigger-lifecycle-unification.test.js tests/required-infusion-play.test.js tests/infuse-free-paths.test.js tests/card-description-fix-lifecycle.test.js tests/battle-temp-item-destination.test.js tests/contracts.test.js tests/facade-snapshot-drift.test.js tests/battle-direct-trigger-source.test.js tests/battle-hand-inspector.test.js tests/reactive-draw-cast-continuation.test.js --reporter=dot`
   - 三个回合/出牌用例拆分后：15 套、252 项通过，无本次异常 stderr。
2. `npx vitest run tests/battle-engine-decomposition.test.js tests/battle-engine-facade.test.js tests/battle-architecture.test.js tests/battle-execution-continuation.test.js tests/battle-action-runner-readiness.test.js tests/battle-trigger-lifecycle-unification.test.js tests/battle-effect-damage-boundary.test.js tests/battle-restart.test.js tests/requested-card-integration.test.js --reporter=dot`
   - 加入伤害模块后：9 套、102 项通过，无本次异常 stderr。与上组有重叠，不相加视作唯一测试总数。
3. `npx eslint game/src/battle/core/battle.engine.js game/src/battle/core/battle.card-play.js game/src/battle/core/battle.turn-continuation.js game/src/battle/core/battle.turn-start.js game/src/battle/core/battle.damage.js tests/battle-engine-decomposition.test.js`
   - 退出码 0。
4. 新增纯端口测试在 node 环境直接导入四模块，覆盖：替换后的 live 敌人绑定与燃料跨目标提交、freeCast 目标归属和取消、批次中新调度不当场执行、取消保留未访问任务、跨战 token 不覆盖新任务、四牌区成长去重、等待 promise 去重和 session 重置解除等待、心数试算不消耗真实防御、伤害记录/击败顺序、共用免伤门与实时回合切换。

首次常规 Vitest 启动遇 esbuild `spawn EPERM`；按既定授权对相同必要测试使用 require_escalated 后执行成功。首轮发现 `runStagedSteps` 装配 TDZ 已改成惰性端口；成长与注能 spread 的端口漏接已修正并补独立测试。没有保留测试仅通过但 stderr 报错的验收结论。

## 剩余实际耦合与交接

引擎仍负责卡牌/音效门面装配、快照与呈现、玩家受伤/诅咒命令、消耗与随机施放等专用卡效果、封印与符文开战流程。当前请求范围内已拆出四个可单测用例，不继续拆其他专用卡规则。

模块依赖无引擎回边；跨用例所需后定义常量通过惰性端口连接，避免导入时执行循环依赖。完整项目的自动架构环检测及严格端口类型接线由第四代理集中完成，当前窗口实页由主代理完成。
