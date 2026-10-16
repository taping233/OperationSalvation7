import { afterEach, expect, it, vi } from 'vitest';
import { restoreChestReward } from '../game/src/run/chest-reward-save.js';

afterEach(() => { vi.useRealTimers(); delete window.SDT; document.body.innerHTML = ''; });

async function setup() {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  const body = document.getElementById('ovBody'), overlay = document.getElementById('overlay'), actions = {};
  body.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled) actions[button.dataset.act]?.(button.dataset);
  });
  const card = { id:'supply', name:'补给卡', type:'法术', rarity:'古朴', cost:0, desc:'' };
  const draw = vi.fn(() => card);
  window.SDT = {
    UI:{ el:{ overlay, ovBody:body, ovTitle:document.getElementById('ovTitle') },
      showOverlay(title, html) { body.innerHTML = html; overlay.hidden = false; },
      hideOverlay() { overlay.hidden = true; }, act(name, fn) { actions[name] = fn; }, refresh:vi.fn(), log:vi.fn() },
    MAP:{ chestKinds:{ small:{ name:'小型物资箱', cards:1, coins:[2,2] } } },
    Cards:{ RARITIES:['古朴','稀有','史诗','传说'], all:() => [card], randomDropCard:draw,
      pickOfRarity:() => card, classPool:() => [], rarityOf:c => c.rarity, sellPrice:() => 1, cardHTML:c => `<div>${c.name}</div>` },
    Base:{ data:{}, slot:1, save:vi.fn(), petEggDropChance:() => 0, recordPetEggChestResult:vi.fn(), bagCap:() => 10, isSha:() => false },
    Sound:{ sfx:vi.fn() }, Icons:{ rich:html => html },
  };
  const game = { seed:17, layerIdx:0, trackPos:1, state:'idle', ownedCards:[], myClass:'',
    usedSlots:() => 0, bagCap:() => 10, canReceiveCard:() => true,
    grantCard:vi.fn(() => true), gainCoins:vi.fn(), persistSave:vi.fn() };
  await import('../game/src/run/chests.js');
  const chests = window.SDT.Chests;
  const click = act => {
    const button = body.querySelector(`[data-act="${act}"]`);
    expect(button, act).not.toBeNull(); button.click();
  };
  const open = () => { click('chestNext'); click('chestReveal'); };
  const save = () => JSON.parse(JSON.stringify(chests.serialize(game)));
  return { body, game, chests, draw, click, open, save, actions };
}

it('金币可先独立领取，未开箱读档保持原卡牌且金币不重领', async () => {
  const { body, game, chests, draw, click, open, save, actions } = await setup();
  const done = vi.fn();
  chests.open(game, [{ kind:'small' }], done, { onCell:true });
  expect(body.querySelector('.cqo-coins')).not.toBeNull();
  expect(body.querySelector('.cqo-boxes [data-act="chestOverviewCoins"]')).toBeNull();
  const staleClaim = actions.chestOverviewCoins;
  game.canReceiveCard = () => false;
  click('chestOverviewCoins'); staleClaim();
  expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(2);
  expect(game.grantCard).not.toHaveBeenCalled();
  const saved = save();
  expect(saved.current).toMatchObject({ rewardStage:'chest', coinsReceived:true, taken:[] });
  expect(restoreChestReward(game, saved)).not.toBeNull();
  expect(chests.restore(game, saved, done)).toBe(true);
  expect(body.querySelector('[data-act="chestOverviewCoins"]')).toBeNull();
  game.canReceiveCard = () => true;
  open();
  expect(body.querySelector('.cqp-dialog .reward-coin-unit')).toBeNull();
  click('chestTake1'); click('chestFinish');
  expect(game.gainCoins).toHaveBeenCalledTimes(1);
  expect(draw).toHaveBeenCalledTimes(1);
  expect(done).toHaveBeenCalledTimes(1);
});

it('先收卡不顺带领币，所有箱子处理后仍需独立领取金币才能完成', async () => {
  const { body, game, chests, draw, click, open, save } = await setup();
  const done = vi.fn();
  chests.open(game, [{ kind:'small' }, { kind:'small' }], done, { onCell:true });
  expect(draw).toHaveBeenCalledTimes(1);
  open(); click('chestTake1');
  expect(game.gainCoins).not.toHaveBeenCalled();
  expect(body.querySelector('.cqo-progress').textContent).toContain('1箱待领');
  expect(draw).toHaveBeenCalledTimes(1);
  open(); click('chestTake1');
  expect(game.gainCoins).not.toHaveBeenCalled();
  expect(body.querySelectorAll('.cqo-box:disabled')).toHaveLength(2);
  expect(body.querySelector('[data-act="chestNext"]')).toBeNull();
  expect(body.querySelector('[data-act="chestFinish"]')).toBeNull();
  expect(body.querySelector('.cqo-coins').textContent).toContain('×4');
  const saved = save();
  expect(chests.restore(game, saved, done)).toBe(true);
  click('chestOverviewCoins'); click('chestFinish');
  expect(game.gainCoins.mock.calls.flat()).toEqual([2,2]);
  expect(draw).toHaveBeenCalledTimes(2);
  expect(done).toHaveBeenCalledTimes(1);
});

it('领取首批金币后，新开箱的金币独立累加且已领金额不重发', async () => {
  const { body, game, chests, click, open } = await setup();
  chests.open(game, [{ kind:'small' }, { kind:'small' }], vi.fn(), { onCell:true });
  click('chestOverviewCoins');
  open(); click('chestTake1');
  open(); click('chestTake1');
  expect(body.querySelector('.cqo-coins').textContent).toContain('×2');
  click('chestOverviewCoins');
  expect(game.gainCoins.mock.calls.flat()).toEqual([2,2]);
});

it.each(['chestTake', 'chestLeave'])('全拿或确认放弃卡牌不会领取金币：%s', async action => {
  const { game, chests, click } = await setup();
  const card = { id:'a', name:'原奖励', type:'法术', rarity:'古朴' };
  const current = { kind:'small', cards:[card,{ ...card, id:'b', name:'另一奖励' }], coins:3,
    coinsReceived:false, rewardStage:'cards', taken:[], lost:[] };
  const saved = { version:1, seed:17, layerIdx:0, trackPos:1, queue:[{ kind:'small', reward:current }],
    index:1, context:{ onCell:true }, current, screen:'overview' };
  expect(chests.restore(game, saved, vi.fn())).toBe(true);
  click('chestNext');
  if (action === 'chestLeave') click('chestSkip');
  click(action);
  expect(game.gainCoins).not.toHaveBeenCalled();
  click('chestOverviewCoins');
  expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(3);
});
