# 项目状态入口

本页只做导航，不维护第二份进度或复制测试数字。当前事实用实时 Git 与任务记录核对。

```powershell
npm run handoff -- --task <任务编号>
npm run workflow -- task summary --json
npm run workflow -- task read --task <任务编号> --json
```

- 当前任务执行状态与验收指针：`docs/evidence/<日期>-<任务>/task.json`。
- 文件/服务/工作树占用：[REGISTRY](PARALLEL-REGISTRY.md)；老板待拍板：[PENDING](PENDING.md)。
- 日常四步与工具入口：[流程指南](WORKFLOW-TOOLS.md)；改动对应资料：[文档路由](README.md)。
- 后续候选：[roadmap](roadmap.md)；制作目标：[项目章程](production/project/CHARTER.md)。
- 旧状态原文与各轮验收保留在[历史索引](archive/lean-workflow-2026-09-30/README.md)，只证明各自时点，不回填为新任务进度。
