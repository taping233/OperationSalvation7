/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
// 胜利反馈留在当前战场，完成后由原结算续流直接打开领奖页。
import '../../../css/battle-scene-polish.css';

const presentations = new WeakMap();

export function presentVictory(options = {}, isCurrent = () => true) {
  const overlay = document.getElementById('overlay');
  const stage = /** @type {BattleElement} */ (overlay?.querySelector('.battle-stage.sts'));
  if (!stage || overlay.hidden || !isCurrent()) return Promise.resolve(true);
  const token = stage._battleToken;
  if (presentations.get(stage)?.token === token) return presentations.get(stage).promise;
  const record = { token, promise: null };
  presentations.set(stage, record);
  record.promise = new Promise(resolve => {
    const wasInert = !!stage.inert;
    const notice = document.createElement('div');
    notice.className = 'battle-victory-feedback';
    notice.setAttribute('role', 'status');
    notice.textContent = options.isBoss ? '首脑已击破' : '战斗胜利';
    stage.inert = true;
    let done = false, animation, observer, deathTimer;
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const reduced = () => window.SDT?.Motion?.reduceMotion?.()
      || document.body.classList.contains('reduce-motion') || preference?.matches;
    const current = () => stage.isConnected && overlay.contains(stage) && !overlay.hidden && stage._battleToken === token && isCurrent();
    const finish = success => {
      if (done) return;
      done = true; observer?.disconnect();
      clearTimeout(deathTimer);
      preference?.removeEventListener?.('change', onPreference);
      document.removeEventListener('sdt-overlay-mode', onMode);
      document.removeEventListener('sdt-overlay-close', onClose);
      notice.remove();
      if (stage._battleToken === token) { stage.inert = wasInert; stage.classList.remove('battle-won'); }
      if (!success) animation?.cancel();
      resolve(success && current());
    };
    const onMode = event => { if (event.detail !== 'battle') finish(false); };
    const onClose = () => finish(false);
    document.addEventListener('sdt-overlay-mode', onMode);
    document.addEventListener('sdt-overlay-close', onClose);
    const onPreference = () => { if (reduced()) finish(true); };
    preference?.addEventListener?.('change', onPreference);
    observer = new MutationObserver(() => { if (!current()) finish(false); else onPreference(); });
    observer.observe(document.body, { attributes: true, attributeFilter: ['hidden', 'class'], childList: true, subtree: true });
    // 没有画面、减少动效或不支持动画时不增加等待；不另开独立过场页。
    if (reduced() || typeof notice.animate !== 'function') { finish(true); return; }
    function showNotice() {
      clearTimeout(deathTimer);
      if (done) return;
      if (!current()) { finish(false); return; }
      stage.appendChild(notice); stage.classList.add('battle-won');
      animation = notice.animate([
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)', offset: .2 },
        { opacity: 1, transform: 'translateY(0)', offset: .78 },
        { opacity: 0, transform: 'translateY(-4px)' },
      ], { duration: 380, easing: 'ease-out', fill: 'both' });
      animation.finished.then(() => finish(true), () => finish(false));
    }
    // Wait for the actual finite death animations, rather than cutting them at a fixed beat.
    const deaths = [.../** @type {NodeListOf<BattleElement>} */ (stage.querySelectorAll('.sts-foe.dead:not(.bt-death-pending)'))]
      .flatMap(enemy => enemy.getAnimations?.({ subtree: true }) || [])
      .filter(run => run.playState === 'running' && Number.isFinite(run.effect?.getComputedTiming?.().endTime));
    if (!deaths.length) showNotice();
    else {
      deathTimer = setTimeout(showNotice, 1100);
      Promise.allSettled(deaths.map(run => run.finished)).then(showNotice);
    }
  });
  return record.promise;
}
