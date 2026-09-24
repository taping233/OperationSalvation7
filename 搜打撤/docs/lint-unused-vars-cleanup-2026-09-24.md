# no-unused-vars 删除报批清单（2026-09-24 生成）

- 依据：`npm run lint`（eslint@10.11.0，flat config）对 `game/src` + `tests` 的现场输出
- 现场：no-undef / no-dupe-else-if / no-useless-escape / no-constant-condition / no-empty / no-useless-assignment / no-regex-spaces 已于 2026-09-23 批次清零，本清单为**剩余全部错误**
- 项数：**443**（含 lint-baseline-2026-09-23 之后新增的 1 项：`game/src/hub/game.bag.js:353 closeCardZoom`——739/740 作用域修复后，外层该副本成为真·未使用）
- **本清单只是报批，未删除任何代码**。批准后按"建议动作"逐项执行；每删一批需重跑相关测试。

## 口径（类别 → 建议动作约定）

| 类别 | 含义 | 默认建议 |
| --- | --- | --- |
| 未用 import | 导入后整个文件未引用 | 删（tests 里可能为触发模块副作用而导入，删前确认） |
| 未用变量 | 声明后未读（含解构成员） | 删；初始化器含函数调用的标"删绑定"，确认副作用后再处理 |
| 未用函数 | 模块内 function 声明无调用方 | 删（确认无字符串/事件名反射调用） |
| 未用参数 | 函数签名参数未被函数体使用 | 默认改 `_` 前缀；**接口占位/签名文档价值（如回调约定参数位）标"保留"** |
| 未用参数（catch） | catch 子句绑定未用 | 改 `_` 前缀或删绑定 |
| 仅赋值未读 | 赋值后从未被读取 | 删该赋值 |

## 按类别统计

| 类别 | 项数 |
| --- | --- |
| 未用 import | 267 |
| 未用参数（catch） | 99 |
| 仅赋值未读 | 50 |
| 未用参数 | 13 |
| 未用函数 | 7 |
| 未用变量 | 7 |
| **合计** | **443** |

## battle 域专节（重构遗留死代码重点审查区）

battle 域共 **238 项**（16 个文件）。该域经历 6-A/6-B/批5 等多轮机械拆分与状态容器化（battle.runtime.js 的 export let + set$Xxx 模式），注意三类坑：

1. **battle.core.js:16 / battle.engine.js:6 的巨型 import 行**：从 battle.runtime.js 一次导入约 250 个状态名与 set$Xxx setter，其中大量未用——这些是拆分时"整行搬运"留下的，删除未用名字是本清单里收益最大的一批；但**同一行上的名字可能被同文件的间接引用（eval 无、模板串有）用到，删前逐名搜索确认**。
2. **set$Xxx 导入未用**：setter 化改造（ESM 导入绑定不可赋值）后的残留，删除安全度高，仍需确认该状态确实不经此文件写。
3. **参数占位**：battle 引擎大量 `function resolveCard(card, target, fromX, fromY)` 式签名，未用参数往往是调用约定占位——**默认改 `_` 前缀而不是删**，除非确认无位置传参依赖。

明细见下方按文件分组中 `game/src/battle/` 各节。

## 明细（按文件分组）

### game/src/audio/sound.js（11 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `e` | 38 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 42 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 361 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 411 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 418 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 491 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 499 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 504 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 528 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 533 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 538 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/audio/sound.scape.js（3 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `_` | 96 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 96 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 97 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/battle/battle.aim.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `uiRect` | 5 | 未用 import | 删 |
| `err` | 240 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/battle/battle.anim.js（6 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `uiScale` | 5 | 未用 import | 删 |
| `attachUnitFrames` | 7 | 未用 import | 删 |
| `hideUnitFrames` | 7 | 未用 import | 删 |
| `frameCacheStats` | 7 | 未用 import | 删 |
| `e` | 88 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 98 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/battle/battle.core.js（167 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `esc` | 3 | 未用 import | 删 |
| `escAttr` | 4 | 未用 import | 删 |
| `createEffectExecutor` | 5 | 未用 import | 删 |
| `splitEffectClauses` | 5 | 未用 import | 删 |
| `consumeTriggerTexts` | 5 | 未用 import | 删 |
| `shuffleCards` | 6 | 未用 import | 删 |
| `removeUid` | 7 | 未用 import | 删 |
| `isAreaEffect` | 8 | 未用 import | 删 |
| `targetSideFor` | 8 | 未用 import | 删 |
| `unplayableReasonFor` | 8 | 未用 import | 删 |
| `itemTargetSideFor` | 8 | 未用 import | 删 |
| `createActionQueue` | 10 | 未用 import | 删 |
| `beginTargeting` | 11 | 未用 import | 删 |
| `cancelTargeting` | 11 | 未用 import | 删 |
| `createBattleState` | 11 | 未用 import | 删 |
| `transitionBattle` | 11 | 未用 import | 删 |
| `Random` | 12 | 未用 import | 删 |
| `demoMs` | 14 | 未用 import | 删 |
| `busEmit` | 15 | 未用 import | 删 |
| `renderBattle` | 16 | 未用 import | 删 |
| `drawPile` | 16 | 未用 import | 删 |
| `discard` | 16 | 未用 import | 删 |
| `granted` | 16 | 未用 import | 删 |
| `played` | 16 | 未用 import | 删 |
| `consumed` | 16 | 未用 import | 删 |
| `grave` | 16 | 未用 import | 删 |
| `turn` | 16 | 未用 import | 删 |
| `pdef` | 16 | 未用 import | 删 |
| `discoverQueue` | 16 | 未用 import | 删 |
| `handSelecting` | 16 | 未用 import | 删 |
| `interaction` | 16 | 未用 import | 删 |
| `pendingHint` | 16 | 未用 import | 删 |
| `delayed` | 16 | 未用 import | 删 |
| `noDrawNext` | 16 | 未用 import | 删 |
| `viewingBag` | 16 | 未用 import | 删 |
| `presentationActionSeq` | 16 | 未用 import | 删 |
| `dreadShown` | 16 | 未用 import | 删 |
| `spellCost1` | 16 | 未用 import | 删 |
| `meleeCost1` | 16 | 未用 import | 删 |
| `consumeFireballN` | 16 | 未用 import | 删 |
| `lastDrawnUids` | 16 | 未用 import | 删 |
| `lastPlayedType` | 16 | 未用 import | 删 |
| `playedMartialThisTurn` | 16 | 未用 import | 删 |
| `playedMovesThisTurn` | 16 | 未用 import | 删 |
| `selPool` | 16 | 未用 import | 删 |
| `selShaN` | 16 | 未用 import | 删 |
| `sel` | 16 | 未用 import | 删 |
| `lastDeckSel` | 16 | 未用 import | 删 |
| `selectingDeck` | 16 | 未用 import | 删 |
| `selDeckMax` | 16 | 未用 import | 删 |
| `allies` | 16 | 未用 import | 删 |
| `growthNames` | 16 | 未用 import | 删 |
| `infuseFuels` | 16 | 未用 import | 删 |
| `sealUnlocked` | 16 | 未用 import | 删 |
| `extraTurn` | 16 | 未用 import | 删 |
| `deathSave` | 16 | 未用 import | 删 |
| `killAtkUp` | 16 | 未用 import | 删 |
| `poisonOnSpell` | 16 | 未用 import | 删 |
| `poisonLegacy` | 16 | 未用 import | 删 |
| `nestRunes` | 16 | 未用 import | 删 |
| `timeRune` | 16 | 未用 import | 删 |
| `unyieldRune` | 16 | 未用 import | 删 |
| `ashRune` | 16 | 未用 import | 删 |
| `unlimitedRune` | 16 | 未用 import | 删 |
| `holyRune` | 16 | 未用 import | 删 |
| `fireballRuneOn` | 16 | 未用 import | 删 |
| `freezeRuneOn` | 16 | 未用 import | 删 |
| `swiftRune` | 16 | 未用 import | 删 |
| `timeSpaceRune` | 16 | 未用 import | 删 |
| `timeSpaceUsed` | 16 | 未用 import | 删 |
| `armorMul` | 16 | 未用 import | 删 |
| `sealDone` | 16 | 未用 import | 删 |
| `playerCurseImmune` | 16 | 未用 import | 删 |
| `zeroFeeUntil` | 16 | 未用 import | 删 |
| `cardOverrides` | 16 | 未用 import | 删 |
| `equipped` | 16 | 未用 import | 删 |
| `restoringRestartCheckpoint` | 16 | 未用 import | 删 |
| `tmpSeq` | 16 | 未用 import | 删 |
| `activeActionSignal` | 16 | 未用 import | 删 |
| `surgeWaiter` | 16 | 未用 import | 删 |
| `lastPersistAt` | 16 | 未用 import | 删 |
| `snapCache` | 16 | 未用 import | 删 |
| `snapSig` | 16 | 未用 import | 删 |
| `set$lastDrawnUids` | 16 | 未用 import | 删 |
| `set$tmpSeq` | 16 | 未用 import | 删 |
| `set$noDrawNext` | 16 | 未用 import | 删 |
| `set$stealthStrike` | 16 | 未用 import | 删 |
| `set$nextSpellTwice` | 16 | 未用 import | 删 |
| `set$drawPile` | 16 | 未用 import | 删 |
| `set$maxEnergy` | 16 | 未用 import | 删 |
| `set$shaTransform` | 16 | 未用 import | 删 |
| `set$consumeFireballN` | 16 | 未用 import | 删 |
| `set$deathSave` | 16 | 未用 import | 删 |
| `set$hand` | 16 | 未用 import | 删 |
| `set$extraTurn` | 16 | 未用 import | 删 |
| `set$delayed` | 16 | 未用 import | 删 |
| `set$meleeCost1` | 16 | 未用 import | 删 |
| `set$spellCost1` | 16 | 未用 import | 删 |
| `set$surgeWaiter` | 16 | 未用 import | 删 |
| `set$sealUnlocked` | 16 | 未用 import | 删 |
| `set$discovering` | 16 | 未用 import | 删 |
| `set$G` | 16 | 未用 import | 删 |
| `set$battleRestartCheckpoint` | 16 | 未用 import | 删 |
| `set$opts` | 16 | 未用 import | 删 |
| `set$mode` | 16 | 未用 import | 删 |
| `set$battleState` | 16 | 未用 import | 删 |
| `set$foes` | 16 | 未用 import | 删 |
| `set$selPool` | 16 | 未用 import | 删 |
| `set$selShaN` | 16 | 未用 import | 删 |
| `set$sel` | 16 | 未用 import | 删 |
| `set$discard` | 16 | 未用 import | 删 |
| `set$granted` | 16 | 未用 import | 删 |
| `set$played` | 16 | 未用 import | 删 |
| `set$consumed` | 16 | 未用 import | 删 |
| `set$grave` | 16 | 未用 import | 删 |
| `set$turn` | 16 | 未用 import | 删 |
| `set$busy` | 16 | 未用 import | 删 |
| `set$pdef` | 16 | 未用 import | 删 |
| `set$pstat` | 16 | 未用 import | 删 |
| `set$infusing` | 16 | 未用 import | 删 |
| `set$discoverQueue` | 16 | 未用 import | 删 |
| `set$handSelecting` | 16 | 未用 import | 删 |
| `set$presentationActionSeq` | 16 | 未用 import | 删 |
| `set$choosing` | 16 | 未用 import | 删 |
| `set$lastPlayedType` | 16 | 未用 import | 删 |
| `set$selectingDeck` | 16 | 未用 import | 删 |
| `set$viewingBag` | 16 | 未用 import | 删 |
| `set$allies` | 16 | 未用 import | 删 |
| `set$growthNames` | 16 | 未用 import | 删 |
| `set$growth` | 16 | 未用 import | 删 |
| `set$infuseFuels` | 16 | 未用 import | 删 |
| `set$killAtkUp` | 16 | 未用 import | 删 |
| `set$poisonOnSpell` | 16 | 未用 import | 删 |
| `set$poisonLegacy` | 16 | 未用 import | 删 |
| `set$zeroFeeUntil` | 16 | 未用 import | 删 |
| `set$cardOverrides` | 16 | 未用 import | 删 |
| `set$sealDone` | 16 | 未用 import | 删 |
| `set$playerCurseImmune` | 16 | 未用 import | 删 |
| `set$allSpellsInfused` | 16 | 未用 import | 删 |
| `set$nestRunes` | 16 | 未用 import | 删 |
| `set$nestSyn` | 16 | 未用 import | 删 |
| `set$timeRune` | 16 | 未用 import | 删 |
| `set$arrowRune` | 16 | 未用 import | 删 |
| `set$unyieldRune` | 16 | 未用 import | 删 |
| `set$ashRune` | 16 | 未用 import | 删 |
| `set$unlimitedRune` | 16 | 未用 import | 删 |
| `set$holyRune` | 16 | 未用 import | 删 |
| `set$fireballRuneOn` | 16 | 未用 import | 删 |
| `set$freezeRuneOn` | 16 | 未用 import | 删 |
| `set$swiftRune` | 16 | 未用 import | 删 |
| `set$timeSpaceRune` | 16 | 未用 import | 删 |
| `set$timeSpaceUsed` | 16 | 未用 import | 删 |
| `set$armorMul` | 16 | 未用 import | 删 |
| `set$freeCast` | 16 | 未用 import | 删 |
| `set$equipped` | 16 | 未用 import | 删 |
| `set$playedMartialThisTurn` | 16 | 未用 import | 删 |
| `set$playedMovesThisTurn` | 16 | 未用 import | 删 |
| `set$selDeckMax` | 16 | 未用 import | 删 |
| `set$lastDeckSel` | 16 | 未用 import | 删 |
| `set$lastPersistAt` | 16 | 未用 import | 删 |
| `set$activeActionSignal` | 16 | 未用 import | 删 |
| `set$restoringRestartCheckpoint` | 16 | 未用 import | 删 |
| `set$snapSig` | 16 | 未用 import | 删 |
| `set$snapCache` | 16 | 未用 import | 删 |
| `swapCardCosts` | 17 | 未用 import | 删 |
| `snapshotSignature` | 17 | 未用 import | 删 |
| `afterEnemies` | 18 | 未用 import | 删 |

### game/src/battle/battle.enemy-phase.js（8 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `beginTargeting` | 5 | 未用 import | 删 |
| `createBattleState` | 5 | 未用 import | 删 |
| `pendingHint` | 9 | 未用 import | 删 |
| `playedMartialThisTurn` | 9 | 未用 import | 删 |
| `freeCast` | 9 | 未用 import | 删 |
| `lastPersistAt` | 9 | 未用 import | 删 |
| `cancelInteraction` | 10 | 未用 import | 删 |
| `flee` | 10 | 未用 import | 删 |

### game/src/battle/battle.engine.js（10 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `noDrawNext` | 6 | 未用 import | 删 |
| `extraTurn` | 6 | 未用 import | 删 |
| `timeRune` | 6 | 未用 import | 删 |
| `fireballRuneOn` | 6 | 未用 import | 删 |
| `swiftRune` | 6 | 未用 import | 删 |
| `timeSpaceRune` | 6 | 未用 import | 删 |
| `timeSpaceUsed` | 6 | 未用 import | 删 |
| `_` | 1174 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `freeCastTarget` | 1402 | 未用函数 | 删（确认无字符串/反射调用） |
| `foe` | 2154 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/battle/battle.frames.js（7 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `_` | 61 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 63 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 81 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 116 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 145 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 224 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 235 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/battle/battle.hand.js（6 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `UNIT` | 29 | 仅赋值未读 | 删该赋值 |
| `SPREAD` | 30 | 仅赋值未读 | 删该赋值 |
| `Y_BIAS` | 31 | 仅赋值未读 | 删该赋值 |
| `MAX_ROT` | 32 | 仅赋值未读 | 删该赋值 |
| `FAN10` | 34 | 仅赋值未读 | 删该赋值 |
| `rowScale` | 47 | 未用函数 | 删（确认无字符串/反射调用） |

### game/src/battle/battle.layers.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `uiScale` | 5 | 未用 import | 删 |
| `groupHandCards` | 9 | 未用 import | 删 |

### game/src/battle/battle.overlays.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `opts` | 20 | 仅赋值未读 | 删该赋值 |

### game/src/battle/battle.pace.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `e` | 12 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 19 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/battle/battle.preview.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `mode` | 32 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/battle/battle.vfx.js（5 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `setPace` | 7 | 未用 import | 删 |
| `attachUnitFrames` | 9 | 未用 import | 删 |
| `hideUnitFrames` | 9 | 未用 import | 删 |
| `frameCacheStats` | 9 | 未用 import | 删 |
| `listIdx` | 185 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/battle/battle.view.js（18 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `uiScale` | 6 | 未用 import | 删 |
| `fanLayout` | 10 | 未用 import | 删 |
| `demoMs` | 11 | 未用 import | 删 |
| `playUnitFrames` | 13 | 未用 import | 删 |
| `handSuspended` | 16 | 未用 import | 删 |
| `battleToken` | 16 | 未用 import | 删 |
| `clickSelectedUid` | 19 | 未用 import | 删 |
| `resolveSlam` | 28 | 仅赋值未读 | 删该赋值 |
| `resolveDart` | 29 | 仅赋值未读 | 删该赋值 |
| `flee` | 31 | 仅赋值未读 | 删该赋值 |
| `closeBagCmd` | 36 | 仅赋值未读 | 删该赋值 |
| `useItemCmd` | 38 | 仅赋值未读 | 删该赋值 |
| `closeGrave` | 43 | 仅赋值未读 | 删该赋值 |
| `selectDeckCard` | 44 | 仅赋值未读 | 删该赋值 |
| `confirmDeck` | 50 | 仅赋值未读 | 删该赋值 |
| `cancelDeck` | 51 | 仅赋值未读 | 删该赋值 |
| `pdef` | 109 | 仅赋值未读 | 删该赋值 |
| `pendingHint` | 111 | 仅赋值未读 | 删该赋值 |

### game/src/battle/effect-steps.audit.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `m` | 144 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/battle/effect-steps.curse.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `m` | 11 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/battle/effect-steps.kills.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `m` | 263 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/cards/card-photo-notes.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `_` | 26 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 38 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/cards/cards.data.js（4 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `KEY` | 3 | 未用 import | 删 |
| `TT10_KEY` | 3 | 未用 import | 删 |
| `TT11_KEY` | 3 | 未用 import | 删 |
| `RETIRE_TT11` | 3 | 未用 import | 删 |

### game/src/cards/cards.js（12 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `characterName` | 4 | 未用 import | 删 |
| `TT7_KEY_V2` | 50 | 未用 import | 删 |
| `TT10_KEY` | 50 | 未用 import | 删 |
| `TT11_KEY` | 50 | 未用 import | 删 |
| `ITEM_RENAME_KEY` | 50 | 未用 import | 删 |
| `EVENTS_0919_KEY` | 50 | 未用 import | 删 |
| `RETIRE_TT10` | 50 | 未用 import | 删 |
| `RETIRE_TT11` | 50 | 未用 import | 删 |
| `CC_KEY` | 50 | 未用 import | 删 |
| `CLASSES` | 50 | 未用 import | 删 |
| `e` | 64 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 97 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/cards/cards.rules.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `cardHTML` | 6 | 未用 import | 删 |

### game/src/cards/cards.sync.js（20 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `KEY` | 4 | 未用 import | 删 |
| `TT8_KEY` | 4 | 未用 import | 删 |
| `e` | 177 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 223 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 251 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 267 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 289 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 304 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 321 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 344 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 478 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 499 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 512 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 587 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 608 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 743 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 785 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 823 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 831 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 854 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/cards/cards.view.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `e` | 40 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 59 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/core/art.js（10 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `BUILD_VERSION` | 5 | 未用 import | 删 |
| `_` | 96 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 319 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 362 | 未用变量 | 删 |
| `_` | 364 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 365 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 366 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 368 | 未用变量 | 删 |
| `_` | 424 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 539 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/core/icons-bitmap.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `BUILD_VERSION` | 3 | 未用 import | 删 |
| `_` | 112 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/core/input.js（4 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `e` | 35 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `prev` | 52 | 仅赋值未读 | 删该赋值 |
| `e` | 60 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 65 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/core/motion.js（4 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `_` | 10 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 26 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 37 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 63 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/core/notes.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `SDT` | 3 | 仅赋值未读 | 删该赋值 |
| `e` | 8 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/core/renderer.icons.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `t` | 32 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/core/renderer.js（3 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `walked` | 316 | 仅赋值未读 | 删该赋值 |
| `t` | 335 | 仅赋值未读 | 删该赋值 |
| `drawAltarCircle` | 417 | 未用函数 | 删（确认无字符串/反射调用） |

### game/src/game.boot.js（4 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `quitGame` | 6 | 未用 import | 删 |
| `atk` | 215 | 仅赋值未读 | 删该赋值 |
| `e` | 567 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 693 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/hub/base.js（16 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `e` | 151 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 157 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 179 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 197 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 204 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e2` | 231 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 246 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 248 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e2` | 253 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e2` | 266 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 269 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 319 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 338 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 345 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 351 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 352 | 未用变量 | 删 |

### game/src/hub/game.bag.drag.js（4 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `doDeath` | 8 | 未用 import | 删 |
| `newUid` | 8 | 未用 import | 删 |
| `safeUsed` | 8 | 未用 import | 删 |
| `usedSlots` | 8 | 未用 import | 删 |

### game/src/hub/game.bag.js（5 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `doDeath` | 7 | 未用 import | 删 |
| `busOn` | 9 | 未用 import | 删 |
| `showRunTransition` | 11 | 未用 import | 删 |
| `showBagCardDetail` | 328 | 未用函数 | 删（确认无字符串/反射调用） |
| `closeCardZoom` | 353 | 仅赋值未读 | 删该赋值 |

### game/src/hub/game.bag.settle.js（4 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `cardStacks` | 7 | 未用 import | 删 |
| `newUid` | 7 | 未用 import | 删 |
| `safeUsed` | 7 | 未用 import | 删 |
| `usedSlots` | 7 | 未用 import | 删 |

### game/src/hub/game.cardslib.js（5 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `TYPE_ICON` | 23 | 仅赋值未读 | 删该赋值 |
| `_` | 60 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 69 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 412 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 1098 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/hub/game.hub.depart.js（5 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `getActiveSlot` | 9 | 未用 import | 删 |
| `setLobby` | 9 | 未用 import | 删 |
| `showTitle` | 9 | 未用 import | 删 |
| `configureCardNavigation` | 10 | 未用 import | 删 |
| `B` | 82 | 仅赋值未读 | 删该赋值 |

### game/src/hub/game.hub.js（9 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `escAttr` | 7 | 未用 import | 删 |
| `MODES` | 8 | 未用 import | 删 |
| `newRun` | 8 | 未用 import | 删 |
| `requestClassChoice` | 8 | 未用 import | 删 |
| `Random` | 10 | 未用 import | 删 |
| `convertCollection` | 12 | 未用 import | 删 |
| `getCharacter` | 12 | 未用 import | 删 |
| `stackKeyOf` | 12 | 未用 import | 删 |
| `validateLastLampState` | 16 | 未用 import | 删 |

### game/src/hub/game.hub.pages.js（13 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `CHARACTERS` | 7 | 未用 import | 删 |
| `MODES` | 11 | 未用 import | 删 |
| `getActiveSlot` | 11 | 未用 import | 删 |
| `newRun` | 11 | 未用 import | 删 |
| `requestClassChoice` | 11 | 未用 import | 删 |
| `setLobby` | 11 | 未用 import | 删 |
| `showTitle` | 11 | 未用 import | 删 |
| `configureCardNavigation` | 12 | 未用 import | 删 |
| `readBaseReceipt` | 14 | 未用 import | 删 |
| `commitBase` | 14 | 未用 import | 删 |
| `getCollection` | 15 | 未用 import | 删 |
| `selectSkin` | 15 | 未用 import | 删 |
| `presentHome` | 16 | 未用 import | 删 |

### game/src/hub/game.notes.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `e` | 119 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/hub/meta.js（5 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `mergeLegacyClasses` | 16 | 仅赋值未读 | 删该赋值 |
| `e` | 39 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 140 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 263 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `e` | 379 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### game/src/run/game.nest.js（3 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `escAttr` | 15 | 未用 import | 删 |
| `rollRuneKind` | 20 | 未用 import | 删 |
| `consumed` | 287 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/run/game.run.altar.js（3 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `tone` | 12 | 未用 import | 删 |
| `cardHTML` | 24 | 未用 import | 删 |
| `def` | 558 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/run/game.run.flow.js（3 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `tone` | 8 | 未用 import | 删 |
| `_` | 33 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `altarE` | 111 | 仅赋值未读 | 删该赋值 |

### game/src/run/game.run.scenes.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `tone` | 12 | 未用 import | 删 |
| `openScene` | 116 | 未用函数 | 删（确认无字符串/反射调用） |

### game/src/run/game.session.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `hasSlot` | 413 | 仅赋值未读 | 删该赋值 |

### game/src/run/lab.ending.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `e` | 44 | 未用变量 | 删 |

### game/src/ui/game.menu.js（11 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `syncPlayTime` | 6 | 仅赋值未读 | 删该赋值 |
| `clearSave` | 6 | 仅赋值未读 | 删该赋值 |
| `hasRun` | 7 | 仅赋值未读 | 删该赋值 |
| `e` | 12 | 未用变量 | 删 |
| `e` | 13 | 未用变量 | 删 |
| `_` | 197 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 247 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 258 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `_` | 264 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |
| `d` | 888 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |
| `btn` | 888 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/ui/route-overlay.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `seed` | 49 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### game/src/ui/ui.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `characterName` | 1 | 未用 import | 删 |
| `_` | 945 | 未用参数（catch） | 改 _ 前缀或删 catch 绑定 |

### tests/abyss-sovereign.test.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `filler` | 74 | 仅赋值未读 | 删该赋值 |
| `g` | 177 | 仅赋值未读 | 删该赋值 |

### tests/bag-structured-rule-migration.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `save` | 119 | 仅赋值未读 | 删该赋值 |

### tests/base-meta.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `store` | 20 | 仅赋值未读 | 删该赋值 |

### tests/battle-resolution.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `count` | 14 | 未用参数 | 改 _ 前缀；若为接口占位/签名文档则保留 |

### tests/boot.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `beforeAll` | 5 | 未用 import | 删（先确认非副作用导入） |

### tests/boss-equip-select.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `max` | 101 | 仅赋值未读 | 删该赋值 |

### tests/cursed-blade.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `specOf` | 79 | 仅赋值未读 | 删该赋值 |

### tests/direct-cast.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `_` | 59 | 未用变量 | 删 |

### tests/dual-wield.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `end` | 80 | 仅赋值未读 | 删该赋值 |

### tests/ember-burst-rot-seed.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `viewApi` | 15 | 仅赋值未读 | 删该赋值 |

### tests/extraction-session-resume.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `copy` | 27 | 仅赋值未读 | 删该赋值 |

### tests/hero-cards.test.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `plainSpell` | 37 | 仅赋值未读 | 删该赋值 |
| `s` | 382 | 仅赋值未读 | 删该赋值 |

### tests/lava-blast.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `playByName` | 65 | 未用函数 | 删（确认无字符串/反射调用） |

### tests/mana-surge.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `end` | 89 | 仅赋值未读 | 删该赋值 |

### tests/message-fixes.test.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `uid` | 94 | 仅赋值未读 | 删该赋值 |
| `o` | 94 | 仅赋值未读 | 删该赋值 |

### tests/nest-hearts.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `viewApi` | 8 | 仅赋值未读 | 删该赋值 |

### tests/nest-runemaster.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `synergyOf` | 3 | 未用 import | 删（先确认非副作用导入） |

### tests/playthrough-bot.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `battle` | 47 | 未用函数 | 删（确认无字符串/反射调用） |

### tests/r5b-route-overlay.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `swap` | 16 | 仅赋值未读 | 删该赋值 |

### tests/rapid-fire.test.js（2 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `viewApi` | 14 | 仅赋值未读 | 删该赋值 |
| `afterCombo` | 153 | 仅赋值未读 | 删该赋值 |

### tests/structured-onplay-battle.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `Random` | 3 | 未用 import | 删（先确认非副作用导入） |

### tests/tt12-hitechrd-structured.test.js（1 项）

| 标识符 | 行号 | 类别 | 建议动作 |
| --- | --- | --- | --- |
| `rules` | 111 | 仅赋值未读 | 删该赋值 |

## 执行注意事项（批准后适用）

1. **每次只清一个文件/一组同域文件**，删后跑该域测试；battle/hub 改动收尾时全量 `npx vitest run --no-file-parallelism`。
2. `game/src/cards/mech-sentences.js`、`game/src/run/map-graph.js` 等并行会话占用文件以现场为准，删前先 `git status --short` 复核所有权。
3. 带注释说明"保留以稳定接口面"的项（如壳文件的再导出），本清单若有误报（实际被模板字符串/动态特征使用），执行时标"保留并说明"跳过。
4. eslint 的 no-unused-vars 不感知运行时字符串调用（UI.act 名、事件名、selftest 关键词测试），tests 里 `关键词用例` 可能引用标识符字符串——删函数前先全仓 `rg` 同名。
