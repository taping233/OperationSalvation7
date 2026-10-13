/* battle.bag.js —— 战斗背包、道具/药水与砸击/双镖点选命令（自 battle.engine.js 拆出）。
 * 规则数据经 battle.runtime.js 活绑定直读；引擎侧结算件由 createBattleBag 注入。 */
const SDT = window.SDT;
import { esc } from '../../core/shared.js';
import { Random } from '../../core/random.js';
import * as Combat from '../core/combat.js';
import { itemTargetSideFor } from '../effects/battle.target-rules.js';
import { getHostedExecutionCard } from '../effects/battle.hosted.js';
import { G, foes, mode, energy, busy, infusing, discovering, choosing, handSelecting, viewingGrave, selectingDeck, viewingBag, pstat, floats, consumed, hand, cardAnims, delayed, set$energy, set$viewingBag, battleState } from '../runtime/battle.runtime.js';
import { slamSkillFor, SLAM_SKILL_PRIEST_FLIPPED } from './battle.slam-skill.js';

export function createBattleBag({
  requestBattleRender, clearTargetSession, cancelInteraction, beginSpecialTargeting, interactionOf,
  queueBattleAction, runStagedSteps, singleTargetHitSteps, applyTextEffects, hitFoe,
  sweepDead, finish, alive, addTempCard, addDeckCard, fireCatGift, applyKillRewards,
  throwIfActionCancelled, findCard,
  triggersM2,
  addEnergy, drawCards, grantSha, queueDiscover, getTurn,
  processDiscoverQueue, randomDiscoverCard,
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
    // M3：结构化 flee op 的 BOSS 禁用（与文本 ITEM_BOSS_FLEE_PATTERN 同口径）
    if (mode === 'boss' && Array.isArray(card.rules?.bag?.use) &&
        card.rules.bag.use.some(op => op?.op === 'flee')) return { usable: false, why: 'BOSS 战中无法逃跑' };
    if (itemTargetSideFor(card) === 'enemy' && !alive().length) return { usable: false, why: '场上没有敌人可用' };
    return { usable: true, why: '' };
  }
  function useItem(uid, side) {
    const entry = battleBagItems().find(o => o.uid === uid);
    if (!entry) return;
    if (busy || infusing || discovering || choosing || handSelecting) return;
    const card = getHostedExecutionCard(entry.card);
    // G-1（2026-09-29 夜班）：入口复检可用性——视图层拦截（药水栏 .off / BOSS 战背包拒开）之外的
    // agent 命令通道（useItem 直达引擎）不再绕过 BOSS 战禁逃等口径，三条使用通道同闸。
    const usability = itemUsability(card);
    if (!usability.usable) { G.log(`[[icon:lock]] 【${esc(card.name)}】${usability.why}，道具未消耗`, 'dim'); return; }
    const desc = String(card.desc || '');
    if (Array.isArray(card.rules?.bag?.use)) {
      useBattleEffectItem({ ...entry, card }, side);
      return;
    }
    const healM = desc.match(/回复\s*(\d+)\s*点生命/);
    const isCrystal = card.id === 'tt-crystal' || /复活最多\s*3\s*张卡牌/.test(desc);
    const isPotion = card.id === 'tt3-mystery-potion' || /随机神秘效果/.test(desc);
    const rm = desc.match(/获得\s*(\d+)\s*份?\s*口粮/) || desc.match(/口粮\s*[×x]\s*(\d+)/);
    const wm = desc.match(/木材\s*[×x]\s*(\d+)/);
    if (!healM && !isCrystal && !isPotion && !rm && !wm) {
      // 2026-09-12：战斗效果类道具（药水/TNT/烟雾弹/通行证C/员工通行证A）走药水栏结算
      useBattleEffectItem({ ...entry, card }, side);
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
          if (!got.rules?.triggers?.onAcquire?.length) fireCatGift(got);   // 结构化 onAcquire 已由 addTempCard 触发
        }
      }
    }
    if (rm) G.addItem(SDT.MAP.items.rations, +rm[1]);
    if (wm) G.addItem(SDT.MAP.items.wood, +wm[1]);
    requestBattleRender();
  }
  // M3（执行器收编轮）：rules.bag.use 结构化分派——战斗内药水/道具按 ops 结算，
  // 沉默封印口径与文本道具一致（药水不受沉默影响，无技能句）；op 集与 schema BAG_SUPPORTED_OPS 对齐
  function useStructuredBattleBag(entry, side) {
    const card = entry.card;
    const ops = card.rules?.bag?.use;
    if (!Array.isArray(ops) || !ops.length) return false;
    const chosen = side != null ? foes[+side] : null;
    const target = chosen && !chosen.dead ? chosen : (alive()[0] || null);
    const aliveBefore = alive().length;   // 击杀奖励总账基数（对齐 resolveDart：饮血剑 per-kill 增益）
    const index = G.ownedCards.findIndex(item => item.uid === entry.uid);
    if (index < 0) return true;
    G.ownedCards.splice(index, 1);
    G.log(`[[icon:bag]] 使用道具【<b>${esc(card.name)}</b>】${target ? `→ ${esc(target.name)}` : ''}`, 'sys');
    for (const op of ops) {
      if (!op || typeof op !== 'object') continue;
      const amount = Number.isInteger(op.amount) ? op.amount
        : op.amountField === 'heal' ? Math.max(0, +(card.heal || 0)) : (op.n || 1);
      if (op.schedule !== undefined) {
        // M3：delayed 消费端（急救合剂「回合开始时回复 6 点，持续 3 回合」式）
        delayed.push({ special: 'triggerOps', ops: [{ ...op, schedule: undefined }], cardName: card.name,
          srcCard: card, notBeforeTurn: getTurn() + 1, repeat: true, left: Number.isInteger(op.duration) ? op.duration : 1 });
        G.log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】效果将每回合开始生效`, 'sys');
        continue;
      }
      if (op.op === 'flee') {
        G.log('[[icon:runner]] 逃出了战斗（非 BOSS 战道具）', 'ok');
        finish(null);   // 逃跑语义=null（烟雾弹）；false 是战败会走死亡结算直接终局
        return true;
      }
      if (op.op === 'heal') {
        if ((pstat.status.healban || 0) > 0) {
          G.log(`[[icon:heart]] 禁疗中：回复 <b>${amount}</b> 点生命无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
        } else {
          G.heal(amount);
          floats.push({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
        }
      } else if (op.op === 'restoreConsumed') {
        if (!restoreConsumed(amount)) G.log('消耗堆是空的，没有可复原的卡牌', 'dim');
      } else if (op.op === 'energy') {
        addEnergy(amount);
        G.log(`[[icon:bolt]] 获得 ${amount} 点能量`, 'sys');
      } else if (op.op === 'blessing') {
        const key = op.key;
        if (key === 'stealth' || key === 'immune') Combat.addBlessing(pstat, key, Number.isInteger(op.duration) ? op.duration : 1);
        else Combat.addBlessing(pstat, key, op.stacks || 1, Number.isInteger(op.duration) ? op.duration : 0);
        G.log(`[[icon:sparkles]] 获得祝福（${esc(key)}）`, 'ok');
      } else if (op.op === 'curse') {
        const victims = op.target === 'allEnemies' ? alive().slice()
          : op.target === 'self' ? [] : (target ? [target] : []);
        if (victims.length) {
          const stacks = op.stacks || (Number.isInteger(op.duration) ? op.duration : 1);
          victims.forEach(victim => Combat.addCurse(victim, op.curse, stacks));
          G.log(victims.length > 1
            ? `[[icon:skull]] 全体敌人附加了诅咒（${esc(op.curse)}）`
            : `[[icon:skull]] <b>${esc(victims[0].name)}</b> 附加了诅咒（${esc(op.curse)}）`, 'sys');
        }
      } else if (op.op === 'draw') {
        const n = op.perCurseKinds === true ? Math.max(1, countKinds(target)) : amount;
        if (mode === 'boss') drawCards(n);
        else grantSha(n);
        G.log(`[[icon:cards]] 抽了 ${n} 张牌`, 'sys');
      } else if (op.op === 'damage') {
        const dmg = op.amount !== undefined ? op.amount
          : op.range ? (op.range[0] + Math.floor(Random.random('battle') * (op.range[1] - op.range[0] + 1)))
          : 0;
        const victims = op.target === 'allEnemies' ? alive().slice() : (target ? [target] : []);
        victims.forEach(foe => { if (!foe.dead) hitFoe(foe, { ...card, desc: '' }, dmg, op.dmgType || 'fixed', ''); });
      } else if (op.op === 'execute') {
        const cap = op.cap || {};
        const count = op.count || 1;
        let killed = 0;
        for (const foe of alive().slice()) {
          if (killed >= count) break;
          if (cap.atk !== undefined && (foe.atk || 0) > cap.atk) continue;
          if (foe.dead) continue;
          hitFoe(foe, { ...card, desc: '' }, foe.hp + 9999, 'true', '（消灭）');
          killed++;
        }
        G.log(killed ? `[[icon:skull]] 消灭了 ${killed} 个敌人` : '[[icon:cross]] 没有符合条件的敌人', killed ? 'sys' : 'dim');
      } else if (op.op === 'acquire' && op.pool?.kind === 'classAbility') {
        // BC-09（09-30 深审）：通行证的获取效果此前只排队发现 job（无人消费、池也不被支持），
        // 道具被消耗却拿不到任何奖励。战斗内与基地 game.bag.rules 同口径直授——
        // classAbility：随机获得 1 张本职业能力卡（觉醒）
        const cls = G.myClass || null;
        const pool = SDT.Cards.all().filter(c => c.type === '能力卡' && (c.cls || null) === cls);
        if (pool.length) {
          const got = pool[Math.floor(Random.random('battle') * pool.length)];
          addTempCard({ ...got });
          G.log(`[[icon:sparkles]] <b>${esc(card.name)}</b> 觉醒：获得本职业能力卡【<b>${esc(got.name)}</b>】`, 'loot');
        } else {
          G.log('[[icon:cross]] 该职业没有可觉醒的能力卡', 'warn');
        }
      } else if (op.op === 'acquire' && op.pool?.kind === 'legendary') {
        // legendary：卡面「抽取 1 张传说卡」——随机池直授 1 张（资格边界走 randomDiscoverCard
        // 的 isRandomObtainable 单源过滤）
        const got = randomDiscoverCard(c => c.rarity === '传说');
        if (got) {
          addTempCard({ ...got });
          G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：抽取传说卡【<b>${esc(got.name)}</b>】置入手牌`, 'loot');
        } else {
          G.log('[[icon:cross]] 没有可获取的传说卡', 'warn');
        }
      } else if (op.op === 'acquire' || op.op === 'discover') {
        queueDiscover({ n: amount, pool: op.pool || { kind: '随机' }, dest: op.dest,
          act: op.act, sourceCardId: card.id });
      }
    }
    applyKillRewards(null, aliveBefore - alive().length);
    sweepDead();
    if (!alive().length) finish(true);
    else processDiscoverQueue();   // BC-09：排队的发现面板立即打开（此前无人消费，通行证类道具白耗）
    requestBattleRender();
    return true;
  }
  function countKinds(foe) {
    return foe ? ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn', 'atkDown'].filter(k => (foe.status?.[k] || 0) > 0).length : 0;
  }
  // 战斗效果类道具（2026-09-12 药水栏批次）：描述交真实执行器结算，敌方指向道具可拖/点选目标
  function useBattleEffectItem(entry, side) {
    const card = entry.card;
    const needsEnemy = itemTargetSideFor(card) === 'enemy';
    void needsEnemy;
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
      // 结构化道具先走目标选择和队列门，再进入唯一结算分支。
      if (Array.isArray(current.card.rules?.bag?.use)) {
        useStructuredBattleBag(current, needsEnemy ? foes.indexOf(target) : side);
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
  // —— 背包技能（2026-10-02 老板：背包砸击换成技能，按五职业分化；原砸击=2 费 4 固定伤）——
  // 技能表单源在 battle.slam-skill.js（view 按钮/aim 拖拽/agent 策略共用）；本文件只管结算。
  // 牧师翻面态按战斗实例令牌键控（lifecycle 每场 createBattleState 递增 token）：
  // 新一场自动复位；本局翻一次后固定；读档从本场开头重开 = 新 token，同样复位。
  let slamFlipToken = 0;
  let slamUsedToken = -1, slamUsedTurn = -1;
  function slamSkill() {
    return { ...slamSkillFor(G ? G.myClass : null, slamFlipToken === battleState.token),
      used: slamUsedToken === battleState.token && slamUsedTurn === getTurn() };
  }
  // 伤害类型按 kind 走现有结算链（Combat.dealDamage）：刺客=固定伤；战士=攻击（同初始攻击结算链，
  // 吃攻/攻升/流血）；降临者火球与牧师翻面=法伤（同深渊降焰 consumeFireballSteps 口径，吃法伤加成）
  const SLAM_DAMAGE_TYPE = {
    fixed: () => Combat.TYPES.FIXED,
    attack: () => Combat.TYPES.ATTACK,
    fireball: () => Combat.TYPES.SPELL,
    spell: () => Combat.TYPES.SPELL,
  };
  function bagSlam() {
    if (busy || infusing || discovering || choosing || handSelecting || viewingGrave || selectingDeck) return;
    if (interactionOf('slam')) { cancelSlam(); return; }
    const skill = slamSkill();
    if (skill.used) { G.log('本回合技能已使用', 'warn'); return; }
    if (energy < skill.cost) { G.log(`[[icon:bolt]] 能量不足：${esc(skill.name)}需要 ${skill.cost} 点能量`, 'warn'); return; }
    if (!skill.needsTarget) { resolveSlamSkill(null); return; }   // 无目标技能（法师搜刮/牧师圣疗）点击即结算
    if (!alive().length) { G.log(`[[icon:cross]] 场上没有敌人可以使用${esc(skill.name)}`, 'warn'); return; }
    beginSpecialTargeting('slam');
    G.log(`[[icon:${skill.icon}]] <b>${esc(skill.name)}</b>：点击一名敌人（${skill.hint}）`, 'sys');
  }
  function cancelSlam() { cancelInteraction(); }

  // —— 血毒双镖·第二镖（2026-09-16 留言「应该能选择两次目标」）——
  // 首段（攻+1 附加流血）随出牌目标结算；二段（攻+1 附加中毒）进入点选：
  // 点击任意敌人结算，可以重复选择同一目标。结束回合放弃点选则二段失效。
  function beginDartStrike(extra = null) {
    // M3：pick:'new' 泛化——extra={uid, card, ops} 时点选后由结构化段结算（resolveDart 消费）
    if (extra && extra.ops && triggersM2) {
      beginSpecialTargeting('dart', extra.uid, extra.card, { pickOps: extra.ops });
      G.log(`[[icon:flask]] <b>${esc(extra.card.name)}</b>：请为下一段效果选择目标（可重复选择同一目标）`, 'sys');
      return;
    }
    if (!alive().length) return;
    beginSpecialTargeting('dart');
    G.log('[[icon:blood]] <b>血毒双镖</b>·第二镖：点击一名敌人（攻 +1，附加中毒 · 可重复选择同一目标）', 'sys');
  }
  function resolveDart(side) {
    const dartInteraction = interactionOf('dart');
    if (!dartInteraction) return;
    if (busy) return;
    const t = side != null ? foes[+side] : null;
    if (!t || t.dead) {
      G.log('[[icon:cross]] 血毒双镖：请重新选择一名存活敌人', 'warn');
      requestBattleRender();
      return;
    }
    // M3：pick:'new' 泛化消费——结构化段经 runner 合成卡在点选目标上结算
    const pickOps = dartInteraction.extra?.pickOps;
    if (pickOps && pickOps.length && triggersM2) {
      const pickCard = dartInteraction.card;
      clearTargetSession();
      queueBattleAction(async signal => {
        throwIfActionCancelled(signal);
        const aliveBefore = alive().length;
        triggersM2.resolveEquipOps(pickCard, pickOps, t);
        applyKillRewards(null, aliveBefore - alive().length);
        sweepDead();
        if (!alive().length) { finish(true); return; }
        requestBattleRender();
      }, '结构化二段效果');
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
    resolveSlamSkill(side);
  }
  // 技能结算统一入口（bagSlam 点选流与无目标直发共用）：费用/效果按当前职业技能表取值
  function resolveSlamSkill(side) {
    if (busy) return;
    const skill = slamSkill();
    if (skill.used) { requestBattleRender(); return; }
    if (energy < skill.cost) { G.log(`[[icon:bolt]] 能量不足：${esc(skill.name)}需要 ${skill.cost} 点能量`, 'warn'); requestBattleRender(); return; }
    const t = skill.needsTarget ? (side != null ? foes[+side] : null) : null;
    if (skill.needsTarget && (!t || t.dead)) {
      G.log(`[[icon:cross]] ${esc(skill.name)}：请重新选择一名存活敌人`, 'warn');
      requestBattleRender();
      return;
    }
    clearTargetSession();
    queueBattleAction(async signal => {
      throwIfActionCancelled(signal);
      if (slamUsedToken === battleState.token && slamUsedTurn === getTurn()) return;
      if (skill.kind === 'heal' || skill.kind === 'acquire') {
        if (energy < skill.cost) { requestBattleRender(); return; }
        slamUsedToken = battleState.token; slamUsedTurn = getTurn();
        if (skill.kind === 'heal') resolveSlamHeal(skill);
        else resolveSlamAcquire(skill);
        requestBattleRender(); return;
      }
      const aliveBefore = alive().length;   // 击杀奖励总账（技能击杀也计饮血剑，对齐 resolveDart）
      const struck = await runStagedSteps(singleTargetHitSteps(t, () => {
        if (energy < skill.cost) {
          G.log(`[[icon:bolt]] ${esc(skill.name)}取消：结算时能量已不足，未扣除能量`, 'warn');
          return false;
        }
        set$energy(energy - skill.cost);
        // 点选取消、目标失效或前摇取消不占次数；实际扣费才算本回合使用。
        slamUsedToken = battleState.token; slamUsedTurn = getTurn();
        SDT.Sound.sfx('strike');
        const hpBefore = t.hp;
        const shieldBefore = t.defense?.shield || 0;
        // 结算源对齐现有链：战士攻击带攻升（status.atkUp，同打一张初始攻击）；
        // 火球/牧师翻面带法强与 spellUp（同 battle.engine consumeFireballSteps 深渊降焰口径）
        const source = skill.kind === 'attack' ? { atk: G.atk, status: pstat.status }
          : (skill.kind === 'fireball' || skill.kind === 'spell') ? { atk: G.atk, spellPower: G.spellPower || 0, status: pstat.status }
          : { atk: G.atk };
        const type = (SLAM_DAMAGE_TYPE[skill.kind] || SLAM_DAMAGE_TYPE.fixed)();
        const r = Combat.dealDamage(source, t, skill.dmg || 0, type);
        const shieldBreak = shieldBefore > 0 && !(t.defense?.shield || 0);
        if (r.dealt > 0 || shieldBreak) floats.push({ unit: foes.indexOf(t),
          text: r.dealt > 0 ? '-' + r.dealt : '护盾破碎', cls: r.dealt > 0 ? 'dmg' : 'block',
          shieldBreak, hpBefore, hpAfter: t.hp, maxHp: t.maxHp });
        G.log(`[[icon:${skill.icon}]] <b>${esc(skill.name)}</b>${skill.kind === 'fireball' ? '施放 1 次火球 → ' : ' → '}${esc(t.name)}：造成 <b>${r.dealt}</b> 点${Combat.TYPE_NAME[type]}（-${skill.cost} 能量）`, 'sys');
        sweepDead();
        // 击杀数必须在 sweepDead 之后取（dealDamage 只扣血不标倒下）：此前先取后清，
        // 砸击击杀的饮血剑计数恒为 0（09-30 深审 BC-10 复验时发现的次生顺序 bug）
        applyKillRewards(null, aliveBefore - alive().length);
      }), signal);
      if (!struck) return;
      if (!alive().length) { finish(true); return; }
      requestBattleRender();
    }, skill.name);
  }
  // 牧师·圣疗（2026-10-02 老板）：回复 3 血；使用后本局翻面为「惩戒」（3 点法伤，本局固定）。
  // 禁疗中也翻面——费用已支付、技能已「使用」；翻面只记一次（token 键控），重复结算不会再次翻转
  function resolveSlamHeal(skill) {
    set$energy(energy - skill.cost);
    const n = skill.heal || 0;
    if ((pstat.status.healban || 0) > 0) {
      G.log(`[[icon:heart]] 禁疗中：回复 <b>${n}</b> 点生命无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
    } else {
      G.heal(n);
      floats.push({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
    }
    const flipped = SLAM_SKILL_PRIEST_FLIPPED;
    slamFlipToken = battleState.token;
    G.log(`[[icon:${skill.icon}]] <b>${esc(skill.name)}</b>：回复 <b>${n}</b> 点生命（-${skill.cost} 能量）`, 'sys');
    G.log(`[[icon:${flipped.icon}]] <b>${esc(skill.name)}</b>已翻面：技能变为「<b>${esc(flipped.name)}</b>」（${flipped.hint.replace('（已翻面，本局固定）', '')}），本局固定`, 'sys');
  }
  // 法师·搜刮（2026-10-02 老板）：随机获得一张卡牌入手牌——取池口径对齐神秘药水
  // （isRandomObtainable 单源，battle.bag useItem 同款）：普通战置入手牌、BOSS 战洗入牌库
  function resolveSlamAcquire(skill) {
    set$energy(energy - skill.cost);
    const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
    const got = pool.length ? pool[Math.floor(Random.random('loot') * pool.length)] : null;
    if (got) {
      if (mode === 'boss') addDeckCard({ ...got });
      else addTempCard({ ...got });
      G.log(`[[icon:${skill.icon}]] <b>${esc(skill.name)}</b>：随机获得【<b>${esc(got.name)}</b>】${mode === 'boss' ? '（洗入牌库）' : '（置入手牌）'}`, 'loot');
      if (!got.rules?.triggers?.onAcquire?.length) fireCatGift(got);   // 结构化 onAcquire 已由 addTempCard 触发
    } else {
      G.log(`[[icon:cross]] ${esc(skill.name)}：没有可获得的卡牌`, 'warn');
    }
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
    slamSkill,   // 2026-10-02 老板：砸击换五职业分化技能——视图按钮/拖拽读当前职业技能口径
  };
}
