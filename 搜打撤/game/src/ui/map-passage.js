import { reduceMotion } from '../core/motion.js';
import '../../css/map-passage.css';

let active = null;
// Presentation only. Moving/saving/arrival remain owned by the travel transaction.
export function showLayerPassage(game, from, to) {
  if (from === to || reduceMotion()) return;
  active?.();
  const token = game.discoveredPairs;
  const layer = document.createElement('div');
  layer.className = 'map-layer-passage';
  layer.setAttribute('role', 'status');
  layer.setAttribute('aria-live', 'polite');
  const kicker = document.createElement('small'); kicker.textContent = 'DEPTH TRANSFER';
  const title = document.createElement('b'); title.textContent = `第 ${to + 1} 层`;
  const trail = document.createElement('span'); trail.textContent = `第 ${from + 1} 层 → 第 ${to + 1} 层`;
  layer.append(kicker, title, trail);
  document.body.append(layer);
  let timer;
  const dispose = () => {
    clearTimeout(timer); observer.disconnect(); layer.remove();
    if (active === dispose) active = null;
  };
  const observer = new MutationObserver(() => {
    if (!game.runActive || game.discoveredPairs !== token) dispose();
  });
  observer.observe(document.body, { childList:true, subtree:true });
  active = dispose;
  timer = setTimeout(dispose, 1000);
}
if (import.meta.hot) import.meta.hot.dispose(() => active?.());
