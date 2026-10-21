// @vitest-environment node
// 2026-10-21 老板实测反馈 12 条第 3 条（C组）：获得奖励界面不得出现上下滚动条。
// 契约：短视口（≤880px 高）用媒体查询收紧 chrome 让箱格与单卡拾取区收缩进首屏；
// 1920×1080 走基线；领取规则、按钮结构与 280px 卡面口径不被媒体查询改写。
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import postcss from 'postcss';

const css = postcss.parse(readFileSync('game/css/chest-reward-overview.css', 'utf8'));

function allRules() {
  const list = [];
  css.walkRules(r => list.push(r));
  return list;
}
function mediaRules(maxHeight) {
  const found = [];
  css.walkAtRules('media', rule => {
    if (rule.params.includes(`max-height:${maxHeight}px`)) rule.walkRules(r => found.push(r));
  });
  return found;
}
const decls = (rules, selector) => {
  const rule = rules.find(r => r.selectors.includes(selector));
  if (!rule) return null;
  const out = {};
  rule.walkDecls(d => { out[d.prop] = d.value; });
  return out;
};
const plainDecls = selector => decls(allRules(), selector);

it('短视口媒体查询收紧总览箱格与拾取区排版，只动间距不动结构', () => {
  const rules = mediaRules(880);
  expect(rules.length).toBeGreaterThan(0);
  const prefix = 'body #overlay .card .cqo-frame ';
  // 箱格：插画高度与内距按视口收缩，1280×720 下箱体内容回到可用高度内。
  expect(decls(rules, `${prefix}.cqo-overview .cqo-box-art`)).toMatchObject({
    height: 'clamp(130px,22vh,240px)', 'min-height': '130px',
  });
  expect(decls(rules, `${prefix}.cqo-overview .cqo-box`)).toMatchObject({ 'min-height': '280px', gap: '8px' });
  expect(decls(rules, `${prefix}.cqo-overview .cqo-rewards`)).toHaveProperty('padding');
  expect(decls(rules, `${prefix}.cqo-overview .cqo-boxes`)).toHaveProperty('padding');
  expect(decls(rules, `${prefix}.cqo-footer`)).toHaveProperty('padding');
  expect(decls(rules, `${prefix}.cqo-background`)).toHaveProperty('padding');
  // 拾取浮层：遮罩/工具条/紧凑头尾与卡台内距收紧，单卡 420px 面 + 领取按钮留进首屏。
  expect(decls(rules, `${prefix}.cqp-shade`)).toHaveProperty('padding');
  expect(decls(rules, `${prefix}.cqp-dialog .cqp-toolbar`)).toHaveProperty('padding');
  const foot = decls(rules, `${prefix}.cqp-dialog .reward-compact .reward-foot`);
  expect(foot).toEqual({ padding: '8px 20px' }); // 不得覆盖基线 flex-wrap 契约
  const stage = decls(rules, `${prefix}.cqp-dialog .reward-stage`);
  expect(stage).toHaveProperty('padding');
  expect(stage).not.toHaveProperty('min-height');
  expect(stage).not.toHaveProperty('overflow');
  // 媒体查询不得改写被既有测试锁定的结构属性。
  expect(decls(rules, `${prefix}.cqo-overview .cqo-boxes`)).toEqual({ padding: '8px 12px 14px' });
  expect(decls(rules, `${prefix}.cqo-footer`)).toEqual({ padding: '12px 24px' });
});

it('基线规则保持自适应骨架：溢出兜底与 280px 卡面口径不变', () => {
  expect(plainDecls('body #overlay .card .cqo-frame .cqo-overview')).toMatchObject({ overflow: 'hidden' });
  expect(plainDecls('body #overlay .card .cqo-frame .cqp-dialog .reward-stage')).toMatchObject({ overflow: 'auto', 'container-type': 'size' });
  expect(plainDecls('body #overlay .card .cqo-frame .cqp-dialog .reward-unit .reward-card')['min-width']).toBe('280px');
  expect(plainDecls('body #overlay .card .cqo-frame .cqo-box-art')['height']).toBe('clamp(200px,27vh,280px)');
});

it('C组第 8 条：返回地图钉在奖励行动行最右（DOM 序不动、order 定位）', () => {
  expect(plainDecls('body #overlay .card .cqo-frame .cqo-overview .cqo-actions > [data-act="chestReturn"]')).toMatchObject({ order: '9' });
  const standalone = plainDecls('body #overlay .card:has(.reward-standalone-picker) .reward-standalone-picker .reward-footer-info > [data-act="chestReturn"]');
  expect(standalone).toMatchObject({ order: '9', 'margin-left': 'auto' });
});
