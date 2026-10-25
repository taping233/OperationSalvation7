import { bindDiscoverySelection } from '../../ui/discovery-selection.js';
import { cancelDiscover as cancelBattleDiscovery } from '../core/battle.engine.js';
import { getBattleRenderGuard } from './battle.stage-view.js';
/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import { bindBattlePageAction } from './battle.page-activity.js';
import '../../../css/battle-decision.css';
import { mountCombatOverlay, restoreCombatScene } from './battle.secondary-overlay.js';
export { restoreCombatScene };

// Shared presentation only: commands and cancellation eligibility stay with each caller.
export function createBattleDecisionPresenter({ UI, getSnapshot, R, cancelDiscover = roundId => cancelBattleDiscovery(roundId) }) {
return function showBattleDecision(title, body, mode, snapshot = getSnapshot()) {
  const isCurrent = getBattleRenderGuard(UI), bodyOwner = UI.el.ovBody;
  const previous = /** @type {BattleElement} */ (UI.el?.ovBody?.querySelector('.battle-decision'));
  const content = document.createElement('div');
  content.innerHTML = body;
  const discoveryCancel = content.querySelector('[data-act="btDiscoverCancel"]');
  if (discoveryCancel) discoveryCancel.textContent = snapshot.discovering?.cancelLabel || '取消';
  const explicitKind = /** @type {BattleElement} */ (content.querySelector('[data-decision-content]'))?.dataset.decisionContent;
  const kind = explicitKind || (/** @type {BattleElement} */ (content.querySelector('[data-act="btRulesBack"]')) ? 'rules' : /** @type {BattleElement} */ (content.querySelector('[data-act="btDiscover"]')) ? 'discover' : /** @type {BattleElement} */ (content.querySelector('[data-act="btPickHand"]')) ? 'hand-select' : /** @type {BattleElement} */ (content.querySelector('.choice-list')) ? 'choice' : /** @type {BattleElement} */ (content.querySelector('[data-act="bossGo"]')) ? 'formation' : /** @type {BattleElement} */ (content.querySelector('.battle-pile-card, .bt-gy-list')) ? 'pile' : /** @type {BattleElement} */ (content.querySelector('.battle-bag-section')) ? 'bag' : /** @type {BattleElement} */ (content.querySelector('.bt-settings')) ? 'settings' : 'other');
  const choiceKey = JSON.stringify([kind, kind === 'discover' ? [snapshot.discovering?.roundId, content.querySelector('[data-battle-discover]')?.getAttribute('data-discover-page')]
    : kind === 'hand-select' ? snapshot.handSelecting?.selectionId : kind === 'choice' ? snapshot.choosing : null]);
  const localRefresh = previous?._decisionTitle === title && previous._battleToken === snapshot.battleToken && previous._choiceKey === choiceKey;
  const scrollSelector = '.battle-decision-content,.battle-pile-grid,[data-selection-scroll]';
  const scrolls = localRefresh ? [...previous.querySelectorAll(scrollSelector)].map(node => ({ top:node.scrollTop, left:node.scrollLeft })) : [];
  const oldButtons = localRefresh ? [...previous.querySelectorAll('button[data-act]:not(:disabled)')] : [];
  const focusedIndex = oldButtons.indexOf(document.activeElement);
  const focused = localRefresh && previous.contains(document.activeElement) && document.activeElement instanceof HTMLElement ? { ...document.activeElement.dataset } : null;
  const selectedDiscovery = localRefresh ? previous.querySelector('[data-discovery-selected="true"]')?.getAttribute('data-i') : null;
  const footer = /** @type {BattleElement} */ (content.querySelector('.ov-btns:not(.choice-list)')) || /** @type {BattleElement} */ (content.querySelector('.ov-note:has([data-act="btPickHandSkip"])'));
  const actions = footer?.outerHTML || '';
  footer?.remove();
  const summary = /** @type {BattleElement} */ (content.querySelector(':scope > .ov-stats'));
  const summaryHTML = summary?.outerHTML || '';
  summary?.remove();
  const compact = kind === 'rules' || /** @type {BattleElement} */ (content.querySelector('.bt-settings')) || (/** @type {BattleElement} */ (content.querySelector('.battle-bag-section')) && !/** @type {BattleElement} */ (content.querySelector('.battle-bag-slot')));
  const pileTotal = /** @type {BattleElement} */ (content.querySelector('[data-battle-pile-view]'))?.dataset.pileTotal || '0';
  const phaseLabel = kind === 'pile' ? `${pileTotal} 张` : kind === 'formation' ? '开战前准备' : `${snapshot.turn ? `第 ${snapshot.turn} 回合 · ` : ''}能量 ${snapshot.energy ?? R().battleEnergy}/${snapshot.maxEnergy ?? R().battleEnergy}`;
  const scene = /** @type {BattleElement} */ (UI.el?.ovBody?.querySelector('.battle-stage'));
  const floating = kind !== 'formation' && !!scene && scene._battleToken === snapshot.battleToken;
  const html = `<section class="battle-decision battle-decision-unified${floating ? ' battle-secondary-panel sdt-feedback-theme' : ''}${compact ? ' battle-decision-compact' : ''}" data-decision-kind="${kind}" data-boss="${snapshot.opts?.isBoss ? '1' : '0'}"><header class="battle-decision-head"><h3>${title}</h3><span${kind === 'pile' ? ' class="battle-pile-total"' : ''}>${phaseLabel}</span></header>${summaryHTML ? `<div class="battle-decision-summary">${summaryHTML}</div>` : ''}<div class="battle-decision-content">${content.innerHTML}</div>${actions ? `<footer class="battle-decision-actions">${actions}</footer>` : ''}</section>`;
  if (floating && !mountCombatOverlay(UI, title, html, mode, scene, { localSettings:kind === 'settings' })) return;
  else if (!floating) UI.showOverlay(title, html, mode);
  if (!isCurrent() || UI.el.ovBody !== bodyOwner) return;
  const next = /** @type {BattleElement} */ (UI.el?.ovBody?.querySelector('.battle-decision'));
  if (next) { next._battleToken = snapshot.battleToken; next._decisionTitle = title; next._choiceKey = choiceKey; }
  if (next?.querySelector('[data-battle-discover]')) {
    const roundKey = JSON.stringify(snapshot.discovering);
    const pageToken = next.querySelector('[data-battle-discover]').getAttribute('data-discover-page');
    const binding = bindDiscoverySelection({ UI, root:next, optionSelector:'[data-act="btDiscover"]',
      confirmAct:'btDiscoverConfirm', cancelAct:'btDiscoverCancel',
      isCurrent:() => isCurrent() && UI.el.ovBody === bodyOwner && bodyOwner.querySelector('.battle-decision') === next
        && getSnapshot().battleToken === snapshot.battleToken && JSON.stringify(getSnapshot().discovering) === roundKey
        && next.querySelector('[data-battle-discover]')?.getAttribute('data-discover-page') === pageToken,
      // Resolve at confirmation: battle.view installs the final handler after mounting
      // this shell. It still owns admission tickets, source rects and actual effects.
      onConfirm:data => {
        const submit = UI._acts?.btDiscover;
        const selected = { ...data };
        if (typeof submit !== 'function') return false;
        const result = submit(selected);
        if (result !== undefined) return result;
        // The legacy handler returns undefined for both rejection and acceptance.
        // A rejected ticket leaves this exact page and discovery round in place.
        const after = getSnapshot();
        return !next.isConnected || bodyOwner.querySelector('.battle-decision') !== next
          || next.querySelector('[data-battle-discover]')?.getAttribute('data-discover-page') !== pageToken
          || after.battleToken !== snapshot.battleToken || JSON.stringify(after.discovering) !== roundKey;
      }, onCancel:() => cancelDiscover(snapshot.discovering?.roundId),
    });
    if (selectedDiscovery != null) binding.select(next.querySelector(`[data-act="btDiscover"][data-i="${Number(selectedDiscovery)}"]`));
  }
  if (next && localRefresh) {
    [...next.querySelectorAll(scrollSelector)].forEach((node, index) => {
      if (scrolls[index]) { node.scrollTop = scrolls[index].top; node.scrollLeft = scrolls[index].left; }
    });
    if (focused) {
      const buttons = [.../** @type {NodeListOf<HTMLButtonElement>} */ (next.querySelectorAll('button[data-act]:not(:disabled)'))];
      (buttons.find(button => button.dataset.act === focused.act && button.dataset.uid === focused.uid && button.dataset.i === focused.i)
        || buttons[Math.min(focusedIndex, buttons.length - 1)] || buttons.find(button => /Cancel|Back/.test(button.dataset.act)) || buttons[0])?.focus({ preventScroll:true });
    }
  }
};
}

// Read-only details preserve the parent DOM, scroll and the exact triggering control.
export function bindBattleDecisionInspection({ UI, getSnapshot, cards, snapshot }) {
  const root = /** @type {BattleElement} */ (UI.el?.ovBody?.querySelector('.battle-decision'));
  /** @type {NodeListOf<HTMLElement>} */ (root?.querySelectorAll('.battle-pile-card [tabindex]') || []).forEach(node => { node.tabIndex = -1; });
  bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btDecisionInspect', data => {
    const card = cards[+data.i];
    if (card) UI.showCardZoom(card, { items:cards, index:+data.i, returnFocus:root.querySelector(`[data-act="btDecisionInspect"][data-i="${+data.i}"]`) });
  });
}
