# 战斗状态袋全量打薄路线图（2026-09-24）

> 背景：战斗运行态集中在兼容壳 `game/src/battle/battle.runtime.js` 与五个属地模块
> （session / piles / interaction / effects / presentation），全部以 `export let` + `set$Xxx(v)`
> 暴露。属地外消费者直接散调 `set$Xxx`，重置/还原逻辑在 lifecycle、engine 等文件里成行铺开。
> 本路线图规划把「散 set$Xxx 调用」逐域收敛为「域内聚合接口」，分批打薄、每批全量回归。
> 试点批次（presentation、piles）已于 2026-09-24 完成并全量回归通过。

## 度量口径

- **域外 set$ 调用点**：除该域声明文件与 `battle.runtime.js` 兼容壳（仅重导出、无调用）外，
  `game/src` 下 `set$Xxx(` 的出现次数。
- 统计方法：从域文件正则抽取 `export function set$\w+` 名单，在其余源码中按 `名字(` 精确子串计数
  （定义行与 import 行不含 `名字(`，不计入；域内声明文件不计）。
- **验证口径**（每批必做）：`node --check` 全部改动文件；
  `cd 搜打撤 && node node_modules/vitest/vitest.mjs run tests/battle- tests/combat tests/r3 tests/tt3
  tests/tt7 tests/structured tests/abyss tests/boss-equip tests/playthrough tests/architecture-boundaries
  tests/contracts --no-file-parallelism`；
  收批 `node node_modules/vitest/vitest.mjs run --no-file-parallelism`（全量 814）。

## 总览与打薄顺序

| 顺序 | 域 | 声明文件 | setter 数 | 域外调用点 前 → 后 | 状态 |
|---|---|---|---|---|---|
| 1a | presentation | battle.runtime.presentation.js | 7 | 19 → **0** | 已完成（2026-09-24） |
| 1b | piles | battle.runtime.piles.js | 14 | 56 → **19** | 已完成（2026-09-24） |
| 2 | interaction | battle.runtime.interaction.js | 16 | 87 → **54** | 已完成（2026-09-25 `1687d78`） |
| 3 | effects | battle.runtime.effects.js | 35 | 98 → **45** | 已完成（2026-09-25 `1687d78`） |
| 4 | session | battle.runtime.session.js | 18 | 84 → **53** | 已完成（2026-09-25 `9f2a09b`；engine 侧 15 点因 P1-b 在途避让保留，≈−7 候选下批） |
| 5 | 兼容壳 battle.runtime.js | — | — | — | 可选收尾，默认不做 |

顺序依据：先收「消费者少 + 重置簇干净」的域（试点两域），再按「簇集中度高、状态机敏感度递增」
推进 interaction → effects → session；风险最高的 battleState/动作信号放最后单独评估。

> **路线图收官（2026-09-25）**：第 2/3/4 批随持续任务 wave2/wave3 落库，四域全部达标。
> engine 规则核深拆经只读复核维持「收益低」结论：SCC（autoPlayHandType→execPlay→hitFoe→
> resolveFoeDefeat 回路、enemy-phase⇄processDelayed/finish 互递归）剩余正文即共享结点，
> 候选块逐一否决表见 wave3 代理报告（交接文档 2026-09-25 03:1x 段）；且任何真实拆分需同时改
> scripts/architecture-graph.mjs 的 RUNTIME_OWNERS 白名单。保留散调点（信号推进/busy 锁/
> 回合推进/检查点簿记等）逐条理由已在各批提交信息与报告记录。

## 第 1 批试点：presentation + piles（已完成）

新增域内聚合接口：

- presentation：`bindBattleRenderer` `showDread` `hideDread` `takeBattleFloats` `takeBattleCardAnims`
  `clearBattlePresentation` `resetBattlePresentation` `nextActionSeq` `storeBattleSnapshot`
- piles：`clearBattlePiles` `restoreBattlePiles` `restorePilesBookkeeping` `resetPilesCarryover`
  `resetCastOverrides`

收敛明细（调用点 → 聚合）：

| 位置（函数） | 原散调 | 收敛为 |
|---|---|---|
| lifecycle restore（牌区回填 4 行 7 个 setter） | hand/drawPile/discard/grave/played/consumed/granted | `restoreBattlePiles(data)` |
| lifecycle restore（delayed/noDrawNext/lastDrawnUids/zeroFee/cardOverrides 5 点） | 分散 5 行 | `restorePilesBookkeeping(data)` |
| lifecycle finish（played/consumed + 五牌区 7 点） | 2 行 7 setter | `clearBattlePiles()` + `set$hand([])` |
| lifecycle beginNormal（六牌区 6 点） | 1 行 6 setter | `clearBattlePiles()` |
| lifecycle beginBoss（洗牌 + 6 牌区 7 点） | 2 行 7 setter | `clearBattlePiles()` + 洗牌 + `set$hand([])`（域内换序，独立赋值） |
| lifecycle resetBattleEntryState / finish（delayed/noDrawNext/lastDrawnUids 各 3 点 ×2） | 4 行分散 | `resetPilesCarryover()` ×2 |
| lifecycle resetBattleExtras（zeroFee/cardOverrides 2 点） | 行尾 2 setter | `resetCastOverrides()` |
| lifecycle restore/finish/entry（floats/cardAnims/seq 重置簇，6 点） | 3-4 行 | `resetBattlePresentation()` ×2 + `clearBattlePresentation()` ×2 |
| lifecycle restore（dreadShown true/false 2 点） | 2 处 | `showDread()` / `hideDread()` |
| core configureBattleRenderer / markDreadShown / takeFloats / takeCardAnims（4 点） | 本地包装散调 | 委托 `bindBattleRenderer` / `showDread` / `takeBattleFloats` / `takeBattleCardAnims`（core 导出面不变） |
| engine getSnapshot（snapSig+snapCache 2 点） | 2 setter | `storeBattleSnapshot(sig, snap)` |
| exec-play queueCardExecution（seq 自增 1 点） | 计数式 setter | `nextActionSeq()` |

风险与结果：唯一允许的换序是「同域独立赋值在聚合内重排」（beginBoss 洗牌挪到清区之后、
lastDrawnUids 前移到行首），跨域语句相对次序未动；save schema 未动。
验证：`node --check` 6 文件通过；battle 定向 28 文件 172 用例绿；全量 145 文件 **814/814 绿**
（2026-09-24，HEAD 12a71c0 工作区）。

## 第 2 批：interaction（87 点，7 个消费文件）——预估 4 步

1. **弹层重置簇**（风险：低）：lifecycle restore/finish/entry 三处的
   `infusing/discovering/handSelecting/choosing/interaction` 整组置 null（各 5-6 点，合计约 −13）
   → 新增 `clearBattlePopups()`。`discoverQueue` 的两种清法（`[]` 赋值 vs `.length=0`）留在调用点
   不并入，保持数组引用语义。
2. **视图旗簇**（风险：低）：restore/finish/entry 的
   `viewingGrave/viewingDeck/viewingBag/selectingDeck` 成组关闭（各 4 点，合计 −12）
   → 新增 `closeBattleViews()`；`dreadShown` 已在第 1 批移入 presentation，不重复计。
3. **成对清理点**（风险：中）：engine clearTargetSession / enemy-phase 结束回合等
   `set$interaction(null)+set$pendingHint('')` 成对点（约 4-6 处）→ 新增 `clearTargetHint()`；
   进行中的状态推进（selection-flow 逐次 `set$handSelecting({…})`）**保持散调**，不做伪聚合。
4. **全量回归**（风险：低）：定向 + 814。

风险总述：interaction 是玩家瞬时交互态，只聚「整组置 null/关闭的重置点」；弹层状态机的推进点
与 bag 的 toggle 点语义各不相同，强聚会破坏时序。目标：87 → ≤60。

## 第 3 批：effects（98 点，4 个消费文件）——预估 5 步

1. **收尾/入场重置簇**（风险：低-中）：finish/entry/restore 中连续的
   `spellCost1/meleeCost1/shaTransform/consumeFireballN/lastPlayedType/stealthStrike/nextSpellTwice`
   成组重置 → `resetCostFlags()` 一类聚合（约 −12 点）。
2. **符文旗簇**（风险：中）：applyNestRunes 内 10+ 个 rune boolean 单行连写与
   resetBattleExtras 内的成组清零 → `resetRuneFlags()` + 按 kind 写旗的域内辅助；
   与 `Combat.addBlessing`/日志交织的行只包值写入，日志与战斗调用留原地。
3. **restore effects 回填块**（风险：低）：restore 内 data→setter 的连续映射段
   （约 20 点）→ `restoreEffectState(data)`；前提逐字段核对 save-format 语义不变。
4. **exec-play 打出侧登记簇**（风险：中）：正则条件 + 日志 + setter 交错
   （killAtkUp/poisonOnSpell/poisonLegacy/playerCurseImmune/allSpellsInfused）——只聚「同一条件块内
   的值写入」，条件与日志不进聚合；防止聚合退化为 1:1 改名（无收益即不做）。
5. **全量回归**（风险：低）。

风险总述：effects 多数 setter 是规则逻辑中途回写，聚合成败取决于「是否真有一次语义动作写多个
变量」；宁可少聚，不做伪聚合。目标：98 → ≤70。

## 第 4 批：session（84 点，6 个消费文件）——预估 5~6 步（全路线最高风险）

1. **restore 数据回填簇**（风险：中）：G/opts/mode/turn/energy/maxEnergy/pdef/pstat/foes 连续回填
   （含 `Combat.ensureStatus` 与 intent 重算随行）→ 聚合须逐字搬迁语句与顺序（约 −10 点）。
2. **终局/入场运行态簇**（风险：中）：finish 与 start 中
   `activeActionSignal/surgeWaiter/busy/lastPersistAt` 的成组置位 → 按「abort 后清信号」
   既有次序包聚合，不得合并跨阶段的 transition。
3. **battleState 阶段迁移点**（风险：**高**）：`set$battleState(transitionBattle(...))` 模板约 6-8 处
   → 只聚「模板完全一致」的成对点为 `transitionTo(phase)`；阶段机是流程本体，错一步直接破坏
   PLAYER/VICTORY/DEFEAT 迁移。单点 `createBattleState()` 初始化不聚。
4. **动作队列信号簇**（风险：**高**）：queueBattleAction 内 `activeActionSignal/lastPersistAt`
   与取消时序强耦合（历史事故：busy 永久卡死，2026-09-18）——建议仅在 battle-settlement-retry /
   r3-b 定向用例全绿前提下小步收，收不动就保留散调。
5. **低收益单点复核**（风险：低）：tmpSeq/lastPersistAt 等单点写入，评估后允许永久保留散调。
6. **全量回归**（风险：低）。

目标：84 → ≤60；battleState/信号两类高危点「允许不收」，以可度量下降为准、不强求清零。

## 第 5 批（可选收尾）：兼容壳 battle.runtime.js——预估 1-2 步，默认不做

- 现状 `export *` 转发五个属地，是全部消费者的统一导入面。两选项：
  a) **保持壳**（推荐）：零风险，聚合导出自动透出，无需改任何 import；
  b) 按属地直导：需改 6 个属地文件的 import 行，并同步 `scripts/architecture-graph.mjs` 的
  `RUNTIME_SURFACE` 判据键 + `deadGuardKeys` 自检，改动面大、收益仅是去掉一层转发。
- 风险：中（触碰全部属地导入面与守卫键）。无明确需求不动。

## 全局约束（每批必须遵守）

1. 聚合必须在域模块内直接赋值域内 `let`（ESM 活绑定），不得经拷贝中转。
2. 跨域语句相对顺序不变；只有「同域独立赋值」允许在聚合内换序。
3. 只聚「整组重置/还原/成对清理簇」，拒绝 1:1 改名式伪聚合；聚不动的点明确记录保留散调。
4. 不改 save schema、不改测试契约、不增删 engine 具名导出面；仅新增模块文件时才同步
  `architecture-graph.mjs` 白名单（RUNTIME_INNER/RUNTIME_OWNERS），并保证 `deadGuardKeys` 零命中失败。
5. 每批验收 = `node --check` 全绿 + battle 定向过滤全绿 + 全量 814 全绿
  （`node node_modules/vitest/vitest.mjs run --no-file-parallelism`，node 直调不用 npx）。

## 附：复测脚本口径

从各域文件抽取 `export function (set$\w+)` 名单；对 `game/src` 其余 `.js`（排除该域声明文件与
`battle.runtime.js`）按 `setter + '('` 精确子串计数求和，即该域「域外 set$ 调用点」。
试点前后数字：presentation 19 → 0；piles 56 → 19；interaction/effects/session 各 87/98/84（未动）。
