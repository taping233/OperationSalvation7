# 整备真实模块 CPU 与完整操作 A/B

本片只修改 game/src/hub/game.hub.depart.js、game/src/hub/departure.view-updates.js，并新增 tests/departure-render-performance.test.js。改前原字节保存在 baseline/。代理收尾时的源码/测试 SHA 见 source-sha256.json。源码已冻结；本代理未改规则、存档、预算、index，未操作浏览器或构建。

主会话集成门随后发现测试的三处 `HTMLTemplateElement` 缺少 ESLint 全局限定，改为 `window.HTMLTemplateElement` 后该文件 ESLint 与15项回归通过；生产源码与正式基准字节不变。最终提交输入见 [code-inputs.json](../integration/code-inputs.json)，原 EXE 构建输入单独保留，不改写既有构建证明。

## 结论与测量口径

25 种库存稳态加一张的中位数从 9.406ms 降至 1.365ms，100 种从 24.674ms 降至 2.844ms。稳态减一张、携带项重排和最后一张额外卡删除也下降。仅主张整备选牌路径收益；初开没有收益结论。

最终由 8 个独立 fork 运行，每场景预热后采样 17 对，baseline/candidate 顺序逐轮交替，每对输入相同且各自重置。steady 操作先完成两次选牌，避免将重置后的首操作冒充稳态。重排场景在同一有效 picks 对象改变键顺序后调用真实选牌 handler；其余增减通过真实 handler/drop 监听，过滤通过真实 change。每个样本完成条件包含受控首帧队列、真实图标 hydration 与 MutationObserver 工作清空。每对严格比较整页 ovBody HTML、卡堆/顺序/数量/按钮/筛选；272 次计时操作输出一致。

实际导入当前 Cards.cardHTML、Art、Icons、overlay、会话容量、整备控制/视图与 DOM；基线为保存的两个原文件，候选为当前生产源码。选角/过渡交接与存档端口受控，声音静默。Node v24.13.0 / Vitest 3.2.7 / Windows jsdom；不包含浏览器布局、绘制/GPU、图片请求与解码。

| 操作（库存种数） | 前 median / p95 ms | 后 median / p95 ms | Element.querySelector 次数 | innerHTML 次数 |
| --- | ---: | ---: | ---: | ---: |
| open.25 | 34.393 / 42.423 | 36.248 / 47.230 | 15→14 | 2→2 |
| steadyAdd.25 | 9.406 / 13.711 | 1.365 / 1.676 | 117→0 | 4→1 |
| steadyRemove.25 | 8.197 / 11.697 | 1.279 / 5.430 | 117→0 | 4→1 |
| lastExtraRemove.25 | 8.554 / 10.023 | 2.355 / 3.431 | 115→0 | 4→2 |
| reorderPicks.25 | 8.490 / 10.063 | 1.313 / 1.919 | 117→0 | 4→1 |
| filter.25 | 0.244 / 0.409 | 0.232 / 0.300 | 0→0 | 0→0 |
| steadyAdd.100 | 24.674 / 31.914 | 2.844 / 3.483 | 267→0 | 4→1 |
| steadyRemove.100 | 23.980 / 27.038 | 2.679 / 7.338 | 267→0 | 4→1 |

首次打开25种的 median 34.393→36.248ms、p95 42.423→47.230ms，原样保留。早期未分 fork 的长矩阵亦出现初开25种 p95 57.7→83.5ms、100种 280→382ms，随后该 jsdom 进程触及堆上限；原因未完全定性，不能据此归因生产泄漏。最初置空 rAF 还会使真实 hydration dirtyRoots 留存，已修正为执行帧队列。旧定位数据 profile.json 已明确标为不可用于最终结论；最终8场景分别退出0，无挑删样本或抬高堆限制。

## CPU 归因与修改边界

CPU profile 使用完成预热的独立 fork，各采20轮“加1→减1”（40次真实操作），每次清空帧/observer队列。原始 .cpuprofile 留在 .tmp/deep-perf-1018/inventory/ab.{baseline,candidate}.{25,100}.cpuprofile；cpu-summary.json 保存字节数、SHA256和采样归因。文件均小于1MB，可按 run-ab.mjs 的同一流程重新获取。

100种基线的前三业务热点按“最近业务帧”互斥归属：updateDepartureView 65.91%、syncRecommendationButtons 15.91%、reconcileBag 9.14%。这些是包含其下 DOM 工作的归属，**不是函数 self 百分比**，不与叶帧 self 类别相加。另一独立视角的叶帧 self 为 jsdom DOM 62.42%、CSS selector engine 11.17%；候选剩余工作主要为当前内容/DOM有效性检查与实际数量更新。完整明细见 cpu-summary.json。稳态实际 cardHTML 为已热缓存调用，原先反复查询/写DOM及丢弃新解析卡面才是主要成本。

process.cpuUsage 单 fork 的 user+system 平均记录在各操作 meanCpuMs。100种加一张 22.882→5.529 CPU-ms/次，减一张 24.941→7.294。Windows计数粒度较粗，部分极短样本记录0；0不表示无CPU工作，不能替代中位数/p95或主线程 self。

- 控制器传结构化携带格描述，视图仅为新增/卡面变化格解析模板；数量变化和重排复用原卡格，不重新绑定。
- DOM根与卡格引用只按 WeakMap 对象身份保存。每次操作重新读库存数量；库存长度/顺序、稳定堆键、完整 card JSON 或 DOM/计数节点归属变化使快照失效并回退完整绘制。没有跨操作库存数量缓存。
- 卡片实例原地改名称/规则说明/费用/类型时，当前 JSON 内容签名生成新的渲染快照，穿透公共 cardHTML 的身份缓存；只保留每个原卡的最新浅快照。内容/删除/插入/重排/variant 改动以及DOM移除均有回归。
- 推荐按钮按当前根保存引用并检查归属，失效后重新定位；容量、资格、动作守卫与推荐规则仍走原逻辑。

## 验证与复现

targeted-tests.json 与 final-targeted-tests.json 合并去重为8文件96项通过；新测试15项。覆盖增减/重排/最后删除、零模板解析与监听复用、同对象属性变化、库存结构/堆键变化、DOM节点被移除、容量拒绝、筛选、推荐、旧动作及重新进入。contracts与architecture-boundaries通过。只读交叉审查未发现生产阻塞；本轮不做浏览器验收。

复现：保留当前依赖，将 reproduction/*.txt 恢复至同名 .tmp/deep-perf-1018/inventory/ 文件，运行 node .tmp/deep-perf-1018/inventory/prepare-ab.mjs、node .tmp/deep-perf-1018/inventory/run-ab.mjs、node .tmp/deep-perf-1018/inventory/analyze.mjs。prepare-ab从 baseline/ 原字节生成私有基线，候选始终读取当前生产文件。逐场景日志 ab.<场景>.log.txt 与原始统计 departure-ab.<场景>.json 保留所有17对分布的统计；没有墙钟阈值测试。
