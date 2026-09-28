# E3 普通胜利结算保存一致性：执行记录

更新时间：2026-09-27 13:34（Asia/Shanghai）。代码、定向与类型验证、独立终审已完成；等待 Friday 统一全量门禁与提交窗口，尚未完成落库验收。

## 基线与归属

- 接管及故障复现时 HEAD：`480e1f6d4c9aae981057e91a75d0711e2ca883cf`。本地相对已有 `origin/master` 引用 ahead 6 / behind 0；未 fetch，未核实服务器状态。
- 接管时 tracked 工作区干净；原未跟踪排除内容及 E3 计划保留。未操作共享 index。
- Luna A 单写领域命令、必要类型与窄类型检查；Luna B 单写普通胜利接线、session 保存 payload 提取及 retry 测试。旧缺口复现由 B 完成，之后经 B 明确停写交接，recovery 测试单文件转由 A 补矩阵。Sol medium 只读独立审查；主指挥单写本文。
- E2 独占战斗展示及其验收 fixture、浏览器当前窗口。E3 仅用隔离测试存储，不写玩家存档。
- 老板在本聊天直接授权向 Friday 回传；接管回执已成功送达，Friday 已确认开工。此前一次回传被自动审批拒绝，未绕过；收到直接授权后重新发送成功。
- 13:34 实时核对：HEAD 仍为上述基线，index 为空；外部 E2 在途改动包含 `game/src/battle/battle.layers.js` 及其专属测试/证据。未覆盖、未混入 E3 范围，未运行 build、安装或修改玩家存档。

E3 实际文件范围（相对本项目）：

1. `game/src/hub/game.bag.settle.js`
2. `game/src/run/game.session.js`
3. `game/src/hub/battle-settlement.commands.js`
4. `game/src/hub/battle-settlement.commands.types.d.ts`
5. `jsconfig.battle-settlement.json`
6. `tests/battle-settlement-retry.test.js`
7. `tests/battle-settlement-recovery.test.js`
8. `tests/battle-settlement-types.test.js`
9. `tests/battle-settlement-types.fixture.ts`
10. 本结果文件

执行计划由 Friday 编写，未由本团队改写；是否随 E3 提交由 Friday 统一决定。

## 改前真实故障证据

在生产 `game.bag.settle` 的 `battle:end → afterRewards → settle` 路径，session 轻量 harness 的 `saveGame` 调用真实 `RunStorage.write`，基地使用真实 `Base.use/save`。只针对 `sdt-base-v2-slot1` 的 `Storage.setItem` 注入 `QuotaExceededError`。

结果：run 的 `visited['0,1']` 已为 1（harness 完成标记也已持久化），持久基地 `eggBattles` 仍为 0，基地内存已为 1。丢弃模块实例并在同一 localStorage 上重新加载 Base/RunStorage 后，失配仍存在。该证据没有将 mock false 或同一 WeakMap 重试等同于刷新恢复。

命令：`npx vitest run tests/battle-settlement-recovery.test.js --no-file-parallelism`，cwd 为 `D:/素材/代号柒/搜打撤`。首次受沙箱 esbuild `spawn EPERM` 影响，未执行断言；按工具权限流程重跑后 1 文件 / 1 用例通过（用例 226 ms，总计 1.08 s）。这是确认旧缺口的复现，不是改后验收。

## 实现与事务边界

固定范围为普通远征胜利最后 saving 检查点：完成整理后的 run 与基地本场永久计数。仍由现有 recovery / recoverable-pair 承担日志、双档写入、恢复及 baseline 同步。不承诺开箱、演出、整理中途刷新具有全流程原子性。

- 调用链：`onBattleEnd → readReceipt → 既有开箱/整理 → createRunSavePayload → createAttempt → commitAttempt → commitBaseAndRun → recoverable-pair`。无档位胜利保留内存行为；撤退、死亡、撤离、龙巢未并入普通胜利事务。
- 请求身份复用持久 runId 与当前地图节点，格式为 `battle-win:<runId>:<layerIdx>,<trackPos>`。一次性普通/事件战节点沿用 visited，首脑沿用 bossKilled 的现有玩法事实，不新增存档身份字段。
- fingerprint 覆盖固定节点业务输入（layerIdx、trackPos、isBoss、encounterId）；奖励、时长和 savedAt 是输出，不进入业务 fingerprint。完整 afterBase/afterRun 首次准备后深冻结，由同一 attempt 和既有恢复日志保留；重试不再次抽奖励或计算计数。已有持久收据不采用新的候选 afterRun。
- slot/runId/revision 在异步前后校验；旧收据只在当前 run revision 精确等于收据 runRevision、对应完成节点存在时可重放。版本冲突、第三值或坏日志保留现场并阻断；生产无 Web Locks 明确拒绝，不回退无锁双写。
- 普通胜利不提前增加 Base 内存计数。afterBase 固定加入 eggBattles 与尚未同步的游玩时间；成功后由 recovery 的 Base._refreshExternal / RunStorage._invalidate 更新权威内存和写入基线，局内 elapsedSynced 只推进到固定快照时间。
- 首次收据查询、最终 saving 和失败重试使用 `battleSettlement` 状态阻止地图/背包操作；保存 guard 阻止常规 saveGame 越过待提交结果。内存代际用只在载入/新局替换的 discoveredPairs 引用辅助识别，不把可合法替换的 ownedCards 数组误当换局，也不把内存 token 当持久事务身份。
- `createRunSavePayload` 为唯一保存字段构造；不写盘、不调用 syncPlayTime。原 saveGame 继续原时长同步和稳定节点限制。session 只改保存构造、保存 guard 与必要导出，未改 loadGame/newRun。
- ammoTaught 仍为核心成功后的独立偏好保存；其写失败不重算奖励，不在未恢复事务上继续写。重复完成回调在 done 阶段直接返回。

## 分层验证与独立审查

所有命令 cwd 为 `D:/素材/代号柒/搜打撤`。Vitest 遇到本环境 esbuild `spawn EPERM` 时按工具权限流程运行同一限定命令；没有以 build 或安装替代验证。

| 层级 | 命令/方法 | 结果 |
| --- | --- | --- |
| 改前缺口 | 上述旧路径故障复现 | 1/1，随后测试已转为改后断言；旧证据保留在本文 |
| 真实恢复矩阵 | `npx vitest run tests/battle-settlement-recovery.test.js --no-file-parallelism`（A 使用等价本地 Vitest bin） | 13/13 |
| 入口与真实 session | `npx vitest run tests/battle-settlement-retry.test.js --no-file-parallelism` | 10/10 |
| 类型正反例 | `npx vitest run tests/battle-settlement-types.test.js --no-file-parallelism` | 2/2 |
| 新窄类型入口 | `npx tsc --noEmit -p jsconfig.battle-settlement.json` | 通过，生产命令由 @ts-check 检查，收集完整适用诊断 |
| 既有类型入口 | `npx tsc --noEmit -p jsconfig.json` 与 `npx tsc --noEmit -p jsconfig.battle-snapshot.json` | 均通过 |
| 保存字段保真 | Acorn AST 对照基线 saveGame 的 payload 与新入口返回对象，忽略位置及 raw 文本 | 45 字段及所有表达式完全一致 |
| 相关兼容 | `npx vitest run tests/save-compat.test.js tests/r5a-session-menu.test.js tests/r5a-map-snapshot.test.js tests/extraction-session-resume.test.js tests/extraction-settlement.test.js tests/terminal-settlement.test.js tests/terminal-persistence.test.js tests/terminal-death.test.js --no-file-parallelism` | 8 文件 / 39 项通过（8.07 s） |
| diff 格式 | `git diff --check` | 通过 |

定向证据合计 64 项（13+10+2+39），不冒称全量。恢复测试覆盖日志前真实写失败、日志/base/run/清理四阶段、真实清日志异常、模块重建后的同原始存储恢复、receipt 重放不写盘、两种 baseline 后续可写、业务 payload 冲突、第三值、坏日志、旧版本、切档/新局、无锁与异步输入快照。矩阵中的简化地图 fixture 仅证明透传；实际地图契约由既有地图/session 测试及 45 字段 AST 对照支撑。

另有真实 settle + 真实领域 factory/recovery/Base/RunStorage 组合测试：run 键配额失败留下 journal，readIdentity 返回 RECOVERY_REQUIRED；原 opts/attempt 重试后恢复正确，永久计数、奖励、payload 与 loot 随机调用各一次。UI/session 外壳为隔离 harness，未称浏览器实页验收。

Sol 最终独立审查通过，当前无未解决 P 级问题。审查发现并修正了 ownedCards 合法替换误判换局、modal 仍可编辑导致保存锁失效，以及首次异步收据查询允许移动的问题。最后复核覆盖实际代码、类型和定向测试；Sol 未改文件，也未把 mock 接线测试当成真实事务证据。

- 全量与本地提交：未运行、未提交，须先获得 Friday 独占窗口。窗口内测试会覆盖当时整个共享工作区（包括 E2），应记录真实状态，不冒称只验 E3。
- 实页：未验；不以 E3 自动化结果抵销 E2 显示与交互待验项。
- 真实玩家存档、完整开箱中途刷新、长局演练：未验。本批只保证最终 saving 检查点，不启动 E4。

## 四项简报

1. 已完成：真实旧缺口复现、复用 pair 的最终结算提交、固定 attempt/互斥/保存 guard、字段保真、定向与类型检查、独立终审。
2. 价值判断：必要修复，真实存储故障已证明收益；开箱全流程原子化与新存档身份字段均无本批必要性，不追加架构或玩法改造。
3. 有效证据：真实 adapter 跨实例恢复和实际 settle 失败重试、64 项定向验证、三个类型入口、45 字段 AST 一致、Sol 独立审查。
4. 仍欠：获窗后的原全量提交门禁与本地落库；实页和上述范围边界明确未验。全队停写后交 Friday 统一安排，不提前操作 index。
