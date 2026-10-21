# Vite 文档导航

开发从 [QUICKSTART](QUICKSTART.md) 进入。本页按任务定位规范、计划与证据；操作步骤见[流程指南](WORKFLOW-TOOLS.md)。读取所需入口后，按相关源码、数据和测试核对实现。

## 资料类型与维护处

| 类型 | 内容与维护入口 | 使用条件 |
| --- | --- | --- |
| 项目规则 | 根 [AGENTS.md](../../AGENTS.md) | 开发范围、权限、协作与文档要求 |
| 现行规范 | 下方任务路由中的规则、架构、存档、开发、质量等文档 | 描述当前行为与约束；随对应实现更新 |
| 制作目标与方案 | [制作资料](production/README.md)、[路线图](roadmap.md)、[UI 提案](UI-TOKEN-SYSTEM-PROPOSAL.md) | 区分已确认目标、候选方案与待核实实现 |
| 状态与决策 | [STATUS](STATUS.md)、[REGISTRY](PARALLEL-REGISTRY.md)、[PENDING](PENDING.md) | 分别导航交付、记录占用归属、记录待决策事项 |
| 生成资料 | [游戏全书](game-compendium.md) | 查内容数据；通过生成器更新 |
| 历史与证据 | [archive](archive/README.md)、[evidence](evidence/README.md)、[模块记录](modules/README.md)、`nightshift/` | 有具体证据或经验缺口时查阅；只代表记录时点 |
| 工具与参考 | [工具箱](AGENT-TOOLBOX.md)、[界面美术指南](UI-ART-OVERHAUL-GUIDE.md)、[预览](previews/README.md) | 按任务选择能力或参考，核对其适用范围 |

## 双端工作流

Codex / ZCode 共用项目规则和事实，各自使用当前平台工具。项目边界见根 AGENTS.md，操作步骤见[流程指南](WORKFLOW-TOOLS.md)，能力入口见[工具箱](AGENT-TOOLBOX.md)。

### 事实分层与记忆入口

| 位置 | 职责与更新条件 |
| --- | --- |
| 两端全局 AGENTS.md | 老板偏好、授权边界、平台工具入口；项目细则引用本仓库 |
| 根 AGENTS.md | 项目范围、协作边界、文档要求与入口 |
| 本页 / WORKFLOW-TOOLS.md | 本页只导航；后者唯一维护日常流程和命令 |
| STATUS.md | 简短交付入口、证据、未核实项；HEAD/工作树以实时 Git 为准 |
| PARALLEL-REGISTRY.md | 唯一占用与归属记录；编辑/验收/完成未提交/已交付分开 |
| PENDING.md | 唯一待决策台账；backlog 归 roadmap，已决记录回写来源 |
| 平台记忆 | 稳定经验与历史依据；现行架构归 docs，热点/活账只放指针 |

当前资料不能回答问题时，再从[工具箱的记忆入口](AGENT-TOOLBOX.md#意图--工具)检索指定主题。历史经验使用前核对适用条件与当前实现。

## 按改动找文档

规范入口不明时按表定位；目标与适用规范已知就直接处理。带日期文档只说明当时时点，现行事实以源码与测试为准。

| 要改什么 | 先看（现行规范） | 再看（时点依据与证据） |
| --- | --- | --- |
| 找代码位置 / 模块职责 | [源码导航](../game/src/README.md)、[架构](architecture.md) | [当前工作区与交付](STATUS.md)；不要按历史文件名猜现行入口 |
| 战斗逻辑 / 数值 / 牌效 | [规则](rules.md)、[架构](architecture.md) | [质量门](quality-gates.md)（验收与全量口径） |
| 卡牌数据 / 规则文本 | [卡牌入口](cards/README.md)、[术语](terminology.md)，先核对运行卡库与解释器 | [迁移矩阵](M-BATCH-MATRIX.md)、[排除清单](M-BATCH-EXCLUSIONS.md)（测试固定路径）、[M 批结果](archive/card-migration-2026-09-27/README.md) |
| 存档 / 基地写入 | [存档契约](save-format.md) | [直写路径审计 09-29](BASE-DIRECT-WRITE-AUDIT-2026-09-29.md)（直写红线、保留簇与挂账） |
| 性能 | [性能方法与历史基准](performance.md) | [全场景账本 09-29](PERF-LEDGER-2026-09-29.md)（19 场景+热点清单+复跑命令） |
| 测试 / 验收门 | [质量门](quality-gates.md)、[开发指南](development.md) | [分层验收改造记录](archive/records-2026-09-28/ACCEPTANCE-FAST-GATE-RESULT-2026-09-28.md) |
| UI / 美术 / 素材 | [当前美术方向](production/art/ART-DIRECTION-BRIEF.md)、[视觉规范](production/art/VISUAL-BIBLE.md)、[人物参考](character-bible/README.md)、[运行素材说明](../game/assets/README.md) | [界面美术指南](UI-ART-OVERHAUL-GUIDE.md)、[页面验收覆盖](production/art/UI-PAGE-COVERAGE.md)、[预览页面](previews/README.md) |
| 音频 | [音频系统](audio-system.md) | — |
| Agent 接口 / 策略 | [接口协议](agent-protocol.md)、[策略迭代手册](agent-iteration-playbook.md) | — |
| 并行会话 / 派工 | [热点登记](PARALLEL-REGISTRY.md)、[待拍板台账](PENDING.md)、[派工手册](PARALLEL-DISPATCH-PLAYBOOK.md) | — |
| 工具怎么用（agent 视角） | [Agent 工具箱](AGENT-TOOLBOX.md)（意图→命令查表，含 impact/handoff/剧本/验证） | — |
| 新特性 / 制作目标 | [项目章程](production/project/CHARTER.md)、[玩法概览](production/design/GDD.md)、[路线图](roadmap.md) | [UI Token 提案](UI-TOKEN-SYSTEM-PROPOSAL.md)（候选方案）、[旧规格流程](archive/SPEC-PROCESS.md) |
| 叙事 / 事件 | [设计入口](design.md)、`narrative/events.ink` | [游戏全书](game-compendium.md)（生成物，不手改） |
| 文档编辑 / 归档 | 根 [文档规则](../../AGENTS.md#文档写作与维护)、[流程指南](WORKFLOW-TOOLS.md#归档与替代) | [09-28 归档审阅记录](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)（涉及该批次文件时核对） |
| 已删资源、旧包与临时目录在哪里 | [清理后文件与当前交付](CLEANUP-STATUS.md) | 各批精确清单、原始指纹和执行回执沿该入口查询；历史路径不代表当前可用 |

## 现行说明

| 用途 | 入口 |
| --- | --- |
| 玩法与设计 | [设计入口](design.md)、[现行规则](rules.md)、[术语](terminology.md)、[后续路线图](roadmap.md)、[版本记录](changelog.md) |
| 工程与质量 | [架构](architecture.md)、[开发指南](development.md)、[存档契约](save-format.md)、[质量门](quality-gates.md)、[性能方法与历史基准](performance.md)、[音频系统](audio-system.md) |
| Agent | [接口协议](agent-protocol.md)、[策略迭代手册](agent-iteration-playbook.md)、[工具箱](AGENT-TOOLBOX.md)（意图→命令查表） |
| 协作流程 | [日常流程](WORKFLOW-TOOLS.md)、[热点登记](PARALLEL-REGISTRY.md)、[待拍板台账](PENDING.md)、[并行派工手册](PARALLEL-DISPATCH-PLAYBOOK.md) |
| 美术与素材 | [人物参考](character-bible/README.md)、[界面美术指南入口](UI-ART-OVERHAUL-GUIDE.md)、[运行素材说明](../game/assets/README.md) |
| 生成数据手册 | [游戏全书](game-compendium.md)：由 `scripts/generate-compendium.mjs` 生成，保留原路径，不手改 |
| 卡牌规格 | [规格与决策入口](cards/README.md)；[迁移矩阵](M-BATCH-MATRIX.md)和[排除清单](M-BATCH-EXCLUSIONS.md)因测试固定路径留在根目录 |
| 制作交接 | [制作资料入口](production/README.md)：项目章程、活 GDD、视觉规范、后续制作者手册、迭代管理与验收矩阵 |

## 带时间的记录与证据

- 带日期记录只说明当时的工作树与验证边界，改完的现行事实以源码与测试为准。09-28 前后的状态快照在 [archive/status/](archive/status/)，其余单篇在 [archive/records-2026-09-28/](archive/records-2026-09-28/)；[归档总览](archive/README.md)保存已执行批次的计划、结果和审查，不把批次结果当作现行规则。移动或删除前复核文件归属与引用（[归档审阅与执行记录](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)）。
- [验收证据](evidence/README.md)保存报告和测试引用的数据；[预览页面](previews/README.md)含验收宿主与旧设计比较；[模块交付资料](modules/README.md)与各专题归档（三线原始记录、实验构建精简、项目概览快照）从 [归档总览](archive/README.md) 查阅；三线原始资料目录未包含在当前恢复快照中。
