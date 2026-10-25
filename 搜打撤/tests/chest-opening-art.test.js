import { afterEach, expect, it, vi } from 'vitest';
import { createChestFrameSets, safeOpeningHTML } from '../game/src/run/chest-opening-art.js';

afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
  delete window.SDT; document.body.innerHTML = '';
});

it('三档使用各自四关键帧、对应阶段与独立光效，特殊箱沿原动画', () => {
  const sets = createChestFrameSets();
  for (const kind of ['small', 'medium', 'large']) {
    expect(sets[kind].frames).toHaveLength(4);
    expect(sets[kind].frames.every(url => url.includes(`/supply-opening-v6/${kind}/`))).toBe(true);
    expect(sets[kind].effects).toHaveLength(4);
    expect(sets[kind].effects.every(url => url.includes('/supply-opening-v6/fx/'))).toBe(true);
    expect(sets[kind].phases).toEqual(['charging', 'opening', 'burst', 'settle']);
    expect(sets[kind].durationsMs.slice(1)).toEqual([160, 140, 700]);
  }
  expect(new Set(['small', 'medium', 'large'].map(kind => sets[kind].frames[0])).size).toBe(3);
  for (const kind of ['class', 'boss']) {
    expect(sets[kind].frames).toHaveLength(11);
    expect(sets[kind].frames.every(url => url.includes('/safe-simple-v7/'))).toBe(true);
  }
  sets.small.frames[0] = 'changed';
  expect(createChestFrameSets().small.frames[0]).not.toBe('changed');
});

it('新光效使用单层帧图，避免再叠旧背景光；旧箱保持原双层结构', () => {
  const set = createChestFrameSets().small;
  document.body.innerHTML = safeOpeningHTML({ kind:'small', src:set.frames[0], animated:true,
    effect:set.effects[0], effectFrames:true });
  expect(document.querySelector('.safe-opening').dataset.chestFx).toBe('frames');
  expect(document.querySelector('.safe-glow')).toBeNull();
  expect(document.querySelector('.safe-burst').getAttribute('src')).toBe(set.effects[0]);
  document.body.innerHTML = safeOpeningHTML({ kind:'boss', src:'legacy', animated:true });
  expect(document.querySelector('.safe-glow')).not.toBeNull();
  expect(document.querySelector('.safe-opening').hasAttribute('data-chest-fx')).toBe(false);
});

async function setup(kind = 'small') {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card chest"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  const body = document.getElementById('ovBody'), overlay = document.getElementById('overlay'), actions = {};
  const card = { id:'animation-card', name:'动画奖励', type:'法术', rarity:'古朴', cost:0, desc:'' };
  const game = { seed:17, layerIdx:0, trackPos:1, state:'idle', myClass:'', ownedCards:[],
    usedSlots:() => 0, bagCap:() => 16, canReceiveCard:() => true,
    grantCard:vi.fn(() => true), gainCoins:vi.fn(), persistSave:vi.fn() };
  const sfx = vi.fn();
  window.SDT = {
    UI:{ el:{ overlay, ovBody:body, ovTitle:document.getElementById('ovTitle') },
      showOverlay(title, html) { body.innerHTML = html; overlay.hidden = false; },
      hideOverlay() { overlay.hidden = true; }, act(name, fn) { actions[name] = fn; }, refresh() {}, log() {} },
    MAP:{ chestKinds:{ [kind]:{ name:'测试箱', cards:1, coins:[1,1] } } },
    Cards:{ RARITIES:['古朴','稀有','史诗','传说'], all:() => [card], randomDropCard:() => card,
      pickOfRarity:() => card, classPool:() => [], rarityOf:c => c.rarity,
      sellPrice:() => 1, cardHTML:c => `<span>${c.name}</span>` },
    Base:{ data:{}, slot:1, petEggDropChance:() => 0, recordPetEggChestResult() {}, bagCap:() => 16, isSha:() => false },
    Sound:{ sfx }, Icons:{ rich:html => html },
  };
  await import('../game/src/run/chests.js');
  const chests = window.SDT.Chests;
  chests.open(game, [{ kind }], vi.fn(), { onCell:true });
  return { body, game, actions, sfx };
}

it.each(['small', 'medium', 'large', 'class', 'boss'])('opens %s directly as cards without chest animation or automatic grants', async kind => {
  const { body, game, actions, sfx } = await setup(kind);
  expect(body.querySelector('[data-eps-search]')).toBeNull();
  expect(body.querySelector('.reward-v14 .reward-card')).not.toBeNull();
  expect(actions.chestReveal).toBeUndefined();
  expect(window.SDT.Chests.serialize(game).current.rewardStage).toBe('cards');
  expect(game.grantCard).not.toHaveBeenCalled();
  expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(1);
  vi.advanceTimersByTime(5000);
  expect(sfx.mock.calls.some(([name]) => ['chestShake','chestBurst'].includes(name))).toBe(false);
  expect(game.grantCard).not.toHaveBeenCalled();
});

it('does not wait for chest artwork decoding before showing rewards', async () => {
  const decode = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal('Image', class { decode = decode; });
  const { body, game, actions } = await setup();
  expect(decode).not.toHaveBeenCalled();
  expect(body.querySelector('[data-act="chestTake1"]')).not.toBeNull();
  await actions.chestReturn();
  expect(document.getElementById('overlay').hidden).toBe(true);
  vi.advanceTimersByTime(5000);
  expect(document.getElementById('overlay').hidden).toBe(true);
  expect(game.grantCard).not.toHaveBeenCalled();
});

it.each(['chest','opening'])('resumes legacy %s saves as cards without redrawing rewards', async stage => {
  const { body, game } = await setup();
  const saved = window.SDT.Chests.serialize(game);
  const cards = saved.current.cards;
  saved.current.rewardStage = stage;
  saved.queue[0].reward = saved.current;
  const draw = vi.spyOn(window.SDT.Cards, 'randomDropCard');
  expect(window.SDT.Chests.restore(game, saved, vi.fn())).toBe(true);
  expect(body.querySelector('[data-eps-search]')).toBeNull();
  expect(window.SDT.Chests.serialize(game).current.cards).toEqual(cards);
  expect(window.SDT.Chests.serialize(game).current.rewardStage).toBe('cards');
  expect(draw).not.toHaveBeenCalled();
  expect(game.gainCoins).toHaveBeenCalledTimes(1);
});
