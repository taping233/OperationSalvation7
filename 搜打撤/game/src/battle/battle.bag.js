/* battle.bag.js —— 战斗背包、道具/药水与砸击/双镖点选命令（自 battle.engine.js 拆出）。
 * 规则数据经 battle.runtime.js 活绑定直读；引擎侧结算件由 createBattleBag 注入。 */
const SDT = window.SDT;
import { esc } from '../core/shared.js';
import { Random } from '../core/random.js';
import * as Combat from './combat.js';
import { itemTargetSideFor } from './battle.rules.js';
import { G, foes, mode, energy, busy, infusing, discovering, choosing, handSelecting, viewingGrave, selectingDeck, viewingBag, pstat, floats, consumed, hand, cardAnims, set$energy, set$viewingBag } from './battle.runtime.js';

export function createBattleBag({
  requestBattleRender, clearTargetSession, cancelInteraction, beginSpecialTargeting, interactionOf,
  queueBattleAction, runStagedSteps, singleTargetHitSteps, applyTextEffects, hitFoe,
  sweepDead, finish, alive, addTempCard, addDeckCard, fireCatGift, applyKillRewards,
  throwIfActionCancelled, findCard,
}) {
  function restoreConsumed(n) {
    let cnt = 0;
    while (cnt < n && consumed.length) {
      const uid = consumed.pop();
      hand.push(uid);
      const o = findCard(uid);
      cardAnims.push({ kind: 'draw', uid, name: o ? o.card.name : '' });
      cnt++;
    }
    if (cnt) G.log(`[[icon:gem]] 复原 ${cnt} 张消耗卡，回到手牌`, 'ok');
    return cnt;
  }

  // ---------- 战斗背包（2026-09-09 老板：战斗中也能开背包使用道具） ----------
  // 道具在战斗内直接生效于战局：回复类回血、能源结晶复原消耗堆、神秘药水随机效果、
  // 口粮/木材入库；其余道具（通行证等涉及获得卡牌的）战斗内不可用，回地图再使。
  function battleBagItems() {
    return (G.ownedCards || []).filter(o => o.card && o.card.type === '道具' && !o.safe);
  }
  // 道具栏可用性（2026-09-09 老板 #10）：不可用的道具在栏内虚化并说明原因，点击不再消耗
  const ITEM_BOSS_FLEE_PATTERN = /非\s*BOSS\s*战/;
  function itemUsability(card) {
    if (!card) return { usable: false, why: '未知道具' };
    if (card.id === 'tt-token-color') return { usable: false, why: '合成材料：集齐 2 枚员工通行证A碎片后在背包里合成' };
    if (mode === 'boss' && ITEM_BOSS_FLEE_PATTERN.test(String(card.desc || ''))) return { usable: false, why: 'BOSS 战中无法逃跑' };
    if (itemTargetSideFor(card) === 'enemy' && !alive().length) return { usable: false, why: '场上没有敌人可用' };
    return { usable: true, why: '' };
  }
  function useItem(uid, side) {
    const entry = battleBagItems().find(o => o.uid === uid);
    if (!entry) return;
    if (busy || infusing || discovering || choosing || handSelecting) return;
    const card = entry.card;
    const desc = String(card.desc || '');
    const healM = desc.match(/回复\s*(\d+)\s*点生命/);
    const isCrystal = card.id === 'tt-crystal' || /复活最多\s*3\s*张卡牌/.test(desc);
    const isPotion = card.id === 'tt3-mystery-potion' || /随机神秘效果/.test(desc);
    const rm = desc.match(/获得\s*(\d+)\s*份?\s*口粮/) || desc.match(/口粮\s*[×x]\s*(\d+)/);
    const wm = desc.match(/木材\s*[×x]\s*(\d+)/);
    if (!healM && !isCrystal && !isPotion && !rm && !wm) {
      // 2026-09-12：战斗效果类道具（药水/TNT/烟雾弹/通行证C/员工通行证A）走药水栏结算
      useBattleEffectItem(entry, side);
      return;
    }
    // 先扣再用（与地图侧道具一致）：用掉即从背包移除
    clearTargetSession();
    G.ownedCards.splice(G.ownedCards.indexOf(entry), 1);
    G.log(`[[icon:bag]] 使用道具【<b>${esc(card.name)}</b>】`, 'sys');
    if (healM) {
      const n = +healM[1];
      if ((pstat.status.healban || 0) > 0) {
        G.log(`[[icon:heart]] 禁疗中：回复 <b>${n}</b> 点生命无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
      } else {
        G.heal(n);
        floats.push({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
      }
    }
    if (isCrystal) {
      if (!restoreConsumed(3)) G.log('消耗堆是空的，没有可复原的卡牌', 'dim');
    }
    if (isPotion) {
      const r = Random.random('loot');
      if (r < 1 / 3) {
        if ((pstat.status.healban || 0) > 0) G.log('[[icon:flask]] 禁疗中：神秘药水的回复无效', 'warn');
        else { G.heal(8); floats.push({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true }); }
      } else if (r < 2 / 3) {
        G.coins += 3;
        G.log('[[icon:flask]] 神秘药水：获得 <b>3</b> 币', 'coin');
      } else {
        const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
        const got = pool.length ? pool[Math.floor(Random.random('loot') * pool.length)] : null;
        if (got) {
          if (mode === 'boss') addDeckCard({ ...got });
          else addTempCard({ ...got });
          G.log(`[[icon:flask]] 神秘药水：随机获得【<b>${esc(got.name)}</b>】${mode === 'boss' ? '（洗入牌库）' : '（置入手牌）'}`, 'loot');
          fireCatGift(got);   // 阿猫的礼物：随机获取触发
        }
      }
    }
    if (rm) G.addItem(SDT.MAP.items.rations, +rm[1]);
    if (wm) G.addItem(SDT.MAP.items.wood, +wm[1]);
    requestBattleRender();
  }
  // 战斗效果类道具（2026-09-12 药水栏批次）：描述交真实执行器结算，敌方指向道具可拖/点选目标
  function useBattleEffectItem(entry, side) {
    const card = entry.card;
    const needsEnemy = itemTargetSideFor(card) === 'enemy';
    if (needsEnemy && side == null) {
      const n = alive().length;
      if (!n) { G.log(`[[icon:cross]] 场上没有敌人可以使用`, 'warn'); return; }
      if (n > 1) {
        beginSpecialTargeting('item', entry.uid, card);
        G.log(`[[icon:flask]] <b>${esc(card.name)}</b>：点击一名敌人使用（或把它拖到敌人身上）`, 'sys');
        return;
      }
      side = foes.indexOf(alive()[0]);
    }
    const chosen = side != null ? foes[+side] : null;
    if (needsEnemy && (!chosen || chosen.dead)) {
      if (alive().length) beginSpecialTargeting('item', entry.uid, card);
      else cancelInteraction();
      G.log(`[[icon:cross]] 【${esc(card.name)}】的目标已失效，${alive().length ? '请重新选择存活敌人' : '场上已无敌人，道具未消耗'}`, 'warn');
      return;
    }
    const target = chosen && !chosen.dead ? chosen : (alive()[0] || null);
    clearTargetSession();
    queueBattleAction(async signal => {
      throwIfActionCancelled(signal);
      const current = battleBagItems().find(item => item.uid === entry.uid);
      if (!current) return;
      if (needsEnemy && target.dead) {
        G.log(`[[icon:cross]] 【${esc(card.name)}】的目标已失效，道具未消耗`, 'warn');
        return;
      }
      const index = G.ownedCards.indexOf(current);
      if (index < 0) return;
      G.ownedCards.splice(index, 1);
      G.log(`[[icon:bag]] 使用道具【<b>${esc(card.name)}</b>】${target ? `→ ${esc(target.name)}` : ''}`, 'sys');
      if (applyTextEffects.steps) await runStagedSteps(applyTextEffects.steps(card, String(card.desc || ''), target, {}), signal);
      else applyTextEffects(card, String(card.desc || ''), target, {});
      throwIfActionCancelled(signal);
      sweepDead();
      if (!alive().length) { finish(true); return; }
      requestBattleRender();
    }, '道具动作');
  }
  // —— 背包砸击（2026-09-16 老板：改回按钮形态——手牌左侧的背包图案按钮，不再向手牌置入令牌；
  //     2026-09-13 曾改为自动置入手牌的常驻牌，因污染一切手牌检测作废）——
  // 2 费 · 4 点固定伤害 · 点按钮进入点选，再点一次取消；不占手牌、不进任何手牌检测
  function bagSlam() {
    if (busy || infusing || discovering || choosing || handSelecting || viewingGrave || selectingDeck) return;
    if (interactionOf('slam')) { cancelSlam(); return; }
    if (energy < 2) { G.log('[[icon:bolt]] 能量不足：背包砸击需要 2 点能量', 'warn'); return; }
    if (!alive().length) { G.log('[[icon:cross]] 场上没有敌人可以砸击', 'warn'); return; }
    beginSpecialTargeting('slam');
    G.log('[[icon:bag]] <b>背包砸击</b>：点击一名敌人砸下（2 费 · 4 点固定伤害 · 不消耗卡牌）', 'sys');
  }
  function cancelSlam() { cancelInteraction(); }

  // —— 血毒双镖·第二镖（2026-09-16 留言「应该能选择两次目标」）——
  // 首段（攻+1 附加流血）随出牌目标结算；二段（攻+1 附加中毒）进入点选：
  // 点击任意敌人结算，可以重复选择同一目标。结束回合放弃点选则二段失效。
  function beginDartStrike() {
    if (!alive().length) return;
    beginSpecialTargeting('dart');
    G.log('[[icon:blood]] <b>血毒双镖</b>·第二镖：点击一名敌人（攻 +1，附加中毒 · 可重复选择同一目标）', 'sys');
  }
  function resolveDart(side) {
    if (!interactionOf('dart')) return;
    if (busy) return;
    const t = side != null ? foes[+side] : null;
    if (!t || t.dead) {
      G.log('[[icon:cross]] 血毒双镖：请重新选择一名存活敌人', 'warn');
      requestBattleRender();
      return;
    }
    clearTargetSession();
    queueBattleAction(async signal => {
      throwIfActionCancelled(signal);
      const aliveBefore = alive().length;
      const struck = await runStagedSteps(singleTargetHitSteps(t, () => {
        SDT.Sound.sfx('strike');
        hitFoe(t, { name: '血毒双镖·第二镖', desc: '' }, 1, Combat.TYPES.ATTACK, '');
        if (!t.dead) { Combat.addCurse(t, 'poison', 1); G.log(`[[icon:skull]] <b>${esc(t.name)}</b> 附加 1 层中毒`, 'sys'); }
      }), signal);
      if (!struck) return;
      applyKillRewards(null, aliveBefore - alive().length);
      sweepDead();
      if (!alive().length) { finish(true); return; }
      requestBattleRender();
    }, '血毒双镖');
  }
  function resolveSlam(side) {
    if (!interactionOf('slam')) return;
    if (busy) return;
    if (energy < 2) { G.log('[[icon:bolt]] 能量不足：背包砸击需要 2 点能量', 'warn'); requestBattleRender(); return; }
    const t = side != null ? foes[+side] : null;
    if (!t || t.dead) {
      G.log('[[icon:cross]] 背包砸击：请重新选择一名存活敌人', 'warn');
      requestBattleRender();
      return;
    }
    clearTargetSession();
    queueBattleAction(async signal => {
      throwIfActionCancelled(signal);
      const struck = await runStagedSteps(singleTargetHitSteps(t, () => {
        if (energy < 2) {
          G.log('[[icon:bolt]] 背包砸击取消：结算时能量已不足，未扣除能量', 'warn');
          return false;
        }
        set$energy(energy - 2);
        SDT.Sound.sfx('strike');
        const hpBefore = t.hp;
        const shieldBefore = t.defense?.shield || 0;
        const r = Combat.dealDamage({ atk: G.atk }, t, 4, Combat.TYPES.FIXED);
        const shieldBreak = shieldBefore > 0 && !(t.defense?.shield || 0);
        if (r.dealt > 0 || shieldBreak) floats.push({ unit: foes.indexOf(t),
          text: r.dealt > 0 ? '-' + r.dealt : '护盾破碎', cls: r.dealt > 0 ? 'dmg' : 'block',
          shieldBreak, hpBefore, hpAfter: t.hp, maxHp: t.maxHp });
        G.log(`[[icon:bag]] <b>背包砸击</b>砸向 ${esc(t.name)}：造成 <b>${r.dealt}</b> 点固定伤害（-2 能量）`, 'sys');
        sweepDead();
      }), signal);
      if (!struck) return;
      if (!alive().length) { finish(true); return; }
      requestBattleRender();
    }, '背包砸击');
  }

  // 药水栏点击：敌方指向道具在多敌时进入点选模式，其余直接生效
  function usePotion(uid) {
    const entry = battleBagItems().find(o => o.uid === uid);
    if (!entry) return;
    if (busy || infusing || discovering || choosing || handSelecting || viewingGrave || selectingDeck) return;
    if (interactionOf('item')?.uid === uid) { cancelInteraction(); return; }
    if (itemTargetSideFor(entry.card) === 'enemy') {
      const n = alive().length;
      if (!n) { G.log(`[[icon:cross]] 场上没有敌人可以使用`, 'warn'); return; }
      if (n > 1) {
        beginSpecialTargeting('item', entry.uid, entry.card);
        G.log(`[[icon:flask]] <b>${esc(entry.card.name)}</b>：点击一名敌人使用（或把它拖到敌人身上）`, 'sys');
        return;
      }
      useItem(uid, foes.indexOf(alive()[0]));
      return;
    }
    useItem(uid, null);
  }
  function openBag() {
    if (selectingDeck) { G.log('[[icon:lock]] 编组牌库时不能打开背包', 'warn'); return; }
    if (infusing || discovering || choosing || handSelecting) {
      G.log('[[icon:hourglass]] 当前效果结算中，稍候再打开背包', 'warn');
      return;
    }
    set$viewingBag(!viewingBag);   // 再按一次 B / 再点一次按钮 = 关闭
    requestBattleRender();
  }
  function closeBag() {
    set$viewingBag(false);
    requestBattleRender();
  }

  return {
    restoreConsumed, battleBagItems, itemUsability, useItem, useBattleEffectItem,
    bagSlam, beginDartStrike, resolveDart, resolveSlam, usePotion, openBag, closeBag,
  };
}
