// Presentation-only boundary for the remaining UI cover.
// Never changes game state, storage, action handlers or the research views.
const researchActions = [
  'labOpen', 'labBack', 'nestGo', 'nestBack', 'rcBack', 'naBack',
  'nsBack', 'nestExtractRetry', 'labScoreBack',
].map(action => `[data-act="${action}"]`).join(',');
const researchRoots = `${researchActions},[data-act^="nestCell"],[data-foe-id^="nest-"]`;
const ordinaryRoots = '#hubMain,#depMain,.slot-page,.cls2-page,.cls-pool-page,.beginner-guide,.settings-page,.studio-unified,.card-library-page,.achievement-gallery,.data-tuned,.node-pg:not(.sc-nest),.flow-transition[data-presentation="base-arrival"]';
let context = 'unknown';
let queued = false;

function updateCoverContext() {
  queued = false;
  const game = window.SDT?.game;
  const overlay = document.getElementById('overlay');
  const body = document.getElementById('ovBody');
  const visibleBody = overlay && !overlay.hidden ? body : null;
  const researchView = !!visibleBody?.querySelector(researchRoots) || !!document.getElementById('labEnding')
    || (!!game?.nestActive && !!visibleBody?.querySelector('.battle-stage.sts'));
  const titleBoundary = game?.state === 'title' && overlay?.hidden;
  const ordinaryView = !!visibleBody?.querySelector(ordinaryRoots) || titleBoundary
    || (!!game && !game.nestActive && overlay?.hidden && !document.getElementById('cardZoom'));
  const card = visibleBody?.parentElement;
  const loneNote = card?.classList.contains('wide') && visibleBody.childElementCount === 1
    && visibleBody.firstElementChild?.matches('p.ov-note');

  if (researchView) context = 'research';
  else if (ordinaryView) context = 'ordinary';
  else if (game?.nestActive && context === 'unknown') context = 'research';
  else if (loneNote) {
    // Saving sheets lack a domain marker. Retain their source context rather
    // than recolouring the final research save after nestActive is cleared.
  } else if (context === 'unknown' && game) context = 'ordinary';

  if (document.body.dataset.uiCoverContext !== context) {
    document.body.dataset.uiCoverContext = context;
  }
}

function queueCoverContext() {
  if (queued) return;
  queued = true;
  queueMicrotask(updateCoverContext);
}

document.addEventListener('sdt-overlay-mode', queueCoverContext);
const observer = new MutationObserver(queueCoverContext);
observer.observe(document.body, { childList: true, attributes: true, attributeFilter: ['class'] });
const overlayBody = document.getElementById('ovBody');
if (overlayBody) observer.observe(overlayBody, { childList: true });
const overlay = document.getElementById('overlay');
if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
updateCoverContext();
