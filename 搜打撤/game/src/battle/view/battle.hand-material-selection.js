// A draft for the shared material workspace. Only pickHandSelect spends cards.
export const isHandMaterialSelection = snapshot => ['payment', 'consume'].includes(snapshot?.handSelecting?.act);
const faceKey = card => JSON.stringify(card);
const identity = snapshot => {
  const state = snapshot?.handSelecting;
  return isHandMaterialSelection(snapshot) ? JSON.stringify([snapshot.battleToken, state.selectionId,
    state.act, state.payment?.uid ?? null, state.srcCard?.id ?? null]) : null;
};
const progress = state => JSON.stringify([state.n, state.selectedUids || []]);

export function createHandMaterialSelection({ getSnapshot, commands, findCard, requestRender }) {
  let draft = null, serial = 0, submitting = false;
  function project(snapshot) {
    const key = identity(snapshot), state = snapshot?.handSelecting;
    if (!key) { if (!submitting) draft = null; return null; }
    if (submitting) return null;
    if (!draft || draft.key !== key || draft.progress !== progress(state)) {
      draft = { key, progress: progress(state), serial: ++serial, picked: new Map() };
    }
    const owner = draft;
    const sourceUid = state.act === 'payment' ? state.payment.uid : `hand-material-source:${owner.serial}`;
    const sourceCard = state.payment?.card || state.srcCard || {
      id:'hand-material-effect', name:state.sourceCardName || '消耗手牌', type:'武术', cost:0, desc:'选择手牌消耗',
    };
    const live = new Map(snapshot.hand.map(uid => [uid, findCard(uid)]));
    const candidates = new Set(state.candidateUids || []);
    const reason = uid => !candidates.has(uid) || !snapshot.hand.includes(uid) || !live.get(uid)
      ? '这张牌已不在当前可选手牌中'
      : owner.picked.has(uid) && owner.picked.get(uid).face !== faceKey(live.get(uid).card)
        ? '卡牌已变化，请撤回后重新选择' : '';
    const entries = [...new Set([...(state.candidateUids || []), ...owner.picked.keys()])]
      .map(uid => live.get(uid) || owner.picked.get(uid)?.entry).filter(Boolean);
    entries.push({ uid:sourceUid, card:sourceCard });
    const selection = { uid:sourceUid, card:sourceCard, need:state.n, picked:[...owner.picked.keys()],
      selectionId:owner.serial, targetIndex:null };
    const current = now => !submitting && draft === owner && identity(now) === owner.key
      && progress(now.handSelecting) === owner.progress ? project(now)?.selection : null;
    const toggle = uid => {
      const now = getSnapshot();
      if (!current(now)) return;
      if (owner.picked.has(uid)) owner.picked.delete(uid);
      else {
        const entry = findCard(uid);
        if (!entry || !now.handSelecting.candidateUids?.includes(uid) || !now.hand.includes(uid)
          || owner.picked.size >= now.handSelecting.n) return;
        owner.picked.set(uid, { entry, face:faceKey(entry.card) });
      }
      requestRender();
    };
    const confirm = () => {
      const now = getSnapshot();
      if (!current(now) || owner.picked.size !== now.handSelecting.n) return;
      const uids = [...owner.picked.keys()];
      if (uids.some(uid => !now.handSelecting.candidateUids?.includes(uid) || !now.hand.includes(uid)
        || !findCard(uid) || owner.picked.get(uid).face !== faceKey(findCard(uid).card))) {
        requestRender(); return;
      }
      submitting = true;
      try {
        for (let i = 0; i < uids.length; i++) {
          const active = getSnapshot();
          if (identity(active) !== owner.key || active.handSelecting.n !== now.handSelecting.n - i
            || !['player', 'targeting'].includes(active.phase)
            || !active.handSelecting.candidateUids?.includes(uids[i]) || !findCard(uids[i])
            || owner.picked.get(uids[i]).face !== faceKey(findCard(uids[i]).card)) break;
          commands.pickHandSelect(uids[i]);
        }
      } finally { submitting = false; if (draft === owner) draft = null; requestRender(); }
    };
    const cancel = () => {
      const now = getSnapshot();
      if (!current(now) || now.handSelecting.canCancel !== true) return false;
      draft = null; commands.skipHandSelect(); requestRender(); return true;
    };
    return { selection, entries, reason, current, toggle, confirm, cancel,
      canCancel:state.canCancel === true, canConfirm:selection.picked.length === selection.need && !selection.picked.some(reason),
      label:state.act === 'payment' ? '选择消耗代价' : '选择消耗手牌', confirmLabel:'确认消耗' };
  }
  return { project, isSubmitting:() => submitting };
}
