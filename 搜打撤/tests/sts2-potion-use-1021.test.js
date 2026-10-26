import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBattlePotionUse } from '../game/src/battle/view/battle.potion-use.js';
import { createBattleEntryGate } from '../game/src/battle/view/battle.presentation-ready.js';

let UI, snapshot, stage, bar, potion, commands, controller;
const makePotion = (extra = {}) => ({ uid: 'item-1', name: '回复药水', desc: '回复 5 点生命。', count: 2, aim: null, usable: true, why: '', ...extra });
const pointer = (type, target = document, options = {}) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, ...options }));
const popup = () => bar.querySelector('[data-potion-use]');
const confirm = () => popup().querySelector('.bt-potion-use-confirm');
function mount(token = snapshot.battleToken) {
  UI.el.ovBody.innerHTML = '<div class="battle-stage sts"><div class="sts-topbar"><div class="bt-potions"><div class="bt-potion" role="button" tabindex="0" data-act="btPotion" data-uid="item-1" data-potion-idx="0">回复药水 ×2</div></div></div><div class="sts-unit" data-target="0">敌人</div></div>';
  stage = UI.el.ovBody.firstElementChild; stage._battleToken = token;
  bar = stage.querySelector('.bt-potions'); potion = bar.querySelector('.bt-potion');
  controller.sync(stage, snapshot);
}
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  UI = { el: { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') }, _lastMode: 'battle' };
  snapshot = { battleToken: 4, phase: 'player', busy: false, actionQueueLength: 0, potionBar: [makePotion()], energy: 3, hand: ['card-1'] };
  commands = { usePotion: vi.fn(()=>true) };
  controller = createBattlePotionUse({ UI, getSnapshot: () => snapshot, commands });
  UI.el.ovBody.addEventListener('click', event => {
    const source = event.target.closest('[data-act="btPotion"]');
    if (source) controller.open(source.dataset.uid);
  });
  mount();
});
afterEach(() => { controller.dispose(); document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('道具先检查再确认', () => {
  it('按下/轻点/双击图标只读说明，使用按钮仅在click提交一次', () => {
    pointer('pointerdown', potion);
    expect(popup().textContent).toContain('回复 5 点生命');
    expect(popup().querySelector('.bt-potion-use-actions').hidden).toBe(true);
    expect(commands.usePotion).not.toHaveBeenCalled();
    pointer('pointerup'); expect(popup()).toBeNull();
    potion.click(); const panel = popup(); potion.click();
    expect(popup()).toBe(panel); expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.textContent).toContain('使用'); expect(panel.textContent).toContain('取消');
    pointer('pointerup'); expect(popup()).toBe(panel);
    const use = confirm();
    pointer('pointerdown', use); expect(commands.usePotion).not.toHaveBeenCalled();
    use.click(); use.click(); pointer('pointerup', use); use.click();
    expect(commands.usePotion).toHaveBeenCalledExactlyOnceWith('item-1');
    expect(popup()).toBeNull();
  });

  it.each(['button', 'escape', 'outside', 'right-click'])('%s取消保持道具原槽、能量及手牌', mode => {
    const stateBefore = structuredClone(snapshot), originalSlot = potion;
    potion.click(); const staleUse = confirm();
    if (mode === 'button') popup().querySelector('.bt-potion-use-cancel').click();
    if (mode === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (mode === 'outside') pointer('pointerdown', stage.querySelector('.sts-unit'));
    if (mode === 'right-click') pointer('contextmenu', document, { button: 2 });
    expect(popup()).toBeNull(); staleUse.click();
    expect(commands.usePotion).not.toHaveBeenCalled();
    expect(snapshot).toEqual(stateBefore); expect(bar.querySelector('.bt-potion')).toBe(originalSlot);
  });

  it.each(['Enter', ' '])('%s键只打开确认框，长按不会连用', key => {
    potion.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    const first = popup(); expect(first).not.toBeNull();
    potion.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: true, bubbles: true }));
    expect(popup()).toBe(first); expect(commands.usePotion).not.toHaveBeenCalled();
    first.querySelector('.bt-potion-use-cancel').click();
    expect(document.activeElement).toBe(potion);
  });

  it('不可用道具可看说明和原因，无法触发使用', () => {
    snapshot.potionBar = [makePotion({ usable: false, why: '消耗牌堆是空的' })];
    potion.classList.add('off'); delete potion.dataset.act;
    controller.sync(stage, snapshot); potion.click();
    expect(popup().textContent).toContain('消耗牌堆是空的'); expect(confirm().disabled).toBe(true);
    confirm().click(); expect(commands.usePotion).not.toHaveBeenCalled();
  });

  it('展示使用当前渲染描述，确认仍按当前UID重新验证，文字不作为HTML执行', () => {
    controller.sync(stage, snapshot, [makePotion({ desc: '<img src=x onerror=alert(1)>附加说明' })]);
    potion.click();
    expect(popup().querySelector('img')).toBeNull(); expect(popup().textContent).toContain('<img src=x');
    snapshot.potionBar = [makePotion({ uid: 'item-2' })];
    confirm().click(); expect(commands.usePotion).not.toHaveBeenCalled(); expect(popup()).toBeNull();
  });
});

describe('仅当前战场当前道具可提交', () => {
  it('真实入场门禁在sync后触发DOM变化，ready后无需重绑即可查看并确认', async () => {
    const gate = createBattleEntryGate();
    try {
      gate.begin(stage, snapshot.battleToken, UI.el.overlay);
      controller.sync(stage, snapshot);
      stage.classList.add('bt-entrance');
      await Promise.resolve();
      expect(stage.inert).toBe(true);
      expect(controller.open('item-1')).toBe(false);
      expect(popup()).toBeNull();
      const ready = gate.ready(stage, snapshot.battleToken);
      gate.wait(stage, snapshot.battleToken, [Promise.resolve(true)]);
      expect(await ready).toBe(true);
      await Promise.resolve();
      expect(stage.inert).toBe(false);
      potion.click();
      expect(popup()).not.toBeNull();
      confirm().click();
      expect(commands.usePotion).toHaveBeenCalledExactlyOnceWith('item-1');
    } finally { gate.dispose(); }
  });

  it('临时inert收起旧详情并保留绑定，真正替换舞台后不复活旧监听', async () => {
    potion.click(); const oldUse = confirm();
    stage.setAttribute('inert', '');
    await Promise.resolve();
    expect(popup()).toBeNull();
    oldUse.click(); expect(commands.usePotion).not.toHaveBeenCalled();
    stage.removeAttribute('inert');
    await Promise.resolve();
    potion.click(); expect(popup()).not.toBeNull();
    const removedStage = stage;
    removedStage.remove(); await Promise.resolve();
    UI.el.ovBody.append(removedStage); await Promise.resolve();
    expect(controller.open('item-1')).toBe(false);
    expect(popup()).toBeNull();
  });

  it.each([
    ['busy', { busy: true }], ['queue', { actionQueueLength: 1 }], ['enemy', { phase: 'enemy' }],
    ['start', { phase: 'start' }], ['finished', { phase: 'victory' }], ['targeting', { phase: 'targeting' }],
    ['infusion', { infusing: {} }], ['discover', { discovering: {} }], ['choice', { choosing: {} }],
    ['hand-select', { handSelecting: {} }], ['deck-select', { deckSelection: {} }], ['deck', { viewingDeck: true }],
    ['grave', { viewingGrave: true }], ['bag', { viewingBag: true }], ['card-target', { pendingTarget: {} }],
    ['item-target', { pendingItem: {} }], ['slam', { slamPending: true }], ['dart', { dartPending: true }],
  ])('%s期间拒绝新开框与旧确认按钮', (_mode, patch) => {
    potion.click(); const oldUse = confirm();
    Object.assign(snapshot, patch); oldUse.click();
    expect(commands.usePotion).not.toHaveBeenCalled(); expect(popup()).toBeNull();
    potion.click(); expect(popup()).toBeNull();
  });

  it.each(['battle-token', 'stage-token', 'stage-replaced', 'bar-replaced', 'hidden', 'inert', 'css-hidden', 'ancestor-css-hidden', 'source-hidden', 'source-css-hidden', 'closing', 'mode', 'missing-uid', 'unusable'])('%s使旧确认按钮失效', reason => {
    potion.click(); const oldUse = confirm();
    if (reason === 'battle-token') snapshot = { ...snapshot, battleToken: 5 };
    if (reason === 'stage-token') stage._battleToken = 5;
    if (reason === 'stage-replaced') { stage.replaceWith(stage.cloneNode(true)); }
    if (reason === 'bar-replaced') { bar.replaceWith(bar.cloneNode(true)); }
    if (reason === 'hidden') UI.el.overlay.hidden = true;
    if (reason === 'inert') stage.setAttribute('inert', '');
    if (reason === 'css-hidden') bar.style.display = 'none';
    if (reason === 'ancestor-css-hidden') UI.el.overlay.style.display = 'none';
    if (reason === 'source-hidden') potion.hidden = true;
    if (reason === 'source-css-hidden') potion.style.display = 'none';
    if (reason === 'closing') UI.el.overlay.classList.add('closing');
    if (reason === 'mode') UI._lastMode = 'settings';
    if (reason === 'missing-uid') snapshot.potionBar = [];
    if (reason === 'unusable') snapshot.potionBar[0].usable = false;
    oldUse.click(); expect(commands.usePotion).not.toHaveBeenCalled();
  });

  it('旧战斗与旧弹层同名UID的延迟事件不能提交新战道具', () => {
    potion.click(); const oldUse = confirm();
    snapshot = { ...snapshot, battleToken: 5 }; mount(); potion.click(); const newUse = confirm();
    oldUse.click(); expect(commands.usePotion).not.toHaveBeenCalled();
    newUse.click(); expect(commands.usePotion).toHaveBeenCalledExactlyOnceWith('item-1');
  });

  it('100次同舞台sync不累积监听，节点复用后仍只响应当前数据', () => {
    const documentAdd = vi.spyOn(document, 'addEventListener'), stageAdd = vi.spyOn(stage, 'addEventListener');
    for (let n = 0; n < 100; n++) controller.sync(stage, snapshot, [makePotion({ desc: `第${n}轮说明` })]);
    expect(documentAdd).not.toHaveBeenCalled(); expect(stageAdd).not.toHaveBeenCalled();
    pointer('mouseenter', potion); expect(popup().textContent).toContain('第99轮说明');
    pointer('mouseleave', potion); expect(popup()).toBeNull();
    potion.click(); confirm().click(); expect(commands.usePotion).toHaveBeenCalledTimes(1);
  });

  it('换页卸载清理确认、监听和旧节点，返回后可重新绑定', () => {
    potion.click(); const oldUse = confirm(), oldPotion = potion;
    UI._lastMode = 'settings'; document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'settings' }));
    oldUse.click(); oldPotion.click(); expect(commands.usePotion).not.toHaveBeenCalled(); expect(popup()).toBeNull();
    UI._lastMode = 'battle'; mount(); potion.click(); const use = confirm();
    controller.dispose(); use.click();
    expect(popup()).toBeNull(); expect(commands.usePotion).not.toHaveBeenCalled();
  });

  it('窗口失焦收起详情，回到当前舞台后仍可查看', () => {
    potion.click(); window.dispatchEvent(new Event('blur')); expect(popup()).toBeNull();
    potion.click(); expect(popup()).not.toBeNull(); expect(commands.usePotion).not.toHaveBeenCalled();
  });
});
