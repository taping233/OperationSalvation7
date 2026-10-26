// Regression coverage for elite-mode 1.35 scaling, catalog values, rounding semantics and mode copy.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mapData from '../game/data/map.json';
import { baseHomeV3HTML } from '../game/src/hub/hub.home-v3.js';

const H = vi.hoisted(() => ({ game:{ mode:'elite' }, map:{ rules:{ fireHeal:10 } }, setXpMul:vi.fn() }));
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game, MAP:H.map }));
let MODES, modeCfg, scaledEnemy, applyModeRules, previousSDT;
beforeAll(async () => {
  previousSDT = window.SDT;
  window.SDT = { Meta:{ setXpMul:H.setXpMul } };
  ({ MODES, modeCfg, scaledEnemy, applyModeRules } = await import('../game/src/run/game.session.modes.js'));
});
beforeEach(() => { H.game.mode = 'elite'; H.map.rules.fireHeal = 10; H.setXpMul.mockClear(); });
afterAll(() => { window.SDT = previousSDT; });

// Hand-reviewed ATK/HP includes the nine approved layer elites.
const rows = [
  ['infantry',4,4,5,5], ['archer',5,3,7,4], ['bandit',3,3,4,4], ['cavalry',5,6,7,8],
  ['orc_jav',6,4,8,5], ['wolf_rider',7,6,9,8], ['orc_axe',4,7,5,9], ['fire_el',10,7,14,9],
  ['water_el',7,10,9,14], ['esper_crow',8,5,11,7], ['esper_candle',9,6,12,8], ['grass_el',5,12,7,16],
  ['esper_silence',7,9,9,12], ['esper_echo',9,7,12,9], ['dragon',7,40,9,54],
  ['rager',2,5,3,7], ['deserter',3,7,4,9], ['greedy_imp',4,5,5,7],
  ['swaggerer',2,6,3,8], ['tin_mute',4,9,5,12], ['heavy_hammer',8,8,11,11],
  ['cultist',6,6,8,8], ['fake_apothecary',5,10,7,14], ['camo_sniper',7,4,9,5],
  ['boss_general',5,50,7,68], ['boss_orc',4,45,5,61], ['boss_elem',8,48,11,65],
  ['boss_witness_pope',1,60,1,81], ['boss_mutation_mother',6,45,8,61],
  ['boss_mysterious_blocker',5,55,7,74], ['boss_necromancer',5,75,7,101],
];
const templates = [...Object.values(mapData.monsters), ...mapData.altar.bosses];

describe('hard-mode enemy stats reduced by 10% before the existing rounding step', () => {
  it.each(rows)('%s preserves all non-stat template fields', (id, baseAtk, baseHp, atk, hp) => {
    const original = templates.find(enemy => enemy.id === id);
    expect(original).toMatchObject({ atk:baseAtk, hp:baseHp });
    const enemy = Object.freeze({ ...original });
    const result = scaledEnemy(enemy);
    expect(result).not.toBe(enemy);
    expect(result).toEqual({ ...original, atk, hp });
    expect(enemy).toEqual(original);
  });
  it('covers the complete current monster/boss catalog', () => {
    expect(rows.map(([id]) => id).sort()).toEqual(templates.map(enemy => enemy.id).sort());
  });
  it.each([[1,1], [2,3], [3,4], [10,14], [30,41], [-1,-1], [-10,-13]])('rounds base %s once to %s', (base, expected) => {
    // In particular, base 1 and 3 distinguish this from rounding at 1.5 then at 0.9.
    expect(scaledEnemy({ hp:base, atk:base })).toEqual({ hp:expected, atk:expected });
  });
  it('preserves the existing fallback and absence of a minimum-one clamp', () => {
    expect(scaledEnemy({ hp:0, atk:0 })).toEqual({ hp:0, atk:3 });
    expect(scaledEnemy({ hp:0.1, atk:0.1 })).toEqual({ hp:0, atk:0 });
    expect(scaledEnemy({ hp:1 })).toEqual({ hp:1, atk:3 });
    expect(scaledEnemy(null)).toBeNull();
    expect(scaledEnemy(undefined)).toBeUndefined();
    expect(Object.is(scaledEnemy({ hp:-0.1, atk:-0.1 }).hp, -0)).toBe(true);
    expect(Object.is(scaledEnemy({ hp:-0.1, atk:-0.1 }).atk, -0)).toBe(true);
  });
  it.each(['standard', 'unknown', undefined])('does not change stats or object identity in mode %s', mode => {
    H.game.mode = mode;
    expect(modeCfg()).toBe(MODES.standard);
    for (const [id, atk, hp] of rows) {
      const source = templates.find(enemy => enemy.id === id);
      const enemy = Object.freeze({ ...source }), before = structuredClone(enemy);
      const result = scaledEnemy(enemy);
      expect(result).toBe(enemy);
      expect(result).toMatchObject({ atk, hp });
      expect(result).toEqual(before); expect(enemy).toEqual(before);
    }
    for (const stats of [{ hp:0, atk:0 }, { hp:0.1, atk:0.1 }, { hp:-10, atk:-1 }]) {
      const enemy = Object.freeze({ ...stats }), before = structuredClone(enemy);
      expect(scaledEnemy(enemy)).toBe(enemy);
      expect(enemy).toEqual(stats); expect(enemy).toEqual(before);
    }
  });
  it('keeps reward, healing and starting-coin settings separate from enemy scaling', () => {
    expect(MODES.elite).toMatchObject({ enemyMul:1.35, coinMul:1.5, xpMul:1.5, startCoins:0, healMul:1 });
    expect(MODES.standard).toMatchObject({ enemyMul:1, coinMul:1, xpMul:1, startCoins:0, healMul:1 });
    applyModeRules();
    expect(H.setXpMul).toHaveBeenLastCalledWith(1.5);
    expect(H.map.rules.fireHeal).toBe(10);
    H.game.mode = 'standard'; applyModeRules();
    expect(H.setXpMul).toHaveBeenLastCalledWith(1);
    expect(H.map.rules.fireHeal).toBe(10);
  });
  it('renders the actual shared mode values rather than a synthetic multiplier fixture', () => {
    const home = mode => baseHomeV3HTML({
      base:{ data:{ stash:[], pocket:[], ammoTaught:true } },
      meta:{ pendingColl:() => [], pendingAch:() => [] }, modes:MODES, mode, prepared:false,
    });
    expect(home('elite')).toContain('敌人与首脑 ×1.35');
    expect(home('elite')).toContain('战斗金币 ×1.5');
    expect(home('elite')).toContain('人物经验 ×1.5');
    expect(home('elite')).toContain('高稀有度掉率 +20%');
    expect(home('standard')).toContain('四层探索 · 基础难度');
    expect(MODES.elite.desc).toContain('敌人与 BOSS 属性 ×1.35');
    expect(MODES.elite.ckpt).toContain('敌人 ×1.35');
  });
});
