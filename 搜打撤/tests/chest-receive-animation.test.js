import { afterEach, expect, it, vi } from 'vitest';
const feedback=vi.hoisted(()=>vi.fn());
vi.mock('../game/src/ui/reward-card-feedback.js',()=>({showRewardCardFeedback:feedback}));
afterEach(()=>{vi.useRealTimers();delete window.SDT;document.body.innerHTML='';feedback.mockClear();});
it.each(['all','one'])('%s animates only committed rewards after render and never rejected or repeated claims',async claimMode=>{
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  const overlay = document.getElementById('overlay');
  const ovBody = document.getElementById('ovBody');
  const actions = {};
  ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button) actions[button.dataset.act]?.(button.dataset);
  });
  const card = { id: 'queue-card', name: '队列测试卡', rarity: '古朴', type: '法术', desc: '', cost: 0 };
  const otherCard = { ...card, id:'queue-card-2', name:'队列测试卡二' };
  const done = vi.fn();
  const game = {
    state: 'idle', myClass: '', ownedCards: [],
    usedSlots: () => game.ownedCards.length, bagCap: () => 10, canReceiveCard: () => true,
    grantCard: vi.fn(item => { game.ownedCards.push({ card:item }); return true; }), gainCoins: vi.fn(),
  };
  const UI = {
    el: { overlay, ovBody, ovTitle: document.getElementById('ovTitle') },
    showOverlay(title, html) { this.el.ovTitle.innerHTML = title; ovBody.innerHTML = html; overlay.hidden = false; },
    hideOverlay() { overlay.hidden = true; },
    act(name, fn) { actions[name] = fn; },
    refresh: vi.fn(), log: vi.fn(),
  };
  const dropCard = () => card;
  window.SDT = {
    UI, MAP: { chestKinds: { small: { name:'小宝箱', cards:1, coins:[2, 2] } } },
    Cards: { RARITIES:['古朴','稀有','史诗','传说'], all:() => [card, otherCard], randomDropCard:dropCard,
      pickOfRarity:() => card, classPool:() => [], rarityOf:item => item.rarity,
      sellPrice:() => 1, cardHTML:() => '<div>队列测试卡</div>' },
    Base: { data:{eggPity:0,eggBattles:0}, save:vi.fn(), petEggDropChance:() => 0,
      recordPetEggChestResult:vi.fn(), bagCap:() => 10, isSha:() => false },
    Sound: { sfx:vi.fn() }, Icons: { rich:html => html },
  };
  const { SDT } = await import('../game/src/run/chests.js');

  game.seed=1;game.layerIdx=0;game.trackPos=1;game.discoveredPairs=new Set();
  game.grantCard.mockImplementation(item=>{if(item.id==='queue-card-2')return false;game.ownedCards.push({card:item});return true;});
  const reward={kind:'small',cards:[card,card,otherCard],coins:0,coinsReceived:true,rewardStage:'cards',claimMode,selected:null,taken:[],lost:[]};
  expect(SDT.Chests.restore(game,{version:1,seed:1,layerIdx:0,trackPos:1,queue:[{kind:'small',isClass:claimMode==='one',reward}],index:1,current:reward,context:{onCell:true},screen:'cards'},done)).toBe(true);
  if(claimMode==='all')actions.chestTake();else actions.chestPick({i:0});
  expect(game.ownedCards).toHaveLength(claimMode==='all'?2:1);expect(game.grantCard).toHaveBeenCalledTimes(claimMode==='all'?3:1);
  expect(feedback).toHaveBeenLastCalledWith(ovBody,claimMode==='all'?[card,card]:[card],{token:game});
  if(claimMode==='all'){
    expect(ovBody.textContent).toContain('剩余 1 张待处理');
    expect(ovBody.querySelector('.reward-capacity-note')?.textContent).toBe('暂时无法领取');
    expect(ovBody.querySelector('[data-act="chestTake1"][data-i="2"]')).not.toBeNull();
  }
  feedback.mockClear();actions.chestTake1({i:2});expect(feedback).not.toHaveBeenCalled();
  actions.chestTake1({i:0});expect(feedback).not.toHaveBeenCalled();expect(game.ownedCards).toHaveLength(claimMode==='all'?2:1);
});
