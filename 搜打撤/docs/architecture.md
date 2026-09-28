# 架构与模块接口

> 2026-09-27 按当前源码补充战斗拆分、Agent 域与样式入口。已提交/在途范围及验收状态见 [项目状态快照](PROJECT-STATUS-2026-09-27.md)；本文描述接口，不表示当前整库已通过验收。

## 入口与依赖方向

`index.html` 只加载 `src/main.js`。所有源码均为 ESM；`main.js` 负责确定初始化顺序，模块自身使用显式 `import` 描述依赖。

源码按功能域分目录（2026-09-23 目录化）：`core/`（底座：随机/规则/输入/渲染/事件/数据/诊断/门面）、`ui/`（全局 UI 与控制器）、`battle/`（战斗全域，含 effect-steps 效果流水线与 combat 伤害）、`cards/`（卡库数据/同步/规则/schema/视图）、`run/`（局内流程与对局地图）、`hub/`（基地/局外：仓库/背包/存档/商店/整备/命令）、`home/`（首页/叙事）、`audio/`（音频）；根层只留装配与入口（`main.js`、`boot-order.js`、`game.boot.js`、`r7a.qa.js`）和 `generated/`。分层判据与目录一致，详见 `game/src/README.md`。

分层从底向上为：规则/数据与纯工具 → 状态和领域逻辑 → 功能视图 → 启动接线；高层依赖低层。核心状态模块不得反向导入 `boot`、`run`、`hub`、`notes` 或具体视图。`tests/contracts.test.js` 通过 AST 依赖图拒绝循环依赖，覆盖子目录、重导出与动态字面量 import。

2026-09-25～26 新增 `agent/` 自动游玩与统计域：`agent.js` 装配 `SDT.Agent`，观察和动作执行复用现有 UI/移动/战斗命令；策略、权重、LLM 适配、记录统计和数据页分模块。批跑/比较/进化/台账工具位于 `game/tools/agent-*.mjs`。协议与实验约束分别见 [agent-protocol.md](agent-protocol.md)、[agent-iteration-playbook.md](agent-iteration-playbook.md)。

## 稳定接口

- `RULES`：跨功能固定数值，只读且冻结。
- `window.SDT`：桌面调试与旧调用的兼容门面；新增代码应优先使用 ESM 导出。
- `BattleSession` / `window.SDT.Battle.start(game, enemies, options)`：开始战斗；后者是兼容门面。
- `window.SDT.Battle.getSnapshot()`：取得战斗只读快照。
- `window.SDT.Battle.commands`：统一战斗命令，包括出牌、注能、结束回合、逃跑和墓地操作。
- `configureGameRuntime()`：由启动模块注入界面跳转，避免 `game.session` 反向依赖页面模块。
- `game.session.browser.js`：只由 `game.boot.js` 调用 `createGameCanvas(document)`；canvas、ctx 和日志端口注入 session kernel。kernel 可在无 DOM 的 Node 环境导入，尚保留 MAP/FX 的兼容门面依赖。
- `configureCardNavigation()`：由基地模块注入卡牌页面关闭与刷新行为。
- `RenderScheduler`：统一控制活动 60 FPS、空闲 30 FPS和遮罩暂停。

## 功能分工

- `game.store.js`：创建可变会话状态，并通过 `getSnapshot()` 暴露不可变快照。
- `game.storage.js`：五槽对局存档键、读写和 v1 迁移。
- `game.session.js`：会话派生数据与对局生命周期，拆为 `game.session.kernel/modes/bag/map/board/death.js` 六片；`game.menu.js` 负责标题、选档、离开和设置页面。
- `game.cardslib.js`：卡牌库轻门面；首次进入照相馆或制作坊时动态加载 `game.cardslib.page.js`。页面及其制作坊、照片道具、性能探针、图片预热和共享模块保持在门面之后，避免静态依赖回到首屏；制作坊写开关保持关闭。`ui/ui.js` 组合 `overlay.js`、`cinematics.js`、`hud.js`。
- `game.hub.preparation.js`：基地整备控制器，通过数据、视图、导航和错误处理端口装配 `preparation.commands.js` / `preparation.view.js`；不读取 `SDT`、`UI`、`document` 或 `window`。页面 dispose 会阻止过期异步返回继续更新 UI。
- `game.run.data.js`：场景、事件与职业叙事授权数据；`game.run.shop.js`：商店进货、购买和出售；`game.run.js`：移动、格子、事件、祭坛与撤离流程。
- `game.hub.js`（基地壳）+ `game.hub.depart.js` / `game.hub.pages.js` / `game.hub.bridge.js`（出征整备、六页签、壳↔切片中立桥）与 `game.bag.js`（背包本体）+ `game.bag.drag.js` / `game.bag.settle.js` / `game.bag.bridge.js`（3D 拖拽、战后结算、中立桥）——2026-09-22 六文件重构批3/4 拆出，切片禁 import 壳、互调只经桥（contracts 拒环）。
- 基地 `home.scene.js` 与 Pixi 在首次打开基地场景时动态加载；请求序号和挂载节点检查阻止已关闭页面的加载结果继续挂载。稳定卡牌数据打为 `game-card-catalog` 缓存分块，仍是同步启动依赖，计入首屏脚本预算。用户已授权将初始 JS gzip 预算从 290 KiB 调至 310 KiB：干净 `96950de` 实测为 299.3 KiB；第二轮源码的新产物仍待验证。
- `cards.js`（壳）+ `cards.data.js` / `cards.rules.js` / `cards.sync.js` / `cards.consts.js`：卡池数据、推导与经济规则、迁移播种、共享常量；`window.SDT.Cards` 键面与数据字节不变。
- `cards.sync.js` 的 TT10/TT11 历史批次重播优先使用 `cards-sync.json` 同 id 定版字段，并服从其退役清单；定版未提供的仓库元数据仍保留。迁移标记存在时不覆盖玩家后续编辑。
- `game/data/cards-sync.json` 是生成数据，使用 `scripts/sync-cards-from-live.mjs` 更新，不手改；改卡牌描述时递增版本，退役卡进入退役名单并递增版本。新增卡必须进入同步数据，保证历史批次重播可解析。
- TT10/TT11 内联历史快照须与同步数据保持一致，由 `tests/cards-sync-snapshot-guard.test.js` 守卫；卡牌效果审计例外与回归入口见 `docs/quality-gates.md`。
- `cards.catalog.js`：按稳定 id 解析 TT10/TT11 的定版引用，定版字段优先，历史独有元数据随后补齐；缺失 id、重复 id、继续内联定版条目均明确失败。其他批次保持原数据入口。
- `cards/card-rarity.js`：英雄线与衍生牌稀有度的纯规则实现，由调用方注入按 ID 查找。Cards 门面继续用 `Array.find` 保持原数组首项优先；`card-render-context.js` 在照相馆一次浅目录快照中构造 first-ID 索引，筛选、排序和各延迟挂载批次共用该快照，页面数据刷新后重建，关闭时释放索引。
- `battle.core.js`：战斗装配与命令门面（批6 拆分：状态在 `battle.runtime.js`、回合环引擎在 `battle.engine.js`、敌方阶段在 `battle.enemy-phase.js`）；不访问 DOM，也不依赖战斗视图。BOSS 编组和墓地页面同样由快照驱动。
- `battle.effects.js` + `effect-steps.js`（有序步骤表本体，拆片 `effect-steps.<节>.js` 按原序 concat——顺序即语义）：文本时点解析与效果执行器；执行器只通过显式端口改变战斗状态，不访问 DOM。
- `battle.deck.js` / `battle.rules.js`：可独立测试的洗牌、回收、目标判定和出牌限制。
- `battle.card-cost.js` / `battle.intent.js`：显式接收卡牌与战斗状态值的费用、敌方意图纯计算；`battle.engine.js` 保留原接口并收集状态，纯计算模块不读取 `window.SDT` 或 DOM。
- `battle.card-inspection.js`：卡实例查找、费用上下文、手牌诅咒与费用交换，通过 cards、curseMeta、readState 三个端口访问引擎；保留原 engine 导出，不创建第二份运行态。`hosted-catalog-index.js` 按原来源顺序建立一次索引，保持重复 ID 首项优先。
- `battle.runtime.js` 是五个运行态子模块（session/piles/interaction/effects/presentation）的兼容重导出入口，保留活绑定；修改 reset/restore/finish 必须核对真实属地与会话边界，不能建立第二份状态副本。
- `battle.engine.js` 装配 `battle.execution-session.js`（取消与代次）、`battle.action-runner.js`（串行动作队列）、`battle.staged-playback.js`（逐拍播放）；旧回调须校验战斗 token 和执行会话 generation。选择、装备、背包、生命周期、出牌执行分别委派给 `battle.selection-flow/equipment/bag/lifecycle/exec-play.js`。
- `cards/card-rules.schema.js` 的 schema v2 是增量契约，`rules.version` 仍为 1；A3 已迁移 damage/heal/armor、curse、acquire、blessing/energy 等批次，未支持的操作或参数由解释器 pending 守卫拒绝。schema 接受形状不等于全部效果已经接线。
- `battle.resolution.js`：完整单卡结算，显式接收当前状态查询与伤害、抽牌、回复、护甲、延迟效果等命名端口；引擎负责适配现有运行时。模块本身不读取全局状态，不直接修改运行时字段。
- `battle.snapshot.js`：按输入值构造视图快照；引擎负责收集输入和维护签名缓存。保留原有快照字段和复制/冻结层级，不宣称任意嵌套对象都已深冻结。
- `battle.view.js`（渲染壳）+ `battle.overlays/layers/vfx/anim/aim/hover.js` 六片：只读取 `getSnapshot()` 快照、渲染 DOM、派发 `commands` 并向核心注册渲染器；viewApi 反取已改 core 具名直引。
- `renderer.js`：Canvas 地图编排与视觉特效；`renderer.primitives.js` 提供纯绘图工具；`render-scheduler.js` 决定何时绘制。
- `sound.js`：Howler.js 管理双 BGM 的加载、循环、静音和淡入淡出；战斗/开箱/胜负音效优先使用 Kenney CC0 采样（`assets/sfx/battle/`，预解码缓存、按键随机选一），采样未就绪或缺位时回退 Web Audio 程序化合成。
- `motion.js`：基于 Motion Mini 的 DOM 微动效门面，并统一处理减少动态效果偏好。
- `pixi-effects.js`：按需加载 PixiJS（v7 + @pixi/particle-emitter 粒子发射），只承载战斗命中特效层，避免增加首屏执行成本。
- `narrative.js`：使用 inkjs 读取预编译剧情；全部 10 个 tt6 事件（选项、文案与效果标注）定义在 `narrative/events.ink`，构建、测试和开发启动前由 `scripts/compile-narrative.mjs` 生成运行时代码；效果结算通过 `game.run.js` 的效果端口表执行。

样式级联以 `game/index.html` 的 `<link rel="stylesheet">` 实际顺序为准：基础/卡牌/弹层/基地/战斗/场景层 → lab-ending/winter/expedition 与照相馆等功能层 → ui-scale → `page-*.css` 页面覆盖层。当前工作区已挂接 `page-datapage.css` 等新页面片，不能再按旧“18 张样式表”清单排查。`winter.css` 和页面覆盖层可能覆盖前层规则，修改后须检查实际页面计算样式。

模块之间不得直接修改另一模块的私有变量；需要跨模块行为时应暴露命名命令、只读快照或一次性配置接口。

基地持久化分为 `base-state.js`（默认状态和旧档归一化）、`base-mutation.js`（同步草稿与提交结果）、`base-economy.js`（购买、拆包、领奖命令）、`base-progression.commands.js`（模式选择与研究所钥匙门禁）、`base.js`（活动槽、存储保护与兼容接口）。写盘失败不替换当前状态；未改变分支保持引用，兼容旧收藏流程持有的卡堆。研究所门禁按整数钥匙储备校验并只扣一次；旧 `game.nest.js` 无费用解锁入口保留兼容语义。跨基地/对局的结算仍使用原 journal/requestId 协议。其他旧流程仍有直接写 `Base.data` 后保存的路径，不能把这次收敛理解为整个存档层已不可变。

`core/rule-config.js` 是只读共享规则来源，包含容量、战斗上限、撤离保留比例和兽王奖励概率；校验真实的字段范围和同组容量顺序。预估和实际结算读取同一常量，随机抽取仍留在原调用位置。

`Base.selectMode()` 与 `Base.unlockNestGate()` 是模式偏好和研究所门禁的事务写入口；对应 UI 不再直接写这两个 `Base.data` 字段。此约束只覆盖这两个字段，局内口袋、eggPity、战斗计数等兼容路径仍需逐步迁移。严格检查按目录/能力增量启用；全局 `jsconfig.json` 尚未整体改为 `strict`。

## 质量检查与文档生成

模块级改进范围与验收记录见 `code-health-plan-2026-09-23.md`、`architecture-alignment-plan-2026-09-23.md`，自动检查入口见 `quality-gates.md`。
`scripts/architecture-graph.mjs` 由契约测试和 `tests/architecture-boundaries.test.js` 共用。检查包含缺失 JS 模块、不透明动态 import、运行时导入范围与独立领域模块的浏览器全局访问；判据采用真实域路径的精确集合，并以 `deadGuardKeys` 检查失效键。`hub/game.cardslib.page.js` 只有一个允许的入边：轻门面 `hub/game.cardslib.js` 的字面量动态 import；静态导入、重导出或其他模块的动态导入都会失败，防止照相馆页面被重新打入首屏。`RUNTIME_SURFACE` 覆盖兼容入口及五个运行态子模块；`RUNTIME_OWNERS` 包含 core、engine、enemy-phase、selection-flow、equipment、bag、lifecycle、exec-play，运行态模块也可互相导入。战斗视图通过 core 的快照和命令访问领域，不能直接读取运行态。这是源码依赖约束，不代表已消除兼容门面上的全部可变状态。
普通测试中的游戏全书校验只在内存生成内容；`npm run docs:compendium` 才会写入 `docs/game-compendium.md`，避免回归测试覆盖工作区文档。
