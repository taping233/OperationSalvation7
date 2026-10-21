# 待拍板台账（PENDING）

> **规则（09-29 起）**：
> 1. 任何会话产生「等老板拍板/处置」的事项，**即时**登记一行（一事一行，注明来源与需要的决定）；拍板后回写来源，将记录移至「已决记录」，不混入活账、不抹除决策依据。
> 2. 台账只收**等决策/等处置**的活账；未排期 backlog、需求想法不入（各归 roadmap / 战役文件）。
> 3. 删除先列具体路径清单获批；台账仅批准方向而未给清单时补清单，清单已获批且范围未变沿用授权，不重复确认。提交/回滚/发布等授权仍独立。
> 4. 记忆只放指针。事项识别来源/对象/需要的决定以避免重复登记；普通修复 backlog 移路线图并留回链，已授权实施归任务记录，不重新挂成等待批准。
> 5. 日落（10-02）：活账挂超 7 天未决——普通工程/处置类在下一落库批次自动降级 [roadmap](roadmap.md) 并留回链；玩法语义与删除报批类不自动降级，仅由 handoff ⏰ 持续催办至拍板。

## 活账

| # | 事项 | 提出 | 来源 | 备注 |
|---|---|---|---|---|
| 43 | 研究所牌盒满容量玩法需确定：现行说明为容量 30（混沌之眼为 35）且满时一换一，领取/商店等实现尚未提供完整换牌流程；确认换牌交互与取消时奖励/付款保留方式后实施 | 10-14 | WF-cloud-deep-review-1014；game/src/run/game.nest.js 牌盒说明与写入路径 | 本轮仅修复已明确的符文容量扣牌/扣币前预检；未以直接丢弃奖励代替换牌。普通 bug 修复与联合验收继续，不受本条阻塞 |
| 44 | 地图设施不相邻与战斗聚集约束是否升级为硬约束：现生成器在无候选时存在软回退，修正规则会改变同种子的布局；需确定新地图生成版本及旧 v3/v9 存档重建兼容策略 | 10-14 | WF-cloud-deep-review-1014；地图 1000 种子审查与 game/src/core 地图生成链 | 本轮已修复地图图连接缺陷；未擅改随机流或旧版本地图重建规则。需先确定兼容策略再实施布局语义变更 |
| 40 | 「天启剑」与「诛魔剑」的后半效果：集齐两剑后发生什么，以及「以天启诛魔剑覆盖所有武器」如何结算，需定义牌区、数量与替换时点；原规格明确为设计留白 | 10-11 | docs/cards/M-BATCH-HOSTED-DESIGN-2026-09-27.md §2.13/2.14/五；docs/evidence/2026-10-11-card-description-unification/README.md | WF-card-copy-1011 已完成文字整理；展示明确“合成效果尚未定稿”，保留原结算。本条仅为玩法定义，不阻塞文案收官 |
| 38 | 方舟衍生休眠音效保留还是删除 | 10-04 | docs/evidence/2026-10-04-sfx-opensource/README.md；docs/evidence/2026-10-14-WF-ledger-cleanup-1014/README.md | 主链路已换开源；alternatives/arknights 与 arknights-runtime 目录本轮仍存在。原188件是历史数量，10-14获批清理后不可沿用；删除前重新列剩余精确清单，不与已批历史媒体混同 |
| 9 | 照相馆 `?libPerfDiag` DEV 诊断钩子（game.cardslib.page.js）去留：保留=可随时复跑滚动归因五连测，删=一句话即清 | 09-29 | docs/PHOTOLIB-PERF-TASK-2026-09-29.md 遗留3 | 生产构建零开销 |
| 10 | `game/src/e2.snapshot.qa.js` 删留单议（E2 验收宿主遗产，E 批已归档；knip A 类批其余项已执行销账：renderer.icons 位图管线 289→57 行、getHomeForSlot、openAltarRitual re-export、三个无人 default+matchBlank 死导出词、run-architecture 断言清单腐坏项同步修正；dev-shims 改判误报=dev.html importmap 依赖） | 09-29 深夜 | knip 首跑甄别（09-29 深夜会话） | 其余已执行，本条仅剩 e2.snapshot |
| 16 | 自施 debuff 首 tick 语义仍待定：当前挂上后同回合末递减，STS2 跳过首 tick（find-D-0100 R-4） | 09-30 夜班 | 夜班 STS2 对照第二批 + journal 延伸 | 已解释，老板指示「后面做」；不重复催问，实施前确认语义 |
| 24 | `game/tools/agent-batch.mjs` fetch 桥 2 行追认：审计班子代理修 INFRA-04/05 时使能（jsdom 无 window.fetch，旧回落恒拒绝 → llm 批跑静默退化贪心），按原注释意图回落 Node 原生 fetch | 10-01 | docs/evidence/2026-10-01-full-audit-fix-perf/README.md 待拍板节 | 不追认可 2 行回退，但 INFRA-04/05 桩验收随之失效 |
| 28 | 附属工作树是否清理 | 10-01 | docs/evidence/2026-10-14-WF-ledger-cleanup-1014/worktrees-before.txt | 当前Git登记除主仓外15处，含2条prunable及新接入隔离树；原13处/3GB清单已过时。未检查各树未提交内容、未删除或prune；处置前逐树列准确清单和保护方案 |
| 31 | 收据表修剪的重放契约策略如何定版（原审计B-3） | 10-02 | docs/evidence/2026-10-02-code-audit/REPORT.md；archive/WF-ledger-cleanup-1014/originals/docs/PENDING.md | A档清理和B-1已完成，不再待批；B-2走格落盘优化转roadmap。B-3仍需定义重放保留边界，未实施 |
| 32 | 是否安排Git历史瘦身及强推窗口 | 10-02 | docs/evidence/2026-10-02-flow-efficiency/README.md；docs/evidence/2026-10-14-WF-local-cleanup-1014/README.md | 10-14已清理工作区固定历史媒体，未重写Git历史；原体积为历史测量。重写会改变提交SHA并影响协作，仍待选择保守保留或另开迁移窗口 |

## 已决记录（不计入活账）

| 50 | 提交推送遇全量测试133项失败 | 10-21 | WF-github-ship-1021；docs/evidence/2026-10-21-WF-github-ship-1021/README.md | 已决（10-22 终版）：反馈12条批次先修复了其中约7项批准登记类失败，随后老板拍板「提交与推送吧」，不再等全量转绿。10-22 推送 e817a3aa..a677441f（game/tests/tooling/docs 四笔）；本地门禁经 `SKIP_FULL_TESTS=1` 显式绕过、按 UNVERIFIED 记录，全量验证以远端 CI 为准；提交边界与排除清单见 evidence/2026-10-21-feedback-12/README.md 附录。 |

历史决定、旧编号重复和原验收状态保留在[整理前原文](archive/WF-ledger-cleanup-1014/originals/docs/PENDING.md)；本轮逐项处置见[清理记录](evidence/2026-10-14-WF-ledger-cleanup-1014/README.md)。

| # | 事项 | 提出 | 来源 | 备注 |
|---|---|---|---|---|
| 通行证C | 地图使用按卡面发现传说卡 | 10-19 | 老板当前聊天明确“按卡面：从候选中发现并选择一张传说卡”；本批cards证据 | 地图结构化与旧卡入口统一三选一，确认前不消费，候选随源条目保留；B维持随机直授。现行行为见rules.md与save-format.md，自定义描述不覆盖 |
| 卡牌低血代价 | 隧道血契损失5血、塌方采掘点损失3血均足额扣除，允许因此死亡 | 10-19 | 老板当前聊天明确“按卡面足额扣血，允许因此死亡”；WF-card-description-fixes-1019 | 实施接现有非战斗死亡结算，致死后不继续开箱或将状态重置为idle；不再强制保留1血 |
| 49 | 10个旧临时解包/缓存目录已清理 | 10-19 | WF-temp-cleanup-1019；docs/evidence/2026-10-19-temp-cleanup/deletion-receipt.json | 老板批准精确清单，20230文件SHA复核后删除5.25GB，10目录均不存在；6份便携EXE哈希不变、最新解包版及源稿/工具/当前任务保留。5200服务未动，未改游戏/主项目依赖/index，未build/提交/推送 |
| 48 | 无用资源与旧代码203文件清理完成 | 10-19 | WF-unused-cleanup-1019；docs/evidence/2026-10-19-unused-cleanup/README.md | 老板批准执行，203项SHA复核一致后已删除，27.61MiB；资源清单、索引、退役/定稿契约与说明已同步，定向测试通过。保留活跃改动与95项范围外资产登记错误；未build/提交/推送 |
| 47 | 无失败动画两目录清理完成 | 10-19 | WF-wu-animation-revert-1019；docs/evidence/2026-10-19-wu-animation-revert/deletion-completed.json | 原自动审批阻断已随执行权限环境变更解除；沿原批准范围复核220文件SHA后删除rig-v1与wu-battle-rig-20261019两目录并确认不存在，运行维持上一版 |
| 46 | 无战斗骨骼样板已取消，恢复上一版 | 10-19 | WF-wu-battle-rig-1019；docs/evidence/2026-10-19-wu-animation-revert/README.md | v4造型曾获确认，后续动作被老板否决；老板已授权回退并删除本版、原会话归档。运行恢复、原制作停止，目录清理亦已完成见47，不继续绑定或重新接入 |
| 27 | 提交机制旧提案 | 10-14核对 | archive/WF-ledger-cleanup-1014/originals/docs/PENDING.md | 已销账；R1/R2/R4/R6已实施，R3已有定性；R5归#28，不重复挂账 |
| 30 | 状态写入通道选择 | 10-14核对 | docs/evidence/2026-10-02-DEBT-1/characterization.md | 已决；维持已采纳方案A，未启动方案B |
| 45 | 删除两份旧 v6 基地样机 | 10-15 | WF-code-clean-1015；老板在当前聊天批准精确两路径 | 已删除 `game/src/ui/base-design-preview-v6.js` 与 `game/src/hub/hub.navigation-v6.js`；逐件哈希与删除后核对见 `docs/evidence/2026-10-15-WF-code-clean-1015/deletion-receipt.json`；两文件原为未跟踪稿，未改已冻结 index |
| 33 | 删除审批打包（perf-probe 两目录 + martial 4 图） | 10-02 | 本表原 #33；10-15 老板指示「该删除的删除」执行 | 已清理；4图随f6bdaf66落库，13份旧性能探针记录随本轮文档提交；清单删除4条ghost并补登8件运行素材，86件未采用原帧撤清单但留本地。card-art-coverage与完整源码门已通过，未扩大原删除清单 |

#2、#13、#19、#23、#26、#37转[路线图](roadmap.md#历史台账转入的候选与待核验项)，不是等待重复批准。#31已完成部分销账，只保留B-3契约决定。
