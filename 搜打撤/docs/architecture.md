# 架构与模块接口

本文维护模块职责、依赖方向和接口边界；实现位置见[源码目录说明](../game/src/README.md)。当前占用与交付证据从[状态入口](STATUS.md)查询，接口说明的适用范围由对应源码和契约测试核对。

## 入口与依赖方向

`index.html` 只加载 `src/main.js`。首页展示、全局界面控制器、游戏内核和启动展示都由该入口按 `BOOT_ORDER` 装配；启动集成测试加载同一入口，契约同时检查 HTML 入口与导入顺序。所有源码均为 ESM，模块自身使用显式 `import` 描述依赖。

源码按功能域分目录：`core/` 管规则、随机、输入与绘图底座；`ui/` 管全局界面；`experience/` 管章节风险徽标；`cards/` 管卡库、同步与规则；`run/` 管局内地图与流程；`hub/` 管基地、背包与存档；`home/` 管首页与叙事；`audio/` 管音频；`agent/` 管自动游玩与统计。根层保留装配入口和 `generated/`。

`battle/` 内分为 `core/`（装配、引擎、结算、快照）、`effects/`（效果流水线）、`runtime/`（运行态）、`view/`（渲染）、`bag/`（牌堆与卡费）；装载器与符文入口在战斗域根目录。

分层从底向上为：规则/数据与纯工具 → 状态和领域逻辑 → 功能视图 → 启动接线；高层依赖低层。核心状态模块不得反向导入 `boot`、`run`、`hub`、`notes` 或具体视图。`tests/contracts.test.js` 通过 AST 依赖图拒绝循环依赖，覆盖子目录、重导出与动态字面量 import。

`architecture-graph.mjs` 自动保护 `*.commands.js`、`*-commands.js` 与 `*execution-plan.js`：命令和计划不能新增浏览器门面、全局状态或页面依赖。四个战斗用例和两个局内控制器另受显式端口边界保护。既有 base/collection/extraction/recovery 命令的浏览器适配、局内工厂的五项显示/数据适配保留精确例外，新文件不继承；该检查约束直接依赖与标识符访问，不代表所有传递依赖都已纯化。

`jsconfig.framework-boundaries.json` 严格检查商店/事件命令、卡牌执行计划及其相关辅助实现；`jsconfig.framework-ports.json` 通过真实出牌工厂与正反例检查公开输入和判别回执。后者没有启用整个战斗实现体的严格检查。两项配置由统一 `typecheck` 入口执行，其他覆盖仍以各配置为准。

`agent/agent.js` 装配 `SDT.Agent`，观察和动作执行复用 UI、移动与战斗命令；策略、权重、LLM 适配、记录统计和数据页分模块。`agent.runner.js` 保留同步动作/停止门面，异步驱动、可信回放和已配置的 LLM 请求执行模块首次实际使用时动态加载；观察、策略工厂、记录、数据页及配置读写仍同步。冷自动驱动先持有单一运行归属，停止、局级期限和换局使迟到加载失效，结束恢复原 driver；加载失败可重试。批跑、比较、进化和台账工具位于 `game/tools/agent-*.mjs`，接口与实验方法见[协议](agent-protocol.md)和[迭代手册](agent-iteration-playbook.md)。

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
- `game.session.browser.js`：只由 `game.boot.js` 调用 `createGameCanvas(document)`；canvas、ctx 和日志端口注入 session kernel。kernel 可在无 DOM 的 Node 环境导入，尚保留 MAP/FX 的兼容门面依赖。
- `configureCardNavigation()`：由基地模块注入卡牌页面关闭与刷新行为。
- `RenderScheduler`：活动状态目标 120 FPS；静态地图仅在状态失效或活动切换时绘制，主循环保留约 4 Hz 状态巡检；全屏遮罩暂停地图绘制。目标值不等于当前设备上的实测交付帧率。

## 功能分工

- `game.store.js`：创建可变会话状态，并通过 `getSnapshot()` 暴露不可变快照。
- `game.storage.js`：五槽对局存档键、读写和 v1 迁移。
- `game.session.js`：会话派生数据与对局生命周期，拆为 `game.session.kernel/modes/bag/map/board/death.js` 六片；`game.menu.js` 保留同步标题/退出与轻量菜单入口，非首屏选档、指南、成就、设置、反馈和离开面板由 `game.menu.pages.js` 首次请求时加载；页工厂注入会话能力和标题回调，不反向导入会话模块。冷入口提供可见载入层、取消/重试与最后请求优先，已载入的页工厂复用并保持热入口同步。
- `game.cardslib.js`：卡牌库轻门面；首次进入照相馆或制作坊时动态加载 `game.cardslib.page.js`。页面及其制作坊、照片道具、性能探针、图片预热和共享模块保持在门面之后，避免静态依赖回到首屏；制作坊写开关保持关闭。`ui/ui.js` 组合 `overlay.js`、`cinematics.js`、`hud.js`。
- `game.hub.preparation.js`：基地整备控制器，通过数据、视图、导航和错误处理端口装配 `preparation.commands.js` / `preparation.view.js`；不读取 `SDT`、`UI`、`document` 或 `window`。页面 dispose 会阻止过期异步返回继续更新 UI。
- `game.run.data.js`：场景、事件与职业叙事授权数据；`game.run.shop.js` 装配商店页面与交易命令；`game.run.js` 保留移动、格子、事件、祭坛与撤离公共入口。
- `run/shop-commands.js` 接收当前状态、容量、UID、价格与保存端口，承接购买、补充初始攻击、出售及委托优惠的状态更新；命令提交前复检资源与对象身份，页面控制器保留浏览、生命周期和反馈。保存失败保留完整内存成交，由原页面提示重试。
- `run/event-commands.js` 承接事件支付、奖励准入、整批重编及结算预留；`game.run.events.js` 持有单个事件控制器的确定性抽取、页面身份、中间选择和奖励承接，`game.run.resources.js` 持有资源领取。`game.run.flow.js` 保留移动和落脚编排，首次进入普通事件时动态加载 `event-runtime.js` 装配会话、剧情与呈现服务；纯事件控制器继续通过端口接收依赖。`event-lifecycle.js` 常驻同步布尔恢复、同一选牌控制器与未保存奖励、保存重试及结算重入边界。冷进入有独立取消、10 秒加载期限、重试和页面/对局归属；迟到加载只缓存，不覆盖新页面。最后一盏灯的剧情与记录等待沿用本次归属，已成功写入 Base 的事实不因离页撤销。原公共入口和恢复导出保持不变。
- `shop-browse-state.js` 只捕获商店背包往返的DOM浏览位置、详情规则展开与焦点动作标识；控制器在同会话和新页面身份仍有效时恢复，不写入对局状态或存档。
- `core/run-checkpoint.js` 统一局内同步保存的失败结果，保留旧端口无返回值兼容；它不回滚已经完成的内存结算。商店购买与出售核对原商品/报价、owned/UID及当前会话并阻止重入；保存失败保留本局完整成交并提示重试，离店失败留页。委托优惠应用失败回退尚未提交的价格草稿，保留已掷定格位。
- `battle/view/battle.scenery.js` 按本场 token 固定场景配置。当前普通战与首脑战统一使用 `platform-minimal-1016` 的远景、透明站台地面与透明前景；`game.run.data.js` 预载同一组三图。分层模式按完整画幅叠放，人物站位与战斗动作仍由原视图和动画层持有；本轮接入及待统一验收范围见[场景记录](evidence/2026-10-16-WF-battle-platform-minimal/README.md)。
- `game.hub.js` 是基地轻门面，选档后首次进入才动态加载 `game.hub.runtime.js`；后者装配出征整备、页签与中立桥；`game.bag.js` 装配拖拽、战后结算与背包中立桥。基地与照相馆的待开页请求通过 `ui/page-entry-cancellation.js` 互斥，返回标题、选档或更新导航会取消旧请求；加载失败可重试，档案状态不复制。基地样式仍静态加载。对应切片以 `game.hub.*.js`、`game.bag.*.js` 命名；切片通过桥互调，contracts 检查循环依赖。
- `run/game.run.altar.js` 保留祭坛、火堆、撤离恢复的同步入口，并把 `openClassChoice()` 转交给选角轻门面 `run/game.run.class-choice.js`；人物与卡池页面 `game.run.class-choice.page.js` 及人物翻页动效仅在实际请求选角时动态装载，无标题/基地 idle 预取。入口 Promise 在页面就绪后完成；出征切幕等待该结果。`loadGame()` 同步返回恢复分支与持久化明细，异步 Base 写入由 `pendingPersistence` 确认；未选角存档另附 `classChoiceEntry` 供选档 await，Promise 不写入游戏或存档状态。选角下载与其他待开页互斥；取消、换档/换局和来源宿主变化废弃旧结果，失败保留 pending run 与可重试入口。
- 家具房间已退役：`renderHomeScene` 仅保留无操作兼容导出，基地不创建旧房间控制器。皮肤、仓库和整备共用 `hub/command-errors.js`，不经旧 Home presenter 加载家具命令或目录；旧 `home` 存档与请求收据保留。稳定卡牌数据打为 `game-card-catalog` 缓存分块，仍是同步启动依赖，计入首屏脚本预算。预算值由 `scripts/perf-budget.cjs` 维护，实际产物大小与构建状态见对应任务证据。
- `cards.js`（壳）+ `cards.data.js` / `cards.rules.js` / `cards.sync.js` / `cards.consts.js`：卡池数据、推导与经济规则、迁移播种、共享常量；`window.SDT.Cards` 键面与数据字节不变。
- `structured-card-description.js` 从完整的自指向 `onPlay` 声明读取包扎、坚守两种已审阅句式的治疗、护甲和抽牌数值；`displayCardDescription` 接受兼容的可选整卡参数，卡面与照相馆引用渲染器消费该结果。未知字段、不完整或复杂声明以及自定义文案保留原描述；卡牌数据和效果执行不由展示层改写。
- `cards.sync.js` 的 TT10/TT11 历史批次重播优先使用 `cards-sync.json` 同 id 定版字段，并服从其退役清单；定版未提供的仓库元数据仍保留。迁移标记存在时不覆盖玩家后续编辑。
- `game/data/cards-sync.json` 是生成数据，使用 `scripts/sync-cards-from-live.mjs` 更新，不手改；改卡牌描述时递增版本，退役卡进入退役名单并递增版本。新增卡必须进入同步数据，保证历史批次重播可解析。
- TT10/TT11 内联历史快照须与同步数据保持一致，由 `tests/cards-sync-snapshot-guard.test.js` 守卫；卡牌效果审计例外与回归入口见 `docs/quality-gates.md`。
- `cards.catalog.js`：按稳定 id 解析 TT10/TT11 的定版引用，定版字段优先，历史独有元数据随后补齐；缺失 id、重复 id、继续内联定版条目均明确失败。其他批次保持原数据入口。
- `cards/card-rarity.js`：英雄线与衍生牌稀有度的纯规则实现，由调用方注入按 ID 查找。Cards 门面继续用 `Array.find` 保持原数组首项优先；`card-render-context.js` 在照相馆一次浅目录快照中构造 first-ID 索引，筛选、排序和各延迟挂载批次共用该快照，页面数据刷新后重建，关闭时释放索引。
下文战斗模块文件名相对上方五个子目录；具体路径按[源码目录说明](../game/src/README.md)定位。

- `battle.core.js`：浏览器战斗装配与命令门面；默认状态在 `battle.runtime.js`，独立状态由 `battle.runtime.factory.js` 创建。引擎及敌方阶段共用对应领域工厂；纯引擎不访问 DOM 或依赖战斗视图，BOSS 编组和消耗牌堆页面由快照驱动。 选牌专用的五项输入仅在选牌阶段参与快照捕获；其他阶段不遍历选牌池，实时选择仍留在运行态用于开战效果和重开恢复。
- `battle.effects.js` + `effect-steps.js`（有序步骤表本体，拆片 `effect-steps.<节>.js` 按原序 concat——顺序即语义）：文本时点解析与效果执行器；执行器只通过显式端口改变战斗状态，不访问 DOM。
- `cards/card-trigger-contract.js` 维护时点词表和声明所有权；纯 `cards/card-execution-plan.js` 统一时点、装备与打出效果的来源计划、注册快照、基础字段所有权及隔离执行视图。`battle.trigger-source.js`、触发 runner、装备及 resolver 共同消费该计划；显式空数组仍拥有对应时点，其他尚未迁移的时点保留文本兼容。获取、抽到、消耗由当事卡直调，其余七个触发时点由 runner 登记；打出效果在 resolver 执行。capability 入口恢复执行卡保留的完整声明后预检；schema 保留原执行视图导出。复杂文本效果体仍由原解释器执行。
- `battle.triggers.m2.js` 按本次事件的登记快照同步派发，执行前预留持续次数，阻止同一登记同一时点的递归重入；战斗身份变化、取消和结束使旧派发失效。回合开始的延迟任务固定当前批次，新产生的任务留给后续回合；恢复仍重演入场检查点，不新增中途触发器存档。
- `battle.deck.js` / `battle.rules.js`：可独立测试的洗牌、回收、目标判定和出牌限制。
- `battle.card-cost.js` / `battle.intent.js`：显式接收卡牌与战斗状态值的费用、敌方意图纯计算；`battle.engine.js` 保留原接口并收集状态，纯计算模块不读取 `window.SDT` 或 DOM。
- `battle.card-inspection.js`：卡实例查找、费用上下文、手牌诅咒与费用交换，通过 cards、curseMeta、readState 三个端口访问引擎；保留原 engine 导出，不创建第二份运行态。有效卡面查询在单次调用内复用已查得的归属实例；不跨调用缓存，可立即反映替身、归属列表与转换规则变化。消耗区法术计数仅在费用规则实际进入该折扣时读取，保持原有费用优先级。`hosted-catalog-index.js` 按原来源顺序建立一次索引，保持重复 ID 首项优先。
- `battle.runtime.factory.js` 创建每场实例自己的状态与更新方法；浏览器默认实例在 `battle.runtime.default.js` 创建，原五个运行态子模块（session/piles/interaction/effects/presentation）继续提供它的 ESM 活绑定。实例通过同一工厂运行，不复制或交换全局状态。
- `battle.engine.factory.js` 通过 `battle.engine.instance.js` 创建完整引擎。运行态、Combat 钩子、随机流、战斗统计、动作队列、取消代次和表现等待均归各实例所有；卡库、规则及音效等服务由参数注入。该入口及领域实现可在无 `window`/`document` 的 Node 环境执行真实开战、出牌、敌方回合与结束。`battle.engine.js` 保留浏览器兼容接口，只在默认装配边界绑定 `battle.default-context.js`；活动战斗或队列未排空时拒绝重配。
- `*.domain.js` 是选择、装备、背包、生命周期、出牌与效果的共同实现，旧文件名只作显式端口工厂或默认适配。`battle.execution-session.js` 管理实例取消与代次，`battle.action-runner.js` 管理串行动作；`battle.playback.js` 保持纯逐拍流程，浏览器反馈、帧提交和时间等待由 `battle.browser-presentation.js` 注入。带时长的动作先等待渲染帧提交，再读反馈队列与命中时钟；无时长的同步流程立即完成。旧回调同时核对战斗 token 与执行代次。
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
- `battle.stage-view.js` 按场次持有舞台与 HUD 组件：暖更新不解析整舞台、不用 live DOM 的 `outerHTML` 判等，只在富组件输入变化时解析该片段；受控文本、ARIA 与挂载引用每次按现存 DOM 校验、原位修复。动画类、展开状态、焦点、药水提示与入场警告仍由各自呈现层持有。分页组件仅通过 feedback 当前场次的精确节点身份查询保留入手徽标和 ARIA 后缀，匹配类名的外来节点不享有此边界；反馈模块仍负责更新与移除。
- `battle.view.js` 的同步事务区分呈现快照与实时交互快照；仅本次安全同步输入复用，宿主弹层边界重新读取。旧 token 在发放新渲染代次前拒绝；新代次或新 token 使旧宿主回调停止写入，单位/手牌挂载也核验 owner 身份。输入事件和异步 readiness 保留现场读取及场次守卫，不写游戏状态或存档。
- `battle.hand-hit.js` 的按牌记录随场次、回合、阶段、结算或选择/查看模式及可见 UID 列表变化失效，避免结算期间被拒绝的拿牌在恢复后由迟到 click 重新选牌。背景战场渲染按真实快照同步交互模式；单纯能量变化不取消阅读。出牌仍走原 view/aim 与核心命令。
- `battle-secondary-overlay.css` 以现有直系保留弹层维持战场全视口和 block/relative/clip 卡体，避免普通抉择壳改变保留战场的布局；`ui/overlay.js` 仅在内部 battleBody 有效性校验通过后维持 page-covered。普通 room-view、pick-veil 和非保留面板语义不变。
- `battle.layers.js` 在当前手牌差分前捕获卡面/规则区焦点及阅读滚动位置，更新后按原牌组、存活近邻交接；空栏回退分栏钮或选项，不自动聚焦结束回合。正常舞台差分不重复摘挂已连接的同一手牌层，跨场次或选择面板不继承这份局部焦点。
- `battle/view/battle.discover-view.js` 为战斗发现的纯呈现切片，接收候选及卡面渲染器，专属样式只作用于发现决策；候选生成和选择效果继续由发现流程持有。`battle.aim.js` 的鼠标拎牌、停靠、目标选择和归位共用一条动画时钟，Enter确认复用当前鼠标目标会话；提交前解除active aim，再按核心回执管理待提交姿态。手牌层在采样出牌位置后用原始play事件释放姿态，同帧打出又回手时仍释放；本地源码依据与网页适配见[参考记录](evidence/2026-10-16-WF-battle-return-1016/drag-reference.md)。
- `battle/view/battle.discover-input.js` 维护发现页的UI输入门：同轮语义快照复用展开期限，每次页面绑定分配标识，提交前核验最新快照并锁定本轮；不抽牌、不改选择效果或存档。页面标识通过候选data属性传入普通UI动作委托。
- `ui/term-tips.js` 保留同步别名、全局输入委托和 `ui-scale.js` 注册，保障冷卡面特写的坐标换算前置条件；首次有效交互按需加载 `term-tips.runtime.js` 的文案和 body 公共解释单例；冷态保留当前有效锚点，松手、移出、离页或取消后不迟到显示，热态仍同步定位和收起。`data-term`用于既有词条，点击与键盘激活在同步捕获层阻止误触父卡牌；`data-ui-tip`与title/text/note属性提供动态控件说明，动态说明不拦截控件点击。战斗职业技能和能量沿此入口；已禁用技能通过外层锚点接受说明聚焦，发动条件仍在原按钮。
- `renderer.js`：Canvas 地图编排与视觉特效；`renderer.primitives.js` 提供纯绘图工具；`render-scheduler.js` 决定何时绘制。
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

自动检查入口见[质量门](quality-gates.md)；模块改进的过程与验收从[历史索引](archive/README.md)按任务查阅。
`scripts/architecture-graph.mjs` 由契约测试和 `tests/architecture-boundaries.test.js` 共用。检查包含缺失 JS 模块、不透明动态 import、运行时导入范围与独立领域模块的浏览器全局访问；判据采用真实域路径的精确集合，并以 `deadGuardKeys` 检查失效键。`hub/game.cardslib.page.js` 只有一个允许的入边：轻门面 `hub/game.cardslib.js` 的字面量动态 import；静态导入、重导出或其他模块的动态导入都会失败，防止照相馆页面被重新打入首屏。`RUNTIME_SURFACE` 覆盖兼容入口及五个运行态子模块；`RUNTIME_OWNERS` 包含 core、engine 兼容壳与工厂、enemy-phase、selection-flow、equipment、bag、lifecycle、exec-play，运行态模块也可互相导入。战斗视图通过 core 的快照和命令访问领域，不能直接读取运行态。这是源码依赖约束，不代表已消除兼容门面上的全部可变状态。
普通测试中的游戏全书校验只在内存生成内容；`npm run docs:compendium` 才会写入 `docs/game-compendium.md`，避免回归测试覆盖工作区文档。


## 二级界面与选择流程公共边界

- `ui/map-passage.js` 是直接移动与正反向闸门的共用跨层展示入口。正常返回带 `done/dispose/current` 的展示句柄，同层、减少动态或turbo返回空值；业务位置、存档和相机仍由调用方同步提交。移动沿用原moving锁，待同一层级幕结束后结算目标节点；表现取消不回滚业务，旧幕仅清理自身，3秒兜底释放输入。
- `ui/transition-preparation.js` 将装饰时长与独立资源准备并行，明确成功、失败与取消结果。普通/首脑入战仍保留650ms切幕和战斗自身真实首帧资源门，模块未完成时原幕不提前关闭；失败交原加载错误流程处理。撤退与出发只在既有切幕期间预热地图，不提前结算或缩短原时长。
- `ui/page-surface-lifetime.js` 统一展示目标的连接、归属、关闭和页面代次检查；加载等待、普通页揭幕与装饰切幕使用同一失效清理边界。旧目标失效后不执行旧揭幕，清理仅释放自身展示；装饰图片失败/超时继续降级，业务入口仲裁仍由 `page-entry-cancellation.js` 负责。
- `ui/page-visual-readiness-sharing.js` 只复用同一宿主、页面实例、UI所有者、页面代次与附加区域上的进行中图片扫描、测量和解码；各调用独立等待背景、字体、取消、超时及呈现帧，最后一个订阅释放后不保留结果。基地初次揭幕遇到同页异步重建会解除旧订阅并等待新页面，切幕图独立准备，完整980ms播放时长不变。
- `ui/interface-motion.js` 安装后独占页面转场，旧 `transitions-director` 不再安装闸门观察器或启动闸门；独立旧宿主仍保留原入口。`page-motion-profiles.js` 为基地声明内容动效归属，控制器通过 `data-ui-shell="content"` 保持基地外壳静止，通用入场样式不再覆盖基地页内动画。首页冷入口取消后恢复首页导航，加载中的重复操作继续拒绝。
- `ui/overlay-return-state.js` 统一临时帮助页的滚动与焦点快照、页面代次校验和一次性返回。`overlay.showHelp` 默认接入背包、商店购买、商店出售与撤离帮助；消费者继续负责对局/档位/结算身份校验及同步重建。快照只保存数值和稳定元素描述，不保存旧 DOM 或游戏状态；异步重建不在此返回协议内。
- 战斗快照的 `consumedPile` 是普通和首脑战唯一消耗牌堆：由旧账本去重，排除手牌、牌库及正在结算的源牌。查看、复原、费用和增伤读同一集合；复原移动原UID并清理旧堆重影，牌库空后不自动洗回。`played`、`consumed`、`discard`、`grave` 保留内部兼容与战后结算用途，未取回卡不互换已打出和被消耗类别。普通99库临时牌可取回再用，战后仍不进入永久消耗区。发现队列的 `act: noInfuse` 沿现有队列与状态传递，仅选中候选生成的实例获得免注能标记，候选模板不改；灵能召唤的文本与结构化规则共用此流程。存档仍恢复战斗起点，不保存待选发现面板。
- 「挖宝」从真实牌库底最多三张中选择一张，其余按原顺序放回；旧规则n=1的该牌也沿此候选口径。选中原UID入手并按选中牌价格获得护甲，空库不补随机候选。设置中的「重新开始本场战斗」复用开战检查点，保留首脑编组并取消旧动作队列；旧页面及跨场点击拒绝，不另走战后结算或重开整局。
- `battle/view/battle.selection-ui.js` 统一选择状态投影、取消分派和目标提示条。点击选牌、卡牌二次选靶、道具、职业技能共用提示与取消入口；注能保留材料布局并复用取消分派。命令层仍负责合法性、资源与提交，提交不调用取消；来源焦点只在明确取消且上下文有效时恢复。
- `ui/card-browser-state.js` 共享单次操作内的列表采集、筛选和选中差分更新，收藏、人物招式池、仓库复用；分页模块接受仍属于当前轨道的节点列表，失效或替换节点重新读取。它不跨操作缓存卡牌数据，重复筛选/选中不重复写相同 DOM 属性。 收藏计数在筛选生效时分开显示匹配数与总收藏数，重置后恢复总收藏数；计数复用本次筛选结果，不另行过滤。
- `ui/reward-state.js` 只读已领取/已放弃记录，派生待领集合、回执与摘要；`reward-scene-view.js` 统一卡下及放大详情的领取按钮、整理与选卡返回按钮。三选一、普通收下、腾位领取保留不同动作与风险说明；这些展示模块不授予奖励、不修改容量或存档。
- 普通节点的奖励完成门先准备幂等节点消耗，再保存已完成且无待领奖的检查点，成功后释放奖励引用与续流；失败保留已领事实及原页。战斗奖励继续走胜利事务，不提前写普通完成存档。物资格按运行上下文和原奖励记录核对领取、保存与退出，失败仅重试保存。
- `css/secondary-ui-tokens.css` 向明确的二级页面消费者提供共用颜色、间距、字级、按钮和焦点规格，避免同类控件各自维护常量。具体消费者和样式层级见 [二级界面样式规范](modules/secondary-ui-style.md)；页面结构和主题差异不由 token 层覆盖。

## 背包与战斗呈现边界

- `core/card-capacity.js` 提供按类型的叠放上限与顺序收卡预估；背包、安全格转移、奖励整理和出发预览传入完整卡牌，避免装备退化为普通卡的叠放上限。散装物资保留聚合存储，背包渲染按每3件分格。
- `core/bag-render-derivation.js` 在每次背包同步渲染中单次遍历持有卡牌，派生两区分堆、容量、计数、UID与排序索引；页面和复原用途提示共享该次结果。分堆与实时查询共用规则，资源扩容仍取容器声明；快照不保存到对局或动作闭包，使用、转移、丢弃和容器存取继续核对即时状态。
- `bag-pane-view.js` 统一容器、丢弃确认和背包关闭重开的列表位置快照；同一对局与卡牌数组仍有效、分区相同时恢复双轴滚动和卡牌/工具焦点。快照不写入存档，换局、替换卡牌数组或显式进入其他分区不套用旧位置。
- `game.bag.token-craft.js` 提供通行证合成的纯计划：先解析产物模板、当前材料与碎片，再由背包单一提交入口生成UID、扣料、记录及保存。详情页指定UID和堆叠放大页首张A的来源语义保持独立；失败不改变材料，安全格与容量规则不由配方模块改写。
- `game.bag.rules.js` 将传说池的 `discover` 交由地图消费器结算，通行证C在背包可用；战斗侧仍沿发现候选流程。背包主层不渲染解释段落，帮助入口与实际操作回执保留。 帮助返回保留分区、筛选和排序，并恢复进入前的面板滚动与帮助入口焦点；原对局或卡牌数组失效时不返回旧背包。
- `battle.hand.js` 先按初始攻击、招式、其他、装备、注能主卡排序；同类保留UID槽位。`battle.layers.js` 将诅咒之刃的当前诅咒写入规则阅读区，玩家护甲徽记附着生命条。
- `expedition.view.js` 在 `travel` 模式不改侧栏inset或重新取景；移动结束后侧栏变化以镜头补间衔接。地图首脑入口走正常 `prepareDeckSelection`，显式开发自动入口与龙巢保留原行为。

自身有效效果由 `battle.player-effects.js` 白名单投影到快照，显示作用与持续期/次数；投影不读取待选卡、不修改延迟队列。状态签名包含投影，过期及时移除，既有BUFF/CURSE显示继续独立保留。
