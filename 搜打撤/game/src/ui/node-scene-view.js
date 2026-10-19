import { esc, escAttr } from '../core/shared.js';
import '../../css/archive-back.css';
import '../../css/event-choice-feedback.css';

function decorateChoices(template) {
  for (const [index, option] of [...template.content.querySelectorAll('.evt-opt[data-act]')].entries()) {
    const label = option.querySelector('b')?.textContent.replace(/\s/g, '') || '';
    const kind = /应战|战斗|攻击|反击/.test(label) ? 'combat' : /离开|返回|放弃|绕行|逃/.test(label) ? 'leave'
      : /购买|支付|交易|贿赂|交出/.test(label) ? 'trade' : /治疗|休息|救助|复原/.test(label) ? 'restore' : 'explore';
    option.dataset.choiceKind = kind;
    const icon = document.createElement('i');
    icon.className = 'event-choice-symbol'; icon.setAttribute('aria-hidden', 'true');
    icon.textContent = `[[icon:${{ combat:'swords', leave:'exit', trade:'coin', restore:'heart', explore:'map' }[kind]}]]`;
    option.prepend(icon);
    option.dataset.choiceNumber = String(index + 1).padStart(2, '0');
  }
  return template.innerHTML;
}

function mergeSingleOptionDescription(choices, body, narrative) {
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
  const themed = ['event', 'entry', 'fire', 'pickup'].includes(tone);
  const choiceTemplate = tone === 'event' ? document.createElement('template') : null;
  if (choiceTemplate) choiceTemplate.innerHTML = body;
  if (choiceTemplate) mergeSingleOptionDescription(choiceTemplate, body, sub);
  const choices = choiceTemplate ? decorateChoices(choiceTemplate) : body;
  const choiceCount = choiceTemplate ? choiceTemplate.content.querySelectorAll('.evt-opt[data-act]').length : 0;
  const eventChoiceFoot = choiceCount > 1 ? `<div class="event-choice-state">
    <div class="event-choice-announcement" role="status" aria-live="polite"><b data-event-choice-name>未选择</b><small data-event-choice-detail></small></div>
    <button type="button" class="event-choice-clear" disabled>取消选择</button>
    <button type="button" class="ov-btn ok event-choice-confirm" disabled>确认选择</button>
  </div>` : '';
  // 四类插画事件页复用公共退出键和真实资源 HUD；结算仍由调用者处理。
  const topbar = themed ? `<div class="event-topbar">
    <button type="button" class="archive-back" data-act="eventExit" aria-label="退出，返回地图"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 12h10M4 12l4-4M4 12l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  </div>` : '';
  // Map area names may already carry their layer prefix; show that fact once.
  const areaLabel = (region || '远征节点').replace(/^第\s*\d+\s*层\s*[·・•—-]?\s*/, '') || '远征节点';
  return `<div class="pg node-pg sc-${escAttr(tone)} event-scene event-replica${themed ? ' event-themed' : ''}${entry ? ' entry-scene' : ''}"${choiceCount ? ` data-event-choice-count="${choiceCount}"` : ''}${music ? ` data-music-scene="${escAttr(music)}"` : ''}${asset ? ` data-asset-key="${escAttr(asset)}"` : ''}>
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
