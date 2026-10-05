// Local character-browser motion; never changes selection or storage itself.
export function createCharacterViewMotion() {
  let switching = false;
  const previews = new WeakMap();
  const reduced = () => document.body.classList.contains('reduce-motion')
    || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

  function page(commit) {
    if (switching) return false;
    const root = document.querySelector('#overlay .cls2-page, #overlay .cls-pool-page');
    if (!root || reduced() || typeof root.animate !== 'function') {
      commit();
      return true;
    }
    switching = true;
    root.dataset.characterView = 'out';
    const current = getComputedStyle(root);
    const fade = root.animate([
      { opacity: current.opacity, transform: current.transform },
      { opacity: 0, transform: 'translateY(-8px)' },
    ], { duration: 150, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' });
    // Navigation follows a bounded UI clock: hidden/captured pages can pause
    // or cancel native animations without delivering a finished event.
    window.setTimeout(() => {
      const overlay = document.getElementById('overlay');
      const active = root.isConnected && overlay && !overlay.hidden && !overlay.classList.contains('closing');
      switching = false;
      delete root.dataset.characterView;
      fade.cancel();
      if (active) commit();
    }, 150);
    fade.finished.catch(() => {});
    return true;
  }

  function preview(element) {
    if (!element || reduced() || typeof element.animate !== 'function') return;
    previews.get(element)?.cancel();
    const fade = element.animate([
      { opacity: .4, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 180, easing: 'cubic-bezier(.22,1,.36,1)' });
    previews.set(element, fade);
    fade.finished.catch(() => {});
  }

  function enter() {
    const root = document.querySelector('#overlay .cls2-page, #overlay .cls-pool-page');
    if (!root || reduced() || typeof root.animate !== 'function') return;
    const fade = root.animate([
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
    fade.finished.catch(() => {});
  }

  return Object.freeze({ page, preview, enter, get busy() { return switching; } });
}
