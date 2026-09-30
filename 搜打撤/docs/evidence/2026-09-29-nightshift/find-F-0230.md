# find-F-0230 —— 开采者 F：STS2 源码对照第三批（敌人意图 + 地图生成）

- 时间：2026-09-29 夜班；HEAD 时点工作树只读调研，未做任何 git/依赖写操作。
- 本项目侧：`game/src/battle/core/battle.enemy-intent.js`、`battle.enemy-phase.js`、`battle.engine.js`、`battle.lifecycle.js`、`battle/core/combat.js`、`run/map-generator.js`、`run/layeredMap.js`、`run/game.nest.js`。
- STS2 参照侧：`MegaCrit.Sts2.Core.Models/MonsterModel.cs`、`MegaCrit.Sts2.Core.MonsterMoves.Intents/*`、`MegaCrit.Sts2.Core.Combat/CombatManager.cs`、`MegaCrit.Sts2.Core.Entities.Creatures/Creature.cs`、`MegaCrit.Sts2.Core.Map/StandardActMap.cs`、`MapPathPruning.cs`（v0.107.1 反编译）。

---

## 方向 1：敌人意图（3 条）

### F1 | P2 | `noFirstAttack` 只写进行动判定，意图模型缺失——首回合显示攻击预告、实际蓄力（确定性复现）
- 本项目 `game/src/battle/core/battle.enemy-intent.js:14`：
  `if (def.evenAttack && ((round || 1) % 2 === 1)) {`
  ——意图计算只有 `evenAttack` 蓄力分支，无 `noFirstAttack` 分支；round=1 时落到 line 19 返回攻击意图：`return { kind, icon: meta[0], label: meta[1], damage: atk + bleed, hits, bleedBonus: bleed };`
- 本项目 `game/src/battle/core/battle.enemy-phase.js:169`（行动侧真实判定）：
  `if (foe.noFirstAttack && turn === 1) {`
  ——实际跳过攻击（「第一回合蓄力，不会攻击」）。
- 数据侧 `game/src/run/game.nest.js:58`：`dragon: { id: 'nest-dragon', name: '巨龙', hp: 40, atk: 7, noFirstAttack: true,`；`game.nest.js:67`：`{ id: 'nest-ancient-dragon', name: '远古龙尊', hp: 99, atk: 9, noFirstAttack: true, phases: true, boss: true },`——初始意图在 `battle.lifecycle.js:234`：`f.intent = intentFor(f, 1);` 注入，round=1 命中缺口。
- STS2 参照 `MonsterModel.cs:415-417`（决策段）：
  `public void RollMove(IEnumerable<Creature> targets)`
  `NextMove = MoveStateMachine.RollMove(targets, Creature, RunRng.MonsterAi);`
  公示读同一 `NextMove`（`MonsterModel.cs:241`：`public bool IntendsToAttack => NextMove.Intents.Any(...)`），蓄力/沉睡在 STS2 是独立非攻击 MoveState（Intents 目录含 `StunIntent.cs`/`SleepIntent.cs`），公示什么就执行什么。
- 差距：本项目意图模型与执行判定是两套独立 if，`noFirstAttack` 只写进行动侧；巢穴龙首回合玩家看到「攻击 N」角标、实际敌人不动。
- 建议修法：`calculateEnemyIntent` 增加 `def.noFirstAttack && (round||1) === 1` 分支返回蓄力意图（与 evenAttack 同款）。

### F2 | P2 | 意图伤害是回合末快照数字，玩家回合内削攻（atkDown）/流血变化不反映——「显示 A 实打 B」窗口
- 本项目 `game/src/battle/core/battle.enemy-phase.js:326`（唯一刷新点，回合末）：
  `foes.forEach(foe => { if (!foe.dead) foe.intent = intentFor(foe, turn); });`
  `game/src/battle/core/battle.enemy-intent.js:18-19`：`const atk = Math.max(0, def.atk || 0);` → `damage: atk + bleed` 存为数字快照。
- 实际执行读实时值 `game/src/battle/core/battle.engine.js:1338-1340`：
  `function playerTakeHit(foe) {`
  `const r = Combat.dealDamage({ atk: foe.atk }, playerRef, 0, Combat.TYPES.ATTACK);`
  ——`foe.atk` 取行动时值；而 atkDown 是玩家可挂敌人的诅咒（`battle/bag/battle.bag.js:200` 敌人诅咒清单含 `'atkDown'`、`'bleed'`）。
- STS2 参照 `AttackIntent.cs:23`：`public Func<decimal>? DamageCalc { get; protected set; }`；`SingleAttackIntent.cs:21`：`base.DamageCalc = damageCalc;`（构造接收闭包）；显示时现算 `SingleAttackIntent.cs:32`：`float num = GetTotalDamage(targets, owner);`，且 `AttackIntent.cs:90` 现场过 hook：`num = Hook.ModifyDamage(..., DamageCalc(), ValueProp.Move, ...)`——力量/虚弱变化即时流入公示数字；每回合 `Creature.cs:551-553`（PrepareForNextTurn）：`Monster.RollMove(targets2);` + `NCombatRoom.Instance?.GetCreatureNode(this)?.RefreshIntents();`，外部改招 `MonsterModel.cs:420-424`（SetMoveImmediate）也强制 `RefreshIntents()`。
- 差距：本项目意图数字为快照、行动伤害为实时；玩家在自己回合削弱敌人后，角标数字纹丝不动，敌人阶段实伤低于预告。
- 建议修法：意图 `damage` 改存惰性取值（渲染时按 `foe.atk`+`pstat.status.bleed` 现算），或在改变 `foe.atk`/玩家 bleed 的效果落点同步重算该敌人 intent。

### F3 | P3 | 冰冻敌人的意图仍显示攻击预告（意图不感知 freeze/stun）
- 本项目 `game/src/battle/core/battle.enemy-phase.js:173`：`if (!Combat.canAct(foe)) {` ——被冰冻敌人整轮不动；判定在 `game/src/battle/core/combat.js:274`：`return !((target.status.freeze || 0) > 0);`。玩家可给敌人挂 freeze（`battle.bag.js:200` 清单含 `'freeze'`），而意图只在回合末刷新且 `calculateEnemyIntent` 无 freeze 感知——玩家回合内挂冰冻后角标仍是「攻击 N」。
- STS2 参照：Intents 目录内建 `StunIntent.cs`/`SleepIntent.cs`/`HiddenIntent.cs`，状态机切到非攻击状态即经 `MonsterModel.cs:424`：`NextMove = state;` → `:429`：`TaskHelper.RunSafely(creatureNode.RefreshIntents());` 立即换图标。
- 差距：本项目冰冻只挡行动不改公示，与 F1/F2 同属「公示与行动脱钩」家族。
- 建议修法：意图渲染层对 `foe.status.freeze > 0` 覆盖显示「无法行动」，或在给敌人挂 freeze 的落点重算其 intent。

（查证口径：`evenAttack` 两侧口径一致无缺口——意图侧 `battle.enemy-intent.js:14` 与行动侧 `battle.enemy-phase.js:165` 同式；额外回合路径 `battle.enemy-phase.js:69` 的意图刷新与主路径口径一致，未列为发现。）

---

## 方向 2：地图生成（2 条）

### F4 | P3 | 生成失败为硬 throw、调用方无兜底；STS2 为原位修复（PruneAndRepair）永不失败
- 本项目 `game/src/run/map-generator.js:286`：
  ``throw new Error(`地图生成失败：${MAX_ATTEMPTS} 次候选均未通过质量校验（${lastIssues.join('；')}）`); }``
  重试上限 `map-generator.js:17`：`const MAX_ATTEMPTS = 8;`；两个调用方均无 catch——`run/layeredMap.js:10`：`const generated = generateLayeredMap(seed);`、`ui/route-overlay.js:66`：`const raw=rawLayers(draft), quality=validateGeneratedMap(raw);`。一旦种子连败 8 次（含 makeLayer 内 `候选网格无法扩展到目标节点数` 抛错），对局创建/路线预览路径直接异常。
- STS2 参照 `StandardActMap.cs:100-104`：
  `GenerateMap();`
  `AssignPointTypes();`
  `MapPathPruning.PruneAndRepair(Grid, startMapPoints, this, _pointTypeCounts, _rng, IsValidPointType);`
  `MapPathPruning.cs:22`：`public static void PruneAndRepair(...)`——注释（:17-20）「Prunes duplicate segments, then repairs any point types that fell below their target count... loops until stable (up to 3 iterations)」，配合 `RepairPointType` 把不足的目标格型回补到 Monster 格上，构造完成即合法，不重掷种子、不抛错。
- 差距：本项目靠「重掷种子+质量门」的拒绝采样，失败即崩；STS2 靠「生成后修复」的构造性保证。
- 建议修法：`generateLayeredMap` 末次尝试改为「取 issues 最少候选+强制修复违规格型」，或 `createLayeredMap`/调用层 catch 后退化固定安全种子。

### F5 | P4 | `altarEntrances` 恒为空的遗留字段链 + 「第五层」过期注释误导后来者
- 本项目 `game/src/run/map-generator.js:204`：`let altarEntrances = [];`（从未填充），`:246` 随层返回；6 处消费方均 `|| []` 兜底（`core/renderer.js:246`、`run/game.run.scenes.js:61`、`game.boot.js:383`、`run/map-graph.js:53` 的 `(ld.altarEntrances || []).forEach(a => link(key(li, a.at), key(-1, 0)));` 死接驳、`ui/route-overlay.js:14`、`run/map-snapshot.js:32`）；且 `map-snapshot.js:102` 反向校验 `if(layer.altarEntrances.length) return fail('INVALID_MAP_SNAPSHOT','3/9 地图不应含旧中央祭坛入口',{layer:li});`。同文件 `map-generator.js:134` 注释「第五层走终局撤离点」与现状四层（`map-generator.js:8`：`const TARGETS = [7, 12, 17, 17];`）不符，系旧五层布局残留。
- STS2 参照：无对应遗留物——`MegaCrit.Sts2.Core.Map/` 各 ActMap（`ActMap.cs`/`SavedActMap.cs`/`SpoilsActMap.cs`）均为当前结构在用字段。
- 差距：纯死代码/文档漂移，运行时无害（全部兜底），但 `map-graph.js:53` 的接驳死代码与「第五层」注释会误导后续地图开发。
- 建议修法：单列清理批次删除 altarEntrances 字段链（6 消费方+快照校验）与过期注释，动前需老板拍板（涉及 `cards-sync` 之外的快照兼容面）。

---

## 参照模式（STS2 侧机制备忘，非缺陷）

- **意图三段链（决策→公示→执行同源）**：决策 `MonsterModel.cs:417` `NextMove = MoveStateMachine.RollMove(targets, Creature, RunRng.MonsterAi);`；公示读同一 `NextMove.Intents`，攻击数字为 `DamageCalc` 闭包显示时现算（`AttackIntent.cs:23`、`:86-90` 现算+hook）；执行 `CombatManager.cs:1079` `await nCreature.PerformIntent();` 执行的就是公示招式。状态变化强制同步：`SetMoveImmediate`→`RefreshIntents`（`MonsterModel.cs:420-429`）、`PrepareForNextTurn`→RollMove+RefreshIntents（`Creature.cs:551-553`）。首招即时公示：`CombatManager.cs:865` 在玩家侧回合生成怪物时即 `RollMove`。
- **地图生成流水线**：`StandardActMap.cs:100-106` GenerateMap → AssignPointTypes（五组分布约束：`_lowerMapPointRestrictions`/`_upperMapPointRestrictions`/`_parentMapPointRestrictions`/`_childMapPointRestrictions`/`_siblingPointTypeRestrictions`，`StandardActMap.cs:27-53`）→ `MapPathPruning.PruneAndRepair`（重复路径剪枝+格型数量修复，最多 3 轮）→ `CenterGrid`/`SpreadAdjacentMapPoints`/`StraightenPaths`（`:106-108`）。种子流 `StandardActMap.cs:113`：`new Rng(runState.Rng.Seed, $"act_{runState.CurrentActIndex + 1}_map")` 命名子流——与本项目 `map-generator.js:277` `rng(`${seed}:layer:${li}`)` 同思路。
- **本项目侧查证后认为已达标、无需改的**：①层间单门结构（每层唯一 door，`map-generator.js:277-279`）与 STS2 多路径 DAG 属设计差异，且 door 节点在 `SPECIAL` 集合被所有改型规则豁免、quality() 有层间门合法性+孤岛校验兜底；②首层/终层约束（L4 祭坛+首脑唯一性、入口出口不同、战斗/宝箱/事件数量）均入 quality() 校验，缺一重掷；③重开图种子一致性：`seed:layer:N`+`seed:attempt:N` 双层子流，代码版本不变则同种子同图，`LAYOUT_VERSION` bump 有意重生成旧档（注释明示）。

## 未发现问题声明（查证范围）

- 意图侧：`evenAttack` 蓄力口径（intent:14 ↔ enemy-phase:165）一致；额外回合意图刷新（enemy-phase:69）与主路径一致；`intentFor` 全部调用点（lifecycle:234、enemy-phase:69/:326、engine:127）已枚举，无遗漏刷新路径。
- 地图侧：spine 双 x=0 节点情形有邻接边保连通；growth 512 次上限失败即抛（归入 F4 同一失败面）；`minFacilityX` 生成侧（width≤4→1）与 quality 侧（maxX+1≤4→1）口径一致；L3 紧急撤离点落空情形被 LAYER_FLOORS 的事件/战斗下限结构性排除。
