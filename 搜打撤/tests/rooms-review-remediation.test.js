// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initRewardInteraction } from '../game/src/ui/reward-interaction.js';
import { fireRestDecisionHTML, initFireRestPreview } from '../game/src/ui/fire-rest-view.js';
import { renderExpeditionPanel } from '../game/src/run/expedition.view.js';
import { createShopCommands } from '../game/src/run/shop-commands.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
describe('review room input and state boundaries', () => {
  it('blocks carried pointer and held Enter while allowing navigation and inspection', () => {
    vi.spyOn(performance,'now').mockReturnValue(100);
    const root = document.createElement('section'); document.body.append(root);
    root.innerHTML = [0,1].map(i => `<article class="reward-unit"><button class="reward-card" data-i="${i}">查看</button><button class="reward-claim" data-i="${i}">领取</button></article>`).join('');
    const submit=vi.fn(), inspect=vi.fn(); root.addEventListener('click',event=>{ if(event.target.matches('.reward-claim'))submit();else inspect(); });
    initRewardInteraction(root);
    const claim = root.querySelector('.reward-claim'), card = root.querySelector('.reward-card');
    claim.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,cancelable:true}));
    expect(submit).not.toHaveBeenCalled();
    card.click(); expect(inspect).toHaveBeenCalledOnce();
    claim.focus(); claim.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
    expect(document.activeElement.dataset.i).toBe('1');
    const repeated = new KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true});
    document.activeElement.dispatchEvent(repeated); expect(repeated.defaultPrevented).toBe(true);
    vi.mocked(performance.now).mockReturnValue(500);
    claim.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,cancelable:true}));
    expect(submit).toHaveBeenCalledOnce();
    initRewardInteraction(root); // Repainting a received tile must not re-arm admission.
    claim.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,cancelable:true}));
    expect(submit).toHaveBeenCalledTimes(2);
  });
  it('previews capped healing and keeps independent restoration usage visible', () => {
    const root=document.createElement('main');document.body.append(root);
    root.innerHTML=fireRestDecisionHTML({heal:12,hp:35,maxHp:40,chance:15,restorable:3,fits:true,capacity:'9/12 格'});
    expect(root.textContent).toContain('35 → 40 · 实际回复 5');
    initFireRestPreview(root);
    root.querySelector('[data-act="fireRestore"]').focus();
    expect(root.querySelector('#fire-effect-preview').textContent).toContain('消耗区 3 张可复原');
    root.innerHTML=fireRestDecisionHTML({heal:12,hp:40,maxHp:40,chance:15,restorable:3,fits:true,capacity:'9/12 格',healUsed:true,hpGain:5});
    expect(root.querySelector('[data-act="fireHeal"]').disabled).toBe(true);
    expect(root.querySelector('[data-act="fireRestore"]').disabled).toBe(false);
  });
  it('keeps the original map tools without legend, objective or route list', () => {
    document.body.innerHTML='<aside id="sidebar"></aside><nav id="expeditionChapter"></nav>';
    const game={runActive:true,state:'idle',layerIdx:0,trackPos:0,layerData:[{logical:[{def:{type:'entrance'},next:[[0,1]]},{def:{type:'battle'},next:[]}],doors:[]}],seen:{'0,1':1},visited:{},nodes:[],hp:30,maxHp:30};
    const before=JSON.stringify(game);
    renderExpeditionPanel(null,game,icon=>icon);
    expect([...document.querySelectorAll('[data-expedition-tool]')].map(el=>el.dataset.expeditionTool)).toEqual(['bag','safe','pocket','focus','overview']);
    expect(document.querySelector('.map-legend-toggle,.map-legend-panel,.expedition-current-objective,.expedition-route-summary,[data-route-select]')).toBeNull();
    expect(document.body.textContent).not.toContain('当前目标');
    expect(document.querySelector('.expedition-map-preview').hidden).toBe(true);
    expect(JSON.stringify(game)).toBe(before);
  });
  it('locks a purchase through asynchronous saving and preserves one accepted trade on save failure', async () => {
    let finish;
    const card={id:'shop-review-card',name:'卡牌',type:'法术',rarity:'古朴'};
    const slot={card,price:3,sold:false}, state={coins:10,ownedCards:[],shopStock:[slot]};
    const save=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
    const commands=createShopCommands({state,canReceive:()=>true,newUid:()=> 'only-one',isSellable:()=>true,sellPrice:()=>1,save});
    const input={index:0,quote:{slot,card,price:3,replenish:false},current:()=>true};
    const purchase=commands.buy(input);
    expect(state.coins).toBe(7);expect(state.ownedCards).toHaveLength(1);
    expect(await commands.buy(input)).toEqual({ok:false,reason:'busy'});
    finish(false);
    expect(await purchase).toMatchObject({ok:true,saved:false});
    expect(state.coins).toBe(7);expect(state.ownedCards).toHaveLength(1);
    expect(await commands.buy(input)).toEqual({ok:false,reason:'stale'});
  });
});
