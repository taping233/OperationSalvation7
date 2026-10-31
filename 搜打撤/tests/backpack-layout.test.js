import { connectSdtFixture } from './helpers/environment-fixtures.js';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { beforeEach, describe, expect, it } from 'vitest';
import { pageHTML } from '../game/src/hub/game.bag.view2.js';
import { readCssSource } from './helpers/css-source.js';

const css = postcss.parse(readCssSource(resolve('game/css/expedition-inventory.css'), 'utf8'));
const page = 'body #overlay .card.bag-page';
const view = `${page} .bag-v2`;
const zoom = 'body:has(#overlay.bag-full .bag-v2) #cardZoom.inventory-zoom';
function declarations(selector) {
  const values = {};
  css.walkRules(selector, rule => rule.walkDecls(decl => { values[decl.prop] = decl.value; }));
  return values;
}
const model = { bagZone: 'bag', bagFilter: 'all', cap: 16, baseCap: 16, total: 0, safeUsedN: 0, sCap: 2, pkN: 0, used: 0, coins: 0, fragments: 0, tiles: [] };
beforeEach(async () => {
  await connectSdtFixture({ UI: {} });
  document.body.replaceChildren();
});

// CSS contracts and scale arithmetic do not replace built-in-browser geometry evidence.
describe('背包横屏布局与独立阅读区', () => {
  it('使用全局布局坐标铺满游戏画幅，避免vw/vh被html zoom再次缩小', () => {
    const shell = declarations(page);
    expect(shell.width).toBe('var(--game-layout-width, 100%)');
    expect(shell['max-width']).toBe(shell.width);
    expect(shell.height).toBe('var(--game-layout-height, 100%)');
    expect(shell['max-height']).toBe(shell.height);
    expect(shell.transform).toBe('none');
    const width = 1188, height = 761, scale = Math.min(width / 1920, height / 1080);
    expect(1920 * scale).toBe(width);
    expect(1080 * scale).toBeCloseTo(668.25);
    expect(width * scale).toBeCloseTo(735.075); // 原100vw的错误显示宽度
  });

  it('清掉旧版bag-view额外内边距，五列与内部滚动仍由背包壳负责', () => {
    expect(declarations(`${page} .bag-view.bag-v2`)).toMatchObject({ padding: '0', 'box-sizing': 'border-box', 'text-align': 'left' });
    expect(declarations(`${view} .bag-shell`)).toMatchObject({ 'grid-template-columns': '112px minmax(0, 1fr)', 'min-height': '0' });
    expect(declarations(`${view} .bag-col`)['min-height']).toBe('0');
    expect(declarations(`${view} .bag-board`)).toMatchObject({ flex: '1', 'min-height': '0', 'overflow-y': 'auto' });
    expect(declarations(`${view} .bag-grid`)['grid-template-columns']).toBe('repeat(5, minmax(0, 1fr))');
  });

  it('当前1188宽窗口的筛选与空态至少13px，主要控件至少36px', () => {
    const scale = 1188 / 1920;
    for (const target of ['.bag-pill', '.bag-empty2']) {
      expect(parseFloat(declarations(`${view} ${target}`)['font-size']) * scale).toBeGreaterThanOrEqual(13);
    }
    for (const [target, property] of [['.bag-pill', 'min-height'], ['.bag-icbtn', 'height'], ['.bag-rz', 'height']]) {
      expect(parseFloat(declarations(`${view} ${target}`)[property]) * scale).toBeGreaterThanOrEqual(36);
    }
  });

  it.each(['bag', 'safe', 'pocket'])('%s区保留计数和有名称的分区目标，主层不渲染解释段落', bagZone => {
    document.body.innerHTML = pageHTML({ ...model, bagZone, used:3, bagCardN:5, safeUsedN:1, safeCardN:2, sCap:6, pkN:7 });
    expect([...document.querySelectorAll('.bag-rlabel')].map(el => el.textContent)).toEqual(['背包', '安全格', '消耗区']);
    expect(document.querySelector('.bag-rz[data-zone="safe"]').dataset.act).toBe('bagZone');
    expect(document.querySelector('.bag-title .help-btn')).toBeNull();
    expect(document.querySelector('.bag-title').textContent).toBeTruthy();
    expect(document.querySelector('.bag-rz[data-zone="bag"]').getAttribute('aria-label')).toBe('随身背包，3/16 格');
    expect(document.querySelector('.bag-rz[data-zone="safe"]').getAttribute('aria-label')).toBe('安全格，1/6 格');
    expect(document.querySelector('.bag-rz[data-zone="pocket"]').getAttribute('aria-label')).toBe('消耗区，7 张');
    expect(document.querySelector(`.bag-rz[data-zone="${bagZone}"]`).getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('.bag-znote, .bag-disclosure')).toHaveLength(0);
    const capacity = document.querySelector('.bag-capchip').textContent;
    if (bagZone === 'pocket') expect(capacity).toMatch(/7\s*张 · 不限容量/);
    else {
      expect(capacity).toMatch(bagZone === 'safe' ? /1\s*\/6 格/ : /3\s*\/16 格/);
      expect(document.querySelector('.bag-count-summary').textContent).toMatch(bagZone === 'safe' ? /卡牌\s*2\s*张/ : /卡牌\s*5\s*张/);
    }
  });

  it('详情布局只在打开的背包中生效，全文可滚动且页脚与关闭目标可点', () => {
    expect(declarations(zoom)['grid-template-columns']).toBe('var(--inspect-card-width) 640px');
    expect(declarations(`${zoom} .inventory-zoom-info`)).toMatchObject({ height: '840px', 'min-height': '0' });
    expect(declarations(`${zoom} .inventory-zoom-effect`)).toMatchObject({ flex: '1 1 auto', 'min-height': '0', overflow: 'auto' });
    expect(parseFloat(declarations(`${zoom} .inspect-collection-hint`)['font-size']) * 1188 / 1920).toBeGreaterThanOrEqual(13);
    expect(parseFloat(declarations(`${zoom} .camp-card-actions .ov-btn`)['min-height']) * 1188 / 1920).toBeGreaterThanOrEqual(36);
    expect(parseFloat(declarations(`${zoom} .cz-close`).height) * 1188 / 1920).toBeGreaterThanOrEqual(36);
    const host = document.createElement('div'); host.innerHTML = '<div id="overlay" class="bag-full"><div class="bag-v2"></div></div><div id="cardZoom" class="inventory-zoom"></div>'; document.body.append(host);
    expect(document.querySelector('#cardZoom').matches(zoom)).toBe(true);
    document.querySelector('#overlay').classList.remove('bag-full');
    expect(document.querySelector('#cardZoom').matches(zoom)).toBe(false);
  });
});
