# 关键接口类型契约盘点（2026-09-27）

- 日期：2026-09-27（Asia/Shanghai）
- 核对 HEAD：`7cf5b6c63c5ae8b0501353b5a7582f6321fb5218`（`git log -1 --oneline`: `7cf5b6c docs: record E6 full-suite acceptance and commit`）
- 盘点时工作区快照：`git status --short` 显示未跟踪 `.codex/`、若干 `.ui-*`、E7 集成 PLAN/RESULT、证据、截图、根 package 文件等。该记录只描述当时状态；Friday 后续复核见下文。未读/改 QA 文件、未运行检查、未碰浏览器和服务。
- 边界：仅源码与现有 jsconfig/声明做静态盘点；未运行测试、tsc、build、install。本文建议是增量切片，不代表现有状态已经提供下述保障。

## 实际类型检查入口

四份配置各自隔离。`checkJs:false` 会关闭配置范围内未显式标注的 JS 检查，但不会取消带文件级 `// @ts-check` 的检查。E2、E3、E6 的目标生产 JS 文件均显式启用 `@ts-check`；执行相应配置时会产生这些文件的 JS 诊断。配置根和声明只覆盖局部依赖边界，不能据此声称调用链全程已有类型保障。

| 配置 | 真实根/模式 | 实际覆盖 |
| --- | --- | --- |
| `搜打撤/jsconfig.json:1-23` | `checkJs:true`、`strict:false`，仅 `include` 指定文件 | `map-graph.js`、`mech-sentences.js`、`encounter-selector.js`、`cards.consts.js`、`map-snapshot.js`、`hub/game.store.js`、`hub/commands.shared.js`、`hub/recoverable-pair.js` 及 `game-store-types.fixture.ts`。不是全仓 JS 检查；游戏战斗、Agent 和结算命令本体不在 include 根内。`game.store.js:1` 有 `@ts-check`，它在主配置范围内。 |
| `搜打撤/jsconfig.battle-snapshot.json:1-17` | `allowJs:true`、`checkJs:false`、`files` 指定快照实现、预览和 fixture | `checkJs:false`，但 `battle.snapshot.js:3` 的显式 `@ts-check` 仍启用该生产文件的 JS 诊断；配置的 `files` 包含快照实现、预览和 fixture。`battle.snapshot.js:3-9,18-31,89-90` 有 `@ts-check`、具名输入/输出 JSDoc；`battle.snapshot.types.d.ts` 另定义快照数据形状。 |
| `搜打撤/jsconfig.battle-settlement.json:1-17` | `allowJs:true`、`checkJs:false`、`files` 指定结算实现、types 声明、fixture | `checkJs:false`，但 `battle-settlement.commands.js:1` 的显式 `@ts-check` 仍启用该生产文件的 JS 诊断；实现通过 JSDoc 引入契约，`.d.ts` 描述端口与结果。 |
| `搜打撤/jsconfig.card-rules.json:1-16` | `strict:true`、`allowJs:true`、`checkJs:false`，只列 capability 与 rule guard | 配置直接列出 capability 与 rule guard 两个生产 JS root，虽然 `checkJs:false`，但两文件均有 `@ts-check`，所以各自的 JS 诊断仍开启。`.d.ts` 提供规则能力联合类型；这不覆盖整个卡牌规则/战斗执行调用链。 |

注：这些配置不是一份聚合项目配置；本轮未运行编译器。上述“有检查”指目标源带 `@ts-check`、纳入对应文件根后按配置执行会启用 JS 诊断；并非本轮实际运行验证。

## 已有局部保障与真实边界

- **E2 快照：已有边界清楚的数据契约。** `game/src/battle/battle.snapshot.types.d.ts:1-50,90-125,155-190` 区分可变输入/只读快照，并定义玩家、敌人、牌堆、选择态等；`battle.snapshot.js:18-31,84-95` 为复制、签名和快照函数标注参数/返回类型。阶段字段仍是 `string`（声明约第96、162行），没有从战斗状态阶段常量导出的字面量联合。不能将快照字段当成 BattleSession、命令调用者或 Agent action 端到端契约。
- **E3 结算：已有较完整的适配器契约。** `game/src/hub/battle-settlement.commands.types.d.ts:1-20,22-68,87-132` 规定 node/context/payload、receipt、attempt、成功/失败联合、base/run/recovery ports 和命令接口；`battle-settlement.commands.js:1-17,48-51,113,148,216` 使用 JSDoc 连接实现。接口专门表达结算命令的乐观 revision / replay 流程；它不覆盖战斗运行态、UI 命令或 Agent 结果。
- **E6 能力/guard：已有封闭的小域模型。** `game/src/cards/card-rules.capability.types.d.ts:1-11` 定义能力操作/目标等联合类型；`card-rules.capability.js:1-8`、`battle.rule-guard.js:1,4-5` 引入这些类型。配置把带 `@ts-check` 的两个生产文件列为根，E6 另有生产内存变异负例证据（见 `tests/e6-card-rules-types.test.js`）；这些保障只覆盖该能力/guard 边界，不提供通用卡牌定义、战斗命令或 Agent 观测调用链保障。本轮未运行编译器或负例测试。
- **Agent 协议已有运行时校验，不是静态调用契约。** `game/src/agent/agent.protocol.js:52-89` 在运行时检查对象、UI 名、move 整数、battle 命令白名单和最多四个 scalar args，返回 `{ok, action}` 或 `{ok:false,code,message}`。战斗执行端 `agent.runner.js:156-160` 再以字符串索引 `window.SDT?.Battle?.commands?.[action.name]` 并 spread args，故函数名和参数位置没有与 `battle.core.js` 命令表静态绑定。
- **命令结果目前归一化为宽泛结构。** `agent.runner.js:29-35` 把 `false`/`{ok:false}` 化成带任意 `code/message` 的失败，把 true、void 及旧返回兼容地变成成功；异步完成另扩展 `async/completed` 等字段（约39-54、65-79、103-109行）。`step` 把该结果与 observation/action/stopReason 等组合（约260-288、325-337行）。当前四份检查根均不含 Agent 文件，没有看到 Agent action、command result、step result 的 `.d.ts`/JSDoc 静态契约。
- **BattleSession 与运行状态是高收益窄缺口。** `game/src/battle/battle.core.js:364-410` 定义冻结的公开命令表，`419-423` 导出 `BattleSession={start,getSnapshot,commands,serialize,restore}`；没有 Session/commands 接口声明。`battle.runtime.session.js:5-19,21-38` 状态以大量未标注导出 let/setter 暴露，`battle.state.js:3-20,24-58` 有状态字段及允许转移图，但未在任何 jsconfig 检查根内，也未见类型定义。转移图是运行时防护，不能约束所有读写调用者；快照阶段另退化为 string。

## 建议的最小增量切片

1. **BattleSession 命令表和阶段类型（优先）**：新增专用声明，先只描述 `BATTLE_PHASES` 字面量、BattleState 核心字段、Session 公开方法和常用 `commands` 的参数/返回值；用小型 TS fixture 编译负例，建立一份独立 config，仅覆盖 `battle.state.js`、承载 Session/commands 的窄适配声明及 fixture。避免把 391 行 `battle.core.js` 全部设成 `@ts-check`：其目前广泛闭包依赖，不经证据验证的全文件开启会扩大范围。涉及路径：`game/src/battle/battle.state.js`、`battle.core.js`（或局部 `battle.commands.types.d.ts`）、新 config 与 fixture。负例：不存在的阶段字符串不能传给以阶段联合类型为参数的状态 helper；`playCard` 的 uid/target 参数颠倒或给非数字 target 应报错；Session 不存在的成员报错。阶段枚举只能限制可用字符串，不能天然证明 Victory→Player 这样的动态转移非法；动态状态合法性仍由 `battle.state.js` 的运行时转移图负责。
2. **Agent 协议/结果贯通（第二）**：建立 discriminated action union（ui/move/battle/sys）、normalize 成功/失败 union、同步/异步命令结果及 step result 的最小契约；优先给 `agent.protocol.js` 加 JSDoc checkJs，再通过静态映射把 battle 名称约束到上述命令键。涉及 `agent.protocol.js`、`agent.runner.js`、`battle.core.js` 导出的命令类型及独立 Agent config/fixtures。负例：未知 action type、battle name 不在白名单、move 缺 `li/idx`、args 含对象、success 结果读取失败专属 `code`、未完成 async 结果读取终局字段都应报错。需要保留 runtime 边界校验和旧命令 true/void 兼容语义，类型不应假设每个命令都返回同一对象。
3. **不建议先扩展 E2/E3/E6 本身。** 快照/结算已有局部契约，先补调用者边界比复制字段或扩宽各自声明收益更直接。E3 settlement ports 上的 `unknown` recovery return（`.d.ts:99-104`）只有当实际消费端需要读取内部字段且能确定语义时才适合另切，当前不推断。

验收条件建议：新增独立 config 在同一项目既有 TS 运行入口下成功；正例 fixture 覆盖现行有效调用并通过，标明 `@ts-expect-error` 的负例确保错误被消费；只验证指定根和差异，不跑全仓检查；若将运行时测试纳入，将其作为另外授权/范围，不由本盘点自动触发。当前未执行以上任一验证。

## Friday 复核更正（2026-09-27）

本报告原盘点基线仍是 HEAD `7cf5b6c`，并行 QA 当时的未跟踪状态仅是当时观察。Friday 后续提供的状态为 E7 已落库提交 `7c8e383` / `eeffe5e`，全量结果 172/1134 通过；因此不得把旧 QA 文件占用或未跟踪状态作为当前事实。此处只记录该复核输入，本代理未重新核对实时 HEAD/工作区，也未重跑全量检查。

复核同时更正类型覆盖描述：E2/E3/E6 带 `@ts-check` 的生产文件在对应配置下已有实际检查入口；`checkJs:false` 只说明配置未普遍开启 JS 检查，不会关闭 `@ts-check`。配置根不等于整个依赖/调用图都有契约。阶段字面量负例仅限未知字符串；不承诺静态证明 Victory→Player 等动态非法转移。

## 并行冲突边界

- **E7 QA**：E7 PLAN 第45行给出的单写文件归属是 QA PLAN/RESULT、预览、bootstrap、evidence、vite config；当前报告另有唯一单写路径。建议接口类型切片集中在新增声明/配置/fixture，避免碰 E7 QA 专属文件。若之后要验证浏览器暴露出来的 `SDT.Battle.commands`，应由 E7 QA 主指挥安排同一浏览器/验证窗口，不让类型盘点工作触碰其服务或浏览器。E7 当前已记录的预览与隔离事项不证明生产 API 类型正确。
- **卡牌迁移盘点**：当前报告仅涉及 BattleSession 命令/Agent 接口。卡牌数据和迁移源码不应成为此切片目标。唯一交叉是 Agent battle 命令参数可能承载 card uid；只引用既有 string uid 契约，不修改卡牌格式、同步源或 `cards-sync.json`。`battle.core.js` 若属于卡牌迁移代理的读/写热点，实施前应拆出命令映射声明由单一代理写，避免两人共同改大文件。

## 未核实项

未运行任何测试、TypeScript 检查、构建或实页验收；未核对浏览器运行时 `SDT.Battle` 全部值、测试调用兼容面、迁移代理最终文件归属。以上优先级/冲突分析是基于本轮只读源码与 E7 PLAN 中已明示归属的推断，应在实施切片开始前与父任务综合其他盘点结果。




