import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { expect, it } from 'vitest';
import { chestRewardFrameHTML, chestRewardOverviewHTML } from '../game/src/ui/chest-reward-overview.js';

it('箱内领取仅当前层可见，总览保留尺寸且不可交互，返回后原动作恢复', () => {
  const css = postcss.parse(readFileSync('game/css/chest-reward-overview.css', 'utf8'));
  const selectors = [];
  css.walkRules('body #overlay .card .cqo-frame.cqo-picker-open .cqo-background', rule => {
    const declarations = {}; rule.walkDecls(d => declarations[d.prop] = d.value); selectors.push(declarations);
  });
  expect(selectors).toEqual([{ visibility:'hidden' }]);
  const overview = chestRewardOverviewHTML({ boxes:[{ index:0, name:'物资箱' }], footer:'8/16 格' });
  const root = document.createElement('div');
  root.innerHTML = chestRewardFrameHTML({ overview, picker:'<button data-act="claim">领取</button>' });
  expect(root.querySelector('.cqo-frame').classList.contains('cqo-picker-open')).toBe(true);
  expect(root.querySelector('.cqo-background').hasAttribute('inert')).toBe(true);
  expect(root.querySelector('.cqo-background').getAttribute('aria-hidden')).toBe('true');
  expect(root.querySelector('.cqp-dialog [data-act="chestClosePicker"]')).not.toBeNull();
  root.innerHTML = chestRewardFrameHTML({ overview });
  expect(root.querySelector('.cqo-frame').classList.contains('cqo-picker-open')).toBe(false);
  expect(root.querySelector('.cqo-background').hasAttribute('inert')).toBe(false);
  expect(root.querySelector('.cqo-background').hasAttribute('aria-hidden')).toBe(false);
  expect(root.querySelector('[data-act="chestOverviewBag"]')).not.toBeNull();
  expect(root.querySelector('.cqo-footer-note').textContent).toBe('8/16 格');
});


it('总览关键说明与操作增大，金币列加宽而箱列表保留独立滚动', () => {
  const css = postcss.parse(readFileSync('game/css/chest-reward-overview.css', 'utf8'));
  const prefix = 'body #overlay .card .cqo-frame ';
  const decl = suffix => {
    const result = {};
    css.walkRules(prefix + suffix, rule => rule.walkDecls(d => { result[d.prop] = d.value; }));
    return result;
  };
  for (const selector of ['.cqo-notice','.cqo-summary','.cqo-box-rule','.cqo-footer-note','.cqo-box-status']) {
    expect(Number.parseFloat(decl(selector)['font-size']), selector).toBeGreaterThanOrEqual(22);
  }
  expect(decl('.cqo-progress small')['font-size']).toBe('18px');
  expect(decl('.cqo-button')).toMatchObject({'font-size':'24px','min-height':'60px','max-width':'100%','white-space':'normal'});
  expect(decl('.cqo-coins').flex).toBe('0 0 240px');
  expect(decl('.cqo-coins b')).toMatchObject({'max-width':'100%','overflow-wrap':'anywhere'});
  expect(decl('.cqo-footer-note')['min-width']).toBe('0');
  expect(decl('.cqo-boxes')).toMatchObject({'min-width':'0','overflow':'auto'});
  expect(decl('.cqo-footer')['flex-wrap']).toBe('wrap');
  expect(decl('.cqo-actions')).toMatchObject({'flex-wrap':'wrap','max-width':'100%'});
  expect(decl('.cqo-progress')['flex-wrap']).toBe('wrap');
  expect(decl('.cqo-overview').overflow).toBe('hidden');
  // 旧共享关闭按钮不跟随总览变大；picker独立布局/滚动继续保留。
  expect(decl(':is(.cqo-button,.cqp-close)')['min-height']).toBe('48px');
  expect(decl('.cqp-dialog')['max-height']).toBeTruthy();
});


it.each([
  [{}, '3 张 · 可全部领取'],
  [{opened:true}, '3 张 · 可全部领取'],
  [{takenCount:1,opened:true}, '已领取 1 张 · 剩余 2 张待处理'],
  [{takenCount:3,completed:true}, '已领取 3 张'],
  [{lostCount:3,completed:true}, '已放弃 3 张'],
  [{takenCount:1,lostCount:2,completed:true}, '已领取 1 张 · 已放弃 2 张'],
  [{takenCount:1,lostCount:2,completed:true,choice:true}, '已领取 1 张 · 其余 2 张已放弃'],
  [{takenCount:1,lostCount:1,opened:true,choice:true}, '已领取 1 张 · 其余 1 张已放弃 · 剩余 1 张待处理'],
])('总览状态%j不在结束后继续承诺可领取', (state, text) => {
  const box={index:0,name:'箱',cardCount:3,takenCount:0,lostCount:0,rule:'3 张 · 可全部领取',...state};
  const before=JSON.stringify(box);
  const root=document.createElement('div'); root.innerHTML=chestRewardOverviewHTML({boxes:[box]});
  expect(root.querySelector('.cqo-box-rule').textContent).toBe(text);
  expect(root.querySelector('.cqo-box').disabled).toBe(!!state.completed);
  expect(JSON.stringify(box)).toBe(before);
  if(state.completed) expect(root.textContent).not.toContain('可全部领取');
});
it('未开启三选一保留规则，不将候选数描述为获得数', () => {
  const root=document.createElement('div');
  root.innerHTML=chestRewardOverviewHTML({boxes:[{index:0,choice:true,rule:'3 张中选 1 张',cardCount:0,takenCount:0,lostCount:0}]});
  expect(root.querySelector('.cqo-box-rule').textContent).toBe('3 张中选 1 张');
});

it('picker 数量与附赠提示独立可见，完成无规则时也不被隐藏', async () => {
  const { rewardSceneHTML } = await import('../game/src/ui/reward-scene-view.js');
  const css = readFileSync('game/css/chest-reward-overview.css', 'utf8');
  const parsed = postcss.parse(css);
  const hidden = [];
  parsed.walkRules(rule => {
    if (rule.nodes.some(d => d.prop === 'display' && d.value === 'none')) hidden.push(rule.selector);
  });
  for (const rule of ['', '基础任选 1 张，附赠可另领']) {
    const root = document.createElement('div');
    root.id = 'overlay';
    root.innerHTML = `<div class="card">${chestRewardFrameHTML({ overview:'', picker:rewardSceneHTML({title:'选择收获',source:'物资箱',countLabel:'共 6 张 · 含额外 3 张 · 横向查看全部',rule,cards:'',actions:''}) })}</div>`;
    document.body.append(root);
    const count = root.querySelector('.reward-count');
    expect(count.textContent).toBe('共 6 张 · 含额外 3 张 · 横向查看全部');
    for (let el = count; el && el !== root; el = el.parentElement) {
      for (const selector of hidden) expect(el.matches(selector), selector).toBe(false);
    }
    expect(root.querySelector('.reward-source').textContent).toBe('物资箱');
    root.remove();
  }
  const plain = rewardSceneHTML({title:'事件',cards:'',actions:''});
  expect(plain).not.toContain('class="reward-count"');
});


it('互斥箱完成只说明本箱已放弃，另一箱仍可继续领取', () => {
  const boxes = [
    { index:0, name:'已选箱', cardCount:3, takenCount:1, lostCount:2, choice:true, completed:true },
    { index:1, name:'待领箱', cardCount:2, takenCount:1, lostCount:0, opened:true },
  ];
  const before = JSON.stringify(boxes);
  const root = document.createElement('div');
  root.innerHTML = chestRewardOverviewHTML({ boxes, claimedCards:[{name:'实际所得'}], primaryAction:{index:1,label:'继续领取'} });
  const [done, pending] = root.querySelectorAll('.cqo-box');
  expect(done.querySelector('.cqo-box-rule').textContent).toBe('已领取 1 张 · 其余 2 张已放弃');
  expect(done.textContent).not.toContain('未领取');
  expect(done.disabled).toBe(true);
  expect(pending.querySelector('.cqo-box-rule').textContent).toBe('已领取 1 张 · 剩余 1 张待处理');
  expect(pending.disabled).toBe(false);
  expect(root.querySelector('[data-act="chestNext"]').dataset.i).toBe('1');
  expect(root.querySelector('[data-act="chestFinish"]')).toBeNull();
  expect(root.querySelector('.cqo-progress').getAttribute('aria-label')).toBe('1 箱待领，共 2 箱');
  expect(root.querySelectorAll('.cqo-receipt li')).toHaveLength(1);
  expect(root.querySelector('.cqo-receipt li').textContent).toBe('实际所得 ×1');
  expect(JSON.stringify(boxes)).toBe(before);
});
