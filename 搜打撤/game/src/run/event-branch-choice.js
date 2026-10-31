import { esc } from '../core/shared.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { containerRuleOf } from '../core/card-capacity.js';
import { canReplaceBagCard } from '../hub/game.bag.rules.js';
import { recodeSourceSnapshot, recodeSourceMatches } from './event-recode-candidates.js';
import { patchRewardScene, rewardCardUnitHTML, rewardClaimHTML, rewardExitHTML, rewardSceneHTML, restoreRewardActionFocus } from '../ui/reward-scene-view.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from '../ui/overlay-return-state.js';

// 新分支继续使用事件节点的选项记录、骰子和结算；候选确定后不因暂离重抽。
export function createEventBranchChoiceController({
  game, UI, SDT, getCards, eventCommands, nodeEventAt, captureEventContext, captureEventPresentation,
  eventPageBinding, setBagReturnHook, bagSlots, saveGame,
  drawEventCards, finishEventRoll, closeEventFlow, transformCandidates,
}) {
  const ordinary = card => ['古朴', '普通'].includes(card.rarity) && !card.cls;
  const pool = types => getCards().all().filter(card => types.includes(card.type) && getCards().isRandomObtainable(card));
  const stock = (kind, entry) => kind === 'recode' ? transformCandidates(entry.card)
    : pool(['装备']).filter(card => card.rarity === entry.card.rarity && card.id !== entry.card.id && card.name !== entry.card.name);
  const sources = kind => game.ownedCards.filter(entry => !entry.safe && !entry.stored && !entry.pouchOf
    && !entry.card?.hero && !containerRuleOf(entry.card)
    && (kind === 'recode' ? ['武术', '法术', '装备'].includes(entry.card?.type) : entry.card?.type === '装备')
    && stock(kind, entry).length);
  const capacity = (entry, card) => canReplaceBagCard(game, game.ownedCards.indexOf(entry), card, {
    usedSlots:() => game.usedSlots(), bagCap:() => game.bagCap(), baseCap:() => SDT.Base.bagCap(),
  });
  const titleOf = kind => ({ equipment:'受困运输队', arrows:'撤防射击位', purchase:'暗巷赌约', recode:'异常改装台', trade:'转运军需' })[kind];
  let viewSequence = 0, zoomToken = null;
  const presentations = new WeakMap();
  const closeBranchZoom = () => {
    const zoom = document.getElementById('cardZoom');
    const owner = /** @type {HTMLElement} */ (zoom?.querySelector('.cz-foot [data-branch-view]'));
    if (zoomToken !== null && owner?.dataset.branchView === zoomToken)
      /** @type {HTMLElement & {_closeCardZoom?: (immediate?: boolean) => void}} */ (zoom)._closeCardZoom?.(true);
    zoomToken = null;
  };

  async function choose(kind, candidates, source = null) {
    const owner = nodeEventAt(game), current = captureEventContext();
    if (!owner || owner.settled) return false;
    if (!owner.branchPick) owner.branchPick = {
      kind, cardIds:candidates.map(card => card.id), source:source ? recodeSourceSnapshot(source) : null,
    };
    const record = owner.branchPick;
    if (record.kind !== kind) return false;
    let saving = false, presentation = presentations.get(record) || null;
    const render = (notice = '', selectedIndex = null) => {
      if (!current() || nodeEventAt(game) !== owner || owner.settled) return;
      closeBranchZoom();
      const viewToken = String(++viewSequence);
      const cards = record.cardIds.map(id => getCards().all().find(card => card.id === id));
      const price = kind === 'purchase' ? 2 : kind === 'recode' ? 3 : 0;
      const entry = record.source ? game.ownedCards.find(item => item.uid === record.source.uid) : null;
      const sourceValid = !record.source || (recodeSourceMatches(entry, record.source) && sources(kind).includes(entry));
      const fits = card => !record.source ? game.canReceiveCard(card) : !sourceValid || capacity(entry, card);
      const label = record.source ? price ? `支付 ${price} 币更换` : '确认更换' : price ? `支付 ${price} 币购买` : '领取此牌';
      const claimHTML = (index, zoom = false) => {
        const html = rewardClaimHTML({ index, cardName:cards[index].name, choice:true, fits:fits(cards[index]),
          disabled:fits(cards[index]) && (!sourceValid || price > (game.coins || 0)), zoom, label,
          actions:{ pick:'eventBranchPick', organize:'eventBranchPick' } });
        return zoom ? html.replace('data-cancel="false"', `data-cancel="false" data-branch-view="${viewToken}"`) : html;
      };
      const previousBody = UI.el?.ovBody, previousPage = previousBody?.querySelector('.event-branch-reward');
      const focused = /** @type {HTMLElement} */ (previousPage?.contains(document.activeElement) ? document.activeElement.closest('[data-act]') : null);
      if (previousPage) {
        presentation = captureOverlayReturnState(previousPage);
        presentations.set(record, presentation);
      }
      const focus = Number.isInteger(selectedIndex) ? { action:'eventBranchPick', index:String(selectedIndex) }
        : focused ? { action:focused.dataset.act, index:focused.dataset.i } : null;
      game.state = 'modal';
      const html = rewardSceneHTML({ className:'reward-v14 event-branch-reward reward-standalone-picker',
        title:'选择 1 张', source:titleOf(kind), count:cards.length,
        rule:record.source ? `以「${esc(record.source.name)}」换取一张同类型、同稀有度的卡牌${price ? '，确认时支付 3 币' : ''}。原卡在确认前保留。`
          : price ? '这张招式售价 2 币，可以先查看；确认购买时才扣币。' : `从以下 ${cards.length} 张卡中选择 1 张。`,
        cards:cards.map((card, index) => card ? rewardCardUnitHTML({ card, face:getCards().cardHTML(card), index,
          readAction:'eventBranchRead', action:claimHTML(index) + (!fits(card) ? '<span class="reward-capacity-note">当前放不下</span>' : '') })
          : '<p class="reward-notice">该候选暂不可用，选择已保留。</p>').join(''),
        actions:rewardExitHTML('eventExit', '返回地图'),
        footer:`<span class="reward-capacity">[[icon:bag]] ${esc(game.bagCapacityText?.() || `${game.usedSlots()}/${game.bagCap()} 格`)}</span><button type="button" class="reward-bag" data-act="eventBranchBag">整理背包</button><button type="button" class="reward-bag danger" data-act="eventBranchLeave">放弃并离开</button>`,
        warning:`<p class="reward-notice" role="status" aria-live="polite">${esc(notice || (!sourceValid ? '原卡已变化，请放弃本次更换。' : price > (game.coins || 0) ? `需要 ${price} 币，当前货币不足，尚未扣费。` : ''))}</p>`,
      });
      if (!previousPage || UI.el?.overlay?.hidden || !patchRewardScene(previousBody, SDT.Icons.rich(html))) UI.showOverlay('', html, 'page');
      setBagReturnHook(() => render());
      const page = UI.el?.ovBody?.firstElementChild;
      const binding = eventPageBinding('eventExit', current);
      const active = () => binding() && String(viewSequence) === viewToken && nodeEventAt(game) === owner
        && !owner.settled && owner.branchPick === record && (!page || UI.el?.ovBody?.firstElementChild === page);
      const rememberPresentation = (target = null) => {
        presentation = captureOverlayReturnState(page, target);
        presentations.set(record, presentation);
      };
      UI.act('eventBranchRead', data => {
        const index = Number(data.i), card = cards[index];
        if (saving || !active() || !Number.isInteger(index) || !card) return false;
        const source = page?.querySelector(`[data-act="eventBranchRead"][data-i="${index}"]`);
        UI.showCardZoom(card, { from:source, returnFocus:source, hideNote:true, presentation:'expedition', footer:claimHTML(index, true) });
        zoomToken = viewToken;
      });
      UI.act('eventExit', () => { if (!saving && active()) { closeBranchZoom(); rememberPresentation(); return closeEventFlow(); } });
      UI.act('eventBranchBag', () => {
        if (!saving && active()) { closeBranchZoom(); rememberPresentation(); return bagSlots.showBackpack(); }
      });
      UI.act('eventBranchLeave', () => {
        if (!saving && active()) { closeBranchZoom(); return finishEventRoll(() => { game.state = 'idle'; }); }
      });
      const pick = async index => {
        const card = cards[index];
        if (saving || !active() || !card || owner.settled || owner.branchPick !== record) return false;
        if (price > (game.coins || 0)) { render('货币不足，尚未扣费。'); return false; }
        if (record.source && (!recodeSourceMatches(entry, record.source) || !sources(kind).includes(entry)
          || !stock(kind, entry).some(candidate => candidate.id === card.id))) {
          render('原卡或候选条件已变化，尚未更换或扣费。'); return false;
        }
        if (record.source && !capacity(entry, card)) { render('更换后背包放不下，请先整理背包。'); return false; }
        saving = true;
        const completed = await finishEventRoll(() => {
          if (price > (game.coins || 0)) return false;
          if (record.source) {
            if (!capacity(entry, card) || !eventCommands.recode([entry], [card], [record.source], item => stock(kind, { card:item }))) return false;
            game.coins -= price;
          } else {
            if (!game.canReceiveCard(card)) return false;
            game.coins -= price;
            if (!eventCommands.claimCard(card)) { game.coins += price; return false; }
          }
          game.state = 'idle';
          return true;
        });
        saving = false;
        if (!completed) render('本次领取或更换尚未完成，候选与原卡保留。');
        else if (current()) {
          try { UI.showCardReward(card); } catch { /* 资源与卡牌已经结算，不重试发放。 */ }
        }
        return completed;
      };
      UI.act('eventBranchPick', data => {
        const index = Number(data.i), card = cards[index];
        if (saving || !active() || !Number.isInteger(index) || !card || (data.branchView !== undefined && data.branchView !== viewToken)) return false;
        closeBranchZoom();
        if (sourceValid && !fits(card)) {
          rememberPresentation(page?.querySelector(`[data-act="eventBranchPick"][data-i="${index}"]`));
          render('请先腾出背包位置，候选、原卡和货币仍保留。', index);
          bagSlots.showBackpack();
          return;
        }
        return pick(index);
      });
      UI.refresh(game);
      restoreOverlayReturnState(page, presentation, { isCurrent:active });
      if (focus && (!focused?.isConnected || Number.isInteger(selectedIndex))) restoreRewardActionFocus(page, focus,
        { claimActions:['eventBranchPick'], returnActions:['eventExit', 'eventBranchBag'] });
    };
    const ownsPage = captureEventPresentation({ allowClosing:true });
    const saved = await saveRunCheckpoint(saveGame);
    if (current() && ownsPage())
      render(saved ? '' : '候选已保留在当前对局，尚未保存成功；刷新前请先保存。');
    return true;
  }

  function open(kind) {
    const owner = nodeEventAt(game);
    if (!owner || owner.settled) return false;
    if (owner?.branchPick) return choose(kind, []);
    if (kind === 'trade' || kind === 'recode') {
      const eligible = sources(kind), current = captureEventContext();
      if (!eligible.length) { UI.log('没有可交换的随身卡牌，原物资未消耗。', 'warn'); closeEventFlow(); return false; }
      let selected = false, presentation = presentations.get(owner) || null;
      const render = () => {
        if (selected || !current() || nodeEventAt(game) !== owner) return;
        closeBranchZoom();
        const viewToken = String(++viewSequence);
        const previousBody = UI.el?.ovBody, previousPage = previousBody?.querySelector('.event-branch-source');
        const focused = /** @type {HTMLElement} */ (previousPage?.contains(document.activeElement) ? document.activeElement.closest('[data-act]') : null);
        if (previousPage) {
          presentation = captureOverlayReturnState(previousPage);
          presentations.set(owner, presentation);
        }
        const focus = focused ? { action:focused.dataset.act, index:focused.dataset.i } : null;
        const claimHTML = (index, zoom = false) => {
          const html = rewardClaimHTML({ index, cardName:eligible[index].card.name, label:'选择这张', zoom,
            disabled:!sources(kind).includes(eligible[index]), actions:{ take:'eventBranchSource' } });
          return zoom ? html.replace('data-cancel="false"', `data-cancel="false" data-branch-view="${viewToken}"`) : html;
        };
        game.state = 'modal';
        const html = rewardSceneHTML({ className:'reward-v14 event-branch-source reward-standalone-picker',
          title:'选择原卡', source:titleOf(kind), count:eligible.length,
          rule:kind === 'recode' ? '先选一张招式或装备，投骰抽出最多三张同类型、同稀有度的候选。确认更换时支付 3 币。'
            : '选择一件随身装备，换取最多三件同稀有度候选中的一件。安全格、容器与已收纳装备不参与交换。',
          cards:eligible.map((entry, index) => rewardCardUnitHTML({ card:entry.card, face:getCards().cardHTML(entry.card), index,
            readAction:'eventBranchSourceRead', action:claimHTML(index) })).join(''),
          actions:rewardExitHTML('eventExit', '返回地图'),
          footer:'<span class="reward-notice">选择原卡后投骰；原卡与货币在确认更换前保留。</span><button type="button" class="reward-bag danger" data-act="eventBranchCancel">放弃并离开</button>',
        });
        if (!previousPage || UI.el?.overlay?.hidden || !patchRewardScene(previousBody, SDT.Icons.rich(html))) UI.showOverlay('', html, 'page');
        setBagReturnHook(render);
        const page = UI.el?.ovBody?.firstElementChild;
        const binding = eventPageBinding('eventBranchSource', current);
        const active = () => binding() && String(viewSequence) === viewToken && nodeEventAt(game) === owner
          && !owner?.settled && (!page || UI.el?.ovBody?.firstElementChild === page);
        UI.act('eventExit', () => {
          if (!selected && active()) {
            closeBranchZoom();
            presentation = captureOverlayReturnState(page);
            presentations.set(owner, presentation);
            return closeEventFlow();
          }
        });
        UI.act('eventBranchCancel', () => {
          if (!selected && active()) { closeBranchZoom(); return finishEventRoll(() => { game.state = 'idle'; }); }
        });
        UI.act('eventBranchSourceRead', data => {
          const index = Number(data.i), entry = eligible[index];
          if (selected || !active() || !Number.isInteger(index) || !entry) return false;
          const source = page?.querySelector(`[data-act="eventBranchSourceRead"][data-i="${index}"]`);
          UI.showCardZoom(entry.card, { from:source, returnFocus:source, hideNote:true, presentation:'expedition', footer:claimHTML(index, true) });
          zoomToken = viewToken;
        });
        UI.act('eventBranchSource', data => {
          if (selected || !active() || (data.branchView !== undefined && data.branchView !== viewToken)) return false;
          const index = Number(data.i), entry = eligible[index];
          if (!Number.isInteger(index) || !entry || !sources(kind).includes(entry)) return;
          const candidates = stock(kind, entry), count = Math.min(3, new Set(candidates.map(card => card.name)).size);
          if (!count) return;
          closeBranchZoom();
          selected = true;
          owner.branchSource = recodeSourceSnapshot(entry);
          drawEventCards(titleOf(kind), `branch-${kind}:${entry.uid}`, Array(count).fill(candidates), cards => choose(kind, cards, entry));
        });
        UI.refresh(game);
        restoreOverlayReturnState(page, presentation, { isCurrent:active });
        if (focus && !focused?.isConnected) restoreRewardActionFocus(page, focus,
          { claimActions:['eventBranchSource'], returnActions:['eventExit', 'eventBranchCancel'] });
      };
      if (owner.branchSource) {
        const entry = eligible.find(item => recodeSourceMatches(item, owner.branchSource));
        if (!entry) { UI.log('原卡已变化，尚未更换或扣费。', 'warn'); closeEventFlow(); return false; }
        const candidates = stock(kind, entry), count = Math.min(3, new Set(candidates.map(card => card.name)).size);
        return drawEventCards(titleOf(kind), `branch-${kind}:${entry.uid}`, Array(count).fill(candidates), cards => choose(kind, cards, entry));
      }
      return render();
    }
    const candidates = kind === 'arrows' ? pool(['武术','法术','装备']).filter(card => /箭/.test(card.name) && card.rarity !== '职业' && !card.cls)
      : pool(kind === 'equipment' ? ['装备'] : ['武术','法术']).filter(ordinary);
    const count = Math.min(kind === 'arrows' ? 3 : 1, new Set(candidates.map(card => card.name)).size);
    if (!count) { UI.log('暂时没有符合条件的候选，尚未扣费。', 'warn'); closeEventFlow(); return false; }
    return drawEventCards(titleOf(kind), `branch-${kind}`, Array(count).fill(candidates), cards => choose(kind, cards));
  }
  return { open };
}
