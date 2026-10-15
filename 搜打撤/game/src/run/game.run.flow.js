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
import { cancelLegacyChainMove, consumeCell, consumeCurrentCell, enterNode, finishInstant, grantEventCard, nodeOpt, nodeShell, openBattleCell, openChestsOnCell, openFixedRewardsOnCell, openPickupPage, openPocketRestore, openShop, preloadCellScene } from './game.run.scenes.js';
import { openDoorModal, openFireRest, openAltarRitual, openBossGate, openEmergencyModal, openEntrySupply } from './game.run.altar.js';
import { claimResourceReward, entrySupplyAt, entrySupplyGate, nodeActionBinding, resourceRewardAt } from './node-reward-state.js';
import { rewardExitHTML, rewardSceneHTML } from '../ui/reward-scene-view.js';
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
      renderScheduler.invalidate();
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
    renderScheduler.invalidate();
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
  // 击败后的巢穴不可再战（重打首脑会反复领传说保底），按 bossKilled 拦截而非 visited
  //（离开未击败的首脑格也会被 moveTo 写 visited，不能据此锁格）。
  if (def && def.type === 'boss' && game.bossKilled) {
    UI.log('[[icon:skull]] 首脑已被击破，巢穴已经空了', 'dim');
    UI.beginRoom(); openSafeNode();
    return;
  }

  // 杀戮尖塔式房间切换：从落脚开始到本格全部结算完成，地图始终由全屏房间页取代。
  UI.beginRoom();
  game.state = 'modal';

  // 1) 战斗格：抵达后直接进入战场。
  if (def && def.type === 'battle') {
    setBagReturnHook(null);
    UI.hideOverlay();
    openBattleCell(def);
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

// 物资格（2026-09-16 Item 17 定版）：按爆率（与商店/宝箱同源权重）刷新 2 张随机资源卡，二选一带走
function openResourcePick(done) {
  const weights = SDT.Cards.DROP_WEIGHTS;
  const pool = SDT.Cards.all().filter(c => c.type === '资源' && SDT.Cards.isRandomObtainable(c));
  const pickOne = (taken) => {
    const avail = pool.filter(c => !(taken && taken.has(c.name)));
    const total = avail.reduce((sum, c) => sum + (weights[c.rarity] || 2), 0);
    if (!total) return null;
    let roll = Random.random('loot') * total;
    for (const c of avail) { roll -= (weights[c.rarity] || 2); if (roll <= 0) return c; }
    return avail[avail.length - 1] || null;
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
      openPickupPage('wood', `木材卡 ×${cnt}`, () => {
        for (let i = 0; i < cnt && card; i++) grantEventCard(card);
        done();
      });
    } break;
    // 物资点：搜索建筑内遗留物资，70% 小宝箱（随机 1 张）/ 30% 中宝箱（3 选 1）。
    case 'chest': openNodeDecision({ tone:'pickup', title:'遗留物资', sub:'你闯进一间废弃配送站。敞开的柜门和散落的包装之间，或许还有值得带走的东西。',
      act:'nodeChestSearch', label:'搜索物资', detail:'翻找遗留的箱柜，查看可领取的卡牌',
      run:() => openChestsOnCell([Random.random('loot') < 0.7 ? { kind:'small' } : { kind:'medium' }], null, { resourceOnly:true, consumeNode:true }) }); break;
    // 物资格（2026-09-16 Item 17 定版）：按爆率刷新 2 张随机资源卡，二选一带走
    case 'resource': openResourcePick(done); break;
    case 'rations': {
      // 2026-09-06 #11：口粮同样以卡牌形式入包
      const card = SDT.Cards.all().find(c => c.id === 'tt-rations');
      const cnt = MAP.items.rations.count || 1;
      openPickupPage('rations', `口粮卡 ×${cnt}`, () => {
        for (let i = 0; i < cnt && card; i++) grantEventCard(card);
        done();
      });
    } break;
    case 'key': {
      // 2026-09-09 老板 #1：物资点资源一律以卡牌形式入包（钥匙与木材/口粮同口径）
      const card = SDT.Cards.all().find(c => c.id === 'tt-key');
      openPickupPage('key', `钥匙卡 ×1`, () => {
        if (card) grantEventCard(card);
        done();
      });
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
  const current = captureEventContext();
  if (!await enterNode('event', () => true)) return;
  if (!current()) return;
  if (await tryLastLampEvent()) return;
  if (!current()) return;
  const deck = SDT.Cards.all().filter(c => c.type === '事件');
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
  return triggerEventCard(pick(deck), current);
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
  const renderEventPage = () => {
    if (evtSettled || !current()) return;
    game.state = 'modal';
    setBagReturnHook(renderEventPage);
    nodeShell({
      tone: 'event', asset: sceneMeta[2], icon: '[[icon:dice]]', title: card.name,
      sub: esc((narrative && narrative.intro) || card.desc || '神秘事件发生了……'),
      body: optHTML,
      foot:'<button class="ov-btn" data-act="evtBag">整理背包</button><p class="reward-notice" data-event-capacity role="status"></p>',
    });
    const active = eventPageBinding(choices ? 'evtChoice' : 'evtNext', current);
    UI.act('evtChoice', (d) => {
      if (!choices || evtSettled || !active()) return;
      const choice = choices[+d.i];
      if (!choice) return;
      if (choice.canRun && !choice.canRun()) {
        const notice = UI.el?.ovBody?.querySelector('[data-event-capacity]');
        if (notice) notice.textContent = '背包放不下木材卡，碎片和本次选择已保留；请先整理背包，或改选碎片与2币。';
        SDT.Sound.sfx('deny');
        return;
      }
      evtSettled = true;
      setBagReturnHook(null);
      UI.hideOverlay();
      consumeCurrentCell();
      choice.run();
      if (game.state !== 'modal') finishInstant();   // 选项未自开新页时兜底收尾（幂等）
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
    UI.act('evtBag', () => { if (!evtSettled && active()) bagSlots.showBackpack(); });
    UI.refresh(game);
  };
  renderEventPage();
}

function eventPool(types) {
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  return SDT.Cards.all().filter(c => wanted.has(c.type) && SDT.Cards.isRandomObtainable(c));
}

function uniqueEventPicks(pool, count) {
  const bag = [...pool];
  const out = [];
  while (bag.length && out.length < count) {
    const at = Math.floor(Random.random('event') * bag.length);
    const picked = bag.splice(at, 1)[0];
    if (picked && !out.some(c => c.id === picked.id || c.name === picked.name)) out.push(picked);
  }
  return out;
}

function closeEventFlow() {
  setBagReturnHook(null);
  UI.hideOverlay();
  game.state = 'idle';
  saveGame();
  UI.refresh(game);
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

function openEventCardChoice(args, transaction = null) {
  const txn = transaction || { picked: false, current: captureEventContext() };
  if (txn.picked || !txn.current()) return;
  const { title, sub, cards, action = '选择获得', onPick, asset = 'scene-event-custom-a' } = args;
  game.state = 'modal';
  const list = (cards || []).filter(Boolean);
  if (!list.length) {
    UI.log(`【${esc(title)}】可用卡池为空，本次未获得卡牌`, 'warn');
    closeEventFlow();
    return;
  }
  // 背包返回恢复本页（09-30 深审 WORLD-003）：二级选卡页此前无返回钩子，装备征用令等
  // 已扣款页关一次背包就丢失候选与奖励（节点已消耗、重进不来）。重开不重扣、不重消耗。
  setBagReturnHook(() => openEventCardChoice(args, txn));
  nodeShell({
    tone: 'event', asset, icon: '[[icon:cards]]', title,
    sub,
    body: `<div class="bt-hand event-choice-hand">${list.map((card, i) => `
      <button type="button" class="bt-card event-choice-card" data-act="eventCardPick" data-i="${i}" aria-label="${escAttr(action)}：${escAttr(card.name)}">
        ${SDT.Cards.cardHTML(card, 'sm')}
      </button>`).join('')}</div>
      <p class="loot-footer-note">点击一张卡牌${action}</p>`,
  });
  const active = eventPageBinding('eventCardPick', txn.current);
  UI.act('eventCardPick', (d) => {
    if (txn.picked || !active()) return;
    const card = list[+d.i];
    if (!card || (onPick ? onPick(card) === false : !grantEventCard(card))) return;
    txn.picked = true;
    closeEventFlow();
  });
  UI.refresh(game);
}

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
  const eligible = game.ownedCards.filter(o => o && o.card && !o.safe && !o.stored && transformCandidates(o.card).length);
  const need = Math.min(2, eligible.length);
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
    UI.act('eventRecodeLeave', () => { if (!settled && active()) { settled = true; closeEventFlow(); } });
    UI.act('eventRecodeGo', () => {
      if (settled || !active() || selected.size !== need) return;
      settled = true;
      for (const uid of selected) {
        const entry = game.ownedCards.find(o => o.uid === uid);
        if (!entry) continue;
        const before = entry.card;
        const pool = transformCandidates(before);
        if (!pool.length) continue;
        const after = pool[Math.floor(Random.random('card') * pool.length)];
        entry.card = { ...after };
        UI.log(`[[icon:recycle]] 【${esc(before.name)}】重编为同类型同稀有度的【${esc(after.name)}】`, 'loot');
      }
      SDT.Sound.sfx('recodeComplete');
      closeEventFlow();
    });
    UI.refresh(game);
  };
  render();
}

function openEventPotions() {
  const pool = eventPool('道具').filter(c => /药水/.test(c.name));
  openEventCardChoice({
    title: '避难市集药摊', asset: 'scene-event-potions',
    sub: '污染区药师只能保住一瓶——从 3 瓶随机药水中选择 1 瓶。',
    cards: uniqueEventPicks(pool, 3),
  });
}

function openEventQuartermaster() {
  const cards = uniqueEventPicks(eventPool('装备'), 3);
  if (!spendEventCoins(3, '军需征用')) { closeEventFlow(); return; }
  openEventCardChoice({
    title: '装备征用令', asset: 'scene-event-quartermaster',
    sub: '已支付 3 币。从军需官摆出的 3 件装备中选择 1 件。', cards,
  });
}

function openEventGamble() {
  game.state = 'modal';
  const equip = uniqueEventPicks(eventPool('装备'), 1);
  const moves = uniqueEventPicks(eventPool(['武术', '法术']), 2);
  const prizes = [...equip, ...moves];
  let attempts = 0;
  let settled = false;
  const current = captureEventContext();
  const render = (lastMiss = false) => {
    if (settled || !current()) return;
    game.state = 'modal';
    setBagReturnHook(() => render(lastMiss));
    nodeShell({
      tone: 'event', asset: 'scene-event-gamble', icon: '[[icon:dice]]', title: '地下商场黑市',
      sub: `每次投入 <b>3 币</b>，有 <b>50%</b> 概率拿走全部三张卡；第 <b>5</b> 次必定成功。已尝试 ${attempts}/5 次。${lastMiss ? '<br><b class="danger">指示灯变红，这次什么也没拿到。</b>' : ''}`,
      body: `<div class="bt-hand event-choice-hand">${prizes.map(c => `<div class="bt-card">${SDT.Cards.cardHTML(c, 'sm')}</div>`).join('')}</div>
        <div class="scene-ops"><button class="ov-btn" data-act="eventGambleLeave">放弃并离开</button><button class="ov-btn ok" data-act="eventGambleTry" ${(game.coins || 0) < 3 || !prizes.length ? 'disabled' : ''}>[[icon:coin]] 投入 3 币${attempts === 4 ? '（本次保底）' : ''}</button></div>`,
    });
    const active = eventPageBinding('eventGambleTry', current);
    UI.act('eventGambleLeave', () => { if (!settled && active()) { settled = true; closeEventFlow(); } });
    UI.act('eventGambleTry', () => {
      if (settled || !active() || !spendEventCoins(3, '黑市抽签')) return;
      attempts++;
      const hit = attempts >= 5 || Random.random('event') < 0.5;
      if (!hit) { SDT.Sound.sfx('blackMarketLose'); render(true); return; }
      settled = true;
      SDT.Sound.sfx('blackMarketWin');
      prizes.forEach(c => grantEventCard(c));
      UI.log(`[[icon:sparkles]] 黑市闸门弹开：第 ${attempts} 次投币成功，获得 1 张装备与 2 张招式`, 'loot');
      closeEventFlow();
    });
    UI.refresh(game);
  };
  if (prizes.length < 3) {
    UI.log('[[icon:cards]] 黑市货架无法生成完整的三张奖品', 'warn');
    closeEventFlow();
    return;
  }
  render(false);
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
      { label: '接收补给', detail: '获得员工通行证A碎片，+2 币', tone: 'ok', run: settle(() => { gainFragment(); gainCoins(2); }) },
    ],
    'tt6-systemsupply': () => {
      const wood = SDT.Cards.all().find(c => c.id === 'tt-wood');
      return [
        { label:'碎片与木材', detail:'获得员工通行证A碎片 ×1，木材卡 ×1；需背包能放下木材卡', tone:'ok',
          canRun:() => !!wood && game.canReceiveCard(wood),
          run:settle(() => { grantEventCard(wood); gainFragment(); }) },
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
      const potion = potionPool.length ? potionPool[Math.floor(Random.random('loot') * potionPool.length)] : null;
      const woodCard = SDT.Cards.all().find(c => c.id === 'tt-wood');
      const rationCard = SDT.Cards.all().find(c => c.id === 'tt-rations');
      return [
        { label: '木材', detail: '木材卡 ×1', run: () => rewards(woodCard) },   // 需求 #10：物资一律以卡牌入包
        { label: '口粮', detail: '口粮卡 ×1', run: () => rewards(rationCard) },
        { label: '能量饮料', detail: '回复 6 血', tone: 'ok', run: settle(() => { game.heal(6); UI.log('[[icon:heart]] 一罐能量饮料下肚，回复 6 点生命', 'ok'); }) },
        { label: '随机药水', detail: potion ? `获得【${potion.name}】：${potion.desc || '效果见卡牌说明'}` : '（补给已耗尽）', tone: 'ok', run: () => rewards(potion) },
      ];
    },
    'tt6-chestdraw': () => [
      { label: '开箱', detail: '从大、中、小宝箱中随机抽取 1 个', tone: 'ok', run: () => {
        const kinds = ['large', 'medium', 'small'];
        const kind = kinds[Math.floor(Random.random('loot') * kinds.length)];
        openChestsOnCell([{ kind }], '你撬开了一个未知的箱子');
      } },
    ],
    'tt6-goldhammer': () => [
      { label: '查看并领取', detail: '获得卡牌「闪金之锤」；放不下时可先整理背包', tone: 'ok', run: () => rewards(SDT.Cards.all().find(c => c.id === 'cmtn0xt0zr7')) },
    ],
    'ev19-vital': () => [
      { label: '接受强化急救', detail: '生命上限 +3，并回复 3 点生命', tone: 'ok', run: settle(() => {
        game.maxHp += 3; game.hp += 3;
        UI.log(`[[icon:heart]] 强化药剂生效：生命上限 +3（${game.hp}/${game.maxHp}）`, 'ok');
      }) },
    ],
    'ev19-pearlbox': () => [
      { label: '取走珍珠匣', detail: '获得卡牌「珍珠盒」', tone: 'ok', run: () => rewards(SDT.Cards.all().find(c => c.id === 'tt2-pearlbox')) },
    ],
    'ev19-fireballs': () => [
      { label: '接收封装火种', detail: '获得两张「火球」', tone: 'ok', run: () => {
        const fireball = SDT.Cards.all().find(c => c.id === 'tt3-fireball');
        rewards(fireball, fireball);
      } },
    ],
    'ev19-classchest': () => [
      { label: '启封黑箱', detail: '开启 1 个职业·密封物资箱', tone: 'ok', run: () => {
        openChestsOnCell([{ kind: 'medium', isClass: true }], '军方调拨的黑色职业宝箱');
      } },
    ],
    'ev19-recode': () => [
      { label: '接入重编台', detail: '选择 2 张招式或装备卡进行同稀有度同类型转换', tone: 'ok', run: openEventRecode },
    ],
    'ev19-potions': () => [
      { label: '查看药摊', detail: '从 3 瓶随机药水中选择 1 瓶', tone: 'ok', run: openEventPotions },
    ],
    'ev19-arrows': () => [
      { label: '打开弹药柜', detail: '获得 2 张随机非职业箭系列卡', tone: 'ok', run: () => {
        const arrows = uniqueEventPicks(eventPool(['武术', '法术', '装备']).filter(c => /箭/.test(c.name) && c.rarity !== '职业' && !c.cls), 2);
        rewards(...arrows);
      } },
    ],
    'ev19-gamble': () => [
      { label: '查看黑市货物', detail: '每次 3 币，50% 概率，第 5 次保底；可随时放弃', run: openEventGamble },
    ],
    'ev19-quartermaster': () => [
      { label: '支付 3 币', detail: (game.coins || 0) >= 3 ? '从 3 张装备卡中选择 1 张' : `币不足（现有 ${game.coins || 0}）`, tone: (game.coins || 0) >= 3 ? 'ok' : 'danger', run: openEventQuartermaster },
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
        sub: '老师傅顺手替你把装备修好了——可以从消耗区复原 <b>1</b> 张卡牌（点击卡面复原）',
      });
      return;   // openPocketRestore 自管收尾
    default:
      UI.log('（该事件的效果将在后续版本实装）', 'dim');
  }
  game.state = 'idle';
  saveGame();
}

// ---------- 节点弹窗 ----------
