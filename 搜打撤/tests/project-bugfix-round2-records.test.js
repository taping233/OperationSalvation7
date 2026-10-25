import { afterEach, describe, expect, it } from 'vitest';
import { listRuns, exportCSV } from '../game/src/agent/agent.recorder.js';
import { aggregate } from '../game/src/agent/agent.stats.js';
afterEach(() => localStorage.removeItem('sdt-run-records'));
const save = rows => localStorage.setItem('sdt-run-records', JSON.stringify(rows));
describe('旧跑局记录的局部损坏', () => {
  it('损坏行和带出条目不会使整个统计页崩溃，原始存储保持原样', () => {
    const rows = [null, 'old', 8, [], { outcome: 'extract', carried: [null, false, { name: '卡牌', count: 2, value: 4 }] },
      { outcome: 'death', carried: { bad: true } }];
    save(rows);
    const raw = localStorage.getItem('sdt-run-records'), runs = listRuns();
    expect(runs).toHaveLength(2); expect(aggregate(runs).topCards[0].carriedCount).toBe(2);
    expect(localStorage.getItem('sdt-run-records')).toBe(raw);
  });
  it('损坏数值不会与数字拼接、污染均值或输出NaN', () => {
    save([{ outcome: 'extract', turns: 2, maxLayer: 2, carriedValue: 8, battles: { fought: 2, won: 1 } },
      { outcome: 'death', turns: '8', maxLayer: '2', carriedValue: '9', battles: { fought: '2', won: '1' } }]);
    const result = aggregate(listRuns());
    expect(result.overall.avgTurns).toBe(1); expect(result.overall.avgCarriedValue).toBe(4);
    expect(result.overall.battles).toEqual({ fought: 2, won: 1 });
    expect(result.overall.battleWinRate).toBe(50);
  });
  it('旧记录缺失或损坏时间仍能导出其余内容', () => {
    save([{ id: 'legacy', outcome: 'death' }, { id: 'damaged', ts: 'invalid', outcome: 'extract' }]);
    expect(exportCSV()).toContain('legacy,,'); expect(exportCSV()).toContain('damaged,,');
  });
  it('回车字符会被CSV引号包裹，保持单元格边界', () => {
    save([{ id: 'legacy', ts: 0, why: '第一行\r第二行' }]);
    expect(exportCSV()).toContain('"第一行\r第二行"');
  });
  it('未知结局与对象原型同名时按未知放弃处理，不破坏计数对象', () => {
    save([{ outcome: 'constructor' }, { outcome: '__proto__' }]);
    expect(aggregate(listRuns()).overall.outcomes).toEqual({ clear: 0, extract: 0, death: 0, abandon: 2 });
  });
  it('JSON对象形状的坏文本与时间字段不会阻断统计或CSV导出', () => {
    const bad = { toString: null, valueOf: null };
    save([{ id: bad, outcome: bad, class: bad, mode: bad, node: bad, ts: bad, why: bad,
      provenance: { driver: 'agent', agentDriver: bad }, netTake: { wood: bad },
      carried: [{ name: '保留的卡', rarity: bad, type: bad, count: 1, value: 4 }] }]);
    expect(aggregate(listRuns()).total).toBe(1); expect(() => exportCSV()).not.toThrow();
    expect(listRuns()[0].carried[0]).toMatchObject({ name: '保留的卡', rarity: '', type: '' });
  });
});
