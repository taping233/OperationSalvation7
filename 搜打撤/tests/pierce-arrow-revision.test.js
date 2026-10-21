import { describe, expect, it, vi } from 'vitest';
import { dataSlice } from '../game/src/cards/cards.data.js';
import { ensureCanonicalFaceRefresh } from '../game/src/cards/cards.sync.face-refresh.js';

const canonical = dataSlice.TABLETOP10.find(card => card.id === 'tt2-piercearrow');
const oldCard = () => ({ id: 'tt2-piercearrow', name: '破甲箭', cost: 1, rarity: '古朴', type: '武术',
  desc: '攻（-1），获得 3 点护甲。', dmg: -1, dmgType: 'attack', armor: 3, value: 2,
  rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }, { op: 'armor', amount: 3 },
  ] } } });
function harness(cards) {
  let saved = cards;
  const library = { TABLETOP10: dataSlice.TABLETOP10, all: () => saved,
    saveAll: vi.fn(next => { saved = next; return true; }) };
  return { library, cards: () => saved };
}

describe('破甲箭定版刷新', () => {
  it.each([true, false])('旧卡库规则存在=%s：移除加甲并更新为破甲，保留其他卡与装饰字段', withRules => {
    const old = { ...oldCard(), art: 'custom-art' };
    if (!withRules) delete old.rules;
    const echo = { id: 'tt2-forestarrow', name: '回音箭', armor: 3 };
    const h = harness([old, echo]);
    ensureCanonicalFaceRefresh(h);
    expect(h.cards()[0]).toEqual({ ...canonical, art: 'custom-art' });
    expect(h.cards()[0]).not.toHaveProperty('armor');
    expect(h.cards()[1]).toBe(echo);
    expect(old.armor).toBe(3);
    ensureCanonicalFaceRefresh(h);
    expect(h.library.saveAll).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: '自定义名称' }, { dmg: 99 }, { armor: 8 }, { desc: '自定义效果' },
    { rules: { version: 1, triggers: { onPlay: [{ op: 'draw', amount: 2 }] } } },
  ])('保留玩家自定义卡 %j', changes => {
    const card = { ...oldCard(), ...changes }, h = harness([card]);
    ensureCanonicalFaceRefresh(h);
    expect(h.cards()[0]).toBe(card);
    expect(h.library.saveAll).not.toHaveBeenCalled();
  });

  it('保存失败不修改热缓存，下次可重试', () => {
    const old = oldCard(), h = harness([old]);
    h.library.saveAll.mockReturnValueOnce(false);
    ensureCanonicalFaceRefresh(h);
    expect(h.cards()[0]).toBe(old);
    expect(old.armor).toBe(3);
    ensureCanonicalFaceRefresh(h);
    expect(h.cards()[0]).toEqual(canonical);
  });
});
