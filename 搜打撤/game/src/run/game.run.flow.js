/* ============================================================
 * game.run.flow.js —— 走格子主流程：移动事务、落脚结算、即时/事件节点（架构批次 4）
 *
 * 由 game.run.js 拆出。层位最高（L2）：依赖 scenes（L0）与 altar（L1），不被二者依赖。
 * ============================================================ */
import { esc, escAttr } from '../core/shared.js';
import { MAP, cellCenter, curLayer, gainCoins, game, getActiveSlot, markSeen, modeCfg, pick, saveGame, scaledEnemy, weighted } from './game.session.js';
import { _set_cardPageOpen } from '../hub/game.cardslib.js';
import { EVENT_SCENE_META } from './game.run.data.js';
import { Random } from '../core/random.js';
import { eventNarrative, lastLampNarrative } from '../home/narrative.js';
import { makeLastLampEventInstanceId } from '../home/story.last-lamp.js';
import { RunStorage } from '../hub/game.storage.js';
import { bagSlots } from '../hub/game.bag.bridge.js';
import { storyCommands } from '../home/story.commands.js';
import { setBagReturnHook } from '../hub/bag-return-hook.js';
import { captureBattleContext, startBattle } from '../battle/battle-loader.js';
import { isTurbo } from '../core/turbo.js';
import { renderScheduler } from '../core/render-scheduler.js';
import { findMapTravelPath, setMapTravelPresentation } from './map-travel-path.js';
import { createTravelMotion, createArrivalFeedback } from './map-travel-motion.js';
import { showLayerPassage } from '../ui/map-passage.js';
import { cancelLegacyChainMove, consumeCell, consumeCurrentCell, enterNode, finishInstant, grantEventCard, nodeOpt, nodeShell, openBattleCell, openChestsOnCell, openFixedRewardsOnCell, openPickupPage, openPocketRestore, openShop, preloadCellScene, resumeChestsOnCell } from './game.run.scenes.js';
import { openDoorModal, openFireRest, openAltarRitual, openBossGate, openEmergencyModal, openEntrySupply, resumeNodeRestore } from './game.run.altar.js';
import { bindNodeEvent, nodeEventAt, claimResourceReward, entrySupplyAt, entrySupplyGate, nodeActionBinding, resourceRewardAt } from './node-reward-state.js';
import { createEventCardChoiceController } from './event-card-choice.js';
import { rewardExitHTML, rewardSceneHTML } from '../ui/reward-scene-view.js';
import { createSignalPuzzleState, mountEventSignalPuzzle } from '../ui/event-signal-puzzle.js';
import { nodeChestRewardAt } from './chest-reward-save.js';
import { recodeEligibleCards } from './event-recode-candidates.js';
import { createEventDiceController } from '../ui/event-dice.js';
import { showEventRecodeResult } from '../ui/event-recode-result.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;

// 全路线共用移动时钟；穿过节点提交稳定位置与存档，终点反馈后结算原内容。
let moveSeq = 0;
let activeMove = null;
const ARRIVAL_DURATION = 100;
const moveUsesReducedMotion = () => {
  try { return localStorage.getItem('sdt-reduce-motion') === '1' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
};
export function moveTo(toLi, toIdx) {
  if (activeMove && game.state !== 'moving') activeMove.cancel?.();
  if (game.state !== 'idle' || activeMove) return false;
  if (entrySupplyGate(game)) { UI.log('[[icon:door]] 领完入城补给后才能前往其他地点', 'warn'); return false; }
  const path = findMapTravelPath(game, { li: toLi, idx: toIdx });
  if (!path?.length) return false;
  game.geometryVersion = game.geometryVersion || String(game.mapSeed) + ':' + (game.layoutVersion || 0);
  const map = game.layerData, geometry = game.geometryVersion, runActive = game.runActive;
  const route = [{ li: game.layerIdx, idx: game.trackPos }, ...path].map(n => ({ ...n, ...cellCenter(n.li, n.idx) }));
  if (route.some(n => !Number.isFinite(n.x) || !Number.isFinite(n.y))) return false;
  const seq = ++moveSeq, reduced = moveUsesReducedMotion() || isTurbo();
  const motion = createTravelMotion(route, game.cam?.zoom || 1);
  const camera = game.cam, cameraMotion = camera?.beginTravel?.();
  const presentation = { path: route, segmentIndex: 1, progress: 0, phase: 'moving' };
  setMapTravelPresentation(game, presentation);
  let committed = 0, done = false, watchdog = null, arrival = null, feedback = null;
  const clock = () => performance.now();
  const startedAt = clock();
  let previousAt = startedAt;
  const frame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame : cb => setTimeout(() => cb(clock()), 16);
  const cleanup = () => {
    if (watchdog != null) clearTimeout(watchdog);
    if (arrival != null) clearTimeout(arrival);
    feedback?.dispose();
    feedback = null;
  };
  const isCurrent = () => {
    if (done || activeMove?.seq !== seq) return false;
    const stable = route[committed];
    if (game.state === 'moving' && game.layerData === map && game.geometryVersion === geometry &&
        game.runActive === runActive && game.layerIdx === stable.li && game.trackPos === stable.idx) return true;
    done = true;
    cleanup();
    activeMove = null;
    setMapTravelPresentation(game, null);
    if (game.layerData === map && game.layerIdx === stable.li && game.trackPos === stable.idx) game.pos = { x: stable.x, y: stable.y };
    if (camera?.frameMode === 'travel') camera.frameMode = cameraMotion?.mode || 'routes';
    game.moveTarget = null;
    if (game.state === 'moving') game.state = 'idle';
    UI.refresh(game);
    renderScheduler.invalidate();
    return false;
  };
  const commitNode = () => {
    const from = route[committed], to = route[++committed];
    const current = game.layerData[from.li]?.logical[from.idx];
    if (!reduced && from.li !== to.li) showLayerPassage(game, from.li, to.li);
    game.pos = { x: to.x, y: to.y };
    game.layerIdx = to.li;
    game.trackPos = to.idx;
    markSeen(to.li, to.idx);
    if (game.explored) game.explored[to.li + ',' + to.idx] = 1;
    if (current?.def?.type === 'shop') consumeCell(from.li, from.idx);
    game.turn++;
    game.activeLayerBounds = game.layerBounds?.[to.li] || null;
    SDT.Meta.track('action');
    if (committed < path.length) {
      // Persist only a stable node, while keeping the travel transaction locked.
      game.state = 'idle';
      saveGame();
      game.state = 'moving';
      preloadCellScene(game.layerData?.[route[committed + 1].li], route[committed + 1].idx);
    }
  };
  const resolveArrival = () => {
    if (!isCurrent()) return;
    done = true;
    cleanup();
    activeMove = null;
    game.moveTarget = null;
    game.hop = 0;
    setMapTravelPresentation(game, null);
    if (path.length > 1) UI.log('[[icon:exit]] 已沿路线抵达，共经过 ' + path.length + ' 格', 'dim');
    resolveCell();
    renderScheduler.invalidate();
  };
  const finish = () => {
    if (!isCurrent() || presentation.phase === 'arrived') return;
    while (committed < path.length) commitNode();
    const target = route.at(-1);
    game.pos = { x: target.x, y: target.y };
    presentation.segmentIndex = path.length;
    presentation.progress = 1;
    presentation.phase = 'arrived';
    camera?.endTravel?.(cameraMotion, game, !reduced);
    UI.refresh(game);
    renderScheduler.invalidate();
    if (reduced) { resolveArrival(); return; }
    const arrivedAt = clock();
    feedback = createArrivalFeedback(game);
    feedback.update(0);
    const settle = now => {
      if (!isCurrent()) return;
      const progress = Math.min(1, (now - arrivedAt) / ARRIVAL_DURATION);
      feedback?.update(progress);
      renderScheduler.invalidateAnimation();
      if (progress >= 1) resolveArrival();
      else frame(settle);
    };
    arrival = setTimeout(resolveArrival, ARRIVAL_DURATION + 80);
    frame(settle);
  };
  const tick = now => {
    if (!isCurrent() || presentation.phase !== 'moving') return;
    const time = Math.max(0, Math.min(1, (now - startedAt) / motion.duration));
    const sample = motion.sample(time);
    while (committed < path.length && motion.ends[committed] <= sample.distance) commitNode();
    game.pos = sample.point;
    presentation.segmentIndex = sample.segment;
    presentation.progress = sample.progress;
    const target = route[sample.segment];
    Object.assign(game.moveTarget, { li: target.li, idx: target.idx, progress: sample.progress });
    const ahead = motion.sample(Math.min(1, time + 65 / motion.duration)).point;
    camera?.updateTravel?.(cameraMotion, sample.point, ahead, now - previousAt);
    previousAt = now;
    renderScheduler.invalidateAnimation();
    if (time >= 1) finish();
    else frame(tick);
  };
  activeMove = { seq, cancel: isCurrent };
  game.moveTarget = { li: path[0].li, idx: path[0].idx, seq, progress: 0, moving: true, cameraOwned: true };
  game.state = 'moving';
  game.pos = { x: route[0].x, y: route[0].y };
  preloadCellScene(game.layerData?.[path[0].li], path[0].idx);
  UI.refresh(game);
  renderScheduler.invalidate();
  // Background tabs can pause rAF; the fallback still resolves through stable nodes.
  watchdog = setTimeout(() => { finish(); resolveArrival(); }, motion.duration + ARRIVAL_DURATION + 700);
  if (reduced) finish();
  else frame(tick);
  return true;
}

// 点击脚下所在格可重开尚未完成的内容；完成结算的节点已写 visited，商店则在离开时写入。
export function reenterCell() {
  if (game.state !== 'idle' || activeMove) return false;
  resolveCell();
  return true;
}

// 即时效果类（币/木材/宝箱/口粮/钥匙/火堆/事件）：拾取或场景演出后再继续
const INSTANT_TYPES = ['coin', 'wood', 'chest', 'rations', 'key', 'fire', 'event', 'resource'];

function resolveCell() {
  const layer = curLayer(), idx = game.trackPos;
  const lc = layer.logical[idx];
  const def = lc ? lc.def : undefined;
  const door = (layer.doors || []).find(d => d.at === idx);

  // 一次性内容防重刷：奖励/事件/战斗完成后立即写 visited；未实际触发就退出仍可重进。
  // 商店例外：在店内可反复浏览，离开所在格才写 visited。进度型节点自管"可再来"语义：门、
  // 祭坛（未激活可再来，激活/领奖由 altarActivated 自判）、撤离点（面板自管）。
  game.visited = game.visited || {};
  const vKey = game.layerIdx + ',' + idx;
  const consumed = !!game.visited[vKey];
  const pendingReward = nodeChestRewardAt(game);
  if (pendingReward) {
    UI.beginRoom();
    const resumed = pendingReward.context?.battleSettlement
      ? bagSlots.resumeBattleRewards?.(pendingReward) : resumeChestsOnCell(pendingReward);
    if (!resumed) {
      game.state = 'idle'; UI.hideOverlay();
      UI.log('待领奖励暂未恢复，已保留在当前节点，请重试', 'warn');
    }
    return;
  }
  if (resumeNodeRestore()) { UI.beginRoom(); return; }
  if (resumeEventCardChoice()) { UI.beginRoom(); return; }
  // The actual entry cell owns its pending supply; old saves have no synthetic reward.
  const supply = entrySupplyAt(game);
  if (supply && supply.taken.length < supply.cardIds.length) { UI.beginRoom(); openEntrySupply(); return; }
  if (def?.type === 'fire' && game.nodeRewards?.[vKey]?.type === 'fire' && !game.nodeRewards[vKey].continued) {
    UI.beginRoom(); openFireRest(() => finishInstant()); return;
  }
  if (consumed && !door && def && (def.type === 'battle' || def.type === 'shop' || INSTANT_TYPES.includes(def.type))) {
    UI.log('[[icon:exit]] 该节点已完成结算，现已变为普通节点', 'dim');
    UI.beginRoom(); openSafeNode();
    return;
  }
  // 首脑格：击败首脑由战斗收尾写 visited（bag.js），祭坛未激活时可再来。
  // 击败后的巢穴不可再战；待领战利品已在上方按节点恢复。
  if (def && def.type === 'boss' && game.bossKilled) {
    UI.log('[[icon:skull]] 首脑已被击破，巢穴已经空了', 'dim');
    UI.beginRoom(); openSafeNode();
    return;
  }

  // 杀戮尖塔式房间切换：从落脚开始到本格全部结算完成，地图始终由全屏房间页取代。
  UI.beginRoom();
  game.state = 'modal';

  // 1) 战斗格：沿通用节点过场进入战场，不再增加接敌确认页。
  if (def && def.type === 'battle') {
    setBagReturnHook(null);
    enterNode('battle', () => openBattleCell(def));
    return;
  }

  // 2) 即时效果类：拾取或场景演出后再继续
  if (def && INSTANT_TYPES.includes(def.type)) {
    runInstant(def, (consume = true) => {
      if (consume !== false) consumeCurrentCell();
      // 即时效果完成 → 本格若兼为节点（如带商店的门、祭坛入口）继续节点演出
      if (door) { enterNode('door', () => openDoorModal(door, def)); return; }
      finishInstant();
    });
    return;
  }

  // 2.5) 事件卡连锁移动（保留兜底：时空孔隙「前进 6 格」）
  if (game.chainMove) {
    cancelLegacyChainMove('即时事件不会盲选第一条邻边');
  }

  // 3) 节点类：门 / 祭坛 / 首脑 / 紧急撤离 / 商店统一经过短过场。
  if (door) { enterNode('door', () => openDoorModal(door, def)); return; }
  if (def && def.type === 'door') { openSafeNode(); return; }
  if (def && def.type === 'altar') { enterNode('altar', openAltarRitual); return; }
  if (def && def.type === 'boss') { openBossGate(); return; }
  if (def && (def.type === 'emergencyExit' || def.type === 'extraction')) { enterNode('emergencyExit', openEmergencyModal); return; }
  if (def && def.type === 'shop') { enterNode('shop', () => openShop('cell:' + game.layerIdx + ',' + game.trackPos)); return; }

  // 4) 空白安全格（无任何事件）：直接收尾，留在地图。
  openSafeNode();
}

// 物资格先按通用掉落权重抽稀有度，再在档内均分；两张候选同名去重。
function openResourcePick(done) {
  const weights = SDT.Cards.DROP_WEIGHTS;
  const pool = SDT.Cards.all().filter(c => c.type === '资源' && SDT.Cards.isRandomObtainable(c));
  const pickOne = (taken) => {
    const avail = pool.filter(c => !(taken && taken.has(c.name)));
    const tiers = Object.entries(weights).map(([rarity, weight]) => ({
      cards: avail.filter(c => c.rarity === rarity),
      weight: weight * (game.mode === 'elite' && rarity !== '古朴' ? 1.2 : 1),
    })).filter(tier => tier.cards.length && tier.weight > 0);
    const total = tiers.reduce((sum, tier) => sum + tier.weight, 0);
    if (!total) return null;
    let roll = Random.random('loot') * total;
    let selected = tiers[tiers.length - 1];
    for (const tier of tiers) {
      roll -= tier.weight;
      if (roll <= 0) { selected = tier; break; }
    }
    return selected.cards[Math.floor(Random.random('loot') * selected.cards.length)];
  };
  const record = resourceRewardAt(game, () => {
    const first = pickOne(null);
    return [first, first ? pickOne(new Set([first.name])) : null];
  });
  const cards = (record?.cardIds || []).map(id => SDT.Cards.all().find(card => card.id === id));
  if (!cards.length) { done(false); return; }
  game.state = 'modal';
  saveGame();
  let active;
  const take = i => {
    if (!active() || !claimResourceReward(record, i, id => grantEventCard(SDT.Cards.all().find(card => card.id === id), { silent:true }))) return;
    document.getElementById('cardZoom')?._closeCardZoom?.(true);
    consumeCurrentCell();
    saveGame();
    UI.refresh(game);
    UI.log(`[[icon:gem]] 物资格：带走了【<b>${esc(cards[i].name)}</b>】`, 'loot');
    render();
  };
  const render = () => {
  const finished = record.taken !== null;
  UI.showOverlay('', rewardSceneHTML({ className:'reward-v14 resource-reward-scene', title:'物资投放点', source:'资源补给', count:cards.length,
    cards:cards.map((card, i) => {
      if (!card) return '<p>该物资暂不可用</p>';
      const fits = game.canReceiveCard?.(card) !== false;
      const action = finished ? `<span class="reward-unit-state">${record.taken === i ? '已入背包' : '已永久放弃'}</span>`
        : `<button class="reward-claim" data-act="${fits ? 'resTake' : 'resBag'}" data-i="${i}">${fits ? '收下' : '整理背包 · 当前放不下'}</button>`;
      return `<article class="reward-unit${record.taken === i ? ' got' : ''}"><button class="reward-card" data-act="resRead" data-i="${i}" aria-label="放大查看${escAttr(card.name)}">${SDT.Cards.cardHTML(card)}</button>${action}</article>`;
    }).join(''),
    actions:rewardExitHTML('resSkip', finished ? '继续探索' : '返回地图'), footer:`<button class="reward-bag" data-act="resBag">整理背包</button><span class="reward-notice" role="status">${finished ? '领取完成 · 1 张已入背包，其余卡牌已永久放弃' : '两张资源卡中选择一张，其余永久放弃；未领取时保留在此处'}</span>`,
  }), 'page');
  active = nodeActionBinding(game, UI, 'resSkip');
  setBagReturnHook(() => openResourcePick(done));
  UI.act('resRead', data => {
    const i = Number(data.i), card = cards[i];
    if (!active() || !card) return;
    const fits = game.canReceiveCard?.(card) !== false;
    UI.showCardZoom(card, { hideNote:true, presentation:'expedition', footer:finished ? '' : `<button class="ov-btn ok" data-act="${fits ? 'resTake' : 'resBag'}" data-i="${i}">${fits ? '收下' : '整理背包 · 当前放不下'}</button>` });
  });
  UI.act('resTake', data => take(Number(data.i)));
  UI.act('resBag', () => { if (active()) bagSlots.showBackpack(); });
  UI.act('resSkip', () => { if (!active()) return; setBagReturnHook(null); UI.hideOverlay(); done(record.taken !== null); });
  };
  render();
}

function openNodeDecision(spec) {
  game.state = 'modal';
  nodeShell({ tone:spec.tone, title:spec.title, sub:spec.sub,
    body:nodeOpt(spec.act, spec.label, spec.detail), foot:'<button class="ov-btn" data-act="nodeDecisionLeave">返回地图</button>' });
  const active = nodeActionBinding(game, UI, spec.act);
  let decided = false;
  setBagReturnHook(() => openNodeDecision(spec));
  UI.act('nodeDecisionLeave', () => { if (!active() || decided) return; decided = true; setBagReturnHook(null); UI.hideOverlay(); finishInstant(); });
  UI.act(spec.act, () => { if (!active() || decided) return; decided = true; setBagReturnHook(null); UI.hideOverlay(); spec.run(); });
}

function openSafeNode() {
  setBagReturnHook(null);
  UI.hideOverlay();
  finishInstant();
}

// 即时效果节点按类型处理奖励或事件。
function runInstant(def, after) {
  const done = after || finishInstant;
  switch (def.type) {
    case 'coin': {
      // 金币格收益 -1（2026-09-06 设计者定版）；展示与入账同口径（含玩法倍率）
      const base = Math.max(1, (def.n || 1) - 1);
      const n = Math.max(1, Math.round(base * (modeCfg().coinMul || 1)));
      openPickupPage('coin', `+${n} 币`, () => { gainCoins(base); done(); });
      break;
    }
    case 'wood': {
      // 2026-09-06 #11：资源格改为把「木材」以卡牌形式入包（可拖动/点击）
      const card = SDT.Cards.all().find(c => c.id === 'tt-wood');
      const cnt = def.n || 1;
      openFixedRewardsOnCell(Array.from({ length:cnt }, () => card).filter(Boolean), '木材补给', { consumeNode:true });
    } break;
    // 宝箱：70% 小宝箱（随机 1 张）/ 30% 中宝箱（3 选 1），使用通用卡牌池。
    case 'chest': openNodeDecision({ tone:'pickup', title:'宝箱', sub:'你找到一只遗留的宝箱，里面或许还有值得带走的卡牌与补给。',
      act:'nodeChestSearch', label:'开启宝箱', detail:'打开宝箱，查看可领取的随机卡牌',
      run:() => openChestsOnCell([Random.random('loot') < 0.7 ? { kind:'small' } : { kind:'medium' }], null, { consumeNode:true }) }); break;
    // 物资格（2026-09-16 Item 17 定版）：按爆率刷新 2 张随机资源卡，二选一带走
    case 'resource': openResourcePick(done); break;
    case 'rations': {
      // 2026-09-06 #11：口粮同样以卡牌形式入包
      const card = SDT.Cards.all().find(c => c.id === 'tt-rations');
      const cnt = MAP.items.rations.count || 1;
      openFixedRewardsOnCell(Array.from({ length:cnt }, () => card).filter(Boolean), '口粮补给', { consumeNode:true });
    } break;
    case 'key': {
      // 2026-09-09 老板 #1：物资点资源一律以卡牌形式入包（钥匙与木材/口粮同口径）
      const card = SDT.Cards.all().find(c => c.id === 'tt-key');
      openFixedRewardsOnCell([card].filter(Boolean), '钥匙补给', { consumeNode:true });
    } break;
    case 'fire':
      openFireRest(done);   // 数值沿用原火堆规则，确认休整才执行。
      break;
    case 'event': {
      // 事件页开着时不得回 idle：同步 done() 会把 modal 覆盖成 idle，玩家此时可移动、
      // 后到的事件页会顶掉前者（2026-09-13 实测奖励丢失）。收尾由事件页关闭点兜底。
      runEventDeck();
      break;
    }
    default: done(); break;
  }
}

// ---------- 事件卡（第六批桌游事件：只能经事件格触发，背包记录触发历史） ----------
// 事件卡池 = 卡牌库中类型「事件」的卡；卡牌库无事件卡时退回旧随机事件表。
// 导出供开发者节点测试面板（game.run.js devJumpNode）直接进事件页，玩法口径与事件格一致。
let eventRequest = 0;
function captureEventContext() {
  const request = eventRequest;
  const current = captureBattleContext(game, getActiveSlot);
  return () => request === eventRequest && current() && game.state !== 'title';
}

function eventPageBinding(act, current) {
  const active = nodeActionBinding(game, UI, act);
  const surface = UI.el?.ovBody?.firstElementChild;
  return () => current() && active() && (!surface || UI.el?.ovBody?.firstElementChild === surface);
}

export async function runEventDeck() {
  eventRequest++;
  if (resumeEventCardChoice()) return;
  const current = captureEventContext();
  if (!await enterNode('event', () => true)) return;
  if (!current()) return;
  const bound = nodeEventAt(game);
  if (!bound && await tryLastLampEvent()) return;
  if (!current()) return;
  const deck = SDT.Cards.all().filter(c => c.type === '事件');
  if (bound) {
    const savedCard = deck.find(card => card.id === bound.eventId);
    if (!savedCard) { renderUnavailableNodeEvent(current); return; }
    return triggerEventCard(savedCard, current);
  }
  if (!deck.length) {
    const ev = weighted(MAP.randomEvents);
    if (ev.coins) { UI.log(`【事件】${ev.text}`, 'sys'); gainCoins(ev.coins[0] + Math.floor(Random.random('event') * (ev.coins[1] - ev.coins[0] + 1))); }
    else if (ev.item) { UI.log(`【事件】${ev.text}`, 'sys'); game.addItem(pick(MAP.chestTable)); }
    else UI.log(`【事件】${ev.text}`, 'dim');
    // 旧随机表没有事件页收尾点：不补 finishInstant 会把格子永久卡在 moving（迭代评审 09-20 C-P2，
    // 设置页「清空卡牌库」后踩事件格必现）
    consumeCurrentCell();
    finishInstant();
    return;
  }
  const card = pick(deck);
  bindNodeEvent(game, card.id);
  saveGame(); // Freeze the first draw before narrative loading; reentry never advances this draw again.
  return triggerEventCard(card, current);
}

function renderUnavailableNodeEvent(current) {
  if (!current()) return;
  game.state = 'modal';
  nodeShell({ tone:'event', icon:'[[icon:notes]]', title:'此处事件暂不可用',
    sub:'这个节点的事件记录已保留，当前卡库暂时无法显示；不会重新抽取事件。',
    body:nodeOpt('eventUnavailableLeave', '返回地图', '保留原事件，稍后可重新进入') });
  const active = eventPageBinding('eventUnavailableLeave', current);
  setBagReturnHook(() => renderUnavailableNodeEvent(current));
  UI.act('eventUnavailableLeave', () => { if (active()) closeEventFlow(); });
  UI.refresh(game);
}

function currentLastLampIdentity(slotId, runId) {
  if (getActiveSlot() !== slotId) return { ok: false, code: 'RUN_CHANGED', message: '当前探索已改变，请在新探索中重新进入事件。' };
  const identity = RunStorage.readIdentity(slotId);
  if (!identity.ok) return identity;
  return identity.value.runId === runId ? identity : { ok: false, code: 'RUN_CHANGED', message: '当前探索已改变，请在新探索中重新进入事件。' };
}

function currentLastLampPage(binding) {
  const identity = currentLastLampIdentity(binding.slotId, binding.runId);
  if (!identity.ok) return identity;
  if (game.layerIdx !== binding.layerIdx || game.trackPos !== binding.trackPos ||
      makeLastLampEventInstanceId(binding.runId, game.layerIdx, game.trackPos) !== binding.eventInstanceId) {
    return { ok: false, code: 'EVENT_CHANGED', message: '当前事件节点已改变。' };
  }
  return identity;
}

function lastLampResultText(segmentId, choiceId) {
  if (segmentId === 1) return '冰霜化开后，新旧漆面的边缘同时显了出来。这不是画错的箭头，而是某次改道留下的两套路线。';
  if (segmentId === 2) return '两层箭头都是真的。一条是平日近路，一条是风雪封路后的公共疏散线；北门那盏灯才是最后的确认标记。';
  return choiceId === 'open_beacon'
    ? '灯光越过风雪落在体育馆方向，远处也能看清路标；北门通道从此不再藏在暗处。'
    : '窄光贴着墙面照出旧箭头，近处的路仍可辨认；从风雪深处望来，北门依旧是一片黑暗。';
}

function renderLastLampResult(record, text, binding, saveError = '') {
  if (!currentLastLampPage(binding).ok) return;
  game.state = 'modal';
  let finishing = false;
  nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:notes]]', title: '最后一盏引路灯',
    sub: esc(text || lastLampResultText(record.segmentId, record.choiceId)),
    body: `${record.mementoId ? `<p><b>${record.mementoId === 'last_lamp_open_beacon' ? '北门远灯记录' : '遮光近照记录'}</b>已写入基地的见闻纪念。故事记录不提供地图或战力效果。</p>` : '<p>本段见闻已永久记录；下一次探索可继续这条线索。</p>'}
      ${saveError ? `<p class="warn">${esc(saveError)}</p>` : ''}
      <button class="evt-opt ok" data-act="lastLampFinish"><b>${saveError ? '重试保存节点' : '记下并离开'}</b></button>`,
  });
  setBagReturnHook(() => { if (currentLastLampPage(binding).ok) renderLastLampResult(record, text, binding, saveError); });
  UI.act('lastLampFinish', () => {
    if (finishing) return;
    if (!currentLastLampPage(binding).ok) return;
    finishing = true;
    const key = `${game.layerIdx},${game.trackPos}`;
    const wasVisited = !!game.visited?.[key];
    consumeCurrentCell();
    if (saveGame() !== true) {
      if (!wasVisited && game.visited) delete game.visited[key];
      renderLastLampResult(record, text, binding, '故事记录已保存，但本次节点保存失败。请重试，期间不会重复推进故事。');
      return;
    }
    setBagReturnHook(null);
    UI.hideOverlay();
    finishInstant();
  });
  UI.refresh(game);
}

async function tryLastLampEvent() {
  const slotId = getActiveSlot();
  if (!slotId) return false;
  const identity = RunStorage.readIdentity(slotId);
  if (!identity.ok) {
    if (identity.code === 'RECOVERY_REQUIRED') {
      game.state = 'modal';
      nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:cross]]', title: '故事记录暂不可用',
        sub: '该档位存在待恢复事务，当前节点没有被消费。',
        body: '<button class="evt-opt" data-act="lastLampRetry"><b>重试读取</b><span>恢复完成后再继续；不会写入故事或结算原事件</span></button>',
      });
      UI.act('lastLampRetry', () => runEventDeck());
      UI.refresh(game);
      return true;
    }
    console.warn('[story] 无法读取稳定探索身份，回退普通事件', identity);
    return false;
  }
  const runId = identity.value.runId;
  const eventInstanceId = makeLastLampEventInstanceId(runId, game.layerIdx, game.trackPos);
  const binding = { slotId, runId, eventInstanceId, layerIdx: game.layerIdx, trackPos: game.trackPos };
  const status = storyCommands.inspect(slotId, { runId, eventInstanceId });
  if (!status.ok) { console.warn('[story] 故事状态不可用，保留原数据并回退普通事件', status); return false; }
  if (status.value.kind === 'complete' || status.value.kind === 'already-read-this-run') return false;
  if (status.value.kind === 'recover') {
    renderLastLampResult(status.value.record, lastLampResultText(status.value.record.segmentId, status.value.record.choiceId), binding);
    return true;
  }
  const segmentId = status.value.segmentId;
  let narrative = null;
  try { narrative = await lastLampNarrative(segmentId); }
  catch (error) { console.warn('[story] 环境故事运行失败，回退普通事件', error); }
  if (!currentLastLampPage(binding).ok) return true;
  if (!narrative || !narrative.choices?.length) return false; // 原事件照旧结算，不因故事消费节点
  game.state = 'modal';
  let settled = false;
  nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:notes]]', title: '最后一盏引路灯',
    sub: esc(narrative.intro),
    body: narrative.choices.map((choice, index) => `<button class="evt-opt ${choice.tone || ''}" data-act="lastLampChoice" data-i="${index}"><b>${esc(choice.label)}</b><span>${esc(choice.detail)}</span></button>`).join(''),
  });
  UI.act('lastLampChoice', async d => {
    if (settled) return;
    const choice = narrative.choices[+d.i];
    if (!choice) return;
    const boundBefore = currentLastLampPage(binding);
    if (!boundBefore.ok) { UI.log(`[[icon:cross]] ${boundBefore.message}`, 'warn'); return; }
    settled = true;
    const fresh = storyCommands.inspect(slotId, { runId, eventInstanceId });
    if (!fresh.ok) { settled = false; if (currentLastLampPage(binding).ok) showChoiceError(fresh.message || '故事档案读取失败'); return; }
    if (fresh.value.kind === 'recover') { renderLastLampResult(fresh.value.record, lastLampResultText(segmentId, fresh.value.record.choiceId), binding); return; }
    const requestId = `last-lamp:${eventInstanceId}`;
    const result = await storyCommands.record({ slotId, requestId, expectedRevision: fresh.revision },
      { runId, eventInstanceId, segmentId, choiceId: choice.effect });
    if (!result.ok) {
      settled = false;
      if (currentLastLampPage(binding).ok) showChoiceError(result.message || '故事记录保存失败，请重试');
      return;
    }
    const boundAfter = currentLastLampPage(binding);
    if (!boundAfter.ok) { console.warn('[story] 旧探索记录已保存，但不会消费当前节点', boundAfter); return; }
    setBagReturnHook(null);
    const output = result.value.output;
    const record = { ...output, mementoId: output.mementoId || null };
    SDT.Sound.sfx(record.mementoId ? 'storyComplete' : 'eventClue');
    let resultText = lastLampResultText(record.segmentId, record.choiceId);
    try { resultText = choice.choose() || resultText; }
    catch (error) { console.warn('[story] 环境故事结尾解析失败，使用固定结果文案', error); }
    renderLastLampResult(record, resultText, binding);
  });
  UI.refresh(game);
  setBagReturnHook(() => { if (currentLastLampPage(binding).ok) tryLastLampEvent(); });
  function showChoiceError(message) {
    if (!currentLastLampPage(binding).ok) return;
    nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:cross]]', title: '最后一盏引路灯', sub: esc(message),
      body: '<button class="evt-opt" data-act="lastLampChoiceRetry"><b>重试选择</b><span>尚未写入故事，也未消费当前节点</span></button>' });
    setBagReturnHook(() => { if (currentLastLampPage(binding).ok) showChoiceError(message); });
    UI.act('lastLampChoiceRetry', () => { if (!currentLastLampPage(binding).ok) return; settled = false; tryLastLampEvent(); });
    UI.refresh(game);
  }
  return true;
}

// 把库里的卡发给玩家（同名堆未满并入现有格；堆满或新卡需要空格——叠放上限见 game.session #7；
// 珍珠盒扩出来的格子只收资源卡——canAcceptCard 统一判定，Q5 老板定向）
async function triggerEventCard(card, current) {
  game.eventLog = game.eventLog || [];
  game.eventLog.push({ name: card.name, desc: card.desc || '', turn: game.turn });
  // 封顶：eventLog 随对局只增不减，而每次落盘都会全量 JSON.stringify——
  // 长局会让每次 persistSave 的同步序列化越来越慢。留 200 条足够回溯。
  if (game.eventLog.length > 200) game.eventLog = game.eventLog.slice(-200);
  UI.log(`[[icon:dice]] 触发事件【<b>${esc(card.name)}</b>】${card.desc ? '· ' + esc(card.desc) : ''}`, 'sys');
  // 主界面大字揭晓：展示事件卡卡面与描述，点击任意处后结算
  game.state = 'modal';
  _set_cardPageOpen(false);
  SDT.Sound.sfx('scene');
  const loadingBody = UI.el?.ovBody;
  const loadingSurface = loadingBody?.firstElementChild;
  // ink 运行时异常兜底（迭代评审 09-20 C-P2）：此前 await 抛错会永久卡 modal（事件页永不渲染、仅按 B 可解）
  let narrative = null;
  try { narrative = await eventNarrative(card.id); }
  catch (e) { console.error('[event] ink 叙事运行异常，回落默认结算：', e); }
  // 转场退出可以自然清空旧画面；另一个页面或探索已接管时不投影迟到叙事。
  if (!current() || game.state !== 'modal' || (loadingBody && (UI.el?.ovBody !== loadingBody ||
      (loadingBody.firstElementChild && loadingBody.firstElementChild !== loadingSurface)))) return;
  const choices = eventChoiceSpec(card, narrative);
  const resumedChoice = nodeEventAt(game)?.actionChoice;
  if (Number.isInteger(resumedChoice) && choices?.[resumedChoice]?.rolls) {
    choices[resumedChoice].run();
    return;
  }
  // 2026-09-10 留言 #18：没有专属图的事件此前全部回落到祭坛图（等于所有事件共用 1 张背景）。
  // 改为从 3 张事件场景图中随机轮换（scene-event-custom-a/b/c，见 css/scenes.css）。
  const GENERIC_EVENT_BGS = ['scene-event-custom-a', 'scene-event-custom-b', 'scene-event-custom-c'];
  const genericBg = GENERIC_EVENT_BGS[Math.floor(Random.random('scene') * GENERIC_EVENT_BGS.length)];
  const sceneMeta = EVENT_SCENE_META[card.id] || ['event-custom', 'scene-event-custom', genericBg];
  // 杀戮尖塔式事件页：整屏事件背景，右侧毛玻璃面板放标题、叙事与选项条
  const optHTML = choices
    ? choices.map((o, i) => `
        <button class="evt-opt ${o.tone || ''}" data-act="evtChoice" data-i="${i}">
          <b>${esc(o.label)}</b>
          ${o.detail ? `<span>${esc(o.detail)}</span>` : ''}
        </button>`).join('')
    : `<button class="evt-opt ok" data-act="evtNext"><b>获取并离开</b></button>`;
  // 事件页渲染收敛为可重入闭包（迭代评审 09-20 C-P1 来源恢复协议）：背包盖开再关后经
  // bag-return-hook 重放本闭包恢复事件页——选项进度由外层 evtSettled 保全，不再吞结算；
  // 每次渲染都重新登记钩子（被消费后再次开背包仍有保护），结算时显式清空
  let evtSettled = false;   // 防连点：事件选项二次触发会重复发奖（2026-09-13 实测连点3次入包2张）
  let selectedChoice = null, pageRevision = 0;
  const signalPuzzle = card.id === 'tt6-systemsupply'
    ? createSignalPuzzleState(`${game.mapSeed ?? game.seed ?? ''}|${card.id}|${game.layerIdx},${game.trackPos}`) : null;
  const renderEventPage = (noticeText = '') => {
    if (evtSettled || !current()) return;
    const revision = ++pageRevision;
    game.state = 'modal';
    setBagReturnHook(() => renderEventPage());
    nodeShell({
      tone: 'event', asset: sceneMeta[2], icon: '[[icon:dice]]', title: card.name,
      sub: esc((narrative && narrative.intro) || card.desc || '神秘事件发生了……'),
      body: optHTML,
      foot:'<button class="ov-btn" data-act="evtReturn">返回地图</button><button class="ov-btn" data-act="evtBag">整理背包</button><p class="reward-notice" data-event-capacity role="status"></p>',
    });
    const active = eventPageBinding(choices ? 'evtChoice' : 'evtNext', current);
    const choiceCurrent = () => !evtSettled && current() && pageRevision === revision;
    if (signalPuzzle) mountEventSignalPuzzle(UI.el?.ovBody?.firstElementChild, signalPuzzle, () => choiceCurrent() && active());
    const executeChoice = index => {
      if (!choiceCurrent()) return false;
      const choice = choices?.[index];
      if (!choice) return false;
      selectedChoice = index;
      if ((choice.canRun && !choice.canRun()) || (choice.claim && !choice.claim())) {
        renderEventPage('当前放不下，奖励与选择已保留。');
        SDT.Sound.sfx('deny');
        return false;
      }
      if (choice.rolls) {
        const record = nodeEventAt(game);
        record.actionChoice = index;
        if (saveGame() === false) { renderEventPage('未能保存选择，请重试。'); return false; }
      }
      evtSettled = true;
      setBagReturnHook(null);
      UI.hideOverlay();
      if (!choice.deferConsume && !choice.rolls) consumeCurrentCell();
      choice.run();
      if (game.state !== 'modal') finishInstant();
      return true;
    };
    UI.act('evtChoice', (d) => {
      if (!choices || evtSettled || !active()) return;
      const index = Number(d.i), choice = choices[index];
      if (!choice) return;
      selectedChoice = index;
      if (choice.capacityCard && !game.canReceiveCard(choice.capacityCard)) {
        setBagReturnHook(null);
        bagSlots.organizeReward({ card:choice.capacityCard, current:choiceCurrent,
          onReturn:() => { if (choiceCurrent()) renderEventPage(); },
          onClaim:() => executeChoice(index),
          onFullBag:() => { if (choiceCurrent()) { renderEventPage(); bagSlots.showBackpack(); } },
        });
        return;
      }
      executeChoice(index);
    });
    UI.act('evtNext', () => {
      if (choices || evtSettled || !active()) return;
      evtSettled = true;
      setBagReturnHook(null);
      UI.hideOverlay();
      applyEventEffect(card);
      consumeCurrentCell();
      if (game.state !== 'modal') finishInstant();   // 同上（旧事件 default 分支此前漏收尾）
    });
    UI.act('evtBag', () => {
      if (evtSettled || !active()) return;
      const selected = UI.el?.ovBody?.querySelector('.evt-opt.is-selected[data-i]');
      selectedChoice = selected ? Number(selected.dataset.i) : null;
      bagSlots.showBackpack();
    });
    UI.act('evtReturn', () => { if (!evtSettled && active()) closeEventFlow(); });
    UI.refresh(game);
    const notice = UI.el?.ovBody?.querySelector('[data-event-capacity]');
    if (notice) notice.textContent = noticeText;
    if (choices?.length > 1 && Number.isInteger(selectedChoice)) {
      const option = UI.el?.ovBody?.querySelector(`[data-act="evtChoice"][data-i="${selectedChoice}"]`);
      option?.click(); option?.focus();
    }
  };
  renderEventPage();
}

function eventPool(types) {
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  return SDT.Cards.all().filter(c => wanted.has(c.type) && SDT.Cards.isRandomObtainable(c));
}

function closeEventFlow() {
  setBagReturnHook(null);
  UI.hideOverlay();
  game.state = 'idle';
  saveGame();
  UI.refresh(game);
}

function eventDice(title, key, outcomes, done, sides, beforeRoll) {
  const owner = nodeEventAt(game);
  const current = captureEventContext();
  return createEventDiceController({ UI, SDT, save:saveGame,
    show:spec => { game.state = 'modal'; nodeShell({ tone:'event', asset:EVENT_SCENE_META[owner.eventId]?.[2], icon:'[[icon:dice]]', ...spec }); UI.refresh(game); },
    bind:act => eventPageBinding(act, current), onLeave:closeEventFlow, setReturn:setBagReturnHook,
  }).open({ owner, key, title, outcomes, done, sides, beforeRoll, current });
}

function finishEventRoll(run) {
  const record = nodeEventAt(game);
  if (record) delete record.actionChoice;
  consumeCurrentCell();
  setBagReturnHook(null);
  UI.hideOverlay();
  run();
}

// Each card uses a numbered die with exactly one face per eligible card.
// Frozen candidate IDs and completed dice are reused on reentry, including partial sequences.
function drawEventCards(title, key, pools, done, unique = true) {
  const owner = nodeEventAt(game), drawn = [];
  const next = index => {
    if (index >= pools.length) { done(drawn); return; }
    const pool = (typeof pools[index] === 'function' ? pools[index]() : pools[index])
      .filter(c => c && (!unique || !drawn.some(other => other.id === c.id || other.name === c.name)));
    const outcomes = pool.map(c => ({label:c.name,value:c.id}));
    if (!outcomes.length && !owner.dice?.[`${key}:${index}`]) {
      UI.log('没有符合条件的卡牌，事件与已投结果已保留。', 'warn'); closeEventFlow(); return;
    }
    eventDice(`${title} · 第 ${index + 1}/${pools.length} 张`, `${key}:${index}`, outcomes, id => {
      const card = SDT.Cards.all().find(c => c.id === id);
      if (!card) { UI.log('本次骰子对应卡牌暂不可用，结果已保留。','warn'); closeEventFlow(); return; }
      drawn.push(card); next(index + 1);
    });
  };
  next(0);
}

function spendEventCoins(amount, reason) {
  if ((game.coins || 0) < amount) {
    SDT.Sound.sfx('deny');
    UI.log(`[[icon:coin]] 币不足：「${esc(reason)}」需要 ${amount} 币（现有 ${game.coins || 0}）`, 'warn');
    return false;
  }
  game.coins -= amount;
  SDT.Sound.sfx('coin');
  UI.log(`[[icon:coin]] ${esc(reason)}：-${amount} 币（剩余 ${game.coins}）`, 'coin');
  return true;
}

let eventCardChoices = null;
function eventCardChoiceController() {
  // Lazy assembly preserves the session/flow import boundary during boot.
  return eventCardChoices ||= createEventCardChoiceController({
    game, UI, SDT, saveGame, getActiveSlot, nodeShell, grantEventCard, consumeCurrentCell, openFixedRewardsOnCell,
    captureContext: captureEventContext, close: closeEventFlow,
  });
}
export function resumeEventCardChoice() { return eventCardChoiceController().resume(); }

function transformCandidates(card) {
  if (!card || !['武术', '法术', '装备'].includes(card.type)) return [];
  return SDT.Cards.all().filter(c => {
    if (!c || c.id === card.id || c.name === card.name || c.type !== card.type || c.rarity !== card.rarity) return false;
    if (SDT.Cards.isRandomObtainable(c)) return true;
    return card.rarity === '职业' && c.rarity === '职业' && c.cls === game.myClass && !c.hero;
  });
}

function openEventRecode() {
  SDT.Sound.sfx('recodeStart');
  game.state = 'modal';
  const eligible = recodeEligibleCards(game.ownedCards, SDT.Cards.all(), game.myClass, card => SDT.Cards.isRandomObtainable(card));
  const need = Math.min(2, eligible.length);
  const owner = nodeEventAt(game);
  const convert = () => {
    const entries = owner.recodeUids.map(uid => game.ownedCards.find(o => o.uid === uid));
    if (entries.some(entry => !entry)) { UI.log('待重编的卡牌已不在背包中，本次结果保留。','warn'); closeEventFlow(); return; }
    drawEventCards('故障重编','recode',entries.map(entry => transformCandidates(entry.card)), cards => showEventRecodeResult({ UI, Cards:SDT.Cards, cards, entries, nodeShell, setReturn:setBagReturnHook, current:captureEventContext(), done:() => {
      if (entries.some(entry => !game.ownedCards.includes(entry))) { UI.log('原卡已不在背包中，结果保留，请重新进入事件。', 'warn'); closeEventFlow(); return; }
      finishEventRoll(() => {
      entries.forEach((entry,i) => {
        UI.log(`[[icon:recycle]] 【${esc(entry.card.name)}】重编为【${esc(cards[i].name)}】`, 'loot');
        entry.card = {...cards[i]};
      });
      SDT.Sound.sfx('recodeComplete'); closeEventFlow();
      });
    } }), false);
  };
  if (owner.recodeUids?.length) { convert(); return; }
  if (!need) {
    UI.log('[[icon:cards]] 背包中没有可转换的招式或装备卡', 'warn');
    closeEventFlow();
    return;
  }
  const selected = new Set();
  const current = captureEventContext();
  let settled = false;
  const render = () => {
    if (settled || !current()) return;
    game.state = 'modal';
    setBagReturnHook(render);
    nodeShell({
      tone: 'event', asset: 'scene-event-recode', icon: '[[icon:recycle]]', title: '故障重编',
      sub: `选择 <b>${need}</b> 张招式或装备卡，将其随机变为同稀有度、同类型的卡牌（${selected.size}/${need}）`,
      body: `<div class="bt-hand event-choice-hand">${eligible.map((o, i) => `
        <button type="button" class="bt-card event-choice-card${selected.has(o.uid) ? ' picked' : ''}" data-act="eventRecodePick" data-i="${i}" aria-pressed="${selected.has(o.uid)}">
          ${SDT.Cards.cardHTML(o.card, 'sm')}
          ${selected.has(o.uid) ? '<span class="chest-got-mark">已选</span>' : ''}
        </button>`).join('')}</div>
        <div class="scene-ops"><button class="ov-btn" data-act="eventRecodeLeave">放弃转换</button><button class="ov-btn ok" data-act="eventRecodeGo" ${selected.size !== need ? 'disabled' : ''}>启动重编</button></div>`,
    });
    const active = eventPageBinding('eventRecodePick', current);
    UI.act('eventRecodePick', (d) => {
      if (settled || !active()) return;
      const entry = eligible[+d.i];
      if (!entry) return;
      if (selected.has(entry.uid)) selected.delete(entry.uid);
      else if (selected.size < need) selected.add(entry.uid);
      render();
    });
    UI.act('eventRecodeLeave', () => { if (!settled && active()) { settled = true; finishEventRoll(closeEventFlow); } });
    UI.act('eventRecodeGo', () => {
      if (settled || !active() || selected.size !== need) return;
      settled = true;
      owner.recodeUids = [...selected];
      convert();
    });
    UI.refresh(game);
  };
  render();
}

function openEventPotions() {
  if (resumeEventCardChoice()) return;
  const pool = eventPool('道具').filter(c => /药水/.test(c.name));
  const count = Math.min(3, new Set(pool.map(c => c.name)).size);
  if (!count) { UI.log('药摊暂无药水。','warn'); closeEventFlow(); return; }
  drawEventCards('避难市集药摊','potions',Array(count).fill(pool), cards => eventCardChoiceController().open('ev19-potions', cards));
}

function openEventQuartermaster() {
  if (resumeEventCardChoice()) return;
  const owner = nodeEventAt(game), pool = eventPool('装备');
  const count = Math.min(3,new Set(pool.map(c => c.name)).size);
  if (!count) { UI.log('军需处暂无装备。','warn'); closeEventFlow(); return; }
  if (!owner.quartermasterPaid) {
    if (!spendEventCoins(3, '军需征用')) { delete owner.actionChoice; closeEventFlow(); return; }
    owner.quartermasterPaid = true;
  }
  drawEventCards('装备征用令','quartermaster',Array(count).fill(pool), cards => eventCardChoiceController().open('ev19-quartermaster', cards));
}

function openEventGamble() {
  const owner = nodeEventAt(game);
  if (!owner.gamble) owner.gamble = { attempts:0, pending:null };
  const state = owner.gamble;
  if (!state.prizeIds) {
    drawEventCards('地下商场黑市','gamble-prizes',[eventPool('装备'),eventPool(['武术','法术']),eventPool(['武术','法术'])], cards => {
      state.prizeIds = cards.map(c => c.id); openEventGamble();
    });
    return;
  }
  game.state = 'modal';
  const prizes = state.prizeIds.map(id => SDT.Cards.all().find(c => c.id === id)).filter(Boolean);
  let attempts = state.attempts;
  let settled = false;
  const current = captureEventContext();
  const attempt = () => {
    const attemptNumber = state.pending ?? state.attempts + 1;
    const guaranteed = attemptNumber >= 5;
    eventDice('地下商场黑市 · 投币判定',`gamble-attempt:${attemptNumber}`,
      guaranteed ? [{label:'第 5 次保底：拿走三张卡',value:true}] : [{label:'本次落空',value:false},{label:'拿走三张卡',value:true}], hit => {
        state.pending = null;
        attempts = state.attempts;
        if (!hit) { SDT.Sound.sfx('blackMarketLose'); render(true); return; }
        settled = true; SDT.Sound.sfx('blackMarketWin');
        finishEventRoll(() => openFixedRewardsOnCell(prizes, '地下商场黑市'));
      },6,() => {
        if (!spendEventCoins(3,'黑市抽签')) return false;
        state.attempts = attemptNumber; state.pending = attemptNumber;
        return true;
      });
  };
  const render = (lastMiss = false) => {
    if (settled || !current()) return;
    game.state = 'modal';
    setBagReturnHook(() => render(lastMiss));
    nodeShell({
      tone: 'event', asset: 'scene-event-gamble', icon: '[[icon:dice]]', title: '地下商场黑市',
      sub: `每次投入 <b>3 币</b>后亲手投骰：<b>1～3 点落空，4～6 点拿走三张卡（50%）</b>；第 <b>5</b> 次任意点数都成功。已尝试 ${attempts}/5 次。${lastMiss ? '<br><b class="danger">指示灯变红，这次什么也没拿到。</b>' : ''}`,
      body: `<div class="bt-hand event-choice-hand">${prizes.map((c, i) => `<button type="button" class="bt-card event-choice-card" data-act="eventGambleRead" data-i="${i}" aria-label="放大查看${escAttr(c.name)}" aria-haspopup="dialog">${SDT.Cards.cardHTML(c, 'sm')}</button>`).join('')}</div>
        <p class="loot-footer-note">点击卡牌放大查看</p>
        <div class="scene-ops"><button class="ov-btn" data-act="eventGambleLeave">放弃并离开</button><button class="ov-btn ok" data-act="eventGambleTry" ${(game.coins || 0) < 3 || !prizes.length ? 'disabled' : ''}>[[icon:coin]] 投入 3 币${attempts === 4 ? '（本次保底）' : ''}</button></div>`,
    });
    const active = eventPageBinding('eventGambleTry', current);
    UI.act('eventGambleRead', d => {
      const i = Number(d.i), card = prizes[i];
      if (settled || !active() || !card) return;
      const source = UI.el.ovBody.querySelector(`[data-act="eventGambleRead"][data-i="${i}"]`);
      UI.showCardZoom(card, { hideNote:true, presentation:'expedition', from:source, returnFocus:source });
    });
    UI.act('eventGambleLeave', () => { if (!settled && active()) { settled = true; finishEventRoll(closeEventFlow); } });
    UI.act('eventGambleTry', () => {
      if (!settled && active()) attempt();
    });
    UI.refresh(game);
  };
  if (prizes.length < 3) {
    UI.log('[[icon:cards]] 黑市货架无法生成完整的三张奖品', 'warn');
    closeEventFlow();
    return;
  }
  if (state.pending !== null) attempt();
  else render(state.attempts > 0);
}

// 事件分支只覆盖已有资源/效果；未列出的旧事件继续单按钮结算，兼容旧存档与自定义事件卡。
function eventChoiceSpec(card, narrative = null) {
  if (!card) return null;
  const settle = (run) => () => { run(); game.state = 'idle'; saveGame(); UI.refresh(game); };
  const rewards = (...cards) => openFixedRewardsOnCell(cards, card.name);
  const gainFragment = () => {
    game.fragments = (game.fragments || 0) + 1;
    // 提示语改写（迭代评审 09-20 B-P1）：原句「可随员工通行证A合成员工通行证A」不成句，
    // 兑换规则以 cards-sync tt-token-color desc 为准
    UI.log(`[[icon:crystal]] 获得员工通行证A碎片（${game.fragments}/2，集齐 2 枚可合成员工通行证A，兑换一张能力卡）`, 'loot');
  };
  // —— 2026-09-09 事件 v2（Q6/C13 老板定向）：描述已按设计者新版对齐的七个事件，
  //     直接走自定义选项（旧 ink 叙事仍作 intro 展示，效果按新卡面结算）——
  const V2 = {
    'tt6-mystery': () => [
      { label:'投骰领取', detail:'1～3 点：员工通行证A碎片 ×1；4～6 点：3 币', tone:'ok', rolls:true,
        run:() => eventDice(card.name, 'supply', [{label:'员工通行证A碎片 ×1',value:'fragment'},{label:'3 币',value:'coins'}],
          value => finishEventRoll(settle(() => { if (value === 'fragment') gainFragment(); else gainCoins(3); })), 6) },
      { label:'离开', detail:'不领取物资', run:settle(() => {}) },
    ],
    'tt6-systemsupply': () => {
      const wood = SDT.Cards.all().find(c => c.id === 'tt-wood');
      return [
        { label:'碎片与木材', detail:'获得员工通行证A碎片 ×1，木材卡 ×1；需背包能放下木材卡', tone:'ok',
          capacityCard:wood, canRun:() => !!wood && game.canReceiveCard(wood),
          claim:() => grantEventCard(wood),
          run:settle(gainFragment) },
        { label:'碎片与货币', detail:'获得员工通行证A碎片 ×1，+2 币；不占背包格', tone:'ok',
          run:settle(() => { gainFragment(); gainCoins(2); }) },
      ];
    },
    'tt6-demondeal': () => [
      { label: '成交', detail: '-5 血，获得 1 个军用保险柜', tone: 'danger', run: () => {
        game.hp = Math.max(1, game.hp - 5);
        UI.log('[[icon:demon]] 恶魔收走了 5 点生命力，并丢给你一个军用保险柜', 'warn');
        openChestsOnCell([{ kind: 'large' }], '恶魔的报酬');
      } },
      { label: '拒绝', detail: '无事发生', run: settle(() => { UI.log('你顶住了诱惑，继续赶路', 'sys'); }) },
    ],
    'tt6-airdrop': () => {
      const potionPool = SDT.Cards.all().filter(c => c.type === '道具' && SDT.Cards.isRandomObtainable(c) && (/药水/.test(c.name) || c.name === '能量饮料'));
      const woodCard = SDT.Cards.all().find(c => c.id === 'tt-wood');
      const rationCard = SDT.Cards.all().find(c => c.id === 'tt-rations');
      return [
        { label: '木材', detail: '木材卡 ×1', run: () => rewards(woodCard) },   // 需求 #10：物资一律以卡牌入包
        { label: '口粮', detail: '口粮卡 ×1', run: () => rewards(rationCard) },
        { label: '能量饮料', detail: '回复 6 血', tone: 'ok', run: settle(() => { game.heal(6); UI.log('[[icon:heart]] 一罐能量饮料下肚，回复 6 点生命', 'ok'); }) },
        { label:'随机药水', detail:'亲手投骰抽取 1 瓶药水；投骰前展示全部对应点数', tone:'ok', rolls:true,
          run:() => drawEventCards(card.name,'airdrop-potion',[potionPool], cards => finishEventRoll(() => rewards(...cards))) },
      ];
    },
    'tt6-chestdraw': () => [
      { label:'投骰开箱', detail:'1～2 点：小型物资箱；3～4 点：密封物资箱；5～6 点：军用保险柜', tone:'ok', rolls:true,
        run:() => eventDice(card.name,'chest-kind',[
          {label:'小型物资箱',value:'small'},{label:'密封物资箱',value:'medium'},{label:'军用保险柜',value:'large'},
        ], kind => finishEventRoll(() => openChestsOnCell([{ kind }], '你投骰选中的物资箱')),6) },
    ],
    'tt6-goldhammer': () => [
      { label: '查看并领取', detail: '获得卡牌「闪金之锤」；放不下时可先整理背包', tone: 'ok', run: () => rewards(SDT.Cards.all().find(c => c.id === 'cmtn0xt0zr7')) },
      { label:'接受送信委托', detail:'替校工把配送凭据交给下一家商店：随机两格商品免费，排除初始攻击；与领取锤子二选一。', tone:'ok',
        run:settle(() => { nodeEventAt(game).commission = {status:'pending'};
          UI.log('[[icon:notes]] 校工把配送凭据塞进你的手里：“交给下一家店的行商，两格货物算我的账。”','sys'); }) },
    ],
    'tt6-relief': () => [
      { label:'接受处理', detail:'回复 6 点生命', tone:'ok', run:settle(() => game.heal(6)) },
      { label:'领取防身招式', detail:'放弃治疗，投骰获得 1 张随机招式（武术或法术）', rolls:true,
        run:() => drawEventCards(card.name,'relief-move',[eventPool(['武术','法术'])], cards => finishEventRoll(() => rewards(...cards))) },
    ],
    'ev19-vital': () => [
      { label: '接受强化急救', tone: 'ok', run: settle(() => {
        game.maxHp += 3; game.hp += 3;
        UI.log(`[[icon:heart]] 强化药剂生效：生命上限 +3（${game.hp}/${game.maxHp}）`, 'ok');
      }) },
    ],
    'ev19-pearlbox': () => [
      { label: '取走珍珠匣', tone: 'ok', run: () => rewards(SDT.Cards.all().find(c => c.id === 'tt2-pearlbox')) },
    ],
    'ev19-fireballs': () => [
      { label: '接收封装火种', tone: 'ok', run: () => {
        const fireball = SDT.Cards.all().find(c => c.id === 'tt3-fireball');
        rewards(fireball, fireball);
      } },
    ],
    'ev19-classchest': () => [
      { label: '启封黑箱', tone: 'ok', run: () => {
        openChestsOnCell([{ kind: 'medium', isClass: true }], '军方调拨的黑色职业宝箱');
      } },
    ],
    'ev19-recode': () => [
      { label: '接入重编台', detail:'选好卡牌后，亲手投骰决定同类型同稀有度的新卡', tone: 'ok', rolls:true, run: openEventRecode },
    ],
    'ev19-potions': () => [
      { label: '查看药摊', detail:'投骰抽出 3 瓶药水，再选择 1 瓶', tone: 'ok', rolls:true, deferConsume:true, run: openEventPotions },
    ],
    'ev19-arrows': () => [
      { label:'投骰打开弹药柜', tone:'ok', rolls:true, run:() => {
        const arrows = eventPool(['武术','法术','装备']).filter(c => /箭/.test(c.name) && c.rarity !== '职业' && !c.cls);
        drawEventCards(card.name,'arrows',[arrows,arrows], cards => finishEventRoll(() => rewards(...cards)));
      } },
    ],
    'ev19-gamble': () => [
      { label: '查看黑市货物', detail:'先投骰抽出货物；每次 3 币，1～3 点落空、4～6 点全拿，第 5 次保底', rolls:true, run: openEventGamble },
    ],
    'ev19-quartermaster': () => [
      { label: '支付 3 币', detail: (game.coins || 0) >= 3 ? '亲手投骰抽出 3 张装备，再选择 1 张' : `币不足（现有 ${game.coins || 0}）`, tone: (game.coins || 0) >= 3 ? 'ok' : 'danger', deferConsume:true, rolls:true, run: openEventQuartermaster },
      { label: '放弃征用', detail: '保留货币继续行进', run: settle(() => { UI.log('你没有签下军需征用单', 'dim'); }) },
    ],
  };
  if (V2[card.id]) return V2[card.id]();
  if (narrative) return narrative.choices.map(choice => {
    const narrate = () => {
      const result = choice.choose();
      if (result) UI.log(`[[icon:notes]] ${esc(result)}`, 'sys');
    };
    const effects = {
      goldmine_safe: settle(() => { narrate(); gainCoins(3); }),
      goldmine_deep: settle(() => { narrate(); gainCoins(6); game.hp = Math.max(1, game.hp - 3); UI.log('[[icon:tools]] 挖矿过深，获得 6 币但损失 3 血', 'warn'); }),
      airdrop_wood: () => { narrate(); rewards(SDT.Cards.all().find(x => x.id === 'tt-wood')); },   // 需求 #10：物资以卡牌入包
      airdrop_rations: () => { narrate(); rewards(SDT.Cards.all().find(x => x.id === 'tt-rations')); },
      airdrop_heal: settle(() => { narrate(); game.heal(3); }),
      chest_small: () => { narrate(); openChestsOnCell([{ kind: 'small' }], '你选择了稳妥的小型物资箱'); },
      chest_medium: () => { narrate(); openChestsOnCell([{ kind: 'medium' }], '你选择了高风险的密封物资箱'); },
      // timeskip_move（时空孔隙「前进 6 格」）已随 2026-09-19 老板定向从事件池摘除：
      // 卡库本就无 tt6-timeskip 事件卡，此 effect 入口一并退役（scenes 的 chainMove 守卫保留兜底）。
      relief_heal: settle(() => { narrate(); UI.log('[[icon:heart]] 爱心救济站为你处理了伤口', 'ok'); game.heal(6); }),
      mystery_supply: () => { narrate(); gainCoins(2); rewards(SDT.Cards.all().find(c => c.id === 'tt-token-color')); },
      systemsupply_restock: () => {
        narrate();
        const token = SDT.Cards.all().find(c => c.id === 'tt-token-color');
        const c = SDT.Cards.all().find(x => x.id === 'tt-wood');
        rewards(token, c);   // 需求 #10：物资以卡牌入包
      },
      demondeal_trade: settle(() => {
        narrate();
        game.hp = Math.max(1, game.hp - 1);
        UI.log('[[icon:demon]] 恶魔收走了一点生命力（-1 血）', 'warn');
        const legends = SDT.Cards.all().filter(c => c.rarity === '传说' && ['装备', '武术', '法术'].includes(c.type));
        grantEventCard(legends.length ? legends[Math.floor(Random.random('card') * legends.length)] : null);
      }),
      bandits_fight: async () => {   // 战斗与开箱路径自管收尾，不走 settle（同 chest_*）
        narrate();
        // 2026-09-11 实机定版：数量随层数缩放（第 1 层 3 只 → 第 3 层起 5 只）——
        // 此前固定 ×5，1-2 层新档（2 费 / 35 血 / 无 AOE）近乎必死
        const gangN = Math.min(5, 3 + game.layerIdx);
        UI.log(`[[icon:swords]] 反抗组织拾荒者一伙（×${gangN}）拦住了去路！`, 'warn');
        game.pendingEventLoot = { text: '密封物资箱 ×2', chests: ['medium', 'medium'] };
        game.state = 'modal';
        const tpl = MAP.monsters.bandit;
        const gang = [];
        for (let i = 0; i < gangN; i++) gang.push(scaledEnemy({ ...tpl }));
        await startBattle(game, gang, { isBoss: false, layer: game.layerIdx, name: tpl.name });
      },
      goldhammer_strike: async () => {
        narrate();
        const enc = MAP.encounters[game.layerIdx] || MAP.encounters[0];
        const tpl = MAP.monsters[enc.pool[Math.floor(Random.random('enemy') * enc.pool.length)]];
        const foe = scaledEnemy({ ...tpl });
        foe.hp -= 5;
        if (foe.hp <= 0) {
          UI.log(`[[icon:tools]] 闪金之锤一击制敌（${foe.name}）！+2 币`, 'coin');
          gainCoins(2);
          game.state = 'idle'; saveGame(); UI.refresh(game);
          return;
        }
        UI.log(`[[icon:tools]] 闪金之锤重击 <b>${esc(foe.name)}</b>（-5 血），战斗打响！`, 'warn');
        game.state = 'modal';
        await startBattle(game, [foe], { isBoss: false, layer: game.layerIdx, name: foe.name });
      },
    };
    return { label: choice.label, detail: choice.detail, tone: choice.tone, run: effects[choice.effect] || settle(narrate) };
  });
  return null;
}

// 事件效果结算（旧版单按钮路径：仅剩自定义/未迁移事件卡会走到这里，tt6 十事件已全部走 ink）
function applyEventEffect(card) {
  switch (card.id) {
    case 'cmtn7qttxqo4':   // 修鞋铺（2026-09-09 审计补实装）：获得员工通行证A碎片；复原 1 张卡牌
      game.fragments = (game.fragments || 0) + 1;
      UI.log(`[[icon:crystal]] 修鞋铺送了你一枚员工通行证A碎片（${game.fragments}/2）`, 'loot');
      // 2026-09-19 留言 #21：在事件本界面内复原，不再跳成「营火休整」页
      openPocketRestore(1, () => {
        game.state = 'idle';
        saveGame();
        UI.refresh(game);
      }, {
        tone: 'event', icon: '[[icon:tools]]', title: '修鞋铺 · 修整行装',
        sub: '老师傅替你修整行装。',
      });
      return;   // openPocketRestore 自管收尾
    default:
      UI.log('（该事件的效果将在后续版本实装）', 'dim');
  }
  game.state = 'idle';
  saveGame();
}

// ---------- 节点弹窗 ----------
