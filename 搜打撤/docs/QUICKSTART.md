# QUICKSTART：搜打撤开发入口

本页只指路。日常路径为 **按目标 → 主动作 → 定向反馈 → 按授权收官**，完整办法只在 [WORKFLOW-TOOLS](WORKFLOW-TOOLS.md) 维护；权限与项目边界见根 AGENTS.md。

| 当前需要 | 最短入口 |
| --- | --- |
| 单问、小改 | 直接答或处理目标，读取相关资料、验证相关范围 |
| 跨域、长任务、接班或改根规则 | 在 `搜打撤` 运行 `npm run handoff`，核对相关改动与占用；路径限定见[流程指南](WORKFLOW-TOOLS.md#按目标) |
| 修改共享文件 | 核对相关占用，按[登记条件](WORKFLOW-TOOLS.md#登记与豁免)维护本会话记录 |
| 找某块的规范与代码入口 | [文档导航·按改动找文档](README.md#按改动找文档) |
| 选测试与保留证据 | [流程指南·定向反馈](WORKFLOW-TOOLS.md#定向反馈)、[质量门](quality-gates.md) |
| 收官或老板已授权提交 | [流程指南·按授权收官](WORKFLOW-TOOLS.md#按授权收官) |
| 复制普通小修或混树提交示例 | [两条操作路径](WORKFLOW-TOOLS.md#两条操作路径)，跨会话 task 模板按需取用 |
| 并行派工 | [派工手册](PARALLEL-DISPATCH-PLAYBOOK.md) |
| 查看工具能力、查指定历史经验 | [Agent 工具箱](AGENT-TOOLBOX.md)；`npm run --silent workflow -- memory --source codex --query "关键词" --limit 3 --json`（Codex 默认 codex，ZCode 用 zcode；跨端经验才选 both） |

新机器才核对环境：Node 22、现有依赖与锁文件，以及 `git config core.hooksPath` 是否指向 `搜打撤/.githooks`。缺失项按任务授权补齐；命令示例不授权安装或改 Git 配置。不要每轮重做环境初始化。

交付列实际检查、结果与未核项；不同检查的覆盖边界见[质量门](quality-gates.md#ci-状态)。
