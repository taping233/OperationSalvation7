import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSafeTransfer, planSafeCardSwap } from '../game/src/hub/game.bag.safe-transfer.js';
import { deriveBagRenderState } from '../game/src/core/bag-render-derivation.js';
import { stackCapOf } from '../game/src/core/card-capacity.js';

const card = (name, type = '武术') => ({ id:name, name, type });
const entries = (template, count, safe = false, prefix = template.id) => Array.from({ length:count }, (_, i) => ({ uid:`${prefix}-${i}`, card:template, safe }));
const attack = card('攻击'), guard = card('格挡'), armor = card('盔甲', '装备');
let game, UI, transfer, ports, limits, sameRun;
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><section id="bag"></section></div></div>';
  game = { ownedCards:[], inventory:[], cardOrder:[], runActive:true, battleActive:false, state:'modal', stackCapOf };
  limits = { bag:2, safe:1 }; sameRun = true;
  UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') }, _acts:{}, log:vi.fn(),
    act(name, fn) { this._acts[name] = fn; },
    showOverlay(_title, html) { document.getElementById('cardZoom')?.remove(); this.el.ovBody.innerHTML = html; },
  };
  const state = () => deriveBagRenderState(game, limits.bag);
  ports = { UI, game, shaName:'初始攻击', bagCap:() => state().cap, safeCap:() => limits.safe,
    usedSlots:() => state().used, safeUsed:() => state().safeStacks.length, baseCap:() => limits.bag,
    refresh:vi.fn(() => { UI.el.ovBody.innerHTML = '<section id="bag"></section>'; }), save:vi.fn(),
    closeZoom:vi.fn(() => document.getElementById('cardZoom')?.remove()), captureContext:() => () => sameRun,
    beforeSelection:vi.fn(), cardHTML:template => `<b>${template.name}</b>`, sound:vi.fn(), receipt:vi.fn(),
  };
  transfer = createSafeTransfer(ports);
});

describe('安全格按最终双方容量原子交换一格', () => {
  it('直接取回新法术叠不能借用资源扩展格，未满同名叠仍可补入', () => {
    limits.bag = 2;
    const pearl = entries({ ...card('珍珠盒', '道具'), id:'tt2-pearlbox' }, 1, true);
    const outgoing = entries(card('火球', '法术'), 1, true);
    game.ownedCards = [...entries(attack, 1), ...entries(guard, 1), ...pearl, ...outgoing];
    expect(transfer.move('火球', false)).toBe(false);
    expect(outgoing[0].safe).toBe(true);
    game.ownedCards = [...entries(card('火球', '法术'), 1), ...entries(guard, 1), ...pearl, ...outgoing];
    expect(transfer.move('火球', false)).toBe(true);
    expect(outgoing[0].safe).toBe(false);
  });
  it('背包和安全格均满，单候选也先选择确认，再原子交换完整三张叠', async () => {
    limits.bag = 1;
    const incoming = entries(attack, 3), outgoing = entries(guard, 3, true);
    game.ownedCards = [...incoming, ...outgoing];
    expect(transfer.move(attack.name, true)).toBe(false);
    expect(UI.el.ovBody.querySelectorAll('[data-act="safeSwapPick"]')).toHaveLength(1);
    expect(UI.el.ovBody.querySelector('[data-act="safeSwapConfirm"]').disabled).toBe(true);
    expect(incoming.every(entry => !entry.safe)).toBe(true); expect(ports.save).not.toHaveBeenCalled();
    UI._acts.safeSwapPick({i:'0'});
    expect(incoming.every(entry => !entry.safe)).toBe(true); expect(ports.save).not.toHaveBeenCalled();
    expect(await UI._acts.safeSwapConfirm()).toBe(true);
    expect(await UI._acts.safeSwapConfirm()).toBe(false);
    expect(incoming.every(entry => entry.safe)).toBe(true); expect(outgoing.every(entry => !entry.safe)).toBe(true);
    expect(ports.save).toHaveBeenCalledTimes(1); expect(ports.refresh).toHaveBeenCalledTimes(1);
    expect(ports.receipt).toHaveBeenCalledWith(expect.stringContaining('格挡 ×3已回背包'));
    expect(UI.el.ovBody.querySelector('[data-act="safeSwapPick"]')).toBeNull();
  });
  it('同名分成两格，只换确认选择的一格，不跨格换出全部同名牌', async () => {
    limits.safe = 2;
    const incoming = entries(attack, 1), outgoing = entries(guard, 6, true);
    game.ownedCards = [...incoming, ...outgoing];
    expect(transfer.move(attack.name, true)).toBe(false);
    expect(UI.el.ovBody.querySelectorAll('[data-act="safeSwapPick"]')).toHaveLength(2);
    UI._acts.safeSwapPick({ i:'1' });
    await UI._acts.safeSwapConfirm();
    expect(outgoing.slice(0, 3).every(entry => entry.safe)).toBe(true);
    expect(outgoing.slice(3).every(entry => !entry.safe)).toBe(true);
    expect(incoming[0].safe).toBe(true);
  });
  it('装备每格一张，一格换出无法容纳两件装备时拒绝且不部分写入', () => {
    const incoming = entries(armor, 2), outgoing = entries(guard, 3, true);
    game.ownedCards = [...incoming, ...outgoing];
    const before = JSON.stringify(game.ownedCards);
    expect(planSafeCardSwap(game, incoming, outgoing, 2, 1)).toBeNull();
    expect(transfer.move(armor.name, true)).toBe(false);
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(ports.save).not.toHaveBeenCalled();
    expect(UI.log).toHaveBeenCalledWith(expect.stringContaining('换出一格仍放不下'), 'warn');
  });
  it('移入同名两格，但已有一格空位时允许仅换出一格', async () => {
    const incoming = entries(attack, 4), outgoing = entries(guard, 3, true);
    game.ownedCards = [...incoming, ...outgoing]; limits.safe = 2;
    const plan = planSafeCardSwap(game, incoming, outgoing, 2, 2);
    expect(plan.safeUsed).toBe(2); expect(plan.bagUsed).toBe(1);
    expect(transfer.move(attack.name, true)).toBe(false);
    UI._acts.safeSwapPick({i:'0'}); expect(await UI._acts.safeSwapConfirm()).toBe(true);
  });
  it('换回卡牌与已有同名叠合并，按实际新增格判断', () => {
    const incoming = entries(attack, 3), bagGuard = entries(guard, 2, false, 'bag'), outgoing = entries(guard, 1, true, 'safe');
    game.ownedCards = [...incoming, ...bagGuard, ...outgoing];
    const plan = planSafeCardSwap(game, incoming, outgoing, 2, 1);
    expect(plan.bagUsed).toBe(1); expect(plan.safeUsed).toBe(1);
  });
  it('换出普通卡使用换入腾出的基础格，已有资源不占用该基础格', () => {
    const incoming = entries(attack, 1), resources = entries(card('木材', '资源'), 4);
    const pearl = entries({ ...card('珍珠盒', '道具'), id:'tt2-pearlbox' }, 1, true);
    const outgoing = entries(guard, 1, true);
    game.ownedCards = [...incoming, ...resources, ...pearl, ...outgoing];
    expect(planSafeCardSwap(game, incoming, outgoing, 1, 2)).toMatchObject({ bagUsed:3, safeUsed:2 });
    game.ownedCards.push(...entries(card('另一招式'), 1));
    expect(planSafeCardSwap(game, incoming, outgoing, 1, 2)).toBeNull();
    outgoing[0].card = card('口粮', '资源');
    expect(planSafeCardSwap(game, incoming, outgoing, 1, 2)).not.toBeNull();
  });
  it.each([2, 3])('同时取回%d张珍珠盒沿用全部扩容，并只保存一次', async count => {
    const boxes = entries({ ...card('珍珠盒', '道具'), id:'tt2-pearlbox' }, count, true);
    game.ownedCards = [...entries(card('木材', '资源'), 36), ...boxes];
    expect(transfer.button('珍珠盒', false, 'take')).not.toContain(' disabled');
    expect(await transfer.move('珍珠盒', false)).toBe(true);
    expect(boxes.every(entry => !entry.safe)).toBe(true);
    expect(deriveBagRenderState(game, limits.bag)).toMatchObject({ used:13, ordinarySlots:1, cap:2 + count * 9 });
    expect(ports.save).toHaveBeenCalledOnce();
  });
  it('满安全格换出两张珍珠盒时按最终容量确认整叠交换', async () => {
    const incoming = entries(attack, 1);
    const boxes = entries({ ...card('珍珠盒', '道具'), id:'tt2-pearlbox' }, 2, true);
    game.ownedCards = [...incoming, ...entries(card('木材', '资源'), 36), ...boxes];
    expect(transfer.move(attack.name, true)).toBe(false);
    expect(UI.el.ovBody.querySelectorAll('[data-act="safeSwapPick"]')).toHaveLength(1);
    UI._acts.safeSwapPick({ i:'0' });
    expect(await UI._acts.safeSwapConfirm()).toBe(true);
    expect(incoming[0].safe).toBe(true); expect(boxes.every(entry => !entry.safe)).toBe(true);
    expect(deriveBagRenderState(game, limits.bag)).toMatchObject({ used:13, ordinarySlots:1, cap:20 });
    expect(ports.save).toHaveBeenCalledOnce();
  });
  it.each(['ordinary', 'total'])('取回珍珠盒确实超过%s容量时整批保留原位', async boundary => {
    const boxes = entries({ ...card('珍珠盒', '道具'), id:'tt2-pearlbox' }, 2, true);
    game.ownedCards = boundary === 'ordinary'
      ? [...entries(attack, 1), ...entries(guard, 1), ...boxes]
      : [...entries(card('木材', '资源'), 60), ...boxes];
    const before = JSON.stringify(game.ownedCards);
    expect(await transfer.move('珍珠盒', false)).toBe(false);
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(ports.save).not.toHaveBeenCalled();
    expect(UI.log).toHaveBeenCalledWith(expect.stringContaining(boundary === 'ordinary' ? '基础格不足' : '背包放不下'), 'warn');
  });
  it('不把容器内卡或已移走的候选当安全格可换出格', () => {
    const incoming = entries(attack, 1), outgoing = entries(guard, 1, true);
    game.ownedCards = [...incoming, ...outgoing];
    outgoing[0].stored = true;
    expect(planSafeCardSwap(game, incoming, outgoing, 2, 1)).toBeNull();
    delete outgoing[0].stored; outgoing[0].safe = false;
    expect(planSafeCardSwap(game, incoming, outgoing, 2, 1)).toBeNull();
  });
});

function multiChoice() {
  limits.safe = 2;
  const incoming = entries(attack, 1), first = entries(guard, 3, true), second = entries(armor, 1, true);
  game.ownedCards = [...incoming, ...first, ...second];
  const result = transfer.move(attack.name, true);
  expect(result).toBe(false);
  return { incoming, first, second };
}
describe('换入选择的真实所有权与同步调用边界', () => {
  it('多格候选显示卡名和数量，确认后只交换选择格并保存一次', async () => {
    const { incoming, first, second } = multiChoice();
    expect(UI.el.ovBody.textContent).toContain('格挡 ×3'); expect(UI.el.ovBody.textContent).toContain('盔甲 ×1');
    expect(ports.save).not.toHaveBeenCalled(); expect(incoming[0].safe).toBe(false);
    UI._acts.safeSwapPick({ i:'0' });
    expect(incoming[0].safe).toBe(false); expect(ports.save).not.toHaveBeenCalled();
    await UI._acts.safeSwapConfirm();
    expect(incoming[0].safe).toBe(true); expect(first.every(entry => !entry.safe)).toBe(true); expect(second[0].safe).toBe(true);
    expect(ports.save).toHaveBeenCalledTimes(1);
    UI._acts.safeSwapPick({ i:'1' }); await UI._acts.safeSwapConfirm(); expect(ports.save).toHaveBeenCalledTimes(1);
  });
  it('返回取消不移动、不保存，旧选择和确认也不再生效', async () => {
    multiChoice(); const pick = UI._acts.safeSwapPick, confirm = UI._acts.safeSwapConfirm, before = JSON.stringify(game.ownedCards);
    pick({i:'0'}); UI._acts.safeSwapCancel(); pick({ i:'0' }); await confirm();
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(ports.save).not.toHaveBeenCalled();
  });
  it.each(['run', 'page', 'cards', 'battle'])('%s失效后旧选择和确认不能交换', async change => {
    multiChoice(); const pick = UI._acts.safeSwapPick, confirm = UI._acts.safeSwapConfirm; pick({i:'0'});
    if (change === 'run') sameRun = false;
    if (change === 'page') UI.el.ovBody.innerHTML = '<section>其他页面</section>';
    if (change === 'cards') game.ownedCards = game.ownedCards.map(entry => ({ ...entry }));
    if (change === 'battle') game.battleActive = true;
    const before = JSON.stringify(game.ownedCards); pick({ i:'0' }); await confirm();
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(ports.save).not.toHaveBeenCalled();
  });
  it.each(['capacity', 'incoming-card', 'outgoing-card', 'incoming-uid'])('%s变化后执行复检失败保留选择与卡牌', async change => {
    const { incoming, first } = multiChoice();
    if (change === 'capacity') limits.safe = 0;
    if (change === 'incoming-card') incoming[0].card = { ...attack };
    if (change === 'outgoing-card') first[0].card = { ...guard };
    if (change === 'incoming-uid') incoming[0].uid = 'new-id';
    const root = UI.el.ovBody.firstElementChild, before = JSON.stringify(game.ownedCards);
    UI._acts.safeSwapPick({ i:'0' });
    await UI._acts.safeSwapConfirm();
    expect(UI.el.ovBody.firstElementChild).toBe(root); expect(UI.el.ovBody.querySelector('[role="status"]').textContent).toContain('未移动');
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(ports.save).not.toHaveBeenCalled();
  });
  it('单候选也可取消，不自动交换或保存', async () => {
    limits.bag = 1;
    game.ownedCards = [...entries(attack,3),...entries(guard,3,true)];
    const before = JSON.stringify(game.ownedCards);
    expect(transfer.move(attack.name,true)).toBe(false);
    const confirm = UI._acts.safeSwapConfirm;
    UI.el.ovBody.querySelector('[data-act="safeSwapPick"]').click();
    expect(JSON.stringify(game.ownedCards)).toBe(before);
    UI._acts.safeSwapCancel();
    expect(await confirm()).toBe(false);
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(ports.save).not.toHaveBeenCalled();
  });
  it('refresh:false奖励整理合同只返回false，不自动交换或打开选择', () => {
    limits.safe = 1;
    game.ownedCards = [...entries(attack, 1), ...entries(guard, 3, true)];
    const before = JSON.stringify(game.ownedCards), root = UI.el.ovBody.firstElementChild;
    expect(transfer.move(attack.name, true, { refresh:false, uids:['攻击-0'] })).toBe(false);
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(UI.el.ovBody.firstElementChild).toBe(root);
    expect(ports.save).not.toHaveBeenCalled();
  });
});

describe('安全格选择的保存与取消结果', () => {
  it.each(['false','throw','reject'])('保存%s恢复原位置，并保留选中以便重试', async failure => {
    const {incoming,first}=multiChoice(), root=UI.el.ovBody.firstElementChild;
    root.scrollTop=80; UI._acts.safeSwapPick({i:'0'});
    const before=JSON.stringify(game.ownedCards), confirm=UI._acts.safeSwapConfirm;
    if (failure === 'false') ports.save.mockReturnValueOnce(false);
    else if (failure === 'throw') ports.save.mockImplementationOnce(() => {throw new Error('save failed');});
    else ports.save.mockRejectedValueOnce(new Error('save rejected'));
    expect(await confirm()).toBe(false);
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(UI.el.ovBody.firstElementChild).toBe(root);
    expect(root.scrollTop).toBe(80); expect(root.querySelector('[data-i="0"]').dataset.discoverySelected).toBe('true');
    expect(ports.sound).not.toHaveBeenCalled(); expect(ports.receipt).not.toHaveBeenCalled();
    expect(await confirm()).toBe(true);
    expect(incoming[0].safe).toBe(true); expect(first.every(entry => !entry.safe)).toBe(true);
    expect(ports.sound).toHaveBeenCalledOnce(); expect(ports.receipt).toHaveBeenCalledOnce();
    expect(await confirm()).toBe(false); expect(ports.save).toHaveBeenCalledTimes(2);
  });

  it.each([false,true])('异步保存%s期间只提交一次，结束后保留新页面', async saved => {
    const {incoming,first}=multiChoice(); let finish;
    ports.save.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
    UI._acts.safeSwapPick({i:'0'}); const confirm=UI._acts.safeSwapConfirm, pending=confirm();
    expect(await confirm()).toBe(false); expect(UI._acts.safeSwapCancel()).toBe(false);
    UI.el.ovBody.innerHTML='<section id="new-view">其他页面</section>'; const next=UI.el.ovBody.firstElementChild;
    finish(saved); expect(await pending).toBe(saved);
    expect(UI.el.ovBody.firstElementChild).toBe(next); expect(ports.refresh).not.toHaveBeenCalled();
    expect(incoming[0].safe).toBe(saved); expect(first.every(entry => entry.safe)).toBe(!saved);
    expect(ports.save).toHaveBeenCalledOnce();
  });

  it('换局后旧保存失败保留新局数组与反馈', async () => {
    multiChoice(); let finish;
    ports.save.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
    UI._acts.safeSwapPick({i:'0'}); const pending=UI._acts.safeSwapConfirm();
    sameRun=false; const fresh=entries(card('新局卡'),1)[0]; game.ownedCards.splice(0,game.ownedCards.length,fresh);
    finish(false); expect(await pending).toBe(false);
    expect(game.ownedCards).toEqual([fresh]); expect(ports.refresh).not.toHaveBeenCalled(); expect(ports.receipt).not.toHaveBeenCalled();
  });

  it.each(['false','throw','reject'])('取消返回%s时保留原选择，重试返回明确成功', async failure => {
    multiChoice(); const root=UI.el.ovBody.firstElementChild;
    UI._acts.safeSwapPick({i:'0'}); const cancel=UI._acts.safeSwapCancel;
    if (failure === 'false') ports.refresh.mockReturnValueOnce(false);
    else if (failure === 'throw') ports.refresh.mockImplementationOnce(() => {throw new Error('return failed');});
    else ports.refresh.mockRejectedValueOnce(new Error('return rejected'));
    expect(await cancel()).toBe(false); expect(UI.el.ovBody.firstElementChild).toBe(root);
    expect(root.querySelector('[data-i="0"]').dataset.discoverySelected).toBe('true');
    expect(await cancel()).toBe(true); expect(ports.save).not.toHaveBeenCalled();
  });

  it('异步取消结束前换局时沿用新页面，并结束旧返回通知', async () => {
    limits.safe=1; game.ownedCards=[...entries(attack,1),...entries(guard,3,true)];
    const onCancel=vi.fn(); transfer.move(attack.name,true,{onCancel});
    let finish; ports.refresh.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
    const pending=UI._acts.safeSwapCancel();
    sameRun=false; UI.el.ovBody.innerHTML='<section id="new-view">新局页面</section>';
    const next=UI.el.ovBody.firstElementChild;
    finish(true); expect(await pending).toBe(true);
    expect(onCancel).not.toHaveBeenCalled(); expect(UI.el.ovBody.firstElementChild).toBe(next);
    expect(ports.save).not.toHaveBeenCalled();
  });
});
