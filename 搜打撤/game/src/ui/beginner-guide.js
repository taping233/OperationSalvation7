import guideData from '../../data/beginner-guide.json';
import { beginnerGuideDiagram } from './beginner-guide-diagrams.js';

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
  if (!page) return '<main class="beginner-guide" aria-labelledby="beginnerGuideTitle"><header class="bg-head"><h1 id="beginnerGuideTitle">生存指南</h1></header><p class="bg-empty">指南内容暂不可用。</p></main>';

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
      <p class="bg-header-note">从出发准备到带回战利品</p>
      <button class="ak-sq ak-exit ak-back-tl bg-back" data-act="guideBack" title="返回（Esc）" aria-label="返回">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 12h10M4 12l4-4M4 12l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
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
