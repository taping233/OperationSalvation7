import '../../css/silent-node-film.css';
import { escAttr } from '../core/shared.js';
import { CINEMATIC_PROFILES, cinematicProfile } from './cinematic-profiles.js';
import { mapImageReady } from '../core/map-image-ready.js';
import { motionReduced } from './motion-presets.js';
export const SILENT_FILMS = CINEMATIC_PROFILES;
const filmStarts=new WeakMap();

export function silentFilmSceneryHTML(kind, className='camp-entry-scenery', artwork=cinematicProfile(kind).art) {
  const profile=cinematicProfile(kind);
  const image=profile.renderer==='image' ? `<img class="silent-node-art" src="${escAttr(artwork)}" alt="" decoding="async" draggable="false">` : '';
  return `<div class="${escAttr(className)} silent-film-scenery" data-film-motion="${profile.motion}" data-film-renderer="${profile.renderer}" aria-hidden="true">${image}<i class="sf-plane sf-plane-a"></i><i class="sf-plane sf-plane-b"></i><i class="sf-stroke"></i><i class="sf-wash"></i><i class="sf-shade"></i></div>`;
}

// Uses the existing city-cut readiness/lifetime contract, without its typography
// or diagonal frame. These are symbolic inserts, not new story entities.
/** @param {string} [kind] @param {{duration?: number, art?: string}} [options] */
export function createSilentNodeCut(kind='loading', {duration,art}={}) {
  const profile=cinematicProfile(kind);
  const cut = document.createElement('div');
  cut.className = 'camp-entry-cut silent-node-cut';
  cut.dataset.filmKind=kind;
  cut.dataset.filmExit=profile.exit;
  cut.dataset.filmExitDuration=String(profile.exitDuration);
  cut.style.setProperty('--silent-film-bg',profile.background);
  cut.style.setProperty('--silent-film-duration',`${duration ?? profile.duration}ms`);
  cut.style.setProperty('--sf-exit',`sfExit-${profile.exit}`);
  cut.dataset.filmDuration=String(duration ?? profile.duration);
  cut.setAttribute('aria-hidden','true');
  cut.inert = true;
  cut.innerHTML=silentFilmSceneryHTML(kind,'camp-entry-scenery',art || profile.art);
  return cut;
}

// Artwork readiness starts one real layered entrance, independently of how long
// destination preparation holds the opaque curtain. Handed-off clones stay still.
/** @param {HTMLElement} cut @param {{signal?: AbortSignal, timeout?: number, deferPlayback?: boolean}} [options] */
export async function prepareSilentFilm(cut,{signal,timeout=3000,deferPlayback=false}={}) {
  if (!cut || signal?.aborted) return false;
  const image=/** @type {HTMLImageElement} */ (cut.querySelector('.silent-node-art'));
  const ready=image ? await mapImageReady(image,{signal,timeout}) : true;
  if (signal?.aborted) return false;
  if (!ready && image) { cut.dataset.scenery='fallback'; image.style.display='none'; }
  if (!deferPlayback) startSilentFilm(cut);
  return true;
}
export function startSilentFilm(cut) {
  if (cut && !filmStarts.has(cut)) {
    filmStarts.set(cut,performance.now());
    cut.classList.remove('page-cut-waiting');
    cut.classList.add('silent-film-playing');
  }
}
export function silentFilmRemaining(cut) {
  if (!cut || motionReduced() || cut.classList.contains('silent-film-settled') || cut.dataset.scenery==='fallback') return 0;
  const started=filmStarts.get(cut);
  return started==null ? 0 : Math.max(0,(Number(cut.dataset.filmDuration)||980)-(performance.now()-started));
}
