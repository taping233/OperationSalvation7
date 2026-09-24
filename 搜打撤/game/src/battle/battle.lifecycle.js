/* battle.lifecycle.js —— 战斗入口/编组与终局收尾（自 battle.engine.js 拆出）。
 * start/编组/restore 进场，finish/flee 收尾；规则数据经 battle.runtime.js 活绑定直读，
 * 规则核结算件由 createBattleLifecycle 注入（解回合循环互递归的强连通簇）。 */
const SDT = window.SDT;
import { esc } from '../core/shared.js';
import { Random } from '../core/random.js';
import * as Combat from './combat.js';
import { COMBAT_HOOKS } from './combat.js';
import { emit as busEmit } from '../core/event-bus.js';
import { clearFeedback } from './battle.feedback.js';
import { shuffleCards } from './battle.deck.js';
import { BATTLE_PHASES, createBattleState, transitionBattle } from './battle.state.js';
import {
  battleState, G, foes, opts, mode, drawPile, hand, discard, granted, played, consumed, grave,
  energy, maxEnergy, turn, pdef, pstat, busy, infusing, discovering, discoverQueue,
  handSelecting, choosing, interaction, pendingHint, delayed, noDrawNext, extraTurn,
  viewingGrave, viewingDeck, viewingBag, floats, cardAnims, presentationActionSeq, dreadShown,
  stealthStrike, nextSpellTwice, selPool, selShaN, sel, lastDeckSel, selectingDeck, selDeckMax,
  spellCost1, meleeCost1, shaTransform, consumeFireballN, lastDrawnUids, lastPlayedType,
  playedMartialThisTurn, playedMovesThisTurn, allies, growthNames, growth, infuseFuels,
  sealUnlocked, deathSave, killAtkUp, poisonOnSpell, poisonLegacy, nestRunes, nestSyn,
  arrowRune, unyieldRune, ashRune, unlimitedRune, holyRune, freezeRuneOn, fireballRuneOn,
  swiftRune, timeSpaceRune, timeSpaceUsed, armorMul, sealDone, playerCurseImmune, allSpellsInfused,
  zeroFeeUntil, cardOverrides, equipped, freeCast, battleRestartCheckpoint, restoringRestartCheckpoint,
  activeActionSignal, surgeWaiter,
  set$activeActionSignal, set$surgeWaiter, set$G, set$opts, set$mode, set$turn, set$maxEnergy,
  set$energy, set$hand, set$drawPile, set$discard, set$grave, set$played, set$consumed, set$granted,
  set$pdef, set$pstat, set$foes, set$delayed, set$noDrawNext, set$spellCost1, set$meleeCost1,
  set$shaTransform, set$consumeFireballN, set$lastDrawnUids, set$lastPlayedType, set$stealthStrike,
  set$nextSpellTwice, set$allies, set$growth, set$growthNames, set$infuseFuels, set$sealUnlocked,
  set$extraTurn, set$deathSave, set$killAtkUp, set$poisonOnSpell, set$poisonLegacy,
  set$zeroFeeUntil, set$cardOverrides, set$infusing, set$discovering, set$discoverQueue, set$handSelecting,
  set$choosing, set$interaction, set$pendingHint, set$floats, set$cardAnims,
  set$presentationActionSeq, set$viewingGrave, set$viewingDeck, set$selectingDeck, set$viewingBag,
  set$sel, set$selPool, set$selShaN, set$busy, set$dreadShown, set$battleState,
  set$battleRestartCheckpoint, set$restoringRestartCheckpoint,
  set$sealDone, set$playerCurseImmune, set$allSpellsInfused, set$nestRunes, set$nestSyn,
  set$timeRune, set$arrowRune, set$unyieldRune, set$ashRune, set$unlimitedRune, set$holyRune,
  set$fireballRuneOn, set$freezeRuneOn, set$swiftRune, set$timeSpaceRune, set$timeSpaceUsed,
  set$armorMul, set$freeCast, set$equipped, set$playedMartialThisTurn, set$playedMovesThisTurn,
  set$selDeckMax, set$lastDeckSel,
  clearBattlePresentation, resetBattlePresentation, showDread, hideDread,
  clearBattlePiles, restoreBattlePiles, restorePilesBookkeeping, resetPilesCarryover, resetCastOverrides,
} from './battle.runtime.js';

const shuffle = shuffleCards;

export function createBattleLifecycle({
  session, intentFor, cloneData, injectSealCards, applyNestRunes, applyVoidRune, drawCards,
  applyBattleStartPassives, isBattleStartEquip, isStarterAttack, requestBattleRender, alive, R,
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
    if (busy || infusing || discovering || choosing) return;
    SDT.Sound.sfx('flee');
    G.log('[[icon:runner]] 你撤出了战斗（打出过的卡照常结算）', 'sys');
    finish(null);
  }

  function restore(nextGame, data) {
    if (data && data.restartVersion === 1 && Array.isArray(data.enemyDefs) && data.opts) {
      session.reset('battle restarted from checkpoint');
      set$activeActionSignal(null); set$surgeWaiter(null);
      applyRunRestart(nextGame, data.run);
      Random.restore(data.rngState);
      set$battleRestartCheckpoint(cloneData(data));
      set$restoringRestartCheckpoint(true);
      try {
        start(nextGame, cloneData(data.enemyDefs), cloneData(data.opts));
        if (data.opts.isBoss && !data.opts.nest && Array.isArray(data.selectedDeck)) {
          set$sel(new Set(data.selectedDeck.filter(uid => selPool.some(entry => entry.uid === uid))));
          if (sel.size >= Math.min(R().bossDeckSize, selPool.length)) beginBoss();
        }
      } finally {
        set$restoringRestartCheckpoint(false);
      }
      G.log('[[icon:recycle]] 已从本场战斗开始处重新进入——战斗内消耗、受伤与状态变化已撤销', 'sys');
      requestBattleRender();
      return true;
    }
    // 旧版本战斗档缺少入场检查点，只能兼容恢复一次；恢复后再次保存即升级为新格式。
    if (!data || !data.opts) return false;
    if (!data.deckSelect && (!Array.isArray(data.foes) || !data.foes.length)) return false;
    if (!Array.isArray(data.foes)) data.foes = [];
    session.reset('battle restored');
    set$activeActionSignal(null); set$surgeWaiter(null);
    clearFeedback();
    set$G(nextGame);
    set$opts(JSON.parse(JSON.stringify(data.opts)));
    set$mode(data.mode === 'boss' ? 'boss' : 'normal');
    set$turn(+data.turn || 1);
    set$maxEnergy(+data.maxEnergy || R().battleEnergy);
    set$energy(Number.isFinite(+data.energy) ? +data.energy : maxEnergy);
    restoreBattlePiles(data);
    set$pdef({ shield: 0, armor: 0, guard: false, ...(data.pdef || {}) });
    set$pstat(Combat.ensureStatus({ hp: G.hp, status: { ...(data.pstat?.status || {}) } }));
    set$foes(data.foes.map(f => {
      const foe = {
        id: f.id || null, name: f.name, hp: f.hp, maxHp: f.maxHp, atk: f.atk || 2,
        affix: f.affix || null, affixName: f.affixName || null, behavior: f.behavior || null, dead: !!f.dead,
        status: { ...(f.status || {}) },
        defense: { shield: 0, armor: 0, guard: false, ...(f.defense || {}) },
        intent: f.intent ? JSON.parse(JSON.stringify(f.intent)) : null,
      };
      Combat.ensureStatus(foe);
      if (!foe.intent) foe.intent = intentFor(foe, turn);
      return foe;
    }));
    restorePilesBookkeeping(data);
    set$spellCost1(!!data.spellCost1); set$meleeCost1(!!data.meleeCost1);
    set$shaTransform(data.shaTransform || null); set$consumeFireballN(+data.consumeFireballN || 0);
    set$lastPlayedType(data.lastPlayedType || null);
    set$stealthStrike(!!data.stealthStrike); set$nextSpellTwice(+data.nextSpellTwice || 0);
    // —— 2026-09-09 机制审计补实装：新战斗规则变量恢复 ——
    set$allies((data.allies || []).map(a => ({ ...a, status: { ...(a.status || {}) }, defense: { shield: 0, armor: 0, guard: false, ...(a.defense || {}) } })));
    set$growth({ ...(data.growth || {}) }); set$growthNames(new Set(data.growthNames || []));
    set$infuseFuels(+data.infuseFuels || 0); set$sealUnlocked(!!data.sealUnlocked);
    set$extraTurn(!!data.extraTurn); set$deathSave(+data.deathSave || 0);
    set$killAtkUp(+data.killAtkUp || 0); set$poisonOnSpell(!!data.poisonOnSpell);
    set$infusing(null); set$discovering(null); discoverQueue.length = 0;
    set$handSelecting(null); handSelectQueue.length = 0; set$choosing(null); choiceQueue.length = 0;
    set$interaction(null); set$pendingHint(''); resetBattlePresentation();
    set$viewingGrave(false); set$viewingDeck(false); set$selectingDeck(false); set$viewingBag(false);
    set$sel(new Set()); set$selPool([]); set$selShaN(0);
    set$busy(false);
    G.battleActive = true;
    G.state = 'modal';
    if (SDT.Sound) SDT.Sound.setDucked(true);
    SDT.Sound.setBoss?.(true);   // BOSS 读档恢复：紧张垫同步（音频 P2#12）
    SDT.Sound.music('battle');
    if (data.deckSelect) {
      prepareDeckSelection();   // BOSS 战退出在编组阶段：重开编组（还没实际开打，无进度损失）
    } else {
      showDread();        // BOSS 登场演出不重播
      set$battleState(transitionBattle(createBattleState(), BATTLE_PHASES.PLAYER));
      G.log('[[icon:swords]] 战斗已恢复——接着上次的局面继续', 'sys');
      requestBattleRender();
    }
    if (!battleRestartCheckpoint) {
      set$battleRestartCheckpoint({
        restartVersion: 1,
        enemyDefs: cloneData(foes.map(f => ({ ...f, hp: f.maxHp || f.hp }))),
        opts: cloneData(opts), selectedDeck: null,
        rngState: cloneData(Random.snapshot()), run: captureRunRestart(G),
      });
    }
    return true;
  }

  function finish(win) {
    session.abort();
    set$activeActionSignal(null); set$surgeWaiter(null);
    if (win === true && battleState.phase !== BATTLE_PHASES.VICTORY) set$battleState(transitionBattle(battleState, BATTLE_PHASES.VICTORY));
    if (SDT.Meta && SDT.Meta.track) SDT.Meta.track('battleEquips', { n: equipped.length });
    if (win === false && battleState.phase !== BATTLE_PHASES.DEFEAT) set$battleState(transitionBattle(battleState, BATTLE_PHASES.DEFEAT));
    clearFeedback();
    set$busy(false);
    SDT.Sound.sfx(win === true ? 'victory' : win === false ? 'defeat' : 'flee');
    const playedCopy = played.slice();
    const consumedCopy = consumed.slice();
    clearBattlePiles(); set$hand([]);
    clearBattlePresentation();
    set$sel(new Set());
    set$infusing(null); set$discovering(null); set$discoverQueue([]); set$interaction(null); clearBattlePresentation();
    set$handSelecting(null); handSelectQueue.length = 0;
    set$choosing(null); choiceQueue.length = 0; set$stealthStrike(false); set$nextSpellTwice(0);
    resetPilesCarryover(); set$spellCost1(false); set$meleeCost1(false);
    set$shaTransform(null); set$consumeFireballN(0); set$lastPlayedType(null);
    set$viewingGrave(false); set$viewingDeck(false); hideDread(); set$selectingDeck(false); set$viewingBag(false);
    resetBattleExtras();
    G.state = 'idle';
    G.battleActive = false;
    if (SDT.Sound) SDT.Sound.setDucked(false);   // 战斗结束恢复 BGM 音量
    if (SDT.Sound) SDT.Sound.setBoss?.(false);   // BOSS 紧张垫解除（音频 P2#12）
    opts.foeNames = foes.map(f => f.name);
    SDT.Sound.music('board');   // 战斗结束切回行军氛围
    // 战斗结束广播（2026-09-11 批次 5）：订阅方各自响应（背包结算/基地/统计），
    // 战斗核心不再直接依赖 game.onBattleEnd 的实现；无人订阅时回退旧回调（审计 harness 兼容）
    if (!busEmit('battle:end', opts, playedCopy, win, consumedCopy) && typeof G.onBattleEnd === 'function') {
      G.onBattleEnd(opts, playedCopy, win, consumedCopy);
    }
    set$battleRestartCheckpoint(null);
  }

  // 混沌之眼「牌库上限 +N」：BOSS 编组可带张数加成（2026-09-10 #35 起按「编组勾选」计算）
  function deckCapBonus(uids) {
    let bonus = 0;
    (G.ownedCards || []).forEach(o => {
      if (!o.card || !isBattleStartEquip(o.card) || !(uids || sel).has(o.uid)) return;
      const m = String(o.card.desc).match(/牌库上限\s*\+\s*(\d+)/);
      if (m) bonus += +m[1];
    });
    return bonus;
  }

  // ---------- 入口 ----------
  function start(game, enemyDefs, options) {
    session.reset('battle replaced');
    set$activeActionSignal(null); set$surgeWaiter(null);
    clearFeedback();
    set$G(game);
    // 战斗开局预热本局可用卡面：手牌 img 是 lazy，手牌重建瞬间图未解码会露插画窗深底（黑窗）。
    // URL 走 collectCardAssets 与 <img> 实际 src 完全一致，命中 HTTP/解码缓存；已预热项内部自动去重。
    // restore 读档恢复同样走 start，两条进战斗路径都覆盖。
    try {
      if (SDT.Art && SDT.Art.collectCardAssets && SDT.Art.warm) {
        SDT.Art.warm(SDT.Art.collectCardAssets((G.ownedCards || []).map(o => o && o.card).filter(Boolean)));
      }
    } catch { /* 预热失败（如 Art 域未就绪/资产缺失）：不阻塞进战斗 */ }
    const defs = Array.isArray(enemyDefs) ? enemyDefs : [enemyDefs];
    const startOptions = Object.assign({ isBoss: false }, options || {});
    if (!restoringRestartCheckpoint) {
      set$battleRestartCheckpoint({
        restartVersion: 1,
        enemyDefs: cloneData(defs),
        opts: cloneData(startOptions),
        selectedDeck: null,
        rngState: cloneData(Random.snapshot()),
        run: captureRunRestart(G),
      });
    }
    G.battleActive = true;   // game.js 用它锁住侧栏/快捷键背包入口
    if (SDT.Sound) SDT.Sound.setDucked(true);   // 战斗期间 BGM 侧链压低（audio-design ducking）
    set$opts(startOptions);
    if (SDT.Sound) SDT.Sound.setBoss?.(opts.isBoss);   // BOSS 战抬升紧张垫（音频 P2#12）
    set$mode(opts.isBoss ? 'boss' : 'normal');
    set$battleState(createBattleState({ mode }));
    set$foes(defs.map(d => {
      const f = {
        id: d.id || null, name: d.name, hp: d.hp, maxHp: d.hp,
        // 龙巢敌人扩展标记（心/轮换免疫/阶段/复活/庇护/消耗手牌等）原样透传
        heartsMode: d.heartsMode || undefined, hearts: d.hearts || undefined, rotateImmune: d.rotateImmune || undefined,
        evenAttack: d.evenAttack || undefined, noFirstAttack: d.noFirstAttack || undefined,
        handConsume: d.handConsume || undefined, phases: d.phases || undefined,
        revive: d.revive || undefined, revived: undefined, protects: d.protects || undefined,
        protected: d.protected || undefined, reviveTurn: undefined,
        atk: d.atk || 2, affix: d.affix || null, affixName: d.affixName || null, behavior: d.behavior || null, dead: false,
        status: {}, defense: { shield: 0, armor: 0, guard: false },
      };
      f.intent = intentFor(f, 1);
      Combat.ensureStatus(f);
      return f;
    }));
    set$interaction(null);
    SDT.Sound.music('battle');   // 切入战斗氛围
    G.state = 'modal';
    const names = foes.map(f => `${f.name}(${f.atk}-${f.hp})`).join('、');
    G.log(`[[icon:swords]] <b>${opts.isBoss ? 'BOSS战' : '遭遇战'}【${esc(names)}】</b>${!opts.isBoss && opts.risk ? ` · 风险<b>${esc(opts.risk)}</b>` : ''}`, 'warn');
    if (mode === 'boss') {
    if (opts.nest) {
      // 龙巢（2026-09-18 留言「牌盒即牌库」）：跳过编组，卡盒全部卡牌直接成库
      set$selPool(G.ownedCards.filter(o => !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isStarterAttack(o.card)));
      set$selShaN(0);
      set$sel(new Set(selPool.map(o => o.uid)));
      beginBoss();
    } else prepareDeckSelection();
  }
    else beginNormal();
  }

  function beginNormal() {
    clearBattlePiles();
    // 道具/资源/事件/生物卡默认不进手牌（v0.32：手牌只放可直接打出的战斗卡）；
    // 「对战开始时」装备（Q1 老板定向：持有即自动生效）不进手牌、改为开战被动
    // 普通战无法使用能力卡（2026-09-16 老板定版）：能力卡与道具/资源/事件/生物一样不进普通战手牌
    set$hand(G.ownedCards.filter(o => !['道具', '资源', '事件', '生物', '能力卡'].includes(o.card.type) && !isBattleStartEquip(o.card)).map(o => o.uid));
    resetBattleEntryState();
    set$battleState(transitionBattle(battleState, BATTLE_PHASES.PLAYER));
    G.state = 'modal';
    applyBattleStartPassives();
    // 普通战无法使用能力卡（2026-09-16 老板定版）：能力卡不进普通战手牌（对 BOSS 编组不受限）
    if (alive().length > 1) G.log('[[icon:question]] 以一敌多：伤害与群体卡都<b>拖到任意敌人身上</b>打出（群体自动命中全体）', 'sys');
    G.log(`[[icon:cards]] 普通战斗无需抽牌：随身 <b>${hand.length}</b> 张战斗卡直接可打出；道具/资源/事件卡不入手，能力卡只能收藏或编入 BOSS 战牌库 · 每回合固定 <b>${maxEnergy}</b> 费`, 'sys');
    requestBattleRender();
  }

  // 两种战斗入口共用的运行态重置；牌区与模式专属开战步骤留在各自入口。
  function resetBattleEntryState() {
    set$maxEnergy(R().battleEnergy);
    set$energy(maxEnergy);
    set$turn(1); set$busy(false);
    set$pdef({ shield: 0, armor: 0, guard: false });
    set$pstat(Combat.ensureStatus({ hp: G.hp }));
    set$infusing(null); set$discovering(null); set$discoverQueue([]); set$handSelecting(null); handSelectQueue.length = 0; set$interaction(null); resetBattlePresentation();
    set$choosing(null); choiceQueue.length = 0; set$stealthStrike(false); set$nextSpellTwice(0);
    resetPilesCarryover(); set$spellCost1(false); set$meleeCost1(false);
    set$shaTransform(null); set$consumeFireballN(0); set$lastPlayedType(null);
    set$viewingGrave(false); set$viewingDeck(false); set$selectingDeck(false); set$viewingBag(false);
    resetBattleExtras();
    set$pendingHint('');
  }

  // —— 新增战斗规则变量统一清零（begin/beginBoss/finish 共用）——
  function resetBattleExtras() {
    set$allies([]); set$growthNames(new Set()); set$growth({});
    set$infuseFuels(0); set$sealUnlocked(false); set$extraTurn(false); set$deathSave(0);
    set$killAtkUp(0); set$poisonOnSpell(false); set$poisonLegacy(false); resetCastOverrides();
    set$sealDone(false); set$playerCurseImmune(false); set$allSpellsInfused(false);
    set$nestRunes([]); set$nestSyn({}); set$timeRune(false); set$arrowRune(false); set$unyieldRune(false);
    set$ashRune(false); set$unlimitedRune(false); set$holyRune(false); set$fireballRuneOn(false); set$freezeRuneOn(false);
    set$swiftRune(false); set$timeSpaceRune(false); set$timeSpaceUsed(false); set$armorMul(1);
    set$interaction(null);
    set$freeCast(new Set());
    set$equipped([]);
    set$playedMartialThisTurn(0);   // 追斩计数跨战不残留
    set$playedMovesThisTurn(0);     // 连续射击计数跨战不残留
  }

  // ---------- BOSS战：编组牌库 ----------
  // 2026-09-09 玩法定版：必选 15 张（招式/装备/能力卡）起步；混沌之眼编入后牌库上限 +5（上限 20）。
  function prepareDeckSelection() {
    set$selDeckMax(R().bossDeckSize + deckCapBonus());   // 混沌之眼「牌库上限+5」（编入后才计入）
    // 2026-09-16 老板定版：骷髅王剑/混沌之眼等「对战开始时」装备计入 15 张套牌（不再独立勾选）
    set$selPool(G.ownedCards.filter(o => !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isStarterAttack(o.card)));
    const shas = G.ownedCards.filter(o => isStarterAttack(o.card));
    set$selShaN(Math.min(shas.length, R().starterSha));
    set$sel(new Set(lastDeckSel.filter(uid => selPool.some(entry => entry.uid === uid))));
    const cap = Math.min(selDeckMax, selPool.length);
    while (sel.size > cap) sel.delete(sel.values().next().value);
    set$selectingDeck(true);
    requestBattleRender();
  }

  function toggleDeckCard(uid) {
    if (!selectingDeck || !selPool.some(entry => entry.uid === uid)) return;
    if (!sel.has(uid) && sel.size >= selDeckMax) return;   // 混沌之眼上限之外不可再编入
    if (sel.has(uid)) sel.delete(uid); else sel.add(uid);
    requestBattleRender();
  }

  function cancelDeckSelection() {
    if (!selectingDeck) return;
    G.log('[[icon:runner]] 你放下了挑战，首脑仍在污染核心深处盘踞', 'sys');
    finish(null);
  }

  function beginBoss() {
    // 2026-09-10 留言 #34：背包可编卡牌不足 15 张时按实际可编数放行（视图侧同口径），
    // 否则「开始战斗」按钮永远灰着、点击也无任何反应
    if (sel.size < Math.min(R().bossDeckSize, selPool.length)) return;
    const shas = G.ownedCards.filter(o => isStarterAttack(o.card)).slice(0, R().starterSha).map(o => o.uid);
    set$lastDeckSel([...sel]);
    if (battleRestartCheckpoint) battleRestartCheckpoint.selectedDeck = [...sel];
    set$selectingDeck(false);
    clearBattlePiles();
    set$drawPile(shuffle([...sel].concat(shas)));   // 骷髅王剑/混沌之眼等对战开始时装备已在 sel 内
    set$hand([]);
    resetBattleEntryState();
    set$battleState(transitionBattle(battleState, BATTLE_PHASES.PLAYER));
    G.state = 'modal';
    G.log(opts.nest
      ? `[[icon:cards]] <b>牌盒即牌库</b>：${drawPile.length} 张 · 开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${maxEnergy}</b> 费`
      : `[[icon:cards]] 牌库编成：自选 ${sel.size} 张非道具卡 + 初始攻击 ×${shas.length} = <b>${drawPile.length}</b> 张 ·
      开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${maxEnergy}</b> 费`, 'sys');
    injectSealCards();   // 受缚之残影：编组带着才发动——4 张封印肢体洗入牌库（本牌已随编组在库），开局抽牌前洗入
    applyNestRunes();    // 龙巢符文：羁绊与符文效果开战结算
    drawCards(R().battleStartDraw);
    applyVoidRune();     // 虚空符文：开局抽牌后复制 0 费招式
    // 龙巢：黑暗元素每回合开始切换 2 种免疫诅咒（对全体系诅咒生效，冰冻除外）
    COMBAT_HOOKS.onFreeze = (target) => {
      if (freezeRuneOn && target !== pstat) { const g = drawCards(2); G.log('[[icon:gem]] <b>冰冻符文</b>：冰冻 1 名角色，抽 ' + g + ' 张牌', 'ok'); }
    };
    applyBattleStartPassives();   // Q1：迷之匣替换/灵符抽牌/骷髅王剑/混沌之眼（持有即生效）
    requestBattleRender();
  }

  return {
    flee, restore, finish, start, toggleDeckCard, cancelDeckSelection, beginBoss,
    prepareDeckSelection, deckCapBonus,
  };
}
