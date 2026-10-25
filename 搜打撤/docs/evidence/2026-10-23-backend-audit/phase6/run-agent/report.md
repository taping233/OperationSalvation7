# 第六轮 run / Agent / 工程脚本精简

完成一项经主会话登记的纯数据构造归一：`scripts/runtime-asset-redundancy-review.mjs` 的30条原图/缩略图候选改由15个固定有序基名及两个固定前缀展开。相对本轮独立原文为 **+22/-30，净减8行、1,881字节**。仍为286条候选，逐条对象、属性顺序、数组顺序和完整审批数据一致。没有删除文件。

## 实施范围与静态证明

- 原文原字节保存在 `runtime-asset-redundancy-review.mjs.before`；35,680字节，SHA256 `49555694de08ddaae990ab4d3ac2db950726f41f34f52a8716a9aabc0e54be83`。
- 本轮独立修改后保存在 `runtime-asset-redundancy-review.mjs.after`；33,799字节，SHA256 `3d16b41f173ec4640dc93f6d1f39ac2d7033e4b42b5296b24ff40b3843cb8db4`。
- 新构造仅使用固定15个卡图名和 `cards/`、`thumbs/cards/`，每个 `map` 返回新对象；构造中没有文件扫描、文件读取、随机数或外部状态。
- `compare-template-ast.cjs` 只解析源码AST、检查固定构造的完整AST并解码字面量，不导入或执行目标模块。286条候选及完整对象同值同序；展开对象前后SHA256均为 `88f7b5124630fdd39cc9fe1bec92d152377080553c0820a9b14550d6ce84a4d0`。30条配对SHA256为 `643638493ad04305d231f9c068d4664587c92c8901cf39473f24a2008bdc74c9`。
- 第五轮90条胸箱构造保持原字节；其他源码AST一致。本轮独立补丁没有更改审批哈希、保护清单、`sourceBytes`、`sourceSha256` 或动态消费者依赖。
- 目标源码语法检查、定向差异空白检查通过。按老板指示不测试；未运行构建、游戏实页、目标工程脚本或提交。

## 共享文件的两处并行更新

写后即时记录的SHA为上面的 `3d16…8db4`。后续只读复核发现其他会话更新了 `opaqueConsumers` 下 `game/src/hub/hub.presentation.js`、`game/src/ui/card-zoom-controller.js` 两个值。当前共享源SHA为 `0a45bd61b688dc9b9fde685fdcacac46d66d6cd59c492ea5963212c99e7a4901`。

这两个值没有被本分片覆盖或回退，也没有计入本轮修改。`parallel-observed.json` 保留原值/现值；`capture-local-after.cjs` 仅在证据副本中还原这两个原值，其余字节全部保留，恢复的副本SHA精确匹配写后即时记录，因此当前源相对本分片写后文本只多这两个已上报的外部指纹变化，286条候选仍与独立写后文本相同。源码已冻结。

主会话已确认两项归属为并行 `WF-frontend-six-residuals-clean-1023`；现行 `docs/PARALLEL-REGISTRY.md:41` 记载“资源复审仅更新2个原指纹已匹配的消费者”。本分片保留该前端清退增量。

## 实际覆盖及排除依据

`clone-scan.cjs` 对 run、Agent、根 scripts 及7份 Agent 工具共136份JS进行50-token重复扫描，保留属性名和字面量，归一局部变量名，也检查同文件不重叠片段；得到53个机器候选。每份输入的路径/字节/行数/SHA及匹配位置见 `clone-scan.json`。这是候选定位，不能据此声称136份都已完成人工业务审查。

本轮人工复核的范围与结论：

| 文件/片段 | 结论与依据 |
| --- | --- |
| `runtime-asset-redundancy-review.mjs` 剩余声明模板 | 30条配对已实施；39条角色帧的动作后缀不同，86条胸箱保留独立字节/哈希，未为减行改写这些差异数据。其他审批字段未改。 |
| `check-types.mjs`、`check-type-coverage.mjs`、`acceptance-gate.mjs` | 配置清单已经共用 `TYPE_CONFIGS`；进程执行段的error/close归并、输出和退出信息不同，未合并。 |
| `workflow-evidence.mjs`、`workflow-staged.mjs` | 证据目录/ID构造片段相似，但实时工作区与冻结index输入、报告字段、写入顺序不同，未合并。 |
| `workflow-ledger.mjs`、`workflow-task.mjs` | 写锁收尾相同，但原文复核、首次创建、任务责任人与报告复核存在差异，未改事务骨架。 |
| `workflow-dependencies.mjs`、`architecture-graph.mjs` | 都使用AST取导入；前者还认require，后者带文件名/行号及全局门面审计，返回契约和报错不同。 |
| `index-validation.mjs`、`workflow-evidence.mjs`、`workflow-status.mjs` | 文档递归/存在性/清单指纹的枚举边界不同；并非可替换的整段相同实现。 |
| `asset-audit.cjs`、`perf-budget.cjs` | walk分别返回带字节记录与路径，stat读取时机不同。其他散列统计段保留独立阈值/输出用途。 |
| `map-generation-rules.js`、`map-route-v2.js` | 最小战斗成本算法相似，分别接收节点集合和类型表；本轮未为少量代码另加回调/临时数据适配层。 |
| `agent.scenes.runtime.js` 场景声明 | 已共用 `runDevKind`；各场景仍有独立进入/完成条件、额外断言、事件准备与时间预算。 |
| `agent.battle-stats.js`、`agent.*` 函数清单与 Agent 工具声明 | 未发现已可静态证明失去消费的大块执行体；既有统计身份/日志校验、回放/等待/取消契约未改。工具仅静态查引用/声明与重复候选。 |
| `compile-narrative.mjs`、`generate-compendium.mjs`、`validate-data.mjs`、`sync-cards-from-live.mjs` 声明与生成入口 | 输出目标/输入契约不同；卡牌迁移已引用生产清单，显式沙箱模块顺序承担声明装配。未更改当前修复或生成链。 |
| `build-artifact-manifest.mjs`、`runtime-asset-aliases.mjs`、`runtime-asset-publication.mjs`、`runtime-trace-alignment.mjs`、`web-up.mjs`、`check-syntax.mjs` | 构造/枚举分别承担构建来源、字节别名、资源存在性、人工时序锚点、服务身份或源码扩展名边界；未发现本轮可直接删除的重复清单。 |

纯UI/开发面板与P3表现路径的机器命中未作为实施候选；性能账本按老板本轮要求排除检查并保留。机器命中列表中未列于上表的部分仅做自动扫描，未扩为人工排查。没有据本轮扫描提出整文件退役，也没有修复前批已登记bug。

完整计数见 `changes.json`，独立补丁见 `runtime-asset-redundancy-review.mjs.diff`，原文/写后字节/并行差异均保留，可由主会话按分片归属合并汇总。
