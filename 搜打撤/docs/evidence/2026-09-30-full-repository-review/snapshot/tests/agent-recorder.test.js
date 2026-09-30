import { beforeEach, describe, expect, it } from 'vitest';
import { recordRun, noteBattle, listRuns, clearRuns, exportCSV, exportJSON, setDriver } from '../game/src/agent/agent.recorder.js';
import { aggregate, brief, rate } from '../game/src/agent/agent.stats.js';

// 记录器只经 window.SDT 全局取游戏与卡牌价值——与实机同一路径
window.SDT = window.SDT || {};
window.SDT.Cards = { sellPrice: (card) => (card?.rarity === '传说' ? 20 : 5) };
window.SDT.game = {
  mapSeed: 'seed-1', mode: 'standard', myClass: '战士', characterId: 'heixiang',
  layerIdx: 2, turn: 42, coins: 13, hp: 7, elapsed: 321,
};

beforeEach(() => {
  localStorage.clear();
  setDriver('human');
});

describe('跑局记录字段完整性', () => {
  it('死亡局记录含结局/死因/层/行动/战斗/带出卡牌价值', () => {
    noteBattle(true);
    noteBattle(false);
    const entry = recordRun('death', {
      why: '你倒下了',
      savedCards: [{ card: { name: '江湖救急', rarity: '传说', type: '事件' }, count: 2 }],
    });
    expect(entry).toMatchObject({
      driver: 'human', outcome: 'death', why: '你倒下了',
      seed: 'seed-1', mode: 'standard', class: '战士', characterId: 'heixiang',
      maxLayer: 3, turns: 42, coins: 13, hpLeft: 7, durationSec: 321,
      battles: { fought: 2, won: 1 },
      carriedValue: 40,   // 传说 20 × 2
    });
    expect(entry.carried).toEqual([{ name: '江湖救急', rarity: '传说', type: '事件', count: 2, value: 20 }]);
    expect(entry.id).toMatch(/^run-/);
    expect(entry.ts).toBeGreaterThan(0);
  });

  it('战斗计数逐局清零，环形缓冲按序追加', () => {
    noteBattle(true);
    recordRun('extract', {});
    const second = recordRun('clear', {});
    expect(second.battles).toEqual({ fought: 0, won: 0 });
    expect(listRuns().map(r => r.outcome)).toEqual(['extract', 'clear']);
    clearRuns();
    expect(listRuns()).toEqual([]);
  });

  it('驱动标签进记录', () => {
    setDriver('llm');
    const entry = recordRun('abandon', {});
    expect(entry.driver).toBe('llm');
    setDriver('human');
  });
});

describe('聚合口径', () => {
  const runs = [
    { outcome: 'clear', maxLayer: 4, turns: 60, durationSec: 100, carriedValue: 80, driver: 'greedy', class: '战士', mode: 'standard', battles: { fought: 5, won: 5 }, carried: [{ name: 'A', rarity: '史诗', count: 1, value: 10 }] },
    { outcome: 'extract', maxLayer: 3, turns: 40, durationSec: 80, carriedValue: 30, driver: 'greedy', class: '法师', mode: 'standard', battles: { fought: 3, won: 2 }, carried: [{ name: 'A', rarity: '史诗', count: 2, value: 10 }] },
    { outcome: 'death', maxLayer: 2, turns: 20, durationSec: 40, carriedValue: 5, driver: 'human', class: '战士', mode: 'standard', battles: { fought: 2, won: 0 }, carried: [] },
    { outcome: 'abandon', maxLayer: 1, turns: 5, durationSec: 10, carriedValue: 0, driver: 'human', class: '战士', mode: 'standard', battles: { fought: 0, won: 0 }, carried: [] },
  ];

  it('率与均值按记录字段算：通关率/撤离率/死亡率/带出价值/战斗胜率', () => {
    const o = brief(runs);
    expect(o.runs).toBe(4);
    expect(o.clearRate).toBe(25);
    expect(o.extractRate).toBe(50);    // clear + extract
    expect(o.deathRate).toBe(25);
    expect(o.avgCarriedValue).toBe(Math.round((80 + 30 + 5 + 0) / 4));
    expect(o.battleWinRate).toBe(rate(7, 10));
  });

  it('死亡层分布 / 高价值卡 / 切分对比', () => {
    const agg = aggregate(runs);
    expect(agg.deathByLayer).toEqual({ 2: 1 });
    expect(agg.topCards[0]).toMatchObject({ name: 'A', carriedCount: 3 });
    expect(agg.byDriver.greedy.runs).toBe(2);
    expect(agg.byClass['战士'].runs).toBe(3);
    expect(agg.byMode.standard.runs).toBe(4);
  });

  it('导出 JSON/CSV 可解析、字段对齐', () => {
    runs.forEach(r => recordRun(r.outcome, {}));
    const json = JSON.parse(exportJSON());
    expect(json.runs.length).toBe(4);
    const csv = exportCSV();
    const lines = csv.trim().split('\n');
    expect(lines[0].split(',')).toContain('carriedValue');
    expect(lines.length).toBe(5);
  });
});
