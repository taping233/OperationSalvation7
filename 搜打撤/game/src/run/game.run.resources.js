import { esc } from '../core/shared.js';
import { Random } from '../core/random.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { showRewardCardFeedback } from '../ui/reward-card-feedback.js';
import { claimResourceReward, resourceRewardAt, nodeActionBinding } from './node-reward-state.js';
import { patchRewardScene, rewardClaimHTML, rewardExitHTML, rewardCardUnitHTML, rewardSceneHTML } from '../ui/reward-scene-view.js';

export function createRunResourceController({
  game, UI, dom, getCards, rich, saveGame, captureRunContext, grantEventCard,
  consumeCurrentCell, setBagReturnHook, bagSlots,
}) {
// 物资格先按通用掉落权重抽稀有度，再在档内均分；两张候选同名去重。
async function openResourcePick(done) {
  const weights = getCards().DROP_WEIGHTS;
  const pool = getCards().all().filter(c => c.type === '资源' && getCards().isRandomObtainable(c));
  const pickOne = (taken) => {
    const avail = pool.filter(c => !(taken && taken.has(c.name)));
    const tiers = Object.entries(weights).map(([rarity, weight]) => ({
      cards: avail.filter(c => c.rarity === rarity),
      weight: weight * (game.mode === 'elite' && rarity !== '古朴' ? 1.2 : 1),
    })).filter(tier => tier.cards.length && tier.weight > 0);
    const total = tiers.reduce((sum, tier) => sum + tier.weight, 0);
    if (!total) return null;
    let roll = Random.random('loot', 'reward') * total;
    let selected = tiers[tiers.length - 1];
    for (const tier of tiers) {
      roll -= tier.weight;
      if (roll <= 0) { selected = tier; break; }
    }
    return selected.cards[Math.floor(Random.random('loot', 'reward') * selected.cards.length)];
  };
  const record = resourceRewardAt(game, () => {
    const first = pickOne(null);
    return [first, first ? pickOne(new Set([first.name])) : null];
  });
  const cards = (record?.cardIds || []).map(id => getCards().all().find(card => card.id === id));
  if (!cards.length) { done(false); return; }
  const current = captureRunContext();
  const key = `${game.layerIdx},${game.trackPos}`;
  game.state = 'modal';
  const sourceBody = UI.el?.ovBody, source = sourceBody?.firstElementChild;
  const overlay = UI.el?.overlay, revision = UI._overlayRevision;
  const mayClear = overlay?.hidden || overlay?.dataset?.uiClosing || overlay?.classList?.contains('closing')
    || source?.matches?.('.flow-transition');
  let saved = await saveRunCheckpoint(saveGame);
  if (!current() || game.state !== 'modal' || UI.el?.ovBody !== sourceBody || UI.el?.overlay !== overlay
    || (sourceBody?.firstElementChild !== source && !(mayClear && !sourceBody?.firstElementChild))
    || (UI._overlayRevision !== revision && !(mayClear && overlay?.hidden && !sourceBody?.firstElementChild
      && UI._overlayRevision === revision + 1))) return false;
  const claimActions = { pick:'resTake', organize:'resBag' };
  let active;
  const take = async i => {
    if (!active()) return;
    const previous = new Set(game.ownedCards);
    if (!claimResourceReward(record, i, id => grantEventCard(getCards().all().find(card => card.id === id), { silent:true }),
      () => game.ownedCards.some(entry => !previous.has(entry) && entry.card?.id === record.cardIds[i]))) return;
    dom.getElementById('cardZoom')?._closeCardZoom?.(true);
    consumeCurrentCell();
    saved = await saveRunCheckpoint(saveGame);
    if (!active()) return false;
    UI.refresh(game);
    UI.log(`[[icon:gem]] 物资格：带走了【<b>${esc(cards[i].name)}</b>】`, 'loot');
    render();
    showRewardCardFeedback(UI.el?.ovBody, [cards[i]], { mode:'page', token:record, sceneSelector:'.resource-reward-scene' });
  };
  const render = () => {
  const finished = record.taken !== null;
  const body = rewardSceneHTML({ className:`reward-v14 resource-reward-scene${finished ? ' no-anim' : ''}`, title:finished ? '物资已领取' : '选择一份物资', source:'物资投放点', count:cards.length,
    cards:cards.map((card, i) => {
      if (!card) return '<p>该物资暂不可用</p>';
      const fits = game.canReceiveCard?.(card) !== false;
      const action = finished ? `<span class="reward-unit-state">${record.taken === i ? '已入背包' : '已永久放弃'}</span>`
        : rewardClaimHTML({ index:i, cardName:card.name, choice:true, fits, actions:claimActions }) + (!fits ? '<span class="reward-capacity-note">当前放不下</span>' : '');
      return rewardCardUnitHTML({card,face:getCards().cardHTML(card),index:i,readAction:'resRead',action,className:finished ? record.taken === i ? 'got' : 'dropped' : ''});
    }).join(''),
    actions:rewardExitHTML('resSkip', finished ? '继续探索' : '返回地图'), footer:`<button class="reward-bag" data-act="resBag" data-card-receive-anchor="bag">整理背包</button>${!saved ? '<button class="reward-bag" data-act="resRetrySave">重试保存</button>' : ''}<span class="reward-notice" role="status">${!saved ? '物资进度尚未保存成功，请重试保存；暂勿刷新页面。' : finished ? '' : '两张资源卡中选择一张，其余永久放弃；未领取时保留在此处'}</span>`,
  });
  const currentBody = UI.el?.ovBody;
  const focused = currentBody?.contains(dom.activeElement) ? dom.activeElement : null;
  if (!currentBody?.querySelector('.resource-reward-scene') || UI.el?.overlay?.hidden
    || !patchRewardScene(currentBody, rich(body))) UI.showOverlay('', body, 'page');
  if (focused && !focused.isConnected) currentBody.querySelector('[data-act="resSkip"]')?.focus({ preventScroll:true });
  const binding = nodeActionBinding(game, UI, 'resSkip');
  active = () => current() && binding() && game.nodeRewards?.[key] === record;
  setBagReturnHook(() => openResourcePick(done));
  UI.act('resRead', data => {
    const i = Number(data.i), card = cards[i];
    if (!active() || !card) return;
    const fits = game.canReceiveCard?.(card) !== false;
    const source = UI.el?.ovBody?.querySelector(`[data-act="resRead"][data-i="${i}"]`);
    UI.showCardZoom(card, { from:source, returnFocus:source, hideNote:true, presentation:'expedition',
      footer:finished ? '' : rewardClaimHTML({ index:i, cardName:card.name, choice:true, fits, zoom:true, actions:claimActions }) });
  });
  UI.act('resTake', data => take(Number(data.i)));
  UI.act('resBag', () => {
    if (!active()) return;
    dom.getElementById('cardZoom')?._closeCardZoom?.(true);
    bagSlots.showBackpack();
  });
  UI.act('resRetrySave', async () => { if (active()) { saved = await saveRunCheckpoint(saveGame); if (active()) render(); } });
  UI.act('resSkip', async () => {
    if (!active()) return;
    saved = await saveRunCheckpoint(saveGame);
    if (!active()) return false;
    if (!saved) { render(); return false; }
    setBagReturnHook(null); UI.hideOverlay(); done(record.taken !== null);
    return true;
  });
  };
  render();
}

  return { openResourcePick };
}
