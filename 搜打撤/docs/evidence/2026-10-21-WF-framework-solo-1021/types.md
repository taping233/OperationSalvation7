# 真实核心装配端口严格类型

已将真实 `battle.effect-assembly.domain.js` 与 `battle.snapshot-projection.domain.js` 的实现纳入 strict TypeScript 检查，并给输入、内部回调端口和输出建立具名合同。未将旧引擎、规则执行器或全部战斗模块声明为严格化完成。

## 修改范围

- 两个真实装配模块：启用 `@ts-check` 并标注输入合同；文本效果回调对象采用具名 `TextEffectPorts`，结构化结算回调由 `ResolutionPorts` 提供上下文类型；快照输入继续受已有 `BattleSnapshotInput` 约束。
- 新增 `game/src/battle/core/battle.core-ports.types.d.ts`：核心 runtime、会话队列、卡库、combat/random 服务、命令与回执、文本效果/结算器输出、快照投影参数，以及公开宿主 audio/presentation/summary 服务。保留实际状态表的数字字典；没有用 `any` 或任意未知属性索引消解装配错误。
- `battle.engine.instance.js`：公开 options 中原先的 `object` 服务改为具名端口或可选端口覆盖；保持既有公开 API 参数和组合行为。旧 factory 的实现体仍不在本片 strict 覆盖范围。
- `jsconfig.framework-ports.json`：显式列入两模块；保持 `strict: true`。全项目 `checkJs: false` 保持旧模块边界，两模块通过 `@ts-check` 单文件开启 checkJs。
- `scripts/check-types.mjs`：更新该配置的实际覆盖注释，现行 10 配置清单不变。
- `tests/framework-battle-ports-types.fixture.ts`：正例覆盖真实装配输入/输出、选牌队列默认字段、数值命令回执；反例覆盖缺端口、参数错误、错误 combat/资源回执、错误 resolver、错误 projection 输出、只读快照和宿主服务。增加 `IsAny` 输出退化检查。
- 新增 `tests/framework-core-ports-types.test.js`：在 TypeScript 虚拟文件系统中改写真实源码，确认字符串能量被拒绝、字符串 battleToken 被拒绝、隐式 any 回调参数被拒绝；不会改写工作树文件。此测试能发现移除 `@ts-check` 或关闭 strict 后仅 fixture 仍通过的退化。

## 实现与行为边界

源签名核对包括 `hitFoe`、`dealEffectDamage`、`emitRecast`、`onHandConsumed`、`splitEffectClauses`、选牌队列、`replaceShaInDeck` 与解锁函数。`queueCardExecution` 当前返回 `false | void`：底层 action runner 不返回 Promise，按真实实现声明，没有在本任务修改动作队列；原注释声称返回 Promise 不作为类型证据。

类型相关等价表达修正：敌方成员关系增加 type predicate；可空目标先检查再做 includes；可选冰冻加成在数值转换前补零；本地卡牌数组明确元素类型。两处 `addTempCard` 后 `findCard` 的局部具名断言只表达同步建卡后 UID 存在的不变量；快照缓存断言只表达 `storeBattleSnapshot` 同步发布缓存的不变量。未给旧运行态整袋套一个跳过检查的断言。

## 最终验证

所有命令在 `D:/素材/代号柒/搜打撤` 执行，退出码均为 0。

1. `npm run typecheck`：10 配置全部通过：`jsconfig.framework-boundaries.json`、`jsconfig.framework-ports.json`、`jsconfig.json`、`jsconfig.battle-settlement.json`、`jsconfig.battle-snapshot.json`、`jsconfig.card-rules.json`、`jsconfig.strict-foundations.json`、`jsconfig.strict-selection.json`、`jsconfig.strict-hand-selection.json`、`jsconfig.strict-ui.json`。
2. `npm run test:target -- tests/framework-core-ports-types.test.js tests/framework-battle-decomposition.test.js tests/framework-battle-engine-services.test.js tests/battle-snapshot-integration.test.js tests/battle-effect-damage-boundary.test.js tests/battle-resolution.test.js`：6 文件、75 项通过；含真实实现类型突变 3 项。
3. `node node_modules/eslint/bin/eslint.js game/src/battle/core/battle.effect-assembly.domain.js game/src/battle/core/battle.snapshot-projection.domain.js game/src/battle/core/battle.engine.instance.js scripts/check-types.mjs tests/framework-core-ports-types.test.js`：通过，无警告。
4. 自有源码/配置/测试路径 `git diff --check`：通过。

未运行 build、全量 Vitest、服务或浏览器。最终集成验收由父任务统一执行；同一输入未变时可复用上述类型结果。本片只承诺新装配实现和具名边界严格检查，旧执行器、旧引擎 factory 与其余 domain 的实现没有因此全部严格化。

## 冻结指纹

以下为本片最终源码/配置 SHA256；不是全仓依赖指纹。父任务复用结果仍须确认相关实际输入没有继续变化。

- `game/src/battle/core/battle.effect-assembly.domain.js` — `6116AB534864A9D791FA3624D86B66FCF5897CD98CC7E1E5861A62B05BCC7BFD`
- `game/src/battle/core/battle.snapshot-projection.domain.js` — `7C1633CB15AEE0978957583ECFBA0C1320D1DB8A8B8634C82474E9A41E44B1E8`
- `game/src/battle/core/battle.engine.instance.js` — `CC3F96871B455A73CB7F847F92C5CF539A46A593067CEC97227BE2DA7759B6BF`
- `game/src/battle/core/battle.core-ports.types.d.ts` — `1E86F7EF0DF35F853431FA41EF89B30CB63CC885B2C87E405DA22BA2BB053472`
- `scripts/check-types.mjs` — `302D58ADAABD4D4F051998422CF6494243AAD0470D0634C65E3457A9CE1ABF93`
- `jsconfig.framework-ports.json` — `EB42F7FDCCBA2F178110867A2CE60F28310D190599D1D2B1BE3232E87673C00C`
- `tests/framework-battle-ports-types.fixture.ts` — `D5C77823442FA78C29B7AC6718197A3F0EE1F34C24D7F336B23C693364DDB88E`
- `tests/framework-core-ports-types.test.js` — `A750B298A7B8D7174755A4CA3E913562EAE89BE03EC1AF13D8B44B11B28B38FF`
