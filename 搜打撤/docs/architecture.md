# 架构与模块接口

## 入口与依赖方向

`index.html` 只加载 `src/main.js`。所有源码均为 ESM；`main.js` 负责确定初始化顺序，模块自身使用显式 `import` 描述依赖。

分层从底向上为：规则/数据与纯工具 → 状态和领域逻辑 → 功能视图 → 启动接线；高层依赖低层。核心状态模块不得反向导入 `boot`、`run`、`hub`、`notes` 或具体视图。`tests/contracts.test.js` 通过 AST 依赖图拒绝循环依赖，覆盖子目录、重导出与动态字面量 import。

## 稳定接口

- `RULES`：跨功能固定数值，只读且冻结。
- `window.SDT`：桌面调试与旧调用的兼容门面；新增代码应优先使用 ESM 导出。
- `BattleSession` / `window.SDT.Battle.start(game, enemies, options)`：开始战斗；后者是兼容门面。
- `window.SDT.Battle.getSnapshot()`：取得战斗只读快照。
- `window.SDT.Battle.commands`：统一战斗命令，包括出牌、注能、结束回合、逃跑和墓地操作。
- `configureGameRuntime()`：由启动模块注入界面跳转，避免 `game.session` 反向依赖页面模块。
- `configureCardNavigation()`：由基地模块注入卡牌页面关闭与刷新行为。
- `RenderScheduler`：统一控制活动 60 FPS、空闲 30 FPS和遮罩暂停。

## 功能分工

- `game.store.js`：创建可变会话状态，并通过 `getSnapshot()` 暴露不可变快照。
- `game.storage.js`：五槽对局存档键、读写和 v1 迁移。
- `game.session.js`：会话派生数据与对局生命周期；`game.menu.js` 负责标题、选档、离开和设置页面。
- `game.run.data.js`：场景、事件与职业叙事授权数据；`game.run.shop.js`：商店进货、购买和出售；`game.run.js`：移动、格子、事件、祭坛与撤离流程。
- `game.hub.js`（基地壳）+ `game.hub.depart.js` / `game.hub.pages.js` / `game.hub.bridge.js`（出征整备、六页签、壳↔切片中立桥）与 `game.bag.js`（背包本体）+ `game.bag.drag.js` / `game.bag.settle.js` / `game.bag.bridge.js`（3D 拖拽、战后结算、中立桥）——2026-09-22 六文件重构批3/4 拆出，切片禁 import 壳、互调只经桥（contracts 拒环）。
- `cards.js`（壳）+ `cards.data.js` / `cards.rules.js` / `cards.sync.js` / `cards.consts.js`：卡池数据、推导与经济规则、迁移播种、共享常量；`window.SDT.Cards` 键面与数据字节不变。
- `cards.sync.js` 的 TT10/TT11 历史批次重播优先使用 `cards-sync.json` 同 id 定版字段，并服从其退役清单；定版未提供的仓库元数据仍保留。迁移标记存在时不覆盖玩家后续编辑。
- `cards.catalog.js`：按稳定 id 解析 TT10/TT11 的定版引用，定版字段优先，历史独有元数据随后补齐；缺失 id、重复 id、继续内联定版条目均明确失败。其他批次保持原数据入口。
- `battle.core.js`：战斗装配与命令门面（批6 拆分：状态在 `battle.runtime.js`、回合环引擎在 `battle.engine.js`、敌方阶段在 `battle.enemy-phase.js`）；不访问 DOM，也不依赖战斗视图。BOSS 编组和墓地页面同样由快照驱动。
- `battle.effects.js` + `effect-steps.js`（有序步骤表本体，拆片 `effect-steps.<节>.js` 按原序 concat——顺序即语义）：文本时点解析与效果执行器；执行器只通过显式端口改变战斗状态，不访问 DOM。
- `battle.deck.js` / `battle.rules.js`：可独立测试的洗牌、回收、目标判定和出牌限制。
- `battle.card-cost.js` / `battle.intent.js`：显式接收卡牌与战斗状态值的费用、敌方意图纯计算；`battle.engine.js` 保留原接口并收集状态，纯计算模块不读取 `window.SDT` 或 DOM。
- `battle.resolution.js`：完整单卡结算，显式接收当前状态查询与伤害、抽牌、回复、护甲、延迟效果等命名端口；引擎负责适配现有运行时。模块本身不读取全局状态，不直接修改运行时字段。
- `battle.snapshot.js`：按输入值构造视图快照；引擎负责收集输入和维护签名缓存。保留原有快照字段和复制/冻结层级，不宣称任意嵌套对象都已深冻结。
- `battle.view.js`（渲染壳）+ `battle.overlays/layers/vfx/anim/aim/hover.js` 六片：只读取 `getSnapshot()` 快照、渲染 DOM、派发 `commands` 并向核心注册渲染器；viewApi 反取已改 core 具名直引。
- `renderer.js`：Canvas 地图编排与视觉特效；`renderer.primitives.js` 提供纯绘图工具；`render-scheduler.js` 决定何时绘制。
- `sound.js`：Howler.js 管理双 BGM 的加载、循环、静音和淡入淡出；战斗/开箱/胜负音效优先使用 Kenney CC0 采样（`assets/sfx/battle/`，预解码缓存、按键随机选一），采样未就绪或缺位时回退 Web Audio 程序化合成。
- `motion.js`：基于 Motion Mini 的 DOM 微动效门面，并统一处理减少动态效果偏好。
- `pixi-effects.js`：按需加载 PixiJS（v7 + @pixi/particle-emitter 粒子发射），只承载战斗命中特效层，避免增加首屏执行成本。
- `narrative.js`：使用 inkjs 读取预编译剧情；全部 10 个 tt6 事件（选项、文案与效果标注）定义在 `narrative/events.ink`，构建、测试和开发启动前由 `scripts/compile-narrative.mjs` 生成运行时代码；效果结算通过 `game.run.js` 的效果端口表执行。

`index.html` 当前按以下级联顺序引入 18 张样式表：`base.css` → `cards.css` → `overlays.css` → `hub.css` → `battle.css` → `scenes.css` → `winter.css` → `expedition.css` → `expedition-map.css` → `expedition-hub.css` → `expedition-inventory.css` → `expedition-rewards.css` → `expedition-battle.css` → `expedition-library.css` → `card-v3.css` → `expedition-roster.css` → `expedition-shop.css` → `ui-scale.css`。这是当前级联现状；页面覆盖层和 `!important` 的整理需另做视觉回归。

模块之间不得直接修改另一模块的私有变量；需要跨模块行为时应暴露命名命令、只读快照或一次性配置接口。

## 质量检查与文档生成

模块级改进范围与验收记录见 `code-health-plan-2026-09-23.md`、`architecture-alignment-plan-2026-09-23.md`，自动检查入口见 `quality-gates.md`。
`scripts/architecture-graph.mjs` 由契约测试和 `tests/architecture-boundaries.test.js` 共用。检查包含缺失 JS 模块、不透明动态 import、运行时导入范围与独立领域模块的浏览器全局访问。`battle.runtime.js` 仅允许 core、engine、enemy-phase 三个装配/执行模块导入；战斗视图通过 core 的快照和命令访问领域。这是源码依赖约束，不代表已消除兼容门面上的全部可变状态。
普通测试中的游戏全书校验只在内存生成内容；`npm run docs:compendium` 才会写入 `docs/game-compendium.md`，避免回归测试覆盖工作区文档。
