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

// Target selection uses battlefield highlighting and existing keyboard cancellation.
// Remove any previously mounted strip during a live update; never create a replacement.
export function syncSelectionPrompt(stage, ..._options) {
  void _options; // Preserve the existing renderer call signature during live updates.
  stage?.querySelectorAll('[data-selection-prompt]').forEach(bar => bar.remove());
}
