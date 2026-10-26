import { motionReduced } from './motion-presets.js';
import { transitionPause } from './transition-handoff.js';
import { silentFilmSceneryHTML } from './silent-node-film.js';
import { cinematicProfile } from './cinematic-profiles.js';
import '../../css/departure-cinematic.css';

export const DEPARTURE_ART = cinematicProfile('departure').art;

// Presentation runs alongside the existing departure transaction. Skipping only
// shortens the film; destination readiness still owns when input is released.
export function createDepartureCinematic(kind = 'departure') {
  const profile = cinematicProfile(kind);
  const element = document.createElement('div');
  element.className = `departure-handoff departure-film departure-film-${kind}`;
  element.classList.toggle('silent-film-light',profile.background==='#e8e5dd');
  element.dataset.filmKind=kind;
  element.dataset.filmExit=profile.exit;
  element.style.setProperty('--sf-exit',`sfExit-${profile.exit}`);
  element.style.setProperty('--silent-film-bg',profile.background);
  element.style.setProperty('--silent-film-duration',`${profile.duration}ms`);
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-label', `${profile.label}演出`);
  element.innerHTML = `${silentFilmSceneryHTML(kind,'departure-film-art')}
    ${kind === 'extraction' ? '<p class="departure-film-caption">撤离成功</p>' : ''}
    <button type="button" class="departure-film-skip" aria-label="跳过${profile.label}演出"><span aria-hidden="true">↗</span></button>
    <span class="departure-film-status" role="status" aria-live="polite"></span>`;
  const button = element.querySelector('button');
  const art = /** @type {HTMLImageElement} */ (element.querySelector('img'));
  const controller = new AbortController();
  let skipped = false, playback = null;
  const skip = () => {
    if (skipped) return;
    skipped = true;
    controller.abort();
    element.classList.add('departure-film-skipped');
    button.setAttribute('aria-disabled', 'true');
    element.querySelector('.departure-film-status').textContent = '正在准备下一画面';
  };
  button.addEventListener('click', skip);
  return {
    element, skip,
    play() {
      if (playback) return playback;
      playback = (async () => {
        if (motionReduced()) { element.classList.add('departure-film-playing'); return; }
        // A missing image never strands the transaction behind an empty cover.
        const loaded = !art ? Promise.resolve(true) : new Promise(resolve => {
          const finish = () => {
            clearTimeout(timer);
            art.removeEventListener('load', finish); art.removeEventListener('error', finish);
            controller.signal.removeEventListener('abort', finish);
            resolve(true);
          };
          const timer = setTimeout(finish, 700);
          art.addEventListener('load', finish, { once:true });
          art.addEventListener('error', finish, { once:true });
          controller.signal.addEventListener('abort', finish, { once:true });
          if (art.complete || controller.signal.aborted) finish();
        });
        await loaded;
        element.classList.add('departure-film-playing');
        await transitionPause(profile.duration, controller.signal);
      })();
      return playback;
    },
    async reveal() {
      const exitDuration = skipped ? 140 : Math.max(680, profile.exitDuration);
      element.classList.add('departure-film-revealing','leaving');
      element.style.setProperty('--silent-film-exit-duration',`${exitDuration}ms`);
      await transitionPause(motionReduced() ? 0 : exitDuration);
    },
    dispose() {
      controller.abort();
      button.removeEventListener('click', skip);
      element.remove();
    },
  };
}
