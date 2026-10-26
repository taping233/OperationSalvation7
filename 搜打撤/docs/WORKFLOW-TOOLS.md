# 日常开发流程

日常路径：**核对现状 → 复用实施 → 集中反馈 → 按授权收官**。项目边界见根 AGENTS.md；本页维护操作步骤，验证分级见[质量门](quality-gates.md)。

## 信息只维护一次

| 内容 | 维护处 |
| --- | --- |
| 点名派工/跨会话长任务的目标、路径、完成标准、进度 | `docs/evidence/<日期>-<任务>/task.json`；**日常小修零仪式，不建任务**（2026-10-04 老板拍板） |
| 编辑/服务占用与完成未提交归属 | [REGISTRY](PARALLEL-REGISTRY.md) |
| 老板尚需拍板的事项 / 未来候选 | [PENDING](PENDING.md) / [roadmap](roadmap.md) |
| 规则、契约、设计决定 | 对应现行规范 |
| 交付摘要 / 原始证据与历史 | [STATUS](STATUS.md) 只作导航 / 任务证据目录与 `docs/archive/` |

台账按 `workflow ledger registry list` / `ledger pending list` 的状态分组读取，按路径接手用 `workflow status --paths ...`。已释放、已决记录按任务追溯；`task summary` 的 `skipped` 标明读取缺口，保留原文和任务编号。

## 按目标

先核对现码及对应版本验收，在简报中说清已有成果、本轮差距和完成标准。小修直查目标，范围不明查[任务路由](README.md#按改动找文档)。接手合并 `handoff` 与定位；项目内加 `-- --paths "路径1,路径2"`，改根规则用全局。同轮复用简报，同属地活跃先协调。影响面缺口查 `impact`；经验缺口用 `workflow memory --source codex --query "关键词" --limit 3 --json`，ZCode 用 zcode，跨端检索才用 both。

工具按全局约定批量读取、顺序修改，逐项检查退出码及预览/SHA/index。素材一次取得尺寸、透明度、切分位置与现行引用，再顺序处理、接线和登记。实测见[请求合并对照](evidence/2026-10-05-WF-request-batching/README.md)与[实际任务迭代](evidence/2026-10-05-WF-flow-practice/README.md)。

已注入规则直接沿用；按目标读现行章节和源码，资料够用即实施。技能按当前阶段取用，人物、素材资料按需补充。相关输入和环境相同时复用读取与验证；变化或新失败影响结论时补查。

体验观察优先使用老板实机录像，按时间戳记录操作、预期与实际，再关联现码和本轮差距；复验聚焦对应片段及差异场景。录屏工具见[工具箱](AGENT-TOOLBOX.md#本地录屏分析)。

## 登记与豁免

共享文件编辑与长任务按根 AGENTS.md 同轮登记并在收官释放。`handoff` 显示活跃占用仅本会话时，以下改动可直接编辑并收官核对，免登记与两段式操作：

- 纯说明类小修：注释或 Markdown 改动不超过 10 行，不碰代码、数据、共享台账，且当次收官。
- 共享台账小额修改：仅维护已核实的记录，不涉及其他会话的占用或归属。

活跃会话多于本会话，或无法确认满足上述条件时，照常登记；同属地已被占用先协调。

## 增删改共用清单

每个完整流程批次复用同一份问题与验收记录，不为每个小点另建报告：

1. 按完整玩家流程确定问题、复现条件与可观察结果，区分尚未实现、已有待补和验收后变化。日常小修直接简报，跨会话批次共用一份记录。
2. 优先复用现有公共模块、正式组件、导入工具与外部库；新增基础能力说清替代对象和接入范围。增删核对玩法、自定义内容、旧档、静态/动态引用和来源许可；Knip/jscpd 提供核查候选。
3. 公共机制由一人收拢，独立规则、素材和验证并行；先做正式组件样板，再接各入口，同步收拢旧分支。预览直接复用正式组件；同类问题回到共同入口修正，按授权处理退役文件。
4. 并行批次先汇总全部修改与待验项，由主会话统一选集、集中验证正式输出与状态变化：定向回归、fast-check、Stylelint/axe 与平台实页各司其职；架构和资源保留必要静态契约，关键守卫按需 Stryker。消费者变化同步审查资源指纹与排除清单，沿用质量门与预算。
5. 同步现行描述，以对应版本和实际覆盖报告结果；按授权冻结、提交推送、回读 SHA 并核对 CI。完成以流程接齐、共性实现收拢和可观察结果为准，删减比例作辅助。

## 定向反馈

日常不清楚测试文件时，用 `npm run test:changed -- --plan` 查看当前项目选集，再运行 `npm run test:changed`。共享工作树优先指定本轮改动，例如 `npm run test:changed -- --paths game/src/battle/view/battle.hover.js`；需要只读预览加 `--plan --json`。该入口沿用质量门选择器，公共边界或配置变化仍可升级 full；测试文件已明确时继续使用 `test:target` 或下方 `verify --tests`。

| 改动 | 最短反馈 |
| --- | --- |
| 工程文档/导航/归档 | `docs:check`：链接、档案契约、规则预算与源码域表 |
| 内部流程脚本 | 相关契约测试；无玩家行为变化不要求游戏浏览器 |
| 游戏代码、数据、剧情、fixture | 依赖或引用定向测试；选择条件见质量门 |
| 玩家可见变化/游戏行为 | 相关测试 + 质量门要求的实页/图片证据 |

```powershell
npm run --silent workflow -- verify --task <编号> --paths <逗号分隔路径> --plan
npm run --silent workflow -- verify --task <编号> --tests <逗号分隔测试>
npm run --silent docs:check -- --json
```

多处改动用 `workflow review --paths <CSV> --json` 汇总文档、测试和UI用例候选；加 `--input <verify报告>` 核验已有结果，详见[改动核验清单](CHANGE-REVIEW.md)。无Git副本显式给路径并标 `snapshot`；HEAD/index/CI 证据由对应 Git 与远端记录提供。

恢复副本、依赖链接变更或冻结交付前，运行 `npm run workflow -- doctor --staged --json` 核对 Git/index、全部适用锁依赖及可运行性；缺 Git、缺包或锁不匹配时先修复，空 index 按待快照选择处理。普通 `doctor` 核关键工具、全部直接依赖及 node_modules 链接；链接同时核对可读性和锁定字节。预检、测试、依赖字节校验与实页各自记录结果，路径/测试预览与 `--staged` 互斥。

测试已明确时直接 `verify --tests`，影响面或门级别待定时用 `--plan`。结果按通过、skip、失败和中断分别记录；相同相关内容与环境复用证据，定向范围沿实际依赖确定。工作树 verify 提供复用候选，提交走暂存门：先用 `npm run check:staged:isolate -- --plan --json` 核对再运行；gateReceipt 精确匹配 index、范围、输入、环境与依赖后用 `GATE_RECEIPT` 复用，差异项补验。

按路径或完整门生成计划的预检上限为 60 秒；超时结束本次预检，直接运行原计划命令定位耗时，保留原定检查范围。

单张皮肤导入、目标素材与定向检查、当前内置页面取证见[美术接入工具](art-workflow-tools.md)；保留原始退出码，目标检查和全局资产门分别报告。

收官汇总、NAI请求记录/只读预检、可续跑的当前内置人物外观操作见[常用工作流短入口](workflow-recipes.md)；工具复用现有任务、台账与证据，负责人据报告判断结果。

## 按授权收官

达到完成标准就收官：说明改动、实测范围、未核项，释放自有编辑/服务占用，完成未提交保留路径和归属。停止本会话创建且身份核实的服务并复核端口；新发现归 backlog 或 PENDING，提交按老板明确授权执行。

老板明确授权提交后，按根规则打包全部完成未提交改动；ship 默认盘点计划，核对完成归属、在途 mtime、原 index 后执行，单组失败即停；推送按明确授权执行：

```powershell
npm run --silent workflow -- ship --json
npm run --silent workflow -- ship --apply --expect <planSha256> --json
```

限定范围加 `--paths <逗号分隔路径>`，复用冻结报告加 `--receipt <报告>`；源码/mtime、HEAD/index、登记与任务/待决基线变化时重新冻结。CI 结果对应已推送版本，本地增量单列状态。

## 两条操作路径

以下模板按已有任务授权取用；普通小修直接处理目标、验证并简报。

### 普通小修：工程文档修正

查目标 → 改目标 → 验相关文档 → 简报完成未提交；stage/commit 按提交授权执行。内部脚本采用对应定向契约测试，玩家可见变化按质量门补实页。

```powershell
git diff -- docs/AGENT-TOOLBOX.md
npm run --silent docs:check -- --json
```

### 混树：已授权提交的完成代码包

确认完成归属和提交授权，审查工作树/index 后预览候选范围；代码及测试读取的文档显式同组列入 `--paths`：

```powershell
npm run handoff
git diff --stat
git diff --cached --stat
$completePaths = 'scripts/workflow-task.mjs,tests/workflow-task.test.js,docs/WORKFLOW-TOOLS.md'
npm run --silent workflow -- ship --paths $completePaths --json
```

核对计划的 commits、coupledDocs、excludedPaths、inProgressPaths；只有完成范围明确才 stage，先预演再冻结：

```powershell
$files = $completePaths -split ','
git add -- $files
git diff --cached --stat
npm run --silent workflow -- staged --task WF-example --plan --json
$frozen = npm run --silent workflow -- staged --task WF-example --json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $frozen.validation.reusableReceipt) { throw $frozen.nextAction }
$receipt = $frozen.report
$ship = npm run --silent workflow -- ship --paths $completePaths --receipt $receipt --json | ConvertFrom-Json
if ($ship.status -ne 'ready' -or -not $ship.receiptValidity.eligible) { throw $ship.nextAction }
```

passed receipt 来自实际执行通过的检查，空 index 和纯文档 skip 单列状态。相关文档随代码同组冻结，输入或任务基线变化时重新预览补验。**按明确提交授权和已核对计划执行**，沿用原参数与预览 SHA；失败保留现场，按 details.nextAction 处理后再决定下一步：

```powershell
npm run --silent workflow -- ship --paths $completePaths --receipt $receipt --apply --expect $ship.planSha256 --json
```

### 仅需跨会话跟踪时：直接 task 字段

点名派工或跨会话长任务才走本节；重复 `--done-when` / `--check` / `--unverified` 形成数组，空数组须明确 `--checks-none` / `--unverified-none`。目标、范围与标准已明确时，新建用 `--apply --expect absent` 一次创建，既有任务或并发插入仍拒绝覆盖；更新/关闭先预览再沿 SHA 写入：

```powershell
# task-start-example
npm run --silent workflow -- task start --task WF-example --owner Friday --goal "修正任务工具及其说明" --paths "scripts/workflow-task.mjs,tests/workflow-task.test.js,docs/WORKFLOW-TOOLS.md" --done-when "相关契约测试通过" --done-when "说明与实际接口一致" --stage doing --apply --expect absent --json
```

完成先 close 释放占用，再按已有提交授权 stage 冻结。close 先预览，核对后用同一参数加 `--apply --expect $closePlan.expectedSha256` 应用；partial 收官用 `--stage partial`，分别填写失败及未核验检查。

```powershell
# task-close-example
$closePlan = npm run --silent workflow -- task close --task WF-example --owner Friday --stage complete-uncommitted --done-when-confirmed --check "manual:passed:已核对相关契约测试输出与说明接口" --unverified "远端CI未覆盖本轮未推送改动" --json | ConvertFrom-Json
npm run --silent workflow -- task close --task WF-example --owner Friday --stage complete-uncommitted --done-when-confirmed --check "manual:passed:已核对相关契约测试输出与说明接口" --unverified "远端CI未覆盖本轮未推送改动" --apply --expect $closePlan.expectedSha256 --json
```

## 归档与替代

旧办法被明确替代或历史入口误导时归档并保留原文；manifest 的 target 原字节 SHA256 与 replacedBy 现行入口可核对，移动/删除沿项目授权。原文来源见[减负归档](archive/lean-workflow-2026-09-30/README.md)。
