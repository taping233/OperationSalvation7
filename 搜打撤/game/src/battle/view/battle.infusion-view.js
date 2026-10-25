/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import '../../../css/battle-infusion.css';
import { escAttr } from '../../core/shared.js';
import { isInteractiveBattlePage } from './battle.page-activity.js';
import { cancelSelection } from './battle.selection-ui.js';
import { infusionHandCards, infusionMaterialState } from './battle.infusion-material-state.js';
import { requiresInfusion } from '../effects/battle.infusion.js';

let keyCleanup = null;
if (import.meta.hot) import.meta.hot.dispose(() => { keyCleanup?.(); keyCleanup = null; });

// The ordinary hand stays mounted. Only its projection and selected-card
// container change; commands retain eligibility and atomic resource spending.
export function renderInfusionSelection({ UI, snapshot, getSnapshot, findCard, infusionFuelReason, targetSide, commands, cardHTML, focusedHandUid = null, materialSelection = null }) {
  keyCleanup?.(); keyCleanup = null;
  const stage = /** @type {BattleElement} */ (UI.el.ovBody.querySelector('.battle-stage.sts'));
  if (!stage) return;
  const previous = /** @type {BattleElement} */ (stage.querySelector('[data-infusion-workspace]'));
  const infusion = materialSelection?.selection || snapshot.infusing;
  const fuelReason = materialSelection?.reason || infusionFuelReason;
  const label = materialSelection?.label || '注能材料选择';
  const locks = stage.querySelectorAll('.sts-arena, .sts-topbar, .bt-potions, .sts-tactics, .sts-hud-l, .sts-hud-r, .sts-energy-wrap, .sts-hand-tools');
  locks.forEach((/** @type {HTMLElement} */ node) => { node.inert = !!infusion; });
  stage.toggleAttribute('data-infusion-mode', !!infusion);
  const hand = /** @type {BattleElement} */ (stage.querySelector('.sts-hand'));
  hand?.setAttribute('aria-label', infusion ? `${materialSelection ? label : '选择注能材料的手牌'}，点击一张移入已选区` : '当前手牌');
  if (!infusion) {
    previous?.remove();
    hand?.querySelectorAll('[data-infusion-page-hidden]').forEach(node => { node.removeAttribute('hidden'); node.removeAttribute('data-infusion-page-hidden'); });
    if (hand) { delete hand.dataset.infusionPage; delete hand.dataset.infusionPageSource; }
    // The shared hand may still be fading out the prior selection projection.
    hand?.querySelectorAll('.infusion-copy-count').forEach(node => node.closest('.bt-slot')?.remove());
    return;
  }
  const cards = infusionHandCards(materialSelection?.entries || snapshot.hand.map(findCard).filter(Boolean), infusion);
  const picked = infusion.picked;
  const candidateUids = new Set(cards.filter(entry => !picked.includes(entry.uids[0])).map(entry => entry.uids[0]));
  const displayedUids = new Set();
  // Selected cards have already left the layer's logical slots. Remove their
  // 240 ms exit remnants so one physical card cannot appear in both containers.
  [.../** @type {NodeListOf<BattleElement>} */ (hand?.querySelectorAll(':scope > .bt-slot') || [])].reverse().forEach(slot => {
    const uid = slot.dataset.uid;
    if (!candidateUids.has(uid) || displayedUids.has(uid)) slot.remove();
    else displayedUids.add(uid);
  });
  // 2026-10-21 老板反馈 #4：注能候选按同名叠收敛——每叠只展示首张未选副本的
  // 槽位，其余副本保留在 DOM（data-uid、数字键 1-9、点击轮转与已选区撤回全部
  // 不变），只隐藏展示并标注 ×N；代表副本被选走后，下一张副本在下一轮渲染
  // 自动接替为可见代表，因此整叠仍然逐张可达、手中全部卡牌不丢。
  const stackKeyOf = entry => entry.key.replace(/\|uid:.*$/, '');
  const repOfStack = new Map();
  cards.forEach(entry => {
    if (!candidateUids.has(entry.uids[0])) return;
    const stack = stackKeyOf(entry);
    if (!repOfStack.has(stack)) repOfStack.set(stack, entry.uids[0]);
  });
  [.../** @type {NodeListOf<BattleElement>} */ (hand?.querySelectorAll(':scope > .bt-slot') || [])].forEach(slot => {
    const entry = cards.find(card => card.uids[0] === slot.dataset.uid);
    const dup = !!entry && candidateUids.has(slot.dataset.uid) && repOfStack.get(stackKeyOf(entry)) !== slot.dataset.uid;
    slot.classList.toggle('infusion-dup', dup);
    if (dup) slot.setAttribute('aria-hidden', 'true');
    else slot.removeAttribute('aria-hidden');
  });
  const required = !!materialSelection || requiresInfusion(infusion.card);
  const remaining = Math.max(0, infusion.need - picked.length);
  const retainedTarget = Number.isInteger(infusion.targetIndex) && snapshot.foes[infusion.targetIndex]?.hp > 0 && !snapshot.foes[infusion.targetIndex]?.dead;
  const targetNext = !materialSelection && targetSide(infusion.card) === 'enemy' && snapshot.foes.filter(foe => foe.hp > 0).length > 1 && !retainedTarget;
  const same = previous?._battleToken === snapshot.battleToken && previous?._sourceUid === infusion.uid;
  const previousPicked = new Set(same ? [...previous.querySelectorAll('[data-selected-uid]')].map(node => /** @type {HTMLElement} */ (node).dataset.selectedUid) : []);
  const pickedChanged = same && (previousPicked.size !== picked.length || picked.some(uid => !previousPicked.has(uid)));
  const sourceCard = same ? previous.querySelector('.infusion-source-card') : null;
  const sourceFocus = sourceCard?.contains(document.activeElement) && document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selectedScroll = same ? /** @type {BattleElement} */ (previous.querySelector('.infusion-selected-cards'))?.scrollLeft || 0 : 0;
  const focused = same && previous.contains(document.activeElement) && document.activeElement instanceof HTMLElement ? { ...document.activeElement.dataset } : null;
  const chosen = picked.map(uid => cards.find(card => card.uids[0] === uid)).filter(Boolean);
  const selectedHTML = chosen.map(entry => `<article class="infusion-selected-card${same && !previousPicked.has(entry.uids[0]) ? ' infusion-pick-arriving' : ''}" data-selected-uid="${escAttr(entry.uids[0])}">
      <button type="button" class="infusion-card-face" data-act="btInfuseRemove" data-uid="${escAttr(entry.uids[0])}" aria-label="撤回${escAttr(entry.card.name)}第${entry.copyIndex}张，同名已选${entry.selectedCopies}/${entry.totalCopies}张">
        ${cardHTML(entry.card, 'sm')}<span class="infusion-card-return">↙</span>
      </button>
    </article>`).join('');
  const workspace = /** @type {BattleElement} */ (document.createElement('section'));
  workspace.setAttribute('data-infusion-workspace', '');
  workspace.setAttribute('aria-label', label);
  workspace.innerHTML = window.SDT.Icons.rich(`<header class="infusion-heading"><strong class="infusion-progress${remaining ? '' : ' is-ready'}${pickedChanged ? ' infusion-count-changed' : ''}" role="status" aria-label="已选 ${picked.length}/${infusion.need} 张材料">${picked.length}/${infusion.need}</strong></header>
    <aside class="infusion-source"><div class="infusion-source-card">${cardHTML(infusion.card, 'lg')}</div></aside>
    <section class="infusion-selection" aria-label="已选材料"><div class="infusion-selected-cards" role="group" aria-label="已选材料，点击卡面撤回">${selectedHTML}</div></section>
    <nav class="infusion-hand-nav" aria-label="翻阅候选材料"><button type="button" data-act="btInfusePrev">上一页</button><span data-infusion-page role="status" aria-live="polite"></span><button type="button" data-act="btInfuseNext">下一页</button></nav>
    <footer class="infusion-footer"><div class="infusion-actions">${!materialSelection || materialSelection.canCancel ? '<button class="ov-btn" data-act="btInfuseCancel">返回</button>' : ''}${required ? '' : `<button class="ov-btn infusion-direct" data-act="btInfuseDirect" data-uid="${escAttr(infusion.uid)}">不注能直接打出</button>`}<button class="ov-btn ok" data-act="btInfuseGo" aria-label="${materialSelection?.confirmLabel || (targetNext ? '确认材料，继续选择目标' : '确认注能并打出')}" ${remaining || materialSelection && !materialSelection.canConfirm ? 'disabled' : ''}>确认</button></div></footer>`);
  workspace._battleToken = snapshot.battleToken; workspace._sourceUid = infusion.uid;
  if (pickedChanged && !remaining) workspace.querySelector('[data-act="btInfuseGo"]').classList.add('infusion-confirm-ready');
  // Material picks must not reset a long main-card rule or reload its artwork.
  if (sourceCard) workspace.querySelector('.infusion-source-card').replaceWith(sourceCard);
  if (previous) previous.replaceWith(workspace); else stage.appendChild(workspace);
  workspace.querySelectorAll('.infusion-card-face [tabindex]').forEach((/** @type {HTMLElement} */ node) => { node.tabIndex = -1; });
  const emptyHand = hand?.querySelector('.ov-empty');
  if (emptyHand) emptyHand.textContent = '';
  /** @type {BattleElement} */ (workspace.querySelector('.infusion-selected-cards')).scrollLeft = selectedScroll;
  if (focusedHandUid && picked.includes(focusedHandUid)) [.../** @type {NodeListOf<HTMLButtonElement>} */ (workspace.querySelectorAll('[data-act="btInfuseRemove"]'))].find(button => button.dataset.uid === focusedHandUid)?.focus({ preventScroll:true });
  if (sourceFocus) sourceFocus.focus({ preventScroll:true });
  else if (focused) {
    const buttons = [.../** @type {NodeListOf<HTMLButtonElement>} */ (workspace.querySelectorAll('button:not(:disabled)'))];
    (buttons.find(button => button.dataset.act === focused.act && button.dataset.uid === focused.uid)
      || /** @type {HTMLElement} */ ([.../** @type {NodeListOf<BattleElement>} */ (hand?.querySelectorAll('.bt-card') || [])].find(node => node.dataset.uid === focused.uid)?.querySelector('.hs-card'))
      || buttons.find(button => button.dataset.act === 'btInfuseCancel'))?.focus({ preventScroll:true });
  }
  // Each face owns an actual UID; captions make same-name copies explicit.
  cards.filter(entry => !picked.includes(entry.uids[0])).forEach(entry => {
    const uid = entry.uids[0];
    const state = infusionMaterialState(entry, infusion, snapshot.hand, fuelReason);
    const card = [.../** @type {NodeListOf<BattleElement>} */ (hand?.querySelectorAll('.bt-card') || [])].find(node => node.dataset.uid === uid);
    if (!card) return;
    if (materialSelection) {
      card.classList.remove('off'); card.dataset.handState = 'infusing';
      if (state.addReason) card.dataset.blockReason = state.addReason; else delete card.dataset.blockReason;
      card.querySelector('.bt-rulehint')?.remove();
    }
    card.querySelector('.infusion-copy-count')?.remove();
    card.querySelector('.infusion-stack-count')?.remove();
    const caption = document.createElement('span'); caption.className = 'infusion-copy-count';
    caption.textContent = entry.shortcut ? String(entry.shortcut) : '';
    card.appendChild(caption);
    // 代表卡（同叠首张未选副本）标注整叠数量，隐藏副本不标注。
    if (entry.totalCopies > 1 && repOfStack.get(stackKeyOf(entry)) === uid) {
      const badge = document.createElement('span'); badge.className = 'infusion-stack-count';
      badge.textContent = `×${entry.totalCopies}`;
      card.appendChild(badge);
    }
    card.classList.toggle('infusion-at-limit', !state.canAdjust);
    card.setAttribute('aria-label', `${entry.card.name}，第${entry.copyIndex}/${entry.totalCopies}张，同名已选${entry.selectedCopies}张。${state.addReason || '点击选择为材料'}`);
    const face = card.querySelector('.hs-card');
    face?.classList.toggle('infusion-pick-returning', same && previousPicked.has(uid));
    face?.setAttribute('aria-label', card.getAttribute('aria-label'));
    face?.setAttribute('aria-disabled', state.canAdjust ? 'false' : 'true');
  });
  const current = () => {
    if (!isInteractiveBattlePage(UI, workspace) || stage.querySelector('[data-infusion-workspace]') !== workspace
      || document.getElementById('cardZoom')) return null;
    const now = getSnapshot();
    const selection = materialSelection ? materialSelection.current(now) : now.infusing;
    return now.battleToken === snapshot.battleToken && selection?.uid === infusion.uid
      && selection.selectionId === infusion.selectionId && !now.busy && ['player', 'targeting'].includes(now.phase)
      ? materialSelection ? { ...now, infusing:selection } : now : null;
  };
  const toggle = (uid, now = current()) => {
    if (!now || !cards.some(entry => entry.uids[0] === uid)) return;
    if (now.infusing.picked.includes(uid) || (now.hand.includes(uid) && now.infusing.picked.length < now.infusing.need && !fuelReason(uid))) {
      if (materialSelection) materialSelection.toggle(uid); else commands.selectInfusion(uid);
    }
  };
  UI.act('btInfuseRemove', data => { const now = current(); if (now?.infusing.picked.includes(data.uid)) toggle(data.uid, now); });
  const prevButton = /** @type {HTMLButtonElement} */ (workspace.querySelector('[data-act="btInfusePrev"]'));
  const nextButton = /** @type {HTMLButtonElement} */ (workspace.querySelector('[data-act="btInfuseNext"]'));
  const pageLabel = workspace.querySelector('[data-infusion-page]');
  let pageCount = 1;
  if (hand && hand.dataset.infusionPageSource !== infusion.uid) {
    hand.dataset.infusionPageSource = infusion.uid;
    hand.dataset.infusionPage = '0';
  }
  const syncHandNavigation = () => {
    const slots = [...(hand?.querySelectorAll(':scope > .bt-slot:not(.infusion-dup)') || [])];
    // Match the original 204px card, 22px gap and 24px horizontal padding.
    const pageSize = Math.max(1, Math.floor(((hand?.clientWidth || 1358) - 24 + 22) / 226));
    pageCount = Math.max(1, Math.ceil(slots.length / pageSize));
    const page = Math.min(pageCount - 1, Math.max(0, Number(hand?.dataset.infusionPage) || 0));
    if (hand) { hand.dataset.infusionPage = String(page); hand.scrollLeft = 0; }
    slots.forEach((slot, index) => {
      const outside = Math.floor(index / pageSize) !== page;
      slot.toggleAttribute('hidden', outside);
      slot.toggleAttribute('data-infusion-page-hidden', outside);
    });
    prevButton.disabled = page === 0;
    nextButton.disabled = page === pageCount - 1;
    pageLabel.textContent = `${page + 1} / ${pageCount}`;
  };
  const changeHandPage = direction => {
    if (!current() || !hand) return;
    hand.dataset.infusionPage = String(Math.min(pageCount - 1, Math.max(0, (Number(hand.dataset.infusionPage) || 0) + direction)));
    syncHandNavigation();
  };
  UI.act('btInfusePrev', () => changeHandPage(-1));
  UI.act('btInfuseNext', () => changeHandPage(1));
  let lastWheel = -Infinity;
  const onHandWheel = event => {
    if (!current() || !hand || event.ctrlKey || pageCount <= 1) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    event.preventDefault(); event.stopPropagation();
    if (delta && performance.now() - lastWheel >= 180) { lastWheel = performance.now(); changeHandPage(Math.sign(delta)); }
  };
  syncHandNavigation();
  const navigationFrame = requestAnimationFrame(syncHandNavigation);
  const handResize = typeof ResizeObserver === 'function' ? new ResizeObserver(syncHandNavigation) : null;
  if (hand) handResize?.observe(hand);
  hand?.addEventListener('wheel', onHandWheel, { passive:false });
  const cancel = () => { const now = current(); return !!now && (materialSelection ? materialSelection.cancel() : cancelSelection({ snapshot:now, commands })); };
  UI.act('btInfuseCancel', cancel);
  UI.act('btInfuseDirect', () => { if (current() && !required) commands.playDirect(infusion.uid); });
  UI.act('btInfuseGo', () => { const now = current(); if (now && now.infusing.picked.length === now.infusing.need) {
    if (materialSelection) materialSelection.confirm(); else commands.confirmInfusion();
  } });
  // Hand layers retain their ordinary command bindings. Material drafts capture
  // input before those handlers can play a card or start a targeting gesture.
  const handCard = event => event.target instanceof Element ? event.target.closest('.sts-hand .bt-card') : null;
  const onHandPointer = event => { if (handCard(event)) event.stopImmediatePropagation(); };
  const onHandClick = event => {
    const card = handCard(event);
    if (!card || event.target.closest('button, a, input, [data-act]:not([data-act="btPlay"])')) return;
    event.preventDefault(); event.stopImmediatePropagation(); toggle(card.dataset.uid);
  };
  const onHandKey = event => {
    const card = handCard(event);
    if (!card || event.target !== card.querySelector('.hs-card') || event.repeat
      || event.isComposing || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); toggle(card.dataset.uid);
  };
  stage.addEventListener('pointerdown', onHandPointer, true);
  stage.addEventListener('click', onHandClick, true);
  stage.addEventListener('keydown', onHandKey, true);
  const onKey = event => {
    if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
    const materialKey = /^[1-9]$/.test(event.key);
    if (event.key !== 'Escape' && !materialKey) return;
    // Suppress the ordinary hand shortcut behind this mode without preventing
    // browser shortcuts or editing text in an input/contenteditable region.
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '') || event.target?.closest?.('[contenteditable="true"]')) {
      event.stopImmediatePropagation(); return;
    }
    const now = current();
    if (!now) {
      if (materialKey || !document.getElementById('cardZoom')) event.stopImmediatePropagation();
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === 'Escape') cancel();
    else toggle(cards[Number(event.key) - 1]?.uids[0], now);
  };
  document.addEventListener('keydown', onKey, true);
  const cleanup = () => {
    cancelAnimationFrame(navigationFrame);
    handResize?.disconnect();
    hand?.removeEventListener('wheel', onHandWheel);
    document.removeEventListener('keydown', onKey, true);
    stage.removeEventListener('pointerdown', onHandPointer, true);
    stage.removeEventListener('click', onHandClick, true);
    stage.removeEventListener('keydown', onHandKey, true);
    document.removeEventListener('sdt-overlay-mode', cleanup);
    document.removeEventListener('sdt-overlay-close', cleanup);
    if (keyCleanup === cleanup) keyCleanup = null;
  };
  document.addEventListener('sdt-overlay-mode', cleanup);
  document.addEventListener('sdt-overlay-close', cleanup);
  keyCleanup = cleanup;
}
