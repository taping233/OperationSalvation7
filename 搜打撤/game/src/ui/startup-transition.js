import { createCityCut, prepareCityCut } from './camp-entry.js';
import { visualFrame } from './page-visual-ready.js';
import { revealTransition } from './transition-handoff.js';
import { startSilentFilm } from './silent-node-film.js';
import '../../css/startup-transition.css';

let activeCleanup;

// Desktop and the preview drive the same DOM handshake; ordinary web entry stays unchanged.
export function installStartupTransition() {
  activeCleanup?.();
  const root = document.documentElement;
  let cover;
  let cut;
  let preparing = false;
  let playing = false;
  const controller = new AbortController();
  const blockKeys = event => {
    if (!cover) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  const finish = () => {
    controller.abort();
    cover?.remove();
    observer.disconnect();
    window.removeEventListener('pagehide', finish);
    window.removeEventListener('keydown', blockKeys, true);
    if (activeCleanup === finish) activeCleanup = null;
  };
  const prepare = async () => {
    if (preparing) return;
    preparing = true;
    const reduced = document.body.classList.contains('reduce-motion')
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      cover = document.createElement('div');
      cover.className = 'desktop-startup-cut page-loading--city';
      cover.setAttribute('role', 'status');
      cover.setAttribute('aria-label', '进入城市');
      cut = createCityCut({ archive: '城市档案', title: '进入城市',
        subtitle: 'ENTER THE CITY / 冬日猜想', destination: 'CITY', watermark: 'CITY', scene: 'departure' });
      cut.classList.add('page-cut-waiting');
      cover.append(cut);
      document.body.append(cover);
      window.addEventListener('keydown', blockKeys, true);
      await prepareCityCut(cut, { signal: controller.signal, deferPlayback:true });
    }
    await visualFrame(controller.signal);
    await visualFrame(controller.signal);
    if (!controller.signal.aborted && root.dataset.desktopStartup === 'preparing') root.dataset.desktopStartup = 'covered';
  };
  const update = () => {
    const state = root.dataset.desktopStartup;
    if (state === 'preparing') prepare().catch(() => {
      if (controller.signal.aborted) return;
      cover?.remove(); cover = null; cut = null;
      root.dataset.desktopStartup = 'covered';
    });
    else if (state === 'playing' && !playing) {
      playing = true;
      startSilentFilm(cut);
      cut?.classList.remove('page-cut-waiting');
      const complete = () => { root.dataset.desktopStartup = 'complete'; finish(); };
      if (cut) revealTransition(cover, { signal:controller.signal, painted:true,
        isCurrent:() => root.dataset.desktopStartup === 'playing' }).then(ok => { if (ok) complete(); }, finish);
      else complete();
    } else if (state === 'cancelled') finish();
  };
  const observer = new MutationObserver(update);
  observer.observe(root, { attributes: true, attributeFilter: ['data-desktop-startup'] });
  window.addEventListener('pagehide', finish, { once: true });
  activeCleanup = finish;
  update();
  return finish;
}

const cleanup = installStartupTransition();
if (import.meta.hot) import.meta.hot.dispose(cleanup);
