# Agent 工具箱（按意图查表）

本页按任务查工具能力。权限见根 AGENTS.md，操作步骤见[流程指南](WORKFLOW-TOOLS.md)，验收范围见[质量门](quality-gates.md)。新增、合并或移除工具时同步更新本表。

日常路径见 [WORKFLOW-TOOLS](WORKFLOW-TOOLS.md)，本页只查能力，查询工具按需使用，不逐项串行运行。

## 意图 → 工具

| 我想要 | 用什么 | 说明 |
| --- | --- | --- |
| 接手时看实况（HEAD/并行占用/无主/活账） | `npm run handoff` | 单命令简报；`-- --json` 拿结构化数据；编辑占用、完成未提交归属、历史行和真实待决策分开，疑点需人工核实 |
| 动手前查影响面（撞线/反向依赖/该跑什么） | `npm run impact -- <路径...>` | 属地撞线提示先协调；反向闭包分层；输出可直接复制的验证命令；`--json`/`--all` |
| 理解代码结构与依赖关系 | `code-map/index.html`；`docs/architecture.md`；`game/src/README.md` | 页面来源、服务和实时状态见 [STATUS](STATUS.md) / [REGISTRY](PARALLEL-REGISTRY.md)，本表不复制交付时点 |
| 查某路径当前占用、改动与证据 | `npm run --silent workflow -- status --paths <路径>` | 筛接手摘要，不输出测试依赖闭包；影响面和关联测试用上方 impact |
| 起服（主线 5200 幂等复用） | `npm run web` | 「拉起网页版」固定指令；详细口径见根 AGENTS |
| 跑固定验收剧本（battle/shop/event/extract/fullrun 等 10 场景） | 内置浏览器 console：`await SDT.Agent.scenes.run('battle')`；或 `scripts/iab-drive.mjs` 的 `runScene(tab, 'battle')` | 一次调用=前置+驱动+断言+结构化报告；剧本清单 `SDT.Agent.scenes.list()`；协议见 [agent-protocol](agent-protocol.md) |
| 驱动游戏页面实测 | `scripts/iab-drive.mjs`（node_repl import 函数库） | ZCode 内置浏览器专用；`openGame()`/`clickDevButton()`/`evalRaw()`；默认主线 5200 |
| 跑定向测试 | `npm run test:target -- tests/a.test.js tests/b.test.js` | 只收 tests/*.test.js |
| 留验证证据（自动报告） | `npm run --silent workflow -- verify --task <编号> --tests/--paths ...` | 详见 [WORKFLOW-TOOLS](WORKFLOW-TOOLS.md) |
| 混树提交前冻结检查 | `npm run check:staged:isolate -- --plan --json` | 确认后去掉 --plan；validation 区分 executed/passed/reusableReceipt，nextAction 指路，不把 skip 当通过 |
| 环境/报告有疑问时轻预检 | `npm run workflow -- doctor --json`，报告可加 `--input <报告>` | 只读，不自动测试；checks 的 passed/warning/blocked/info/not-checked 与 summary 标明预检边界，无报告不算错误 |
| 建跨会话任务台账 | `npm run --silent workflow -- task start/update/close ...` | 可直接传 goal/paths/done-when/check 等字段，例子见[流程指南](WORKFLOW-TOOLS.md#仅需跨会话跟踪时直接-task-字段)；小修不需要 |
| 老板拍板事项 | [PENDING](PENDING.md) | 唯一真源，拍板即销账 |
| 查指定历史经验 / 找记忆库 | `npm run --silent workflow -- memory --source both --query "关键词" --limit 3 --json` / `npm run memory:discover -- --json` | source可选codex/zcode/both；各端先索引后限量正文，附来源行号；无query只发现库，历史不是现行规则 |
| 文档一致性检查 | `npm run docs:check -- --json` | 与 docs-consistency 共用链接、档案完整性、预算和域表契约；语义候选另行复核 |
| Vite 性能观察 | 游戏内 `?perfProbe=1`；[性能方法](performance.md) | 先核对当前平台内置浏览器能力；Electron perf 命令冻结不执行 |

## 使用边界

自助查询只读、按目标选择；权限与登记豁免见根 AGENTS.md，验收口径见 [质量门](quality-gates.md)。工具失配以实时命令与源码为准，不因本表存在假定能力可用。

## 保养

- 新脚本进 `scripts/` 时，在 acceptance-gate 的 `WORKFLOW_TESTS`（配专属测试）或 `EXEMPT_SCRIPTS` 登记，供 scripts-contract 和定向检查选择器使用。
- 本表行与真实命令失配时以 `package.json` scripts 与脚本头注释为准，改完命令同步本表。
