# 战斗取消与完成凭据批次

状态：实现与回归代码已写，等待统一集中验收。按老板最新节奏，本批尚未运行测试、静态检查或浏览器，也未同步副本。以下判断基于源码和调用链，不冒充运行时复现结果。

## 设计对照与选择

本地 `D:/素材/杀戮尖塔2源码/sts2-decompiled/` 中 `MegaCrit.Sts2.Core.GameActions/GameAction.cs` 明确区分输入动作与内部命令，提供状态及 `CompletionTask`；`MegaCrit.Sts2.Core.GameActions.Multiplayer/ActionQueueSet.cs` 在结束战斗时取消待执行动作，保留运行中动作的执行所有权并阻止不合时宜的新动作入队。仅参考职责分界，没有复制多人同步或引擎实现。

本项目 `core/battle.actions.js` 已串行执行，`runtime/battle.execution-session.js` 已用 generation 使旧收尾失效，`runtime/battle.playback.js` 已在逐段等待后核对 token/signal。这里复用现有机制，不新增执行器，不让不响应取消的任意 executor 通过 Promise.race 脱离队列，也不旋转队列绕开运行中的任务。

初步考虑的清队重入 gate 没有发现足够的正常公开API行为收益，本批没有修改 `core/battle.actions.js`。实际修复收敛到公共时钟的取消窗口，并补全调度器已有完成链的返回契约。

## 公共时钟：取消覆盖等待后的回调交付

`runtime/battle.clock.js` 原 `schedulePresentationMs` 直接使用 `waitPresentationMs(...).then(callback)`。在 turbo、零/负时长或测试短路时，等待已 resolve，而 callback 仍在微任务队列；即便普通计时器已经触发、callback尚未交付，返回的取消函数也不能撤销这次 callback。

这是明确的源代码可达窗口：创建任务→等待已完成→同轮调用取消句柄→旧 then 仍调用 callback。正常的同目标效果替换会调用旧取消句柄，例如 `view/battle.vfx.js` 的受击效果清理与 `view/battle.anim.view.js` 的牌堆效果。后者已有自己的身份检查，不代表公共取消句柄可以忽略取消。此处没有声称已在自然试玩中复现画面故障。

本批在公共调度器交付 callback 前核对其自身 AbortSignal，同时让 `waitPresentationMs` 和 `waitHitStop` 的事前已取消信号先于 turbo/零时长短路被拒绝。普通计时、暂停深度和串行规则执行保持原机制；没有逐调用者补 if，也没有修改 view 文件。

新增回归位于 `tests/cov-battle-clock.test.js`：4种已排微任务取消窗口；3种短路模式下等待与顿帧的一致拒绝；同演出被替换时仅新 callback 提交终态。共8项参数展开案例，待运行。

## 调度器：交回已存在的完成 Promise

`runtime/battle.action-runner.js` 原已构建 `enqueue(...).catch(...).finally(...)` 完成链，但没有 return，使上层 `core/battle.exec-play.domain.js:161` 所声明的可等待返回被截断。本批仅 return 这条原链，不改变执行、错误回调、队列idle、phase/busy清理或原有错误收口方式。

调用者逐项核对：bag/equipment/selection及普通打牌入口忽略该返回；draw、effect-assembly、enemy-phase、selection的判断使用 `=== false` 或 `!== false`；工厂与 engine 只是透传，没有发现依赖 undefined 为假值的生产分支。尚无实际 await 此返回的生产调用，因此这是完成凭据契约补齐，不表述为修复现行卡牌效果。

`tests/battle-action-runner-readiness.test.js` 新增2项：完成 Promise 等待呈现、执行及idle清理；取消后的旧完成凭据正常收口且不复活替换代际。待运行。

## 本批修改与待集中验证

```text
game/src/battle/runtime/battle.clock.js
game/src/battle/runtime/battle.action-runner.js
tests/cov-battle-clock.test.js
tests/battle-action-runner-readiness.test.js
```

集中验收建议将这两个直接测试与现有 `battle-architecture.test.js`、`battle-execution-continuation.test.js` 一次运行，确认串行、取消与回合续接；静态检查覆盖上述4文件，并按统一批次核对实现类型。没有申请或启动全量、构建及额外浏览器验证。
