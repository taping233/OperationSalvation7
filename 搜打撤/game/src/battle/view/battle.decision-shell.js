import { bindBattlePageAction } from './battle.page-activity.js';
import '../../../css/battle-decision.css';
import { mountCombatOverlay, restoreCombatScene } from './battle.secondary-overlay.js';
export { restoreCombatScene };

// Shared presentation only: commands and cancellation eligibility stay with each caller.
export function createBattleDecisionPresenter({ UI, getSnapshot, R }) {
return function showBattleDecision(title, body, mode, snapshot = getSnapshot()) {
  const previous = UI.el?.ovBody?.querySelector('.battle-decision');
  const localRefresh = previous?._decisionTitle === title && previous._battleToken === snapshot.battleToken;
  const scrollTop = localRefresh ? previous.querySelector('.battle-decision-content')?.scrollTop || 0 : 0;
  const focused = localRefresh && previous.contains(document.activeElement) ? document.activeElement.dataset : null;
  const content = document.createElement('div');
  content.innerHTML = body;
  const explicitKind = content.querySelector('[data-decision-content]')?.dataset.decisionContent;
  const kind = explicitKind || (content.querySelector('[data-act="btRulesBack"]') ? 'rules' : content.querySelector('[data-act="btDiscover"]') ? 'discover' : content.querySelector('[data-act="btPickHand"]') ? 'hand-select' : content.querySelector('.choice-list') ? 'choice' : content.querySelector('[data-act="bossGo"]') ? 'formation' : content.querySelector('.battle-pile-card, .bt-gy-list') ? 'pile' : content.querySelector('.battle-bag-section') ? 'bag' : content.querySelector('.bt-settings') ? 'settings' : 'other');
  const footer = content.querySelector('.ov-btns:not(.choice-list)') || content.querySelector('.ov-note:has([data-act="btPickHandSkip"])');
  const actions = footer?.outerHTML || '';
  footer?.remove();
  const summary = content.querySelector(':scope > .ov-stats');
  const summaryHTML = summary?.outerHTML || '';
  summary?.remove();
  const compact = kind === 'rules' || content.querySelector('.bt-settings') || (content.querySelector('.battle-bag-section') && !content.querySelector('.battle-bag-slot'));
  const phaseLabel = kind === 'formation' ? '开战前准备' : `${snapshot.turn ? `第 ${snapshot.turn} 回合 · ` : ''}能量 ${snapshot.energy ?? R().battleEnergy}/${snapshot.maxEnergy ?? R().battleEnergy}`;
  const scene = UI.el?.ovBody?.querySelector('.battle-stage');
  const floating = kind !== 'formation' && !!scene && scene._battleToken === snapshot.battleToken;
  const html = `<section class="battle-decision battle-decision-unified${floating ? ' battle-secondary-panel sdt-feedback-theme' : ''}${compact ? ' battle-decision-compact' : ''}" data-decision-kind="${kind}" data-boss="${snapshot.opts?.isBoss ? '1' : '0'}"><header class="battle-decision-head"><h3>${title}</h3><span>${phaseLabel}</span></header>${summaryHTML ? `<div class="battle-decision-summary">${summaryHTML}</div>` : ''}<div class="battle-decision-content">${content.innerHTML}</div>${actions ? `<footer class="battle-decision-actions">${actions}</footer>` : ''}</section>`;
  if (floating) mountCombatOverlay(UI, title, html, mode, scene);
  else UI.showOverlay(title, html, mode);
  const next = UI.el?.ovBody?.querySelector('.battle-decision');
  if (next) { next._battleToken = snapshot.battleToken; next._decisionTitle = title; }
  if (next && localRefresh) {
    next.querySelector('.battle-decision-content').scrollTop = scrollTop;
    if (focused) {
      const buttons = [...next.querySelectorAll('button[data-act]:not(:disabled)')];
      (buttons.find(button => button.dataset.act === focused.act && button.dataset.uid === focused.uid && button.dataset.i === focused.i) || buttons.find(button => /Cancel|Back/.test(button.dataset.act)) || buttons[0])?.focus({ preventScroll:true });
    }
  }
};
}

// Read-only details preserve the parent DOM, scroll and the exact triggering control.
export function bindBattleDecisionInspection({ UI, getSnapshot, cards, snapshot }) {
  const root = UI.el?.ovBody?.querySelector('.battle-decision');
  bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btDecisionInspect', data => {
    const card = cards[+data.i];
    if (card) UI.showCardZoom(card, { returnFocus:root.querySelector(`[data-act="btDecisionInspect"][data-i="${+data.i}"]`) });
  });
}
