import { describe, expect, it } from 'vitest';
import { planBagTokenCraft } from '../game/src/hub/game.bag.token-craft.js';
const gold = { id:'tt-token-gold', name:'员工通行证B', type:'道具' };
const color = { id:'tt-token-color', name:'员工通行证A', type:'道具' };
const final = { id:'cmtmvq6ss84l', name:'觉醒通行证', type:'道具' };
const catalog = [color, final];
const owned = (uid, card, safe = false) => ({uid,card,safe});
describe('shared token recipe plan', () => {
  it('plans the first three B UIDs across zones without mutation or catalog aliasing', () => {
    const game={ownedCards:[owned('g1',gold,true),owned('g2',gold),owned('g3',gold),owned('g4',gold)],fragments:5};
    const before=structuredClone(game), plan=planBagTokenCraft(game,'gold',catalog);
    expect(plan).toMatchObject({ok:true,sourceUids:['g1','g2','g3'],card:color,fragments:0});
    expect(plan.card).not.toBe(color);expect(game).toEqual(before);
  });
  it('preserves the explicit detail UID versus first-A zoom selection', () => {
    const game={ownedCards:[owned('a1',color),owned('a2',color,true)],fragments:4};
    expect(planBagTokenCraft(game,'fragments',catalog,'a2').sourceUids).toEqual(['a2']);
    expect(planBagTokenCraft(game,'fragments',catalog).sourceUids).toEqual(['a1']);
  });
  it.each(['gold','fragments'])('missing output keeps %s materials unchanged', kind => {
    const game={ownedCards:[owned('g1',gold),owned('g2',gold),owned('g3',gold),owned('a1',color)],fragments:4};
    const before=structuredClone(game);
    expect(planBagTokenCraft(game,kind,[])).toMatchObject({ok:false,reason:expect.stringContaining('材料未消耗')});
    expect(game).toEqual(before);
  });
  it('rereads removed/retyped source UID instead of consuming another A', () => {
    const game={ownedCards:[owned('a1',color),owned('a2',color)],fragments:4};
    game.ownedCards[1].card=gold;
    expect(planBagTokenCraft(game,'fragments',catalog,'a2').ok).toBe(false);
    game.ownedCards.pop();
    expect(planBagTokenCraft(game,'fragments',catalog,'a2').ok).toBe(false);
    expect(game.ownedCards[0].uid).toBe('a1');expect(game.fragments).toBe(4);
  });
  it('rejects insufficient live fragments and B inputs', () => {
    expect(planBagTokenCraft({ownedCards:[owned('a',color)],fragments:1},'fragments',catalog).ok).toBe(false);
    expect(planBagTokenCraft({ownedCards:[owned('g',gold)],fragments:4},'gold',catalog).ok).toBe(false);
  });
});
