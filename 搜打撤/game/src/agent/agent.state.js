/* ============================================================
 * agent.state.js —— observe()：把当前局面组装成结构化 JSON
 *
 * 信息来源全部是接口层（不读画面）：
 *   - run/game.session 的 game 会话单例（角色/资源/位置/手牌持有）
 *   - SDT.Battle.getSnapshot() 战斗只读快照（手牌 uid / 敌人 / 待选态）
 *   - agent.surface 的弹层动作面扫描（data-act 按钮清单）
 *   - 地图相邻节点（curLayer().logical[trackPos].next）
 * 输出 JSON 可直接喂 LLM / 外部脚本；每条动作带稳定 id（见 agent.protocol）。
 * ============================================================ */
import { game, curLayer, bagCap, usedSlots } from '../run/game.session.js';
import { entrySupplyGate } from '../run/node-reward-state.js';
import { collectUiActions, collectActionKeys, overlayBody, overlayVisible } from './agent.surface.js';
import { actionId } from './agent.protocol.js';
import { getBattleCount } from './agent.recorder.js';

const withId = (action) => ({ ...action, id: actionId(action) });

// ---------- 阶段判定（settle 稳定性与驱动范围都看这里） ----------
function phaseOf() {
  if (game.terminalPending) return 'settlement';
  if (game.pendingExtraction) return 'extraction';
  if (game.battleActive) return 'battle';
  if (game.nestActive) return 'nest';
  const body = overlayBody();
  if (body?.querySelector?.('#hubMain')) return 'hub';
  if (body?.querySelector?.('#exMain')) return 'extraction';
  if (body?.querySelector?.('#devcSearch')) return 'devconsole';
  if (game.state === 'title') return 'title';
  if (overlayVisible()) return 'overlay';
  if (game.state === 'moving') return 'moving';
  if (game.runActive) return 'map';
  return game.state === 'boot' ? 'boot' : 'idle';
}

// ---------- 战斗投影（快照 → 可决策精简视图） ----------
const briefDesc = (desc) => {
  const text = String(desc || '').replace(/\s+/g, ' ').trim();
  return text.length > 80 ? text.slice(0, 79) + '…' : text;
};

// 局内授予卡（战斗中发放）不在 game.ownedCards 里；经 battle.core 导出的 findCard 解析。
// 动态导入保持战斗域按需加载边界：战斗开始后预热一次，首个观察周期可能仍缺详情。
let battleFindCard = null;
function warmBattleLookups() {
  if (battleFindCard) return;
  import('../battle/core/battle.core.js')
    .then(m => { battleFindCard = m.findCard; })
    .catch(() => { /* 战斗未就绪：下一观察周期再试 */ });
}

function cardBrief(uid) {
  const entry = game.ownedCards?.find(o => o.uid === uid) || battleFindCard?.(uid) || null;
  const card = entry?.card;
  if (!card) return { uid, name: '（局内授予卡）', cost: null, type: null, desc: '' };
  return {
    uid,
    name: card.name,
    cost: card.cost ?? null,
    type: card.type || null,
    rarity: card.rarity || '',
    dmg: card.dmg ?? null,
    desc: briefDesc(card.desc),
  };
}

function battleView(snap) {
  if (!snap) return null;
  return {
    turn: snap.turn,
    energy: snap.energy,
    maxEnergy: snap.maxEnergy,
    busy: !!snap.busy,
    phase: snap.phase,
    player: {
      hp: snap.player?.hp ?? null,
      maxHp: snap.player?.maxHp ?? null,
      atk: snap.player?.atk ?? null,
      armor: snap.pdef?.armor ?? 0,
      status: snap.pstat?.status || {},
    },
    foes: snap.foes.map((f, i) => ({
      i, id: f.id, name: f.name,
      hp: f.hp, maxHp: f.maxHp ?? null, atk: f.atk ?? null,
      intent: f.intent || null, status: f.status || {}, dead: !!f.dead,
    })),
    hand: snap.hand.map(cardBrief),
    piles: { draw: snap.drawPile.length, discard: snap.discard.length, grave: snap.grave.length },
    pendingTarget: snap.pendingTarget ? { uid: snap.pendingTarget.uid, name: snap.pendingTarget.card?.name || '' } : null,
    choosing: snap.choosing ? { options: (snap.choosing.options || []).map((o, i) => ({ i, label: typeof o === 'string' ? o : (o.label || o.name || JSON.stringify(o)).slice(0, 60) })) } : null,
    discovering: snap.discovering ? { options: (snap.discovering.options || []).map((c, i) => ({ i, name: c.name || '', rarity: c.rarity || '', cost: c.cost ?? null, desc: briefDesc(c.desc) })) } : null,
    handSelecting: snap.handSelecting ? {
      need: snap.handSelecting.n ?? snap.handSelecting.need ?? null,
      mandatory: !!snap.handSelecting.mandatory,
      type: snap.handSelecting.type || snap.handSelecting.act || null,
    } : null,
    infusing: snap.infusing ? { uid: snap.infusing.uid, name: snap.infusing.card?.name || '', picked: [...(snap.infusing.picked || [])] } : null,
    deckSelection: snap.deckSelection ? {
      // need 投影即放行口径 min(need, cards.length)——与 battleActions/引擎一致，
      // 策略第一分支 selected>=need 判定不再拿原始 15 卡死
      need: Math.min(snap.deckSelection.need, (snap.deckSelection.cards || []).length),
      selected: [...(snap.deckSelection.selected || [])],
      boss: snap.deckSelection.boss ? { name: snap.deckSelection.boss.name || '', atk: snap.deckSelection.boss.atk ?? null, maxHp: snap.deckSelection.boss.maxHp ?? null } : null,
      cards: (snap.deckSelection.cards || []).map(e => ({ uid: e.uid, name: e.card?.name || '', rarity: e.card?.rarity || '', type: e.card?.type || '', desc: e.card?.desc || '', dmg: e.card?.dmg ?? null })),
    } : null,
    potions: (snap.potionBar || []).map(p => ({ uid: p.uid, name: p.name || '', count: p.count ?? 1 })),
    // 装备：uid/主动技能状态（passive=纯被动，used=本回合已用）——主动技能 useEquipSkill(uid)
    equipped: (snap.equipped || []).map(e => ({
      uid: e?.uid || '', name: e?.card?.name || e?.name || '',
      used: !!e?.used, passive: !!e?.passive,
    })),
    // 背包战斗道具（useItem 要 uid——与药水分开：potions=potionBar 快速栏）
    ownItems: (game.ownedCards || [])
      .filter(o => o.card && o.card.type === '道具' && !o.safe)
      .map(o => ({ uid: o.uid, name: o.card.name || '', desc: briefDesc(o.card.desc) })),
    // 目标/挂起态：砸击、血毒双镖第二镖、道具选目标——不回填动作会卡死
    slamPending: !!snap.slamPending,
    dartPending: !!snap.dartPending,
    pendingItem: snap.pendingItem ? { uid: snap.pendingItem.uid || '', name: snap.pendingItem.card?.name || '' } : null,
  };
}

// ---------- 战斗动作面：由快照待选态推导此刻可执行的命令 ----------
function battleActions(snap) {
  const acts = [];
  if (!snap || snap.busy) return acts;
  const push = (name, args) => acts.push(withId({ type: 'battle', name, args }));
  if (snap.deckSelection) {
    for (const e of snap.deckSelection.cards) {
      if (!snap.deckSelection.selected.includes(e.uid)) push('selectDeckCard', [e.uid]);
    }
    // confirm 门槛与引擎放行同口径（beginBoss：sel.size >= min(bossDeckSize, selPool.length)，
    // 视图 bossGo 同款）——可编卡不足 need 时全选后必须给 confirm，否则动作面只剩
    // cancelDeck，策略回 null 被判 decide-null 弃局（09-26 trace-76 实录）
    const need = Math.min(snap.deckSelection.need, (snap.deckSelection.cards || []).length);
    if ((snap.deckSelection.selected || []).length >= need) push('confirmDeck', []);
    if ((snap.deckSelection.selected || []).length > 0) push('cancelDeck', []);
    return acts;
  }
  if (snap.infusing) {
    // 「不注能直接打出」是注能态的正出口（playDirect = 退出注能并结算）；
    // 只留 confirm/cancel 会让驱动在注能条里打转。
    push('playDirect', [snap.infusing.uid]);
    push('confirmInfusion', []);
    push('cancelInfusion', []);
    return acts;
  }
  if (snap.discovering) {
    (snap.discovering.options || []).forEach((_, i) => push('pickDiscover', [i]));
    return acts;
  }
  if (snap.handSelecting) {
    (snap.handSelecting.cards || snap.hand || []).forEach(uid => push('pickHandSelect', [uid]));
    push('skipHandSelect', []);
    return acts;
  }
  if (snap.choosing) {
    (snap.choosing.options || []).forEach((_, i) => push('pickChoice', [i]));
    return acts;
  }
  if (snap.pendingTarget) {
    const uid = snap.pendingTarget.uid;
    snap.foes.forEach((f, i) => { if (!f.dead) push('playCard', [uid, i]); });
    push('playCard', [uid, 'self']);
    push('cancelPendingTarget', []);
    return acts;
  }
  // 挂起态回填（不给出口会卡死在选目标页）：砸击 / 血毒双镖第二镖 / 道具选目标
  if (snap.slamPending) {
    snap.foes.forEach((f, i) => { if (!f.dead) push('resolveSlam', [i]); });
    push('cancelInteraction', []);
    return acts;
  }
  if (snap.dartPending) {
    snap.foes.forEach((f, i) => { if (!f.dead) push('resolveDart', [i]); });
    push('cancelInteraction', []);
    return acts;
  }
  if (snap.pendingItem) {
    snap.foes.forEach((f, i) => { if (!f.dead) push('useItem', [snap.pendingItem.uid, i]); });
    push('useItem', [snap.pendingItem.uid, 'self']);
    push('cancelInteraction', []);
    return acts;
  }
  for (const uid of snap.hand) {
    push('playCard', [uid]);
    snap.foes.forEach((f, i) => { if (!f.dead) push('playCard', [uid, i]); });
    push('playDirect', [uid]);
  }
  push('endTurn', []);
  push('openBag', []);
  push('flee', []);
  // 背包技能：按职业 1-2 费（2026-10-02 老板五职业分化）不吃手牌——手牌卡手时的硬通货
  push('bagSlam', []);
  // 装备主动技能（uid 供 useEquipSkill；passive 装备无主动）
  for (const e of snap.equipped || []) {
    if (e && e.uid && !e.passive) push('useEquipSkill', [e.uid]);
  }
  // 背包战斗道具（回血药等——useItem(uid)；敌侧道具引擎会进选目标态，由 pendingItem 回填）
  for (const item of (game.ownedCards || []).filter(o => o.card && o.card.type === '道具' && !o.safe)) {
    push('useItem', [item.uid]);
  }
  for (const p of snap.potionBar || []) push('usePotion', [p.uid]);
  return acts;
}

// ---------- 地图动作面 ----------
function mapActions() {
  if (game.state !== 'idle' || overlayVisible() || game.battleActive) return [];
  const layer = curLayer();
  const current = layer?.logical?.[game.trackPos];
  const acts = [];
  // 入城补给未领完时不给出 move 动作，保留 reenter 供返回入口领取。
  if (!entrySupplyGate(game)) for (const [li, idx] of current?.next || []) {
    const cell = game.layerData?.[li]?.logical?.[idx];
    const def = cell?.def;
    // next=该候选自身的邻居（09-26 架构升级② 2步前瞻）：observe 侧一次展开，
    // 策略做 depth-2 rollout 不需要回读引擎。纯只读投影，不影响引擎状态
    const next = (cell?.next || []).map(([nli, nidx]) => {
      const ndef = game.layerData?.[nli]?.logical?.[nidx]?.def;
      return {
        li: nli, idx: nidx,
        visited: !!game.visited?.[`${nli},${nidx}`],
        label: `${ndef?.name || ndef?.type || '节点'}（${ndef?.type || '?'}）`,
      };
    });
    acts.push(withId({
      type: 'move', li, idx,
      visited: !!game.visited?.[`${li},${idx}`],
      label: `${def?.name || def?.type || '节点'}（${def?.type || '?'}）`,
      next,
    }));
  }
  acts.push(withId({ type: 'sys', name: 'reenter', label: '重开脚下节点' }));
  return acts;
}

// ---------- 背包卡管理动作面：丢弃（背包满时腾格，对接 game.discardCard） ----------
function bagActions() {
  const body = overlayBody();
  if (!body || !overlayVisible()) return [];
  // 背包页开着的信号 = 背包关闭按钮在面上（closeBag 走 surface 的 ui 动作，这里只补丢弃）
  if (!body.querySelector('[data-act="closeBag"]')) return [];
  // 满格口径对齐引擎（09-26）：usedSlots=物资+卡牌占格（同名堆叠1格、stored/safe 不占格）。
  // 旧 usedCards.length 在堆叠场景下恒偏大（实例数>格数），丢卡面会提前出现/该出现不出现
  if (usedSlots() < bagCap()) return [];
  const owned = game.ownedCards || [];
  const acts = [];
  for (const o of owned) {
    if (!o.card || o.safe || o.stored) continue;
    if (o.card.name === '初始攻击') continue;
    acts.push(withId({ type: 'sys', name: 'discardCard', args: [o.card.name], label: `丢弃【${o.card.name}】（腾背包格）` }));
  }
  return acts;
}

function runBrief() {
  if (!game.runActive && !game.battleActive && game.state === 'title') return null;
  return {
    active: !!game.runActive,
    fought: getBattleCount(),   // 本局已战场数（09-27 R17 连续作战疲劳信号）
    mode: game.mode || null,
    hp: game.hp, maxHp: game.maxHp,
    coins: game.coins, atk: game.atk,
    turn: game.turn,
    layer: game.layerIdx != null ? game.layerIdx + 1 : null,
    node: game.trackPos,
    class: game.myClass || null,
    characterId: game.characterId || null,
    bossKilled: !!game.bossKilled,
    state: game.state,
    bagCap: bagCap(),   // 背包容量（满时触发腾格/卖卡决策）
    // 满格判断统一用 used（占格数，堆叠口径）；deck=卡牌实例数（整备预算用）
    used: usedSlots(),
    deck: (game.ownedCards || []).length,
    nodeVisited: !!game.visited?.[`${game.layerIdx},${game.trackPos}`],   // 脚下格是否已结算（死循环检测用）
    inventory: (game.inventory || []).map(i => ({ name: i.name, count: i.count, value: i.value ?? null })),
    ownedCards: (game.ownedCards || []).map(o => ({
      uid: o.uid, name: o.card?.name || '', type: o.card?.type || '',
      rarity: o.card?.rarity || '', safe: !!o.safe,
      // 可否卖给商店（09-26 断链修复②）：openSell 只对可售卡有意义，
      // 普通卡进收购台是空面板——策略据此决定走卖卡还是丢卡腾格
      sellable: !!window.SDT?.Cards?.isSellable?.(o.card),
    })),
    // 仓库卡池（基地整备选卡的价值排序依据；非对局态也有，标题页除外）
    stash: (() => {
      try {
        return (window.SDT?.Base?.data?.stash || []).map(s => ({
          name: s.card?.name || '', rarity: s.card?.rarity || '', type: s.card?.type || '',
        }));
      } catch { return []; }
    })(),
  };
}

// 失败动作记忆（09-26）：act 被引擎拒绝的动作（如必选页的 closeOverlay）记下当时的
// 签名——同一页面内策略必须绕开它；页面一换（签名变）自动失效。
let uiFailure = null;
function markUiFailure(fail) {
  // 时间窗（09-26 改）：sig 比对会被页面闪变/揭晓重渲染打断导致记忆秒失效，
  // 3 秒 TTL 内同 id 一律绕开——覆盖瞬态页连点窗口，过期自动恢复可重试
  if (fail && fail.id) uiFailure = { fail, ts: Date.now() };
}

function observe() {
  const prof = globalThis.__stepProf;
  const tObs = prof ? performance.now() : 0;
  const phase = phaseOf();
  if (game.battleActive) warmBattleLookups();
  const snap = game.battleActive && window.SDT?.Battle?.getSnapshot ? window.SDT.Battle.getSnapshot() : null;
  const uiActions = collectUiActions();
  const moveActions = phase === 'map' ? mapActions() : [];
  const fightActions = phase === 'battle' ? battleActions(snap) : [];
  const bagDrops = bagActions();
  const sysActions = phase === 'title' ? [withId({ type: 'sys', name: 'startGame', label: '开始探索' })] : [];
  // 背包满开包（09-26 断链修复①）：野外唯一腾格入口。bagBtnFloat 无 data-act 且在
  // ovBody 外 surface 扫不到、showBackpack 只经 game.debug 暴露——协议补 openBackpack。
  // 只在 map 相推（overlay 期间 showBackpack 会与现页叠层）；无可丢卡（全 safe/初始牌）不推，
  // 否则开包后无 discardCard 可选会空转。phase==='map' 已蕴含 overlay 未开
  if (phase === 'map' && game.runActive && !game.battleActive) {
    const owned = game.ownedCards || [];
    const discardable = owned.some(o => o.card && !o.safe && !o.stored && o.card.name !== '初始攻击');
    // 满格=usedSlots>=cap（堆叠口径）：ownedCards.length 在多张同名时虚高，
    // 曾致 11/16 就开包丢卡（seed77023 带出价值13→0 的回归根因）
    if (usedSlots() >= bagCap() && discardable) {
      sysActions.push(withId({ type: 'sys', name: 'openBackpack', label: `背包已满（${usedSlots()}/${bagCap()} 格）· 开包丢卡腾格` }));
    }
  }
  const actions = [
    ...uiActions.map(withId),
    ...moveActions,
    ...fightActions,
    ...bagDrops,
    ...sysActions,
  ];
  const out = {
    ok: true,
    settle: phase !== 'moving' && phase !== 'boot' && !(snap && (snap.busy || snap.actionQueueLength > 0)),
    lastFailed: (uiFailure && Date.now() - uiFailure.ts < 3000) ? uiFailure.fail : null,
    phase,
    turn: game.turn ?? 0,
    run: runBrief(),
    battle: battleView(snap),
    ui: {
      open: overlayVisible(),
      title: (document.getElementById('ovTitle')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      actions: uiActions,
    },
    actions,
  };
  if (prof) { prof.obsMs += performance.now() - tObs; prof.obsCalls += 1; }
  return out;
}

// settle 签名：runner 用它做「静止期」判定（连续两次不变才算稳）与动作面变化检测。
// 动作键（name+params）进签名：按钮集一变即视为推进，防止在淡出/转场窗口里重复点同一钮。
// 1ms TTL 缓存（09-26 均耗时④）：settleSignature 单次 0.11-0.35ms——内部 getSnapshot 每调
// 一次就深走全量战斗快照签名（手牌/牌库/敌人数值逐叶子 JSON 化，profile 占 ~7%）+
// collectActionKeys 全 DOM 键扫描。轮询步进（defer ~0.1ms）下连续调用读的都是同一状态，
// 1ms 内直接回放缓存；状态传播延迟最坏 +1ms，落在 40ms 推进窗与 quiet=1ms 判定的容差内。
let sigCacheT = -1e9;
let sigCacheV = '';
// act() 改写状态后必须失效（09-26）：before 指纹刚写过缓存，轮询首查必然回放旧值——
// 同步完成的动作也要白等 TTL 过期才能看见推进
function bustSigCache() { sigCacheT = -1e9; }
function settleSignature() {
  const nowC = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (nowC - sigCacheT < 1) return sigCacheV;
  const prof = globalThis.__stepProf;
  const t = prof ? performance.now() : 0;
  const snap = game.battleActive && window.SDT?.Battle?.getSnapshot ? window.SDT.Battle.getSnapshot() : null;
  const out = JSON.stringify([
    game.state, game.battleActive, !!game.terminalPending, !!game.pendingExtraction,
    game.turn, snap ? [snap.busy, snap.actionQueueLength, snap.phase, snap.hand.length, snap.foes.map(f => f.hp)] : null,
    overlayVisible(),
    collectActionKeys(),   // 轻量键扫描（无 label/textContent）——settle 轮询性能关键
  ]);
  if (prof) { prof.sigMs += performance.now() - t; prof.sigCalls += 1; }
  sigCacheT = nowC;
  sigCacheV = out;
  return out;
}

export { observe, settleSignature, bustSigCache, phaseOf, markUiFailure };
