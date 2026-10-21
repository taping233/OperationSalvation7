import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: vi.fn(() => Promise.resolve(false)), hide: vi.fn(), cacheStats: () => ({}),
  play: vi.fn(), setPaused: vi.fn(), presentDeath: vi.fn(), isLiveBattleFigure: () => false,
  actionImpactRemaining: () => null,
}));

document.body.innerHTML = '<div id="overlay" hidden><div id="ovBody"></div></div>';
const overlay = document.getElementById('overlay'), body = document.getElementById('ovBody');
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: { overlay, ovBody: body }, _lastMode: null,
  showOverlay(_title, html, mode) {
    body.innerHTML = rich(html); overlay.hidden = false; this._lastMode = mode;
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: mode }));
  },
  hideOverlay() { overlay.hidden = true; document.dispatchEvent(new CustomEvent('sdt-overlay-close')); },
  hideTooltip() {}, showTooltip() {}, refresh() {}, log() {}, act() {},
};
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
const potionBar = count => [{ uid: 'tip-fixture', name: '提示药水', count, desc: '受控提示说明', usable: false, why: '测试不可用道具' }];
function showPotions(count = 1) {
  render({ ...getSnapshot(), potionBar: potionBar(count) });
  return { potion: body.querySelector('.bt-potion'), tip: body.querySelector('[data-potion-tip]') };
}
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

describe('药水提示全局监听生命周期', () => {
  it.each(['pointerup', 'pointercancel', 'mouseleave'])('%s同时移除两个终止监听，并保持提示显隐', type => {
    const { potion, tip } = showPotions();
    const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
    pointer('pointerdown', potion);
    expect(tip.hidden).toBe(false); expect(tip.textContent).toContain('受控提示说明');
    const release = add.mock.calls.find(([event]) => event === 'pointerup')[1];
    pointer(type, type === 'mouseleave' ? potion : document);
    expect(tip.hidden).toBe(true);
    expect(remove).toHaveBeenCalledWith('pointerup', release);
    expect(remove).toHaveBeenCalledWith('pointercancel', release);
    const hidden = vi.spyOn(tip, 'hidden', 'set');
    pointer('pointerup'); pointer('pointercancel');
    expect(hidden).not.toHaveBeenCalled();
  });

  it.each(['replace', 'mode', 'close', 'new-stage'])('%s在指针未释放时清理旧提示及双监听', action => {
    const { potion, tip } = showPotions();
    const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
    pointer('pointerdown', potion);
    const release = add.mock.calls.find(([event]) => event === 'pointerup')[1];
    if (action === 'replace') showPotions(2);
    if (action === 'mode') UI.showOverlay('', '<p>设置</p>', 'settings');
    if (action === 'close') UI.hideOverlay();
    if (action === 'new-stage') { body.firstElementChild._battleToken = Symbol('old-stage'); showPotions(); }
    expect(tip.hidden).toBe(true);
    expect(remove).toHaveBeenCalledWith('pointerup', release);
    expect(remove).toHaveBeenCalledWith('pointercancel', release);
    const hidden = vi.spyOn(tip, 'hidden', 'set');
    pointer('pointerup'); pointer('pointercancel');
    expect(hidden).not.toHaveBeenCalled();
  });

  it('100次普通按下/松开及药水栏替换不保留旧cancel回调', () => {
    const oldTips = [];
    for (let count = 1; count <= 100; count++) {
      const { potion, tip } = showPotions(count);
      pointer('pointerdown', potion); pointer('pointerup');
      oldTips.push(vi.spyOn(tip, 'hidden', 'set'));
    }
    UI.showOverlay('', '<p>地图</p>', 'event');
    for (const hidden of oldTips) hidden.mockClear();
    pointer('pointercancel');
    for (const hidden of oldTips) expect(hidden).not.toHaveBeenCalled();
  });

  it('离开后的旧药水节点不重新绑定document监听', () => {
    const { potion } = showPotions();
    // Count changes retain the current control; leaving means a genuinely detached node.
    potion.remove(); showPotions(2); expect(potion.isConnected).toBe(false);
    const add = vi.spyOn(document, 'addEventListener');
    pointer('pointerdown', potion);
    expect(add.mock.calls.filter(([event]) => event === 'pointerup' || event === 'pointercancel')).toEqual([]);
  });

  it('数量变化保留当前药水节点，旧闭包读取最新数量且仍可使用', () => {
    const first = showPotions(), next = showPotions(2);
    expect(next.potion).toBe(first.potion);
    pointer('pointerdown', first.potion);
    expect(next.tip.hidden).toBe(false); expect(next.tip.textContent).toContain('×2');
    pointer('pointercancel'); expect(next.tip.hidden).toBe(true);
  });

  it.each(['close', 'mode', 'token', 'battle'])('%s后旧节点不得通过连接的新提示恢复document监听', action => {
    const { potion, tip } = showPotions();
    if (action === 'close') UI.hideOverlay();
    if (action === 'mode') UI.showOverlay('', '<p>设置</p>', 'settings');
    if (action === 'token') body.firstElementChild._battleToken = Symbol('departed-stage');
    if (action === 'battle') BattleSession.start(window.SDT.game, [{id:'new-tip-foe', name:'新场次', hp:50, atk:1}], {isBoss:false});
    const add = vi.spyOn(document, 'addEventListener');
    try {
      pointer('pointerdown', potion); pointer('mouseenter', potion);
      expect(tip.hidden).toBe(true);
      expect(add.mock.calls.filter(([event]) => event === 'pointerup' || event === 'pointercancel')).toEqual([]);
    } finally {
      // Drain the new battle's queued render even when this negative control fails.
      if (action === 'battle') frames.shift()?.(performance.now());
    }
  });

  it('同一药水栏重复渲染保留节点，悬停/移开仍可使用', () => {
    const first = showPotions(), next = showPotions();
    expect(next.potion).toBe(first.potion); expect(next.tip).toBe(first.tip);
    pointer('mouseenter', next.potion); expect(next.tip.hidden).toBe(false);
    pointer('mouseleave', next.potion); expect(next.tip.hidden).toBe(true);
  });
});
