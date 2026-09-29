# 项目状态入口

核对时点：2026-09-29 14:43（Asia/Shanghai）。本页用于找到实时状态和证据；每次接手先在工作区重新运行 `git status --short`、`git log -1`。

## 本次核对

- 范围是 `搜打撤` Vite；Godot、Unity、EXE 线冻结。`package.json` 当前版本为 0.60.0，版本号本身不代表发布或完整验收。
- 本地 `master` HEAD 为 `9e5a4ad`（2026-09-29 验收提速）；相对本地 `origin/master` 引用无 ahead/behind，未 fetch，服务器实时状态未核实。工作树无已跟踪文件改动，未跟踪项见下条。
- 09-28 深夜至 09-29 的批次已全部落库并推送，提交链为 `1b7504d`/`a6225b6`/`0dd41fc`/`94f50ce`（战斗模块治理：90 字段守卫、五目录分层、engine 瘦身、effects 收敛、turbo 归 core）→ `0959124`（cards 回填机制收敛 + 花瓣法阵 heal:3，并入夜班三线产物）→ `9e5a4ad`（全量测试默认并行，304s→约 55s）。各批次验收结论以提交信息与当时记录为准，本页未重跑全量。
- 全量 `npx vitest run` 自 09-29 起默认并行，旧「必须 `--no-file-parallelism`」的硬规则作废；收尾落库前或改公共架构才跑全量的口径不变。
- 09-28 归档审计的后续（均经老板批准）：`.ui-loop-0926/` 已瘦身，顶层 11 份报告迁入[循环报告目录](archive/ui-loop-2026-09-26/)留底；`.perf-wt-b/` worktree（`47001e3` 已并入 master）与 `.cards-consolidation-2026-09-29.patch` 已删。明细见[审计执行记录 §10](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)；`.ui-art-loop-0925/`、`game/shots/`、`.codex/`、`AGENTS.md.bak-*` 仍按审计裁决保留。
- 长期计划夜班（09-29→30 晨，截止 09-30 09:00）B 性能账本、C 存档收敛在途；B 线账本见 [PERF-LEDGER-2026-09-29.md](PERF-LEDGER-2026-09-29.md)，各线状态以各自会话记录为准。
- 待老板拍板的遗留（截至本次核对）：战斗治理的 animation-waiter 处置与 selftest 预存坏条目；onetake 形制动效的实机验收；EXP-003 打包屏文案失真。
- 09-28 时点的核对内容（HEAD `2cef754`、ahead 14、六份实验构建清理等）见[归档审阅与执行记录](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)，以当时时点为准，不在本页重复。

## 按问题找入口

| 需要了解 | 入口与使用方式 |
| --- | --- |
| 当前代码与验证 | 实时 Git 状态与 `git log`；09-28 重构的在途证据见[重构执行记录](archive/records-2026-09-28/REFACTOR-2026-09-28.md)，落库后以提交为准 |
| 玩法与后续 | [规则](rules.md)、[设计](design.md)、[路线图](roadmap.md)；与玩法取舍有关的疑点仍须明确决定 |
| 卡牌迁移 | [卡牌规格入口](cards/README.md)、固定路径的[迁移矩阵](M-BATCH-MATRIX.md)和[排除清单](M-BATCH-EXCLUSIONS.md) |
| 工程历史 | [工程批次索引](archive/engineering-2026-09-27/README.md)、[M 批结果索引](archive/card-migration-2026-09-27/README.md)、[UI 循环报告](archive/ui-loop-2026-09-26/) |
| 旧状态和交接 | [归档总览](archive/README.md)；带日期的报告只代表当时工作区 |
| 文件夹与未提交现场 | [项目文件夹盘点](archive/records-2026-09-28/PROJECT-FOLDER-INVENTORY-2026-09-28.md)；09-29 清理增量见[审计执行记录 §10](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md) |

本页刷新只核对了 Git 状态、文件与目录清单，没有运行游戏测试、构建或浏览器验收；在途会话（夜班 B/C 线）的改动收口前，不应从单份记录推断整项目已可交付。
