import { displayCardDescription } from '../../cards/card-description-text.js';
import { descRich } from '../../cards/cards.view.js';
import { effCostOf, findEffectiveCard as findCard, infusionFuelReason, getSnapshot, infuseOf, targetSide, unplayableReason } from '../core/battle.core.js';

let active = null;
const inHand = (snapshot, uid) => snapshot.hand?.includes(uid);

function actionFor(uid, snapshot) {
  const entry = findCard(uid);
  if (!entry || !inHand(snapshot, uid)) return { reason: '这张牌已离开手牌' };
  if (snapshot.busy || !['player', 'targeting'].includes(snapshot.phase)) return { reason: '当前动作正在结算' };
  if (snapshot.infusing) {
    if (snapshot.infusing.uid === uid) return { reason: '不能用正在注能的牌作为材料' };
    const picked = snapshot.infusing.picked.includes(uid);
    if (!picked && infusionFuelReason(uid)) return { reason: infusionFuelReason(uid) };
    if (!picked && snapshot.infusing.picked.length >= snapshot.infusing.need) return { reason: '注能材料已选满' };
    return { kind: 'infusion', label: picked ? '取消这张材料' : '选作注能材料', detail: '只调整材料选择；确认发动后才消耗。' };
  }
  if (snapshot.discovering || snapshot.choosing || snapshot.handSelecting) return { reason: '请先完成当前选择' };
  const reason = unplayableReason(entry.card);
  if (reason) return { reason };
  const cost = effCostOf(entry.card, uid);
  if (cost > snapshot.energy) return { reason: `能量不足：需要 ${cost}，当前 ${snapshot.energy}` };
  return {
    kind: 'play', label: '使用这张牌',
    detail: infuseOf(entry.card) > 0 ? '下一步选择注能方式' : targetSide(entry.card) ? '下一步选择目标' : '确认后使用',
  };
}

export function closeHandInspector({ restoreFocus = true } = {}) {
  if (!active) return false;
  const previous = active;
  active = null;
  previous.observer?.disconnect();
  previous.panel.remove();
  previous.stage.inert = previous.wasInert;
  if (restoreFocus && previous.stage.isConnected) {
    const origin = [...previous.stage.querySelectorAll('.sts-hand .bt-card')].find(card => card.dataset.uid === previous.uid);
    (origin || previous.focus)?.focus({ preventScroll: true });
  }
  return true;
}

export function syncHandInspector(snapshot = getSnapshot()) {
  if (!active) return false;
  if (!active.stage.isConnected || !active.panel.isConnected || snapshot.battleToken !== active.token
    || active.stage._battleToken !== active.token
    || !inHand(snapshot, active.uid) || !['player', 'targeting'].includes(snapshot.phase)
    || snapshot.busy || snapshot.deckSelection || snapshot.viewingGrave || snapshot.viewingDeck
    || snapshot.viewingBag || snapshot.discovering || snapshot.choosing || snapshot.handSelecting) {
    closeHandInspector({ restoreFocus: false });
    return false;
  }
  const action = actionFor(active.uid, snapshot);
  const button = active.panel.querySelector('.bt-hand-detail-use');
  button.disabled = !!action.reason;
  button.textContent = action.label || '暂时无法使用';
  active.panel.querySelector('.bt-hand-detail-action-note').textContent = action.reason || action.detail;
  const entry = findCard(active.uid);
  const cost = active.panel.querySelector('.hsc-cost');
  if (cost) cost.textContent = String(effCostOf(entry.card, active.uid));
  return true;
}

export function openHandInspector(uid, onUse) {
  const SDT = window.SDT;
  const snapshot = getSnapshot();
  const entry = uid && findCard(uid);
  const stage = document.querySelector('#overlay .battle-stage');
  const overlay = document.getElementById('overlay');
  if (!entry || !stage || !overlay || overlay.hidden || !inHand(snapshot, uid)
    || stage._battleToken !== snapshot.battleToken
    || ['loading', 'waiting'].includes(stage.dataset.battleEntry)
    || !['player', 'targeting'].includes(snapshot.phase) || snapshot.busy) return false;
  closeHandInspector({ restoreFocus: false });
  SDT.UI.hideTooltip?.();
  const card = entry.card;
  const description = displayCardDescription(card.desc || '暂无规则描述', card.id);
  const panel = document.createElement('aside');
  panel.className = 'bt-hand-detail';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', `${card.name}：卡牌详情`);
  panel.innerHTML = `<div class="bt-hand-detail-scrim"></div><div class="bt-hand-detail-surface">
    <header><button type="button" class="bt-hand-detail-close" aria-label="关闭详情，返回手牌">返回手牌 · Esc</button></header>
    <div class="bt-hand-detail-body"><div class="bt-hand-detail-art">${SDT.Cards.cardHTML(card, 'lg', { costOverride: { v: effCostOf(card, uid), base: card._baseCost ?? card.cost } })}</div>
    ${description.length > 70 ? '<details class="bt-hand-detail-copy" open><summary>完整规则</summary><p class="bt-hand-detail-rules card-rules-copy"></p></details>' : ''}</div>
    <footer><p class="bt-hand-detail-action-note" role="status"></p><button type="button" class="bt-hand-detail-use">使用这张牌</button></footer></div>`;
  const fullRules = panel.querySelector('.bt-hand-detail-rules');
  if (fullRules) fullRules.innerHTML = descRich(description, card.id);
  active = { uid, token: snapshot.battleToken, stage, panel, wasInert: !!stage.inert, focus: document.activeElement };
  stage.inert = true;
  panel.addEventListener('pointerdown', event => event.stopPropagation());
  panel.addEventListener('click', event => event.stopPropagation());
  const closeThis = () => { if (active?.panel === panel) closeHandInspector(); };
  panel.querySelector('.bt-hand-detail-close').addEventListener('click', closeThis);
  panel.querySelector('.bt-hand-detail-scrim').addEventListener('click', closeThis);
  panel.querySelector('.bt-hand-detail-use').addEventListener('click', () => {
    if (active?.panel !== panel) return;
    if (!syncHandInspector()) return;
    const action = actionFor(uid, getSnapshot());
    if (action.reason) return;
    closeHandInspector({ restoreFocus: false });
    onUse?.(uid, action.kind);
  });
  overlay.appendChild(panel);
  active.observer = new MutationObserver(() => {
    if (active?.panel === panel && (overlay.hidden || !stage.isConnected || !panel.isConnected)) closeHandInspector({ restoreFocus: false });
  });
  active.observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  syncHandInspector(snapshot);
  panel.querySelector('.bt-hand-detail-close').focus({ preventScroll: true });
  return true;
}

function onInspectorKey(event) {
  if (!active) return;
  // 层内只允许自己的按钮与阅读滚动；数字键/结束回合/背包快捷键不能穿透。
  event.stopImmediatePropagation();
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeHandInspector();
  } else if (event.key === 'Tab') {
    const buttons = [...active.panel.querySelectorAll('button:not(:disabled), summary')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}
function onOverlayMode() { closeHandInspector({ restoreFocus: false }); }
document.addEventListener('keydown', onInspectorKey, true);
document.addEventListener('sdt-overlay-mode', onOverlayMode);
if (import.meta.hot) import.meta.hot.dispose(() => {
  closeHandInspector({ restoreFocus: false });
  document.removeEventListener('keydown', onInspectorKey, true);
  document.removeEventListener('sdt-overlay-mode', onOverlayMode);
});
