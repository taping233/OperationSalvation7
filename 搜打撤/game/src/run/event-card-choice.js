import { esc, escAttr } from '../core/shared.js';
import { eventChoiceRewardAt, nodeActionBinding } from './node-reward-state.js';
import { setBagReturnHook } from '../hub/bag-return-hook.js';
import { bagSlots } from '../hub/game.bag.bridge.js';

const PRESENTATIONS = {
  'ev19-potions': {
    title:'避难市集药摊', asset:'scene-event-potions', paidCoins:0,
    sub:'污染区药师只能保住一瓶——从 3 瓶随机药水中选择 1 瓶。',
  },
  'ev19-quartermaster': {
    title:'装备征用令', asset:'scene-event-quartermaster', paidCoins:3,
    sub:'已支付 3 币。从军需官摆出的 3 件装备中选择 1 件。',
  },
};

// The reward record, paid coins, and received card share the existing run save.
// Only rendering callbacks remain in memory; reopening never draws or pays again.
export function createEventCardChoiceController({
  game, UI, SDT, saveGame, getActiveSlot, nodeShell, grantEventCard, consumeCurrentCell, captureContext, close, openFixedRewardsOnCell,
}) {
  let viewSequence = 0;
  let choiceZoomToken = null;
  const closeChoiceZoom = () => {
    // 引用卡往返会重建特写 DOM；按当前详情动作的归属关闭，不持有旧节点。
    const zoom = document.getElementById('cardZoom');
    const owner = zoom?.querySelector('.cz-foot [data-act="eventCardPick"][data-choice-view]');
    if (choiceZoomToken !== null && owner?.dataset.choiceView === choiceZoomToken) zoom._closeCardZoom?.(true);
    choiceZoomToken = null;
  };
  function render(record, current = captureContext(), notice = '', selectedIndex = null) {
    if (!current()) return false;
    const key = `${game.layerIdx},${game.trackPos}`;
    if (game.nodeRewards?.[key] !== record || record.taken !== null) return false;
    closeChoiceZoom();
    const viewToken = String(++viewSequence);
    const spec = PRESENTATIONS[record.eventId];
    const cards = record.cardIds.map(id => SDT.Cards.all().find(card => card.id === id));
    const capacity = game.bagCapacityText?.() || `${game.usedSlots?.() ?? 0}/${game.bagCap?.() ?? SDT.Base.bagCap()} 格`;
    const noFit = !cards.some(card => card && game.canReceiveCard(card));
    game.state = 'modal';
    setBagReturnHook(() => render(record, current, '', selectedIndex));
    nodeShell({
      tone:'event', asset:spec.asset, icon:'[[icon:cards]]', title:spec.title, sub:spec.sub,
      body:`<div class="bt-hand event-choice-hand">${cards.map((card, i) => card ? `
        <div class="event-choice-option"><button type="button" class="bt-card event-choice-card" data-act="eventCardRead" data-i="${i}" aria-label="放大查看${escAttr(card.name)}" aria-haspopup="dialog">
          ${SDT.Cards.cardHTML(card, 'sm')}
        </button><button type="button" class="ov-btn ok" data-act="eventCardPick" data-i="${i}" aria-label="${card.id !== 'tt2-apollo' && !game.canReceiveCard(card) ? '腾出位置领取' : '领取'}${escAttr(card.name)}">${card.id !== 'tt2-apollo' && !game.canReceiveCard(card) ? '腾位置领取' : '领取此牌'}</button></div>` : '<p class="reward-notice">这张候选卡暂时不可用，奖励已保留。</p>').join('')}</div>
        <p class="loot-footer-note">暂离可保留候选，领取后其余放弃。</p>`,
      foot:`<span class="reward-capacity">[[icon:bag]] ${esc(capacity)}</span>
        <button type="button" class="ov-btn" data-act="eventCardReturn">返回地图</button>
        <button type="button" class="ov-btn" data-act="eventCardBag">整理背包</button>
        <p class="reward-notice" data-event-capacity role="status" aria-live="polite">${esc(notice || (noFit ? '当前候选都放不下，请先整理背包；候选和已支付的货币会保留。' : ''))}</p>`,
    });
    const page = UI.el?.ovBody?.firstElementChild;
    const binding = nodeActionBinding(game, UI, 'eventCardPick');
    const active = () => current() && binding() && game.nodeRewards?.[key] === record && record.taken === null
      && (!page || UI.el?.ovBody?.firstElementChild === page);
    UI.act('eventCardBag', () => { if (active()) { closeChoiceZoom(); bagSlots.showBackpack(); } });
    UI.act('eventCardReturn', () => { if (active()) { closeChoiceZoom(); close(); } });
    UI.act('eventCardRead', data => {
      if (!active()) return false;
      const index = Number(data.i), card = cards[index];
      if (!Number.isInteger(index) || !card) return false;
      UI.showCardZoom(card, { hideNote:true, presentation:'expedition',
        footer:`<button type="button" class="ov-btn ok" data-act="eventCardPick" data-i="${index}" data-choice-view="${viewToken}">${card.id !== 'tt2-apollo' && !game.canReceiveCard(card) ? '腾位置领取' : '领取此牌'}</button>` });
      choiceZoomToken = viewToken;
      return true;
    });
    const choiceCurrent = () => current() && String(viewSequence) === viewToken
      && game.nodeRewards?.[key] === record && record.taken === null;
    const pick = index => {
      if (!choiceCurrent()) return false;
      const card = cards[index];
      if (!Number.isInteger(index) || !card) return false;
      closeChoiceZoom();
      if (card.id === 'tt2-apollo') {
        // 先锁定选择再建立同一份 Run 的待领快照；主卡和附赠都由宝箱逐张承接。
        // 交接失败且未建立待领时只还原此节点，既不发主卡也不重新抽候选。
        if (typeof openFixedRewardsOnCell !== 'function' || typeof SDT.Chests?.restore !== 'function' || typeof SDT.Chests?.serialize !== 'function') {
          render(record, current, '领奖页暂未就绪，主卡与已支付货币均已保留，请稍后重试。');
          return false;
        }
        const visited = game.visited || (game.visited = {});
        const hadVisited = Object.prototype.hasOwnProperty.call(visited, key), previousVisited = visited[key];
        let beforeReward = null;
        try { beforeReward = SDT.Chests.serialize(game); } catch { /* 下方承接结果仍须独立核对。 */ }
        record.taken = index;
        consumeCurrentCell();
        let opened = false;
        try { opened = openFixedRewardsOnCell([card], spec.title) === true; }
        catch { /* 已建立的待领快照仍应保留；没有建立时回到原选择。 */ }
        let pending = null;
        try { pending = SDT.Chests.serialize?.(game); } catch { /* 失效端口不能作为成功凭据。 */ }
        const adopted = pending && pending.seed === game.seed && pending.layerIdx === game.layerIdx
          && pending.trackPos === game.trackPos && pending.current?.cards?.[0]?.id === card.id
          && JSON.stringify(pending) !== JSON.stringify(beforeReward);
        if (opened || adopted) { setBagReturnHook(null); return true; }
        record.taken = null;
        if (game.visited === visited) {
          if (hadVisited) visited[key] = previousVisited;
          else delete visited[key];
        }
        if (current()) render(record, current, '领奖页未能打开，选择与已支付货币已保留，请重试。');
        return false;
      }
      if (!grantEventCard(card)) {
        const message = UI.el?.ovBody?.querySelector('[data-event-capacity]');
        const notice = `「${card.name}」当前放不下，请整理背包后重试；本次候选已保留。`;
        if (message) message.textContent = notice;
        else render(record, current, notice, index);
        return false;
      }
      record.taken = index;
      consumeCurrentCell();
      close();
      return true;
     };
    UI.act('eventCardPick', data => {
      if (!active() || (data.choiceView !== undefined && data.choiceView !== viewToken)) return false;
      const index = Number(data.i), card = cards[index];
      if (!Number.isInteger(index) || !card) return false;
      if (card.id !== 'tt2-apollo' && !game.canReceiveCard(card)) {
        closeChoiceZoom();
        setBagReturnHook(null);
        bagSlots.organizeReward({ card, current:choiceCurrent,
          onReturn:() => { if (choiceCurrent()) render(record, current, '', index); },
          onClaim:() => { if (choiceCurrent()) pick(index); },
          onFullBag:() => { if (choiceCurrent()) {
            render(record, current, '', index); bagSlots.showBackpack();
          } },
        });
        return false;
      }
      return pick(index);
    });
    UI.refresh(game);
    if (Number.isInteger(selectedIndex)) UI.el?.ovBody?.querySelector(`[data-act="eventCardPick"][data-i="${selectedIndex}"]`)?.focus();
    return true;
  }

  function resume() {
    const record = eventChoiceRewardAt(game);
    return record ? render(record) : false;
  }

  function open(eventId, candidates) {
    if (resume()) return true;
    const spec = PRESENTATIONS[eventId];
    const cards = candidates.filter(Boolean);
    if (!spec || !cards.length) {
      UI.log('本次可用卡池为空，尚未领取奖励', 'warn');
      close();
      return false;
    }
    game.nodeRewards ||= {};
    const key = `${game.layerIdx},${game.trackPos}`;
    if (game.nodeRewards[key]?.type === 'event-choice') return false;
    const record = game.nodeRewards[key] = {
      version:1, type:'event-choice', eventId, cardIds:cards.map(card => card.id), paidCoins:spec.paidCoins, taken:null,
    };
    consumeCurrentCell(); // 事件选项已确定；未领取候选仍由上方 resume 入口承接。
    game.state = 'modal';
    const saved = saveGame();
    const notice = saved === false && getActiveSlot()
      ? '候选已留在当前对局，但尚未保存成功。请检查存储状态，刷新前先重试保存。' : '';
    return render(record, captureContext(), notice);
  }

  return { open, resume };
}
