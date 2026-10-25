import guideData from '../../data/beginner-guide.json';
import { beginnerGuideDiagram, bossPreparationHTML } from './beginner-guide-diagrams.js';
import { linkedBackHTML } from './home-linked-interactions.js';
import { transitionRegion, cancelRegionTransition } from './region-transition.js';
import { waitPageVisual } from './page-visual-ready.js';
import { syncViewChildren } from './view-children-sync.js';

const pages = Array.isArray(guideData?.pages) ? guideData.pages : [];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function pageIndex(value) {
  const index = Number.parseInt(value, 10);
  return Number.isFinite(index) ? Math.max(0, Math.min(pages.length - 1, index)) : 0;
}

export function beginnerGuidePageCount() { return pages.length; }

export function beginnerGuideHTML(requestedIndex = 0) {
  const index = pageIndex(requestedIndex);
  const page = pages[index];
  if (!page) return `<main class="beginner-guide" aria-labelledby="beginnerGuideTitle"><header class="bg-head"><h1 id="beginnerGuideTitle">生存指南</h1>${linkedBackHTML('guideBack', '返回', 'bg-back')}</header><p class="bg-empty">指南内容暂不可用，请返回后重试。</p></main>`;

  const nav = pages.map((item, itemIndex) => `
    <button class="bg-nav-item${itemIndex === index ? ' is-current' : ''}" type="button"
      data-act="guidePage" data-page-index="${itemIndex}" aria-current="${itemIndex === index ? 'step' : 'false'}">
      <span class="bg-nav-number">${String(itemIndex + 1).padStart(2, '0')}</span>
      <span class="bg-nav-title ui-control-label">${escapeHTML(item.navTitle || item.title)}</span>
      <span class="bg-nav-mark" aria-hidden="true"></span>
    </button>`).join('');
  const steps = (Array.isArray(page.steps) ? page.steps : []).map((step, stepIndex) => `
    <li class="bg-step"><span class="bg-step-number">${String(stepIndex + 1).padStart(2, '0')}</span>
      <div><h3>${escapeHTML(step.title)}</h3><p>${escapeHTML(step.text)}</p></div>
    </li>`).join('');
  const controls = (Array.isArray(page.controls) ? page.controls : []).map(control => `
    <span class="bg-control"><kbd>${escapeHTML(control.key)}</kbd><span>${escapeHTML(control.text)}</span></span>`).join('');

  return `<main class="beginner-guide" aria-labelledby="beginnerGuideTitle" data-guide-page="${index}">
    <header class="bg-head">
      <div class="bg-head-title"><h1 id="beginnerGuideTitle">生存指南</h1></div>
      ${linkedBackHTML('guideBack', '返回', 'bg-back')}
    </header>
    <div class="bg-layout">
      <nav class="bg-nav" aria-label="指南章节">${nav}</nav>
      <article class="bg-page" aria-label="${escapeHTML(page.title)}">
        <div class="bg-page-heading">
          <span class="bg-eyebrow">${escapeHTML(page.eyebrow)}</span>
          <h2>${escapeHTML(page.title)}</h2>
          <p class="bg-lead">${escapeHTML(page.lead)}</p>
        </div>
        <div class="bg-content">
          <figure class="bg-illustration">
            ${beginnerGuideDiagram(page.id) || `<img data-visual-critical src="${escapeHTML(page.image)}" alt="${escapeHTML(page.caption)}" draggable="false">`}
            <figcaption><span class="bg-caption-mark" aria-hidden="true">✦</span>${escapeHTML(page.caption)}</figcaption>
          </figure>
          <div class="bg-copy">
            <ol class="bg-steps">${steps}</ol>
            <aside class="bg-tip"><span class="bg-tip-label">要点</span><p>${escapeHTML(page.tip)}</p></aside>
            ${page.id === 'extract' ? `<details class="bg-tip"><summary>首脑前准备</summary>${bossPreparationHTML()}</details>` : ''}
            ${controls ? `<div class="bg-controls" aria-label="本页操作提示">${controls}</div>` : ''}
          </div>
        </div>
      </article>
    </div>
    <footer class="bg-pager">
      <button class="bg-page-button" data-act="guidePrev" type="button"${index === 0 ? ' disabled' : ''} aria-label="上一页">← <span class="ui-control-label">上一页</span></button>
      <div class="bg-page-status"><span>${String(index + 1).padStart(2, '0')}</span><i></i><span>${String(pages.length).padStart(2, '0')}</span><small>章节</small></div>
      <button class="bg-page-button is-next" data-act="guideNext" type="button"${index === pages.length - 1 ? ' disabled' : ''} aria-label="下一页"><span class="ui-control-label">下一页</span> →</button>
    </footer>
  </main>`;
}

const readingPositions = new WeakMap();
/* Keep the article host, navigation and per-chapter reading position through paired changes. */
export async function updateBeginnerGuide(root, requestedIndex) {
  const index = pageIndex(requestedIndex);
  if (!root) return false;
  const page = /** @type {HTMLElement} */ (root.querySelector('.bg-page'));
  if (!page) return false;
  if (root.dataset.guidePage === String(index)) { cancelRegionTransition(page); return true; }
  const direction = index - Number(root.dataset.guidePage || 0);
  const template = document.createElement('template');
  template.innerHTML = beginnerGuideHTML(index);
  const next = /** @type {HTMLElement} */ (template.content.querySelector('.beginner-guide'));
  const nextPage = /** @type {HTMLElement} */ (next?.querySelector('.bg-page'));
  if (!nextPage) return false;
  let positions = readingPositions.get(root);
  if (!positions) { positions = new Map(); readingPositions.set(root, positions); }
  positions.set(root.dataset.guidePage, { page:page.scrollTop,
    copy:page.querySelector('.bg-copy')?.scrollTop || 0 });
  return transitionRegion(page, () => {
    page.replaceChildren(...nextPage.childNodes);
    page.setAttribute('aria-label', nextPage.getAttribute('aria-label') || '指南正文');
    const pager = root.querySelector('.bg-pager'), nextPager = next.querySelector('.bg-pager');
    if (pager && nextPager) syncViewChildren(pager, nextPager);
    const saved = positions.get(String(index));
    page.scrollTop = saved?.page || 0;
    const copy = page.querySelector('.bg-copy');
    if (copy) copy.scrollTop = saved?.copy || 0;
    root.dataset.guidePage = String(index);
    /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-act="guidePage"]')).forEach(button => {
      const current = button.dataset.pageIndex === String(index);
      button.classList.toggle('is-current', current);
      button.setAttribute('aria-current', current ? 'step' : 'false');
    });
  }, {
    direction,
    enterGroups:['.bg-page-heading', '.bg-illustration', '.bg-copy'],
    isCurrent: () => root.isConnected,
    prepare: signal => waitPageVisual(page, { signal, timeout:600 }),
  });
}
