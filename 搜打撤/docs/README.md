# Vite 文档导航

本目录同时保存现行说明、带时间的工作记录、测试证据和设计预览。接手开发先读[项目入口](../README.md)与[状态入口](STATUS.md)，再核对实时 `git status --short` 与 `git log -1`；带日期的记录只说明当时的工作树与验证边界。

制作目标与执行入口见[制作资料总览](production/README.md)；最新全场景性能账本见 [PERF-LEDGER-2026-09-29](PERF-LEDGER-2026-09-29.md)，存档直写红线见 [BASE-DIRECT-WRITE-AUDIT-2026-09-29](BASE-DIRECT-WRITE-AUDIT-2026-09-29.md)。

## 按改动找文档

改任何一块之前，先按这张表找到该看的文档；带日期文档只说明当时时点，改完的现行事实以源码与测试为准。

| 要改什么 | 先看（现行规范） | 再看（时点依据与证据） |
| --- | --- | --- |
| 战斗逻辑 / 数值 / 牌效 | [规则](rules.md)、[架构](architecture.md) | [质量门](quality-gates.md)（验收与全量口径） |
| 卡牌数据 / 规则文本 | [卡牌规格入口](cards/README.md)、[迁移矩阵](M-BATCH-MATRIX.md)、[排除清单](M-BATCH-EXCLUSIONS.md)（后两份测试固定路径，不改名不手改结构） | [M 批结果索引](archive/card-migration-2026-09-27/README.md) |
| 存档 / 基地写入 | [存档契约](save-format.md) | [直写路径审计 09-29](BASE-DIRECT-WRITE-AUDIT-2026-09-29.md)（直写红线、保留簇与挂账） |
| 性能 | [性能方法与历史基准](performance.md) | [全场景账本 09-29](PERF-LEDGER-2026-09-29.md)（19 场景+热点清单+复跑命令） |
| 测试 / 验收门 | [质量门](quality-gates.md)、[开发指南](development.md) | [分层验收改造记录](archive/records-2026-09-28/ACCEPTANCE-FAST-GATE-RESULT-2026-09-28.md) |
| UI / 美术 / 素材 | [人物参考](character-bible/README.md)、[界面美术指南入口](UI-ART-OVERHAUL-GUIDE.md)、[运行素材说明](../game/assets/README.md) | [验收截图](evidence/game-shots/)、[预览页面](previews/README.md) |
| 音频 | [音频系统](audio-system.md) | — |
| Agent 接口 / 策略 | [接口协议](agent-protocol.md)、[策略迭代手册](agent-iteration-playbook.md) | — |
| 并行会话 / 派工 | [热点登记](PARALLEL-REGISTRY.md)、[待拍板台账](PENDING.md)、[派工手册](PARALLEL-DISPATCH-PLAYBOOK.md) | — |
| 叙事 / 事件 | [设计入口](design.md)、`narrative/events.ink` | [游戏全书](game-compendium.md)（生成物，不手改） |
| 文档增删 / 归档 | [状态入口](STATUS.md) | [归档审阅与执行记录](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)（移动或删除前必读） |

## 现行说明

| 用途 | 入口 |
| --- | --- |
| 玩法与设计 | [设计入口](design.md)、[现行规则](rules.md)、[术语](terminology.md)、[后续路线图](roadmap.md)、[版本记录](changelog.md) |
| 工程与质量 | [架构](architecture.md)、[开发指南](development.md)、[存档契约](save-format.md)、[质量门](quality-gates.md)、[性能方法与历史基准](performance.md)、[音频系统](audio-system.md) |
| Agent | [接口协议](agent-protocol.md)、[策略迭代手册](agent-iteration-playbook.md) |
| 协作流程 | [热点登记](PARALLEL-REGISTRY.md)（改共享文件/长任务先登记）、[待拍板台账](PENDING.md)（挂账唯一真源）、[并行派工手册](PARALLEL-DISPATCH-PLAYBOOK.md) |
| 美术与素材 | [人物参考](character-bible/README.md)、[界面美术指南入口](UI-ART-OVERHAUL-GUIDE.md)、[运行素材说明](../game/assets/README.md) |
| 生成数据手册 | [游戏全书](game-compendium.md)：由 `scripts/generate-compendium.mjs` 生成，保留原路径，不手改 |
| 卡牌规格 | [规格与决策入口](cards/README.md)；[迁移矩阵](M-BATCH-MATRIX.md)和[排除清单](M-BATCH-EXCLUSIONS.md)因测试固定路径留在根目录 |
| 制作交接 | [制作资料入口](production/README.md)：项目章程、活 GDD、视觉规范、后续制作者手册、迭代管理与验收矩阵 |

## 带时间的记录与证据

- 09-28 前后的带日期记录已各成组归档：状态快照在 [archive/status/](archive/status/)，其余单篇在 [archive/records-2026-09-28/](archive/records-2026-09-28/)（含[重构执行记录](archive/records-2026-09-28/REFACTOR-2026-09-28.md)）；标题中的“当前”以记录时间为准。
- [归档总览](archive/README.md)和[模块交付资料](modules/README.md)保存已执行批次的计划、结果和审查；工程 E1–E8 与 M 批结果已各成组归档，不把批次结果当作现行规则。
- [验收证据](evidence/README.md)保存报告和测试引用的数据；[预览页面](previews/README.md)含验收宿主与旧设计比较；[三线原始记录](archive/three-track-2026-09-27/)保留原报告与截图。
- [归档审阅与执行记录](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)记录迁移、固定路径和待处理临时资料。移动或删除前复核文件归属与引用。
- [项目文件夹与未提交现场盘点](archive/records-2026-09-28/PROJECT-FOLDER-INVENTORY-2026-09-28.md)记录 Vite 各层目录、生成物、重复内容和并行归属；`output/` 的 250 个实验目录见[逐项快照](evidence/agent-output-inventory-2026-09-28.tsv)。
- [09-28 实验构建精简记录](archive/records-2026-09-28/BUILD-OUTPUT-CLEANUP-2026-09-28.md)列明五个已结题产物的原路径、本机去重归档、校验与恢复方式。
- [09-28 项目概览页面](archive/records-2026-09-28/PROJECT-OVERVIEW-2026-09-28.html)和[静态图](archive/records-2026-09-28/OVERVIEW-2026-09-28.png)是该时点的视觉快照，数据以实时状态入口为准。
