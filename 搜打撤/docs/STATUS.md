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

## 当前工作区与交付

当前主线为 Vite 工作区；HEAD、index 与未提交增量以实时 Git 为准。下表导航当前已接入的改动及其验证边界，不把某批历史通过结果视作整个工作树通过。

| 范围 | 当前入口与证据 |
| --- | --- |
| 源码结构与类型 | [源码导航](../game/src/README.md)、[架构](architecture.md)；全域类型与实例端口改造见[类型记录](evidence/2026-10-21-WF-types-full-1021/README.md) |
| 性能优化 | [首批移植](evidence/2026-10-21-WF-github-perf-integrate-1021/README.md)、[追加五项优化](evidence/2026-10-21-WF-cloud-perf-merge-1021/README.md)；均已接入，完成未提交，构建/实页/测试分别保留输入边界 |
| 战斗施放与公共控件 | [施放、牌堆与切栏](evidence/2026-10-21-WF-sts2-cast-ui-1021/README.md)、[公共控件与装备](evidence/2026-10-21-WF-public-controls-1021/README.md)；当前实现见架构，旧UI断言补齐及清账见[整理记录](evidence/2026-10-21-WF-project-tidy-1021/README.md) |
| 编辑、服务与候选 | [REGISTRY](PARALLEL-REGISTRY.md)分别记录源码编辑、保留服务、待验收美术和已释放成果；服务历史PID不能直接当作当前进程身份 |
| 待决策与后续工作 | [PENDING](PENDING.md)保留需老板拍板的事项；普通需求见[roadmap](roadmap.md) |
| 旧资源与便携包 | [清理后状态](CLEANUP-STATUS.md)只维护已执行清理的文件及旧交付包；不代表当前网页已打包或发布 |

## 较早交付记录

以下保留原报告时点和验证范围；原文中的“未提交”不作为今天仍未提交的判断，使用前核对Git及对应任务交付信息。

10-19清理后的文件可用性与当前保留EXE统一见[清理后状态](CLEANUP-STATUS.md)。旧资源、失败动画、临时解包目录和五份旧便携包已经按批准清单删除；历史交付记录中的旧路径不再作为当前下载入口。

10-18留言13项修复与代码/注释/文档同步见[本轮记录](evidence/2026-10-18-feedback-13/README.md)；定向260项通过，实页覆盖与全局类型/文档既有错误分列，未提交。

10-15冗余代码、被覆盖样式及完成改动落库见[清理与提交记录](evidence/2026-10-15-WF-code-clean-1015/README.md)；运行代码全量、CSS增量及工具提交门分别说明覆盖，保留原稿和其他在途会话的边界见该记录。

10-14台账整理与本地提交核对见[本轮记录](evidence/2026-10-14-WF-ledger-cleanup-1014/README.md)。执行记录中的stage保存原收官时点；新增delivery字段确认已在本地HEAD的交付提交。是否尚有改动仍以实时Git与REGISTRY为准，候选制作稿和实页缺口不因源码提交而完成。
