# 注能连续施放实施结果（2026-10-21）

默认鼠标与键盘入口已统一先选材；没有足量合法材料的可选注能保留基础效果，纯注能拒绝；显式直接施放可继续使用。材料 UID 保存在原有 pendingTarget.fuelUids，返回选材时恢复并复检，不新增材料状态。取消不扣材料或能量，最终有效出牌才沿既有执行队列消费。

## 接口和接线

- commands.beginInfusion(uid) 从同卡 pendingTarget.fuelUids 恢复材料；其余 selectInfusion / confirmInfusion / cancelInfusion / playDirect 接口沿用。
- pendingTarget 新投影只读 fuelUids、battleToken、selectionId；infusing 显式声明 battleToken、selectionId、targetIndex（敌方初次目标槽位，默认 null）。每次进入材料/目标步骤递增 selectionId，按钮按战斗和步骤拒绝迟到输入。
- 鼠标原目标以 WeakMap 保留实例引用，确认时同实例且存活则沿目标结算；替换/死亡时回到选目标，引用不进入快照。
- syncSelectionPrompt 新增可选 onReturnToInfusion(uid) 回调，由 battle.aim 接 commands.beginInfusion；目标条显示“返回选材”。
- required-infusion-play 仅两处基础效果 playCard 调用添加 forceDirect=true，对应 3 个旧默认定向直打测试；其余既有测试未改。

## 验证

| 检查 | 真实结果 |
| --- | --- |
| A 组 13 文件 test:target | exit 0；164 用例 |
| B 组 6 文件 test:target | exit 0；93 用例 |
| 末轮专属文件 + required-infusion-play | exit 0；37 用例，其中专属文件 23 用例 |
| tsc jsconfig.runtime.json（末轮） | exit 0 |
| tsc jsconfig.battle-snapshot.json（末轮） | exit 0 |
| tsc jsconfig.framework-ports.json | exit 0 |
| tsc jsconfig.framework-boundaries.json | exit 0 |
| 本线 5 个 JS 源码及 2 个测试的 eslint（末轮） | exit 0 |

不同文件最终合计 19 文件、259 用例，重复复验不重复计数。首轮曾有 3 个旧默认定向直打断言失败，同步上述两处显式 direct 调用后通过。

```text
# A 组
npm run test:target -- tests/sts2-infusion-flow-1021.test.js tests/required-infusion-play.test.js tests/infuse-free-play.test.js tests/infuse-free-paths.test.js tests/n1-infuse-uid-toggle.test.js tests/battle-engine-decomposition.test.js tests/battle-selection-ui.test.js tests/battle-drag-reference.test.js tests/battle-card-feedback.test.js tests/battle-hover-play-availability.test.js tests/battle-snapshot-integration.test.js tests/sts2-consumed-pile.test.js tests/sts2-unified-consumed-pile.test.js
# B 组
npm run test:target -- tests/discover-infusion-feedback.test.js tests/tt12-structured-preplay.test.js tests/battle-end-turn-selection.test.js tests/provoke-target-contract.test.js tests/contracts.test.js tests/architecture-boundaries.test.js
# 最后只复验新增/改动项
npm run test:target -- tests/sts2-infusion-flow-1021.test.js tests/required-infusion-play.test.js
node node_modules/eslint/bin/eslint.js game/src/battle/core/battle.card-play.domain.js game/src/battle/core/battle.core.js game/src/battle/core/battle.snapshot-projection.domain.js game/src/battle/view/battle.aim.js game/src/battle/view/battle.selection-ui.js tests/sts2-infusion-flow-1021.test.js tests/required-infusion-play.test.js
# 每个配置分别执行
node node_modules/typescript/bin/tsc --noEmit -p jsconfig.runtime.json --pretty false
node node_modules/typescript/bin/tsc --noEmit -p jsconfig.battle-snapshot.json --pretty false
node node_modules/typescript/bin/tsc --noEmit -p jsconfig.framework-ports.json --pretty false
node node_modules/typescript/bin/tsc --noEmit -p jsconfig.framework-boundaries.json --pretty false
```

首轮 runtime 类型检查 exit 1，报告过以下 5 项非属地问题；本线未修改这些文件，末轮同命令 exit 0，当前无类型未过项：

```text
game/src/agent/agent.runner.js(20,15): error TS2339: Property 'code' does not exist on type 'Error'.
game/src/hub/game.bag.js(74,44): error TS2741: Property 'renderState' is missing in type '{ game: GameState; usedSlots: () => number; bagCap: () => any; }' but required in type '{ bagCap: any; game: any; renderState: any; usedSlots: any; }'.
game/src/hub/game.bag.js(91,58): error TS2741: Property 'renderState' is missing in type '{ usedSlots: () => number; bagCap: () => any; }' but required in type '{ bagCap: any; renderState: any; usedSlots: any; }'.
game/src/hub/game.bag.js(111,58): error TS2741: Property 'renderState' is missing in type '{ usedSlots: () => number; bagCap: () => any; }' but required in type '{ bagCap: any; renderState: any; usedSlots: any; }'.
game/src/hub/game.bag.rules.js(185,55): error TS2741: Property 'renderState' is missing in type '{ usedSlots: any; bagCap: any; }' but required in type '{ bagCap: any; renderState: any; usedSlots: any; }'.
```

## 未验项

本线未启动服务或浏览器；当前窗口内置浏览器的真实鼠标/键盘输入和可见布局由父会话集成验收。本线未跑全量测试、build 或提交。

## 自有差异与 SHA256

6 项直接使用父会话 .tmp/sts2-cast-ui-1021-before 的已保存字节。父快照没有包含 core-ports 类型文件和旧测试，这两项在内存中仅逆向本线精确补丁恢复比较字节，没有读取 HEAD 或覆盖现场。专属测试为新增文件。下表和补丁不包含此前类型覆盖等他人改动。

| 路径 | 自有 + / - | 修改前 SHA256 | 修改后 SHA256 |
| --- | --- | --- | --- |
| game/src/battle/core/battle.card-play.domain.js | +97 / -31 | 477affffcd25276713e9ec0aef936fc23056529c8ffd772f7475ba7470781b40 | 2e17016dc2084d513610c2110972b156c9f83424d257dc80bdd677067679bee8 |
| game/src/battle/view/battle.aim.js | +10 / -4 | 7c9b164484ca562c2754c1c2d1e4b85e6ca4f2f2295d68848a2a5b8704c98882 | 389513a511043986f6f7e6442e577e6b5ac141e863785fae92ae36ee3bfa11d3 |
| game/src/battle/view/battle.selection-ui.js | +7 / -6 | 9785117947a468ea9d984e2f609c6f325d3bc0f7dbeb5fb2865ab1c77e631d22 | 763b39865202c5c86a972ffbd4eb2c5bde54e3f32e8dbb002334fb3225914b55 |
| game/src/battle/core/battle.core.js | +2 / -0 | 12b55009131e447405e9f9cdc11beca3fc3d4ec0e33d582cde993e3d296fa6a3 | f0fad508495b25e12c85aafc978f10040d2e2cefdd2007b7e19c74efca014b7d |
| game/src/battle/core/battle.snapshot-projection.domain.js | +3 / -1 | 7c1633cb15aee0978957583ecfba0c1320d1db8a8b8634c82474e9a41e44b1e8 | 3d96aeb5f5e3499f234295a701cff8d7b547b2b2f5aca7acde59f85e3d9cdbfe |
| game/src/battle/battle.snapshot.types.d.ts | +4 / -4 | dd3b951ff2b7ef8fb270229804c645cb3c2f14bacd24a6639bce77fc3070826c | c573dd16265dea4157f587059c785d01bb3dd3c09c1d86bd2f303f35bbec97a1 |
| game/src/battle/core/battle.core-ports.types.d.ts | +2 / -1 | 49d3416e22c85df5e91a709547a625c8f8b4da7b00623e838e150f5d58c62187 | c8ab9f57ddfe7a5f1ba3bf616f4511a483c214cfe44307645e59e59a37467e62 |
| tests/required-infusion-play.test.js | +2 / -2 | 1983931b3f1606b92b99b1abda950ba91972b6a19be1105ce21e1af0093ec620 | a609e44672a15c1cb04fe78c323a4388a6d4080c36b5e85144cd5a77ac198412 |
| tests/sts2-infusion-flow-1021.test.js | +271 / -0 | 新增 | 95825fa25d2f92f9ed85a54aee1f822ae8c59ccc552cbb4af3df4ce1ba69ca14 |

<details>
<summary>相对上述字节基线的完整自有补丁</summary>

```diff
--- a/game/src/battle/core/battle.card-play.domain.js
+++ b/game/src/battle/core/battle.card-play.domain.js
@@ -21,6 +21,17 @@
   set$interaction, set$pendingHint, set$battleState, set$infusing,
   clearTargetHint, cancelTargetingState,
 }) {
+  let selectionSeq = 0;
+  // Pointer intent is tied to this material step, never copied into snapshots.
+  const infusionTargets = new WeakMap();
+  const battleInputCurrent = () => !!readState().G?.battleActive
+    && [BATTLE_PHASES.PLAYER, BATTLE_PHASES.TARGETING].includes(readState().battleState.phase);
+  const infusionCurrent = () => {
+    const selection = readState().infusing;
+    return !!selection && battleInputCurrent() && !readState().busy
+      && selection.battleToken === readState().battleState.token
+      && readState().hand.includes(selection.uid);
+  };
 function clearTargetSession(preserveCardUid = null) {
     if (!readState().interaction && readState().battleState.phase !== BATTLE_PHASES.TARGETING) return false;
     const i = readState().interaction;
@@ -43,7 +54,8 @@
     const previous = interactionOf('card');
     if (previous?.uid === uid && !fuelUids.length) fuelUids = previous.fuelUids || [];
     clearTargetSession(uid);
-    set$interaction({ kind: 'card', uid, card, hint: hint || '', fuelUids, foeFightFirst });
+    set$interaction({ kind: 'card', uid, card, hint: hint || '', fuelUids: [...fuelUids], foeFightFirst,
+      battleToken: readState().battleState.token, selectionId: ++selectionSeq });
     set$battleState(beginTargeting(readState().battleState, uid, targetIds));
     set$pendingHint(hint || '');
     requestBattleRender();
@@ -78,10 +90,13 @@
     return unplayableReason(card) || equipmentPlayLimit(card)?.reason.message || null;
   }
 
-  function inspectCardPlay(uid) {
+  function inspectCardPlay(uid, allowInfusing = false) {
     const fail = (code, message, card = null) => ({ card, reason:{ code, message } });
+    if (!battleInputCurrent()) return fail('NO_ACTIVE_BATTLE', '当前不是可出牌的战斗阶段');
+    const pending = interactionOf('card');
+    if (pending?.uid === uid && pending.battleToken != null && pending.battleToken !== readState().battleState.token) return fail('STALE_SELECTION', '这次施放已失效，请重新选牌');
     if (!readState().hand.includes(uid)) return fail('NOT_IN_HAND', '这张牌已不在当前手牌中');
-    if (readState().busy || readState().infusing || readState().discovering || readState().choosing || readState().handSelecting || readState().viewingGrave || readState().viewingDeck) return fail('INPUT_BUSY', '当前动作或选择尚未结束');
+    if (readState().busy || readState().infusing && !allowInfusing || readState().discovering || readState().choosing || readState().handSelecting || readState().viewingGrave || readState().viewingDeck) return fail('INPUT_BUSY', '当前动作或选择尚未结束');
     if (hasPendingEndTurn() && interactionOf('card')?.uid !== uid) return fail('TURN_END_PENDING', '回合结束流程正在等待原目标');
     const entry = findEffectiveCard(uid);
     if (!entry) return fail('CARD_MISSING', '当前卡牌暂不可用');
@@ -101,6 +116,18 @@
     const need = infuseOf(card);
     const others = readState().hand.filter(handUid => handUid !== uid && !infusionFuelReason(handUid));
     return others.length < need ? { code:'INFUSION_MATERIALS', message:`手牌不足：【${card.name}】注能(${need}) 需要消耗 ${need} 张手牌，当前只有 ${others.length} 张可选` } : null;
+  }
+  function needsInfusionChoice(uid, card, forceDirect) {
+    if (forceDirect || infuseOf(card) <= 0 || interactionOf('card')?.uid === uid) return false;
+    // Optional infusion still has its base play when a full payment is unavailable.
+    return !infusionChoiceReason(uid, card) || !!missingInfusionReason(card, 0, readState().allSpellsInfused);
+  }
+  function selectedFuelReason(uid, card, fuel) {
+    if (!fuel.length) return null;
+    const need = infuseOf(card);
+    return fuel.length !== need || new Set(fuel).size !== fuel.length
+      || fuel.some(fuelUid => fuelUid === uid || infusionFuelReason(fuelUid))
+      ? { code:'FUEL_INVALID', message:'注能材料已失效，请返回选材后重新确认' } : null;
   }
   /** @returns {import('../battle.play-submission.types.js').CardPlayRejected} */
   const cardPlayRejected = (uid, reason) => Object.freeze({ status:'rejected', uid, battleToken:readState().battleState.token, reason:Object.freeze(reason) });
@@ -116,7 +143,7 @@
     const check = inspectCardPlay(uid);
     if (check.reason) return cardPlayRejected(uid, check.reason);
     const card = check.card;
-    if (!forceDirect && side == null && infuseOf(card) > 0) {
+    if (needsInfusionChoice(uid, card, forceDirect)) {
       const reason = infusionChoiceReason(uid, card);
       return reason ? cardPlayRejected(uid, reason) : Object.freeze({ status:'ready', uid, battleToken:readState().battleState.token });
     }
@@ -127,7 +154,7 @@
       || need === 'self' && side !== 'self';
     const infusionIssue = missingInfusionReason(card, fuel.length, readState().allSpellsInfused);
     const executeIssue = requestedTargetReason(card, side == null || side === 'self' ? null : readState().foes[+side], alive()) || executeTargetReason(card, side == null || side === 'self' ? null : readState().foes[+side], alive());
-    const reason = executeIssue || (infusionIssue ? { code:'INFUSION_REQUIRED', message:infusionIssue }
+    const reason = selectedFuelReason(uid, card, fuel) || executeIssue || (infusionIssue ? { code:'INFUSION_REQUIRED', message:infusionIssue }
       : needsTarget ? null : executionAvailability(uid, card, fuel, readState().freeCast.has(uid)));
     return reason ? cardPlayRejected(uid, reason) : Object.freeze({ status:'ready', uid, battleToken:readState().battleState.token });
   }
@@ -138,7 +165,7 @@
       const ruleRejected = ['RULE_INVALID','RULE_UNSUPPORTED'].includes(check.reason.code);
       if (ruleRejected) rejectUnsupportedCard(check.card, { warn:warnCardRuleRejection });
       else if (check.reason.code === 'EQUIPMENT_FULL') readState().G.log(`[[icon:tools]] 最多同时装配 <b>${check.cap}</b> 件装备（已装配 ${check.worn} 件）——本场无法再穿戴`, 'warn');
-      else if (!['NOT_IN_HAND','INPUT_BUSY','TURN_END_PENDING','CARD_MISSING'].includes(check.reason.code)) readState().G.log(`${check.reason.code === 'INSUFFICIENT_ENERGY' ? '[[icon:bolt]]' : '[[icon:cross]]'} ${esc(check.reason.message)}`, 'warn');
+      else if (!['NO_ACTIVE_BATTLE','NOT_IN_HAND','INPUT_BUSY','TURN_END_PENDING','CARD_MISSING'].includes(check.reason.code)) readState().G.log(`${check.reason.code === 'INSUFFICIENT_ENERGY' ? '[[icon:bolt]]' : '[[icon:cross]]'} ${esc(check.reason.message)}`, 'warn');
       return submission ? cardPlayRejected(uid, check.reason) : ruleRejected ? false : undefined;
     }
     let card = check.card;
@@ -146,10 +173,9 @@
     // （R3-0：待选期间打出别的卡不吞砸击选择态），一并清会把它们顺带取消。
     const staleCard = interactionOf('card');
     if (staleCard && staleCard.uid !== uid) clearTargetSession();
-    // 09-20 老板定版（取代需求 #15 的「点卡直打」）：注能卡点卡先进注能态——
-    // 注能条内提供「不注能直接打出」；拖拽到目标（side 非空）与该直打钮（forceDirect）仍直接打出
-    if (!forceDirect && side == null && infuseOf(card) > 0) {
-      beginInfuse(uid);
+    // Mouse and keyboard share the material step; explicit direct play stays available.
+    if (needsInfusionChoice(uid, card, forceDirect)) {
+      beginInfuse(uid, side);
       if (!submission) return;
       return readState().infusing?.uid === uid ? cardPlayNeedsInput(uid, 'infusion')
         : cardPlayRejected(uid, infusionChoiceReason(uid, card) || { code:'INFUSION_UNAVAILABLE', message:'当前无法进入注能选择' });
@@ -160,6 +186,12 @@
     const isFree = readState().freeCast.has(uid);
     const pendingCard = interactionOf('card');
     const fuel = pendingCard?.uid === uid ? pendingCard.fuelUids || [] : [];
+    const fuelIssue = selectedFuelReason(uid, card, fuel);
+    if (fuelIssue) {
+      readState().G.log(`[[icon:cross]] ${esc(fuelIssue.message)}`, 'warn');
+      requestBattleRender();
+      return submission ? cardPlayRejected(uid, fuelIssue) : undefined;
+    }
     const infusionIssue = missingInfusionReason(card, fuel.length, readState().allSpellsInfused);
     if (infusionIssue) {
       readState().G.log(`[[icon:cross]] ${esc(infusionIssue)}`, 'warn');
@@ -194,6 +226,12 @@
       card = withFoeFightTargets(card, [first, target]);
       target = first;
     }
+    const availabilityIssue = executionAvailability(uid, card, fuel, isFree);
+    if (availabilityIssue) {
+      readState().G.log(`[[icon:cross]] ${esc(availabilityIssue.message)}`, 'warn');
+      requestBattleRender();
+      return submission ? cardPlayRejected(uid, availabilityIssue) : undefined;
+    }
     if (pendingCard) set$interaction(null);   // 交互正常结算：清卡牌槽（不 cancelTargeting，RESOLVING 迁移接管阶段）
     set$pendingHint('');
     // 「杀化为X」战斗规则：打出的初始攻击以目标卡形态结算（uid 沿用，弃牌簿记不变）
@@ -216,7 +254,7 @@
   // 容量仍按 need 封顶）。旧实现是「组级 toggle」（组内有已选即 delete 最后一张），
   // 同名堆叠 ×need≥2 时点第二张会顶掉第一张，燃料永远选不满（tt12 走查 N1）。
   function toggleInfusePick(uid) {
-    if (!readState().infusing || uid === readState().infusing.uid) return;
+    if (!infusionCurrent() || uid === readState().infusing.uid) return;
     const entry = findCard(uid);
     if (!entry) return;
     // Allow removing a previously picked card even if a transform made it illegal.
@@ -233,34 +271,54 @@
     }
     requestBattleRender();
   }
-  function cancelInfuse() { set$infusing(null); requestBattleRender(); }
-  // 需求 #15：注能入口——卡面上的「注能」角标触发（打出本体不再强制注能）
-  function beginInfuse(uid) {
-    if (readState().busy || readState().infusing || readState().discovering || readState().choosing || readState().handSelecting || readState().viewingGrave || readState().viewingDeck || hasPendingEndTurn()) return;
-    if (!readState().hand.includes(uid)) return;
-    const entry = findEffectiveCard(uid);
-    if (!entry) return;
-    const card = entry.card;
-    if (rejectUnsupportedCard(card, { warn: warnCardRuleRejection })) return false;
+  function cancelInfuse() {
+    if (!readState().infusing) return;
+    set$infusing(null);
+    resumeTurnEnd();
+    requestBattleRender();
+  }
+  // The same entry also returns from targeting without replacing selected UIDs.
+  function beginInfuse(uid, side = undefined) {
+    const check = inspectCardPlay(uid);
+    if (check.reason || hasPendingEndTurn()) return;
+    const card = check.card;
     const infN = infuseOf(card);
     if (infN <= 0) return;
-    const effCost = effCostOf(card, uid);
-    if (effCost > readState().energy) { readState().G.log(`[[icon:bolt]] 能量不足：【${esc(card.name)}】注能打出需要 ${effCost} 点能量`, 'warn'); return; }
+    const previous = interactionOf('card');
+    if (previous?.battleToken != null && previous.battleToken !== readState().battleState.token) return;
+    const previousFuel = previous?.uid === uid ? previous.fuelUids || [] : [];
     const choiceIssue = infusionChoiceReason(uid, card);
-    if (choiceIssue) {
+    if (choiceIssue && !previousFuel.length) {
       readState().G.log(`[[icon:flask]] ${esc(choiceIssue.message)}`, 'warn');
       return;
     }
     clearTargetSession(uid);
-    set$infusing({ uid, card, need: infN, picked: new Set() });
+    const picked = new Set(previousFuel.filter(fuelUid => fuelUid !== uid && !infusionFuelReason(fuelUid)).slice(0, infN));
+    const selection = { uid, card, need: infN, picked, targetIndex:null,
+      battleToken: readState().battleState.token, selectionId: ++selectionSeq };
+    if (side === 'self' || side != null && readState().foes[+side] && !readState().foes[+side].dead) {
+      infusionTargets.set(selection, { side, target: side === 'self' ? null : readState().foes[+side] });
+      if (side !== 'self') selection.targetIndex = +side;
+    }
+    set$infusing(selection);
     requestBattleRender();
   }
   function confirmInfuse() {
     // 迭代评审 09-20：特色机制全程接音——成功=confirm 生效感，校验不过=deny（按钮路径会被
     // deny 反向抑制吞掉、仅保留视觉，程序化路径正常出声，见 sound.js DENY_SUPPRESS_MS）
-    if (!readState().infusing || readState().infusing.picked.size !== readState().infusing.need) { sound('deny'); return; }
-    const { uid, card } = readState().infusing;
-    const fuel = [...readState().infusing.picked];
+    if (!infusionCurrent()) return;
+    const selection = readState().infusing;
+    const { uid } = selection;
+    const check = inspectCardPlay(uid, true);
+    if (check.reason) {
+      readState().G.log(`[[icon:cross]] ${esc(check.reason.message)}`, 'warn');
+      requestBattleRender(); return;
+    }
+    const card = check.card;
+    const need = infuseOf(card);
+    selection.card = card;
+    selection.need = need;
+    const fuel = [...selection.picked].slice(0, need);
     const invalid = fuel.filter(fuelUid => infusionFuelReason(fuelUid));
     if (invalid.length) {
       invalid.forEach(fuelUid => readState().infusing.picked.delete(fuelUid));
@@ -268,13 +326,21 @@
       requestBattleRender();
       return;
     }
+    if (fuel.length !== need) { sound('deny'); requestBattleRender(); return; }
+    const intended = infusionTargets.get(selection);
     set$infusing(null);
     sound('confirm');
-    if (targetSide(card) === 'enemy' && alive().length > 1) {
-      beginCardTargeting(uid, card, alive().map(foe => foe.id), `注能完成：选择【${card.name}】的目标`, fuel);
-      return;
-    }
-    queueCardExecution(uid, card, fuel, alive()[0] || null);
+    const side = targetSide(card);
+    /** @type {string|number|undefined} */
+    let chosenSide = side === 'self' ? 'self' : undefined;
+    if (side === 'enemy') {
+      const intendedIndex = intended?.side !== 'self' ? readState().foes.indexOf(intended?.target) : -1;
+      if (intendedIndex >= 0 && !readState().foes[intendedIndex].dead) chosenSide = intendedIndex;
+      else if (!intended && alive().length === 1) chosenSide = readState().foes.indexOf(alive()[0]);
+    }
+    set$interaction({ kind:'card', uid, card, hint:`已选 ${fuel.length} 张材料：选择【${card.name}】的目标`, fuelUids:fuel,
+      battleToken:readState().battleState.token, selectionId:++selectionSeq });
+    return submitCardPlay(uid, chosenSide, true);
   }
 
   return { clearTargetSession, cancelInteraction, beginSpecialTargeting, beginCardTargeting, targetSide, unplayableReason, handUnplayableReason, getCardPlayAvailability, play, submitCardPlay, toggleInfusePick, cancelInfuse, beginInfuse, confirmInfuse };
--- a/game/src/battle/view/battle.aim.js
+++ b/game/src/battle/view/battle.aim.js
@@ -272,7 +272,7 @@
     a.fieldPlayable = a.follow && (a.side === 'self' || isAreaEffect(entry.card) || isRandomEnemyEffect(entry.card));
     a.stage = stage;
     a.vr = UI.el.overlay.getBoundingClientRect();
-    a.playBlockedReason = cardPlayBlockedReason(a.uid, a.side === 'self' ? 'self' : undefined, a.side !== 'any');
+    a.playBlockedReason = cardPlayBlockedReason(a.uid, a.side === 'self' ? 'self' : undefined);
     if (a.reasonShown) {
       if (a.playBlockedReason) showThoughtBubble(a.playBlockedReason, true);
       else { clearThoughtBubble(); a.reasonShown = false; }
@@ -378,6 +378,11 @@
       clickUid:clickSelectedUid, findCard,
       getCurrent:() => ({ snapshot:getSnapshot(), clickUid:clickSelectedUid, stage:/** @type {BattleElement} */ (UI.el.ovBody?.querySelector('.battle-stage')) }),
       onCancel:({ restoreFocus }) => cancelBattleSelection({ restoreFocus }),
+      onReturnToInfusion:uid => {
+        cancelClickSelection();
+        commands.beginInfusion(uid);
+        updateClickSelectionUI();
+      },
     });
   }
   function selectCardByClick(uid, focusTarget = false, { autoSingleTarget = true } = {}) {
@@ -437,6 +442,8 @@
   }
   function clickSelectedTarget(side, idx) {
     const snapshot = getSnapshot();
+    if (!snapshot || snapshot.busy || snapshot.infusing || snapshot.discovering || snapshot.choosing || snapshot.handSelecting
+      || !targetSessionBattleCurrent(snapshot.battleToken)) return false;
     const pending = snapshot.pendingTarget;
     if (clickSelectedUid == null && !pending) return false;
     const uid = pending?.uid ?? clickSelectedUid;
@@ -498,10 +505,9 @@
     if (!entry) return;
     cancelClickSelection();
     const side = (kind === 'potion' || isSlam) ? 'enemy' : (targetSide(entry.card) || 'any');   // null = 无目标招式：拖到中间空地即可
-    // Aimed enemy/self plays skip optional infusion; an untargeted pickup keeps
-    // the original infusion entry. Match that intent in the read-only query.
+    // Default pointer and keyboard submissions share the same infusion entry.
     const playBlockedReason = !isSlam && kind !== 'potion'
-      ? cardPlayBlockedReason(uid, side === 'self' ? 'self' : undefined, side !== 'any') : '';
+      ? cardPlayBlockedReason(uid, side === 'self' ? 'self' : undefined) : '';
     const isCard = kind !== 'potion' && !isSlam;
     const vr = UI.el.overlay.getBoundingClientRect();
     const r = el.getBoundingClientRect();
--- a/game/src/battle/view/battle.selection-ui.js
+++ b/game/src/battle/view/battle.selection-ui.js
@@ -9,6 +9,7 @@
   if (snapshot.pendingTarget) {
     const target = snapshot.pendingTarget;
     return { kind:'card', uid:target.uid, name:target.card?.name || '', step:target.excludedTargetIndex,
+      selectionId:target.selectionId, canReturnToInfusion:!!target.fuelUids?.length,
       detail:(target.hint || '继续选择高亮目标').replace(/\s*·\s*Esc 取消$/, '') };
   }
   if (snapshot.pendingItem) return { kind:'item', uid:snapshot.pendingItem.uid, name:snapshot.pendingItem.card?.name || '', detail:'点击一名敌人使用，或直接拖到敌人身上' };
@@ -18,7 +19,7 @@
 }
 
 export function selectionKey(snapshot, selection) {
-  return selection ? JSON.stringify([snapshot.battleToken, selection.kind, selection.uid ?? null, selection.step ?? null]) : '';
+  return selection ? JSON.stringify([snapshot.battleToken, selection.kind, selection.uid ?? null, selection.step ?? null, selection.selectionId ?? null]) : '';
 }
 
 export function cancelSelection({ snapshot, commands, hasAim = false, clickUid = null,
@@ -36,7 +37,7 @@
 // One direct-child status strip for click selection, pending card/item and skills.
 // Its callback is bound to the displayed selection, so a detached/stale button
 // cannot cancel a newer card, target step or battle.
-export function syncSelectionPrompt(stage, snapshot, { clickUid = null, findCard, getCurrent, onCancel }) {
+export function syncSelectionPrompt(stage, snapshot, { clickUid = null, findCard, getCurrent, onCancel, onReturnToInfusion = null }) {
   if (!stage) return;
   const selection = selectionState(snapshot, { clickUid, findCard });
   let bar = /** @type {BattleElement} */ (stage.querySelector('[data-selection-prompt]'));
@@ -51,13 +52,12 @@
     bar.dataset.selectionPrompt = '';
     stage.appendChild(bar);
   }
-  const html = `<div class="bt-infuse-copy"><p class="bt-infuse-title" role="status">${selection.name ? `已选【<b>${esc(selection.name)}</b>】：` : ''}${esc(selection.detail)}</p></div><div class="bt-infuse-actions"><button class="mini-btn" data-act="btPickCancel" type="button">取消 · Esc</button></div>`;
+  const html = `<div class="bt-infuse-copy"><p class="bt-infuse-title" role="status">${selection.name ? `已选【<b>${esc(selection.name)}</b>】：` : ''}${esc(selection.detail)}</p></div><div class="bt-infuse-actions">${selection.canReturnToInfusion && onReturnToInfusion ? '<button class="mini-btn" data-act="btPickReturnInfusion" type="button">返回选材</button>' : ''}<button class="mini-btn" data-act="btPickCancel" type="button">取消 · Esc</button></div>`;
   if (bar.dataset.selectionKey === key && bar._selectionHTML === html) return;
   bar.dataset.selectionKey = key;
   bar._selectionHTML = html;
   bar.innerHTML = html;
-  const button = /** @type {HTMLButtonElement} */ (bar.querySelector('button'));
-  button.addEventListener('click', event => {
+  for (const button of /** @type {NodeListOf<HTMLButtonElement>} */ (bar.querySelectorAll('button'))) button.addEventListener('click', event => {
     event.preventDefault(); event.stopPropagation();
     const current = getCurrent();
     if (!button.isConnected || !bar.contains(button) || !bar.isConnected || !stage.isConnected || stage.closest('[hidden], [inert], [aria-hidden="true"], .closing') || current.snapshot.busy
@@ -65,6 +65,7 @@
       || current.stage && current.stage !== stage
       || stage._battleToken != null && stage._battleToken !== current.snapshot.battleToken
       || selectionKey(current.snapshot, selectionState(current.snapshot, { clickUid:current.clickUid, findCard })) !== key) return;
-    onCancel({ restoreFocus:event.detail === 0 });
+    if (button.dataset.act === 'btPickReturnInfusion') onReturnToInfusion(selection.uid);
+    else onCancel({ restoreFocus:event.detail === 0 });
   });
 }
--- a/game/src/battle/core/battle.core.js
+++ b/game/src/battle/core/battle.core.js
@@ -459,6 +459,8 @@
       const card = findEffectiveCard(uid)?.card;
       const reason = missingInfusionReason(card, 0, allSpellsInfused);
       if (reason) { G.log(reason, 'warn'); return; }
+      const pending = interactionOf('card');
+      if (pending?.uid === uid) set$interaction({ ...pending, fuelUids:[], foeFightFirst:null });
       cancelInfuse(); play(uid, null, true);
     },
     useEquipSkill,
--- a/game/src/battle/core/battle.snapshot-projection.domain.js
+++ b/game/src/battle/core/battle.snapshot-projection.domain.js
@@ -9,7 +9,9 @@
 export function createSnapshotProjection({ runtime: instanceRuntime, executionSession, interactionOf,
   battleBagItems, itemUsability, getConsumedPile, R, isBattleStartEquip, equipCap, equipSkillText }) {
 const { actionQueue, stagedDeathFx, handSelectQueue, choiceQueue } = executionSession;
-const pendingTargetOf = () => { const i = interactionOf('card'); return i ? { uid: i.uid, card: i.card, hint: i.hint, excludedTargetIndex: i.foeFightFirst ? instanceRuntime.foes.indexOf(i.foeFightFirst) : null } : null; };
+const pendingTargetOf = () => { const i = interactionOf('card'); return i ? { uid: i.uid, card: i.card, hint: i.hint,
+  fuelUids: Object.freeze([...(i.fuelUids || [])]), battleToken: i.battleToken, selectionId: i.selectionId,
+  excludedTargetIndex: i.foeFightFirst ? instanceRuntime.foes.indexOf(i.foeFightFirst) : null } : null; };
 const pendingItemOf = () => { const i = interactionOf('item'); return i ? { uid: i.uid, card: i.card, hint: i.hint, excludedTargetId: i.foeFightFirst?.id ?? null } : null; };
 /** @returns {import('../battle.snapshot.types.js').BattleSnapshotInput} */
 function captureSnapshotInput() {
--- a/game/src/battle/battle.snapshot.types.d.ts
+++ b/game/src/battle/battle.snapshot.types.d.ts
@@ -115,11 +115,11 @@
   consumed?: string[];
   consumedPile?: string[];
   handInfuseCounts?: Record<string, number>;
-  infusing: ({ uid: string; card?: BattleCardInput | null; picked: Set<string>; [key: string]: unknown }) | null;
+  infusing: ({ uid: string; card?: BattleCardInput | null; picked: Set<string>; battleToken?: number; selectionId?: number; targetIndex?: number | null; [key: string]: unknown }) | null;
   discovering: ({ options: BattleCardInput[]; [key: string]: unknown }) | null;
   handSelecting: ({ candidateUids?: readonly string[]; canCancel?: boolean; srcCard?: BattleCardInput | null; payment?: ({ card?: BattleCardInput | null; [key: string]: unknown }) | null; [key: string]: unknown }) | null;
   choosing: ({ options: unknown[]; [key: string]: unknown }) | null;
-  pendingTarget: ({ uid: string; card?: BattleCardInput | null; [key: string]: unknown }) | null;
+  pendingTarget: ({ uid: string; card?: BattleCardInput | null; fuelUids?: readonly string[]; battleToken?: number; selectionId?: number; [key: string]: unknown }) | null;
   pendingHint: string | null;
   viewingGrave: boolean;
   viewingDeck: boolean;
@@ -201,11 +201,11 @@
   readonly consumed?: readonly string[];
   readonly consumedPile?: readonly string[];
   readonly handInfuseCounts?: Readonly<Record<string, number>>;
-  readonly infusing: ({ readonly uid: string; readonly card: SnapshotBattleCard | null | undefined; readonly picked: readonly string[]; readonly [key: string]: unknown }) | null;
+  readonly infusing: ({ readonly uid: string; readonly card: SnapshotBattleCard | null | undefined; readonly picked: readonly string[]; readonly battleToken?: number; readonly selectionId?: number; readonly targetIndex?: number | null; readonly [key: string]: unknown }) | null;
   readonly discovering: ({ readonly options: readonly SnapshotBattleCard[]; readonly [key: string]: unknown }) | null;
   readonly handSelecting: SnapshotHandSelecting | null;
   readonly choosing: ({ readonly options: readonly unknown[]; readonly [key: string]: unknown }) | null;
-  readonly pendingTarget: ({ readonly uid: string; readonly card: SnapshotBattleCard | null | undefined; readonly [key: string]: unknown }) | null;
+  readonly pendingTarget: ({ readonly uid: string; readonly card: SnapshotBattleCard | null | undefined; readonly fuelUids?: readonly string[]; readonly battleToken?: number; readonly selectionId?: number; readonly [key: string]: unknown }) | null;
   readonly pendingHint: string | null;
   readonly viewingGrave: boolean;
   readonly viewingDeck: boolean;
--- a/game/src/battle/core/battle.core-ports.types.d.ts
+++ b/game/src/battle/core/battle.core-ports.types.d.ts
@@ -205,7 +205,8 @@
   random: RandomPort; executionSession: EffectSession; sound(name: string): void;
   commands: EffectCommands; createBattleResolution(ports: ResolutionPorts): ResolveCard };
 export type SnapshotProjectionOptions = { runtime: SnapshotRuntime; executionSession: SnapshotSession;
-  interactionOf(kind: 'card' | 'item' | 'slam' | 'dart'): { uid: string; card: CoreCard; hint: string; foeFightFirst?: CoreFoe | null } | null;
+  interactionOf(kind: 'card' | 'item' | 'slam' | 'dart'): { uid: string; card: CoreCard; hint: string;
+    fuelUids?: string[]; battleToken?: number; selectionId?: number; foeFightFirst?: CoreFoe | null } | null;
   battleBagItems(): CardEntry[]; itemUsability(card: CoreCard): { usable: boolean; why: string };
   getConsumedPile(): string[]; R(): { bossDeckSize: number };
   isBattleStartEquip(card: CoreCard): boolean; equipCap(): number; equipSkillText(card: CoreCard): string };
--- a/tests/required-infusion-play.test.js
+++ b/tests/required-infusion-play.test.js
@@ -97,7 +97,7 @@
   it.each(['tt3sp-silverthorn', 'tt3sp-bloodstorm'])('%s retains its uninfused base effect', async id => {
     const card = cardById(id); expect(requiresInfusion(card)).toBe(false);
     await start(card);
-    BattleSession.commands.playCard('u0', 0); await drain();
+    BattleSession.commands.playCard('u0', 0, true); await drain();
     expect(runtime.hand).not.toContain('u0'); expect(runtime.infuseFuels).toBe(0);
     expect(runtime.foes[0].hp).toBeLessThan(999);
   });
@@ -106,7 +106,7 @@
     await start(cardById('tt3sp-silverthorn'));
     runtime.foes[0].status.immune = 1;
     expect(BattleSession.commands.getCardPlayAvailability('u0', 0, true).status).toBe('ready');
-    BattleSession.commands.playCard('u0', 0); await drain();
+    BattleSession.commands.playCard('u0', 0, true); await drain();
     expect(runtime.hand).not.toContain('u0'); expect(runtime.foes[0].hp).toBe(999);
   });
 
--- a/tests/sts2-infusion-flow-1021.test.js
+++ b/tests/sts2-infusion-flow-1021.test.js
@@ -0,0 +1,271 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import { syncSelectionPrompt } from '../game/src/battle/view/battle.selection-ui.js';
+
+window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
+  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
+  MAP: { rules: { battleEnergy: 30, battleHandMax: 99, bossDeckSize: 99, starterSha: 0,
+    battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
+await import('../game/src/cards/cards.js');
+const C = window.SDT.Cards;
+C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
+const { BattleSession, configureBattleRenderer } = await import('../game/src/battle/core/battle.core.js');
+const E = await import('../game/src/battle/core/battle.engine.js');
+const R = await import('../game/src/battle/runtime/battle.runtime.js');
+const commands = BattleSession.commands;
+const snapshot = () => BattleSession.getSnapshot();
+const settle = () => vi.advanceTimersByTimeAsync(3000);
+const byId = id => structuredClone(C.all().find(card => card.id === id));
+const fuel = id => ({ id, name: '同名材料', type: '法术', cost: 0, desc: '回复1点生命', heal: 1 });
+const optional = () => byId('tt3sp-silverthorn');
+const pure = () => byId('tt12-raydragon');
+const twoFuel = () => ({ id:'flow-two', name:'双材料注能箭', type:'法术', cost:2, infuse:2,
+  dmg:5, dmgType:'spell', desc:'造成5点法术伤害；注能（2）：伤害+3。' });
+let game;
+
+beforeEach(() => {
+  vi.useFakeTimers(); configureBattleRenderer(() => {});
+  R.set$lastDeckSel([]); document.body.innerHTML = '';
+});
+afterEach(() => {
+  if (game?.battleActive) E.finish(null);
+  configureBattleRenderer(null); vi.clearAllTimers(); vi.useRealTimers();
+});
+async function begin(card, extra = [fuel('one')], enemies = 2) {
+  if (game?.battleActive) E.finish(null);
+  game = { ownedCards:[card, ...extra].map((card, i) => ({ uid:`flow-${i}`, card })),
+    hp:30, maxHp:50, atk:0, spellPower:0, coins:0, myClass:null, characterId:null,
+    state:'idle', battleActive:false, log:vi.fn(), inventory:[], usedPocket:[],
+    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {} };
+  BattleSession.start(game, Array.from({ length:enemies }, (_, i) => ({ id:'same-species', name:`靶子${i}`, hp:999, atk:0 })), { isBoss:false });
+  await settle();
+  expect(snapshot().phase).toBe('player');
+  return game;
+}
+const resources = () => ({ hand:[...R.hand], energy:R.energy, played:[...R.played],
+  consumed:[...R.consumed], discard:[...R.discard], grave:[...R.grave],
+  drawPile:[...R.drawPile], infuseFuels:R.infuseFuels });
+const pick = uid => commands.selectInfusion(uid);
+function materialTarget(cardUid = 'flow-0', picked = ['flow-1']) {
+  expect(commands.submitCardPlay(cardUid).kind).toBe('infusion');
+  picked.forEach(pick);
+  expect(commands.confirmInfusion().kind).toBe('target');
+  return snapshot();
+}
+
+describe('one infusion cast across default pointer, keyboard and target steps', () => {
+  it.each(['pointer', 'keyboard'])('optional infusion with no materials uses its base effect via %s', async input => {
+    await begin(optional(), [], 1);
+    const before = resources();
+    expect(commands.getCardPlayAvailability('flow-0', input === 'pointer' ? 0 : undefined).status).toBe('ready');
+    let submitted = commands.submitCardPlay('flow-0', input === 'pointer' ? 0 : undefined);
+    if (input === 'keyboard') {
+      expect(submitted.kind).toBe('target');
+      expect(snapshot().infusing).toBeNull();
+      expect(resources()).toEqual(before);
+      submitted = commands.submitCardPlay('flow-0', 0);
+    }
+    expect(submitted.status).toBe('queued');
+    await settle(); expect((await submitted.settled).status).toBe('committed');
+    expect(R.foes[0].hp).toBeLessThan(999); expect(R.infuseFuels).toBe(0);
+    expect(R.hand).not.toContain('flow-0'); expect(R.energy).toBe(before.energy - optional().cost);
+  });
+
+  it('optional infusion also falls back when the only remaining card forbids fuel', async () => {
+    await begin(optional(), [{ ...fuel('blocked'), rules:{ version:1, battle:{fuelAllowed:false} } }], 1);
+    const result = commands.submitCardPlay('flow-0', 0);
+    expect(result.status).toBe('queued'); await settle();
+    expect((await result.settled).status).toBe('committed');
+    expect(R.hand).toEqual(['flow-1']); expect(R.infuseFuels).toBe(0);
+  });
+
+  it('optional infusion with fewer materials than its cost keeps its base play', async () => {
+    await begin(twoFuel(), [fuel('one')], 1);
+    const final = commands.submitCardPlay('flow-0', 0); await settle();
+    expect((await final.settled).status).toBe('committed');
+    expect(R.hand).toEqual(['flow-1']); expect(R.infuseFuels).toBe(0);
+    expect(R.foes[0].hp).toBe(994);
+  });
+
+  it.each([undefined, 0])('pure infusion cannot bypass missing materials with side=%s', async side => {
+    await begin(pure(), [], 1); const before = resources();
+    expect(commands.getCardPlayAvailability('flow-0', side).reason.code).toBe('INFUSION_MATERIALS');
+    expect(commands.submitCardPlay('flow-0', side).reason.code).toBe('INFUSION_MATERIALS');
+    commands.playDirect('flow-0'); commands.confirmInfusion(); await settle();
+    expect(resources()).toEqual(before); expect(snapshot().infusing).toBeNull();
+  });
+
+  it.each(['pointer', 'keyboard'])('eligible materials enter the same selection via %s and pay once', async input => {
+    await begin(optional()); const before = resources();
+    const first = commands.submitCardPlay('flow-0', input === 'pointer' ? 1 : undefined);
+    expect(first).toMatchObject({ status:'needs-input', kind:'infusion' });
+    expect(snapshot().infusing.targetIndex).toBe(input === 'pointer' ? 1 : null);
+    expect(resources()).toEqual(before); pick('flow-1');
+    let final = commands.confirmInfusion();
+    if (input === 'keyboard') {
+      expect(final.kind).toBe('target');
+      expect(snapshot().pendingTarget.fuelUids).toEqual(['flow-1']);
+      expect(Object.isFrozen(snapshot().pendingTarget.fuelUids)).toBe(true);
+      expect(resources()).toEqual(before);
+      final = commands.submitCardPlay('flow-0', 1);
+    }
+    expect(final.status).toBe('queued');
+    commands.confirmInfusion(); await settle();
+    expect((await final.settled).status).toBe('committed');
+    expect(R.energy).toBe(before.energy - optional().cost); expect(R.infuseFuels).toBe(1);
+    expect(R.foes[0].hp).toBe(999); expect(R.foes[1].hp).toBeLessThan(999);
+    expect(R.played.filter(uid => uid === 'flow-0')).toHaveLength(1);
+    expect(R.consumed.filter(uid => uid === 'flow-1')).toHaveLength(1);
+    expect(snapshot().consumedPile).toEqual(expect.arrayContaining(['flow-0', 'flow-1']));
+    expect(R.drawPile).toEqual(before.drawPile);
+  });
+
+  it('returns to materials with the same UIDs, removing only invalid choices before reselection', async () => {
+    await begin(twoFuel(), [fuel('one'), fuel('two'), fuel('three')]);
+    const before = resources();
+    const targeted = materialTarget('flow-0', ['flow-1','flow-2']);
+    R.cardOverrides.set('flow-1', { ...fuel('one'), rules:{version:1,battle:{fuelAllowed:false}} });
+    commands.beginInfusion('flow-0');
+    expect(snapshot().infusing.picked).toEqual(['flow-2']);
+    expect(snapshot().infusing.selectionId).not.toBe(targeted.pendingTarget.selectionId);
+    expect(snapshot().pendingTarget).toBeNull(); expect(resources()).toEqual(before);
+    pick('flow-3'); expect(snapshot().infusing.picked).toEqual(['flow-2','flow-3']);
+    expect(commands.confirmInfusion().kind).toBe('target');
+    expect(snapshot().pendingTarget.fuelUids).toEqual(['flow-2','flow-3']);
+    expect(targeted.pendingTarget.fuelUids).toEqual(['flow-1','flow-2']);
+    commands.cancelPendingTarget(); commands.confirmInfusion(); await settle();
+    expect(resources()).toEqual(before); expect(snapshot().pendingTarget).toBeNull();
+  });
+
+  it('can return after all selected fuel leaves the hand and still offers cancel without payment', async () => {
+    await begin(pure()); materialTarget();
+    R.set$hand(['flow-0']); const before = resources();
+    commands.beginInfusion('flow-0');
+    expect(snapshot().infusing.picked).toEqual([]);
+    commands.confirmInfusion(); commands.cancelInfusion(); await settle();
+    expect(resources()).toEqual(before); expect(snapshot().infusing).toBeNull();
+  });
+
+  it('rejects invalid fuel at the final target, preserving the material step for correction', async () => {
+    await begin(optional()); materialTarget();
+    R.cardOverrides.set('flow-1', { ...fuel('one'), rules:{version:1,battle:{fuelAllowed:false}} });
+    const before = resources();
+    expect(commands.getCardPlayAvailability('flow-0', 0).reason.code).toBe('FUEL_INVALID');
+    expect(commands.submitCardPlay('flow-0', 0).reason.code).toBe('FUEL_INVALID');
+    expect(snapshot().pendingTarget.fuelUids).toEqual(['flow-1']);
+    commands.beginInfusion('flow-0'); expect(snapshot().infusing.picked).toEqual([]);
+    commands.cancelInfusion(); await settle(); expect(resources()).toEqual(before);
+  });
+
+  it('rechecks effective cost while confirming and keeps the selection when energy changed', async () => {
+    await begin(pure()); commands.beginInfusion('flow-0'); pick('flow-1');
+    R.set$energy(0); const before = resources(); commands.confirmInfusion(); await settle();
+    expect(snapshot().infusing.picked).toEqual(['flow-1']); expect(resources()).toEqual(before);
+  });
+
+  it('a pointer target replaced by another instance of the same species is selected again before payment', async () => {
+    await begin(optional()); commands.submitCardPlay('flow-0', 1); pick('flow-1');
+    R.foes[1] = { ...R.foes[1], hp:777 };
+    const before = resources();
+    expect(commands.confirmInfusion().kind).toBe('target');
+    expect(resources()).toEqual(before); expect(snapshot().pendingTarget.fuelUids).toEqual(['flow-1']);
+  });
+
+  it('cancelled material and target steps cannot be revived by a late confirm', async () => {
+    await begin(optional()); const before = resources();
+    commands.beginInfusion('flow-0'); pick('flow-1'); commands.cancelInfusion(); commands.confirmInfusion();
+    expect(resources()).toEqual(before); expect(snapshot().infusing).toBeNull();
+    materialTarget(); commands.cancelPendingTarget(); commands.confirmInfusion(); await settle();
+    expect(resources()).toEqual(before); expect(snapshot().pendingTarget).toBeNull();
+  });
+
+  it('old-battle material and target state cannot cast in a new battle using the same UIDs', async () => {
+    await begin(optional()); commands.beginInfusion('flow-0'); pick('flow-1');
+    const oldMaterials = R.infusing;
+    await begin(optional()); const before = resources();
+    R.set$infusing(oldMaterials); commands.confirmInfusion(); pick('flow-1');
+    expect(resources()).toEqual(before); expect(snapshot().pendingTarget).toBeNull();
+    R.set$infusing(null); materialTarget(); const oldTarget = R.interaction;
+    await begin(optional()); const next = resources(); R.set$interaction(oldTarget);
+    expect(commands.submitCardPlay('flow-0', 0).reason.code).toBe('STALE_SELECTION');
+    await settle(); expect(resources()).toEqual(next);
+  });
+
+  it('late commands after battle teardown are inert even after the game host is removed', async () => {
+    await begin(optional()); commands.beginInfusion('flow-0'); pick('flow-1');
+    E.finish(null); R.set$G(null); const before = resources();
+    expect(() => { commands.playCard('flow-0'); commands.beginInfusion('flow-0');
+      commands.confirmInfusion(); commands.selectInfusion('flow-1'); }).not.toThrow();
+    expect(commands.submitCardPlay('flow-0', 0).reason.code).toBe('NO_ACTIVE_BATTLE');
+    expect(resources()).toEqual(before);
+  });
+
+  it('explicit direct play drops chosen fuel and uses the base effect', async () => {
+    await begin(optional()); materialTarget(); const before = resources();
+    commands.playDirect('flow-0');
+    expect(snapshot().pendingTarget.fuelUids).toEqual([]);
+    const final = commands.submitCardPlay('flow-0', 0); await settle();
+    expect((await final.settled).status).toBe('committed');
+    expect(R.hand).toContain('flow-1'); expect(R.infuseFuels).toBe(0);
+    expect(R.energy).toBe(before.energy - optional().cost);
+  });
+
+  it('free casts keep their grant through material selection and targeting', async () => {
+    await begin(pure()); R.freeCast.add('flow-0'); const before = resources();
+    materialTarget(); commands.beginInfusion('flow-0');
+    expect(R.freeCast.has('flow-0')).toBe(true);
+    expect(commands.confirmInfusion().kind).toBe('target');
+    const final = commands.submitCardPlay('flow-0', 0); await settle();
+    expect((await final.settled).status).toBe('committed');
+    expect(R.energy).toBe(before.energy); expect(R.infuseFuels).toBe(1);
+  });
+
+  it('switching a free cast to explicit direct play preserves free energy and all material UIDs', async () => {
+    await begin(optional()); R.freeCast.add('flow-0'); const before = resources(); materialTarget();
+    commands.playDirect('flow-0');
+    expect(R.freeCast.has('flow-0')).toBe(true); expect(snapshot().pendingTarget.fuelUids).toEqual([]);
+    const final = commands.submitCardPlay('flow-0', 0); await settle();
+    expect((await final.settled).status).toBe('committed');
+    expect(R.energy).toBe(before.energy); expect(R.hand).toContain('flow-1'); expect(R.infuseFuels).toBe(0);
+  });
+
+  it('actual normal-deck material keeps its UID in the unified consumed pile without permanent ownership', async () => {
+    await begin(optional(), [], 1);
+    expect(R.drawPile.filter(uid => uid.startsWith('normal-sha-'))).toHaveLength(99);
+    expect(E.drawCards(1)).toBe(1);
+    const temporary = R.hand.find(uid => uid.startsWith('normal-sha-'));
+    expect(temporary).toBeTruthy(); const remainingDeck = [...R.drawPile];
+    commands.submitCardPlay('flow-0', 0); pick(temporary);
+    const final = commands.confirmInfusion(); await settle();
+    expect((await final.settled).status).toBe('committed');
+    expect(snapshot().consumedPile).toContain(temporary);
+    expect(R.consumed).toContain(temporary); expect(R.drawPile).toEqual(remainingDeck);
+    expect(game.ownedCards.some(entry => entry.uid === temporary)).toBe(false);
+    E.finish(null);
+    expect(R.opts.spentCards.some(entry => entry.uid === temporary)).toBe(false);
+  });
+
+  it.each(['instance','global'])('%s waiver still bypasses materials and keeps all fuel', async kind => {
+    const card = pure(); if (kind === 'instance') card._noInfuse = true;
+    await begin(card); R.set$allSpellsInfused(kind === 'global');
+    const final = commands.submitCardPlay('flow-0', 0); await settle();
+    expect((await final.settled).status).toBe('committed');
+    expect(R.hand).toContain('flow-1'); expect(R.infuseFuels).toBe(0);
+  });
+
+  it('the target strip returns to the same material UIDs and rejects a late button from an older step', async () => {
+    await begin(optional()); materialTarget();
+    document.body.innerHTML = '<div class="battle-stage"></div>';
+    const stage = document.querySelector('.battle-stage'); stage._battleToken = snapshot().battleToken;
+    const returnToInfusion = vi.fn(uid => commands.beginInfusion(uid));
+    const cancel = vi.fn();
+    const sync = () => syncSelectionPrompt(stage, snapshot(), { getCurrent:() => ({snapshot:snapshot(),stage}),
+      findCard:E.findCard, onCancel:cancel, onReturnToInfusion:returnToInfusion });
+    sync(); const old = stage.querySelector('[data-act="btPickReturnInfusion"]');
+    old.click(); expect(returnToInfusion).toHaveBeenCalledTimes(1);
+    expect(snapshot().infusing.picked).toEqual(['flow-1']);
+    expect(commands.confirmInfusion().kind).toBe('target');
+    old.click(); expect(returnToInfusion).toHaveBeenCalledTimes(1);
+    sync(); stage.querySelector('[data-act="btPickReturnInfusion"]').click();
+    expect(returnToInfusion).toHaveBeenCalledTimes(2); expect(cancel).not.toHaveBeenCalled();
+  });
+});
```

</details>
