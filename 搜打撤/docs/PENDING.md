# 待拍板台账（PENDING）

> **规则（09-29 起）**：
> 1. 任何会话产生「等老板拍板/处置」的事项，**即时**登记一行（一事一行，注明来源与需要的决定）；拍板后回写来源，将记录移至「已决记录」，不混入活账、不抹除决策依据。
> 2. 台账只收**等决策/等处置**的活账；未排期 backlog、需求想法不入（各归 roadmap / 战役文件）。
> 3. 删除先列具体路径清单获批；台账仅批准方向而未给清单时补清单，清单已获批且范围未变沿用授权，不重复确认。提交/回滚/发布等授权仍独立。
> 4. 记忆只放指针。事项识别来源/对象/需要的决定以避免重复登记；普通修复 backlog 移路线图并留回链，已授权实施归任务记录，不重新挂成等待批准。

## 活账

| # | 事项 | 提出 | 来源 | 备注 |
|---|---|---|---|---|
| 1 | `docs/evidence/` 内 perf-probe-photo、perf-probe-run 两目录（53K）已入库仍 tracked，删否 | 09-29 夜班 | 记忆 soudache-night-long-run-2026-09-29 | |
| 2 | 战斗右键弹反馈浮层做否（历史挂账功能） | 09-25 | 记忆 soudache-continuous-refactor-2026-09-25 | |
| 3 | 死图 7 张待批删（卡面重出审计豁免之外） | 09-23 | 记忆 soudache-card-redraw-audit-2026-09-23 | 动手前列清单 |
| 4 | 三份 PARALLEL 盘点文档未跟踪，处置方式 | 09-27 | 记忆 soudache-engineering-e-line-2026-09-27 | |
| 5 | photo-nail 待处置 | 09-19 | 记忆 soudache-cardlib-gallery-40 | |
| 6 | martial-builtin-sha 死图待批删 | 09-19 | 记忆 soudache-starter-attack-rename-2026-09-19 | 动手前列清单 |
| 7 | 僵尸 Vite：`.exp-observe/` 5199 端口（PID 21256，09-25 起）杀否 | 09-28 | 记忆 soudache-exp-tri-track-2026-09-28 | 先 tasklist 验身份再杀 |
| 9 | 照相馆 `?libPerfDiag` DEV 诊断钩子（game.cardslib.page.js）去留：保留=可随时复跑滚动归因五连测，删=一句话即清 | 09-29 | docs/PHOTOLIB-PERF-TASK-2026-09-29.md 遗留3 | 生产构建零开销 |
| 10 | `game/src/e2.snapshot.qa.js` 删留单议（E2 验收宿主遗产，E 批已归档；knip A 类批其余项已执行销账：renderer.icons 位图管线 289→57 行、getHomeForSlot、openAltarRitual re-export、三个无人 default+matchBlank 死导出词、run-architecture 断言清单腐坏项同步修正；dev-shims 改判误报=dev.html importmap 依赖） | 09-29 深夜 | knip 首跑甄别（09-29 深夜会话） | 其余已执行，本条仅剩 e2.snapshot |
| 13 | 照相馆照片在 Vite 主线 dev 服全黑：页面相对路径 `assets/thumbs/*.webp` 解析到 `/game/assets/*` 被 SPA fallback 回 text/html（16/16 naturalWidth=0），绝对路径 `/assets/*` 有映射正常；8137 类静态服（game/ 即根）不受影响。修不修（改绝对路径/加 Vite 映射）等拍板 | 09-29 深夜 | CSS 精修班顺带发现（docs/evidence/css-dedupe-2026-09-29/README.md 顺带发现①；HEAD 版 A/B 同现=既有问题） | 影响：以后在 Vite 主线服做照相馆实页验收会被照片黑块干扰 |
| 16 | 自施 debuff 首 tick 语义仍待定：当前挂上后同回合末递减，STS2 跳过首 tick（find-D-0100 R-4） | 09-30 夜班 | 夜班 STS2 对照第二批 + journal 延伸 | 已解释，老板指示「后面做」；不重复催问，实施前确认语义 |
| 19 | 终局短路深化：文本路径句内多动词不做句内中断（单 immediate 句内步级不查全灭守卫），修复单已披露（fix-U16-0500）——要完全对齐 STS2 需句级守卫另开单元；遗留 dmg 字段路径（resolution:742-872）维护者后续改动时需复评（R10 NOTE） | 09-30 | 夜班 U16 复审 R10 | |
| 20 | finish(false)→terminalPending 异步窗口内 beforeunload 可把 run 级负 hp 写入存档（旧语义写 0 同类窗口，危害 0→负升级，概率低；bag.settle.js:34 onBattleEnd async 间隙，hub 域处置）——R12 移交①挂账成立 | 09-30 | 夜班 U18 复审 R12 | |
| ~~21~~ | 已实施：`scripts/iab-drive.mjs` 由 WF-acceptance-scenes 收编纳管（owner 补齐+runScene 一行式），内置桥端到端已验（battle/smoke/shop/chest/fire 五场景实机过） | 09-30 挂账；10-01 老板拍板收编 | 证据 docs/evidence/2026-10-01-acceptance-scenes/；口径落 docs/quality-gates.md 内置浏览器节 | 完结 |
| ~~25~~ | 部分完成：event 实机过（664ms）、extract 机制全链路验证（跳层/BFS/战斗/死亡收束全通），fullrun 同链路依赖；实机补跑不受 HMR 阻断（审计会话已收官） | 10-01 | docs/evidence/2026-10-01-acceptance-scenes/README.md | 剩余收口归 #26 |
| 26 | 疑似游戏 bug：宝箱搜刮页多箱队列中 `chestSkip`/`chestTake` 点击 handler 返回 ok 但队列不推进（实机实测连点 40 次全空转，spin 熔断；单箱场景 chest 正常）——玩家手动点「只收金币并离开」预计同样卡。影响 extract/fullrun 剧本完整收口。需定性 chests.js 的 next()/queue 状态机 | 10-01 | docs/evidence/2026-10-01-acceptance-scenes/README.md 坑 8（trace 证据在案） | 定性修复后 extract/fullrun 重跑销账 |
| 23 | 性能优化遗留两项是否排期：F11 启动链动态 import 拆包（47k 行 ESM 解析几十 ms；牵动 boot-order 契约与初始化时序）、F1 全量版快照签名代际缓存（战斗状态写入通道无统一信号——set$ 赋值与数组原位变异并存，代际会漏事件产出陈旧快照；已用 getBattleLiveness 轻查询覆盖其热路径） | 10-01 | docs/evidence/2026-10-01-full-audit-fix-perf/README.md 第二轮 | 评估后暂不实施（回归风险>收益）；其余 F1 局部/F3/F4/F5②/F9/F12/F8 补充均已实施，F5③ 已有封顶 |
| 24 | `game/tools/agent-batch.mjs` fetch 桥 2 行追认：审计班子代理修 INFRA-04/05 时使能（jsdom 无 window.fetch，旧回落恒拒绝 → llm 批跑静默退化贪心），按原注释意图回落 Node 原生 fetch | 10-01 | docs/evidence/2026-10-01-full-audit-fix-perf/README.md 待拍板节 | 不追认可 2 行回退，但 INFRA-04/05 桩验收随之失效 |

## 已决记录（不计入活账）

| # | 事项与结果 | 决策时间 | 来源 | 后续 |
|---|---|---|---|---|
| ~~8~~ | 已处置（老板拍板「其他的全部落库」+三项明细确认）：`.codex/config.toml` 与 `项目近况-2026-09-29/` 入库、`.ui-art-loop-0925/nai-out` png+json 入库（NAI 原始 zip 入 ignore）、`.photolib-acc` worktree 经三文件 diff 核对与主仓库 HEAD 一致（三期内容均已随 d2c0d0a 落库）后移除（303M 释放）；另 `.sfx-work/`（明日方舟音频 120M，版权素材）老板拍板不入库，入 ignore；随 `2fefeff` 落库 | 10-01 | 本台账 + 老板会话 AskUserQuestion 拍板 | 完结 |
| ~~22~~ | 已实施：老板授权修复全量 3 红灯——hub-flow-regression 源码形状守卫放宽为有界顺序断言（合法音效插入不再误红，CRLF 教训同族）、boot.test 超时 5s→20s（根治负载 flake）、m7-battle 前会话已修；全量 266 文件/2131 通过/2 跳过/0 失败 EXIT=0（并行 84.5s），修复后首次全绿 | 10-01 | 老板「之前那个红灯你也可以修掉」 | 完结；变异演练另发现 pets 数值覆盖空洞（全链路无人测），归 backlog 另议 |
| ~~14~~ | 已实施：老板拍板 STS2 式全灭短路，foesAnnihilated 循环守卫及字段兜底，onKill/吸血 rider 原子保留；历史 219 例 + 新 5 例，`8db5b19`，R10 PASS | 09-30 | 夜班 STS2 对照第二批 + journal 延伸 | 完结；句内深化 #19 仍待决 |
| ~~15~~ | 已实施：老板拍板负血 + 即时死亡；免死钩照旧、展示钳 0、快照真实值；`4f0fae5`，R12 PASS | 09-30 | 同上 | 完结；保存窗口 #20 仍待决 |
| ~~17~~ | 已实施：老板拍板主档 corrupt 时回退同链 prev 并逐字节自愈，tooNew 不回退；历史 8 例，`8f6756c`，R11 有保留通过，其 F1 已修 | 09-30 | 夜班 U5 复审 R4 + journal 延伸 | 完结 |
| 18 | 无 IME 守卫的极窄 moveCancel 入口，属于未排期 P3 修复，09-30 按本台账职责转 [roadmap](roadmap.md#流程工具与未排期修复) | 09-30 分类核对（非玩法拍板） | 夜班 U3 复审 R2 | 未实施，保留原问题与风险说明在路线图 |
| ~~11~~ | **已执行销账（09-29 深夜，老板批「删除c类」）**：set$×25 定义行全删（effects 13/piles 4/presentation 7/session 1），守卫测试 2 增 SETTER_EXEMPT 豁免清单（25 字段+写入通道注释）；白名单 90 let 不动（字段活，写入走文件内赋值/引用变异）；守卫+facade+architecture 定向 17/17 绿，knip 残留 set$=0，全量仅负载 flake 定向复绿 | 09-29 深夜 | knip C 类批（STATUS 当时记录；词边界甄别与 ugrep 锚点坑） | 完结 |
| ~~12~~ | **已执行销账（09-29 深夜，老板批「按步骤做」，档一）**：新建 ui/terminal-settlement.js 消 death⇄menu 25 行×2（UI 参数注入对齐 menu 控制器 mock 契约与 facade-snapshot-drift 守卫）；battle.resolution 抽 applyLifesteal 消结构化/文本双轨 13 行；**评估后放弃**：cards.sync ensureXxx 模板（09-29 mechanism consolidation 刚产出的声明式配置，非坏重复）、pickTargets 等 3 块（双轨过渡+核心逻辑）、顺手级 3 文件（收益/风险比不划算）。定向 64 用例绿，jscpd 87→83 块/734→696 行（1.07%→1.02%）；报告=docs/evidence/jscpd-2026-09-29/（before+after）。CSS 骨架层（card-v3⇄winter 109 行、page 系 ~93 行）避照相馆验收期另议 | 09-29 深夜 | 同左 | 完结（CSS 档另议） |
