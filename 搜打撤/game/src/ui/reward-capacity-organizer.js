import { esc } from '../core/shared.js';

// Organization actions commit independently. The reward is granted only by its owner.
export function openRewardCapacityOrganizer({ UI, card, readStacks, canReceive, capacity,
  moveToSafe, discardOne, current, onReturn, onClaim, onFullBag, safeAvailability = () => ({ok:true,reason:''}) }) {
  let receipt = '', pending = null, revision = 0;
  UI.showOverlay('腾出位置', '<section class="reward-capacity-organizer"></section>', 'chest');
  const root = UI.el.ovBody.querySelector('.reward-capacity-organizer');
  const live = () => current() && root.isConnected && UI.el.ovBody.contains(root)
    && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
  function render() {
    const version = ++revision, stacks = readStacks(), fits = canReceive();
    const safeStates = stacks.map(safeAvailability);
    const canStore = safeStates.some(state => state.ok);
    root.innerHTML = `<header><h3>待领取：${esc(card.name)}</h3><p>${esc(capacity())}</p></header>
      <p>整理操作立即生效，返回奖励不会撤销。</p>
      <p class="reward-organizer-receipt" role="status">${esc(receipt || (fits ? '已有位置，可以领取' : canStore ? '先移入安全格，或丢弃不需要的卡牌' : '安全格暂放不下这些整叠；可打开完整背包整理，或丢弃不需要的卡牌'))}</p>
      <div class="reward-organizer-list">${stacks.map((stack, i) => `<article>
        <strong>${esc(stack.card.name)} ×${stack.count}</strong>
        <div>${pending === stack.uids[0]
          ? `<span>丢弃 1 张，无法取回</span><button type="button" data-organize="confirm" data-index="${i}">确认丢弃</button><button type="button" data-organize="keep">保留</button>`
          : `<button type="button" data-organize="safe" data-index="${i}"${safeStates[i].ok ? '' : ' disabled'} title="${esc(safeStates[i].reason)}">移入安全格</button>${safeStates[i].ok ? '' : `<small class="reward-safe-reason">${esc(safeStates[i].reason)}</small>`}<button type="button" data-organize="discard" data-index="${i}">丢弃1张</button>`}</div>
      </article>`).join('') || '<p>没有可直接腾位的卡牌，可打开完整背包整理道具。</p>'}</div>
      <footer><button type="button" data-organize="return" data-cancel="true">返回奖励</button>
      <button type="button" data-organize="bag">完整背包</button>
      <button type="button" class="ok" data-organize="claim"${fits ? '' : ' disabled'}>${fits ? '收下此牌' : '还需腾出位置'}</button></footer>`;
    root.querySelectorAll('[data-organize]').forEach(button => button.addEventListener('click', () => {
      if (!live() || revision !== version || !root.contains(button) || button.disabled) return;
      const action = button.dataset.organize;
      if (action === 'return' || action === 'bag' || action === 'claim') {
        if (action === 'claim' && !canReceive()) { receipt = '空间已变化，请继续整理'; render(); return; }
        revision++;
        ({ return:onReturn, bag:onFullBag, claim:onClaim })[action](); return;
      }
      if (action === 'keep') { pending = null; render(); return; }
      const stack = stacks[Number(button.dataset.index)];
      const fresh = readStacks().find(item => item.uids[0] === stack?.uids[0]);
      if (!fresh) { pending = null; receipt = '背包已变化'; render(); return; }
      if (action === 'discard') { pending = fresh.uids[0]; render(); return; }
      if (action === 'confirm' && pending !== fresh.uids[0]) return;
      if (action === 'safe' && !safeAvailability(fresh).ok) { receipt = safeAvailability(fresh).reason; render(); return; }
      const success = action === 'safe' ? moveToSafe(fresh) : discardOne(fresh);
      receipt = success
        ? `${action === 'safe' ? '已移入安全格' : '已丢弃'}：${fresh.card.name} ×${action === 'safe' ? fresh.count : 1}${canReceive() ? '' : '；还需腾出位置'}`
        : action === 'safe' ? '安全格放不下，背包未改变' : '未能丢弃，请重新选择';
      pending = null; render();
    }));
  }
  render();
  root.querySelector('[data-organize="return"]')?.focus();
  return root;
}
