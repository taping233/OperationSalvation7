# 提交机制体检与重设计 2026-10-01

老板令：多情况、多次重复检查工作流/提交机制，测试后重新设计。范围：`scripts/acceptance-gate.mjs`、`.githooks/pre-commit`、静态检查链、workflow.mjs 入口、提交打包流程。方法：真实 git index 探针实测（临时探针文件全程隔离，测毕恢复现场）+ 重复计时。

## 一、实测数据（全部本机实测，2026-10-01 夜，Node 24.13）

| 场景 | 修复前 | 修复后 | 备注 |
| --- | --- | --- | --- |
| 空暂存 plan | 0.12s | — | |
| 单文件路径选择 | 0.58s | — | reverseImports 全图解析 |
| 纯文档 skip+文档守卫 --run | 0.23s | — | 未跟踪文件不干扰 docs 提交 |
| quick 全链路 --run（3 连跑） | 5.67/5.69/5.67s | **~3.0s** | 零抖动；ESLint 缓存生效 |
| pre-commit hook 端到端 | 8.07s | — | sh+git 子进程开销 ~2.4s |
| 全量 npm test（含 pretest） | 48.2s | 48-50s | 267 文件/2136 过/0 败 |
| ESLint 无缓存 → 热缓存 | 3.68s → 0.78s | — | quick 链路 65% 大头 |
| check-types 7 配置 | 0.88s 串行 | **0.36s 并行** | |
| compile-narrative | 0.155s | — | 无需增量缓存 |
| handoff | 0.85s | — | |
| staged:isolate --plan | 0.91s | — | |

## 二、BUG 清单（按严重度）

1. **BUG#3（流程根因，已发生事故）**：gate 只验内容质量，**不验提交边界**。26a5254 `git add` 排除 pathspec 失效，误带 892 行无主 code-map 产物入库（2ce3def 回撤）。任何 staged 内容只要质量过就放行，打包提交（多会话合落库）时无人核对清单。
2. **BUG#5（假红，间歇）**：`tests/node-retrigger.test.js` 测试拆除后残留 500ms 级定时器触发 `new Image()`，teardown 已撤 jsdom 全局 → vitest 记 unhandled error → **267 文件全过仍 exit 1**（3 连跑复现 1 次，run2）。同类问题该文件 2026-09-20 已发生过一次（当年堵了 openClassChoice 单入口）。
3. **BUG#1（呈现）**：`acceptance-gate.mjs` 顶层 `try{main()}` 捕获不了 async rejection，`[gate] FAIL` 分支是死代码——所有错误（含混树拒绝）以原始堆栈呈现。退出码碰巧仍 1（unhandled rejection 崩溃），fail-closed 保住但排障体验差。
4. **BUG#2（呈现+文档缺口）**：混树拒绝把「未暂存改动/未跟踪新文件/被忽略文件」三类混列为一个清单，无法区分"在途工作"vs"ignore 产物挡路"；quality-gates.md 未记载 ignored 文件也阻塞提交（实测 tests/ 下被 ignore 的 .asar 即拒绝）。
5. **BUG#4（卫生）**：14 个 worktree（9 个 codex 遗留、2 个 Temp prunable、6 个 detached HEAD），`git worktree list` 噪音+磁盘占用，无人清理。
6. **观察**：`workflow verify --tests` 用逗号分隔、`gate --paths` 用空格分隔——参数风格不一致易踩坑；handoff 报 REGISTRY 属地重叠疑点（已落库历史行，台账卫生）。

## 三、结构性效率问题（"慢"的定量来源）

1. **scripts/ 映射覆盖 50%**：34 个脚本 17 个无 WORKFLOW_TESTS 映射——改 `check-types.mjs`/`validate-data.mjs`/`compile-narrative.mjs`/`iab-drive.mjs` 等高频基础设施脚本一行 = 48s 全量惩罚。本次实测亲身踩中（stage check-types 修复即 full）。
2. **ESLint 无缓存 3.68s**：quick 链路 65% 耗时；`--cache` 热跑 0.78s（-79%），eslint 自带配置变更失效，安全。
3. **类型检查 7 配置串行 0.88s**：配置彼此独立，可并行（实测 0.36s）。
4. **FULL_SOURCE 正则宽**：core/、battle.engine/runtime、hub storage 等公共边界一触即全量——活跃开发路径高频命中。这是审慎设计（公共边界），但 runtime/ 目录下文件影响面差异大，可逐文件收窄（需证据，另立任务）。
5. quick 链路其余环节健康：剧情编译 0.155s、依赖图解析 0.58s、handoff 0.85s、vitest 单文件 ~2s——无需优化。

## 四、已实施修复（本工作树，待老板授权提交）

| 修复 | 文件 | 验证 |
| --- | --- | --- |
| FIX1 `main().catch()` 友好错误 | scripts/acceptance-gate.mjs | 混树场景实测输出 `[gate] FAIL：`+处理建议，exit 1 |
| FIX2 混树消息三类分类（`[未暂存改动]/[未跟踪新文件]/[被忽略文件]`，>12 项截断） | scripts/acceptance-gate.mjs | 实测三类各带标签；导出 `formatDirtyReport` 纯函数 |
| FIX3 gate 内 ESLint `--cache` | scripts/acceptance-gate.mjs | quick 5.67s→~3.0s |
| FIX4 类型检查 7 配置并行 | scripts/check-types.mjs | 0.88s→0.36s，按原序输出，exit 语义不变 |
| FIX5 node-retrigger afterAll 排水 700ms | tests/node-retrigger.test.js | 单跑 3/3 过；全量 3 连跑见下 |

修复后回归：`tests/acceptance-gate.test.js` 23/23、`tests/node-retrigger.test.js` 3/3、ESLint/语法/类型/数据全绿（随全量门验证）。

## 四点五、终态验证（2026-10-01 夜收官前）

- **全量 3 连跑（stage 含全部修复集）：3/3 exit=0、0 个 unhandled error、51-57s**——FIX5 假红消除验证通过（修复前 3 连跑复现 1 次「全过却 exit 1」）。
- quick 提速口径修正：同 stage 集修复前后对照不可得（修复集自身在 stage 中，且 gate 修复使 acceptance-gate.mjs 映射带出 4 个 workflow 测试）。确凿分段实测：ESLint 3.68→0.78s（热缓存）、types 0.88→0.36s（并行），静态段关键路径 max() 由 3.68s 降至 ~0.8s，**全链路收益 ~2.9s 为分段加总**；6 测试文件集 quick 实测 7.2-7.4s×3（参考点，含 acceptance-gate 映射的 workflow 测试族）。
- 收官现场：index=3 修复文件（待授权提交），工作树=REGISTRY/PENDING/quality-gates 台账改动，探针全部清除，code-map/（他会在途）未动；`gate --staged --plan` 现显 full（check-types 无映射）——R2 提案的活证据。

## 五、重设计提案（待老板拍板，未实施）

- **R1 提交边界守卫（治 BUG#3/26a5254 复发）**：pre-commit 在 gate 之前核对 staged 清单——超出当前任务属地（task.json paths / REGISTRY 属地）的文件要求 `GATE_MANIFEST_OK=1` 显式确认；无属地记录时打印完整清单+新增未跟踪文件数警示。原则：清单显式化，不替人判断。
- **R2 scripts/ 基础契约测试**：新建 `tests/scripts-contract.test.js`（34 个脚本全部可加载+导出形状），未映射脚本回退「基础契约+架构哨兵」而非全量；另加守卫强制新脚本要么入 WORKFLOW_TESTS 要么登记豁免。预计消掉一半"一行改动=48s"惩罚。
- **R3 FULL_SOURCE 逐文件收窄**：battle/runtime/*.js 等按反向依赖图量化影响面，能降 quick+guards 的降级；每文件留证据。另立任务。
- **R4 task 登记一步化**：handoff 显示无他人活跃时，task start/update/close 允许 `--apply` 直接落并回显写入 diff（省 SHA 两段式往返）；多会话争用时维持 SHA 确认。SHA 确认防的是并发写坏，单人场景成本>收益。
- **R5 worktree 清理报批**：2 个 Temp prunable（soudache-release/settlement-20260923）建议直接 `git worktree prune`；其余 12 个逐个列明分支/HEAD/最后用途后报批删除。
- **R6 参数风格统一**：`--tests/--paths` 统一同时接受逗号与空格分隔。

## 七、方案应用与全面演练（10-01 深夜，老板令「应用新的方案，再检查一遍，模拟完整流程与复杂环境」）

### 已实施（本工作树，含 FIX1-5 共 12 文件待授权提交）

- **R1 提交边界守卫**：`parseUnclaimedPaths`+`checkCommitBoundary` 进 gate `--staged` 主流程；staged 命中 REGISTRY 无主物品路径（含目录前缀）即阻断，`GATE_MANIFEST_OK=1` 显式逃生。
- **R2 脚本契约回退**：`EXEMPT_SCRIPTS` 17 项豁免清单+`SCRIPT_CONTRACT_TEST`；planForPaths 未映射/豁免/被删脚本回退契约测试+文本引用搜索+双哨兵（说明延后注入绕开 reasons=全量短路）。新测试 `tests/scripts-contract.test.js`：34 脚本语法契约+映射完整性守卫（新脚本漏登记即红，错误信息带指引）。
- **R4 一步化**：task/ledger `--expect auto`（plan.expectedSha256 直传；apply 时刻重新 plan+expect 比对+锁内 unchanged 复核三层防线不变）；task/ledger 错误消息分级（「没提供」vs「预览后已变化」）。
- **R6**：gate `--paths` 逗号/空格均收。

### 演练结果（第一幕完整流程 + 第二幕复杂环境）

| 场景 | 结果 |
| --- | --- |
| 完整四步流程（R4 实战） | task start→改动→verify（真拦下错误断言一次）→close→staged→gate quick→hook 端到端，全通；start/update/close 各一条命令 |
| **E2 26a5254 复现**（REGISTRY 注入假无主+stage） | **精确阻断**，消息指明事故形态与逃生口；`GATE_MANIFEST_OK=1` 放行 ✓；现场完整恢复（grep 0 残留） |
| E3/E4 并发写 task | 双进程并发=顺序化合法更新（无丢失更新）；两段式旧基线 apply 被重新-plan 比对拒绝；auto 无陈旧基线覆盖风险（plan 恒读最新） |
| E5 改名（HEAD 文件往返 mv） | 测试改名→「缺失测试」全量 ✓；源码改名引用未同改→「新文件孤立」全量 ✓；**发现 needsFull 的 R 分支是死代码**（--no-renames 拆 A+D），已改注释+文案诚实化，行为三层兜住安全 |
| E5 纯删除/空暂存/纯文档 | A 档定向 ✓（首轮已验）；skip+守卫 0.23s ✓ |

### R3 修正（重要）

首轮判断「battle/runtime 整体全量」过粗：逐文件实测 13 文件中 7 个本就 quick（10-11 定向测试），仅 `battle.runtime.*` 核心 6 文件全量且 2 跳影响面 12-54 个测试——判得合理。`game/src/core/` 30 文件 100% 全量是分层验收改造的审慎设计；收窄需逐文件 30+6 项证据，收益=改动频率×48s，另立专项。**本轮不改规则。**

### 最终回归

- **R2 实战对照闭环**：同一改动集（含 check-types.mjs）——R2 前 full 48-57s，R2 后 quick **8.0/8.1/7.9s（3 连跑 3/3 绿 0 unhandled，-85%）**。
- 面向测试 5 文件 86/86（含更新 2 条旧断言至 R2 新契约）；演练产物（探针/模拟任务目录）全部清理，index=12 文件待授权提交。
- worktree 清单（R5）实测 13 附属 3.0GB，分类报批挂 PENDING #28。

- 探针文件（tests/__gate_probe__*、scripts/__gate_probe__）已全部删除，git index 已恢复为空；未跟踪的 code-map/（在途会话）未动。
- 全量 3 连跑结果、修复后场景矩阵见同目录记录；本报告结论以当时 HEAD f52ada1 为基线。

## 六、边界

- 探针与演练产物全清（tests/__*_probe__、sim-flow-drill/sim-race 目录）；未跟踪 code-map/（在途会话）全程未动。
- 本报告两轮结论以 HEAD f52ada1 为基线；第二轮改动待授权提交。
