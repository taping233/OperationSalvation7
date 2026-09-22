/* 卡池快照防退回守卫（2026-09-20）：
 * TABLETOP10/TT11 内联快照冻结自 09-07/09-09，而定版持续演进在 cards-sync——
 * 任一批次升 KEY 重播都会把旧定义整卡写回（09-20 TT11 v6 重播实测把受缚之残影
 * 退回邪渊主宰、把满电动力锤压死为矮人的帮助）。本测试钉死：快照与 sync 同 id
 * 条目的语义字段必须一致；改 sync 定版时必须同步快照，否则红灯。 */
import { describe, it, expect, beforeAll } from 'vitest';
import cardsSync from '../game/data/cards-sync.json';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');

let Cards;
beforeAll(() => { Cards = window.SDT.Cards; });

const syncMap = new Map(cardsSync.cards.map(c => [c.id, c]));

// 只比较 sync 条目中存在的字段：sync 没写的字段（art/battle 等仓库语义）不归快照管
const EXACT_FIELDS = ['name', 'desc', 'cls', 'tokenOf', 'cost', 'rarity', 'type',
  'value', 'heal', 'armor', 'draw', 'infuse', 'dmg', 'dmgType'];
const BOOL_FIELDS = ['hero', 'unrandom', 'sellable', 'battle'];
const norm = (v) => (typeof v === 'string' ? v.replace(/\s+/g, '') : v);

function diffAgainstSync(snapshotRow) {
  const def = syncMap.get(snapshotRow.id);
  if (!def) return [];
  const diffs = [];
  for (const f of EXACT_FIELDS) {
    if (!(f in def)) continue;
    if (norm(snapshotRow[f]) !== norm(def[f])) diffs.push(`${f}: 快照[${snapshotRow[f]}] ≠ sync[${def[f]}]`);
  }
  for (const f of BOOL_FIELDS) {
    if (!(f in def)) continue;
    if (!!snapshotRow[f] !== !!def[f]) diffs.push(`${f}: 快照[${snapshotRow[f]}] ≠ sync[${def[f]}]`);
  }
  return diffs;
}

describe('快照防退回守卫：TT10/TT11 与 cards-sync 同 id 语义一致', () => {
  for (const [label, table] of [['TABLETOP10', () => Cards.TABLETOP10], ['TABLETOP11', () => Cards.TABLETOP11]]) {
    it(`${label} 全部条目与 sync 定版一致`, () => {
      const problems = [];
      for (const row of table()) {
        const diffs = diffAgainstSync(row);
        if (diffs.length) problems.push(`${row.id}（快照「${row.name}」）: ${diffs.join('；')}`);
      }
      expect(problems).toEqual([]);
    });
  }

  it('老板点名两张回归锚：受缚之残影 / 满电动力锤', () => {
    expect(syncMap.get('tt8-hero-sealer').name).toBe('受缚之残影');
    expect(syncMap.get('tt6-goldhammer').name).toBe('满电动力锤');
    expect(Cards.TABLETOP11.find(c => c.id === 'tt8-hero-sealer').name).toBe('受缚之残影');
    expect(Cards.TABLETOP11.find(c => c.id === 'tt6-goldhammer').name).toBe('满电动力锤');
  });
});
