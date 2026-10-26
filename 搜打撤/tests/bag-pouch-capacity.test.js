import { runPendingFields } from './helpers/environment-fixtures.js';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';

let session, game, showBackpack, UI;
const pouch = { id: 'tt7-stratagem', name: '法师锦囊', type: '武术', rarity: '稀有' };
const spell = { id: 'capacity-spell', name: '容量法术', type: '法术', rarity: '稀有' };
const pearl = { id: 'tt2-pearlbox', name: '珍珠盒', type: '武术', rarity: '稀有' };

beforeAll(async () => {
  document.body.innerHTML = readFileSync('game/index.html', 'utf8');
  window.SDT = { Icons: { img: () => '', rich: String, TYPE_ART: {} },
    Sound: { music() {}, sfx: vi.fn(), setDucked() {} }, FX: { feedback() {} } };
  await import('../game/src/cards/cards.js');
  await import('../game/src/ui/ui.js');
  await import('../game/src/hub/base.js');
  session = await import('../game/src/run/game.session.js');
  ({ showBackpack } = await import('../game/src/hub/game.bag.js'));
  game = session.game;
  UI = window.SDT.UI;
  UI.init(); UI.log = vi.fn(); UI.refresh = () => {};
  window.SDT.Cards.cardHTML = c => `<span>${c.name}</span>`;
  window.SDT.Cards.cardBackHTML = () => '';
  vi.spyOn(window.SDT.Base, 'bagCap').mockReturnValue(16);
  window.SDT.Chests = { isOpen: () => false };
  session._set_active_slot(null);
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(game, { runActive: true, state: 'idle', myClass: '法师', inventory: [],
    ...runPendingFields() });
});
afterEach(() => UI.hideOverlay({ immediate: true }));

function arrange(occupied, bagCopies = 0, storedCopies = 3, withPearl = false) {
  game.ownedCards = [{ uid: 'pouch', card: pouch },
    ...(withPearl ? [{ uid: 'pearl', card: pearl }] : []),
    ...Array.from({ length: bagCopies }, (_, i) => ({ uid: `bag${i}`, card: spell })),
    ...Array.from({ length: storedCopies }, (_, i) => ({ uid: `stored${i}`, card: spell, stored: 1, pouchOf: pouch.id }))];
  const cardSlots = session.cardStacks(false).length;
  game.inventory = Array.from({ length: occupied - cardSlots }, (_, i) => ({ name: `物资${i}`, value: 1, count: 1 }));
  expect(session.usedSlots()).toBe(occupied);
  showBackpack(true);
  UI._acts.inspectStack({ name: pouch.name, safe: '0' });
  UI._acts.pouchStoreZoom();
}
async function take() { await UI._acts.pouchTake({ name: spell.name }); }

it('锦囊存取读取声明容量和类型，整叠超限不消费卡牌', async () => {
  arrange(4, 3, 0);
  game.ownedCards[0].card = { ...pouch, rules:{ version:1, equip:{ container:{ slots:2, accepts:'法术' } } } };
  showBackpack(true);
  UI._acts.inspectStack({ name:pouch.name, safe:'0' }); UI._acts.pouchStoreZoom();
  const before = JSON.stringify(game.ownedCards);
  await UI._acts.pouchPut({ name:spell.name });
  expect(JSON.stringify(game.ownedCards)).toBe(before);
  expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('0/2'), 'warn');
});

it.each([0, 3])('满包整叠取出拒绝且锦囊与物资原样保留（已有同名 %i 张）', async bagCopies => {
  arrange(16, bagCopies);
  const cards = JSON.stringify(game.ownedCards), items = JSON.stringify(game.inventory);
  await take();
  expect(session.usedSlots()).toBe(16);
  expect(JSON.stringify(game.ownedCards)).toBe(cards);
  expect(JSON.stringify(game.inventory)).toBe(items);
  expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('背包放不下'), 'warn');
});
it('正好一个空格可取出整叠，保留卡牌总数及物资', async () => {
  arrange(15);
  const count = game.ownedCards.length, items = JSON.stringify(game.inventory);
  await take();
  expect(session.usedSlots()).toBe(16);
  expect(game.ownedCards).toHaveLength(count);
  expect(game.ownedCards.filter(o => o.pouchOf || o.stored)).toHaveLength(0);
  expect(JSON.stringify(game.inventory)).toBe(items);
});
it('满包同名叠放还有余位时允许无新增格的取出', async () => {
  arrange(16, 1, 2);
  await take();
  expect(session.usedSlots()).toBe(16);
  expect(game.ownedCards.filter(o => o.card.id === spell.id && !o.stored)).toHaveLength(3);
});
it('珍珠盒有空扩格也不能让法术占用资源专属格', async () => {
  arrange(16, 0, 3, true);
  expect(session.bagCap()).toBe(25);
  const before = JSON.stringify(game.ownedCards);
  await take();
  expect(session.usedSlots()).toBe(16);
  expect(JSON.stringify(game.ownedCards)).toBe(before);
  expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('珍珠盒额外格仅收资源卡'), 'warn');
});


function openCanonicalPouch(extra = []) {
  const Cards = window.SDT.Cards;
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
  const get = id => structuredClone(Cards.all().find(c => c.id === id));
  game.ownedCards = ['tt7-stratagem', 'tt3-firm-barrier', 'tt7-frozenight'].map((id, i) => ({uid:`class-${i}`,card:get(id)})).concat(extra);
  showBackpack(true);
  UI._acts.inspectStack({name:'法师锦囊',safe:'0'});
  UI._acts.pouchStoreZoom();
}
it('真实背包锦囊接受坚冰结界与冰封千里职业法术并可原样取出', async () => {
  openCanonicalPouch();
  const cardsBefore = game.ownedCards.map(o => JSON.stringify(o.card));
  for (const name of ['坚冰结界','冰封千里']) {
    expect(document.querySelector(`[data-act="pouchPut"][data-name="${name}"]`)).not.toBeNull();
    await UI._acts.pouchPut({name});
    expect(game.ownedCards.find(o => o.card.name === name)).toMatchObject({stored:1,pouchOf:pouch.id});
  }
  expect(document.body.textContent.replace(/\s/g, '')).toContain('2/3');
  for (const name of ['坚冰结界','冰封千里']) await UI._acts.pouchTake({name});
  expect(game.ownedCards.every(o => !o.stored && !o.pouchOf)).toBe(true);
  expect(game.ownedCards.map(o => JSON.stringify(o.card))).toEqual(cardsBefore);
});
it('职业法术与普通法术共用3张上限，锦囊自身和非术不能直接命令存入', async () => {
  openCanonicalPouch([{uid:'pouch-other',card:{id:pouch.id,name:'另一只法师锦囊',type:'法术',cls:'法师'}},{uid:'normal',card:spell},{uid:'overflow',card:{...spell,id:'overflow',name:'第四张'}},{uid:'move',card:{id:'move',name:'武术卡',type:'武术'}}]);
  expect(document.querySelector('[data-act="pouchPut"][data-name="法师锦囊"]')).toBeNull();
  await UI._acts.pouchPut({name:'法师锦囊'}); await UI._acts.pouchPut({name:'另一只法师锦囊'}); await UI._acts.pouchPut({name:'武术卡'});
  expect(game.ownedCards.filter(o => o.stored)).toHaveLength(0);
  for (const name of ['坚冰结界','冰封千里',spell.name]) await UI._acts.pouchPut({name});
  expect(game.ownedCards.filter(o => o.stored)).toHaveLength(3);
  await UI._acts.pouchPut({name:'第四张'});
  expect(game.ownedCards.find(o => o.uid === 'overflow').stored).toBeUndefined();
  expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('锦囊装不下整叠'), 'warn');
});

it('安全格与已经存放的职业法术仍不作为背包候选', async () => {
  openCanonicalPouch();
  game.ownedCards.find(o => o.card.name === '坚冰结界').safe = true;
  Object.assign(game.ownedCards.find(o => o.card.name === '冰封千里'), {stored:1,pouchOf:pouch.id});
  UI._acts.pouchBack();
  UI._acts.inspectStack({name:'法师锦囊',safe:'0'}); UI._acts.pouchStoreZoom();
  expect(document.querySelectorAll('[data-act="pouchPut"]')).toHaveLength(0);
  const before = JSON.stringify(game.ownedCards);
  await UI._acts.pouchPut({name:'坚冰结界'}); await UI._acts.pouchPut({name:'冰封千里'});
  expect(JSON.stringify(game.ownedCards)).toBe(before);
});

it('真实背包存取两种资源：盒内独立张数不占外部格',async ()=>{
 const key={id:'key',name:'神秘钥匙卡',type:'资源'},wood={id:'wood',name:'一捆木材',type:'资源'};
 game.ownedCards=[{uid:'pearl',card:pearl},{uid:'key',card:key},{uid:'wood',card:wood}];
 game.inventory=Array.from({length:12},(_,i)=>({name:`外部物资${i}`,value:1,count:1}));
 showBackpack(true);expect(session.usedSlots()).toBe(15);
 expect(UI.el.ovBody.querySelector('.bag-capchip').textContent).toContain('盒内 0/9 张（不占格）');
 UI._acts.inspectStack({name:pearl.name,safe:'0'});UI._acts.pearlStoreZoom();
 await UI._acts.pearlPut({name:key.name});await UI._acts.pearlPut({name:wood.name});
 expect(game.ownedCards).toHaveLength(3);expect(game.ownedCards.filter(o=>o.stored&&!o.pouchOf)).toHaveLength(2);
 expect(UI.el.ovBody.textContent.replace(/\s/g, '')).toContain('2/9');expect(session.usedSlots()).toBe(13);
 UI._acts.pearlBack();expect(UI.el.ovBody.querySelector('.bag-capchip').textContent).toContain('盒内 2/9 张（不占格）');
 expect(UI.el.ovBody.textContent).toContain('资源扩展格 0/9');
 UI._acts.inspectStack({name:pearl.name,safe:'0'});UI._acts.pearlStoreZoom();
 await UI._acts.pearlTake({name:key.name});await UI._acts.pearlTake({name:wood.name});
 expect(game.ownedCards.filter(o=>o.stored)).toHaveLength(0);expect(game.ownedCards).toHaveLength(3);expect(session.usedSlots()).toBe(15);
 UI._acts.pearlBack();expect(UI.el.ovBody.querySelector('.bag-capchip').textContent).toContain('盒内 0/9 张（不占格）');
});

it.each([[0,0],[1,0],[1,9],[2,10]])('背包摘要区分盒数%s/盒内%s张并排除锦囊', (boxes, stored) => {
  game.inventory = [];
  game.ownedCards = [
    ...Array.from({ length: boxes }, (_, i) => ({ uid: `pearl-${i}`, card: pearl, safe: i === 1 })),
    ...Array.from({ length: stored }, (_, i) => ({ uid: `res-${i}`, card: { id: 'resource', name: '木材', type: '资源' }, stored: 1 })),
    { uid: 'pouch', card: pouch },
    { uid: 'pouch-spell', card: spell, stored: 1, pouchOf: pouch.id },
  ];
  showBackpack(true);
  const text = UI.el.ovBody.querySelector('.bag-capchip').textContent;
  if (boxes) expect(text).toContain(`盒内 ${stored}/${boxes * 9} 张（不占格）`);
  else expect(text).not.toContain('盒内');
  expect(game.bagCapacityText()).toContain(boxes ? `资源扩展格 0/${boxes * 9}` : '/16 格');
});

it('奖励腾位只操作可见普通背包UID：移安全格保容器，同名丢弃1张不假称腾格', async () => {
  const {bagSlots}=await import('../game/src/hub/game.bag.bridge.js');
  const source={id:'organize',name:'腾位法术',type:'法术',rarity:'古朴'};
  game.ownedCards=[0,1,2].map(i=>({uid:`normal-${i}`,card:source}));
  game.ownedCards.push({uid:'stored-copy',card:source,stored:1,pouchOf:'pouch'});
  game.inventory=[]; game.state='modal';
  const options={card:spell,current:()=>true,onReturn:vi.fn(),onClaim:vi.fn(),onFullBag:vi.fn()};
  bagSlots.organizeReward(options);
  document.querySelector('[data-organize="discard"]').click(); await settleContainer();
  expect(game.ownedCards).toHaveLength(4);
  document.querySelector('[data-organize="confirm"]').click(); await settleContainer();
  expect(game.ownedCards.map(o=>o.uid)).toEqual(['normal-1','normal-2','stored-copy']);
  expect(session.usedSlots()).toBe(1);
  document.querySelector('[data-organize="safe"]').click(); await settleContainer();
  expect(game.ownedCards.filter(o=>o.safe).map(o=>o.uid)).toEqual(['normal-1','normal-2']);
  expect(game.ownedCards.find(o=>o.uid==='stored-copy')).toMatchObject({stored:1,pouchOf:'pouch'});
  expect(game.ownedCards.find(o=>o.uid==='stored-copy').safe).toBeFalsy();
});

it('真实箱奖励直接开完整背包，Esc返回无损；存安全格后原grant仅领取一次', async () => {
  await import('../game/src/run/chests.js');
  const Chests=window.SDT.Chests;
  const reward={id:'organizer-reward',name:'腾位奖励',type:'法术',rarity:'古朴'};
  Object.assign(game,{seed:77,layerIdx:0,trackPos:0,discoveredPairs:new Set(),state:'modal'});
  game.ownedCards=Array.from({length:16},(_,i)=>({uid:`full-${i}`,card:{id:`full-${i}`,name:`占位${i}`,type:'法术',rarity:'古朴'}}));
  game.inventory=[];
  showBackpack(true); await UI._acts.closeBag();
  const {grantEventCard}=await import('../game/src/run/game.run.scenes.js');
  game.grantCard=(card,opts)=>grantEventCard(card,opts);
  expect(Chests.restore(game,{version:1,screen:'cards',seed:77,layerIdx:0,trackPos:0,queue:[{kind:'small'}],index:1,context:{onCell:true},
    current:{kind:'small',cards:[reward],coins:0,coinsReceived:false,taken:[],lost:[],rewardStage:'cards',claimMode:'all'}},()=>{})).toBe(true);
  UI._acts.chestMakeRoom({i:0});
  expect(document.querySelector('.bag-view')).not.toBeNull();
  expect(document.querySelector('.reward-capacity-organizer')).toBeNull();
  UI.closeTopOverlayByEsc();
  await vi.waitFor(()=>expect(document.querySelector('[data-act="chestMakeRoom"]')).not.toBeNull());
  expect(Chests.serialize(game).current.taken).toEqual([]);
  expect(Chests.serialize(game).current.lost).toEqual([]);
  expect(document.querySelector('[data-act="chestMakeRoom"]').textContent).toBe('整理背包');
  UI._acts.chestMakeRoom({i:0});
  UI._acts.inspectStack({name:'占位0',safe:'0'});
  await UI._acts.zoomMoveToSafe();
  expect(session.usedSlots()).toBe(15);
  await UI._acts.closeBag();
  const claim = UI._acts.chestTake1;
  await claim({i:0});
  expect(game.ownedCards.filter(o=>o.card.id===reward.id)).toHaveLength(1);
  expect(game.ownedCards.find(o=>o.uid==='full-0').safe).toBe(true);
  expect(UI._acts.chestTake1).toBeUndefined();
  claim({i:0});expect(game.ownedCards.filter(o=>o.card.id===reward.id)).toHaveLength(1);
});

it('奖励腾位安全格已满时不移动卡；存放/锦囊/初始攻击不列作腾位对象', async () => {
  const {bagSlots}=await import('../game/src/hub/game.bag.bridge.js');
  const normal={uid:'eligible',card:spell};
  game.ownedCards=[normal,{uid:'stored',card:{...spell,name:'盒内'},stored:1},
    {uid:'pouched',card:{...spell,name:'囊内'},pouchOf:'pouch'},
    {uid:'starter',card:window.SDT.Cards.SHA},
    ...Array.from({length:session.safeCap()},(_,i)=>({uid:`safe-${i}`,safe:true,card:{...spell,name:`安全${i}`}}))];
  game.inventory=[];game.state='modal';
  const before=JSON.stringify(game.ownedCards);
  bagSlots.organizeReward({card:spell,current:()=>true,onReturn:()=>{},onClaim:()=>{},onFullBag:()=>{}});
  expect(document.querySelectorAll('.reward-organizer-list article')).toHaveLength(1);
  expect(session.safeUsed()).toBe(session.safeCap());
  expect(session.usedSlots()).toBeLessThan(16);
  expect(game.canReceiveCard(spell)).toBe(true);
  const safeButton = document.querySelector('[data-organize="safe"]');
  expect(safeButton.disabled).toBe(true);
  expect(document.querySelector('.reward-safe-reason').textContent).toBe('整叠需 1 格，安全格余 0 格');
  expect(document.querySelector('[data-organize="claim"]').disabled).toBe(false);
  safeButton.click(); await settleContainer();
  expect(JSON.stringify(game.ownedCards)).toBe(before);
  expect(document.querySelector('.reward-organizer-receipt').textContent).toBe('已有位置，可以领取');
});


it.each([1, 3])('真实满包同名已有%i张：领取按钮、grant与安全格禁用各自准确', async copies => {
  const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
  const { grantEventCard } = await import('../game/src/run/game.run.scenes.js');
  game.ownedCards = [
    ...Array.from({length:copies}, (_, i) => ({uid:`bag-${i}`,card:spell})),
    ...Array.from({length:session.safeCap()}, (_, i) => ({uid:`safe-${i}`,safe:true,card:{...spell,name:`安全占位${i}`}})),
  ];
  game.inventory = Array.from({length:15}, (_, i) => ({name:`物资${i}`,count:1}));
  game.state = 'modal';
  const before = JSON.stringify(game.ownedCards);
  const onClaim = vi.fn(() => grantEventCard(spell, {silent:true}));
  bagSlots.organizeReward({card:spell,current:()=>true,onReturn:vi.fn(),onClaim,onFullBag:vi.fn()});
  expect(session.usedSlots()).toBe(16);
  expect(game.canReceiveCard(spell)).toBe(copies === 1);
  expect(document.querySelector('[data-organize="safe"]').disabled).toBe(true);
  const claim = document.querySelector('[data-organize="claim"]');
  expect(claim.disabled).toBe(copies === 3);
  claim.click(); await settleContainer(); claim.click(); await settleContainer();
  if (copies === 1) {
    expect(onClaim).toHaveBeenCalledOnce();
    expect(onClaim).toHaveReturnedWith(true);
    expect(game.ownedCards.filter(o=>!o.safe)).toHaveLength(2);
  } else {
    expect(onClaim).not.toHaveBeenCalled();
    expect(grantEventCard(spell, {silent:true})).toBe(false);
    expect(JSON.stringify(game.ownedCards)).toBe(before);
    expect(document.querySelector('.reward-organizer-receipt').textContent).toContain('安全格暂放不下这些整叠');
  }
  expect(session.usedSlots()).toBe(16);
});

it.each([[2,1,true],[2,2,false],[0,4,false]])('整叠移安全格：目的同名%i张/移动%i张，按真实增格判定%s', async (safeCopies, moving, fits) => {
  const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
  game.ownedCards = [
    ...Array.from({length:moving}, (_,i)=>({uid:`move-${i}`,card:spell})),
    ...Array.from({length:safeCopies}, (_,i)=>({uid:`same-${i}`,card:spell,safe:true})),
    ...Array.from({length:session.safeCap()-1}, (_,i)=>({uid:`other-${i}`,card:{...spell,name:`安全占位${i}`},safe:true})),
    {uid:'stored',card:spell,stored:1,pouchOf:pouch.id},
  ];
  game.inventory = Array.from({length:16-session.cardStacks(false).length}, (_,i)=>({name:`物资${i}`,count:1}));
  game.state = 'modal';
  const before = JSON.stringify(game.ownedCards);
  const reward = {...spell,id:'new-reward',name:'待领新牌'};
  bagSlots.organizeReward({card:reward,current:()=>true,onReturn:vi.fn(),onClaim:vi.fn(),onFullBag:vi.fn()});
  const safe = document.querySelector('[data-organize="safe"]');
  expect(safe.disabled).toBe(!fits);
  expect(document.querySelector('[data-organize="claim"]').disabled).toBe(true);
  safe.click(); await settleContainer();
  if (fits) {
    expect(game.ownedCards.find(o=>o.uid==='move-0').safe).toBe(true);
    expect(session.safeUsed()).toBe(session.safeCap());
    expect(session.usedSlots()).toBe(15);
    expect(document.querySelector('[data-organize="claim"]').disabled).toBe(false);
    expect(game.ownedCards.find(o=>o.uid==='stored')).toMatchObject({stored:1,pouchOf:pouch.id});
    expect(game.ownedCards.find(o=>o.uid==='stored').safe).toBeUndefined();
  } else {
    expect(JSON.stringify(game.ownedCards)).toBe(before);
    expect(session.usedSlots()).toBe(16);
    expect(document.querySelector('.reward-safe-reason').textContent).toBe(`整叠需 ${safeCopies ? 1 : 2} 格，安全格余 ${safeCopies ? 0 : 1} 格`);
  }
});

it('标题按真实session分列占格与张数，筛选不改变总数且排除容器内卡', () => {
  game.inventory = [{ name:'零散物资',value:1,count:4 }];
  game.ownedCards = [
    ...Array.from({length:7},(_,i)=>({uid:`count-${i}`,card:spell})),
    ...Array.from({length:5},(_,i)=>({uid:`safe-count-${i}`,card:spell,safe:1})),
    {uid:'stored-count',card:spell,stored:1,pouchOf:pouch.id},
  ];
  showBackpack(true);
  expect(session.usedSlots()).toBe(5); // 三堆卡 + 两格散装物资
  expect(UI.el.ovBody.querySelector('.bag-capchip').textContent).toMatch(/5\s*\/16 格/);
  expect(UI.el.ovBody.querySelector('.bag-count-summary').textContent).toContain('卡牌 7 张');
  expect(UI.el.ovBody.querySelector('.bag-count-summary').textContent).toContain('散装物资 4 件');
  UI._acts.bagFilter({f:'道具'});
  expect(UI.el.ovBody.querySelectorAll('.bag-tile')).toHaveLength(0);
  expect(UI.el.ovBody.querySelector('.bag-count-summary').textContent).toContain('卡牌 7 张');
  UI._acts.bagZone({zone:'safe'});
  expect(UI.el.ovBody.querySelector('.bag-capchip').textContent).toMatch(/2\s*\//);
  expect(UI.el.ovBody.querySelector('.bag-count-summary').textContent).toContain('卡牌 5 张');
});

it('装备整叠移入安全格按每张1格判断，空位不足不移动', async () => {
  const equip={id:'armor-test',name:'测试盔甲',type:'装备'};
  game.ownedCards=[{uid:'e1',card:equip},{uid:'e2',card:equip}];
  vi.spyOn(window.SDT.Base,'safeCap').mockReturnValueOnce(1);
  const {bagSlots}=await import('../game/src/hub/game.bag.bridge.js');
  bagSlots.moveStackSafe(equip.name,true,{refresh:false});
  expect(game.ownedCards.every(o=>!o.safe)).toBe(true);
});

const settleContainer = () => vi.waitFor(() => expect(document.querySelector('.pearl-store[aria-busy="true"], .pouch-store[aria-busy="true"], .reward-capacity-organizer[aria-busy="true"]')).toBeNull());
