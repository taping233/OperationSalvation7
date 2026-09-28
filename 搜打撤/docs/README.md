# Vite 文档导航

本目录同时保存现行说明、带时间的工作记录、测试证据和设计预览。接手开发先读[项目入口](../README.md)与[状态入口](STATUS.md)，再核对实时 `git status --short` 与 `git log -1`；带日期的记录只说明当时的工作树与验证边界。

## 现行说明

| 用途 | 入口 |
| --- | --- |
| 玩法与设计 | [设计入口](design.md)、[现行规则](rules.md)、[术语](terminology.md)、[后续路线图](roadmap.md)、[版本记录](changelog.md) |
| 工程与质量 | [架构](architecture.md)、[开发指南](development.md)、[存档契约](save-format.md)、[质量门](quality-gates.md)、[性能方法与历史基准](performance.md)、[音频系统](audio-system.md) |
| Agent | [接口协议](agent-protocol.md)、[策略迭代手册](agent-iteration-playbook.md) |
| 美术与素材 | [人物参考](character-bible/README.md)、[界面美术指南入口](UI-ART-OVERHAUL-GUIDE.md)、[运行素材说明](../game/assets/README.md) |
| 生成数据手册 | [游戏全书](game-compendium.md)：由 `scripts/generate-compendium.mjs` 生成，保留原路径，不手改 |
| 卡牌规格 | [规格与决策入口](cards/README.md)；[迁移矩阵](M-BATCH-MATRIX.md)和[排除清单](M-BATCH-EXCLUSIONS.md)因测试固定路径留在根目录 |
| 制作交接 | [制作资料入口](production/README.md)：项目章程、活 GDD、视觉规范、后续制作者手册、迭代管理与验收矩阵 |

## 带时间的记录与证据

- [重构执行记录](REFACTOR-2026-09-28.md)、[09-28 项目记忆](PROJECT-MEMORY-2026-09-28.md)、[09-27 项目状态](PROJECT-STATUS-2026-09-27.md)是不同时间的快照；标题中的“当前”以记录时间为准。这两份项目快照仍被其他在途文件引用，暂留根目录。
- [归档总览](archive/README.md)和[模块交付资料](modules/README.md)保存已执行批次的计划、结果和审查；工程 E1–E8 与 M 批结果已各成组归档，不把批次结果当作现行规则。
- [验收证据](evidence/README.md)保存报告和测试引用的数据；[预览页面](previews/README.md)含验收宿主与旧设计比较；[三线原始记录](archive/three-track-2026-09-27/)保留原报告与截图。
- [归档审阅与执行记录](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)记录迁移、固定路径和待处理临时资料。移动或删除前复核文件归属与引用。
- [项目文件夹与未提交现场盘点](PROJECT-FOLDER-INVENTORY-2026-09-28.md)记录 Vite 各层目录、生成物、重复内容和并行归属；`output/` 的 250 个实验目录见[逐项快照](evidence/agent-output-inventory-2026-09-28.tsv)。
- [09-28 实验构建精简记录](BUILD-OUTPUT-CLEANUP-2026-09-28.md)列明五个已结题产物的原路径、本机去重归档、校验与恢复方式。
- [09-28 项目概览页面](PROJECT-OVERVIEW-2026-09-28.html)和[静态图](OVERVIEW-2026-09-28.png)是该时点的视觉快照，数据以实时状态入口为准。
