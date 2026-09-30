# 待拍板台账（PENDING）

> **规则（09-29 起）**：
> 1. 任何会话产生「等老板拍板/处置」的事项，**即时**在此登记一行（一事一行，注明来源）；拍板后销账——删行并在来源条目补记拍板结果与时间。
> 2. 台账只收**等决策/等处置**的活账；未排期 backlog、需求想法不入（各归 roadmap / 战役文件）。
> 3. 删除类事项执行前仍按「删除必先报批」走：老板在台账点头后，动手前列具体路径清单再确认一次。
> 4. MEMORY 速览表只放指针到这里，不复制条目。

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
| 8 | 工作树未跟踪杂项去留：`.codex/`、`.ui-art-loop-0925/`、`项目近况-2026-09-29/` | 09-29 | git status | 认领或报批删 |
| 9 | 照相馆 `?libPerfDiag` DEV 诊断钩子（game.cardslib.page.js）去留：保留=可随时复跑滚动归因五连测，删=一句话即清 | 09-29 | docs/PHOTOLIB-PERF-TASK-2026-09-29.md 遗留3 | 生产构建零开销 |
| 10 | `game/src/e2.snapshot.qa.js` 删留单议（E2 验收宿主遗产，E 批已归档；knip A 类批其余项已执行销账：renderer.icons 位图管线 289→57 行、getHomeForSlot、openAltarRitual re-export、三个无人 default+matchBlank 死导出词、run-architecture 断言清单腐坏项同步修正；dev-shims 改判误报=dev.html importmap 依赖） | 09-29 深夜 | knip 首跑甄别（09-29 深夜会话） | 其余已执行，本条仅剩 e2.snapshot |
| 13 | 照相馆照片在 Vite 主线 dev 服全黑：页面相对路径 `assets/thumbs/*.webp` 解析到 `/game/assets/*` 被 SPA fallback 回 text/html（16/16 naturalWidth=0），绝对路径 `/assets/*` 有映射正常；8137 类静态服（game/ 即根）不受影响。修不修（改绝对路径/加 Vite 映射）等拍板 | 09-29 深夜 | CSS 精修班顺带发现（docs/evidence/css-dedupe-2026-09-29/README.md 顺带发现①；HEAD 版 A/B 同现=既有问题） | 影响：以后在 Vite 主线服做照相馆实页验收会被照片黑块干扰 |
| ~~14~~ | **已实施销账（09-30 老板拍板「改成 STS2 式」）**：foesAnnihilated 单一谓词于三处 op 循环入口 break+字段兜底，敌人全灭中止同卡余下效果；onKill/吸血 rider 原子保留；既有 219 例零断言变更+新 5 例（8db5b19，R10 PASS） | 09-30 夜班 | 夜班 STS2 对照第二批 | 完结；句内深化见 #19 |
| ~~15~~ | **已实施销账（09-30 老板拍板「对齐 STS2 负血+即时死亡」）**：受伤不钳 0（数据层负血保留），hp<=0 当拍 finish(false)（自己回合自伤致死同样触发、死了即死）；deathSave 免死钩照旧；展示层钳 0、快照真实值；存档恒正核实（4f0fae5，R12 PASS） | 09-30 夜班 | 同上 | 完结；saveGame 窗口见 #20 |
| 16 | 自施 debuff 无 SkipNextDurationTick：「当回合挂上、同回合末即被递减 -1」（find-D-0100 R-4，combat.js tickDurations 走共享回合钟）。STS2 对玩家自施 debuff 跳过首 tick。**09-30 已向老板解释语义，等拍板** | 09-30 夜班 | 同上 | 解释见 09-30 汇报 |
| ~~17~~ | **已实施销账（09-30 老板拍板「读档失败自动回退上一版」）**：主档 corrupt 且非事务时读 prev 同链校验，原串逐字节写回自愈（_r2 保真）；tooNew 不回退（R11 口径：过新档零备份保留等新版程序读）；8 用例（8f6756c，R11 PASS-WITH-RESERVATIONS 其 F1 已按口径修复） | 09-30 夜班 | 夜班 U5 复审 R4 备注 | 完结 |
| 18 | closeTopOverlayByEsc moveCancel 链（game.boot.js:183）函数级无 IME 守卫——暴露面极窄（body 焦点+输入法组合态+overlay 开三条件叠加，现实难触发；overlay 捕获链 ui.js:78 与输入焦点守卫 boot.js:158 已双层覆盖）。P3 立档，做否等排期 | 09-30 夜班 | 夜班 U3 复审 R2 建议 | |
| 19 | 终局短路深化：文本路径句内多动词不做句内中断（单 immediate 句内步级不查全灭守卫），修复单已披露（fix-U16-0500）——要完全对齐 STS2 需句级守卫另开单元；遗留 dmg 字段路径（resolution:742-872）维护者后续改动时需复评（R10 NOTE） | 09-30 | 夜班 U16 复审 R10 | |
| 20 | finish(false)→terminalPending 异步窗口内 beforeunload 可把 run 级负 hp 写入存档（旧语义写 0 同类窗口，危害 0→负升级，概率低；bag.settle.js:34 onBattleEnd async 间隙，hub 域处置）——R12 移交①挂账成立 | 09-30 | 夜班 U18 复审 R12 | |
| 21 | `scripts/iab-drive.mjs`（ZCode 内置浏览器驱动函数库，未跟踪）归属不明——认领或报批处置 | 09-30 | 收尾提交盘点 | |
| ~~11~~ | **已执行销账（09-29 深夜，老板批「删除c类」）**：set$×25 定义行全删（effects 13/piles 4/presentation 7/session 1），守卫测试 2 增 SETTER_EXEMPT 豁免清单（25 字段+写入通道注释）；白名单 90 let 不动（字段活，写入走文件内赋值/引用变异）；守卫+facade+architecture 定向 17/17 绿，knip 残留 set$=0，全量仅负载 flake 定向复绿 | 09-29 深夜 | 同上（python 词边界甄别+ugrep `$` 锚点坑已绕） | 完结 |
| ~~12~~ | **已执行销账（09-29 深夜，老板批「按步骤做」，档一）**：新建 ui/terminal-settlement.js 消 death⇄menu 25 行×2（UI 参数注入对齐 menu 控制器 mock 契约与 facade-snapshot-drift 守卫）；battle.resolution 抽 applyLifesteal 消结构化/文本双轨 13 行；**评估后放弃**：cards.sync ensureXxx 模板（09-29 mechanism consolidation 刚产出的声明式配置，非坏重复）、pickTargets 等 3 块（双轨过渡+核心逻辑）、顺手级 3 文件（收益/风险比不划算）。定向 64 用例绿，jscpd 87→83 块/734→696 行（1.07%→1.02%）；报告=docs/evidence/jscpd-2026-09-29/（before+after）。CSS 骨架层（card-v3⇄winter 109 行、page 系 ~93 行）避照相馆验收期另议 | 09-29 深夜 | 同左 | 完结（CSS 档另议） |
