const app = document.getElementById('app');
const root = document.body;
const cursor = document.getElementById('codenameCursor');
const cursorImage = cursor?.querySelector('img');

if (app && cursor && cursorImage) {
  const assets = '../assets/ui/cursors/';
  const clickable = [
    'button:not(:disabled)', 'a[href]', '[role="button"]', '[data-action]', '[data-route-index]', '#game',
    'input[type="button"]:not(:disabled)', 'input[type="submit"]:not(:disabled)',
    'input[type="range"]', 'input[type="checkbox"]', 'input[type="radio"]', 'label[for]', 'summary',
    '.ov-btn:not(.dis)', '.menu-btn:not(:disabled)', '.mode-card', '.cls-card', '.stash-row', '.step-btn:not(:disabled)',
    '.bt-card:not(.off)', '.bt-pile.clickable', '.bt-foe.can-target', '.sts-unit.can-target',
    '.sts-equip.has-skill:not(.used)', '.shop-row', '.bag-cell.filled', '.lib-cardwrap',
    '.dep-card', '.sac-row', '.event-choice-card', '.type-tab', '#btnMapOverview',
  ].join(',');
  const aiming = '.battle-stage[data-phase="targeting"] :is(.sts-unit.can-target, .bt-foe.can-target, .bt-card.targeting, .bt-potion.need-target)';
  const textField = 'input:not([type="button"]):not([type="submit"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]';
  let pointerX = 0;
  let pointerY = 0;
  let leftPointerId = null;
  let downX = 0;
  let downY = 0;
  let dragged = false;
  let animationFrame = 0;
  let previousState = '';

  const setState = (state) => {
    if (state === previousState) return;
    previousState = state;
    cursor.dataset.state = state;
    cursorImage.src = `${assets}${state === 'default' ? 'field-pointer.png' : `${state}.svg`}`;
    cursor.classList.toggle('is-target', state === 'target');
  };

  const scheduleUpdate = () => {
    if (animationFrame) return;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = 0;
      const element = document.elementFromPoint(pointerX, pointerY);
      const target = element instanceof Element ? element : null;
      if (!target || !root.contains(target)) {
        cursor.hidden = true;
        return;
      }
      cursor.hidden = false;
      if (target.closest(textField)) {
        cursor.hidden = true;
        return;
      }
      const disabled = target.closest(':disabled, [aria-disabled="true"], .off, .dis, .used');
      const gameCursor = document.getElementById('game')?.style.cursor;
      let state = 'default';
      if (target.closest(aiming)) state = 'target';
      else if (disabled || gameCursor === 'not-allowed') state = 'unavailable';
      else if (gameCursor === 'wait') state = 'waiting';
      else if (leftPointerId !== null && dragged && target.closest('#game, .dep-card, .bt-card[data-aim="1"]')) state = 'grabbing';
      else if (gameCursor === 'grabbing') state = 'grabbing';
      else if (gameCursor === 'pointer' || gameCursor === 'cell' || target.closest(clickable)) state = 'interactive';
      setState(state);
    });
  };

  const clearPress = () => {
    leftPointerId = null;
    dragged = false;
    cursor.classList.remove('is-pressed');
  };

  app.dataset.cursorReady = 'true';
  root.dataset.cursorReady = 'true';
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (leftPointerId === event.pointerId && Math.hypot(pointerX - downX, pointerY - downY) > 5) {
      dragged = true;
      cursor.classList.remove('is-pressed');
    }
    cursor.style.transform = `translate3d(${pointerX - 4}px, ${pointerY - 4}px, 0)`;
    scheduleUpdate();
  }, true);

  root.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || event.target !== root) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    cursor.style.transform = `translate3d(${pointerX - 4}px, ${pointerY - 4}px, 0)`;
    cursor.hidden = false;
    scheduleUpdate();
  }, true);
  root.addEventListener('pointerleave', (event) => {
    // Ignore descendant leave events; hide only when crossing the page boundary.
    if (event.pointerType === 'mouse' && event.target === root) cursor.hidden = true;
  }, true);

  root.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !root.contains(target)) return;
    if (target.closest(textField)) {
      cursor.hidden = true;
      return;
    }
    pointerX = event.clientX;
    pointerY = event.clientY;
    cursor.style.transform = `translate3d(${pointerX - 4}px, ${pointerY - 4}px, 0)`;
    cursor.hidden = false;
    leftPointerId = event.pointerId;
    downX = event.clientX;
    downY = event.clientY;
    dragged = false;
    cursor.classList.add('is-pressed');
    cursor.classList.remove('is-pulsing');
    scheduleUpdate();
  }, true);
  window.addEventListener('pointerup', (event) => {
    if (leftPointerId !== event.pointerId) return;
    const clicked = !dragged && event.button === 0;
    clearPress();
    if (clicked) {
      cursor.classList.remove('is-pulsing');
      void cursor.offsetWidth;
      cursor.classList.add('is-pulsing');
      window.setTimeout(() => cursor.classList.remove('is-pulsing'), 320);
    }
    scheduleUpdate();
  }, true);
  window.addEventListener('pointercancel', clearPress, true);
  window.addEventListener('blur', () => {
    clearPress();
    cursor.hidden = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearPress();
  });
}
