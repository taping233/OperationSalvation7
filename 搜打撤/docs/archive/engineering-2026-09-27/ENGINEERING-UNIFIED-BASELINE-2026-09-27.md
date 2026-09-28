# 统一基线提交范围审阅清单

最新执行状态（2026-09-27 11:21）：Friday 已对精确白名单重新送审，缩窄指令成功交付；既有全量 Vitest 158文件/920项及类型检查通过，准备显式暂存和单次本地提交。第1–6节保留此前只读盘点事实，当前授权及验证以第7节为准；E2实现仍未启动。

## 1. 当前执行门与基线

盘点：2026-09-27 11:01 起，Asia/Shanghai。HEAD `dd5ac7f4a161079e3a41183ea1cdc89cc70158b0`；相对本地 `origin/master` ahead 2 / behind 0，未 fetch。暂存区 `git diff --cached --stat` 为空。

自动审批此前拒绝“全仓提交＋E2”派发，原因是范围广、可能含敏感内容/他人改动、26 对删除归档未逐项确认。盘点阶段授权仅只读与本清单写入；本清单自身不是授权来源。该阶段未暂存、提交、删除、回滚、测试、类型检查、构建或运行游戏；后续缩窄授权见第7节。

以 `git status --porcelain=v1 --untracked-files=all` 的路径快照计：**75 个 tracked 修改、26 个 tracked 删除、709 个未跟踪文件，共 810 条路径**。下文覆盖：**100 个项目成果候选 + 52 条删除/归档路径（26 对）+ 658 个本次建议排除文件 = 810**。本清单新建后再增加自身 1 个候选，即项目成果候选共 101、路径共 811；不把目录条目数当文件数。

所有路径相对 `D:/素材/代号柒/`。表中 M=当前 Git 修改状态，U=未跟踪新增；仅说明现状，不等同已通过验收。目录排除含整棵子目录，精确统计同时给出 Git 可见文件数与必要的物理数量区别。

## 2. 活跃写入者与归属事实

- 应用清单显示当前协调聊天 **Friday 沟通与工程调度接续**（`01a0e0af-8906-79b0-9f7d-6e09b3d6c266`）active；持有 E1/E2 计划，目前正在做确认协调。本主指挥 `01a0e0b0-c1db-7a20-9d66-ff76a8e431c8` 只写本清单，三名现有子代理只读。
- 当前可见项目相关聊天 **对照塔2改进战斗系统**（`01a0cf2c-4312-77f1-9862-241d31f792a8`）列表为 idle，读取详情为 notLoaded，最近可读执行轮为历史 failed；这不是活跃写入证据，也不释放其历史归属。**评估项目代码框架**、**制定卡牌规则解耦计划**显示 notLoaded。未向它们派任务或要求重新验收。
- 本次可见清单未发现另一个 active 工程写入聊天，但这不是进程级/所有历史聊天全局写锁证明。未主动暂停其它聊天，未建立“所有作者已确认停写”的虚假记录；由 Friday 统一同步和处理受阻范围。
- 归属按已有记录保留：工程批1/2；UI大修及此前战斗交互；Agent后续实验；Friday的计划及现行文档。混合归属仅记清，不要求逐文件重新取得作者许可，也不重做 E1。
- 已知混合：`battle.layers.js` 含 UI W5-03/W5-06 和工程批2隔离修复；`game.run.altar.js` 有UI/Agent/原流程交叠。Agent的 `battle.lifecycle.js` 当前 diff 为战斗观测扩展；`game.session.js` 的本次 diff 为 UI 数据页接线。不能按目录名把这些整文件标成单一批次独占。

## 3. 项目成果候选确切清单

以下 **100 个现有文件及本清单** 是固定白名单；盘点时列为候选，后续 Friday 已按此清单恢复本地提交执行门（第7节）。这里记录现有成果，不要求每个文件重验功能。

### A 工程批次成果

16 个文件。复用 ENGINEERING-BATCH-01（09:27）与 BATCH-02（09:56）的归属及完成记录：第二批独立 tsc 和 158 文件/920 项历史通过。构建、真实产物预算、浏览器未验；本轮不重跑。battle.layers 混合文件列 C。

| 状态 | 精确路径 |
| --- | --- |
| M | `搜打撤/game/src/core/sdt-facade.js` |
| M | `搜打撤/game/src/hub/commands.shared.js` |
| M | `搜打撤/game/src/hub/game.store.js` |
| M | `搜打撤/game/src/hub/recoverable-pair.js` |
| M | `搜打撤/game/src/hub/recovery.commands.js` |
| M | `搜打撤/jsconfig.json` |
| M | `搜打撤/vite.config.js` |
| U | `搜打撤/game/src/hub/game.store.types.d.ts` |
| U | `搜打撤/tests/commands-shared-contract.test.js` |
| U | `搜打撤/tests/game-store-snapshot.test.js` |
| U | `搜打撤/tests/game-store-types.fixture.ts` |
| U | `搜打撤/tests/game-store-types.test.js` |
| U | `搜打撤/tests/intent-legend-isolation.test.js` |
| U | `搜打撤/tests/recoverable-pair-contract.test.js` |
| U | `搜打撤/tests/recoverable-pair-types.test.js` |
| U | `搜打撤/tests/vite-card-chunk.test.js` |

### B Agent 后续迭代

15 个文件。含动作/观察/策略/统计、批跑/比较/进化/台账和新增 supervise。手册有晚于08:15状态快照的实验记录，champion仍 strategic DEFAULT，若干实验为弃案/判毙且基础设施保留；统一提交是保存现状，不冒称实验收益已证明或页面时序已验收。

| 状态 | 精确路径 |
| --- | --- |
| M | `搜打撤/docs/agent-iteration-playbook.md` |
| M | `搜打撤/game/src/agent/agent.js` |
| M | `搜打撤/game/src/agent/agent.policy.js` |
| M | `搜打撤/game/src/agent/agent.recorder.js` |
| M | `搜打撤/game/src/agent/agent.runner.js` |
| M | `搜打撤/game/src/agent/agent.state.js` |
| M | `搜打撤/game/src/agent/agent.stats.js` |
| M | `搜打撤/game/src/agent/agent.surface.js` |
| M | `搜打撤/game/src/agent/agent.weights.js` |
| M | `搜打撤/game/src/battle/battle.lifecycle.js` |
| M | `搜打撤/game/tools/agent-batch.mjs` |
| M | `搜打撤/game/tools/agent-compare.mjs` |
| M | `搜打撤/game/tools/agent-evolve.mjs` |
| M | `搜打撤/game/tools/agent-ledger.mjs` |
| U | `搜打撤/game/tools/agent-supervise.mjs` |

### C UI/战斗/流程混合成果

47 个文件。复用 UI终报/PROJECT-STATUS：39 closed、7 open移交、1 gameplay待定；241项相关用例和W7七靶位是历史记录，非47项全修复。overlay、部分战斗交互等不全属同一UI循环。expedition-rewards.css虽status为M，盘点时diff/numstat没有内容项，保留状态记录，不编造功能改动。

| 状态 | 精确路径 |
| --- | --- |
| M | `搜打撤/game/css/base.css` |
| M | `搜打撤/game/css/battle.css` |
| M | `搜打撤/game/css/expedition-hub.css` |
| M | `搜打撤/game/css/expedition-inventory.css` |
| M | `搜打撤/game/css/expedition-map.css` |
| M | `搜打撤/game/css/expedition-rewards.css` |
| M | `搜打撤/game/css/expedition-roster.css` |
| M | `搜打撤/game/css/expedition.css` |
| M | `搜打撤/game/css/hub.css` |
| M | `搜打撤/game/css/page-ach.css` |
| M | `搜打撤/game/css/page-classes.css` |
| M | `搜打撤/game/css/page-deploy.css` |
| M | `搜打撤/game/css/page-hub.css` |
| M | `搜打撤/game/css/page-rewards-bag-help.css` |
| M | `搜打撤/game/css/page-settings.css` |
| M | `搜打撤/game/css/page-shop.css` |
| M | `搜打撤/game/css/page-slot-select.css` |
| M | `搜打撤/game/css/page-stash.css` |
| M | `搜打撤/game/css/page-upgrade.css` |
| M | `搜打撤/game/css/preparation.css` |
| M | `搜打撤/game/css/title-p0.css` |
| M | `搜打撤/game/css/winter.css` |
| M | `搜打撤/game/index.html` |
| M | `搜打撤/game/src/audio/sound.js` |
| M | `搜打撤/game/src/battle/battle.aim.js` |
| M | `搜打撤/game/src/battle/battle.feedback.js` |
| M | `搜打撤/game/src/battle/battle.layers.js` |
| M | `搜打撤/game/src/battle/battle.piles.view.js` |
| M | `搜打撤/game/src/battle/battle.vfx.js` |
| M | `搜打撤/game/src/battle/battle.view.js` |
| M | `搜打撤/game/src/core/icons-bitmap.js` |
| M | `搜打撤/game/src/core/renderer.js` |
| M | `搜打撤/game/src/home/home.visuals.js` |
| M | `搜打撤/game/src/hub/game.hub.depart.js` |
| M | `搜打撤/game/src/hub/game.hub.js` |
| M | `搜打撤/game/src/hub/game.hub.pages.js` |
| M | `搜打撤/game/src/run/chests.js` |
| M | `搜打撤/game/src/run/expedition.view.js` |
| M | `搜打撤/game/src/run/game.run.altar.js` |
| M | `搜打撤/game/src/run/game.session.death.js` |
| M | `搜打撤/game/src/run/game.session.js` |
| M | `搜打撤/game/src/run/game.session.map.js` |
| M | `搜打撤/game/src/ui/game.menu.js` |
| M | `搜打撤/game/src/ui/hud.js` |
| M | `搜打撤/game/src/ui/overlay.js` |
| M | `搜打撤/game/src/ui/quick-nav.js` |
| U | `搜打撤/game/css/page-datapage.css` |

### D 资产及生成清单

8 个文件。6张emblems有真实运行引用：game.run.altar.js:26–33（五职业）、game.hub.pages.js:188（宠物蛋）；与nai-out对应PNG哈希相同，产品副本共7,735,529字节。两份manifest为既有生成清单变化；本轮不生成、不重验资产完整性，也未逐图视觉审查。

| 状态 | 精确路径 |
| --- | --- |
| M | `搜打撤/game/src/generated/art-manifest.js` |
| M | `搜打撤/game/src/generated/thumb-manifest.js` |
| U | `搜打撤/game/assets/ui/emblems/pet-egg.png` |
| U | `搜打撤/game/assets/ui/emblems/profession-emblem-baita.png` |
| U | `搜打撤/game/assets/ui/emblems/profession-emblem-dwu.png` |
| U | `搜打撤/game/assets/ui/emblems/profession-emblem-heixiang.png` |
| U | `搜打撤/game/assets/ui/emblems/profession-emblem-wu.png` |
| U | `搜打撤/game/assets/ui/emblems/profession-emblem-xingyue.png` |

### E 项目规则及文档

14 个现有文件。AGENTS为项目规则精简；README/architecture等为导航更新；工程两批/E1为既有证据；E1/E2计划属Friday，E2已写明当前只读盘点门。历史交接标题“闭环47单”不能代替39/7/1明细。不得因纳入计划文件而认为E2已实施。

| 状态 | 精确路径 |
| --- | --- |
| M | `AGENTS.md` |
| M | `搜打撤/README.md` |
| M | `搜打撤/docs/archive/handoffs/2026-09-20-to-27-vite-log.md` |
| M | `搜打撤/docs/architecture.md` |
| M | `搜打撤/docs/changelog.md` |
| M | `搜打撤/game/src/README.md` |
| U | `搜打撤/docs/ENGINEERING-BATCH-01-2026-09-27.md` |
| U | `搜打撤/docs/ENGINEERING-BATCH-02-2026-09-27.md` |
| U | `搜打撤/docs/ENGINEERING-E1-ARCHITECTURE-CONTRACT-PLAN-2026-09-27.md` |
| U | `搜打撤/docs/ENGINEERING-E1-ARCHITECTURE-EVIDENCE-2026-09-27.md` |
| U | `搜打撤/docs/ENGINEERING-E2-BATTLE-SNAPSHOT-PLAN-2026-09-27.md` |
| U | `搜打撤/docs/archive/engineering-2026-09-27/LONG-TERM-PLAN-2026-09-27.md` |
| U | `搜打撤/docs/PROJECT-STATUS-2026-09-27.md` |
| U | `搜打撤/docs/archive/experience-2026-09-26/ui-experience-overhaul-brief-2026-09-26.md` |

本轮自身候选：`搜打撤/docs/ENGINEERING-UNIFIED-BASELINE-2026-09-27.md`（U，唯一由本轮创建/编辑）。

## 4. 删除与归档：26 对需统一确认

只读比较 HEAD blob 与当前同名 archive 文件：**24 对字节/SHA一致；2 对仅换行不同，规范化 EOL 后内容一致；无未配对删除、无内容改写对**。已有删除仍需 Friday 协调老板确认，不能因存在副本而自动获准。确认对象是下表26对原路径和归档路径；本轮未操作删除。

| tracked 删除路径 | 未跟踪归档路径 | HEAD→归档字节 / 比较 |
| --- | --- | --- |
| `搜打撤/docs/FIRST-THREE-MODULES-PLAN-2026-09-21.md` | `搜打撤/docs/archive/FIRST-THREE-MODULES-PLAN-2026-09-21.md` | 10810→10810；字节/SHA相同 |
| `搜打撤/docs/GAME-MODULE-CONTRACTS-2026-09-21.md` | `搜打撤/docs/archive/GAME-MODULE-CONTRACTS-2026-09-21.md` | 41730→41730；字节/SHA相同 |
| `搜打撤/docs/GAME-TRANSFORMATION-PLAN-2026-09-21.md` | `搜打撤/docs/archive/GAME-TRANSFORMATION-PLAN-2026-09-21.md` | 47845→47845；字节/SHA相同 |
| `搜打撤/docs/LINEAR-EXECUTION-2026-09-21.md` | `搜打撤/docs/archive/LINEAR-EXECUTION-2026-09-21.md` | 31996→31999；仅3个LF变CRLF |
| `搜打撤/docs/MODULES-01-06-RESULTS-2026-09-21.md` | `搜打撤/docs/archive/MODULES-01-06-RESULTS-2026-09-21.md` | 5313→5313；字节/SHA相同 |
| `搜打撤/docs/MODULES-04-06-PLAN-2026-09-21.md` | `搜打撤/docs/archive/MODULES-04-06-PLAN-2026-09-21.md` | 11950→11950；字节/SHA相同 |
| `搜打撤/docs/NEXT-AI-HANDOFF-2026-09-12.md` | `搜打撤/docs/archive/NEXT-AI-HANDOFF-2026-09-12.md` | 9716→9716；字节/SHA相同 |
| `搜打撤/docs/OVERNIGHT-RESULTS-2026-09-21.md` | `搜打撤/docs/archive/OVERNIGHT-RESULTS-2026-09-21.md` | 5469→5469；字节/SHA相同 |
| `搜打撤/docs/PHOTO-STUDIO-ART-ACCEPTANCE-2026-09-23.md` | `搜打撤/docs/archive/PHOTO-STUDIO-ART-ACCEPTANCE-2026-09-23.md` | 6867→6867；字节/SHA相同 |
| `搜打撤/docs/PHOTO-STUDIO-ART-DIRECTION-2026-09-23.md` | `搜打撤/docs/archive/PHOTO-STUDIO-ART-DIRECTION-2026-09-23.md` | 12637→12637；字节/SHA相同 |
| `搜打撤/docs/arch-guard-revive-2026-09-24.md` | `搜打撤/docs/archive/arch-guard-revive-2026-09-24.md` | 6036→6036；字节/SHA相同 |
| `搜打撤/docs/architecture-alignment-plan-2026-09-23.md` | `搜打撤/docs/archive/architecture-alignment-plan-2026-09-23.md` | 15597→15597；字节/SHA相同 |
| `搜打撤/docs/art-coverage-2026-09-12.md` | `搜打撤/docs/archive/art-coverage-2026-09-12.md` | 3335→3335；字节/SHA相同 |
| `搜打撤/docs/ci-fix-tick-2026-09-24.md` | `搜打撤/docs/archive/ci-fix-tick-2026-09-24.md` | 3975→3975；字节/SHA相同 |
| `搜打撤/docs/ci-gate-2026-09-23.md` | `搜打撤/docs/archive/ci-gate-2026-09-23.md` | 4697→4697；字节/SHA相同 |
| `搜打撤/docs/code-health-plan-2026-09-23.md` | `搜打撤/docs/archive/code-health-plan-2026-09-23.md` | 7380→7380；字节/SHA相同 |
| `搜打撤/docs/lint-baseline-2026-09-23.md` | `搜打撤/docs/archive/lint-baseline-2026-09-23.md` | 4878→4878；字节/SHA相同 |
| `搜打撤/docs/lint-unused-cleanup-exec-2026-09-24.md` | `搜打撤/docs/archive/lint-unused-cleanup-exec-2026-09-24.md` | 9019→9019；字节/SHA相同 |
| `搜打撤/docs/lint-unused-vars-cleanup-2026-09-24.md` | `搜打撤/docs/archive/lint-unused-vars-cleanup-2026-09-24.md` | 36469→36469；字节/SHA相同 |
| `搜打撤/docs/live-walkthrough-2026-09-25-three-batch.md` | `搜打撤/docs/archive/live-walkthrough-2026-09-25-three-batch.md` | 16639→16639；字节/SHA相同 |
| `搜打撤/docs/multi-agent-review-changelog-2026-09-20.md` | `搜打撤/docs/archive/multi-agent-review-changelog-2026-09-20.md` | 15359→15359；字节/SHA相同 |
| `搜打撤/docs/orphan-audit-2026-09-25.md` | `搜打撤/docs/archive/orphan-audit-2026-09-25.md` | 23244→23464；220行LF变CRLF |
| `搜打撤/docs/pending-deletions-2026-09-25.md` | `搜打撤/docs/archive/pending-deletions-2026-09-25.md` | 7859→7859；字节/SHA相同 |
| `搜打撤/docs/save-hardening-2026-09-24.md` | `搜打撤/docs/archive/save-hardening-2026-09-24.md` | 7107→7107；字节/SHA相同 |
| `搜打撤/docs/ts-check-rollout-2026-09-23.md` | `搜打撤/docs/archive/ts-check-rollout-2026-09-23.md` | 17563→17563；字节/SHA相同 |
| `搜打撤/docs/tt12-live-walkthrough-2026-09-24.md` | `搜打撤/docs/archive/tt12-live-walkthrough-2026-09-24.md` | 10417→10417；字节/SHA相同 |

`LINEAR-EXECUTION`：旧0 CRLF+229 LF，归档3 CRLF+226 LF；`orphan-audit`：旧0 CRLF+220 LF，归档220 CRLF；均无裸CR。另两个archive文件 `skills-improvement-checklist.md`、`ui-walkthrough-checklist.md` 已在HEAD跟踪且clean，不属于本次新增或删除配对，不额外纳入。

## 5. 本次建议排除并保留原地的确切范围

下列范围 **658 个 Git 可见未跟踪文件，共 505,140,454 字节**。全都留原地；“排除”仅指不纳入这次候选，不执行删除或新增忽略规则。截图证据若Friday决定另行纳入，应从明确图片清单确认，不把整个临时目录一并暂存。

| 精确范围（目录含全部后代） | Git可见数量 / 字节 | 用途、风险和建议 |
| --- | --- | --- |
| `.codex/config.toml` | 1 / 331 | 本机项目配置，不是产品代码；含个人设置/机器路径风险，本次排除。 |
| `.codex/config.toml.bak-20260927-082641-global-skills` | 1 / 2,918 | 配置历史备份，本次排除。 |
| `.codex/config.toml.bak-20260927-082732-no-overrides` | 1 / 371 | 配置历史备份，本次排除。 |
| `AGENTS.md.bak-20260927-082309-context` | 1 / 1,636 | 规则备份，现行AGENTS另列候选；备份排除。 |
| `package.json` | 1 / 61 | 根目录仅声明puppeteer-core截图工具依赖，非搜打撤Vite产品依赖；本次排除。 |
| `package-lock.json` | 1 / 11,526 | 配套截图工具锁文件，本次排除；若以后正式保留runner再另定范围。 |
| `.ui-art-loop-0925/` | 51 / 48,467,187 | 17素材族各payload JSON/PNG/ZIP，原始生图输入与中间/输出；产品6副本另列D。原目录本次全部排除。 |
| `.ui-loop-0926/` | 572 / 421,110,054 | UI研究、截图、操作脚本与记录；含第三方嵌入仓库、再分发许可及截图隐私未确认，体积大，整目录排除。 |
| `搜打撤/game/shots/` | 29 / 35,546,370 | 流程截图证据，非运行时素材；虽旧验收文档引用，未逐图复核隐私/内容，本次建议排除留原地，由Friday可选择另批证据入库。 |

`.ui-loop-0926/` 的物理目录为 **6,840 文件 / 708,649,745字节**，包括被忽略内容及嵌入Git仓库内部对象；不能用物理量代替Git未跟踪可提交量。整目录排除同时保留这些内容。已知产品/状态文档引用其中 FINAL-REPORT/议题/截图，故排除后的仓库副本不会自带这部分本地证据；这是交付附件缺口，不是本轮删文件。

截图范围内的29个准确文件（如Friday选择单独纳入，只取本列表；当前仍建议排除）：

- `搜打撤/game/shots/B2/deploy-2.png`
- `搜打撤/game/shots/B2/deploy-after.png`
- `搜打撤/game/shots/B2/deploy-empty.png`
- `搜打撤/game/shots/B2/deploy-hint.png`
- `搜打撤/game/shots/B2/deploy-tear.png`
- `搜打撤/game/shots/walk0925-b2-after-freeze-turn.png`
- `搜打撤/game/shots/walk0925-b2-after-lianshe.png`
- `搜打撤/game/shots/walk0925-b2-before-lianshe.png`
- `搜打撤/game/shots/walk0925-b2-boss.png`
- `搜打撤/game/shots/walk0925-b2-boss2.png`
- `搜打撤/game/shots/walk0925-b2-death-fxdie.png`
- `搜打撤/game/shots/walk0925-b2-death-gone.png`
- `搜打撤/game/shots/walk0925-b2-death-pending.png`
- `搜打撤/game/shots/walk0925-b2-drag-mid.png`
- `搜打撤/game/shots/walk0925-b2-drag-result.png`
- `搜打撤/game/shots/walk0925-b2-endgame-1.png`
- `搜打撤/game/shots/walk0925-b2-endgame-2.png`
- `搜打撤/game/shots/walk0925-b2-freeze-idle-after.png`
- `搜打撤/game/shots/walk0925-b2-frozen.png`
- `搜打撤/game/shots/walk0925-b2-icespike-frozen.png`
- `搜打撤/game/shots/walk0925-b2-lianshe-result.png`
- `搜打撤/game/shots/walk0925-b2-meteor.png`
- `搜打撤/game/shots/walk0925-b2-pace-result.png`
- `搜打撤/game/shots/walk0925-infuse-1picked.png`
- `搜打撤/game/shots/walk0925-infuse-cycled.png`
- `搜打撤/game/shots/walk0925-infuse-reselect.png`
- `搜打撤/game/shots/walk0925-infuse-start.png`
- `搜打撤/game/shots/walk0925-shop-first.png`
- `搜打撤/game/shots/walk0925-title.png`

敏感检查限度：子代理仅对选定目录中小于5MB可读文本做凭证形状/字段模式扫描，跳过媒体/压缩；未见高置信API key/token/private-key形状。两处泛用password标签来自第三方仓库的许可证/公证脚本，不输出匹配值，也不判定实际密钥。未视觉审查PNG或检查ZIP内容，因此不能保证截图隐私/二进制内容安全；这是排除临时/截图证据的依据之一，不是发现密钥的声明。未做全仓保密审计。

## 6. 供 Friday 一次确认的范围与剩余边界

1. 确认第3节 **101个项目成果候选（含本清单）** 是否作为统一基线；这是保存现状，不代表全库验收通过。
2. 确认第4节 **26对文档删除/归档** 纳入，已证明24对字节相同、2对仅EOL差异；没有新增删除动作建议。
3. 第5节 **658个文件** 本次排除且保留原地；29张截图的本地证据引用缺口已明示，可由Friday另行选择，不要求逐作者许可。
4. 当前只读盘点完成后即停止，交Friday统一确认/审批协调。获得明确恢复执行门之前，不暂存/提交或开始E2；不绕过先前拒绝。

复用证据：PROJECT-STATUS（08:10–08:15）、工程批1/2（09:27/09:56）、E1（10:39）和UI/Agent既有记录。本轮只核提交范围/归属事实、文件大小、删除归档内容等价及限定敏感风险，没有重复E1、功能验收或运行检查。

## 7. 缩窄授权后的统一基线验证与提交准备

- 授权来源：Friday 成功送达的新指令只允许第3节101个项目成果文件和第4节26对既有归档结果；第5节658个文件全部排除。只记录既有搬迁，不执行文件删除/移动。单次本地提交后回报并等待E2恢复，不推送、不amend、不更改忽略规则。
- 11:14 前置核对：153条路径（101成果+52归档两端），127个现存文件、26个既有缺失原路径；暂存区为空。相对盘点快照仅Friday持有的E2计划增加158字节，内容为缩窄审批门同步，无代码尺寸变化；随后为白名单全部现存文件记录SHA256。
- 限定新增敏感/体积扫描：白名单可读文本未命中高置信API key/token/private-key形状，未输出任何敏感值；白名单无大于10MB文件。6张产品PNG未做视觉隐私审查，不把来源/引用核验当图片完整验收。
- 既有类型检查：`node node_modules/typescript/bin/tsc --project jsconfig.json --pretty false`，退出码0，无诊断。
- 既有全量检查：`node node_modules/vitest/vitest.mjs run --no-file-parallelism --reporter=dot`，从项目目录直接调用本地依赖，不触发npm pretest生成。首次沙箱启动因esbuild子进程spawn EPERM退出1、未运行用例；经权限审批后同命令重试成功，11:17:05开始，耗时205.23秒，**158文件/920项全部通过，退出码0**。
- 通过并非零日志：全卡实打272张、硬失败0、零效果警告3；另有测试环境Pixi渲染提示、故障注入/损坏档预期日志。未以这些提示扩范围修复。构建、产物预算、浏览器及长局仍未验证。
- 11:20:53 并发复核：白名单全部SHA256与检查前一致（含仍缺失的26个旧路径），Git状态除本清单新增外与盘点快照完全一致，共811路径；未发现新的外来修改。随后只更新本清单记录以上结果。
- 仓库现有 `搜打撤/.githooks/pre-commit` 会因源码/测试暂存再次自动跑相同全量并写 `.git/gate-full-test.log`；保持此门禁，不设置SKIP_FULL_TESTS、不用no-verify。此处不提前宣称门禁或提交成功；实际SHA、门禁结果和提交后保留项由提交完成报告提供，避免为回填自身SHA再造提交或amend。
- 显式暂存后复核：152个原始路径全部在153路径白名单内，唯一无实际差异的批准路径为 `搜打撤/game/css/expedition-rewards.css`，未人为制造改动；Git折叠改名后为126个文件变更（100个实际成果文件+26个归档改名）。26对暂存归档blob与HEAD原blob全部完全相同；`git diff --cached --check`退出0，未暂存tracked差异为空，658个排除文件未入暂存区。
