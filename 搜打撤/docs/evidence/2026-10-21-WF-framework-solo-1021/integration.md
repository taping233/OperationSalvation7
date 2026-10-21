# 框架整改集成验收

状态：集成源码审查、最终静态、关键集成及一轮全量已执行。全量唯一失败为已消除门面捕获的旧清单，更新守卫后定向回绿；没有重跑或把该次全量改记通过。实页因本轮 Codex 内置浏览器不可用而未核。

## 独立复核

- 快照初版的顶层 `Object.entries(state)` / 对象展开仍会执行 getter，与不透明访问器约定不一致（S1）。已定向交快照代理修复，复核确认顶层和嵌套均按 own descriptor 构造，根 state 先登记 WeakMap；新增顶层抛异常 getter 和根别名回归。访问器的动态返回值仍属于运行态端口，既有 map/交互引用及 rings 行内对象保留其明确边界。
- 启动实际 diff 使用 MAP/FX 的具名 ESM 同对象导出，内核及主循环不捕获门面中的空值；GameStore/game 未重建。`main.js` 的入口清单未改加载模式，`BOOT_ORDER` 仍是独立常量合同，未从 main 派生。
- 新战斗切片的 *.domain.js 命名已受现有默认实例隔离守卫覆盖，无需放宽旧保护。引擎到效果装配的命令由调用时回调读取；快照投影读取同一实例 runtime，缓存保留在 instanceRuntime.snapCache/snapSig 中。
- 独立 AST 搬迁复核脚本 `review-moves.mjs` 对比 HEAD 原函数体与新切片：10 个函数中 9 个 AST 原样相同；captureSnapshotInput 唯一预期变化为 equipment.isBattleStartEquip 改为注入查询，其余函数体 AST 相同。退出 0。此证据证明搬迁范围，不替代接线与行为测试。
- 现行 `docs/architecture.md` 与 `game/src/README.md` 已更新会话快照边界、明确 ESM 来源、独立启动合同、战斗切片职责和真实两装配实现的严格类型覆盖；明确旧 engine factory 和其他传递效果实现不因此全部严格化。

## 新增守卫的开发检查

`scripts/architecture-graph.mjs` 增加会话内核门面属性捕获保护（包括 default 别名、具名 default 和 namespace 导入），只允许 sdtDefine 兼容发布；MAP/FX 源模块禁止直接访问浏览器全局。新增保护键纳入 deadGuardKeys，未删除或放宽旧保护。

`npx vitest run tests/architecture-boundaries.test.js --reporter=dot`：退出 0，1 文件 44 项通过；时间 2026-10-21 01:53:20（Asia/Shanghai）。这是守卫开发定向检查，最终集中结果另记。

## 内置浏览器能力与阻塞

核对时间：2026-10-21 01:54:10 Asia/Shanghai（2026-10-20 17:54:10 UTC）。已读 `computer-use:computer-use` SKILL.md 和本轮 cua API 返回文档，仅使用 Codex 内置浏览器路线探测：

1. `mcp__cua_repl.js`，代码 `await cua.getState();`：返回 `{"apps":[],"browsers":[]}`。
2. `mcp__cua_repl.js`，代码 `var integrationBrowser = await cua.getBrowser({ id: "iab" });`：返回 `Browser is not available: iab`。

因此未创建冻结副本或 53xx 服务，未接管他人服务/存档，未切外部浏览器或 headless。真实标题→档位开局→战斗出牌/敌回合→保存恢复、画布/日志实际显示和页面 error 均未核；jsdom 启动链与 Node 战斗测试不能替代这些实页证据。主会话已知悉此阻塞。

## 最终静态与类型复用

环境：Windows PowerShell、Node v24.13.0、TypeScript 7.0.2。全部实施源码和现行说明冻结后执行；所有正式轮次均沿用 `scripts/workflow-evidence.mjs` 的 fingerprint，包含代码、测试、配置、现行文档、资产字节、状态及环境。每轮前后四组指纹均一致。

- 实际执行 `npm run check:syntax`、`npm run validate:data`、`npm run lint`：均退出 0。报告 `static-2026-10-20T18-04-15.340Z.json`。
- 类型检查复用类型代理最后一次 `npm run typecheck` 的 10 配置全 0 结果，未再执行一遍。已逐字节比对 types.md 的 8 个冻结文件，8/8 SHA 相符；10 个当前配置哈希、当前环境及复用范围见 `type-reuse.json`。其他代理实施输入均已冻结，没有后续生产源码变更。
- `git diff --check` 对集成自有架构脚本、守卫、现行说明及收尾守卫均退出 0；最后只改清单的 `facade-snapshot-drift.test.js` 单独 lint 退出 0。

## 集中逻辑与完整套件

| 执行 | 退出码 | 结果 | 小报告 |
| --- | --- | --- | --- |
| 六个关键集成：boot、独立双实例、战斗快照集成、GameStore 快照、contracts、architecture-boundaries | 0 | 6 文件、95 项通过 | `target-2026-10-20T18-04-48.378Z.json` |
| 一轮 `npm test`，包含 narrative compile / validate:data 前置 | 1 | 748 文件通过、1 失败、1 跳过；7670 项通过、1 失败、38 跳过；317.99 秒 | `full-2026-10-20T18-05-33.044Z.json` |
| 收尾守卫 + 架构 + 原生 Node 内核三文件定向 | 0 | 3 文件、48 项通过 | `recovery-2026-10-20T18-12-00.449Z.json` |
| `npm run docs:check` | 0 | 文档检查通过 | 同 recovery 报告 |

全量唯一失败位于 `tests/facade-snapshot-drift.test.js` 的顶层 window.SDT 捕获精确清单：本轮 renderer.fx 已改用 ESM 门面导入，旧清单仍把它列为允许债务。经父会话授权，仅删除该已消除债项，并把 renderer.fx 加入原有“已迁移模块不再捕获”文件表；精确清单相等断言保留，重新引入捕获仍会失败。未改生产实现或放宽保护，未更改其余用例。

恢复验证后的覆盖边界见 `full-recovery-coverage.json`：完整套件当时的 7670 项通过结果继续覆盖相同生产输入；失败守卫由 48 项定向结果补验。完整套件的退出 1 和跳过项原样保留，不宣称当前 SHA 下又跑过完整全绿套件。

- 完整套件后的输入 SHA：`13a51fa8eca84287b60507d11803fb7bca479ab34ac02c6168fa0b4cbf5af8ae`。
- 清单修订后当前输入 SHA：`4e9a4ef6cb239b56c6dff6c672d495241028f32df9cc868513fa6afa623a0471`。
- 两者的 `game/src` 生产源码清单 SHA 均为 `bd4e8b5e7f6bff14496551dee38053074ee02c9b6e3fcf3bf9ed58117caf8a65`（排除 Markdown）。完整 manifest 对比仅 `tests/facade-snapshot-drift.test.js` 变化，其他输入没有漂移；测试文件前后 SHA 记录在 coverage 报告。

## 证据获取与未核项

`run-integration.mjs` 为本轮编排入口，逐命令保留真实退出码、失败即停止后续步骤；`static`、`target`、`full`、`recovery` 对应上表。原始日志和完整输入 manifest 留在 `.tmp/WF-framework-solo-1021-integration/`，正式小报告记录相对路径、字节数和 SHA256，可由入口按同一模式重新获取；原日志不覆写。

完整套件原始日志为 `.tmp/WF-framework-solo-1021-integration/full-2026-10-20T18-05-33.044Z-1.log`，173238 字节，SHA256 `952619f22414cf2b8aafec003679e487e2846e8fd1519c85c99ee6bb6e3346ab`。运行器第一轮差异列表曾把同一路径的“文件字节/存在性”当成同一键，已修正为路径+kind并基于原始 manifest 重算；原始前后 SHA 与静态退出结果未变。

未执行 build、提交、推送或远端 CI；没有创建服务、冻结副本或占用端口。平台实页未核范围及两次真实失败来源见上文；它仍是本轮交付限制，不能由逻辑测试替代。共享任务状态/README/登记由父会话收尾，本代理只持有架构守卫、相关现行说明和集成证据；启动片文件保持其原归属。
