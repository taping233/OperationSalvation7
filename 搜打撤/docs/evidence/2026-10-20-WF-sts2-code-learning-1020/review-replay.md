# 回放边界独立只读复核

2026-10-20。复核对象：`agent.replay.js`、`agent.replay-state.js`、`tests/sts2-agent-replay.test.js`；按调用依赖定向核对 `Agent.step` 的失败回执及 `BattleSession.getReplayState()`。复核者没有修改实现、共享台账或现行说明。

结论：本次发现的两项实质问题均已由实现代理修复，最终负例测试通过；所核范围内没有剩余需修复项。

## 已修复问题与核对

1. 命令异常被封装在 `result.res`，原 capture/play 仅检查顶层 error/stopReason，可能把 `ACTION_THREW` 当成可继续步骤。最终 capture 在 `res.ok !== true`、未完成或停止/异常回执时立即标记包不可回放并停止；play 同样停止，且执行前拒绝含失败步骤的包。负例注入真实命令面的同步抛错，确认只记录首条命令、决策只调用一次，后续 endTurn 不执行。此负例覆盖同步异常；异步失败停止条件另由最终代码的同一回执检查核对，没有声称该负例实测了异步拒绝。

2. 展示快照缺少实际影响规则的免费标记、临时卡面覆盖、成长、延迟等状态，原初态比较与纯决策检查会漏检。最终改由 BattleSession 的单一只读诊断接口提供牌区、效果、交互三个 runtime 域的数据及临时卡序号，Agent 没有直接依赖 runtime。负例在可信 prepare 后额外加入 `freeCast`，确认在初态阶段、执行 0 条命令时报告 `battleRules.piles.freeCast` 差异；另验证诊断结果深度冻结且与后续 runtime 改动没有共享引用。

## 其他边界

- capture 与 play 都需要调用方提供可信本地 prepare；capture 主动重建 fixture，边界标记为 `trusted-fixture-battle-entry`。没有提供通用中途战斗恢复。
- 播放只重新执行记录命令，不逐步恢复包内规则快照或 RNG 来掩盖差异；初态、每步前后状态及结果均作比较。
- 决策污染规则随机数的负例在派发前停止；决策专用 `agent-policy`、表现 `visual`、记录 `recording` 流不参与规则态比较。
- 包为普通数据；拒绝函数和访问器，负例确认 getter 与 prepare 均不会因该非法包被调用。callbackSource 只作为文本比较，未发现求值执行入口。
- fingerprint 由调用方显式提供，标记 `caller-provided`；错误指纹在 prepare 前被拒绝。该接口没有自动证明调用方填入的代码指纹与工作区文件一致。
- 诊断覆盖公共快照及上述显式 runtime 数据，不覆盖引擎闭包内所有规则状态；例如 `battle.triggers.m2.js` 的登记表和剩余触发次数仍未投影。本轮不把它描述为全引擎内部状态的完整校验。

## 最终独立验证

命令：`node node_modules/vitest/vitest.mjs run tests/sts2-agent-replay.test.js --reporter=dot`

结果：退出码 0，1 文件 11 测试通过；22:21:28 开始，29.55 秒完成。异常负例产生预期的 `injected command failure` stderr，测试断言通过。没有运行全量、build 或服务。

最终复核文件 SHA256：

| 文件 | SHA256 |
| --- | --- |
| `game/src/agent/agent.replay.js` | `4E9DEC4EED5498BDB96BB2EEF969AE6FD2F326E843EA6C649A14C1372AB61E50` |
| `game/src/agent/agent.replay-state.js` | `906277D2B54609AE365DD24B62E5121675EB88F51E99990FB55A0566482ADEB8` |
| `tests/sts2-agent-replay.test.js` | `FD5E955D7363EFA39D284E008C7087B1B2E960061FA9533E3B277EB0F45A4C98` |
| `game/src/battle/core/battle.core.js` | `D0E33FFE3AAB42BFDD338DE93981A83557D4CC81E70DAAA8E0D7A95DFDDDC773` |
