import { describe, expect, it } from 'vitest';
import { createCombatRuntime } from '../game/src/battle/core/combat.factory.js';
import { STATUS_ICONS } from '../game/src/ui/status-icons.js';
import { TERM_TIPS } from '../game/src/ui/term-definitions.js';
import { semanticIconPath } from '../game/src/core/semantic-icons.js';

const combat = createCombatRuntime();
const states = [...combat.BUFFS, ...combat.CURSES];

describe('战斗状态图标跨元数据、常驻栏与词条说明一致', () => {
  it('覆盖核心16项状态，独立机制没有共用图标键', () => {
    expect(states).toHaveLength(16);
    expect(Object.keys(STATUS_ICONS).sort()).toEqual([...states].sort());
    expect(new Set(Object.values(STATUS_ICONS)).size).toBe(states.length);
  });

  it.each(states)('%s的核心图标、说明图标与已注册展示图相同', key => {
    const meta = combat.BUFF_META[key] || combat.CURSE_META[key];
    const icon = STATUS_ICONS[key];
    expect(meta.icon).toBe(`[[icon:${icon}]]`);
    expect(TERM_TIPS[key]?.icon).toBe(icon);
    expect(semanticIconPath(icon)).toBe(`assets/ui/semantic-icons/${icon}.svg`);
  });
});
