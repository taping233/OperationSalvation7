/* combat.js 单元测试：四类伤害 + 诅咒状态引擎（迁移自 selftest.js 第 1 节） */
import { describe, it, expect } from 'vitest';

import * as Combat from '../game/src/battle/core/combat.js';
import { runCombatSelfTest } from './helpers/combat-self-test.js';

describe('combat（四类伤害/诅咒用例）', () => {
  it('全部通过', () => {
    const t = runCombatSelfTest(Combat);
    console.log(t.lines.join(' | '));
    expect(t.pass, t.failed?.join('; ')).toBe(true);
  });
});
