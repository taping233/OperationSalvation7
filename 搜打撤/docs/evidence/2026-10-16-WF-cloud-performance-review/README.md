# 云端包体与首屏审查：先收一项确定的大头

已按主任务追加授权实施两项小范围变更：生产发布/预取清单省略五套退役宝箱 rig，取消 Noto 回退字体的两条强制预载。所有源素材、现用 safe-simple-v7 帧与字体保留，预算阈值和玩法未改。8 个定向测试文件共 79 项通过；未 build，不能宣称四项预算已通过。

第二步已追加实施 deployPick 纯状态抽离，详见 [第二步交接](deploy-selection/README.md)。该交接同时记录当前并行战斗改动触发资产审定保守回退的状态；第一步体积投影不可当作当前混树新构建实测。

## 基线与验证边界

- 仓库基线：f0e84c5dc34afcbc1176b1519258d2c3010c62cb；Node 22.23.3，现有锁依赖
- 复用主任务的[既有构建证据](../2026-10-16-WF-integration-ship-1016/build-budget-comparison.json)：package 144.58/112 MiB，entry gzip 329.6/270 KiB，initial JS 375/310 KiB，CSS 200.1/136 KiB
- 本轮先只读审查，收到精确实施授权与安全重载窗口后才修改源码；5300 服务与浏览器始终由主任务负责
- 不运行 build、pretest 或全量测试；不启动、重启或停止服务；不操作浏览器；不提交、推送或删除文件
- `game/src/generated/*-manifest.js` 未手改，也未由本轮生成。当前 dev 清单仍含旧 rig，生产清单减负须在下一次主任务统一构建时生效

## 已实施：精确省略退役宝箱发布与预取

当前 `chest-opening-art.js` 为 small/medium/large/class/boss 全部使用 safe-simple-v7 的 4 张帧图和 burst。`chests.js` 只有这一默认装配，运行时源码没有 `configureFrameArt` 调用。排除生成清单后，game/src、game/css、game/data、主入口及其他 game HTML 对五套旧 rig 名称零引用。

仅把以下 5 个目录内的 frame-00 至 frame-17 共 90 个明确文件加入既有审定类别机制，没有按日期或宽泛目录删素材：

- scenes/chests/small-rig-640-v1/
- scenes/chests/medium-rig-640-v1/
- scenes/chests/large-rig-640-v1/
- scenes/chests/class-rig-640-v1/
- scenes/chests/boss-rig-640-v1/

90 个源文件共 20,222,734 字节；其中 15 个等字节副本原本已有发布别名，不能重复计算收益。本次新增实际省略的发布/预取实体是 75 个，16,905,604 字节，约 16.12 MiB。以原产物 144.58 MiB 投影，约降到 128.46 MiB，距离 112 MiB 仍差约 16.46 MiB。该投影不是新构建实测值。

保护机制：

1. `chests` 类别锁定当前两份选择器源码指纹；选择器变动、缺失或新增不透明动态路径，保守恢复相关发布
2. 旧 rig 与新 safe 帧共用 frame-00 等文件名，引用检查以明确旧 rig 目录名区分，避免误把 safe 帧判为退役资源
3. Vite 注入的生产别名字典同时排除被省略路径及正本，避免别名字典残留指向缺件；真实源验证由 19 条减少至 4 条，其余常无欲/口粮别名保留
4. 配置期别名字典、buildStart 清单和 closeBundle 完整模块图必须一致；选择在阶段之间变化立即失败，不能生成不一致产物
5. safe-simple-v7 的 4 帧和 burst 全部存在、不在排除集合；90 张旧源图 SHA256 全保持

具体源文件、字节和 SHA256 见 [精确清单](chest-candidates.json)，只读验证见 [implementation-verification.json](implementation-verification.json)。

## 已实施：回退字体按需请求

仅从 game/index.html 移除 notosans-sc-400.woff2 与 notosans-sc-700.woff2 的 preload。base.css 的两份 @font-face、字体优先级、主字体预载和全部字体文件不变。两文件共 509,372 字节，约 497.4 KiB，避免首页无条件争用这些回退字体的带宽；若当前文字确实需要回退，浏览器仍可按需请求。它不减少发布包体，也不等于已测得首屏时延改善。

## 后续方案：按风险与真实收益排序

### 1. 下一步建议：解除 deployPick 的静态反穿

`game.hub.js:29` 为重新导出 `deployPick`，静态引入整个 `game.hub.depart.js`，后者引入整备视图、卡牌浏览器、基地 Home 等。Acorn 图切断这一条边后，11 个模块退出初始静态闭包，78,283 字节源码，逐文件源码 gzip 合计 27.1 KiB。

建议把 deployPick 与 setter 移到一个无 DOM、无 CSS 的小状态模块，门面和 depart 引用同一个 live binding；保留外部导出名、setter 的输入规范化和原有身份/取消逻辑。不要把整个整备入口改成随意延迟回调，也不要移除架构守卫。

需要同步修改 hub-architecture.test.js 里当前刻意锁定旧静态导入的断言，用状态单源与“初始图不触达 depart”替代；再覆盖 hub-lazy-entry、departure-browse-state、departure-stack-lifecycle、base-hub-business-lifecycle 与真实选档→整备→返回→再进入。此项本轮未实施，等主任务分配。

源码 gzip 是排序信号，不能等同 Rollup 后可节省体积。当前 entry 与 initial JS 分别超 59.6/65.0 KiB，这一项单独未必能收口。

### 2. Agent 装配链：有潜力，不能直接改掉同步 API

`game.boot.js:25` 静态装载 agent.js。只切这条边时，11 个独占模块退出初始图，142,903 字节源码，逐文件源码 gzip 合计 58.2 KiB；这是比继续调 manualChunks 更有意义的候选。

但 Agent.observe、policies、场景目录和若干调用是同步契约；recorder/stats 又由菜单和正常游戏独立使用。只懒载 policy 没有效果，agent.llm 仍会静态引回它。不能简单对整个 Agent 用 import() 后立刻宣称兼容。

建议先保留同步轻门面/观测/录制，针对异步 step、autoRun、LLM、场景执行的完整首次调用链设计加载边界，显式缓存、重试、并发占用和取消；同时审查启动前外部工具的可用性。现有 scenes runtime 已动态加载，不重复计算其旧收益。需要 Agent 相关行为测试和真实首调，再统一构建量化。本轮只提供建议。

### 3. CSS：首屏负担与总预算是两个不同问题

主入口有 40 份 HTML stylesheet；加 JS 静态 CSS 和 @import 后，初始图触达 87 个 CSS 源文件、1,288,333 字节。基地轻门面的 21 份 CSS 就有 249,662 字节源码，逐文件源码 gzip 合计 49.4 KiB，即使基地 JS 懒加载也仍在启动 CSS 中。

可以在下一轮把基地专属样式按既有顺序装入一个持久的基地样式入口，并在首次 render 前等待就绪；首进、快速取消、失败重试、基地→照相馆→设置，以及全局卡面/覆盖层级联都需验证。不能只把 import 随意挪到动态模块，现有 hub-lazy-entry 明确守护了静态加载顺序。

更重要的是 perf-budget.cjs 累计产物里全部 .css 的 gzip，CSS 懒加载本身不能让总量从 200.1 降到 136 KiB。要过这个预算，仍需在保持最终 computed style 的条件下，逐域整合旧样式层、不可达规则与覆盖声明。

现有只读审计的结果：

- 主入口级联同选择器/属性覆盖候选 356 条、10,003 字节原文；不能当删除清单，且不足解释 64.1 KiB gzip 超额
- 全部 130 个 CSS 文件的同文件候选只剩 23 条、358 字节原文，主要在独立预览样式
- 既有 standalone CSS minifier 已接入，不能把其历史约 8 KiB gzip 收益再算一遍

先从 winter.css、scenes.css、base-camp 与战斗多层样式做各页面最终规则账本，再选择一个区域重构；任何未测的选择器不能自动视为死代码。证据见 [入口候选](css-entry-redundancy.json) 和 [同文件候选](css-local-redundancy.json)。本轮未修改任何 CSS。

### 4. 余下包体：不要继续追重复文件的小数点

只读发布复制投影中，现有别名/排除后的等字节副本约 16.2 KiB，主要是小图标和两份角色 metadata。最大几组同字节图片已经由既有规则处理，无法靠继续去重补齐剩余约 16.46 MiB。

HarmonyOS Regular/Bold 两份 TTF 共 16,420,124 字节，约 15.66 MiB，但仓内许可强调未修改分发、禁止修改组件，不能直接把转 WOFF2/子集化当作已批准的安全压缩。除非取得可用的官方文件/明确许可，否则保持当前文件；本轮没有转换或替换字体。

可另立小任务核对实际被 Vite 引用的大 PNG（例如 title-wordmark、title-plaque-metal、传奇照相馆框）是否适合保持像素与 alpha 的无损编码，并验证色彩/透明边与许可；未编码，不给虚构节省率。部分体积很大的 photo-studio 旧 PNG 当前无运行时引用且不在复制目录，不能把删它们的源码字节记作发布收益。

## 实际验证

- 8 文件 79 测试通过、0 失败/跳过：runtime-asset-redundancy、redundancy-plugin、aliases、publication、asset-url-aliases、rations-thumbnail-alias、contracts、architecture-boundaries
- 测试直接运行 Vitest，未走 npm pretest；Vite hooks 的发布测试使用虚拟文件系统，没有运行真实清理、生成或复制
- 定向 ESLint、7 个源码/测试路径的 diff whitespace 检查通过
- 真实源只读扫描：146 排除、0 警告；旧源 SHA 保持；生产别名字典无缺件目标；safe 5 资源均保留
- generated manifests、素材、CSS 与 hub 源码本轮无差异；源码修改仅见下一节
- 未核：真实构建/包体与四预算；生产端缓存/预取/字体请求；真实开箱与字形浏览器验收由主任务统筹

测试原始结果见 [target-tests.json](target-tests.json)、[target-tests.log](target-tests.log)、[lint.log](lint.log)。静态图的前后快照见 [source-analysis.json](source-analysis.json) / [source-analysis.after.json](source-analysis.after.json)。分析器仅做 Acorn 可达性、源码 gzip 与文件清单读取，不执行 bundler/tree-shaking；这些源码体积不能替代产物实测。

## 精确交付路径

- scripts/runtime-asset-redundancy-review.mjs
- scripts/runtime-asset-redundancy.mjs
- vite.config.js
- game/index.html
- tests/runtime-asset-redundancy.test.js
- tests/runtime-asset-redundancy-plugin.test.js
- tests/runtime-asset-publication.test.js
- 本目录的分析、清单与验证证据

所有修改完成未提交；服务/浏览器不归本子任务管理。完整预算仍待主任务在稳定节点构建，不能将本次定向通过称为全量或发布通过。
