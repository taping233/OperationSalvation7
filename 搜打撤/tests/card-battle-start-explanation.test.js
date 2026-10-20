import { describe, expect, it } from 'vitest';
import { battleStartExplanation } from '../game/src/cards/card-battle-start-explanation.js';
import { decorateInventoryZoom } from '../game/src/ui/inventory-zoom.js';

describe('开战装备库存说明', () => {
  it('显式空开战规则覆盖旧说明，其他装备域不吞掉未迁移开战句', () => {
    const card = { type: '装备', desc: '对战开始时，获得 3 点护甲。' };
    expect(battleStartExplanation({ ...card, rules: { equip: { battleStart: [] } } })).toBe('');
    expect(battleStartExplanation({ ...card, rules: { equip: { skill: { ops: [] } } } }))
      .toBe(battleStartExplanation(card));
  });
  it('文本与结构化开战装备同样说明BOSS编入条件，不改原描述', () => {
    const card = { id: 'sword', name: '骷髅王剑', type: '装备', desc: '对战开始时，你的初始攻击化为不朽斩。' };
    const before = JSON.stringify(card);
    expect(battleStartExplanation(card)).toContain('BOSS 战编入本场牌库');
    expect(battleStartExplanation(card)).toContain('普通战不触发');
    expect(battleStartExplanation({ type: '装备', desc: '', rules: { equip: { battleStart: [{ op: 'armor', amount: 1 }] } } })).toBe(battleStartExplanation(card));
    expect(battleStartExplanation({ ...card, type: '武术' })).toBe('');
    expect(battleStartExplanation({ type: '装备', desc: '攻 +1' })).toBe('');
    expect(JSON.stringify(card)).toBe(before);
  });
  it('库存/背包共用大图装饰器显示可见说明，重复打开不重复附加', () => {
    window.SDT ||= {}; window.SDT.UI = { _acts: {} };
    document.body.innerHTML = '<div id="cardZoom"><div class="cz-card"></div><footer class="cz-foot"></footer></div>';
    const card = { name: '骷髅王剑', type: '装备', desc: '对战开始时，初始攻击化为不朽斩。' };
    decorateInventoryZoom(card); decorateInventoryZoom(card);
    expect(document.querySelectorAll('.inventory-zoom-start-hint')).toHaveLength(1);
    expect(document.querySelector('.inventory-zoom-start-hint').textContent).toBe(battleStartExplanation(card));
    document.body.replaceChildren();
  });
});
