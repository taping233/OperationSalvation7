// @vitest-environment node
// 2026-10-21 老板实测反馈 12 条第 3 条（C组）：获得奖励界面不得出现上下滚动条。
// 2026-10-23 统一奖励布局：标题/页脚固定，只有奖励内容区滚动；
// 卡面使用统一 300px 口径，公共顶栏预留一次安全区。
import {readCssSource} from './helpers/css-source.js';
import { expect, it } from 'vitest';
import postcss from 'postcss';

const css = postcss.parse(['chest-reward-overview','room-rewards','room-footer'].map(name=>readCssSource(`game/css/${name}.css`, 'utf8')).concat(readCssSource('game/src/ui/run-top-bar.css')).join('\n'));

function allRules() {
  const list = [];
  css.walkRules(r => list.push(r));
  return list;
}
const decls = (rules, selector) => {
  const rule = rules.find(r => r.selectors.includes(selector));
  if (!rule) return null;
  const out = {};
  rule.walkDecls(d => { out[d.prop] = d.value; });
  return out;
};
const plainDecls = selector => decls(allRules(), selector);

it('总览和拾取层固定头尾，内部内容收缩并独立滚动', () => {
  expect(plainDecls('body #overlay .card .cqo-frame .cqo-rewards')).toMatchObject({flex:'1','min-height':'0',overflow:'auto'});
  expect(plainDecls('body #overlay .card .cqo-frame .cqo-intro')).toMatchObject({flex:'none'});
  expect(plainDecls('body #overlay .card .room-reward .reward-head')).toMatchObject({'grid-row':'1'});
  expect(plainDecls('body #overlay .card .room-reward .reward-main')).toMatchObject({'min-height':'0',overflow:'hidden'});
  expect(plainDecls('body #overlay .card .room-reward .reward-foot.room-footer')).toMatchObject({display:'grid',overflow:'visible'});
  expect(plainDecls('body #runTopBar.run-topbar')).toMatchObject({height:'104px','box-sizing':'border-box'});
});

it('基线规则保持自适应骨架：溢出兜底与 300px 卡面口径不变', () => {
  expect(plainDecls('body #overlay .card .cqo-frame .cqo-overview')).toMatchObject({ overflow: 'hidden' });
  expect(plainDecls('body #overlay .card .room-reward .reward-stage')).toMatchObject({ overflow: 'auto', 'container-type': 'size','min-height':'0' });
  expect(plainDecls('body #overlay .card .room-reward .reward-unit .reward-card')).toMatchObject({'min-width':'300px','max-width':'300px'});
  expect(plainDecls('body #overlay .card .cqo-frame .cqo-box-art')['height']).toBe('150px');
  expect(plainDecls('body #overlay .card .cqo-frame .cqo-boxes')).toMatchObject({display:'flex','flex-wrap':'wrap'});
});

it('主要去向位于统一页脚右侧，返回地图使用同一出口样式', () => {
  expect(plainDecls('body #overlay .card .cqo-frame .cqo-button-primary')).toMatchObject({order:'10'});
  expect(plainDecls('body #overlay .card .room-reward .reward-exit')).toMatchObject({order:'10'});
  expect(plainDecls('body #overlay .card .room-reward .loot-actions')).toMatchObject({'justify-content':'flex-end'});
});
