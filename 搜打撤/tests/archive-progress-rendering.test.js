import { afterEach, describe, expect, it, vi } from 'vitest';
import data from '../game/data/achievements.json';
import { archiveV3HTML } from '../game/src/hub/hub.archive-v3.js';
import { achievementProgressText, createAchievementProgressReader } from '../game/src/hub/hub.archive.js';
let slot = 100;
function setup() {
  const base = { slot:slot++, data:{stats:{extracts:1,kills:4},characters:{wu:{lv:2}},pets:{one:{lv:2}},collection:{},runes:[]},
    bagCap:vi.fn(() => 6),safeCap:vi.fn(() => 1),PETS:[{},{}] };
  const meta = { ACHIEVEMENTS:data.achievements, isClaimed:vi.fn(() => false), isUnlocked:vi.fn(item => item.id === 'firstExtract') };
  const cards = { all:() => [], CARD_BACKS:[] };
  window.SDT = { Base:base, MAP:{rules:{bagMax:10,safeMax:4}} };
  const render = () => archiveV3HTML({base,meta,cards,view:'achievements'});
  return {base,meta,cards,render};
}
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
describe('one-render achievement progress snapshot', () => {
  it('calculates all progress once for the real achievement catalog, including row and detail copies', () => {
    const {base,meta,render} = setup(); const before = JSON.stringify(base.data);
    const html = render(); document.body.innerHTML = html;
    expect(document.querySelectorAll('.av3-medal')).toHaveLength(data.achievements.length);
    expect(base.bagCap).toHaveBeenCalledOnce(); expect(base.safeCap).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('.av3-detail-source')).toHaveLength(data.achievements.length);
    expect(document.querySelector('.av3-medal-detail').textContent).toContain('1 / 1');
    expect(meta.isUnlocked).toHaveBeenCalledTimes(data.achievements.length);
    expect(meta.isClaimed).toHaveBeenCalledTimes(data.achievements.length);
    expect(document.querySelector('.av3-medal-detail').innerHTML).toBe(document.querySelector('.av3-medal.selected .av3-detail-source').innerHTML);
    expect(JSON.stringify(base.data)).toBe(before);
  });
  it('takes a fresh snapshot on the next render after in-place progression and collection changes', () => {
    const {base,render} = setup(); render();
    base.data.stats.extracts = 2; base.data.stats.kills = 8;
    base.data.characters.wu.lv = 3; base.data.pets.two = {lv:5};
    base.data.collection.legend = {rarity:'传说'}; base.data.runes.push({kind:'rainbow',attrs:['a','b']});
    document.body.innerHTML = render();
    const progress = id => document.querySelector(`[data-achievement="${id}"] .av3-medal-label small`).textContent;
    expect(progress('extract3')).toBe('2 / 3'); expect(progress('kill10')).toBe('8 / 10');
    expect(progress('class3')).toBe('3 / 3'); expect(progress('petMax')).toBe('5 / 5');
    expect(progress('collectLegend')).toBe('1 / 1'); expect(progress('runeFan')).toBe('2 / 5');
    expect(progress('beautifulVase')).toBe('1 / 1');
    expect(base.bagCap).toHaveBeenCalledTimes(2); expect(base.safeCap).toHaveBeenCalledTimes(2);
  });
  it('does not reuse snapshots across replacement data or slots', () => {
    const {base,render} = setup(); const snapshot = createAchievementProgressReader(base);
    expect(snapshot('kill10')).toBe('4 / 10'); base.data = {stats:{kills:9}}; base.slot++;
    document.body.innerHTML = render();
    expect(document.querySelector('[data-achievement="kill10"] .av3-medal-label small').textContent).toBe('9 / 10');
    expect(snapshot('kill10')).toBe('4 / 10'); expect(achievementProgressText('kill10',base)).toBe('9 / 10');
    expect(createAchievementProgressReader(base)('unknown-achievement')).toBe('');
  });
  it('keeps empty catalogs renderable without touching unavailable progress ports', () => {
    const {base,meta,render} = setup(); meta.ACHIEVEMENTS = [];
    base.bagCap = () => { throw new Error('must not read empty progress'); };
    expect(render()).toContain('暂无成就档案');
  });
  it('refreshes status, sorting and filter counts together without invoking reward commands', () => {
    const {base,meta,render} = setup(); base.grantReward=vi.fn();
    meta.ACHIEVEMENTS = ['firstExtract','kill10','extract3'].map(id => data.achievements.find(item => item.id === id));
    const sourceOrder = meta.ACHIEVEMENTS.map(item => item.id);
    meta.isUnlocked.mockImplementation(item => item.id !== 'extract3');
    meta.isClaimed.mockImplementation(id => id === 'firstExtract');
    document.body.innerHTML=render();
    const rows = () => [...document.querySelectorAll('.av3-medal')].map(row => [row.dataset.achievement,row.dataset.status]);
    const count = status => document.querySelector(`[data-act="archiveStatus"][data-status="${status}"] small`).textContent;
    expect(rows()).toEqual([['kill10','claimable'],['extract3','progress'],['firstExtract','done']]);
    expect(['all','claimable','progress','done'].map(count)).toEqual(['3','1','1','1']);
    expect(document.querySelector('[data-achievement="firstExtract"]').dataset.status).toBe('done');
    expect(document.querySelector('.av3-medal-detail [data-act="claimAch"]').dataset.id).toBe('kill10');
    meta.isClaimed.mockImplementation(id => id === 'firstExtract' || id === 'kill10');
    document.body.innerHTML=render();
    expect(rows()).toEqual([['extract3','progress'],['firstExtract','done'],['kill10','done']]);
    expect(['all','claimable','progress','done'].map(count)).toEqual(['3','0','1','2']);
    expect(document.querySelector('.av3-pending-count')).toBeNull();
    expect(document.querySelector('.av3-medal-detail [data-act="claimAch"]')).toBeNull();
    expect(meta.ACHIEVEMENTS.map(item => item.id)).toEqual(sourceOrder);
    expect(meta.isUnlocked).toHaveBeenCalledTimes(6); expect(meta.isClaimed).toHaveBeenCalledTimes(6);
    expect(base.grantReward).not.toHaveBeenCalled();
  });
});
