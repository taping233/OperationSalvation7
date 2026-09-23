import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCardRules } from '../game/src/card-rules.schema.js';
import { KEY } from '../game/src/cards.consts.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');

const Cards = window.SDT.Cards;
const originalRaw = localStorage.getItem(KEY);

function resetStore() {
  Cards.clearAll();
  if (originalRaw != null) localStorage.setItem(KEY, originalRaw);
}

beforeEach(resetStore);
afterAll(resetStore);

describe('卡库规则运行时边界', () => {
  it('载入含无效规则的旧档时报告卡牌 id/path，并保留原存档而不缓存为空库', () => {
    const raw = JSON.stringify([
      { id: 'archive-unknown-version', name: '未知规则卡', rules: { version: 8 } },
    ]);
    localStorage.setItem(KEY, raw);

    expect(() => Cards.all()).toThrow(/archive-unknown-version rules\.version/);
    expect(localStorage.getItem(KEY)).toBe(raw);
    expect(() => Cards.all()).toThrow(/archive-unknown-version rules\.version/);
  });

  it('拒绝无效 saveAll/upsert，且恢复被原地修改过的缓存到最后一次有效存档', () => {
    const baseline = [{ id: 'saved-card', name: '有效卡', desc: '持久化描述' }];
    expect(Cards.saveAll(baseline)).toBe(true);
    const persistedRaw = localStorage.getItem(KEY);
    const persistedSnapshot = JSON.parse(persistedRaw);

    const cached = Cards.all();
    cached[0].desc = '尚未保存的缓存改动';
    cached.push({ id: 'invalid-save-card', rules: { version: 2 } });
    expect(() => Cards.saveAll(cached)).toThrow(/invalid-save-card rules\.version/);
    expect(localStorage.getItem(KEY)).toBe(persistedRaw);
    expect(Cards.all()).toEqual(persistedSnapshot);

    expect(() => Cards.upsert({ id: 'invalid-upsert-card', rules: { version: 99 } }))
      .toThrow(/invalid-upsert-card rules\.version/);
    expect(Cards.all()).toEqual(persistedSnapshot);
    expect(localStorage.getItem(KEY)).toBe(persistedRaw);
  });

  it('允许兼容的无 rules 卡和通过 schema 的结构化规则卡写入及载入', () => {
    const cards = [
      { id: 'legacy-no-rules', name: '旧卡', desc: '继续兼容' },
      { id: 'valid-structured', type: '资源', rules: { version: 1, base: { material: { kind: 'wood', amount: 3 } } } },
    ];
    expect(validateCardRules(cards[1]).ok).toBe(true);
    expect(Cards.saveAll(cards)).toBe(true);
    expect(Cards.all()).toEqual(cards);

    Cards.upsert({ id: 'valid-upsert', type: '资源', rules: { version: 1, base: { material: { kind: 'keys', amount: 2 } } } });
    expect(Cards.all().find(card => card.id === 'valid-upsert').rules.base.material)
      .toEqual({ kind: 'keys', amount: 2 });
  });

  it('localStorage 写入失败时恢复 last-good 缓存，不暴露失败候选值', () => {
    const baseline = [{ id: 'storage-baseline', desc: '已保存' }];
    Cards.saveAll(baseline);
    const persistedRaw = localStorage.getItem(KEY);
    const persistedSnapshot = JSON.parse(persistedRaw);
    const cached = Cards.all();
    cached[0].desc = '写入失败的变更';
    cached.push({ id: 'write-failed-candidate', desc: '未能保存' });

    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === KEY) throw new DOMException('quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(Cards.saveAll(cached)).toBe(false);
      expect(localStorage.getItem(KEY)).toBe(persistedRaw);
      expect(Cards.all()).toEqual(persistedSnapshot);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
