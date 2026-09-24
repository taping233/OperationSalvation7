/* battle.enemy-phase.js —— 敌方阶段与回合结束（2026-09-22 六文件重构批6-C 自 battle.core.js 拆出，原行 2480-2797）。
 * 逐字搬迁（flee 因被引擎侧 finish 环调随迁 engine）；状态经 battle.runtime.js；禁 import 壳。 */
const SDT = window.SDT;
import { esc } from '../core/shared.js';
import { BATTLE_PHASES, cancelTargeting, transitionBattle } from './battle.state.js';
import { Random } from '../core/random.js';
import * as Combat from './combat.js';
import { demoMs } from './battle.pace.js';
import { battleState, G, foes, mode, drawPile, hand, consumed, grave, energy, maxEnergy, turn, pdef, pstat, busy, infusing, discovering, handSelecting, choosing, interaction, noDrawNext, floats, cardAnims, playedMovesThisTurn, allies, extraTurn, timeRune, holyRune, fireballRuneOn, swiftRune, timeSpaceRune, timeSpaceUsed, set$noDrawNext, set$energy, set$extraTurn, set$battleState, set$interaction, set$turn, set$busy, set$timeSpaceUsed, set$playedMartialThisTurn, set$playedMovesThisTurn, set$pendingHint, set$lastPersistAt } from './battle.runtime.js';
import { processDelayed, accrueGrowth, resolveCard, syncCurseCondEquips, applyKillRewards, unplayableReason, queueCardExecution, foeIdx, addPlayerCurse, playerTakeHit, frenzyCurse, elCurse, requestBattleRender, R, alive, intentFor, drawCards, resolveFoeDefeat, sweepDead, nestPhase, grantSha, findCard, effCostOf, finish } from './battle.engine.js';

  // 敌方步进演出节拍在 vitest 环境归零（比照 battle.engine.js 的 SURGE_WAVE_MS 先例）：
  // 回归测试的等待辅助用固定次数 setTimeout(0) tick 当预算，其真实间隔平台相关
  // （Windows ≈15.6ms / Linux ≈1ms），跨不过 420ms×N 的真实节拍会导致 CI 确定性红。
  // 仅测速环境生效；运行时 demoMs 照常逐次求值（2× 档倍率不受影响）。
  const ENEMY_STEP_ZERO = (typeof process !== 'undefined' && process.env && process.env.VITEST);

  // ---------- 回合结束 ----------
  function endTurn() {
    if (SDT.Meta && SDT.Meta.track) SDT.Meta.track('turnMoves', { n: playedMovesThisTurn });
    if (busy || infusing || discovering || choosing) return;
    if (battleState.phase === BATTLE_PHASES.VICTORY || battleState.phase === BATTLE_PHASES.DEFEAT) return;   // 终局后点击无效（2026-09-16 实测 defeat 后连点报错）
    if (interaction && interaction.kind !== 'card') set$interaction(null);   // 结束回合取消药水点选/砸击（卡牌指向在转入敌方阶段时清）
    // 批次C：指向性卡牌的 targeting 阶段若还挂着（直接释放未选目标 / 拖到死目标），
    // 必须先清掉——否则 targeting→enemy 是非法迁移，endTurn 直接抛错卡死。
    // 这里硬清槽位、不走 cancelInteraction：freeCast 簿记保留（「直接释放」卡跨回合仍免费）
    if (battleState.phase === BATTLE_PHASES.TARGETING) {
      set$interaction(null); set$pendingHint('');
      set$battleState(cancelTargeting(battleState));
    }
    set$busy(true);
    // —— 额外回合（命运钟表 C7）：跳过敌方阶段，直接刷新为你的下一个回合 ——
    if (extraTurn) {
      set$extraTurn(false);
      set$turn(turn + 1);
      foes.forEach(foe => { if (!foe.dead) foe.intent = intentFor(foe, turn); });
      set$energy(maxEnergy);
      if ((pstat.status.natureForm || 0) > 0) set$energy(energy + 1);
      if ((pstat.status.swordForm || 0) > 0) {
        if (mode === 'boss') { const got = drawCards(1); G.log(`[[icon:sword]] <b>剑仙形态</b>：额外抽了 ${got} 张牌`, 'ok'); }
        else grantSha(1);
      }
      if (noDrawNext) { set$noDrawNext(false); G.log('[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌', 'warn'); }
      else if (mode === 'boss') drawCards(R().battleTurnDraw);
      processDelayed();
      G.log(`[[icon:hourglass]] <b>额外回合</b>：敌人被钉在原地，你再次行动！（第 ${turn} 回合）`, 'ok');
      set$battleState(transitionBattle(battleState, BATTLE_PHASES.PLAYER));
      set$busy(false);
      requestBattleRender();
      return;
    }
    if (swiftRune && hand.length) {
      const u0 = hand[0];
      const o = findCard(u0);
      if (o && !unplayableReason(o.card) && effCostOf(o.card, u0) <= energy) {
        G.log('[[icon:bolt]] <b>极速符文</b>：回合结束，打出最左侧的手牌', 'sys');
        queueCardExecution(u0, o.card, [], alive()[0] || null, false);
        requestBattleRender();
        return;
      }
    }
    set$battleState(transitionBattle(battleState, BATTLE_PHASES.ENEMY));
    set$interaction(null);
    set$pendingHint('');
    // —— 玩家回合结束：中毒 / 灼烧结算 ——
    const pref = { hp: G.hp, defense: pdef, status: pstat.status };
    // 时光符文：回合结束效果触发 2 次（中毒/灼烧结算双倍）
    const tickPasses = timeRune ? 2 : 1;
    let pr = null, br = null;
    for (let pass = 0; pass < tickPasses; pass++) {
      const p1 = Combat.tickPoison(pref);
      if (p1) { pr = pr ? { dealt: pr.dealt + p1.dealt } : p1; }
      const b1 = Combat.tickBurn(pref);
      if (b1) { br = br ? { dealt: br.dealt + b1.dealt } : b1; }
    }
    G.hp = Math.max(0, pref.hp);
    if (pr) {
      floats.push({ unit: 'self', text: '-' + pr.dealt, cls: 'hurt' });
      G.log(`[[icon:skull]] 中毒结算：你受到 <b>${pr.dealt}</b> 点固定伤害（${G.hp}/${G.maxHp}）`, 'warn');
    }
    if (br) {
      floats.push({ unit: 'self', text: '-' + br.dealt, cls: 'hurt' });
      G.log(`[[icon:fire]] 灼烧结算：你受到 <b>${br.dealt}</b> 点固定伤害（${G.hp}/${G.maxHp}）`, 'warn');
    }
    // 计时状态不在玩家阶段递减——共享回合钟统一在每回合结束（afterEnemies 末尾）递减
    requestBattleRender();
    if (G.hp <= 0) { set$busy(false); finish(false); return; }
    // —— 随从自动攻击（Q4 老板定向：步兵等为你自动战斗；无攻血场面物件不参与）——
    allies.filter(a => !a.dead && !a.statless).forEach(a => {
      const t = alive()[0];
      if (!t) return;
      const r = Combat.dealDamage({ atk: a.atk, status: a.status }, t, 0, Combat.TYPES.ATTACK);
      if (r.dealt > 0) floats.push({ unit: foeIdx(t), text: '-' + r.dealt, cls: 'dmg' });
      G.log(`[[icon:swords]] <b>${esc(a.name)}</b> 自动攻击 ${esc(t.name)}：造成 <b>${r.dealt}</b> 点攻击伤害`, 'sys');
    });
    sweepDead();
    if (!alive().length) { set$busy(false); finish(true); return; }
    // —— 敌人回合：逐个行动 ——
    const acting = alive();
    let i = 0;
    const step = () => {
      if (G.hp <= 0) { set$busy(false); finish(false); return; }
      if (i >= acting.length) { afterEnemies(); return; }
      const foe = acting[i++];
      if (foe.dead) { step(); return; }
      if (foe.stunned) {
        foe.stunned = false;
        G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 蓄力完毕，下回合行动`, 'sys');
        step(); return;
      }
      if (foe.evenAttack && turn % 2 === 1) {
        G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 蓄力（偶数回合才会攻击）`, 'sys');
        step(); return;
      }
      if (foe.noFirstAttack && turn === 1) {
        G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 第一回合蓄力，不会攻击`, 'sys');
        step(); return;
      }
      if (!Combat.canAct(foe)) {
        G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 被冰冻，无法行动！`, 'sys');
      } else {
        const hits = foe.affix === 'frenzy' ? 2 : 1;
        for (let h = 0; h < hits && G.hp > 0; h++) {
          // 潜行：无法成为被攻击对象（冰冻/潜行的敌人在自己行动后照常递减计时）
          if (Combat.isStealthed(pstat)) {
            G.log(`[[icon:runner]] 你在<b>潜行</b>中，<b>${esc(foe.name)}</b> 无法将你作为攻击对象`, 'sys');
            break;
          }
          // 随从优先替主人承受伤害（Q4 老板定向：步兵「优先为主人承受伤害」；无攻血物件除外）
          const guard = allies.find(a => !a.dead && !a.statless);
          if (guard) {
            floats.push({ unit: foes.indexOf(foe), text: '', cls: 'lungefx' });   // 攻击前摇：敌人前倾
            const shieldBefore = guard.defense?.shield || 0;
            const ar = Combat.dealDamage({ atk: foe.atk }, guard, 0, Combat.TYPES.ATTACK);
            if (shieldBefore > 0 && !(guard.defense?.shield || 0)) SDT.Sound.sfx('shieldBreak');
            SDT.Sound.sfx('hurt');
            floats.push({ unit: 'ally:' + allies.indexOf(guard), text: '-' + ar.dealt, cls: 'hurt' });
            G.log(`[[icon:runner]] <b>${esc(guard.name)}</b> 替你承受了 <b>${ar.dealt}</b> 点攻击伤害（${Math.max(0, guard.hp)}/${guard.maxHp}）`, 'sys');
            if (guard.hp <= 0 && !guard.dead) {
              guard.dead = true;
              G.log(`[[icon:skull]] <b>${esc(guard.name)}</b> 阵亡`, 'warn');
            }
            continue;
          }
          floats.push({ unit: foes.indexOf(foe), text: '', cls: 'lungefx' });   // 攻击前摇：敌人前倾
          const shieldBefore = pdef.shield || 0;
          const dealt = playerTakeHit(foe);
          if (shieldBefore > 0 && !(pdef.shield || 0)) SDT.Sound.sfx('shieldBreak');
          // 敌人造成伤害也会破除它自己的潜行
          if (dealt > 0 && Combat.breakStealth(foe)) {
            G.log(`[[icon:runner]] <b>${esc(foe.name)}</b> 发动了攻击，<b>潜行</b>被破除`, 'dim');
          }
          if (dealt > 0 && foe.affix === 'frenzy') frenzyCurse(foe);
          // 龙巢：黑暗使者攻击后消耗对方 1 张手牌；远古龙尊按阶段附加诅咒/回血
          if (dealt > 0 && foe.handConsume && hand.length) {
            const vi = Math.floor(Random.random('battle') * hand.length);
            const vu = hand.splice(vi, 1)[0];
            const vo = findCard(vu);
            consumed.push(vu);
            grave.push(vu);
            G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> 消耗了你手牌中的【${esc(vo ? vo.card.name : '?')}】`, 'warn');
          }
          if (dealt > 0 && foe.phases) {
            const ph = foe.phase || 1;
            if (ph === 1) {
              const keys = ['bleed', 'poison', 'silence', 'abreak', 'healban', 'burn'];
              SDT.Sound.sfx('danger');
              addPlayerCurse(keys[Math.floor(Random.random('battle') * keys.length)], 1, foe);
              G.log('[[icon:fire]] 远古龙尊的吐息附加了一层随机诅咒（冰冻除外）', 'warn');
            } else if (ph === 2) {
              foe.hp = Math.min(foe.maxHp, foe.hp + 10);
              G.log('[[icon:fire]] 远古龙尊回复了 10 点生命', 'warn');
            }
          }
          // 行为型附加：灼热异变体（攻击并灼烧）/ 滋生异变体（攻击并施加诅咒）
          if (dealt > 0 && foe.behavior === 'burn') {
            SDT.Sound.sfx('danger');
            addPlayerCurse('burn', 2, foe);
            SDT.Sound.sfx('curse');
            G.log(`[[icon:fire]] <b>${esc(foe.name)}</b> 的攻击附加了<b>灼烧</b>（2 回合内每回合结束受 1 点固定伤害）`, 'warn');
          } else if (dealt > 0 && foe.behavior === 'curse') {
            elCurse(foe);
          }
        }
      }
      requestBattleRender();
      if (G.hp <= 0) { set$busy(false); finish(false); return; }
      setTimeout(step, ENEMY_STEP_ZERO ? 0 : demoMs(420));   // 敌方步进：2× 档经 demoMs 单一倍率缩放（battle.pace.js）；vitest 归零（见文件头 ENEMY_STEP_ZERO）
    };
    setTimeout(step, ENEMY_STEP_ZERO ? 0 : demoMs(420));
  }

  function afterEnemies() {
    const aliveBeforeTick = alive().length;
    if (holyRune && turn <= 3) {
      const n = timeRune ? 8 : 4;   // 时光符文：回合结束效果触发 2 次
      pdef.armor += n;
      SDT.Sound.sfx('shieldUp');
      G.log('[[icon:shield]] <b>圣洁符文</b>：回合结束获得 ' + n + ' 点护甲（' + pdef.armor + '）', 'sys');
    }
    // —— 敌人回合结束：中毒 / 灼烧结算 + 词缀 ——
    foes.forEach(foe => {
      if (foe.dead) return;
      const tickPasses = timeRune ? 2 : 1;   // 时光符文：回合结束效果触发 2 次
      let poisonDealt = 0, burnDealt = 0;
      for (let tp = 0; tp < tickPasses; tp++) {
        const er = Combat.tickPoison(foe);
        if (er) poisonDealt += er.dealt;
        const eb = Combat.tickBurn(foe);
        if (eb) burnDealt += eb.dealt;
      }
      if (poisonDealt) {
        floats.push({ unit: foes.indexOf(foe), text: '-' + poisonDealt, cls: 'dmg', tintKey: 'poison' });
        G.log(`[[icon:skull]] 中毒结算：<b>${esc(foe.name)}</b> 受到 <b>${poisonDealt}</b> 点固定伤害（${Math.max(0, foe.hp)}/${foe.maxHp}）${timeRune ? '（时光×2）' : ''}`, 'sys');
      }
      if (burnDealt) {
        floats.push({ unit: foes.indexOf(foe), text: '-' + burnDealt, cls: 'dmg', tintKey: 'burn' });
        G.log(`[[icon:fire]] 灼烧结算：<b>${esc(foe.name)}</b> 受到 <b>${burnDealt}</b> 点固定伤害（${Math.max(0, foe.hp)}/${foe.maxHp}）`, 'sys');
      }
      if (resolveFoeDefeat(foe, '毒发倒地')) SDT.Sound.sfx('kill');
    });
    if (!alive().length) { set$busy(false); finish(true); return; }
    applyKillRewards(null, aliveBeforeTick - alive().length);   // 毒杀计入饮血剑击杀层数
    // 军威（肃清总督）：回合结束时攻击力 +2
    foes.forEach(foe => {
      if (!foe.dead && foe.affix === 'grow') {
        foe.atk += 2;
        G.log(`[[icon:arrow]] <b>军威</b>：<b>${esc(foe.name)}</b> 攻击力增至 <b>${foe.atk}</b>`, 'warn');
      }
    });
    // —— 共享回合钟：所有计时状态在本回合结束统一递减 1 ——
    // 持续 1 回合 = 本回合结束前生效；持续 n 回合 = 从触发当回合起覆盖 n 个完整回合
    if (timeRune) G.log('[[icon:hourglass]] <b>时光符文</b>：你的增益状态在时光中凝固（不递减）', 'sys');
    else tickDurationsLog(pstat, '你');
    foes.forEach(foe => { if (!foe.dead) tickDurationsLog(foe, foe.name); });
    // 影噬/影蚀：偷取攻击 1 回合后还原（2026-09-16 留言 #20）
    foes.forEach(foe => {
      if (foe.dead || !foe._stealRestore) return;
      if (turn > (foe._stealRestoreTurn || 0)) {
        foe.atk += foe._stealRestore;
        G.log(`[[icon:arrow]] <b>${esc(foe.name)}</b> 的攻击力恢复 ${foe._stealRestore} 点（现 ${foe.atk}）`, 'sys');
        foe._stealRestore = 0;
      }
    });
    // 偷取攻击到期：与 1 回合攻强化同期还原（2026-09-09 留言 #1/#2）
    foes.forEach(foe => {
      if (!foe.dead || !foe._stealRestore) return;
      foe.atk = (foe.atk || 0) + foe._stealRestore;
      G.log(`[[icon:arrow]] <b>${esc(foe.name)}</b> 被偷取的攻击力归还（恢复至 ${foe.atk}）`, 'dim');
      delete foe._stealRestore;
    });
    syncCurseCondEquips();   // 条件装备（深海印记类）随诅咒状态变化重新核算
    set$turn(turn + 1);
    foes.forEach(foe => { if (!foe.dead) foe.intent = intentFor(foe, turn); });
    set$energy(maxEnergy);
    set$playedMartialThisTurn(0);   // 追斩/连续射击：本回合打出计数随新回合清零
    set$playedMovesThisTurn(0);
    accrueGrowth();   // 充能火球等「回合开始时本牌伤害+1」按 uid 成长
    // —— 新回合开始：玩家形态祝福 ——
    if ((pstat.status.natureForm || 0) > 0) {
      set$energy(energy + 1);
      G.log(`[[icon:wood]] <b>自然形态</b>：额外获得 1 点能量（当前 ${energy}/${maxEnergy}）`, 'ok');
    }
    if ((pstat.status.swordForm || 0) > 0) {
      if (mode === 'boss') {
        const got = drawCards(1);
        G.log(`[[icon:sword]] <b>剑仙形态</b>：额外抽了 ${got} 张牌`, 'ok');
      } else {
        grantSha(1);
        G.log(`[[icon:sword]] <b>剑仙形态</b>：额外获得 1 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'ok');
      }
    }
    // —— 龙巢：远古龙尊阶段检定 / 时空符文 / 火球符文 ——
    foes.forEach(f => { if (!f.dead && f.phases) nestPhase(f); });
    foes.forEach(f => {
      if (!f.dead || !f.rotateImmune) return;
      const keys = ['bleed', 'poison', 'silence', 'abreak', 'healban', 'burn', 'freeze'];
      const picked = [];
      while (picked.length < 2) {
        const k = keys[Math.floor(Random.random('battle') * keys.length)];
        if (!picked.includes(k)) picked.push(k);
      }
      f.noCurseKeys = picked;
      G.log(`[[icon:shield]] <b>${esc(f.name)}</b> 切换免疫：${picked.join('、')}`, 'warn');
    });
    if (timeSpaceRune && !timeSpaceUsed && drawPile.length === 0) {
      set$timeSpaceUsed(true);
      set$extraTurn(true);
      G.log('[[icon:hourglass]] <b>时空符文</b>：牌库已空——额外回合！（本局限一次）', 'ok');
    }
    if (fireballRuneOn && drawPile.length) {
      const bottom = drawPile.shift();   // 牌库底
      const o = findCard(bottom);
      grave.push(bottom);
      G.log(`[[icon:fire]] <b>火球符文</b>：消耗牌库底的【${esc(o ? o.card.name : '?')}】`, 'sys');
      const fbPool = SDT.Cards.all().filter(c => String(c.name || '').includes('火球') && c.type === '法术');
      if (fbPool.length) {
        const fb = fbPool[Math.floor(Random.random('battle') * fbPool.length)];
        const target = alive()[0] || null;
        if (target) {
          cardAnims.push({ kind: 'surge', i: 1, n: 1, sourceName: '火球符文', name: fb.name, target: foes.indexOf(target), targetName: target.name, card: { ...fb } });
          G.log(`[[icon:fire]] <b>火球符文</b>：随机释放【${esc(fb.name)}】→ <b>${esc(target.name)}</b>`, 'loot');
        }
        resolveCard(fb, target, false, 0);
      }
    }
    // —— 新回合开始：「回合开始时」延迟段结算 ——
    processDelayed();
    // —— 常规抽牌（「下回合无法抽牌」标记在本回合开始消耗掉） ——
    if (noDrawNext) {
      set$noDrawNext(false);
      G.log('[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌', 'warn');
    } else if (mode === 'boss') {
      drawCards(R().battleTurnDraw);
    }
    // 敌人回合结束必须转回玩家阶段：此前 phase 卡在 enemy，
    // 视图的 data-phase="enemy" 规则（手牌下沉/禁点）会吞掉之后每个玩家回合
    set$battleState(transitionBattle(battleState, BATTLE_PHASES.PLAYER));
    set$busy(false);
    if (G.persistSave && G.battleActive) { set$lastPersistAt(performance.now()); G.persistSave(); }   // 回合开始落盘（无条件，同步节流时钟）
    if (typeof SDT.Sound?.setBattlePressure === 'function') {
      const hpRatio = G.maxHp > 0 ? G.hp / G.maxHp : 1;
      SDT.Sound.setBattlePressure(Math.max(0, Math.min(1, 1 - hpRatio)));
    }
    requestBattleRender();
  }

  function tickDurationsLog(target, who) {
    const meta = (k) => Combat.CURSE_META[k] || Combat.BUFF_META[k];
    const expired = Combat.tickDurations(target);
    expired.forEach(k => G.log(`[[icon:sparkles]] ${esc(who)} 的<b>${meta(k).name}</b>效果结束了`, 'dim'));
    if (expired.some(k => Combat.BUFF_META[k])) SDT.Sound.sfx('buffDown');   // 增益到期=轻碎裂提示（音频 P2#6，与挂上音成对）
    if (expired.some(k => Combat.CURSE_META[k])) SDT.Sound.sfx('curseEnd');
  }

  

  // 主动撤离（2026-09-09 玩法定版）：战斗中的「撤退」一律视为本局失败——
  // 仅烟雾弹的逃跑（fleeBattle → flee）豁免。走战败结算（安全格抢运、对局结束）。
  function surrender() {
    if (busy || infusing || discovering || choosing || handSelecting) return;
    G.surrenderedRun = true;
    SDT.Sound.sfx('flee');
    G.log('[[icon:cross]] 你选择了撤离——<b>本局视为失败</b>，安全格中的卡牌将被抢运回基地', 'warn');
    finish(false);
  }


export { endTurn, afterEnemies, surrender };
