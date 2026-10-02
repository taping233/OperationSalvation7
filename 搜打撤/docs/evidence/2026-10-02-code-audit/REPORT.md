# 全库冗余/性能审计报告（2026-10-02）

- **审计对象**：`搜打撤/game/src`（battle / hub / run / cards / core / ui / agent / home / 根级）与 `搜打撤/game/css`，共 10 个审计块、8 个域、**112 条 findings**。
- **数据来源**：各域子审计结果与 29 个文件的机器复核引用计数由工作流入参提供；本报告为汇编成文与分档，除文末 5 条抽验外未重新执行审计命令（未核实项见文末）。
- **行文约定**：finding 位置路径相对 `搜打撤/`；每条一行，五元组为 位置｜问题｜证据要点｜建议｜档位。
- **分档标准**：**A**=建议直接删/改（机器复核引用数为 0，或 risk low 且证据确凿）；**B**=需人工/老板复核（risk medium，含 1 条 risk high）；**C**=建议保留（定版口径/历史决策/证据不足）。

## 汇总

| 档位 | 条数 | 处置 | 预计可删行 |
|---|---|---|---|
| A | 74 | 直接删/改（动手前跑对应门禁留证） | ≈400 |
| B | 36 | 人工/老板复核通过后实施 | 另计 ≈450 |
| C | 2 | 保留（标注即可） | 0 |
| **合计** | **112** | — | — |

| 域 | 条数 | A | B | C |
|---|---|---|---|---|
| battle | 21 | 16 | 5 | 0 |
| hub | 17 | 8 | 9 | 0 |
| run | 15 | 9 | 6 | 0 |
| cards | 11 | 8 | 3 | 0 |
| core | 9 | 6 | 3 | 0 |
| ui | 10 | 7 | 3 | 0 |
| agent+home+根级 | 14 | 10 | 3 | 1 |
| css | 15 | 10 | 4 | 1 |

预计可删行口径：仅计物理消失行（摘 `export` 关键字、从导出名单删名不计数），按各条 evidence/suggestion 给出的行号区段与量级累加——cards 注释去重 200 行、css A 档死规则/遮蔽约 80 行、死函数/死块约 70 行、死导出行与名单收缩约 50 行。B 档 ≈450 行含 css 四大死簇约 149 行、`showBagCardDetail` 58 行、hub 双容器/熟练度三抄/返回键 SVG/两步确认/policy 双 BFS 等重复块合并净减。

## 机器复核引用计数（文件级）

29 个被复核文件全部非零、无复核失败（口径：0=确认零引用、-1=复核失败，两者均未出现）：

| 文件 | 命中 | 文件 | 命中 | 文件 | 命中 | 文件 | 命中 | 文件 | 命中 |
|---|---|---|---|---|---|---|---|---|---|
| battle.state.js | 8 | battle.layers.js | 8 | battle.preview.js | 5 | battle.piles.view.js | 3 | battle.enemy-phase.js | 8 |
| battle.hosted.js | 7 | effect-steps.js | 28 | battle.runtime.effects.js | 3 | game.storage.js | 13 | game.nest.js | 3 |
| game.run.data.js | 6 | game.session.kernel.js | 8 | cards.rules.js | 4 | cards.sync.m1.js | 6 | card-photo-notes.js | 2 |
| cards.sync.face-refresh.js | 3 | cards.sync.backfiller.js | 24 | renderer.primitives.js | 3 | art.js | 29 | renderer.fx.js | 4 |
| ui-scale.js | 11 | term-tips.js | 6 | quick-nav.js | 4 | feedback.local.js | 5 | agent.llm.js | 4 |
| agent.stats.js | 4 | scenes.css | 24 | winter.css | 75 | page-events.css | 8 | | |

**解读**：文件级复核未发现任何「整文件死文件」，也无复核失败——本次 112 条 findings 全部是文件内级别（死导出/死块/重复块/热点），与文件存活不矛盾，无一被引用计数推翻。因此 A 档判定全部落在「risk low 且证据确凿」分支。（计数由工作流入参提供，撰写时未重跑。）

---

## 1. battle —— 导出冗余专项（74 文件 / 约 14.8k 行）

口径：死文件 0、12 行精确重复窗口 0、僵尸监听/定时器 0（feedback 用 AbortController、layers 的 document keydown 为模块级一次性注册）；实峰为 13 条死导出——1 个完全死函数、2 组被契约白名单钉住的门面残留、10 条无契约 export 残留；判据为自建 import 图（静态/动态 import + re-export 链 + 命名空间属性回溯）+ 逐名 rg 三重搜索，r7a.qa/e6/intent-legend 等动态消费路径已逐一核实排除。

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/src/battle/core/combat.js:62`（定义）/`:508`（导出） | previewDamage 完全死函数：函数体+导出全库零调用 | `rg -w previewDamage`（game/tests/scripts）仅 3 处：:62 定义、:98 注释、:508 导出（撰写抽验证实，审计原文记注释为 :63 实为 :98）；UI 预览实际走 battle.preview.js previewAction 与 viewApi.getPreviewContext（battle.hover.js:6 导入）；battle-architecture.test.js:77 动态导入只用 addBlessing/tickDurations；注释自称「战斗界面显示最终数字时用」但战斗界面零引用 | 整函数删除（含 :508 导出名单中的名字），失真注释一并清理 | A |
| `game/src/battle/core/battle.engine.js:371` | 引擎门面 3 个零消费 re-export：snapshotSignature / swapCardCosts / addTempCard | 逐名 rg：外部命中仅 tests 端口 stub（battle-resolution.test.js:4、battle-selection-flow-boundary.test.js）与 facade 基线，引擎内部自用（:113 从 cardInspection 解构、:119 起多处、swapCardCosts 经 selection-flow 端口注入）；snapshotSignature 仅内部 :297/:308；e6 动态命名空间只覆盖 resolveCard/matchHandSelectKey/findCard（e6-card-rules-execution.test.js:101-102,175）；tests/battle-engine-facade.test.js:8-37 将 65 名导出面逐字钉死（增删任何导出名即红灯） | 按治理批次 3 显式流程同步更新 BASELINE_EXPORTS 基线后从 :371 删三名 | B |
| `game/src/battle/core/battle.core.js:426-427` | core 门面 4 个零消费导出：裸名 start/serialize/restore 与别名 matchHandSelectKey | 全库 30+ 条 import/destructure 消费点无人取四名；SDT.Battle 经 `{ ...BattleSession }` spread 注册（battle.view.js:633），start/serialize/restore 运行时消费全走 BattleSession 捆绑（run/game.session.js:175 SDT.Battle.serialize）；battle.view.js:18 具名导入不含四者；battle-esc-ime-guard.test.js 的 core 命名空间仅用 getSnapshot/commands；viewApi.matchHandSelectKey 全库零命中 | 从 :426/:427 导出行删四名（函数本体与 viewApi/BattleSession 捆绑保留）；:424 注释自称「viewApi 原样保留给既有消费方与测试」，删前顺带核对定版口径 | A |
| `game/src/battle/runtime/battle.runtime.session.js:17`（tmpSeq）+ `battle.runtime.presentation.js:5`（presentationActionSeq） | 两个只写不读的导出 let：绑定全库无任何读者 | 逐名 rg：生产代码仅声明与写点（nextTmpSeq/nextActionSeq 自增自返、resetBattlePresentation 清零）；唯一外部引用是 tests/battle-runtime-state-guard.test.js:23/:48 的 90 字段 export-let 治理白名单；快照序列化不含这两字段 | 维持 state-guard 白名单口径则保留现状；瘦身须同步更新白名单（session 18/presentation 7）并在 PENDING 记录口径变更 | B |
| `game/src/battle/runtime/battle.state.js:55` | ALLOWED_TRANSITIONS 与 canTransition 死导出（仅文件内自用） | rg -w：ALLOWED_TRANSITIONS 仅 :13（canTransition 内）、canTransition 仅 :35（transitionBattle 内）；game/src 与 tests 零外部引用；battle.aim.js:35 只导入 BATTLE_PHASES | 去掉 export 关键字（:55 导出行删两名），函数保留 | A |
| `game/src/battle/view/battle.layers.js:732` | handLayer 与 battleToken 死导出（仅文件内自用） | handLayer 全部命中在文件内部（:74 起键盘选牌等）；battleToken 命中皆为快照字段读法（battle.aim.js 的 snap.battleToken、e2.snapshot.qa.js:54 字面量键）非本模块导出绑定；零 import 消费 | 从 :732 导出行删两名，变量保留 | A |
| `game/src/battle/view/battle.preview.js:195` | normalizeDesc 与 semanticMatch 死导出（仅文件内自用） | normalizeDesc 仅 :24、semanticMatch 仅 :67 内部调用 + :195 导出行；tests 与 game/src 零外部引用 | 去掉 :195 导出行的两名 | A |
| `game/src/battle/view/battle.piles.view.js:31` | renderPileBadge 死导出（仅文件内自用） | 本文件内 5+ 处调用（:17/:19/:3 等），零外部引用；battle.view.js:15 只导入 renderCombatPiles | 去掉 :31 导出行的 renderPileBadge | A |
| `game/src/battle/core/battle.enemy-phase.js:461` | afterEnemies 死导出（仅文件内自用） | 仅本文件 :275 `await afterEnemies(...)` 内部调用 + 定义；battle.core.js:161 为注释提及；endTurn/surrender 经 battle.core.js:16 导入消费，afterEnemies 无人导入 | 从 :461 导出行删 afterEnemies | A |
| `game/src/battle/effects/battle.hosted.js:8` | HOSTED_EXECUTION_CARD_IDS 死导出（HOSTED_CARD_RULES 的别名导出，仅内部用） | 仅 :23 内部使用（getHostedExecutionCard 内查表）；零外部引用 | 删除 :8 别名导出，:23 改用 HOSTED_CARD_RULES | A |
| `game/src/battle/effects/effect-steps.js:44`（createEffectSteps）+ `:39`（POOL_NUM_MAP/parsePoolNoun re-export）+ `game/src/battle/effects/battle.effects.js:66` | effect-steps 门面残留：createEffectSteps 死导出 + POOL_NUM_MAP/parsePoolNoun 双层 re-export 零消费 | createEffectSteps 仅 :73（createEffectPipeline 内）使用；POOL_NUM_MAP 真实消费走 s 端口解构（effect-steps.deck.js:4）而非 import，:39 re-export 零 import 命中；battle.effects.js:66 的 parsePoolNoun re-export 全库零命中（cards 域命中皆为注释） | 去掉 createEffectSteps 的 export 与 :39/:66 两处 re-export 名（ctx 模块内部实现保留） | A |
| `game/src/battle/runtime/battle.runtime.effects.js:86` | resetRuneFlags 死导出（仅文件内自用） | 仅本文件 :86 定义、:116 内部调用；tests/battle-runtime-state-guard.test.js:80/:84 仅注释提及（白名单管的是 export let 不含函数） | 去掉 export 关键字（与 PENDING #30 set$ 双轨口径无关，属函数导出残留） | A |
| `game/src/battle/view/battle.view.js:655` | render 死导出（battle.view.js 全库零静态导入方） | `from '.*battle/view/battle.view.js'` 零命中；模块仅经 battle-loader.js:44 / r7a.qa.js:12 / e2.snapshot.qa.js:56 动态 side-effect 加载；render 仅内部使用（configureBattleRenderer 注册渲染器），SDT 注册走 :633 的 BattleSession spread | 去掉 :655 的 `export { render }`（render 本体保留） | A |

## 2. battle —— 全量只读走读（74 文件，73 js + 1 d.ts）

口径：经 09-30 性能审计（F1/F3/F4/F5/F9 已落库）后未发现真热点、泄漏或无界增长；**本块未跑运行时 profile（只读口径），量级均为静态推算并如实标注**。剩余 8 条：4 条冗余双轨 + 4 条渲染路径重复计算。

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/src/battle/core/battle.enemy-phase.js:320-335` | _stealRestore 归还管线双轨：第二轨绕过 turn 门；当前卡数据下不可达，duration≥2 引入后会被当回合提前归还 | 第一轨 :322-327 带 `turn > (foe._stealRestoreTurn || 0)` 门，第二轨 :331-334 无门直接加回+清账；唯一写入方 effect-steps.m2.js:110-113（`_stealRestoreTurn = getTurn() + duration - 2`）；rg 验证当前仅两张 stealAtk 卡且 duration 均缺省 1（cards.sync.m3.js:97 tt3sp-shadowbug、cards.sync.m5.js:98 禁咒I）→ 第一轨恒命中、第二轨恒不可达；两段注释分别引 09-16 与 09-09 历史留言，系旧路径合并未去重 | 合并为单一归还门（保留 turn 门语义）；删第二轨当前数据下零行为差，但需 owner 复核是否刻意保留「与 1 回合攻强化同期还原」旧口径 | B |
| `game/src/battle/effects/effect-steps.m2.js:20-27` + `game/src/battle/effects/battle.card-inspection.js:6-14` | 7 诅咒识别正则表（bleed/poison/burn/freeze/silence/abreak/healban）两处逐字双份，新增措辞只改一处即两路径识别面漂移 | 两处 7 条目 pattern 与 def 逐一相同（freeze/abreak/healban 均同文同缺省层数）；同仓已有单源先例 hand-cost-patterns.js（预检与执行共用一张表） | 仿 hand-cost-patterns.js 收敛为单一登记点，两路径同源导入；合并后跑全卡审计确认两路径 did/层数不变 | B |
| `game/src/battle/view/battle.overlays.js:58-83` 与 `89-114` | renderGrave 与 renderDeckPileView 约 25 行近似重复 | byType 统计 + byName 按 cardIdentityKey 堆叠 + bt-gy-row listHTML 模板 + showOverlay 骨架三段完全同文（:60-75 vs :91-106），仅标题/说明串不同 | 抽公共 buildPileListHTML(snapshot 字段, 文案) 一处；纯机械搬迁零行为差 | A |
| `game/src/battle/view/battle.view.js:81-85` + `game/src/battle/view/battle.layers.js:173,327` + `game/src/battle/core/battle.engine.js:881-884` | 每次战斗渲染手牌可玩性/费用整手双算：壳层 combatStateCopy 与手牌层 handGroupState 各自调 unplayableReason，内部又 hand.map(findCard) 全手扫——O(hand²) 次 findCard/渲染 ×2 处，effCostOf 每叠也算两遍 | view.js:83（some 遍历全手）、layers.js:173（每分组/渲染）、engine.js:882（每次调用 O(hand) findCard）、card-inspection.js:35（线性扫 ownedCards+granted）；渲染经 rAF 合帧，hand≤10，绝对成本微秒级、非热点 | 渲染入口一次算好 per-uid {unplayableReason, effCost} 传入 ctx 复用（handGroupState 已有 ctx 通道），删壳层重复遍历；行为等价纯上提 | A |
| `game/src/battle/view/battle.layers.js:669-670` | updateFoes 的 foes.forEach 循环体内每敌人重复两次 findCard（pendingTarget 与 clickSelectedUid 对全体敌人同结果），可上提循环外 | :669-670 位于 :615 `foes.forEach` 体内；updateSelfUnit :560-561 也各算一次，3 敌时一帧 8 次同参 findCard | 上提至 updateFoes/updateUnits 开头算一次挂 ctx；纯机械 | A |
| `game/src/battle/view/battle.view.js:306-314` + `game/src/battle/view/battle.piles.view.js:25-27` + `game/src/battle/core/battle.core.js:141-152` | BOSS 战每次渲染对牌库/弃牌/墓地三堆全量重建 tooltip 文本：pileTip 每 uid findCard 线性扫全收藏，结果只随牌堆簿记变化却被逐帧重算 | view.js 每次 render 调 renderCombatPiles；piles.view.js boss 分支三堆各调一次 pileTip；battle.core.js:143-150 逐 uid findCard；满编局三堆约 40-60 uid × 收藏数/渲染，rAF 合帧下微秒级 | pileTip 文本按 uid 数组签名键缓存或下沉快照组装；量级小，排期充裕再做 | A |
| `game/src/battle/core/battle.engine.js:1114-1132` | hitFoe 每段命中重建 statusForHit 浅拷贝并对 card.desc 跑 4 组正则（受法伤翻倍/对冰冻/流血翻倍/装备 vsFreeze），多段卡（连射/万剑 10+ 段）逐段重复同一不可变输入的计算 | :1116-1118 `Object.assign({}, pstat.status, {spellUp:0})`；:1115/:1120 正则匹配 String(card.desc)；:1123-1129 equipped 循环；事件驱动非逐帧，绝对成本低，改则牵动伤害口径 | 可在 resolveCardSteps 每卡入口算一次缓存传入 hitFoe；收益小且伤害口径敏感，建议仅实测命中热卡掉帧时再做 | B |
| `game/src/battle/core/battle.engine.js:97-100` vs `game/src/battle/view/battle.overlays.js:15-17` vs `game/src/battle/core/battle.hand.js:5-7` | 卡身份键逻辑三处同式实现：engine.cardIdentity 与 overlays.cardIdentityKey 逐字等价，hand.stackKey 为加 cost 第三变体 | engine.js:98-99 与 overlays.js:16-17 同文（id 优先、legacy 用 name/type/desc 拼接）；hand.js:6-7 stackKey 为 `id:...|cost|desc` 变体，cost 语义不同不可直接合并 | cardIdentity/cardIdentityKey 收敛单源导出（hand.stackKey 注明差异保留）；纯机械 | A |

## 3. hub —— 存量冗余（48 文件，46 js + 2 d.ts，约 9k 行）

口径：无死文件（45 个 js 模块均有真实 import，import 语句级精确检索验证）、hub 内零未使用导入；约 120 个导出名经「静态 import / 动态 import() / 字符串」三重检索坐实 13 个死导出（分 3 条上报）、僵尸 UI.act 坐实 2 个，另有 1 个 selftest 正则续命函数与 4 组 ≥10 行重复块；deployPick 门面转出、CARD_DESIGNER_WRITES_ENABLED 等契约测试锚定的转出面按定版口径未计入。

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/src/hub/extraction.commands.js:42-50`；`game/src/hub/battle-victory-progress.js:35-48`；`game/src/hub/base-meta.commands.js:24-46` | 「characterFor 解析→characters/classes 回退→缺省→addXpToProgress/applyXpGain→写回」的职业熟练度推进块抄了三份 | :44-49 / :38-47 / :28-44 三处同构（extraction 走 addXpToProgress 规范化入口，另两处走 applyXpGain，battle-victory 多 migrateCharacterProgress） | 在 meta-progression.js 上提 resolveProgressEntry(draft, cls) 公共纯函数供三处调用；保留两种写回入口差异 | B |
| `game/src/hub/game.bag.js:352-414,419-492`；`game/src/hub/game.bag.drag.js:170-194` | 珍珠盒/法师锦囊双容器 UI 整体同构（openPouchStore vs openPearlStore），且「拖入」与「点击存入」两路各自手抄同一套容量+stored 标记+入库逻辑 | bag.js:358-366 与 :426-434 storedStacks 近逐字（仅过滤谓词不同）；bag.drag.js:179-190 与 bag.js:422-465 同为 boxes*9 容量、storedN 过滤、uids.forEach 置 stored=1、sfx('gain')+saveGame+刷新，仅日志文案不同 | 抽 makeContainerStore({storedPred, bagPred, cap}) 容器工厂与共享 pearlPut(stack) 入口，拖拽路与点击路共用 | B |
| `game/src/hub/game.bag.rules.js:39-53,54-61`；`game/src/hub/game.bag.js:41-57,108-118` | 背包道具双轨：结构化规则消费器已实装 heal/restoreConsumed/classAbility，bag.js 仍保留同逻辑硬编码分支 | bag.js:45-54 与 rules.js:43-52「复原消耗口袋 N 张」while 循环+剩余计数+满提示 13 行同构（上限 3 vs operation.amount）；bag.js:109-117 与 rules.js:55-60 classPool 觉醒取卡同构 | 待 data/ 侧对应卡牌补齐 rules.bag 后删硬编码分支；属 cards.sync 同类双轨过渡，若已定版保留请并入已知口径 | B |
| `game/src/hub/game.bag.js:291-348` | showBagCardDetail 整函数挂空：#27 改版后唯一入口已由 inspectStack 特写承担，仅靠 selftest 源码正则续命 | :291 eslint-disable 自述「被 game/selftest.js:87 源码正则锚定，删除会挂红自检……历史保留」；showBackpack 内已无任何调用点 | 删除函数并同步收紧 game/selftest.js:87 锚定正则（涉 hub 外一处 selftest，需随改动一并验证） | B |
| `game/src/hub/game.hub.pages.js:337-347,352-362`（另 248-257,382-405 同型） | openStashItem 内三组 one/all 成对助手同构，collectOne/collectAll 两段 10 行近逐字（仅数量与文案不同） | 两段主体同为 readBase→convertCollection→Sfx.ding→UI.log→renderHub，仅 count:1 vs n 与日志差异 | 抽 convertStash(stack, n, logText) 共享体，sell/use 两对同理合并包装 | A |
| `game/src/hub/game.storage.js:234`；`game.store.js:95`；`collection.commands.js:224-227`；`preparation.sources.js:3`；`preparation.commands.js:136`；`meta.js:332` | 7 个仅内部使用/零消费死导出：OLD_SAVE_KEY、createGameState、createCollectionCommands、SOURCE_EVIDENCE、PRESET_IDS、DEFAULT_PRESETS、SDT | 全库三重搜索（静态/动态/字符串，含 tests/scripts/index.html）：各名仅定义文件内部命中；docs/M02 自称留测试用但无测试引用；meta.js 的 `export { SDT }` 无 importer 按名取用（测试走 window.SDT.Meta） | 各文件 export 列表移除这 7 名（本体保留），纯机械零行为差 | A |
| `game/src/hub/game.hub.depart.js:363`；`game/src/hub/game.hub.pages.js:657` | 切片内部函数无效导出 4 名：renderDepartPrep、deploySlotsUsed、hubPetsHTML、collRoomHTML | rg -w 全库：外部命中仅 tests/hub-architecture.test.js:30-32 的「壳内不得定义」源码断言（非导出契约）；壳 game.hub.js:17-18 import 清单不含四名 | 从两文件 export 语句移除四名；架构测试锁的是 SHELL 源码非导出面，删除不挂红 | A |
| `game/src/hub/game.bag.drag.js:211`；`game/src/hub/game.cardslib.common.js:48`（含 `game.cardslib.js:91` 门面转出） | 经对象桥/内部消费的函数仍带无效 export：bindBagDrag（消费全走 bagSlots 桥）、navigation（全库零 import） | bindBagDrag 唯一消费链 :209 `bagSlots.bindBagDrag = bindBagDrag` → bag.js:724，无模块按名 import；bag-architecture.test.js:60 只锚桥注册行；navigation import 行扫描零命中，card-library-lazy-boundary.test.js:24 仅锚 CARD_DESIGNER_WRITES_ENABLED | 去掉 export 关键字与门面 export 行中的 navigation；bindBagDrag 改模块内函数 | A |
| `game/src/hub/game.hub.js:255`；`game/src/hub/game.hub.depart.js:243` | 僵尸 UI.act 注册×2：upSafe、pickSub 全库无任何 data-act emitter | 脚本对 hub 全部 109 个 UI.act 注册名做全库 emitter 交叉核对，仅这两名零命中；upSafe 行尾注释自认「保险升级已改为宠物升级」（撰写抽验证实仅此一处）；pickSub 的 subPick 仍被 bagZoomRemove 内部调用（:267） | 删 game.hub.js:255 一行；game.hub.depart.js:243 删注册但保留 subPick 函数本体 | A |
| `game/src/hub/game.cardslib.page.js:390,413` | renderLibGrid 内 stopLibTileObserver 同一调用周期执行两次（函数首行 + if(grid) 块内首行） | :390 首行与 :412-413 两次调用之间无任何 observeLibTiles/重建观察者语句，第二次必为空操作 | 删行 413 的重复调用 | A |

## 4. hub —— 存档管线与渲染性能（48 个 js 逐文件读毕）

口径：性能主发现集中在存档管线热路径（readIdentity 重复 parse、每步走格全档双序列化、_m01.requests 无界增长），其次收藏池重复 filter 与整备页 pointermove 未合帧；冗余仅 8 个多余 export 名（4 个三重零命中、4 个 test-only 守卫）；无死文件、无僵尸监听/定时器（settlements WeakMap 随 opts 回收、bagTiltBound 单绑、photo-fps/art-warm 观察器均有收口）。**已读码+全库搜索定性，未做浏览器运行时 profiling（本环境无内置浏览器会话），绝对量级未实测，修复前建议先按 suggestion 口径测量。**

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/src/hub/game.storage.js:150` | RunStorage.readIdentity 每次全量 getItem+JSON.parse 对局档，不走同文件 reader 指纹缓存，战后结算链一次胜利最多重复 parse 13 次 | :154 绕过 versioned-slot-reader.js:58 带指纹缓存的 parse；battle-settlement.commands.js 11 处调用点（readReceipt 4+createAttempt 5+commitAttempt 4）；bag.settle.js:53 sameRun() 每次重查；对照 write 侧同款问题已修（:172-173 F5 注释），:38 注释自证对局存档大 | readIdentity 纳入 versioned-slot-reader 指纹缓存（写穿透 poke 已有），或结算事务内传递 identity 复用 | B |
| `game/src/run/game.run.flow.js:72` | 每步棋盘走格触发全基地档 clone（双序列化）+retainUnchanged 全档遍历+再次全量 stringify 同步落盘 | track→recordEvent→persistProgress（base-meta.commands.js:64）→commitBaseMutation（base-mutation.js:32 clone=JSON.parse(JSON.stringify)，:38 深遍历）+base.js:144 setItem；走格是局内最高频动作，成本随基地档体积（含 _m01.requests）线性增长 | action/kill 等纯计数事件改内存 checkpoint 合帧批量落盘（同 playSeconds checkpoint 家族口径） | B |
| `game/src/hub/base.commands.js:107` | _m01.requests 幂等收据表只增不删、无界增长，并放大每一次全档序列化（含每步走格落盘） | :107 与 recovery.commands.js:155 均追加完整收据深拷贝；全库 `delete/reset requests` 仅命中 base-state.js:108 形状兜底，无业务修剪；base.js:143 每次 save 全量浅拷贝该表（risk high） | 定版修剪策略（按 revision/时间窗仅留近期收据）后实施，需先确认旧 requestId 重放契约可收敛 | B |
| `game/src/hub/meta.js:190` | collectPool 无 memo，syncCollXp 对每个收藏 id 重复全卡库 filter（O(收藏数×卡库)），每次 checkUnlocks（每杀敌/每步行动/进基地）重跑 | :190 位于 :188 逐 id 过滤内；collectPool()=meta.js:104 每次 SDT.Cards.all().filter 全库重建（约 270 卡）；ach 页单次渲染约 7 次全库 filter（game.hub.pages.js:526-531,611-612），renderHub 头部 pendingColl 再加 5 次 | collectPool 加模块级 memo（Cards upsert/remove 失效），syncCollXp 先建一次 id→card Map 再查 | B |
| `game/src/hub/game.hub.depart.js:275` | 出发整备页卡池 pointermove 光斑未合帧：每 move 事件 closest+getBoundingClientRect 读写交替+2 次 CSS 变量写入，高 report-rate 鼠标下每秒数百次强制布局失效 | :275-281 逐事件执行；同库同模式已按 F2 口径合帧并留实测注释（game.bag.drag.js:111-121「125-1000Hz 设备每秒数百次强制命中测试」） | 套用 onBagDragMove 同款 rAF 合帧（只采样坐标，每显示帧一次读写） | A |
| `game/src/hub/preparation.commands.js:136` | 4 个导出名全库三重搜索零外部引用：PRESET_IDS、DEFAULT_PRESETS、createCollectionCommands、createGameState（与 §3 第 6 条部分重叠，销账勿重复计数） | rg 词边界全库+import 语句精确+字符串/动态引用三重均零命中，仅定义文件自用（:4-8,39-44,109 / collection.commands.js:94,220 / game.store.js:9,48） | 删除这 4 处 export 关键字（函数本体保留） | A |
| `game/src/hub/game.hub.pages.js:657` | hubPetsHTML、collRoomHTML、deploySlotsUsed、renderDepartPrep 导出面生产零消费，唯一引用方是架构守卫测试按名断言 | 生产 import 零命中；全库唯一命中 tests/hub-architecture.test.js:30-32 字符串数组导出面守卫；函数本体同文件内被调用（活代码），仅 export 关键字为守卫保留（与 §3 第 7 条同组名单） | 与守卫测试口径一起评估收敛（改源码正则锚定或移除导出）；现状属受控模式不急于动 | B |

## 5. run（26 文件 6014 行全读）

口径：全部可疑导出经 import/动态引用/字符串三重全库搜索验证；无双死文件（chests/nest 经 main.js:35,39 副作用加载）、无僵尸监听与无界增长新发现（eventLog 已封顶 200、shopStocks/_preloaded 有界、UI.act 覆盖式注册）；11 项死导出/影子数据 + 3 项性能；已排除已知口径（F1/F3/F8/F11/F12、set$、cards-sync 双版本卡）。

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/src/run/game.session.js:141-145`（配 map-snapshot.js:60,129、hub/game.storage.js:186） | 单次 saveGame 对同一份地图快照至少 4 次 stringify + 2 次 parse，全部同步主线程，每次移动落格/节点结算都触发 | map-snapshot.js:60 stringify 全量、:129 clone round-trip 返回；game.session.js:141-145 createMapSnapshot 后紧接再跑一次 validateMapSnapshot；RunStorage.write:186 第 5 次全量 stringify；快照上限 300KB（map-snapshot.js:63） | 把 position 校验并入 createMapSnapshot（或 :145 改轻量 layerIdx/trackPos 索引范围检查），消掉第二次全量 validate+clone | B |
| `game/src/run/game.run.data.js:13,44,46`（对照 `game.run.altar.js:15-21`） | CLASS_STORY 双版本并存：data.js 数据外置版全库零 import 成影子数据源，选角页实际渲染用 altar 硬编码本地版——改一处不改另一处必然漂移 | rg CLASS_STORY：data.js 仅定义/freeze/export；altar.js:15-21 定义本地版并经 :140 渲染消费；data.js 版三重搜索零命中 | 二选一定权威：删 data.js 版，或 altar.js 改 import 数据版（后者才是 09-11 数据外置批次初衷）；需老板定版权威口径 | B |
| `game/src/run/game.session.js:406,559`（源 ui/game.menu.js:895,1094） | quitGame 三跳死链：menu 定义→menu 返回面→session 解构→session 转发导出，全库零消费 | rg `\.quitGame` 全库零命中（撰写抽验证实）；session 48 个具名 import 子句无 quitGame；menu 定义与返回之间无调用点 | 整链删除（menu 定义+返回面、session 解构与转发导出） | B |
| `game/src/run/chests.js:427` | `export { G, SDT, UI, render }` 中 G/UI/render 三重搜索零命中；G 是 open() 运行时注入的可变模块态（导出即语义陷阱），render 外部消费全走 sdtDefine 的 SDT.Chests 面 | 全库唯一 import 形态是 3 处测试 `const { SDT: chestFacade } = await import(...)`（chest-click-flow/pet-egg-chest/nightshift-u10），均只取 SDT；`.G`/chestFacade.render/UI 零命中 | 收窄为 `export { SDT }`（保测试契约），或测试改走 sdt-facade 后删整行 | A |
| `game/src/run/game.nest.js:86-97` | unlockNest 死导出：游戏侧零调用、sdtDefine('Nest') 面不含、tests 两处仅 vi.mock 占位（非消费） | rg 仅定义处 + extraction-flow.test.js:33、extraction-settlement.test.js:32 的 vi.mock；boot-order.js:17/main.js:39 侧载本模块但不调；unlockNestLegacy 在 base-progression 另有活链 | 删前先与 09-24 定版口径复核（注释自称「兼容旧解锁入口……保留零钥匙调用语义」）；口径过期则连函数体一并删 | B |
| `game/src/run/game.nest.js:647-651` | craftRainbow 死导出且是半成品 stub：不读 baseRune、不写任何状态，直接拼 custom 史诗符文对象返回；全库零调用、不在 sdtDefine 面 | rg 仅命中定义处（docs/evidence 快照副本除外）；参数 baseRune 函数体内未引用（:650 直接 return） | 删除；若彩虹符文仍在路线图，挂账 backlog 重新实现而非留死代码 | A |
| `game/src/run/game.session.js:554,556` | 兼容转发面两个死项：FX（消费方全走 SDT.FX，kernel.js:17 定义后 kernel 内部也无使用）、canAcceptCard（外部消费全走 bag.js:75 挂载或直引） | session 48 个具名 import 子句无二者；`session.FX`/`session.canAcceptCard` 零命中；`.canAcceptCard` 命中均为 game.canAcceptCard（bag.js:144、run.shop.js:369、run.scenes.js:274） | :554 删 FX、:556 删 canAcceptCard（kernel 的 FX 定义本体与 bag 导出不动，bag.js:32 仍自引 canAcceptCard） | A |
| `game/src/run/game.run.data.js:9,42,46` | SCENE_META 死导出：从 DATA.scenes.sceneMeta 读入、freeze 并导出，全库零 import（EVENT_SCENE_META 才是活的） | rg SCENE_META：仅 data.js 定义/freeze/export；narrative.test.js 用的是 EVENT_SCENE_META；import 子句无 SCENE_META | 从 :46 导出面删 SCENE_META（本地 const 与 freeze 可留作数据装载一致性） | A |
| `game/src/run/map-snapshot.js:9-10,179` | SNAPSHOT_VERSION / ROUTE_SNAPSHOT_VERSION 导出零命中：内部 const 活（:46,61,63 用），export 行纯冗余 | rg（排除 docs）除自身零命中；对照 hydrateMapSnapshot 有 tests/r5a-map-snapshot.test.js:11 活引用，证明搜索有效 | 删 :179 导出行 | A |
| `game/src/run/map-graph.js:81` | buildAdjacency 导出零命中：仅被同文件 checkConnectivity:64 内部调用 | rg 仅 :27 定义、:64 调用、:81 导出；外部（含 tests）零命中 | 去掉 export（模块内函数保留） | A |
| `game/src/run/game.run.scenes.js:48,69` | preloadScene / preloadSceneList 导出零命中：仅被本文件 preloadCellScene:64 与 preloadAllNodeShellBgs:80 内部调用；对外生效入口是 preloadCellScene / preloadAllNodeShellBgs | rg 全部命中在本文件内部（6 处）无任何 import；flow.js:45、altar.js:81 消费的是对外入口 | 两函数去 export 关键字 | A |
| `game/src/run/game.run.shop.js:441` | createShopController 返回对象暴露的 generateShopStock 无消费者：唯一调用方 scenes.js:25 只解构 openShop；函数本体活、返回面冗余 | rg：定义 :25、内部调用 :93,:96、返回 :441；scenes.js 解构处无它，tests 零命中 | 返回对象改为 `{ openShop }` | A |
| `game/src/run/game.session.kernel.js:45` | store 死导出：GameStore 实例仅 kernel 内部使用（:46 store.state、:47 getSnapshot），对外消费面是 game 单例 | import 子句与 `session.store` 属性访问搜索零命中；store 其余命中均为 GameStore/game.store/RunStorage 等异名 | 去 export 关键字（模块内 const 保留） | A |
| `game/src/run/game.session.bag.js:16-17,33-54`（消费端 ui/hud.js:124-125） | 每次 UI.refresh 无条件重算背包容量：usedSlots()+bagCap() → cardStacks(false) 全量遍历 ownedCards 重建 Map + uids.slice 逐堆分配 + pearlBonus() 再 filter 全量；_lastBagKey 只缓存 DOM 写入，计算无 memo | hud.js:124-125 每次刷新调用；bag.js:54→cardStacks 每次 new Map；UI.refresh 调用点 run 侧 40+ 处（altar 18/flow 14 等），一局数百次 | 给 usedSlots/bagCap 加按 ownedCards 引用+长度失效的 memo（同 pocket-strip.js:34-40 的 F12 手法），或 hud 侧传上次值短路 | B |
| `game/src/run/expedition.view.js:74-88` | renderExpeditionPanel（挂 UI.refresh，非战斗每次刷新必跑）先全量构建 routes 对象数组（NODE_INFO 查询/routePlan 判定/字符串拼接）再算 diff-key，而 key 只由 idx 序列组成——key 命中时 routes 构建全白烧 | :74-75 先行构建，:87 才算 key；ariaLabel/name/hint 拼接全在 expeditionRoutes 内（:19-26,38）；F8 已把 stringify 换原始值拼接但对象构建无法被 key 短路 | 先算轻量 key（disabled + objective.text + 邻接 idx 序列可不经 expeditionRoutes 取得）再决定是否构建，未命中直接 return | B |

## 6. cards（26 文件逐个读毕）

口径：最大冗余是 hosted 注册表 61 条同数据四处手写（漂移即迁移运行时被拒）；另有 1 处恒空死循环、1 个死数据键、11 个死导出、双写常量、200 行搬迁双写注释；性能两处小热点均为轻微级——M 批回填链已 marker 门控、渲染已有 cardHTMLMemo，无每帧级热点；已知口径（ensureXxx 模板/同名双版卡/生成产物）未重复上报。

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/src/cards/card-rules.schema.js:4-35` | hosted 注册表同数据四处手写：schema 61 条 = m9(26)+m10(11)+m11(22) 并集（59 条）+ m10 已迁 2 条，逐键值完全一致；任一侧手改漂移即运行时 capability 拒绝、迁移失败 | node diff 实测「仅 schema 有 [tt3-master-staff, tt3-twinwater-mail]，其余一致」；四处各存一份 id→hosted 映射；capability.js:118-119 以 schema 表为迁移门槛、backfiller.js:114-124 以批内 map 写数据 | 单源化：schema 的 HOSTED_CARD_RULES 由三张批内导出 map 并集派生（或反向 M 批从 schema 切片取数），消四处手写同步 | B |
| `game/src/cards/card-rules.capability.js:143-146` | 恒空数组驱动的死循环：pendingKeys 永远为空，for 循环体永不执行 | 原文 `const pendingKeys = ([]); for (const key of pendingKeys) {...reject...}`；注释自述 M2 的 graveyard/schedule 均已接线，系旧 pending 键拒绝逻辑清空后的遗留骨架 | 整块删除（纯死代码，零行为差） | A |
| `game/src/cards/cards.rules.js:27` | TYPE_ICON 是全库零引用的死数据键（挂在 SDT.Cards 暴露） | rg 全部 js/mjs/html 仅命中定义行 :27 及相邻注释 :28-29（撰写抽验证实）；动态拼接访问兜底零命中；实际消费的位图映射是相邻 TYPE_ART（cards.view.js:127） | 删除 TYPE_ICON 键；注意改变 SDT.Cards 键面（拆分批注释承诺键面不变），删前宜与老板口径核对 | B |
| `game/src/cards/cards.sync.m1.js:27`（及 m2:49/m3:64/m4:45/m5:58/m6:36/m8:12/m11:9） | 8 个 M 批 marker 键死导出：M1/M2/M3/M4/M5/M6/M8/M11_MARKER_KEY 全库零 importer | 逐名 rg（排除 evidence/code-map）仅命中定义行与同文件传参；对照 M7/M10 被各自 *-data.test.js import（活）；键值文件内仍被 createRuleBackfiller 使用，仅 export 关键字死 | 8 处去掉 export 关键字改模块内 const（对齐 m9 的 M9_MARKER_KEY 私有先例） | A |
| `game/src/cards/card-photo-notes.js:56` | hasManualNotes 死导出：全库（import/动态解构/字符串）零引用 | rg 仅命中定义行；hub 消费方 cardslib.page.js:36 只 import 四个兄弟导出；tests/card-photo-notes.test.js 也不引用 | 删除该函数或去 export（若为预留 API 则注明） | A |
| `game/src/cards/card-rules.capability.js:29-30` | BAG_SUPPORTED_OPS 常量与 schema 双写：两处逐字符相同的 10 项 Set | node 实测两处 Set 内容一致；schema 是 shape authority 且 capability.js:2 已 import 该文件，无循环依赖障碍 | schema 导出 BAG_SUPPORTED_OPS，capability 改 import，消双写漂移面 | A |
| `game/src/cards/cards.view.js:25` | descRich 每次调用重建 30 词 alternation 正则：DESC_TERMS 是模块常量但 RegExp 在函数体内 new | 调用点 buildCardHTML:138（卡牌库页首渲数百卡各一次）、ui.js:172、cardslib.page.js:160（预览每开即重建）；cardHTMLMemo 只挡 cardHTML 重复，挡不住直调 | 上提为模块级 const DESC_TERM_RE（/g 标志自管 lastIndex，提升零行为差） | A |
| `game/src/cards/cards.rules.js:252-254` | rarityOf/isHeroLine 每次调用新建闭包并全库线性扫（253、262 两处同构） | 衍生/能力卡一次 rarityOf = 1-2 次全库 find（card-rarity.js:13-26 递归）；cards.view.js:87 棱彩分支再扫一次；sellPrice:271 经济路径每卡直调，商店/背包列表循环无 memo 兜底；233+ 张卡单次亚毫秒，属轻微热点 | 启动时建一次 id→card Map 供 findById 查询（需 saveAll/upsert/clearAll 三处写路径同步失效） | B |
| `game/src/cards/cards.sync.face-refresh.js:16` | FACE_REFRESH_BY_ID 死导出：注册表仅模块内 ensureCanonicalFaceRefresh（:36）消费，无外部 importer、无测试引用 | rg（排除 evidence/code-map）仅命中文件内 3/8/16/36 行；ensureCanonicalFaceRefresh 本体被 cards.js:61 与 m8-data.test.js 正常引用（活） | 去 export 保留 Map（文件头注释仍以注册表语义维护） | A |
| `game/src/cards/cards.sync.backfiller.js:15` | sameSnapshot 死导出：仅模块内消费；cards.sync.js 的同名命中是 E8 函数体内另一份局部实现（ensureXxx 模板块按 jscpd #12 口径保留，本条只报 export 面） | rg 非 cards 目录零命中；无任何测试 import 该导出 | 去 export 改模块内函数（模板块本身不动） | A |
| `game/src/cards/cards.data.js:644-658` 等（cards.sync.js / cards.rules.js / cards.js） | 逐字搬迁留下的整段注释双写：cards/ 四文件共 200 行全文重复注释 | node 全文重复行统计：cards.data.js 84 / cards.sync.js 56 / cards.rules.js 55 / cards.js 5；例 cards.js:148-150 相邻两行同文、cards.data.js:644-658 与 629-643 整块重复 | 各文件去重保留一份（纯注释零行为，顺带降低 jscpd 噪音） | A |

## 7. core（30 文件 2841 行全读）

口径：发现 9 条（6 冗余 3 性能），集中在表现层——motion.js hit() 整链死代码、icons-bitmap 旧预热链残留、13+7 个死导出、renderer.js 每帧重复计算；数据/规则/RNG/事件总线/存储层干净：无僵尸监听（4 处 busOn 均一次性注册）、无无界缓存（warmPool 双预算封顶、revealedAt 自清）；已知口径（F1/F3/F11/set$/cards 双轨/生成产物）未重复上报。

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/src/core/motion.js:39,57-71,73,75` | hit() 受击晃动动画整链死代码：函数、activeHits WeakMap、SDT.Motion 挂载成员、ESM 导出全无消费方 | 无 SDT.Motion.hit 调用；import 统计仅 reduceMotion/resolveReducedMotion 被 import；全部 `hit(` 命中均为 battle.engine.js:622 等处同名局部函数；activeHits 仅 hit() 内部使用 | 删除 hit 函数+activeHits+挂载/导出三处引用（09-18 stop() 异常防御注释一并失效）；或最低成本先摘 export 与挂载 | A |
| `game/src/core/renderer.js:476-479,504` | reachableSet() 每次绘制帧重算并新建 Set，内容与 nodeGeo 已缓存的 geo.legalKeys 完全相同 | nodeGeo :212-214 用同一 `layerData[layerIdx].logical[trackPos].next` 构造 legalKeys 且随 geo 缓存（:264）；:477-478 reachableSet 同键重建；drawTargetArrow（draw() 每帧调用，:582）:504 无条件执行 | drawTargetArrow 改用 nodeGeo(game).legalKeys，删除 reachableSet | B |
| `game/src/core/icons-bitmap.js:114-123` | 全量图标预热链死代码：iconUrls/warmAllIcons 两函数及 SDT.Icons 上 urls/warmAll/DEFS/missingKeys 四个挂载成员零调用 | rg（game/src+tests+scripts+game/tools）零命中；预热实际走 game.boot.js:729-746 的 collectThumbnailAssets/collectManifestAssets/warmBatched/prefetchBatched 链 | 删除两函数与挂载成员（09-07 预热口径已由 art-manifest 链接管，PENDING 若有旧口径条目应同步销账） | A |
| `game/src/core/renderer.primitives.js:3-11,53-63,65` | drawCover/fillStroke 零消费死导出，且 renderer.js 存在同款本地重复实现 | renderer.js:2 仅 import circle/font/hash2/mixHex/rrect/shade 六名；:77-84 自带局部 drawCover（多 image.width 兜底，:115 调用）；全库 rg 仅此三处定义/export | 二选一收敛：删 primitives 的两函数（保留 renderer.js 局部版），或 renderer.js 改 import 后删本地版 | A |
| `game/src/core/art.js:574`；`icons-bitmap.js:125`；`camera.js:160`；`renderer.js:605` | 门面/工具 re-export 死导出簇：{SDT,ROOT,esc,missingKeys,reportMissing,MAP} 等 13 个零消费者命名导出 | import 统计脚本（node 解析全库 import 语句）：art.js 仅 SKIN_FULL_ART/setActiveSkin 被引，icons-bitmap 零绑定被引，camera/renderer 仅 nodeHitRadius/副作用导入；动态 import 与 `SDT['...']` 括号访问搜索均零命中 | 整批删除这些 re-export（window.SDT 消费方走门面对象本身） | A |
| `game/src/core/renderer.fx.js:34`；`input.js:70`；`art.js:574`；`diagnostics.local.js:155`；`asset-url.js:9`；`random-core.js:36` | 活函数/常量的零消费死导出簇：FX、actionFor、hydrateSelectedSkins、diagnosticRecord、BUILD_VERSION、UINT32_RANGE、STEP | 各名三重搜索零命中；FX/actionFor/hydrateSelectedSkins 均经 SDT.* 面消费（game.boot.js:472/169、game.hub.js:69）；diagnosticRecord 仅文件内自用；UINT32_RANGE/STEP 唯一其他出现是 tests/map-rng-bit-equivalence.test.js:10-11 独立重定义 | 摘除 export 关键字保留内部使用（纯机械，零行为差） | A |
| `game/src/core/art.js:389-434,437-479` | warmBatched 与 prefetchBatched 约 30 行调度脚手架近似重复（去重表、进度记账、cardlib-open 让路 160ms、rIC 分批） | 两函数逐行对照三段结构一致（:391-397 vs :439-445、:400-411 vs :447-458、:412-431 vs :459-477），仅传输层不同（Image+decode vs fetch+arrayBuffer） | 抽公共批处理调度器（入参为逐项执行器，传输差异留回调）；或维持现状但在两函数头互相注明镜像关系 | B |
| `game/src/core/renderer.js:278-286` | drawCurrentNodePlate 每个绘制帧重建 createRadialGradient 并开 shadowBlur，未复用同文件暗角渐变的按需缓存手法 | :280 每帧 createRadialGradient + :278 shadowBlur=14/zoom，随 draw()（:575）每帧执行（active 态 120fps，render-scheduler.js:62）；:589-597 暗角已按视口键缓存并注明「省每帧渐变构建」 | 底盘渐变按（当前节点标识+layerColor+zoom）缓存命中即复用，参照 :591 vignetteKey 先例 | B |
| `game/src/core/renderer.js:294,439,484` | 每个绘制帧重复 2-3 次 document.body.classList.contains('reduce-motion') DOM 读，而 motion.js 已有失效链完整的缓存版判定 | drawIcons(:294) 与 drawEntrancePulse(:439) 每帧各读一次、drawNodeArrow(:484) 有目标时再读；motion.js:22-33 cachedReducedMotion+refreshReduceMotion 已接媒体查询与设置页失效，:34 已挂 SDT.Motion | 最低成本：draw() 顶部读一次传参下去；或统一改调 SDT.Motion.reduceMotion() 复用缓存 | A |

## 8. ui（12 文件通读）

口径：真冗余 9 条（1 组死方法、5 个死导出面、5 个恒 null 死 DOM 引用连带 boot 死分支、返回键 SVG×6 与两步确认×4 两组重复块）+ 性能 1 条；HUD/演出/缩放热路径均有脏检查缓存（F8 已修），未发现每帧分配或无界增长；已知口径（F1/F3/F11/set$/cards 同步块）未重复上报。

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/src/ui/overlay.js:172-174` | layerToken()/layerValid() 跳转代际令牌死方法：全库零调用点，注释声明的「跳转后迟到 showOverlay 自检」从未接线 | rg 仅命中定义与注释；外部跳转竞态实际由 game.menu.js:752-777 的 runtime.showRunTransition(...).isCurrent() 机制接管 | 删除 layerToken/layerValid/_jumpSeq 三行及注释（要保留令牌机制则先接线调用方） | A |
| `game/src/ui/ui.js:33-38` | init 每次收集 5 个 index.html 中不存在的元素引用（btnExport/btnImport/btnClear/btnCardDesigner/tglIndex），恒为 null 并连带 game.boot 守卫分支永不生效 | grep index.html 仅命中 devTools:76/btnCardLib:237/titleDev:275；game.boot.js:248-250 三分支永不绑定；game.menu.js:1014 恒跳过；scripts/electron-title-smoke.mjs:114 仍期望 #btnCardDesigner（疑似过期 QA 口径） | 删除 5 个 ref 与 game.boot.js:248-250 死分支；删前先核对 electron-title-smoke.mjs 是否仍引用旧设计师入口 | B |
| `game/src/ui/ui-scale.js:67,72-73` | pt()（视口→布局坐标点换算）死导出：ES 导入、SDT.UiScale.pt、字符串访问三路全库零消费 | 消费面只有 rect/scale（ui.js:235-446、boot.test.js:185）与 apply（ui-scale.test.js:2）；各 battle view 只 import { rect, scale }；rg `\bpt\b` 命中均为无关局部变量 | 删除 pt 函数与两处导出面（export 与 SDT.UiScale 字段） | A |
| `game/src/ui/term-tips.js:68` | termMeta 的 export 为死导出面：函数仅被本文件 :93 内部调用 | rg 仅命中定义与内部调用；cards.view.js:10 只 import termKeyFor | 去掉 export 关键字改模块内私有（函数保留） | A |
| `game/src/ui/quick-nav.js:73` | PAGES 为死导出：仅模块内部使用，唯一消费者 agent.console.js 只 import { listPages, jump } | 其余命中均为 lab.ending.js:13 本地常量与测试本地变量；card-library-lazy-boundary.test.js:32 只做源文本字符串断言（不 import PAGES） | 从 export { listPages, jump, PAGES } 中移除 PAGES | A |
| `game/src/ui/feedback.local.js:146` | FEEDBACK_KEY 为死导出：仅模块内部使用，外部（含测试）一律用原始串 'sdt-suggestions-v1' | FEEDBACK_KEY 引用仅文件内 :48/:65/:78/:92/:146；tests/r7b-feedback.test.js 十余处直接写字面量 | 从 export 列表移除 FEEDBACK_KEY（可选：测试改导入常量消字面量重复，属另一议题） | A |
| `game/src/ui/ui.js:474` | export { SDT, UI } 中 SDT 为死再导出：全库无一处从 ui.js 导入 SDT（window.SDT 才是真实分发通道） | 具名导入搜索零命中；唯一 ES 导入方 game.nest.js:17 只 import { UI }；tests 各处 import 均为副作用装配或取 { UI } | 改为 export { UI }（SDT 保留为模块内引用） | A |
| `game/src/ui/game.menu.js:349-354,401-407,452-458,651,941-943,970-975` | 同款「左上返回键」SVG 标记（M9 4h9a1.5 路径 + ak-sq ak-exit）内联重复 6 份约 35 行；index.html:134-138/191-196 另有 2 份同路径 | 六处同一 svg/path 块仅 data-act/title/aria 微差（sugin-exit 的 title 随 fromTitle 变化） | 提取共享 backBtnHTML(act, {title, ariaLabel}) 模板常量，六处渲染点替换 | B |
| `game/src/ui/game.menu.js:374-379,688-696,830-837,1018-1027` | 「两步确认」模式（dataset.confirm 守卫+文案换确认态+2600ms setTimeout 还原）重复 4 份（sugDel 内联/armConfirm/armDanger/leaveAbandon 内联） | 四块同构；微差：armDanger 确认路径播 sfx('confirm')、leaveAbandon 还原用 innerHTML 带图标 | 合并为单一 armConfirmButton(btn, armedText, restoreHTML)，差异（音效/还原图标）作参数 | B |
| `game/src/ui/overlay.js:124,138` | showOverlay 同一次调用内对同一选择器 '.node-pg, .flow-transition' 做了两遍 querySelector（:124 判开窗音效、:138 取场景音） | 战斗内每次重绘都会进 showOverlay（同模式跳过动画但不跳过这两行） | 在 :124 前查一次存 const soundScene 复用两处 | A |

## 9. agent + home + 根级（27 文件逐文件读毕）

口径：全部死导出经 import+动态+字符串三重搜索零命中确认；冗余大头是 policy 双反向 BFS 38 行同构块与 policy 排序取 [0] 的重复计算（性能），另有 10 处零消费死导出面/双轨门面；e2.snapshot.qa.js 有 docs/previews/e2-snapshot-acceptance/index.html:13 真实入口且 PENDING #10 已挂账、r7a.qa.js 有 docs/previews/r7a-encounters 入口，均非死文件，未重复上报。

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/src/agent/agent.policy.js:412-450` 与 `457-485` | R13 出口梯度与 R24 残血导航两段同构反向 BFS（pred/targets/dist/queue 约 38 行逐行对应），仅 targets 谓词（door vs fire）、R14a boss 附加目标、梯度系数（×6 vs ×10）三处差异 | :412/:428 与 :461/:471 两段 dist+queue 块逐字同构，均以 `catch { ...Dist = null; }` 收尾 | 抽公共 reverseBfs(lay, isTarget, extraTargets) 返回 {dist,max}，R14a 附加目标作参数只留 exit 分支；属修根因产物改动，需配对跑局验证行为逐值等价 | B |
| `game/src/agent/agent.policy.js:656-669` | 每步地图决策对 moves 做 2-3 次全量 sort(value) 但正常路径只用 ranked[0]：:656 的结果在非回退分支整体丢弃、:669 再排一次、:663 第三次；比较器每次调 2 次 value（内含 4+ 正则与字符串拼接） | :656 sort 取 [0]；:681 return ranked[0]；:669 的全序仅 :678 `globalThis.__scdbg` 调试分支消费；:669 在 banPrev 复位后执行、与 :656 输入等价可共享 | 先算一次 ranked 缓存复用（first=ranked[0]，banPrev forced 与兜底 return 都在缓存上取）；调试分支照旧读缓存数组 | A |
| `game/src/agent/agent.js:54` | 整行 ESM 具名导出（observe/act/step/autoRun/waitSettle/isTurbo/setTurbo 共 7 名）全库零消费——门面唯一出口是 :52 sdtDefine('Agent', Agent) 的 window.SDT 挂载 | import 搜索仅 game.boot.js:20 副作用导入；scripts/iab-drive.mjs、perf-ledger-capture.mjs、tools/agent-batch.mjs 均走 window.SDT.Agent 动态面 | 删除 :54 导出行（挂门面不受影响）；纯机械零行为差 | A |
| `game/src/home/story.last-lamp.js:110` | 5 个导出全库零消费：CHOICES、ENDINGS、MEMENTOS、STORY_ID、validLastLampEventInstanceId（均文件内部使用）；同文件另四名有真实消费 | 逐名搜索（排除归档）五名命中仅本文件；字符串引用搜索零命中；消费者 game.run.flow.js:12 只 import makeLastLampEventInstanceId、game.hub.pages.js 只用 validateLastLampState | 改为模块内 const/函数声明，从 export 列表摘除五名 | A |
| `game/src/home/home.commands.js:174-177` | 底部默认门面三连（buyFurniture/saveLayout/setDisplay）与生产装配双轨：game.hub.js:22 走 createHomeCommands 自建实例，转发中 saveLayout/setDisplay 全库零消费、buyFurniture 仅一处测试 import | game.hub.js:22 自建实例、:116-118 调实例方法；rg 生产侧零裸导入，测试侧均为 createHomeCommands 实例方法调用 | 与 PENDING #30 set$ 双轨同型：确认 M12 注释「可直接接入的生产门面」无在途接入后删转发三连，测试改走注入路径 | B |
| `game/src/home/home.visuals.js:34,320-330` | 导出面 4 名中 3 名零生产消费（M04_VISUAL_PACK/projectHomeCell/HOME_VISUAL_IDS 仅 m04-visual-pack.test.js）；且 projectHomeCell 依赖的 roomSpec.projection 静态投影（origin 960,252、cell 112×56）与生产 createHomeProjection（floorCalibration 动态缩放，home.scene.js:41）是并存两套投影 | 逐名验证如上；getM04VisualPack 有 game.hub.js:13 消费；home.scene.js 只读 floorCalibration（:165,:249），全库无 roomSpec.projection 生产读取 | projection 静态块与 projectHomeCell 若仅为 M04 契约快照，标注 test-fixture 性质或随 m04 测试收敛；删前需与 m04-preview-contract.test.js 口径复核 | B |
| `game/src/agent/agent.state.js:382` | 导出面 7 名中 battleActions、mapActions 全库零消费（两函数仅被同文件 observe() 内部调用） | rg（排除归档）命中仅本文件；agent.js:15 import observe/settleSignature/phaseOf、agent.runner.js:13 与 agent.scenes.js:15 均不含；字符串引用搜索零命中 | 两函数去掉 export 保留模块内使用；纯机械 | A |
| `game/src/agent/agent.protocol.js:93` | BATTLE_COMMANDS、SYS_COMMANDS 两个白名单 Set 的导出全库零消费（normalizeAction 内部使用） | rg 命中仅本文件；字符串搜索零命中；消费方 agent.js/agent.llm.js/agent.runner.js 均只 import normalizeAction/actionId | 去掉 export 改模块内 const；纯机械 | A |
| `game/src/agent/agent.llm.js:180` | SYSTEM_PROMPT 导出全库零消费（chatComplete messages 内部使用）；同文件 parseActionReply/decide/loadConfig/saveConfig/isEnabled 有真实消费，均非死导出 | rg 命中仅本文件（:52 定义、:149 内部消费）；字符串搜索零命中；agent.js:20 import 清单不含 SYSTEM_PROMPT | 去掉 export 改模块内 const；纯机械 | A |
| `game/src/agent/agent.stats.js:95` | outcomeCounts 导出全库零消费（brief() 内部 :31 调用）；同文件 rate/aggregate/brief 均有真实消费 | rg 命中仅本文件；import 语句级搜索唯一命中 tests/agent-recorder.test.js:3 `import { aggregate, brief, rate }`（不含 outcomeCounts） | 去掉 export 改模块内函数；纯机械 | A |
| `game/src/game.boot.js:751` | `export { resize }` 全库零消费——game.boot.js 只被 main.js:45 副作用导入；resize 本体活（:26 configureGameRuntime 与 :538 ResizeObserver 内部使用） | `from '.*game\.boot\.js'` 零命中；main.js:45 为副作用导入形式 | 删除末行 export 保留函数声明；纯机械 | A |
| `game/src/agent/agent.turbo.js:8` | core/turbo 迁移后的兼容转发壳治理未收尾：壳自注「新代码请直接 import core/turbo.js」，但仍有 5 个消费者绕经 agent 域取 turbo——含 run 域 lab.ending.js:11（与「归属 core 后依赖方向单一」治理口径相悖）和 3 个 agent 测试 | 消费者清单：agent.js:18、agent.runner.js:14、lab.ending.js:11、tests/agent-command-results.test.js:13、agent-runner-driver-restore.test.js:16、agent-runner-abort.test.js:14；core/turbo.js 已有直接消费者先例（agent.scenes.js:18、battle.clock.js:3、cov-battle-clock.test.js:17） | 5 处 import 改指 core/turbo.js 后删除壳文件；纯机械改 import 路径，docs/agent-protocol.md:121 模块表同步 | A |
| `game/src/home/home.scene.js:86` 与 `game/src/home/narrative.js:76` | 两个仅测试消费的导出：unprojectHomePoint（投影逆运算，生产 mountHome 无拖拽吸附未用）、KNOTS（narrative 内部消费，唯一外部消费是覆盖度测试）——属合法测试夹具 | 逐名（排除归档）：各命中本文件 + tests/m05-home-scene.test.js / tests/narrative-coverage.test.js；字符串引用搜索零命中 | 合法测试夹具，建议保留；若无在途拖拽吸附计划可标注 test-only 或移入测试侧，不急 | C |
| `game/src/game.boot.js:236-244` | 右上资源 HUD 三个 chip 的 mousemove 高频回调内重复求值不变量：每次鼠标移动执行 getBoundingClientRect 与 chip.querySelector('#charCoins')，两者绑定后不变，仅 tooltip 位置需随鼠标更新 | :236-241 `const show = (e) => { const r = vpEl.getBoundingClientRect(); const coins = chip.querySelector('#charCoins'); ... }` 每次 mousemove 重算 | 把 r 与 coins/文案分支提到绑定时的闭包（或 resize 时刷新 r），handler 只做坐标换算；改动极小、纯减法 | A |

## 10. css（44 文件 15881 行全读 + 全语料核对）

口径：语料为 game/src + game/data + *.html + scripts + tests 共 4.31MB，字符串拼接与数据驱动 tone 逐一排除（tier-bd-*/eps-val-*/rv*/tp*/hb-*/b-*/c-*/sc-*/slot-art-*/rl-*/lab-tone-*/fx-*/hub-{tab}/figure-{id}/home-hotspot--* 均存活，sc-chest/sc-pick 曾误判后被 scenes.json tone 数据翻案）：定性 149 个零引用死类分布 20 文件（约 254 行直接死代码 + chestShake1/2/3 连带死动画）、3 组同选择器后写遮蔽、1 组死 @font-face、1 个死 keyframes；文件级无孤儿（39 个走 index.html、sfx-audition 走独立页、其余走 JS import）。

| 位置 | 问题 | 证据要点 | 建议 | 档位 |
|---|---|---|---|---|
| `game/css/scenes.css:8-40,71-75(alive),190-230,242-296,474-497` | 32 个零引用死类横跨四代被替代渲染（旧场景节点布局/旧宝箱开箱动画/旧战斗名牌/旧事件状态页）约 53 行，另有只被死规则引用的 chestShake1/2/3 keyframes(222-224) | node 全语料子串检索（4.31MB）命中 0（scene-glow/scene-art/scene-title/scene-line/scene-hint/scene-foes/scene-gain、chest-stage/chest-glow/chest-box/shake-1..3/chest-hint、bt-self/bt-fportrait/bt-boss/bt-finfo/bt-self-tag/bt-hint-warn、evt-sts-*、withart/evt-opt-*、sell-tip/sell-no、gate-locked）；宝箱现走 chests.js:291 'bt-card chest-fly rl-'+riOf，事件选项走 nodeOpt 纯 tone 类；:32-40 级联块混有存活的 .scene-ops（game.run.flow.js:585,645 在用） | 分四块删除（旧场景布局/旧宝箱/旧名牌/旧事件页），保留 .scene-ops 与 .flow-transition 相关行；chestShake1/2/3 随 .chest-box.shake-N 一起删 | B |
| `game/css/winter.css:9-13,27-40,108-110,213-215,230-238,285-286,363-365,387-390,501-502,528-534,623,1010-1014,1567,1597-1600` | 45 个零引用死类约 48 行：旧标题页（ak-hex/ak-invest/inv-ico/inv-label/inv-num/map-label/cn-title/en-subtitle/scene-battle-3d）、旧卡牌库预览（clib-grid/clib-preview/lib-pager/lib-pageinfo）、sac-list/row/sel、guide-list/row、title-suggest、lib-page-next/previous、scrolling 等 | 全语料（含 game/data）0 命中；:501 注释称 .scrolling 由 JS 挂但 rg game/src 为空（陈旧注释）；:108 .clib-grid 的 contain/will-change 性能优化挂在死类上，现役网格类是 lib-grid（game.cardslib.page.js:224 实际输出）；:1597-1600 翻页动画类 JS 零生成 | 按簇删除死规则与陈旧注释；:is()/组合选择器里与活类交织的行须只剔死类 token | B |
| `game/css/winter.css:708-715` | .hs-card.tp0~tp7 的 --type-body1/2/art1 八行被同文件 739-746 行完全遮蔽（同选择器同属性后者胜出），是「低饱和卡牌主题定稿」上线后未删的旧稿 | 重复定义检测器输出 SHADOWED(last-wins)；人工 sed 比对 708-715 与 739-746 属名一致；两处均无 !important、同特异性 | 删除 708-715 八行（同节 717-725 的 .hsc-name/.hsc-gem/.hsc-art 消费新值，保留） | A |
| `game/css/hub.css:44,71,86-108,146-147,181-202,237,255-259` 与 expedition-inventory.css | 旧基地整页布局残留 15 个死类（deploy-grid/deploy-foot/deploy-forecast/stash-grid/stash-row/dep-back/cls-stat-row/cls-detail/cls-hub-art/cls2-tag/cls2-lv/cls-pick-art/bt-fportrait/scene-foes/scene-foe-art）约 18 行，其中 stash-row/stash-grid/deploy-grid 与 expedition-inventory.css、dep-back 与 page-deploy.css 跨文件重复定义 | 全语料 0 命中；基地现渲染为 hub-${hubTab}（game.hub.js:162）+ game.hub.depart.js 新部署列活类；hub.css:237 一行同时串 cls-hub-art/cls-pick-art/bt-fportrait 三个死类 | 删 hub.css 簇时把 expedition-inventory.css 的 cardlib-page/cardlib-head/cls-info/stash-row/stash-grid/deploy-grid 与 page-deploy.css 的 dep-back 一并清（同一代旧布局） | B |
| `game/css/expedition-library.css:441-455,719-733,1234-1254` 与 `page-cardslib.css:161-247`、`photo-studio-craft.css:139-156` | 照相馆旧「加载更多/翻页」机制 6 个死类（studio-load-more/lib-page-next/lib-page-previous/advanced-row/library-advanced/studio-page-nav，expedition-library.css 约 30 行），且死类 token 混在两文件的 :is() 组里 | 6 名全语料 0 命中；现役分页由 cardslib page.js 直接渲染 lib-grid，无 studio-load-more 按钮生成点；:is() 组内 pv-navbtn/studio-zoom/studio-exit 为活类，整行删除会误伤 | 删 expedition-library.css 纯死块；page-cardslib.css/photo-studio-craft.css 仅从 :is() 列表剔除死 token、保留活类规则 | B |
| `game/css/overlays.css:302-306` | .tier-S/.tier-A/.tier-B/.tier-C/.tier-EV 五行档位色带永不生效——宝箱档位钩子实际生成 tier-small/tier-medium/tier-large | chests.js:40 TIER_KINDS=new Set(['small','medium','large'])、:46 classList.add('tier-'+cur.kind) 只能产出三者；S/A/B/C/EV 档位色实际由 game.bag.js:577 tier-bd-${it.tier} 承担；全语料字面 tier-S 等 0 命中 | 删除 302-306 五行；.tier 基类(301)与 tier-small/medium/large（page-rewards-bag-help.css:551-554 命中）保留 | A |
| `game/css/expedition-hub.css:25-30` 与 `page-hub.css:241-246,373` | nest-locked 锁态按钮样式（合计约 12 行）随 W2-02 重设计死亡——#btnNest 现在只在 nestUnlocked 为真时渲染，永不挂 nest-locked 类 | rg 全库仅命中这两个 css；game.hub.depart.js:32 条件渲染 + 注释明言「锁态不再占主列行动位——未解锁时收敛到右栏 MISSION BRIEF」 | 删除两文件共 9 行 nest-locked 规则（含 :not(.nest-locked) 反向选择器，注意保留 #btnNest.deploy-primary 本体样式） | A |
| `game/css/battle.css:450-451` | .sts-hand .hs-card .hsc-desc 与 .hsc-desc span 两行被同文件 475-476 行完全遮蔽（无 @media 间隔，后者胜出） | rg 仅 450/475 两处；awk 440-478 检查无 @media；475 行 font-size:12px/1.38、line-clamp:6 覆盖 450 行 10.5px/1.35、clamp:4；450 上方注释「#35 卡牌描述最多 3 行」为旧口径 | 删除 450-451 两行（473 行 handDescIn 段与紧凑手牌块保留） | A |
| `game/css/expedition-shop.css:112-114` | 买不起货位样式 .shop-slot.buy[data-short] 三行被同文件 127 行整组遮蔽，且 111 行注释（「不再整体压灰」）与 126 行注释（「整板灰…收轻一档」）叙述相反，误导读者 | rg 命中 112 与 127 两处同选择器；awk 110-128 无 @media；112 行 opacity:1/filter:none 被 127 行 opacity:.82/filter:saturate(.72) 覆盖 | 删 112-114 三行及 111 行旧注释，把 126 行注释留作唯一口径 | A |
| `game/css/page-events.css:170` 与 `winter.css:501` | @keyframes evtPanelIn 是 44 文件 191 个 keyframes 中唯一全库零引用的动画声明；winter.css:501 注释声称的 .scrolling JS 挂载机制已不存在（陈旧注释+死规则） | 计数法+词边界法双重检测（node，剥离注释比对）均仅报 evtPanelIn（撰写抽验证实仅 page-events.css:170）；rg scrolling game/src 为空 | 删 evtPanelIn 块；winter.css:501-502 注释与 .lib-grid.scrolling 规则一并处理 | A |
| `game/css/base.css:40-47` | 'Source Han Sans SC' 两个 @font-face 声明（400/700，复用 notosans-sc woff2）无任何 font-family 引用，属死字体声明 | rg 全库仅 4 处：声明本身 + expedition-library.css:279,1823（--serif 引用的是另一族名 'Source Han Serif SC'，且无对应 @font-face，走系统宋体回退）；--font-ui 链（base.css:52、winter.css:2）只含 HarmonyOS/Noto Sans SC Sub | 删除 40-47 两个 @font-face 块（不动 notosans-sc woff2 文件，'Noto Sans SC Sub' 仍在 --font-ui 回退链中） | A |
| `game/css/base.css:237,275,343-345` 与 `ui-scale.css:33`、page-rewards-bag-help.css、winter.css:234,285-286 | 旧顶栏/背包详情代际残留 4 死类：hero-name（旧主角名牌）、#bagBtn .bag-cap（旧背包角标）、bag-card-detail、bag-drop-note，且 ui-scale.css:33 与 winter.css 对死类还有次级 override（transitively dead） | 全语料（含 game/data）0 命中四类名；ui-scale.css:33 html[data-ui-scale-floor] .bag-drop-note 是死类上的死覆盖；back-sm 在 winter.css:234 与 page-rewards-bag-help.css 各一份、ov-btns-corner 在 winter.css:285-286 成组，均 0 命中 | 删 base.css 三块及 ui-scale.css:33 对应行；back-sm/ov-btns-corner 随 winter 死簇清理 | A |
| `game/css/expedition-roster.css:51,201` 与 page-hub.css、page-events.css、ui-scale.css | 选角页 cls2-face.sel 旧选中样式（51 行 box-shadow）被 09-28 重定稿的 219 行遮蔽；另有 cls2-preview/cls2-lv/cls2-ability 三死类（roster 201 行区）及跨文件死覆盖：page-events.css 的 scene-title/scene-hint/scene-gain、ui-scale.css 的 scene-line/scene-hint/guide-row/cls-story/step-btn 均是给死基类写 secondary 覆盖 | 两处 .cls2-face.sel 同特异性无 media 间隔（51 vs 219），51 的 box-shadow 被 219 覆盖、border-color 同值冗余；三死类与覆盖目标全语料 0 命中（cls2-page/cls2-stage 存活见 game.run.altar.js:112-113） | 删 51 行旧 sel 样式与三个 cls2 死类块；page-events/ui-scale 的死覆盖行随基类清理一并删 | A |
| `game/css/cards.css`、`expedition.css`、`expedition-shop.css`、`page-hub.css`、`overlays.css` 零散死类 | 剩余小簇：cards.css clib-preview/lib-actions（旧卡牌库预览/操作行）、expedition.css winter-edition/title-expedition-copy（旧活动版头）、expedition-shop.css sell-tip、page-hub.css step-btn、overlays.css slot-ops/pet-ava/shop-row/ov-items/scene-line | 全部经含 game/data 的 4.31MB 语料检索 0 命中；expedition.css:264-303 证明 var(--font-handwriting) 活着但 winter-edition/title-expedition-copy 类名零生成；pet-ava/shop-row 所在旧商店/宠物面板已被 page-shop.css/sc-* 商店（tone:shop 存活）替代 | 按文件小簇随手清理，与前面各条同批落地 | A |
| `game/css/`（全量 44 文件 15881 行） | 性能镜头总体干净：191 个 @keyframes 仅 1 个未引用；transition:all 每文件 1-8 处；backdrop-filter winter12/overlays7/battle2；will-change 点状使用且有治理注释；未发现无界动画或通配 transition 热路径——唯一值得动的是死类 clib-grid 上的 contain/will-change 优化从未落到现役 .lib-grid | 检测命令：node 全 CSS 扫 @keyframes（191 定义/1 未用）、rg -c transition:all、rg -n will-change（9 处）、rg -c backdrop-filter；winter.css:108 为死类（JS 只输出 lib-grid） | 冗余清理落地后无需额外性能专项；若卡牌库滚动掉帧，再评估把 contain 移植到 .lib-grid（属新优化，不在本次删除范围） | C |

---

## 定级边界与已知口径（审计已排除、未重复上报项）

- F1/F3/F4/F5/F8/F9/F11/F12 等已落库性能项、set$ 双轨（PENDING #30）、cards-sync 同名双版卡、ensureXxx 模板块（jscpd #12 裁定保留）、deployPick/CARD_DESIGNER_WRITES_ENABLED 等契约测试锚定的门面转出面、e2.snapshot.qa.js（PENDING #10 挂账删留待拍板）与 r7a.qa.js（有预览入口，非死文件）。
- battle 门面/engine 导出面、state-guard export-let 白名单、hub 架构守卫测试按名断言的导出，属**受契约钉住的残留**：删除必须连同基线/白名单/守卫一起改，故全部落入 B 档，不做单点摘除。
- A 档执行口径沿用项目既定标准（A 档删除三证据 + 对应门禁留证，详见 `搜打撤/docs/quality-gates.md`）；本报告只做定级，未实施任何删除。

## 未核实项与撰写附注

- **本报告为审计结果汇编**：各域 findings、summary、risk 分级与 29 文件机器引用计数均转录自工作流入参，撰写时未重跑各域三重搜索、import 图与引用计数复核。
- 撰写时抽验 5 条（cwd `D:\素材\代号柒`，全部与审计结论吻合）：
  1. `rg -w -n previewDamage 搜打撤/game 搜打撤/tests 搜打撤/scripts` → 命中 3：combat.js:62（定义）、:98（注释）、:508（导出）。证实零消费；审计原文把注释行记为 :63，实测为 :98，已按实测修正，结论不变。
  2. `rg -n "\.quitGame" 搜打撤/game 搜打撤/tests 搜打撤/scripts` → 0 命中，证实三跳死链。
  3. `rg -n "TYPE_ICON" 搜打撤/game 搜打撤/tests 搜打撤/scripts` → 仅 cards.rules.js:27 + 相邻注释 :28/:29，证实死数据键。
  4. `rg -n "evtPanelIn" 搜打撤/game` → 仅 page-events.css:170，证实唯一零引用 keyframes。
  5. `rg -n "upSafe" 搜打撤/game 搜打撤/tests` → 仅 game.hub.js:255，证实僵尸 UI.act 注册。
- 静态口径限制（沿用原审计声明）：battle 走读块与 hub 性能块均未跑运行时 profile（hub 块明示本环境无内置浏览器会话），性能量级为静态推算；实施前建议先按各条 suggestion 口径测量。
- 本任务只写了本报告文件，未修改任何代码/配置/台账。
