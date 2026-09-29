# find-D-0100 —— STS2 源码对照第二批：战斗效果时序与竞态（开采者 D，2026-09-29 夜班）

对照基线：本项目 `game/src/battle/`（09-29 分层落库版，HEAD 待调度长核对）；参照 `D:\素材\杀戮尖塔2源码\sts2-decompiled\`（STS2 v0.107.1 反编译）。只读调研，除本单外无写入。

---

## 发现

### D-1 | P3 | 结构化 op 循环无「战斗已终局」短路：致死伤害后的余下 op 照常落状态

- **本项目** `game/src/battle/core/battle.exec-play.js:278`（结算完成之后才查胜利）：
  ```js
  if (!alive().length) { finish(true); return false; }
  ```
  其上游 `battle.exec-play.js:159` `await resolveCardWithFeedback(...)` 期间，`battle.resolution.js` 的 op 循环顺序执行 damage→heal/coins/draw/selfDamage，无任何步骤检查战斗是否已因前序 op 致死而结束。
- **STS2 参照** `MegaCrit.Sts2.Core.Commands/PowerCmd.cs:69`（每个 Apply 入口同款，DamageCmd/CardSelectCmd 亦然）：
  ```csharp
  if (CombatManager.Instance.IsEnding)
  {
      return null;
  }
  ```
- **差距**：STS2 的 Command 链在每个命令入口用 `IsEnding` 短路，战斗终局后余下命令全部中止；本项目同一张卡「先杀死全部敌人、后损失生命/抽牌/加币」时余下 op 仍全部落账（如致死段后的 `heal.selfDamage` 会在胜利结算前扣玩家血并计入战后 hp）。
- **建议**：op 循环每轮入口补一条「所有敌人已亡/玩家已亡则 break」守卫（语义对齐 STS2 IsEnding），或在 `resolveCardSteps` 段间检查。

### D-2 | P3 | 未知 onPlay op 中途 `throw` 无回滚：前序已结算、卡已离手，异常仅落 console

- **本项目** `game/src/battle/core/battle.resolution.js:997-999`（同款还有 :1073-1077 的 draw 分支）：
  ```js
  if (!['heal', 'armor', 'draw'].includes(operation.op)) {
    throw new TypeError(`Unsupported onPlay operation for card ${card.id || '<missing id>'}`);
  }
  ```
  上游 `battle.exec-play.js:283-285` 的 try/finally 无 catch：
  ```js
  } finally {
    if (activeActionSignal === signal) set$activeActionSignal(null);
  }
  ```
  最终 `battle/runtime/battle.action-runner.js:31-33`：
  ```js
  .catch(error => {
    if (error?.name !== 'BattleActionCancelledError') console.error(`[battle] ${label}异常：`, error);
  })
  ```
- **STS2 参照**：STS2 无「未知效果」这一失败类别（卡效是编译期 Command 链）；对应防线是入口守卫 + 文档化返回 null（`PowerCmd.cs:69-71` 及注释 `Can be null if: ... Something blocked application`），失败是逐命令可恢复的，不存在「结算到一半抛穿」。
- **差距**：能量已扣（exec-play.js:123）、卡已离手进 played/discard（124/126/151）、前序 op 已改状态后才 throw；无回滚、无失败标记，玩家侧表现为「卡没了效果只生效一半」。schema 入口拦截（resolution.js:18 注释的 complete-list boundary）使该 throw 理论上不可达，但一旦 schema 与运行时清单失配，落点就是半结算态。
- **建议**：保留炸出（与 resolveCopyRandom 的 deps.random 守卫同哲学）但补一条 vitest：遍历全卡库 schema op 清单与 resolution 运行时清单求差集，红在测试层而不是结算期。

### D-3 | P3 | 玩家 HP 受伤即时钳 0、死亡只在敌方回合管线判定：自己回合存在「0 血存活窗口」，无显式复活语义

- **本项目** `game/src/battle/core/battle.engine.js:140`：
  ```js
  G.hp = Math.max(0, G.hp - n);
  ```
  `finish(false)` 全部 8 处调用均在 `battle/core/battle.enemy-phase.js`（:90/:130/:156/:189 区间/:199/:253/:388/:400/:441），玩家自己回合内（含结构化 `heal.selfDamage`、文本 `dmg.negHp` 自伤）无任何死亡判定。唯一免死钩是黑暗吊坠 `deathSave`（engine.js:131-140，逐次致死伤害拦截）。
- **STS2 参照** `MegaCrit.Sts2.Core.Entities.Creatures/Creature.cs:206` + `:477-487`：
  ```csharp
  public bool IsAlive => CurrentHp > 0;
  ...
  public void HealInternal(decimal amount)
  {
      bool isDead = IsDead;
      SetCurrentHpInternal((decimal)CurrentHp + amount);
      if (isDead && !IsDead)
      {
          Player?.ActivateHooks();
          this.Revived?.Invoke(this);
      }
  }
  ```
  死亡本身是显式三段管线（`CreatureCmd.cs:503-507`）：`Hook.BeforeDeath` → `Hook.ShouldDie`（免死钩，out preventer）→ `InvokeDiedEvent`；玩家死亡走 `PlayerCmd.EndTurn(canBackOut: false)`（:476-478）。
- **差距**：STS2 不钳负血（`SetCurrentHpInternal` 只钳上限），死/活是可查询状态且治疗显式支持复活；本项目钳 0 + 只在敌方回合查死，净效果是「自己回合永远死不了、0 血可被同回合后续治疗拉回」，属隐式窗口而非声明语义——与 STS2 行为分叉但内部自洽，疑似设计取舍而非 bug。
- **建议**：在 `damagePlayer` 落 0 时打一条显式日志/状态（「命悬一线：本回合不会死亡」），把隐式窗口变成玩家可见规则；若要贴 STS2，再补回合内死亡判定 + 免死钩统一收口到 deathSave。

### D-4 | P3 | pickDiscover 无 battleActive/终局入口守卫，中断全靠 finish() 事后清场

- **本项目** `game/src/battle/effects/battle.discover-flow.js:132-135`：
  ```js
  function pickDiscover(index) {
    const state = interaction.get();
    if (!state) return;
  ```
  落牌路径（:169-179）直接 `addTempCard` + `queueCardExecution`，全程不查 `battleActive`；唯一中断路径是 `finish()` 里的 `set$discoverQueue([])` + `clearBattlePopups()`（`battle/core/battle.lifecycle.js:141` → `battle/runtime/battle.runtime.interaction.js:42-44` 清 `discovering`）。
- **STS2 参照** `MegaCrit.Sts2.Core.Commands/CardSelectCmd.cs:277`（同款 :333/:382/:818）：
  ```csharp
  if (CombatManager.Instance.IsEnding)
  ```
  且每个选择入口配 `NPlayerHand.Instance?.CancelAllCardPlay()` 与 `SignalPlayerChoiceBegun(PlayerChoiceOptions.CancelPlayCardActions)` 的显式取消契约。
- **差距**：本项目依赖「终局事后清场」而非「入口拒绝」——`pickDiscover` 若在 finish 之后被调（stale 渲染回调、`agent.policy.js:188-192` 自动选牌与终局转场竞态），会向已拆空的战场加临时牌并入队出牌。当前 UI 时序下难以触发，属防御缺口。
- **建议**：`pickDiscover` 入口补 `if (!getGame()?.battleActive) return;` 级守卫，与 STS2 IsEnding 同位。

---

## 未发现问题（含查证范围）

**方向 2：同名效果叠加/多层能力算术——未发现问题。**
查证范围：`game/src/battle/core/combat.js:177-192`（addCurse：stack 类 `Math.max(0, status[key] + n)` 求和、timed 类 `Math.max(status[key], n)` 取剩余较大值、NaN/负值兜底钳 1、noCurseKeys 免疫）、`:281-299`（addBlessing：value 类求和、timed 类取大、flag 类置 1；`__timedBuffs` 按来源独立记录到期回扣，:292 注释明确否决了「按 key 合并取最长」的旧做法）。算术自洽、兜底齐全，与 STS2 `FindExistingInstanceForStacking → ModifyAmount` 的「同实例叠量、异实例新建」模型无行为级差距。一处语义差异降级为参照模式（见 R-4），不作 bug 断言——combat.js 文件头声明该计时规则为设计者 2026-09-02 定版。

---

## 参照模式（STS2 好做法，单独记录）

- **R-1 Command 入口 IsEnding 短路**（`PowerCmd.cs:69`、`CardSelectCmd.cs:277` 等）：每条战斗命令/选择入口第一行检查战斗是否收尾，终局后一切余下结算静默中止——对应 D-1/D-4。
- **R-2 逐命令可恢复失败**（`PowerCmd.cs` Apply 文档注释）：`Can be null if: Combat is over / Something blocked application (like Artifact) / amount was changed to 0`——失败是返回值语义，不是异常，链上后续命令照常走——对应 D-2。
- **R-3 死亡三段式管线**（`CreatureCmd.cs:503-507`）：`Hook.BeforeDeath`（预告）→ `Hook.ShouldDie`（免死钩，可被道具/能力拦下，out preventer）→ `InvokeDiedEvent`（正式死亡）→ `ShouldCreatureBeRemovedFromCombatAfterDeath`（移除与否分离）——对应 D-3，本项目 deathSave 是它的单点特例。
- **R-4 玩家自施 debuff 的 SkipNextDurationTick**（`PowerCmd.cs:140-146`）：`target.Side == Player && Type == Debuff` 时置 `SkipNextDurationTick`，防「当回合挂上、同一回合末就被递减」；本项目 `tickDurations`（combat.js:246-269）走共享回合钟、无同款跳过位，「挂上即 -1」是否合意属设计复核项，非缺陷断言。
- **R-5 治疗显式复活语义**（`Creature.cs:477-487`）：`HealInternal` 前后比对 IsDead，复活触发 `Revived` 事件并重挂钩子——把「死人被拉回」从隐式状态变化升级为一等事件（对应 D-3）。

---

## 附：查证方法一句话

本项目侧通读 `effect-steps.js` 主壳（步骤表+halt 语义）、`battle.resolution.js` 结构化 op 循环（:930-1186）、`effect-steps.m2.js` 全文、`battle.discover-flow.js` 全文、`battle.exec-play.js`（:60-289）、`battle.engine.js` damagePlayer/hitFoe、`combat.js` 叠层段、`battle.action-runner.js`、`battle.lifecycle.js finish`、`battle.runtime.interaction.js`；STS2 侧核对 DamageCmd/PowerCmd/CardSelectCmd/CreatureCmd、Creature.cs、MonsterModel.cs 的死亡与叠加路径。时间盒内未做多段效果的全量差分回放，D-3 的「自己回合 0 血窗口」未实机复现（静态推演，依据 finish(false) 调用点全集）。
