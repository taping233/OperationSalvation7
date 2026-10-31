import { RULE_CONFIG } from '../../core/rule-config.js';
import { esc } from '../../core/shared.js';
import { createDeckOperations } from '../bag/battle.deck.factory.js';
import { BATTLE_PHASES, createBattleState, transitionBattle } from '../runtime/battle.state.js';
import { initializeEliteEnemies, blocksPlayerPowerGain, syncEliteAuras } from './battle.elite-mechanics.js';
import { applyBossOpening } from './battle.boss-mechanics.js';

/** Instance-owned state and host services are captured explicitly. */
export function createLifecycleDomain(context) {
const instanceRuntime = context.runtime;
const hostAudio = context.audio;
const cardCatalog = context.cards;
const traceRestoreStep = context.traceRestoreStep;
const Random = context.random;
const Combat = context.combat;
Combat.COMBAT_HOOKS.canAddBlessing = (target, key, amount) => {
  const blocked = target === instanceRuntime.pstat && amount > 0 && ['atkUp', 'spellUp'].includes(key)
    && blocksPlayerPowerGain(instanceRuntime.foes);
  if (blocked) instanceRuntime.G.log('[[icon:skull]] <b>封识信徒</b>：主人公无法获得攻击强化与法术强化', 'warn');
  return !blocked;
};
const busEmit = context.emitEvent;
const presentBattleDefeat = context.presentBattleDefeat;
const { clearFeedback } = context.presentation;
const { createNormalStarterDeck, shuffleCards } = createDeckOperations(context.random);
const getHostedExecutionCard = context.normalizeCard;
const { resetBattleSummary, readBattleSummary } = context.summary;
/* battle.lifecycle.js —— 战斗入口/编组与终局收尾（自 battle.engine.js 拆出）。
 * start/编组/restore 进场，finish/flee 收尾；规则数据经 battle.runtime.js 活绑定直读，
 * 规则核结算件由 createBattleLifecycle 注入（解回合循环互递归的强连通簇）。 */

const shuffle = shuffleCards;

function createBattleLifecycle({
  session, intentFor, cloneData, injectSealCards, applyNestRunes, applyVoidRune, drawCards,
  applyBattleStartPassives, isBattleStartEquip, equipCap, isStarterAttack, requestBattleRender, alive, R,
  resetTriggers, runBattleStartTriggers, emitBattlePresentation,
  checkHandCombinations = () => {},
}) {
  const { handSelectQueue, choiceQueue } = session;
  const RUN_RESTART_KEYS = [
    'hp', 'maxHp', 'coins', 'turn', 'atk', 'spellPower', 'inventory', 'ownedCards', 'cardOrder',
    'usedPocket', 'eventLog', 'cardBox', 'nestRunes', 'nestEquipped', 'nestBossName', 'nestTargetedBox',
  ];
  function captureRunRestart(game) {
    const out = {};
    RUN_RESTART_KEYS.forEach(key => { if (Object.prototype.hasOwnProperty.call(game, key)) out[key] = cloneData(game[key]); });
    return out;
  }
  function applyRunRestart(game, state) {
    Object.entries(state || {}).forEach(([key, value]) => { game[key] = cloneData(value); });
  }

  function flee() {
    if (instanceRuntime.busy || instanceRuntime.infusing || instanceRuntime.discovering || instanceRuntime.choosing) return;
    // 撤退音由 finish(null) 统一播（win===false→'flee'），此处不再预播免得双声
    instanceRuntime.G.log('[[icon:runner]] 你撤出了战斗（打出过的卡照常结算）', 'sys');
    finish(null);
  }

  function restore(nextGame, data) {
    return context.dev
      ? traceRestoreStep('battle-restore', () => restoreImpl(nextGame, data))
      : restoreImpl(nextGame, data);
  }

  function restoreImpl(nextGame, data) {
    if (data && data.restartVersion === 1 && Array.isArray(data.enemyDefs) && data.opts) {
      session.reset('battle restarted from checkpoint');
      instanceRuntime.clearActionSignals();
      applyRunRestart(nextGame, data.run);
      Random.restore(data.rngState);
      instanceRuntime.set$battleRestartCheckpoint(cloneData(data));
      instanceRuntime.set$restoringRestartCheckpoint(true);
      try {
        start(nextGame, cloneData(data.enemyDefs), cloneData(data.opts));
        if (data.opts.isBoss && !data.opts.nest && Array.isArray(data.selectedDeck)) {
          instanceRuntime.set$sel(new Set(data.selectedDeck.filter(uid => instanceRuntime.selPool.some(entry => entry.uid === uid))));
          if (instanceRuntime.sel.size >= minimumBossDeckSize()) beginBoss();
        }
      } finally {
        instanceRuntime.set$restoringRestartCheckpoint(false);
      }
      instanceRuntime.G.log('[[icon:recycle]] 已从本场战斗开始处重新进入——战斗内消耗、受伤与状态变化已撤销', 'sys');
      requestBattleRender();
      return true;
    }
    // 旧版本战斗档缺少入场检查点，只能兼容恢复一次；恢复后再次保存即升级为新格式。
    if (!data || !data.opts) return false;
    resetBattleSummary();
    if (!data.deckSelect && (!Array.isArray(data.foes) || !data.foes.length)) return false;
    if (!Array.isArray(data.foes)) data.foes = [];
    session.reset('battle restored');
    resetTriggers?.();
    instanceRuntime.clearActionSignals();
    clearFeedback();
    instanceRuntime.restoreBattleSession(nextGame, data, R().battleEnergy);
    instanceRuntime.restoreBattlePiles(data);
    instanceRuntime.restoreBattleCombatants(data, intentFor);
    syncEliteAuras(instanceRuntime.foes);
    instanceRuntime.restorePilesBookkeeping(data);
    instanceRuntime.restoreEffectState(data);
    // —— 2026-09-09 机制审计补实装：新战斗规则变量恢复 ——
    instanceRuntime.set$allies((data.allies || []).map(a => ({ ...a, status: { ...(a.status || {}) }, defense: { shield: 0, armor: 0, guard: false, ...(a.defense || {}) } })));
    instanceRuntime.restoreEffectRules(data);
    instanceRuntime.discoverQueue.length = 0;
    instanceRuntime.clearBattlePopups(); instanceRuntime.set$pendingHint(''); instanceRuntime.resetBattlePresentation();
    instanceRuntime.closeBattleViews();
    instanceRuntime.set$sel(new Set()); instanceRuntime.set$selPool([]); instanceRuntime.set$selShaN(0);
    instanceRuntime.set$busy(false);
    instanceRuntime.G.battleActive = true;
    instanceRuntime.G.state = 'modal';
    if (hostAudio) hostAudio.setDucked(true);
    hostAudio.setBoss?.(!!data.opts.isBoss, instanceRuntime.foes[0]?.id || '');   // 读档恢复：紧张垫按存档战斗类型同步（音频 P2#12；旧格式普通战不再误抬垫）
    hostAudio.music('battle');
    if (data.deckSelect) {
      prepareDeckSelection();   // BOSS 战退出在编组阶段：重开编组（还没实际开打，无进度损失）
    } else {
      instanceRuntime.showDread();        // BOSS 登场演出不重播
      instanceRuntime.set$battleState(transitionBattle(createBattleState(), BATTLE_PHASES.PLAYER));
      instanceRuntime.G.log('[[icon:swords]] 战斗已恢复——接着上次的局面继续', 'sys');
      checkHandCombinations();
      requestBattleRender();
    }
    if (!instanceRuntime.battleRestartCheckpoint) {
      instanceRuntime.set$battleRestartCheckpoint({
        restartVersion: 1,
        enemyDefs: cloneData(instanceRuntime.foes.map(f => ({ ...f, hp: f.maxHp || f.hp }))),
        opts: cloneData(instanceRuntime.opts), selectedDeck: null,
        rngState: cloneData(Random.snapshot()), run: captureRunRestart(instanceRuntime.G),
      });
    }
    return true;
  }

  function abortBattleExecution() {
    session.abort();
    resetTriggers?.();
    instanceRuntime.clearActionSignals();
  }

  function releaseBattleState() {
    instanceRuntime.clearBattlePiles(); instanceRuntime.set$hand([]);
    instanceRuntime.clearBattlePresentation();
    instanceRuntime.set$sel(new Set());
    instanceRuntime.set$discoverQueue([]); instanceRuntime.clearBattlePopups();
    handSelectQueue.length = 0;
    choiceQueue.length = 0; instanceRuntime.resetCostFlags();
    instanceRuntime.resetPilesCarryover();
    instanceRuntime.closeBattleViews(); instanceRuntime.hideDread();
    resetBattleExtras();
  }

  // A committed run ending cancels combat without creating a second battle settlement.
  function endRun(expectedGame) {
    if (!expectedGame || instanceRuntime.G !== expectedGame) return false;
    abortBattleExecution();
    clearFeedback();
    instanceRuntime.set$busy(false);
    releaseBattleState();
    instanceRuntime.set$battleRestartCheckpoint(null);
    expectedGame.battleActive = false;
    hostAudio?.setDucked(false);
    hostAudio?.setBoss?.(false);
    return true;
  }

  function finish(win) {
    if (!instanceRuntime.G?.battleActive) return;
    abortBattleExecution();
    if (win === true && instanceRuntime.battleState.phase !== BATTLE_PHASES.VICTORY) instanceRuntime.transitionTo(BATTLE_PHASES.VICTORY);
    if (context.track) context.track('battleEquips', { n: instanceRuntime.equipped.length });
    if (win === false && instanceRuntime.battleState.phase !== BATTLE_PHASES.DEFEAT) instanceRuntime.transitionTo(BATTLE_PHASES.DEFEAT);
    clearFeedback();
    instanceRuntime.set$busy(false);
    hostAudio.sfx(win === true ? (instanceRuntime.opts.isBoss ? 'bossVictory' : 'victory') : win === false ? 'defeat' : 'flee');
    const playedCopy = instanceRuntime.played.slice();
    const settledPlayedCopy = [...new Set([...playedCopy, ...instanceRuntime.discard])];
    const consumedCopy = instanceRuntime.consumed.slice();
    const spentUids = new Set([...settledPlayedCopy, ...consumedCopy]);
    // 普通临时牌库只属于本场；其已出/弃置/注能记录保留，但不提供可被战后消耗区入库的卡模板。
    instanceRuntime.opts.spentCards = instanceRuntime.granted.filter(entry => spentUids.has(entry.uid) && !entry.uid.startsWith('normal-sha-'))
      .map(entry => ({ uid: entry.uid, card: { ...entry.card } }));
    releaseBattleState();
    instanceRuntime.G.state = 'idle';
    instanceRuntime.G.battleActive = false;
    if (hostAudio) hostAudio.setDucked(false);   // 战斗结束恢复 BGM 音量
    if (hostAudio) hostAudio.setBoss?.(false);   // BOSS 紧张垫解除（音频 P2#12）
    instanceRuntime.opts.foeNames = instanceRuntime.foes.map(f => f.name);
    instanceRuntime.opts.battleSummary = readBattleSummary(instanceRuntime.turn, instanceRuntime.foes);
    // 先记账再通知结算/保存；隔离样本不进入玩家的本局战斗记录。
    if (!instanceRuntime.opts.devSample) context.noteBattle?.(win, {
      li: instanceRuntime.G.layerIdx, node: instanceRuntime.G.trackPos, foe: instanceRuntime.opts.foeNames?.join('+') || '', hp: instanceRuntime.G.hp, turn: instanceRuntime.G.turn,
      round: instanceRuntime.turn,
      mode: win === true ? 'win' : win === false ? 'lose' : 'flee',
      nPlayed: playedCopy.length,
      nUsed: consumedCopy.length,
      deck: instanceRuntime.opts.isBoss ? instanceRuntime.lastDeckSel.map(uid => instanceRuntime.G.ownedCards?.find(o => o.uid === uid)?.card?.name || uid) : null,
    });
    hostAudio.music('board');   // 战斗结束切回行军氛围
    // Necessary settlement has an explicit completion port; observers run only after success.
    const endedGame = instanceRuntime.G, endedOpts = instanceRuntime.opts;
    const notifyEnd = () => {
      if (instanceRuntime.G !== endedGame || instanceRuntime.opts !== endedOpts || endedGame.battleActive) return;
      const settle = endedOpts.nest ? endedGame.onNestBattleEnd : endedGame.onBattleEnd;
      const fail = error => {
        console.error('[battle] 必要战后结算失败', error);
        endedGame.log('[[icon:cross]] 战后结算尚未完成，请保留当前页面并重试；进度未确认为已保存。', 'warn');
        return false;
      };
      const complete = result => {
        if (result === false) return fail(new Error('Settlement reported incomplete'));
        busEmit('battle:end', endedOpts, playedCopy, win, consumedCopy);
        return true;
      };
      if (typeof settle !== 'function') return fail(new Error('Missing necessary battle settlement port'));
      try {
        const result = settle.call(endedGame, endedOpts, settledPlayedCopy, win, consumedCopy);
        return result && typeof result.then === 'function' ? Promise.resolve(result).then(complete, fail) : complete(result);
      } catch (error) { return fail(error); }
    };
    // 逻辑死亡和中止仍立即完成；仅在实页有倒地演出时推迟结算页通知。
    const presentation = win === false ? presentBattleDefeat({ hp: endedGame.hp, maxHp: endedGame.maxHp }) : null;
    if (presentation) presentation.then(notifyEnd, notifyEnd);
    else notifyEnd();
    instanceRuntime.set$battleRestartCheckpoint(null);
  }

  // 混沌之眼「牌库上限 +N」：BOSS 编组可带张数加成（2026-09-10 #35 起按「编组勾选」计算）
  function deckCapBonus(uids) {
    let bonus = 0;
    (instanceRuntime.G.ownedCards || []).forEach(o => {
      const card = getHostedExecutionCard(o.card);
      if (!card || !isBattleStartEquip(card) || !(uids || instanceRuntime.sel).has(o.uid)) return;
      const declared = card.rules?.equip?.passive?.aura?.deckCap;
      if (Number.isInteger(declared)) bonus += declared;
      else {
        const m = String(card.desc || '').match(/牌库上限\s*\+?\s*(\d+)/);
        if (m) bonus += +m[1];
      }
    });
    return bonus;
  }

  // ---------- 入口 ----------
  function start(game, enemyDefs, options) {
    resetBattleSummary();
    session.reset('battle replaced');
    resetTriggers?.();
    instanceRuntime.clearActionSignals();
    clearFeedback();
    instanceRuntime.set$G(game);
    // Only the requested card art needs warming here; unrelated enemy and class
    // portraits must not be decoded on battle entry.
    // Keep card URLs and two-slot decode warmup, without pinning speculative card images.
    // Restore uses this same entry. Visible fighters load through their own scene images.
    try {
      if (context.warmCards) {
        // These inventory-only types never enter combat hand, deck selection or item dock.
        const cards = (instanceRuntime.G.ownedCards || []).map(o => o && o.card)
          .filter(card => card && !['资源', '事件', '生物'].includes(card.type));
        context.warmCards(cards);
      }
    } catch { /* Optional artwork warmup must not block battle entry. */ }
    const defs = Array.isArray(enemyDefs) ? enemyDefs : [enemyDefs];
    const startOptions = Object.assign({ isBoss: false }, options || {});
    if (!instanceRuntime.restoringRestartCheckpoint) {
      instanceRuntime.set$battleRestartCheckpoint({
        restartVersion: 1,
        enemyDefs: cloneData(defs),
        opts: cloneData(startOptions),
        selectedDeck: null,
        rngState: cloneData(Random.snapshot()),
        run: captureRunRestart(instanceRuntime.G),
      });
    }
    instanceRuntime.G.battleActive = true;   // game.js 用它锁住侧栏/快捷键背包入口
    if (hostAudio) hostAudio.setDucked(true);   // 战斗期间 BGM 侧链压低（audio-design ducking）
    instanceRuntime.set$opts(startOptions);
    if (hostAudio) hostAudio.setBoss?.(instanceRuntime.opts.isBoss, defs[0]?.id || '');   // BOSS 战抬升紧张垫（音频 P2#12）
    instanceRuntime.set$mode(instanceRuntime.opts.isBoss ? 'boss' : 'normal');
    instanceRuntime.set$battleState(createBattleState({ mode: instanceRuntime.mode }));
    instanceRuntime.set$foes(defs.map(d => {
      const f = {
        id: d.id || null, name: d.name, hp: d.hp, maxHp: d.hp,
        boss: d.boss,
        controlBoss: d.boss ?? d.isBoss ?? (!!instanceRuntime.opts.isBoss && d === defs[0] && !instanceRuntime.opts.nest),
        // 龙巢敌人扩展标记（心/轮换免疫/阶段/复活/庇护/消耗手牌等）原样透传
        heartsMode: d.heartsMode || undefined, hearts: d.hearts || undefined, rotateImmune: d.rotateImmune || undefined,
        evenAttack: d.evenAttack || undefined, noFirstAttack: d.noFirstAttack || undefined,
        handConsume: d.handConsume || undefined, phases: d.phases || undefined,
        revive: d.revive || undefined, revived: undefined, protects: d.protects || undefined,
        protected: d.protected || undefined, reviveTurn: undefined,
        atk: d.atk || 2, affix: d.affix || null, affixName: d.affixName || null, behavior: d.behavior || null, dead: false,
        elite: d.elite || undefined, eliteSkill: d.eliteSkill, desc: d.desc, damageCap: d.damageCap,
        status: {}, defense: { shield: 0, armor: 0, guard: false },
      };
      f.intent = intentFor(f, 1);
      Combat.ensureStatus(f);
      return f;
    }));
    initializeEliteEnemies(instanceRuntime.foes);
    instanceRuntime.foes.forEach(f => { f.intent = intentFor(f, 1); });
    instanceRuntime.set$interaction(null);
    hostAudio.music('battle');   // 切入战斗氛围
    hostAudio.sfx(instanceRuntime.opts.isBoss ? 'bossReveal' : 'battleEnter');
    instanceRuntime.G.state = 'modal';
    // The restart checkpoint, opts and combatants are now complete. Persist before
    // entry effects/rendering; restoreGame retains ownership of its final save.
    if (!instanceRuntime.restoringRestartCheckpoint && instanceRuntime.battleRestartCheckpoint && typeof instanceRuntime.G.persistSave === 'function') {
      try {
        const sourceGame = instanceRuntime.G;
        const warn = () => sourceGame.log('[[icon:cross]] 本场入场检查点未保存，重新载入仍以此前存档为准', 'warn');
        const pendingSave = sourceGame.persistSave();
        if (pendingSave && typeof pendingSave.then === 'function') pendingSave.then(saved => { if (saved === false) warn(); }, warn);
        else if (pendingSave === false) warn();
      } catch (error) {
        console.warn('[battle] 入场检查点保存失败', error);
        instanceRuntime.G.log('[[icon:cross]] 本场入场检查点未保存，重新载入仍以此前存档为准', 'warn');
      }
    }
    const names = instanceRuntime.foes.map(f => `${f.name}(${f.atk}-${f.hp})`).join('、');
    instanceRuntime.G.log(`[[icon:swords]] <b>${instanceRuntime.opts.isBoss ? 'BOSS战' : '遭遇战'}【${esc(names)}】</b>${!instanceRuntime.opts.isBoss && instanceRuntime.opts.risk ? ` · 风险<b>${esc(instanceRuntime.opts.risk)}</b>` : ''}`, 'warn');
    if (instanceRuntime.mode === 'boss') {
    if (instanceRuntime.opts.nest) {
      // 龙巢（2026-09-18 留言「牌盒即牌库」）：跳过编组，卡盒全部卡牌直接成库
      instanceRuntime.set$selPool(instanceRuntime.G.ownedCards.filter(o => !o.stored && !o.pouchOf && !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isStarterAttack(o.card)));
      instanceRuntime.set$selShaN(0);
      instanceRuntime.set$sel(new Set(instanceRuntime.selPool.map(o => o.uid)));
      beginBoss();
    } else if (instanceRuntime.opts.directBossStart) prepareAutomaticBossDeck();
    else prepareDeckSelection();
  }
    else beginNormal();
  }

  function beginNormal() {
    instanceRuntime.clearBattlePiles();
    // 道具/资源/事件/生物卡默认不进手牌（v0.32：手牌只放可直接打出的战斗卡）；
    // 「对战开始时」装备（Q1 老板定向：持有即自动生效）不进手牌、改为开战被动
    // 随身能力卡与招式一同进入普通战手牌，按各自卡牌条件使用。
    instanceRuntime.set$hand(instanceRuntime.G.ownedCards.filter(o => !o.stored && !o.pouchOf && !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isBattleStartEquip(o.card)).map(o => o.uid));
    resetBattleEntryState();
    const starters = createNormalStarterDeck(cardCatalog.SHA, instanceRuntime.battleState.token, cloneData);
    instanceRuntime.granted.push(...starters);
    instanceRuntime.set$drawPile(starters.map(entry => entry.uid));
    instanceRuntime.transitionTo(BATTLE_PHASES.PLAYER);
    instanceRuntime.G.state = 'modal';
    if (resetTriggers) resetTriggers();
    applyBossOpening(context);
    applyBattleStartPassives();
    if (runBattleStartTriggers) runBattleStartTriggers();   // M2：结构化 onBattleStart（能力卡/迎装规则）
    checkHandCombinations();
    if (!instanceRuntime.restoringRestartCheckpoint) emitBattlePresentation?.({ kind: 'player-turn-start', turn: instanceRuntime.turn });
    if (alive().length > 1) instanceRuntime.G.log('[[icon:question]] 以一敌多：单体伤害牌选择敌人；全体牌可拖到<b>战场空地</b>或选择敌人。需要注能时先选材料，再确认释放', 'sys');
    instanceRuntime.G.log(`[[icon:cards]] 随身 <b>${instanceRuntime.hand.length}</b> 张战斗卡直接入手；另有 <b>${RULE_CONFIG.battle.normalStarterDeckSize}</b> 张本场临时初始攻击牌库，仅由抽牌效果取牌，开局与每回合不固定抽牌 · 每回合固定 <b>${instanceRuntime.maxEnergy}</b> 费`, 'sys');
    requestBattleRender();
  }

  // 两种战斗入口共用的运行态重置；牌区与模式专属开战步骤留在各自入口。
  function resetBattleEntryState() {
    instanceRuntime.resetBattlePlayerState(R().battleEnergy);
    instanceRuntime.set$discoverQueue([]); instanceRuntime.clearBattlePopups(); instanceRuntime.resetBattlePresentation();
    handSelectQueue.length = 0; choiceQueue.length = 0; instanceRuntime.resetCostFlags();
    instanceRuntime.resetPilesCarryover();
    instanceRuntime.closeBattleViews();
    resetBattleExtras();
    instanceRuntime.set$pendingHint('');
  }

  // —— 新增战斗规则变量统一清零（begin/beginBoss/finish 共用）——
  function resetBattleExtras() {
    instanceRuntime.set$allies([]);
    instanceRuntime.resetBattleEffectFlags();   // effects 属地旗标+符文旗整组清零（治理批次 4a 收敛）
    instanceRuntime.resetCastOverrides();
    instanceRuntime.set$interaction(null);
    instanceRuntime.set$freeCast(new Set());
    instanceRuntime.set$equipped([]);
  }

  // ---------- BOSS战：编组牌库 ----------
  function minimumBossDeckSize() {
    const available = instanceRuntime.opts.nest ? instanceRuntime.selPool.length : instanceRuntime.selPool.filter(o => !isBattleStartEquip(o.card)).length
      + Math.min(equipCap(), instanceRuntime.selPool.filter(o => isBattleStartEquip(o.card)).length);
    return Math.min(R().bossDeckSize, available);
  }
  function selectedStartEquipCount() {
    return instanceRuntime.selPool.filter(o => instanceRuntime.sel.has(o.uid) && isBattleStartEquip(o.card)).length;
  }
  function trimStartEquipmentSelection() {
    let remaining = equipCap();
    for (const uid of instanceRuntime.sel) {
      const entry = instanceRuntime.selPool.find(o => o.uid === uid);
      if (entry && isBattleStartEquip(entry.card) && remaining-- <= 0) instanceRuntime.sel.delete(uid);
    }
  }

  // 地图首脑直入：沿用有效旧编组，按背包顺序补齐，保持既有卡类与容量规则。
  function prepareAutomaticBossDeck() {
    instanceRuntime.set$selPool(instanceRuntime.G.ownedCards.filter(o => !o.stored && !o.pouchOf && !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isStarterAttack(o.card)));
    instanceRuntime.set$selShaN(R().starterSha);
    instanceRuntime.set$sel(new Set(instanceRuntime.lastDeckSel.filter(uid => instanceRuntime.selPool.some(entry => entry.uid === uid))));
    trimStartEquipmentSelection();
    const capacity = () => Math.min(instanceRuntime.selPool.length, R().bossDeckSize + deckCapBonus(instanceRuntime.sel));
    while (instanceRuntime.sel.size > capacity()) instanceRuntime.sel.delete(instanceRuntime.sel.values().next().value);
    for (const entry of instanceRuntime.selPool) {
      if (instanceRuntime.sel.size >= capacity()) break;
      if (isBattleStartEquip(entry.card) && selectedStartEquipCount() >= equipCap()) continue;
      instanceRuntime.sel.add(entry.uid);
    }
    instanceRuntime.set$selDeckMax(R().bossDeckSize + deckCapBonus(instanceRuntime.sel));
    beginBoss();
  }

  // 2026-09-09 玩法定版：必选 15 张（招式/装备/能力卡）起步；混沌之眼编入后牌库上限 +5（上限 20）。
  function prepareDeckSelection() {
    instanceRuntime.set$selDeckMax(R().bossDeckSize + deckCapBonus());   // 混沌之眼「牌库上限+5」（编入后才计入）
    // 2026-09-16 老板定版：骷髅王剑/混沌之眼等「对战开始时」装备计入 15 张套牌（不再独立勾选）
    instanceRuntime.set$selPool(instanceRuntime.G.ownedCards.filter(o => !o.stored && !o.pouchOf && !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isStarterAttack(o.card)));
    instanceRuntime.set$selShaN(R().starterSha);
    instanceRuntime.set$sel(new Set(instanceRuntime.lastDeckSel.filter(uid => instanceRuntime.selPool.some(entry => entry.uid === uid))));
    trimStartEquipmentSelection();
    instanceRuntime.set$selDeckMax(R().bossDeckSize + deckCapBonus(instanceRuntime.sel));
    const cap = Math.min(instanceRuntime.selDeckMax, instanceRuntime.selPool.length);
    while (instanceRuntime.sel.size > cap) instanceRuntime.sel.delete(instanceRuntime.sel.values().next().value);
    instanceRuntime.set$selectingDeck(true);
    requestBattleRender();
  }

  function toggleDeckCard(uid) {
    if (!instanceRuntime.selectingDeck || !instanceRuntime.selPool.some(entry => entry.uid === uid)) return;
    const proposed = new Set(instanceRuntime.sel);
    if (proposed.has(uid)) proposed.delete(uid); else proposed.add(uid);
    const capacity = R().bossDeckSize + deckCapBonus(proposed);
    if (!instanceRuntime.sel.has(uid) && proposed.size > capacity) return;
    const entry = instanceRuntime.selPool.find(o => o.uid === uid);
    if (!instanceRuntime.sel.has(uid) && isBattleStartEquip(entry.card) && selectedStartEquipCount() >= equipCap()) {
      instanceRuntime.G.log(`[[icon:cross]] 开战装备占用装备栏，最多编入 ${equipCap()} 件；请先移出一件开战装备`, 'warn');
      return;
    }
    if (instanceRuntime.sel.has(uid)) instanceRuntime.sel.delete(uid); else instanceRuntime.sel.add(uid);
    instanceRuntime.set$selDeckMax(capacity);
    requestBattleRender();
  }

  function cancelDeckSelection() {
    if (!instanceRuntime.selectingDeck) return;
    instanceRuntime.G.log('[[icon:runner]] 你放下了挑战，首脑仍在污染核心深处盘踞', 'sys');
    finish(null);
  }

  function beginBoss() {
    if (!instanceRuntime.opts.nest) {
      instanceRuntime.set$selDeckMax(R().bossDeckSize + deckCapBonus(instanceRuntime.sel));
      if (instanceRuntime.sel.size > instanceRuntime.selDeckMax) {
        instanceRuntime.G.log(`[[icon:cross]] 所选卡牌超过牌库上限 ${instanceRuntime.selDeckMax} 张，请调整编组后开战`, 'warn');
        instanceRuntime.set$selectingDeck(true);
        requestBattleRender();
        return;
      }
    }
    if (!instanceRuntime.opts.nest && selectedStartEquipCount() > equipCap()) {
      instanceRuntime.G.log(`[[icon:cross]] 开战装备超过 ${equipCap()} 件，请调整编组后开战`, 'warn');
      instanceRuntime.set$selectingDeck(true);
      requestBattleRender();
      return;
    }
    // 2026-09-10 留言 #34：背包可编卡牌不足 15 张时按实际可编数放行（视图侧同口径），
    // 否则「开始战斗」按钮永远灰着、点击也无任何反应
    if (instanceRuntime.sel.size < minimumBossDeckSize()) return;
    const shas = instanceRuntime.G.ownedCards.filter(o => isStarterAttack(o.card)).slice(0, R().starterSha).map(o => o.uid);
    instanceRuntime.set$lastDeckSel([...instanceRuntime.sel]);
    if (instanceRuntime.battleRestartCheckpoint) instanceRuntime.battleRestartCheckpoint.selectedDeck = [...instanceRuntime.sel];
    instanceRuntime.set$selectingDeck(false);
    instanceRuntime.clearBattlePiles();
    // 首脑入口保证固定初始攻击数；缺少的补为战斗临时牌，用过后也进入消耗区。
    while (!instanceRuntime.opts.nest && shas.length < R().starterSha) {
      const uid = `boss-sha-${instanceRuntime.battleState.token}-${shas.length}`;
      instanceRuntime.granted.push({ uid, card: { ...cardCatalog.SHA } });
      shas.push(uid);
    }
    instanceRuntime.set$drawPile(shuffle([...instanceRuntime.sel].concat(shas)));   // 骷髅王剑/混沌之眼等对战开始时装备已在 sel 内
    instanceRuntime.set$hand([]);
    resetBattleEntryState();
    instanceRuntime.transitionTo(BATTLE_PHASES.PLAYER);
    instanceRuntime.G.state = 'modal';
    if (resetTriggers) resetTriggers();   // 与 beginNormal 对齐：上一场战斗的 M2 触发登记不得跨战斗泄漏
    instanceRuntime.G.log(instanceRuntime.opts.nest
      ? `[[icon:draw-pile]] <b>牌盒即牌库</b>：${instanceRuntime.drawPile.length} 张 · 开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${instanceRuntime.maxEnergy}</b> 费`
      : `[[icon:draw-pile]] 牌库编成：${instanceRuntime.opts.directBossStart ? '自动编入' : '自选'} ${instanceRuntime.sel.size} 张非道具卡 + 初始攻击 ×${shas.length} = <b>${instanceRuntime.drawPile.length}</b> 张 ·
      开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${instanceRuntime.maxEnergy}</b> 费`, 'sys');
    injectSealCards();   // 受缚之残影：编组带着才发动——4 张封印肢体洗入牌库（本牌已随编组在库），开局抽牌前洗入
    applyNestRunes();    // 龙巢符文：羁绊与符文效果开战结算
    drawCards(R().battleStartDraw);
    applyVoidRune();     // 虚空符文：开局抽牌后复制 0 费招式
    applyBossOpening(context);
    // 冰冻监听由 engine 持续装配，开局抽牌与之后各战斗沿同一宿主。
    applyBattleStartPassives();   // 已编入的开战装备先统一消耗，再按顺序执行开战效果
    if (runBattleStartTriggers) runBattleStartTriggers();   // M2：结构化 onBattleStart（能力卡/迎装规则）
    if (!instanceRuntime.restoringRestartCheckpoint) emitBattlePresentation?.({ kind: 'player-turn-start', turn: instanceRuntime.turn });
    requestBattleRender();
  }

  return {
    flee, restore, finish, endRun, start, toggleDeckCard, cancelDeckSelection,
    beginBoss: () => { if (instanceRuntime.selectingDeck) beginBoss(); },
    prepareDeckSelection, deckCapBonus,
  };
}
return { createBattleLifecycle };
}
