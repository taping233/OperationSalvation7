# 流程减负设计依据

执行阶段、完成标准和验证指针只维护在[task.json](task.json)，本页保留设计依据，不重复记进度。基线HEAD fd38468；本轮不build、不提交。

日常裁剪为定任务、改动、相关验证、收官。小修不强制建任务文件；跨会话/长任务用唯一记录，资源与决策仍各归原台账。STATUS只导航，摘要由工具按任务生成。

## 参考与取舍

- [Unity任务工作流](https://unity.com/how-to/devops-task-branch-workflow)强调短小、独立任务与评审/验证。本项目保留可追溯任务和集成，不照搬每任务新分支、自动提交或部署。
- [Epic自动化测试分类](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine)区分快速、功能与压力测试。本项目已有Vitest/质量门，复用直接契约作日常反馈，未知脚本与公共边界保守全量；不引入新引擎或工具栈。

## 三项验收场景

1. 台账/任务状态改变，稳定代码报告仍可作代码候选，只提示廉价状态核对；代码或环境改变、失败/中断仍失效。
2. 任务只更新一个小JSON，只读摘要随之变化；不重写STATUS、制作看板或记忆。
3. 同一现场按lean-workflow接手只列相关变更，明确省略数量；未知任务不回退猜测。

修改前原文见[归档](../../archive/lean-workflow-2026-09-30/README.md)。正文没有新建第二份执行台账；所有新发现另列候选，达到上述标准就收官。
