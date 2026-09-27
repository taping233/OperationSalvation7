# E1 架构与类型契约证据

## 1. 接管基线、归属与范围

- 接管核对：2026-09-27 10:27–10:29，Asia/Shanghai；源码核验及整合时间见第 7 节。HEAD `dd5ac7f`；`git rev-list --left-right --count HEAD...origin/master` 为 `2 0`，即 ahead 2 / behind 0；未 fetch，不代表服务器实时状态。
- 已完整读取 Friday 的 `docs/ENGINEERING-E1-ARCHITECTURE-CONTRACT-PLAN-2026-09-27.md`，从 `README.md` 导航。本文件沿用给定模块化单体、JSDoc/checkJs 及复用路线，不另定架构或首个实现切片。
- `git status --short` 显示 UI、Agent、战斗、文档、类型配置等大量在途修改及既有删除/归档；保留原归属。应用聊天清单仅用于核对并行上下文，idle 不视为释放。接管时本文件不存在；执行单仅授权本主指挥写此路径，三名子代理明确只读，无竞争写入者进入本团队。
- 分工：GPT-6-luna A 核状态/流程/恢复；GPT-6-luna B 核内容/类型；GPT-6-sol medium 独立抽查并审查实际整合文档。唯一写入者为本主指挥；没有新建额外用户侧聊天。
- 本批只沿新增卡牌机制、战后结算、旧档升级恢复三个场景核源码及既有测试源码。不运行测试、类型检查、构建、游戏；不改代码/配置/测试/数据/存档，不安装、删除、回滚、提交、推送或发布。
- 路径规则：`game/`、`docs/`、`tests/`、`scripts/` 及 jsconfig 路径相对 `搜打撤/`；省略 `game/src/` 的 `agent/`、`battle/`、`cards/`、`core/`、`hub/`、`run/`、`ui/` 和 `game.boot.js` 均相对 `搜打撤/game/src/`；裸文件名或简称承接该段已指明文件。`路径:行号` 指当前工作区源码，不是只看 HEAD。状态只用“已有且有证据 / 部分具备 / 明确缺口 / 待核实”；它们评价相应具体能力，不等同整库验收。
- 历史第二批 `docs/ENGINEERING-BATCH-02-2026-09-27.md:43,52` 记录类型检查及 158 文件/920 项通过，仅作历史证据。本批没有重验该结果；构建、真实产物预算、浏览器及长局仍未验证。

## 2. 五职责区、状态权威与调用方向

| 职责区 / 状态 | 当前模块与真实连接 | 权威状态、方向及例外 |
| --- | --- | --- |
| 界面与输入：部分具备 | `game/src/battle/battle.view.js:16,24,156,574` 从 core 取命令、读取快照、注册 renderer；`agent/agent.runner.js:51,68,79,83` 分别走 UI 回调表、moveTo、Battle.commands；`game.boot.js:23` 注入流程钩子 | 战斗玩家与 Agent 共用 commands；Agent UI 路径实际依赖 DOM 元素与 UI._acts/_baseActs。`agent/agent.state.js:11,256,308` 仍直接读 `game` 并读取战斗快照。不是所有界面均只依赖深只读模型；`viewApi/findCard` 也保留可变数据读口。 |
| 应用流程：部分具备 | `run/game.session.js:88,191,209` 保存、预检、载入；`battle/battle.lifecycle.js:61,126,185` 恢复/结束/开战；`hub/game.bag.settle.js:25,259` 战后续流；`run/game.run.altar.js:774,896,907,925,933` 撤离 UI 命令；`ui/game.menu.js:821` 放弃流程 | `game.boot.js:23` → `configureGameRuntime`（`run/game.session.kernel.js:19,29`），并非 session 反导入所有页面。执行会话管理队列/取消；但 session 内核仍读 `window.SDT`、UI、DOM（kernel:10,56,61），职责边界尚非纯端口。 |
| 游戏规则与状态：部分具备 | `hub/game.store.js:44` 构造状态；`run/game.session.kernel.js:38–40` 唯一实例及 `game=store.state`；`battle/battle.runtime.js:1–8` 重导出五类运行态；`battle/battle.runtime.session.js:5–19,21–38` 战斗状态及写入口；`hub/base.js:97,226,245,666` 档位基地状态与存取 | 局内资源/位置/背包属同一 `game` 对象；战斗 `G` 指向该对象（runtime.session:60–61），不能另造第二份局内权威；回合/能量/牌堆/交互/临时效果由 battle runtime 子模块持有，engine/lifecycle 等经 setter 或原数组操作写入。基地内存由 Base 持有，`Base.data` getter（base:672）仍暴露可变引用；永久提交由 Base.save 或领域事务写入。单对象不等于唯一封装写入口。 |
| 内容数据：部分具备 | `cards/cards.js:49–53,83–99` 装配 data/rules/sync/schema 并校验；`cards/cards.data.js:483` 包扎结构化 heal/armor；`cards/card-rules.schema.js:588` 校验入口；`battle/battle.resolution.js:460` 解释；`battle/battle.engine.js:719` 接端口 | 卡定义/定版来源、规则解释和展示分工已有；仍保留结构化与文本兼容路径。schema 放行不等于解释器已实现（resolution:85–102 的 pending 拒绝）。不能把所有卡宣称已脱离描述文字。定版来源的精确补证见 4.1。 |
| 存储与基础服务：部分具备 | `hub/game.storage.js:44` RunStorage；`hub/recovery.commands.js:19,55` 注入 storage/locks/领域校验后建 pair；`hub/recoverable-pair.js:51` 通用日志引擎；`core/random.js:28,48,50,62` 随机服务和替换端口 | pair 只承担持久化恢复协议，生产 adapter 再校验收据及前后身份。RunStorage/Base 仍直接依赖 localStorage，不能称全域存储已注入。随机流已有快照恢复；地图持久拓扑与运行时派生缓存分离。 |

跨区装配证据：`game/src/main.js:9–45` 按顺序导入底座、卡库、存储、会话、功能及 boot；`core/sdt-facade.js:10–20` 初始化并登记兼容命名空间。允许方向以执行单为目标约束；上表“例外”是现实偏差，不是新增授权。

异步互斥的实际覆盖：`battle.execution-session.js:12–19` reset 先增 generation 再清队列；`battle.action-runner.js:14–24,34–46` 捕获及复验 token/generation；`battle.staged-playback.js:23–26,93–99` 守卫播放。它们证明已接入动作的旧结果隔离，不证明所有异步入口都受保护。

## 3. 五类类型契约与实际约束

`jsconfig.json:3–23` 为 `checkJs:true`、`strict:false`、`skipLibCheck:true`、`noEmit:true`；9 个显式根是 map-graph、mech-sentences、encounter-selector、cards.consts、map-snapshot、game.store、commands.shared、recoverable-pair 和 game-store-types.fixture.ts。导入依赖也可能进入检查程序，因此不能把 include 等同全部文件清单；也不能用 9 个根冒称全仓静态保障。

| 契约 / 状态 | 定义、真实调用与检查边界 | 运行时责任及现有证据 |
| --- | --- | --- |
| 卡牌规则：部分具备 | `hub/game.store.types.d.ts:31–41` CardRules/operation 以字符串和开放字段描述，不是 schema 的完整判别联合；通过 `game.store.js:4–6,8,51` 约束初始状态及快照。schema、卡库、battle resolution 不因此自动获得全调用约束 | `cards.js:83–95,130,139–142` 在读/写卡库处调用 validateCardRules；`card-rules.schema.js:588–710` 校验版本、字段、trigger/op/target 组合；解释器还校验未接线操作。`tests/card-rules-schema.test.js:6–40` 有正反例；非本批运行结果。 |
| 战斗状态：明确缺口（静态契约） | runtime session/piles/interaction/effects/presentation 有状态属地，engine→snapshot→view 有真实边界，但未见这些接口对应的实际强类型检查接线；`jsconfig.json:13–23` 的根及本次静态 import 核验不能证明 BattleSession 调用已受类型约束 | `battle.snapshot.js:26–85` 负责投影；`tests/battle-snapshot.test.js:5` 检查若干嵌套状态/集合。行为用例不替代战斗状态静态契约，也不证明所有嵌套数据隔离。 |
| 命令参数/结果：部分具备 | `commands.shared.js:13–20` 定义 fail、泛型 TransactionReceiptValue/successReceipt；`recoverable-pair.js:1–10,51` 定义 StoragePort/Journal/Failpoint/Result 并用于真实函数。二者是检查根；实际领域调用见 recovery.commands:55,153。领域命令与 Battle 的调用层尚未由这两份声明完整约束 | pair 的 receipt 仅 `Record<string,unknown>`，不是已验证业务成功收据；生产 recovery.commands:22–55 再验。`tests/recoverable-pair-types.test.js:85–125` 有合法端口/结果收窄和错误端口、日志字段、slot、结果假设负例；`tests/recoverable-pair-contract.test.js:16` 拒数组日志。Agent runner:83–87 的 ok:true 表示已分派，即使命令返回 false；不能解释成业务提交成功。 |
| 存档数据：部分具备 | `recoverable-pair.js:2–4` 约束原始串对和日志封套；`run/map-snapshot.js:54,134,145` 有 JSDoc，但主要输入仍为 any。`game.store.types.d.ts:92–152` 是运行状态/观察快照，不是 RunStorage 序列化模型。RunStorage/整个 load 调用不因它而全部类型化 | `game.storage.js:51–76` 解析/版本迁移，`game.session.js:191–207,225–276` 业务预检和字段归一；地图由 `map-snapshot.js:58–139` 严格校验。顶层可扩展 run 与严格地图 schema 不同。`tests/save-compat.test.js:20–90`、`r5a-map-snapshot.test.js:9–53` 是相应既有用例源码。 |
| 只读快照：部分具备 | GameSnapshot/DeepReadonly 在 `game.store.types.d.ts:130–152`，通过 game.store.js:51 的返回类型及 fixture 真实接入检查。`tests/game-store-types.fixture.ts:6–34` 和 `tests/game-store-types.test.js:50–95` 覆盖构造/赋值/只读负例。BattleSnapshot 尚未形成同等静态约束 | `game.store.js:54–90` 深拷贝冻结卡、口袋、货架纯数据；map/hover/moveTarget 保留引用，rings 行浅拷贝，声明 :135–137 说明此边界，测试 :38–40 刻意保留引用。Battle 卡牌浅拷贝仍共享 rules 嵌套，见第 6 节；不声称全对象只读安全。 |

真实消费者与检查范围必须分开：kernel:38 的 `new GameStore(MAP)`、recovery.commands:55 的 pair 装配、Battle UI/Agent 调用均存在，但“被调用的库有类型”不等于“这些未纳入检查的调用方已被检查”。静态 import 补核：commands.shared 与 recoverable-pair 都无 import，不会由这两个检查根带入 RunStorage/Base；game.store:2,4–6 引入 sdt-facade 和自身声明，不会由该路径反向检查 kernel 的调用。现有类型测试用 TypeScript API 构造专门诊断用例（game-store-types.test:9–26、recoverable-pair-types.test:10–25），不能替代整个产品调用图。

类型正负例的具体范围：game-store-types.test:50–69 允许 live state 修改、snapshot.map 浅引用修改；:72–95 拒绝 snapshot 卡 rules/meta 写入、卡费用错类型、错误 live card 形状、只读货架 push 和 inventory.count 改写。commands-shared-contract.test:51–103 验共享结果形状；map/存档运行时正反例不等于存档 payload 静态正反例。本次未找到完整 run payload 的对应声明/静态 fixture，结论止于“部分具备”，不声称外部输入已全静态检查。当前没有提出新增 any、忽略诊断或扩大 include 的实施。

## 4. 三种场景的源码链路

### 4.1 新增卡牌机制的参照链：包扎的 heal → armor

结论：部分具备。这是对已经存在机制的追踪，不是新增卡牌需求或实现决定。

1. 定义：`cards/cards.data.js:483` 的包扎含结构化 onPlay heal、armor；`cards/cards.js:49–53,97–99` 装配数据/同步/schema。定版来源为 `core/data-loader.js:21,37` 导入并深冻结的 `game/data/cards-sync.json`；`cards.catalog.js:3–13,15–39` 建唯一 ID 表并解析引用，拒绝缺 ID/重复/不存在的 ref，canonical 字段优先于 metadata。`cards.data.js:447,659` 的 TABLETOP10/11 实际调用该解析器，其余历史内联条目仍允许。`cards.sync.js:10–15,75,99,353,487,498–504` 从相同数据派生同步/退役表、迁移校验和版本标记。生成脚本定位为 `scripts/sync-cards-from-live.mjs:13–14,91–103`；本批未运行或改写它及 JSON。
2. 入库形状/引用：cards.js:83–95 的读取和 :130,139–142 的存写路径调用 `validateCardRules`；schema:588–710 检查版本和 trigger/op 组合；:123 起校验 amountField 等卡字段引用，:684–710 核 operation.target 与 rules.battle.target 一致，:717 起校验 base/bag/equip。Catalog 的稳定 ID 校验与这些规则内字段校验不同；本次所检 schema/代表链未发现通用任意 cardId/ruleId 引用解析器，不外推全仓绝无此能力。
3. 真实行为入口：玩家 `battle.view.js:24` → `commands.playCard`（core:365）；Agent runner:83 同入口 → `battle.engine.js:1025–1076` play 的手牌/费用/目标校验 → :1187–1188 queueCardExecution 转接 → `battle.exec-play.js:21,45–46` 排队及 :52,122 execPlay → engine:818–819 resolveCardWithFeedback，将 :719 装配的 resolveCard.steps 交给 runStagedSteps。`battle.resolution.js:460,844,884` 处理结构化步骤；新增机制是否可复用现有端口取决于操作语义，不能只把新 op 加入 schema 即称支持。
4. 真实写入口：engine:724 的 heal 端口调用 `G.heal`，其实现 `run/game.session.death.js:22` 写 game.hp；engine:779–781 的 addArmor 写 `pdef.armor`。局内生命属于 game，战斗护甲属于 runtime 的 pdef；规则解释器使用命名端口，不再造权威状态。`battle.engine.js:731` 注入命名 battle 随机流。
5. 展示：engine:502,537–541 捕获状态并构建/缓存 `createBattleSnapshot` → `battle.snapshot.js:35–43,66–69` 玩家/防御投影 → `battle.view.js:156` render。snapshot 不拥有规则状态；其卡牌嵌套引用限制不能被“快照”一词掩盖。
6. 保存/恢复边界：单张牌不是独立永久提交。`game.session.js:88–135` 在稳定状态保存；moving/terminal/pendingExtraction 等被挡。战斗 `battle.core.js:217` serialize 保存入场重开检查点，`battle.lifecycle.js:61–123` restore 重建战斗，不承诺恢复半张牌/动画中间态。新机制若带持久状态，未来切片须明确应进入哪个既有保存模型；本批不更改格式。

验证入口已有：`tests/structured-onplay-battle.test.js:192` 实际 BattleSession 断言 heal 后 armor、改文案不重复效果；同文件 :110,164,175 覆盖伤害、护甲、沉默；`tests/battle-resolution.test.js:80–150` 端口执行用例；schema 正负例及 `tests/battle-restart.test.js:29` 入场重开。均为源码证据，未本批执行。内容/规则版本、初始状态、随机状态、操作序列需共同固定才能比较确定性；仅同 seed 或同演出速度不能证明规则等价。

### 4.2 战后结算与离局结算

结论：部分具备；重复请求/旧局保护已有具体路径，普通胜利的两次保存不能冒称成对事务。

| 路径 | 调用与写入 | 失败、取消、恢复责任 |
| --- | --- | --- |
| 普通战斗结束 → 背包整理/本局奖励 | `battle.lifecycle.js:126–154` 清理状态、置 battleActive=false，发 battle:end；`hub/game.bag.settle.js:25,259` 订阅。:58–82 将使用/注能牌从 game.ownedCards 移入本局 usedPocket（经 bagSlots.pocketAdd），临时/职业/初始牌分支消散；:138–175 发额外卡、标记节点、saveGame | :24–44 WeakMap(opts) 保存 phase/promise/runId；sameRun、rewardsApplied/runSaved/baseSaved 防同实例重复及保存重试；:46–51 给 UI 重试。它是内存结算记录，不能当持久 receipt。slot=null 时 sameRun 仅比较空档位，保护边界弱于有 runId 的持久局。 |
| 胜利的基地增量 | settle:147–149 增 Base.data.eggBattles，:170 先保存 run，:174 再 Base.save；:94–99 ammoTaught 也单独写基地 | 局内战利品不是这里全部进基地。Base 失败有同实例重试；两键之间没有该流程的 journal，跨刷新中断完整恢复未证明。教学保存返回值未参与该主保存重试。 |
| 撤离/整理/入库/完成 | `run/game.run.altar.js:774–800,891–937` → extraction.commands。`extraction.commands.js:51–95` 计算材料、口袋概率保留、统计/熟练度和 pending.remainingCards；:213–236 分步入 stash；finish 分支将 afterRun 置 null | start/stash/finish 经 recovery.commands 的 pair，命令核 slot/runId/revision、请求指纹；失败保留 pending，load 可恢复整理界面。不是每胜一战都执行撤离结算。 |
| 死亡/放弃 | 战败 settle:27 → doDeath；`run/game.session.death.js:144–154` 与 `ui/game.menu.js:821,881–894` → terminal.commands.createAttempt/commitAttempt；`terminal.commands.js:131` 提交 afterBase、afterRun:null | death token/generation/current 守卫（death:43–64,138–160），放弃 token/current（menu:825–830），失败重试；slot=null 使用 projectEphemeral，只投影内存。撤离、死亡、放弃不是同一个奖励公式。 |

成对提交细节：`recovery.commands.js:62–65` 缺 Web Locks 拒绝生产双键事务；:113–168 持锁校验槽位、runId、revision、requestId+fingerprint，已有同请求重放旧收据，不同 payload 拒绝；`recoverable-pair.js:113–143` 日志→基地→run→清日志，失败区分 SAVE_FAILED 与 SAVE_FAILED_PENDING_RECOVERY。`pair:78–110` 恢复只接受当前 raw 为 before/after，第三值拒绝并保留现场；生产 `recovery.commands.js:22–55` 补版本和收据身份校验。通用日志形状合法不是业务成功。

现有用例源码：`tests/battle-settlement-retry.test.js:51,69,97,113` 覆盖重试、不重发、Base 失败、同槽新局旧回调；`tests/extraction-recovery.test.js:53,71,92,118,135` 覆盖中断/receipt 重放/刷新分批入库/无档位/旧 runId；`tests/terminal-recovery-matrix.test.js:59,81,120` 覆盖真实 Base/RunStorage 故障矩阵和第三值保护。未本批运行，不能据其存在推导全部跨刷新失败窗口已覆盖。

龙巢例外：game.bag.settle:26 明确把 nestActive 交给 game.nest 的独立订阅，不把普通四层背包结算结论外推龙巢全部奖励。本批场景以普通远征为闭合主链。

### 4.3 旧档升级与恢复

结论：部分具备；事务恢复、版本迁移、地图恢复和战斗重开分别已有入口，完整存档业务 schema 并未由一处静态类型保证。

1. 真实 UI/Agent 调用：`ui/game.menu.js:701–752` enterSlot 回调先 `recoverSlotIfPending`，再 preflightRunMap，转场后 ensureBattleReady，再 loadGame；Agent 的 UI 分派仍调用同表（agent.runner:68–73）。进入互斥及 picker.isConnected 检查在 menu:694,703,709，不能外推所有后续 await 都有局代次守卫。
2. 先恢复事务：pending journal 由 recovery.commands/pair 校验、恢复或拒绝，失败留档并提示；无日志路径不要求锁能力。此步骤不是旧版本迁移。
3. 读取/迁移：`game.storage.js:51–76` read 解析 JSON，过新 version 返回 null 且不改 run 原串；坏 JSON/非对象走 :88–91 corrupt 备份（备份写入也可能失败，原键仍保留）。迁移在内存逐级执行；:16–28 将旧 builtin-sha ID 改为 starter-attack，:74 再 migrateRunCharacter。:78–84 readForLoad 记录写 baseline；不能将 read 的浅对象/版本检测说成完整业务校验。
4. 预检：`game.session.js:191–207` 拦待恢复事务、校验 pendingExtraction 及 runId，再 `planMapRestore`。`run/map-snapshot.js:58–139` 检 schema/JSON/节点边/版本/位置；无快照旧图只接受有真实 seed 的指定 3/9 路线，未知/冲突拒绝保留原串。严格地图 schema 与可扩展 run 顶层的兼容策略不同。
5. 建运行态：session:218 恢复 Random，:219 installDerived 重建地图派生，:220 Base.use(slot)，:225–276 归一 hp/资源/数组、刷新卡副本、恢复 Set 等；卡牌副本按当前卡库刷新（:245–250），不是对旧卡规则永久冻结。随机服务 `core/random.js:48–55` 恢复命名流；地图缓存不作为第二拓扑真源。
6. 对外可用：pendingExtraction 走 session:277–286 的 resumeExtraction（未就绪返回失败）；普通地图 enterLayer 后若有战斗，:313–317 Battle.restore 并尝试 saveGame；龙巢走 :288–303 的独立分支。loadGame 最终 ok:true 表示装载分支成功，不证明其内部每次 Base.save/saveGame 都成功；调用处没有汇总这些保存返回值。存档持久成功与可玩界面可用应分别验收。
7. 档位隔离/原始数据：RunStorage 使用 sdt-save-v2-slot1..5 与写基线，Base 使用对应 slot 键；普通 write 在 `game.storage.js:113–139` 拒待恢复事务/旧 baseline，再写 revision；不存在本批改键或迁移写盘操作。旧键搬迁有实际启动链 `game.boot.js:652` → `game.session.js:84–85` → `game.storage.js:161–169`：存在旧单档且 slot1 有 pending journal 时拒迁；目标缺失时 setItem 成功后清旧；目标已存在时保留目标并清旧，不能写成总会先写目标。基地旧键由 boot:656 → `base.js:210–221`，向缺失目标槽复制，全部目标无待恢复事务且复制未抛错后清旧。键搬迁与内存字段迁移是两件事。

既有源码用例：`tests/save-compat.test.js:20,35,49,60,68,78,90,98,112,127` 对旧单档、五槽、坏档、未来版本、跨标签冲突和基地迁移断言；`tests/r5a-map-snapshot.test.js:9,16,23,31,45,53` 对旧 3/9、冲突、坏图和 route v2 断言；`tests/r5a-session-menu.test.js:37,72,92` 对真实保存/载入及预检拒绝断言。这些旧无地图 fixture 不证明任意旧地图可恢复。恢复后持久失败对用户可见行为、所有坏业务字段组合、真实浏览器中断链仍未运行核实。

## 5. 过渡边界与退役前事实

以下仅是已有转接及以后迁移需满足的事实，不发起迁移、不指定新实现范围。

| 已有兼容边界 | 已知调用方及权威 | 退役或改接前需满足 |
| --- | --- | --- |
| window.SDT / ESM | `core/sdt-facade.js:14–20` 同一对象；boot、kernel、Agent、battle-loader 仍依赖；不是另一份权威状态 | 逐调用方列清新入口、启动顺序与晚注册关系，不能仅删门面；Agent/debug/UI 回调及测试 harness 需有接替。 |
| game.session 聚合导出 / kernel 单例 | `game.session.js:485–490` 重导出 kernel/分片；UI、Agent、hub 使用同 game | 保持同一实例及活绑定，先界定写入口和只读投影的字段范围；不能复制 game 作为第二真源。 |
| battle.runtime 重导出 / core viewApi | runtime:1–8 保持子模块活绑定；view:16、agent.state:41–52 的 findCard 等兼容读口仍在 | 拿到实际消费者清单与读写意图后才评估缩口；重置/恢复/结束须覆盖五类运行态和代次。 |
| battle:end / G.onBattleEnd 回退 | lifecycle:154–155 无订阅才用旧回调；bag.settle:259 订阅，龙巢另分支 | 回调退役前确认普通/龙巢/测试 harness 均有接收者；保留奖励与重试唯一责任，不增加第二结算器。 |
| 结构化 card.rules / 文本解释 | resolution:85–102,460 起共存，部分 operation 已接线，部分 pending 拒绝 | 按具体机制核文案改写、效果次序及旧卡兼容，不全局切换规则来源，不手改 cards-sync.json。 |
| Base.save/RunStorage.write / recoverable-pair | 普通胜利与日常保存仍直写；撤离/终局 pair 有日志与 receipt | 先确定哪种业务需要事务、保存成功语义和失败责任，再由 Friday 决定是否迁移；现有 receipt 返回形状无需强制统一。 |

复用候选已具事实支持：Battle.commands、execution-session/action-runner、GameStore 已隔离纯数据、RunStorage baseline、recovery.commands、recoverable-pair、Random 命名流。新万能命令层、第二状态仓库、全仓 TS 改写及抽象重建的收益均未由 E1 证明。

## 6. 差距表

“明确缺口”可以是静态或结构事实，不等于已在游戏中复现故障。下面没有把只读发现自动升级为必须实施。

| 问题 / 状态 / 类别 | 证据与影响 | 可能涉及文件；Friday 决策 |
| --- | --- | --- |
| 快照未全隔离；明确缺口；结构风险 | GameStore:54 展开保留 map/hover/moveTarget；Battle engine:420 findCard 原 entry、lifecycle:241 selPool 来自 ownedCards、engine:502–526 原样投影；snapshot:46,60,79,84 只浅拷贝卡，嵌套 rules 可共享。源码已证引用链，未运行恶意修改复现 | game.store/types、battle.snapshot/engine/lifecycle、实际消费者；需裁决只读对外面及范围，不能破坏刻意保留的运行时引用。 |
| 普通胜利 Run→Base 不是成对事务；部分具备；结构风险 | bag.settle:170–174；有同实例重试，但内存 WeakMap 不跨刷新。跨保存窗口的永久计数完整性未有本批运行证据 | bag.settle、保存/恢复调用；是否要求胜利永久计数与本局奖励同事务由 Friday 决定。 |
| Battle/内容完整调用未静态约束；明确缺口；结构风险 | jsconfig 根、类型宽字符串/any 边界、Battle 无对应声明接线；旧库类型不能自动覆盖所有调用方 | jsconfig、Battle 命令/快照、schema 等；需先选高风险接口切片，不默认扩大全仓 include。 |
| Agent 分派成功与业务成功不同；已有且有证据；语义边界/文档不足候选 | runner:83–87 不读命令 false 返回值。当前行为确定，但是否违反产品协议需结合调用方成功定义裁决，不能直接称保存成功 | agent.runner/protocol 及命令消费者；若改成功语义需 Friday 决策。 |
| 战斗懒加载后未见局代次复验；部分具备；结构风险 | battle-loader:27–30 await 后直接 battle.start；run/game.run.scenes.js:235–241 调用段未补此复验；不能由 execution-session 已存在推导全 async 安全 | battle-loader、对应 run 调用；真实 UI 是否能在窗口内切局待核实，优先级及修复范围由 Friday 决定。 |
| loadGame 成功未汇总内部保存结果；已有且有证据；语义边界/结构风险 | session:244、272 的 Base.save 与 :316 saveGame 未汇总；:319 仍返回装载 ok。可用状态与持久成功不能混称 | session/menu/恢复提示；若要求统一完成语义需裁决，当前不强制统一返回形状。 |
| 存档顶层业务覆盖不集中；部分具备；结构风险 | storage:59 的 object 检测与 session 字段默认不能证明所有组合有效；地图严格门已有。坏业务字段组合覆盖待核实 | storage/session、领域 validator；是否增入口校验及兼容默认策略需 Friday 决策。 |
| 现行文档与源码定位有历史路径；部分具备；文档不足 | architecture:62 仍指向已归档旧计划；jsconfig 注释提旧文档路径。不是运行代码缺陷 | 共享 architecture/jsconfig 归属未释放；可后置，由原所有者处理，本批不改。 |
| 新抽象/全 TS/重建状态层；待核实；收益未证明 | 已有命令、端口、恢复器、单例、随机服务，E1 没有性能/维护成本实验支持重建 | 不自主发起；Friday 决定，当前可后置。 |

已证实的运行故障：本批没有执行运行复现，因此不登记新的“已运行确认故障”。上述确定的源码行为与尚待动态验证的触发条件已分开。没有仅凭文件缺少文档定性代码缺陷。

## 7. 独立审查与主指挥简报

整合/独立复核收敛：2026-09-27 10:39（Asia/Shanghai）。GPT-6-sol medium 已两轮阅读本文件实际正文，并回报达到 E1“事实证据基线”验收：五职责、五类类型契约、三场景都有明确结论及真实调用链，没有未处理的事实错误或阻断下一切片决策的关键矛盾。此结论不是运行架构改造完成，也不是动态验收通过。

修正记录：

1. 独立提前抽查纠正了“快照全面隔离”“胜利完全不写基地”“日志形状合法即业务成功”“include 即完整检查清单”等可能误述，正文明确了限制。
2. 首次全文审查要求补齐路径缩写规则、出牌→队列→exec→解释器链、旧键目标已存在时直接清旧的例外和实际启动链，并纠正 Base.save/saveGame 行号；主指挥仅修改本证据文件。
3. B 线补证定版卡源、schema 引用限制、检查入口 import 方向及具体正负例；Sol 随后重新全文阅读并抽核 catalog/data-loader、类型例、Base 旧键迁移和 game.heal 写口，确认必须修正项全部关闭。

未解决事项均已在第 6 节明示为能力边界、动态验证缺口或 Friday 待定取舍：普通胜利跨刷新窗口、懒加载后切局触发、完整存档坏字段组合、快照外部面范围、命令成功语义。并无把这些风险判成已修复或已运行复现。本批没有测试/类型检查/构建/游戏；构建、产物预算、浏览器、长局继续未验证。

主指挥四项简报：

1. **干了什么**：建立指定三名只读子代理团队，完成五职责、五类型、三场景的源码核验和独立复核，仅新增本证据文件。收尾 HEAD 仍为 dd5ac7f，对本地 origin/master 仍 2/0，未 fetch；代码及他人在途文件未由本团队改写。
2. **必要性**：本批必要，纠正了胜利/撤离提交、快照隔离及类型覆盖边界的具体误判，足以支持 Friday 选择首个实现切片。共享历史文档链接可后置；新万能层、第二状态仓库和全仓 TypeScript 迁移收益未证明；重复修复已通过历史批次、重跑本批禁止的检查属于无效或越界返工，未执行。
3. **有效证据及独立审查**：证据是当前源码路径/符号/行号与既有测试断言源码；两名 Luna 分线核验，Sol medium 独立抽查、审查实际文档、修正后复核通过。历史 158 文件/920 项及类型通过未冒充本批运行结果。
4. **还欠什么**：下一实现切片及上述语义/架构取舍由 Friday 决定；实现、定向或全量测试、构建/预算和实页/长局验收均不在 E1 已完成范围。本团队在 E1 批末停止，不自动实施、不派发下一批、不设置周期唤醒；只向当前 Friday 协调对话发送一次完成报告。
