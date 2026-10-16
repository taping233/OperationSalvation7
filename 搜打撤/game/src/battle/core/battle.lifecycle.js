/* battle.lifecycle.js —— 战斗入口/编组与终局收尾（自 battle.engine.js 拆出）。
 * start/编组/restore 进场，finish/flee 收尾；规则数据经 battle.runtime.js 活绑定直读，
 * 规则核结算件由 createBattleLifecycle 注入（解回合循环互递归的强连通簇）。 */
const SDT = window.SDT;
import { esc } from '../../core/shared.js';
import { Random } from '../../core/random.js';
import * as Combat from './combat.js';
import { COMBAT_HOOKS } from './combat.js';
import { emit as busEmit } from '../../core/event-bus.js';
import { presentBattleDefeat } from './battle.presentation.js';
import { clearFeedback } from '../view/battle.feedback.js';
import { shuffleCards } from '../bag/battle.deck.js';
import { BATTLE_PHASES, createBattleState, transitionBattle } from '../runtime/battle.state.js';
import { getHostedExecutionCard } from '../effects/battle.hosted.js';
import { resetBattleSummary, readBattleSummary } from './battle.summary.js';
import {
  battleState, G, foes, opts, mode, drawPile, hand, played, consumed, granted, maxEnergy, pstat, turn,
  busy, infusing, discovering, discoverQueue, choosing, selPool, sel, lastDeckSel,
  selectingDeck, selDeckMax, freezeRuneOn, equipped, battleRestartCheckpoint,
  restoringRestartCheckpoint, set$G, set$opts, set$foes,
  set$mode, set$hand, set$drawPile,
  set$allies,
  set$discoverQueue, set$interaction, set$pendingHint, set$selectingDeck, set$sel, set$selPool,
  set$selShaN, set$busy, set$battleState, set$battleRestartCheckpoint,
  set$restoringRestartCheckpoint,
  set$freeCast, set$equipped,
  set$selDeckMax, set$lastDeckSel,
  clearBattlePresentation, resetBattlePresentation, showDread, hideDread, clearBattlePiles,
  restoreBattlePiles, restorePilesBookkeeping, resetPilesCarryover, resetCastOverrides,
  clearBattlePopups, closeBattleViews, restoreEffectState, restoreEffectRules, resetCostFlags,
  resetBattleEffectFlags,
  transitionTo, clearActionSignals, restoreBattleSession, restoreBattleCombatants,
  resetBattlePlayerState,
} from '../runtime/battle.runtime.js';

const shuffle = shuffleCards;

export function createBattleLifecycle({
  session, intentFor, cloneData, injectSealCards, applyNestRunes, applyVoidRune, drawCards,
  applyBattleStartPassives, isBattleStartEquip, isStarterAttack, requestBattleRender, alive, R,
  resetTriggers, runBattleStartTriggers, triggersM2,
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
    // 撤退音由 finish(null) 统一播（win===false→'flee'），此处不再预播免得双声
    G.log('[[icon:runner]] 你撤出了战斗（打出过的卡照常结算）', 'sys');
    finish(null);
  }

  function restore(nextGame, data) {
    if (data && data.restartVersion === 1 && Array.isArray(data.enemyDefs) && data.opts) {
      session.reset('battle restarted from checkpoint');
      clearActionSignals();
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
    resetBattleSummary();
    if (!data.deckSelect && (!Array.isArray(data.foes) || !data.foes.length)) return false;
    if (!Array.isArray(data.foes)) data.foes = [];
    session.reset('battle restored');
    clearActionSignals();
    clearFeedback();
    restoreBattleSession(nextGame, data, R().battleEnergy);
    restoreBattlePiles(data);
    restoreBattleCombatants(data, intentFor);
    restorePilesBookkeeping(data);
    restoreEffectState(data);
    // —— 2026-09-09 机制审计补实装：新战斗规则变量恢复 ——
    set$allies((data.allies || []).map(a => ({ ...a, status: { ...(a.status || {}) }, defense: { shield: 0, armor: 0, guard: false, ...(a.defense || {}) } })));
    restoreEffectRules(data);
    discoverQueue.length = 0;
    clearBattlePopups(); set$pendingHint(''); resetBattlePresentation();
    closeBattleViews();
    set$sel(new Set()); set$selPool([]); set$selShaN(0);
    set$busy(false);
    G.battleActive = true;
    G.state = 'modal';
    if (SDT.Sound) SDT.Sound.setDucked(true);
    SDT.Sound.setBoss?.(!!data.opts.isBoss, foes[0]?.id || '');   // 读档恢复：紧张垫按存档战斗类型同步（音频 P2#12；旧格式普通战不再误抬垫）
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
    if (!G?.battleActive) return;
    session.abort();
    clearActionSignals();
    if (win === true && battleState.phase !== BATTLE_PHASES.VICTORY) transitionTo(BATTLE_PHASES.VICTORY);
    if (SDT.Meta && SDT.Meta.track) SDT.Meta.track('battleEquips', { n: equipped.length });
    if (win === false && battleState.phase !== BATTLE_PHASES.DEFEAT) transitionTo(BATTLE_PHASES.DEFEAT);
    clearFeedback();
    set$busy(false);
    SDT.Sound.sfx(win === true ? (opts.isBoss ? 'bossVictory' : 'victory') : win === false ? 'defeat' : 'flee');
    const playedCopy = played.slice();
    const consumedCopy = consumed.slice();
    const spentUids = new Set([...playedCopy, ...consumedCopy]);
    opts.spentCards = granted.filter(entry => spentUids.has(entry.uid))
      .map(entry => ({ uid: entry.uid, card: { ...entry.card } }));
    clearBattlePiles(); set$hand([]);
    clearBattlePresentation();
    set$sel(new Set());
    set$discoverQueue([]); clearBattlePopups();
    handSelectQueue.length = 0;
    choiceQueue.length = 0; resetCostFlags();
    resetPilesCarryover();
    closeBattleViews(); hideDread();
    resetBattleExtras();
    G.state = 'idle';
    G.battleActive = false;
    if (SDT.Sound) SDT.Sound.setDucked(false);   // 战斗结束恢复 BGM 音量
    if (SDT.Sound) SDT.Sound.setBoss?.(false);   // BOSS 紧张垫解除（音频 P2#12）
    opts.foeNames = foes.map(f => f.name);
    opts.battleSummary = readBattleSummary(turn, foes);
    // 先记账再通知结算/保存；隔离样本不进入玩家的本局战斗记录。
    if (!opts.devSample) SDT.Agent?.recorder?.noteBattle?.(win, {
      li: G.layerIdx, node: G.trackPos, foe: opts.foeNames?.join('+') || '', hp: G.hp, turn: G.turn,
      round: turn,
      mode: win === true ? 'win' : win === false ? 'lose' : 'flee',
      nPlayed: playedCopy.length,
      nUsed: consumedCopy.length,
      deck: opts.isBoss ? lastDeckSel.map(uid => G.ownedCards?.find(o => o.uid === uid)?.card?.name || uid) : null,
    });
    SDT.Sound.music('board');   // 战斗结束切回行军氛围
    // 战斗结束广播（2026-09-11 批次 5）：订阅方各自响应（背包结算/基地/统计），
    // 战斗核心不再直接依赖 game.onBattleEnd 的实现；无人订阅时回退旧回调（审计 harness 兼容）
    const endedGame = G, endedOpts = opts;
    const notifyEnd = () => {
      if (G !== endedGame || opts !== endedOpts || endedGame.battleActive) return;
      if (!busEmit('battle:end', endedOpts, playedCopy, win, consumedCopy) && typeof endedGame.onBattleEnd === 'function') {
        endedGame.onBattleEnd(endedOpts, playedCopy, win, consumedCopy);
      }
    };
    // 逻辑死亡和中止仍立即完成；仅在实页有倒地演出时推迟结算页通知。
    const presentation = win === false ? presentBattleDefeat({ hp: endedGame.hp, maxHp: endedGame.maxHp }) : null;
    if (presentation) presentation.then(notifyEnd, notifyEnd);
    else notifyEnd();
    set$battleRestartCheckpoint(null);
  }

  // 混沌之眼「牌库上限 +N」：BOSS 编组可带张数加成（2026-09-10 #35 起按「编组勾选」计算）
  function deckCapBonus(uids) {
    let bonus = 0;
    (G.ownedCards || []).forEach(o => {
      const card = getHostedExecutionCard(o.card);
      if (!card || !isBattleStartEquip(card) || !(uids || sel).has(o.uid)) return;
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
    clearActionSignals();
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
    if (SDT.Sound) SDT.Sound.setBoss?.(opts.isBoss, defs[0]?.id || '');   // BOSS 战抬升紧张垫（音频 P2#12）
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
    SDT.Sound.sfx(opts.isBoss ? 'bossReveal' : 'battleEnter');
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
    } else if (opts.directBossStart) prepareAutomaticBossDeck();
    else prepareDeckSelection();
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
    transitionTo(BATTLE_PHASES.PLAYER);
    G.state = 'modal';
    if (resetTriggers) resetTriggers();
    applyBattleStartPassives();
    if (runBattleStartTriggers) runBattleStartTriggers();   // M2：结构化 onBattleStart（能力卡/迎装规则）
    // 普通战无法使用能力卡（2026-09-16 老板定版）：能力卡不进普通战手牌（对 BOSS 编组不受限）
    if (alive().length > 1) G.log('[[icon:question]] 以一敌多：伤害与群体卡都<b>拖到任意敌人身上</b>打出（群体自动命中全体）', 'sys');
    G.log(`[[icon:cards]] 普通战斗无需抽牌：随身 <b>${hand.length}</b> 张战斗卡直接可打出；道具/资源/事件卡不入手，能力卡只能收藏或编入 BOSS 战牌库 · 每回合固定 <b>${maxEnergy}</b> 费`, 'sys');
    requestBattleRender();
  }

  // 两种战斗入口共用的运行态重置；牌区与模式专属开战步骤留在各自入口。
  function resetBattleEntryState() {
    resetBattlePlayerState(R().battleEnergy);
    set$discoverQueue([]); clearBattlePopups(); resetBattlePresentation();
    handSelectQueue.length = 0; choiceQueue.length = 0; resetCostFlags();
    resetPilesCarryover();
    closeBattleViews();
    resetBattleExtras();
    set$pendingHint('');
  }

  // —— 新增战斗规则变量统一清零（begin/beginBoss/finish 共用）——
  function resetBattleExtras() {
    set$allies([]);
    resetBattleEffectFlags();   // effects 属地旗标+符文旗整组清零（治理批次 4a 收敛）
    resetCastOverrides();
    set$interaction(null);
    set$freeCast(new Set());
    set$equipped([]);
  }

  // ---------- BOSS战：编组牌库 ----------
  // 地图首脑直入：沿用有效旧编组，按背包顺序补齐，保持既有卡类与容量规则。
  function prepareAutomaticBossDeck() {
    set$selPool(G.ownedCards.filter(o => !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isStarterAttack(o.card)));
    set$selShaN(R().starterSha);
    set$sel(new Set(lastDeckSel.filter(uid => selPool.some(entry => entry.uid === uid))));
    const capacity = () => Math.min(selPool.length, R().bossDeckSize + deckCapBonus(sel));
    while (sel.size > capacity()) sel.delete(sel.values().next().value);
    for (const entry of selPool) {
      if (sel.size >= capacity()) break;
      sel.add(entry.uid);
    }
    set$selDeckMax(R().bossDeckSize + deckCapBonus(sel));
    beginBoss();
  }

  // 2026-09-09 玩法定版：必选 15 张（招式/装备/能力卡）起步；混沌之眼编入后牌库上限 +5（上限 20）。
  function prepareDeckSelection() {
    set$selDeckMax(R().bossDeckSize + deckCapBonus());   // 混沌之眼「牌库上限+5」（编入后才计入）
    // 2026-09-16 老板定版：骷髅王剑/混沌之眼等「对战开始时」装备计入 15 张套牌（不再独立勾选）
    set$selPool(G.ownedCards.filter(o => !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isStarterAttack(o.card)));
    set$selShaN(R().starterSha);
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
    // 首脑入口保证固定初始攻击数；缺少的补为战斗临时牌，用过后也进入消耗区。
    while (!opts.nest && shas.length < R().starterSha) {
      const uid = `boss-sha-${battleState.token}-${shas.length}`;
      granted.push({ uid, card: { ...SDT.Cards.SHA } });
      shas.push(uid);
    }
    set$drawPile(shuffle([...sel].concat(shas)));   // 骷髅王剑/混沌之眼等对战开始时装备已在 sel 内
    set$hand([]);
    resetBattleEntryState();
    transitionTo(BATTLE_PHASES.PLAYER);
    G.state = 'modal';
    if (resetTriggers) resetTriggers();   // 与 beginNormal 对齐：上一场战斗的 M2 触发登记不得跨战斗泄漏
    G.log(opts.nest
      ? `[[icon:cards]] <b>牌盒即牌库</b>：${drawPile.length} 张 · 开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${maxEnergy}</b> 费`
      : `[[icon:cards]] 牌库编成：${opts.directBossStart ? '自动编入' : '自选'} ${sel.size} 张非道具卡 + 初始攻击 ×${shas.length} = <b>${drawPile.length}</b> 张 ·
      开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${maxEnergy}</b> 费`, 'sys');
    injectSealCards();   // 受缚之残影：编组带着才发动——4 张封印肢体洗入牌库（本牌已随编组在库），开局抽牌前洗入
    applyNestRunes();    // 龙巢符文：羁绊与符文效果开战结算
    drawCards(R().battleStartDraw);
    applyVoidRune();     // 虚空符文：开局抽牌后复制 0 费招式
    // 龙巢：黑暗元素每回合开始切换 2 种免疫诅咒（对全体系诅咒生效，冰冻除外）。
    // 冰冻符文与 M2 onFreezeDealt 触发合并挂载——此前整句覆写会把 engine 模块级挂的
    // M2 转发挤掉，首次 BOSS 战起冰冻触发器（如双水之甲）在 BOSS 及之后所有战斗失效。
    COMBAT_HOOKS.onFreeze = (target) => {
      if (triggersM2) triggersM2.fireFreezeDealt(target);
      if (freezeRuneOn && target !== pstat) { const g = drawCards(2); G.log('[[icon:gem]] <b>冰冻符文</b>：冰冻 1 名角色，抽 ' + g + ' 张牌', 'ok'); }
    };
    applyBattleStartPassives();   // Q1：迷之匣替换/灵符抽牌/骷髅王剑/混沌之眼（持有即生效）
    if (runBattleStartTriggers) runBattleStartTriggers();   // M2：结构化 onBattleStart（能力卡/迎装规则）
    requestBattleRender();
  }

  return {
    flee, restore, finish, start, toggleDeckCard, cancelDeckSelection, beginBoss,
    prepareDeckSelection, deckCapBonus,
  };
}
