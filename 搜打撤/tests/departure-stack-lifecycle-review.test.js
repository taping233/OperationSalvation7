import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseDepartureCommands } from '../game/src/hub/base-departure.commands.js';
const ports = vi.hoisted(() => ({ choice: vi.fn(), start: vi.fn(), hub: vi.fn(), handoff: vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: { starterSha: 5 } }, MODES: { standard: { id: 'standard', name: '标准' } },
  game: { stackCapOf: card => card.name === '初始攻击' ? 5 : 3 }, newRun: ports.start, requestClassChoice: ports.choice,
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick: vi.fn() }, _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/hub/game.hub.bridge.js', () => ({ slots: { renderHub: ports.hub } }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase: vi.fn(), readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
vi.mock('../game/src/ui/departure-transition.js', () => ({ enterDepartureCut: vi.fn(), startDepartureHandoff: ports.handoff }));

let actions, base, ui, departure;
const first = { id: 'first', name: '同名牌', rarity: '古朴', type: '道具', cost: 1 };
const second = { id: 'second', name: '同名牌', rarity: '稀有', type: '法术', cost: 2, variantKey: 'foil' };
beforeEach(async () => {
  vi.resetModules(); Object.values(ports).forEach(mock => mock.mockReset());
  actions = {};
  base = { slot: 1, data: { selMode: 'standard', pocket: [], stash: [{ card: first, count: 2 }, { card: second, count: 2 }] },
    PETS: [], bagCap: () => 16, carriedPet: () => null, ownedPets: () => [], setPet: vi.fn(() => true), petById: () => ({ name: '宠物', desc: '效果' }) };
  const overlay = document.createElement('div'); overlay.id = 'overlay'; document.body.replaceChildren(overlay);
  ui = { el: { overlay }, _acts: actions, act: (id, handler) => { actions[id] = handler; },
    showOverlay: (_title, html) => { overlay.innerHTML = html; }, showCardZoom: vi.fn(), log: vi.fn() };
  window.SDT = { UI: ui, Base: base, Cards: { SHA: { id: 'starter-attack', name: '初始攻击' }, cardHTML: card => `<span data-card-id="${card.id}">${card.name}</span>`, RARITIES: [], TYPES: [], rarityOf: card => card.rarity },
    Icons: { rich: html => html }, Sound: { sfx: vi.fn() } };
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  departure = await import('../game/src/hub/game.hub.depart.js');
  ports.start.mockImplementation((_mode, picks) => {
    const commands = createBaseDepartureCommands({ read: () => base.data, mutate: prepare => { const draft = structuredClone(base.data); const result = prepare(draft); base.data = draft; return result; } });
    return commands.prepareDeparture(picks).ok;
  });
});

describe('新手可调整推荐装配', () => {
  const defense = { id: 'defense', name: '护身', type: '法术', rarity: '古朴', cost: 1, desc: '获得 3 点护甲' };
  const attack = { id: 'attack', name: '试探', type: '武术', rarity: '古朴', cost: 1, desc: '攻击' };
  const third = { id: 'third', name: '援手', type: '生物', rarity: '古朴', cost: 2 };
  const preview = async () => { document.querySelector('[data-act="depRecommendPreview"]').click(); await vi.dynamicImportSettled(); await Promise.resolve(); };
  it('真实预览按钮不改已选、不扣仓；应用补充并可撤销到原手选', async () => {
    base.data.stash = [defense, attack, third].map(card => ({ card, count: 2 })); open();
    expect(document.querySelector('[data-act="depRecommendApply"]').disabled).toBe(true);
    expect(document.querySelector('[data-act="depRecommendUndo"]').disabled).toBe(true);
    expect(document.querySelector('[data-act="depRecommendPreview"]').disabled).toBe(false);
    document.querySelector('[data-act="pickAdd"][data-name="试探"]').click();
    const original = { ...departure.deployPick }, inventory = structuredClone(base.data.stash);
    await preview(); expect(departure.deployPick).toEqual(original); expect(base.data.stash).toEqual(inventory);
    expect(document.querySelector('#depStatus').textContent).toContain('推荐补充');
    expect(document.querySelector('[data-act="depRecommendApply"]').disabled).toBe(false);
    expect(document.querySelector('[data-act="depRecommendUndo"]').disabled).toBe(true);
    document.querySelector('[data-act="depRecommendApply"]').click();
    expect(departure.deployPick).toEqual({ 'card:attack': 1, 'card:defense': 1, 'card:third': 1 });
    expect(document.querySelector('[data-act="depRecommendApply"]').disabled).toBe(true);
    expect(document.querySelector('[data-act="depRecommendUndo"]').disabled).toBe(false);
    document.querySelector('[data-act="depRecommendUndo"]').click();
    expect(departure.deployPick).toEqual(original); expect(base.data.stash).toEqual(inventory); expect(ports.start).not.toHaveBeenCalled();
    expect(document.querySelector('[data-act="depRecommendApply"]').disabled).toBe(true);
    expect(document.querySelector('[data-act="depRecommendUndo"]').disabled).toBe(true);
  });
  it('机器人额外初始牌也计占格，预留三格且禁带职业卡', async () => {
    base.bagCap = () => 6; base.carriedPet = () => ({ id: 'robot', name: '机器人', effect: { extraSha: 2 } });
    base.data.stash = [{ card: { ...defense, id: 'class', rarity: '职业' }, count: 2 }, ...[defense, attack, third].map(card => ({ card, count: 2 }))];
    open(); await preview(); document.querySelector('[data-act="depRecommendApply"]').click();
    expect(Object.keys(departure.deployPick)).toEqual(['card:defense']);
    expect(document.querySelector('#depCapacity').textContent).toContain('3/6');
    expect(base.data.stash.map(stack => stack.count)).toEqual([2, 2, 2, 2]);
  });
  it('预览后库存变化必须重新预览，继续手调后撤销不覆盖手选', async () => {
    base.data.stash = [defense, attack, third].map(card => ({ card, count: 2 })); open(); await preview();
    base.data.stash[0].count = 1; document.querySelector('[data-act="depRecommendApply"]').click();
    expect(departure.deployPick).toEqual({}); expect(document.querySelector('#depStatus').textContent).toContain('重新预览');
    await preview(); document.querySelector('[data-act="depRecommendApply"]').click();
    document.querySelector('[data-act="pickAdd"][data-name="试探"]').click(); const changed = { ...departure.deployPick };
    expect(document.querySelector('[data-act="depRecommendUndo"]').disabled).toBe(true);
    document.querySelector('[data-act="depRecommendUndo"]').click(); expect(departure.deployPick).toEqual(changed);
  });
  it('首次整备在出发按钮之前明示统一消耗去向与复原入口', () => {
    open(); const rules = document.querySelector('.dep-survival'); expect(rules.open).toBe(true);
    expect(rules.textContent).toContain('所有用过的牌都进入消耗区，复原后可以再用');
    expect(rules.textContent).toContain('复原方法在背包查看');
    expect(rules.textContent).toContain('撤离时再确认带回结果');
    expect(rules.compareDocumentPosition(document.querySelector('#btnDeploy')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });
function open() {
  departure.openDepartPrep();
  const options = ports.choice.mock.lastCall[0];
  options.onSelect('侠客', () => options.beforeConfirm());
  ui.el.overlay.addEventListener('click', event => {
    const target = event.target.closest('[data-act]');
    if (target && !target.disabled) actions[target.dataset.act]?.({ ...target.dataset });
  });
}
function clickSecond() { document.querySelectorAll('#depPool .dep-card')[1].click(); }
describe('出征真实页面选择与扣仓身份', () => {
  it('点第二堆预览其卡面和数量，确认出征只扣第二堆', () => {
    open(); clickSecond();
    const bag = [...document.querySelectorAll('#depBag [data-name="同名牌"]')];
    expect(bag).toHaveLength(1);
    expect(bag[0].querySelector('[data-card-id]').dataset.cardId).toBe('second');
    bag[0].click(); expect(ui.showCardZoom.mock.lastCall[0]).toEqual(second);
    document.querySelector('[data-act="confirmDeploy"]').click(); ports.handoff.mock.lastCall[0]();
    expect(base.data.stash.map(stack => [stack.card.id, stack.count])).toEqual([['first', 2], ['second', 1]]);
  });
  it('正常pointer拖动保留第二堆稳定身份，取消拖动不新增选择', () => {
    open(); const source = document.querySelectorAll('#depPool .dep-card')[1], bag = document.querySelector('#depBag');
    source.setPointerCapture = vi.fn(); source.hasPointerCapture = () => false;
    source.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 140, width: 100, height: 140 });
    bag.getBoundingClientRect = () => ({ left: 200, top: 0, right: 400, bottom: 300, width: 200, height: 300 });
    vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const pointer = (type, x) => { const event = new Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { pointerId: 5, button: 0, clientX: x, clientY: 20 }); source.dispatchEvent(event); };
    pointer('pointerdown', 20); pointer('pointermove', 240); pointer('pointercancel', 240);
    expect(departure.deployPick).toEqual({}); expect(document.querySelector('.departure-drag-card')).toBeNull();
    pointer('pointerdown', 20); pointer('pointermove', 240); pointer('pointerup', 240);
    expect(departure.deployPick).toEqual({ 'card:second:foil': 1 });
    expect(document.querySelector('#depBag [data-name="同名牌"] [data-card-id]').dataset.cardId).toBe('second');
    actions.confirmDeploy(); ports.handoff.mock.lastCall[0]();
    expect(base.data.stash.map(stack => [stack.card.id, stack.count])).toEqual([['first', 2], ['second', 1]]);
  });
  it('同id不同堆级variant也只扣选择的变体', () => {
    base.data.stash = [{ card: first, count: 2, variantKey: 'plain' }, { card: first, count: 2, variantKey: 'foil' }];
    open(); clickSecond(); document.querySelector('[data-act="confirmDeploy"]').click(); ports.handoff.mock.lastCall[0]();
    expect(base.data.stash.map(stack => [stack.variantKey, stack.count])).toEqual([['plain', 2], ['foil', 1]]);
  });
  it('第二堆筛选按自己的类型和费用，选后不改第一堆剩余数量', () => {
    open(); clickSecond();
    expect([...document.querySelectorAll('#depPool .dep-own')].map(node => node.textContent)).toEqual(['2', '1']);
    const filter = document.querySelector('#depFilterType'); filter.value = '道具'; filter.dispatchEvent(new Event('change'));
    expect([...document.querySelectorAll('#depPool .dep-card')].map(node => node.hidden)).toEqual([false, true]);
  });
  it('同卡超过一格的预设保持每个格子独立，数量更新不丢节点', () => {
    base.data.stash = [{ card: first, count: 6 }]; departure.setDeployPick({ 同名牌: 6 }); open();
    const before = [...document.querySelectorAll('#depBag [data-name="同名牌"]')];
    expect(before).toHaveLength(2);
    actions.depPet({ id: 'dog' });
    const after = [...document.querySelectorAll('#depBag [data-name="同名牌"]')];
    expect(after).toHaveLength(2); expect(new Set(after).size).toBe(2);
  });
  it.each(['pickAdd', 'depPet', 'confirmDeploy', 'depBack', 'depMode'])('换slot后旧%s动作不执行', action => {
    open(); const old = actions[action]; base.slot = 2;
    old({ name: '同名牌', stackKey: 'card:second:foil', id: 'dog' });
    expect(base.setPet).not.toHaveBeenCalled(); expect(ports.start).not.toHaveBeenCalled(); expect(ports.handoff).not.toHaveBeenCalled();
    expect(ports.hub).not.toHaveBeenCalled(); expect(ports.choice).toHaveBeenCalledTimes(1); expect(departure.deployPick).toEqual({});
  });
  it('返回模式后原整备handler和已排队确认不能抢回页面', () => {
    open(); const oldPick = actions.pickAdd; document.querySelector('[data-act="confirmDeploy"]').click();
    const confirm = ports.handoff.mock.lastCall[0];
    actions.depMode(); ui.el.overlay.innerHTML = '<div id="hubMain">模式</div>';
    oldPick({ name: '同名牌' }); confirm();
    expect(ports.start).not.toHaveBeenCalled(); expect(document.getElementById('hubMain')).not.toBeNull();
  });
  it('返回模式再进整备可正常确认，原handoff不会在重进后执行', () => {
    open(); clickSecond(); actions.confirmDeploy(); const oldConfirm = ports.handoff.mock.lastCall[0];
    actions.depMode(); ui.el.overlay.innerHTML = '<div id="hubMain">模式</div>';
    departure.openDepartPrep();
    oldConfirm(); expect(ports.start).not.toHaveBeenCalled();
    actions.confirmDeploy(); ports.handoff.mock.lastCall[0]();
    expect(ports.start).toHaveBeenCalledOnce(); expect(base.data.stash[1].count).toBe(1);
  });
  it('已选择堆被替换后显示失败并保留仓库及口袋', () => {
    open(); clickSecond(); base.data.stash = [{ card: first, count: 2 }]; base.data.pocket = [{ card: first, count: 1 }];
    actions.confirmDeploy(); ports.handoff.mock.lastCall[0]();
    expect(ports.start).not.toHaveBeenCalled(); expect(base.data.stash[0].count).toBe(2); expect(base.data.pocket).toHaveLength(1);
    expect(document.querySelector('#depStatus').textContent).toContain('卡堆身份已变化');
  });
  it('准备保存失败不扣任何堆，重试只扣正确堆一次', () => {
    open(); clickSecond(); ports.start.mockReturnValueOnce(false);
    actions.confirmDeploy(); ports.handoff.mock.lastCall[0]();
    expect(base.data.stash.map(stack => stack.count)).toEqual([2, 2]);
    actions.confirmDeploy(); ports.handoff.mock.lastCall[0](); actions.confirmDeploy();
    expect(base.data.stash.map(stack => stack.count)).toEqual([2, 1]); expect(ports.start).toHaveBeenCalledTimes(2);
  });
});
