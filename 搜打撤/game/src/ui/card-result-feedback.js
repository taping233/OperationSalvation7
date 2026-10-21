import { FEEDBACK_TIMING, quietFeedback } from './feedback-theme.js';
import { rewardRarity, hasRareReveal } from './rarity-reveal.js';
import { clearRewardAcquisition, showRewardAcquisition } from './reward-acquisition-motion.js';

// Settled events only: this queue never returns a battle wait or mutates a card.
const states = new Map();
const CARD_WIDTH = 240;
export const CARD_FEEDBACK_LAYOUT = Object.freeze({
  width: CARD_WIDTH, height: CARD_WIDTH * 1.5, laneGap: 48,
  captionFont: 21, captionGap: 6, centerY: .5,
});
// Read the existing scale service lazily; importing feedback must not initialize the app.
const rect = element => window.SDT?.UiScale?.rect(element) || element.getBoundingClientRect();
const reduced = quietFeedback;
export function clearCardFeedback(host) {
  clearRewardAcquisition(host);
  for (const [key, state] of states) {
    if (host && key !== host) continue;
    state.observer.disconnect();
    for (const timer of state.timers) clearTimeout(timer);
    for (const animation of state.animations) animation.cancel();
    state.layer.remove(); states.delete(key);
  }
}
function later(state, fn, ms) {
  const timer = setTimeout(() => { state.timers.delete(timer); fn(); }, ms);
  state.timers.add(timer);
  return timer;
}
function animate(state, node, frames, options) {
  if (!node.animate) return;
  const animation = node.animate(frames, options);
  state.animations.add(animation);
  animation.onfinish = () => {
    if (options.fill === 'forwards' || options.fill === 'both') node.remove();
    state.animations.delete(animation); animation.cancel();
  };
}
function visibleBagAnchor(element, stage) {
  const box = rect(element), style = getComputedStyle(element);
  if (!(box.width > 0 && box.height > 0) || element.closest('[hidden], [inert], [aria-hidden="true"]')
    || style.display === 'none' || style.visibility === 'hidden') return false;
  const host = stage.closest('#overlay') || stage;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const clipping = getComputedStyle(parent);
    if (parent === host || /auto|scroll|hidden|clip/.test(`${clipping.overflow} ${clipping.overflowX} ${clipping.overflowY}`)) {
      const bounds = rect(parent);
      if (bounds.width > 0 && bounds.height > 0 && (box.left >= bounds.left + bounds.width || box.left + box.width <= bounds.left
        || box.top >= bounds.top + bounds.height || box.top + box.height <= bounds.top)) return false;
    }
    if (parent === host) break;
  }
  return true;
}
function targetFor(stage, event) {
  if (event.kind === 'bag') {
    for (const selector of ['[data-card-receive-anchor="bag"]', '.reward-capacity', '[data-act="entrySupplyBag"]']) {
      for (const element of stage.querySelectorAll(selector)) {
        if (visibleBagAnchor(element, stage)) return element;
      }
    }
    return null;
  }
  if (event.kind === 'shuffle') return /** @type {HTMLElement} */ (stage.querySelector('.sts-hud-l .bt-pile'));
  if (event.kind === 'draw') {
    return [.../** @type {NodeListOf<HTMLElement>} */ (stage.querySelectorAll('.bt-card[data-uid]'))].find(el => el.dataset.uid === String(event.uid))
      || [.../** @type {NodeListOf<HTMLElement>} */ (stage.querySelectorAll('.bt-card'))].find(el => /** @type {HTMLElement} */ (el.querySelector('.hsc-name'))?.textContent.trim() === event.name)
      || /** @type {HTMLElement} */ (stage.querySelector('.bt-hand-page')) || /** @type {HTMLElement} */ (stage.querySelector('.sts-hand'));
  }
  if (event.side === 'self') return /** @type {HTMLElement} */ (stage.querySelector('#btSelf .sts-figure')) || /** @type {HTMLElement} */ (stage.querySelector('#btSelf'));
  if (Number.isInteger(event.target) && event.target >= 0)
    return stage.querySelector(`.sts-foe[data-eidx="${event.target}"] .sts-figure`) || stage.querySelector(`.sts-foe[data-eidx="${event.target}"]`);
  return null; // Never invent a target when settlement did not supply one.
}
function labelFor(event) {
  if (event.kind === 'bag') return '已入背包';
  if (event.kind === 'draw') return '入手';
  if (event.kind === 'shuffle') return '洗入牌库';
  if (event.kind === 'recast') return `${event.scope === 'damage' ? '追加伤害' : '追加施放'} ${event.repeatIndex || 1}/${event.repeatTotal || 1}`;
  return `${event.sourceName || '随机释放'}${event.n > 1 ? ` ${event.i}/${event.n}` : ''}`;
}
function present(state, item, lane) {
  const { event, count } = item, { stage, host } = state;
  if (!stage.isConnected || host.hidden) { clearCardFeedback(host); return; }
  const origin = rect(host), area = rect(stage);
  const layout = CARD_FEEDBACK_LAYOUT;
  const x = area.left - origin.left + area.width * .5 + (lane - .5) * (layout.width + layout.laneGap);
  const y = area.top - origin.top + area.height * layout.centerY;
  const node = document.createElement('div');
  node.className = 'bt-card-reveal'; node.dataset.kind = event.kind;
  node.style.cssText = `left:${x - layout.width / 2}px;top:${y - layout.height / 2}px`;
  const face = document.createElement('div'); face.className = 'bt-card-reveal-face';
  const card = event.card || window.SDT?.Cards?.all?.().find(card => card.name === event.name);
  const rarity = rewardRarity(card);
  const rare = hasRareReveal(rarity) && (event.kind === 'bag' || event.kind === 'draw' && event.acquired);
  if (rare) { node.dataset.rarity = rarity; node.dataset.rareReveal = 'true'; }
  if (card && window.SDT?.Cards?.cardHTML) face.innerHTML = window.SDT.Cards.cardHTML(card, 'sm');
  else { const name = document.createElement('b'); name.textContent = event.name; face.append(name); }
  const caption = document.createElement('span'); caption.className = 'bt-card-reveal-caption';
  caption.textContent = `${rare ? `${rarity} · ` : ''}${labelFor(event)}${count > 1 ? ` ×${count}` : ''}${event.targetName ? ` → ${event.targetName}` : ''}`;
  node.append(face, caption); state.layer.append(node);
  for (const element of /** @type {NodeListOf<HTMLButtonElement>} */ (node.querySelectorAll('[tabindex],button,a,input'))) element.setAttribute('tabindex','-1');
  node.inert = true;
  const quiet = reduced();
  node.dataset.reducedMotion = String(quiet);
  if (!quiet) animate(state, node, [{opacity:0,transform:'translateY(16px) scale(.82)'},{opacity:1,transform:'none'}], {duration:FEEDBACK_TIMING.enter,easing:FEEDBACK_TIMING.ease});
  later(state, () => {
    const target = targetFor(state.stage, event);
    if (target && !quiet) {
      const end = rect(target), current = rect(node);
      const dx = end.left + end.width / 2 - current.left - current.width / 2;
      const dy = end.top + end.height / 2 - current.top - current.height / 2;
      animate(state, node, [{transform:'none',opacity:1},{transform:`translate(${dx * .45}px,${dy * .35 - 25}px) scale(.8)`,opacity:1,offset:.45},{transform:`translate(${dx}px,${dy}px) scale(.16)`,opacity:0}], {duration:FEEDBACK_TIMING.travel,easing:FEEDBACK_TIMING.ease,fill:'forwards'});
      // A separate ring cannot overwrite the unit's attack/hit animations.
      const ring = document.createElement('i'); ring.className = 'bt-card-arrival';
      ring.style.cssText = `left:${end.left-origin.left+end.width/2-30}px;top:${end.top-origin.top+end.height/2-30}px`;
      state.layer.append(ring);
      animate(state, ring, [{opacity:0,transform:'scale(.5)'},{opacity:.85,offset:.65},{opacity:0,transform:'scale(1.8)'}], {duration:600,fill:'both'});
      later(state, () => ring.remove(), 620);
    } else if (!quiet) animate(state, node, [{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-24px) scale(.9)'}], {duration:260,fill:'forwards'});
    later(state, () => { node.remove(); state.active--; pump(state); }, quiet ? 200 : 380);
  }, quiet ? 700 : rare ? 1150 : FEEDBACK_TIMING.hold);
}
function pump(state) {
  while (state.active < 2 && state.queue.length) {
    const lane = state.nextLane++ % 2;
    state.active++; present(state, state.queue.shift(), lane);
  }
}
export function showSettledCardFeedback(stage, events = [], options = {}) {
  const mode = options.mode || 'battle', token = options.token ?? stage?._battleToken;
  const validScene = () => !options.sceneSelector || !!stage?.querySelector(options.sceneSelector);
  if (!validScene()) return;
  if (!stage?.isConnected) return;
  const host = stage.closest('#overlay') || stage.parentElement;
  if (!host || host.hidden) return;
  let state = states.get(host);
  if (state && (state.token !== token || state.stage !== stage || state.mode !== mode)) { clearCardFeedback(host); state = null; }
  const eligible = events.filter(event => event.name && (event.battleToken == null || event.battleToken === token)
    && (event.kind === 'bag' || event.kind === 'shuffle' || event.kind === 'surge' || event.kind === 'recast' || (event.kind === 'draw' && event.acquired)));
  if (!eligible.length) return;
  if (!state) {
    const layer = document.createElement('div'); layer.className = 'bt-card-feedback-layer sdt-feedback-theme'; layer.setAttribute('aria-hidden','true');
    for (const [property, value] of Object.entries(CARD_FEEDBACK_LAYOUT)) {
      if (property !== 'centerY') layer.style.setProperty(`--card-feedback-${property}`, `${value}px`);
    }
    host.append(layer);
    state = { host, stage, token, mode, layer, queue:[], active:0, nextLane:0, timers:new Set(), animations:new Set(), seen:new WeakSet() };
    state.observer = new MutationObserver(() => { if (host.hidden || !stage.isConnected || !host.contains(stage) || !validScene()) clearCardFeedback(host); });
    state.observer.observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    states.set(host,state);
  }
  for (const event of eligible) {
    if (state.seen.has(event)) continue;
    state.seen.add(event);
    if (options.rewardSource && event.kind === 'bag' && showRewardAcquisition(stage, event.card, { ...options, mode, token, count: event.count })) continue;
    const last = state.queue.at(-1);
    if (last && ['bag','draw','shuffle'].includes(event.kind) && last.event.kind === event.kind && last.event.name === event.name) last.count += event.count || 1;
    else state.queue.push({event,count:event.count || 1});
  }
  // Long bursts keep the recent visual queue bounded; the complete bounded log stays available.
  if (state.queue.length > 8) {
    const overflow = state.queue.splice(0,state.queue.length-8).reduce((sum,item) => sum+item.count,0);
    state.overflow = (state.overflow || 0) + overflow;
    let badge = /** @type {HTMLElement} */ (state.layer.querySelector('.bt-card-feedback-overflow'));
    if (!badge) { badge=document.createElement('span'); badge.className='bt-card-feedback-overflow'; state.layer.append(badge); }
    badge.textContent = `另 ${state.overflow} 次卡牌动态已结算`;
    if (state.overflowTimer) { clearTimeout(state.overflowTimer); state.timers.delete(state.overflowTimer); }
    state.overflowTimer = later(state, () => { badge.remove(); state.overflow=0; state.overflowTimer=null; }, 1800);
  }
  pump(state);
}
const clearAll = () => clearCardFeedback();
const onMode = event => { for (const [host,state] of states) if (event.detail !== state.mode) clearCardFeedback(host); };
document.addEventListener('sdt-overlay-close',clearAll);
document.addEventListener('sdt-overlay-mode',onMode);
if (import.meta.hot) import.meta.hot.dispose(() => { clearAll(); document.removeEventListener('sdt-overlay-close',clearAll); document.removeEventListener('sdt-overlay-mode',onMode); });
