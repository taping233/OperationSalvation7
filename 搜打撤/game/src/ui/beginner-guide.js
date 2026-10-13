import guideData from '../../data/beginner-guide.json';
import { beginnerGuideDiagram } from './beginner-guide-diagrams.js';
import { linkedBackHTML, linkedAnimate } from './home-linked-interactions.js';
import { motionTiming, motionEasing, motionReduced, changeFrames } from './motion-presets.js';

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
      <span class="bg-nav-title">${escapeHTML(item.navTitle || item.title)}</span>
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
            ${beginnerGuideDiagram(page.id) || `<img src="${escapeHTML(page.image)}" alt="${escapeHTML(page.caption)}" draggable="false">`}
            <figcaption><span class="bg-caption-mark" aria-hidden="true">✦</span>${escapeHTML(page.caption)}</figcaption>
          </figure>
          <div class="bg-copy">
            <ol class="bg-steps">${steps}</ol>
            <aside class="bg-tip"><span class="bg-tip-label">要点</span><p>${escapeHTML(page.tip)}</p></aside>
            ${controls ? `<div class="bg-controls" aria-label="本页操作提示">${controls}</div>` : ''}
          </div>
        </div>
      </article>
    </div>
    <footer class="bg-pager">
      <button class="bg-page-button" data-act="guidePrev" type="button"${index === 0 ? ' disabled' : ''} aria-label="上一页">← <span>上一页</span></button>
      <div class="bg-page-status"><span>${String(index + 1).padStart(2, '0')}</span><i></i><span>${String(pages.length).padStart(2, '0')}</span><small>章节</small></div>
      <button class="bg-page-button is-next" data-act="guideNext" type="button"${index === pages.length - 1 ? ' disabled' : ''} aria-label="下一页"><span>下一页</span> →</button>
    </footer>
  </main>`;
}

/* 翻页只替换正文和分页器；页头、章节导航及其焦点/滚动位置保留。 */
export function updateBeginnerGuide(root, requestedIndex) {
  const index = pageIndex(requestedIndex);
  if (!root || root.dataset.guidePage === String(index)) return;
  const direction = index - Number(root.dataset.guidePage || 0);
  const template = document.createElement('template');
  template.innerHTML = beginnerGuideHTML(index);
  const next = template.content.querySelector('.beginner-guide');
  if (!next?.querySelector('.bg-page')) return;
  for (const selector of ['.bg-page', '.bg-pager']) {
    root.querySelector(selector)?.replaceWith(next.querySelector(selector));
  }
  root.dataset.guidePage = String(index);
  if (!motionReduced()) linkedAnimate(root.querySelector('.bg-page'), changeFrames(direction), { duration: motionTiming.change, easing: motionEasing.enter });
  root.querySelectorAll('[data-act="guidePage"]').forEach(button => {
    const current = button.dataset.pageIndex === String(index);
    button.classList.toggle('is-current', current);
    button.setAttribute('aria-current', current ? 'step' : 'false');
  });
}
