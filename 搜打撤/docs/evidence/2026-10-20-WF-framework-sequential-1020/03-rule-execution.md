# 规则执行计划收敛（第三代理）

状态：本属地实施完成；指定 7 套回归 197 项通过。无提交、推送、构建、安装或游戏数据改写。浏览器由主代理统一验收。

## 本轮实现

- 新增纯 `cards/card-execution-plan.js`，复用既有 `card-trigger-contract.js` 的显式声明判定。onPlay、直接触发、登记触发、装备入口共同读取来源计划，空数组不回退描述；无该时点声明时保留旧文本。
- 从 resolver 收出 onPlay/装备即时文本抑制、装备基础字段所有权、出牌执行视图边界；触发 runner 复用注册计划。装备 onEquip/battleStart 分支使用同一计划，旧装备消耗文本抑制和 venom-staff 宿主行为保留。
- 将既有隔离执行视图实现移入纯计划模块，schema 保留原名兼容 re-export。capability、guard、trigger/equipment runner 继续共用同一执行视图；引用字段转换保留 0 和 false，不改操作顺序。
- `inspectCardRuleCapability` 统一恢复 `_registeredTriggers` 后预检完整声明，resolver 不再自行拼装恢复视图。剥离后的执行卡仍不能绕过未支持时点操作检查。

## 相对本轮初始基线的文件

以 `baseline.json` 指向的 `.tmp/framework-sequential-1020/baseline` 为基准；没有把此前未提交修改计入本轮归属。完整增量见同目录 `03-rule-execution.patch`。

| 文件 | 状态 | 文本增量 |
| --- | --- | --- |
| `game/src/cards/card-execution-plan.js` | 新增 | +84/-0 |
| `game/src/cards/card-rules.schema.js` | 修改 | +1/-22 |
| `game/src/cards/card-rules.capability.js` | 修改 | +2/-0 |
| `game/src/battle/core/battle.resolution.js` | 修改 | +11/-34 |
| `game/src/battle/effects/battle.trigger-source.js` | 修改 | +3/-6 |
| `game/src/battle/effects/battle.rule-guard.js` | 修改 | +1/-1 |
| `game/src/battle/effects/battle.triggers.m2.js` | 修改 | +5/-11 |
| `game/src/battle/bag/battle.equipment.js` | 修改 | +16/-10 |
| `tests/card-execution-plan.test.js` | 新增 | +83/-0 |

## 验证

命令：`node node_modules/vitest/vitest.mjs run tests/structured-effect-authority.test.js tests/battle-structured-authority-unification.test.js tests/battle-direct-trigger-source.test.js tests/battle-trigger-lifecycle-unification.test.js tests/card-rules-schema.test.js tests/battle-resolution.test.js tests/card-execution-plan.test.js --reporter=dot`

结果：7 test files passed，197 tests passed，退出码 0（2026-10-20 20:20 本地时间）。现有对照回归覆盖声明顺序、沉默时保留伤害、终局中止、空 onDraw/onConsume、冲突描述结构化优先、未声明时点文本兼容、装备 0 光环与 oncePerBattle=false；新增 11 项计划测试覆盖所有权单点隔离、完整预检恢复、执行视图不变异、无关基础字段剥除、schema 导出与执行视图同一实现。

定向 ESLint 覆盖上述 9 个实施/测试文件，退出码 0。首次测试沙箱因 esbuild spawn EPERM 受阻，同一必要测试命令经自动审核放行。中途 engine 在途拆分出现 runStagedSteps TDZ，由第二代理修复后本轮全部指定回归通过。

## 保留边界

- 未把历史自然语言卡牌全量迁移为结构化数据；复杂文本解析及基础伤害、抽牌、沉默等执行体仍沿既有兼容实现。统一的是来源/计划/执行视图/全量预检，不能声称所有文本效果体已经合并。
- 没有为纯文本引入自动转 DSL 的第二套编译器，也未改现行玩法。伤害、抽牌、延迟、目标与日志语义由既有执行器承担，本轮用原回归锁定行为。
- 卡牌计划的严格静态类型和通用架构守卫由第四代理后接；该文件接口已交接。无新增老板待决策事项。


## 集成补修：同步沙箱 ESM 装配（20:42）

全量回归发现 `scripts/sync-cards-from-live.mjs` 的源码沙箱只剥本地 export，无法剥 schema 新增的兼容 `export { createCardRuleExecutionView } from ...`；同时没有装入其真实纯执行计划依赖。结果四套读取源码卡库的测试因 `Unexpected token 'export'` 失败。

本次仅改同步脚本及其测试：按 `card-trigger-contract → card-execution-plan → schema` 加载真源，命名 re-export 剥壳支持带 from 的单行和多行形式。没有复制规则实现，没有改运行时业务源码，没有运行同步命令或写 `cards-sync.json`。原脚本开场改动保留；相对初始基线的补修见 `03-sync-sandbox-integration.patch`。

验证：

- 四套集成回归 `card-description-text/card-fixes-1010/schema-op-coverage/sync-cards-from-live` 加 `card-execution-plan/card-rules-schema`：6 files / 61 tests passed。
- `e6-card-rules-types`：1 file / 3 tests passed。
- `tsc -p jsconfig.framework-boundaries.json`：退出码 0。
- 同步脚本和测试定向 ESLint：退出码 0。

新增剥壳回归实际拼接依赖与命名 re-export 后求值，确认 0/false 原样保留；既有源码有效卡库测试验证完整迁移链可用。仅支持本沙箱现行命名 re-export 形态，未扩展为通用 ESM 打包器。
