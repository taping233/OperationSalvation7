# src 模块说明

`index.html` 只通过一个 `<script type="module">` 加载 `main.js`；首页控制器、游戏内核与启动展示都在同一装配清单内，启动集成测试沿用该入口。所有模块都是 ESM；不得再依赖旧版普通 script 的共享词法作用域。

## 目录结构

源码按下表的功能域组织，生成文件另放 `generated/`。依赖边界由 `scripts/architecture-graph.mjs` 与 `tests/architecture-boundaries.test.js` 检查：

| 目录 | 域 | 内容概览 |
| --- | --- | --- |
| `core/` | 底座 | 随机、规则、输入、相机、渲染原语与聚合、事件总线、数据加载、诊断、SDT 门面 |
| `ui/` | 全局 UI | UI 工具、缩放、词条浮框、页面生命周期与揭幕、路线浮层、标题菜单 |
| `experience/` | 体验线 | 章节风险徽标；`startPocketStrip` 保留装配接口，当前不创建随身资源汇总条 |
| `battle/` | 战斗 | `core/`（装配/引擎/结算/快照）、`effects/`（效果流水线 effect-steps.*）、`runtime/`（运行态）、`view/`（渲染）、`bag/`（牌堆/卡费）；懒装载器、符文与快照类型定义在 `battle/` 根 |
| `cards/` | 卡库 | 卡数据/同步/规则/schema/视图、备注、机制句式 |
| `run/` | 局内流程 | 对局会话、地图生成与快照、遭遇、宝箱、祭坛/商店/撤离 |
| `hub/` | 基地/局外 | 仓库、背包、存档、商店、整备、收藏、各类命令、照相馆呈现 |
| `home/` | 叙事/退役家具兼容 | ink 叙事与剧情命令；`home.*` 家具场景保留兼容和直测，正常基地不再装配 |
| `audio/` | 音频 | 音频门面、场景曲目、按需配乐播放器、短音效策略与声景 |
| `agent/` | 自动游玩与统计 | SDT.Agent 门面、局面观察、动作执行、策略/权重、LLM 适配器、跑局记录和数据页 |

根层保留装配与专用入口：`main.js`（页面装配）、`boot-order.js`（顺序合同）、`game.boot.js`（跨功能接线）、`e2.snapshot.qa.js` 与 `r7a.qa.js`（QA）、`rarity-design-lab.js` 与 `wu-career-frame-preview.js`（预览）。`generated/` 放生成物，不手改。ESM 依赖先于消费者求值；整体页面清单由合同保护。

## 按任务定位代码

| 要改什么 | 入口与职责 |
| --- | --- |
| 启动与标题 | `main.js`、`game.boot.js`、`ui/game.menu.js`；非首屏系统面板在 `ui/game.menu.pages.js` |
| 战斗规则与快照 | `battle/core/battle.core.js` 提供命令和快照；实例实现位于 `*.domain.js`，效果解析在 `battle/effects/` |
| 战斗手牌与交互 | `battle/view/battle.view.js` 装配；`battle.layers.js` 更新手牌/单位，`battle.infusion-view.js`、`battle.hand-inspector.js`、`battle.pile-view.js` 分别持有注能、详情和牌堆呈现 |
| 地图与事件 | `run/game.run.flow.js` 编排移动/落脚；地图数据与生成在 `core/mapData.js`、`run/map-*.js`，普通事件经 `run/event-runtime.js` 按需加载 |
| 奖励与商店 | `run/chests.js`、`run/game.run.shop.js` 接页面；`run/shop-commands.js`、`run/event-commands.js` 承接业务写入，公共展示在 `ui/reward-*.js` |
| 基地与整备 | `hub/game.hub.js` 轻门面、`game.hub.runtime.js` 壳、`game.hub.pages.js` 页签、`game.hub.preparation*.js` 整备；错误文案在 `hub/command-errors.js` |
| 背包与存档 | `hub/game.bag.js` 装配背包；`hub/base.js`、`hub/game.storage.js`、`hub/slot-write-lock.js` 持有持久化边界 |
| 卡牌与说明 | `cards/cards.js` 装配卡库，`cards/cards.sync.js` 承接迁移；`cards/card-execution-plan.js` 生成执行视图，`cards/structured-card-description.js` 生成展示文案 |
| 词条与页面等待 | `ui/term-tips.js` 保留同步拦截与按需加载；`page-entry-cancellation.js` 仲裁入口，`page-surface-lifetime.js` 检查宿主，`page-visual-readiness-sharing.js` 共享图片等待 |
| 自动游玩 | `agent/agent.js` 装配；`agent.runner.js`、`agent.replay.js`、`agent.llm.js` 保留轻入口，执行实现分别按需加载 |

上表用于定位，接口、取消/保存失败语义与依赖约束统一见[架构说明](../../docs/architecture.md)；规则与验收从[文档导航](../../docs/README.md)进入。

## 依赖层次

1. `core/rules.js`、`core/mapData.js`、`run/game.run.data.js`、`core/asset-url.js`：规则、授权数据和资源路径。
2. `core/art.js`、`core/icons-bitmap.js`、`audio/sound.js`、`core/camera.js`、`battle/core/combat.js`、`hub/base.js`、`hub/meta.js`、`core/renderer.primitives.js`：独立能力与纯工具。
3. `hub/game.store.js`、`hub/game.storage.js`、`run/game.session.js`、`battle/core/battle.core.js`、`battle/effects/battle.effects.js`、`battle/bag/battle.deck.js`、`battle/effects/battle.target-rules.js`：状态、持久化和领域逻辑；`ui/game.menu.js` 是标题、异步保存退出与菜单懒加载门面；`ui/game.menu.pages.js` 是经依赖注入创建一次的非首屏面板工厂。冷入口可等待完成并支持取消/重试，热入口直接复用原面板行为。
4. `core/renderer.js`（聚合 `renderer.icons.js` / `renderer.fx.js`）、`battle/view/battle.view.js`、`ui/ui.js`、`experience/pocket-strip.js`（章节风险徽标，常驻汇总条已按老板要求移除）：Canvas 或 DOM 表现层；`renderer.fx.js` 的纯状态壳直接导出 FX，session kernel 和 boot 通过 ESM 使用同一对象，SDT.FX 保留兼容入口。
5. `run/game.run.js`、`run/game.run.shop.js`、`run/game.run.class-choice.js`（选角按需轻门面，返回页面就绪 Promise）、`run/game.run.class-choice.page.js`（人物与卡池叶页面，非首屏依赖）、`hub/game.hub.js`（基地按需轻门面）、`hub/game.hub.runtime.js`（基地壳实现，首次选档进入时动态加载）、`hub/game.hub.depart.js`（出征整备）、`hub/game.hub.pages.js`（六页签 HTML）、`hub/game.hub.bridge.js`（壳↔切片中立桥）、`hub/game.bag.js`、`hub/game.notes.js`、`hub/game.cardslib.js`：功能流程。
6. `game.boot.js`：输入、跨功能接线和启动；这是唯一允许了解多数功能模块的地方。

## 关键约束

- `npm run typecheck` 检查本目录全部自有运行实现，含 generated、根层 QA 和预览模块；全域基线为 `checkJs:true / strict:false`，原严格配置另行执行。覆盖数量随源码变化，以当次类型门输出为准；接口 fixture 与仅导入可达不计入实现覆盖。真实注错探针会阻断漏检，详细配置与类型边界见[架构说明](../../docs/architecture.md)。

- `run/game.session.js` 不得导入 `boot/run/hub/notes/cardslib`；页面跳转通过 `configureGameRuntime()` 注入。
- `run/game.session.kernel.js` 直接导入 MAP/FX，只经 sdtDefine 发布兼容会话；画布、上下文和日志由启动层注入。MAP/FX 源模块与内核均可在无浏览器环境求值。
- `hub/game.store.js` 的快照默认复制并冻结普通数据；地图、交互引用、rings 行内对象以及函数、访问器、带原型实例保留运行态语义。新加的普通会话数据无需另列复制白名单，类型入口仍须显式声明。
- `battle/core/battle.core.js` 不得导入 `battle/view/battle.view.js`；视图通过 `configureBattleRenderer()` 注册。
- 战斗调用优先使用 `getSnapshot()` 和 `commands`，不要新增私有状态修改器。
- 商店与事件的业务写入通过 `run/shop-commands.js`、`run/event-commands.js`；事件和资源领取控制器由 flow 注入会话及呈现端口。
- 战斗引擎装配 card-play、turn-continuation、turn-start、damage 用例；新用例显式读取当前状态，不捕获兼容门面或复制运行态。
- `battle.engine.factory.js` / `battle.engine.instance.js` 创建独立战斗；runtime、Combat钩子、随机、队列及取消均属实例。`*.domain.js` 是共同实现，默认浏览器服务仅在 `battle.default-context.js` 装配；原接口保留稳定转发，重配只允许在战斗不活动且队列排空后进行。
- 引擎装配分为 `battle.effect-assembly.domain.js`（效果端口）、`battle.setup-mechanics.domain.js`（开战机制）和 `battle.snapshot-projection.domain.js`（当前状态投影与实例缓存）；结构化获取与状态操作在 `battle.acquire-operation.domain.js`、`battle.status-operations.domain.js`。各片通过显式端口工作，领域模块不得捕获默认运行态或浏览器。
- `battle/core/battle.core-ports.types.d.ts` 定义真实效果装配与快照投影的命令、回执和宿主服务；`jsconfig.framework-ports.json` strict 检查这两片实现及 fixture，真实源码突变守卫防止仅 fixture 通过。旧 engine factory 和其余传递依赖实现不因此全部严格化。
- Base 公开写 API 返回 Promise，所有物理写入经 `slot-write-lock.js` 同槽锁及有效 lease。`saveGame()` 同步保存 Run；保存退出用 `saveSession()`，读档后的完整持久结果等待 `pendingPersistence`。
- `newRun()` 返回 Promise；持久档位的出征在同槽 Web Lock 内提交可恢复的 Base/Run 日志，调用方必须 await 并处理 `false`，页面已取消或档位已变化时不继续原请求。
- 卡牌时点、装备与打出效果的来源和执行视图统一从 `cards/card-execution-plan.js` 获取。内建可执行卡使用结构化声明；自定义卡及未识别历史规则保留文本兼容路径。卡面文案与内建执行数值独立。
- 新规则值进入 `RULES`，新效果文本时点进入 `battle/effects/battle.effects.js`。
- `tests/contracts.test.js` 会检查整个目录的循环依赖；新增顶层目录须同步 `architecture-graph.mjs` 的分层判据。

完整接口和数据流见 `docs/architecture.md`。
