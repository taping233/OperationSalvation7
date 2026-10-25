# 第五轮：纯重复模板归一与大项保留结论

2026-10-23。本轮先只读定位大项，随后按主会话精确授权，仅修改 `scripts/runtime-asset-redundancy-review.mjs`：**+7 / -90 行，净删 83 行、6,998 字节**。没有删除文件，没有运行源脚本、测试、构建或实页。

90 条相同路径模板已归一为固定目录/帧号的纯构造，完整 286 条审定候选与所有保护指纹静态展开后完全一致。另核对的旧自动性能账本共 1,210 行 / 61,048 字节，**老板本轮再次明确决定保留**，不再作为删除候选，不计入本轮收益。

## 1. 已实施：90 条相同路径模板归一

旧 `scripts/runtime-asset-redundancy-review.mjs:33-122` 逐条重复 5 个固定目录的 00–17 帧：small、medium、large、class、boss。现在以同一固定顺序 `flatMap`，每目录 `Array.from({length:18})` 产生 `{path, category:'chests'}`；不查询文件系统，不使用随机数，不读取任何运行状态。

- 首 90 条路径、字段插入顺序、类别与候选枚举顺序完全相同，完整候选仍为 286 条。所有对象仍为逐条独立构造；外层 Object.freeze 与公开导出不变。
- 后 196 条候选、sourceBytes/sourceSha256、consumerFingerprints、opaqueConsumerDependencies、opaqueConsumers 与所有既有审批/注释均未改动。不删除审定保护，不刷新审批指纹。
- 源文件从 42,678 字节减到 35,680 字节；本轮精确差异见 `runtime-asset-redundancy-review.mjs.diff`，原字节见 `.before`，原 SHA 见 `template-before.json`，真实增删与字节见 `changes.json`。
- `compare-template-ast.cjs` 仅解析前后 AST，校验新增构造的 AST 必须符合已审定的固定纯模板，再对原 JSON 字面量与固定模板展开进行静态比较；不 import 或执行源模块。
- 整张审定表展开 SHA256 前后均为 `88f7b5124630fdd39cc9fe1bec92d152377080553c0820a9b14550d6ce84a4d0`。各保护字段也分别保存前后 SHA，见 `template-equivalence.json`。
- 新源 SHA256：`49555694de08ddaae990ab4d3ac2db950726f41f34f52a8716a9aabc0e54be83`。静态 AST 对照、`node --check` 与限定 `git diff --check` 均通过，退出码 0；未运行资源发布脚本或任何测试。

## 2. 核实并再次确认保留的独立旧账本

### 完整文件清单

| 路径 | 行数 | 字节 | 作用 |
| --- | ---: | ---: | --- |
| `scripts/perf-ledger-capture.mjs` | 993 | 49,981 | 自起/复用隔离 Vite、启动 Edge/CDP、注入采样器、自动走多场景、按轮采样与写账本。 |
| `tests/perf-ledger-drive.test.js` | 79 | 3,831 | 仅从该脚本取出 plInstall，验证其场景驱动/部署/战斗就绪顺序；没有执行其他产品能力。 |
| `tests/perf-ledger-port-occupancy.test.js` | 138 | 7,236 | 仅启动该脚本验证 CDP 端口预检、拒绝误杀进程与探测 socket 释放。 |
| **三文件合计** | **1,210** | **61,048** | 约 59.6 KiB，全部保留，不计入任何删除收益。 |

每个文件的当前 SHA256、精确行数/字节见 `large-items.json`。统计以真实物理行计数，包含空行；没有将旧“967 行”的历史数值冒充当前尺寸。

### 不能直接删的明确依据

已读取老板此前拍板的原始记录：

> “967 行性能台账采集，evidence 有使用史（2026-09-30 批次）与复跑链路价值——不删。”

来源：[2026-10-02 工具箱清理](../../../2026-10-02-toolbox-cleanup/README.md) 的“② perf-ledger-capture.mjs 保留定性”。归档 [PENDING #29](../../../../archive/WF-ledger-context-1009/originals/docs/PENDING.md:35) 同样记录“10-02 老板令‘弄完’全部了结”时核实保留。

当前脚本还比当时多 26 行；两份专用回归测试也覆盖其独立行为。老板本轮在复核该功能与现行入口的差异后再次明确决定保留；该项已结束，不再提删除。

### 根入口与全库引用核对

- 唯一执行根是显式手动命令 `node scripts/perf-ledger-capture.mjs ...`；脚本末尾 `:987` 直接调用 main。没有模块导出供其他生产代码复用。文件 `:26-31` 的直接 imports 全为 Node 内置模块。
- `package.json` 没有指向该脚本的 npm alias；`scripts/workflow.mjs` 没有分派到它；`vite.config.js` 没有导入它。两个专用测试分别通过源码提取和隔离子进程执行它。
- 从仓库根 `D:/素材/代号柒` 搜索 `perf-ledger-capture`，当前/非归档文本共 13 处命中，原始结果见 `current-references.txt`。扫描排除 node_modules、.git、dist/build、output/.tmp、docs/evidence 和 docs/archive；根目录的 Windows 设备项 nul 也显式排除，最终扫描退出码 0。
- 13 处中，脚本自述 3 处、两份专用测试 4 处、配置/注释 3 处、两份 09-29 测量报告 3 处。**未发现其他现行模块以 import/require/spawn 依赖该脚本**；这排除了产品运行依赖，并不否认人工 CLI 入口与历史复跑价值。

### 本轮保留边界

脚本、两份测试、`gate-plan.mjs:74`、`eslint.config.js:285`、`game.cardslib.page.js:13` 的相关说明以及两份 09-29 测量报告全部保留。历史 evidence/archive 与当前浏览器边界不改。此次未检查运行进程，不宣称该采集器没有使用者或后台任务。

## 3. 与现行内置浏览器性能观察的关系

| 能力 | 旧 perf-ledger-capture | 现行入口及差别 |
| --- | --- | --- |
| 采样页面 rAF、Renderer.draw、LongTask | 页面内 plInstall/sample 采样 | `game.boot.js:147-148` 以 `?perfProbe=1` 按需加载 `core/perf-probe.local.js`；`:22` 的 summarizePerfSample 与 `:209` 的 sample 提供 6 秒采样。可部分替代同窗口逐页观测。 |
| 首次加载/资源与战斗模块加载信息 | loadReport | 当前探针 `onClick` 的 loads 分支也读取 navigation/paint/resource 与战斗加载 measure。 |
| 自动走标题/档位/基地/照相馆/设置/多层地图/普通战/首脑战 | 脚本 main/runDrive/driveBoss 维护整套自动场景链 | `scripts/iab-drive.mjs` 是 ZCode 内置浏览器驱动，Agent.scenes 是固定验收剧本；它们没有导入该采集器，也没有输出同款全场景性能账本。 |
| 3 轮中位数、逐场景 JSON、旧 summary 合并 | script 的 record/summarizeForLedger/writeSummary | 当前探针呈现单次结果；`workflow-browser.mjs` 负责证据快照导入/对比，不是同款采样调度器。 |
| CDP Performance.getMetrics 的 JSHeapUsedSize/Nodes 等 | 使用外部 Edge/CDP 获取 | 当前页面探针/内置驱动没有同等的这套自动 CDP 采集流程。 |

旧脚本仍有独立能力。当前平台边界不允许拿外部浏览器作为游戏实页验收替代，这约束运行方式；它本身不足以证明源代码冗余或撤销老板保留决定。本轮没有运行任何浏览器或采样器。

`scripts/perf-benchmark.cjs` 是另一个 **401 行 / 18,775 字节**的冻结 Electron 基准，经 `package.json:33-34` 的 `perf` / `perf:soak` 进入；它有固定物理分辨率、压力/soak 场景与 performanceGatePassed 判据。`docs/performance.md:125`、`docs/development.md:18` 已明说属于冻结历史基准。它和旧 Edge 账本测量条件、结果与用途不同，也不是该账本的完整替代。本轮不将它搭车并入 1,210 行删除包。

## 4. 其余大项：有入口，保留

| 大项 | 当前尺寸 | 根入口与实际引用 | 净减与条件判断 |
| --- | ---: | --- | --- |
| `game/tools/agent-{batch,evolve,supervise,compare,ledger,compare-provenance,run-provenance}.mjs` | 7 文件，1,713 行 / 96,728 字节 | `docs/agent-protocol.md:173`、现行 `docs/production/engineering/AGENT-EXPERIMENTS.md:21-31` 给出人工 batch/compare/ledger 入口；evolve `:170-172` 会启动 batch；compare 导入 comparison provenance；batch 导入 run provenance。 | 实际实验功能，不是无入口模块；只有明确放弃整套策略实验能力才有删除可能，不能作为冗余直接减 96KB。 |
| `game/src/agent/agent.scenes.runtime.js` | 514 行 / 24,418 字节 | `agent.scenes.js:24` 按需加载；`agent.js` 公开 scenes；`docs/quality-gates.md` 与 AGENT-TOOLBOX 仍给出验收入口。 | 当前 QA 功能入口，不因未参与玩家正常一局就删。 |
| `game/src/run/map-generator.js` | 325 行 / 24,363 字节 | 不仅 `layeredMap.js:2` 的旧局入口消费，现行 `map-generator-v4.js:3` 仍导入并生成候选/保底几何，`map-generation-rules.js:2` 仍调用旧质量校验。 | 现行新局本身依赖它；无论旧存档多少都不能整套删。 |
| `scripts/electron-title-smoke.mjs` + `scripts/electron-gpu-info.cjs` | 145 行 / 6,371 字节 | 手动 Electron/CDP/GPU 诊断入口；gate-plan 明确标为桌面冻结域工具。 | 属历史诊断保留目的，不能将“冻结”解释成已授权删除。单独尺寸也没有数百行。 |
| `scripts/runtime-asset-redundancy-review.mjs` | 改前 42,678 字节，改后 35,680 字节 | `runtime-asset-redundancy.mjs:6` 导入；`vite.config.js:16` 进入构建资源发布保护。 | 仅归一前述 90 行重复模板，审定表完整保留；不是可以因资源缺失一并删掉的数据。 |

未扩展到根目录冻结 Godot/Unity/EXE、历史素材或临时输出的物理清理。根入口的全局可达性图由主会话另做，本报告不重复声称完整覆盖全仓入口。
