# 架构与模块接口

本文维护模块职责、依赖方向和接口边界；实现位置见[源码目录说明](../game/src/README.md)。当前占用与交付证据从[状态入口](STATUS.md)查询，接口说明的适用范围由对应源码和契约测试核对。

## 入口与依赖方向

公共返回按钮由 `ui/home-linked-interactions.js` 的 `linkedBackHTML` 生成，背包和商店复用相同图标与可访问名称，快捷键及文字由调用页传入。`ui/motion-presets.js` 同时提供脚本参数和CSS变量；普通卡牌特写、照片收回、商店详情及返回地图使用该参数来源。商店详情开合和卡牌/照片详情关闭通过 `ui/motion-completion.js` 统一等待目标动画或过渡结束、超时收尾、取消旧操作及减少动态效果处理，隐藏节点和恢复焦点仍由所属页面完成。

背包、局内商店与基地操作提示共用 `ui/operation-notice.js`：每个所属页面保留一个提示通道，新结果替换旧提示与计时器；成功提示显示3200ms，警告由所属页面显式替换或清除，保存失败不会自动消失。提示文案按纯文本转义，配色、状态播报与减少动态效果规则由公共样式维护，位置和业务结果由页面提供。

`index.html` 只加载 `src/main.js`。首页展示、全局界面控制器、游戏内核和启动展示都由该入口按 `BOOT_ORDER` 装配；启动集成测试加载同一入口，契约同时检查 HTML 入口与导入顺序。所有源码均为 ESM，模块自身使用显式 `import` 描述依赖。

源码按功能域分目录：`core/` 管规则、随机、输入与绘图底座；`ui/` 管全局界面；`experience/` 管章节风险徽标；`cards/` 管卡库、同步与规则；`run/` 管局内地图与流程；`hub/` 管基地、背包与存档；`home/` 管首页与叙事；`audio/` 管音频；`agent/` 管自动游玩与统计。根层保留装配入口和 `generated/`。

`battle/` 内分为 `core/`（装配、引擎、结算、快照）、`effects/`（效果流水线）、`runtime/`（运行态）、`view/`（渲染）、`bag/`（牌堆与卡费）；装载器与符文入口在战斗域根目录。

分层从底向上为：规则/数据与纯工具 → 状态和领域逻辑 → 功能视图 → 启动接线；高层依赖低层。核心状态模块不得反向导入 `boot`、`run`、`hub`、`notes` 或具体视图。`tests/contracts.test.js` 通过 AST 依赖图拒绝循环依赖，覆盖子目录、重导出与动态字面量 import。

`architecture-graph.mjs` 自动保护 `*.commands.js`、`*-commands.js` 与 `*execution-plan.js`：命令和计划不能新增浏览器门面、全局状态或页面依赖。四个战斗用例和两个局内控制器另受显式端口边界保护。既有 base/collection/extraction/recovery 命令的浏览器适配、局内工厂的五项显示/数据适配保留精确例外，新文件不继承；该检查约束直接依赖与标识符访问，不代表所有传递依赖都已纯化。

`npm run typecheck` 检查 `game/src` 全部自有运行实现，包括 generated、根层 QA 与预览入口。`jsconfig.runtime.json` 使用 `checkJs:true / strict:false` 提供全域基线；原有严格配置继续检查各自实现及接口正反例。覆盖数量随源码变化，以当次类型门输出为准；已完成批次及其输入从[项目状态](STATUS.md)定位。接口 fixture 或导入可达本身不计为实现覆盖。覆盖门在隔离源码副本逐文件注入必定出错的赋值，只将编译器实际报告该行错误的文件计入覆盖，新增源码漏列或 `@ts-nocheck` 会阻断总门。

runtime 基线通过 `core/sdt-facade.typecheck.d.ts` 和 `runtime-env.d.ts` 读取具名导出的真实类型及浏览器/构建变量；`sdt-facade.js` 仍作为显式源码输入接受实现检查。该模块后缀解析只用于 runtime 配置，原严格配置保留原解析方式。配置清单由 `scripts/check-type-coverage.mjs` 统一维护；逐文件结果见[本轮覆盖证据](evidence/2026-10-21-WF-types-full-1021/coverage-I02-final.json)。

`agent/agent.js` 装配 `SDT.Agent`，观察和动作执行复用 UI、移动与战斗命令；策略、权重、LLM 适配、记录统计和数据页分模块。同步动作分派与 `stopRun()` 留在轻门面；`step/autoRun/waitSettle` 首次调用才加载 runner runtime，取消、期限与对局身份核对覆盖冷加载等待。回放执行和 LLM 网络实现各自在首次请求时加载，解析、配置与 fallback 保持原接口。批跑、比较、进化和台账工具位于 `game/tools/agent-*.mjs`，接口与实验方法见[协议](agent-protocol.md)和[迭代手册](agent-iteration-playbook.md)。

`Agent.replay.capture/play` 通过可信的本地 fixture 适配器重建战斗起点，记录并重放真实 Agent 战斗命令、目标选择及逐步规则状态；在首处初态、结果或状态分歧停止。`BattleSession.getReplayState()` 提供与展示快照分开的只读诊断投影，Agent 不直接导入战斗运行态。该入口用于受控开发复现，恢复能力取决于本地适配器，不能恢复任意中途对局；调用方须提供代码与版本指纹，详细契约见[Agent 协议](agent-protocol.md#战斗命令复现)。

手牌选择由 `battle.hand-selection.js` 生成合法UID与可取消性，快照、UI和Agent共用；提交仍执行领域最终复检。`battle.enemy-plan.js` 统一蓄力、冰冻、退场与攻击次数，意图、回合预测和敌方行动分别在需要时读取当前值。

`battle.facts.js` 记录提交时的伤害与完成出牌值，保存在当场 `pstat.requestedCards.history`，不保留卡牌或单位的可变引用。防御牌的本回合伤害条件查询事实；出牌计数在原结算完成点由事实回写，当前牌不计入自身效果所读的“其他牌”。旧伤害回合标记保留为兼容事件，不伪造伤害数值。

`cards/card-instance.js` 供商店、事件收牌和卡面刷新深拷贝嵌套数据，UID由原调用方提供。`card-instance-fields.js` 明确已知字段的局内、战斗、单次施放和展示生命周期；刷新保留锦囊与未知历史扩展，清除已知临时字段，缺少模板的自定义牌不改。自然法杖在 `zeroFeeUntil` 写入明确的目标回合改费记录，费用查询仍兼容旧数字，保持原费用优先级与目标回合内重复生效规则。

随机服务按用途隔离命名流：击杀喝彩使用 `visual`，终局记录 ID 使用 `recording`，默认随机策略使用 `agent-policy`；这些调用不推进玩法流。新增流沿现有 seed/rngState 保存，不改变随机算法或存档格式。默认随机策略与击杀后的规则序列相对旧实现会变化，旧实验基线须区分本次实现。

## 稳定接口

- `RULES`：跨功能固定数值，只读且冻结。
- `window.SDT`：页面调试与旧调用的兼容门面；新增代码优先使用 ESM 导出。
- `BattleSession` / `window.SDT.Battle.start(game, enemies, options)`：开始战斗；后者是兼容门面。
- `window.SDT.Battle.getSnapshot()`：取得战斗只读快照。
- `window.SDT.Battle.commands`：统一战斗命令，包括出牌、注能、结束回合、逃跑和消耗牌堆操作。
- 出牌视图通过 `commands.getCardPlayAvailability(uid, side?, forceDirect?)` 只读查询当前可用性，通过 `submitCardPlay` 接收拒绝、等待输入或带回执的入队结果；原 `playCard` 返回语义保留。入队回执按场次、UID和动作序号区分，源牌扣费并移出手牌后即确认提交，后续效果取消不改写该事实。类型见 `battle.play-submission.types.d.ts`，细节见[提交合同](evidence/2026-10-16-WF-battle-play-feedback-1016/core-contract.md)。
- `configureGameRuntime()`：由启动模块注入界面跳转，避免 `game.session` 反向依赖页面模块。
- `game.session.browser.js`：只由 `game.boot.js` 调用 `createGameCanvas(document)`；canvas、ctx 和日志端口注入 session kernel。kernel 直接导入 MAP/FX，可在无 DOM 的原生 Node 环境导入；源模块仍向 SDT 发布同一对象，GameStore 与页面持有的会话和地图引用不替换。`main.js` 保持页面装配清单，`boot-order.js` 保留独立顺序合同，兼容页面的整体求值顺序仍受保护。
- `configureCardNavigation()`：由基地模块注入卡牌页面关闭与刷新行为。
- `RenderScheduler`：活动状态目标 120 FPS；静态地图仅在状态失效或活动切换时绘制，主循环保留约 4 Hz 状态巡检；全屏遮罩暂停地图绘制。目标值不等于当前设备上的实测交付帧率。

## 功能分工

- `game.store.js`：创建可变会话状态，`getSnapshot()` 默认递归复制并冻结普通对象和数组，包括节点奖励、入场物资与后加的普通会话字段；保留共享关系与循环。map、altarFrom、hover、moveTarget 明确保留运行态引用，rings 只复制并冻结行；函数、访问器和带原型对象是不透明端口，不遍历其内部，访问器也不在取快照时执行。因此只读保证覆盖普通数据副本，不覆盖这些运行态端口返回的对象。
- `game.storage.js`：五槽对局存档键、读写和 v1 迁移。
- `game.session.js`：会话派生数据与对局生命周期，拆为 `game.session.kernel/modes/bag/map/board/death.js` 六片；`game.menu.js` 保留同步标题/退出与轻量菜单入口，非首屏选档、指南、成就、设置、反馈和离开面板由 `game.menu.pages.js` 首次请求时加载；页工厂注入会话能力和标题回调，不反向导入会话模块。冷入口提供可见载入层、取消/重试与最后请求优先，已载入的页工厂复用并保持热入口同步。
- `game.cardslib.js`：卡牌库轻门面；首次进入照相馆或制作坊时动态加载 `game.cardslib.page.js`。页面及其制作坊、照片道具、性能探针、图片预热和共享模块保持在门面之后，避免静态依赖回到首屏；制作坊写开关保持关闭。`ui/ui.js` 组合 `overlay.js`、`cinematics.js`、`hud.js`。
- `game.hub.preparation.js`：基地整备控制器，通过数据、视图、导航和错误处理端口装配 `preparation.commands.js` / `preparation.view.js`；不读取 `SDT`、`UI`、`document` 或 `window`。页面 dispose 会阻止过期异步返回继续更新 UI。
- `game.run.data.js`：场景、事件与职业叙事授权数据；`game.run.shop.js` 装配商店页面与交易命令；`game.run.js` 保留移动、格子、事件、祭坛与撤离公共入口。
- `run/shop-commands.js` 接收当前状态、容量、UID、价格与保存端口，承接购买、补充初始攻击、出售及委托优惠的状态更新；命令提交前复检资源与对象身份，页面控制器保留浏览、生命周期和反馈。保存失败保留完整内存成交，由原页面提示重试。
- `run/event-commands.js` 承接事件支付、奖励准入、整批重编及结算预留；`game.run.events.js` 持有单个事件控制器的确定性抽取、页面身份、中间选择和奖励承接，`game.run.resources.js` 持有资源领取。`game.run.flow.js` 首次普通事件入口通过 `event-runtime.js` 加载事件控制器、骰子与剧情呈现，并注入会话和呈现服务；冷入口支持取消、重试、超时及对局身份检查。待领奖恢复仍在 `event-lifecycle.js` 同步返回布尔值；移动和落脚编排保留在 flow。
- `shop-browse-state.js` 只捕获商店背包往返的DOM浏览位置、详情规则展开与焦点动作标识；控制器在同会话和新页面身份仍有效时恢复，不写入对局状态或存档。
- `core/run-checkpoint.js` 统一局内同步保存的失败结果，保留旧端口无返回值兼容；它不回滚已经完成的内存结算。商店购买与出售核对原商品/报价、owned/UID及当前会话并阻止重入；保存失败保留本局完整成交并提示重试，离店失败留页。委托优惠应用失败回退尚未提交的价格草稿，保留已掷定格位。
- `battle/view/battle.scenery.js` 按本场 token 固定场景配置。当前普通战与首脑战统一使用 `platform-minimal-1016` 的远景、透明站台地面与透明前景；`game.run.data.js` 预载同一组三图。分层模式按完整画幅叠放，人物站位与战斗动作仍由原视图和动画层持有；本轮接入及待统一验收范围见[场景记录](evidence/2026-10-16-WF-battle-platform-minimal/README.md)。
- `game.hub.js` 是基地轻门面，选档后首次进入才动态加载 `game.hub.runtime.js`；后者装配出征整备、页签与中立桥；`game.bag.js` 装配拖拽、战后结算与背包中立桥。基地与照相馆的待开页请求通过 `ui/page-entry-cancellation.js` 互斥，返回标题、选档或更新导航会取消旧请求；加载失败可重试，档案状态不复制。基地样式仍静态加载。对应切片以 `game.hub.*.js`、`game.bag.*.js` 命名；切片通过桥互调，contracts 检查循环依赖。
- 正常基地和整备通过 `hub/command-errors.js` 格式化错误，不加载退役家具的 presenter、命令或控制器。兼容出口 `renderHomeScene` 返回 false，不导航、不取消正常基地加载、不写存档；退役模块、旧数据和收据保留。
- `run/game.run.altar.js` 保留祭坛、火堆、撤离恢复的同步入口，并把 `openClassChoice()` 转交给选角轻门面 `run/game.run.class-choice.js`；人物与卡池页面 `game.run.class-choice.page.js` 及人物翻页动效仅在实际请求选角时动态装载，无标题/基地 idle 预取。入口 Promise 在页面就绪后完成；出征切幕等待该结果。`loadGame()` 同步返回恢复分支与持久化明细，异步 Base 写入由 `pendingPersistence` 确认；未选角存档另附 `classChoiceEntry` 供选档 await，Promise 不写入游戏或存档状态。选角下载与其他待开页互斥；取消、换档/换局和来源宿主变化废弃旧结果，失败保留 pending run 与可重试入口。
- 基地 `home.scene.js` 与 Pixi 在首次打开基地场景时动态加载；请求序号和挂载节点检查阻止已关闭页面的加载结果继续挂载。稳定卡牌数据打为 `game-card-catalog` 缓存分块，仍是同步启动依赖，计入首屏脚本预算。预算值由 `scripts/perf-budget.cjs` 维护，实际产物大小与构建状态见对应任务证据。
- `cards.js`（壳）+ `cards.data.js` / `cards.rules.js` / `cards.sync.js` / `cards.consts.js`：卡池数据、推导与经济规则、迁移播种、共享常量；`window.SDT.Cards` 键面与数据字节不变。
- `structured-card-description.js` 从完整的自指向 `onPlay` 声明读取包扎、坚守两种已审阅句式的治疗、护甲和抽牌数值；`displayCardDescription` 接受兼容的可选整卡参数，卡面与照相馆引用渲染器消费该结果。未知字段、不完整或复杂声明以及自定义文案保留原描述；卡牌数据和效果执行不由展示层改写。
- `cards.sync.js` 的 TT10/TT11 历史批次重播优先使用 `cards-sync.json` 同 id 定版字段，并服从其退役清单；定版未提供的仓库元数据仍保留。迁移标记存在时不覆盖玩家后续编辑。
- `game/data/cards-sync.json` 是生成数据，使用 `scripts/sync-cards-from-live.mjs` 更新，不手改；改卡牌描述时递增版本，退役卡进入退役名单并递增版本。新增卡必须进入同步数据，保证历史批次重播可解析。
- TT10/TT11 内联历史快照须与同步数据保持一致，由 `tests/cards-sync-snapshot-guard.test.js` 守卫；卡牌效果审计例外与回归入口见 `docs/quality-gates.md`。
- `cards.catalog.js`：按稳定 id 解析 TT10/TT11 的定版引用，定版字段优先，历史独有元数据随后补齐；缺失 id、重复 id、继续内联定版条目均明确失败。其他批次保持原数据入口。
- `cards/card-rarity.js`：英雄线与衍生牌稀有度的纯规则实现，由调用方注入按 ID 查找。Cards 门面继续用 `Array.find` 保持原数组首项优先；`card-render-context.js` 在照相馆一次浅目录快照中构造 first-ID 索引，筛选、排序和各延迟挂载批次共用该快照，页面数据刷新后重建，关闭时释放索引。
下文战斗模块文件名相对上方五个子目录；具体路径按[源码目录说明](../game/src/README.md)定位。

- `battle.core.js`：浏览器战斗装配与命令门面；默认状态在 `battle.runtime.js`，独立状态由 `battle.runtime.factory.js` 创建。引擎及敌方阶段共用对应领域工厂；纯引擎不访问 DOM 或依赖战斗视图，BOSS 编组和消耗牌堆页面由快照驱动。
- `battle.effects.js` + `effect-steps.js`（有序步骤表本体，拆片 `effect-steps.<节>.js` 按原序 concat——顺序即语义）：文本时点解析与效果执行器；执行器只通过显式端口改变战斗状态，不访问 DOM。
- `cards/card-trigger-contract.js` 维护时点词表和声明所有权；纯 `cards/card-execution-plan.js` 统一时点、装备与打出效果的来源计划、注册快照、基础字段所有权及隔离执行视图。`battle.trigger-source.js`、触发 runner、装备及 resolver 共同消费该计划；显式空数组仍拥有对应时点，其他尚未迁移的时点保留文本兼容。获取、抽到、消耗由当事卡直调，其余七个触发时点由 runner 登记；打出效果在 resolver 执行。capability 入口恢复执行卡保留的完整声明后预检；schema 保留原执行视图导出。复杂文本效果体仍由原解释器执行。
- `battle.triggers.m2.js` 按本次事件的登记快照同步派发，执行前预留持续次数，阻止同一登记同一时点的递归重入；战斗身份变化、取消和结束使旧派发失效。回合开始的延迟任务固定当前批次，新产生的任务留给后续回合；恢复仍重演入场检查点，不新增中途触发器存档。
- `battle.deck.js` / `battle.rules.js`：可独立测试的洗牌、回收、目标判定和出牌限制。
- `battle.card-cost.js` / `battle.intent.js`：显式接收卡牌与战斗状态值的费用、敌方意图纯计算；`battle.engine.js` 保留原接口并收集状态，纯计算模块不读取 `window.SDT` 或 DOM。
- `battle.card-inspection.js`：卡实例查找、费用上下文、手牌诅咒与费用交换，通过 cards、curseMeta、readState 三个端口访问引擎；保留原 engine 导出，不创建第二份运行态。有效卡面查询在单次调用内复用已查得的归属实例；不跨调用缓存，可立即反映替身、归属列表与转换规则变化。消耗区法术计数仅在费用规则实际进入该折扣时读取，保持原有费用优先级。`hosted-catalog-index.js` 按原来源顺序建立一次索引，保持重复 ID 首项优先。
- `battle.runtime.factory.js` 创建每场实例自己的状态与更新方法；浏览器默认实例在 `battle.runtime.default.js` 创建，原五个运行态子模块（session/piles/interaction/effects/presentation）继续提供它的 ESM 活绑定。实例通过同一工厂运行，不复制或交换全局状态。
- `battle.engine.factory.js` 通过 `battle.engine.instance.js` 创建完整引擎。运行态、Combat 钩子、随机流、战斗统计、动作队列、取消代次和表现等待均归各实例所有；卡库、规则及音效等服务由参数注入。该入口及领域实现可在无 `window`/`document` 的 Node 环境执行真实开战、出牌、敌方回合与结束。`battle.engine.js` 保留浏览器兼容接口，只在默认装配边界绑定 `battle.default-context.js`；活动战斗或队列未排空时拒绝重配。
- `*.domain.js` 是选择、装备、背包、生命周期、出牌与效果的共同实现，旧文件名只作显式端口工厂或默认适配。`battle.execution-session.js` 管理实例取消与代次，`battle.action-runner.js` 管理串行动作；`battle.playback.js` 保持纯逐拍流程，浏览器反馈、帧提交和时间等待由 `battle.browser-presentation.js` 注入。带时长的动作先等待渲染帧提交，再读反馈队列与命中时钟；无时长的同步流程立即完成。旧回调同时核对战斗 token 与执行代次。
- 引擎内的效果端口装配、开战机制与快照投影分别在 `battle.effect-assembly.domain.js`、`battle.setup-mechanics.domain.js`、`battle.snapshot-projection.domain.js`；它们接收同一实例的 runtime、服务和命令，装配中的跨片命令通过调用时回调读取。`battle.acquire-operation.domain.js` 与 `battle.status-operations.domain.js` 承担结构化获取、诅咒和祝福操作，结算入口仍保留声明顺序和原返回语义。快照投影每次读取当前运行态，签名缓存归该实例所有。
- `battle.selection-flow.js` 是选择域的纯工厂入口；运行态、卡库、拒绝音效、随机源与取消检查显式注入。`battle.hand-selection.js` 单源提供选择名称匹配与支付候选规则；`battle.discover-candidates.js` 提供有序目录筛选和单次候选抽取；`battle.discover-state.js` 构造显式、随机及锦囊发现状态，`battle.discover-flow.js` 承载发现队列处理。非自定义发现池在单个面板内构建一次并保留源卡引用，自定义 `job.pred` 每次抽取仍重新查询目录/执行谓词。interaction 用 `getJobs()` 读取当前可替换队列。结构化抉择将展示标签与执行操作分开；重复回合效果保存声明操作和生效回合，公开快照只提供选择所需信息。
- `meta-progression.js` 是等级曲线与 XP 步进的共享纯计算来源；`battle-victory-progress.js` 从 Base 快照计算本场击杀、首个同名 BOSS 记录和逐敌职业经验。slot 战斗结算将计算后的 Base 一并纳入现有 journal attempt，提交成功后才发布升级演出与成就检查；重放已完成 receipt 不重复增加进度。无 slot 保留旧内存埋点路径。该流程仍使用分离的 Base/Run 存储，不能视为跨存储原子事务。
- `cards/card-rules.schema.js` 的 schema v2 是增量契约，`rules.version` 仍为 1；damage/heal/armor、curse、acquire、blessing/energy、refillEnergy 等操作的支持范围由 schema、解释器与测试共同确定。未支持的操作或参数由 pending 守卫拒绝。
- `battle.resolution.js`：完整单卡结算，显式接收当前状态查询与伤害、抽牌、回复、护甲、延迟效果等命名端口；引擎负责适配现有运行时。模块本身不读取全局状态，不直接修改运行时字段。
- 结构化定向抽牌与普通抽牌共用张数计算，支持字段值、区间及诅咒种数，零张不回填为一张。`untilHandN` 与 `filter` 的组合尚未实现，由 `card-rules.capability.js` 在支付或执行前统一拒绝；出牌、其他触发和装备操作共用预检。
- 结构化操作按声明顺序执行；触发和装备操作的执行视图与预检使用同一合成器。装备开战、主动技能和被动分别按字段声明拥有对应域，显式空数组、零值及关闭值不再回放该域的旧描述；末手重放由结构化或旧文本单路径执行。
- 现役内建可执行卡的打出、背包与装备行为均由结构化声明拥有；卡库重载时也从声明与内建数值默认表恢复字段，展示文案不改写执行数值。已知旧版规则按完整指纹迁移，自定义显式规则保持原值；未知历史卡及自定义文本卡仍沿兼容解释器执行。
- 文本与结构化对敌伤害共用引擎的庇护、元素庇幕、心数换算及伤害记录边界；数值准备与提交分离，敌人互殴保留敌方攻击者身份。直调、延迟及被注能文本触发共用沉默门：保留前置条件和伤害步骤，封锁其他技能步骤；神秘药水的既定延迟产卡例外由调用方显式保留。
- `battle.snapshot.js`：按输入值构造视图快照；引擎负责收集输入和维护签名缓存。保留原有快照字段和复制/冻结层级，不宣称任意嵌套对象都已深冻结。
- `battle.view.js`（渲染壳）+ `battle.overlays/layers/vfx/anim/aim/hover.js` 六片：只读取 `getSnapshot()` 快照、渲染 DOM、派发 `commands` 并向核心注册渲染器；viewApi 反取已改 core 具名直引。
- `battle.infusion-view.js` 与 `battle.infusion-material-state.js` 在原舞台和手牌层内投影主卡、逐UID候选与已选区；取消恢复原手牌节点、滚动和焦点。注能及发现的专属样式只在选择期间虚化战场后景，普通战斗不受影响。`battle.potion-use.js` 持有道具说明及使用面板的输入生命周期；悬停阅读、点击固定与明确使用分离，提交前校验当前舞台、场次和道具UID，关闭时释放旧事件。
- `battle.pile-view.js` 为牌库与消耗牌堆生成同源整卡网格；按有效卡面分组后排序副本列表，保留原卡、UID和实际牌序。`battle.decision-content.js` 保留原呈现入口，`battle.overlays.js` 沿公共 `bindBattleDecisionInspection` 打开大卡；牌堆刷新保留网格滚动和焦点。发现及牌堆的专属样式以不透明战斗底板隔离地图，再对保留的战场作轻度退焦。
- `battle.hand-hit.js` 的按牌记录随场次、回合、阶段、结算或选择/查看模式及可见 UID 列表变化失效，避免结算期间被拒绝的拿牌在恢复后由迟到 click 重新选牌。背景战场渲染按真实快照同步交互模式；单纯能量变化不取消阅读。出牌仍走原 view/aim 与核心命令。
- `battle.layers.js` 在当前手牌差分前捕获卡面/规则区焦点及阅读滚动位置，更新后按原牌组、存活近邻交接；空栏回退分栏钮或选项，不自动聚焦结束回合。正常舞台差分不重复摘挂已连接的同一手牌层，跨场次或选择面板不继承这份局部焦点。
- `battle.view.js` 持有左侧牌库、手牌切栏与能量的排列及切栏视图状态。上一栏/下一栏保留可用方向和当前进度，单栏隐藏；切换前清理旧栏动画与卡槽，新栏卡牌从左到右逐张升起（140px、每张280ms、间隔65ms），减少动态偏好下直接显示。输入同时核对当前控件、场次和分页版本，切换后焦点回到有效方向按钮。
- `battle/view/battle.discover-view.js` 为战斗发现的纯呈现切片，接收候选及卡面渲染器，专属样式只作用于发现决策；候选生成和选择效果继续由发现流程持有。`battle.aim.js` 的鼠标拎牌、停靠、目标选择和归位共用一条动画时钟，Enter确认复用当前鼠标目标会话；提交前解除active aim，再按核心回执管理待提交姿态。手牌层在采样出牌位置后用原始play事件释放姿态，同帧打出又回手时仍释放；本地源码依据与网页适配见[参考记录](evidence/2026-10-16-WF-battle-return-1016/drag-reference.md)。
- `battle/view/battle.discover-input.js` 维护发现页的UI输入门：同轮语义快照复用展开期限，每次页面绑定分配标识，提交前核验最新快照并锁定本轮；不抽牌、不改选择效果或存档。页面标识通过候选data属性传入普通UI动作委托。
- `ui/term-tips.js` 同步安装词条委托与输入隔离，解释渲染单例由首次词条交互加载的 `term-tips.runtime.js` 创建；冷等待期间只保留当前有效意图，取消或隐藏后不会迟到展示。词条接口：`data-term`用于既有词条，`data-ui-tip`与title/text/note属性提供动态控件说明，动态说明不拦截控件点击。战斗职业技能和能量沿此入口；已禁用技能通过外层锚点接受说明聚焦，发动条件仍在原按钮。
- `renderer.js`：Canvas 地图编排与视觉特效；`renderer.primitives.js` 提供纯绘图工具；`render-scheduler.js` 决定何时绘制。`map-layer-atmosphere.js` 维护四层背景的冷灰、蓝白、灰青、暗紫雾色与残影组合；`map-city-atmosphere.js` 将原透明城市残影烘焙进背景，每层仅显示一处 `map-environment-1021/` 简笔环境，其下缘淡出按层缓存，全景时适度缩小；节点、路线和布局不参与分层着色。道路区分选中、可走、两端已探索及其余已知连接，沿用探索记录而不新增逐边行走历史。已完成节点保留轮廓与小勾，省略常态“未完成”和重复“已完成”文字牌；待领奖、商店状态与祭坛条件仍显示。节点编号默认关闭，开发模式开启编号时绘制。
- `audio/sound.js`：音频门面，装配 `sound.music.catalog.js`、`sound.music.player.js` 与 `sound.samples.player.js`。原创配乐按场景加载和切换；短音效仅播放已解码采样，未就绪时静默。旧声景和采样实现已退役清理。具体曲目与混音行为见[音频说明](audio-system.md)。
- `motion.js`：基于 Motion Mini 的 DOM 微动效门面，并统一处理减少动态效果偏好。
- `battle/view/battle.frames.js`：按需加载 PixiJS 播放战斗序列帧；`battle.vfx.js` 的轻量受击火花使用 WAAPI 动画。
- `narrative.js`：使用 inkjs 读取预编译剧情；全部 10 个 tt6 事件（选项、文案与效果标注）定义在 `narrative/events.ink`，构建、测试和开发启动前由 `scripts/compile-narrative.mjs` 生成运行时代码；效果结算通过 `game.run.js` 的效果端口表执行。
- 事件节点在核心结算前预留完成凭据，使首次待领奖保存同时记录事件完成；未承接且尚未发放时恢复原选择，已经发放的内容不因保存失败重新结算。事件选牌、骰子和重编的旧回调核对当前上下文；保存失败留页重试，原骰结果及已支付事实保留。

样式级联以 `game/index.html` 的 `<link rel="stylesheet">` 实际顺序为准：基础与功能层之后加载缩放和页面覆盖层。按当前引用定位样式文件，并检查目标页面的计算样式。

模块之间不得直接修改另一模块的私有变量；需要跨模块行为时应暴露命名命令、只读快照或一次性配置接口。

基地持久化分为 `base-state.js`（默认状态和旧档归一化）、`base-mutation.js`（同步草稿与提交结果）、`base-economy.js`（购买、拆包、领奖命令）、`base-progression.commands.js`（模式选择与研究所钥匙门禁）、`base-departure.commands.js`（一次准备命令中扣除出征卡并清理消耗区）、`base-pet-egg.commands.js`（宠物蛋保底）、`base-elapsed.commands.js`（累计游玩时间算术）、`base.js`（活动槽、存储保护与兼容接口）。标准 `mutate` 草稿命令在保存失败时不替换运行态；pet egg 的旧兼容命令则只推进内存 `eggPity` 并继续发放本次奖励，返回 `persisted:false`；elapsed 同样保留先推进内存、再尝试保存的旧 checkpoint 策略并显式报告持久化结果。这两类特定兼容命令不改变通用 `mutate` 的回滚语义。未改变的标准草稿分支保持引用，兼容旧收藏流程持有的卡堆。研究所门禁按整数钥匙储备校验并只扣一次；旧 `game.nest.js` 无费用解锁入口保留兼容语义。`base-departure.commands.js` 提供隔离的出征计划；`game.session.newRun()` 返回 Promise，由 `departure-persistence.js` 在同槽 Web Lock 内将扣仓结果与首份 Run 写入同一恢复日志。提交完成后才发布新局与页面表现；失败保留原内存和随机流，已开始的日志由重试或重新选档恢复，不再次扣仓。调用方 await 结果，等待期间取消或换档会废弃原请求。跨基地/对局的结算仍使用原 journal/requestId 协议。兼容流程仍可修改 `Base.data` 内存草稿再调用异步保存；存储写入统一持锁，但 `Base.data` 不是只读对象。

`slot-write-lock.js` 是 Base 单键、恢复日志和出征两键写入的共同协调器。所有 Base 物理写入（含坏档备份、重置、删除及旧档迁移）必须持有对应 `sdt-slot-<slot>` Web Lock 与当前同步回调内有效的 lease；伪造、跨槽或已释放的 lease 均拒绝。Base 的公开写 API 返回 Promise，`peek`、`use` 等读取入口仍同步。调用方等待原业务结果并处理失败，`flushWrites()` 可等待已经排队的写入；缺少 Web Locks 时明确失败，不退回无锁写入。

时长、宠物蛋保底和成长 checkpoint 仍立即推进当前内存，持久写入排队等待同槽锁。已准备事务等待期间若出现新 checkpoint，提交会先保存该进度，再以 `STALE_REVISION` 拒绝旧准备结果，调用方重新准备；不会用旧事务覆盖新 checkpoint。`saveGame()` 保持同步 Run 保存；需要完整 Base 与 Run 回执的保存退出使用异步 `saveSession()`。选档等待初始化、改名迁移和 `loadGame().pendingPersistence`，失败留在可重试入口，迟到结果不改写新页面。

`core/rule-config.js` 是只读共享规则来源，包含容量、战斗上限、撤离保留比例和兽王奖励概率；校验真实的字段范围和同组容量顺序。预估和实际结算读取同一常量，随机抽取仍留在原调用位置。

`Base.selectMode()` 与 `Base.unlockNestGate()` 是模式偏好和研究所门禁的事务写入口；对应 UI 不再直接写这两个 `Base.data` 字段。此约束只覆盖这些已迁移字段，其他旧流程仍需逐步收敛。严格检查按目录/能力增量启用；全局 `jsconfig.json` 尚未整体改为 `strict`。`battle.selection-flow.js` 的独立严格配置验证新建的 `cards`、`deny`、`random01`、取消检查及发现规则消费端口；运行态由显式端口注入，但领域实现尚未全部纳入严格实现检查。`battle.hand-selection.js`、`battle.discover-candidates.js`、`battle.discover-state.js` 与 `battle.discover-flow.js` 的规则/状态实现进入纯模块严格检查；`meta-progression.js` 与 `battle-victory-progress.js` 通过 settlement 严格配置检查。runtime interaction 的发现状态/队列字段有精确 JSDoc，但这不代表整个 `battle.runtime` 严格化；也不要与 `card-rarity.js`、`card-render-context.js`、`base-departure.commands.js` 的源文件严格检查混为一谈。

## 质量检查与文档生成

`jsconfig.framework-ports.json` 以 strict 检查真实 `battle.effect-assembly.domain.js` 和 `battle.snapshot-projection.domain.js` 的装配实现，两模块通过 `@ts-check` 开启实现检查。输入、内部命令及回执、文本/结构化效果输出和宿主服务的具名合同位于 `battle.core-ports.types.d.ts`；fixture 验证正反例，`framework-core-ports-types.test.js` 用真实源码的虚拟突变验证错误能量参数、错误 battleToken 和隐式 any 会被拒绝。该覆盖不包含旧 engine factory 或传递导入的全部效果执行器实现。

自动检查入口见[质量门](quality-gates.md)；模块改进的过程与验收从[历史索引](archive/README.md)按任务查阅。
`scripts/architecture-graph.mjs` 由契约测试和 `tests/architecture-boundaries.test.js` 共用。检查包含缺失 JS 模块、不透明动态 import、运行时导入范围与独立领域模块的浏览器全局访问；判据采用真实域路径的精确集合，并以 `deadGuardKeys` 检查失效键。`hub/game.cardslib.page.js` 只有一个允许的入边：轻门面 `hub/game.cardslib.js` 的字面量动态 import；静态导入、重导出或其他模块的动态导入都会失败，防止照相馆页面被重新打入首屏。`RUNTIME_SURFACE` 覆盖兼容入口及五个运行态子模块；`RUNTIME_OWNERS` 包含 core、engine 兼容壳与工厂、enemy-phase、selection-flow、equipment、bag、lifecycle、exec-play，运行态模块也可互相导入。战斗视图通过 core 的快照和命令访问领域，不能直接读取运行态。这是源码依赖约束，不代表已消除兼容门面上的全部可变状态。
普通测试中的游戏全书校验只在内存生成内容；`npm run docs:compendium` 才会写入 `docs/game-compendium.md`，避免回归测试覆盖工作区文档。


## 二级界面与选择流程公共边界

- 卡牌外侧不使用矩形线框。`game/css/card-layout-selected.css`统一清除卡面及卡牌容器在常态、悬停、焦点、选中和收牌时的outline、边框颜色及矩形box-shadow，保留手绘卡框资产、数量角标和文字区域；焦点以亮度变化表达。`ui/card-state-motion.js`只驱动抬升和缩放，不生成外侧描边；页面不另加卡牌矩形外框。

- 续局使用 `ui/transition-handoff.js` 的 `resume` 呈现配置：选档页保留至续局遮幕挂载，恢复与插画准备并行，不额外等待450ms；目标首帧准备完成后统一360ms淡出，标题先淡退，插画保持静止。公共呈现占用在恢复期间隐藏地图HUD与底栏，结束或失败后由所属续局操作释放并刷新；读档先重置数值显示缓存，把恢复值作为基线，不播放数值增减反馈。该配置由续局入口显式启用，节点、战斗和返回地图继续使用各自现有公共配置。

- `ui/map-passage.js` 是直接移动与正反向闸门的共用跨层展示入口。正常返回带 `done/dispose/current` 的展示句柄，同层、减少动态或turbo返回空值；业务位置、存档和相机仍由调用方同步提交。移动沿用原moving锁，待同一层级幕结束后结算目标节点；表现取消不回滚业务，旧幕仅清理自身，3秒兜底释放输入。
- `ui/transition-preparation.js` 将装饰时长与独立资源准备并行，明确成功、失败与取消结果。普通/首脑入战仍保留650ms切幕和战斗自身真实首帧资源门，模块未完成时原幕不提前关闭；失败交原加载错误流程处理。撤退与出发只在既有切幕期间预热地图，不提前结算或缩短原时长。
- `ui/page-visual-readiness-sharing.js` 按挂载目标、页面身份、展示代次及额外图片容器共享当前图片采样和解码等待；揭幕与基地切幕各自保留期限、背景、取消和最后呈现帧，最后订阅者释放后停止共享等待。
- `ui/page-surface-lifetime.js` 统一展示目标的连接、归属、关闭和页面代次检查；加载等待、普通页揭幕与装饰切幕使用同一失效清理边界。旧目标失效后不执行旧揭幕，清理仅释放自身展示；装饰图片失败/超时继续降级，业务入口仲裁仍由 `page-entry-cancellation.js` 负责。
- `ui/interface-motion.js` 安装后独占页面转场，旧 `transitions-director` 不再安装闸门观察器或启动闸门；独立旧宿主仍保留原入口。`page-motion-profiles.js` 为基地声明内容动效归属，控制器通过 `data-ui-shell="content"` 保持基地外壳静止，通用入场样式不再覆盖基地页内动画。首页冷入口取消后恢复首页导航，加载中的重复操作继续拒绝。
- `ui/overlay-return-state.js` 统一临时帮助页的滚动与焦点快照、页面代次校验和一次性返回。`overlay.showHelp` 默认接入背包、商店购买、商店出售与撤离帮助；消费者继续负责对局/档位/结算身份校验及同步重建。快照只保存数值和稳定元素描述，不保存旧 DOM 或游戏状态；异步重建不在此返回协议内。
- 战斗快照的 `consumedPile` 是普通和首脑战唯一消耗牌堆：由旧账本去重，排除手牌、牌库及正在结算的源牌。查看、复原、费用和增伤读同一集合；复原移动原UID并清理旧堆重影，牌库空后不自动洗回。`played`、`consumed`、`discard`、`grave` 保留内部兼容与战后结算用途，未取回卡不互换已打出和被消耗类别。普通99库临时牌可取回再用，战后仍不进入永久消耗区。发现队列的 `act: noInfuse` 沿现有队列与状态传递，仅选中候选生成的实例获得免注能标记，候选模板不改；灵能召唤的文本与结构化规则共用此流程。存档仍恢复战斗起点，不保存待选发现面板。
- 「挖宝」从真实牌库底最多三张中选择一张，其余按原顺序放回；旧规则n=1的该牌也沿此候选口径。选中原UID入手并按选中牌价格获得护甲，空库不补随机候选。设置中的「重新开始本场战斗」复用开战检查点，保留首脑编组并取消旧动作队列；旧页面及跨场点击拒绝，不另走战后结算或重开整局。
- `battle/view/battle.selection-ui.js` 统一选择状态投影、取消分派和目标提示条。点击选牌、卡牌二次选靶、道具、职业技能共用提示与取消入口；注能目标态通过 `fuelUids/battleToken/selectionId` 保留材料和选择身份，返回选材时重新校验，旧页面输入不作用于新选择。命令层仍负责合法性、资源与提交，提交不调用取消；来源焦点只在明确取消且上下文有效时恢复。
- `ui/card-browser-state.js` 共享单次操作内的列表采集、筛选和选中差分更新，收藏、人物招式池、仓库复用；分页模块接受仍属于当前轨道的节点列表，失效或替换节点重新读取。它不跨操作缓存卡牌数据，重复筛选/选中不重复写相同 DOM 属性。 收藏计数在筛选生效时分开显示匹配数与总收藏数，重置后恢复总收藏数；计数复用本次筛选结果，不另行过滤。
- `ui/reward-state.js` 只读已领取/已放弃记录，派生待领集合、回执与摘要；`reward-scene-view.js` 统一卡下及放大详情的领取按钮、整理与选卡返回按钮。宝箱显式传入 `claimMode`：选一使用横向候选区，全部可领使用纵向清单，额外附赠独立呈现；差分更新保留卡牌DOM与滚动容器。三选一、普通收下、腾位领取保留不同动作与风险说明；这些展示模块不授予奖励、不修改容量或存档。
- 普通节点的奖励完成门先准备幂等节点消耗，再保存已完成且无待领奖的检查点，成功后释放奖励引用与续流；失败保留已领事实及原页。战斗奖励继续走胜利事务，不提前写普通完成存档。物资格按运行上下文和原奖励记录核对领取、保存与退出，失败仅重试保存。
- `css/secondary-ui-tokens.css` 向明确的二级页面消费者提供共用颜色、间距、字级、按钮和焦点规格，避免同类控件各自维护常量。具体消费者和样式层级见 [二级界面样式规范](modules/secondary-ui-style.md)；页面结构和主题差异不由 token 层覆盖。

## 背包与战斗呈现边界

- `core/card-capacity.js` 提供按类型的叠放上限与顺序收卡预估；背包、安全格转移、奖励整理和出发预览传入完整卡牌，避免装备退化为普通卡的叠放上限。散装物资保留聚合存储，背包渲染按每3件分格。
- `bag-pane-view.js` 统一容器、丢弃确认和背包关闭重开的列表位置快照；同一对局与卡牌数组仍有效、分区相同时恢复双轴滚动和卡牌/工具焦点。快照不写入存档，换局、替换卡牌数组或显式进入其他分区不套用旧位置。
- `game.bag.token-craft.js` 提供通行证合成的纯计划：先解析产物模板、当前材料与碎片，再由背包单一提交入口生成UID、扣料、记录及保存。详情页指定UID和堆叠放大页首张A的来源语义保持独立；失败不改变材料，安全格与容量规则不由配方模块改写。
- `game.bag.rules.js` 将传说池的 `discover` 交由地图消费器结算，通行证C在背包可用；战斗侧仍沿发现候选流程。背包主层不渲染解释段落，帮助入口与实际操作回执保留。 帮助返回保留分区、筛选和排序，并恢复进入前的面板滚动与帮助入口焦点；原对局或卡牌数组失效时不返回旧背包。
- `battle.hand.js` 先按初始攻击、招式、其他、装备、注能主卡排序；同类保留UID槽位。`battle.layers.js` 将诅咒之刃的当前诅咒写入规则阅读区，玩家护甲徽记附着生命条。
- 战斗左侧的牌库、手牌分栏与能量只显示大图标和数字，名称及规则在悬停/聚焦提示中读取；分栏箭头保留可访问名称，首尾禁用且单栏隐藏。能量数字保留辉光，花费/回复时沿原能量反馈触发短脉冲；减少动态偏好下不播放该脉冲。
- `expedition.view.js` 在 `travel` 模式不改侧栏inset或重新取景；移动结束后自动取景从当前镜头直接补间，侧栏inset更新不先横移镜头。终点需要补充展示后续节点时以360ms校正，侧栏锚点按最终缩放计算。地图工具与节点详情仅在活跃对局的idle/moving状态且无覆盖页面时创建；打开覆盖页面即卸载，关闭后确实回到地图才重建，同动作工具承接返回焦点。工具分为左下携行物资与右下地图视野两组，样式由 `map-floating-tools.css` 单独维护，`expedition-tool-art.js` 提供本作原创透明图标；背包显示容量数字与紧凑进度条，紧张/满格时一同变色，动作键与快捷键沿用原入口。地图首脑入口走正常 `prepareDeckSelection`，显式开发自动入口与龙巢保留原行为。
- `chest-reward-overview.js` 展示宝箱状态、金币与领取操作，不再输出“本次已入背包”卡牌汇总块；实际入包、领取记录和存档仍由 `run/chests.js` 的原奖励流程处理。

自身有效效果由 `battle.player-effects.js` 白名单投影到快照，显示作用与持续期/次数；投影不读取待选卡、不修改延迟队列。状态签名包含投影，过期及时移除，既有BUFF/CURSE显示继续独立保留。
