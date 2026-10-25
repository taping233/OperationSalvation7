import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSignalPuzzleState, signalPuzzleConnected, mountEventSignalPuzzle } from '../game/src/ui/event-signal-puzzle.js';
import { eventSceneHTML } from '../game/src/ui/node-scene-view.js';
import { Random } from '../game/src/core/random.js';
import { readCssSource } from './helpers/css-source.js';

let mounted;
afterEach(() => { mounted?.dispose(); mounted = null; document.body.innerHTML = ''; vi.restoreAllMocks(); });
function fixture(seed = 'terminal', current) {
  document.body.innerHTML = `<main>${eventSceneHTML({ tone:'event', title:'配送无人机', layer:0,
    body:'<button class="evt-opt is-selected" data-act="evtChoice" data-i="0"><b>碎片与木材</b></button><button class="evt-opt" data-act="evtChoice" data-i="1"><b>碎片与货币</b></button>',
    foot:'<button data-act="evtReturn">返回地图</button>',
  })}</main>`;
  const scene = document.querySelector('.event-scene'), state = createSignalPuzzleState(seed);
  mounted = mountEventSignalPuzzle(scene, state, current);
  return { scene, state, panel: mounted.panel, summary: mounted.panel.querySelector('summary'), tiles:[...mounted.panel.querySelectorAll('[data-signal-tile]')] };
}
function solve({ state, tiles }) {
  const desired = state.variant ? [3, 1] : [2, 0];
  tiles.forEach((tile, i) => { for (let attempts = 0; state.rotations[i] !== desired[i] && attempts < 4; attempts++) tile.click(); });
}

describe('无人机可选信号屏：独立展示规则', () => {
  it('独立种子稳定、覆盖两个布局，512个种子均只需2–6次转动且无无解初局', () => {
    const variants = new Set();
    for (let seed = 0; seed < 512; seed++) {
      const state = createSignalPuzzleState(seed);
      expect(state).toEqual(createSignalPuzzleState(seed));
      expect(signalPuzzleConnected(state)).toBe(false);
      variants.add(state.variant);
      const target = state.variant ? [3, 1] : [2, 0];
      const distance = state.rotations.reduce((sum, rotation, i) => sum + ((target[i] - rotation + 4) % 4), 0);
      expect(distance).toBeGreaterThanOrEqual(2); expect(distance).toBeLessThanOrEqual(6);
      state.rotations = target;
      expect(signalPuzzleConnected(state)).toBe(true);
    }
    expect([...variants].sort()).toEqual([0, 1]);
  });

  it('每个布局16种几何组合恰有1解，单段正确不算完成', () => {
    for (const variant of [0, 1]) {
      const solutions = [];
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        if (signalPuzzleConnected({ variant, rotations:[a, b] })) solutions.push([a, b]);
      }
      expect(solutions).toEqual(variant ? [[3, 1]] : [[2, 0]]);
    }
  });

  it('默认折叠且只挂一个独立模块，原选项数与选择确认保持不变', () => {
    const f = fixture();
    expect(f.panel.open).toBe(false); expect(f.summary.textContent).toContain('可选');
    expect(f.panel.querySelector('[data-act],.evt-opt')).toBeNull();
    expect(f.scene.querySelectorAll('.evt-opt')).toHaveLength(2);
    expect(f.scene.dataset.eventChoiceCount).toBe('2');
    expect(f.scene.querySelector('.evt-opt.is-selected').dataset.i).toBe('0');
    expect(mountEventSignalPuzzle(f.scene, f.state)).toBeNull();
  });

  it('任意点击不会完成，完整连通后呈现灯光且不重复完成或重置', () => {
    const f = fixture(); f.summary.click();
    const before = [...f.state.rotations];
    for (let i = 0; i < 8; i++) f.tiles[0].click();
    expect(f.state.rotations).toEqual(before); expect(f.panel.dataset.signalConnected).toBe('false');
    solve(f);
    expect(f.panel.dataset.signalConnected).toBe('true');
    expect(f.panel.classList.contains('signal-just-connected')).toBe(true);
    expect(f.panel.querySelector('[role=status]').textContent).toBe('信号已连通');
    const solved = [...f.state.rotations]; f.tiles[0].click(); f.tiles[1].click();
    expect(f.state.rotations).toEqual(solved);
  });

  it('Enter/Space旋转、按住不重复，Escape收起还焦点而不清空原选择', () => {
    const f = fixture(); f.summary.click();
    const initial = f.state.rotations[0];
    f.tiles[0].focus();
    for (const key of ['Enter', ' ']) f.tiles[0].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles:true, cancelable:true }));
    expect(f.state.rotations[0]).toBe((initial + 2) % 4);
    f.tiles[0].dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', repeat:true, bubbles:true, cancelable:true }));
    expect(f.state.rotations[0]).toBe((initial + 2) % 4);
    const rewardCapture = vi.fn(); document.addEventListener('keydown', rewardCapture, true);
    f.tiles[0].dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
    document.removeEventListener('keydown', rewardCapture, true);
    expect(rewardCapture).not.toHaveBeenCalled(); expect(f.panel.open).toBe(false); expect(f.state.open).toBe(false);
    expect(document.activeElement).toBe(f.summary);
    expect(f.scene.querySelector('.evt-opt.is-selected').dataset.i).toBe('0');
    expect(f.state.rotations[0]).toBe((initial + 2) % 4);
  });

  it('展开只滚动自己的阅读区露出规则与线路，收起恢复入口位置', () => {
    const f = fixture();
    const scroller = f.scene.querySelector('.node-main'), screen = f.panel.querySelector('.signal-puzzle-screen');
    Object.defineProperties(scroller, { clientHeight:{ value:350 }, scrollHeight:{ value:900 }, clientTop:{ value:0 } });
    scroller.scrollTop = 42;
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ top:100 });
    vi.spyOn(f.panel, 'getBoundingClientRect').mockReturnValue({ top:430, height:390 });
    vi.spyOn(screen, 'getBoundingClientRect').mockReturnValue({ top:470 });
    const documentScroll = document.documentElement.scrollTop;
    f.summary.click();
    expect(scroller.scrollTop).toBe(412);
    expect(document.documentElement.scrollTop).toBe(documentScroll);
    f.panel.querySelector('.signal-puzzle-close').click();
    expect(scroller.scrollTop).toBe(42);
    expect(document.activeElement).toBe(f.summary);
  });

  it('按实页393px内滚区与356px面板测量，展开滚到底后完整露出线路', () => {
    const f = fixture(), scroller = f.scene.querySelector('.node-main');
    Object.defineProperties(scroller, { clientHeight:{ value:393 }, scrollHeight:{ value:702 }, clientTop:{ value:0 } });
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ top:132 });
    vi.spyOn(f.panel, 'getBoundingClientRect').mockReturnValue({ top:477.5, height:356 });
    f.summary.click();
    expect(scroller.scrollTop).toBe(309);
    expect(477.5 - scroller.scrollTop).toBeGreaterThanOrEqual(132);
    expect(477.5 + 356 - scroller.scrollTop).toBeLessThanOrEqual(132 + 393);
    f.summary.click();
    expect(scroller.scrollTop).toBe(0); expect(f.panel.open).toBe(false);
  });

  it('本次UI状态可在背包重绘中保留，完成反馈不会重播', () => {
    const f = fixture(); f.summary.click(); solve(f);
    mounted.dispose(); f.panel.remove();
    mounted = mountEventSignalPuzzle(f.scene, f.state);
    expect(mounted.panel.open).toBe(true); expect(mounted.panel.dataset.signalConnected).toBe('true');
    expect(mounted.panel.classList.contains('signal-just-connected')).toBe(false);
  });

  it('关闭及旧页面/新探索后监听失效，窗口Escape监听随页面销毁清理', async () => {
    let current = true; const f = fixture('old', () => current); f.summary.click();
    const before = [...f.state.rotations]; current = false; f.tiles[0].click();
    expect(f.state.rotations).toEqual(before);
    current = true; const removed = vi.spyOn(window, 'removeEventListener'); f.scene.remove();
    await Promise.resolve();
    f.tiles[0].click(); expect(f.state.rotations).toEqual(before);
    expect(removed).toHaveBeenCalledWith('keydown', expect.any(Function), true);
  });

  it('全过程不推进任何随机流，不访问存档，不引入奖励计数或计时器', () => {
    const f = fixture('no-economy'); const randomState = Random.snapshot();
    const globalRandom = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('unexpected random'); });
    const save = vi.spyOn(Storage.prototype, 'setItem');
    f.summary.click(); solve(f); f.panel.querySelector('.signal-puzzle-close').click(); f.summary.click();
    expect(Random.snapshot()).toEqual(randomState); expect(globalRandom).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    const source = readFileSync('game/src/ui/event-signal-puzzle.js', 'utf8');
    expect(source).not.toMatch(/(?:Random\.|Math\.random|localStorage|saveGame|setTimeout|setInterval|gainCoins|grantCard|consumeCell)/);
  });

  it('减少动态保留静态亮线和指示灯，无循环动画', () => {
    const css = readCssSource('game/css/event-signal-puzzle.css', 'utf8');
    expect(css).toContain('body.reduce-motion .event-signal-puzzle');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
    expect(css).toContain('.event-signal-puzzle.is-connected .signal-drone-lamp');
    expect(css).not.toContain('infinite');
    expect(css).toContain(".event-signal-puzzle[open] .signal-puzzle-entry > span::before { content:'−'; }");
    expect(css).not.toContain('rotate(45deg)');
    expect(css).toContain('.event-signal-puzzle :is(summary,.signal-puzzle-close):focus-visible { outline-offset:-2px; }');
  });
});
