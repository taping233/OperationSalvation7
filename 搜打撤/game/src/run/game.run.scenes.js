/* ============================================================
 * game.run.scenes.js —— 局内场景壳、节点词汇与拾取/开箱页（架构批次 4）
 *
 * 由 game.run.js 拆出。层位最底（L0）：只依赖会话/数据/UI 模块，
 * 不依赖 altar / flow；ALTAR 与 FLOW 反向依赖本文件。
 * 内容：场景预加载与整页壳（nodeShell/nodeOpt）、
 *       行军转场、即时节点落定、拾取页、战斗/搜刮点格、事件发牌、火堆复原页。
 * 商店控制器也在此装配（openShop 唯一实例，供 ALTAR/FLOW 复用）。
 * ============================================================ */
import { esc, escAttr } from '../core/shared.js';
import { playOutcomeFeedback } from '../ui/outcome-feedback.js';
import { createRoomCheckpoint } from '../ui/room-actions.js';
import { createCardInstance } from '../cards/card-instance.js';
import { MAP, bagCap, game, newUid, pick, saveGame, scaledEnemy, usedSlots } from './game.session.js';
import { _set_cardPageOpen, cardHTML } from '../hub/game.cardslib.js';
import { IMMEDIATE_SCENES, NODE_BG, PICKUP_BG, PRELOAD_SCENES, SCENES, WINTER_BATTLE_LAYERS } from './game.run.data.js';
import { Random } from '../core/random.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { hashSeed } from '../core/random-core.js';
import { createShopController } from './game.run.shop.js';
import { captureBattleContext, ensureBattleReady, startBattle } from '../battle/battle-loader.js';
import { setBagReturnHook } from '../hub/bag-return-hook.js';
import { bagSlots } from '../hub/game.bag.bridge.js';
import { nodeActionBinding, nodeContentEndedAt } from './node-reward-state.js';
import { claimNodeRestore, finishNodeRestore, nodeRestoreAt } from './node-restore-state.js';
import { selectEncounterSpec } from './encounter-selector.js';
import { turboMs } from '../core/turbo.js';
import { usePlainBattleTransition } from '../ui/transition-diagnostic-policy.js';
import { reduceMotion } from '../core/motion.js';
import { cityCutDuration, prepareCityCut } from '../ui/camp-entry.js';
import { createSilentNodeCut, SILENT_FILMS, silentFilmRemaining } from '../ui/silent-node-film.js';
import { cinematicKind } from '../ui/cinematic-profiles.js';
import { createPageSurfaceLifetime } from '../ui/page-surface-lifetime.js';
import { prepareTransition } from '../ui/transition-preparation.js';
import { motionTiming } from '../ui/motion-presets.js';
import { revealTransition, transitionPause } from '../ui/transition-handoff.js';
import { TRANSITION_ART } from '../ui/transition-art.js';
import { disposeEventChoiceSelection, wireEventChoiceSelection } from '../ui/event-choice-selection.js';
import { invokeUiAction } from '../ui/action-dispatch.js';
import { syncViewChildren } from '../ui/view-children-sync.js';
import { eventSceneHTML } from '../ui/node-scene-view.js';
import '../../css/entry-events.css';
import '../../css/expedition-transitions.css';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;

// ---------- 商店（全流程唯一实例：ALTAR 的层间门与 FLOW 的商店格都通过 import 复用） ----------
export const { openShop } = createShopController({
  UI,
  SDT,
  game,
  bagCap,
  cardHTML,
  newUid,
  saveGame,
  setCardPageOpen: _set_cardPageOpen,
  usedSlots,
});

export function cancelLegacyChainMove(reason = '即时事件不再自动跳转') {
  const steps = Math.max(0, Number(game.chainMove) || 0);
  if (!steps) return false;
  game.chainMove = 0;
  UI.log(`[[icon:map]] ${reason}（原计划前进 ${steps} 格）`, 'sys');
  return true;
}

// ---------- 落脚结算 ----------
// ---------- 场景演出（v0.10：不同格子进入不同场景，少量对话后开启内容） ----------
let scenePreload = null;
function preloadScene(name) {
  if (!name || (scenePreload && scenePreload.name === name)) return;
  const img = new Image();
  img.decoding = 'async';
  img.src = name;
  scenePreload = { name, img };
  if (img.decode) img.decode().catch(() => {});
}
export function preloadCellScene(layer, idx) {
  if (!layer?.logical) return;
  const cell = layer.logical[idx];
  const cellType = cell && cell.def && cell.def.type;
  const door = (layer.doors || []).some(d => d.at === idx);
  const altar = (layer.altarEntrances || []).some(a => a.at === idx);
  const immediate = IMMEDIATE_SCENES.has(cellType);
  const type = immediate ? cellType : door ? 'door' : altar ? 'altar' : cellType;
  if (['battle', 'boss', 'bossGeneral', 'bossOrc', 'bossElement'].includes(type)) {
    preloadSceneList([...WINTER_BATTLE_LAYERS, TRANSITION_ART.retreat]);
  } else {
    preloadScene(PRELOAD_SCENES[type]);
    preloadSceneList([TRANSITION_ART[type]]);
  }
}
// 兼容旧调用：只预载最常见的即时节点，不再一次吞入全部事件背景。
// 其他房间由 preloadCellScene 在路线确认时按目标格预取。
const _preloaded = new Set();
function preloadSceneList(urls) {
  urls.forEach(url => {
    if (!url || _preloaded.has(url)) return;
    _preloaded.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    if (img.decode) img.decode().catch(() => {});
  });
}
export function preloadAllNodeShellBgs() {
  preloadSceneList(Array.from(IMMEDIATE_SCENES, key => PRELOAD_SCENES[key]).filter(Boolean));
}
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return;
  const root = UI.el?.ovBody?.querySelector('.event-scene[data-event-choice-count]');
  if (!root?.querySelector('.evt-opt.is-selected')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  /** @type {HTMLElement & {_clearEventChoice?: () => void}} */ (root)._clearEventChoice?.();
}, true);
// 节点共享场景／叙事与决策两区；只有事件启用原有选择确认机制。
// o = { tone: 场景分色(sc-*), icon, title, sub, body, foot, asset: 背景图 asset-key（缺省按 tone 映射） }
const nodeShellPages = new WeakMap();
export function nodeShell(o) {
  const bg = o.asset || NODE_BG[o.tone] || '';
  const html = eventSceneHTML({ ...o, asset: bg, region: game.layerData?.[game.layerIdx]?.name, layer: game.layerIdx });
  const body = UI.el?.ovBody, overlay = UI.el?.overlay;
  let root = body?.firstElementChild;
  const previous = root && nodeShellPages.get(root);
  const key = JSON.stringify([game.seed, game.mapSeed, game.turn, game.layerIdx, game.trackPos, o.tone, bg, o.title]);
  const retained = previous && previous.key === key && previous.run === game.discoveredPairs
    && previous.map === game.layerData && previous.body === body && previous.overlay === overlay
    && previous.revision === UI._overlayRevision && UI._lastMode === 'page'
    && root.isConnected && root.matches('.event-scene') && overlay && !overlay.hidden && !overlay.inert
    && !overlay.classList.contains('closing') && !overlay.dataset.uiClosing;
  // A result or retry updates this business page without replacing its scene,
  // background readiness or source owner. Real navigation keeps the full entry path.
  disposeEventChoiceSelection(root);
  if (retained) {
    const template = body.ownerDocument.createElement('template');
    template.innerHTML = SDT.Icons?.rich?.(html) || html;
    const next = template.content.firstElementChild;
    for (const name of ['data-event-choice-count', 'data-music-scene']) {
      if (next.hasAttribute(name)) root.setAttribute(name, next.getAttribute(name));
      else root.removeAttribute(name);
    }
    syncViewChildren(root, next);
  } else {
    UI.showOverlay('', html, 'page');
    root = UI.el?.ovBody?.firstElementChild;
  }
  if (root) nodeShellPages.set(root, { key, run:game.discoveredPairs, map:game.layerData,
    body:UI.el?.ovBody, overlay:UI.el?.overlay, revision:UI._overlayRevision });
  // 事件体系页（事件/入城/火堆/物资点）：左上退出键（IS7 事件整页语言，样式复用地图
  // #topBtns 按钮族）——事件未消耗可原节点重进；入城退出保留剩余卡，领完才解锁移动。
  // 金币/攻击由 #resHud 经 CSS 提层常驻，不经页面重画。
  if (['event', 'entry', 'fire', 'pickup'].includes(o.tone)) {
    const key = `${game.mapSeed}|${game.turn}|${game.layerIdx},${game.trackPos}|${o.title}|${bg}|${o.sub || ''}`;
    if (o.tone === 'event') {
      if (root) wireEventChoiceSelection(root, key, game.discoveredPairs || game.layerData || game,
        option => invokeUiAction(UI, option));
    }
    UI.act('eventExit', () => {
      if (game.state !== 'modal') return;
      const page = /** @type {HTMLElement} */ (UI.el?.ovBody?.querySelector('.event-scene'));
      if (!page) return;
      if (page.dataset.eventChoiceBusy === 'true') return;
      /** @type {HTMLElement & {_clearEventChoice?: () => void}} */ (page)._clearEventChoice?.();
      return finishInstant();
    });
  }
}
// 杀戮尖塔式选项条：主标题 + 后果说明（复用事件页 .evt-opt 样式）
export function nodeOpt(act, label, detail, tone = '', extra = '') {
  return `<button class="evt-opt ${tone}" data-act="${act}" ${extra}><b>${label}</b>${detail ? `<span>${detail}</span>` : ''}</button>`;
}

export function consumeCell(layerIdx = game.layerIdx, trackPos = game.trackPos) {
  game.visited = game.visited || {};
  game.visited[`${layerIdx},${trackPos}`] = 1;
}

export function consumeCurrentCell() { consumeCell(); }

// 新增局内过场统一从此入口接入；文字样式由 transition-heading 与公共 CSS 维护。
let transitionRequest = 0;
/**
 * @param {object} options
 * @param {string} options.title 无障碍场景名称；过场不显示标题或解释文案。
 * @param {string} [options.art] 已导入的图片 URL；不传则显示公共暗色底。
 * @param {number} [options.duration] 原流程的停留时间（ms）。
 * @param {string} [options.tone]
 * @param {string} [options.asset] 兼容既有场景资源键。
 * @param {string} [options.eyebrow] 既有基地抵达表现使用。
 * @param {string} [options.detail] 标准过场保留为无障碍说明。
 * @param {string} [options.presentation] 既有切幕运动/基地抵达兼容选项。
 * @param {string} [options.scene] 既有切幕选图。
 * @param {boolean} [options.holdVisual]
 * @param {boolean} [options.resumeVisual]
 * @param {Function} [options.prepare]
 */
export function showRunTransition({ tone = 'battle', asset = 'scene-battle-bg', title, detail = '', duration = cityCutDuration, presentation = 'node-cut', scene = '', art = '', holdVisual = false, resumeVisual = false, prepare }) {
  // 结束时必须恢复状态：战斗/节点流程下游会自行改状态，但「继续对局」路径
  // 过渡后无人收拾，曾导致 game.state 卡死在 modal、侧栏按钮永久禁用
  const prevState = game.state;
  const currentContext = captureBattleContext(game);
  const request = ++transitionRequest;
  let lifetime = null, cancelTransition = null;
  const isCurrent = () => currentContext() && request === transitionRequest && (!holdVisual || !lifetime || lifetime.current());
  const filmKind=cinematicKind({scene,tone,presentation});
  const plainCut = usePlainBattleTransition(import.meta.env.DEV, location.search, tone, presentation);
  // Business dwell/skip stays here; the shared handoff owns artwork readiness and playback.
  let heldSurface = null;
  let automaticReveal = Promise.resolve(true);
  let filmPlayback=Promise.resolve(true);
  game.state = 'modal';
  const transition = new Promise(resolve => {
    let done = false;
    let timer = null;
    let surface = null;
    cancelTransition = () => { if (done) return; done = true; clearTimeout(timer); resolve(false); };
    const finish = (skip = false) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (!isCurrent()) { lifetime?.dispose(); resolve(false); return; }
      // 过场只拥有自己挂载的画面；迟到回调不能关掉已打开的背包或新页面。
      if (surface && (!surface.isConnected || !UI.el.ovBody.contains(surface) || (lifetime && !lifetime.current()))) { lifetime?.dispose(); resolve(false); return; }
      const complete = () => {
        if (!isCurrent() || !surface?.isConnected || !UI.el.ovBody.contains(surface)) { resolve(false); return; }
        if (!holdVisual) { lifetime?.dispose(); UI.hideOverlay({ immediate:true }); }
        // 战斗 modal 态不能被过场降级为 idle。
        game.state = (prevState === 'modal' && !game.battleActive) ? 'idle' : prevState;
        resolve(true);
      };
      if (!holdVisual && !skip) automaticReveal.then(complete, () => resolve(false));
      else if (!skip && !resumeVisual) filmPlayback.then(complete,() => resolve(false));
      else complete();
    };
    const cut=plainCut ? null : createSilentNodeCut(filmKind,{duration:turboMs(duration),art});
    if (cut && !holdVisual) cut.classList.add('page-cut-waiting');
    UI.showOverlay('', `<div class="scene flow-transition city-run-transition${holdVisual && !resumeVisual ? ' resume-hold' : ''} sc-${escAttr(tone)}"
      data-asset-key="${escAttr(asset)}" data-presentation="${presentation==='base-arrival' ? 'base-arrival' : 'city-cut'}" data-act="flowContinue" role="group"
      aria-label="${escAttr(`${title || SILENT_FILMS[filmKind]?.label || '进入区域'}。${detail}。点击跳过`)}"
      style="--city-run-duration:${turboMs(duration)}ms">${cut?.outerHTML || ''}</div>`, 'scene');
    UI.act('flowContinue', () => finish(true));
    surface = UI.el.ovBody?.querySelector('.flow-transition');
    heldSurface = surface;
    if (resumeVisual && surface) surface.dataset.handoffProfile = 'resume';
    timer = setTimeout(finish, reduceMotion() || resumeVisual ? 0 : turboMs(duration));
    UI.refresh(game);
  });
  if (heldSurface && UI.el.overlay) lifetime = createPageSurfaceLifetime(heldSurface, {
    overlay: UI.el.overlay, onInvalidate: () => cancelTransition?.(),
  });
  const preparation = prepareTransition(prepare, { signal: lifetime?.signal, isCurrent });
  // Resume artwork loads alongside restoration, rather than after the map is ready.
  const heldArtwork = heldSurface?.querySelector('.camp-entry-cut');
  const resumeArtwork = heldArtwork ? prepareCityCut(heldArtwork, { signal:lifetime?.signal }) : Promise.resolve(true);
  filmPlayback=resumeArtwork.then(async ok => {
    if (ok && heldArtwork && !resumeVisual) await transitionPause(silentFilmRemaining(heldArtwork),lifetime?.signal);
    return ok;
  });
  if (!holdVisual && heldSurface) automaticReveal = revealTransition(heldSurface, {
    signal:lifetime?.signal, isCurrent, duration:turboMs(duration),
    ready:async () => {
      const cut = heldSurface.querySelector('.camp-entry-cut');
      const results = await Promise.all([preparation, cut ? resumeArtwork : true]);
      return results[1];
    },
  });
  // resolve 与消费者的 then/await 之间仍可能启动新过场；保留该次只读核验。
  const ownsSurface = () => request === transitionRequest && heldSurface?.isConnected
    && UI.el.ovBody.contains(heldSurface);
  const release = async ({ immediate = false } = {}) => {
    if (!holdVisual || !ownsSurface()) return;
    if (!immediate) await revealTransition(heldSurface, { isCurrent:ownsSurface, painted:true,
      ready:() => {
        if (resumeVisual) return resumeArtwork;
        const cut = heldSurface.querySelector('.camp-entry-cut');
        return cut ? prepareCityCut(cut, { signal:lifetime?.signal }) : true;
      } });
    // 恢复战斗/奖励/选角可能已经换页，只收起本次续局自己的过场。
    if (ownsSurface()) UI.hideOverlay({ immediate: true });
  };
  return Object.assign(transition, { isCurrent, release, preparation });
}

/** @param {(() => unknown) | null} [onFailure] 当前过场仍有效且尚未开战时恢复入口。 */
export function enterNode(kind, done, onFailure = null) {
  const transitions = {
    battle: { tone: 'battle', asset: 'scene-battle-bg', eyebrow: 'WINTER EXPEDITION', title: '旅途继续', detail: '冬日远征 · 旅途继续', presentation: 'city-cut', scene: 'battle' },
    boss: { tone: 'battle', asset: 'scene-battle-bg', eyebrow: 'WINTER EXPEDITION', title: '旅途继续', detail: '冬日远征 · 旅途继续', presentation: 'city-cut', scene: 'boss' },
    door: { tone: 'door', asset: 'scene-door-bg', eyebrow: 'GATE SIGNAL', title: '抵达大门', detail: '环层通路正在响应' },
    altar: { tone: 'altar', asset: 'scene-altar-bg', eyebrow: 'CONTAMINATION DETECTED', title: '污染核心', detail: '高危生命信号逼近' },
    emergencyExit: { tone: 'exit', asset: 'scene-extract-bg', eyebrow: 'EXTRACTION POINT', title: '紧急撤离点', detail: '撤离信标已经接通' },
    shop: { tone: 'shop', asset: 'scene-shop-bg', eyebrow: 'CARAVAN SIGNAL', title: '拾荒商队', detail: '交易频道已经开放' },
    event: { tone: 'event', asset: 'scene-event-custom-a', eyebrow: 'UNKNOWN ENCOUNTER', title: '偶遇见闻', detail: '风雪中的故事正在展开' },
  };
  const spec = transitions[kind] || { title: '进入节点' };
  const combat = kind === 'battle' || kind === 'boss';
  const transition = showRunTransition(combat
    ? { ...spec, duration: SILENT_FILMS[kind].duration, holdVisual: true, prepare: ensureBattleReady }
    : { ...spec, scene:kind, art: TRANSITION_ART[kind], presentation: 'node-cut', duration: SILENT_FILMS[kind]?.duration || motionTiming.sceneEnter, holdVisual: true });
  const recoverEntry = () => {
    if (onFailure && transition.isCurrent() && !game.battleActive && !nodeContentEndedAt(game)) return onFailure();
  };
  return transition.then(async current => {
    if (!current || !transition.isCurrent()) return false;
    if (combat) {
      // Keep the mounted curtain/input state while module preparation completes.
      game.state = 'modal';
      const prepared = await transition.preparation;
      if (prepared.cancelled || !transition.isCurrent()) return false;
      // A failed speculative import is not readiness: startBattle retains its
      // retry, diagnostic and failure state handling beneath the held curtain.
    }
    let result;
    try { result = await done(); }
    catch (error) {
      try { await recoverEntry(); }
      finally { await transition.release({ immediate: true }); }
      throw error;
    }
    // Destination pages replace the held scene directly; only this curtain is
    // released. Successful combat hands its presentation to the battle owner.
    if (!combat || result === false) {
      try { if (result === false) await recoverEntry(); }
      finally { await transition.release({ immediate: true }); }
    }
    return result;
  });
}

// One checkpoint owns a node's return, including empty map nodes without a page.
let mapReturn = null;
function finishNodeReturn(saved) {
  if (mapReturn?.isCurrent()) return mapReturn.run();
  const context = captureBattleContext(game);
  if (!context() || game.battleActive || ['title', 'done', 'boot'].includes(game.state)) return Promise.resolve(false);
  if (game.chainMove) cancelLegacyChainMove();
  game.state = 'modal';
  const checkpoint = createRoomCheckpoint({
    UI, save:saveGame, initialSaved:saved, pageRequired:false,
    isCurrent:() => context() && !game.battleActive && !game.terminalPending && !game.extractionPending,
    renderRetry:({ saved, run, isCurrent }) => {
      game.state = 'modal';
      nodeShell({ tone:'safe', icon:'[[icon:map]]', title:'返回地图',
        sub:saved ? '进度已保存，继续返回地图。' : '本次操作已保留，保存后返回地图。',
        body:nodeOpt('nodeReturnRetry', saved ? '继续返回地图' : '重试保存并返回地图', '', 'ok') });
      setBagReturnHook(null);
      for (const name of ['nodeReturnRetry', 'eventExit']) UI.act(name, () => isCurrent() ? run() : false);
    },
    complete:isCurrent => {
      const body = UI.el?.ovBody, surface = body?.firstElementChild;
      const overlay = UI.el?.overlay, revision = UI._overlayRevision;
      game.state = 'idle';
      try { UI.refresh(game); }
      catch (error) { game.state = 'modal'; throw error; }
      if (!isCurrent()) return false;
      const visible = overlay && !overlay.hidden && !overlay.classList.contains('closing');
      if (visible) UI.hideOverlay();
      if (overlay && !overlay.hidden && !overlay.classList.contains('closing')) {
        game.state = 'modal';
        return false;
      }
      if (context() && UI.el?.ovBody === body && UI.el?.overlay === overlay &&
        (body?.firstElementChild === surface || !body?.firstElementChild) &&
        UI._overlayRevision === revision + (visible ? 1 : 0)) setBagReturnHook(null);
      return true;
    },
  });
  mapReturn = checkpoint;
  return checkpoint.run().then(result => {
    if (result && mapReturn === checkpoint) mapReturn = null;
    return result;
  });
}

/** @type {(completed?: boolean) => Promise<boolean>} */
export function finishInstant() { return finishNodeReturn(false); }
/** @type {(completed?: boolean) => Promise<boolean>} */
export function finishSavedInstant() { return finishNodeReturn(true); }

// 拾取页：杀戮尖塔式右栏——拾获叙事 + 大字收益 + 继续按钮
// 搜索物资（2026-09-09 老板 #3）：收获不再直接蹦出来——先演一段搜索（提灯扫过 + 进度条填充），
// 约 0.95s 后揭晓收获大字与「继续」按钮，给拾取一个过程感
const PICKUP_SEARCH_MS = 950;
// claim 只执行一次；complete 在检查点保存后继续目的页，并可用 retry 恢复本次领取。
export function openPickupPage(kind, gain, actions, skipSearch = false, transaction = null) {
  const f = SCENES[kind];
  const txn = transaction || { action:null, finished:false, continued:false, page:0,
    saved:false, saving:null, current:captureBattleContext(game) };
  if (txn.finished || !txn.current() || nodeContentEndedAt(game)) return false;
  const page = ++txn.page;
  game.state = 'modal';
  const sourceCurrent = () => txn.current() && txn.page === page && !txn.finished && !nodeContentEndedAt(game);
  const retry = () => sourceCurrent() ? openPickupPage(kind, gain, actions, true, txn) : false;
  const retryBody = saved => `<div class="node-summary pickup-result"><p class="gain-big">${txn.action === 'claim' ? gain : '返回地图'}</p>
    <p class="ov-note" role="status">${saved ? '进度已保存，继续页面尚未完成。' : '本次操作已保留，保存尚未完成。'}</p>
    <button class="evt-opt ok" data-act="pickupRetry"><b>${saved ? '继续' : '重试保存'}</b></button></div>`;
  nodeShell({ tone: 'pickup', asset: PICKUP_BG[kind], icon: f.icon, title: f.title,
    sub: pick(f.lines),
    body: txn.action ? retryBody(txn.saved) : `<div class="pick-search">
        <span class="ps-lantern">[[icon:lantern]]</span>
        <span class="ps-ground"><i></i></span>
        <p class="ps-tip">正在搜索物资…</p>
      </div>` });
  setBagReturnHook(retry);
  const surface = UI.el.ovBody.firstElementChild, revision = UI._overlayRevision;
  const active = () => sourceCurrent() && game.state === 'modal' && UI.el.ovBody.firstElementChild === surface &&
    UI._overlayRevision === revision && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
  const checkpoint = createRoomCheckpoint({
    UI, isCurrent:sourceCurrent,
    save:() => {
      // Backpack/entry recovery adopts only the actual save result; it never
      // restarts a former page's completion callback or grants the pickup again.
      if (txn.saved) return true;
      if (!txn.saving) {
        const saving = saveRunCheckpoint(saveGame).then(saved => {
          txn.saved = saved;
          return saved;
        }).finally(() => { if (txn.saving === saving) txn.saving = null; });
        txn.saving = saving;
      }
      return txn.saving;
    },
    renderRetry:({ saved, run, isCurrent }) => {
      game.state = 'modal';
      nodeShell({ tone:'pickup', asset:PICKUP_BG[kind], icon:f.icon, title:f.title,
        sub:pick(f.lines), body:retryBody(saved) });
      setBagReturnHook(retry);
      for (const name of ['pickupRetry', 'eventExit']) UI.act(name, () => isCurrent() ? run() : false);
    },
    complete:async isCurrent => {
      if (txn.action === 'claim' && !txn.continued) {
        const result = await actions.complete?.(retry);
        if (result === false) return false;
        txn.continued = true;
      }
      // A destination opened by complete owns its own overlay and bag hook.
      if (isCurrent()) {
        game.state = 'idle';
        try { UI.refresh(game); }
        catch (error) { game.state = 'modal'; throw error; }
        if (!isCurrent()) return false;
        UI.hideOverlay();
        if (isCurrent()) { game.state = 'modal'; return false; }
        setBagReturnHook(null);
      }
      txn.finished = true;
      return true;
    },
  });
  const settle = action => {
    if (!active() || txn.action) return false;
    txn.action = action;
    if (game.chainMove) cancelLegacyChainMove();
    if (action === 'claim') actions.claim();
    return checkpoint.run();
  };
  // Before claiming, exiting keeps this node's reward available. Once settlement
  // starts, every exit/return goes through the same save/continue checkpoint.
  UI.act('eventExit', () => txn.action ? checkpoint.run() : settle('leave'));
  if (txn.action) {
    UI.act('pickupRetry', () => checkpoint.run());
    return true;
  }
  if (!skipSearch) SDT.Sound.sfx('searchStart');
  const main = UI.el.ovBody.querySelector('.node-main');
  const reveal = () => {
    if (!active() || txn.action || !main?.isConnected) return;
    main.innerHTML = `<div class="node-summary pickup-result"><p class="gain-big">${gain}</p>
      <button class="evt-opt ok" data-act="pickupGo"><b>获取并离开</b></button></div>`;
    if (!skipSearch) SDT.Sound.sfx('searchReveal');
    const go = /** @type {HTMLElement} */ (main.querySelector('[data-act="pickupGo"]'));
    if (go) go.focus({ preventScroll: true });
    UI.act('pickupGo', () => settle('claim'));
  };
  if (skipSearch) { reveal(); return true; }
  setTimeout(reveal, turboMs(PICKUP_SEARCH_MS));
  return true;
}

// ---------- 遭遇组建（设计者 2026-09-02 定版：按环层抽怪，1-3 只，越内层越强） ----------
export function buildEncounter(layerIdx) {
  const enc = MAP.encounters[layerIdx] || MAP.encounters[0];
  let pool, size;
  const selected=selectEncounterSpec(enc,MAP.monsters,()=>Random.random('enemy', 'enemy'));
  if(selected.ok === false) throw new Error(`遭遇配置无效：${selected.code}`);
  const spec=selected.value;
  let strategy=spec.strategy, risk=spec.risk;
  // 2026-09-10 玩法定版：每层每种敌人有固定数量区间（一律落在 1~3 只，如 2-3 只），
  // 区间内每个数量等概率生成（MAP.rollCount）；二层起以当层精英替换一个位置，总数不变。
  pool=spec.enemyIds; size=spec.size;
  const n=spec.kind==='group'?2:(MAP.rollCount ? MAP.rollCount(size, () => Random.random('enemy', 'enemy')) : size[0] + Math.floor(Random.random('enemy', 'enemy') * (size[1] - size[0] + 1)));
  /** @type {(ReturnType<typeof scaledEnemy>[]) & {risk?:string, strategy?:string, encounterId?:string, encounterKind?:string, rewardKind?:string, fallbackReason?:string}} */
  const list = [];
  // 只对新局第三层普通遭遇轮换；独立种子盐不推进地图、掉落或遭遇随机流。
  // 人数沿原掷数；替代只取该层人数区间允许的普通敌人，精英与旧档完全沿原路径。
  const cells = game.layerData?.[layerIdx]?.logical || [];
  const ordinal = cells.map((cell, index) => ({ cell, index })).filter(item => item.cell.def?.type === 'battle')
    .findIndex(item => item.index === game.trackPos);
  const alternatives = game.encounterRotationVersion === 1 && layerIdx === 2 && spec.kind === 'entry' && ordinal >= 0
    ? (enc.entries || []).filter(entry => entry.size?.[0] <= n && entry.size?.[1] >= n &&
      MAP.monsters[entry.id] && !MAP.monsters[entry.id].elite) : [];
  const rotation = alternatives.length > 1 ? hashSeed(`${game.mapSeed ?? game.seed}:third-layer-encounters:v1`) + ordinal : null;
  for (let i = 0; i < n; i++) {
    const originalId=spec.kind==='group'?pool[i]:pool[Math.floor(Random.random('enemy', 'enemy') * pool.length)];
    const id=rotation === null ? originalId : alternatives[(rotation + i) % alternatives.length].id;
    const tpl = MAP.monsters[id];
    list.push(scaledEnemy({ ...tpl }));
  }
  if (enc.guaranteedElite?.length) {
    const id = enc.guaranteedElite[Math.floor(Random.random('enemy', 'enemy') * enc.guaranteedElite.length)];
    list[0] = scaledEnemy({ ...MAP.monsters[id] });
  }
  // 元数据不参与战斗结算，仅用于战前预告和战斗内提示；旧敌人对象仍保持原字段。
  list.risk = risk;
  list.strategy = strategy;
  list.encounterId=rotation === null ? spec.encounterId : `rotation:${list.map(enemy => enemy.id).join('+')}`;
  list.encounterKind=spec.kind; list.rewardKind=spec.rewardKind; list.fallbackReason=spec.fallbackReason;
  return list;
}


export function openBlankSafePage() {
  game.state = 'modal';
  nodeShell({
    tone: 'safe', icon: '[[icon:check]]', title: '安全地带',
    sub: '风雪暂歇，前方仍有路可走。',
    body: `<div class="blank-safe-gain">
      <p class="gain-big">无事发生</p>
      <p class="ov-note">没有埋伏或拾获，可整理背包后继续前行。</p>
    </div>`,
    foot: `<button class="ov-btn ok fire-done-btn" data-act="blankSafeDone"><svg class="svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5.5 18.5 12 12 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg> 继续旅程</button>`,
  });
  UI.act('blankSafeDone', () => finishInstant());
}

// 战斗格 → 遭遇战（encounter 已在场景前组建好传入，保证场景与战斗一致）
export function openBattleCell(def, encounter) {
  game.state = 'modal';
  const list = encounter || buildEncounter(game.layerIdx);
  return startBattle(game, list, { isBoss: false, layer: game.layerIdx, name: list[0].name,
    risk: list.risk, strategy: list.strategy, encounterId:list.encounterId, encounterKind:list.encounterKind,
    rewardKind:list.rewardKind, fallbackReason:list.fallbackReason });
}

// 搜刮点 / 事件卡搜刮容器：处理完回待机并存档（场景演出后由本函数自行收尾）
export function openChestsOnCell(chests, text, opts) {
  if (nodeContentEndedAt(game)) return false;
  UI.log(`[[icon:archive]] ${text || '回收了' + SDT.Chests.dropText(chests)}`, 'loot');
  SDT.Chests.open(game, chests, () => {
    game.state = 'idle';
    UI.refresh(game);
  }, { ...opts, onCell:true, beforeComplete:() => { if (opts?.consumeNode) consumeCurrentCell(); } });
}

export function resumeChestsOnCell(saved) {
  if (nodeContentEndedAt(game)) return false;
  return SDT.Chests.restore(game, saved, () => {
    game.state = 'idle'; UI.refresh(game);
  }, { beforeComplete:() => { if (saved.context.consumeNode) consumeCurrentCell(); } });
}

// 固定奖励复用搜刮点的逐张领取与存档恢复；同地点可整理后继续，前往下一节点后结束。
export function openFixedRewardsOnCell(cards, source, { consumeNode = false } = {}) {
  if (nodeContentEndedAt(game)) return false;
  const saved = { version:1, seed:game.seed, layerIdx:game.layerIdx, trackPos:game.trackPos,
    queue:[{ kind:'small' }], index:1, context:{ onCell:true, consumeNode },
    current:{ kind:'small', cards:cards.filter(Boolean), coins:0, coinsReceived:false,
      taken:[], lost:[], source, title:'领取奖励' } };
  setBagReturnHook(null);
  const opened = resumeChestsOnCell(saved);
  if (opened && typeof game.persistSave !== 'function') saveRunCheckpoint(saveGame);
  return opened;
}

// 即时效果（经场景演出后结算）；after = 效果完成后的续流回调
// 拾取类在场景里用大字标明结算（v0.22：明确告诉玩家发生了什么）
// opts.silent：跳过获得演出（搜刮点/基地等调用方自带卡牌展示界面，2026-09-13）
export function grantEventCard(tpl, opts = {}) {
  if (!tpl) return false;
  const feedback = action => {
    try { action(); } catch (error) { console.warn('[reward] 获得反馈未完成', error); }
  };
  const canReceive = game.canReceiveCard
    ? game.canReceiveCard(tpl)
    : (game.ownedCards.some(o => o.card.name === tpl.name) || game.canAcceptCard(tpl));
  if (!canReceive) {
    // 2026-09-09 老板 #12：收不下要当场给提示（音效+日志，口径同 addItem），不能只默默掉在原地
    feedback(() => SDT.Sound.sfx('deny'));
    feedback(() => UI.log(`[[icon:bag]] 背包放不下（${game.bagCapacityText?.() || `${usedSlots()}/${bagCap()} 格`}${tpl.type !== '资源' ? '；新普通牌需通用空格，同名未满仍可叠放' : ''}），【${esc(tpl.name)}】未领取，请整理背包后重试`, 'warn'));
    return false;
  }
  game.ownedCards.push(createCardInstance(tpl, newUid()));
  feedback(() => UI.log(`[[icon:archive]] 获得卡牌【<b>${esc(tpl.name)}</b>】`, 'loot'));
  // 2026-09-13 老板：发卡要有奖励动画，不能静默进背包——统一走获得演出
  //（传说卡保留金色光柱 + legend 音效，普通卡中性演出；多张连发自动排队逐张播）
  // opts.reason：获得原因文字（2026-09-20 老板：火堆等发牌点要说明"为什么给这张牌"），可省略
  if (!opts.silent) feedback(() => UI.showCardReward(tpl, opts.reason));
  // 阿猫的礼物（2026-09-12 实装）：「发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌」
  // 地图侧没有能量概念，只结算附赠卡；战斗内触发走 battle.core fireCatGift（含能量）
  if (tpl.id === 'tt2-apollo') {
    const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c) && c.id !== 'tt2-apollo');
    if (pool.length) {
      const got = pool[Math.floor(Random.random('loot', 'reward') * pool.length)];
      feedback(() => UI.log('[[icon:bolt]] <b>阿猫的礼物</b>：随机获取触发，附赠另 1 张随机卡牌', 'loot'));
      // 搜刮点可把已掷定附赠保留为独立待领卡；本体与附赠各自记领取状态。
      if (typeof opts.deferAcquiredCard === 'function') opts.deferAcquiredCard(got);
      else grantEventCard(got);   // 旧非搜刮点入口保留原行为；池内排除自身，无递归风险
    }
  }
  return true;
}
// ESM：循环导入下本模块体先于 game.session 执行，顶层读 game 会 TDZ，延迟到 boot 统一绑定
export const FIRE_RESTORABLE = (card) => card.type !== '道具' && card.type !== '装备';
// opts = { title, icon, tone, sub }：调用方传入当前来源的标题与说明。
// 祭坛和「战地整备」复原分支各用自身身份；不传 opts 时默认「营火休整」。
export function openPocketRestore(picks, done, opts = {}, transaction = null) {
  if (nodeContentEndedAt(game)) return false;
  const record = opts.restoreRecord;
  if (record && nodeRestoreAt(game) !== record) return false;
  const txn = transaction || { left: record?.left ?? picks, finished: false, current: captureBattleContext(game) };
  if (txn.finished || !txn.current()) return;
  game.state = 'modal';
  // 背包返回恢复本页并保留剩余复原次数（09-30 深审 WORLD-002）：关闭背包不再兜底回
  // idle 导致节点未消耗、火堆奖励可被反复重领
  setBagReturnHook(() => txn.checkpoint ? false : openPocketRestore(picks, done, opts, txn));
  const restorable = () => game.usedPocket.filter(p => FIRE_RESTORABLE(p.card));
  const cell = `${game.layerIdx},${game.trackPos}`;
  const sourceCurrent = () => txn.current() && (!record || game.nodeRewards?.[cell] === record);
  let surface, pendingFocus = null;
  const rememberView = () => {
    if (UI.el?.ovBody?.firstElementChild !== surface || !surface?.querySelector('.pocket-restore-content')) return;
    const buttons = [...surface.querySelectorAll('button[data-act="restoreOne"]')];
    const focused = surface.contains(document.activeElement) ? document.activeElement : null;
    txn.view = { focused:!!focused, focusNode:focused, name:/** @type {HTMLElement} */ (focused)?.dataset.name,
      index:buttons.indexOf(focused), scrollTop:surface.querySelector('.pocket-restore-content').scrollTop };
  };
  const refreshMap = () => {
    try { UI.refresh(game); } catch (error) { console.warn('[restore] 地图刷新未完成', error); }
  };
  const checkpoint = (kind, card = null) => {
    rememberView();
    const mapDone = kind === 'return' || !done || done === finishInstant;
    let continued = false;
    if (kind !== 'claim' && mapDone) {
      if (game.chainMove) cancelLegacyChainMove();
      game.state = 'idle';
    }
    const pending = createRoomCheckpoint({
      UI, save:saveGame, isCurrent:sourceCurrent,
      renderRetry:({ saved, isCurrent }) => {
        UI.showOverlay('', `<section class="battle-decision pocket-restore" data-decision-kind="pocket-restore">
          <header class="battle-decision-head"><h3>${opts.icon || '[[icon:fire]]'} ${opts.title || '营火休整'}</h3></header>
          <div class="battle-decision-content"><p class="ov-note" role="status">${saved
            ? '复原进度已保存，继续页面尚未完成。' : '本次复原结果已保留，保存尚未完成。'}</p></div>
          <footer class="battle-decision-actions"><button type="button" class="ov-btn ok" data-act="restoreRetry">${saved ? '继续' : '重试保存'}</button></footer>
        </section>`, 'discover');
        UI.act('restoreRetry', () => isCurrent() ? runCheckpoint() : false);
      },
      complete:async isCurrent => {
        if (!isCurrent()) return false;
        let showCard = kind === 'claim';
        if (kind === 'claim') {
          render();
          txn.checkpoint = null;
        } else {
          const result = mapDone || continued ? true : await done();
          if (result === false) return false;
          continued = true;
          // A destination opened by done owns its own hook and overlay now.
          if (isCurrent()) {
            const body = UI.el?.ovBody, page = body?.firstElementChild, overlay = UI.el?.overlay;
            try { UI.hideOverlay(); } catch (error) { console.warn('[restore] 复原页面关闭未完成', error); }
            if (isCurrent()) return false;
            if (sourceCurrent() && UI.el?.ovBody === body && UI.el?.overlay === overlay &&
                body?.firstElementChild === page && !overlay?.hidden && !overlay?.classList.contains('closing')) return false;
            if (sourceCurrent() && UI.el?.ovBody === body && UI.el?.overlay === overlay &&
                (body?.firstElementChild === page || !body?.firstElementChild) &&
                (overlay?.hidden || overlay?.classList.contains('closing'))) {
              setBagReturnHook(null);
              const revision = UI._overlayRevision;
              refreshMap();
              showCard = UI._overlayRevision === revision;
            }
          }
          txn.finished = true;
          txn.checkpoint = null;
        }
        if (card && showCard && sourceCurrent()) {
          const onMap = kind !== 'claim';
          const host = onMap ? document.getElementById('viewport') : UI.el?.ovBody;
          const body = UI.el?.ovBody, page = body?.firstElementChild, revision = UI._overlayRevision;
          try {
            playOutcomeFeedback(host,{kind:'restore',cards:[card],source:opts.title || '卡牌复原',
              extra:opts.feedbackExtra || '', surface:onMap ? host : null,blocking:!onMap,
              cardHTML:entry=>SDT.Cards.cardHTML(entry,'sm'),
              isCurrent:()=>sourceCurrent() && UI.el?.ovBody === body && UI._overlayRevision === revision &&
                (body?.firstElementChild === page || (onMap && UI.el?.overlay?.hidden && !body?.firstElementChild))});
          } catch (error) { console.warn('[restore] 复原演出未完成', error); }
        }
        return true;
      },
    });
    function runCheckpoint() {
      return pending.run().then(result => {
        const focus = pendingFocus;
        pendingFocus = null;
        if (result && focus) focus();
        return result;
      });
    }
    txn.checkpoint = pending;
    return runCheckpoint();
  };
  const render = () => {
    if (txn.finished || !sourceCurrent()) return;
    if (!txn.checkpoint) rememberView();
    const view = txn.view || { focused:false, scrollTop:0 };
    const left = record?.left ?? txn.left;
    const list = restorable();
    const rows = list.map(item => ({ item, card:item.card, count:item.count, name:item.card.name,
      id:item.card.id, variant:item.variantKey || item.card.variantKey || '' }));
    const blockedN = game.usedPocket.filter(p => !FIRE_RESTORABLE(p.card)).reduce((sum, p) => sum + p.count, 0);
    const title = opts.title || '营火休整';
    const icon = opts.icon || '[[icon:fire]]';
    const cardsHTML = list.length
      ? list.map((p, index) => {
        const reason = left <= 0 ? '复原次数已用完' : game.canReceiveCard(p.card) ? '' : `背包放不下：${game.bagCapacityText?.() || `${usedSlots()}/${bagCap()} 格`}`;
        return `
          <button type="button" class="bt-card fire-restore-card${reason ? ' off' : ''}" data-view-key="${escAttr(JSON.stringify([p.card.id || p.card.name, p.variantKey || p.card.variantKey || '']))}" data-act="restoreOne" data-cancel="false" data-i="${index}" data-name="${escAttr(p.card.name)}" ${reason ? 'disabled aria-disabled="true"' : ''}
            aria-label="${escAttr(`${p.card.name}，消耗区剩余 ${p.count} 张，复原 1 张回背包${reason ? `，${reason}` : ''}`)}" aria-description="${escAttr(p.card.desc || '')}"
            title="${escAttr(reason || p.card.desc || p.card.name)}">
            <span class="pocket-restore-art" aria-hidden="true">${SDT.Cards.cardHTML(p.card, 'sm')}</span>
            <span class="pocket-restore-caption"><b>${esc(p.card.name)}</b><span>${reason ? esc(reason) : `复原 1 张 · 剩余 ${p.count} 张`}</span></span>
          </button>`;
      }).join('')
      : `<p class="ov-empty">（消耗区里没有可复原的卡牌${blockedN ? `——另有 ${blockedN} 张道具/装备不可在此复原` : ''}）</p>`;
    const html = `<section class="battle-decision pocket-restore" data-decision-kind="pocket-restore">
      <header class="battle-decision-head"><h3>${icon} ${title}</h3><span>消耗区 · ${list.length} 种可复原卡牌</span></header>
      <div class="battle-decision-summary">
        <p class="ov-note" role="status" aria-live="polite" aria-atomic="true">还可复原 <b>${left}</b> 张（最多 ${picks} 张）</p>
        <p class="ov-note">${opts.sub != null ? opts.sub : '<span class="eps-fate">复原=撤离全额带回，否则每张仅 1/3 幸存</span>'}${blockedN ? ` · 道具/装备共 ${blockedN} 张不可复原` : ''}</p>
      </div>
      <div class="battle-decision-content pocket-restore-content"><div class="bt-hand fire-restore-hand">${cardsHTML}</div></div>
      <footer class="battle-decision-actions"><div class="ov-btns">${record ? `<button type="button" class="ov-btn ok" data-act="restoreReturn">返回地图 · 保留 ${left} 次复原</button><button type="button" class="ov-btn" data-act="restoreBag">整理背包</button><button type="button" class="ov-btn fire-done-btn" data-act="fireDone">结束复原${left ? ' · 放弃剩余次数' : ''}</button>` : '<button type="button" class="ov-btn ok fire-done-btn" data-act="fireDone" aria-label="继续旅程，结束复原并返回地图"><svg class="ic svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5.5 18.5 12 12 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg> 继续旅程</button>'}</div></footer>
      </section>`;
    if (surface?.isConnected && UI.el?.ovBody?.firstElementChild === surface && !UI.el?.overlay?.hidden
        && !UI.el?.overlay?.classList.contains('closing')) {
      const template = surface.ownerDocument.createElement('template');
      template.innerHTML = SDT.Icons?.rich?.(html) || html;
      syncViewChildren(surface, template.content.firstElementChild);
    } else {
      UI.showOverlay('', html, 'discover');
      surface = UI.el?.ovBody?.firstElementChild;
    }
    surface?.querySelectorAll('.pocket-restore-art [tabindex]').forEach(el => el.removeAttribute('tabindex'));
    const content = surface?.querySelector('.pocket-restore-content');
    if (content) content.scrollTop = view.scrollTop;
    if (view.focused && (document.activeElement === view.focusNode || document.activeElement === document.body)) {
      const focusedPage = surface, revision = UI._overlayRevision, previousFocus = document.activeElement;
      const restoreFocus = () => {
        if (!sourceCurrent() || txn.finished || UI.el?.ovBody?.firstElementChild !== focusedPage
          || UI._overlayRevision !== revision || UI.el?.overlay?.hidden || UI.el?.overlay?.classList.contains('closing')
          || (document.activeElement !== previousFocus && document.activeElement !== document.body)) return;
        const buttons = [...surface.querySelectorAll('button[data-act="restoreOne"]:not(:disabled)')];
        (buttons.find(button => button.dataset.name === view.name)
          || buttons[Math.min(view.index, buttons.length - 1)] || surface.querySelector('[data-act="fireDone"]'))?.focus({ preventScroll:true });
      };
      if (txn.checkpoint) pendingFocus = restoreFocus;
      else restoreFocus();
    }
    const active = nodeActionBinding(game, UI, 'fireDone');
    const renderedSurface = surface;
    const live = () => active() && sourceCurrent() && !txn.finished && !txn.checkpoint &&
      (!renderedSurface || UI.el?.ovBody?.firstElementChild === renderedSurface);
    const finish = () => {
      if (!live()) return false;
      if (record && !finishNodeRestore(game, record)) return false;
      return checkpoint('finish');
    };
    UI.act('restoreOne', (d) => {
      if (!live()) return;
      if (d.i == null && game.usedPocket.filter(item => item.card.name === d.name && FIRE_RESTORABLE(item.card)).length !== 1) return;
      const matches = d.i == null ? rows.filter(row => row.name === d.name)
        : Number.isInteger(Number(d.i)) ? rows.filter((_, index) => index === Number(d.i)) : [];
      if (matches.length !== 1) return;
      const row = matches[0], p = row.item;
      if (!game.usedPocket.includes(p) || p.card !== row.card || p.count !== row.count || p.card.name !== row.name
        || p.card.name !== d.name || p.card.id !== row.id || (p.variantKey || p.card.variantKey || '') !== row.variant
        || !FIRE_RESTORABLE(p.card) || (record?.left ?? txn.left) <= 0) return;
      // 2026-09-06 #18：背包满时不能复原
      const card = p.card;
      if (!game.canReceiveCard(card)) { UI.log(`[[icon:bag]] 背包放不下（${game.bagCapacityText?.() || `${usedSlots()}/${bagCap()} 格`}），无法复原`, 'warn'); SDT.Sound.sfx('deny'); return; }
      if (record) {
        if (!claimNodeRestore(game, record, { name:d.name, entry:p, isRestorable:FIRE_RESTORABLE,
          canReceive:c => game.canReceiveCard(c), newUid })) return;
      } else {
        const restored = createCardInstance(card, newUid());
        p.count--;
        if (p.count <= 0) game.usedPocket.splice(game.usedPocket.indexOf(p), 1);
        game.ownedCards.push(restored);
        txn.left--;
      }
      try { UI.log(`[[icon:sparkles]] 【<b>${esc(card.name)}</b>】已复原，回到背包`, 'ok'); }
      catch (error) { console.warn('[restore] 复原播报未完成', error); }
      const finished = (record?.left ?? txn.left) <= 0;
      if (finished && record) finishNodeRestore(game, record);
      return checkpoint(finished ? 'finish' : 'claim', card);
    });
    UI.act('fireDone', finish);
    if (record) {
      UI.act('restoreReturn', () => {
        if (!live()) return;
        return checkpoint('return');
      });
      UI.act('restoreBag', () => { if (live()) { rememberView(); bagSlots.showBackpack(); } });
    }
  };
  render();
  return true;
}

// ---------- 角色选择（开局从全部角色中自由选 1，与 5 张初始攻击一起获得 1 张该角色随机卡） ----------
// 各角色的背景故事与出发任务（角色选择页展示）
