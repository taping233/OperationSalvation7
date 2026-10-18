// Finite, read-only presentation check for foreground screenshot fixtures.
// Does not disable animations or assume a fixed sleep equals readiness.
const generations = new WeakMap();
export function markReviewReady(root) {
  const generation = (generations.get(root) || 0) + 1;
  generations.set(root, generation);
  root.dataset.reviewReady = 'pending';
  let previous = '', stableFrames = 0, frames = 0;
  const check = () => {
    if (generations.get(root) !== generation || !root.isConnected) return;
    if (document.hidden) { requestAnimationFrame(check); return; }
    frames++;
    const moving = root.getAnimations({ subtree:true }).some(animation =>
      animation.effect?.getTiming().iterations !== Infinity &&
      ['pending', 'running'].includes(animation.playState));
    const imagesReady = [...root.querySelectorAll('img')].every(image => image.complete);
    const rects = [...root.querySelectorAll('button,h2,h3,.evt-opt,.reward-unit')].map(el => {
      const r=el.getBoundingClientRect();
      return [r.x,r.y,r.width,r.height].map(value=>Math.round(value*10)).join(',');
    }).join(';');
    stableFrames = !moving && imagesReady && previous === rects ? stableFrames+1 : 0;
    previous = rects;
    if (stableFrames >= 2) { root.dataset.reviewReady='true'; return; }
    if (frames >= 240) { root.dataset.reviewReady='unresolved'; return; }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}
