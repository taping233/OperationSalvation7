// @vitest-environment node
import {readCssSource} from './helpers/css-source.js';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = postcss.parse(['expedition-rewards','room-rewards'].map(name=>readCssSource(new URL(`../game/css/${name}.css`, import.meta.url), 'utf8')).join('\n'));
const sharedRoot = 'body #overlay .card .room-reward';
function declarations(selector) {
  const values = {};
  css.walkRules(selector, rule => rule.walkDecls(decl => { values[decl.prop] = decl.value; }));
  return values;
}

describe('入城补给独占呈现边界', () => {
  it('入城补给使用统一居中卡列，卡面宽度不因奖励计数改变', () => {
    expect(declarations(`${sharedRoot} .reward-objects`)).toMatchObject({ display:'flex', 'flex-wrap':'wrap', 'align-items':'center', 'justify-content':'center' });
    expect(declarations(`${sharedRoot} .reward-unit`)).toMatchObject({ flex:'0 0 300px', width:'300px', 'min-height':'0' });
    expect(declarations(`${sharedRoot} .reward-unit .reward-card`)).toMatchObject({ width:'300px', 'min-width':'300px', 'max-width':'300px' });
  });

  it('当前窗口的提示正文至少13px，收下和整理按钮至少36px高', () => {
    const scale = 1617 / 1920;
    for (const selector of [`${sharedRoot} :is(.reward-source,.reward-rule)`,`${sharedRoot} :is(.reward-empty,.reward-notice,.reward-capacity-note,.reward-final,.loot-outcome)`]) expect(parseFloat(declarations(selector)['font-size']) * scale).toBeGreaterThanOrEqual(13);
    for (const selector of [`${sharedRoot} .reward-claim`,`${sharedRoot} :is(.reward-bag,.reward-secondary)`]) expect(parseFloat(declarations(selector)['min-height']) * scale).toBeGreaterThanOrEqual(36);
    expect(parseFloat(declarations('body #overlay .entry-supply-strips .entry-complete-confirm')['min-height']) * scale).toBeGreaterThanOrEqual(36);
  });

  it('进度锚点与完成态只属于入城补给，离开动作和固定页脚共用', () => {
    expect(declarations(`${sharedRoot} .loot-actions`)).toMatchObject({display:'flex','justify-content':'flex-end'});
    expect(declarations('body #overlay .entry-supply-strips .entry-supply-status').display).toBe('flex');
    expect(declarations('body #overlay .entry-supply-strips .entry-reward-complete').display).toBe('grid');
    expect(declarations(`${sharedRoot} .reward-foot.room-footer`)).toMatchObject({ display:'grid','grid-template-columns':'minmax(0,1fr) auto','overflow':'visible' });
    expect(declarations(`${sharedRoot} .reward-exit`)).toMatchObject({order:'10','min-height':'52px'});
  });
});
