// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { prepareBattleVictoryProgress } from '../game/src/hub/battle-victory-progress.js';
import { LEVEL_MAX, addXpToProgress, xpForNext } from '../game/src/hub/meta-progression.js';

describe('battle victory progress planning', () => {
  it('keeps kill/Boss dedupe and sequential multi-level XP rules on a detached snapshot', () => {
    const base = {
      stats: { kills: 7, bossKills: ['旧首脑'] },
      characters: { wu: { lv: 1, xp: 0 } },
      classes: {},
      coins: 12,
    };
    const result = prepareBattleVictoryProgress(base, {
      foeNames: ['同名首脑', '同名首脑', '敌人甲', '敌人乙'],
      isBoss: true,
      classId: 'wu',
      xpMultiplier: 5,
    });

    expect(result.afterBase).not.toBe(base);
    expect(base).toEqual({ stats: { kills: 7, bossKills: ['旧首脑'] }, characters: { wu: { lv: 1, xp: 0 } }, classes: {}, coins: 12 });
    expect(result.afterBase.stats).toEqual({ kills: 11, bossKills: ['旧首脑', '同名首脑'] });
    expect(result.afterBase.characters.wu).toEqual({ lv: 4, xp: 20 });
    expect(result.levelUps).toEqual([{ classId: 'wu', levels: [2, 3, 4] }]);
  });

  it('uses the existing curve, max level, and public normalized progress helper', () => {
    expect(LEVEL_MAX).toBe(10);
    expect(xpForNext(1)).toBe(50);
    expect(xpForNext(2)).toBe(90);
    expect(addXpToProgress({ lv: 9, xp: 0 }, 10_000)).toMatchObject({ after: { lv: 10, xp: 9_630 }, levelsGained: 1 });
  });

  it('preserves per-enemy XP rounding and does not grant XP without a selected class', () => {
    const base = { stats: { kills: 0, bossKills: [] }, classes: {} };
    const result = prepareBattleVictoryProgress(base, {
      foeNames: ['敌人甲', '敌人乙'], isBoss: false, classId: '', xpMultiplier: 0.5,
    });
    expect(result.afterBase.stats.kills).toBe(2);
    expect(result.afterBase.classes).toEqual({});
    expect(result.levelUps).toEqual([]);
  });
});
