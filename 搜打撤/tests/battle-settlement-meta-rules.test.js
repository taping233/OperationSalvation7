import { beforeEach, describe, expect, it } from 'vitest';

window.SDT = { Icons: { img: () => '' }, Sound: { sfx() {} }, MAP: { rules: {} } };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
await import('../game/src/hub/meta.js');
const Base = window.SDT.Base;
const Meta = window.SDT.Meta;

beforeEach(() => {
  localStorage.clear();
  Base.use(1);
  Base.data.classes = { 刺客: { lv: 1, xp: 44 } };
  Base.data.stats.kills = 0;
  Base.data.stats.bossKills = [];
  Base.save();
});

describe('战斗击杀规则可应用于 Base 草稿', () => {
  it('沿用旧职业迁移、首脑经验与击杀统计且不触盘', () => {
    const draft = JSON.parse(JSON.stringify(Base._readForCommit(1)));
    const originalRaw = localStorage.getItem(Base.SLOT_KEY(1));
    const levels = Meta.applyBattleKillsToBase(draft, ['首脑', '随从'], true, 'wu', 1);
    expect(levels).toBe(1);
    expect(draft.stats.kills).toBe(2);
    expect(draft.stats.bossKills).toEqual(['首脑']);
    expect(draft.characters.wu).toEqual({ lv: 2, xp: 40 });
    expect(Base.data.stats.kills).toBe(0);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(originalRaw);
  });
});
