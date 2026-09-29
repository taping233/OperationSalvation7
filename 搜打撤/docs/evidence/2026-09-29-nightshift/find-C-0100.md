# find-C-0100 — 开采者 C：测试覆盖缺口甄别（架构线 W1 前置）

- 日期：2026-09-29 夜班
- 甄别人：开采者 C（只读审计，唯一写入=本单）
- 输入：调度长粗筛 25 个「文件名在 tests/ 零出现」候选
- 方法：四通道甄别（①concat 拼接 ②barrel/聚合入口 ③window.SDT 门面 ④消费者间接覆盖），证据 = rg 静态引用 + 测试执行链反推（import 图 121 个静态入口 + 动态 `await import` 补扫 + vi.doMock 排除）
- 结论：**真缺口 4 个，误报 20 个，标注 1 个**
- 重要口径修正：effect-steps 分片族**不是 concat 拼接**，是主壳 `effect-steps.js:30-38` 的 ES import 组装（`createEffectSteps` 按序 concat 步骤表，语义序=装配序）；「测试测主壳即覆盖分片」成立。另：仅扫静态 import 会漏掉 `await import` 动态入口（agent 族差点误判），本轮已补扫。

---

## 一、真缺口清单（4 个，均为 P3）

### 1. battle/core/battle.target-session.js（76 行）P3
- **甄别证据**：全仓唯一消费者 `game/src/battle/view/battle.aim.js:34`，且仅在函数体内调用（battle.aim.js:149/335/381）。battle.aim/battle.view 均不在测试执行图：`tests/e4-battle-loader.test.js:18` 对 battle.view `vi.doMock`；`tests/boot.test.js:272` 仅 `ensureBattleReady()` 预取模块（顶层定义执行，工厂不调）；facade-snapshot-drift/message-batch-0920-late/ui-accessibility-regression 三处提及 battle.aim 均为文件清单字符串守卫，非执行。
- **核心职责**：出牌点击瞄准的多目标会话状态机（进入/切换目标/确认/取消）。
- **建议补测**：直测 `createTargetSession` 状态机——进入→逐个切换→确认的合法性迁移、取消后状态清空、越界目标拒绝。
- **说明**：引擎侧目标结算（targetSide/multi-hit）已被 tests/multi-hit-retarget.test.js 等覆盖，缺口仅在 view 层会话逻辑。

### 2. battle/runtime/battle.clock.js（90 行）P3
- **甄别证据**：`game/src/battle/view/battle.feedback.js:15-17` 存在显式测试旁路：`isTestRuntime()`（VITEST=true）时 `waitMs` 直接 resolve，**绕过 waitPresentationMs**（battle.feedback.js:4,18）；其余消费者 battle.view/anim.view/vfx/layers 的呈现路径无测试执行（boot.test 不进战斗画面；e4 mock battle.view）。core/turbo.js 仅注释提及，且是零 import 叶子模块，未被测试引（agent 测试引的是 agent/agent.turbo.js，不同文件）。
- **核心职责**：演出层时序调度（schedulePresentation/pausePresentation/waitHitStop）。
- **建议补测**：`vi.useFakeTimers` 直测调度/暂停/恢复语义——pause 后挂起回调不触发、恢复后按序补发、hitstop 窗口合并。

### 3. core/renderer.primitives.js（65 行）P3
- **甄别证据**：唯一消费者 `game/src/core/renderer.js:2`（circle/font/hash2/mixHex/rrect/shade）；renderer 绘制路径在 jsdom 下无 2D ctx 不执行——`tests/render-scheduler.test.js` 只测调度器自身 `shouldDraw` 数值逻辑，不驱动真实绘制；无任何测试按符号引用本模块（全 tests rg 零命中）。
- **核心职责**：画布绘制原语与颜色数学（圆/圆角矩形/字体/混色/明暗/散列抖动）。
- **建议补测**：先测零 DOM 依赖的纯函数 `mixHex/shade/hash2`（端点色、比例边界、确定性）；canvas 族用桩 ctx 断言调用序列即可。

### 4. core/motion-primitives.js（56 行）P3
- **甄别证据**：消费者 core/renderer.js、run/game.run.shop.js、core/camera.js:2、run/map-reveals.js 均不在测试执行图；`tests/camera-interaction.test.js:5` 动态 import camera.js 但只调 `nodeHitRadius`（camera.js:155，纯几何，不踩 ease）。无测试按符号引用本模块。
- **核心职责**：缓动/弹簧/衰减动画数学底座（ease/spring/clamp01/decayOsc/hopPoint/settleMs）。
- **建议补测**：数值性质单测——t=0/1 端点值、输出值域 [0,1]、弹簧收敛性；一行 import 即可测，成本最低。

---

## 二、误报清单（20 个，按甄别通道分组）

### 通道①：主壳装配的分片族（6 个）
| 文件 | 行数 | 实际覆盖通道 |
|---|---|---|
| battle/effects/effect-steps.gates.js | 99 | 主壳 effect-steps.js:30 装配进每次牌效解析；门控选择经 tests/playthrough-bot.test.js:31 `pickChoice` 踩中；装备条件门被 cards.sync.m4 引用 |
| battle/effects/effect-steps.recovery.js | 164 | effect-steps.js:33 装配；回复/护甲/抽牌段被 tests/battle-modules.test.js:4,64-73（createEffectExecutor 直驱管道）等踩中 |
| battle/effects/effect-steps.kills.js | 350 | effect-steps.js:34 装配；击杀/毒爆语义被 tests/m7-battle.test.js、tests/ember-burst-rot-seed.test.js 等真实出牌踩中 |
| battle/effects/effect-steps.deck.js | 107 | effect-steps.js:35 装配；牌库操作段被 battle-modules（抽牌断言）踩中 |
| battle/effects/effect-steps.rules.js | 82 | effect-steps.js:36 装配；规则登记段随 tt12-structured-battle 等规则牌测试执行 |
| battle/effects/effect-steps.audit.js | 154 | effect-steps.js:37 装配；Q1-Q8 机制（召唤/额外回合等）被 tests/abyss-sovereign.test.js、tests/card-audit.test.js 踩中 |

### 通道④：经消费者间接执行——battle 引擎族（5 个）
| 文件 | 行数 | 实际覆盖通道 |
|---|---|---|
| battle/bag/battle.equipment.js | 217 | battle.engine.js:53 导入、:995 装配；tests/battle-engine-facade.test.js:9 import 门面即执行工厂，tests/boss-equip-select.test.js 驱动穿戴 |
| battle/core/battle.draw.js | 175 | battle.engine.js:49 导入、:119 **模块顶层**执行工厂；全部 BattleSession 战斗测试走 drawCards |
| battle/core/battle.foe-lifecycle.js | 93 | battle.engine.js:48 导入、:116 **模块顶层**执行工厂；敌败/清扫随战斗测试执行 |
| battle/runtime/battle.action-runner.js | 53 | battle.engine.js:35 导入、:981 装配；tests/mana-surge.test.js:15 等 BattleSession play 链执行 |
| battle/effects/battle.discover-flow.js | 244 | battle.selection-flow.js:7,23 创建；tests/battle-selection-flow-boundary.test.js 直测 selection-flow（28 处 discover 断言） |

### 通道④：经消费者间接执行——agent/数据/装配族（9 个）
| 文件 | 行数 | 实际覆盖通道 |
|---|---|---|
| agent/agent.policy.js | 872 | agent.llm.js:141 每次 decide() **急切构造** greedyPolicy 回退 ← tests/agent-llm.test.js:80-108 端到端。附注：randomPolicy/strategicPolicy 函数体零执行（仅 agent.js:30 门面挂载），后续可为双策略补定向单测 |
| agent/agent.surface.js | 118 | agent.runner.js:12 / agent.state.js:12 导入 ← tests/agent-command-results.test.js:11-12 **动态 import** runner/state 驱动 autoRun/observe（静态 import 扫描会漏，差点误判） |
| agent/agent.protocol.js | 93 | agent.llm.js:169 `normalizeAction(parsed.raw)` ← tests/agent-llm.test.js:80 decide 端到端执行 |
| cards/cards.sync.backfiller.js | 159 | cards.sync.m10.js:10 导入、:32 `createRuleBackfiller` 装配 ← tests/m10-data.test.js:5 直接调用 ensureM10HostedEquipmentRules；m1-m11 同族同通道 |
| experience/pocket-strip.js | 152 | game.boot.js:24 `startPocketStrip()` ← tests/boot.test.js:62 全量启动链执行 |
| hub/base-meta.commands.js | 140 | hub/base.js 装配 ← tests/base-meta.test.js:7 import base.js 直测存档隔离/卡背/成就命令 |
| ui/term-tips.js | 122 | main.js:32 侧效挂载 ← tests/boot.test.js:62、tests/potion-tip.test.js:55 全量启动执行全局委托注册。附注：termKeyFor/termMeta 仅 hover 触发，函数体未被断言 |
| hub/game.bag.rules.js | 70 | game.bag.js:13 导入、:38 每卡调用 ← tests/bag-structured-use.test.js:71 `showBackpack(true)` 执行 |
| hub/game.cardslib.art-warm.js | 52 | game.cardslib.page.js:43,245,425,531 挂载时调用 ← tests/boot.test.js:96-99,133 Alt+7 真实打开图鉴页（`.card-library-page` 挂载断言）触发 warmLibArt |

---

## 三、标注（不入两清单）

- **e2.snapshot.qa.js（112 行）**：PENDING #10 在案，跳过甄别。

---

## 四、给调度长的一句话

- 「文件名零出现」口径误报率 20/24（83%）：本项目经主壳装配（effect-steps 族）、引擎门面顶层工厂（battle.engine.js:116/119 模块级执行）、全量启动链（boot.test→main.js→game.boot.js）和动态 import（agent 族）四条通道形成了密实的间接覆盖网。
- 真缺口集中在 **view/呈现层**（target-session、clock、绘制/动画原语），核心玩法结算路径无洞。最值得补测前三：battle.target-session.js（瞄准状态机，纯逻辑易测）、battle.runtime/battle.clock.js（演出时序，fake timers 可测）、core/motion-primitives.js（动画数学底座，成本最低）。
