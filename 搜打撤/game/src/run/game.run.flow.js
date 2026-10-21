/* ============================================================
 * game.run.flow.js —— 走格子主流程：移动事务、落脚结算、即时/事件节点（架构批次 4）
 *
 * 由 game.run.js 拆出。层位最高（L2）：依赖 scenes（L0）与 altar（L1），不被二者依赖。
 * ============================================================ */
import { MAP, cellCenter, curLayer, gainCoins, game, getActiveSlot, markSeen, modeCfg, pick, saveGame, scaledEnemy, weighted } from './game.session.js';
import { Random } from '../core/random.js';
import { _set_cardPageOpen } from '../hub/game.cardslib.js';
import { RunStorage } from '../hub/game.storage.js';
import { bagSlots } from '../hub/game.bag.bridge.js';
import { setBagReturnHook } from '../hub/bag-return-hook.js';
import { captureBattleContext, startBattle } from '../battle/battle-loader.js';
import { isTurbo } from '../core/turbo.js';
import { renderScheduler } from '../core/render-scheduler.js';
import { findMapTravelPath, setMapTravelPresentation } from './map-travel-path.js';
import { createTravelMotion, createArrivalFeedback } from './map-travel-motion.js';
import { showLayerPassage, isLayerPassageActive } from '../ui/map-passage.js';
import { cancelLegacyChainMove, consumeCell, consumeCurrentCell, enterNode, finishInstant, grantEventCard, nodeOpt, nodeShell, openBattleCell, openChestsOnCell, openFixedRewardsOnCell, openPickupPage, openPocketRestore, openShop, preloadCellScene, resumeChestsOnCell } from './game.run.scenes.js';
import { openDoorModal, openFireRest, openAltarRitual, openBossGate, openEmergencyModal, openEntrySupply, resumeNodeRestore } from './game.run.altar.js';
import { entrySupplyAt, entrySupplyGate, nodeActionBinding } from './node-reward-state.js';
import { createEventCardChoiceController } from './event-card-choice.js';
import { createEventLifecycle, createLazyEventEntry } from './event-lifecycle.js';
import { nodeChestRewardAt } from './chest-reward-save.js';
import { createRunResourceController } from './game.run.resources.js';
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
  if (game.state !== 'idle' || activeMove || isLayerPassageActive(game)) return false;
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
  let passage = null, passageWaiting = false, passageFinished = false;
  const clock = () => performance.now();
  const startedAt = clock();
  let previousAt = startedAt;
  const frame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame : cb => setTimeout(() => cb(clock()), 16);
  const cleanup = () => {
    if (watchdog != null) clearTimeout(watchdog);
    if (arrival != null) clearTimeout(arrival);
    passage?.dispose();
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
    if (!reduced && from.li !== to.li) passage = showLayerPassage(game, from.li, to.li);
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
    if (passage && !passageFinished) {
      if (!passageWaiting) {
        passageWaiting = true;
        passage.done.then(() => { passageFinished = true; resolveArrival(); });
      }
      return;
    }
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
  if (game.state !== 'idle' || activeMove || isLayerPassageActive(game)) return false;
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

let resources;
function openResourcePick(done) {
  resources ||= createRunResourceController({ game, UI, dom:document, getCards:() => SDT.Cards,
    rich:html => SDT.Icons.rich(html), saveGame,
    captureRunContext:() => captureBattleContext(game, getActiveSlot), grantEventCard,
    consumeCurrentCell, setBagReturnHook, bagSlots });
  return resources.openResourcePick(done);
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

// Pending choices remain synchronous; ordinary event content loads only on entry.
let events;
function eventController() {
  if (events) return events;
  const ports = {
    game, UI, SDT, dom:document, MAP, getCards:() => SDT.Cards, sound:key => SDT.Sound.sfx(key),
    serializeReward:state => SDT.Chests?.serialize?.(state), gainCoins,
    createCardChoice:options => createEventCardChoiceController({ ...options, SDT }),
    captureRunContext:() => captureBattleContext(game, getActiveSlot),
    getActiveSlot, saveGame, RunStorage, setCardPageOpen:value => _set_cardPageOpen(value),
    pick:items => pick(items), weighted:items => weighted(items),
    scaledEnemy:enemy => scaledEnemy(enemy),
    nodeShell:spec => nodeShell(spec), nodeOpt:(...args) => nodeOpt(...args),
    enterNode:(...args) => enterNode(...args), consumeCurrentCell:() => consumeCurrentCell(),
    finishInstant:(...args) => finishInstant(...args), cancelLegacyChainMove:() => cancelLegacyChainMove(),
    grantEventCard:(...args) => grantEventCard(...args),
    openFixedRewardsOnCell:(...args) => openFixedRewardsOnCell(...args),
    openChestsOnCell:(...args) => openChestsOnCell(...args), openPocketRestore:(...args) => openPocketRestore(...args),
    setBagReturnHook, bagSlots, startBattle:(...args) => startBattle(...args),
  };
  const lifecycle = createEventLifecycle(ports);
  return events = createLazyEventEntry({ ...ports, lifecycle,
    load:() => import('./event-runtime.js'),
    create:module => module.createRunEventRuntime(ports, lifecycle),
  });
}
export async function runEventDeck() { return eventController().runEventDeck(); }
export function resumeEventCardChoice() { return eventController().resumeEventCardChoice(); }
