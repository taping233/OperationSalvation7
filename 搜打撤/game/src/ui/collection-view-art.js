import { createListImageRecovery } from './list-image-recovery.js';

/** A collection retains controls while artwork is prepared separately and committed atomically. */
export function createCollectionArt({root,track,current,host,render = null,prepareRender = null,rich = false,margin = 0,filterHidden = true}) {
  const imageRecovery = createListImageRecovery({root, current, host:root.querySelector('.card-browser-footer') || root});
  const rendered = new WeakSet();
  const queued = new Set();
  let artFrame = 0;
  let disposed = false;
  const prepare = items => {
    if (disposed || !current()) return [];
    const pending = items.map(item => [item,item.querySelector(host)])
      .filter(([item,art]) => art && !rendered.has(art) && track.contains(item) && (!filterHidden || !item.hidden));
    if (!pending.length) return [];
    const draw = prepareRender ? prepareRender(pending.map(([item]) => item)) : render;
    return pending.map(([item,art]) => {
      const html = draw(item);
      return html == null ? null : [item,art,rich ? window.SDT?.Icons?.rich?.(html) ?? html : html];
    }).filter(Boolean);
  };
  const commit = prepared => {
    for (const [item,art,html] of prepared) { art.innerHTML = html; rendered.add(art);queued.delete(item);observer?.unobserve(item); }
    if (prepared.length) imageRecovery.refresh();
  };
  const hydrate = items => commit(prepare(items));
  // Visible prints stay synchronous; the larger prefetch window must not build
  // dozens of card faces in the same entry/scroll frame.
  const queueArt = items => {
    if (disposed || !current()) return;
    for (const item of items) queued.add(item);
    if (!artFrame && queued.size) artFrame = requestAnimationFrame(drawBatch);
  };
  function drawBatch() {
    artFrame = 0;
    if (disposed || !current()) { queued.clear(); return; }
    const batch = [];
    for (const item of queued) {
      queued.delete(item);
      batch.push(item);
      if (batch.length === 8) break;
    }
    hydrate(batch);
    queueArt([]);
  }
  const observer = margin && typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    const nearby = [];
    for (const entry of entries) {
      if (entry.isIntersecting) nearby.push(entry.target);
      else queued.delete(entry.target);
    }
    queueArt(nearby);
  },{root:track,rootMargin:`${margin}px 0px`}) : null;
  const refresh = () => {
    if (disposed || !current()) return;
    const items = [...track.children].filter(item => !item.hidden && !rendered.has(item.querySelector(host)));
    if (!observer) {hydrate(items);return;}
    for (const item of items) observer.observe(item);
    const viewport = track.getBoundingClientRect();
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const visible = [], nearby = [];
    queued.clear();
    // Finish the geometry pass before any template writes.
    for (const item of items) {
      const box = item.getBoundingClientRect();
      if (box.bottom < viewport.top - margin || box.top > viewport.bottom + margin) continue;
      (box.bottom >= viewport.top && box.top <= viewport.bottom ? visible : nearby).push(item);
    }
    hydrate(visible);
    queueArt(nearby);
  };
  const focus = event => { const item = event.target.closest('[data-browser-key]');if (item) hydrate([item]); };
  const dispose = () => {
    disposed = true; queued.clear();
    if (artFrame) cancelAnimationFrame(artFrame);
    artFrame = 0;
    observer?.disconnect();lifetime?.disconnect();track.removeEventListener('focusin',focus);
    imageRecovery.dispose();
  };
  const lifetime = margin ? new MutationObserver(() => {if (!root.isConnected || !current()) dispose();}) : null;
  if (margin) {
    track.addEventListener('focusin',focus);
    for (const item of track.children) observer?.observe(item);
    lifetime.observe(root.ownerDocument,{childList:true,subtree:true});
  }
  return {prepare,commit,refresh,dispose};
}
