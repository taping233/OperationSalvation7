// @ts-check
import { createEffectExecutor } from '../effects/battle.effects.js';
import { esc } from '../../core/shared.js';

/** Assemble text and structured effects over one live runtime and shared combat adapter.
 * Commands are lazy callbacks so selection, bag and trigger assembly retain their original order.
 * @param {import('./battle.core-ports.types.js').EffectAssemblyOptions} options
 */
export function createBattleEffectAssembly({ runtime: instanceRuntime, cards, combat: Combat, random: Random,
  executionSession, createBattleResolution, sound, commands }) {
const { handSelectQueue, choiceQueue } = executionSession;
/** @param {number} amount */
const addEnergyCap = (amount, grantCurrent = true) => {
  instanceRuntime.set$maxEnergy(instanceRuntime.maxEnergy + amount);
  if (grantCurrent) instanceRuntime.set$energy(instanceRuntime.energy + amount);
  return instanceRuntime.maxEnergy;
};
/** @param {import('./battle.core-ports.types.js').CombatUnit} target
 * @returns {target is import('./battle.core-ports.types.js').CoreFoe} */
const isRuntimeFoe = target => instanceRuntime.foes.includes(/** @type {import('./battle.core-ports.types.js').CoreFoe} */ (target));
const { recordRequestedDamage, alive, hitFoe, foeIdx, dealEffectDamage, drawCards, grantSha, addTempCard, queueCardExecution, findCard, randomDiscoverCard, addDeckCard, processHandSelect, restoreConsumed, processChoice, shuffle, deckDraw, flee, sweepDead, releaseHandMatches, autoPlayHandType, damagePlayer, fireConsumeTriggers, replaceShaInDeck, summonAlly, queuePouchCast, tryUnlockSeal, checkElementSealProgress, fireCatGift, handCurseSpecs, queueSwapCostDiscover, resolveRequestedCard, emitRecast, getConsumedPile, onHandConsumed, splitClauses, registerTurnStart, registerBattle, castRandomSpells, drawOf, isAOE, addPlayerCurse } = commands;
// 诅咒施加视觉差分（P1）：包装 addCurse——卡牌文本路径与结构化路径（battle.resolution.js curse op）
// 对敌方施加诅咒时推 cursefx 彩闪（玩家自身中诅咒不闪，仍走日志+角标）。两端口共用同一份对象，
// 保证两条路径踩的是同一套底层 API。addCurse 回传 combat.addCurse 的结果（叠层后层数/计时剩余，
// 免疫为 0）——文本路径不消费回传值，结构化路径用它判定日志与生效。
// Combat 是模块命名空间（属性 only-getter，不能 Object.create 委托），展开为快照普通对象再覆盖——
// combat.js 导出全是函数/常量，快照安全。
/** @type {import('./battle.core-ports.types.js').CombatPort} */
const combatPort = {
  ...Combat,
  tickPoison(target) {
    if (isRuntimeFoe(target) && target.dead) return null;
    const result = Combat.tickPoison(target);
    if (isRuntimeFoe(target)) {
      recordRequestedDamage(target, result?.dealt || 0, { name:'中毒' }, { alive, hitFoe });
      if (target.hp <= 0) sweepDead();
    }
    return result;
  },
  dealDamage(attacker, target, amount, type) {
    const result = Combat.dealDamage(attacker, target, amount, type);
    if (isRuntimeFoe(target)) recordRequestedDamage(target, result.dealt, { name:'伤害' }, { alive, hitFoe });
    return result;
  },
  addCurse(t, key, n) {
    const applied = Combat.addCurse(t, key, n);
    if (t && !t.dead && t !== instanceRuntime.pstat) {
      instanceRuntime.floats.push({ unit: foeIdx(t), text: '', cls: `cursefx curse-${key}` });
    }
    return applied;
  },
};
/** @type {import('./battle.core-ports.types.js').TextEffectPorts} */
const effectPorts = {
    combat: combatPort,
    dealEffectDamage,
    getAlive: alive,
    getAllies: () => instanceRuntime.allies,
    getFrozenTargetBonus: target => (target?.status?.freeze || 0) > 0
      ? instanceRuntime.equipped.reduce((sum, eq) => sum + (+(eq?.card?.rules?.equip?.passive?.cond?.vsFreeze ?? 0) || 0), 0) : 0,
    getPlayerStatus: () => instanceRuntime.pstat,
    getPlayerDefense: () => instanceRuntime.pdef,
    getMode: () => instanceRuntime.mode,
    log: (message, kind) => instanceRuntime.G.log(message, kind),
    escapeHtml: esc,
    heal: amount => instanceRuntime.G.heal(amount),
    pushFloat: value => instanceRuntime.floats.push(value),
    drawCards,
    grantStarterAttack: grantSha,
    castStarterAttack: target => {
      const foes = alive();
      if (!instanceRuntime.G?.battleActive || instanceRuntime.G.hp <= 0 || !foes.length) return false;
      const enemy = target && foes.includes(target) ? target : foes[0];
      const uid = addTempCard(cards.SHA, { source: 'effect-cast' });
      // addTempCard synchronously creates the entry resolved by this UID.
      const entry = /** @type {import('./battle.core-ports.types.js').CardEntry} */ (findCard(uid));
      return queueCardExecution(uid, entry.card, [], enemy, true) !== false;
    },
    markNoDrawNext: () => { instanceRuntime.set$noDrawNext(true); },
    queueDiscover: value => instanceRuntime.discoverQueue.push(value),
    randomDiscoverCard,
    addTempCard,
    addDeckCard,
    queueHandSelect: job => { handSelectQueue.push(job); processHandSelect(); },
    restoreConsumed: n => restoreConsumed(n),
    random01: (purpose = 'generation') => Random.random('battle', purpose),
    allCards: () => cards.all(),
    // —— 抉择面板（2026-09-08 人工 N 选一）：选项入队并弹出面板 ——
    queueChoice: job => { choiceQueue.push(job); processChoice(); },
    // —— 装备嵌入句「回合开始 -N 血」注册为每回合开始的延迟段（留言 #10 通用机制；灭魔之剑已退役）——
    registerTurnStartText: (text, cardName) => { instanceRuntime.delayed.push({ text, cardName, repeat: true }); },
    setStealthStrike: v => { instanceRuntime.set$stealthStrike(!!v); },
    setNextSpellTwice: n => { instanceRuntime.set$nextSpellTwice(n || 0); },
    shuffleDeck: () => { instanceRuntime.set$drawPile(shuffle(instanceRuntime.drawPile)); return instanceRuntime.drawPile.length; },
    addEnergy: amount => { instanceRuntime.set$energy(instanceRuntime.energy + (amount)); return instanceRuntime.energy; },
    refillEnergy: () => { instanceRuntime.set$energy(instanceRuntime.maxEnergy); return instanceRuntime.maxEnergy; },
    addEnergyCap,
    // 招式池谓词复用卡库判定。
    isRandomObtainable: c => cards.isRandomObtainable(c),
    // —— 2026-09-08 补线：以下端口此前从未传入，相关描述一打就崩 ——
    getPlayerHp: () => instanceRuntime.G.hp,
    getHandSize: () => instanceRuntime.hand.length,
    getHandCards: () => instanceRuntime.hand.map(findCard).filter(Boolean),
    burstPoison: t => combatPort.tickPoison(t),
    deckDraw,
    fleeBattle: () => flee(),
    sweepDead,
    armorMul: () => instanceRuntime.armorMul,
    getPlayerClass: () => instanceRuntime.G.myClass || null,
    getPlayerCaster: () => ({
      atk: instanceRuntime.G.atk,
      // spellUp 不预加：status 里带着，combat.dealDamage 只加一次（2026-09-09 修复双重计数）
      spellPower: instanceRuntime.G.spellPower || 0,
      status: instanceRuntime.pstat ? instanceRuntime.pstat.status : undefined,
    }),
    foeIndexOf: t => instanceRuntime.foes.indexOf(t),
    releaseHandMatches,
    autoPlayHandType,
    setShaTransform: name => { instanceRuntime.set$shaTransform(name || null); },
    setConsumeFireball: n => { instanceRuntime.set$consumeFireballN(n || 0); },
    damagePlayer,
    addPlayerMaxHp: n => {
      instanceRuntime.G.maxHp += n;
      instanceRuntime.G.heal(n);
      instanceRuntime.G.log(`[[icon:heart]] 血量上限 +${n}（当前上限 ${instanceRuntime.G.maxHp}，并回复 ${n} 点）`, 'ok');
    },
    dumpHand: () => {
      const uids = instanceRuntime.hand.slice();
      instanceRuntime.set$hand([]);
      /** @type {import('./battle.core-ports.types.js').CoreCard[]} */
      const cards = [];
      uids.forEach(u => {
        instanceRuntime.consumed.push(u);
        if (instanceRuntime.mode === 'boss') instanceRuntime.grave.push(u);
        const o = findCard(u);
        if (o) cards.push(o.card);
        instanceRuntime.cardAnims.push({ kind: 'dump', uid: u, name: o ? o.card.name : '' });
      });
      cards.forEach(c => fireConsumeTriggers(c, null));   // 09-29 老板拍板：批量消耗也算逐张「消耗该牌时」
      return uids.length;
    },
    // —— 2026-09-09 机制审计补实装端口（Q1-Q8 老板定向批次）——
    getInfuseFuels: () => instanceRuntime.infuseFuels,
    getPriceOfLastDrawn: () => {
      const uid = instanceRuntime.lastDrawnUids[instanceRuntime.lastDrawnUids.length - 1];
      const o = uid && findCard(uid);
      return o ? Math.max(0, +(o.card.cost || 0)) : 0;   // 09-29 老板拍板：价格统一按费用（原 sellPrice 卖价口径废弃）
    },
    dealAoeFixed: (n, card) => {
      // Preserve the price-derived amount while sharing immunity, protection, stealth and defeat handling.
      alive().slice().forEach(t => hitFoe(t, card, n, Combat.TYPES.FIXED, '', { preserveBaseDamage: true, deferDefeat: true }));
      sweepDead();
    },
    replaceShaInDeck,
    summonAlly,
    setExtraTurn: v => { instanceRuntime.set$extraTurn(!!v); },
    setDeathSave: n => { instanceRuntime.set$deathSave(n || 0); },
    queuePouchCast,
    registerGrowthCard: card => { if (card && card.name) instanceRuntime.growthNames.add(card.name); },
    setAllSpellsInfused: v => { instanceRuntime.set$allSpellsInfused(!!v); },
    setPoisonLegacy: v => { instanceRuntime.set$poisonLegacy(!!v); },
    setPlayerCurseImmune: v => {
      instanceRuntime.set$playerCurseImmune(!!v);
      // 结构化永久免疫与旧日再临同口径；false 保持原撤销语义。
      if (v) instanceRuntime.delayed.forEach(q => { if (q.special === 'curseImmuneOff') q.restore = true; });
    },
    unlockSeal: name => tryUnlockSeal(name),
    checkElementSealProgress,
    randomAcquired: card => fireCatGift(card),
    handCurseSpecs,
    queueSwapCostDiscover,
  };
/** @type {import('./battle.core-ports.types.js').ApplyTextEffects} */
const applyTextEffects = createEffectExecutor(effectPorts);

  function createResolution() {
    return createBattleResolution({
    resolveBagOperations: (...args) => commands.resolveBagOperations(...args),
    autoPlayHandType, queuePouchCast,
    queueChoice: job => { choiceQueue.push(job); processChoice(); },
    castStarterAttack: target => {
      const targets = alive();
      if (!instanceRuntime.G?.battleActive || instanceRuntime.G.hp <= 0 || !targets.length) return false;
      const uid = addTempCard(cards.SHA, { source: 'effect-cast' });
      // Same synchronous addTempCard/findCard guarantee as the text effect port.
      const entry = /** @type {import('./battle.core-ports.types.js').CardEntry} */ (findCard(uid));
      return queueCardExecution(uid, entry.card, [], target && targets.includes(target) ? target : targets[0], true) !== false;
    },
    releaseHandMatches,
    queueHandSelect: job => { handSelectQueue.push(job); processHandSelect(); },
    queueSwapCostDiscover,
    resolveRequestedCard,
    emitRecast,
    readState: () => ({ mode: instanceRuntime.mode, playedMovesThisTurn: instanceRuntime.playedMovesThisTurn, infuseFuels: instanceRuntime.infuseFuels, grave: getConsumedPile(), allSpellsInfused: instanceRuntime.allSpellsInfused }),
    restoreHeroSkill: () => commands.restoreHeroSkill(),
    getHandSize: () => instanceRuntime.hand.length,
    getPlayerStatus: () => instanceRuntime.pstat,
    esc,
    log: (...args) => instanceRuntime.G.log(...args),
    heal: amount => instanceRuntime.G.heal(amount),
    addFloat: value => instanceRuntime.floats.push(value),
    addDelayed: value => instanceRuntime.delayed.push(value),
    takeDeckBottom: count => instanceRuntime.drawPile.splice(0, count),
    deckBottomCount: () => instanceRuntime.drawPile.length,
    startSurge: promise => instanceRuntime.set$surgeWaiter(promise),
    getAllCards: () => cards.all(),
    isRandomObtainable: card => cards.isRandomObtainable(card),
    randomBattle: (purpose = 'generation') => Random.random('battle', purpose),
    getDamageTypes: () => cards.DMG_TYPES,
    getDamageTypeMeta: () => cards.DMG_TYPE_META,
    fixedDamageType: Combat.TYPES.FIXED,
    hasCurse: foe => Combat.hasCurse(foe),
    getAliveFoes: alive,
    getGrowth: uid => instanceRuntime.growth[uid],
    getHandInfuseCount: uid => instanceRuntime.handInfuseCounts[uid] || 0,
    getFoeIndex: foeIdx,
    applyStatus: (foe, status, duration) => {
      const applied = Combat.addCurse(foe, status, duration);
      if (applied > 0 && foe && !foe.dead) {
        instanceRuntime.floats.push({ unit: foeIdx(foe), text: '', cls: `cursefx curse-${status}` });
        if (status === 'abreak') sound('armorBreak');
      }
      return applied;
    },
    findCard, addTempCard, sweepDead,
    onHandConsumed: (card, uid) => onHandConsumed(card, uid),
    // M3：registerRule discoverPlus（黑暗形态「每当你发现卡牌时，增加 1 个可选项」）——
    // 旗标经 pstat.status.discoverPlus，发现面板候选数 +N。此前误把 n（选择/获得次数）+1，
    // 变成多获得一张而不是多看一张（09-30 深审 BC-07）
    queueDiscover: value => instanceRuntime.discoverQueue.push(
      (instanceRuntime.pstat.status.discoverPlus || 0) > 0 ? { ...value, optionsPlus: (instanceRuntime.pstat.status.discoverPlus || 0) } : value),
    splitClauses, applyTextEffects,
    registerTurnStart, registerBattle, castRandomSpells, drawCards, grantSha, hitFoe,
    // G3（A3 第三批）：acquire 族端口——洗入牌库与洗混（deck.insert 文本路径同一底层）、
    // 随机池/指定池单源抽卡（selectionFlow.randomDiscoverCard 转发同一函数）、
    // 战斗币（与 applyKillRewards/bag 同一 G.coins 计数）、职业名（「本职业/其它职业」池谓词）。
    addDeckCard,
    shuffleDeck: () => { instanceRuntime.set$drawPile(shuffle(instanceRuntime.drawPile)); return instanceRuntime.drawPile.length; },
    randomDiscoverCard,
    addCoins: n => { instanceRuntime.G.coins = (instanceRuntime.G.coins || 0) + n; },
    getMyClass: () => instanceRuntime.G.myClass || null,
    // B7（A3 第三批）：能量/上限资源命令端口——命令体与文本路径 applyTextEffects 的
    // addEnergy/addEnergyCap、开战被动 addPlayerMaxHp（上限 +n 同时回复 n）逐字同款，
    // 保证结构化 op 与文本路径对同一引擎状态（energy/maxEnergy/G.maxHp）结算一致。
    addEnergy: amount => { instanceRuntime.set$energy(instanceRuntime.energy + (amount)); return instanceRuntime.energy; },
    refillEnergy: () => { instanceRuntime.set$energy(instanceRuntime.maxEnergy); return instanceRuntime.maxEnergy; },
    addEnergyCap,
    addPlayerMaxHp: n => {
      instanceRuntime.G.maxHp += n;
      instanceRuntime.G.heal(n);
      instanceRuntime.G.log(`[[icon:heart]] 血量上限 +${n}（当前上限 ${instanceRuntime.G.maxHp}，并回复 ${n} 点）`, 'ok');
    },
    drawOf, isAOE,
    // B5（A3 第二批）：诅咒族结构化结算与文本路径共用同一包装 combat（cursefx 彩闪 + 同一 addCurse/tickPoison/CURSE_META）
    combat: combatPort,
    canApplyPlayerCurse: () => !instanceRuntime.playerCurseImmune && !(instanceRuntime.holyRune && instanceRuntime.turn <= 3),
    foeDealDamage: (caster, target, amount, card) => dealEffectDamage({ caster, target, amount,
      type: Combat.TYPES.ATTACK, card, source: 'enemy' }),
    // B3 端口：自伤走 damagePlayer 命令（死亡保险/不屈符文共用）；回复至需要读玩家当前血量；
    // 护甲命令扩展 guard 选项（格挡置 pdef.guard，与文本路径 def.guard 同一旗标）；
    // perSpellHeal 需要「本批抽牌中的法术数」（lastDrawnUids 只记真正入手的牌）。
    damagePlayer,
    addPlayerCurse,
    getPlayerHp: () => instanceRuntime.G.hp,
    countDrawnSpells: () => instanceRuntime.lastDrawnUids.reduce((n, u) => {
      const o = findCard(u);
      return o && o.card.type === '法术' ? n + 1 : n;
    }, 0),
    addArmor: (amount, opts) => {
      instanceRuntime.pdef.armor += amount;
      if (opts && opts.guard) instanceRuntime.pdef.guard = true;
    },
    // M2（2026-09-27）端口：偷取/禁抽/额外回合/持续规则旗标/随从位/价格与牌库定向抽取——
    // markNoDrawNext/summonAlly/deckDraw/getPriceOfLastDrawn 均为既有引擎件（此处仅透传，
    // 不新增引擎逻辑；getPriceOfLastDrawn 与上方 effect-steps deps 同口径）。
    markNoDrawNext: () => { instanceRuntime.set$noDrawNext(true); },
    setExtraTurn: v => instanceRuntime.set$extraTurn(!!v),
    setBleedAmp: v => { instanceRuntime.pstat.status.bleedAmp = v ? 1 : 0; },
    setMeleeCost1: v => instanceRuntime.set$meleeCost1(!!v),
    setSpellCost1: v => instanceRuntime.set$spellCost1(!!v),
    setConsumeFireball: v => instanceRuntime.set$consumeFireballN(v || 0),
    setAllSpellsInfused: v => instanceRuntime.set$allSpellsInfused(!!v),
    registerGrowthCard: card => { if (card?.name) instanceRuntime.growthNames.add(card.name); },
    setPoisonLegacy: v => instanceRuntime.set$poisonLegacy(!!v),
    setPlayerCurseImmune: v => {
      instanceRuntime.set$playerCurseImmune(!!v);
      if (v) instanceRuntime.delayed.forEach(q => { if (q.special === 'curseImmuneOff') q.restore = true; });
    },
    setStealthStrike: v => instanceRuntime.set$stealthStrike(!!v),
    summonAlly,
    deckDraw,
    getTurn: () => instanceRuntime.turn,
    getPlayerSpellPower: () => instanceRuntime.G.spellPower || 0,
    setNextSpellTwice: v => instanceRuntime.set$nextSpellTwice(v || 0),
    getPriceOfLastDrawn: () => {
      const uid2 = instanceRuntime.lastDrawnUids[instanceRuntime.lastDrawnUids.length - 1];
      const o2 = uid2 ? findCard(uid2) : null;
      return o2 ? Math.max(0, +(o2.card.cost || 0)) : 0;
    },
  });

  }
  return { applyTextEffects, createResolution };
}
