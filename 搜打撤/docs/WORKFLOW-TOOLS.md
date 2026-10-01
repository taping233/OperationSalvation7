# 日常开发流程

现行规范，2026-09-30 减负版。当前只开发搜打撤 Vite；授权、属地与当前平台内置浏览器边界沿用根 AGENTS。日常按四步走：**定任务 → 做改动 → 验相关范围 → 收官**。

## 信息只维护一次

| 内容 | 维护处 |
| --- | --- |
| 任务目标、负责人、涉及路径、完成标准、执行状态、检查指针 | `docs/evidence/<日期>-<任务>/task.json` |
| 资源占用与未提交归属 | [REGISTRY](PARALLEL-REGISTRY.md)：开工、释放时各登记一次，进度用任务指针 |
| 老板尚需拍板的事项 | [PENDING](PENDING.md)；已经授权的不重复挂账 |
| 未来候选 | [roadmap](roadmap.md) |
| 规则/契约/设计决策 | 对应现行规范；复杂改动才补[规格](SPEC-PROCESS.md) |
| 历史与原始证据 | `docs/archive/`、任务证据目录；不抄入当前状态 |

STATUS 和接手简报只生成/引用摘要。spec保留需求、方案、拆分，不再同时维护执行进度；旧任务记录保留原位，不批量迁移或补造task.json。

## 定任务

主动作先行（10-01 精简）：Git/属地核对并入 `npm run handoff` 一条命令，按任务路由查已有实现不阻塞启动。小修用本次目标、Git差异与交付说明即可，不强制创建task.json；单问与说明小修沿原免登规则。共享文件或长任务动作先行、登记同轮紧随；需要跨会话跟踪时才创建持久任务。输入JSON只需goal、paths、doneWhen，默认planned；明确开工填doing。

```powershell
npm run --silent workflow -- task start --task <编号> --owner Friday --input <任务输入JSON> --json
# 确认预览后追加 --apply --expect absent；单会话无争用可一步 --apply --expect auto（R4，10-01 起：
# 写前自动复核基线+锁内互斥，他人插手即拒；多会话争用时仍用显式 SHA 两段式）
npm run --silent handoff -- --task <编号>
```

完成标准是可观察结果。目标明确的小修直接实施；玩法新规则、存档契约或跨域接口不明确时，用一页规格补齐决定，再开工。

## 做改动

只改任务范围；并行任务不交叉，主会话负责集成。进度变化只更新task.json，更新与关闭需预览时的SHA256；不逐步回写STATUS、制作看板或记忆。

```powershell
npm run --silent workflow -- task update --task <编号> --owner Friday --input <补丁JSON> --json
# 确认预览后追加 --apply --expect <预览SHA256>
npm run --silent workflow -- status --paths scripts/workflow-task.mjs
```

定向接手明确省略数量；看全局问题时不用过滤，详情用--json。记忆按需 `npm run --silent memory:discover -- --json`，只读索引，不自动注入正文。

## 验相关范围

| 改动 | 日常反馈 | 集成出口 |
| --- | --- | --- |
| 工程说明、状态、归档导航 | docs:check，必要时文档守卫 | 不跑游戏全量/build |
| 有直接测试的代码/流程脚本 | 相关测试与现有门选择 | 公共边界/阶段收尾按质量门完整验收 |
| 玩家可见变化 | 当前平台内置浏览器、当前窗口真实路径 | 按[质量门](quality-gates.md)保存实际证据 |
| 数据 / 剧情 / fixture / 纯删除 | 依赖图或引用定向（提交门自动选择） | 复用有效结果，范围或源码/环境改变再验 |
| 包配置、未知脚本、公共状态/存档边界 | 保守回退完整检查（全量以 CI 为准） | 复用有效结果，范围或源码/环境改变再验 |

```powershell
npm run --silent workflow -- verify --task <编号> --paths <逗号分隔项目路径> --plan
npm run --silent workflow -- verify --task <编号> --tests <逗号分隔测试路径>
npm run --silent docs:check -- --json
npm run --silent workflow -- evidence --input <自动报告JSON> --json
```

路径分隔口径（R6，10-01 起）：`workflow verify` 的 `--tests/--paths` 用逗号；`check:staged:plan` 直跑 `acceptance-gate.mjs --paths` 空格与逗号均接受。

自动报告分代码、文档、任务状态、环境。台账变化只提示便宜的状态/链接核对；规则文档变化保留代码候选，补文档检查；代码或环境变化、失败、中断、检查期间代码变化仍使代码证据失效。候选不代替负责人对范围和真实行为的判断。

定向报告保存测试与关联静态输入的依赖闭包，复核沿原roots重算；不相关的音效源码不牵连流程测试。动态import、未知进程/文件输入无法证明时保守回退项目范围；full/suite保持项目范围。报告明确validation.mode/executed与outcome，skip不是passed；收官按本地/隔离报告各自的指纹、index、依赖和快照完整性契约核验。

混树准备提交内容用 `npm run --silent check:staged:isolate -- --plan --json`，确认后运行；只验证冻结index，依赖不符拒绝，不混入工作树。内置浏览器采集函数在 `scripts/workflow-browser.mjs`；通过 workflow browser import/compare 导入与比较，旧page-snapshot命令只作同一安全入口，不启动外部浏览器。

## 收官

对doneWhen逐项确认，在关闭输入里给终态 complete-uncommitted 或 partial、checks、unverified；完成须 doneWhenConfirmed:true。报告检查指针会核对退出码和运行稳定性，手工检查明确标manual。

```powershell
npm run --silent workflow -- task close --task <编号> --owner Friday --input <收官JSON> --json
# 确认预览后追加 --apply --expect <预览SHA256>
npm run --silent workflow -- task summary --task <编号> --json
```

只释放自有资源登记，任务记录与验收指针保留；提交/推送/发布仍需明确授权。达到完成标准就收官，新发现另列候选或真正待决策，不继续扩大本任务。打包提交默认（10-01）：老板授权提交时，受理会话打包落库全部完成未提交改动并代写缺失文档证据，排除 PENDING 待拍板目录与 `.sfx-work/` 类中间文件；受理前盘点并核对验证基线。

## 归档与替代

规则被明确替代、执行批次结束或现行入口误导接手时才归档；小修不每次复制一套原文。已提交历史可引用精确版本；未提交原文需要保留时用 archive snapshot，不覆盖旧档。现行规范只保留有效办法，日期报告保留来源与未核项；实际移动/删除仍沿项目授权规则。

本项目裁剪参考[Unity短任务与评审流程](https://unity.com/how-to/devops-task-branch-workflow)和[Epic快速/功能/压力测试分类](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine)：保留短反馈与集成验证，具体门槛按本项目质量门，不照搬引擎工具。修改前原文见[减负归档](archive/lean-workflow-2026-09-30/README.md)，本轮唯一执行记录见[task.json](evidence/2026-09-30-lean-workflow/task.json)。
