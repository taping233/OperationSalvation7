// @vitest-environment node
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = postcss.parse(readFileSync(new URL('../game/css/expedition-rewards.css', import.meta.url), 'utf8'));
const entryRoot = 'body #overlay .card:has(.entry-supply-strips) .entry-supply-strips';
function declarations(selector) {
  const values = {};
  css.walkRules(selector, rule => rule.walkDecls(decl => { values[decl.prop] = decl.value; }));
  return values;
}

describe('入城补给独占呈现边界', () => {
  it('计数样式优先于通用单张/双张宽度，条列不再被通用100%高度拉伸', () => {
    const objects = declarations(`${entryRoot}.reward-replica[data-reward-count] .reward-objects`);
    const strip = declarations(`${entryRoot}.reward-replica[data-reward-count] .reward-unit`);
    expect(objects).toMatchObject({ flex:'0 0 auto', 'min-height':'0', 'align-items':'stretch', 'justify-content':'flex-start' });
    expect(strip).toMatchObject({ flex:'0 0 360px', width:'360px', 'min-height':'0' });
    expect(declarations(`${entryRoot}.reward-replica[data-reward-count] .reward-card`)).toMatchObject({ width:'272px', 'max-width':'100%' });
  });

  it('1188宽当前窗口的提示正文至少13px，收下和整理按钮至少36px高', () => {
    const scale = 1188 / 1920;
    for (const target of ['.reward-notice', '.reward-rule']) {
      expect(parseFloat(declarations(`${entryRoot} ${target}`)['font-size']) * scale).toBeGreaterThanOrEqual(13);
    }
    for (const target of ['.reward-claim', '.reward-bag']) {
      expect(parseFloat(declarations(`${entryRoot} ${target}`)['min-height']) * scale).toBeGreaterThanOrEqual(36);
    }
    expect(parseFloat(declarations('body #overlay .entry-supply-strips .entry-complete-confirm')['min-height']) * scale).toBeGreaterThanOrEqual(36);
  });

  it('进度锚点与完成态只属于入城补给，普通奖励仍保留独立离开区', () => {
    expect(declarations(`${entryRoot} .loot-actions`).display).toBe('flex');
    expect(declarations('body #overlay .entry-supply-strips .entry-supply-status').display).toBe('grid');
    expect(declarations(`${entryRoot}.reward-replica.reward-complete[data-reward-count] .reward-objects`)['justify-content']).toBe('center');
    expect(declarations('body #overlay .card:has(.reward-replica) .reward-replica .reward-exit')['min-height']).toBe('220px');
    expect(declarations('body #overlay .card:has(.reward-replica) .reward-replica .reward-unit').width).toBe('278px');
  });
});
