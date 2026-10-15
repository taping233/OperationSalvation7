import { esc, escAttr } from '../core/shared.js';

function mergeSingleOptionDescription(body, narrative) {
  const choices = document.createElement('template');
  choices.innerHTML = body;
  const options = choices.content.querySelectorAll('.evt-opt');
  if (options.length !== 1) return body;
  const detail = options[0].querySelector(':scope > span');
  if (!detail) return body;
  const prose = document.createElement('template');
  prose.innerHTML = narrative;
  const normalise = text => text.trim().replace(/[。.!！?？]+$/, '').trim();
  const text = normalise(prose.content.textContent);
  if (!text || text !== normalise(detail.textContent)) return body;
  detail.remove();
  return choices.innerHTML;
}

// Pure presentation only: callers own choices, rewards, guards and storage.
export function eventSceneHTML({ tone, icon = '', title, sub = '', body = '', foot = '', asset, music, region, layer }) {
  const entry = tone === 'entry';
  const choices = tone === 'event' ? mergeSingleOptionDescription(body, sub) : body;
  const choiceTemplate = document.createElement('template');
  choiceTemplate.innerHTML = choices;
  const choiceCount = tone === 'event' ? choiceTemplate.content.querySelectorAll('.evt-opt[data-act]').length : 0;
  const eventChoiceFoot = choiceCount > 1 ? `<div class="event-choice-state">
    <div class="event-choice-announcement" role="status" aria-live="polite"><b data-event-choice-name>先选择一个选项</b><small data-event-choice-detail>点击选项查看已知结果，再确认执行。</small></div>
    <button type="button" class="event-choice-clear" disabled>取消选择</button>
    <button type="button" class="ov-btn ok event-choice-confirm" disabled>选择后确认</button>
  </div>` : '';
  // 事件体系页顶栏（2026-10-15 老板令）：仅左上退出键，样式复用地图 #topBtns 按钮语言；
  // 金币/攻击不经页面重画——CSS 把真 HUD #resHud 提到 overlay 之上常驻（entry-events.css）。
  const topbar = ['event', 'entry', 'fire', 'pickup'].includes(tone) ? `<div class="event-topbar">
    <button type="button" class="event-exit" data-act="eventExit" aria-label="退出，返回地图"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M14.5 4H19v16h-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12h9.5M10 8.5 13.5 12 10 15.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  </div>` : '';
  // Map area names may already carry their layer prefix; show that fact once.
  const areaLabel = (region || '远征节点').replace(/^第\s*\d+\s*层\s*[·・•—-]?\s*/, '') || '远征节点';
  return `<div class="pg node-pg sc-${escAttr(tone)} event-scene event-replica${entry ? ' entry-scene' : ''}"${choiceCount ? ` data-event-choice-count="${choiceCount}"` : ''}${music ? ` data-music-scene="${escAttr(music)}"` : ''}${asset ? ` data-asset-key="${escAttr(asset)}"` : ''}>
    ${topbar}
    <div class="node-panel">
      <div class="event-context"><div class="node-kicker">${esc(areaLabel)} <span>第 ${layer + 1} 层</span></div>
      </div>
      <section class="event-story" aria-label="${tone === 'event' ? '事件与叙事' : '地点说明'}">${entry ? '<div class="event-eyebrow">启程 · 随行补给</div>' : ''}<header class="pg-head"><h2>${icon} ${title}</h2></header>
      ${sub ? `<div class="event-narrative" role="region" aria-label="${entry ? '入城说明' : '事件叙述'}">${sub}</div>` : ''}
      </section>
      <section class="event-decisions" aria-label="${entry ? '补给选项' : tone === 'event' ? '事件选项' : '可用操作'}">
        <div class="node-main"><div class="node-summary">${choices}</div></div>
        ${foot || eventChoiceFoot ? `<footer class="node-foot">${eventChoiceFoot}${foot}</footer>` : ''}
      </section>
    </div>
  </div>`;
}
