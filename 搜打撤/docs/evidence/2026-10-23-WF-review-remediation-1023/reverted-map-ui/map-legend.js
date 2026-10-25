import { esc } from '../core/shared.js';
import { mapNodeArtHTML } from '../core/map-node-art.js';
import { renderScheduler } from '../core/render-scheduler.js';
import '../../css/map-legend.css';

const views = new WeakMap();
const entries = [
  ['battle','战斗','迎战敌人，胜利后领取战利品'], ['event','事件','进入后查看遭遇与选择'],
  ['chest','宝箱','开启并领取物资'], ['shop','补给站','购买、出售和整理物资'],
  ['fire','营火','回复生命或复原消耗卡牌'], ['altar','祭坛','查看献祭与本层目标'],
  ['door','层间门','连接当前区域与下一片区域'], ['extraction','撤离','按此处条件完成撤离'],
  ['resource','物资','收集此处资源'], ['blank','已知空地','可通行的已揭示地点'],
];
export function mapLegendType(type) {
  return ['boss','elite','battleElite'].includes(type) ? 'battle' : ['entrance'].includes(type) ? 'door'
    : ['emergencyExit'].includes(type) ? 'extraction' : ['coin','wood','rations','key'].includes(type) ? 'resource' : type;
}
export function getMapLegendType(game) { const view = views.get(game); return view?.open && view.root?.isConnected ? view.type : null; }
export function closeMapLegend(game) {
  const view = views.get(game); if (!view) return;
  view.open = false; view.type = null;
  view.root?.removeAttribute('data-open');
  view.root?.querySelector('.map-legend-toggle')?.setAttribute('aria-expanded', 'false');
  const panel = view.root?.querySelector('.map-legend-panel'); if (panel) panel.hidden = true;
  view.root?.closest('#sidebar')?.removeAttribute('data-map-legend-open');
  renderScheduler.invalidate();
}
export function renderMapLegend(sidebar, game) {
  let root = sidebar.querySelector('.map-legend');
  let view = views.get(game);
  if (root && view?.root !== root) { root.remove(); root = null; }
  if (!root) {
    root = sidebar.ownerDocument.createElement('section'); root.className = 'map-legend';
    root.innerHTML = `<button type="button" class="map-legend-toggle" aria-expanded="false" aria-controls="map-legend-panel">地点图例</button><div id="map-legend-panel" class="map-legend-panel" hidden><header><b>地点图例</b><button type="button" class="map-legend-close" aria-label="关闭地点图例">×</button></header><p>聚焦类型，高亮已揭示地点</p>${entries.map(([type,name,hint]) => `<button type="button" class="map-legend-item" data-map-type="${type}">${mapNodeArtHTML(type,42) || '<span aria-hidden="true">◇</span>'}<span><b>${esc(name)}</b><small>${esc(hint)}</small></span></button>`).join('')}</div>`;
    sidebar.append(root);
    view = { root, open:false, type:null }; views.set(game, view);
    const highlight = type => { view.type = type; renderScheduler.invalidate(); };
    root.querySelector('.map-legend-toggle').addEventListener('click', () => {
      if (view.open) { closeMapLegend(game); return; }
      view.open = true; root.dataset.open = 'true'; sidebar.dataset.mapLegendOpen = 'true';
      root.querySelector('.map-legend-toggle').setAttribute('aria-expanded','true');
      root.querySelector('.map-legend-panel').hidden = false;
      root.querySelector('.map-legend-item').focus({ preventScroll:true });
      renderScheduler.invalidate();
    });
    const close = () => { closeMapLegend(game); root.querySelector('.map-legend-toggle').focus({preventScroll:true}); };
    root.querySelector('.map-legend-close').addEventListener('click', close);
    root.addEventListener('keydown', event => { if(event.key === 'Escape' && view.open){event.preventDefault();event.stopPropagation();close();} });
    root.addEventListener('pointerover', event => { const item=event.target.closest('[data-map-type]'); if(item)highlight(item.dataset.mapType); });
    root.addEventListener('pointerleave', () => highlight(null));
    root.addEventListener('focusin', event => { const item=event.target.closest('[data-map-type]'); if(item)highlight(item.dataset.mapType); });
    root.addEventListener('focusout', event => { if(!root.contains(event.relatedTarget))highlight(null); });
  }
  return view;
}

export function renderMapRouteSummary(sidebar, game, routes, objective) {
  let root = sidebar.querySelector('.expedition-route-summary');
  if (!root) { root=sidebar.ownerDocument.createElement('section');root.className='expedition-route-summary';sidebar.append(root); }
  const fog = Object.keys(game.seen || {}).length > 0;
  const known = routes.filter(route => !fog || game.seen[`${route.li},${route.idx}`] === 1);
  const html = `<p class="expedition-current-objective"><b>当前目标</b><span>${esc(objective.text)}</span></p><nav aria-label="相邻路线">${known.map(route => `<button type="button" data-route-select="1" data-li="${route.li}" data-idx="${route.idx}" aria-label="${esc(route.ariaLabel)}"${game.state !== 'idle' ? ' disabled' : ''}><span>${esc(route.name)}</span><small>${esc(route.contentLabel || (route.cleared ? '已完成' : '可以前往'))}</small></button>`).join('') || '<span class="map-no-routes">暂无已揭示的相邻路线</span>'}</nav>`;
  if (root.innerHTML !== html) root.innerHTML = html;
}
