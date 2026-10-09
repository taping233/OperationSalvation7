# 《搜打撤》制作资料入口

这里汇集 Vite 项目的目标、设计、视觉、工程与验收方法，供人和 Agent 按任务查阅。已确认方向、候选方案和当前实现分别标注；实时进度从[项目状态入口](../STATUS.md)查询。

## 目录

| 领域 | 从哪里开始 | 主要用途 |
| --- | --- | --- |
| 项目目标 | [项目章程](project/CHARTER.md) | 为什么做、双目标、范围与取舍 |
| 游戏设计 | [玩法概览](design/GDD.md) | 玩家旅程、核心循环、系统关系与待核内容 |
| 美术与体验 | [Vite 视觉规范](art/VISUAL-BIBLE.md) | 已有风格锚点、组件状态、素材接入与实页复核 |
| 工程与数据 | [代码与数据工作流](engineering/CODE-DATA-WORKFLOW.md)、[后续制作者操作手册](engineering/MAKER-HANDBOOK.md) | 模块入口、Git/CI、数据真源、常见修改步骤与验证边界 |
| Agent 研究 | [实验复现约定](engineering/AGENT-EXPERIMENTS.md) | 在现有协议和手册上补齐实验元数据 |
| 迭代管理 | [迭代办法](management/ITERATION-BOARD.md)、[制作决策簿](management/DECISIONS.md)、[工程选题计划](management/NEXT-CYCLE-TECH-PLAN.md) | 任务选择方法、已确认决定与候选工作；执行状态查任务记录 |
| 质量与验收 | [整局与 Agent 验收模板](qa/ACCEPTANCE-MATRIX.md) | 场景选择与记录模板；每次实际结果保存到任务证据 |

## 现行资料与证据入口

| 问题 | 先看 |
| --- | --- |
| 当前代码与验证状态 | [STATUS](../STATUS.md)，随后实时 Git、相关源码与证据 |
| 玩家规则与数值 | [rules](../rules.md)及其代码真源；本目录 GDD 不重复维护数值 |
| 现行功能与待办 | [项目 README](../../README.md)、[roadmap](../roadmap.md)、[changelog](../changelog.md) |
| 卡牌数据与规格 | [卡牌规格入口](../cards/README.md)、[自动生成的游戏全书](../game-compendium.md)；生成文档勿手改 |
| 模块、开发与存档 | [architecture](../architecture.md)、[development](../development.md)、[save-format](../save-format.md) |
| 角色与素材 | [人设库](../character-bible/README.md)、[运行素材说明](../../game/assets/README.md)、[素材清单](../../game/assets/asset-manifest.json) |
| Agent 接口与策略方法 | [接口协议](../agent-protocol.md)、[策略迭代手册](../agent-iteration-playbook.md) |
| 历史报告和原始证据 | [文档导航](../README.md)、[归档](../archive/README.md)、[证据入口](../evidence/README.md) |

## 开发入口

日常路径见[流程指南](../WORKFLOW-TOOLS.md)，快速导航见[QUICKSTART](../QUICKSTART.md)。按目标读取本目录所需章程、GDD、视觉或工程资料；看板和历史报告不再提供第二套接手步骤与执行进度。

游戏规则、生成数据和存档格式在上表对应来源维护；本目录通过链接引用。
