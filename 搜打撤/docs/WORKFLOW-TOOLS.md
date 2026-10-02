# 日常开发流程

现行规范，2026-10-02。日常只有一条路径：**按目标 → 主动作 → 定向反馈 → 按授权收官**。项目权限、属地、登记豁免与资源边界见根 AGENTS.md；验证分级与覆盖解释只在[质量门](quality-gates.md)维护。

## 信息只维护一次

| 内容 | 维护处 |
| --- | --- |
| 需跨会话跟踪的目标、负责人、路径、完成标准、进度和检查指针 | `docs/evidence/<日期>-<任务>/task.json` |
| 编辑/服务占用与完成未提交归属 | [REGISTRY](PARALLEL-REGISTRY.md)，进度引用任务指针 |
| 老板尚需拍板的事项 / 未来候选 | [PENDING](PENDING.md) / [roadmap](roadmap.md) |
| 规则、契约、设计决定 | 对应现行规范；规格只保留需求和方案 |
| 交付摘要 / 原始证据与历史 | [STATUS](STATUS.md)只作导航 / 任务证据目录与 `docs/archive/` |

小修用目标、diff和交付说明即可，不强制建task.json；旧记录保留原位，不补造执行历史。task summary 生成任务摘要，不在看板、记忆和多份报告重复更新同一进度。

## 按目标

先确定可观察结果和任务边界。单问直接答；明确小改直接处理目标。跨域、长任务、接班或改共享文件运行一次 `npm run handoff`，同轮复用；已知他人编辑属地冲突先协调。留言、记忆、PENDING 和任务路由只按目标补查，不做默认六项巡检。

handoff 分开列编辑占用、完成未提交归属、已落库/已释放历史和真实待决策。划线/已决记录不计活账；完成未提交不是编辑锁，也不构成提交授权。无主改动只记录，不能按路径猜测完成或清理。

持久任务的直接字段命令见下方操作路径：start 必需 goal、paths、doneWhen，默认 planned，开工填 doing。明确单会话无争用可用 `--apply --expect auto`，仍写前核对基线；争用场景用显式 SHA。玩法、存档或接口尚不明确时只补所需决定，不给所有小修加规格门。

## 主动作

按[任务路由](README.md#按改动找文档)定位现有实现，主动作与必要登记同轮完成。并行任务划不相交属地，主会话集成；进度只更新 task.json。

```powershell
npm run --silent workflow -- status --paths scripts/workflow-task.mjs
```

task update 只传变动字段，预览后沿 SHA 写入，不默认清空旧数组。定位影响面用 `npm run impact -- <路径...>`，不必同时跑 status；记忆用 `npm run memory:discover -- --json` 按需找索引和相关正文。

## 定向反馈

| 改动 | 最短反馈 |
| --- | --- |
| 工程文档/导航/归档 | `docs:check`：当前链接、档案原文字节/替代入口、规则预算和源码域表契约 |
| 内部流程脚本 | 相关契约测试；无玩家行为变化不要求游戏浏览器 |
| 游戏代码、数据、剧情、fixture | 依赖或引用选择定向测试；选择与升级条件见质量门 |
| 玩家可见变化/游戏行为 | 相关测试与质量门要求的实页/图片证据 |

```powershell
npm run --silent workflow -- verify --task <编号> --paths <逗号分隔路径> --plan
npm run --silent workflow -- verify --task <编号> --tests <逗号分隔测试>
npm run --silent docs:check -- --json
npm run --silent workflow -- evidence --input <报告JSON> --json
```

`verify --tests/--paths` 用逗号；`acceptance-gate.mjs --paths` 也接受空格。报告记录执行范围、结果、源输入与环境；skip、失败和中断不算通过。相同相关内容与环境复用，不相关改动不扩大定向闭包；台账变化只补状态检查，规则变化补文档检查。动态 import 或未知进程/文件输入无法证明时保守回退。工作树 verify 结果是复用候选，不能直接免除暂存门。

混树提交前：

```powershell
npm run check:staged:isolate -- --plan --json
npm run check:staged:isolate -- --json
```

隔离冻结实际 index，核对依赖且不读半成品工作树。普通门与隔离门共用选择规则。有效报告的 gateReceipt 可经 `acceptance-gate.mjs --reuse <报告>` 或 `GATE_RECEIPT` 复核后使用；须匹配 index、选择范围、输入、环境与依赖，失败就补验，不绕过门禁。内置浏览器采集后用 `npm run workflow -- browser import/compare` 保存/对比，工具存在不等于真实输入已验。

## 按授权收官

达到 doneWhen 就收官。说明改动、实测范围、未核项；释放自有编辑/服务占用，完成未提交保留路径和归属。持久任务关闭输入填 complete-uncommitted 或 partial、checks、unverified；完成必须 doneWhenConfirmed:true，手工检查标 manual。

```powershell
npm run --silent workflow -- task summary --task <编号> --json
```

写入沿预览 SHA。收官只停止本会话创建且身份核实的服务，复核端口。新发现入 backlog 或真正待决策，不继续扩大本轮。

老板明确授权提交后，按根规则受理全部完成未提交改动；这才适用平时不混提的例外。ship 默认只盘点计划，核对完成归属、在途 mtime、原 index、验证边界后才执行：

```powershell
npm run --silent workflow -- ship --json
npm run --silent workflow -- ship --apply --expect <planSha256> --json
```

需明确完成范围可加 `--paths <逗号分隔路径>`，冻结报告复用加 `--receipt <报告>`；范围不覆盖在途保护。源码/mtime、HEAD/index、登记与任务/待决基线变化拒绝执行；原 index 的计划外内容阻断。执行按共同验收范围分组，测试读取的文档随代码同组，状态与其他证据另组；单组失败就停后续，不覆盖并发暂存、不回滚现场或自动推送。receipt 失效补验，不把路径分类、预估耗时或任务完成当授权/验收。提交后核对结果并销账。

CI 只覆盖已推送且有实际运行结果的来源版本；未推送/未提交的增量明确列为未覆盖。阶段收尾是否补本地全量按质量门，不能因“落库”固定再跑一套。

## 两条操作路径

以下在 `搜打撤` 目录执行。路径和编号须换成本轮目标；示例是操作模板，不产生实际提交授权。普通小修不因模板新增 task 或 stage 仪式。

### 普通小修：工程文档修正

查目标 → 改目标 → 验相关文档 → 简报完成未提交。改共享文件时先取得本轮一次 handoff 简报并按根规则判断登记；同轮已有简报复用。只审查时停在结论，不编辑。

```powershell
git diff -- docs/AGENT-TOOLBOX.md
# 实施已授权的目标修正后
npm run --silent docs:check -- --json
git diff --check -- docs/AGENT-TOOLBOX.md
git diff -- docs/AGENT-TOOLBOX.md
```

报告改动、检查和未核项，到此收官；无提交授权不 stage/commit。内部脚本小修把 docs:check 换成对应定向契约测试，玩家可见变化按质量门补对应实页。

### 混树：已授权提交的完成代码包

先确认完成归属和提交授权，审查工作树/index，预览候选范围；`--paths` 不自动扩展文档。核对计划的 commits、coupledDocs、excludedPaths、inProgressPaths：测试读取的相关文档须经审查完成后纳入同一代码组，在途依赖不能强行打包。下面演示单一代码组与其相关文档，其他独立文档组另行预览执行，不拿本报告复用。

```powershell
npm run handoff
git diff --stat
git diff --cached --stat
# 例子范围须换成已确认完成的本轮代码包，包括测试读取的相关文档
$completePaths = 'scripts/workflow-task.mjs,tests/workflow-task.test.js,docs/WORKFLOW-TOOLS.md'
npm run --silent workflow -- ship --paths $completePaths --json
```

核对既有 stage 归属，计划外内容由归属会话处理，不回滚他人 index。审查后将 `$completePaths` 收敛到同一代码组及其 coupledDocs；若还有独立 docs 组，拆开本次 receipt 包。只有完成范围明确才 stage，先预演再冻结：

```powershell
$files = $completePaths -split ','
git diff -- $files
git add -- $files
git diff --cached --stat
npm run --silent workflow -- staged --task WF-example --plan --json
$frozen = npm run --silent workflow -- staged --task WF-example --json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $frozen.validation.reusableReceipt) { throw $frozen.nextAction }
$receipt = $frozen.report
$ship = npm run --silent workflow -- ship --paths $completePaths --receipt $receipt --json | ConvertFrom-Json
if ($ship.status -ne 'ready' -or -not $ship.receiptValidity.eligible) { throw $ship.nextAction }
$ship | ConvertTo-Json -Depth 12
```

确认仍是同一冻结输入、完成范围和已授权代码组；空 index 或纯文档 skip 不是 passed receipt。staged 的 validation 区分 executed/passed/reusableReceipt，nextAction 说明后续；ship 区分 ready/noop/blocked，receiptValidity 仅预检，提交门仍严格核验。相关文档随代码同组，不在冻结后补 stage；输入/任务基线变化重新预览和补验。**下面仅在已有明确提交授权且刚才计划已核对时执行**，原参数与预览 SHA 不变；失败保留已完成提交和剩余现场，按 details.nextAction 处理，不自动重试：

```powershell
npm run --silent workflow -- ship --paths $completePaths --receipt $receipt --apply --expect $ship.planSha256 --json
```

### 仅需跨会话跟踪时：直接 task 字段

单会话小修跳过本节。换成本轮编号、负责人、范围与完成标准；直接字段免准备临时 JSON。复杂输入仍兼容 `--input <JSON文件>`，不能与直接字段混用。重复 `--done-when` / `--check` / `--unverified` 形成数组；check 仅前两处冒号分隔种类和结果，后续是说明或项目内报告路径。空数组须明确 `--checks-none` / `--unverified-none`，不是省略字段。

开始时预览；核对后用同一参数追加 `--apply --expect absent` 写入，争用时沿原锁边界，不覆盖既有任务：

```powershell
# task-start-example
npm run --silent workflow -- task start --task WF-example --owner Friday --goal "修正任务工具及其说明" --paths "scripts/workflow-task.mjs,tests/workflow-task.test.js,docs/WORKFLOW-TOOLS.md" --done-when "相关契约测试通过" --done-when "说明与实际接口一致" --stage doing --json
```

检查真实完成后才能声明 passed；输入适配不生成通过证据。完成仍是未提交，先 close/释放占用，再 stage 与冻结，以免 doing 保护或冻结后任务基线变动。用同一 close 参数获取预览，核对后沿其 SHA 应用：

```powershell
# task-close-example
$closePlan = npm run --silent workflow -- task close --task WF-example --owner Friday --stage complete-uncommitted --done-when-confirmed --check "manual:passed:已核对相关契约测试输出与说明接口" --unverified "远端CI未覆盖本轮未推送改动" --json | ConvertFrom-Json
$closePlan | ConvertTo-Json -Depth 12
# 核对完成标准、检查与未核项后
npm run --silent workflow -- task close --task WF-example --owner Friday --stage complete-uncommitted --done-when-confirmed --check "manual:passed:已核对相关契约测试输出与说明接口" --unverified "远端CI未覆盖本轮未推送改动" --apply --expect $closePlan.expectedSha256 --json
```

partial 收官改 `--stage partial`，失败/未核验检查如实填写。`report:passed:docs/evidence/.../report.json` 仍由原任务模型核验报告。start 默认当日日期，read/update/close 可按唯一编号定位原日期；编号有歧义才补 `--date`。任何 close 都不产生提交授权。

## 归档与替代

旧办法被明确替代或历史入口误导时才归档；小修不复制一套原文。已提交历史引用精确版本，未提交原文需要保留时用 archive snapshot；不覆盖旧档。manifest 的 source 只记录历史来源，可合法退役；target 原字节 SHA256 与 replacedBy 现行入口必须可核对。实际移动/删除沿项目授权，检查器不自动处理文件。

原文与裁剪来源见[减负归档](archive/lean-workflow-2026-09-30/README.md)；历史[task.json](evidence/2026-09-30-lean-workflow/task.json)只证明该批次。
