# 工程化第一批实施与验收记录

本记录归属本批主代理；共享 README、项目状态快照、长期计划与在途交接记录保持原状。最终核对：2026-09-27 09:27（Asia/Shanghai）。本批实现和独立代码审查通过，整个工作区全量测试未通过；构建未验证。

后续补记（09:52）：老板授权修复该遗留并开展第二批。原隔离 QA 已保持原断言通过独立定向验收；类型内存测试的语法诊断漏项也已补齐，真实项目 tsc 的旧证据仍有效。详情及新的全量结果见 [第二批记录](ENGINEERING-BATCH-02-2026-09-27.md)。下文第一批数字保留为当时证据，不改写成后来结果。

后续验收（09:56）：第二批独立全量 **158 文件 / 920 项全部通过**，原隔离 QA 已在全量中转绿；构建/真实浏览器仍未验证。

## 范围与工作区

- 接手核对时间：2026-09-27 09:09（Asia/Shanghai）已完成首轮工作区与入口核对；仅 `搜打撤` Vite。
- HEAD：`dd5ac7f4a161079e3a41183ea1cdc89cc70158b0`；相对本地 `origin/master` ahead 2 / behind 0；未 fetch，服务器端状态未核实。
- 初始工作区已有 UI、Agent、战斗与文档修改/归档移动。它们继续归属原工作，不因会话 idle 视为可覆盖；本批不修改这些文件，不构建、不提交。
- 已查应用会话：`评估项目代码架构` 为来源；`对照塔2改进战斗系统` 的历史分工涉及 battle.view、battle.engine、battle.runtime 等，均避开。既有 UI/Agent 文件按现行项目状态和实际 dirty 列表保留。
- 本批候选 `game.store.js`、`commands.shared.js`、`recovery.commands.js`、`sdt-facade.js`、`jsconfig.json`、`vite.config.js` 开始时均无未提交修改。
- 本批仅快照隔离、卡库分块路径、实际快照与命令结果类型契约，以及相关状态/保存/恢复验证；不实施后续完整阶段。

## 文件归属与循环

- GPT-6-luna / snapshot_impl：`game/src/hub/game.store.js`、快照类型文件与新增快照测试；独占 `jsconfig.json` 和必要的 `sdt-facade.js` 类型边界。
- GPT-6-luna / chunk_impl：`vite.config.js`、分块测试；随后串行处理 `commands.shared.js`、`recovery.commands.js` 的成功收据构造及命令契约测试。
- GPT-6-sol medium / batch_review：独立只读审查与验收；具体失败交回实现者。
- 主代理：分工、接口协调、证据汇总及本文件；未接管具体代码实现。

## 改动与回退闭环

- 快照首轮回归在旧实现下因嵌套 card 引用相同而失败，最小修复后 1 项通过。独立审查随后发现 `game.run.shop.js` 的真实货架同样包含 card，已退回补修及测试。
- 最终深复制并冻结 `ownedCards`、`usedPocket`、`shopStock` 和动态货架缓存 `shopStocks` 的普通对象/数组。`inventory` 的实际写入口只创建标量字段；它与 `rings` 维持原浅行快照。地图、hover、moveTarget 与带自定义原型的对象维持引用边界；没有机械复制 DOM/第三方对象，也不冻结原卡库。
- `game-card-catalog` 原路径指向旧平铺目录；实现已改为 `cards/cards.{data,catalog,consts}.js` 与 `core/data-loader.js`，保持资源预算。
- 分块测试独立执行发现 jsdom 导入 Vite/esbuild 的跨 realm 问题，已退回改用 Node 环境并由实现者复测通过；首次沙箱 `spawn EPERM` 不视为代码失败，升级执行后才暴露真实测试环境问题。
- `GameStore.getSnapshot()` 接入显式状态与快照类型；新增卡牌关键字段、深只读纯数据与共享引用边界。`sdt-facade.js` 仅补动态注册门面的最小类型承接。
- 共享 `fail` 固定失败判别字段，新增泛型 `successReceipt` 并接入 `recovery.commands.js` 的实际恢复事务收据构造，保留序列化形状。没有把所有命令成功结果强制统一为同一种载荷。
- `jsconfig.json` 保留原 5 文件和原编译检查选项，新增 store、shared 以及类型正例；类型负例通过 TypeScript 7 的 `typescript/unstable/sync` API 在内存中实际诊断。未用忽略指令或新增 `any` 掩盖本批错误。

## 实现者检查（尚不能替代独立验收）

- `npx tsc -p jsconfig.json`：实现者通过。
- `npx vitest run tests/game-store-snapshot.test.js tests/game-store-types.test.js --no-file-parallelism --reporter=dot`：2 文件、2 项通过。
- `npx vitest run tests/commands-shared-contract.test.js tests/r2a-commands.test.js tests/r2a-recovery.test.js tests/save-compat.test.js tests/vite-card-chunk.test.js --no-file-parallelism`：5 文件、38 项通过。
- 上述结果仅为实现者交接证据；以下是指定独立验收代理的最终结论。

## GPT-6-sol medium 独立验收

| 项目 | 结果 | 证据与限制 |
| --- | --- | --- |
| 最终代码审查 | 通过 | 快照纯数据隔离与共享节点边界一致；成功收据接入实际命令；分块规则命中当前目录 |
| `npx tsc -p jsconfig.json` | 通过 | 实际运行状态可写，嵌套快照只读；正负例实际调用接口；未新增 any、诊断抑制或放宽选项 |
| `npx vitest run --no-file-parallelism` | **失败** | 155 文件：154 通过 / 1 失败；912 项：911 通过 / 1 失败；0 跳过，无未处理错误报告 |
| 本批回归与相关状态/保存/恢复用例 | 通过 | 包含在上述全量中；新增快照、类型、共享命令和分块用例均通过 |
| 唯一失败的定向复跑 | 稳定失败 | `npx vitest run tests/r7a-qa-live.test.js --no-file-parallelism`：1 文件 / 1 项失败 |
| 本批 tracked diff 空白检查 | 通过 | `git diff --check --` 限定本批六个已跟踪修改文件 |
| 真实构建、产物预算与浏览器 | 未验证 | 构建受其他会话在途修改限制；本批没有实页/体验验收 |

全量与复现日志保留在 [batch1-review-vitest-20260927.log](../batch1-review-vitest-20260927.log)、[batch1-review-r7a-repro-20260927.log](../batch1-review-r7a-repro-20260927.log)。这些 `.log` 文件受仓库忽略规则影响，结果数字已写入本记录，不依赖日志进入 Git。

失败来源：`tests/r7a-qa-live.test.js:23` 要求隔离 QA 不写玩家存储，但在途 `game/src/battle/battle.layers.js:677` 写入 `sdt-intent-legend`。该块位于 `git diff` 的 `@@ -652,6 +659,25`，属于 W5-03 意图图例新增；测试文件本身未修改。`r7a.qa.js:16/19` 直接创建夹具并启动 BattleSession，不调用 GameStore/getSnapshot 或 recovery 命令；manualChunks 不参与该开发测试，sdt 门面的变更运行等价。因此能定位为在途图例的直接存储副作用；本批未覆盖或修补该 UI 文件，也没有放宽隔离测试。

## 交付路径

- [快照实现](../game/src/hub/game.store.js)、[状态与快照类型](../game/src/hub/game.store.types.d.ts)、[门面类型承接](../game/src/core/sdt-facade.js)。
- [共享命令结果](../game/src/hub/commands.shared.js)、[实际恢复收据接线](../game/src/hub/recovery.commands.js)。
- [分块配置](../vite.config.js)、[类型试点配置](../jsconfig.json)。
- [快照运行回归](../tests/game-store-snapshot.test.js)、[快照类型负例](../tests/game-store-types.test.js)、[类型正例](../tests/game-store-types.fixture.ts)、[命令契约](../tests/commands-shared-contract.test.js)、[分块规则](../tests/vite-card-chunk.test.js)。

## 未完成与下一批建议

- 当前全量仍有上述 1 项失败，不能将本批代码通过升级为整个工作区验收通过。建议下一批由战斗 UI 原归属处理意图图例的隔离存储副作用。
- 具备独立且无冲突的构建条件后，验证真实 `game-card-catalog` 产物和原有资源预算；目前只证明配置规则命中，不证明产物体积或加载表现。
- 后续类型扩展、完整状态重构、卡牌规则迁移、流程实页矩阵均未启动。本批结束后等待老板指示，不自动派发下一批。
- 收尾 HEAD 仍为 `dd5ac7f`，相对本地 `origin/master` ahead 2 / behind 0；未 fetch、未提交、未推送。原有工作区修改及本批改动均保留。

## 验证边界

- 工作区仍有其他会话未提交改动，生产构建及真实分块/资源预算验收禁止执行，保持待验证。
- 本批未要求视觉或玩法变化；没有进行浏览器/多尺寸/长局体验验收。
- 未授权删除、回滚、提交、推送、发布、外部写入或安装环境；本批不执行。
