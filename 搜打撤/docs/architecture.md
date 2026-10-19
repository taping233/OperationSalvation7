# 架构与模块接口

本文维护模块职责、依赖方向和接口边界；实现位置见[源码目录说明](../game/src/README.md)。当前占用与交付证据从[状态入口](STATUS.md)查询，接口说明的适用范围由对应源码和契约测试核对。

## 入口与依赖方向

`index.html` 只加载 `src/main.js`。所有源码均为 ESM；`main.js` 负责确定初始化顺序，模块自身使用显式 `import` 描述依赖。

源码按功能域分目录：`core/` 管规则、随机、输入与绘图底座；`ui/` 管全局界面；`experience/` 管章节风险徽标；`cards/` 管卡库、同步与规则；`run/` 管局内地图与流程；`hub/` 管基地、背包与存档；`home/` 管首页与叙事；`audio/` 管音频；`agent/` 管自动游玩与统计。根层保留装配入口和 `generated/`。

`battle/` 内分为 `core/`（装配、引擎、结算、快照）、`effects/`（效果流水线）、`runtime/`（运行态）、`view/`（渲染）、`bag/`（牌堆与卡费）；装载器与符文入口在战斗域根目录。

分层从底向上为：规则/数据与纯工具 → 状态和领域逻辑 → 功能视图 → 启动接线；高层依赖低层。核心状态模块不得反向导入 `boot`、`run`、`hub`、`notes` 或具体视图。`tests/contracts.test.js` 通过 AST 依赖图拒绝循环依赖，覆盖子目录、重导出与动态字面量 import。

`agent/agent.js` 装配 `SDT.Agent`，观察和动作执行复用 UI、移动与战斗命令；策略、权重、LLM 适配、记录统计和数据页分模块。批跑、比较、进化和台账工具位于 `game/tools/agent-*.mjs`，接口与实验方法见[协议](agent-protocol.md)和[迭代手册](agent-iteration-playbook.md)。

## 稳定接口

- `RULES`：跨功能固定数值，只读且冻结。
- `window.SDT`：页面调试与旧调用的兼容门面；新增代码优先使用 ESM 导出。
- `BattleSession` / `window.SDT.Battle.start(game, enemies, options)`：开始战斗；后者是兼容门面。
- `window.SDT.Battle.getSnapshot()`：取得战斗只读快照。
- `window.SDT.Battle.commands`：统一战斗命令，包括出牌、注能、结束回合、逃跑和墓地操作。
- 出牌视图通过 `commands.getCardPlayAvailability(uid, side?, forceDirect?)` 只读查询当前可用性，通过 `submitCardPlay` 接收拒绝、等待输入或带回执的入队结果；原 `playCard` 返回语义保留。入队回执按场次、UID和动作序号区分，源牌扣费并移出手牌后即确认提交，后续效果取消不改写该事实。类型见 `battle.play-submission.types.d.ts`，细节见[提交合同](evidence/2026-10-16-WF-battle-play-feedback-1016/core-contract.md)。
- `configureGameRuntime()`：由启动模块注入界面跳转，避免 `game.session` 反向依赖页面模块。
- `game.session.browser.js`：只由 `game.boot.js` 调用 `createGameCanvas(document)`；canvas、ctx 和日志端口注入 session kernel。kernel 可在无 DOM 的 Node 环境导入，尚保留 MAP/FX 的兼容门面依赖。
- `configureCardNavigation()`：由基地模块注入卡牌页面关闭与刷新行为。
- `RenderScheduler`：活动状态目标 120 FPS；静态地图仅在状态失效或活动切换时绘制，主循环保留约 4 Hz 状态巡检；全屏遮罩暂停地图绘制。目标值不等于当前设备上的实测交付帧率。

## 功能分工

- `game.store.js`：创建可变会话状态，并通过 `getSnapshot()` 暴露不可变快照。
- `game.storage.js`：五槽对局存档键、读写和 v1 迁移。
- `game.session.js`：会话派生数据与对局生命周期，拆为 `game.session.kernel/modes/bag/map/board/death.js` 六片；`game.menu.js` 保留同步标题/退出与轻量菜单入口，非首屏选档、指南、成就、设置、反馈和离开面板由 `game.menu.pages.js` 首次请求时加载；页工厂注入会话能力和标题回调，不反向导入会话模块。冷入口提供可见载入层、取消/重试与最后请求优先，已载入的页工厂复用并保持热入口同步。
- `game.cardslib.js`：卡牌库轻门面；首次进入照相馆或制作坊时动态加载 `game.cardslib.page.js`。页面及其制作坊、照片道具、性能探针、图片预热和共享模块保持在门面之后，避免静态依赖回到首屏；制作坊写开关保持关闭。`ui/ui.js` 组合 `overlay.js`、`cinematics.js`、`hud.js`。
- `game.hub.preparation.js`：基地整备控制器，通过数据、视图、导航和错误处理端口装配 `preparation.commands.js` / `preparation.view.js`；不读取 `SDT`、`UI`、`document` 或 `window`。页面 dispose 会阻止过期异步返回继续更新 UI。
- `game.run.data.js`：场景、事件与职业叙事授权数据；`game.run.shop.js`：商店进货、购买和出售；`game.run.js`：移动、格子、事件、祭坛与撤离流程。
- `shop-browse-state.js` 只捕获商店背包往返的DOM浏览位置、详情规则展开与焦点动作标识；控制器在同会话和新页面身份仍有效时恢复，不写入对局状态或存档。
- `battle/view/battle.scenery.js` 按本场 token 固定场景配置。当前普通战与首脑战统一使用 `platform-minimal-1016` 的远景、透明站台地面与透明前景；`game.run.data.js` 预载同一组三图。分层模式按完整画幅叠放，人物站位与战斗动作仍由原视图和动画层持有；本轮接入及待统一验收范围见[场景记录](evidence/2026-10-16-WF-battle-platform-minimal/README.md)。
- `game.hub.js` 是基地轻门面，选档后首次进入才动态加载 `game.hub.runtime.js`；后者装配出征整备、页签与中立桥；`game.bag.js` 装配拖拽、战后结算与背包中立桥。基地与照相馆的待开页请求通过 `ui/page-entry-cancellation.js` 互斥，返回标题、选档或更新导航会取消旧请求；加载失败可重试，档案状态不复制。基地样式仍静态加载。对应切片以 `game.hub.*.js`、`game.bag.*.js` 命名；切片通过桥互调，contracts 检查循环依赖。
- `run/game.run.altar.js` 保留祭坛、火堆、撤离恢复的同步入口，并把 `openClassChoice()` 转交给选角轻门面 `run/game.run.class-choice.js`；人物与卡池页面 `game.run.class-choice.page.js` 及人物翻页动效仅在实际请求选角时动态装载，无标题/基地 idle 预取。入口 Promise 在页面就绪后完成；出征切幕等待该结果。`loadGame()` 仍同步返回恢复/持久化结果，未选角存档另附 `classChoiceEntry` 供选档 await，Promise 不写入游戏或存档状态。选角下载与其他待开页互斥；取消、换档/换局和来源宿主变化废弃旧结果，失败保留 pending run 与可重试入口。
- 基地 `home.scene.js` 与 Pixi 在首次打开基地场景时动态加载；请求序号和挂载节点检查阻止已关闭页面的加载结果继续挂载。稳定卡牌数据打为 `game-card-catalog` 缓存分块，仍是同步启动依赖，计入首屏脚本预算。预算值由 `scripts/perf-budget.cjs` 维护，实际产物大小与构建状态见对应任务证据。
- `cards.js`（壳）+ `cards.data.js` / `cards.rules.js` / `cards.sync.js` / `cards.consts.js`：卡池数据、推导与经济规则、迁移播种、共享常量；`window.SDT.Cards` 键面与数据字节不变。
- `cards.sync.js` 的 TT10/TT11 历史批次重播优先使用 `cards-sync.json` 同 id 定版字段，并服从其退役清单；定版未提供的仓库元数据仍保留。迁移标记存在时不覆盖玩家后续编辑。
- `game/data/cards-sync.json` 是生成数据，使用 `scripts/sync-cards-from-live.mjs` 更新，不手改；改卡牌描述时递增版本，退役卡进入退役名单并递增版本。新增卡必须进入同步数据，保证历史批次重播可解析。
- TT10/TT11 内联历史快照须与同步数据保持一致，由 `tests/cards-sync-snapshot-guard.test.js` 守卫；卡牌效果审计例外与回归入口见 `docs/quality-gates.md`。
- `cards.catalog.js`：按稳定 id 解析 TT10/TT11 的定版引用，定版字段优先，历史独有元数据随后补齐；缺失 id、重复 id、继续内联定版条目均明确失败。其他批次保持原数据入口。
- `cards/card-rarity.js`：英雄线与衍生牌稀有度的纯规则实现，由调用方注入按 ID 查找。Cards 门面继续用 `Array.find` 保持原数组首项优先；`card-render-context.js` 在照相馆一次浅目录快照中构造 first-ID 索引，筛选、排序和各延迟挂载批次共用该快照，页面数据刷新后重建，关闭时释放索引。
下文战斗模块文件名相对上方五个子目录；具体路径按[源码目录说明](../game/src/README.md)定位。

- `battle.core.js`：战斗装配与命令门面；状态在 `battle.runtime.js`、回合环在 `battle.engine.js`、敌方阶段在 `battle.enemy-phase.js`。核心不访问 DOM 或依赖战斗视图，BOSS 编组和墓地页面由快照驱动。
- `battle.effects.js` + `effect-steps.js`（有序步骤表本体，拆片 `effect-steps.<节>.js` 按原序 concat——顺序即语义）：文本时点解析与效果执行器；执行器只通过显式端口改变战斗状态，不访问 DOM。
- `battle.deck.js` / `battle.rules.js`：可独立测试的洗牌、回收、目标判定和出牌限制。
- `battle.card-cost.js` / `battle.intent.js`：显式接收卡牌与战斗状态值的费用、敌方意图纯计算；`battle.engine.js` 保留原接口并收集状态，纯计算模块不读取 `window.SDT` 或 DOM。
- `battle.card-inspection.js`：卡实例查找、费用上下文、手牌诅咒与费用交换，通过 cards、curseMeta、readState 三个端口访问引擎；保留原 engine 导出，不创建第二份运行态。`hosted-catalog-index.js` 按原来源顺序建立一次索引，保持重复 ID 首项优先。
- `battle.runtime.js` 是五个运行态子模块（session/piles/interaction/effects/presentation）的兼容重导出入口，保留活绑定；修改 reset/restore/finish 必须核对真实属地与会话边界，不能建立第二份状态副本。
- `battle.engine.js` 装配 `battle.execution-session.js`（取消与代次）、`battle.action-runner.js`（串行动作队列）、`battle.staged-playback.js`（逐拍播放）；旧回调须校验战斗 token 和执行会话 generation。选择、装备、背包、生命周期、出牌执行分别委派给 `battle.selection-flow/equipment/bag/lifecycle/exec-play.js`。
- `battle.selection-flow.js` 管理战斗内手牌选择、发现和抉择队列；卡库查询、拒绝音效、随机源与取消检查由 `battle.engine.js` 通过窄端口装配。`battle.hand-selection.js` 单源提供选择名称匹配与支付候选规则；`battle.discover-candidates.js` 提供有序目录筛选和单次候选抽取；`battle.discover-state.js` 构造显式、随机及锦囊发现状态，`battle.discover-flow.js` 承载发现队列处理。非自定义发现池在单个面板内构建一次并保留源卡引用，自定义 `job.pred` 每次抽取仍重新查询目录/执行谓词。interaction 用 `getJobs()` 读取当前可替换队列，避免固定捕获旧数组。selection-flow 不捕获 `window.SDT`，也不静态依赖连接 UI 等待的 `battle.staged-playback.js`；战斗状态仍读取 `battle.runtime.js` 活绑定，因此这是浏览器边界解耦，不是纯状态模块。
- `meta-progression.js` 是等级曲线与 XP 步进的共享纯计算来源；`battle-victory-progress.js` 从 Base 快照计算本场击杀、首个同名 BOSS 记录和逐敌职业经验。slot 战斗结算将计算后的 Base 一并纳入现有 journal attempt，提交成功后才发布升级演出与成就检查；重放已完成 receipt 不重复增加进度。无 slot 保留旧内存埋点路径。该流程仍使用分离的 Base/Run 存储，不能视为跨存储原子事务。
- `cards/card-rules.schema.js` 的 schema v2 是增量契约，`rules.version` 仍为 1；damage/heal/armor、curse、acquire、blessing/energy 等操作的支持范围由 schema、解释器与测试共同确定。未支持的操作或参数由 pending 守卫拒绝。
- `battle.resolution.js`：完整单卡结算，显式接收当前状态查询与伤害、抽牌、回复、护甲、延迟效果等命名端口；引擎负责适配现有运行时。模块本身不读取全局状态，不直接修改运行时字段。
- `battle.snapshot.js`：按输入值构造视图快照；引擎负责收集输入和维护签名缓存。保留原有快照字段和复制/冻结层级，不宣称任意嵌套对象都已深冻结。
- `battle.view.js`（渲染壳）+ `battle.overlays/layers/vfx/anim/aim/hover.js` 六片：只读取 `getSnapshot()` 快照、渲染 DOM、派发 `commands` 并向核心注册渲染器；viewApi 反取已改 core 具名直引。
- `battle.layers.js` 在当前手牌差分前捕获卡面/规则区焦点及阅读滚动位置，更新后按原牌组、存活近邻交接；空栏回退分栏钮或选项，不自动聚焦结束回合。正常舞台差分不重复摘挂已连接的同一手牌层，跨场次或选择面板不继承这份局部焦点。
- `battle/view/battle.discover-view.js` 为战斗发现的纯呈现切片，接收候选及卡面渲染器，专属样式只作用于发现决策；候选生成和选择效果继续由发现流程持有。`battle.aim.js` 的鼠标拎牌、停靠、目标选择和归位共用一条动画时钟，Enter确认复用当前鼠标目标会话；提交前解除active aim，再按核心回执管理待提交姿态。手牌层在采样出牌位置后用原始play事件释放姿态，同帧打出又回手时仍释放；本地源码依据与网页适配见[参考记录](evidence/2026-10-16-WF-battle-return-1016/drag-reference.md)。
- `battle/view/battle.discover-input.js` 维护发现页的UI输入门：同轮语义快照复用展开期限，每次页面绑定分配标识，提交前核验最新快照并锁定本轮；不抽牌、不改选择效果或存档。页面标识通过候选data属性传入普通UI动作委托。
- `ui/term-tips.js` 维护挂在body的公共解释单例：`data-term`用于既有词条，`data-ui-tip`与title/text/note属性提供动态控件说明，动态说明不拦截控件点击。战斗职业技能和能量沿此入口；已禁用技能通过外层锚点接受说明聚焦，发动条件仍在原按钮。
- `renderer.js`：Canvas 地图编排与视觉特效；`renderer.primitives.js` 提供纯绘图工具；`render-scheduler.js` 决定何时绘制。
- `audio/sound.js`：音频门面，装配 `sound.music.catalog.js`、`sound.music.player.js` 与 `sound.samples.player.js`。原创配乐按场景加载和切换；短音效仅播放已解码采样，未就绪时静默。旧声景和采样实现已退役清理。具体曲目与混音行为见[音频说明](audio-system.md)。
- `motion.js`：基于 Motion Mini 的 DOM 微动效门面，并统一处理减少动态效果偏好。
- `battle/view/battle.frames.js`：按需加载 PixiJS 播放战斗序列帧；`battle.vfx.js` 的轻量受击火花使用 WAAPI 动画。
- `narrative.js`：使用 inkjs 读取预编译剧情；全部 10 个 tt6 事件（选项、文案与效果标注）定义在 `narrative/events.ink`，构建、测试和开发启动前由 `scripts/compile-narrative.mjs` 生成运行时代码；效果结算通过 `game.run.js` 的效果端口表执行。

样式级联以 `game/index.html` 的 `<link rel="stylesheet">` 实际顺序为准：基础与功能层之后加载缩放和页面覆盖层。按当前引用定位样式文件，并检查目标页面的计算样式。

模块之间不得直接修改另一模块的私有变量；需要跨模块行为时应暴露命名命令、只读快照或一次性配置接口。

基地持久化分为 `base-state.js`（默认状态和旧档归一化）、`base-mutation.js`（同步草稿与提交结果）、`base-economy.js`（购买、拆包、领奖命令）、`base-progression.commands.js`（模式选择与研究所钥匙门禁）、`base-departure.commands.js`（一次准备命令中扣除出征卡并清理消耗区）、`base-pet-egg.commands.js`（宠物蛋保底）、`base-elapsed.commands.js`（累计游玩时间算术）、`base.js`（活动槽、存储保护与兼容接口）。标准 `mutate` 草稿命令在保存失败时不替换运行态；pet egg 的旧兼容命令则只推进内存 `eggPity` 并继续发放本次奖励，返回 `persisted:false`；elapsed 同样保留先推进内存、再尝试保存的旧 checkpoint 策略并显式报告持久化结果。这两类特定兼容命令不改变通用 `mutate` 的回滚语义。未改变的标准草稿分支保持引用，兼容旧收藏流程持有的卡堆。研究所门禁按整数钥匙储备校验并只扣一次；旧 `game.nest.js` 无费用解锁入口保留兼容语义。出征命令提交 Base 后 `game.session.newRun()` 才创建新局；Base 与 Run 使用不同存储，不能把这个单边事务称为跨存储原子提交。跨基地/对局的结算仍使用原 journal/requestId 协议。其他旧流程仍有直接写 `Base.data` 后保存的路径，不能把这次收敛理解为整个存档层已不可变。

`core/rule-config.js` 是只读共享规则来源，包含容量、战斗上限、撤离保留比例和兽王奖励概率；校验真实的字段范围和同组容量顺序。预估和实际结算读取同一常量，随机抽取仍留在原调用位置。

`Base.selectMode()` 与 `Base.unlockNestGate()` 是模式偏好和研究所门禁的事务写入口；对应 UI 不再直接写这两个 `Base.data` 字段。此约束只覆盖这些已迁移字段，其他旧流程仍需逐步收敛。严格检查按目录/能力增量启用；全局 `jsconfig.json` 尚未整体改为 `strict`。`battle.selection-flow.js` 的独立严格配置验证新建的 `cards`、`deny`、`random01`、取消检查及发现规则消费端口；该模块对既有 `battle.runtime.js` 活绑定的内部访问尚未纳入严格实现检查。`battle.hand-selection.js`、`battle.discover-candidates.js`、`battle.discover-state.js` 与 `battle.discover-flow.js` 的规则/状态实现进入纯模块严格检查；`meta-progression.js` 与 `battle-victory-progress.js` 通过 settlement 严格配置检查。runtime interaction 的发现状态/队列字段有精确 JSDoc，但这不代表整个 `battle.runtime` 严格化；也不要与 `card-rarity.js`、`card-render-context.js`、`base-departure.commands.js` 的源文件严格检查混为一谈。

## 质量检查与文档生成

自动检查入口见[质量门](quality-gates.md)；模块改进的过程与验收从[历史索引](archive/README.md)按任务查阅。
`scripts/architecture-graph.mjs` 由契约测试和 `tests/architecture-boundaries.test.js` 共用。检查包含缺失 JS 模块、不透明动态 import、运行时导入范围与独立领域模块的浏览器全局访问；判据采用真实域路径的精确集合，并以 `deadGuardKeys` 检查失效键。`hub/game.cardslib.page.js` 只有一个允许的入边：轻门面 `hub/game.cardslib.js` 的字面量动态 import；静态导入、重导出或其他模块的动态导入都会失败，防止照相馆页面被重新打入首屏。`RUNTIME_SURFACE` 覆盖兼容入口及五个运行态子模块；`RUNTIME_OWNERS` 包含 core、engine、enemy-phase、selection-flow、equipment、bag、lifecycle、exec-play，运行态模块也可互相导入。战斗视图通过 core 的快照和命令访问领域，不能直接读取运行态。这是源码依赖约束，不代表已消除兼容门面上的全部可变状态。
普通测试中的游戏全书校验只在内存生成内容；`npm run docs:compendium` 才会写入 `docs/game-compendium.md`，避免回归测试覆盖工作区文档。


## 二级界面与选择流程公共边界

- `ui/map-passage.js` 是直接移动与正反向闸门的共用跨层展示入口。正常返回带 `done/dispose/current` 的展示句柄，同层、减少动态或turbo返回空值；业务位置、存档和相机仍由调用方同步提交。移动沿用原moving锁，待同一层级幕结束后结算目标节点；表现取消不回滚业务，旧幕仅清理自身，3秒兜底释放输入。
- `ui/transition-preparation.js` 将装饰时长与独立资源准备并行，明确成功、失败与取消结果。普通/首脑入战仍保留650ms切幕和战斗自身真实首帧资源门，模块未完成时原幕不提前关闭；失败交原加载错误流程处理。撤退与出发只在既有切幕期间预热地图，不提前结算或缩短原时长。
- `ui/page-surface-lifetime.js` 统一展示目标的连接、归属、关闭和页面代次检查；加载等待、普通页揭幕与装饰切幕使用同一失效清理边界。旧目标失效后不执行旧揭幕，清理仅释放自身展示；装饰图片失败/超时继续降级，业务入口仲裁仍由 `page-entry-cancellation.js` 负责。
- `ui/overlay-return-state.js` 统一临时帮助页的滚动与焦点快照、页面代次校验和一次性返回。`overlay.showHelp` 默认接入背包、商店购买、商店出售与撤离帮助；消费者继续负责对局/档位/结算身份校验及同步重建。快照只保存数值和稳定元素描述，不保存旧 DOM 或游戏状态；异步重建不在此返回协议内。
- 战斗快照只读公开 `consumed` 与 `grave`，显示层按普通战/首脑战选择本场消耗牌堆；统一查看器与用语不改变两种消费结算语义。发现队列的 `act: noInfuse` 沿现有队列与状态传递，仅选中候选生成的实例获得免注能标记，候选模板不改；灵能召唤的文本与结构化规则共用此流程。存档仍恢复战斗起点，不保存待选发现面板。
- `battle/view/battle.selection-ui.js` 统一选择状态投影、取消分派和目标提示条。点击选牌、卡牌二次选靶、道具、职业技能共用提示与取消入口；注能保留材料布局并复用取消分派。命令层仍负责合法性、资源与提交，提交不调用取消；来源焦点只在明确取消且上下文有效时恢复。
- `ui/card-browser-state.js` 共享单次操作内的列表采集、筛选和选中差分更新，收藏、人物招式池、仓库复用；分页模块接受仍属于当前轨道的节点列表，失效或替换节点重新读取。它不跨操作缓存卡牌数据，重复筛选/选中不重复写相同 DOM 属性。
- `ui/reward-state.js` 只读已领取/已放弃记录，派生待领集合、回执与摘要；`reward-scene-view.js` 统一卡下及放大详情的领取按钮、整理与选卡返回按钮。三选一、普通收下、腾位领取保留不同动作与风险说明；这些展示模块不授予奖励、不修改容量或存档。
- `css/secondary-ui-tokens.css` 向明确的二级页面消费者提供共用颜色、间距、字级、按钮和焦点规格，避免同类控件各自维护常量。具体消费者和样式层级见 [二级界面样式规范](modules/secondary-ui-style.md)；页面结构和主题差异不由 token 层覆盖。

## 背包与战斗呈现边界

- `core/card-capacity.js` 提供按类型的叠放上限与顺序收卡预估；背包、安全格转移、奖励整理和出发预览传入完整卡牌，避免装备退化为普通卡的叠放上限。散装物资保留聚合存储，背包渲染按每3件分格。
- `game.bag.token-craft.js` 提供通行证合成的纯计划：先解析产物模板、当前材料与碎片，再由背包单一提交入口生成UID、扣料、记录及保存。详情页指定UID和堆叠放大页首张A的来源语义保持独立；失败不改变材料，安全格与容量规则不由配方模块改写。
- `game.bag.rules.js` 将传说池的 `discover` 交由地图消费器结算，通行证C在背包可用；战斗侧仍沿发现候选流程。背包主层不渲染解释段落，帮助入口与实际操作回执保留。 帮助返回保留分区、筛选和排序，并恢复进入前的面板滚动与帮助入口焦点；原对局或卡牌数组失效时不返回旧背包。
- `battle.hand.js` 先按初始攻击、招式、其他、装备、注能主卡排序；同类保留UID槽位。`battle.layers.js` 将诅咒之刃的当前诅咒写入规则阅读区，玩家护甲徽记附着生命条。
- `expedition.view.js` 在 `travel` 模式不改侧栏inset或重新取景；移动结束后侧栏变化以镜头补间衔接。地图首脑入口走正常 `prepareDeckSelection`，显式开发自动入口与龙巢保留原行为。

自身有效效果由 `battle.player-effects.js` 白名单投影到快照，显示作用与持续期/次数；投影不读取待选卡、不修改延迟队列。状态签名包含投影，过期及时移除，既有BUFF/CURSE显示继续独立保留。
