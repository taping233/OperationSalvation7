# 性能专项审计报告（子代理 A，只读）

**日期**： 2026-10-01 · **范围**： `game/src`（249 个 JS 文件 / 47,320 行）+ `game/css` 抽查 · **方法**： rg/grep 定位模式（定时器/rAF、innerHTML、getComputedStyle/offsetWidth/getBoundingClientRect、JSON 序列化、Observer、document 级监听、CSS keyframes 属性枚举），逐处读上下文确认真伪热点，剔除有循环变量守卫/低频路径的误报。

**总体结论**： 该代码库性能意识很高——主循环空转 4Hz（game.boot.js:401-511）、覆盖页停画、战斗手牌/单位常驻层签名差分（battle.layers.js）、卡牌库 IO 窗口化（cardslib.page.js）、Pixi 层 30fps+脏标记跳帧（battle.frames.js）、存档指纹缓存（game.storage.js）都已落地。**未发现泄漏级 rAF/interval**（aim/frames/lab.ending 均有清理）。剩余热点集中在：**getSnapshot 每次调用的全量深遍历签名**、**背包拖拽未合帧**、**双全局 MutationObserver**、**战斗期同步存档**四项。

---

## 一、发现清单（按影响排序）

### F1. getSnapshot() 每次调用都做全量快照深遍历签名（拖拽期每帧 2+ 次）— 影响中高 【可无损优化】
- **证据**： `battle/core/battle.engine.js:306-312` —— `getSnapshot()` 每次都执行 `captureSnapshotInput()`（全量组装：potionBar reduce、equipped map、foes map，battle.engine.js:258-286）+ `snapshotSignature(input)`；缓存只跳过 `createBattleSnapshot`（冻结克隆），**签名遍历 `signatureValue` 永不缓存**（`battle/runtime/battle.snapshot.js:110-129`，对 player/foes/hand/equipped/规则项递归字符串化，每个原始值都过一遍 `JSON.stringify`）。
- **放大器**： 战斗瞄准/点选期间 `battle/view/battle.aim.js:56-61` `targetSessionBattleCurrent` → `getSnapshot()`；`battle/core/battle.target-session.js:8-17` `hitAt()`/`setHover()` 每次都调 `isCurrent()` → `isBattleCurrent()` → `getSnapshot()`。即 `battle.aim.js:514-579` 的 `aimPointerFrame` **每个显示帧至少 2 次全量签名遍历**；全仓另有 33 处 `getSnapshot()` 调用点（每次渲染、每次点击）。
- **频率**： 瞄准拖拽期每帧；战斗中每次状态读。**影响**： 中高（主线程字符串构建 + GC churn，高刷屏放大）。
- **建议**： 给签名加"代际失效"——引擎状态写入处 bump 一个 generation 计数，`getSnapshot` 先比对计数再决定是否重算签名；或把拖拽期快照直接传给 targetSession（已有 `a.snap`），删掉 hitAt 路径的实时重取。
- **风险**： 无行为变化（缓存命中语义不变），需保证所有 `set$Xxx` 写入口都走计数。

### F2. 背包拖拽逐 pointermove 做命中测试 + 非合成器属性写 — 影响中高 【违反铁律②，可无损优化】【已实施】
- **证据**： `hub/game.bag.drag.js:111-133` `onBagDragMove` 直接挂 window pointermove（`:73`），**未 rAF 合帧**：每事件 `bagDropTarget` → `document.elementFromPoint`（`:92-103`，强制命中测试）；浮影用 `ghost.style.left/top` 写（`:123-124`）——布局属性、非合成器通道，每事件触发 style→layout→paint。
- **对照**： battle.aim.js:503-513 注释明确记录了同一问题已被修过（"高回报率鼠标合帧……原先逐事件全跑，每秒数百次强制布局+全屏清屏"），背包这条线漏改。
- **频率**： 每次 pointermove 事件（125-1000Hz 鼠标）。**影响**： 中高（开背包整理卡牌时）。
- **建议**： 照抄 aim.js 的 `aimMoveFrame` 合帧模式；浮影定位改 `transform: translate3d`（left/top 仅落位时写一次）。
- **风险**： 无（观感不变，帧内取最后位置）。

### F3. 两个页面级 MutationObserver 叠加在每次 DOM 重建上 — 影响中 【需权衡，非纯无损】
- **证据**：
  - `game.boot.js:604-615` `titleObserver` 盯 `document.documentElement` 全树 `childList+attributes['title']`，每批 childList 变更对**每个新增元素**跑 `stripNativeTitles` → `querySelectorAll('[title]')`（`:599-603`）。
  - `core/icons-bitmap.js:88-102` `observer` 盯 `document.body` 全树 `childList+attributes`，每批 addedNodes 进 dirtyRoots，rAF 合帧后 `hydrate()` 用 TreeWalker 扫新增子树文本 + `querySelectorAll('[title],[placeholder],[aria-label]')`（`:56-67`）。
- **频率**： 每次 DOM 变更（日志 prepend、飘字 append、战斗 syncBattleSlot 换槽、卡牌库/背包整页重建时数百节点×两套观察器）。已做合并去重（icons 侧），但**叠加成本仍是每次重建两轮全子树遍历**。
- **影响**： 中（大页面重建时可感知，与 F4 叠加）。
- **建议**： boot 的 titleObserver 只留 `attributes` 过滤（childList 侧改为渲染出口统一摘 title，或并入 icons 的单观察器）；icons hydrate 对 `textContent` 无 token 的节点已早退，维持现状。
- **风险**： 收窄 childList 后动态插入的 title 属性可能漏摘（有文案兜底，行为影响小但需验证菜单快捷键标签读取）。

### F4. 战斗每次渲染重建整块舞台模板 + 12 槽 outerHTML 字符串比对 — 影响中 【可优化】
- **证据**： `battle/view/battle.view.js:143-192` `showBattleStage`：每次渲染 `template.innerHTML = SDT.Icons.rich(html)`（整舞台 HTML 正则宏替换+解析），再对 12 个槽位逐个 `syncBattleSlot` 做 `(oldNode?.outerHTML)===(nextNode?.outerHTML)` 字符串序列化比对（`:116-125`，调用点 `:179-189`）。渲染由 `requestBattleRender` rAF 合帧（battle.engine.js:73-93），但出牌结算期间状态多次变更 → 每秒多次整模板构建。
- **频率**： 每次战斗状态变更（出牌/能量/飘字入队/回合切换）。**影响**： 中（CPU+GC；DOM 写入已被差分挡住，成本在字符串侧）。
- **建议**： syncBattleSlot 的比对键改为各槽位的"数据签名"（如回合数/能量/药水数组的 JSON 或手工拼接短键），命中即跳过模板侧重建；或把整段 HTML 只在 token 首建时生成、后续仅 patch 数据位。
- **风险**： 中（差分语义需逐槽验证，漏判会丢更新）。

### F5. 战斗期间每 ~8s 同步全量存档序列化 — 影响中 【可优化】【①已实施】
- **证据**： `battle/runtime/battle.action-runner.js:3,42-47`（`PERSIST_MIN_MS=8000`，动作队列清空时落盘）+ `battle/core/battle.enemy-phase.js:432`（回合开始无条件落盘）→ `run/game.session.js:189-222` `saveGame` → `createRunSavePayload`（`:139-188`：地图快照校验 + `SDT.Battle.serialize()` 整场战斗牌库/手牌）→ `RunStorage.write`（`hub/game.storage.js:166-195`：整 payload `JSON.stringify`，并对 `currentRaw` **连续两次 `JSON.parse`**（`:175`、`:181`），再写 prev 键）。
- **频率**： 战斗中每 8 秒一次 + 每回合一次 + 背包每次整理（game.bag.drag.js:175,187 等）。**影响**： 中（同步主线程停顿随 ownedCards/eventLog/地图快照体积增长，实战中段卡一下的候选来源）。
- **建议**： ①write 内 currentRaw 只 parse 一次（无损，已实施）；②8 秒节流存档改 `requestIdleCallback` 包裹；③eventLog 环形截断上限。
- **风险**： ①无；②③涉及崩溃安全窗口，需产品确认。

### F6. 被覆盖的战斗页常驻 CSS 动画不暂停 — 影响低中 【违反铁律①】【已实施】
- **证据**： `battle/view/battle.view.js:508-522` 创建 12 个 `.sts-ambient` 无限粒子（`game/css/battle.css:591` `stsAmbient linear infinite`）；`game/css/battle.css:93` 每个敌人立绘 `btFoeIdle 3.2s infinite alternate`。卡牌特写 `#cardZoom` 挂 body（ui.js:374）盖住战斗页时，`page-covered` 暂停机制只作用于 `#title`（`game/css/winter.css:650-659`、`title-p0.css:290-293`），战斗层动画照跑；Pixi 序列帧层有 `hideUnitFrames`（battle.view.js:212）但只覆盖战斗内弹层，不覆盖 body 级特写。
- **频率**： 战斗中打开卡牌特写/背签期间持续。**影响**： 低中（合成器层仍在提交帧）。
- **建议**： showCardZoom 开合时给 body 挂类，CSS 把 `.battle-stage *{animation-play-state:paused}` 并入现有 page-covered 机制。
- **风险**： 低（关特写恢复，注意 fill:forwards 动画）。

### F7. 基地页闸门钥匙无限 filter 动画 — 影响低中 【违反铁律②】【已实施】
- **证据**： `game/css/page-hub.css:398-405`：`.gate-scale i.lit { animation: hubKeyBreath 2.8s ease-in-out infinite alternate }`，`@keyframes hubKeyBreath { from{filter:brightness(.92)} to{filter:brightness(1.12)} }`——**filter 非合成器属性**，基地页打开期间每帧重绘。其余 CSS 抽查：无限动画绝大多数走 transform/opacity（winter.css、expedition.css、overlays.css 抽查通过）；非合成器 keyframes（btCardPickup/fx-die/fx-victory/btFoeHurt/wordGlint/psFill 等，属性枚举见方法）全部是一次性短动画，合规。
- **频率**： 基地页停留期间 60fps 持续。**建议**： 辉光改独立伪元素动画 opacity，滤镜值静态。
- **风险**： 无损（视觉等效）。

### F8. HUD 每次刷新对路线面板做 JSON.stringify 差分键 — 影响低中 【可无损优化】【已实施】
- **证据**： `run/expedition.view.js:85` `const key = JSON.stringify([routes, objective, disabled])`；调用链 `ui/hud.js:12-13` `refresh()` 每次先跑 `renderExpeditionPanel`，而 `UI.refresh` 在每次战斗渲染末尾调用（battle.view.js:619），即**战斗中每次出牌/能量变化都对路线数组做一次 JSON 序列化**（此时面板根本不可见——overlay 盖住）。
- **建议**： 键改原始值拼接（layerIdx:trackPos:state:disabled:各 route idx）；或 `UI._lastMode==='battle'` 时短路跳过。
- **风险**： 无。

### F9. 瞄准帧内重复 DOM 查询与逐敌矩形读 — 影响低 【可无损优化】
- **证据**： `battle/view/battle.aim.js:127-147` `enemyNearAt` 每帧 `a.stage.querySelectorAll('.bt-foe[data-eidx]')` + 每敌 `figure.getBoundingClientRect()`；`battle/core/battle.target-session.js:20` 每帧 `document.elementFromPoint`；`battle.aim.js:78-122` `aimArrowUpdate` 每帧全画布 clear+重绘（无位移阈值）。
- **频率**： 仅拖拽期每帧；N 小（敌 ≤3），已有 rAF 合帧与 `a.vr` 复用（battle.aim.js:519）。**影响**： 低。
- **建议**： 拖拽起缓存敌 rect、槽位变化时失效；箭头重绘加 1px 位移阈值。
- **风险**： 无。

### F10. pocket-strip 永久 600ms 轮询，无 document.hidden 门 — 影响低 【违反铁律①精神，可无损优化】【已实施】
- **证据**： `experience/pocket-strip.js:140-149` `setInterval(tick, 600)` 无清理通道（注释自知："600ms 永久 interval 无清理通道"）；tick（`:90-138`）每轮先跑 `decorateChapters`（`:34-58`：querySelectorAll + 每行重建 `layerEncounterMeta` 元数据对象）+ `previewExtraction`（O(ownedCards+inventory)，extraction-preview.js:25-51），**即使可见性与数值都没变、即使页面在后台**（setInterval 后台仅降频至 ~1s，不清零）。
- **影响**： 低（单次便宜），但全程空转与三铁律①精神相悖。**建议**： visibilitychange 停/启；章节面板不在 DOM 时跳过 decorate；meta 结果按 (map,idx) 记忆化。
- **风险**： 无。

### F11. 启动 import 链全量 eager（含 agent 链） — 影响低中 【结构性优化】
- **证据**： `game/src/boot-order.js:14-28` BOOT_ORDER 一次性副作用导入全部域（battle.engine 1387 行、cards.sync 1096、cardslib、game.boot）；`game.boot.js:20-23` 顶层 `import './agent/agent.js'`（agent.policy 872 行等 13 个文件）+ quick-nav + pocket-strip——不玩 agent 的玩家也付解析成本。`game/index.html:15-39` 同步加载 ~25 个 CSS。预热侧已做得好：启动场景图限额校验（game.boot.js:698-700）、壁纸 requestIdleCallback 预热（`:686-693`）、批量预取（`:711-722`）、图标全量预热（icons-bitmap.js:111-118）。
- **影响**： 低中（47k 行 ESM 在现代桌面解析 ~几十 ms；低端机/网页版可感知）。**建议**： battle/cardslib/agent 走动态 import 首用加载（Vite 代码分割）。**风险**： 低（boot-order 契约测试需同步调整）。

### F12. 杂项（低，记录在案）
- `hub/game.storage.js:175,181`：同一 `currentRaw` 两次 `JSON.parse`（每次存档），纯无损合并（已并入 F5①实施）。
- `battle/view/battle.layers.js:271,369-397`：每次战斗渲染一读一写一再读（FLIP 必需的一次强制布局），接受成本，不建议动。
- `hub/game.hub.pages.js:541-578`：成就/收藏页打开时 `Cards.all().find` 逐成就/逐职业线性扫（272 池），每次打开 O(n×m)，量小可忽略；可选建 id 索引 Map（无损）。
- `ui/hud.js:146-148`（bagBtn inert 观察器，单元素+attributeFilter）、`ui/game.menu.js:953-961`（dataPageMo，ovBody 非子树、隐藏即 disconnect）——**均正确收敛，非问题**。
- `battle/view/battle.frames.js:404-414,508`：pollTimer 战斗收尾清理、Pixi maxFPS=30 + 脏标记跳帧 + 静止 `app.stop()`（`:392-401`）——**模范实现**。
- 全部 rAF 循环（camera.js:92-103、renderer.js:62-70、map-reveals.js:35-45、game.boot.js:409-435、battle.aim.js:494-512）均有终止条件与取消路径，**无泄漏**。

---

## 二、Top 10 修复优先级表

| # | 发现 | 位置(文件:行) | 触发频率 | 影响 | 违反铁律/性质 | 建议修法(一句话) | 风险 |
|---|------|--------------|---------|------|--------------|-----------------|------|
| 1 | getSnapshot 全量签名遍历不缓存 | battle.engine.js:306-312; battle.snapshot.js:110-129 | 拖拽期每帧2+次/每渲染 | 中高 | 可无损优化 | 状态写入口 bump generation，签名按代际缓存 | 低 |
| 2 | 背包拖拽逐事件 elementFromPoint + left/top 写 | game.bag.drag.js:111-133,73 | 每 pointermove(≤1000Hz) | 中高 | ②/可无损 | 照 aim.js 模式 rAF 合帧 + 浮影改 transform | 低 |
| 3 | 战斗期同步全量存档序列化 | game.session.js:189-222; game.storage.js:166-195; battle.action-runner.js:42-47 | 每8s/每回合/背包操作 | 中 | 可优化 | write 内合并双 parse；8s 存档走 idle 回调 | 中(崩溃安全窗口) |
| 4 | 战斗渲染整模板重建 + outerHTML×12 比对 | battle.view.js:143-192,116-125 | 每次状态变更 | 中 | 可优化 | 槽位比对改数据短键，命中跳过重建 | 中 |
| 5 | 双页面级 MutationObserver 叠加扫描 | game.boot.js:604-615; icons-bitmap.js:88-102 | 每次 DOM 变更 | 中 | 需权衡 | boot 观察器收窄为 attributes-only，title 摘除并入渲染出口 | 中(title 回潮) |
| 6 | 被特写覆盖的战斗 idle 动画不暂停 | battle.css:93,591; battle.view.js:508-522; ui.js:374 | 特写打开期间 | 低中 | **①** | cardZoom 开合挂 body 类并入 page-covered 暂停 | 低 |
| 7 | hubKeyBreath 无限 filter 动画 | page-hub.css:398-405 | 基地页每帧 | 低中 | **②** | 辉光改伪元素 opacity 动画 | 无 |
| 8 | HUD 路线面板 JSON.stringify 差分键 | expedition.view.js:85; ui/hud.js:12-13; battle.view.js:619 | 每次战斗渲染 | 低中 | 可无损 | 键改原始值拼接/战斗模式短路 | 无 |
| 9 | 瞄准帧逐敌 rect+elementFromPoint+箭头全重绘 | battle.aim.js:127-147,78-122; battle.target-session.js:20 | 拖拽期每帧 | 低 | 可无损 | 拖拽起缓存敌 rect + 箭头位移阈值 | 无 |
| 10 | pocket-strip 永久轮询无后台门 | pocket-strip.js:90-148 | 600ms 全程 | 低 | ①精神/可无损 | visibilitychange 停启 + 面板缺席跳过 decorate | 无 |

（另记：启动链 eager 拆包为中长期项 F11；game.storage.js:175/181 双 parse 为零风险顺手修。）

## 三、未核验项
1. **实测量级缺失**：本审计为静态读码，所有"影响"为推断分级；项目自带探针（`core/perf-probe.local.js`、`hub/game.cardslib.photo-fps.js`、帧时间分桶 game.boot.js:503-509）建议按 F1-F5 逐项 A/B 实测后再动手。
2. **存档/事件Log 实际体积**：F5 的停顿时长取决于 ownedCards/eventLog/map 快照的运行期规模，未测。
3. **`audio/sound.scape.js` 常驻 WebAudio 声景节点**（持续 oscillator/buffer loop，sound.scape.js:16-22）的 CPU 占用未审计（音频持续出声属设计内，不在三铁律范围）。
4. **Vite 生产构建产物**（manualChunks/压缩后体积）未检查，F11 的影响以源码行数估算。
5. **Electron/系统缩放下的合成层预算**：cardslib 窗口化的层化行为在 09-29 注释中已有实测记录（cardslib.page.js:116-121），本次未复测。
6. `getSnapshot` 33 处调用点仅人工归类了拖拽/渲染热路径，冷路径（QA/控制台）未逐一枚举。
