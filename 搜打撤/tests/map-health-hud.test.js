import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountMapHealthHud, updateMapHealthHud } from '../game/src/ui/map-health-hud.js';
import { readCssSource } from './helpers/css-source.js';
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
  it('统一数字入口保留当前/上限节点，同值更新不重写数字DOM', () => {
    const root = fixture(), text = root.querySelector('#hpText');
    const current = text.querySelector('.hp-current'), rest = text.querySelector('.hp-rest');
    expect(current).not.toBeNull(); expect(rest).not.toBeNull();
    control.update({ hp:20, maxHp:50 });
    expect(root.querySelector('#hpText')).toBe(text);
    expect(text.querySelector('.hp-current')).toBe(current);
    expect(text.querySelector('.hp-rest')).toBe(rest);
    expect(current.textContent).toBe('20'); expect(rest.textContent).toBe('/50');
    const observer = new MutationObserver(() => {});
    observer.observe(text, { subtree:true, childList:true, characterData:true });
    control.update({ hp:20, maxHp:50 });
    expect(observer.takeRecords()).toHaveLength(0); observer.disconnect();
  });
  it('缓存命中仍修复被旧入口抹掉的数字格式，inactive也保持准确且不播反馈', () => {
    const root = fixture(5), text = root.querySelector('#hpText');
    control.update({ hp:5, maxHp:30, active:false });
    text.textContent = '旧格式';
    control.update({ hp:5, maxHp:30, active:false });
    expect(root.querySelector('#hpText')).toBe(text);
    expect(text.querySelector('.hp-current')?.textContent).toBe('5');
    expect(text.querySelector('.hp-rest')?.textContent).toBe('/30');
    expect(root.querySelector('.map-health-delta').textContent).toBe('');
    expect(root.dataset.healthActive).toBe('false');
  });
  it('首次载入低血不播受伤，数字与低血语义可读', () => {
    const root = fixture(5);
    expect(root.classList.contains('health-low')).toBe(true);
    expect(root.classList.contains('health-hurt')).toBe(false);
    expect(root.getAttribute('aria-label')).toBe('生命 5，上限 30，生命偏低');
    expect(root.querySelector('#mapHealthTip').textContent).toBe('');
    expect(root.querySelector('#mapHealthTip').hidden).toBe(true);
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
  it('生命只作信息展示，点击不展开文字或触发地图父级', () => {
    const root = fixture(); const click = vi.fn(), pointer = vi.fn();
    root.parentElement.addEventListener('click', click); root.parentElement.addEventListener('pointerdown', pointer);
    root.dispatchEvent(new Event('pointerdown', { bubbles:true })); root.click();
    expect(root.hasAttribute('aria-expanded')).toBe(false); expect(click).not.toHaveBeenCalled(); expect(pointer).not.toHaveBeenCalled();
    expect(root.getAttribute('role')).toBe('img');
    expect(root.hasAttribute('tabindex')).toBe(false);
    expect(root.querySelector('#mapHealthTip').hidden).toBe(true);
  });
  it('键盘输入不再打开冗余的生命说明', () => {
    const root = fixture(); root.focus();
    const key = (key, repeat = false) => root.dispatchEvent(new KeyboardEvent('keydown', { key, repeat, bubbles:true, cancelable:true }));
    key('Enter'); key('Enter', true); key('Escape'); key(' ');
    expect(root.hasAttribute('aria-expanded')).toBe(false);
    expect(root.querySelector('#mapHealthTip').hidden).toBe(true);
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
    expect(root.dataset.healthActive).toBe('true');
    root.click(); expect(root.hasAttribute('aria-expanded')).toBe(false);
    game.runActive = false; refresh();
    expect(root.dataset.healthActive).toBe('false');
    expect(root.querySelector('#hpText').textContent).toBe('4/30');
    game.runActive = true;
    ctx._lastMode = 'map'; refresh(); expect(root.classList.contains('health-hurt')).toBe(false);
    expect(game.hp).toBe(4);
  });
  it('生命标签和详情使用可读逻辑字号且只作用新HUD，保持原顶栏高度', () => {
    const css = readCssSource('game/css/page-expedition-hud.css', 'utf8');
    expect(css).toMatch(/#hpHud\[data-health-hud\] \.map-health-heading\s*\{[^}]*font:500 18px\/20px/);
    expect(css).toContain('#hpHud[data-health-hud] .map-resource-tip { font-size:20px; line-height:1.45; }');
    expect(css).toContain('#hpHud[data-health-hud] .map-resource-tip strong { font-size:20px; line-height:1.4; }');
    expect(css).toContain('#hpHud[data-health-hud] .hp-hud-body { gap:1px; }');
  });
  it('样式关闭旧无限低血动画，系统和游戏减少动态均覆盖血条', () => {
    const css = readCssSource('game/css/page-expedition-hud.css', 'utf8');
    expect(css).toContain('#topBtns #hpHud[data-health-hud] #hpBarWrap { animation:none; will-change:auto; }');
    expect(css).toContain('body.reduce-motion #topBtns #hpHud[data-health-hud] #hpBar { transition:none; }');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
  });
});
