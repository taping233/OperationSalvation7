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
| ~~11~~ | **已执行销账（09-29 深夜，老板批「删除c类」）**：set$×25 定义行全删（effects 13/piles 4/presentation 7/session 1），守卫测试 2 增 SETTER_EXEMPT 豁免清单（25 字段+写入通道注释）；白名单 90 let 不动（字段活，写入走文件内赋值/引用变异）；守卫+facade+architecture 定向 17/17 绿，knip 残留 set$=0，全量仅负载 flake 定向复绿 | 09-29 深夜 | 同上（python 词边界甄别+ugrep `$` 锚点坑已绕） | 完结 |
