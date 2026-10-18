import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mountMapHealthHud, updateMapHealthHud } from '../game/src/ui/map-health-hud.js';
let control;
afterEach(() => { control?.dispose(); control = null; vi.useRealTimers(); document.body.innerHTML = ''; });
function fixture(hp = 30) {
  document.body.innerHTML = '<main><div id="hpHud"><div class="hp-hud-body"><b id="hpText">30/30</b><div id="hpBarWrap"><div id="hpBar"></div></div></div><span id="mapHealthTip" class="map-resource-tip" role="tooltip"></span></div><button id="outside">地图</button></main>';
  const root = document.querySelector('#hpHud');
  control = mountMapHealthHud(root);
  control.update({ hp, maxHp:30 });
  return root;
}
describe('地图生命展示', () => {
  it('首次载入低血不播受伤，数字与低血语义可读', () => {
    const root = fixture(5);
    expect(root.classList.contains('health-low')).toBe(true);
    expect(root.classList.contains('health-hurt')).toBe(false);
    expect(root.getAttribute('aria-label')).toBe('生命 5，上限 30，生命偏低');
    expect(root.querySelector('#mapHealthTip').textContent).toBe('生命值当前 5 / 上限 30');
    expect(root.querySelector('#hpBar').style.width).toBe('16.7%');
  });
  it('伤害与回血仅短促一次，重复刷新不重播，连续变化替换计时', () => {
    vi.useFakeTimers(); const root = fixture();
    control.update({ hp:20, maxHp:30 });
    expect(root.classList.contains('health-hurt')).toBe(true);
    expect(root.querySelector('.map-health-delta').textContent).toBe('−10');
    vi.advanceTimersByTime(500); control.update({ hp:20, maxHp:30 });
    vi.advanceTimersByTime(500); expect(root.querySelector('.map-health-delta').textContent).toBe('');
    control.update({ hp:25, maxHp:30 }); vi.advanceTimersByTime(400);
    control.update({ hp:28, maxHp:30 }); vi.advanceTimersByTime(600);
    expect(root.classList.contains('health-heal')).toBe(true);
    expect(root.querySelector('.map-health-delta').textContent).toBe('+3');
    vi.advanceTimersByTime(400); expect(root.classList.contains('health-heal')).toBe(false);
  });
  it('上限单独改变、战斗隐藏刷新及再次进场均无虚假受伤', () => {
    const root = fixture();
    control.update({ hp:30, maxHp:60 }); expect(root.classList.contains('health-hurt')).toBe(false);
    control.update({ hp:10, maxHp:60, active:false });
    control.update({ hp:8, maxHp:60, active:true }); expect(root.classList.contains('health-hurt')).toBe(false);
    control.update({ hp:4, maxHp:60, instant:true }); expect(root.classList.contains('health-hurt')).toBe(false);
  });
  it('零/负值不溢出血条，超上限只裁进度不改数值', () => {
    const root = fixture();
    control.update({ hp:-4, maxHp:30 }); expect(root.querySelector('#hpBar').style.width).toBe('0%');
    expect(root.getAttribute('aria-label')).toBe('生命 0，上限 30');
    expect(root.querySelector('.map-health-state').textContent).toBe('耗尽');
    control.update({ hp:40, maxHp:30 }); expect(root.querySelector('#hpBar').style.width).toBe('100%');
    control.update({ hp:0, maxHp:0 }); expect(root.querySelector('#hpBar').style.width).toBe('0%');
  });
  it('触控点击可展开/收起，不触发地图父级指针或点击', () => {
    const root = fixture(); const click = vi.fn(), pointer = vi.fn();
    root.parentElement.addEventListener('click', click); root.parentElement.addEventListener('pointerdown', pointer);
    root.dispatchEvent(new Event('pointerdown', { bubbles:true })); root.click();
    expect(root.getAttribute('aria-expanded')).toBe('true'); expect(click).not.toHaveBeenCalled(); expect(pointer).not.toHaveBeenCalled();
    root.click(); expect(root.getAttribute('aria-expanded')).toBe('false');
    root.click(); document.querySelector('#outside').dispatchEvent(new Event('pointerdown', { bubbles:true }));
    expect(root.getAttribute('aria-expanded')).toBe('false');
  });
  it('Enter/空格与Escape可用，长按不反复切换，焦点离开关闭', () => {
    const root = fixture(); root.focus();
    const key = (key, repeat = false) => root.dispatchEvent(new KeyboardEvent('keydown', { key, repeat, bubbles:true, cancelable:true }));
    key('Enter'); expect(root.getAttribute('aria-expanded')).toBe('true');
    key('Enter', true); expect(root.getAttribute('aria-expanded')).toBe('true');
    key('Escape'); expect(root.dataset.healthDismissed).toBe('true');
    key(' '); expect(root.getAttribute('aria-expanded')).toBe('true');
    document.querySelector('#outside').focus(); expect(root.getAttribute('aria-expanded')).toBe('false');
  });
  it('缺少地图壳时安全跳过，重复刷新只挂一个控件', () => {
    expect(() => updateMapHealthHud(null, {hp:1,maxHp:2})).not.toThrow();
    const root = fixture(); control.dispose(); control = null;
    updateMapHealthHud(root, {hp:30,maxHp:30}); updateMapHealthHud(root, {hp:30,maxHp:30});
    expect(root.querySelectorAll('.map-health-heading')).toHaveLength(1);
  });
  it('真实 HUD 刷新链更新数值、伤害、重载基线；不读取或写入存档', async () => {
    vi.useFakeTimers();
    const root = fixture(); control.dispose(); control = null;
    await import('../game/src/core/sdt-facade.js');
    const { hudMethods } = await import('../game/src/ui/hud.js');
    const el = Object.fromEntries(['layerZh', 'layerEn', 'statTurn', 'statValue', 'charCoins', 'charAtk', 'heroAva'].map(id => [id, document.createElement('span')]));
    for (const id of ['hpText', 'hpBar', 'hpBarWrap']) el[id] = root.querySelector(`#${id}`);
    const ctx = { el, _lastMode:'map', _roomActive:false, popNum() {}, endRoom() {} };
    const game = { state:'idle', turn:1, hp:30, maxHp:30, coins:0, atk:0, myClass:'', runActive:true, inventory:[] };
    const refresh = () => hudMethods.refresh.call(ctx, game);
    refresh(); expect(root.querySelector('#hpText').textContent).toBe('30/30');
    game.hp = 6; refresh(); expect(root.classList.contains('health-hurt')).toBe(true);
    expect(root.querySelector('#hpText').textContent).toBe('6/30');
    ctx._lastHpKey = null; game.hp = 30; refresh();
    expect(root.querySelector('.map-health-delta').textContent).toBe('');
    ctx._lastMode = 'battle'; game.hp = 4; refresh();
    expect(root.dataset.healthActive).toBe('false');
    ctx._lastMode = 'map'; refresh(); expect(root.classList.contains('health-hurt')).toBe(false);
    expect(game.hp).toBe(4);
  });
  it('生命标签和详情使用可读逻辑字号且只作用新HUD，保持原顶栏高度', () => {
    const css = readFileSync('game/css/page-expedition-hud.css', 'utf8');
    expect(css).toMatch(/#hpHud\[data-health-hud\] \.map-health-heading\s*\{[^}]*font:500 18px\/20px/);
    expect(css).toContain('#hpHud[data-health-hud] .map-resource-tip { font-size:20px; line-height:1.45; }');
    expect(css).toContain('#hpHud[data-health-hud] .map-resource-tip strong { font-size:20px; line-height:1.4; }');
    expect(css).toContain('#hpHud[data-health-hud] .hp-hud-body { gap:1px; }');
  });
  it('样式关闭旧无限低血动画，系统和游戏减少动态均覆盖血条', () => {
    const css = readFileSync('game/css/page-expedition-hud.css', 'utf8');
    expect(css).toContain('#topBtns #hpHud[data-health-hud] #hpBarWrap { animation:none; will-change:auto; }');
    expect(css).toContain('body.reduce-motion #topBtns #hpHud[data-health-hud] #hpBar { transition:none; }');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
  });
});
