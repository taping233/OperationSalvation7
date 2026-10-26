import { describe, expect, it, vi } from 'vitest';
import { bagUseCompatibility, grantsApolloBonus } from '../game/src/hub/bag-use-compatibility.js';
import { createLegacyBagUse } from '../game/src/hub/bag-legacy-use.js';

function scenario(card) {
  const game = { ownedCards:[{ uid:'source', card }], usedPocket:[], hp:1, maxHp:10, coins:0, heal:vi.fn(), addItem:vi.fn() };
  const ports = { game, UI:{ log:vi.fn(), showLegendGet:vi.fn() }, cards:{ all:vi.fn(() => []), classPool:vi.fn(() => []), isRandomObtainable:() => true },
    baseCap:() => 4, items:{}, Random:{ random:vi.fn(() => 0) }, newUid:vi.fn(() => 'output'), saveGame:vi.fn(() => true),
    showBackpack:vi.fn(), usedSlots:() => 1, bagCap:() => 4, captureContext:() => () => true, setBagReceipt:vi.fn() };
  return { ...ports, ...createLegacyBagUse({ ...ports, readCards: () => ports.cards }) };
}

describe('legacy bag compatibility and structured priority', () => {
  it.each([
    [{ id:'tt3-mystery-potion', desc:'回复 8 点生命' },'battleOnly',0],
    [{ id:'tt-crystal', desc:'复原两张卡牌。回复 8 点生命' },'crystal',3],
    [{ name:'复原药水', desc:'觉醒' },'restore',2],
    [{ desc:'获得 4 份口粮。随机获取 1 张传说卡' },'rations',4],
    [{ desc:'木材×2' },'wood',2],
    [{ id:'tt-token-gold', desc:'觉醒' },'gold',1],
    [{ id:'tt4-shine-token', desc:'发现 1 张传说卡。' },'discover',1],
    [{ desc:'随机神秘效果。回复 8 点生命' },'mystery',1],
    [{ desc:'回复 7 点生命' },'heal',7],
  ])('preserves legacy match precedence for %j', (card, kind, amount) => {
    expect(bagUseCompatibility(card)).toEqual({kind,amount});
  });

  it('runs native structured healing before a conflicting legacy name', () => {
    const h = scenario({ name:'复原药水', type:'道具', rules:{ bag:{ use:[{op:'heal',amount:3}] } } });
    h.useOwnedCard('source');
    expect(h.game.heal).toHaveBeenCalledWith(3, { deferFeedback: expect.any(Function) }); expect(h.game.ownedCards).toEqual([]);
    expect(h.saveGame).toHaveBeenCalledOnce(); expect(h.newUid).not.toHaveBeenCalled();
  });

  it('keeps the battle-only potion ahead of native operations without consuming anything', () => {
    const h = scenario({ id:'tt3-mystery-potion', name:'神秘药水', type:'道具', rules:{ bag:{ use:[{op:'heal',amount:3}] } } });
    const before = structuredClone(h.game.ownedCards);
    h.useOwnedCard('source');
    expect(h.game.ownedCards).toEqual(before); expect(h.game.heal).not.toHaveBeenCalled();
    expect(h.newUid).not.toHaveBeenCalled(); expect(h.saveGame).not.toHaveBeenCalled(); expect(h.Random.random).not.toHaveBeenCalled();
  });

  it('rejects expired callers and empty token pools before allocation or consumption', () => {
    const h = scenario({ id:'tt-token-gold', name:'通行证', type:'道具' });
    h.useOwnedCard('source', () => false); expect(h.cards.all).not.toHaveBeenCalled();
    h.useOwnedCard('source'); expect(h.game.ownedCards).toHaveLength(1);
    expect(h.newUid).not.toHaveBeenCalled(); expect(h.Random.random).not.toHaveBeenCalled(); expect(h.saveGame).not.toHaveBeenCalled();
  });

  it('persists legacy crystal restoration before refreshing and keeps Apollo identity matching', async () => {
    const h = scenario({ id:'tt-crystal', name:'能源结晶', type:'道具' });
    h.game.usedPocket = [{card:{name:'旧牌'},count:1}]; await h.useOwnedCard('source');
    expect(h.game.ownedCards[0].card.name).toBe('旧牌'); expect(h.game.usedPocket).toEqual([]);
    expect(h.showBackpack).toHaveBeenCalledWith(true); expect(h.saveGame).toHaveBeenCalledOnce();
    expect(grantsApolloBonus({id:'tt2-apollo'})).toBe(true); expect(grantsApolloBonus({name:'阿猫的礼物'})).toBe(false);
  });

  it.each(['false','throw'])('rolls back only restoration outputs and pocket counts after save %s', async failure => {
    const h=scenario({id:'tt-crystal',name:'旧结晶',type:'道具'});
    const pocket={card:{name:'原牌'},count:2}; h.game.usedPocket=[pocket];
    const source=h.game.ownedCards[0]; let complete;
    h.saveGame.mockImplementationOnce(()=>new Promise((resolve,reject)=>{complete=()=>failure==='throw'?reject(new Error('quota')):resolve(false);}));
    const pending=h.useOwnedCard('source');
    expect(h.useOwnedCard('source')).toBe(false); expect(h.showBackpack).not.toHaveBeenCalled();
    const unrelated={uid:'other',card:{name:'后来获得的卡'}}; h.game.ownedCards.push(unrelated);
    complete(); expect(await pending).toBe(false);
    expect(h.game.ownedCards).toEqual([source,unrelated]); expect(h.game.usedPocket).toEqual([pocket]); expect(pocket.count).toBe(2);
    expect(h.UI.log).toHaveBeenCalledWith(expect.stringContaining('已恢复'),'warn');
  });

  it('does not rollback or repaint a replacement run after pending restoration fails', async () => {
    const h=scenario({id:'tt-crystal',name:'旧结晶',type:'道具'}); h.game.usedPocket=[{card:{name:'旧牌'},count:1}];
    let complete; h.saveGame.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
    const pending=h.useOwnedCard('source');
    const fresh=[{uid:'new',card:{name:'新局卡'}}]; h.game.ownedCards=fresh; h.game.usedPocket=[];
    complete(false); expect(await pending).toBe(false); expect(h.game.ownedCards).toBe(fresh);
    expect(h.game.ownedCards).toEqual([{uid:'new',card:{name:'新局卡'}}]); expect(h.showBackpack).not.toHaveBeenCalled(); expect(h.UI.log).not.toHaveBeenCalled();
  });

});
