// Characterization probes: assertions describe current defects, not intended behavior.
// Production Cards/Base/Meta modules; storage is isolated jsdom localStorage only.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { RULES } from '../../../game/src/core/rules.js';
window.SDT = window.SDT || {};
window.SDT.Icons = { img: () => '', rich: text => text };
await import('../../../game/src/cards/cards.js');
await import('../../../game/src/hub/base.js');
await import('../../../game/src/hub/meta.js');
const { Cards, Base, Meta } = window.SDT;
window.SDT.MAP = { rules: RULES };
window.SDT.Sound = { sfx() {} };
window.SDT.UI = { log() {} };
Cards.ensureTabletop();
const catalog = JSON.parse(JSON.stringify(Cards.all()));
const traces = [];
const disk = () => JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));
const snapshot = () => ({ wood: Base.data.wood, stash: Base.data.stash.map(s => ({ id: s.card.id, count: s.count })), achClaimed: Base.data.achClaimed, collClaimed: Base.data.collClaimed });
const registerCollection = count => {
  const selected = Meta.collectPool().slice(0, count);
  expect(selected).toHaveLength(count);
  for (const card of selected) Base.data.collection[card.id] = { name:card.name, rarity:card.rarity, ts:1 };
  expect(Base.save()).toBe(true);
};
beforeEach(() => {
  Cards.all(); expect(Cards.saveAll(JSON.parse(JSON.stringify(catalog)))).toBe(true);
  localStorage.removeItem(Base.SLOT_KEY(1)); Base.use(1); expect(Base.save()).toBe(true);
});
afterAll(() => writeFileSync('docs/evidence/2026-10-16-reward-atomicity-audit/reproduction.json', JSON.stringify({ at:new Date().toISOString(), productionModules:true, browserUsed:false, playerStorageTouched:false, traces }, null, 2) + '\n'));
describe('Reward atomicity and durable-marker characterization', () => {
  it('configured achievement card removed through real Cards.remove is consumed without a reward', () => {
    const id = 'labScore2', reward = Meta.achById(id).reward.card;
    const original = Cards.all().find(card => card.id === reward); expect(original).toBeTruthy();
    Base.data.stats.labTotalScore = 1500; expect(Base.save()).toBe(true);
    Cards.remove(reward); expect(Cards.all().some(card => card.id === reward)).toBe(false);
    const input = { id, reward, catalogHasReward:false, state:snapshot() };
    const result = Meta.claim(id);
    expect(result.ok).toBe(true); expect(Base.data.achClaimed[id]).toBe(true); expect(Base.data.stash).toHaveLength(0);
    const saved = disk(); expect(saved.achClaimed[id]).toBe(true); expect(saved.stash).toHaveLength(0);
    Cards.upsert(original); Base.use(1); const retry = Meta.claim(id); expect(retry.ok).toBe(false);
    traces.push({ case:'missing-achievement-card', input, result, saved, afterRestoringCatalogRetry:retry });
  });
  it('full collection egg reward removed from catalog is marked claimed without granting an egg', () => {
    registerCollection(Meta.collectPool().length);
    Cards.remove(Base.PET_EGG_ID); expect(Cards.all().some(card => card.id === Base.PET_EGG_ID)).toBe(false);
    const input = { id:'mAll', collectionProgress:Meta.collProgress(), collectionTotal:Meta.collTotal(), catalogHasEgg:false };
    const result = Meta.claimColl('mAll'); const saved = disk();
    expect(result.ok).toBe(true); expect(saved.collClaimed.mAll).toBe(true); expect(saved.stash).toHaveLength(0);
    traces.push({ case:'missing-collection-egg', input, result, saved });
  });
  it('two-legend milestone accepts a catalog with one eligible legend and permanently grants only one', () => {
    registerCollection(45);
    const legends = Cards.all().filter(card => card.rarity === '传说' && Cards.isRandomObtainable(card));
    expect(legends.length).toBeGreaterThan(1);
    const keep = legends[0]; const remove = new Set(legends.slice(1).map(card => card.id));
    expect(Cards.saveAll(Cards.all().filter(card => !remove.has(card.id)))).toBe(true);
    const input = { id:'m45', promised:Meta.collMsById('m45').reward.legend, eligibleLegendIds:[keep.id], collectionProgress:Meta.collProgress() };
    const result = Meta.claimColl('m45'); const saved = disk();
    expect(result.ok).toBe(true); expect(saved.collClaimed.m45).toBe(true);
    expect(saved.stash).toEqual([expect.objectContaining({ card:expect.objectContaining({ id:keep.id }), count:1 })]);
    traces.push({ case:'short-legend-pool', input, result, saved });
  });
  it('malformed collClaimed array drops the claimed marker but durably saves wood, permitting a second grant after reload', () => {
    registerCollection(5);
    const raw = disk(); raw.collClaimed = []; localStorage.setItem(Base.SLOT_KEY(1), JSON.stringify(raw)); Base.use(1);
    const input = { id:'m5', collClaimed:[], wood:Base.data.wood, collectionProgress:Meta.collProgress() };
    const first = Meta.claimColl('m5'); const firstMemory = Meta.isCollClaimed('m5'); const savedFirst = disk();
    expect(first.ok).toBe(true); expect(firstMemory).toBe(true); expect(savedFirst.wood).toBe(3); expect(savedFirst.collClaimed).toEqual([]);
    Base.use(1); expect(Meta.isCollClaimed('m5')).toBe(false);
    const second = Meta.claimColl('m5'); const savedSecond = disk();
    expect(second.ok).toBe(true); expect(savedSecond.wood).toBe(6); expect(savedSecond.collClaimed).toEqual([]);
    traces.push({ case:'malformed-array-marker', input, first, firstMemory, savedFirst, second, savedSecond });
  });
});
