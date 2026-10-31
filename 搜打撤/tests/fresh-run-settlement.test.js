import { beforeEach, expect, it, vi } from 'vitest';

const actions = new Map();
const UI = { el:{}, showOverlay:vi.fn((_title,html)=>{document.body.innerHTML=`<div id="overlay"><div id="ovBody">${html}</div></div>`;UI.el={overlay:document.getElementById("overlay"),ovBody:document.getElementById("ovBody")};}), log:vi.fn(), refresh:vi.fn(), act:(name, fn) => actions.set(name,fn) };
window.SDT = { UI, Sound:{sfx:vi.fn(),music:vi.fn()}, FX:{feedback:vi.fn()},
  Cards:{cardHTML:card => `<span>${card.name}</span>`} };
const { createDeathSettlement, buildDeathReceipt } = await import('../game/src/run/game.session.death.js');
let activeSlot, generation, progress, base, game, commit, doDeath, openBaseHub;
const html = () => UI.showOverlay.mock.calls.at(-1)?.[1] || '';
beforeEach(() => {
  activeSlot=1; generation=0; actions.clear(); UI.showOverlay.mockClear(); UI.log.mockClear();
  progress={cls:'侠客',lv:1,xp:70,need:90};
  base={slot:1,carriedPet:() => ({name:'旺财'})}; window.SDT.Base=base;
  window.SDT.Meta={classSummary:() => [progress],checkUnlocks:vi.fn(),classLv:() => progress.lv,perkText:() => ''};
  game={runActive:true,state:'idle',hp:0,maxHp:30,myClass:'侠客',surrenderedRun:false,inventory:[],ownedCards:[],usedPocket:[],turn:3,elapsed:5,terminalPending:null,pos:{x:0,y:0}};
  commit=vi.fn(async () => {progress={...progress,xp:75};return {ok:true,receipt:{output:{levelsGained:0}}};});
  openBaseHub=vi.fn();
  ({doDeath}=createDeathSettlement({ game,runtime:{openBaseHub},
    terminalCommands:{createAttempt:async () => ({ok:true,attempt:{}}),commitAttempt:(...args) => commit(...args)},
    getActiveSlot:() => activeSlot,getTerminalGeneration:() => generation,nextTerminalGeneration:() => ++generation,
    cardStacks:() => game.ownedCards.filter(o => o.safe).map(o => ({card:o.card,count:1})),safeUsed:() => 1,safeCap:() => 2,pearlBoxId:'pearl' }));
});

it('counts rescued copies instead of excluding every shared card reference', () => {
  const card={id:'wood',name:'木材',type:'资源'};
  expect(buildDeathReceipt({game:{...game,ownedCards:[{card,safe:true},{card,safe:false}]},rescuedCards:[{card,count:1}]}).losses.lostCount).toBe(1);
});

it('separates lost resource cards, loose materials, rescued cards and final XP from cumulative progress', async () => {
  const card={id:'wood',name:'木材',type:'资源'};
  game.ownedCards=[{card,safe:true},{card,safe:false}];
  game.inventory=[{name:'口粮',count:2,value:3}];
  await doDeath();
  expect(html()).toContain('旺财抢运回基地'); expect(html()).not.toContain('宠物阿七');
  expect(html()).toContain('资源卡散失：木材 ×1');
  expect(html()).toContain('已抢运资源卡：木材 ×1');
  expect(html()).toContain('散装物资散失：口粮 ×2');
  expect(html()).toContain('散装物资估值损失'); expect(html()).toContain('>6</b>');
  expect(html()).toContain('仓库“使用”才折入基地材料数字');
  expect(html()).toContain('本次失败结算 <b class="gold">+5 XP</b>');
  expect(html()).toContain('当前累计进度 Lv.1：75/90'); expect(html()).not.toContain('本局 <b');
});

it('renders a snapshot of the real final turn, remaining boss and attributed damage with adjacent coverage', async () => {
  const summary={round:7,remainingFoes:[{name:'异能领主',hp:4,maxHp:48}],damageTaken:[{source:'异能领主',damage:9,round:6},{source:'中毒',damage:2,round:7},{source:'灼烧',damage:1,round:7}],damageCoverage:'记录敌方直接攻击与回合末中毒、灼烧；其他卡牌或反噬伤害未归因。'};
  await doDeath({battleSummary:summary,battleIsBoss:true});
  expect(html()).toContain('最后第 7 回合');expect(html()).toContain('首脑剩余：异能领主 4/48 生命');
  expect(html()).toContain('异能领主 9、中毒 2、灼烧 1');expect(html()).toContain('反噬伤害未归因');
});

it('keeps the partner and review captured before async settlement instead of reading changed UI state', async () => {
  let resolve;
  commit.mockImplementation(() => new Promise(done => {resolve=done;}));
  game.ownedCards=[{card:{id:'safe',name:'安全卡'},safe:true}];
  const summary={round:2,remainingFoes:[{name:'首脑',hp:3,maxHp:50}],damageTaken:[]};
  const pending=doDeath({battleSummary:summary,battleIsBoss:true}); await Promise.resolve(); await Promise.resolve();
  base.carriedPet=() => ({name:'后来选择的伙伴'}); summary.remainingFoes[0].hp=40;
  resolve({ok:true,receipt:{output:{levelsGained:0}}}); await pending;
  expect(html()).toContain('旺财抢运回基地');expect(html()).not.toContain('后来选择的伙伴');
  expect(html()).toContain('首脑 3/50 生命');
});

it('ignores an async completion after the active save changes', async () => {
  let resolve;
  commit.mockImplementation(() => new Promise(done => {resolve=done;}));
  const pending=doDeath();await Promise.resolve();await Promise.resolve();
  expect(html()).toContain('正在保存结算');
  const savingPage=UI.el.ovBody.firstElementChild, calls=UI.showOverlay.mock.calls.length;
  activeSlot=2;base.slot=2;resolve({ok:true});expect(await pending).toBe(false);
  expect(UI.showOverlay).toHaveBeenCalledTimes(calls);
  expect(UI.el.ovBody.firstElementChild).toBe(savingPage);
  expect(openBaseHub).not.toHaveBeenCalled();
});

it.each([false,true])('uses an honest reason without inventing a battle review when surrender=%s', async surrender => {
  game.surrenderedRun=surrender;await doDeath({reason:'事件中失血'});
  expect(html()).toContain(surrender ? '你主动选择撤离，按失败结算' : '事件中失血');
  expect(html()).toContain('本次没有战斗摘要');expect(html()).not.toContain('首脑剩余');
});

it('reports the final failure XP even when it crosses a level', async () => {
  progress={cls:'侠客',lv:1,xp:47,need:50};
  commit.mockImplementation(async () => {progress={cls:'侠客',lv:2,xp:2,need:80};return {ok:true,receipt:{output:{levelsGained:1}}};});
  await doDeath();expect(html()).toContain('+5 XP');expect(html()).toContain('当前累计进度 Lv.2：2/80');
});


it('keeps zero losses and zero rescued cards visible without three empty statistic tiles', async () => {
  await doDeath(); document.body.innerHTML=html();
  const stats=document.querySelector('.ui-facts');
  expect(stats.querySelectorAll('.ui-facts > div')).toHaveLength(2);
  expect(stats.textContent).toContain('卡牌散失0 张');
  expect(document.querySelector('.settlement-notes').textContent).toContain('消耗区另散失 0 张');
  expect(stats.textContent).toContain('抢运回基地0 张');
  expect(document.querySelector('.settlement-notes').textContent).toContain('安全格占用 1/2');
  expect(stats.textContent).not.toContain('估值损失');
  expect(document.querySelector('.settlement-details').open).toBe(false);
  expect(document.querySelector('.settlement-details summary').textContent).toBe('物资明细与保留规则');
});

it('keeps long loss lists and full damage attribution in native details after the review summary', async () => {
  game.ownedCards=[{card:{id:'legend',name:'极长的传说卡牌名称<不可执行>',rarity:'传说'}}];
  game.usedPocket=[{count:37}];
  await doDeath({battleSummary:{round:6,remainingFoes:[{name:'首脑',hp:17,maxHp:45}],damageTaken:[{source:'中毒',damage:3}]},battleIsBoss:true});
  document.body.innerHTML=html();
  const panel=document.querySelector('.settlement-content');
  const review=panel.querySelector('.settlement-review');
  const details=panel.querySelector('.settlement-details');
  expect(panel.querySelector('.ui-facts').textContent).toContain('卡牌散失1 张');
  expect(panel.querySelector('.settlement-notes').textContent).toContain('消耗区另散失 37 张');
  expect(details.textContent).toContain('极长的传说卡牌名称<不可执行>');
  expect(details.querySelector('不可执行')).toBeNull();
  expect([...panel.children].indexOf(review)).toBeLessThan([...panel.children].indexOf(details));
  expect(review.textContent).toContain('首脑剩余：首脑 17/45 生命');
  const damage=review.querySelector('details');
  expect(damage.open).toBe(false);
  expect(damage.textContent).toContain('中毒 3');
  expect(damage.textContent).toContain('其他卡牌或反噬伤害未归因');
});

it('keeps both terminal actions unique and opens the same deployment destination', async () => {
  await doDeath();
  for (const action of ['goBase','again']) {
    expect(document.querySelectorAll(`[data-act="${action}"]`)).toHaveLength(1);
    await actions.get(action)();
  }
  expect(openBaseHub.mock.calls).toEqual([['deploy'],['departure']]);
});
