import { describe, expect, it, vi } from 'vitest';
import { createLegacyBagUse } from '../game/src/hub/bag-legacy-use.js';

describe('bag use current library port', () => {
  it.each(['legacy', 'structured'])('uses a replacement library for %s acquisition without changing synchronous return', kind => {
    const card = kind === 'legacy' ? { id: 'tt-token-gold', name: '旧通行证', type: '道具' }
      : { id: 'custom-acquire', name: '自制获取', type: '道具', rules: { bag: { use: [{ op: 'acquire', pool: { kind: 'legendary' } }] } } };
    const oldCards = { all: vi.fn(() => []), isRandomObtainable: () => true };
    let current = oldCards;
    const game = { ownedCards: [{ uid: 'source', card }], usedPocket: [], hp: 1, maxHp: 10 };
    const saveGame = vi.fn(); const refresh = vi.fn();
    const controller = createLegacyBagUse({ UI: { log: vi.fn(), showLegendGet: vi.fn() }, game,
      readCards: () => current, baseCap: () => 4, items: {}, Random: { random: () => 0 },
      newUid: () => 'reward', saveGame, showBackpack: refresh, usedSlots: () => 1, bagCap: () => 4,
      captureContext: () => () => true, setBagReceipt: vi.fn() });
    const reward = { id: 'new-legend', name: '当前传说', rarity: '传说' };
    current = { all: vi.fn(() => [reward]), isRandomObtainable: () => true };
    expect(controller.useOwnedCard('source')).toBeUndefined();
    expect(oldCards.all).not.toHaveBeenCalled();
    expect(current.all).toHaveBeenCalledOnce();
    expect(game.ownedCards).toEqual([{ uid: 'reward', card: reward }]);
    expect(saveGame).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledExactlyOnceWith(true);
  });
});

it('复原道具在保存成功后展示实际卡牌，演出期间不重复消耗',async()=>{
  vi.useFakeTimers();
  try {
    document.body.innerHTML='<main id="bag"><section><button>使用</button></section></main>';
    const body=document.querySelector('#bag');body.firstElementChild.animate=vi.fn();
    const source={id:'tt-crystal',name:'能源结晶',type:'道具'};
    const game={ownedCards:[{uid:'source',card:source}],usedPocket:[{card:{id:'a',name:'实际旧牌'},count:2}],hp:1,maxHp:10};
    const refresh=vi.fn(),save=vi.fn(()=>true);let uid=0;
    const controller=createLegacyBagUse({UI:{el:{ovBody:body},log:vi.fn()},game,
      readCards:()=>({cardHTML:card=>card.name}),baseCap:()=>4,items:{},Random:{random:()=>0},newUid:()=>`r${uid++}`,
      saveGame:save,showBackpack:refresh,usedSlots:()=>game.ownedCards.length,bagCap:()=>4,
      captureContext:()=>()=>true,setBagReceipt:vi.fn()});
    const result=controller.useOwnedCard('source');await Promise.resolve();
    expect(body.querySelectorAll('.fire-rest-reveal-card')).toHaveLength(2);
    expect(game.ownedCards).toHaveLength(2);expect(save).toHaveBeenCalledOnce();expect(refresh).not.toHaveBeenCalled();
    expect(controller.useOwnedCard('source')).toBe(false);
    await vi.advanceTimersByTimeAsync(900);await result;
    expect(refresh).toHaveBeenCalledOnce();expect(game.usedPocket).toEqual([]);
  } finally {vi.clearAllTimers();vi.useRealTimers();document.body.replaceChildren();}
});
