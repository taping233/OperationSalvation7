import { retargetVisual, clearVisual } from './target-motion.js';
import { motionTiming, motionEasing, motionReduced } from './motion-presets.js';
import { quietFeedback } from './feedback-theme.js';
import '../../css/card-state-motion.css';

const flights = new Set();
const receipts = new Map();
// Fixed-position CSS still lives inside the html zoom; write unscaled layout values.
const layoutRect = element => window.SDT?.UiScale?.rect(element) || element.getBoundingClientRect();
function visible(element) {
  if (!element?.isConnected || element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
  const box = element.getBoundingClientRect();
  if (!(box.width > 0 && box.height > 0)) return false;
  for (let parent = element; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parent !== element && /auto|scroll|hidden|clip/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) {
      const clip = parent.getBoundingClientRect();
      if (clip.width && clip.height && (box.right <= clip.left || box.left >= clip.right || box.bottom <= clip.top || box.top >= clip.bottom)) return false;
    }
  }
  return box.bottom > 0 && box.right > 0 && box.left < window.innerWidth && box.top < window.innerHeight;
}
export function clearRewardAcquisition(host) {
  for (const flight of [...flights]) if (!host || host === flight.host) flight.dispose();
}

// Called only after the shared successful-grant hook. Missing endpoints use its existing reveal queue.
export function showRewardAcquisition(stage, card, { mode = 'chest', token, count = 1, sceneSelector = '.reward-replica,.cqo-overview' } = {}) {
  if (!stage?.isConnected || quietFeedback() || motionReduced()) return false;
  if (sceneSelector && !stage.querySelector(sceneSelector)) return false;
  const source = [...stage.querySelectorAll('[data-reward-card]')]
    .find(element => element.dataset.rewardCard === String(card.id || card.name))?.querySelector('.reward-card');
  const findTarget = () => [...stage.querySelectorAll('[data-card-receive-anchor="bag"],.reward-capacity,[data-act="entrySupplyBag"]')].find(visible);
  let target = findTarget();
  const face = source?.querySelector('.hs-card');
  if (!face || !visible(source) || !target) return false;
  const host = stage.closest('#overlay') || stage.parentElement;
  if (!host || host.hidden) return false;
  // A new run replaces any old run's purely visual receipt.
  for (const flight of [...flights]) if (flight.host === host && (flight.token !== token || flight.mode !== mode)) flight.dispose();
  const start = layoutRect(source);
  const node = document.createElement('div');
  node.className = 'reward-acquisition-card'; node.inert = true; node.setAttribute('aria-hidden','true');
  node.style.cssText = `left:${start.left}px;top:${start.top}px;width:${start.width}px;height:${start.height}px`;
  const clone = face.cloneNode(true);
  for (const element of [clone, ...clone.querySelectorAll('*')]) {
    element.removeAttribute('id'); element.removeAttribute('tabindex');
  }
  // The holder keeps its live endpoint; the face plays one short lift/shrink.
  // Retargeting the holder never restarts the face or extends the grant receipt.
  const body = document.createElement('div'); body.className = 'reward-acquisition-body';
  body.style.setProperty('--reward-flight-duration', `${motionTiming.acquire}ms`);
  body.append(clone); node.append(body); document.body.append(node);
  if (count > 1) {
    const badge = document.createElement('span'); badge.className = 'reward-acquisition-count';
    badge.textContent = `×${count}`; body.append(badge);
  }
  const nodes = new Set([node]);
  const deadline = performance.now() + motionTiming.acquire;
  const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let revision = 0, arrival = null, pendingFrame = null, endKey = '';
  const keyFor = box => [box.left, box.top, box.width, box.height].join(',');
  const flight = { host, stage, token, mode, dispose() {
    revision++;
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
    window.removeEventListener('scroll', scheduleGeometry, true);
    window.removeEventListener('resize', scheduleGeometry);
    preference?.removeEventListener?.('change', refreshGeometry);
    if (receipts.get(host)?.owner === flight) receipts.delete(host);
    observer.disconnect(); for (const item of nodes) { clearVisual(item); item.remove(); }
    nodes.clear(); flights.delete(flight);
  } };
  function placeArrival() {
    const box = layoutRect(target);
    Object.assign(arrival.style, { left: `${box.left - 4}px`, top: `${box.top - 4}px`, width: `${box.width + 8}px`, height: `${box.height + 8}px` });
  }
  function travel() {
    const end = layoutRect(target), currentRevision = ++revision;
    endKey = keyFor(end);
    const run = retargetVisual(node, {
      x: end.left + end.width / 2 - start.left - start.width / 2,
      y: end.top + end.height / 2 - start.top - start.height / 2,
      scale: 1, rotate: 0, opacity: 1,
    }, { duration: Math.max(0, deadline - performance.now()), easing: motionEasing.travel });
    run.finished.then(completed => {
      if (!flights.has(flight) || revision !== currentRevision) return;
      if (!completed) { flight.dispose(); return; }
      const currentTarget = findTarget();
      if (!currentTarget) { flight.dispose(); return; }
      if (currentTarget !== target || keyFor(layoutRect(currentTarget)) !== endKey) { target = currentTarget; travel(); return; }
      clearVisual(node); node.remove(); nodes.delete(node);
      const shared = receipts.get(host);
      if (shared) { shared.detach(); arrival = shared.node; }
      else {
        arrival = document.createElement('i');
        arrival.className = 'reward-acquisition-arrival'; arrival.setAttribute('aria-hidden','true');
      }
      placeArrival(); document.body.append(arrival); nodes.add(arrival);
      receipts.set(host, { node: arrival, owner: flight, detach() { nodes.delete(arrival); flight.dispose(); } });
      retargetVisual(arrival, { opacity: 0, scale: 1.035 }, { from: { opacity: .65, scale: 1 }, duration: motionTiming.change }).finished.then(() => flight.dispose());
    });
  }
  function refreshGeometry() {
    if (!flights.has(flight)) return;
    if (motionReduced() || !stage.isConnected || host.hidden || !host.contains(stage)
      || (sceneSelector && !stage.querySelector(sceneSelector))) { flight.dispose(); return; }
    const replacement = findTarget();
    if (!replacement) return;
    const moved = replacement !== target || keyFor(layoutRect(replacement)) !== endKey;
    target = replacement;
    if (arrival) placeArrival(); else if (moved) travel();
  }
  function scheduleGeometry() {
    if (pendingFrame !== null) return;
    pendingFrame = requestAnimationFrame(() => { pendingFrame = null; refreshGeometry(); });
  }
  const observer = new MutationObserver(refreshGeometry);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  flights.add(flight);
  preference?.addEventListener?.('change', refreshGeometry);
  window.addEventListener('scroll', scheduleGeometry, { capture: true, passive: true });
  window.addEventListener('resize', scheduleGeometry, { passive: true });
  if (flights.size > 8) [...flights][0].dispose();
  travel();
  return true;
}
