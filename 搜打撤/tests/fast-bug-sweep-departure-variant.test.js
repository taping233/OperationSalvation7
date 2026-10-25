// @vitest-environment node
import { expect, it } from 'vitest';
import { planBaseDeparture } from '../game/src/hub/base-departure.commands.js';
import { sameStoredCard } from '../game/src/hub/stored-card-identity.js';

it('retains outer warehouse variants through the card-only expedition admission', () => {
  const card = { id:'same-id', name:'同名卡', type:'武术', rarity:'古朴' };
  const state = { stash:[{card, count:1, variantKey:'first'}, {card, count:1, variantKey:'second'}], pocket:[] };
  const before = structuredClone(state);
  const {departure} = planBaseDeparture(state, {'card:same-id:first':1, 'card:same-id:second':1});
  expect(departure.ok).toBe(true);
  const admitted = departure.cards.map((stack, index) => ({uid:String(index), card:{...stack.card}}));
  expect(admitted.map(entry => entry.card.variantKey)).toEqual(['first', 'second']);
  expect(sameStoredCard(admitted[0], admitted[1])).toBe(false);
  expect(state).toEqual(before);
  expect(card).not.toHaveProperty('variantKey');
});

it('uses the selected outer identity when it overrides a historic card variant', () => {
  const card = {id:'card', name:'卡牌', rarity:'古朴', variantKey:'old'};
  const {departure} = planBaseDeparture({stash:[{card, count:2, variantKey:'current'}], pocket:[]}, {'card:card:current':1});
  expect(departure.cards).toEqual([{card:{...card, variantKey:'current'}, count:1}]);
  expect(card.variantKey).toBe('old');
});

it('preserves plain and legacy name-only departure snapshots', () => {
  const plain = {id:'card', name:'卡牌', rarity:'古朴'};
  const legacy = {name:'旧卡', rarity:'古朴'};
  const {departure} = planBaseDeparture({stash:[{card:plain, count:2}, {card:legacy, count:1}], pocket:[]}, {'card:card':1, '旧卡':1});
  expect(departure.cards).toEqual([{card:plain, count:1}, {card:legacy, count:1}]);
  expect(departure.cards.every(stack => !Object.hasOwn(stack.card, 'variantKey'))).toBe(true);
});
