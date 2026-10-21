import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: vi.fn(() => Promise.resolve(false)), hide: vi.fn(), cacheStats: () => ({}),
  play: vi.fn(), setPaused: vi.fn(), presentDeath: vi.fn(), isLiveBattleFigure: () => false,
  actionImpactRemaining: () => null,
}));

document.body.innerHTML = '<div id="overlay" hidden><div id="ovBody"></div></div>';
const overlay = document.getElementById('overlay'), body = document.getElementById('ovBody');
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const actions = {};
const UI = {
  el: { overlay, ovBody: body }, _lastMode: null,
  showOverlay(_title, html, mode) {
    body.innerHTML = rich(html); overlay.hidden = false; this._lastMode = mode;
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: mode }));
  },
  hideOverlay() { overlay.hidden = true; document.dispatchEvent(new CustomEvent('sdt-overlay-close')); },
  hideTooltip() {}, showTooltip() {}, refresh() {}, log() {}, act(name, handler) { actions[name] = handler; },
};
body.addEventListener('click', event => {
  const source = event.target.closest('[data-act]');
  if (source) actions[source.dataset.act]?.(source.dataset);
});
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 2, battleHandMax: 8, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession, getSnapshot } = await import('../game/src/battle/core/battle.core.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const { render } = await import('../game/src/battle/view/battle.view.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
let frames;
function showPotions(count = 1, prefix = 'tip-fixture') {
  window.SDT.game.ownedCards = Array.from({ length: count }, (_unused, index) => ({ uid: `${prefix}-${index}`,
    card: { id: 'tip-fixture', type: '道具', name: '提示药水', desc: '回复 5 点生命。' } }));
  render(getSnapshot());
  return body.querySelector('.bt-potion');
}
const popup = () => body.querySelector('[data-potion-use]');
function pointer(type, target = document) {
  target.dispatchEvent(new MouseEvent(type, { button: 0, bubbles: true }));
}
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const game = {
    ownedCards: [], inventory: [], hp: 50, maxHp: 50, atk: 4, spellPower: 0, coins: 0, layerIdx: 0,
    myClass: null, characterId: null, state: 'idle', battleActive: false,
    log() {}, heal() {}, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'tip-foe', name: '提示回归靶子', hp: 50, atk: 1 }], { isBoss: false });
  frames.shift()(performance.now());
});
afterEach(() => {
  clearFeedback(); BattleSession.commands.flee(); UI.hideOverlay(); body.replaceChildren();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('药水说明与确认生命周期', () => {
  it.each(['pointerup', 'pointercancel', 'mouseleave'])('%s收起只读说明，后续终止事件不触碰旧面板', type => {
    const potion = showPotions();
    const before = window.SDT.game.ownedCards.slice();
    pointer('pointerdown', potion);
    const tip = popup();
    expect(tip.textContent).toContain('回复 5 点生命');
    pointer(type, type === 'mouseleave' ? potion : document);
    expect(tip.hidden).toBe(true); expect(tip.isConnected).toBe(false);
    const hidden = vi.spyOn(tip, 'hidden', 'set');
    pointer('pointerup'); pointer('pointercancel');
    expect(hidden).not.toHaveBeenCalled(); expect(window.SDT.game.ownedCards).toEqual(before);
  });

  it.each(['replace', 'mode', 'close', 'new-stage'])('%s在未松手时清理说明，旧节点不能提交或重新打开', action => {
    const potion = showPotions();
    pointer('pointerdown', potion);
    const tip = popup(), oldUse = tip.querySelector('.bt-potion-use-confirm');
    if (action === 'replace') {
      showPotions(2, 'replacement');
      expect(potion.isConnected).toBe(false);
    }
    if (action === 'mode') UI.showOverlay('', '<p>设置</p>', 'settings');
    if (action === 'close') UI.hideOverlay();
    if (action === 'new-stage') { body.firstElementChild._battleToken = Symbol('old-stage'); showPotions(); }
    expect(tip.hidden).toBe(true); expect(tip.isConnected).toBe(false);
    const before = window.SDT.game.ownedCards.slice();
    oldUse.click(); pointer('pointerdown', potion);
    expect(popup()).toBeNull(); expect(window.SDT.game.ownedCards).toEqual(before);
    const hidden = vi.spyOn(tip, 'hidden', 'set');
    pointer('pointerup'); pointer('pointercancel');
    expect(hidden).not.toHaveBeenCalled();
  });

  it('100次普通按下/松开及药水栏替换不保留旧cancel回调', () => {
    const oldTips = [];
    for (let count = 1; count <= 100; count++) {
      const potion = showPotions(count);
      pointer('pointerdown', potion); const tip = popup(); pointer('pointerup');
      oldTips.push(vi.spyOn(tip, 'hidden', 'set'));
    }
    UI.showOverlay('', '<p>地图</p>', 'event');
    for (const hidden of oldTips) hidden.mockClear();
    pointer('pointercancel');
    for (const hidden of oldTips) expect(hidden).not.toHaveBeenCalled();
  });

  it('离开后的旧药水节点不重新绑定document监听', () => {
    const potion = showPotions(); showPotions(2, 'replacement');
    expect(potion.isConnected).toBe(false);
    const add = vi.spyOn(document, 'addEventListener');
    pointer('pointerdown', potion);
    expect(add.mock.calls.filter(([event]) => event === 'pointerup' || event === 'pointercancel')).toEqual([]);
  });

  it('同UID数量更新保留当前入口，旧确认失效，新说明使用当前数量且不消费', () => {
    const potion = showPotions();
    potion.click();
    const tip = popup(), oldUse = tip.querySelector('.bt-potion-use-confirm');
    expect(tip.getAttribute('role')).toBe('dialog');
    const current = showPotions(2);
    expect(current).toBe(potion); expect(potion.isConnected).toBe(true);
    expect(tip.hidden).toBe(true); expect(tip.isConnected).toBe(false);
    const before = window.SDT.game.ownedCards.slice();
    oldUse.click(); expect(popup()).toBeNull();
    expect(window.SDT.game.ownedCards).toEqual(before);
    pointer('pointerdown', current);
    const preview = popup();
    expect(preview).not.toBe(tip); expect(preview.textContent).toContain('提示药水 ×2');
    expect(preview.getAttribute('role')).toBe('status');
    oldUse.click(); expect(window.SDT.game.ownedCards).toEqual(before);
    pointer('pointerup'); expect(popup()).toBeNull();
    const hidden = vi.spyOn(tip, 'hidden', 'set');
    pointer('pointercancel'); expect(hidden).not.toHaveBeenCalled();
  });

  it('被替换UID的已打开确认与入口都失效，当前入口仍可读取', () => {
    const potion = showPotions(); potion.click();
    const tip = popup(), oldUse = tip.querySelector('.bt-potion-use-confirm');
    const current = showPotions(2, 'replacement');
    expect(current).not.toBe(potion); expect(potion.isConnected).toBe(false);
    expect(tip.hidden).toBe(true); expect(tip.isConnected).toBe(false);
    const before = window.SDT.game.ownedCards.slice();
    oldUse.click(); pointer('pointerdown', potion); potion.click();
    expect(popup()).toBeNull(); expect(window.SDT.game.ownedCards).toEqual(before);
    current.click(); expect(popup().getAttribute('role')).toBe('dialog');
    expect(popup().dataset.potionUse).toBe('replacement-0');
    oldUse.click(); expect(window.SDT.game.ownedCards).toEqual(before);
    popup().querySelector('.bt-potion-use-cancel').click();
    expect(popup()).toBeNull();
  });

  it('同一药水栏重复渲染保留节点，悬停/移开仍可使用', () => {
    const first = showPotions(), next = showPotions();
    expect(next).toBe(first);
    pointer('mouseenter', next); expect(popup().textContent).toContain('回复 5 点生命');
    pointer('mouseleave', next); expect(popup()).toBeNull();
    next.click(); const use = popup().querySelector('.bt-potion-use-confirm');
    next.click(); expect(body.querySelectorAll('[data-potion-use]')).toHaveLength(1);
    popup().querySelector('.bt-potion-use-cancel').click(); use.click();
    expect(getSnapshot().potionBar.map(potion => potion.uid)).toEqual(['tip-fixture-0']);
  });

  it('确认多敌道具后进入公共选靶，取消保持原UID和槽位', () => {
    BattleSession.commands.flee();
    const card = { id: 'tip-target-item', type: '道具', name: '指向道具', desc: '',
      rules: { version: 1, bag: { use: [{ op: 'damage', amount: 3, dmgType: 'fixed', target: 'chosenEnemy' }] } } };
    const game = window.SDT.game;
    game.ownedCards = [{ uid: 'target-item', card }];
    BattleSession.start(game, [{ id: 'tip-left', name: '左敌', hp: 50, atk: 0 }, { id: 'tip-right', name: '右敌', hp: 50, atk: 0 }], { isBoss: false });
    render(getSnapshot());
    const source = body.querySelector('.bt-potion');
    source.click(); expect(getSnapshot().pendingItem).toBeNull();
    popup().querySelector('.bt-potion-use-confirm').click();
    expect(getSnapshot().pendingItem?.uid).toBe('target-item');
    expect(game.ownedCards.map(entry => entry.uid)).toEqual(['target-item']);
    BattleSession.commands.cancelPendingTarget();
    expect(getSnapshot().pendingItem).toBeNull();
    expect(getSnapshot().potionBar.map(potion => potion.uid)).toEqual(['target-item']);
    expect(game.ownedCards.map(entry => entry.uid)).toEqual(['target-item']);
    expect(body.querySelector('.bt-potion')).toBe(source);
  });
});
