# 回归与调试能力并行审查

核对日期：2026-09-27（Asia/Shanghai）  
核对 HEAD：`7cf5b6c`（`docs: record E6 full-suite acceptance and commit`）  
范围：只读审查 Agent 跑局记录、随机服务、运行时诊断、异步动作归属、相关回归测试与故障注入；未运行测试、基准、构建或浏览器，未修改游戏代码。

## 结论

现有能力可用于跑局统计、保存档随机状态恢复、定位少数异步错误和测试结算恢复，但没有形成可重放的故障记录。`agent.recorder` 的跑局记录保存地图 seed、职业/模式、终局统计与末 10 场战斗摘要；它不保存源码/构建版本、开局完整状态、随机流快照、逐个玩家动作、动作时间顺序或异步任务身份。`Random.snapshot()` 能准确保存命名随机流当前位置，但跑局记录没有收录该快照；相同 seed 也无法单独补足动作和初始状态。

本地诊断有意只保留时间、来源、错误名称和分类码，不保存错误消息或堆栈。因此它能做安全的故障计数和来源分类，不能独立说明具体哪一局、哪个动作或哪段调用栈出错。反馈导出有独立 `gameVersion` 字段，但诊断摘要和跑局记录没有版本关联。

## 证据与现状

| 能力 | 代码证据 | 判断 |
| --- | --- | --- |
| 跑局汇总 | `game/src/agent/agent.recorder.js:11-12, 140-162` | 有界保存最多 200 局；记录 `seed`、模式、职业、层/节点/回合、结局、局时、战斗计数、携带物及末 10 场战斗摘要。不是动作日志或快照。 |
| 战斗摘要 | `game/src/agent/agent.recorder.js:29-56, 65-96` | `noteBattle` 存胜负、位置、敌人、战后血/回合、战斗观测计数；runner 喂入观察与少量动作统计。无法还原卡牌、目标和每步状态。 |
| 随机状态 | `game/src/core/random.js:27-56, 70-75` | Seeded service 支持按命名流抽数、`snapshot/restore` 含 seed 和各流状态。存档有用它恢复的路径：`game/src/run/game.session.js:145, 295`；跑局 recorder 只读取 `G.mapSeed`，未保存快照。 |
| 构建/版本 | `game/src/core/asset-url.js:4-13`；`game/src/game.boot.js:595-606` | 构建号用于资源缓存参数，页面版本从 `version.json` 显示；未发现其写入 recorder 记录。反馈独立导出才读取用户反馈条目的版本：`game/src/ui/feedback.local.js:47-56`。源码提交或实际构建号未与跑局关联。 |
| 诊断 | `game/src/core/diagnostics.local.js:1-5, 8-29, 73-95` | 最多 40 条，字段为时间/来源/错误名/错误码；错误消息与堆栈明确不保存。运行时捕获全局错误、未处理 rejection、Bus 和 loader 等来源：`98-131`；不足以关联对局、状态或动作。 |
| Agent 动作追踪 | `game/src/agent/agent.runner.js:251-288, 340-390, 448-503` | `step/autoRun` 返回内存中的 trace，包含动作稳定 id、结果码、phase、spin/stall 和 stopReason；不是持久日志。超时/上下文变更会收口，内部 commandContext 不输出到 trace（相关断言 `tests/agent-command-results.test.js:234-265`）。当前摘录没有证明 trace 保存完整动作参数、动作前后观察或异步 promise 身份。 |
| 对局归属保护 | `game/src/agent/agent.runner.js:23-78, 251-288` | 命令会捕获对局上下文，完成时验证归属；新局/档位切换后丢弃旧结果，超时停止自动驱动。这是运行时防护与返回码，不是事后可审计的关联记录。 |

### 回归测试与注入复用

- `tests/random.test.js:6-38` 覆盖同 seed 同命名流、流隔离、快照后精确续抽和随机服务注入契约；`40-52` 是静态源码约束。适合未来验证记录快照能续接随机流，不等价于整局回放。
- `tests/agent-recorder.test.js:13-16, 18-54` 验证记录字段、清零、环形追加和 driver 标签；当前夹具没有动作序列、版本、初始状态或随机快照断言。测试通过情况只引用 E6 历史证据，本次未运行。
- `tests/agent-command-results.test.js:1, 24-36, 143-208, 227-300` 有命令拒绝/抛错/超时、异步延迟后新局、上下文切换以及旧结果隔离用例；afterEach 恢复 mock（36 行），适合复用作异步故障归属验证。它覆盖 runner 的协议边界，不记录可持久回放资料。
- `tests/e4-async-entry.test.js:10-11, 55, 64-123` 通过 fake timers、延迟 Promise、resolve/reject、替换 transition 和切档来验证旧异步入口不能作用于新状态；afterEach 调 `useRealTimers/restoreAllMocks`，没有看到显式 `clearAllTimers`。依其现有用法，计时器恢复隔离已有模式；清除遗留计时器是否必需需结合 Vitest 配置及完整套件执行确认，本审查未运行。
- `tests/battle-settlement-recovery.test.js:13-45, 48-52, 83-109` 提供可注入 failpoint、storage quota 错误注入、模块重载和存档恢复；覆盖结算事务持久化边界。这里保存的 `rngState/mapSnapshot` 是测试准备的存档字段，不是 recorder 的故障包。afterEach 恢复 mock、还原 navigator lock、重载模块并清本地存储。
- `tests/diagnostics.local.test.js:6-17, 19-114` 覆盖诊断脱敏、全局错误/rejection、Bus 同步异步错误、存储失败、有界数量和反馈导出。可复用为将来诊断关联字段的兼容/脱敏测试；不应把现有安全字段约束误读成含栈诊断。

## 建议的独立切片

1. **跑局故障包最小增量**：限于 `game/src/agent/agent.recorder.js` 与 `tests/agent-recorder.test.js`，在终局记录中增加格式版本、构建/源码识别字段、初始状态标识/快照引用、终局随机流快照；定义采集能力不足时显式标记字段缺失。可选把当前内存 trace 作为有上限、脱敏后的独立引用附上，不要宣称能对真人局自动重放。完成标准：测试证明 seed 与流快照同时导出；已有记录兼容；不同随机消费位置可区分；字段有界；敏感消息/堆栈仍不进入记录。**热点**：与 E7 同目录但未见此轮文件归属证据；与卡牌迁移低直接冲突；若切片需改 `battle.lifecycle.js` 或 `agent.runner.js`，会触及 Agent/战斗热点，先协调，不应顺带重构。
2. **动作 trace 转为可诊断事件序列**：限于 `game/src/agent/agent.runner.js` 与其结果测试，明确每步动作参数、序号/单调时间、对局 token 的不可变摘要，以及动作前后观察摘要/结果；对超时保留“尚未完成/结果未知”状态，不重派副作用命令。完成标准：延迟完成、同 seed 新局、切档、timeout 用例可证明每个结果归属单一 run/action，导出不泄出 commandContext 对象或玩家私密信息。**热点**：E7 当前 QA 是同目录全局协作，具体 runner 文件占用未核实；与 cards 迁移低直接冲突；可能和 battle 动作调度有交界但不必改 battle 实现。
3. **诊断与运行上下文轻关联**：限于 `game/src/core/diagnostics.local.js`、`game/src/ui/feedback.local.js` 及相应测试，把安全白名单字段扩为可选版本、run id、动作序号/来源；不加消息/堆栈。完成标准：旧反馈兼容、缺字段稳健、上限和脱敏继续成立，并能从诊断条目关联到跑局/trace 导出。**热点**：E7 的整体验收与页面反馈可能使用 feedback 导出流程，改动前核文件归属；cards 迁移无直接交集；不触碰 battle UI。

优先级建议为 1 → 2；第 3 项只有在反馈导出作为实际故障上报渠道时才值得做。若目标是普通玩家整局精确重放，还需要专门设计初始状态序列化、外部/时间输入、随机流版本兼容和动作执行器；本审查没有证据支持直接建立通用回放或“诊断平台”。

## 验证建议与边界

本报告未运行验证。未来实现后先定向运行 `tests/agent-recorder.test.js`、`tests/random.test.js`、`tests/agent-command-results.test.js` 或 `tests/diagnostics.local.test.js` 中对应切片；若动作关联改变异步执行，则补跑 `tests/e4-async-entry.test.js`。需要确认错误注入和存储恢复时复用 `tests/battle-settlement-recovery.test.js` 的 failpoint/storage port 模式。只有公共架构变更或提交前，再按项目约定执行全量 Vitest。

E6 的全量 **171 文件 / 1119 项**通过记录是历史门禁证据，不代表本次重跑，也不能证明长局、真实演出时序或整局回放安全。本轮不重复 E7 实页验收。

## 未核实项

- 当前待交付改动对上述具体文件的占用情况；实时 Git 状态中有并行工作区材料，只有指定本报告是本次新增写入。
- recorder 面对真实浏览器局时可以稳定读取哪些完整初始状态，以及 `mapSeed` 与 `Random.seed` 的一致性边界。
- Vitest 全局 fake timer/restore 配置是否提供额外清理，以及整套测试是否存在跨文件共享状态问题。
- 生产构建实际版本、Git SHA 注入方案及发布后可获取性。
- E6 结果未在本次重跑；所有测试文件仅作源码审查。
