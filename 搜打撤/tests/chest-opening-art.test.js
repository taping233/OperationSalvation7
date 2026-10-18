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
  chests.open(game, [{ kind }], vi.fn(), { onCell:true }); actions.chestNext();
  return { body, game, actions, sfx };
}

it.each(['small', 'medium', 'large'])('实际%s开箱立即解锁→爆光→余辉切帧，不提前领取卡牌', async kind => {
  const { body, game, sfx } = await setup(kind);
  const surface = body.querySelector('[data-eps-search]');
  const check = (frame, phase) => {
    expect(surface.dataset.chestPhase).toBe(phase);
    expect(surface.querySelector('.ps-chest').src).toContain(`/supply-opening-v6/${kind}/frame-0${frame}.webp`);
    expect(surface.querySelector('.safe-burst').src).toContain(`/supply-opening-v6/fx/frame-0${frame}.webp`);
  };
  check(1, 'opening'); // Starts immediately: no initial 780ms hold.
  vi.advanceTimersByTime(160); check(2, 'burst');
  expect(sfx.mock.calls.filter(([name]) => name === 'chestBurst')).toHaveLength(1);
  vi.advanceTimersByTime(140); check(3, 'settle');
  vi.advanceTimersByTime(699); expect(body.querySelector('[data-eps-search]')).toBe(surface);
  vi.advanceTimersByTime(1); expect(body.querySelector('.reward-v14')).not.toBeNull();
  expect(game.grantCard).not.toHaveBeenCalled(); expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(1);
  vi.advanceTimersByTime(3000);
  expect(sfx.mock.calls.filter(([name]) => name === 'chestBurst')).toHaveLength(1);
});

it('点击跳过后旧计时器不重播、不提前领取卡牌', async () => {
  const { body, game, actions } = await setup();
  actions.chestReveal();
  expect(body.querySelector('.reward-v14')).not.toBeNull();
  vi.advanceTimersByTime(5000);
  expect(body.querySelector('[data-eps-search]')).toBeNull();
  expect(game.grantCard).not.toHaveBeenCalled(); expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(1);
});

it('开箱中返回总览立即取消后续帧，避免覆盖总览', async () => {
  const { body, actions } = await setup();
  vi.advanceTimersByTime(780); actions.chestClosePicker();
  expect(body.querySelector('.cqo-overview')).not.toBeNull();
  vi.advanceTimersByTime(3000);
  expect(body.querySelector('.cqp-dialog')).toBeNull();
});

it('减少动态时不播放逐帧，仍进入原奖励', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches:true }));
  const { body, game } = await setup();
  expect(body.querySelector('.reward-v14')).not.toBeNull();
  expect(game.grantCard).not.toHaveBeenCalled(); expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(1);
});

it('解码未完成仍可立即跳过，旧解码回调不重播/重复收币或发卡',async()=>{
  const complete=[];
  vi.stubGlobal('Image',class {decode(){return new Promise(resolve=>complete.push(resolve));}});
  const {body,game,actions,sfx}=await setup();
  expect(body.querySelector('[data-eps-search]')).not.toBeNull();
  actions.chestReveal();
  expect(body.querySelector('.reward-v14')).not.toBeNull();
  const content=body.innerHTML;
  complete.forEach(resolve=>resolve());await Promise.resolve();await Promise.resolve();
  expect(body.innerHTML).toBe(content);expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(1);
  expect(game.grantCard).not.toHaveBeenCalled();expect(sfx.mock.calls.filter(([name])=>name==='chestBurst')).toHaveLength(0);
});
