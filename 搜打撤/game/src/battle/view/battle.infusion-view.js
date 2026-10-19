import '../../../css/battle-infusion.css';
import { esc, escAttr } from '../../core/shared.js';
import { displayCardDescription } from '../../cards/card-description-text.js';
import { descRich } from '../../cards/cards.view.js';
import { groupHandCards, orderHandGroups } from '../core/battle.hand.js';

import { cancelSelection } from './battle.selection-ui.js';
import { requiresInfusion } from '../effects/battle.infusion.js';

let keyCleanup = null;
if (import.meta.hot) import.meta.hot.dispose(() => { keyCleanup?.(); keyCleanup = null; });

// Selection is presentation only. The battle commands remain the authority for
// eligibility, counts, final target confirmation and atomic resource spending.
export function renderInfusionSelection({ UI, snapshot, getSnapshot, findCard, infusionFuelReason, effCostOf, targetSide, commands, showBattleDecision, cardHTML }) {
  keyCleanup?.(); keyCleanup = null;
  const infusion = snapshot.infusing;
  const entries = snapshot.hand.map(findCard).filter(Boolean);
  const groups = orderHandGroups(groupHandCards(entries, infusion)).filter(group => !group.self);
  const picked = infusion.picked;
  const required = requiresInfusion(infusion.card);
  const remaining = Math.max(0, infusion.need - picked.length);
  const targetNext = targetSide(infusion.card) === 'enemy' && snapshot.foes.filter(foe => foe.hp > 0).length > 1;
  const previous = UI.el.ovBody.querySelector('[data-infusion-workspace]');
  const same = previous?._battleToken === snapshot.battleToken && previous?._sourceUid === infusion.uid;
  const scroll = same ? previous.querySelector('.infusion-materials')?.scrollTop || 0 : 0;
  const sourceExpanded = same && previous.querySelector('.infusion-source-details')?.open;
  const focused = same && previous.contains(document.activeElement) ? { ...document.activeElement.dataset } : null;
  const materialHTML = groups.map((group, i) => {
    const selected = group.uids.filter(uid => picked.includes(uid));
    const available = group.uids.filter(uid => !picked.includes(uid) && !infusionFuelReason(uid));
    const reason = available.length || selected.length ? '' : infusionFuelReason(group.uids[0]);
    const canAdd = available.length > 0 && remaining > 0;
    return `<article class="infusion-material${selected.length ? ' is-selected' : ''}${reason ? ' is-unavailable' : ''}">
      <div class="infusion-material-heading"><b>${i < 9 ? `<small class="infusion-key">${i + 1}</small> ` : ''}${esc(group.card.name)}</b><button class="infusion-detail" data-act="btInfuseInspect" data-i="${i}">详情</button></div>
      <div class="infusion-quantity"><button data-act="btInfuseRemove" data-i="${i}" aria-label="减少一张${escAttr(group.card.name)}" ${selected.length ? '' : 'disabled'}>−</button><span><b>${selected.length}</b> / ${group.uids.length}<small>已选 / 持有</small></span><button data-act="btInfuseAdd" data-i="${i}" aria-label="增加一张${escAttr(group.card.name)}" ${canAdd ? '' : 'disabled'}>＋</button></div>
      <button class="infusion-card-face" aria-pressed="${selected.length > 0}" data-act="btInfuseAdd" data-i="${i}" aria-label="选择一张${escAttr(group.card.name)}作为材料" ${canAdd ? '' : 'disabled'}>${cardHTML(group.card, 'sm')}</button>
      ${reason ? `<p class="infusion-material-note">${esc(reason)}</p>` : ''}
    </article>`;
  }).join('');
  const chosen = groups.filter(group => group.uids.some(uid => picked.includes(uid))).map(group => `${esc(group.card.name)} ×${group.uids.filter(uid => picked.includes(uid)).length}`).join('、');
  showBattleDecision('注能', `<div data-decision-content="infusion" data-infusion-workspace>
    <aside class="infusion-source"><span class="infusion-eyebrow">将要使用</span><h4>${esc(infusion.card.name)}</h4><p class="infusion-cost">消耗 ${effCostOf(infusion.card, infusion.uid)} 点能量 + ${infusion.need} 张材料</p>
      <div class="infusion-rules"><h5>打出效果</h5><p>${descRich(displayCardDescription(infusion.card.desc || '暂无规则描述', infusion.card.id), infusion.card.id)}</p></div>
      <details class="infusion-source-details" ${sourceExpanded ? 'open' : ''}><summary>查看卡面</summary><div class="infusion-source-card">${cardHTML(infusion.card, 'sm')}</div></details>
      <p class="infusion-destination">材料进入本场消耗牌堆，不再抽回；战后进入消耗区。道具、装备不可在火堆复原。</p>
    </aside>
    <section class="infusion-selection"><header><div><h4>选择 ${infusion.need} 张材料</h4></div><strong class="infusion-progress${remaining ? '' : ' is-ready'}" role="status">已选 ${picked.length}/${infusion.need}${remaining ? '' : '<small>材料已齐</small>'}</strong></header>
      <div class="infusion-materials">${materialHTML || '<p>没有可选材料</p>'}</div>
      <div class="infusion-selection-summary"><span>本次材料</span><p>${chosen || '尚未选择材料'}</p></div>
    </section></div>
    <div class="ov-btns infusion-footer"><button class="ov-btn" data-act="btInfuseCancel">返回战斗</button><button class="ov-btn infusion-direct" data-act="btInfuseDirect" data-uid="${escAttr(infusion.uid)}" ${required ? 'disabled title="未注能时没有效果，必须先注能"' : ''}>${required ? '必须注能后打出' : '不注能直接打出'}</button><p>${targetNext ? '下一步选目标，有效打出后才消耗' : '确认后打出，并消耗所选材料'}</p><button class="ov-btn ok" data-act="btInfuseGo" ${remaining ? 'disabled' : ''}>${remaining ? `还需 ${remaining} 张材料` : targetNext ? '确认材料 · 选择目标' : '确认注能并打出'}</button></div>`, 'discover', snapshot);
  const page = UI.el.ovBody.querySelector('.battle-decision[data-decision-kind="infusion"]');
  const workspace = page?.querySelector('[data-infusion-workspace]');
  if (!workspace) return;
  workspace._battleToken = snapshot.battleToken; workspace._sourceUid = infusion.uid;
  workspace.querySelector('.infusion-materials').scrollTop = scroll;
  if (focused) [...page.querySelectorAll('button')].find(button => button.dataset.act === focused.act && button.dataset.i === focused.i)?.focus({ preventScroll:true });
  // A snapshot checks all current values; share it only within this synchronous
  // input. Later inputs must see in-place state changes before the next render.
  const current = () => {
    if (!page.isConnected || UI.el.overlay.hidden || UI.el.ovBody.querySelector('.battle-decision') !== page
      || document.getElementById('cardZoom')) return null;
    const now = getSnapshot();
    return now.battleToken === snapshot.battleToken && now.infusing?.uid === infusion.uid
      && !now.busy && ['player', 'targeting'].includes(now.phase) ? now : null;
  };
  const adjust = (data, remove, now = current()) => {
    if (!now) return;
    const group = groups[Number(data.i)];
    if (!group) return;
    const uid = remove ? group.uids.find(id => now.infusing.picked.includes(id))
      : now.infusing.picked.length < now.infusing.need && group.uids.find(id => now.hand.includes(id) && !now.infusing.picked.includes(id) && !infusionFuelReason(id));
    if (uid) commands.selectInfusion(uid);
  };
  UI.act('btPlay', () => {});
  UI.act('btInfuseAdd', data => adjust(data, false));
  UI.act('btInfuseRemove', data => adjust(data, true));
  UI.act('btInfuseInspect', data => {
    if (!current()) return;
    const group = groups[Number(data.i)];
    const entry = group && findCard(group.uids[0]);
    if (entry) UI.showCardZoom(entry.card, { returnFocus:page.querySelector(`[data-act="btInfuseInspect"][data-i="${Number(data.i)}"]`) });
  });
  const cancel = () => { const now = current(); return !!now && cancelSelection({ snapshot:now, commands }); };
  UI.act('btInfuseCancel', cancel);
  UI.act('btInfuseDirect', () => { if (current() && !required) commands.playDirect(infusion.uid); });
  UI.act('btInfuseGo', () => { const now = current(); if (now && now.infusing.picked.length === now.infusing.need) commands.confirmInfusion(); });
  const onKey = event => {
    if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
    const materialKey = /^[1-9]$/.test(event.key) && !/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '') && !event.shiftKey;
    if (event.key !== 'Escape' && !materialKey) return;
    const now = current();
    if (!now) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel(); }
    // Detached hand-layer shortcuts must not select a hidden material.
    if (materialKey) {
      event.preventDefault(); event.stopImmediatePropagation();
      const i = Number(event.key) - 1, group = groups[i], infusionNow = now.infusing;
      if (group) adjust({ i }, infusionNow.picked.length >= infusionNow.need || group.uids.every(uid => infusionNow.picked.includes(uid)), now);
    }
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
  UI.refresh(window.SDT.game);
}
