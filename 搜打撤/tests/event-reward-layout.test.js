import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { expect, it } from 'vitest';
import { readCssSource } from './helpers/css-source.js';

const css = postcss.parse(readCssSource('game/css/room-rewards.css', 'utf8'));
const prefix = 'body #overlay .card .room-reward';
const values = suffix => {
  const result = {};
  css.walkRules(rule => {
    if (rule.selectors.includes(prefix + suffix)) rule.walkDecls(d => { result[d.prop] = d.value; });
  });
  return result;
};
it('固定事件共享居中舞台与明确操作，空操作栏不占侧列，滚动仅在卡区', () => {
  expect(values('.reward-replica')).toMatchObject({ display:'grid', 'grid-template-columns':'minmax(0,1fr)', overflow:'hidden' });
  expect(values(' .reward-main')).toMatchObject({ display:'flex', 'min-height':'0',overflow:'hidden' });
  expect(values(' .reward-objects')).toMatchObject({ 'justify-content':'center','flex-wrap':'wrap' });
  expect(values(' .reward-stage')).toMatchObject({ 'container-type':'size', overflow:'auto', flex:'1 1 0' });
  expect(values(' .reward-foot.room-footer')).toMatchObject({ display:'grid','grid-template-columns':'minmax(0,1fr) auto',overflow:'visible' });
  expect(values(' .loot-actions')).toMatchObject({ display:'flex','justify-content':'flex-end' });
  expect(values(' :is(.reward-bag,.reward-secondary)')['min-height']).toBe('52px');
  expect(values(' .reward-claim')['min-height']).toBe('52px');
  expect(values(' .reward-head').display).toBe('flex');
  expect(values(' .reward-exit').order).toBe('10');
});
it('统一奖励规则限定在显式room-reward，不扩散到其他页面', () => {
  let shared = 0;
  css.walkRules(rule => {
    if (!rule.selectors.some(selector => selector.startsWith(prefix))) return;
    expect(rule.selectors.every(selector => selector.startsWith(prefix))).toBe(true);
    shared++;
  });
  expect(shared).toBeGreaterThan(20);
  expect(readFileSync('game/src/ui/reward-scene-view.js','utf8')).toContain('room-reward');
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
