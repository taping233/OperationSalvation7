# 项目状态入口

本页按问题指向状态来源。先查询相关任务或路径，再读对应记录；占用、待决策与历史各有入口。

```powershell
npm run handoff -- --task <任务编号>
npm run workflow -- status --paths <相关路径1,相关路径2> --json
npm run workflow -- task summary --json
npm run workflow -- task read --task <任务编号> --date <YYYY-MM-DD> --json
```

- 当前任务执行状态与验收指针：`docs/evidence/<日期>-<任务>/task.json`。
- 文件/服务/工作树占用：[REGISTRY](PARALLEL-REGISTRY.md)；老板待拍板：[PENDING](PENDING.md)。
- 日常四步与工具入口：[流程指南](WORKFLOW-TOOLS.md)；改动对应资料：[文档路由](README.md)。
- 后续候选：[roadmap](roadmap.md)；制作目标：[项目章程](production/project/CHARTER.md)。
- 文档系统整理：[首轮记录](evidence/2026-10-09-WF-doc-system-1009/README.md)、[后续核对与工具修复](evidence/2026-10-09-WF-doc-system-followup-1009/README.md)。任务汇总中的 `skipped` 表示旧格式或无效记录，原文仍保留，实际状态须查对应证据。
- 美术、人设、术语与图鉴整理：[接手与生成验证](evidence/2026-10-09-WF-doc-system-art-cards-1009/README.md)。
- 旧状态原文与各轮验收保留在[历史索引](archive/lean-workflow-2026-09-30/README.md)，只证明各自时点，不回填为新任务进度。

## 当前交付核对

10-18留言13项修复与代码/注释/文档同步见[本轮记录](evidence/2026-10-18-feedback-13/README.md)；定向260项通过，实页覆盖与全局类型/文档既有错误分列，未提交。

10-15冗余代码、被覆盖样式及完成改动落库见[清理与提交记录](evidence/2026-10-15-WF-code-clean-1015/README.md)；运行代码全量、CSS增量及工具提交门分别说明覆盖，保留原稿和其他在途会话的边界见该记录。

10-14台账整理与本地提交核对见[本轮记录](evidence/2026-10-14-WF-ledger-cleanup-1014/README.md)。执行记录中的stage保存原收官时点；新增delivery字段确认已在本地HEAD的交付提交。是否尚有改动仍以实时Git与REGISTRY为准，候选制作稿和实页缺口不因源码提交而完成。
