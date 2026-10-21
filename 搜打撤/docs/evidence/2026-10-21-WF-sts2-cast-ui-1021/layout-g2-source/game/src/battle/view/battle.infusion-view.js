/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import '../../../css/battle-infusion.css';
import { esc, escAttr } from '../../core/shared.js';
import { isInteractiveBattlePage } from './battle.page-activity.js';
import { cancelSelection } from './battle.selection-ui.js';
import { infusionHandCards, infusionMaterialState } from './battle.infusion-material-state.js';
import { requiresInfusion } from '../effects/battle.infusion.js';

let keyCleanup = null;
if (import.meta.hot) import.meta.hot.dispose(() => { keyCleanup?.(); keyCleanup = null; });

// The ordinary hand stays mounted. Only its projection and selected-card
// container change; commands retain eligibility and atomic resource spending.
export function renderInfusionSelection({ UI, snapshot, getSnapshot, findCard, infusionFuelReason, effCostOf, targetSide, commands, cardHTML, focusedHandUid = null }) {
  keyCleanup?.(); keyCleanup = null;
  const stage = /** @type {BattleElement} */ (UI.el.ovBody.querySelector('.battle-stage.sts'));
  if (!stage) return;
  const previous = /** @type {BattleElement} */ (stage.querySelector('[data-infusion-workspace]'));
  const infusion = snapshot.infusing;
  const locks = stage.querySelectorAll('.sts-arena, .sts-topbar, .bt-potions, .sts-tactics, .sts-hud-l, .sts-hud-r, .sts-energy-wrap, .sts-hand-tools');
  locks.forEach((/** @type {HTMLElement} */ node) => { node.inert = !!infusion; });
  stage.toggleAttribute('data-infusion-mode', !!infusion);
  const hand = /** @type {BattleElement} */ (stage.querySelector('.sts-hand'));
  hand?.setAttribute('aria-label', infusion ? '选择注能材料的手牌，点击一张移入已选区' : '当前手牌');
  if (!infusion) {
    previous?.remove();
    // The shared hand may still be fading out the prior selection projection.
    hand?.querySelectorAll('.infusion-copy-count').forEach(node => node.closest('.bt-slot')?.remove());
    return;
  }
  const cards = infusionHandCards(snapshot.hand.map(findCard).filter(Boolean), infusion);
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
  const required = requiresInfusion(infusion.card);
  const remaining = Math.max(0, infusion.need - picked.length);
  const retainedTarget = Number.isInteger(infusion.targetIndex) && snapshot.foes[infusion.targetIndex]?.hp > 0 && !snapshot.foes[infusion.targetIndex]?.dead;
  const targetNext = targetSide(infusion.card) === 'enemy' && snapshot.foes.filter(foe => foe.hp > 0).length > 1 && !retainedTarget;
  const same = previous?._battleToken === snapshot.battleToken && previous?._sourceUid === infusion.uid;
  const sourceCard = same ? previous.querySelector('.infusion-source-card') : null;
  const sourceFocus = sourceCard?.contains(document.activeElement) && document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selectedScroll = same ? /** @type {BattleElement} */ (previous.querySelector('.infusion-selected-cards'))?.scrollLeft || 0 : 0;
  const focused = same && previous.contains(document.activeElement) && document.activeElement instanceof HTMLElement ? { ...document.activeElement.dataset } : null;
  const chosen = picked.map(uid => cards.find(card => card.uids[0] === uid)).filter(Boolean);
  const selectedHTML = chosen.map(entry => `<article class="infusion-selected-card" data-selected-uid="${escAttr(entry.uids[0])}">
      <button type="button" class="infusion-card-face" data-act="btInfuseRemove" data-uid="${escAttr(entry.uids[0])}" aria-label="撤回${escAttr(entry.card.name)}第${entry.copyIndex}张，同名已选${entry.selectedCopies}/${entry.totalCopies}张">
        ${cardHTML(entry.card, 'sm')}<span class="infusion-card-return">↙ 点击撤回${entry.shortcut ? ` · ${entry.shortcut}` : ''}</span>
      </button><span class="infusion-copy-count">第 ${entry.copyIndex}/${entry.totalCopies} 张 · 同名已选 ${entry.selectedCopies} 张</span>
    </article>`).join('');
  const workspace = /** @type {BattleElement} */ (document.createElement('section'));
  workspace.setAttribute('data-infusion-workspace', '');
  workspace.setAttribute('aria-label', '注能材料选择');
  workspace.innerHTML = window.SDT.Icons.rich(`<header class="infusion-heading"><div><span class="infusion-eyebrow">注能</span><h3>从手牌选择 ${infusion.need} 张材料</h3></div><strong class="infusion-progress${remaining ? '' : ' is-ready'}" role="status">已选 ${picked.length}/${infusion.need}${remaining ? '' : '<small>材料已齐</small>'}</strong></header>
    <aside class="infusion-source"><span class="infusion-eyebrow">将要使用</span><h4>${esc(infusion.card.name)}</h4><p class="infusion-cost">${effCostOf(infusion.card, infusion.uid)} 点能量 + ${infusion.need} 张材料</p>
      <div class="infusion-source-card">${cardHTML(infusion.card, 'lg')}</div>
      <button type="button" class="infusion-detail" data-act="btInfuseInspect" data-uid="${escAttr(infusion.uid)}">查看主卡详情</button>
      <p class="infusion-destination">材料进入消耗牌堆，不自动洗回，仅由卡牌效果取回；战后进入消耗区。道具、装备不可在火堆复原。</p>
    </aside>
    <section class="infusion-selection"><header><h4>已选材料</h4><span>${picked.length ? '点击已选卡撤回手牌' : '点击下方手牌移入此处'}</span></header>
      <div class="infusion-selected-cards" role="group" aria-label="已选材料，点击卡面撤回">${selectedHTML || '<p class="infusion-selection-empty">从下方手牌选择材料</p>'}</div>
    </section>
    <footer class="infusion-footer"><div class="infusion-actions"><button class="ov-btn" data-act="btInfuseCancel">返回战斗</button><button class="ov-btn infusion-direct" data-act="btInfuseDirect" data-uid="${escAttr(infusion.uid)}" ${required ? 'disabled title="未注能时没有效果，必须先注能"' : ''}>${required ? '必须注能后打出' : '不注能直接打出'}</button><button class="ov-btn ok" data-act="btInfuseGo" ${remaining ? 'disabled' : ''}>${remaining ? `还需 ${remaining} 张材料` : targetNext ? '确认材料 · 选择目标' : '确认注能并打出'}</button></div><p>${targetNext ? '下一步选目标，有效打出后才消耗' : '确认后打出，并消耗所选材料'}</p></footer>
    <div class="infusion-hand-caption"><h4>候选手牌</h4><span>${cards.length - picked.length} 张留在手中 · 已选卡在上方${cards.length > 9 ? ' · 横向滚动查看更多' : ''}</span></div>`);
  workspace._battleToken = snapshot.battleToken; workspace._sourceUid = infusion.uid;
  // Keep the current unit readout above the selection area while the original
  // figures, foot bars and overlay canvas are suspended behind card selection.
  const context = document.createElement('aside');
  context.className = 'infusion-battle-context'; context.setAttribute('aria-label', '战场生命与意图');
  stage.querySelectorAll('.sts-me, .sts-ally:not(.dead), .sts-foe:not(.dead)').forEach(unit => {
    const summary = document.createElement('div'); summary.className = 'infusion-unit-summary';
    const name = document.createElement('span'); name.className = 'infusion-unit-name';
    name.textContent = unit.querySelector('.sts-figure')?.getAttribute('aria-label') || '单位';
    summary.appendChild(name);
    const vitals = unit.querySelector('.sts-unit-vitals');
    if (vitals) summary.appendChild(vitals.cloneNode(true));
    const intent = /** @type {HTMLElement} */ (unit.querySelector('.sts-intent'));
    const readout = intent && intent.style.display !== 'none' && !intent.hidden ? intent : unit.querySelector('.sts-stats');
    if (readout) summary.appendChild(readout.cloneNode(true));
    summary.querySelectorAll('[tabindex], [role], [data-act]').forEach(node => {
      node.removeAttribute('tabindex'); node.removeAttribute('role'); node.removeAttribute('data-act');
    });
    context.appendChild(summary);
  });
  workspace.prepend(context);
  // Material picks must not reset a long main-card rule or reload its artwork.
  if (sourceCard) workspace.querySelector('.infusion-source-card').replaceWith(sourceCard);
  if (previous) previous.replaceWith(workspace); else stage.appendChild(workspace);
  workspace.querySelectorAll('.infusion-card-face [tabindex]').forEach((/** @type {HTMLElement} */ node) => { node.tabIndex = -1; });
  const emptyHand = hand?.querySelector('.ov-empty');
  if (emptyHand) emptyHand.textContent = '候选手牌已全部选中；点击上方卡牌可撤回。';
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
    const state = infusionMaterialState(entry, infusion, snapshot.hand, infusionFuelReason);
    const card = [.../** @type {NodeListOf<BattleElement>} */ (hand?.querySelectorAll('.bt-card') || [])].find(node => node.dataset.uid === uid);
    if (!card) return;
    card.querySelector('.infusion-copy-count')?.remove();
    const caption = document.createElement('span'); caption.className = 'infusion-copy-count';
    caption.textContent = `${entry.shortcut ? `${entry.shortcut} · ` : ''}第 ${entry.copyIndex}/${entry.totalCopies} 张 · 同名已选 ${entry.selectedCopies} 张`;
    card.appendChild(caption);
    card.classList.toggle('infusion-at-limit', !state.canAdjust);
    card.setAttribute('aria-label', `${entry.card.name}，第${entry.copyIndex}/${entry.totalCopies}张，同名已选${entry.selectedCopies}张。${state.addReason || '点击选择为材料'}`);
    const face = card.querySelector('.hs-card');
    face?.setAttribute('aria-label', card.getAttribute('aria-label'));
    face?.setAttribute('aria-disabled', state.canAdjust ? 'false' : 'true');
  });
  const current = () => {
    if (!isInteractiveBattlePage(UI, workspace) || stage.querySelector('[data-infusion-workspace]') !== workspace
      || document.getElementById('cardZoom')) return null;
    const now = getSnapshot();
    return now.battleToken === snapshot.battleToken && now.infusing?.uid === infusion.uid
      && now.infusing.selectionId === infusion.selectionId && !now.busy && ['player', 'targeting'].includes(now.phase) ? now : null;
  };
  const toggle = (uid, now = current()) => {
    if (!now || !cards.some(entry => entry.uids[0] === uid)) return;
    if (now.infusing.picked.includes(uid) || (now.hand.includes(uid) && now.infusing.picked.length < now.infusing.need && !infusionFuelReason(uid))) commands.selectInfusion(uid);
  };
  UI.act('btInfuseRemove', data => { const now = current(); if (now?.infusing.picked.includes(data.uid)) toggle(data.uid, now); });
  UI.act('btInfuseInspect', data => {
    if (!current()) return;
    const entry = findCard(data.uid);
    if (entry) UI.showCardZoom(entry.card, { returnFocus:workspace.querySelector('[data-act="btInfuseInspect"]') });
  });
  const cancel = () => { const now = current(); return !!now && cancelSelection({ snapshot:now, commands }); };
  UI.act('btInfuseCancel', cancel);
  UI.act('btInfuseDirect', () => { if (current() && !required) commands.playDirect(infusion.uid); });
  UI.act('btInfuseGo', () => { const now = current(); if (now && now.infusing.picked.length === now.infusing.need) commands.confirmInfusion(); });
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
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('sdt-overlay-mode', cleanup);
    document.removeEventListener('sdt-overlay-close', cleanup);
    if (keyCleanup === cleanup) keyCleanup = null;
  };
  document.addEventListener('sdt-overlay-mode', cleanup);
  document.addEventListener('sdt-overlay-close', cleanup);
  keyCleanup = cleanup;
}
