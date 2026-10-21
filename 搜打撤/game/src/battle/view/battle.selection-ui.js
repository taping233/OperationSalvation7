/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import { esc } from '../../core/shared.js';

// Presentation identity only. Commands remain authoritative for eligibility,
// target rules, material costs and submission; this module never spends resources.
export function selectionState(snapshot, { clickUid = null, findCard = /** @type {(uid: string) => {card?: {name?: string}} | null} */ (() => null) } = {}) {
  if (!snapshot) return null;
  if (snapshot.infusing) return { kind:'infusion', uid:snapshot.infusing.uid, name:snapshot.infusing.card?.name || '', detail:'选择材料，确认后才消耗' };
  if (snapshot.pendingTarget) {
    const target = snapshot.pendingTarget;
    return { kind:'card', uid:target.uid, name:target.card?.name || '', step:target.excludedTargetIndex,
      selectionId:target.selectionId, canReturnToInfusion:!!target.fuelUids?.length,
      detail:(target.hint || '继续选择高亮目标').replace(/\s*·\s*Esc 取消$/, '') };
  }
  if (snapshot.pendingItem) return { kind:'item', uid:snapshot.pendingItem.uid, name:snapshot.pendingItem.card?.name || '', detail:'点击一名敌人使用，或直接拖到敌人身上' };
  if (snapshot.slamPending || snapshot.dartPending) return { kind:snapshot.slamPending ? 'slam' : 'dart', detail:'点击高亮敌人确认目标' };
  if (clickUid != null && snapshot.hand?.includes(clickUid)) return { kind:'click', uid:clickUid, name:findCard(clickUid)?.card?.name || '', detail:'点击高亮目标确认使用' };
  return null;
}

export function selectionKey(snapshot, selection) {
  return selection ? JSON.stringify([snapshot.battleToken, selection.kind, selection.uid ?? null, selection.step ?? null, selection.selectionId ?? null]) : '';
}

export function cancelSelection({ snapshot, commands, hasAim = false, clickUid = null,
  clearAim = () => {}, clearClick = /** @type {(options: {restoreFocus: boolean}) => void} */ (() => {}), clearFeedback = () => {}, restoreFocus = false }) {
  const pending = snapshot.pendingTarget || snapshot.pendingItem || snapshot.slamPending || snapshot.dartPending;
  if (!hasAim && clickUid == null && !pending && !snapshot.infusing) return false;
  if (hasAim) clearAim();
  if (clickUid != null) clearClick({ restoreFocus });
  if (pending) commands.cancelPendingTarget();
  if (snapshot.infusing) commands.cancelInfusion();
  clearFeedback();
  return true;
}

// One direct-child status strip for click selection, pending card/item and skills.
// Its callback is bound to the displayed selection, so a detached/stale button
// cannot cancel a newer card, target step or battle.
export function syncSelectionPrompt(stage, snapshot, { clickUid = null, findCard, getCurrent, onCancel, onReturnToInfusion = null }) {
  if (!stage) return;
  const selection = selectionState(snapshot, { clickUid, findCard });
  let bar = /** @type {BattleElement} */ (stage.querySelector('[data-selection-prompt]'));
  if (stage._battleToken != null && stage._battleToken !== snapshot.battleToken
    || !selection || selection.kind === 'infusion' || snapshot.busy || !['player', 'targeting'].includes(snapshot.phase)) {
    bar?.remove(); return;
  }
  const key = selectionKey(snapshot, selection);
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'bt-infuse bt-pick';
    bar.dataset.selectionPrompt = '';
    stage.appendChild(bar);
  }
  const html = `<div class="bt-infuse-copy"><p class="bt-infuse-title" role="status">${selection.name ? `已选【<b>${esc(selection.name)}</b>】：` : ''}${esc(selection.detail)}</p></div><div class="bt-infuse-actions">${selection.canReturnToInfusion && onReturnToInfusion ? '<button class="mini-btn" data-act="btPickReturnInfusion" type="button">返回选材</button>' : ''}<button class="mini-btn" data-act="btPickCancel" type="button">取消 · Esc</button></div>`;
  if (bar.dataset.selectionKey === key && bar._selectionHTML === html) return;
  bar.dataset.selectionKey = key;
  bar._selectionHTML = html;
  bar.innerHTML = html;
  for (const button of /** @type {NodeListOf<HTMLButtonElement>} */ (bar.querySelectorAll('button'))) button.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    const current = getCurrent();
    if (!button.isConnected || !bar.contains(button) || !bar.isConnected || !stage.isConnected || stage.closest('[hidden], [inert], [aria-hidden="true"], .closing') || current.snapshot.busy
      || !['player', 'targeting'].includes(current.snapshot.phase)
      || current.stage && current.stage !== stage
      || stage._battleToken != null && stage._battleToken !== current.snapshot.battleToken
      || selectionKey(current.snapshot, selectionState(current.snapshot, { clickUid:current.clickUid, findCard })) !== key) return;
    if (button.dataset.act === 'btPickReturnInfusion') onReturnToInfusion(selection.uid);
    else onCancel({ restoreFocus:event.detail === 0 });
  });
}
