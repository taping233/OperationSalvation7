import { esc, escAttr } from '../core/shared.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { containerRuleOf } from '../core/card-capacity.js';
import { canReplaceBagCard } from '../hub/game.bag.rules.js';
import { recodeSourceSnapshot, recodeSourceMatches } from './event-recode-candidates.js';
import { EVENT_SCENE_META } from './game.run.data.js';

// 新分支继续使用事件节点的选项记录、骰子和结算；候选确定后不因暂离重抽。
export function createEventBranchChoiceController({
  game, UI, SDT, getCards, eventCommands, nodeEventAt, captureEventContext, captureEventPresentation,
  eventPageBinding, eventNodeShell, setBagReturnHook, bagSlots, saveGame,
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
  const assetOf = () => EVENT_SCENE_META[nodeEventAt(game)?.eventId]?.[2];

  async function choose(kind, candidates, source = null) {
    const owner = nodeEventAt(game), current = captureEventContext();
    if (!owner || owner.settled) return false;
    if (!owner.branchPick) owner.branchPick = {
      kind, cardIds:candidates.map(card => card.id), source:source ? recodeSourceSnapshot(source) : null,
    };
    const record = owner.branchPick;
    if (record.kind !== kind) return false;
    let saving = false;
    const render = (notice = '') => {
      if (!current() || nodeEventAt(game) !== owner || owner.settled) return;
      const cards = record.cardIds.map(id => getCards().all().find(card => card.id === id));
      const price = kind === 'purchase' ? 2 : kind === 'recode' ? 3 : 0;
      const entry = record.source ? game.ownedCards.find(item => item.uid === record.source.uid) : null;
      game.state = 'modal';
      setBagReturnHook(() => render());
      eventNodeShell({ tone:'event', asset:assetOf(), icon:'[[icon:cards]]', title:titleOf(kind),
        sub:record.source ? `以「${esc(record.source.name)}」换取一张同类型、同稀有度的卡牌${price ? '，确认时支付 3 币' : ''}。原卡在确认前保留。`
          : price ? '这张招式售价 2 币，可以先查看；确认购买时才扣币。' : `从以下 ${cards.length} 张卡中选择 1 张。`,
        body:`<div class="bt-hand event-choice-hand">${cards.map((card, index) => card ? `<div class="event-choice-option"><button type="button" class="bt-card event-choice-card" data-act="eventBranchRead" data-i="${index}" aria-label="查看${escAttr(card.name)}详情">${getCards().cardHTML(card, 'sm')}</button><button type="button" class="ov-btn ok" data-act="eventBranchPick" data-i="${index}" ${price > (game.coins || 0) ? 'disabled' : ''}>${record.source ? '确认更换' : price ? '支付 2 币购买' : '领取此牌'}</button></div>` : '<p>该候选暂不可用。</p>').join('')}</div>`,
        foot:`<button type="button" class="ov-btn" data-act="eventBranchLeave">放弃并离开</button><button type="button" class="ov-btn" data-act="eventBranchBag">整理背包</button><p class="reward-notice" role="status">${esc(notice || (record.source && !recodeSourceMatches(entry, record.source) ? '原卡已变化，请放弃本次更换。' : ''))}</p>`,
      });
      const active = eventPageBinding('eventBranchPick', current);
      UI.act('eventBranchRead', data => {
        if (!saving && active() && cards[Number(data.i)]) UI.showCardZoom(cards[Number(data.i)]);
      });
      UI.act('eventBranchBag', () => { if (!saving && active()) bagSlots.showBackpack(); });
      UI.act('eventBranchLeave', () => {
        if (!saving && active()) finishEventRoll(() => { game.state = 'idle'; });
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
        if (saving || !active() || !card) return;
        if (!record.source && !game.canReceiveCard(card)) {
          render('请先腾出背包位置，候选和货币仍保留。');
          bagSlots.showBackpack();
          return;
        }
        return pick(index);
      });
      UI.refresh(game);
    };
    const ownsPage = captureEventPresentation({ allowClosing:true });
    const saved = await saveRunCheckpoint(saveGame);
    if (current() && ownsPage())
      render(saved ? '' : '候选已保留在当前对局，尚未保存成功；刷新前请先保存。');
    return true;
  }

  function open(kind) {
    const owner = nodeEventAt(game);
    if (owner?.branchPick) return choose(kind, []);
    if (kind === 'trade' || kind === 'recode') {
      const eligible = sources(kind), current = captureEventContext();
      if (!eligible.length) { UI.log('没有可交换的随身卡牌，原物资未消耗。', 'warn'); closeEventFlow(); return false; }
      let selected = false;
      const render = () => {
        if (selected || !current() || nodeEventAt(game) !== owner) return;
        game.state = 'modal';
        setBagReturnHook(render);
        eventNodeShell({ tone:'event', asset:assetOf(), icon:'[[icon:recycle]]', title:titleOf(kind),
          sub:kind === 'recode' ? '先选一张招式或装备，投骰抽出最多三张同类型、同稀有度的候选。确认更换时支付 3 币。'
            : '选择一件随身装备，换取最多三件同稀有度候选中的一件。安全格、容器与已收纳装备不参与交换。',
          body:`<div class="bt-hand event-choice-hand">${eligible.map((entry, index) => `<button type="button" class="bt-card event-choice-card" data-act="eventBranchSource" data-i="${index}" aria-label="选择${escAttr(entry.card.name)}">${getCards().cardHTML(entry.card, 'sm')}</button>`).join('')}</div>`,
          foot:'<button type="button" class="ov-btn" data-act="eventBranchCancel">放弃并离开</button>',
        });
        const active = eventPageBinding('eventBranchSource', current);
        UI.act('eventBranchCancel', () => { if (!selected && active()) finishEventRoll(() => { game.state = 'idle'; }); });
        UI.act('eventBranchSource', data => {
          if (selected || !active()) return;
          const entry = eligible[Number(data.i)];
          if (!entry || !sources(kind).includes(entry)) return;
          const candidates = stock(kind, entry), count = Math.min(3, new Set(candidates.map(card => card.name)).size);
          if (!count) return;
          selected = true;
          owner.branchSource = recodeSourceSnapshot(entry);
          drawEventCards(titleOf(kind), `branch-${kind}:${entry.uid}`, Array(count).fill(candidates), cards => choose(kind, cards, entry));
        });
        UI.refresh(game);
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
