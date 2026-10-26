import { installImmediateWebLocks } from './helpers/web-locks.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openBagLegendaryDiscovery, useStructuredBagRule } from '../game/src/hub/game.bag.rules.js';
import { captureBattleContext } from '../game/src/battle/battle-loader.js';
import { RunStorage } from '../game/src/hub/game.storage.js';
import { validateRunSave } from '../game/src/hub/run-save-validation.js';

let game, card, ports, acts, candidates;
beforeEach(() => {
  installImmediateWebLocks();
  card = { id:'tt4-shine-token', name:'员工通行证C', type:'道具', desc:'发现 1 张传说卡。',
    rules:{version:1,bag:{use:[{op:'discover',count:1,pool:{kind:'legendary'}}]}} };
  candidates = [0, 1, 2, 3].map(i => ({id:'legend-'+i,name:'传说-'+i,rarity:'传说',type:i === 1 ? '装备' : '法术'}));
  game = {seed:17,runActive:true,battleActive:false,state:'modal',discoveredPairs:new Set(),
    ownedCards:[{uid:'source',card}],usedPocket:[]};
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  acts = {};
  const UI = { el:{overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody')},
    log:vi.fn(), act:(name, fn) => { acts[name] = fn; },
    showOverlay:(_title, html) => { UI.el.overlay.hidden = false; UI.el.ovBody.innerHTML = html; } };
  window.SDT = {game,Base:{slot:1}};
  ports = {game,UI,SDT:{Base:{bagCap:()=>18},Cards:{all:()=>[...candidates,{...candidates[0],id:'unrandom',unrandom:true}],
    isRandomObtainable:entry => !entry.unrandom,cardHTML:entry => `<span>${entry.name}</span>`}},
    Random:{random:vi.fn(()=>0)},newUid:vi.fn(()=> 'reward'),saveGame:vi.fn(()=>true),
    showBackpack:vi.fn(()=> { UI.el.ovBody.innerHTML = '<div>背包</div>'; }),
    usedSlots:()=>1,bagCap:()=>18,captureContext:()=>captureBattleContext(game)};
});
const open = () => useStructuredBagRule(card, game.ownedCards.indexOf(game.ownedCards.find(entry => entry.uid === 'source')), ports);
const pick = index => {
  if (!acts.bagDiscoverPick({i:String(index)})) return false;
  return acts.bagDiscoverConfirm();
};

describe('通行证C地图发现事务', () => {
  it('三张不同合法候选，打开/取消不扣源牌，重入不重抽，确认只得所选一张', async () => {
    expect(open()).toBe(true);
    const ids = [...game.ownedCards[0].bagDiscover.cardIds], oldPick = acts.bagDiscoverPick;
    expect(ids).toHaveLength(3); expect(new Set(ids).size).toBe(3); expect(ids).not.toContain('unrandom');
    expect(game.ownedCards).toHaveLength(1); expect(ports.newUid).not.toHaveBeenCalled();
    acts.bagDiscoverCancel(); expect(game.ownedCards[0].uid).toBe('source');
    open(); expect(game.ownedCards[0].bagDiscover.cardIds).toEqual(ids); expect(ports.Random.random).toHaveBeenCalledTimes(3);
    expect(await oldPick({i:'0'})).toBe(false);
    const chosen = ids[1]; expect(await pick(1)).toBe(true); expect(await pick(1)).toBe(false);
    expect(game.ownedCards).toHaveLength(1); expect(game.ownedCards[0]).toMatchObject({uid:'reward',card:{id:chosen}});
    expect(ports.newUid).toHaveBeenCalledOnce();
  });
  it.each(['slot','run','owned-array','page','battle'])('%s变化使旧选择失效', async change => {
    open(); const oldPick = acts.bagDiscoverPick;
    if (change === 'slot') window.SDT.Base.slot = 2;
    if (change === 'run') game.discoveredPairs = new Set();
    if (change === 'owned-array') game.ownedCards = structuredClone(game.ownedCards);
    if (change === 'page') ports.UI.el.ovBody.innerHTML = '<div>新页</div>';
    if (change === 'battle') game.battleActive = true;
    expect(await oldPick({i:'0'})).toBe(false); expect(game.ownedCards[0].uid).toBe('source'); expect(ports.newUid).not.toHaveBeenCalled();
  });
  it('容量不足保留源牌/候选，腾位后使用同一候选成功', async () => {
    let used = 18;
    game.ownedCards.push({uid:'other-token',card}); ports.usedSlots = () => used;
    open(); const ids = [...game.ownedCards[0].bagDiscover.cardIds];
    expect(await pick(1)).toBe(false); expect(game.ownedCards[0].uid).toBe('source');
    expect(game.ownedCards[0].bagDiscover.cardIds).toEqual(ids); expect(ports.UI.el.ovBody.textContent).toContain('空间不足');
    used = 17;
    expect(await pick(1)).toBe(true); expect(game.ownedCards.at(-1).card.id).toBe(ids[1]);
  });
  it.each(['false','throw'])('保存%s时回退交易并允许原候选重试', async failure => {
    open(); const source = game.ownedCards[0], ids = [...source.bagDiscover.cardIds];
    if (failure === 'throw') ports.saveGame.mockImplementationOnce(()=> { throw new Error('quota'); });
    else ports.saveGame.mockReturnValueOnce(false);
    expect(await pick(0)).toBe(false); expect(game.ownedCards).toEqual([source]); expect(source.bagDiscover.cardIds).toEqual(ids);
    expect(await pick(0)).toBe(true); expect(game.ownedCards[0].card.id).toBe(ids[0]);
  });
  it('真实RunStorage写入/读取后恢复同一候选，不重抽且旧回调失效', async () => {
    await RunStorage.remove(5); open();
    const source = game.ownedCards[0], ids = [...source.bagDiscover.cardIds], oldPick = acts.bagDiscoverPick;
    expect(await RunStorage.write(5,{seed:17,hp:20,ownedCards:game.ownedCards,usedPocket:[]})).toBe(true);
    const recovered = RunStorage.readForLoad(5);
    expect(validateRunSave(recovered).ok).toBe(true);
    expect(recovered.ownedCards[0].bagDiscover.cardIds).toEqual(ids);
    game.ownedCards = recovered.ownedCards; card = game.ownedCards[0].card; ports.Random.random.mockClear();
    expect(open()).toBe(true); expect(ports.Random.random).not.toHaveBeenCalled(); expect(await oldPick({i:'0'})).toBe(false);
    expect(await pick(2)).toBe(true); expect(game.ownedCards[0].card.id).toBe(ids[2]);
    await RunStorage.remove(5);
  });
  it('旧卡无rules也可用同一入口，自定义描述不被覆盖', async () => {
    delete card.rules; card.desc = '我自定义的通行证文字';
    expect(openBagLegendaryDiscovery(card,0,ports)).toBe(true);
    expect(card.desc).toBe('我自定义的通行证文字'); expect(game.ownedCards[0].uid).toBe('source');
  });
  it('候选记录损坏时保留，不静默重抽', async () => {
    game.ownedCards[0].bagDiscover = {version:1,cardIds:['missing']};
    expect(open()).toBe(true); expect(ports.Random.random).not.toHaveBeenCalled(); expect(game.ownedCards[0].uid).toBe('source');
    expect(ports.newUid).not.toHaveBeenCalled();
  });
  it('首次候选保存失败明确提示，源牌未消费，确认时可重试保存', async () => {
    ports.saveGame.mockReturnValueOnce(false);
    open(); await vi.waitFor(()=>expect(ports.UI.el.ovBody.textContent).toContain('候选尚未保存'));
    expect(game.ownedCards[0].uid).toBe('source'); expect(ports.UI.el.ovBody.textContent).toContain('候选尚未保存');
    expect(await pick(0)).toBe(true); expect(game.ownedCards[0].uid).toBe('reward');
  });
});


it('structured classAbility discovery uses explicit selection and confirmation, not random acquisition', async () => {
  card.rules.bag.use = [{op:'discover',count:1,pool:{kind:'classAbility'}}];
  const abilities = [0,1,2].map(i => ({id:`ability-${i}`,name:`能力-${i}`,type:'能力卡'}));
  ports.SDT.Cards.classPool = () => abilities;
  open();
  expect(game.ownedCards[0].uid).toBe('source');
  expect(game.ownedCards[0].bagDiscover.poolKind).toBe('classAbility');
  const chosen = game.ownedCards[0].bagDiscover.cardIds[1];
  acts.bagDiscoverPick({i:'1'});
  expect(game.ownedCards[0].uid).toBe('source'); expect(ports.newUid).not.toHaveBeenCalled();
  expect(await acts.bagDiscoverConfirm()).toBe(true);
  expect(game.ownedCards[0].card.id).toBe(chosen); expect(ports.newUid).toHaveBeenCalledOnce();
});

it('candidate-save feedback keeps the selected card and current scroll position', async () => {
  let finish;
  ports.saveGame.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
  open(); await vi.waitFor(()=>expect(finish).toBeTypeOf('function')); const root=ports.UI.el.ovBody.firstElementChild;
  root.scrollTop=140; acts.bagDiscoverPick({i:'1'});
  finish(false); await vi.waitFor(()=>expect(root.querySelector('.reward-notice').textContent).toContain('候选尚未保存'));
  expect(ports.UI.el.ovBody.firstElementChild).toBe(root);
  expect(root.scrollTop).toBe(140);
  expect(root.querySelector('[data-i="1"]').dataset.discoverySelected).toBe('true');
  expect(root.querySelector('.reward-notice').textContent).toContain('候选尚未保存');
});

it('a failed confirmation retries the same selected card without rebuilding the discovery page', async () => {
  open(); const root=ports.UI.el.ovBody.firstElementChild, source=game.ownedCards[0];
  root.scrollTop=90; acts.bagDiscoverPick({i:'1'});
  const confirm=acts.bagDiscoverConfirm;
  ports.saveGame.mockReturnValueOnce(false);
  expect(await confirm()).toBe(false);
  expect(ports.UI.el.ovBody.firstElementChild).toBe(root); expect(root.scrollTop).toBe(90);
  expect(root.querySelector('[data-i="1"]').dataset.discoverySelected).toBe('true');
  expect(game.ownedCards).toEqual([source]);
  expect(await confirm()).toBe(true);
  expect(game.ownedCards).toHaveLength(1); expect(game.ownedCards[0].card.id).toBe(source.bagDiscover.cardIds[1]);
});

it.each([false,true])('a late save result %s leaves a replacement page in place', async saved => {
  open(); await vi.waitFor(()=>expect(ports.UI.el.ovBody.querySelector('.reward-notice').textContent).not.toContain('正在保存')); const source=game.ownedCards[0];
  let finish;
  ports.saveGame.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
  acts.bagDiscoverPick({i:'0'}); const pending=acts.bagDiscoverConfirm();
  await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  ports.UI.el.ovBody.innerHTML='<section id="new-view">其他页面</section>';
  const next=ports.UI.el.ovBody.firstElementChild;
  await vi.waitFor(()=>expect(finish).toBeTypeOf('function')); finish(saved); expect(await pending).toBe(saved);
  expect(ports.UI.el.ovBody.firstElementChild).toBe(next); expect(ports.showBackpack).not.toHaveBeenCalled();
  expect(game.ownedCards).toHaveLength(1);
  expect(game.ownedCards[0].uid).toBe(saved ? 'reward' : source.uid);
});

it.each(['false','throw','reject'])('a %s cancellation failure preserves selection for retry', async failure => {
  open(); const root=ports.UI.el.ovBody.firstElementChild;
  acts.bagDiscoverPick({i:'1'});
  if (failure === 'false') ports.showBackpack.mockReturnValueOnce(false);
  else if (failure === 'throw') ports.showBackpack.mockImplementationOnce(() => {throw new Error('return failed');});
  else ports.showBackpack.mockRejectedValueOnce(new Error('return rejected'));
  expect(await acts.bagDiscoverCancel()).toBe(false);
  expect(ports.UI.el.ovBody.firstElementChild).toBe(root);
  expect(root.querySelector('[data-i="1"]').dataset.discoverySelected).toBe('true');
  expect(await acts.bagDiscoverCancel()).toBe(true);
  expect(game.ownedCards[0].uid).toBe('source');
});
