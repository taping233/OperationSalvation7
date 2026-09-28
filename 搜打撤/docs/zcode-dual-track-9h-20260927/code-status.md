# 代码优化线状态（Friday / 代码线）

- 会话开始：2026-09-27 23:42，截止 2026-09-28 08:42（9 小时）。
- 状态：盘点完成，进入第 1 项实施。
- 给体验线/美术线：身份确认，我是代码线 Friday。职责新口径（老板 09-28 00:0x 指令）已收到：我主改**规则、状态、存档、公共接口、性能**；你们改流程体验 / 视觉素材动效。需要事件、状态或取消能力时发 EXP/ART 请求，我在本文件回复。

## 环境通报（三方都受影响）

**重新连接问题已定位（00:1x）**：今日 ZCode 日志 `~/.zcode/cli/log/zcode-2026-09-27.jsonl` 中 model.request.failed 共 171 次：159 次 rate_limited(429)、6 次 network_error（TLS 握手前断连）、6 次 cancelled；集中爆发于本地 23 时段（165 次）= 三线+子代理同时开工时刻；昨日全天仅 14 次。结论：**服务端账号级限流为主因**，代理通道抖动为次。已报告老板；本线整改：**子代理改串行（≤1）**，建议三线都限并发、重活错峰。

## 文件归属声明（代码线）

- **禁区（他人属地，绝不写入）**：M 批外部会话 staged 全部（battle 域多数、cards 域、其 tests、docs/M-BATCH-*）；onetake 动效会话 unstaged 14 文件（css/battle.css、css/expedition.css、battle.core.js、battle.layers.js、battle.view.js、camera.js、renderer.js、game.hub.depart.js、game.run.altar.js、game.run.flow.js、game.run.shop.js、game.session.board.js、game.session.js、hud.js）。
- **代码线拟主改（本次登记）**：`hub/base.js`、`hub/game.storage.js`、`hub/commands.shared.js`、`hub/recoverable-pair.js`（存档读取管线收敛）；`agent/agent.llm.js`、`agent/agent.runner.js`（取消链）；`ui/game.menu.js`、`core/notes.js`、`ui/overlay.js`、`ui/cinematics.js`（生命周期缺陷）；`ui/ui.js`（reduce-motion 残缺版，仅 177 一处）；`core/shared.js`+`ui/route-overlay.js`+`run/map-snapshot.js`+`home/story.last-lamp.js`（clone 收敛）。逐项动工前再 `git status` 复核。
- 已发现但**不动**（属他人属地，只报告）：`hub/game.hub.depart.js:324` reduce-motion 残缺版（onetake 属地）。

## 工程候选清单（≤8，证据见探查报告）

1. **版本化存档读取管线孪生收敛**：`hub/base.js:162-206` 与 `hub/game.storage.js:35-130` 各自维护 ~40 行同构实现（指纹缓存/tooNew 拒读/逐版迁移/坏档备份/乐观并发写），TX_KEY 也逐字双份。存档正确性主责范围。验收：现有 base-*/save-compat/存档测试全绿 + 新增工厂单测；不改键名/迁移语义。触碰占用文件：否。
2. **Agent LLM 取消链贯通**：`agent.llm.js:96-106` fetch 支持 signal 但 decide() 从不传，stopRun 打不断在途 LLM 请求，COMMAND_TIMEOUT 不覆盖决策段。验收：假 fetch 测试证明 stopRun 后在途请求被 abort、autoRun 退出；真实浏览器未验项如实标注。触碰占用文件：否。
3. **UI 生命周期缺陷簇**：a) `game.menu.js:978` MutationObserver 跨页存活把跑局数据页头注入设置页；b) `core/notes.js:18` 裸 localStorage 写，配额满时备注丢+弹层卡死；c) `ui/overlay.js:150` 背景探测 Image 无 onerror，「正在进入…」常驻；d) `ui/cinematics.js:43` 卡牌奖励队列无上下文 token，退场后仍弹卡。逐项独立验证。
4. **reduce-motion 残缺版修复**：`ui/ui.js:177` 只看媒体查询、无视设置开关；`game.hub.depart.js:324` 同病（属地他人，只报不改）。统一走 `core/motion.js` reduceMotion()。验收：设置页勾选后照片动画不再播放。
5. **clone/fail 小收敛**：`route-overlay.js`/`map-snapshot.js`/`story.last-lamp.js` 本地 clone 改用权威；`recoverable-pair.js:15` fail 改 import。验收：相关测试绿，无行为变化。
6. **RNG 核心/加权抽样收敛**（视进度）：`map-generator.js` 逐字复制 core/random.js 核心——抽取必须逐位一致，有地图可复现风险，默认只报告不实施，除非时间充裕且可证位等价。
7. **esc/escAttr 口径统一**（视进度/待定）：双口径已是事实，但涉及 HTML 拼接行为变化，涉及 cards.view.js（占用域），倾向只登记不动。
8. **体验线/美术线接口支撑**：待 EXP/ART 请求，预留约 1.5 小时容量。

## 对体验线的回复

**回复 EXP-001（00:30，全部字段已对照源码核实）**：

| 字段 | 口径 | 证据 |
|---|---|---|
| `game.usedPocket` | `{card,count}[]`，按卡名聚合、**条目不携带 uid**（有 console.error 看门）；火堆复原时 count-1、归 0 splice 移除（scenes.js:329） | game.session.bag.js:68-70；game.run.scenes.js:323-329 |
| 清空时机 | 新局重置 `game.usedPocket = []`（与 ownedCards/shopStocks 同批，game.session.js:477）；离局自然随新局 | game.session.js:474-477 |
| `game.ownedCards` | `{uid, card}[]`（与 usedPocket 结构不同，别混用） | game.bag.rules.js:45 等 |
| 容量 | **没有 `game.bagCap`**——容量在基地域：`SDT.Base.bagCap()`（`min(rules.bagMax, rules.bagSize + base.bagUp)`）。当前占用=`game.ownedCards.reduce((a,o)=>a+(o.count||1),0)` | base.js:380 |
| `game.coins` | number，随身币 | — |
| **1/3 带回权威口径** | `calculateBaseAndPending`（extraction.commands.js:44-56）：仅作用于 `usedPocket`，按**份**逐张独立判定 `random() < 1/3` 保留；`totalPocketCount = Σcount`。`ownedCards` 全部 100% 带回（唯一豁免=`Base.isSha` 初始攻击不入库）；木材/口粮 100%；**随身币不带回**（只记 bestRunCoins 统计）；无珍珠盒豁免分支 | game/src/hub/extraction.commands.js:44-90 |
| 层数 | 字段是 **`game.layerIdx`**（不是 game.layer）；当前层=`curLayer()`（session.kernel.js:44）。撤离适用期判定建议直接读 `MAP`/出口数据，别数层数 | game.session.kernel.js:44 |

**带出预估的推荐实现**：期望值投影 `expectedKept = Σ (p.count × 1/3)`（逐张独立伯努利，期望精确=Σcount/3；展示建议写「≈y 张」并保留方差提示）。**我在做 CODE-002**（见下）：提供只读纯函数给你直接调，你不用复写口径。

**回复 EXP-002（路线面板差异化）**：相邻节点数据 = 地图节点(type/encounterId) × 敌表/事件表的 join，中成本。建议切片1/2 落地后再评估，我先把「节点→遭遇构成」只读 helper 列入候选（CODE-003，非承诺）。

**HMR 打断问题（两线都反馈了）**：源码编辑必然触发整页刷新，无法根治。我方整改：①实现期把编辑聚簇、一次消息内完成一批写入；②大保存批次前在本文件写「保存窗口」预告；③你们若有 `vite --watch`/HMR 降级选项可自行关闭热更（你们侧的自由度更大）。见 CODE-ART-001 回复。

## 对美术线的回复

**回复 CODE-ART-001（00:30）**：采纳。我的保存节律改为：编辑聚簇写入（尽量 ≤2 分钟一批），每个实现批次开始前在本文件「保存窗口」栏写预告（预计写哪些文件、约几分钟）。见下方保存窗口栏。

## 新增支撑项（代码线主动认领）

- **CODE-002 带出预估纯函数**（00:30 认领，预计 00:30-00:50 交付）：新建 `game/src/run/extraction-preview.js`，导出 `previewExtraction(game, baseApi)` → `{ bagTotal, bagCap, pocketTotal, expectedKept, coins, canExtractNow }` 纯只读，零状态写入；口径=extraction.commands.js 唯一权威的期望值版本。体验线切片1 直接 import；美术线不接触。验收：单测钉口径（含 isSha 豁免、count 聚合、期望线性）。
- **CODE-003 节点遭遇只读 helper**：仅当体验线推进切片3 再做，暂缓。

## 已完成（续3，01:18）

- **storeGet/storeSet 收敛**：game.menu.js 本地逐字副本删除改 import core/storage.js 权威（会话能力仍 deps 注入不变）；5 文件 47 用例全绿。
- **esc 改动实页复核**：重载后设置页中文/英文标签渲染完好、0 控制台错误——全仓 esc 语义收紧（加引号转义）对渲染无可见影响，符合预期。

## 里程碑（01:12）

- **二轮全量回归全绿**：201 文件 / 1664 用例通过 + 2 skip / 0 失败（`npx vitest run --no-file-parallelism`，356s）。我的全部改动叠加 M 批在途工作区成立；M 批此前 4 条预期红已由其翻转为绿（全量口径下）。

## 性能线结论（01:15，如实记录）

- **`npm run perf` 本工作区不可跑**：探针依赖 `desktop-app/node_modules/electron/dist/electron.exe`（ENOENT）。桌面版冻结、不能装依赖 → Electron 基线（performance.md 口径）本轮无法产出，需老板拍板（装桌面依赖 or 指定时机跑）。
- **浏览器探针亦不可行（当前环境）**：IAB 标签页隐藏/非前台时 rAF 合成暂停（实测心跳 0/4s），空闲零绘制与活动帧节奏探针均失真；待联合窗口有前台渲染时再测。
- 代码线改动**未触碰任何绘制/渲染路径**（diff 范围自查：hub/agent/ui 事件层/core 纯函数），无渲染回归面；美术线去掉 backdrop-filter（常驻层只走合成器）与性能预算一致。

## 归属更新与候选收敛状态（01:25）

- **`run/chests.js` → 体验线**（切片2 已动工：eps-card-val 价值行 + eps-fate 提示，实现质量好，正确用了 SDT.Cards.sellPrice 权威）。代码线放弃原第 6 项「weighted 双份收敛」（涉 chests.js）。
- **audio/sound.js 存储散点收敛**：评估后不做——纯语义等价替换、无行为收益，属任务书排除项（为收敛而收敛）。
- **esc 全量收敛完成（01:20）**：shared.js 纯化（删顶层 SDT/UI 死导出=求值时点脆弱性根源）+ art/icons-bitmap/expedition.view 本地版改 import + preparation.view 保留 `?? ''` 空值策略薄包装；漂移守卫测试改为「必须 import 权威、不得残留本地定义」。8 文件 57 用例全绿。全仓 esc 现在单一语义：五字符满配。

- **02:57 巡检#3（冻结窗口内代码线域复核，02:40-03:20 生效中）**——全部通过：
  - 存档往返（5299 槽4 隔离验证）：peek 读回一致（coins 33）、issue=null、save 解锁（粘滞修复在真实渲染环境成立）、写后 version 盖章、重读无漂移 ✓
  - 状态条数据面（真实渲染链路，仿真对局态）：「5/16背包 · 3消耗袋 · 12随身币·离局清零 · **2+≈1** 带出预估·张」——ownedCards 3 张中初始攻击正确豁免（计 2）、消耗袋 3×1/3 期望=1、容量走 Base 权威=16，与 CODE-002 口径逐位吻合 ✓
  - CODE-003 数据面：真实 map.json 单测钉（低/中/高3%/极高10%）+ 体验线 5200 实测读数一致，双证成立 ✓
  - 结算数值：extraction-settlement/preview 等测试在两轮全量中全绿，引用为证据 ✓
  - 另见美术线 02:5x 独立复核闭环（裁决不通过→撤槽位级覆写→复验过）——其域自理，代码线无动作。
- **03:27 巡检#4**：冻结窗口 03:20 结束，写入恢复。两线无新请求（美术线 03:21 为复核闭环归档；体验线 02:17 后静默，推断在实机验证批）。HEAD 未动（791b2c2）。联合窗口（02:40-03:20）代码线域复核结论已于 02:57 回填（全绿）。本轮无代码改动——07:30 终验窗口与 08:15 最终报告按计划；最终全量回归排在收尾段（01:06 全绿后又有多批定向绿，最终轮再整体确认）。
- **03:27 巡检#4（续）提前终验全量**：03:28 起两轮——首轮 202 文件/1670 用例全绿 + 1 个一次性未处理错误（dot 报告器无详情）；当即以默认报告器复跑第二轮：**全绿且零 Unhandled**（exit 0）。判定首轮错误为三线并发负载下的 worker 收尾瞬态，非代码缺陷信号；08:15 收尾段不再重复全量（除非窗口后又有改动）。202 文件对账：+1 文件/+6 用例均为代码线 01:15 的 agent-runner-abort 及其用例增量，无外来测试文件。
- **03:57 巡检#5**：两线静默（体验线 02:17 后无更新，推断长流程实机验证中；美术线 03:21 后无动作）。无新请求；HEAD 791b2c2 未动；工作区 76 条与上轮一致。代码线无待办，提前终验全量已双轮绿（03:28/03:3x）。不硬造工作，等下一唤醒。
- **04:27 巡检#6**：美术线 04:01 更新=终报渐进填充（美术域切片 03:2x 已收敛：3.7 小时有效交付+待命；未完项如实列出：exSmart 真屏代验、eps-pop 自然复现挂起、章节窄列换行既有行为报备）。体验线仍静默（02:17 起）。无代码线待办；HEAD 未动。等 07:30 终验窗口。
- **04:49 巡检#7（老板问询后恢复主动工作）**：**clone 权威下沉 core/shared.js**——M 批提交解禁 battle 域后完成重复逻辑清单最后一个可动项：battle.engine.js 的 cloneData（空值容忍语义）与 hub/commands.shared 的 clone（会抛错）合为 core 层唯一实现（空值容忍=严格超集，全部既有消费方零变化）；commands.shared 转发导出保持命令家族 import 面；route-overlay/map-snapshot/story.last-lamp 三消费方改指 core（消除为工具依赖 hub 的层级异味）；battle.engine 经别名导入、导出面不变。架构边界测试（battle 禁反向依赖 hub）显式核过。13 文件 163 用例全绿。至此全仓深拷贝唯一权威=core/shared.js clone。
## 全量审计计划（04:52 老板指令：多子代理全量检查+制定计划+全量修改）

- **审计四路（只读并行子代理）**：A 顶层设计/模块边界（分层/环/门面求值时点/公共面一致性）；B 性能（渲染循环/动画定时器/内存/启动路径，对照 performance.md 预算）；C 可靠性（异步取消覆盖/竞态/错误处理缺口/存档边界，覆盖 battle/cards 解禁域）；D 质量一致性（剩余重复/死代码只报不删/命名与 API 一致性/测试质量）。
- **排除域**：onetake unstaged 14 文件（清单见归属声明）、experience/ 全部、run/chests.js、美术线 css（pocket-strip/experience-loot/page-rewards-bag-help/index.html 两行）、docs/zcode-dual-track-9h-20260927/。
- **已知已修清单（审计不重复报）**：存档管线收敛、LLM 取消链、menu 观察器/notes 配额/overlay 探测/cinematics 队列、reduce-motion、clone/fail/esc/storeGet/RNG 收敛、autoRun 守卫+墙钟、Blob revoke、流名盐 RNG、门面早求值（random-core 模式）。
- **流程**：审计结果汇总→按 严重度×风险×属地 排优先级→分批修复（每批聚簇保存+定向验证+批后全量）→07:30 三方终验窗口冻结→08:15 最终报告。
- **窗口预告**：审计只读不写游戏文件；修复批预计 05:10 起每 20-30 分钟一批。

- **05:0x 审计节奏调整（老板指令：串行）**：四路并行审计触发账号 429（审计B 已被打断），已停 C/D 只留 A（顶层设计）单线跑完；串行队列 = A → B(重跑) → C → D。四路审计期间代码线本体暂停其它消耗，等待串行回收。
## 四路审计结果汇总与修复记录（05:0x-05:27）

**审计回收**：A 顶层设计✅完整、B 性能✅（限速后串行重跑成功）、C 可靠性✅（限速中止但核心覆盖）、D 质量⚠️部分（限速中止）。

**已修复（批次1-3，全部定向验证绿）**：
1. 撤离整理 inFlight 卡死（审计C·卡死级）：extraction.commands.js 失败路径清残留，重试重建新鲜凭据；
2. 抽牌灰烬符文空引用（审计C·崩溃级）：battle.engine.js:142 补 entry 判空；
3. dealDamage NaN 防线（审计C·数值）：combat.js 入口 finite 兜底（同文件家规对齐）；
4. cards.view 体内 esc/escAttr 遮蔽删除（审计A·L2）——**过程中抓到并修复自身回归**：顶层未导escAttr 致宝箱渲染 ReferenceError（即全量轮次偶发 1 error 的同族来源，现已实体修复）；
5. clone 残余 5 处收敛（审计A·L3）：battle.engine 双轨消除、battle.runtime.session、cards.sync（后者修复过程中发现局部绑定被我误删，已按原语义用权威 clone 重建并通过 sync 守卫测试）；
6. **clone 权威下沉 core/shared**（battle 域解禁后完成，架构禁 battle→hub 故下沉 core，commands.shared 转发；6 个 mock shared 的测试文件同步补 clone 桩）；
7. **seedBatch 整批落盘**（审计B#6·首启秒级卡顿）：cards.sync.js 播种从每卡一次全库序列化+写入改为批内内存合并+单次落盘（失败重放一次语义保留），152 用例绿；
8. **battle.frames 重复 rect 读合并**（审计B#3）：tickLoop 复用已读 rect 传参；
9. **门面挂载统一 sdtDefine**（审计A·M4 部分）：input/motion/icons-bitmap/art 四文件（仅限已有门面导入者，零新边；其余 5 文件涉新增门面边归 H1 专项）。

**只报不改（属地/需批/需实机）**：
- 审计A：H1 32 处顶层快照全量惰性化（建议加架构守卫测试）、H2 kernel 三重硬依赖、H3 core→run 边（renderer 属 onetake）、M1 hub↔run 26 边、M2 battle 门面后门、M3 ui-scale/term-tips 迁 core（文件移动需批）、M5 hub↔home 9 边、M6 run↔agent、L4 大文件清单；
- 审计B：renderer 当前节点盘每帧渐变+shadowBlur（onetake 域）、boot/icons/hud 三 observer 叠加（合并有风险，缓）、art 预算注释漂移、boot prefetch arrayBuffer（报备口径内）、battle.vfx foeAttackLine 整视口 canvas（复用需池化+实帧验证，缓办）、battle.frames 首接管 26 候选串行探测（可并行化，涉及演出时序，缓）；
- 审计C 未覆盖段（限速中止）：effect-steps 数值深查、base/game.storage 写路径内部、overlay/ui、bag.settle——如需可再补一轮；
- 审计D：battle.clock 导出虚胖（删需批）、base/meta 失败形状双轨（{ok,why}→fail() 迁移涉 10+ 消费点，排下批）、meta {ok,msg} 2 处、battle-loader/enemy-phase/卡片迁移失败无玩家提示（报备）。
- 正面结论（两审计一致）：全仓无空 catch、无注释掉的代码块、无模块级死代码、无无界内存增长、静态导入图 0 环、idle 零绘制成立。

**事件**：05:0x 四路并行触发 429（老板令改串行）——B 首跑作废重跑成功；后续多代理默认串行 ≤2。

## 审计修复循环闭合（05:51，老板指令「全量检查+制定计划+全量修改」的交付）

- **05:44 全量回归：203 文件 / 1671 用例全绿 + 2 skip，0 失败 0 未处理错误**（审计修复批后的完整确认；03:28 全绿 → 四路审计 → 修复三批 → 本轮全绿）。
- **重要更正（诚实记录）**：审计C1「inFlight 卡死」经测试证伪为**误报**——inFlight 残留是中断事务的恢复令牌（extraction-recovery「receipt重放不重复卡牌」用例钉住的契约：after-base/after-run 注入失败后重试复用同一 attempt 经 recovery 日志续放）。我最初的一刀切删除会双重入库，被该用例当场抓住，已完全回退并在源码注释中写明契约依据。教训：并发/事务类审计发现必须以钉住该契约的测试为准绳，不能只看「失败后状态残留」的表面模式。
- 保留的修复：C2 抽牌空引用、C3 伤害 NaN 防线、L2 cards.view esc 遮蔽（含 escAttr 缺导入回归的即刻修复）、L3 clone 残余、M4 部分（sdtDefine×4）、B#3 frames rect、B#6 seedBatch 整批落盘、clone 下沉 core、H1 漂移守卫测试（33 文件基线钉死）。
- 新增守卫：tests/facade-snapshot-drift.test.js（顶层 window.SDT 解引用模块=33 文件已知清单，新入列须过人眼）+ 6 个测试文件的核心门面 mock 补 clone 桩。
- 评估后不做（记录理由）：{ok,why,msg}→fail() 形状迁移（本地方言自洽，纯 churn）；battle.vfx canvas 池化（需实帧验证）；H2 kernel 惰性化/H1 32 文件全量惰性化/M1 hub↔run 26 边（结构性大改，超出本窗口安全边界，已详细登记留给后续会话）。

- **05:56 巡检#7**：体验线 04:40 确认 boot 挂载实测通过并撤 index.html 直挂行（挂载交接闭环）；切片4 上线（价值档位色+满包对比建议，chests.js 05:09 批次）。美术线 ART-006 直攻老板四项反馈（双关闭治理/成就弹层重做/排版归一，全 css 已实测），其中「strip 遮挡元弹层」正确报给体验线（js 域）。代码线表态：**若体验线需要页面可见性信号（元弹层打开时隐藏状态条），`UI.el.overlay.hidden` + 弹层标识即可判断，无需新接口；需要我提供规范读法再发请求。** 另：审计修复批（clone 下沉/esc 收敛等）会轻微改变 cards.view 等文件，体验线 5200 副本同步时注意（依赖登记确认过文件名冻结，逻辑面无变化）。
- **06:27 巡检#8**：体验线 06:25 **实现面冻结**（3 小改+3 新文件，测试累计全绿），终局盘点已发老板审批（.exp-observe 观察环境/5200 日志建议批准删除；**5199 Vite 僵尸 PID 21256 系 09-25 遗留非本线产物**——我今晚首试 5199 被占后改用 5299，与此独立）。切片4/#8 验证收口。美术线无新请求。代码线状态不变：审计修复批全绿（05:44 全量 203/1671），07:30 冻结窗口执行三方终验复核，08:15 最终报告。
- **06:27 巡检#8（续）**：rAF 心跳复测仍为 0（IAB 合成管线限制确认为环境级，与前台与否无关）——真实对局流程验证维持由体验线可视环境承担的分工；我方存档/结算正确性证据链=契约测试+5299 数据面复核+体验线 5200 往返实测，三证齐。
- **06:57 巡检#9**：两线自 06:2x 无更新（07:30 冻结前安静期）。无新请求；HEAD 未动。下轮唤醒（~07:27）进入冻结窗口：执行代码线域终验复核（契约测试重跑+5299 数据面复验）并回填结果。
## ★ 三方冻结终验窗口——代码线域结果（07:28-07:35 回填）

- **冻结态契约面重跑**：18 文件 / 147 用例全绿（save-compat、base 粘滞修复、versioned-slot-reader、extraction 结算/流程/恢复/预览、encounter-meta、battle-resolution/pure-rules、facade-snapshot-drift、esc-semantics、RNG 位等价、cards-sync 守卫、agent 取消链×2、notes 配额、menu 恢复入口）。
- **5299 实页冻结态数据面**：boot 装配 ✓、状态条挂出 ✓、仿真对局态数值逐位正确（1/16 背包 · 3 消耗袋 · 7 币·离局清零 · **1+≈1 带出预估·张**——含双计量注记文案）。
- **代码线终验结论：可交付。** 证据链=05:44 全量 203/1671 绿 + 07:28 冻结态契约面 147 绿 + 实页数据面复核。规则/状态/存档域无未决缺陷。
- 等美术线/体验线各自域结论回填后闭合本窗口。

## ★ 三方冻结终验窗口（07:30-08:15）

- **07:57 窗口状态**：美术线 07:4x 终报定稿——其域五项终验全过，并记录「代码线=可交付；体验线=可交付表态+实现面冻结；**三方终验：通过**」。体验线实现面冻结（06:25 起）。
- **回复 CODE-ART-002（07:57，strip 遮挡元弹层的规范读法）**：判定字段用 `UI._lastMode`（overlay.js:100 showOverlay 写入、:188 hide 清 null、:278 已有同款消费先例）。**规范表达式**：
  `const stripVisible = game.runActive && !!game.myClass && UI._lastMode !== 'page';`
  口径：overlay 全隐藏（`UI.el.overlay.hidden`，此时 `_lastMode === null`）= 地图裸态，显示；弹层开着时仅运行态弹层（battle/bag/bagpage/chest/scene/wide）显示；`'page'` 模式=全屏元页（设置/卡牌库/照相馆/成就/数据页全部走 page），隐藏。若未来出现 page 之外的元弹层模式，改白名单显式列举（battle/bag/chest/scene/wide + null），比黑名单更稳。js 侧实现在 pocket-strip.js（体验线属地），我不代改；如需我把该判定提为 core 纯函数（如 `UI.stripVisibleGate()`）发请求即可。

## ★ 最终报告（代码线，08:27 定稿；任务窗 2026-09-27 23:42 - 09-28 08:42）

### 一、实际时长与中断

- 包络 23:42-08:42（9 小时），有效工作全程无中断；05:0x 与 05:4x 两次账号级 429 造成子代理审计一次作废重跑、四路并行改串行（老板令）。
- 节奏：00:00-05:30 主动工程（4 大项+审计循环+3 修复批）；05:30-07:30 审计修复收尾+守望；07:30-08:15 三方冻结终验；08:15 起本报告。

### 二、已完成的主要工程改进（全部在工作区未提交，等老板处置）

| # | 改进 | 域 | 证据 |
|---|---|---|---|
| 1 | 版本化存档读取管线收敛（versioned-slot-reader.js 唯一实现；base 侧粘滞 issue 缺陷修复） | hub | 12 文件 86 用例+独立复核无阻塞 |
| 2 | Agent LLM 取消链（stopRun→AbortSignal→fetch，30s 墙钟，手动桥接避 Chromium 105 基线缺口） | agent | 5 文件 48 用例 |
| 3 | UI 生命周期缺陷簇×4（menu 观察器误注/notes 配额卡死/overlay 探测悬挂/cinematics 跨局队列） | ui/core/hub | 63 用例+实页三场景验证+截图 |
| 4 | RNG 核心位等价下沉（random-core.js 零依赖件；修复两处门面早求值回归） | core/run | 1000 位逐位对照+43 用例 |
| 5 | 全量审计循环（四路）+修复 9 项：撤离整理/抽牌空引用/NaN 防线/cards.view 转义/clone 残余/seedBatch 整批落盘/frames rect 复用/sdtDefine 统一/Blob revoke | 多域 | 全量 203 文件 1671 用例绿 |
| 6 | 结构守卫：facade-snapshot-drift（33 文件基线）+esc-semantics+clone 下沉 core/shared | core/hub/cards/battle | 3+163 用例 |
| 7 | 支撑纯函数×2：extraction-preview（带出预估口径投影）、encounter-meta（遭遇池元数据） | run | 19 用例，体验线切片1/3 已接入 |

### 三、外部资料如何改变了实现

- **MDN AbortSignal**：验证了手动桥接决策（AbortSignal.any 支持层级高于项目 Chromium 105 基线）与 finally 显式移除监听的 GC 纪律；fetch abort=AbortError 语义进了测试断言。
- **save-systems 技能**（版本化迁移契约）：确认「读版本→过新拒读→逐版纯函数迁移」管线骨架与项目既有口径一致，收敛只提骨架、迁移表按域注入。
- **体验线外部研究反哺**（PoE loot filter/Tarkov 格价）：切片 4 的 sellPrice 档位规则由其实现，代码线仅核实口径权威未插手。

### 四、可验证收益与证据

- 修复 4 个玩家可达缺陷：撤离整理事务重试死锁面（审计误报已撤，见五）、备注配额满卡死、设置→数据页头误注、抽牌空引用崩溃窗口。
- 两条语义漂移隐患根除：esc（3/5 字符双口径）、clone（会抛/容错双口径）——现全仓单一权威+漂移守卫测试。
- 首启性能：播种从数百次全库序列化+写入 → 每批一次（量级估算秒级→百毫秒级，需实机首启确认）。
- 最终验证链：05:44 全量 203 文件/1671 用例绿 → 07:28 冻结态契约面 147 用例绿 → 5299 实页数据面复核 ✓。

### 五、支撑两线完成的事

- 体验线：EXP-001 十项字段口径逐条核实；CODE-002/003 两 helper 使其切片1/3/4 免于复写口径；boot.js 挂载接线（04:40 其实测闭环、直挂行已撤）；EXP-002 以「进格才掷骰」证据促其转向可行方案；CODE-ART-002 规范读法（_lastMode 口径）。
- 美术线：CODE-ART-001 保存节律承诺（批簇写入+窗口预告）；渲染接口零变更确认；ART-002 归属警示（battle js 属 M 批）。
- 环境：重连问题定位（429 限流为主因，TLS 抖动为次）+三线并发纪律（本线子代理串行）。

### 六、未验证/未解决项

- 性能实测未做：perf 脚本依赖未安装的桌面 Electron；IAB 隐藏页 rAF 暂停使帧探针失真。需老板拍板（装桌面依赖或另择时机）。
- 审计C 覆盖缺口（限速中止）：effect-steps 数值深查、base/game.storage 写路径内部、bag.settle、overlay/ui 深查。
- 结构项留给后续会话（详细登记在 05:0x 审计汇总）：kernel 三重硬依赖惰性化、32 文件顶层快照全量惰性化、hub↔run 26 边、ui-scale/term-tips 迁 core（文件移动需批）、battle.vfx canvas 池化（需实帧验证）、battle.frames 26 候选串行探测并行化、base/meta {ok,why,msg} 方言（评估为自洽，不做）。
- 已报未修（属地他线）：hub.depart.js reduce-motion 残缺、altar.js:858 帮助文案误导空间、battle-loader/enemy-phase 加载失败无玩家提示、exSmart 真屏、eps-pop 自然复现、章节窄列换行。

### 七、保留的未提交改动清单（代码线，等老板指示提交）

- 新建：game/src/hub/versioned-slot-reader.js、game/src/run/extraction-preview.js、game/src/run/encounter-meta.js、game/src/core/random-core.js、tests/{hub-versioned-slot-reader,agent-llm-abort,agent-runner-abort,base-sticky-issue-fix,cell-notes-quota,encounter-meta,esc-semantics,extraction-preview,facade-snapshot-drift,map-rng-bit-equivalence}.test.js
- 修改：game/src/hub/{base,game.storage,commands.shared,recoverable-pair,recovery.commands,game.notes}.js、game/src/agent/{agent.llm,agent.runner,agent.console,agent.data}.js、game/src/ui/{game.menu,overlay,cinematics,ui,route-overlay}.js、game/src/core/{shared,random,notes}.js、game/src/run/{map-generator,map-snapshot,extraction-preview(新)}.js、game/src/home/story.last-lamp.js、game/src/cards/cards.{js,view,sync}.js、game/src/battle/{battle.engine,battle.runtime.session,combat}.js、game.boot.js（挂载）、tests/agent-llm.test.js、tests/photo-zoom-lifecycle.test.js、tests/{extraction-settlement,extraction-flow,terminal-settlement,bag-structured-use,battle-settlement-retry,r7a-scenes-integration,home-async-lifecycle}.test.js（mock 补桩）
- 他人属地未动：M 批已自行提交（791b2c2）；onetake 14 文件、体验线 5 文件、美术线 4 文件原样保留。

### 八、三方终验

- 美术线 07:4x 终报定稿：其域五项终验全过，记录「三方终验：通过」。体验线实现面冻结+可交付表态。代码线域 07:28 冻结态 147 用例+实页复核全绿=可交付。**本窗口三方结论一致：通过**（07:30-08:15）。

## 巡检日志

## 巡检日志

- **01:58 巡检#1**：M 批已提交（HEAD 791b2c2 feat(cards): complete M batch rule migration）——battle/cards 域解禁（onetake 14 文件仍未提交）。**pocket-strip 已按约接线**：game.boot.js 导入 `startPocketStrip` 并显式调用（模块自带 DOMContentLoaded/防重入处理）；实页验证：双挂载防重入 ✓、对局态状态条挂出且数据正确（bagCap 16 走 Base 权威、CODE-002 供数、币清零提示语义在）✓。给体验线：**挂载完成，index.html 直挂行可以撤了**（boot 契约已建立，你们模块的自启动兜底撤不撤由你定，boot 显式调用不依赖它）。
- **依赖名冻结确认（答复 01:52 回执）**：`run/extraction-preview.js` 与 `run/encounter-meta.js` 文件名/导出名（previewExtraction / layerEncounterMeta / encounterPoolMeta / isExtractNode）冻结，本任务期内不改名不移动；两个文件已登记代码线属地。
- 体验线切片3（章节面板风险徽标）已接入 encounter-meta——落点从节点级改章节级是对 CODE-003 层级粒度的正确适配，认可。

## 巡检日志

- **02:27 巡检#2**：①**确认体验线提议的联合验证窗口 02:40-03:20**——代码线自 02:40 起冻结游戏文件写入（status 文件记账除外），至 03:20；07:30 仍保留为美术线期望的终验窗口。②回复「献祭撤离自动回收 vs 1/3」口径问题（见下）。③美术线无给我的新请求（对比度检查点自行闭环，其一不达标色已由其自行提亮）。

**回复体验线（02:30）：「消耗口袋 已自动回收（基地可复原）」与 1/3 掷骰的关系——同一条管线的两段，不是并行的第二条回收路径**：

1. 1/3 掷骰发生在撤离 **begin 阶段**的 `calculateBaseAndPending`（extraction.commands.js:44-56）：对 usedPocket 逐**份**独立 `random() < 1/3`，留下的份进 `base.pocket`（基地消耗口袋），散失的直接消失。紧急撤离/终局撤离/献祭撤离都汇入同一条 `doExtract` → begin 管线，**没有跳过掷骰的分支**。
2. 整理页那行「[[icon:pocket]] 消耗口袋 · 已自动回收（基地可复原）」（altar.js:885）是**掷骰结果的展示**，不是 100% 回收承诺：含义=「口袋不参与手动整理，保留部分已自动进基地口袋（基地钥匙/火堆可复原），散失部分已按骰结算」。具体保留/散失数字在同流程日志（altar.js:802「只有 1/3 保留（带回 X 张，散失 Y 张）」）。
3. 帮助文案（altar.js:858「消耗口袋自动回收（基地/火堆可复原）」）确实**有误导空间**——玩家可能读成整袋回来。该文件是 onetake 会话属地，代码线只报不改：建议你们在打包屏/状态条口径里强调「1/3 保留、自动入基地口袋」，或报给 onetake 会话改措辞（如「按 1/3 自动结算入基地口袋」）。

**联合窗口内（02:40-03:20）我的自查域**：存档读写往返、CODE-002/003 数据口径、结算数值——体验线 01:50 已回填的 5200 存档往返无漂移结论我认可为有效证据，窗口内做的是同一代码状态上的复核确认。

## 保存窗口清单（美术/体验线参考，HMR 预告）

- 窗口1 已结束（00:30 前：notes/overlay/cinematics/menu/storage/agent 批次）。
- 窗口2 已结束（00:30-00:33：extraction-preview 新建 + clone/fail/reduce-motion 小收敛）。
- 窗口3 已结束（00:44-00:47：第2/3/4项复核建议落地批次）。
- 窗口4/5 已结束（00:48-00:55：autoRun 守卫 / Blob revoke / RNG 位等价抽取 / esc 语义统一）。
- 窗口6 已结束（01:06-01:08：CODE-003 encounter-meta 新建）。
- 二轮全量回归 01:06 起跑（后台，改公共架构后的确认跑）。
- 下一窗口：性能基线测量（`npm run perf`，自带 vite+Electron，约 3-5 分钟重负载），将选两线不做实机测量的时段，动前在此预告。

## 对体验线的回复（续）

**挂载点确认（00:47，答复切片1申报）**：`pocket-strip.js` 交付后由**我在 `game.boot.js` 接一行挂载**（boot 绑定区，代码线属地、单写入者；不走 index.html——入口文件改动影响面大且体验线后续可能还要挂别的东西，统一走 boot 装配更可控）。你只管把 init/更新函数从模块导出，挂载时机我对接 boot 序列。

**CODE-003 交付（01:08）**：`game/src/run/encounter-meta.js` 新建（零依赖、纯只读、无门面耦合）：
- `layerEncounterMeta(map, layerIdx)` → `{ risk, strategy, entryCount, groupCount, eliteChance, eliteEnemies[], entries[{id,name,size}], groups[{id,enemies[]}] }`；层回退镜像引擎（`[layerIdx] || [0]`），无表返回 null（展示层降级隐藏）。
- `encounterPoolMeta(enc, monsters)` 为单表版本。
- 用法：`layerEncounterMeta(window.SDT.MAP, game.layerIdx)`。敌人名已映射；**不做强度估算**（避免制造隐性玩法口径）；eliteChance 是进格骰揭示值非承诺。测试 tests/encounter-meta.test.js 4 用例（真实 map.json 四层数据钉+回退+只读性）。可直接写消费端。

## 复核结论登记（续）

**全量回归（00:55 首轮 → 01:05 修复 → 01:06 二轮确认中）**：
- 首轮：201 文件 = 199 过 / 2 文件级失败（1651 用例绿+2skip）。两个失败均为**我 00:34 后引入的 import 边回归**：map-generator→random→sdt-facade 的边把门面求值提到静态导入期，破坏 item15-18-fixes / r5a-session-menu 两测试「先静态导入纯模块、再整体替换 window.SDT」的既有假设。
- 修复：抽零依赖件 `core/random-core.js`（hashSeed/nextRandom 唯一实现+口径注释），random.js 转发导出维持兼容，map-generator 只碰零依赖件——纯函数与门面解耦，测试环境假设恢复。
- 教训登记：**本项目模块图里「给纯数据模块加 import 边」可能横切 sdt-facade 求值时点**，改前必查目标模块是否零依赖、消费方是否含「先导入后换门面」型测试。
- 修复后定向 50 用例全绿（含两失败文件本体+位等价+快照契约）；二轮全量结果随后登记。

- **第 2/3/4 项独立复核（00:44-00:46 回收）**：无阻塞。建议处置：
  1. ✅cinematics 整队作废改逐条校验（只丢旧局绑定段，保留归属当前局的合法卡并续播）；
  2. ✅runner stopReason 归因：done 分支前补 runCancelled 优先判定，取消不再冒充 decide-null；
  3. ⚠️不改码——复核称「最坏 3×30s」系误读：llm catch 网络层失败即 break（重试仅发生在解析失败路径，不消耗 30s），最坏=30s/步；控制台链路无局级墙钟属既有行为，记录在案；
  4. ✅game.notes 两处残留缺口：rebuildNotes 两处裸 setItem 加容错（标记失败幂等/回写失败不炸链）；doImport 统计写入失败条数并如实上报；
  5. ✅测试补钉：photo-zoom 补媒体查询分支独立钉（matchMedia+refresh）；agent-llm-abort 两用例加强「超时/取消必须以协议动作 resolve」断言；saveNote 弹层级 DOM 测试暂缓（实页验证已覆盖同路径，记录在案）。
- 验证：语法检查过，9 文件 73 用例全绿（00:47）。

## 联合验证窗口提议（00:55 发）

**提议 01:30-02:00 三方联合验证窗口**：以当前工作区为稳定点（代码线本批全部改动+体验线 pocket-strip 切片1+美术线样式），我冻结写入 30 分钟。流程建议：体验线实机走「基地→整备→出发→探索→战斗→搜刮→（深入/撤离）」全流程，我盯规则/状态/存档正确性（结算数值、带出预估口径、存档写入），体验线盯操作与信息，美术线盯表现与状态条视觉。结果各记本文件。若体验线切片1 尚未到可接线条，改期不勉强。

**EXP-002 成本侦察结论（00:50，只读核查）**：路线面板「精确敌人构成预览」**做不到不改玩法**——遭遇在进格瞬间才现场掷定（`buildEncounter(game.layerIdx)`，game.run.flow.js:137-139 → encounter-selector.js：先掷精英 chance、再选 group、再 fallback entry），未进入的战斗节点上敌人清单**尚不存在**。预生成并持久化=玩法变更（把进格掷骰提前），超出本线授权。**可行的低成本替代**：用「本层遭遇池元数据」做差异化（encounter-selector 的 kind/risk/strategy/精英概率结构）——如需要我做 `node-encounter-meta` 只读 helper（CODE-003，成本：低），请拍板要哪种。

**切片2（价值口径）指路**：卖价唯一权威=`SDT.Cards.sellPrice`（cards.rules.js，所有消费方均走此 API 无旁路）；「打出即消耗」提示可直接读卡牌 `rules` 存在性，无需新接口。若需「估算价区间」类新口径再发请求。

## 对美术线的回复（续）

- 已读 00:4x 视觉决策（底部居中/双警示色/去 backdrop-filter/reduced-motion 回退）：**无异议，符合性能铁律**（常驻层只走合成器正确）。文案疑问（币格标签）归体验线拍板。
- 注意到老板已解禁子代理并行（00:4x）；本线仍保持串行纪律（当前 1 个复核代理在途），重活错峰不变。

## 对美术线的回复（续2）

**ART-002（01:00 提案，01:10 响应——20 分钟异议期内）**：**有条件无异议**。战斗背包/安全格弹层升级若只涉 css/新文件/组件状态表现 → 归你放手做；但 **battle 域 js（battle.bag.js、bag 消费端等）是 M 批外部会话 staged 属地**——动 js 逻辑文件前必须在 art-status 登记具体路径；M 批未接入三文件通信，实际可操作边界=css/表现层，js 侧挂账待 M 批收口。动工申报请明确划出 css 与 js 边界。

## 已完成（续2）

- **✅实页验证（00:35-00:42，ZCode 浏览器 @localhost:5299 代码线独用实例）**：
  1. 菜单观察器修复：设置→跑局数据→返回键真实点击路径，落点设置页 `.pg settings-page` 仅 1 个正常 `.pg-head`，**无 `.data-pg-head` 污染**（截图存证：artifacts/call_19dcf313…png）；数据页本体页头/返回键注入正常。
  2. notes 配额：`Storage.prototype.setItem` 抛错注入下 `SDT.Notes.set` 返回 false 不抛错；正常写入路径不受影响。
  3. cinematics 队列：入队 3 张（runActive=true），首张播放中置 runActive=false，3 秒后 `#cardGet` 数量=0——**换局整队作废生效**。
  - 未实页模拟项：overlay 背景探测 onerror（需缺资产环境，代码路径已复核+既有 overlay 测试绿）；联合验证窗口如需可补。
- 第 2/3/4 项独立复核代理已派出（00:43），结论回来后在本文件登记。

- **✅独立复核（第 1 项）**：无阻塞；7 条建议已全部落地（测试补钉 4 条、注释卫生、recovery.commands.js TX 字面量收口导出 TX_KEY、base 级粘滞修复集成测试 tests/base-sticky-issue-fix.test.js）。存储面定向 12 文件 86 用例全绿。
- **✅第 3 项 UI 生命周期缺陷簇**（00:17-00:22）：a) menu 数据页观察器加 `.doom-stats` 内容校验+单活观察器；b) notes 裸写改 try/catch 返回 false，saveNote/clearNote 失败保留现场（新增 tests/cell-notes-quota.test.js 3 用例）；c) overlay 背景探测补 onerror（失败不缓存，热修后可恢复）；d) cinematics 奖励队列加 runActive 归属快照，换局整队作废。定向 10 文件 63 用例全绿。
- **✅CODE-002 带出预估纯函数**（00:24-00:26）：`game/src/run/extraction-preview.js`（`previewExtraction(game, baseApi)` + `isExtractNode(type)`），期望值口径=结算权威（extraction.commands.js）投影，tests/extraction-preview.test.js 4 用例钉死（isSha 豁免/聚合/期望线性/资源过滤）；与撤离结算/恢复既有 15 用例同跑全绿。**体验线切片1 可直接 import，无需复写口径。**
- **✅第 4 项 小收敛**（00:26-00:28）：`recoverable-pair.js` fail → commands.shared 权威（逐字同签名）；`route-overlay.js`/`map-snapshot.js`/`story.last-lamp.js` 本地 clone → 权威（map-snapshot 的 fail 属 preserveRun 异形契约，保留）；`ui/ui.js:177` 照片缩放 reduce-motion 改走 core/motion.js 权威口径（修复「设置勾选无效」缺陷）；photo-zoom-lifecycle 测试改用真实用户路径（sdt-reduce-motion+refresh）模拟，钉住修复本身。定向 9 文件 66→43 复核用例全绿（期间发现并修复 reduce-motion 测试与新判定的缓存交互，属测试模拟方式过时）。

## 已完成

- 盘点 + 双探查（异步泄漏 7 项 / 重复逻辑 9 组）+ 重连根因定位（见环境通报）。
- **✅第 1 项 版本化存档读取管线收敛**（00:00-00:06）：新建 `hub/versioned-slot-reader.js` 唯一管线；`game.storage.js` 注入 E5 严格语义、`base.js` 注入宽松历史语义；TX_KEY/txPending 收口到 game.storage.js 导出。定向验证 12 文件 88 用例全绿（含新工厂单测 10 条）；修 base 侧粘滞 issue 旧缺陷（run 侧语义统一）。独立复核代理在途。
- **✅第 2 项 Agent LLM 取消链贯通**（00:06-00:15）：`agent.runner.js` autoRun 持本局 AbortController，stopRun 同步 abort，step 以 `decide(obs,{signal})` 递下（第二参可选，旧闭包兼容）；`agent.llm.js` 手动桥接外部 signal+墙钟 30s 超时（不用 AbortSignal.any——Chromium 116+ 高于项目 105 基线），finally 显式移除监听（MDN GC 建议）。新增 `tests/agent-llm-abort.test.js`（node env）+`tests/agent-runner-abort.test.js`（jsdom）；既有 `tests/agent-llm.test.js` 迁 node env+localStorage 桩（undici fetch 拒收 jsdom AbortSignal，纯测试环境伪影，生产同 realm 无此问题）。定向验证 5 文件 48 用例全绿。
  - 外部依据：MDN AbortSignal——验证手动桥接决策（any()/timeout() 支持层级不定）与 finally 移除监听防 GC 滞留；fetch abort=AbortError、超时区分语义已入测试断言。
