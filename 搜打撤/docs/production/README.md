# 《搜打撤》制作资料入口

整理时间：2026-09-28。这里汇集 Vite 项目的制作决策、设计、视觉、工程、迭代与验收资料，供后续人类或 Agent 制作者按同一入口接手。本次新增目录采用索引和补充规范的方式；现有源码、素材、规则和历史证据仍在原路径。实时进度先查[项目状态入口](../STATUS.md)并核对 Git 工作区。

## 目录

| 领域 | 从哪里开始 | 主要用途 |
| --- | --- | --- |
| 项目目标 | [项目章程](project/CHARTER.md) | 为什么做、双目标、范围与取舍 |
| 游戏设计 | [活 GDD](design/GDD.md) | 玩家旅程、核心循环、系统关系与内容状态 |
| 美术与体验 | [Vite 视觉规范](art/VISUAL-BIBLE.md) | 已有风格锚点、组件状态、素材接入与实页复核 |
| 工程与数据 | [代码与数据工作流](engineering/CODE-DATA-WORKFLOW.md)、[后续制作者操作手册](engineering/MAKER-HANDBOOK.md) | 模块入口、Git/CI、数据真源、常见修改步骤与验证边界 |
| Agent 研究 | [实验复现约定](engineering/AGENT-EXPERIMENTS.md) | 在现有协议和手册上补齐实验元数据 |
| 迭代管理 | [当前看板](management/ITERATION-BOARD.md)、[制作决策簿](management/DECISIONS.md)、[下一轮技术计划](management/NEXT-CYCLE-TECH-PLAN.md) | 当前主问题、老板已定方向、候选技术轮 |
| 质量与验收 | [整局与 Agent 验收矩阵](qa/ACCEPTANCE-MATRIX.md) | 未来整局、恢复与配对实验的验收入口；当前未执行 |

## 权威资料仍在原路径

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

## 接手顺序

1. 查实时 Git 状态、最近提交和文件归属；历史报告只按记录时点使用。
2. 读本目录的章程、决策簿和看板，确定当前目标与暂缓范围。
3. 按任务读 GDD/视觉/工程/Agent 入口，随后进入现行规则、代码和测试。
4. 开工前写清负责人、涉及文件、完成标准与验证；结束时在自有记录中列证据和未核实项。

本目录是导航与工作规则，不是另一套运行时数据源。游戏规则、生成数据、存档格式和实际完成状态仍由各自的现行资料与代码决定。
