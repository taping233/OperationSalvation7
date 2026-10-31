import guideData from '../../data/beginner-guide.json';
import { linkedBackHTML } from './home-linked-interactions.js';
import { transitionRegion, cancelRegionTransition } from './region-transition.js';
import { waitPageVisual } from './page-visual-ready.js';
import { syncViewChildren } from './view-children-sync.js';
import { esc } from '../core/shared.js';

const pages = Array.isArray(guideData?.pages) ? guideData.pages : [];

function escapeHTML(value) {
  return esc(value ?? '');
}

function pageIndex(value) {
  const index = Number.parseInt(value, 10);
  return Number.isFinite(index) ? Math.max(0, Math.min(pages.length - 1, index)) : 0;
}

function imageReaderHTML(page) {
  return `<section class="bg-image-reader" role="dialog" aria-modal="true" aria-label="${escapeHTML(page.title)} · 原图阅读" hidden>
    <header><div><span class="bg-eyebrow">原图阅读</span><h3>${escapeHTML(page.caption)}</h3></div>
      <button type="button" class="bg-reader-close" data-act="guideImageClose" data-cancel="true">关闭大图 <kbd>Esc</kbd></button></header>
    <div class="bg-reader-scroll" tabindex="0" aria-label="实机原图，可横向和纵向滚动"><img data-guide-original="${escapeHTML(page.image)}" alt="${escapeHTML(page.caption)}" draggable="false"></div>
  </section>`;
}

export function beginnerGuidePageCount() { return pages.length; }

function guidePageHTML(page) {
  const steps = (Array.isArray(page.steps) ? page.steps : []).map((step, stepIndex) => `
    <li class="bg-step"><span class="bg-step-number">${stepIndex + 1}</span>
      <div><h3>${escapeHTML(step.title)}</h3><p>${escapeHTML(step.text)}</p></div>
    </li>`).join('');
  const markers = (page.steps || []).map((step, stepIndex) => step.point ?
    `<span class="bg-image-point" style="left:${Number(step.point[0])}%;top:${Number(step.point[1])}%" aria-hidden="true">${stepIndex + 1}</span>` : '').join('');
  const notes = (page.notes || []).map(note => `<div class="bg-note"><h4>${escapeHTML(note.title)}</h4><p>${escapeHTML(note.text)}</p></div>`).join('');
  const controls = (Array.isArray(page.controls) ? page.controls : []).map(control => `
    <span class="bg-control"><kbd>${escapeHTML(control.key)}</kbd><span>${escapeHTML(control.text)}</span></span>`).join('');

  return `<article class="bg-page" aria-label="${escapeHTML(page.title)}">
        <div class="bg-page-heading">
          <span class="bg-eyebrow">${escapeHTML(page.eyebrow)}</span>
          <h2>${escapeHTML(page.title)}</h2>
          <p class="bg-lead">${escapeHTML(page.lead)}</p>
        </div>
        <div class="bg-content">
          <figure class="bg-illustration">
            <div class="bg-image-frame"><div class="bg-shot"><img data-visual-critical src="${escapeHTML(page.image)}" alt="${escapeHTML(page.caption)}" draggable="false">${markers}</div></div>
            <figcaption><span><b>实机界面示例</b>${escapeHTML(page.caption)}</span><button type="button" data-act="guideImageOpen" class="bg-image-open" aria-haspopup="dialog">查看大图 ↗</button></figcaption>
            <div class="bg-image-key"><span class="bg-image-key-mark">1</span><span>画面编号对应右侧说明</span></div>
          </figure>
          <div class="bg-copy">
            <ol class="bg-steps">${steps}</ol>
            ${page.feature ? `<section class="bg-feature"><h3>${escapeHTML(page.feature.title)}</h3><p>${escapeHTML(page.feature.text)}</p></section>` : ''}
            <aside class="bg-tip"><span class="bg-tip-label">要点</span><p>${escapeHTML(page.tip)}</p></aside>
            ${notes ? `<details class="bg-more"><summary>${escapeHTML(page.moreTitle || '继续了解')}</summary>${notes}</details>` : ''}
            ${controls ? `<div class="bg-controls" aria-label="本页操作提示">${controls}</div>` : ''}
          </div>
        </div>
      </article>`;
}

function guidePagerHTML(index) {
  return `<footer class="bg-pager">
      <button class="bg-page-button" data-act="guidePrev" type="button"${index === 0 ? ' disabled' : ''} aria-label="上一章">← <span class="ui-control-label">上一章</span></button>
      <div class="bg-page-status"><span>${String(index + 1).padStart(2, '0')}</span><i></i><span>${String(pages.length).padStart(2, '0')}</span><small>章节</small></div>
      <button class="bg-page-button is-next" data-act="guideNext" type="button"${index === pages.length - 1 ? ' disabled' : ''} aria-label="下一章"><span class="ui-control-label">下一章</span> →</button>
    </footer>`;
}

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
  return `<main class="beginner-guide" aria-labelledby="beginnerGuideTitle" data-guide-page="${index}">
    <header class="bg-head">
      <div class="bg-head-title"><span>城市远征 · 入城手册</span><h1 id="beginnerGuideTitle">生存指南</h1></div>
      <span class="bg-head-note">准备行囊，带回收获</span>
      ${linkedBackHTML('guideBack', '返回', 'bg-back', 'button', { cancel:true, text:'返回' })}
    </header>
    <div class="bg-layout">
      <nav class="bg-nav" aria-label="指南章节">${nav}</nav>
      ${guidePageHTML(page)}
    </div>
    ${guidePagerHTML(index)}
    ${imageReaderHTML(page)}
  </main>`;
}

/** Large-image reading stays inside this guide and returns to the same chapter. */
export function setBeginnerGuideImageReading(root, open) {
  const reader = root?.querySelector('.bg-image-reader');
  if (!reader) return false;
  if (open) {
    const image = reader.querySelector('img');
    image.src = image.dataset.guideOriginal;
  }
  reader.hidden = !open;
  root.classList.toggle('is-reading-image', open);
  root.querySelectorAll(':scope > .bg-head, :scope > .bg-layout, :scope > .bg-pager').forEach(region => { region.inert = open; });
  root.querySelector(open ? '[data-act="guideImageClose"]' : '[data-act="guideImageOpen"]')?.focus({ preventScroll:true });
  return true;
}

const readingPositions = new WeakMap();
/* Keep the article host, navigation and per-chapter reading position through paired changes. */
export async function updateBeginnerGuide(root, requestedIndex) {
  const index = pageIndex(requestedIndex);
  const chapter = pages[index];
  if (!root || !chapter) return false;
  const page = /** @type {HTMLElement} */ (root.querySelector('.bg-page'));
  if (!page) return false;
  if (root.dataset.guidePage === String(index)) { cancelRegionTransition(page); return true; }
  const direction = index - Number(root.dataset.guidePage || 0);
  const template = document.createElement('template');
  // Chapter changes reuse the mounted shell and navigation; only build the parts that change.
  template.innerHTML = guidePageHTML(chapter) + guidePagerHTML(index) + imageReaderHTML(chapter);
  const next = template.content;
  const nextPage = /** @type {HTMLElement} */ (next.querySelector('.bg-page'));
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
    root.querySelector('.bg-image-reader')?.replaceWith(next.querySelector('.bg-image-reader'));
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
