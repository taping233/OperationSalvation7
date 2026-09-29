# 项目状态入口

核对时点：2026-09-29 深夜（Asia/Shanghai）。本页用于找到实时状态和证据；每次接手先在工作区重新运行 `git status --short`、`git log -1`。

## 本次核对

- 范围是 `搜打撤` Vite；Godot、Unity、EXE 线冻结。`package.json` 当前版本为 0.60.0，版本号本身不代表发布或完整验收。
- 本地 `master` HEAD 为 `0bac1f3`（2026-09-29 深夜工作流标准化七项，纯文档提交走门禁 skip 闸秒过），其父链 `f94e1f1`/`9114001` 等至 `1b7504d` 均已与远端同步（09-29 `ls-remote` 活核实）。
- **09-29 深夜工作流标准化（`0bac1f3`，老板批「全部一一做」）**：新增[并行热点登记](PARALLEL-REGISTRY.md)（登记/销账/无主物品区）、[待拍板台账](PENDING.md)（挂账唯一真源，迁入 8 条历史活账）、[并行派工手册](PARALLEL-DISPATCH-PLAYBOOK.md)（并发上限 2/工作树惯例/编号协议）；根 AGENTS.md 加接手检查单六步与流程登记五条（证据路径 `docs/evidence/<日期>-<任务>/`、端口约定 5200/53xx/8139）；docs/README 路由表同步登记。
- **09-29 深夜 knip 首跑+A 类死代码清理（老板批「执行」）+C 类 setter 删除（老板批「删除c类」）**：新装 knip（`npx knip`+`knip.json` 配置，未进 package.json——lock 被并行会话占用）；A 类已执行：renderer.icons 位图管线移除（289→57 行，地图仅剩战术符号路径实证）、getHomeForSlot、openAltarRitual re-export、三个无人 default+matchBlank 死导出词、run-architecture 断言清单腐坏项同步修正；C 类已执行：runtime `set$`×25 零调用 setter 删除（三重确认：生产读者/测试读者/动态拼接全零），守卫测试增 SETTER_EXEMPT 豁免清单（25 字段写入走文件内赋值与引用变异），白名单 90 let 不动；验证=守卫/facade/architecture 定向 17/17 绿+knip 残留归零+全量仅负载 flake 定向复绿；**教训三条**：删除前 grep 必须含 html/md（dev.html importmap 险情，git checkout 救回）、本机 ugrep 对 `$` 模式按锚点解释（甄别须用 python 词边界）、「setter 零调用」≠「字段死」（引用类型有 push/pop 变异写通道，删前必须分清整体重赋值与内容变异）。e2.snapshot.qa.js 删留在 [PENDING](PENDING.md) #10。
- 09-28 深夜至 09-29 的批次已全部落库并推送，提交链为 `1b7504d`/`a6225b6`/`0dd41fc`/`94f50ce`（战斗模块治理：90 字段守卫、五目录分层、engine 瘦身、effects 收敛、turbo 归 core）→ `0959124`（cards 回填机制收敛 + 花瓣法阵 heal:3，并入夜班三线产物）→ `9e5a4ad`（全量测试默认并行，304s→约 55s）→ `0a70dee`（文档层级清尾，game/shots 29 件证据入库）→ `9114001`（战斗域审计 58 处修复 + 晚批拍板执行）→ `f94e1f1`（STATUS 落档）→ `0bac1f3`（工作流标准化）→ `643434f`/`2bcfc23`（落档+REGISTRY 实况）。各批次验收结论以提交信息与当时记录为准。
- `9114001` 落库经过：验收门 full 档拦出类型契约（discover-flow pouchUid 传参）与 ESLint（beginTargeting 未用参数）两处，当场修正后重过；门禁内全量 vitest 234 文件/1887 过/2 skip（89.3s），另有 17:11 人工实跑同结果。本次推送曾报 `unable to rewind rpc post data`，调 `http.postBuffer` 500MB 后经 `ls-remote` 确认数据实际已到位。
- 全量 `npx vitest run` 自 09-29 起默认并行，旧「必须 `--no-file-parallelism`」的硬规则作废；收尾落库前或改公共架构才跑全量的口径不变。
- 09-28 归档审计的后续（均经老板批准）：`.ui-loop-0926/` 已瘦身，顶层 11 份报告迁入[循环报告目录](archive/ui-loop-2026-09-26/)留底；`.perf-wt-b/` worktree（`47001e3` 已并入 master）与 `.cards-consolidation-2026-09-29.patch` 已删。明细见[审计执行记录 §10](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)；`.ui-art-loop-0925/`、`game/shots/`、`.codex/`、`AGENTS.md.bak-*` 仍按审计裁决保留。
- 长期计划夜班（09-27→29）三线已收官（`0959124` 落库，09-29 午后老板宣布）；遗留挂账（perf evidence 53K 删否、僵尸 Vite 等 8 条）统一移入[待拍板台账](PENDING.md)跟踪。
- 拍板与验收状态：animation-waiter 移除与 selftest 预存坏条目已按 09-29 晚批拍板执行并随 `9114001` 落库；仍待验收的遗留：onetake 形制动效实机验收、EXP-003 打包屏文案实页复核、「无」选人立绘 v27 大图对照验收。
- 09-28 时点的核对内容（HEAD `2cef754`、ahead 14、六份实验构建清理等）见[归档审阅与执行记录](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md)，以当时时点为准，不在本页重复。

## 按问题找入口

| 需要了解 | 入口与使用方式 |
| --- | --- |
| 当前代码与验证 | 实时 Git 状态与 `git log`；09-28 重构的在途证据见[重构执行记录](archive/records-2026-09-28/REFACTOR-2026-09-28.md)，落库后以提交为准 |
| 接手/并行协作 | 根 AGENTS.md 接手检查单；[热点登记](PARALLEL-REGISTRY.md)（在途占用与无主物品）、[待拍板台账](PENDING.md)（挂账别重复登记） |
| 玩法与后续 | [规则](rules.md)、[设计](design.md)、[路线图](roadmap.md)；与玩法取舍有关的疑点仍须明确决定 |
| 卡牌迁移 | [卡牌规格入口](cards/README.md)、固定路径的[迁移矩阵](M-BATCH-MATRIX.md)和[排除清单](M-BATCH-EXCLUSIONS.md) |
| 工程历史 | [工程批次索引](archive/engineering-2026-09-27/README.md)、[M 批结果索引](archive/card-migration-2026-09-27/README.md)、[UI 循环报告](archive/ui-loop-2026-09-26/) |
| 旧状态和交接 | [归档总览](archive/README.md)；带日期的报告只代表当时工作区 |
| 文件夹与未提交现场 | [项目文件夹盘点](archive/records-2026-09-28/PROJECT-FOLDER-INVENTORY-2026-09-28.md)；09-29 清理增量见[审计执行记录 §10](DOCUMENT-ARCHIVE-AUDIT-2026-09-28.md) |

本页刷新（深夜）核对 Git 状态并记录 `0bac1f3` 落库（纯文档走 skip 闸）；未跑全量测试与浏览器实页验收（本批无代码改动）。在途会话（cardslib/expedition-library 两文件改动、PHOTOLIB 任务）收口前，不应从单份记录推断整项目已可交付。
