import { rect as uiRect } from '../../ui/ui-scale.js';
import { assetUrl } from '../../core/asset-url.js';
import { schedulePresentationMs } from '../runtime/battle.clock.js';
import '../../../css/battle-fx-art.css';

// One atlas and lifecycle for all battle art. Turn title text stays in its own presenter.
const kinds = ['slash', 'block', 'magic', 'fire', 'ice', 'lightning', 'poison', 'heal',
  'curse', 'pulse', 'trail', 'death', 'buff', 'debuff', 'draw', 'boss'];
const live = new Set();
const atlas = () => assetUrl('assets/battle/fx-atlas.webp?v=muted-brush-20261026');
export function battleFigureRect(fig) {
  const rect = uiRect(fig), unit = fig.closest('.sts-me');
  if (!unit) return rect;
  const style = getComputedStyle(unit);
  const height = parseFloat(style.getPropertyValue('--battle-actor-height'))
    || parseFloat(style.getPropertyValue('--battle-body-height')) || 278;
  const measuredInset = parseFloat(unit.style.getPropertyValue('--battle-actor-foot-inset'));
  const inset = Number.isFinite(measuredInset) ? measuredInset
    : rect.height * (parseFloat(style.getPropertyValue('--battle-foot-margin')) || .052632);
  const bottom = rect.bottom - inset;
  return { ...rect, top: bottom - height, bottom, height };
}
export function createBattleArt(kind) {
  const index = Math.max(0, kinds.indexOf(kind));
  const node = document.createElement('i');
  node.className = `bt-fx-art fx-art-${kinds[index]}`;
  node.setAttribute('aria-hidden', 'true');
  node.style.backgroundImage = `url("${atlas()}")`;
  node.style.backgroundPosition = `${index % 4 * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%`;
  return node;
}
export function clearBattleArt() {
  for (const remove of [...live]) remove();
}
document.addEventListener('sdt-overlay-close', clearBattleArt);
const onMode = event => { if (event.detail !== 'battle') clearBattleArt(); };
document.addEventListener('sdt-overlay-mode', onMode);
if (import.meta.hot) import.meta.hot.dispose(() => {
  clearBattleArt();
  document.removeEventListener('sdt-overlay-close', clearBattleArt);
  document.removeEventListener('sdt-overlay-mode', onMode);
});

export function emitBattleArt(stage, kind, options = {}) {
  const host = stage?.closest('#overlay') || stage?.parentElement;
  if (!stage?.isConnected || !host || host.hidden) return null;
  const origin = uiRect(host);
  const target = options.anchor ? battleFigureRect(options.anchor) : uiRect(stage);
  const at = options.at || { x: target.left - origin.left + target.width / 2,
    y: target.top - origin.top + target.height * (options.anchor ? .42 : .46) };
  const node = createBattleArt(kind), size = options.size || 160;
  node.style.left = `${at.x}px`; node.style.top = `${at.y}px`;
  node.style.width = node.style.height = `${size}px`;
  if (options.tint) node.style.filter = options.tint;
  host.append(node);
  const quiet = !!window.SDT?.Motion?.reduceMotion?.() || document.body.dataset.renderQuality === 'low';
  const duration = quiet ? 280 : options.duration || 620;
  const angle = options.angle || 0;
  const travel = options.travel || { x: 0, y: kind === 'heal' || kind === 'buff' ? -34 : 0 };
  let cancel, animation;
  const remove = () => { cancel?.(); animation?.cancel(); node.remove(); live.delete(remove); };
  while (live.size >= 36) live.values().next().value();
  live.add(remove);
  if (!quiet && node.animate) animation = node.animate([
    { opacity: 0, transform: `translate(-50%,-50%) scale(.45) rotate(${angle - 8}deg)` },
    { opacity: .84, transform: `translate(-50%,-50%) scale(1) rotate(${angle}deg)`, offset: .22 },
    { opacity: .65, transform: `translate(-50%,-50%) translate(${travel.x * .5}px,${travel.y * .5}px) scale(1.04) rotate(${angle + 3}deg)`, offset: .6 },
    { opacity: 0, transform: `translate(-50%,-50%) translate(${travel.x}px,${travel.y}px) scale(1.12) rotate(${angle + 5}deg)` },
  ], { duration, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'both' });
  if (animation) animation.onfinish = remove;
  cancel = schedulePresentationMs(remove, duration + 80);
  return node;
}

export function emitBattleTrail(stage, from, to, options = {}) {
  const dx = to.x - from.x, dy = to.y - from.y;
  return emitBattleArt(stage, 'trail', { ...options, at: from, travel: { x: dx, y: dy },
    angle: Math.atan2(dy, dx) * 180 / Math.PI, size: options.size || 110 });
}

export function damageArtKind(feedback) {
  const type = feedback.tintKey || feedback.type;
  const element = { freeze: 'ice', thunder: 'lightning', spell: 'magic', fixed: 'pulse',
    arrow: 'trail', blunt: 'pulse', pierce: 'slash', psychic: 'magic' }[type] || type;
  if (kinds.includes(element)) return element;
  const sound = feedback.cue?.hitSound;
  return { attackFire: 'fire', attackIce: 'ice', attackLightning: 'lightning',
    attackPoison: 'poison', attackPsychic: 'magic', attackArrow: 'trail',
    attackBlunt: 'pulse', attackBossHeavy: 'pulse', attackPierce: 'slash' }[sound]
    || (feedback.cue?.hit === 'target-magic' ? 'magic' : 'slash');
}
