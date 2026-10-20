// Shared hand policy: static rectangles in original paint order; no nearest-card snapping.
export function pickStaticHandRegion(regions, x, y) {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return r.uid;
  }
  return null;
}
export function resolveHandHit({ regions, x, y, actualUid, interactive = false, ownerUid = null, accessBands = [] }) {
  if (interactive) return { uid: actualUid, route: 'control' };
  if (ownerUid != null && pickStaticHandRegion(accessBands, x, y) != null) return { uid: ownerUid, route: 'reading-access' };
  const uid = pickStaticHandRegion(regions, x, y);
  return uid == null ? { uid: actualUid, route: 'outside-reading' } : { uid, route: 'static-region' };
}

// Swept vertical bounds of real controls as the same card rises from rest to reading.
// Full card width joins its exposed strip to the control; the middle art remains selectable.
export function readingAccessBands({ uid, left, right, raisedTop, restDrop, cardTop, controls }) {
  return controls.filter(r => r.width > 0 && r.height > 0).map(r => ({ uid, left, right,
    top: raisedTop + (r.top - cardTop),
    bottom: raisedTop + (r.bottom - cardTop) + restDrop,
  }));
}

// One controller owns visual reading and physical card gestures. Commands remain
// with the existing view/aim callbacks; native controls never get rerouted.
const CONTROL = 'button,[data-term],.hsc-desc,input,select,textarea,a';
export function createHandHitController(root, { getCards, scale, isAiming, onPointerDown, onPlay }) {
  let ownerUid = null, press = null, identity = '';
  const existingAimPresses = new WeakSet();
  function rememberAim(event) {
    if (event.target instanceof Node && root.contains(event.target) && isAiming()) existingAimPresses.add(event);
  }
  const liveCards = () => getCards().filter(card => root.contains(card)
    && !card.closest('[hidden],[aria-hidden="true"],[inert]'));
  const cardOf = target => target?.closest?.('.bt-card') || target?.closest?.('.bt-slot')?.querySelector('.bt-card');
  function paint(uid) {
    ownerUid = uid;
    for (const card of getCards()) card.closest('.bt-slot')?.classList.toggle('hand-reading', card.dataset.uid === uid);
  }
  function reset() { if (press) press.invalid = true; paint(null); }
  function resolve(event, reading = true) {
    const cards = liveCards(), zoom = scale();
    const actual = cardOf(event.target);
    const actualUid = cards.includes(actual) ? actual.dataset.uid : null;
    const regions = cards.map(card => {
      const slot = card.closest('.bt-slot'), r = slot.getBoundingClientRect();
      const height = card.offsetHeight * zoom;
      const rest = (parseFloat(slot.style.getPropertyValue('--hand-rest')) || 0) * zoom;
      return { uid: card.dataset.uid, left: r.left, right: r.right,
        top: r.top + Math.min(rest, height), bottom: Math.max(r.top + rest + height, r.bottom) };
    });
    const owner = reading ? cards.find(card => card.dataset.uid === ownerUid) : null;
    let accessBands = [];
    if (owner) {
      const slot = owner.closest('.bt-slot'), r = slot.getBoundingClientRect();
      accessBands = readingAccessBands({ uid: ownerUid, left: r.left, right: r.right,
        raisedTop: r.top, restDrop: (parseFloat(slot.style.getPropertyValue('--hand-rest')) || 0) * zoom,
        cardTop: owner.getBoundingClientRect().top,
        controls: [...owner.querySelectorAll('.bt-infchip,.hsc-desc')].map(el => el.getBoundingClientRect()) });
    }
    return resolveHandHit({ regions, x: event.clientX, y: event.clientY, actualUid,
      interactive: !!event.target?.closest?.(CONTROL), ownerUid: owner?.dataset.uid, accessBands });
  }
  function move(event) {
    if (event.pointerType === 'touch' || event.isPrimary === false || event.buttons || isAiming()) return;
    paint(resolve(event).uid);
  }
  function down(event) {
    if (event.button !== 0 || event.isPrimary === false || event.isComposing || event.defaultPrevented) return;
    if (isAiming() || existingAimPresses.has(event)) return;
    press = null;
    if (event.target?.closest?.(CONTROL)) return;
    const choice = resolve(event, event.pointerType !== 'touch');
    const card = liveCards().find(card => card.dataset.uid === choice.uid);
    if (!card) return;
    paint(choice.uid);
    press = { uid: choice.uid, pointerId: event.pointerId, aimed: false };
    onPointerDown(event, card);
    if (press) press.aimed = isAiming();
  }
  function click(event) {
    // Keyboard and assistive/programmatic activation retain the existing path.
    if (event.detail === 0 || event.button !== 0 || event.defaultPrevented) return;
    if (event.target?.closest?.(CONTROL)) {
      // Reading text is not a play command; buttons keep their native action.
      if (event.target.closest('.hsc-desc') && !event.target.closest('button,a,input,select,textarea')) event.stopPropagation();
      press = null;
      return;
    }
    if (!cardOf(event.target)) return;
    const previous = press; press = null;
    event.stopPropagation(); // Exactly one dispatch, never the ovBody btPlay again.
    if (isAiming() || previous?.aimed || previous?.invalid) return;
    if (previous && event.pointerId != null && previous.pointerId != null && event.pointerId !== previous.pointerId) return;
    const uid = previous?.uid ?? resolve(event, event.pointerType !== 'touch').uid;
    if (liveCards().some(card => card.dataset.uid === uid)) onPlay(uid);
  }
  function leave() { if (!isAiming()) paint(null); }
  function visibility() { if (document.hidden) reset(); }
  root.dataset.handHit = 'fixed';
  root.addEventListener('pointerover', move, true);
  root.addEventListener('pointermove', move, true);
  root.addEventListener('pointerdown', down, true);
  root.addEventListener('click', click, true);
  root.addEventListener('pointerleave', leave);
  root.addEventListener('pointercancel', reset, true);
  // Installed before startAim adds its window capture handlers: cancellation
  // of an old pickup must not turn the same down into a new pickup.
  window.addEventListener('pointerdown', rememberAim, true);
  window.addEventListener('blur', reset);
  window.addEventListener('resize', reset);
  document.addEventListener('visibilitychange', visibility);
  return {
    sync(token, interaction = {}) {
      // A refused pickup must not become a fresh click when settlement or a
      // selection ends with the same hand. Energy changes do not end reading.
      const { phase, turn, busy, infusing, discovering, choosing, handSelecting,
        pendingTarget, pendingItem, slamPending, dartPending, viewingDeck, viewingGrave, viewingBag } = interaction;
      const next = JSON.stringify([token, phase, turn,
        ...[busy, infusing, discovering, choosing, handSelecting, pendingTarget,
          pendingItem, slamPending, dartPending, viewingDeck, viewingGrave, viewingBag].map(Boolean),
        ...getCards().map(card => card.dataset.uid)]);
      if (next !== identity) { reset(); identity = next; }
    },
    reset,
    dispose() {
      reset();
      root.removeEventListener('pointerover', move, true);
      root.removeEventListener('pointermove', move, true);
      root.removeEventListener('pointerdown', down, true);
      root.removeEventListener('click', click, true);
      root.removeEventListener('pointerleave', leave);
      root.removeEventListener('pointercancel', reset, true);
      window.removeEventListener('pointerdown', rememberAim, true);
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', reset);
      document.removeEventListener('visibilitychange', visibility);
      delete root.dataset.handHit;
    },
  };
}
