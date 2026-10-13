# 非实页失败分簇修复第二批（2026-10-13）

## 目标与基线

老板要求继续处理上一批留下的非实页问题。本批延续 [第一批记录](../2026-10-13-WF-nonbrowser-repairs-1013/README.md)，保留其完成未提交差异。输入是上一批修复中途的全量 Vitest 日志：350 文件中 26 败、2941 用例中 49 败、1 个 worker 超时；该全量运行早于第一批后续多项定向修订，不能把数量当作当前失败数。任务范围和完成标准见 [task.json](task.json)，编辑占用见 [REGISTRY](../../PARALLEL-REGISTRY.md)。

本批先并行定向核对基地导航/仓库、路线图覆盖和 Agent 批跑超时三个不相交失败簇；实页验收按老板要求暂缓。不据旧失败直接修改生产规则，先核对当前源码、既有未提交 diff 和现行测试契约。

## 已完成的第一组

- 基地导航与仓库：`tests/hub-flow-regression.test.js`、`tests/hub-pages-rework.test.js` 的 9 项失败含旧 DOM/导航/交易所断言；`game/src/hub/hub.warehouse.js` 补木材、口粮查看入口，`game.hub.js`、`game.hub.pages.js` 传递来源按钮以恢复特写关闭焦点。修后两目标加相邻交易所 35/35 通过；架构、Home 异步及两目标复核 32/32 通过，`game.hub.js` 为 428 行（契约要求少于 430）。未实页验收。
- 路线覆盖：现行首层“先战斗后火堆”质量门使 `r5-check-90` 重试整图，安全降级由 37 变为 38。仅更新 `tests/r5b-route-overlay.test.js` 的固定计数和原因注释，路线及邻近地图 37/37 通过，未改生成器。
- 卡牌迁移：10-10 老板批准绿化箭改名回音箭；v37 同步卡增至 57 张，回音箭已携带定版 M2 规则。旧 E6/E8/M/M2 测试基线与之脱节；仅更新 `tests/e6-card-rules-capability.test.js`、`tests/helpers/card-catalog-approved-revisions.js`、`tests/m2-data.test.js`，保留授权范围和规则逐键断言。目标四文件 68 过、1 跳，相邻三文件 53/53 通过；未改运行卡数据或 `cards-sync.json`。
- 工具诊断：`tests/asset-audit.test.js` 的仓库级零错误断言仍被 273 项真实未登记素材阻断。`tests/agent-batch-llm-timeout.test.js` 当前子进程 0 退出，却没有启动日志、`runs.jsonl` 或 LLM 桩命中；本轮不能据此判断 runner 超时收口，未改批跑实现。该项应另批先定位启动链。

## 已完成的第二组

- 基地动效：`tests/base-motion-v4.test.js`、`tests/base-ui-sample.test.js` 的 4 项旧预期仍按旧翻页动效、玻璃透明度写入和仓库卖出入口检查；现行按钮/同页区域动效与交易所职责已明确。仅修这两份测试，连同架构和 Home 异步测试 25/25 通过，未改游戏实现。
- 宝箱退出：`tests/nightshift-u10-teardown-guards.test.js` 的单卡夹具点击了只在多卡时出现的 `chestTake`；改为当前单卡的 `chestContinue` 并保持 document 拆除与待触发音效定时器检查。含邻近宝箱、结算测试 5 文件 30/30 通过，未改 `chests.js`。
- 毒箭附加中毒：G05 已定“附加效果绑定原目标”，前段击杀后不转移旁人。`tests/ember-burst-rot-seed.test.js` 的旧旁人 1 层断言改为 0，保留原目标死亡及无腐化之种转移日志断言；连同四线语义回归 18/18 通过，未改战斗或卡牌数据。

## 第二批全量复核

以上两组完成后直接对当前混合工作树运行 `npx vitest run --reporter=dot`，退出 1：[原始日志](full-vitest.log) 330,782 字节，SHA256 `03F79B7EE43450F5404EA08CF3BED301A0B9FFE073789ED4505345E4198FFC5A`。350 文件中 342 过、8 败；2942 用例中 2917 过、13 败、12 跳过，无 worker 超时。失败文件为 `achievement-gallery`、`agent-batch-llm-timeout`、`asset-audit`、`boot`、`card-library-performance-contract`、`departure-browse-state`、`message-batch-0920-late`、`premium-ui-pages`。此结果仍属混合未提交工作树，不是可发布版本验收。

## 全量复核后的定向处理

- `achievement-gallery` 与 `departure-browse-state` 的 3 项旧预期分别对应现行奖章空态文案及 `startDepartureHandoff` 延后提交时序；仅改两测试，目标与相邻出征回归 23/23 通过。
- `boot` 与 `card-library-performance-contract` 的 3 项失败来自 jsdom 滚动补桩、旧仓库返回按钮路径、旧预览容器和新增 `preparePhotoStudioEntry` mock 缺失；仅改两测试，22/22 通过，未改照相馆实现。
- `message-batch-0920-late` 旧内联场景断言改查 `scenes.json` 元数据；`premium-ui-pages` 的人物 v12、收藏六项目录和现行暗房材质三项旧守卫已对齐，目标过滤运行 4/4 通过。照相馆可见馆名与独立馆藏总数确实缺失，保留该测试并单独修复页面源码。
- 照相馆门头：`game/src/hub/game.cardslib.page.js` 在现有工具区恢复可见“照相馆”和独立“馆藏 N 张照片”；`game/css/photo-studio-unified.css` 只补该区排版，不动两列分类网格。`premium-ui-pages` 现行语义检查 9/9 通过，关联 boot/性能过滤运行通过，ESLint、PostCSS 解析及 diff 检查通过。按老板要求未做实页，实际视觉排布未验证。

## 本批最终全量复核与阻断

门头补丁后重跑 `npx vitest run --reporter=dot`：[原始日志](full-vitest-final.log) 90,018 字节、SHA256 `31CE4FFFF5F02A886466266697DE3976FFD4A1F1C358C849BB8FA148D8B51387`，退出 1。350 文件中 348 过、2 败；2942 用例中 2928 过、2 败、12 跳过，无 worker 超时。仅余：

1. `tests/asset-audit.test.js` 仓库级零错误断言被 273 项未登记素材阻断；其中大量未跟踪候选尚缺来源/归属，不能据文件存在直接写入清单。
2. `tests/agent-batch-llm-timeout.test.js` 的子进程 0 退出但未产生启动日志、`runs.jsonl` 或 LLM 桩请求；该测试尚未走到目标 runner 超时逻辑。Vite-node 简单脚本可执行，批跑入口静默退出的原因本批未定；按项目 10 分钟边界停止深挖，未改 runner。

这两个阻断之外仍有 12 项既有跳过用例。全量结果来自混合未提交工作树，不能等同可发布版本；本批未 build、实页、提交、推送或发布。
