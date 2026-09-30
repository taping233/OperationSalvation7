# 流程工具与归档办法

文档状态：现行规范。2026-09-30 老板授权执行信息同步、台账与验收工具，并防重复建设、建立归档方式。本轮授权已进入工具实施阶段；[双端工作流](README.md#双端工作流)中上一轮“本轮不改脚本”描述仅适用于其原文档规范化任务。两端共用这里的项目脚本，无全局安装或新依赖。

## 信息各归一处

| 信息 | 唯一维护处 | 其他入口如何使用 |
| --- | --- | --- |
| 某任务的目标、负责人、步骤、执行状态 | 大任务规格内的任务清单；小任务自有交付记录 | 简报只给指针，不另建同一任务看板 |
| 文件/服务/工作树的占用与未提交归属 | [REGISTRY](PARALLEL-REGISTRY.md) | 接手工具只读汇总；关闭行仍保留未提交归属 |
| 必须老板决定的事项 | [PENDING](PENDING.md) | 其他文档引用编号；已授权事项不重复挂账 |
| 后续候选目标 | [roadmap](roadmap.md) | 不当作正在执行的任务 |
| 验收证据 | `docs/evidence/<日期>-<任务>/` | STATUS、任务记录引用证据，不复制测试数字成当前结论 |
| 历史经验与被替代原文 | 平台记忆 / `docs/archive/` | 显式历史检索，不作为当前许可或状态 |

## 开工先复用

在 `搜打撤/` 下运行；脚本也可用绝对路径从其他目录运行。

```powershell
npm run handoff
node scripts/workflow.mjs status --json
node scripts/workflow.mjs find --query handoff
node scripts/workflow.mjs find --query handoff --history
node scripts/workflow.mjs archive plan
```

现行检索覆盖 scripts/tests/game/src、docs 根与 production，历史须明确 `--history`；每次最多显示 20 个命中并给总数。新增工具/规范前在任务方案写明已有入口、复用内容和缺口。接手提示检测重复编号、可能重叠路径及提交引用，不自动判定过期或释放占用；未 fetch 的远端、留言、实页仍分别核验。

## 台账安全更新

继续直接维护原 Markdown 台账，未新增数据库/第二份台账。`list` 返回原文 SHA256；`add/update/close` 默认预览，`--apply --expect` 才写入。registry 工具行用稳定 `WF-` 编号，负责人格式 `Friday（任务说明 WF-编号）`；历史无编号行保留原样，需按项目归属规则人工处理，不批量改名。

```powershell
node scripts/workflow.mjs ledger registry list --json
node scripts/workflow.mjs ledger registry update --key WF-workflow-tools --owner Friday --input docs/evidence/2026-09-30-workflow-tools/registry-update.json
# 核对预览后，用预览的 expectedSha256 代入；不使用此处占位值执行
node scripts/workflow.mjs ledger registry update --key WF-workflow-tools --owner Friday --input docs/evidence/2026-09-30-workflow-tools/registry-update.json --apply --expect <预览SHA256>
```

输入 JSON 为 `{"cells":["第一列","第二列","第三列","第四列","第五列"]}`，不接受必填列为空、竖线或换行；pending 第五列备注可空。活跃 registry 五列、close 四列；pending 五列，关闭记录保留编号、决定、来源和后续入口。申请新编号前 list；重复编号拒绝。台账修订变化则拒写；合作工具使用独占临时锁。普通编辑器不遵循工具锁，仍必须先确认归属并停止同时编辑；不声称能解决所有外部编辑竞争。

## 自动记录验收

```powershell
node scripts/workflow.mjs verify --task workflow-tools --tests tests/workflow-tools.test.js,tests/docs-consistency.test.js --plan
node scripts/workflow.mjs verify --task workflow-tools --tests tests/workflow-tools.test.js,tests/docs-consistency.test.js
node scripts/workflow.mjs verify --task workflow-tools --paths scripts/handoff-brief.mjs --plan
# --full 复用现有完整本地门，不运行 build，也不包含实页
node scripts/workflow.mjs verify --task workflow-tools --full
# 仅完整测试套件；不替代上面的静态门，也不隐式运行 npm pretest
node scripts/workflow.mjs verify --task workflow-tools --suite
node scripts/workflow.mjs evidence --input docs/evidence/2026-09-30-workflow-tools/<报告文件>.json
```

显式定向列表由负责人按质量门选择；`--paths` 交现有 acceptance-gate 选择。自动保存命令、日志哈希、退出码/信号、HEAD、工作区状态、执行前后文件指纹及 Node/工具版本。失败与中断不会成为可复用候选；检查过程中指纹变化也会标记。文档变化不因 HEAD 改变而一律重验。

指纹覆盖 game/src、game/data、game/css、game/tools、game 顶层 HTML/JS/JSON、tests、scripts、narrative 和项目配置（含七份 jsconfig）。完整门、完整套件、按路径选择及 docs-consistency 定向报告还记录现行文档/归档原文；文档检查依赖变化也会使证据失效。未监控图片/声音、依赖目录全部字节、所有环境变量或浏览器。匹配仅为候选，仍需确认测试范围、依赖与环境。报告不代替真实输入/hover、玩家存档、生产构建或远端 CI。实页证据按下方统一入口导入并由负责人核实，不自动驱动外部浏览器。

所有命令支持 `--json`：成功为一个 `{"ok":true,...}` 对象，参数/执行错误为 `{"ok":false,"error":"..."}` 且非零退出；验收命令失败仍输出报告路径和 exitCode（CLI 退出非零）。JSON 模式运行日志走 stderr，便于流水线读取 stdout。工具不会提交、推送、发布、启服或自动 build。

## 内置浏览器证据

由当前平台内置工具采集；Node CLI 不启动浏览器。`scripts/workflow-browser.mjs` 的 collectBrowserSnapshot 是自包含只读 DOM/计算样式函数，可作为当次已授权 evaluate 的函数体；参数见模块注释与[实际采集证据](evidence/2026-09-30-workflow-completion/README.md)。只取明确 selectors，记录当前 origin/pathname/viewport、场景、操作类型、console 覆盖和截图引用，不读存档或全 localStorage。

```powershell
npm run workflow -- browser import --input <内置采集JSON> --task <任务编号>
npm run workflow -- browser compare --before <前快照JSON> --after <后快照JSON> --task <任务编号>
npm run page-snapshot -- --help
```

旧 page-snapshot 命令现在仅支持同一导入/对比入口，旧外部驱动已归档。平台/输入类型是采集者声明，schema 不能独立证明来源；须沿工具记录核验。相同节点按稳定身份配对，同名歧义、缺节点或不同窗口条件记 inconclusive；equal 仅证明所选字段一致。真实输入、合成事件、hover inputKind、截图、静态样式各自保留，不互相替代。

## 动态记忆发现

```powershell
npm run memory:discover -- --json
npm run workflow -- memory --home <用户目录> --json
```

从当前 CODEX_HOME/用户目录确定候选根；Codex 只读 summary/MEMORY 索引，ZCode 只读有界项目索引和标识，按当前仓库完整路径匹配，不猜目录哈希。多个匹配、截断、不可读或扫描超限都留待人工核对；旧 ZCode 库仅标历史。返回路径和匹配依据，不输出主题正文，不自动注入记忆、不修改全局配置。

## 混树暂存隔离

```powershell
npm run check:staged:isolate -- --plan --json
npm run check:staged:isolate -- --json
```

冻结真实 Git index，按已冻结对象 ID 导出原始文件到本次创建的 temp；未暂存配置、未跟踪文件及工作树内容不会混入。暂存 package/lock 与已安装依赖证明不符时阻断，不自动安装；依赖独立复制，避免缓存写回共享 node_modules。调用快照中的现有验收门，删除/重命名强制全量；纯说明或无暂存标 skip，不能当已验。

前后 index 变化、命令失败/中断、检查改写暂存文件均拒绝通过；只清理经过路径校验的自有 temp。报告与日志回本任务证据目录，不提交、不 build，也不绕过原钩子的保守拒绝。当前真实仓库无暂存内容，隔离执行通过证据来自受控 fixture，而不是伪造真实提交。

## 现行文档核对

```powershell
npm run docs:check -- --json
```

检查现行 docs 根、production、项目入口与根规则，输出 scannedFiles、相对链接、逐字重复和明确旧规则疑点；跳过历史/证据/模块/预览及代码块，带日期的历史段仅提示。不会判定全部语义重复，也不会自动合并、搬移或删除；负责人核对候选后再留档修正。

## 归档与替代

归档以“职责结束/被明确替代”为条件，mtime 与模式命中只作候选。`archive plan` 搜现行根层和 production 的同正文/固定措辞；它不自动判定语义冲突，引用结果不是全项目零引用证明。

```powershell
node scripts/workflow.mjs archive snapshot --task <日期主题批次> --paths docs/<明确文档>.md --replaced-by docs/<现行入口>.md
```

1. 明确源路径、归属、尚未完成事项的现行去向；核对脚本、测试、历史与相对链接。固定路径测试数据、预览宿主、运行素材不按旧文档处理。
2. 修改现行文档前复制原文字节入 `docs/archive/<批次>/originals/`，manifest 记录时间、源路径、目标路径、SHA256、替代入口；不得覆盖既有归档。
3. 批次 README 标明“历史快照，不再作为现行规则”，列每项替代关系。原文内部相对路径按源位置解释，避免为了可点击而改掉原始证据。
4. 现行文件保留其职责；旧执行记录转为历史入口，更新现行索引/链接。只归档已确认过时的表述，不推定旧任务已经完成，不吞掉遗留。
5. 文件实际移动/删除另按根 AGENTS.md 与[归档审阅](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)核对并获授权；本工具只复制，不移动/删除源。

第一批替代关系见[归档索引](archive/workflow-2026-09-30/README.md)，原文路由与旧浏览器驱动的后续替代见[补完归档](archive/workflow-completion-2026-09-30/README.md)。当前实施与完整验收见[补完任务证据](evidence/2026-09-30-workflow-completion/README.md)，[第一批任务证据](evidence/2026-09-30-workflow-tools/README.md)保留当时时点。
