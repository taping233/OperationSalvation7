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
import { game, curLayer, bagCap } from '../run/game.session.js';
import { collectUiActions, collectActionKeys, overlayBody, overlayVisible } from './agent.surface.js';
import { actionId } from './agent.protocol.js';

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
  import('../battle/battle.core.js')
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
      need: snap.deckSelection.need,
      selected: [...(snap.deckSelection.selected || [])],
      cards: (snap.deckSelection.cards || []).map(e => ({ uid: e.uid, name: e.card?.name || '', rarity: e.card?.rarity || '', type: e.card?.type || '' })),
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
    if ((snap.deckSelection.selected || []).length >= snap.deckSelection.need) push('confirmDeck', []);
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
  // 背包砸击：2 费 4 固定伤不吃手牌——手牌卡手时的硬通货
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
  for (const [li, idx] of current?.next || []) {
    const def = game.layerData?.[li]?.logical?.[idx]?.def;
    acts.push(withId({
      type: 'move', li, idx,
      visited: !!game.visited?.[`${li},${idx}`],
      label: `${def?.name || def?.type || '节点'}（${def?.type || '?'}）`,
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
  const owned = game.ownedCards || [];
  if (owned.length < bagCap()) return [];
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
    nodeVisited: !!game.visited?.[`${game.layerIdx},${game.trackPos}`],   // 脚下格是否已结算（死循环检测用）
    inventory: (game.inventory || []).map(i => ({ name: i.name, count: i.count, value: i.value ?? null })),
    ownedCards: (game.ownedCards || []).map(o => ({
      uid: o.uid, name: o.card?.name || '', type: o.card?.type || '',
      rarity: o.card?.rarity || '', safe: !!o.safe,
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
  const phase = phaseOf();
  if (game.battleActive) warmBattleLookups();
  const snap = game.battleActive && window.SDT?.Battle?.getSnapshot ? window.SDT.Battle.getSnapshot() : null;
  const uiActions = collectUiActions();
  const moveActions = phase === 'map' ? mapActions() : [];
  const fightActions = phase === 'battle' ? battleActions(snap) : [];
  const bagDrops = bagActions();
  const sysActions = phase === 'title' ? [withId({ type: 'sys', name: 'startGame', label: '开始探索' })] : [];
  const actions = [
    ...uiActions.map(withId),
    ...moveActions,
    ...fightActions,
    ...bagDrops,
    ...sysActions,
  ];
  return {
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
}

// settle 签名：runner 用它做「静止期」判定（连续两次不变才算稳）与动作面变化检测。
// 动作键（name+params）进签名：按钮集一变即视为推进，防止在淡出/转场窗口里重复点同一钮。
function settleSignature() {
  const snap = game.battleActive && window.SDT?.Battle?.getSnapshot ? window.SDT.Battle.getSnapshot() : null;
  return JSON.stringify([
    game.state, game.battleActive, !!game.terminalPending, !!game.pendingExtraction,
    game.turn, snap ? [snap.busy, snap.actionQueueLength, snap.phase, snap.hand.length, snap.foes.map(f => f.hp)] : null,
    overlayVisible(),
    collectActionKeys(),   // 轻量键扫描（无 label/textContent）——settle 轮询性能关键
  ]);
}

export { observe, settleSignature, phaseOf, battleActions, mapActions, markUiFailure };
