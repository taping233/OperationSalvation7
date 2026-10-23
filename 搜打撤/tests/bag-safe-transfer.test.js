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
  it('背包和安全格均满，交换完整三张叠不会先取出失败', () => {
    limits.bag = 1;
    const incoming = entries(attack, 3), outgoing = entries(guard, 3, true);
    game.ownedCards = [...incoming, ...outgoing];
    expect(transfer.move(attack.name, true)).toBe(true);
    expect(incoming.every(entry => entry.safe)).toBe(true); expect(outgoing.every(entry => !entry.safe)).toBe(true);
    expect(ports.save).toHaveBeenCalledTimes(1); expect(ports.refresh).toHaveBeenCalledTimes(1);
    expect(ports.receipt).toHaveBeenCalledWith(expect.stringContaining('格挡 ×3已回背包'));
    expect(UI.el.ovBody.querySelector('[data-act="safeSwapPick"]')).toBeNull();
  });
  it('同名分成两格，只换选中的一格，不跨格换出全部同名牌', () => {
    limits.safe = 2;
    const incoming = entries(attack, 1), outgoing = entries(guard, 6, true);
    game.ownedCards = [...incoming, ...outgoing];
    expect(transfer.move(attack.name, true)).toBe(false);
    expect(UI.el.ovBody.querySelectorAll('[data-act="safeSwapPick"]')).toHaveLength(2);
    UI._acts.safeSwapPick({ i:'1' });
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
  it('移入同名两格，但已有一格空位时允许仅换出一格', () => {
    const incoming = entries(attack, 4), outgoing = entries(guard, 3, true);
    game.ownedCards = [...incoming, ...outgoing]; limits.safe = 2;
    const plan = planSafeCardSwap(game, incoming, outgoing, 2, 2);
    expect(plan.safeUsed).toBe(2); expect(plan.bagUsed).toBe(1);
    expect(transfer.move(attack.name, true)).toBe(true);
  });
  it('换回卡牌与已有同名叠合并，按实际新增格判断', () => {
    const incoming = entries(attack, 3), bagGuard = entries(guard, 2, false, 'bag'), outgoing = entries(guard, 1, true, 'safe');
    game.ownedCards = [...incoming, ...bagGuard, ...outgoing];
    const plan = planSafeCardSwap(game, incoming, outgoing, 2, 1);
    expect(plan.bagUsed).toBe(1); expect(plan.safeUsed).toBe(1);
  });
  it('珍珠盒资源扩展格不能接收新非资源叠，资源叠可接收', () => {
    const incoming = entries(attack, 1), resources = entries(card('木材', '资源'), 4);
    const pearl = entries({ ...card('珍珠盒', '道具'), id:'tt2-pearlbox' }, 1, true);
    const outgoing = entries(guard, 1, true);
    game.ownedCards = [...incoming, ...resources, ...pearl, ...outgoing];
    expect(planSafeCardSwap(game, incoming, outgoing, 1, 2)).toBeNull();
    outgoing[0].card = card('口粮', '资源');
    expect(planSafeCardSwap(game, incoming, outgoing, 1, 2)).not.toBeNull();
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
  it('多格候选显示卡名和数量，点击后只交换选择格并保存一次', () => {
    const { incoming, first, second } = multiChoice();
    expect(UI.el.ovBody.textContent).toContain('格挡 ×3'); expect(UI.el.ovBody.textContent).toContain('盔甲 ×1');
    expect(ports.save).not.toHaveBeenCalled(); expect(incoming[0].safe).toBe(false);
    UI._acts.safeSwapPick({ i:'0' });
    expect(incoming[0].safe).toBe(true); expect(first.every(entry => !entry.safe)).toBe(true); expect(second[0].safe).toBe(true);
    expect(ports.save).toHaveBeenCalledTimes(1);
    UI._acts.safeSwapPick({ i:'1' }); expect(ports.save).toHaveBeenCalledTimes(1);
  });
  it('返回取消不移动、不保存，旧选择也不再生效', () => {
    multiChoice(); const pick = UI._acts.safeSwapPick, before = JSON.stringify(game.ownedCards);
    UI._acts.safeSwapCancel(); pick({ i:'0' });
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(ports.save).not.toHaveBeenCalled();
  });
  it.each(['run', 'page', 'cards', 'battle'])('%s失效后旧选择不能交换', change => {
    multiChoice(); const pick = UI._acts.safeSwapPick;
    if (change === 'run') sameRun = false;
    if (change === 'page') UI.el.ovBody.innerHTML = '<section>其他页面</section>';
    if (change === 'cards') game.ownedCards = game.ownedCards.map(entry => ({ ...entry }));
    if (change === 'battle') game.battleActive = true;
    const before = JSON.stringify(game.ownedCards); pick({ i:'0' });
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(ports.save).not.toHaveBeenCalled();
  });
  it.each(['capacity', 'incoming-card', 'outgoing-card', 'incoming-uid'])('%s变化后执行复检失败保留选择与卡牌', change => {
    const { incoming, first } = multiChoice();
    if (change === 'capacity') limits.safe = 0;
    if (change === 'incoming-card') incoming[0].card = { ...attack };
    if (change === 'outgoing-card') first[0].card = { ...guard };
    if (change === 'incoming-uid') incoming[0].uid = 'new-id';
    const root = UI.el.ovBody.firstElementChild, before = JSON.stringify(game.ownedCards);
    UI._acts.safeSwapPick({ i:'0' });
    expect(UI.el.ovBody.firstElementChild).toBe(root); expect(UI.el.ovBody.querySelector('[role="status"]').textContent).toContain('未移动');
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
