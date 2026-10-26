// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { groupHandCards } from '../game/src/battle/core/battle.hand.js';

function reference(entries, infusing, counted = () => {}) {
  const groups = [];
  const keyOf = card => card && card.id ? `id:${card.id}|${card.cost}|${card.desc || ''}`
    : `legacy:${card?.name || ''}|${card?.type || ''}|${card?.cost || 0}|${card?.desc || ''}`;
  const push = entry => {
    const key = keyOf(entry.card);
    const group = groups.find(value => { counted(); return value.key === key; });
    if (group) group.uids.push(entry.uid);
    else groups.push({key,card:entry.card,uids:[entry.uid],self:false});
  };
  entries.forEach(entry => { if (!infusing || entry.uid !== infusing.uid) push(entry); });
  const main = infusing && entries.find(entry => entry.uid === infusing.uid);
  if (main) groups.push({key:keyOf(main.card),card:main.card,uids:[main.uid],self:true});
  return groups;
}

it('preserves first-face identity, order, live cost/description splits and infusion main isolation', () => {
  for (let round = 0; round < 80; round++) {
    const entries = Array.from({length:round + 1}, (_, i) => ({uid:`u${i}`,card:{
      ...(i % 3 ? {id:`id${i % 9}`} : {}), name:`名${i % 4}`, type:'法术', cost:(i + round) % 4,
      desc:`伤害${i % 5}`, dmg:i,
    }}));
    for (const infusing of [null, {uid:`u${round % entries.length}`}, {uid:'absent'}]) {
      const expected = reference(entries, infusing), actual = groupHandCards(entries, infusing);
      expect(actual).toEqual(expected);
      actual.forEach((group, i) => expect(group.card).toBe(expected[i].card));
    }
  }
});

it('uses one ephemeral key lookup per entry rather than scanning previous groups', () => {
  const entries = Array.from({length:99}, (_, i) => ({uid:`u${i}`,card:{id:`id${i}`,cost:1,desc:'造成1伤害'}}));
  let comparisons = 0;
  reference(entries, null, () => comparisons++);
  const get = vi.spyOn(Map.prototype, 'get');
  groupHandCards(entries);
  const lookups = get.mock.calls.length;
  get.mockRestore();
  expect(lookups).toBe(99);
  expect(comparisons).toBe(4851);
});
