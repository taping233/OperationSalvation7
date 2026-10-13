import { baseHomeV3HTML } from '../hub/hub.home-v3.js';
import { baseNavigationV7HTML } from '../hub/hub.navigation-v7.js';
import { bindBasePageMotionV7, animateBaseModeChangeV12 } from '../hub/base-page-motion-v7.js';
import { resourceStripHTML } from '../hub/hub.materials.js';
import { bindCardBrowser, refreshCardBrowser } from './card-browser.js';
import { warehousePreviewV7HTML, tradePreviewV7HTML, personnelPreviewV7HTML, collectionPreviewV7HTML, cardPreviewV7HTML } from './base-preview-rooms-v7.js';
import '../../css/base-framework-v7.css';
import '../../css/base-rooms-v7.css';
import '../../css/base-personnel-v12.css';
import '../../css/base-logistics-trade-v12.css';
import '../../css/base-archive-facilities-v12.css';

// 独立设计演示：只读自有资产，示例模型不加载存档或交易命令。
const modes = { standard:{ id:'standard', enemyMul:1, coinMul:1, xpMul:1 }, elite:{ id:'elite', enemyMul:1.5, coinMul:1.5, xpMul:1.5 } };
const base = { data:{ wood:24, rations:12, keys:3, coins:2400, pocket:[{ count:3 }], nestUnlocked:false } };
const meta = { pendingColl:() => [1], pendingAch:() => [1] };
let tab = 'deploy', mode = 'standard', group = '', query = '', person = 'wu', trade = '长剑', tradeMode = 'buy', detail = null;
const host = document.getElementById('frameHost');
const captions = { deploy:'绝区零参考：共用底部玻璃目的地，侧边主行动；此页为示例数据。', stash:'共用玻璃框架示意；正式后勤已采用分类、物价格和选中阅读。', classes:'白底原立绘示意；正式角色的培养、招式、外观与伙伴为同一浏览工作区。', shop:'示例交易；正式页采用左侧目录、商品格和同页交易台。', ach:'示例收藏；正式页采用目录与连续阅读。' };
const back = '<button class="hub-back" data-preview-home aria-label="返回基地"><svg viewBox="0 0 48 44" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M31 8 15 22l16 14M15 22h28"/></svg></button>';
function render(changed = true) {
  const home = tab === 'deploy' && !detail;
  const body = detail ? cardPreviewV7HTML(detail) : home ? baseHomeV3HTML({ base, meta, modes, mode, prepared:document.getElementById('preparedPreview').checked, character:{ name:'无' }, picks:8 }) : tab === 'stash' ? warehousePreviewV7HTML({ group, query }) : tab === 'shop' ? tradePreviewV7HTML({ selected:trade, mode:tradeMode }) : tab === 'classes' ? personnelPreviewV7HTML(person) : collectionPreviewV7HTML();
  host.innerHTML = `<div id="hubMain" class="pg hub hub-${tab} base-camp base-frame-v7 ${home ? 'base-home' : 'base-subpage'}" data-page="${tab}"><header class="hub-head">${back}<div class="camp-brand"><h2>基地</h2></div><span class="hub-slot-label">示例档案 / 01</span><span class="hub-res">${resourceStripHTML(base)}</span></header><div class="hub-body"><main class="hub-page" data-view="${tab}/${detail || ''}">${body}</main>${baseNavigationV7HTML({ tab, pendingRewards:2 })}</div></div>`;
  host.querySelectorAll('[data-card-browser]').forEach(browser => bindCardBrowser(browser));
  bindBasePageMotionV7(host.querySelector('#hubMain'), { changed });
  document.getElementById('layoutCaption').textContent = detail ? '卡牌进入完整详情画面，返回恢复原房间。' : captions[tab];
  document.querySelectorAll('[data-page-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pageChoice === tab && !detail)));
}
function open(next) { tab = next; detail = null; render(); }
host.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-preview-home')) { open('deploy'); return; }
  if (button.hasAttribute('data-preview-back')) { detail = null; render(); return; }
  if (button.dataset.previewCard) { detail = button.dataset.previewCard; render(); return; }
  if (button.dataset.previewPerson) { person = button.dataset.previewPerson; render(false); return; }
  if (button.dataset.previewTrade) { trade = button.dataset.previewTrade; render(false); return; }
  if (button.dataset.previewTradeMode) { tradeMode = button.dataset.previewTradeMode; render(false); return; }
  if (button.dataset.act === 'warehouseGroup') { group = button.dataset.group; render(false); return; }
  if (button.dataset.act === 'selMode') { const previousMode = mode; mode = button.dataset.mode; render(false); animateBaseModeChangeV12(host.querySelector('#hubMain'), previousMode); return; }
  if (button.dataset.act === 'deploy') { document.getElementById('preparedPreview').checked = true; open('classes'); return; }
  if (button.dataset.act === 'hubTab') {
    if (Object.hasOwn(captions, button.dataset.tab)) open(button.dataset.tab);
    else document.getElementById('layoutCaption').textContent = '建设与庭院保留正式游戏的独立入口，本画板展示基地、仓库、角色、交易所与收藏。';
  }
});
host.addEventListener('input', event => {
  if (!event.target.hasAttribute('data-preview-search')) return;
  const input = event.target, cursor = input.selectionStart;
  query = input.value; render(false);
  const next = host.querySelector('[data-preview-search]'); next.focus(); next.setSelectionRange(cursor, cursor);
});
document.querySelectorAll('[data-page-choice]').forEach(button => button.addEventListener('click', () => open(button.dataset.pageChoice)));
document.getElementById('preparedPreview').addEventListener('change', () => render(false));
document.getElementById('replayPreview').addEventListener('click', () => render());
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => {
  document.getElementById('layoutsPanel').hidden = button.dataset.panel !== 'layouts';
  document.getElementById('referencesPanel').hidden = button.dataset.panel !== 'references';
  document.querySelectorAll('[data-panel]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
const stage = document.querySelector('.design-stage');
new ResizeObserver(() => { stage.style.setProperty('--preview-scale', String(stage.clientWidth / 1920)); host.querySelectorAll('[data-card-browser]').forEach(browser => refreshCardBrowser(browser)); }).observe(stage);
render();
const sources = await fetch(new URL('../../../docs/evidence/2026-10-11-WF-base-redesign-v7/reference-sources.json', import.meta.url)).then(response => response.json()).catch(() => null);
if (sources) {
  document.getElementById('referenceCards').innerHTML = sources.screenshots.map(source => `<figure class="design-reference"><img src="${source.image_url}" loading="lazy" alt="${source.game} · ${source.screen}" referrerpolicy="no-referrer"><figcaption><h2>${source.game}</h2><p>${source.screen}</p><a href="${source.source_page}" target="_blank" rel="noopener noreferrer">原始来源 ↗</a></figcaption></figure>`).join('');
  document.getElementById('teachingSources').innerHTML = sources.teaching_sources.map(source => `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.publisher} · ${source.title}</a></li>`).join('');
}
