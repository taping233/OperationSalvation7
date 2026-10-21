import { hasStructuredTrigger } from '../../cards/card-trigger-contract.js';
import { foeFightTargets, validFoeFightTargets } from './battle.foe-fight.js';

/** Instance-owned state and host services are captured explicitly. */
export function createM2Domain(context) {
const instanceRuntime = context.runtime;

/* ============================================================
 * effect-steps.m2.js —— M 批契约扩展执行件第二批（M2，2026-09-27）
 *
 * 承接结构化 onPlay 的块1新语义，注册点在 battle.resolution.js 结构化 op
 * 循环（schema/capability 已同步放行，规则口径见 docs/cards/M-BATCH-CONTRACT-SPEC-2026-09-27.md）：
 *
 *   stealAtk / noDrawNext / extraTurn / execute / summon / registerRule 扩键
 *   damage.onKill 击杀奖励 / curse.source handMoves / armor.consumeEquip
 *   atkDown 诅咒扣攻与归还
 *
 * 与 effect-steps.m1.js 同一挂接风格：deps 显式传入；牌区运行态按属地直读
 * battle.runtime（结算侧先例同 exec-play）。
 * ============================================================ */

/** 手牌招式诅咒：规则优先，未迁移卡沿旧描述识别；叠层求和、计时取最大。 */
function scanHandMoveCurses(deps) {
  const merged = new Map();
  /** @type {[string, RegExp, number][]} */
  const legacySpecs = [
    ['bleed', /(?:附加|施加)\s*(?:(\d+)\s*层?)?\s*流血/, 1],
    ['poison', /(?:附加|施加)\s*(?:(\d+)\s*层)?\s*中毒/, 1],
    ['freeze', /附加冰冻|冰冻所有|冰冻\s*(?:\d+|[一两二三四五])?\s*名|冻结/, 1],
    ['silence', /沉默/, 1],
    ['abreak', /破甲/, 2],
    ['healban', /禁疗/, 2],
  ];
  const merge = entry => {
    const meta = deps.combat.CURSE_META[entry.kind];
    if (!meta) return;
    const previous = merged.get(entry.kind);
    if (!previous) {
      merged.set(entry.kind, entry);
      return;
    }
    if (meta.stack) previous.amount += entry.amount;
    else previous.amount = Math.max(previous.amount, entry.amount);
    if (entry.atkAmount !== undefined) {
      previous.atkAmount = Math.max(previous.atkAmount || 0, entry.atkAmount);
    }
  };

  for (const uid of instanceRuntime.hand) {
    const o = deps.findCard(uid);
    const card = o && o.card;
    // 招式＝武术+法术（2026-09-29 复核维持 09-10 定版）
    if (!card || !['武术', '法术'].includes(card.type)) continue;
    const curses = (card.rules?.triggers?.onPlay || []).filter(op => op?.op === 'curse' && typeof op.curse === 'string');
    if (curses.length) {
      for (const op of curses) {
        const meta = deps.combat.CURSE_META[op.curse];
        if (!meta) continue;
        const fieldAmount = typeof op.amountField === 'string' ? Number(card[op.amountField]) : NaN;
        const duration = op.curse !== 'atkDown' && Number.isFinite(fieldAmount) && fieldAmount > 0
          ? fieldAmount
          : (Number.isInteger(op.duration) && op.duration > 0 ? op.duration : 1);
        const stacks = Number.isFinite(fieldAmount) && fieldAmount > 0 ? fieldAmount
          : (Number.isInteger(op.stacks) && op.stacks > 0 ? op.stacks : 1);
        if (op.curse === 'atkDown') {
          const atkAmount = Number.isFinite(fieldAmount) && fieldAmount > 0 ? fieldAmount
            : (Number.isInteger(op.amount) && op.amount > 0 ? op.amount : 1);
          merge({ kind: op.curse, amount: duration, atkAmount });
        } else {
          merge({ kind: op.curse, amount: meta.stack ? stacks : duration });
        }
      }
      continue;
    }
    // 只有显式打出规则拥有此域；只迁移抽到等其他时点的卡仍保留旧打出诅咒。
    if (hasStructuredTrigger(card, 'onPlay')) continue;
    const desc = String(card.desc || '');
    for (const key of deps.combat.CURSES) {
      const meta = deps.combat.CURSE_META[key];
      if (!meta) continue;
      const word = key === 'atkDown' ? '降低' : meta.name;
      if (!word || !desc.includes(word)) continue;
      const spec = legacySpecs.find(([specKey]) => specKey === key);
      const match = spec && desc.match(spec[1]);
      const amount = Math.max(1, Number(match?.[1]) || (spec ? spec[2] : 1));
      if (key === 'atkDown') merge({ kind: key, amount: 1, atkAmount: amount });
      else merge({ kind: key, amount });
    }
  }
  return [...merged.values()];
}

/**
 * stealAtk：偷取/夺取敌人攻击力（影噬「偷取攻击力至 1 点」/ 禁咒「夺取 1 点攻击力」）。
 * capTo 压至阈值 / amount 固定夺取量；玩家侧走 blessing atkUp（duration 回合后到期扣回，
 * enemy-phase 既有 _stealRestore 归还管线负责敌方侧还原）。
 */
function resolveStealAtk(card, operation, preferredTarget, deps) {
  let targets;
  if (operation.target === 'allEnemies' || operation.target === 'randomEnemy') {
    const alive = deps.getAliveFoes().filter(foe => foe && !foe.dead);
    if (!alive.length) return false;
    if (operation.target === 'randomEnemy') {
      if (typeof deps.random !== 'function') throw new Error('resolveStealAtk: deps.random 未注入');
      targets = [alive[Math.floor(deps.random() * alive.length)]];
    } else targets = alive;
  } else {
    const target = preferredTarget && !preferredTarget.dead ? preferredTarget : deps.getAliveFoes()[0];
    targets = target && !target.dead ? [target] : [];
  }
  if (!targets.length) return false;
  const duration = Number.isInteger(operation.duration) ? operation.duration : 1;
  for (const t of targets) {
    const before = t.atk || 0;
    let stolen;
    if (operation.capTo !== undefined) {
      stolen = Math.max(0, before - operation.capTo);
      t.atk = before - stolen;   // 偷取只会降低攻击，已经低于阈值时不能反向抬高。
    } else {
      stolen = Math.min(operation.amount, before);
      t.atk = before - stolen;
    }
    if (stolen <= 0) {
      deps.log(`[[icon:arrow]] <b>${deps.esc(card.name)}</b>：${deps.esc(t.name)} 没有可偷取的攻击力`, 'dim');
      continue;
    }
    t._stealRestore = (t._stealRestore || 0) + stolen;
    // 归还门在 enemy-phase 回合末管线（turn > _stealRestoreTurn）——duration=1（影噬「本回合偷取」缺省）
    // 须当回合末归还，故 -2；旧文本路径 ctx.turn 恒 undefined、经 || 0 恰好同为当回合末归还
    t._stealRestoreTurn = deps.getTurn() + duration - 2;
    deps.combat.addBlessing(deps.getPlayerStatus(), 'atkUp', stolen, duration);
    deps.log(`[[icon:arrow]] <b>${deps.esc(card.name)}</b>：偷取 <b>${deps.esc(t.name)}</b> ${stolen} 点攻击力（${duration} 回合后归还）`, 'sys');
  }
  return true;
}

/** noDrawNext：下回合开始不抽牌（破浪斩）——runtime noDrawNext 旗标，回合管线消费。 */
function resolveNoDrawNext(card, _operation, deps) {
  deps.markNoDrawNext();
  deps.log(`[[icon:cross]] <b>${deps.esc(card.name)}</b>：下回合无法抽牌`, 'warn');
  return true;
}

/** extraTurn：获得 1 个额外回合（命运钟表）——runtime extraTurn 旗标，敌人回合跳过。 */
function resolveExtraTurn(card, _operation, deps) {
  deps.setExtraTurn(true);
  deps.log(`[[icon:hourglass]] <b>${deps.esc(card.name)}</b>：获得 1 个额外回合（敌人不会行动）`, 'ok');
  return true;
}

/** registerRule：持续规则旗标。M2 扩 bleedAmp / meleeCost1 / spellCost1（既有三键文本路径承载）；
 * moveCost1 所有招式（=武术+法术）1 费（2026-10-06 银河之旅改版）。 */
function resolveRegisterRule(card, operation, deps) {
  const rule = operation.rule;
  if (rule === 'consumeFireball') {
    deps.setConsumeFireball(1);
    deps.log(`[[icon:fire]] <b>${deps.esc(card.name)}</b>：每消耗 1 张卡牌，自动施放火球`, 'ok');
    return true;
  }
  if (rule === 'allSpellsInfused') {
    deps.setAllSpellsInfused(true);
    deps.log(`[[icon:sparkles]] <b>${deps.esc(card.name)}</b>：本场可注能招式均视为已注能`, 'ok');
    return true;
  }
  if (rule === 'growth') {
    deps.registerGrowthCard(card);
    deps.log(`[[icon:arrow-up]] <b>${deps.esc(card.name)}</b>：回合开始时本牌伤害 +1`, 'ok');
    return true;
  }
  if (rule === 'poisonLegacy') {
    deps.setPoisonLegacy(true);
    deps.log(`[[icon:skull]] <b>${deps.esc(card.name)}</b>：死亡时转移中毒层数`, 'ok');
    return true;
  }
  if (rule === 'playerCurseImmune') {
    deps.setPlayerCurseImmune(true);
    instanceRuntime.delayed.forEach(entry => { if (entry.special === 'curseImmuneOff') entry.restore = true; });
    deps.log(`[[icon:shield]] <b>${deps.esc(card.name)}</b>：免疫诅咒`, 'ok');
    return true;
  }
  if (rule === 'stealthStrike') {
    deps.setStealthStrike(true);
    deps.log(`[[icon:eye]] <b>${deps.esc(card.name)}</b>：潜行状态下的下一次攻击伤害翻倍`, 'ok');
    return true;
  }
  if (rule === 'bleedAmp') {
    deps.setBleedAmp(true);
    deps.log(`[[icon:blood]] <b>${deps.esc(card.name)}</b>：持续规则——触发的流血伤害翻倍`, 'ok');
    return true;
  }
  if (rule === 'moveCost1') {
    // 招式=武术+法术（terminology 定版口径）：机械层复用双旗标，battle.card-cost 费用结算零改动
    deps.setMeleeCost1(true);
    deps.setSpellCost1(true);
    deps.log(`[[icon:sparkles]] 持续规则：你的所有招式（武术与法术）均按 <b>1</b> 费打出`, 'ok');
    return true;
  }
  if (rule === 'meleeCost1') {
    deps.setMeleeCost1(true);
    deps.log(`[[icon:sparkles]] 持续规则：你的所有武术均按 <b>1</b> 费打出`, 'ok');
    return true;
  }
  if (rule === 'spellCost1') {
    deps.setSpellCost1(true);
    deps.log(`[[icon:sparkles]] 持续规则：你的所有法术均按 <b>1</b> 费打出`, 'ok');
    return true;
  }
  // M3：discoverPlus（黑暗形态「每当你发现卡牌时，增加 1 个可选项」）——旗标经 pstat.status 袋，
  // engine 的 queueDiscover 入队口统一 +1；doubleNextSpell（元素风暴「下一张法术施放 2 次」）
  // 走 runtime nextSpellTwice 既有旗标
  if (rule === 'discoverPlus') {
    const pstat = deps.getPlayerStatus();
    pstat.status.discoverPlus = (pstat.status.discoverPlus || 0) + 1;
    deps.log(`[[icon:question]] <b>${deps.esc(card.name)}</b>：持续规则——每次发现的可选项 +1`, 'ok');
    return true;
  }
  if (rule === 'doubleNextSpell') {
    deps.setNextSpellTwice(1);
    deps.log(`[[icon:sparkles]] <b>${deps.esc(card.name)}</b>：下一张法术施放 2 次`, 'ok');
    return true;
  }
  return false;   // consumeFireball / allSpellsInfused / growth 走引擎既有专支端口
}

/**
 * damage.onKill：本段伤害击杀敌人时的结构化奖励（闪金之锤 +币 / 破甲重斩 +甲）。
 * 与 engine applyKillRewards 文本路径同一 G.coins / pdef.armor 计数。
 */
function applyDamageOnKill(card, onKill, kills, deps) {
  if (!onKill || kills <= 0) return;
  if (onKill.energy !== undefined) {
    deps.addEnergy(onKill.energy * kills);
    deps.log(`[[icon:bolt]] <b>${deps.esc(card.name)}</b>：击杀敌人，+${onKill.energy * kills} 能量`, 'sys');
  }
  if (onKill.coins !== undefined) {
    deps.addCoins(onKill.coins * kills);
    deps.log(`[[icon:coin]] <b>${deps.esc(card.name)}</b>：击杀敌人，+${onKill.coins * kills} 币`, 'loot');
  }
  if (onKill.armor !== undefined) {
    deps.addArmor(onKill.armor * kills);
    deps.log(`[[icon:plate]] <b>${deps.esc(card.name)}</b>：击杀敌人，+${onKill.armor * kills} 甲`, 'sys');
  }
}

/** curse.atkDown 侧效：addCurse 挂计时后按 amount 扣攻并登记归还量。 */
function applyAtkDown(target, amount) {
  if (!target || target.dead) return;
  const cut = Math.min(amount, Math.max(0, target.atk || 0));
  target.atk = (target.atk || 0) - cut;
  target._atkDownAmount = (target._atkDownAmount || 0) + amount;
  target._atkDownPending = (target._atkDownPending || 0) + cut;   // 实际扣掉的量（到期按此归还）
}

/** atkDown 到期归还（enemy-phase 回合结束管线调用；与 _stealRestore 归还同款）。 */
function restoreAtkDown(foe) {
  if (!foe || foe._atkDownAmount === undefined) return;
  if (!(foe.status?.atkDown > 0) && foe._atkDownAmount > 0) {
    foe.atk = (foe.atk || 0) + (foe._atkDownPending || 0);
    delete foe._atkDownAmount;
    delete foe._atkDownPending;
  }
}

/**
 * execute：消灭满足 cap 的敌人（吞噬「攻 4 及以下小怪」/ TNT）。
 * perCurseKinds=true 时消灭数量锚定目标诅咒种类数；onKill 奖励复用击杀奖励键。
 */
function matchesExecuteCap(foe, cap = {}) {
  return !foe.affix && (cap.atk === undefined || (foe.atk || 0) <= cap.atk) &&
    (cap.wounded !== true || foe.hp < foe.maxHp) &&
    (cap.maxHpBelow === undefined || (foe.maxHp || 0) < cap.maxHpBelow);
}

// Only pure single-target execute cards can be rejected before their effects run.
// Mixed operations may change the target first; automatic casts retain their own flow.
function executeTargetReason(card, target, aliveFoes) {
  const ops = card.rules?.triggers?.onPlay;
  if (card.rules?.battle?.target?.side !== 'enemy' || card.rules.battle.target.area ||
    !Array.isArray(ops) || ops.length !== 1) return null;
  const op = ops[0];
  if (op.op !== 'execute' || op.what || op.perCurseKinds || op.perCurseStacks) return null;
  const candidates = target ? aliveFoes.filter(foe => foe === target) : aliveFoes;
  if (candidates.some(foe => !foe.dead && matchesExecuteCap(foe, op.cap))) return null;
  const cap = op.cap || {};
  const message = target?.affix ? '不能选择 BOSS 敌人' : cap.atk !== undefined
    ? `只能选择攻击力不高于${cap.atk}的非 BOSS 敌人`
    : cap.maxHpBelow !== undefined ? `只能选择最大生命低于${cap.maxHpBelow}的非 BOSS 敌人`
      : '没有可以消灭的非 BOSS 敌人';
  return { code: 'EXECUTE_TARGET_INELIGIBLE', message };
}

function resolveExecute(card, operation, preferredTarget, deps) {
  const cap = operation.cap || {};
  // 词缀 BOSS 豁免（对齐文本轨 kill.minions 门槛分支；m6 数据注释「含 BOSS 排除」）
  let targets = deps.getAliveFoes().filter(foe => matchesExecuteCap(foe, cap));
  const anchor = preferredTarget && !preferredTarget.dead ? preferredTarget : targets[0];
  if (operation.perCurseKinds === true || operation.perCurseStacks === true) {
    targets = anchor ? [anchor] : [];
  }
  const count = operation.perCurseStacks === true
    ? deps.combat.CURSES.reduce((sum, key) => sum + Math.max(0, +(anchor?.status?.[key] || 0)), 0)
    : operation.perCurseKinds === true ? countCurseKinds(anchor, deps) : (operation.count ?? 1);
  // M3：what——对选中目标施放指定攻击而非消灭（星陨之力「施放 3 次火球」/流光照影「每层诅咒释放一次初始攻击」）
  if (operation.what === 'fireball' || operation.what === 'starterAttack') {
    let casts = 0;
    const foe = anchor;
    for (let cast = 0; foe && !foe.dead && cast < count; cast++) {
      if (operation.what === 'fireball') {
        deps.hitFoe(foe, { ...card, desc: '', name: '火球' }, 4, 'spell', '（火球）');
      } else {
        // Combat 的 attack 类型已统一加攻击力；初始攻击的卡面增量为 0。
        deps.hitFoe(foe, { ...card, desc: '', name: '初始攻击' }, 0, 'attack', '（初始攻击）');
      }
      casts++;
    }
    deps.log(casts > 0
      ? `[[icon:fire]] <b>${deps.esc(card.name)}</b>：${operation.what === 'fireball' ? '施放火球' : '释放初始攻击'} ${casts} 次`
      : `[[icon:cross]] <b>${deps.esc(card.name)}</b>：没有符合条件的敌人`, casts > 0 ? 'sys' : 'dim');
    return casts > 0;
  }
  // A single-target card must not silently execute a different eligible enemy.
  // Untargeted effects (TNT) and automatic casts without an anchor keep list order.
  const singleEnemy = card.rules?.battle?.target?.side === 'enemy' && !card.rules.battle.target.area;
  if (singleEnemy && preferredTarget) targets = targets.filter(foe => foe === preferredTarget);
  let killed = 0;
  for (const foe of targets) {
    if (killed >= count) break;
    if (foe.dead) continue;
    deps.hitFoe(foe, { ...card, desc: '' }, foe.hp + 9999, 'true', '（消灭）');
    killed++;
  }
  if (killed > 0) {
    deps.log(`[[icon:skull]] <b>${deps.esc(card.name)}</b>：消灭了 ${killed} 个符合条件的敌人`, 'sys');
    if (operation.onKill) applyDamageOnKill(card, operation.onKill, killed, deps);
  } else {
    deps.log(`[[icon:cross]] <b>${deps.esc(card.name)}</b>：没有符合条件的敌人`, 'dim');
  }
  return killed > 0;
}

/** M3：foeFight——迫使其相互攻击（扰敌「选择 2 名敌人，迫使其相互攻击一次」）：两名存活敌互殴一次。 */
function* resolveFoeFightSteps(card, operation, deps) {
  const live = deps.getAliveFoes();
  const selected = foeFightTargets(card);
  const fighters = selected || live.slice(0, Number.isInteger(operation.count) ? operation.count : 2);
  if (selected && !validFoeFightTargets(selected, live)) return false;
  if (fighters.length < 2) {
    deps.log(`[[icon:cross]] <b>${deps.esc(card.name)}</b>：场上敌人不足两名，无法互相攻击`, 'dim');
    return false;
  }
  const [a, b] = fighters;
  // 敌人互殴以攻击者自身的 atk 结算（不经过玩家攻击力），死亡交由回合管线 sweepDead
  yield { kind: 'windup', targets: [b] };
  const firstHp = b.hp;
  const first = b.dead ? { dealt: 0 } : deps.foeDealDamage(a, b, 0, card);
  const firstDealt = first?.dealt ?? Math.max(0, firstHp - b.hp);
  deps.log(`[[icon:swords]] <b>${deps.esc(card.name)}</b>：${deps.esc(a.name)} 被迫攻击 ${deps.esc(b.name)}，造成 ${firstDealt} 点伤害`, 'sys');
  yield { kind: 'hit' };
  if (!b.dead && !(b.hp <= 0) && !a.dead && !(a.hp <= 0)) {
    yield { kind: 'windup', targets: [a] };
    const secondHp = a.hp;
    const second = a.dead ? { dealt: 0 } : deps.foeDealDamage(b, a, 0, card);
    const secondDealt = second?.dealt ?? Math.max(0, secondHp - a.hp);
    deps.log(`[[icon:swords]] <b>${deps.esc(card.name)}</b>：${deps.esc(b.name)} 被迫反击 ${deps.esc(a.name)}，造成 ${secondDealt} 点伤害`, 'sys');
    yield { kind: 'hit' };
  }
  deps.sweepDead?.();
  deps.log(`[[icon:swords]] <b>${deps.esc(card.name)}</b>：<b>${deps.esc(a.name)}</b> 与 <b>${deps.esc(b.name)}</b> 被迫相互攻击`, 'sys');
  return true;
}

function resolveFoeFight(...args) {
  const steps = resolveFoeFightSteps(...args);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}

/** M3：copyRandom——随机复制一张手牌（刀剑形态「回合开始时，获得一张随机手牌的复制」）。 */
function resolveCopyRandom(card, deps) {
  if (!instanceRuntime.hand.length) {
    deps.log(`[[icon:cross]] <b>${deps.esc(card.name)}</b>：手牌是空的，没有可复制的牌`, 'dim');
    return false;
  }
  // 守卫（2026-09-29 U4）：随机一律走注入的 battle 种子流（生产装配 battle.resolution m2Deps.random
  // → engine randomBattle）。漏注入即种子复现性破坏，结算期直接炸出，不留 Math.random 静默退化口。
  if (typeof deps.random !== 'function') {
    throw new Error('resolveCopyRandom: deps.random 未注入——战斗随机必须走 battle 种子流，禁止裸 Math.random 退化');
  }
  const uid = instanceRuntime.hand[Math.floor(deps.random() * instanceRuntime.hand.length)];
  const entry = uid && deps.findCard(uid);
  if (!entry) return false;
  deps.addTempCard({ ...entry.card });
  deps.log(`[[icon:cards]] <b>${deps.esc(card.name)}</b>：复制了手牌中的【<b>${deps.esc(entry.card.name)}</b>】`, 'loot');
  return true;
}

/** 目标身负诅咒种类数（深渊诅咒「每有 1 种诅咒」计数口径）。 */
function countCurseKinds(foe, deps) {
  if (!foe || !foe.status) return 0;
  return deps.combat.CURSES.filter(k => (foe.status[k] || 0) > 0).length;
}

/**
 * summon：召唤随从（征召「召唤步兵（4-4）×2」）——engine summonAlly 同一随从位。
 * statless 物件（封印肢体）不带攻血、taunt 优先承伤（随从位自带语义）。
 */
function resolveSummon(card, operation, deps) {
  deps.summonAlly(operation.name, operation.atk || 0, operation.hp || 1, operation.count, operation.statless === true);
  deps.log(`[[icon:paw]] <b>${deps.esc(card.name)}</b>：召唤 ${operation.count} 名【${deps.esc(operation.name)}】为你而战`, 'sys');
  return true;
}

/**
 * armor.consumeEquip：消耗手牌中 1 张装备牌作为代价（铸甲「消耗 1 张装备牌，+10甲」）。
 * 无装备在手时效果无效（与文本路径 hand-cost 语义一致：付不出就不白拿甲）。
 */
function resolveConsumeEquip(card, deps) {
  const equipUid = instanceRuntime.hand.find(uid => {
    const o = deps.findCard(uid);
    return o && o.card.type === '装备';
  });
  if (!equipUid) {
    deps.log(`[[icon:cross]] <b>${deps.esc(card.name)}</b>：手牌中没有装备牌可供消耗`, 'warn');
    return false;
  }
  const idx = instanceRuntime.hand.indexOf(equipUid);
  instanceRuntime.hand.splice(idx, 1);
  instanceRuntime.consumed.push(equipUid);
  if (instanceRuntime.mode === 'boss') instanceRuntime.grave.push(equipUid);
  const o = deps.findCard(equipUid);
  deps.log(`[[icon:flask]] <b>${deps.esc(card.name)}</b>：消耗了手牌中的【<b>${deps.esc(o ? o.card.name : '?')}</b>】`, 'sys');
  return true;
}

/** curse.source:'handMoves'：聚合手牌规则/旧文案诅咒及其数量。 */
function handMoveCurses(deps) {
  return scanHandMoveCurses(deps);
}

/**
 * recast.on:'lastHand' 判定：本牌是否为最后一张手牌（急行军/破釜沉舟口径——
 * 「永远被保留在手牌中」类卡不计入手牌数，与 exec-play 末手重跑同款）。
 */
function isLastHandCard(uid, deps) {
  const others = instanceRuntime.hand.filter(u => {
    if (u === uid) return false;
    const o = deps.findCard(u);
    return o && !/永远被保留在手牌中/.test(String(o.card.desc || ''));
  });
  return others.length === 0;
}
return { resolveStealAtk, resolveNoDrawNext, resolveExtraTurn, resolveRegisterRule, applyDamageOnKill, applyAtkDown, restoreAtkDown, matchesExecuteCap, executeTargetReason, resolveExecute, resolveFoeFight, resolveFoeFightSteps, resolveCopyRandom, countCurseKinds, resolveSummon, resolveConsumeEquip, handMoveCurses, isLastHandCard };
}
