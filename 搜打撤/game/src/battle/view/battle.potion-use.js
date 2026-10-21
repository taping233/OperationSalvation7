// @ts-check
import '../../../css/battle-potion-use.css';
import { isInteractiveBattlePage } from './battle.page-activity.js';

/** @typedef {import('../battle.snapshot.types.js').BattleSnapshot} BattleSnapshot */
/** @typedef {import('./battle.dom.types.js').BattleElement} BattleElement */
/** @typedef {NonNullable<BattleSnapshot['potionBar']>[number]} Potion */
/** @typedef {{ el: { overlay?: HTMLElement | null, ovBody?: HTMLElement | null }, _lastMode?: string | null }} PotionUI */
/** @typedef {{ uid: string, source: HTMLElement, panel: HTMLElement, pinned: boolean, submitted: boolean }} Inspection */

// Inspecting never enters the domain. Only the current popup's Use button can
// invoke the existing command, which retains targeting, ownership and cost rules.
/** @param {{ UI: PotionUI, getSnapshot: () => BattleSnapshot, commands: { usePotion: (uid: string) => unknown } }} options */
export function createBattlePotionUse({ UI, getSnapshot, commands }) {
  /** @type {BattleElement | null} */ let stage = null;
  /** @type {HTMLElement | null} */ let bar = null;
  /** @type {number | null} */ let token = null;
  /** @type {readonly Potion[]} */ let presented = [];
  /** @type {Inspection | null} */ let inspection = null;
  /** @type {MutationObserver | null} */ let observer = null;
  let disposed = false;

  /** @param {HTMLElement} element */
  function visible(element) {
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      if (node === UI.el.overlay) return true;
    }
    return false;
  }
  function currentPage() {
    return !!stage && !!bar && isInteractiveBattlePage(UI, stage) && UI._lastMode === 'battle'
      && UI.el.ovBody?.querySelector('.battle-stage.sts') === stage
      && stage.querySelector(':scope > .bt-potions') === bar && stage._battleToken === token
      && !bar.closest('[hidden], [inert], [aria-hidden="true"]') && visible(bar);
  }
  function currentSnapshot() {
    const snapshot = getSnapshot();
    if (!currentPage() || snapshot.battleToken !== token || snapshot.phase !== 'player' || snapshot.busy
      || snapshot.actionQueueLength || snapshot.infusing || snapshot.discovering || snapshot.choosing
      || snapshot.handSelecting || snapshot.deckSelection || snapshot.viewingGrave || snapshot.viewingDeck
      || snapshot.viewingBag || snapshot.pendingTarget || snapshot.pendingItem || snapshot.slamPending || snapshot.dartPending) return null;
    return snapshot;
  }
  /** @param {HTMLElement} source */
  function sourceUid(source) {
    return source.dataset.uid || presented[Number(source.dataset.potionIdx)]?.uid || '';
  }
  /** @param {EventTarget | null} target */
  function sourceAt(target) {
    const source = target instanceof Element ? target.closest('.bt-potion') : null;
    return source instanceof HTMLElement && bar?.contains(source) ? source : null;
  }
  /** @param {boolean} [restoreFocus] */
  function close(restoreFocus = false) {
    const previous = inspection;
    inspection = null;
    if (!previous) return;
    previous.panel.hidden = true;
    previous.panel.remove();
    previous.source.classList.remove('is-inspected');
    previous.source.setAttribute('aria-expanded', 'false');
    if (restoreFocus && currentPage() && previous.source.isConnected) previous.source.focus({ preventScroll: true });
  }
  /** @param {string} uid @param {boolean} pinned @param {HTMLElement | null} [source] */
  function inspect(uid, pinned, source = null) {
    const snapshot = currentSnapshot();
    const live = snapshot?.potionBar?.find(potion => potion.uid === uid);
    if (!live || !bar) { close(); return false; }
    const sources = /** @type {NodeListOf<HTMLElement>} */ (bar.querySelectorAll('.bt-potion'));
    source ||= [...sources].find(node => sourceUid(node) === uid) || null;
    if (!(source instanceof HTMLElement) || !source.isConnected || !bar.contains(source) || sourceUid(source) !== uid
      || source.closest('[hidden], [inert], [aria-hidden="true"]') || !visible(source)) return false;
    if (inspection?.uid === uid && (inspection.pinned || !pinned)) return true;
    if (inspection?.pinned && !pinned) return false;
    close();
    const shown = presented.find(potion => potion.uid === uid) || live;
    const panel = document.createElement('section');
    panel.className = `bt-potion-use${pinned ? '' : ' is-preview'}`;
    panel.dataset.potionUse = uid;
    panel.setAttribute('role', pinned ? 'dialog' : 'status');
    panel.setAttribute('aria-label', `${shown.name}道具详情`);
    const heading = document.createElement('strong');
    heading.className = 'bt-potion-use-name';
    heading.textContent = `${shown.name}${live.count > 1 ? ` ×${live.count}` : ''}`;
    const description = document.createElement('p');
    description.className = 'bt-potion-use-description';
    description.textContent = shown.desc;
    const hint = document.createElement('p');
    hint.className = 'bt-potion-use-hint';
    hint.textContent = live.usable === false ? `当前无法使用：${live.why}`
      : pinned ? (live.aim === 'enemy' ? '确认使用；有多名敌人时再选择目标。也可从道具栏拖向敌人。' : '确认使用后立即生效。')
        : live.aim === 'enemy' ? '点击查看使用入口；也可拖到敌人身上使用。' : '点击查看道具和使用入口。';
    const actions = document.createElement('div');
    actions.className = 'bt-potion-use-actions';
    const use = document.createElement('button');
    use.type = 'button'; use.className = 'bt-potion-use-confirm';
    use.textContent = '使用'; use.disabled = live.usable === false;
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'bt-potion-use-cancel'; cancel.textContent = '取消';
    actions.hidden = !pinned;
    actions.append(use, cancel); panel.append(heading, description, hint, actions);
    const opened = { uid, source, panel, pinned, submitted: false };
    inspection = opened;
    source.setAttribute('aria-haspopup', 'dialog');
    source.setAttribute('aria-expanded', String(pinned));
    if (pinned) source.classList.add('is-inspected');
    panel.addEventListener('pointerdown', event => event.stopPropagation());
    panel.addEventListener('click', event => event.stopPropagation());
    use.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if (inspection !== opened || !opened.pinned || opened.submitted || !panel.isConnected || !bar?.contains(panel)) return;
      const current = currentSnapshot()?.potionBar?.find(potion => potion.uid === uid);
      if (!current || current.usable === false || sourceUid(source) !== uid || !source.isConnected || !bar.contains(source)
        || source.closest('[hidden], [inert], [aria-hidden="true"]') || !visible(source)) { close(); return; }
      opened.submitted = true;
      use.disabled = true;
      close();
      commands.usePotion(uid);
    });
    cancel.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); if (inspection === opened) close(true); });
    bar.append(panel);
    return true;
  }
  /** @param {string} uid */
  function open(uid) { return !disposed && inspect(uid, true); }
  /** @param {MouseEvent} event */
  function onHover(event) {
    const source = sourceAt(event.target);
    if (source && !(event.relatedTarget instanceof Node && source.contains(event.relatedTarget))) inspect(sourceUid(source), false, source);
  }
  /** @param {MouseEvent} event */
  function onLeave(event) {
    const source = sourceAt(event.target);
    if (source && inspection?.source === source && !inspection.pinned
      && !(event.relatedTarget instanceof Node && source.contains(event.relatedTarget))) close();
  }
  /** @param {PointerEvent} event */
  function onPress(event) {
    if (event.button !== 0 || event.isPrimary === false) return;
    const source = sourceAt(event.target);
    if (source) inspect(sourceUid(source), false, source);
  }
  function onRelease() { if (inspection && !inspection.pinned) close(); }
  /** @param {MouseEvent} event */
  function onBarClick(event) {
    const source = sourceAt(event.target);
    // Usable icons reach the view's btPotion action. Disabled icons remain inspectable.
    if (source && !source.dataset.act) { event.stopPropagation(); open(sourceUid(source)); }
  }
  /** @param {KeyboardEvent} event */
  function onKey(event) {
    if (event.isComposing || event.repeat) return;
    if (event.key === 'Escape' && inspection?.pinned) {
      event.preventDefault(); event.stopImmediatePropagation(); close(true); return;
    }
    const source = sourceAt(event.target);
    if (!source || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); source.click();
  }
  /** @param {PointerEvent | MouseEvent} event */
  function onOutside(event) {
    if (!inspection) return;
    if (event.type === 'contextmenu') { event.preventDefault(); close(true); return; }
    if (!(event.target instanceof Node) || !bar?.contains(event.target)) close();
  }
  function leavePage() { close(); unbind(); }
  function onBlur() { close(); }
  function onMode() { if (UI._lastMode !== 'battle') leavePage(); }
  function unbind() {
    observer?.disconnect(); observer = null;
    stage?.removeEventListener('mouseenter', onHover, true);
    stage?.removeEventListener('mouseleave', onLeave, true);
    stage?.removeEventListener('pointerdown', onPress);
    stage?.removeEventListener('click', onBarClick);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('contextmenu', onOutside, true);
    document.removeEventListener('pointerup', onRelease);
    document.removeEventListener('pointercancel', onRelease);
    document.removeEventListener('sdt-overlay-mode', onMode);
    document.removeEventListener('sdt-overlay-close', leavePage);
    window.removeEventListener('blur', onBlur);
    stage = null; bar = null; token = null; presented = [];
  }
  /** @param {BattleElement | null} nextStage @param {BattleSnapshot} snapshot @param {readonly Potion[] | null} [potions] */
  function sync(nextStage, snapshot, potions = snapshot.potionBar) {
    if (disposed) return;
    const nextBar = nextStage?.querySelector(':scope > .bt-potions');
    if (stage !== nextStage || bar !== nextBar || token !== snapshot.battleToken) {
      leavePage();
      if (!nextStage || !(nextBar instanceof HTMLElement)) return;
      stage = nextStage; bar = nextBar; token = snapshot.battleToken;
      stage.addEventListener('mouseenter', onHover, true);
      stage.addEventListener('mouseleave', onLeave, true);
      stage.addEventListener('pointerdown', onPress);
      stage.addEventListener('click', onBarClick);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('contextmenu', onOutside, true);
      document.addEventListener('pointerup', onRelease);
      document.addEventListener('pointercancel', onRelease);
      document.addEventListener('sdt-overlay-mode', onMode);
      document.addEventListener('sdt-overlay-close', leavePage);
      window.addEventListener('blur', onBlur);
      if (typeof MutationObserver !== 'undefined' && UI.el.overlay) {
        observer = new MutationObserver(() => { if (!currentPage()) leavePage(); });
        observer.observe(UI.el.overlay, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'class', 'style'] });
      }
    }
    presented = potions || [];
    if (inspection && (!currentSnapshot()?.potionBar?.some(potion => potion.uid === inspection?.uid)
      || !inspection.source.isConnected || !inspection.panel.isConnected || !bar?.contains(inspection.panel))) close();
  }
  // Only the live inspection may extend the persistent potion region. A matching
  // class or cloned panel never grants a structural-repair exemption.
  /** @param {HTMLElement} parent @param {Node} node */
  function ownsPanel(parent, node) {
    return !!inspection && inspection.panel === node && bar === parent
      && node.parentNode === parent && currentPage();
  }
  return { sync, open, ownsPanel, close: () => close(), dispose() { leavePage(); disposed = true; } };
}
