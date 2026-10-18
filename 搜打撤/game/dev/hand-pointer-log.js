// Isolated fixture diagnostics: visible DOM only, never battle commands or saved state.
export function createPointerLog(root, output, policyForEvent = () => null) {
  let entries = [];
  const cardOf = el => el instanceof Element ? el.closest('.bt-card') || el.closest('.bt-slot')?.querySelector('.bt-card') : null;
  const uid = el => cardOf(el)?.dataset.uid || '-';
  const rounded = number => Math.round(number * 10) / 10;
  function record(text) {
    entries.push(`${performance.now().toFixed(1)}ms ${text}`);
    entries = entries.slice(-20);
    output.textContent = entries.join('\n'); output.hidden = false;
    output.scrollTop = output.scrollHeight;
  }
  function geometry(card) {
    const slot = card.closest('.bt-slot'), r = card.getBoundingClientRect(), sr = slot.getBoundingClientRect();
    const style = getComputedStyle(card), slotStyle = getComputedStyle(slot);
    return { uid: card.dataset.uid, rect: [r.x, r.y, r.width, r.height].map(rounded),
      slotRect: [sr.x, sr.y, sr.width, sr.height].map(rounded), transform: style.transform,
      slotTransform: slotStyle.transform, zIndex: slotStyle.zIndex };
  }
  function event(e) {
    const targetCard = cardOf(e.target), previousCard = cardOf(e.relatedTarget);
    // Ignore movement between descendants of the same card, including rich text spans.
    // Keep entry into infusion buttons as a distinct diagnostic path.
    if (e.type === 'pointerover' && (!targetCard || (targetCard === previousCard
      && e.target.closest('.bt-infchip') === e.relatedTarget?.closest?.('.bt-infchip')))) return;
    const policy = policyForEvent(e);
    const hit = document.elementFromPoint(e.clientX, e.clientY), hitCard = cardOf(hit);
    const pair = [...new Set([targetCard, hitCard, previousCard].filter(Boolean))].slice(0, 2);
    if (pair.length === 1) {
      const neighbors = [...root.querySelectorAll('.bt-card')].filter(card => card !== pair[0]);
      neighbors.sort((a, b) => {
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return Math.abs(ar.x + ar.width / 2 - e.clientX) - Math.abs(br.x + br.width / 2 - e.clientX);
      });
      if (neighbors[0]) pair.push(neighbors[0]);
    }
    const guard = e.type === 'pointerdown' ? (e.target.closest('button,[data-term]') ? ' GUARD: button/term → 不起拖' : ' CARD: 卡面路径 → 生产将尝试拿起（本夹具不执行）') : '';
    record(`${policy ? `strategy=${policy.strategy} selectedUID=${policy.uid || '-'} route=${policy.route}${policy.accessBands?.length ? ` accessBands=${JSON.stringify(policy.accessBands)}` : ''} ` : ''}${e.type} (${rounded(e.clientX)},${rounded(e.clientY)}) targetUID=${uid(e.target)} elementFromPointUID=${uid(hit)}${guard} cards=${JSON.stringify(pair.map(geometry))}`);
  }
  return { record, event, clear() { entries = []; output.textContent = ''; } };
}
