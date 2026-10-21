import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { expect, it } from 'vitest';

const css = postcss.parse(readFileSync('game/css/chest-reward-overview.css', 'utf8'));
const prefix = 'body #overlay .card:has(.reward-standalone-picker) .reward-standalone-picker.reward-replica';
const values = suffix => {
  const result = {};
  css.walkRules(rule => {
    if (rule.selectors.includes(prefix + suffix)) rule.walkDecls(d => { result[d.prop] = d.value; });
  });
  return result;
};
it('固定事件共享居中舞台与明确操作，空操作栏不占侧列，滚动仅在卡区', () => {
  expect(values(' .reward-main')).toMatchObject({ display:'flex', 'flex-direction':'column' });
  expect(values(' .reward-objects:has(> .reward-unit:only-child)')).toMatchObject({ 'justify-content':'center', 'grid-template-columns':'280px' });
  expect(values(' .loot-actions:empty').display).toBe('none');
  expect(values(' .reward-stage')).toMatchObject({ 'container-type':'size', overflow:'auto', flex:'1 1 0' });
  expect(values(' .reward-foot')).toMatchObject({ flex:'none', 'flex-wrap':'wrap' });
  expect(values(' :is(.reward-exit,.reward-secondary,.reward-bag)')).toMatchObject({ 'min-height':'44px', 'border-radius':'6px' });
  expect(values(' .reward-claim')['min-height']).toBe('46px');
  expect(values(' .reward-head').display).toBe('block');
  expect(values(' .reward-head .reward-source').display).toBe('block');
  expect(values('')['--cqo-accent']).toBe('#aab5bf');
});
it('共享规则只显式接入独立领取，不改变其他奖励入口或战斗箱既有声明', () => {
  const sceneLayers = new Set([
    'body #overlay .card .cqo-frame.reward-replica',
    'body #overlay .card .cqo-frame.reward-replica::before',
  ]);
  let shared = 0;
  css.walkRules(rule => {
    if (!rule.selectors.some(selector => selector.startsWith(prefix))) return;
    expect(rule.selectors.every(selector => selector.startsWith(prefix) || selector.startsWith('body #overlay .card .cqo-frame .cqp-dialog ') || sceneLayers.has(selector))).toBe(true);
    if (rule.selectors.length === 2) shared++;
  });
  expect(shared).toBeGreaterThan(20);
  const source = readFileSync('game/src/run/chests.js', 'utf8');
  expect(source).toContain("overviewMode ? '' : ' reward-standalone-picker'");
  expect(source).toContain('overviewMode = !(cur.source || cur.title);');
});
it('只读夹具显式提供固定事件两态，保留真实视图与战斗箱分支，不接入生产命令', () => {
  const html = readFileSync('game/dev/reward-hierarchy-review.html', 'utf8');
  const source = readFileSync('game/dev/reward-hierarchy-review.js', 'utf8');
  expect(html).toContain('<option value="event-single">固定事件单卡</option>');
  expect(html).toContain('<option value="event-full">固定事件满包</option>');
  expect(html).toContain('纯呈现 · 不连接存档');
  expect(source).toContain("mode === 'event-single' || mode === 'event-full'");
  expect(source).toContain("card.id === 'tt3-iceheart-potion'");
  expect(source).toContain("source:standalone?'污染空投箱':''");
  expect(source).toContain("title:standalone?'领取奖励':rewardPickerTitle");
  expect(source).toContain("standalone ? ' reward-standalone-picker' : ''");
  expect(source).toContain('standalone ? picker : chestRewardFrameHTML(');
  expect(source).toContain('隔离展示：不执行领取、丢弃或存档操作。');
  expect(source).not.toMatch(/localStorage|persistSave|Sound\.|main\.js|run\/chests|UI\.act|grantCard/);
});
