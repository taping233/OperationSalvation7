import { esc, escAttr } from '../core/shared.js';
import { rewardReturnHTML } from './reward-scene-view.js';
import { registerScreenOwner } from './screen-owner.js';
import { setBagReturnHook } from '../hub/bag-return-hook.js';
import { syncViewChildren } from './view-children-sync.js';

// Organization actions commit independently. The reward is granted only by its owner.
export function openRewardCapacityOrganizer({ UI, card, readStacks, canReceive, capacity,
  moveToSafe, discardOne, current, onReturn, onClaim, onFullBag, safeAvailability = (/** @type {{card: import("../hub/game.store.types.js").CardSnapshot, count: number, uids?: string[]}} */ _stack) => { void _stack; return {ok:true,reason:''}; } }) {
  let receipt = '', pending = null, revision = 0, busy = false, submitted = false;
  /** @type {HTMLElement} */
  let root;
  let releaseOwner = () => {};
  const live = () => current() && root.isConnected && UI.el.ovBody.contains(root)
    && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
  function perform(command, { focus, success, failure, leave = false }) {
    if (!live() || busy || submitted) return false;
    const buttons = [.../** @type {NodeListOf<HTMLButtonElement>} */ (root.querySelectorAll('[data-organize]'))]
      .map(button => ({ button, disabled:button.disabled }));
    const previousBusy = root.getAttribute('aria-busy');
    busy = true;
    root.setAttribute('aria-busy', 'true');
    buttons.forEach(({button}) => { button.disabled = true; });
    const complete = result => {
      busy = false;
      if (previousBusy == null) root.removeAttribute('aria-busy'); else root.setAttribute('aria-busy', previousBusy);
      buttons.forEach(({button,disabled}) => { button.disabled = disabled; });
      if (!live()) { releaseOwner(); return result !== false; }
      if (result === false) {
        receipt = failure;
        render(focus);
        return false;
      }
      if (leave) {
        submitted = true;
        revision++;
        buttons.forEach(({button}) => { button.disabled = true; });
        return true;
      }
      pending = null;
      receipt = success();
      render(focus);
      return true;
    };
    let result;
    try { result = command(); } catch { return complete(false); }
    return result && typeof result.then === 'function' ? Promise.resolve(result).then(complete, () => complete(false)) : complete(result);
  }
  function render(focus = null) {
    const previousList = /** @type {HTMLElement} */ (root.querySelector('.reward-organizer-list'));
    const scrollTop = previousList?.scrollTop || 0, scrollLeft = previousList?.scrollLeft || 0;
    const version = ++revision, stacks = readStacks(), fits = canReceive();
    const safeStates = stacks.map(safeAvailability);
    const canStore = safeStates.some(state => state.ok);
    const template = root.ownerDocument.createElement('template');
    template.innerHTML = `<header><h3>待领取：${esc(card.name)}</h3><p>${esc(capacity())}</p></header>
      <p>整理操作立即生效，返回奖励不会撤销。</p>
      <p class="reward-organizer-receipt" role="status">${esc(receipt || (fits ? '已有位置，可以领取' : canStore ? '先移入安全格，或丢弃不需要的卡牌' : '安全格暂放不下这些整叠；可打开完整背包整理，或丢弃不需要的卡牌'))}</p>
      <div class="reward-organizer-list">${stacks.map((stack, i) => `<article data-view-key="${escAttr(JSON.stringify([stack.card.id || stack.card.name, stack.card.variantKey || '', stack.uids[0]]))}">
        <strong>${esc(stack.card.name)} ×${stack.count}</strong>
        <div>${pending === stack.uids[0]
          ? `<span>丢弃 1 张，无法取回</span><button type="button" data-organize="keep">保留</button><button type="button" data-organize="confirm" data-index="${i}">确认丢弃</button>`
          : `<button type="button" data-organize="safe" data-index="${i}"${safeStates[i].ok ? '' : ' disabled'} title="${esc(safeStates[i].reason)}">移入安全格</button>${safeStates[i].ok ? '' : `<small class="reward-safe-reason">${esc(safeStates[i].reason)}</small>`}<button type="button" data-organize="discard" data-index="${i}">丢弃1张</button>`}</div>
      </article>`).join('') || '<p>没有可直接腾位的卡牌，可打开完整背包整理道具。</p>'}</div>
      <footer>${rewardReturnHTML({ action:"return", organize:true })}
      <button type="button" data-organize="bag">完整背包</button>
      <button type="button" class="ok" data-organize="claim"${fits ? '' : ' disabled'}>${fits ? '收下此牌' : '还需腾出位置'}</button></footer>`;
    syncViewChildren(root, template.content);
    const list = /** @type {HTMLElement} */ (root.querySelector('.reward-organizer-list'));
    list.scrollTop = scrollTop; list.scrollLeft = scrollLeft;
    root.onclick = event => {
      const button = /** @type {HTMLButtonElement} */ (/** @type {Element} */ (event.target)?.closest('[data-organize]'));
      if (!button) return;
      if (!live() || busy || submitted || revision !== version || !root.contains(button) || button.disabled) return;
      const action = button.dataset.organize;
      if (action === 'return' || action === 'bag' || action === 'claim') {
        if (action === 'claim' && !canReceive()) { receipt = '空间已变化，请继续整理'; render({ action:'return' }); return; }
        return perform(() => ({ return:onReturn, bag:onFullBag, claim:onClaim })[action](), {
          focus:{ action }, leave:true, success:() => '',
          failure:action === 'claim' ? '尚未领取，请重试' : action === 'bag' ? '尚未打开背包，请重试' : '尚未返回奖励，请重试',
        });
      }
      if (action === 'keep') {
        const uid = pending, index = stacks.findIndex(stack => stack.uids[0] === uid);
        pending = null; render({ action:'discard', uid, index }); return;
      }
      const stack = stacks[Number(button.dataset.index)];
      const fresh = readStacks().find(item => item.uids[0] === stack?.uids[0]);
      const returnFocus = { action:action === 'safe' ? 'safe' : action === 'confirm' ? 'confirm' : 'discard', uid:fresh?.uids[0], index:Number(button.dataset.index) };
      if (!fresh) { pending = null; receipt = '背包已变化'; render(returnFocus); return; }
      if (action === 'discard') { pending = fresh.uids[0]; render({ action:'keep' }); return; }
      if (action === 'confirm' && pending !== fresh.uids[0]) return;
      if (action === 'safe' && !safeAvailability(fresh).ok) { receipt = safeAvailability(fresh).reason; render(returnFocus); return; }
      return perform(() => action === 'safe' ? moveToSafe(fresh) : discardOne(fresh), {
        focus:returnFocus,
        success:() => `${action === 'safe' ? '已移入安全格' : '已丢弃'}：${fresh.card.name} ×${action === 'safe' ? fresh.count : 1}${canReceive() ? '' : '；还需腾出位置'}`,
        failure:action === 'safe' ? '未能移入安全格，请重试' : '未能丢弃，请重试',
      });
    };
    // Rebuilding a row removes its focused button. Continue the same decision,
    // preferring the same stack, then its neighbour; never auto-confirm or leave.
    if (focus) {
      let target;
      if (['keep', 'return', 'bag', 'claim'].includes(focus.action)) {
        target = root.querySelector(`[data-organize="${focus.action}"]:not(:disabled)`);
      } else if (stacks.length) {
        const same = stacks.findIndex(stack => stack.uids[0] === focus.uid);
        const index = same >= 0 ? same : Math.max(0, Math.min(focus.index, stacks.length - 1));
        target = root.querySelector(`[data-organize="${focus.action}"][data-index="${index}"]:not(:disabled)`)
          || root.querySelector(`[data-organize="discard"][data-index="${index}"]`);
      }
      (target || /** @type {HTMLElement} */ (root.querySelector('[data-organize="return"]')))?.focus({ preventScroll:true });
    }
  }
  function mount() {
    releaseOwner();
    UI.showOverlay('腾出位置', '<section class="reward-capacity-organizer"></section>', 'chest');
    root = /** @type {HTMLElement} */ (UI.el.ovBody.querySelector('.reward-capacity-organizer'));
    releaseOwner = registerScreenOwner({ root, priority:30, isCurrent:live,
      onBack:() => { if (!busy && !submitted) /** @type {HTMLButtonElement} */ (root.querySelector('[data-organize="return"]'))?.click(); },
    });
    render();
    // Keep the business closure across a menu pause; the public owner restores
    // presentation position after this fresh root has been mounted.
    setBagReturnHook(() => {
      if (!current() || busy || submitted) return false;
      mount();
      return true;
    });
  }
  mount();
  /** @type {HTMLElement} */ (root.querySelector('[data-organize="return"]'))?.focus({ preventScroll:true });
  return root;
}
