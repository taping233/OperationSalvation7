import { esc } from '../core/shared.js';
import '../../css/run-memento.css';

export function runMementoHTML(memento, { failed = false } = {}) {
  if (!memento || memento.version !== 1) return '';
  const trail = Array.isArray(memento.trail) ? memento.trail : [];
  const moments = Array.isArray(memento.moments) ? memento.moments.slice(0, 3) : [];
  if (!trail.length && !moments.length && !memento.representative) return '';
  return `<section class="run-memento" aria-label="本局纪念">
    <header><h3>本局纪念</h3><span>${failed ? '脚步止于此，经历仍被记下' : '把这段经历带回去'}</span></header>
    ${trail.length ? `<ol class="run-memento-trail" aria-label="各层首次探索足迹">${trail.map(step => `<li><span>第 ${step.layer} 层</span><b>${esc(step.name)}</b><small>探索 ${step.count} 处</small></li>`).join('')}</ol>` : ''}
    ${moments.length ? `<ul class="run-memento-moments">${moments.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
    ${memento.representative ? `<p class="run-memento-keepsake">${failed ? '抢运回基地' : '本次入库'}的一件纪念：<b>${esc(memento.representative.name)}</b> ×${memento.representative.count}</p>` : ''}
  </section>`;
}
