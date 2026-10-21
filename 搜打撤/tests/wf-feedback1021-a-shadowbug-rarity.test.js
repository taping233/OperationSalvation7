/* 反馈#1（2026-10-21 老板实测 12 条）：影噬 tt3sp-shadowbug 稀有度调「史诗」。
 * 同 id 在 cards.data.js 有两处定义（TABLETOP3 旧面「影蛊」/ TABLETOP10 定版「影噬」），
 * 本文件锁三处一致性：定版定义、播种终态（生效面）、老档 face-refresh 幂等重刷
 * （TT10 marker 已置的老档不会重播 seedBatch，只能靠 ensureCanonicalFaceRefresh）。 */
import { describe, it, expect, vi } from 'vitest';
import { dataSlice } from '../game/src/cards/cards.data.js';
import { ensureCanonicalFaceRefresh } from '../game/src/cards/cards.sync.face-refresh.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;

const ID = 'tt3sp-shadowbug';
const canonical = () => dataSlice.TABLETOP10.find(card => card?.id === ID);

describe('反馈#1 影噬稀有度 = 史诗', () => {
  it('定版 TABLETOP10（生效卡面）为史诗', () => {
    expect(canonical()).toBeTruthy();
    expect(canonical().name).toBe('影噬');
    expect(canonical().rarity).toBe('史诗');
  });

  it('同 id 旧批次 TABLETOP3 定义稀有度同步为史诗（重复定义一致）', () => {
    const legacy = dataSlice.TABLETOP3.find(card => card?.id === ID);
    expect(legacy).toBeTruthy();
    expect(legacy.rarity).toBe('史诗');
  });

  it('全库播种终态：卡库该 id 只有一张且稀有度为史诗', () => {
    Cards.ensureStarters();
    Cards.ensureSha();
    Cards.ensureTabletop();
    const hits = Cards.all().filter(card => card.id === ID);
    expect(hits).toHaveLength(1);
    expect(hits[0].rarity).toBe('史诗');
    expect(Cards.rarityOf(hits[0])).toBe('史诗');
  });

  it('老档固化稀有度经 face-refresh 幂等重刷为史诗，其余字段不动', () => {
    const stale = { ...canonical(), rarity: '稀有' };
    let saved = [stale];
    const library = {
      TABLETOP10: dataSlice.TABLETOP10,
      all: () => saved,
      saveAll: vi.fn(next => { saved = next; return true; }),
    };
    ensureCanonicalFaceRefresh({ library });
    expect(saved[0].rarity).toBe('史诗');
    expect(saved[0].name).toBe(canonical().name);
    expect(saved[0].desc).toBe(canonical().desc);
    expect(library.saveAll).toHaveBeenCalledTimes(1);
    ensureCanonicalFaceRefresh({ library });
    expect(library.saveAll).toHaveBeenCalledTimes(1);   // 已定版 → 幂等不落盘
  });
});
