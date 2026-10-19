# 日常开发流程

日常路径：**按目标 → 主动作 → 定向反馈 → 按授权收官**。项目权限、属地与资源边界见根 AGENTS.md；本页维护流程命令和登记条件，验证分级与覆盖解释见[质量门](quality-gates.md)。

## 信息只维护一次

| 内容 | 维护处 |
| --- | --- |
| 点名派工/跨会话长任务的目标、路径、完成标准、进度 | `docs/evidence/<日期>-<任务>/task.json`；**日常小修零仪式，不建任务**（2026-10-04 老板拍板） |
| 编辑/服务占用与完成未提交归属 | [REGISTRY](PARALLEL-REGISTRY.md) |
| 老板尚需拍板的事项 / 未来候选 | [PENDING](PENDING.md) / [roadmap](roadmap.md) |
| 规则、契约、设计决定 | 对应现行规范 |
| 交付摘要 / 原始证据与历史 | [STATUS](STATUS.md) 只作导航 / 任务证据目录与 `docs/archive/` |

读取台账时用 `workflow ledger registry list` / `ledger pending list` 的状态分组；按路径接手用 `workflow status --paths ...`。REGISTRY 的近期已释放段和 PENDING 的已决段供历史追溯，按具体任务查阅。`task summary` 的 `skipped` 单列无法读取的记录，汇总不据此推断其完成状态；旧记录保留原文且占用原任务编号。

## 按目标

先确定可观察结果和任务边界。单问直接答，路径已知直接查目标，范围不明再查[任务路由](README.md#按改动找文档)；接手/占用核对将 `handoff` 与独立定位合并，范围均在项目内加 `-- --paths "路径1,路径2"`，改根规则用全局（`--paths` 拒绝上级路径）。同轮简报复用，同属地他人活跃先协调。影响面/历史经验有缺口才查 `impact` / `workflow memory --source both --query "关键词" --limit 3 --json`（source选codex/zcode/both）；无query只发现库，不组成开场清单。

按依赖边界组织工具编排：独立读取/检查用 `Promise.allSettled` 并行，逐项核对结果与退出码，fulfilled 不等于命令成功；修改与必要登记、最小验证按序合并。确定命令可判断的依赖链在编排内继续，失败即停；需要模型解释输出、选方案、审批或协调时再返回。已批准的局部素材接入一次取得尺寸、透明度、切分位置与现行引用，再用兼容当前环境的现有模板顺序完成处理、接线、清单和必要登记；同一属性不分多轮探查，脚本失败先修复再继续依赖步骤。共享同路径写入不并行，预览/SHA/index 守卫仍先核对；不硬凑请求次数、不批量倾倒输出，足够交付就结束。实测见[请求合并对照](evidence/2026-10-05-WF-request-batching/README.md)与[实际任务迭代](evidence/2026-10-05-WF-flow-practice/README.md)。

## 登记与豁免

共享文件编辑与长任务按根 AGENTS.md 同轮登记并在收官释放。`handoff` 显示活跃占用仅本会话时，以下改动可直接编辑并收官核对，免登记与两段式操作：

- 纯说明类小修：注释或 Markdown 改动不超过 10 行，不碰代码、数据、共享台账，且当次收官。
- 共享台账小额修改：仅维护已核实的记录，不涉及其他会话的占用或归属。

活跃会话多于本会话，或无法确认满足上述条件时，照常登记；同属地已被占用先协调。

## 增删改共用清单

每个完整流程批次复用同一份问题与验收记录，不为每个小点另建报告：

1. 先写玩家遇到的问题、复现条件与可观察验收；对照现码防止重复改。Spec Kit 的问题/验收模板用于查漏，不能代替事实。
2. 核对玩法规则、自定义内容与旧存档边界；新增/删除同时查静态和动态引用、迁移兼容、资源清单及来源许可。Knip/jscpd 只提供候选，不能单凭无引用或重复率删除。
3. 共性问题先改公共模块，再成批接入相关页面；按完整玩家流程收拢更改，及时保存完成内容。
4. 按影响集中验证：纯逻辑用定向回归，状态序列可用 fast-check；UI 合并 Stylelint、axe 与平台实页；关键守卫按需 Stryker，不追单函数满分。资源消费者变化必须重新审查指纹及排除清单；不降低质量门、预算或关闭 CI。
5. 同步必要文档，列明真实验证与阻碍；按已有授权冻结完成清单、提交推送、回读 SHA 并核对该 SHA 的 CI。新结果与原日志分开，不把未验项写成通过。

## 定向反馈

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

改动涉及多处时可用 `workflow review --paths <CSV> --json` 汇总现行文档、测试和UI用例候选；加 `--input <verify报告>` 核验已有结果，详见[改动核验清单](CHANGE-REVIEW.md)。无Git恢复副本必须显式给路径，报告标 `snapshot`，不提供HEAD/index/CI证明。

明确测试列表可直接 `verify --tests`；影响面/门级别不明才用 `--plan`，示例不是必跑清单。skip、失败和中断不算通过；相同相关内容与环境复用证据，不相关改动不扩大定向闭包。工作树 verify 结果是复用候选，不能直接免除暂存门。混树提交前先 `npm run check:staged:isolate -- --plan --json` 核对再显式运行；有效报告的 gateReceipt 须精确匹配 index、选择范围、输入、环境与依赖后才可 `GATE_RECEIPT` 复用，任一不符补验，不绕过门禁。

## 按授权收官

达到完成标准就收官：说明改动、实测范围、未核项；释放自有编辑/服务占用，完成未提交保留路径和归属；收官只停本会话创建且身份核实的服务，复核端口。新发现入 backlog 或 PENDING，不扩大本轮。完成任务本身不构成提交授权。

老板明确授权提交后，按根规则打包全部完成未提交改动；ship 默认只盘点计划，核对完成归属、在途 mtime、原 index 后才执行，单组失败就停后续，不自动推送：

```powershell
npm run --silent workflow -- ship --json
npm run --silent workflow -- ship --apply --expect <planSha256> --json
```

需明确范围加 `--paths <逗号分隔路径>`，冻结报告复用加 `--receipt <报告>`；源码/mtime、HEAD/index、登记与任务/待决基线变化拒绝执行。CI 只覆盖已推送版本；未推送增量明确列未覆盖。

## 两条操作路径

示例是操作模板，不产生实际提交授权；普通小修不因模板新增 task 或 stage 仪式。

### 普通小修：工程文档修正

查目标 → 改目标 → 验相关文档 → 简报完成未提交，到此收官；无提交授权不 stage/commit。内部脚本小修把 docs:check 换成对应定向契约测试，玩家可见变化按质量门补实页。

```powershell
git diff -- docs/AGENT-TOOLBOX.md
npm run --silent docs:check -- --json
```

### 混树：已授权提交的完成代码包

先确认完成归属和提交授权，审查工作树/index 后预览候选范围；`--paths` 不自动扩展文档，测试读取的相关文档纳入同一代码组：

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

空 index 或纯文档 skip 不是 passed receipt；相关文档随代码同组，不在冻结后补 stage；输入/任务基线变化重新预览补验。**仅在已有明确提交授权且刚才计划已核对时执行**，原参数与预览 SHA 不变；失败保留已完成提交和剩余现场，按 details.nextAction 处理，不自动重试：

```powershell
npm run --silent workflow -- ship --paths $completePaths --receipt $receipt --apply --expect $ship.planSha256 --json
```

### 仅需跨会话跟踪时：直接 task 字段

点名派工或跨会话长任务才走本节；重复 `--done-when` / `--check` / `--unverified` 形成数组，空数组须明确 `--checks-none` / `--unverified-none`。目标、范围与标准已明确时，新建用 `--apply --expect absent` 一次创建，既有任务或并发插入仍拒绝覆盖；更新/关闭先预览再沿 SHA 写入：

```powershell
# task-start-example
npm run --silent workflow -- task start --task WF-example --owner Friday --goal "修正任务工具及其说明" --paths "scripts/workflow-task.mjs,tests/workflow-task.test.js,docs/WORKFLOW-TOOLS.md" --done-when "相关契约测试通过" --done-when "说明与实际接口一致" --stage doing --apply --expect absent --json
```

完成仍是未提交：先 close 释放占用，再 stage 冻结。close 同样先预览，核对后用同一参数加 `--apply --expect $closePlan.expectedSha256` 应用；partial 收官改 `--stage partial`，失败/未核验检查如实填写。任何 close 都不产生提交授权。

```powershell
# task-close-example
$closePlan = npm run --silent workflow -- task close --task WF-example --owner Friday --stage complete-uncommitted --done-when-confirmed --check "manual:passed:已核对相关契约测试输出与说明接口" --unverified "远端CI未覆盖本轮未推送改动" --json | ConvertFrom-Json
npm run --silent workflow -- task close --task WF-example --owner Friday --stage complete-uncommitted --done-when-confirmed --check "manual:passed:已核对相关契约测试输出与说明接口" --unverified "远端CI未覆盖本轮未推送改动" --apply --expect $closePlan.expectedSha256 --json
```

## 归档与替代

旧办法被明确替代或历史入口误导时才归档，不覆盖旧档；manifest 的 target 原字节 SHA256 与 replacedBy 现行入口必须可核对，实际移动/删除沿项目授权。原文来源见[减负归档](archive/lean-workflow-2026-09-30/README.md)。
