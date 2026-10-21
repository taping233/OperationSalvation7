// 2026-10-21 老板实测反馈 12 条第 7 条（C组）：「选择手牌」决策界面重做——
// 卡面加大、尽量单屏不翻页。契约：候选恒为单行（grid-auto-flow:column），
// 每格随可用宽度均分（190px 下限、520px 槽宽上限），字号随槽宽缩放，
// 整行超宽时由外层 .battle-decision-content 横向滚动兜底；壳层留白压缩。
// 同名卡去重已落地于 battle.decision-content.js 的 battleHandSelectBodyHTML
// （经主线确认归属 C 组）：按 cardIdentityKey 分组渲染一张 + 尾挂 ×N，详情
// 索引沿用组内首张的原 pool 下标；本测试同时锁定 DOM 去重契约（见最后一例）。
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import postcss from 'postcss';
import { battleHandSelectBodyHTML } from '../game/src/battle/view/battle.decision-content.js';

const css = postcss.parse(readFileSync('game/css/battle-decision.css', 'utf8'));
const rules = [];
css.walkRules(r => rules.push(r));
const declOf = selector => {
  const rule = rules.find(r => r.selectors.includes(selector));
  if (!rule) return null;
  const out = {};
  rule.walkDecls(d => { out[d.prop] = d.important ? `${d.value}!important` : d.value; });
  return out;
};
const prefix = 'body #overlay .battle-decision.battle-decision-unified ';

it('选择手牌网格单行排布：不纵向翻页，宽度均分、超宽才横滚', () => {
  const grid = declOf(`${prefix}.battle-select-grid.bt-hand`);
  expect(grid).toMatchObject({
    display: 'grid!important',
    'container-type': 'size',
    height: '100%',
    'grid-auto-flow': 'column!important',
    'grid-template-columns': 'none!important',
    'grid-auto-columns': 'minmax(190px,1fr)',
    'grid-template-rows': 'minmax(0,1fr)',
    gap: '24px!important',
  });
  // 滚动兜底交给外层（既有契约：.battle-decision-content overflow auto）。
  expect(grid.overflow).toBeUndefined();
  expect(declOf('body #overlay .battle-decision.battle-decision-unified .battle-decision-content')).toMatchObject({ overflow: 'auto!important' });
});

it('卡面随槽宽放大：少卡更大、字号按容器宽度缩放，单卡有 520px 上限', () => {
  const slot = declOf(`${prefix}.battle-select-slot`);
  expect(slot).toMatchObject({ display: 'flex', width: 'auto', 'min-width': '0', 'max-width': '520px', 'container-type': 'inline-size' });
  expect(slot.width).not.toBe('300px'); // 旧固定 300px 槽已撤下
  const face = declOf(`${prefix}.battle-select-slot .hs-card`);
  expect(face['font-size']).toBe('min(30px,calc(100cqw * .096))');
  expect(face.width).toBe('100%!important');
  expect(declOf(`${prefix}.battle-select-slot .bt-card`)['width']).toBe('100%!important');
});

it('手牌选择页压缩壳层留白，把高度让给单行卡面', () => {
  const kind = 'body #overlay .battle-decision.battle-decision-unified[data-decision-kind="hand-select"]';
  expect(declOf(`${kind} .battle-decision-head`)).toMatchObject({ padding: '14px 36px 6px' });
  expect(declOf(`${kind} .battle-decision-summary`)).toMatchObject({ padding: '4px 36px 12px' });
  expect(declOf(`${kind} .battle-decision-content`)).toMatchObject({ padding: '10px 36px 12px' });
  expect(declOf(`${kind} .battle-decision-actions`)).toMatchObject({ padding: '12px 36px' });
});

it('新增规则仍是 #overlay 作用域且可被 querySelector 解析（既有壳测试不变式）', () => {
  for (const rule of rules) {
    expect(rule.selector).toContain('#overlay');
    expect(() => document.querySelector(rule.selector)).not.toThrow();
  }
  const shell = readFileSync('game/src/battle/view/battle.decision-content.js', 'utf8');
  // 去重已按 cardIdentityKey 分组渲染 ×N（DOM 契约见下一例）。
  expect(shell).toContain('export const cardIdentityKey');
  expect(shell).toContain('data-decision-content="hand-select"');
});

it('同名手牌候选合并为一张 ×N 展示，选卡仍按实际 uid 提交（反馈 #7 去重）', () => {
  const face = card => `<div class="hs-card">${card.name}</div>`;
  const entry = (uid, id, name) => ({ uid, card: { id, name, type: '武术', cost: 1, desc: '规则' } });
  const pool = [entry('a1', 'same', '甲'), entry('a2', 'same', '甲'), entry('b1', 'other', '乙'), entry('a3', 'same', '甲')];
  document.body.innerHTML = `<main>${battleHandSelectBodyHTML({ pool, handSelecting: { act: 'copy', n: 1, canCancel: false }, cardHTML: face })}</main>`;
  const picks = [...document.querySelectorAll('[data-act="btPickHand"]')];
  // 同名三张只展示一张（代表 = 组内首张 uid），异名单独一张。
  expect(picks.map(button => button.dataset.uid)).toEqual(['a1', 'b1']);
  expect(picks[0].querySelector('.bt-count')?.textContent).toBe('×3');
  expect(picks[1].querySelector('.bt-count')).toBeNull();
  expect(picks[0].getAttribute('aria-label')).toContain('同名 3 张');
  // 查看详情索引映射原 pool 下标（检查器 cards = pool.map(card) 不变）。
  expect([...document.querySelectorAll('[data-act="btDecisionInspect"]')].map(button => button.dataset.i)).toEqual(['0', '2']);
  // 选卡语义不变：单击提交一张、不隐式取消。
  expect(picks.every(button => button.dataset.cancel === 'false')).toBe(true);
  // 空池仍走空态文案。
  document.body.innerHTML = `<main>${battleHandSelectBodyHTML({ pool: [], handSelecting: { act: 'copy', n: 1 }, cardHTML: face })}</main>`;
  expect(document.querySelector('.ov-empty')).not.toBeNull();
  expect(document.querySelectorAll('[data-act="btPickHand"]')).toHaveLength(0);
});
