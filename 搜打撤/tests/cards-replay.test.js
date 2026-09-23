import { describe, it, expect } from 'vitest';
import { DATA } from '../game/src/data-loader.js';
import { KEY as CARDS_KEY, TT10_KEY, TT11_KEY } from '../game/src/cards.consts.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');

const Cards = window.SDT.Cards;
const liveSyncKey = `sdt-cards-sync-v${DATA.cardsSync.version}-seeded`;

describe('TT10/TT11 历史重播保护', () => {
  for (const { name, key, method } of [
    { name: 'TT10', key: TT10_KEY, method: 'ensureTabletopSync' },
    { name: 'TT11', key: TT11_KEY, method: 'ensureTabletopSync11' },
  ]) {
    it(`${name} 重播时使用最新 sync 语义、保留仓库元数据并服从退役`, () => {
      const tableName = name === 'TT10' ? 'TABLETOP10' : 'TABLETOP11';
      const previousCards = Cards.all().map(card => ({ ...card }));
      const previousTable = Cards[tableName];
      const previousKeys = new Map([CARDS_KEY, key, liveSyncKey].map(k => [k, localStorage.getItem(k)]));
      const synced = DATA.cardsSync.cards.find(card => previousTable.some(row => row.id === card.id));
      const retiredId = DATA.cardsSync.retire[0];
      const snapshotRows = [
        { ...synced, desc: '历史旧描述', cost: -1, art: 'repository-only-art', battle: true },
        { id: retiredId, name: '退役卡', desc: '不得复活', cost: 1 },
        { id: `replay-only-${name.toLowerCase()}`, name: '新卡补种', desc: '仅在历史快照', cost: 1 },
      ];
      const retainedLiveKey = localStorage.getItem(liveSyncKey) || '1';
      try {
        Cards[tableName] = snapshotRows;
        Cards.saveAll([{ id: synced.id, name: '旧存档名', desc: '旧存档描述' }, { id: retiredId, name: '退役卡' }]);
        localStorage.removeItem(key);
        localStorage.setItem(liveSyncKey, retainedLiveKey);

        Cards[method]();
        const replayed = Cards.all();
        const canonical = replayed.find(card => card.id === synced.id);
        const currentDefinition = DATA.cardsSync.cards.find(card => card.id === synced.id);
        expect(canonical).toMatchObject(currentDefinition);
        expect(canonical.art).toBe('repository-only-art');
        expect(canonical.battle).toBe(true);
        expect(replayed.some(card => card.id === retiredId)).toBe(false);
        expect(replayed.find(card => card.id === snapshotRows[2].id)).toMatchObject(snapshotRows[2]);
        expect(localStorage.getItem(liveSyncKey)).toBe(retainedLiveKey);

        canonical.desc = '玩家重播后编辑';
        Cards.saveAll(replayed);
        Cards[method]();
        expect(Cards.all().find(card => card.id === synced.id).desc).toBe('玩家重播后编辑');
      } finally {
        Cards[tableName] = previousTable;
        Cards.saveAll(previousCards);
        for (const [storedKey, value] of previousKeys) {
          if (value == null) localStorage.removeItem(storedKey);
          else localStorage.setItem(storedKey, value);
        }
      }
    });
  }
});
