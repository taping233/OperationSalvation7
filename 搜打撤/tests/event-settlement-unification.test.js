import { overlayElements, bindEventRoot, eventMapMocks, eventMapActions, eventUiMocks } from './helpers/environment-fixtures.js';
import { flushEventActions } from './helpers/event-dice-async.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventCardChoiceController } from '../game/src/run/event-card-choice.js';
import { createEventDiceController } from '../game/src/ui/event-dice.js';
import { recodeSourceMatches, recodeSourceSnapshot } from '../game/src/run/event-recode-candidates.js';
import { rollEventDice } from './helpers/event-dice-async.js';

const H = vi.hoisted(() => ({ game:{}, cards:[], saves:[], uid:0, slot:null,
  save:() => true, random:() => .9, narrative:async () => null }));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random:{ ...actual.Random, random:(...args) => H.random(...args) } };
});
vi.mock('../game/src/run/game.session.js', () => ({
  ...eventMapMocks(H), newUid:() => `event-u${++H.uid}`, pick:a => a[0],
  saveGame:async () => { const saved = await H.save(); if (saved !== false) H.saves.push(JSON.parse(JSON.stringify(H.game))); return saved; },
  scaledEnemy:a => a, getActiveSlot:() => H.slot, ...eventMapActions(H),
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx:{ tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML:c => `<span>${c.name}</span>` }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands:() => ({}), validatePendingExtraction:() => ({ ok:true }) }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands:{ inspect:() => ({ ok:true, value:{ kind:'complete' } }) } }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative:(...args) => H.narrative(...args), lastLampNarrative:async () => null }));

let UI, flow, scenes, setBagReturnHook, registeredChests;
beforeAll(async () => {
  window.SDT = { game:H.game, Icons:{ rich:x => x }, Sound:{ sfx() {} }, Meta:{ track() {}, addXpToProgress() {} }, Base:{ bagCap:() => 9 },
    MAP:{ chestKinds:{ small:{ name:'小型物资箱' } } },
    Cards:{ DROP_WEIGHTS:{ 古朴:1 }, all:() => H.cards, classPool:() => [], sellPrice:() => 1,
      isRandomObtainable:() => true, cardHTML:c => `<span>${c.name}</span>` } };
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, ...eventUiMocks(() => UI) };
  ({ setBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  flow = await import('../game/src/run/game.run.flow.js');
  scenes = await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js');
  // 静态依赖可能已初始化 facade；保留真实注册端口，避免替换测试门面丢失挂载。
  const { default:facade } = await import('../game/src/core/sdt-facade.js');
  registeredChests = facade.Chests;
});
beforeEach(() => {
  vi.useFakeTimers();
  window.SDT.Chests = registeredChests;
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { ...overlayElements() };
  bindEventRoot(() => UI);
  setBagReturnHook(null);
  H.cards = []; H.saves = []; H.uid = 0; H.slot = null; H.save = vi.fn(() => true); H.random = vi.fn(() => .9); H.narrative = async () => null;
  for (const key of Object.keys(H.game)) delete H.game[key];
  Object.assign(H.game, { seed:7, state:'idle', layerIdx:0, trackPos:1, hp:10, maxHp:35, visited:{}, ownedCards:[], usedPocket:[],
    myClass:'武', runActive:true, coins:18, fragments:0, nodeRewards:{}, discoveredPairs:new Set(),
    layerData:[{ logical:[{ def:{ type:'entrance' } }, { def:{ type:'event' } }] }],
    canReceiveCard:() => true, heal:n => H.game.hp = Math.min(H.game.maxHp, H.game.hp + n),
    grantCard:(card, opts) => scenes.grantEventCard(card, opts), bagCap:() => 9, usedSlots:() => H.game.ownedCards.length });
});
afterEach(() => { UI.hideOverlay({ immediate:true }); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

async function openEvent(id, cards = []) {
  H.cards = [{ id, name:'事件检查点', type:'事件' }, ...cards];
  const opening = flow.runEventDeck(); await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(1000);
  await opening;
}
const potion = { id:'event-potion', name:'测试药水', type:'道具', rarity:'古朴' };
async function choiceHarness(grant = scenes.grantEventCard) {
  H.cards = [potion];
  const close = vi.fn(() => { H.game.state = 'idle'; UI.hideOverlay(); });
  const controller = createEventCardChoiceController({ game:H.game, UI, SDT:window.SDT, saveGame:() => H.save(),
    getActiveSlot:() => 'slot', nodeShell:scenes.nodeShell, grantEventCard:grant, consumeCurrentCell:scenes.consumeCurrentCell,
    captureContext:() => () => H.game.state !== 'title', close });
  await controller.open('ev19-potions', [potion]);
  return { controller, close, record:H.game.nodeRewards['0,1'] };
}
function failSave(mode) { H.save = vi.fn(() => { if (mode === 'throw') throw new Error('storage unavailable'); return false; }); }

describe('事件卡牌授予与保存检查点', () => {
  it('授予日志同步重入时，预留 taken 阻止同一候选再发一张', async () => {
    const h = await choiceHarness();
    const pick = UI._acts.eventCardPick;
    vi.spyOn(UI, 'log').mockImplementation(() => pick({ i:'0' }));
    await pick({ i:'0' }); await flushEventActions(); await pick({ i:'0' }); await flushEventActions();
    expect(H.game.ownedCards.map(entry => entry.card.id)).toEqual([potion.id]);
    expect(h.record.taken).toBe(0); expect(h.close).toHaveBeenCalledOnce();
  });

  it.each(['false', 'throw'])('领取后的保存 %s 保留已发事实，恢复与重试只保存', async mode => {
    const h = await choiceHarness(); const pick = UI._acts.eventCardPick;
    failSave(mode); await pick({ i:'0' }); await flushEventActions(); await pick({ i:'0' }); await flushEventActions();
    expect(H.game.ownedCards).toHaveLength(1); expect(h.record.taken).toBe(0);
    expect(h.close).not.toHaveBeenCalled(); expect(H.game.state).toBe('modal');
    expect(h.controller.resume()).toBe(true);
    expect(UI.el.ovBody.textContent).toContain('不会再次发牌');
    H.save = vi.fn(() => true); await UI._acts.eventCardSaveRetry(); await flushEventActions();
    expect(H.game.ownedCards).toHaveLength(1); expect(h.close).toHaveBeenCalledOnce();
  });

  it.each([false, true])('授予异常只有确认未入包才释放选择（已入包=%s）', async received => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const grant = vi.fn(card => { if (received) H.game.ownedCards.push({ uid:'actual', card:{ ...card } }); throw new Error('late presentation'); });
    const h = await choiceHarness(grant); await UI._acts.eventCardPick({ i:'0' }); await flushEventActions();
    expect(h.record.taken).toBe(received ? 0 : null);
    expect(H.game.ownedCards).toHaveLength(received ? 1 : 0);
    if (!received) { grant.mockImplementation(scenes.grantEventCard); await UI._acts.eventCardPick({ i:'0' }); await flushEventActions(); expect(H.game.ownedCards).toHaveLength(1); }
  });

  it('候选初次保存抛错仍保留原候选与未领取状态', async () => {
    failSave('throw'); const h = await choiceHarness();
    expect(h.record).toMatchObject({ taken:null, cardIds:[potion.id] });
    expect(UI.el.ovBody.textContent).toContain('尚未保存成功');
    expect(H.game.ownedCards).toHaveLength(0);
  });
});

describe('事件节点结算与恢复', () => {
  it.each(['false', 'throw'])('投骰选择保存 %s 时不留下可自动执行的 actionChoice', async mode => {
    await openEvent('tt6-mystery'); failSave(mode);
    await UI._acts.evtChoice({ i:'0' }); await flushEventActions();
    expect(H.game.nodeRewards['0,1'].actionChoice).toBeUndefined();
    expect(H.game.nodeRewards['0,1'].dice).toBeUndefined();
    expect(H.game.coins).toBe(18); expect(H.game.visited).toEqual({});
    H.save = vi.fn(() => true); await openEvent('tt6-mystery');
    expect(UI.el.ovBody.querySelector('.event-dice-panel')).toBeNull();
    await UI._acts.evtChoice({ i:'1' }); await flushEventActions(); expect(H.game.nodeRewards['0,1'].settled).toBe(true);
  });

  it.each(['false', 'throw'])('即时资源结算保存 %s 保留完成标记，重入不加第二份', async mode => {
    await openEvent('tt6-systemsupply', [{ id:'tt-wood', name:'木材', type:'资源', rarity:'古朴' }]);
    failSave(mode); await UI._acts.evtChoice({ i:'1' }); await flushEventActions();
    expect(H.game.coins).toBe(20); expect(H.game.fragments).toBe(1);
    expect(H.game.nodeRewards['0,1'].settled).toBe(true); expect(H.game.state).toBe('modal');
    expect(UI.el.ovBody.querySelector('[data-act="eventSaveRetry"]')).not.toBeNull();
    H.save = vi.fn(() => true); await flow.runEventDeck();
    expect(H.game.coins).toBe(20); expect(H.game.fragments).toBe(1); expect(H.game.state).toBe('idle');
  });

  it('木材实际入包时日志重入不重复授予，碎片与完成标记一起保存', async () => {
    await openEvent('tt6-systemsupply', [{ id:'tt-wood', name:'木材', type:'资源', rarity:'古朴' }]);
    const pick = UI._acts.evtChoice;
    vi.spyOn(UI, 'log').mockImplementation(() => { pick({ i:'0' }); void flow.runEventDeck(); });
    await pick({ i:'0' }); await flushEventActions();
    expect(H.game.ownedCards.map(entry => entry.card.id)).toEqual(['tt-wood']);
    expect(H.game.fragments).toBe(1); expect(H.game.nodeRewards['0,1'].settled).toBe(true);
    expect(H.saves.at(-1)).toMatchObject({ fragments:1, nodeRewards:{ '0,1':{ settled:true } } });
  });

  it('pending 投骰从 JSON 恢复原结果，确认后的再次入口不重复结算', async () => {
    await openEvent('tt6-mystery'); await UI._acts.evtChoice({ i:'0' }); await flushEventActions(); await UI._acts.eventDiceRoll(); await flushEventActions();
    const record = JSON.parse(JSON.stringify(H.game.nodeRewards['0,1']));
    H.game.nodeRewards['0,1'] = record;
    await openEvent('tt6-mystery'); await UI._acts.eventDiceContinue(); await flushEventActions();
    expect(H.game.coins).toBe(21); expect(record).toMatchObject({ settled:true });
    expect(record.actionChoice).toBeUndefined();
    await flow.runEventDeck(); expect(H.game.coins).toBe(21); expect(H.random.mock.calls.filter(args => args[0] === 'event')).toHaveLength(1);
  });

  it('最后一骰的固定奖励未承接时留骰页，重试不多加一张候选', async () => {
    const move = { id:'event-move', name:'防身招式', type:'武术', rarity:'古朴' };
    await openEvent('tt6-relief', [move]); await UI._acts.evtChoice({ i:'1' }); await flushEventActions(); await UI._acts.eventDiceRoll(); await flushEventActions();
    vi.spyOn(window.SDT.Chests, 'restore').mockReturnValueOnce(false);
    await UI._acts.eventDiceContinue(); await flushEventActions();
    expect(UI.el.ovBody.querySelector('.event-dice-panel')).not.toBeNull();
    expect(H.game.nodeRewards['0,1'].settled).not.toBe(true);
    expect(H.game.nodeRewards['0,1'].actionChoice).toBe(1); expect(H.game.visited).toEqual({});
    await UI._acts.eventDiceContinue(); await flushEventActions();
    expect(window.SDT.Chests.serialize(H.game).current.cards.map(card => card.id)).toEqual([move.id]);
    expect(H.game.nodeRewards['0,1'].settled).toBe(true);
    expect(H.random.mock.calls.filter(args => args[0] === 'event')).toHaveLength(1);
  });

  it('事件左上退出保存抛错时留重试页，不消费尚未选择的节点', async () => {
    await openEvent('tt6-mystery'); failSave('throw');
    await UI._acts.eventExit(); await flushEventActions();
    expect(H.game.state).toBe('modal'); expect(H.game.visited).toEqual({});
    expect(UI.el.ovBody.querySelector('[data-act="eventSaveRetry"]')).not.toBeNull();
    H.save = vi.fn(() => true); await UI._acts.eventSaveRetry(); await flushEventActions();
    expect(H.game.state).toBe('idle'); expect(H.game.coins).toBe(18);
  });

  it('黑市命中但奖励未承接时保留本次付费投骰，重进后不再付一次', async () => {
    const prizes = [{ id:'market-equip', name:'装备', type:'装备', rarity:'古朴' },
      ...[1, 2].map(i => ({ id:`market-move${i}`, name:`招式${i}`, type:'武术', rarity:'古朴' }))];
    await openEvent('ev19-gamble', prizes); await UI._acts.evtChoice({ i:'0' }); await flushEventActions(); await rollEventDice(UI);
    await UI._acts.eventGambleTry(); await flushEventActions(); await UI._acts.eventDiceRoll(); await flushEventActions();
    vi.spyOn(window.SDT.Chests, 'restore').mockReturnValueOnce(false);
    await UI._acts.eventDiceContinue(); await flushEventActions();
    expect(H.game.coins).toBe(15); expect(H.game.nodeRewards['0,1'].gamble.pending).toBe(1);
    await UI._acts.eventDiceLeave(); await flushEventActions(); await openEvent('ev19-gamble', prizes);
    await UI._acts.eventDiceContinue(); await flushEventActions();
    expect(H.game.coins).toBe(15); expect(H.game.nodeRewards['0,1'].settled).toBe(true);
    expect(window.SDT.Chests.serialize(H.game).current.cards).toHaveLength(3);
  });

  it('首次待领快照已含事件完成凭据，后续保存失败再重载也不能重开奖或扣币', async () => {
    const prizes = [{ id:'receipt-equip', name:'凭据装备', type:'装备', rarity:'古朴' },
      ...[1, 2].map(i => ({ id:`receipt-move${i}`, name:`凭据招式${i}`, type:'武术', rarity:'古朴' }))];
    await openEvent('ev19-gamble', prizes); await UI._acts.evtChoice({ i:'0' }); await flushEventActions(); await rollEventDice(UI);
    await UI._acts.eventGambleTry(); await flushEventActions(); await UI._acts.eventDiceRoll(); await flushEventActions();
    let intermediate = null;
    H.game.persistSave = () => H.save();
    H.save = vi.fn(() => {
      if (intermediate) return false;
      if (H.game.nodeChestRewards?.['0,1']) intermediate = JSON.parse(JSON.stringify(H.game));
      return true;
    });
    await UI._acts.eventDiceContinue(); await flushEventActions();
    expect(intermediate?.nodeRewards['0,1']).toMatchObject({ settled:true });
    expect(intermediate.nodeRewards['0,1'].actionChoice).toBeUndefined();
    expect(intermediate.coins).toBe(15); expect(intermediate.nodeChestRewards['0,1'].current.cards).toHaveLength(3);
    expect(H.save.mock.results.some(result => result.value === false)).toBe(true);

    Object.assign(H.game, JSON.parse(JSON.stringify(intermediate)), { discoveredPairs:new Set() });
    H.save = vi.fn(() => true);
    expect(scenes.resumeChestsOnCell(H.game.nodeChestRewards['0,1'])).toBe(true);
    await UI._acts.chestTake(); await flushEventActions(); await UI._acts.chestContinue(); await flushEventActions(); await vi.advanceTimersByTimeAsync(400);
    expect(H.game.ownedCards).toHaveLength(3); expect(H.game.nodeChestRewards['0,1']).toBeUndefined();
    const restore = vi.spyOn(window.SDT.Chests, 'restore');
    await flow.runEventDeck();
    expect(restore).not.toHaveBeenCalled(); expect(H.game.ownedCards).toHaveLength(3);
    expect(H.game.coins).toBe(15); expect(H.game.state).toBe('idle');
  });
});

describe('骰子保存异常与回调过期', () => {
  async function diceHarness() {
    const owner = {}; let valid = true;
    const done = vi.fn(), pay = vi.fn(() => { H.game.coins -= 3; return true; });
    const open = createEventDiceController({ UI, SDT:window.SDT, save:() => H.save(),
      show:scenes.nodeShell, bind:() => () => true, onLeave:vi.fn(), setReturn:setBagReturnHook });
    await open.open({ owner, key:'paid', title:'投币', sides:6, outcomes:[{ label:'所得', value:'prize' }], done, beforeRoll:pay, current:() => valid });
    return { owner, done, pay, invalidate:() => valid = false };
  }
  it('已扣款的投骰保存抛错后仍能重试确认，原点数与扣款仅一次', async () => {
    const h = await diceHarness(); failSave('throw'); await UI._acts.eventDiceRoll(); await flushEventActions();
    expect(h.owner.dice.paid.result).toBe(6); expect(H.game.coins).toBe(15);
    expect(UI.el.ovBody.textContent).toContain('保存未成功');
    H.save = vi.fn(() => true); await UI._acts.eventDiceContinue(); await flushEventActions();
    expect(h.pay).toHaveBeenCalledOnce(); expect(h.done).toHaveBeenCalledExactlyOnceWith('prize');
  });
  it('页面绑定仍真但运行上下文已过期，旧 roll 不扣费也不消耗随机', async () => {
    const h = await diceHarness(); const oldRoll = UI._acts.eventDiceRoll; h.invalidate(); await oldRoll(); await flushEventActions();
    expect(h.pay).not.toHaveBeenCalled(); expect(H.random).not.toHaveBeenCalled(); expect(h.owner.dice.paid.result).toBeNull();
  });
  it('确认未承接时允许重试同一结果，承接成功后旧按钮失效', async () => {
    const h = await diceHarness(); await UI._acts.eventDiceRoll(); await flushEventActions(); h.done.mockReturnValueOnce(false).mockReturnValue(true);
    await UI._acts.eventDiceContinue(); await flushEventActions(); expect(UI.el.ovBody.textContent).toContain('奖励尚未承接');
    const confirm = UI._acts.eventDiceContinue; await confirm(); await flushEventActions(); await confirm(); await flushEventActions();
    expect(h.done).toHaveBeenCalledTimes(2); expect(h.pay).toHaveBeenCalledOnce();
  });
});

describe('故障重编确认', () => {
  const source = { id:'source', name:'原招式', type:'武术', rarity:'古朴' };
  const replacement = { id:'replacement', name:'新招式', type:'武术', rarity:'古朴' };
  it.each(['safe', 'stored', 'changed'])('源卡 %s 后确认旧结果不替换，原骰结果保留', async change => {
    const entry = { uid:'recode-source', card:{ ...source } }; H.game.ownedCards = [entry];
    await openEvent('ev19-recode', [source, replacement]); await UI._acts.evtChoice({ i:'0' }); await flushEventActions();
    await UI._acts.eventRecodePick({ i:'0' }); await flushEventActions(); await UI._acts.eventRecodeGo(); await flushEventActions(); await rollEventDice(UI);
    const dice = JSON.stringify(H.game.nodeRewards['0,1'].dice);
    if (change === 'changed') entry.card = { ...source, id:'other-source' }; else entry[change] = true;
    await UI._acts.eventRecodeAccept(); await flushEventActions();
    expect(entry.card.id).toBe(change === 'changed' ? 'other-source' : source.id);
    expect(JSON.stringify(H.game.nodeRewards['0,1'].dice)).toBe(dice);
    expect(H.game.nodeRewards['0,1'].settled).not.toBe(true); expect(H.game.visited).toEqual({});
  });
  it('来源快照保留 uid 与卡牌身份，同物件改稀有度也不再匹配', () => {
    const entry = { uid:'owned', card:{ ...source } }, expected = recodeSourceSnapshot(entry);
    expect(recodeSourceMatches(entry, expected)).toBe(true);
    entry.card.rarity = '传说'; expect(recodeSourceMatches(entry, expected)).toBe(false);
  });
});


it('候选授予后的保存仍在等待时，重复领取与旧上下文关闭均被阻止', async () => {
  const h=await choiceHarness(); const pick=UI._acts.eventCardPick; let release;
  H.save=vi.fn(()=>new Promise(resolve=>release=resolve));
  const saving=pick({i:'0'}); await pick({i:'0'}); expect(H.game.ownedCards).toHaveLength(1);
  expect(h.close).not.toHaveBeenCalled(); H.game.state='title'; UI.showOverlay('新页','<main id="later">新页面</main>','page');
  release(true); await saving; await flushEventActions();
  expect(h.close).not.toHaveBeenCalled(); expect(document.getElementById('later')).not.toBeNull(); expect(H.game.ownedCards).toHaveLength(1);
});
