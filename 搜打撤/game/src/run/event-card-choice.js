import { esc } from '../core/shared.js';
import { eventChoiceRewardAt, nodeActionBinding } from './node-reward-state.js';
import { setBagReturnHook } from '../hub/bag-return-hook.js';
import { bagSlots } from '../hub/game.bag.bridge.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { createEventCommands } from './event-commands.js';
import { patchRewardScene, rewardCardUnitHTML, rewardClaimHTML, rewardExitHTML, rewardSceneHTML, restoreRewardActionFocus } from '../ui/reward-scene-view.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from '../ui/overlay-return-state.js';

const PRESENTATIONS = {
  'ev19-potions': {
    title:'应急药品站', asset:'scene-event-potions', paidCoins:0,
    sub:'庇护所的存量有限——从 3 瓶随机药水中选择 1 瓶。',
  },
  'ev19-quartermaster': {
    title:'转运军需', asset:'scene-event-quartermaster', paidCoins:3,
    sub:'已支付 3 币转运费。从货位上的 3 件装备中选择 1 件。',
  },
};

// The reward record, paid coins, and received card share the existing run save.
// Only rendering callbacks remain in memory; reopening never draws or pays again.
export function createEventCardChoiceController({
  game, UI, SDT, saveGame, getActiveSlot, nodeShell, grantEventCard, consumeCurrentCell, captureContext, close, openFixedRewardsOnCell,
}) {
  let viewSequence = 0;
  let choiceZoomToken = null;
  const pendingSaves = new WeakSet();
  const presentationStates = new WeakMap();
  const persist = async () => await saveRunCheckpoint(saveGame);
  const capturePage = () => {
    const body = UI.el?.ovBody, surface = body?.firstElementChild, overlay = UI.el?.overlay, revision = UI._overlayRevision;
    const mayClear = overlay?.hidden || overlay?.dataset?.uiClosing || overlay?.classList?.contains('closing');
    return () => UI.el?.ovBody === body && UI.el?.overlay === overlay
      && (body?.firstElementChild === surface || (mayClear && !body?.firstElementChild))
      && (UI._overlayRevision === revision || (mayClear && overlay?.hidden && !body?.firstElementChild
        && UI._overlayRevision === revision + 1));
  };
  const commands = createEventCommands({ state:game, grantCard:grantEventCard });
  const closeChoiceZoom = () => {
    // 引用卡往返会重建特写 DOM；按当前详情动作的归属关闭，不持有旧节点。
    const zoom = document.getElementById('cardZoom');
    const owner = zoom?.querySelector('.cz-foot [data-act="eventCardPick"][data-choice-view]');
    if (choiceZoomToken !== null && /** @type {HTMLElement} */ (owner)?.dataset.choiceView === choiceZoomToken) /** @type {HTMLElement & {_closeCardZoom?: (immediate?: boolean) => void}} */ (zoom)._closeCardZoom?.(true);
    choiceZoomToken = null;
  };
  function renderSaveRetry(record, current = captureContext()) {
    if (!current()) return false;
    const key = `${game.layerIdx},${game.trackPos}`;
    if (game.nodeRewards?.[key] !== record || !pendingSaves.has(record)) return false;
    closeChoiceZoom();
    const token = ++viewSequence;
    game.state = 'modal';
    nodeShell({ tone:'event', asset:PRESENTATIONS[record.eventId].asset, icon:'[[icon:cards]]', title:'已领取，尚未保存',
      sub:'卡牌已在当前背包中，选择已完成。重试只保存进度，不会再次发牌。',
      body:'<p class="reward-notice" role="status">保存未成功，请在刷新或关闭游戏前重试。</p><button type="button" class="ov-btn ok" data-act="eventCardSaveRetry">重试保存并返回地图</button>' });
    const page = UI.el?.ovBody?.firstElementChild;
    const binding = nodeActionBinding(game, UI, 'eventCardSaveRetry');
    const active = () => current() && token === viewSequence && binding() && game.nodeRewards?.[key] === record
      && (!page || UI.el?.ovBody?.firstElementChild === page);
    setBagReturnHook(() => renderSaveRetry(record, current));
    const retry = async () => {
      if (!active()) return false;
      const saved = await persist();
      if (saved) pendingSaves.delete(record);
      if (!active()) return false;
      if (!saved) return renderSaveRetry(record, current);
      return await close() !== false;
    };
    UI.act('eventCardSaveRetry', retry);
    UI.act('eventExit', retry);
    UI.refresh(game);
    return true;
  }
  function render(record, current = captureContext(), notice = '', selectedIndex = null) {
    if (!current()) return false;
    const key = `${game.layerIdx},${game.trackPos}`;
    if (game.nodeRewards?.[key] !== record || record.taken !== null) return false;
    closeChoiceZoom();
    const viewToken = String(++viewSequence);
    const spec = PRESENTATIONS[record.eventId];
    const cards = record.cardIds.map(id => SDT.Cards.all().find(card => card.id === id));
    const capacity = game.bagCapacityText?.() || `${game.usedSlots?.() ?? 0}/${game.bagCap?.() ?? SDT.Base.bagCap()} 格`;
    const fits = card => card.id === 'tt2-apollo' || game.canReceiveCard(card);
    const noFit = !cards.some(card => card && fits(card));
    const claimActions = { pick:'eventCardPick', organize:'eventCardPick' };
    const claimHTML = (index, zoom = false) => {
      const html = rewardClaimHTML({ index, cardName:cards[index].name, choice:true, fits:fits(cards[index]), zoom, actions:claimActions });
      return zoom ? html.replace('data-cancel="false"', `data-cancel="false" data-choice-view="${viewToken}"`) : html;
    };
    const previousBody = UI.el?.ovBody, previousPage = previousBody?.querySelector('.event-reward-scene');
    const focused = /** @type {HTMLElement} */ (previousPage?.contains(document.activeElement) ? document.activeElement.closest('[data-act]') : null);
    const presentation = previousPage ? captureOverlayReturnState(previousPage) : presentationStates.get(record);
    const focus = Number.isInteger(selectedIndex) ? { action:'eventCardPick', index:String(selectedIndex) }
      : focused ? { action:focused.dataset.act, index:focused.dataset.i } : null;
    game.state = 'modal';
    const html = rewardSceneHTML({ className:'reward-v14 event-reward-scene reward-standalone-picker',
      title:'选择 1 张', source:spec.title, rule:spec.sub, count:cards.length,
      cards:cards.map((card, index) => card ? rewardCardUnitHTML({ card, face:SDT.Cards.cardHTML(card), index, readAction:'eventCardRead',
        action:claimHTML(index) + (!fits(card) ? '<span class="reward-capacity-note">当前放不下</span>' : '') })
        : '<p class="reward-notice">这张候选卡暂时不可用，奖励已保留。</p>').join(''),
      actions:rewardExitHTML('eventCardReturn', '返回地图'),
      footer:`<span class="reward-capacity">[[icon:bag]] ${esc(capacity)}</span>
        <button type="button" class="reward-bag" data-act="eventCardBag">整理背包</button>
        <span class="reward-notice">当前节点可整理后继续选择；前往下一节点后未领候选作废。领取后其余放弃。${record.paidCoins ? '已付转运费不退。' : ''}</span>`,
      warning:`<p class="reward-notice" data-event-capacity role="status" aria-live="polite">${esc(notice || (noFit ? '当前候选都放不下，请先整理背包，返回后可继续选择。' : ''))}</p>`,
    });
    if (!previousPage || UI.el?.overlay?.hidden || !patchRewardScene(previousBody, SDT.Icons.rich(html))) UI.showOverlay('', html, 'page');
    setBagReturnHook(() => render(record, current, '', selectedIndex));
    const page = UI.el?.ovBody?.firstElementChild;
    const binding = nodeActionBinding(game, UI, 'eventCardPick');
    const active = () => current() && binding() && game.nodeRewards?.[key] === record && record.taken === null
      && (!page || UI.el?.ovBody?.firstElementChild === page);
    const rememberPresentation = (target = null) => presentationStates.set(record, captureOverlayReturnState(page, target));
    const returnToMap = () => { if (active()) { closeChoiceZoom(); rememberPresentation(); return close(); } };
    UI.act('eventExit', returnToMap);
    UI.act('eventCardBag', () => { if (active()) { closeChoiceZoom(); rememberPresentation(); bagSlots.showBackpack(); } });
    UI.act('eventCardReturn', returnToMap);
    UI.act('eventCardRead', data => {
      if (!active()) return false;
      const index = Number(data.i), card = cards[index];
      if (!Number.isInteger(index) || !card) return false;
      const source = page?.querySelector(`[data-act="eventCardRead"][data-i="${index}"]`);
      UI.showCardZoom(card, { from:source, returnFocus:source, hideNote:true, presentation:'expedition', footer:claimHTML(index, true) });
      choiceZoomToken = viewToken;
      return true;
    });
    const choiceCurrent = () => current() && String(viewSequence) === viewToken
      && game.nodeRewards?.[key] === record && record.taken === null;
    const pick = async index => {
      if (!choiceCurrent()) return false;
      const ownsPage = capturePage();
      const card = cards[index];
      if (!Number.isInteger(index) || !card) return false;
      closeChoiceZoom();
      if (card.id === 'tt2-apollo') {
        // 先锁定选择再建立同一份 Run 的待领快照；主卡和附赠都由搜刮点逐张承接。
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
      // 先预留选择，核心授予后再演出；日志/展示的同步回调不能重领。
      const granted = commands.claimChoice({ record, key, index, card, current:choiceCurrent });
      if (!granted) {
        const message = UI.el?.ovBody?.querySelector('[data-event-capacity]');
        const notice = `「${card.name}」当前放不下，请整理背包后重试；本次候选已保留。`;
        if (message) message.textContent = notice;
        else render(record, current, notice, index);
        return false;
      }
      consumeCurrentCell();
      const saved = await persist();
      if (!saved) pendingSaves.add(record);
      if (!current() || !ownsPage()) return true;
      if (!saved) renderSaveRetry(record, current);
      else if (await close() === false) return true;
      try { UI.showCardReward(card); }
      catch (error) { console.warn('[event-choice] 卡牌已领取，演出未完成', error); }
      return true;
     };
    UI.act('eventCardPick', data => {
      if (!active() || (data.choiceView !== undefined && data.choiceView !== viewToken)) return false;
      const index = Number(data.i), card = cards[index];
      if (!Number.isInteger(index) || !card) return false;
      if (!fits(card)) {
        closeChoiceZoom();
        rememberPresentation(page?.querySelector(`[data-act="eventCardPick"][data-i="${index}"]`));
        setBagReturnHook(null);
        bagSlots.organizeReward({ card, current:choiceCurrent,
          onReturn:() => choiceCurrent() ? render(record, current, '', index) : false,
          onClaim:() => choiceCurrent() ? pick(index) : false,
          onFullBag:() => {
            if (!choiceCurrent() || !render(record, current, '', index)) return false;
            presentationStates.set(record, captureOverlayReturnState(UI.el?.ovBody?.firstElementChild));
            return bagSlots.showBackpack();
          },
        });
        return false;
      }
      return pick(index);
    });
    UI.refresh(game);
    if (focus && (!focused?.isConnected || Number.isInteger(selectedIndex))) restoreRewardActionFocus(page, focus,
      { claimActions:['eventCardPick'], returnActions:['eventCardReturn', 'eventCardBag'] });
    restoreOverlayReturnState(page, presentation, { isCurrent:active });
    return true;
  }

  function resume() {
    const completed = game.nodeRewards?.[`${game.layerIdx},${game.trackPos}`];
    if (completed && pendingSaves.has(completed)) return renderSaveRetry(completed);
    const record = eventChoiceRewardAt(game);
    return record ? render(record) : false;
  }

  async function open(eventId, candidates) {
    if (resume()) return true;
    const spec = PRESENTATIONS[eventId];
    const cards = candidates.filter(Boolean);
    if (!spec || !cards.length) {
      UI.log('本次可用卡池为空，尚未领取奖励', 'warn');
      await close();
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
    const current = captureContext(), ownsPage = capturePage();
    const saved = await persist();
    if (!current() || !ownsPage()) return false;
    const notice = saved === false && getActiveSlot()
      ? '候选已留在当前对局，但尚未保存成功。请检查存储状态，刷新前先重试保存。' : '';
    return render(record, current, notice);
  }

  return { open, resume };
}
