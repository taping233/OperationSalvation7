# 文档、资料与项目记忆归档审阅 · 2026-09-28

第 1～6 节保存 17:49 的审阅基线与当时建议；老板随后授权执行的路径调整和清理结果见第 7 节。

核对时间：2026-09-28 17:49 +08:00。范围：`搜打撤` Vite 版及仓库根与之直接相关的临时资料；Godot、Unity、EXE 冻结。核对时 `master` HEAD `2cef754`，相对**本地** `origin/master` 为 ahead 14 / behind 0，未 fetch，远端实时状态未核实。工作树有其他会话的代码、测试、`REFACTOR-2026-09-28.md`、`architecture.md`、`development.md`、`quality-gates.md` 等未提交改动。审阅阶段没有覆盖这些文件，没有构建、全量测试、浏览器验收、提交、移动或删除。

## 1. 数量与放置现状

下表是新增本索引和本报告**之前**的静态盘点；大小为 MiB 四舍五入。

| `docs/` 位置 | 文件数 | 大小 | 实际用途 |
| --- | ---: | ---: | --- |
| 根目录 | 78 | 1.0 | 现行规范、路线图、历史计划、交接和批次结果混放 |
| `archive/` | 29 | 0.4 | 部分历史计划和报告，旧代码路径仍需标注 |
| `modules/` | 54 | 0.3 | 09-21 模块批次记录及少量 QA 页面/脚本 |
| `evidence/` | 93 | 14.7 | 验收截图、日志、JSON；部分被测试直接读取 |
| `previews/` | 84 | 13.0 | QA 宿主页和卡图版本比较；R7A 页面被测试读取 |
| `redesign/` | 37 | 24.9 | 旧设计样板及其相对路径素材 |
| `character-bible/` | 11 | 0.6 | 五角色文字与定稿时点立绘快照 |
| `ui-art-overhaul/` | 6 | <0.1 | 可移植的项目内技能副本 |
| `zcode-dual-track-9h-20260927/` | 21 | 14.1 | 09-27/28 三线原始报告、截图和日志 |
| **合计** | **413** | **69.0** | 其中 Markdown 171 份；根目录已有 78 个文件，导航成本最高 |

目录外另有：`.exp-observe/` 1336 文件/148.7 MiB（隔离观察副本，`node_modules` 是 junction）；`.ui-art-loop-0925/` 51 文件/46.2 MiB；`.ui-loop-0926/` 6781 文件/554.6 MiB（含两个嵌入 Git 仓库和 UI 大修原始证据）；`搜打撤/output/` 2771 文件/233.3 MiB、250 个 Agent 实验子目录；`搜打撤/game/shots/` 29 文件/33.9 MiB；`搜打撤/_backups/` 23 文件/12.6 MiB。`desktop-app/` 约 598.9 MiB，其中 `game/` 和六份 09-28 实验构建各约 85 MiB。大小是物理文件盘点，不等于可安全回收空间或 Git 增量。

## 2. 保留的权威来源与固定路径

| 路径 | 决定与理由 |
| --- | --- |
| `docs/rules.md`、`design.md`、`architecture.md`、`save-format.md`、`quality-gates.md` 等 | 继续作为现行说明；改动须依据实时源码和规则决定。此轮只修正已核实的地图层级、源码路径和历史基准措辞。 |
| `docs/character-bible/` | 保留角色人设与定稿时点的参考图。五张 `ref-images/*.webp` 与运行立绘逐字节相同是有说明的快照，不按重复文件删除。 |
| `game/assets/`、`game/art-source/` | 前者是运行素材，后者是可编辑原稿/过程；按引用、来源和授权分别管理。`game/assets/README.md` 的 v0.1 预留说法已更正。 |
| `game/data/`、`narrative/events.ink` | 内容与叙事来源，不按“文档旧稿”移动；生成物和数据同步有独立入口。 |
| 仓库根 `NovelAI生图功能手册-AI接手版.md` | 工作区级生图流程参考，被旧交接文档引用；当前项目画风仍以项目内实际风格源和人物参考为准。 |
| `docs/game-compendium.md` | 生成脚本和 `tests/compendium.test.js` 使用固定路径；不改名、不手改。它的生成日期是 09-23，不能仅凭旧生成物认定实时卡库状态。 |
| `docs/evidence/e8-card-migration-2026-09-27/catalog-before.json` | `e8-card-inventory`、`e8-card-migration`、`m-batch-production` 测试直接导入；不移动、不删。其他证据先保留至对应验收记录完成引用审查。 |
| `docs/previews/r7a-encounters/index.html` | `tests/r7a-qa-host.test.js` 使用固定路径；不移动。`e2-*`、`e7-*` 预览也先保留其验收语境。 |
| `docs/ui-art-overhaul/` | 项目内可移植副本，与本机技能已有 3/6 文件内容不同；保留并指定同步方向后再考虑合并，不能把其中一份当作完全相同的副本删除。 |
| `搜打撤/output/`、`game/shots/`、`.ui-loop-0926/` | 有 Agent 实验和历史实页证据引用；先建立保留清单及隐私/许可复核，再讨论瘦身。 |

精确哈希比较在 `docs/` 内发现 9 组重复内容，主要是卡图版本比较中相邻版本未变化的图片、空控制台 JSON 和两份相同 DOM 片段。它们节省空间有限且保留了版本/验收语义。跨 `docs/`、运行素材及 `_backups/` 的 15 组重复中，还包括上述人物快照和两个历史备份；**不建议凭哈希批量删除**。运行素材内的口粮图两条路径内容相同，但对应不同语义与引用，需先核对映射。

### 记忆分层

- 仓库中的 `PROJECT-MEMORY-2026-09-28.md`、`PROJECT-STATUS-2026-09-27.md` 是可复查的**日期快照**；`zcode-dual-track-9h-20260927/` 和 `.ui-loop-0926/` 是它们的部分原始报告/证据。下一份现行状态应引用证据，不把这些历史文件继续改写为“永远当前”。
- 本机 `C:\Users\太平\.codex\memories\memory_summary.md` 是检索索引，`MEMORY.md` 的代号柒条目记录了 `791b2c2` 时点的三线状态；两者不在 Vite 仓库内，也不是当前工作树的权威状态。已只读核对相关索引与条目；本轮未改本机记忆或复制其历史正文进仓库。以后更新记忆时先核对实时仓库与原始报告。

## 3. 合并：合并入口与结论，不压掉原始证据

1. **项目状态/记忆**：`PROJECT-STATUS-2026-09-27.md`、`PROJECT-MEMORY-2026-09-28.md`、`NEXT-AI-HANDOFF-2026-09-20.md` 与正在更新的 `REFACTOR-2026-09-28.md` 都有“当前”语句，但记录时点不同。建议在其他会话收口后，以实时 Git、测试和实页证据写一份短的现行状态页；前三份作为带时间的历史快照归档。不要把旧测试数字拼成新验收结论。
2. **路线图**：`LONG-TERM-PLAN-2026-09-27.md` 包含稳定目标，也包含已过期的第一/第二批在途状态。逐项核实尚未完成的目标后并入短的 `roadmap.md`；原计划保留在历史目录。与玩法取舍有关的条目仍由老板拍板。
3. **卡牌迁移**：`M-BATCH-TAKEOVER-2026-09-27.md`、`NEXT-AI-HANDOFF-M-BATCH-2026-09-27.md` 和十份 `M*-RESULT.md` 形成同一批的时间线。建议建一个批次索引，汇总 150 张目标、92 操作规则/58 hosted、51 排除和剩余文本执行依赖，并链接原报告。`M-BATCH-DECISIONS.md`、`M-BATCH-EXCLUSIONS.md`、`M-BATCH-MATRIX.md`、`M-BATCH-CONTRACT-SPEC.md`、`M-BATCH-HOSTED-DESIGN.md` 则分别承载决定、范围和契约，暂不合成一篇。
4. **工程批次**：`ENGINEERING-*` 的计划、结果和证据承担不同责任，不建议把原文直接合并。用一个 09-27 工程批次索引说明 E1–E8 的先后、结论和证据路径，再将计划/结果成组归档。
5. **美术技能**：`UI-ART-OVERHAUL-GUIDE.md` 是 `ui-art-overhaul/SKILL.md` 的入口，功能不同；保留短入口，核对项目副本与本机技能 3 处差异后选定维护源。

## 4. 改名与层级调整建议（17:49 方案；执行见第 7 节）

| 现路径或文件组 | 建议去向 | 前置条件 |
| --- | --- | --- |
| `docs/NEXT-AI-HANDOFF-2026-09-20.md` | `docs/archive/handoffs/2026-09-20-to-27-vite-log.md` | 文件顶部含至 09-27 的反向追加，原名易被误读为 09-20 当前交接；更新项目 README、状态页和历史交叉链接。 |
| `docs/PROJECT-STATUS-2026-09-27.md`、`docs/PROJECT-MEMORY-2026-09-28.md` | `docs/archive/status/` 中保留日期文件名 | 先建立现行状态入口；README 目前仍把 09-28 凌晨记录称为“当前项目记忆”。 |
| `docs/friday-2026-09-12.md`、`docs/battle-ui-alignment-handoff.md` | `docs/archive/status/2026-09-12-v0.54.md`、`docs/archive/handoffs/2026-09-12-battle-ui.md` | 保留原日期/版本信息并更新旧链接。 |
| 根目录的 `ENGINEERING-*.md` 共 25 份 | `docs/archive/engineering-2026-09-27/` | 先建批次索引，修相对链接，`docs/evidence/` 原地保留。 |
| 根目录的 `M1-D1-RESULT.md`、`M2-D3-RESULT.md`、`M3-D5-RESULT.md`、`M4-D6-RESULT.md`、`M5-D7-RESULT.md`、`M6-D8-RESULT.md`、`M7-RESULT.md`、`M8-RESULT.md`、`M10-RESULT.md`、`M11-RESULT.md`、`M-BATCH-TAKEOVER-2026-09-27.md`、`NEXT-AI-HANDOFF-M-BATCH-2026-09-27.md` | `docs/archive/card-migration-2026-09-27/` | 批次索引先行；决策、排除、矩阵和契约另放 `docs/cards/` 活跃参考层，不能混同历史结果。 |
| `docs/card-rule-structure-migration-plan-2026-09-23.md`、`card-rule-text-inventory-2026-09-23.md`、`card-rule-nonbattle-test-matrix-2026-09-23.md` | `docs/archive/card-rules-2026-09-23/` | 先确认尚未完成项在当前路线图中有去向；`card-rules-v2-taxonomy-2026-09-25.md` 保留为带日期的设计参考。 |
| `docs/modules/`（54 文件） | `docs/archive/modules-2026-09-21/` | 有 QA 页面/脚本和相对路径；先检查测试与内部链接，再整体移动。 |
| `docs/redesign/`（37 文件） | `docs/previews/redesign-legacy/` | 整目录移动以保留 HTML→assets 的相对路径；先检查外部链接。 |
| `docs/zcode-dual-track-9h-20260927/` | `docs/archive/three-track-2026-09-27/` | 原始报告与截图同目录移动，更新项目记忆链接。 |
| `docs/steam-asset-requirements.md` | `docs/archive/release-placeholder/` | 当前只有占位规格，且桌面/发布线冻结；未来启动发行时重查渠道现行要求。 |

上表 `ENGINEERING-*` 的 25 个**精确源路径**如下；目标目录一致，执行前仍需逐篇更新相对链接：

- `docs/ENGINEERING-BATCH-01-2026-09-27.md`
- `docs/ENGINEERING-BATCH-02-2026-09-27.md`
- `docs/ENGINEERING-E1-ARCHITECTURE-CONTRACT-PLAN-2026-09-27.md`
- `docs/ENGINEERING-E1-ARCHITECTURE-EVIDENCE-2026-09-27.md`
- `docs/ENGINEERING-E2-ACCEPTANCE-PLAN-2026-09-27.md`
- `docs/ENGINEERING-E2-ACCEPTANCE-RESULT-2026-09-27.md`
- `docs/ENGINEERING-E2-BATTLE-SNAPSHOT-PLAN-2026-09-27.md`
- `docs/ENGINEERING-E2-BATTLE-SNAPSHOT-RESULT-2026-09-27.md`
- `docs/ENGINEERING-E2-VIEW-FOLLOWUP-2026-09-27.md`
- `docs/ENGINEERING-E3-BATTLE-SETTLEMENT-PLAN-2026-09-27.md`
- `docs/ENGINEERING-E3-BATTLE-SETTLEMENT-RESULT-2026-09-27.md`
- `docs/ENGINEERING-E4-ASYNC-COMMAND-PLAN-2026-09-27.md`
- `docs/ENGINEERING-E4-ASYNC-COMMAND-RESULT-2026-09-27.md`
- `docs/ENGINEERING-E5-SAVE-RECOVERY-PLAN-2026-09-27.md`
- `docs/ENGINEERING-E5-SAVE-RECOVERY-RESULT-2026-09-27.md`
- `docs/ENGINEERING-E6-CARD-RULE-CONTRACT-PLAN-2026-09-27.md`
- `docs/ENGINEERING-E6-CARD-RULE-CONTRACT-RESULT-2026-09-27.md`
- `docs/ENGINEERING-E7-INTEGRATION-ACCEPTANCE-PLAN-2026-09-27.md`
- `docs/ENGINEERING-E7-INTEGRATION-ACCEPTANCE-RESULT-2026-09-27.md`
- `docs/ENGINEERING-E8-CARD-MIGRATION-PLAN-2026-09-27.md`
- `docs/ENGINEERING-E8-CARD-MIGRATION-RESULT-2026-09-27.md`
- `docs/ENGINEERING-PARALLEL-CARD-MIGRATION-INVENTORY-2026-09-27.md`
- `docs/ENGINEERING-PARALLEL-REGRESSION-DEBUG-AUDIT-2026-09-27.md`
- `docs/ENGINEERING-PARALLEL-TYPE-CONTRACT-INVENTORY-2026-09-27.md`
- `docs/ENGINEERING-UNIFIED-BASELINE-2026-09-27.md`

`docs/archive/` 目前没有索引，`docs/modules/`、`redesign/`、`zcode-*` 虽属历史却与长期规范同层。建议归档后保留 `docs/` 根目录给现行规范、设计参考和一份当前状态入口；把证据、预览、可编辑源和运行素材分别留在其角色目录，不强行合并成一个“资料”文件夹。

## 5. 候选删除与暂缓项（17:49 方案；执行见第 7 节）

以下为**可重建或会话临时物的候选**，本次均未删除；应先确认相关会话、服务和验收引用已经结束。

| 完整相对路径 | 体量与判断 |
| --- | --- |
| `.exp-observe/` | 148.7 MiB。09-28 体验线原报告称隔离观察环境在会话结束后无用，并建议批准删除；含 `node_modules` junction，执行前须验证目标仍在本工作区且无服务使用。 |
| `exp-observe-vite.log` | 与上述隔离服务配套的未跟踪日志，先确认不再用于排障。 |
| `搜打撤/desktop-app/game-refactor-20260928-1155/` | 约 85.5 MiB，未跟踪实验构建；来源只作时间窗推断。 |
| `搜打撤/desktop-app/game-refactor-20260928-photo-lazy/` | 约 85.5 MiB，未跟踪实验构建。 |
| `搜打撤/desktop-app/game-code-quality-20260928-final/` | 约 85.5 MiB，未跟踪实验构建。 |
| `搜打撤/desktop-app/game-code-quality-20260928-round3/` | 约 85.5 MiB，未跟踪实验构建。 |
| `搜打撤/desktop-app/game-code-quality-20260928-round4/` | 约 85.5 MiB，未跟踪实验构建。 |
| `搜打撤/desktop-app/game-code-quality-20260928-round5/` | 约 85.5 MiB，未跟踪实验构建，当前可能仍被并行会话使用。 |

**暂不列为删除对象**：`.ui-loop-0926/`（含唯一验收记录、第三方嵌入 Git 仓库及待查许可/隐私）、`.ui-art-loop-0925/`（生图输出与来源）、`搜打撤/output/`（实验台账关联）、`搜打撤/game/shots/`（旧走查文档引用）、`搜打撤/_backups/`（原始素材备份）、`搜打撤/desktop-app/game/`（旧构建仍被预算审计脚本默认读取）、根 `package*.json`、`.codex/` 配置备份、`AGENTS.md.bak-*` 及当前未跟踪证据/源码。对这些对象没有足够的替代证据和归属确认。`game/assets/cards/expedition-starters/rations.webp` 与 `game/assets/cards/resources/ration.webp` 的相同哈希也不构成删除依据。

## 6. 链接、内容漂移与执行顺序

- 整理前静态扫描 172 份 Markdown（含项目 README）得到 168 个本地链接候选、36 个未直接解析。未解析项混有 `agent-protocol.md` 的示例语法、两处 `文件.md:行号` 写法，以及历史文档中的旧绝对路径，不能当作 36 个真实坏链接。其中 `archive/GAME-MODULE-CONTRACTS-2026-09-21.md` 指回 `docs/` 的 3 个相对链接、`archive/MODULES-04-06-PLAN-2026-09-21.md` 指向 `modules/` 的 3 个相对链接，以及 `ENGINEERING-PARALLEL-CARD-MIGRATION-INVENTORY-2026-09-27.md` 的两处行号伪链接，已在本次定向修正；历史源码绝对路径仍需标注为旧路径。
- `docs/design.md` 的“三环”与现行四层规则冲突；`rules.md`、`audio-system.md` 和 `terminology.md` 指向旧平铺源码；`game/assets/README.md` 仍称 v0.1 无外部素材；`performance.md` 的 09-04 体积数据容易被误读为现状。这些已在本次定向修正，未改玩法或素材本体。
- 仓库根 `README.md` 仍列出本机当前未出现的 `图片/`、`图片成果/`、`工具/`；它是工作区级说明，且这些目录可能按 `.gitignore` 留在别处。建议另行核对目录定位后修订，不把“当前没看见”作为删除或重建依据。
- 推荐次序：① 在途会话结束、核实当前状态与所有权；② 建批次索引和现行状态页，修链接；③ 获批准后成组移动历史文档；④ 复查新旧链接及固定测试路径；⑤ 再对上表临时目录请求逐路径删除批准。移动会移除旧路径，也须按项目删除约定获批准。

17:55 收尾复扫：174 份 Markdown（含新增两份）有 192 个本地链接候选、28 个未直接解析；其来源为 `agent-protocol.md` 的两个示例参数、旧模块契约中四条已迁移源码路径、旧转型计划中 22 条历史绝对路径。项目 README、新文档导航和本报告的链接均可解析；现行说明里扫描出的 `game/src/*.js` 路径全部存在。对本次修改的已跟踪文件运行 `git diff --check` 无空白错误。

首轮验证仅有 Git 状态、文件清单/大小、内容检索、哈希与静态链接扫描；未运行测试、构建或实际页面验收。生成文件、存档数据、游戏资源和其他会话工作均未改动。

## 7. 授权后的归档执行（2026-09-28 18:22 +08:00）

老板已授权本次整理。执行时 HEAD 仍为 `2cef754`，相对本地 `origin/master` ahead 14 / behind 0；未 fetch。工作树仍有其他会话的源码、测试与重构记录，未覆盖它们，也未提交、推送、构建或运行游戏测试。

| 整理项 | 实际结果 |
| --- | --- |
| 工程批次 | 25 份 `ENGINEERING-*` 迁入 `archive/engineering-2026-09-27/`；新增[工程索引](archive/engineering-2026-09-27/README.md)。09-27 长期计划也迁入该组，稳定目标摘入[路线图](roadmap.md)。 |
| 卡牌规则 | 十份 `M*-RESULT.md` 加两份 M 批交接迁入[结果索引](archive/card-migration-2026-09-27/README.md)；三份 M 批规格/决策/设计和 schema v2 分类迁入[cards/](cards/README.md)；09-23 三份旧计划迁入 `archive/card-rules-2026-09-23/`。测试直接读取的 `M-BATCH-MATRIX.md`、`M-BATCH-EXCLUSIONS.md` 留在根目录。 |
| 历史资料 | `redesign/` 37 件整体迁入 `previews/redesign-legacy/`；三线资料 21 件迁入 `archive/three-track-2026-09-27/`；9 份零散旧资料按[独立资料索引](archive/LEGACY-MATERIALS-INDEX-2026-09.md)分入快照、战斗、可靠性、体验与发布占位组；09-20 至 09-27 旧交接改名迁入 `archive/handoffs/2026-09-20-to-27-vite-log.md`。 |
| 现行入口 | 新增[状态入口](STATUS.md)、[文档导航](README.md)、[归档总览](archive/README.md)，并给 `cards/`、`modules/`、`evidence/`、`previews/` 增索引。`PROJECT-STATUS-2026-09-27.md` 和 `PROJECT-MEMORY-2026-09-28.md` 仍被在途文件引用，暂留原路径并标注日期快照。 |
| 固定路径 | `modules/R4-A-RIG-KINEMATICS.json` 被立绘导出脚本读取，故 54 件模块资料暂留原目录；`game-compendium.md`、E8 `catalog-before.json` 与 R7A 验收页也按脚本/测试原路径保留。 |
| 临时环境 | 已移除 `.exp-observe/node_modules` junction、本体内容和 `exp-observe-vite.log`；共享的 `搜打撤/node_modules` 经检查仍在。`.exp-observe/` 空目录被另一个进程持有，最后一级目录未能删除。 |
| 其他大目录 | 六份 `desktop-app/game-*20260928*` 构建仍由在途 `REFACTOR-2026-09-28.md` 逐项引用，未清理；`.ui-loop-0926/`、`.ui-art-loop-0925/`、`output/`、`game/shots/`、`_backups/` 未移动或删除。 |

共迁移 113 个文件，`docs/` 根层从盘点时 78 个降为 28 个（含本轮新增入口及其他会话新增文件）。迁移后扫描项目 README 和 `docs/` 下 183 份 Markdown；跳过代码块与行内代码后，261 条本地链接的缺失目标为 0。旧转型计划中已失效的绝对路径链接改为标明时点的路径文本，保留历史定位。`git diff --check` 对已跟踪改动未报空白错误。以上是文档链接与路径验证，不等同于游戏测试或实页验收。

本机 `C:\Users\太平\.codex\memories\memory_summary.md` 已加一条指向[状态入口](STATUS.md)和[文档导航](README.md)的日期路由；`MEMORY.md` 的历史条目保持原文，不把旧路径和数字改写成新事实。项目最新事实仍以实时仓库与具体证据为准。

## 8. 后续项目文件夹盘点

18:48 起又核对了 Vite 各层目录、被忽略的 `output/`、六份构建、截图、备份、根部原图/研究现场及全部 Git 未提交项；结果与未动理由集中在[项目文件夹与未提交现场盘点](PROJECT-FOLDER-INVENTORY-2026-09-28.md)，250 个实验目录和 67 个根文件见[逐项快照](evidence/agent-output-inventory-2026-09-28.tsv)。这次没有新增移动或删除，六份构建与空 `.exp-observe/` 的占用边界保持第 7 节结论。

## 9. 已结题构建的后续精简

老板 19 时后授权精简无用或已结题输出。六份 09-28 构建先完成本机去重归档和逐文件校验，随后移除五份旧实验目录，保留最新 `round5/` 与默认 `game/`。完整路径、归档哈希和恢复步骤见[实验构建精简记录](BUILD-OUTPUT-CLEANUP-2026-09-28.md)。第 5、7、8 节描述的是此前时点的保留状态；Agent `output/`、截图与原始素材尚未删减。

20:17 统一收尾时，已确认同一归档覆盖 `round5/` 的 946 件文件并移除该原目录；默认 `desktop-app/game/` 仍在。隔离生产构建的原目录与日志处置也记在[精简记录](BUILD-OUTPUT-CLEANUP-2026-09-28.md)和[低成本优化证据](evidence/LOW-COST-OPTIMIZATIONS-2026-09-28.md)。
