// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createLifecycleDomain } from '../game/src/battle/core/battle.lifecycle.domain.js';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';
import { createBattleExecutionSession } from '../game/src/battle/runtime/battle.execution-session.js';

function fixture() {
  const runtime = createBattleRuntime();
  const eye = { uid: 'eye', card: { type: '装备', rules: { equip: { battleStart: [{}], passive: { aura: { deckCap: 5 } } } } } };
  const fillers = Array.from({ length: 20 }, (_, index) => ({ uid: `f${index}`, card: { type: '武术' } }));
  runtime.set$G({ ownedCards: [...fillers, eye], log: vi.fn() });
  runtime.set$opts({ isBoss: true });
  runtime.set$selPool([...fillers, eye]);
  runtime.set$sel(new Set());
  runtime.set$selectingDeck(true);
  runtime.set$selDeckMax(15);
  const flow = createLifecycleDomain({ runtime, combat:{COMBAT_HOOKS:{}}, normalizeCard: card => card,
    summary: { resetBattleSummary() {}, readBattleSummary() {} },
    presentation: { clearFeedback() {} },
  }).createBattleLifecycle({ session: createBattleExecutionSession(),
    R: () => ({ bossDeckSize: 15 }), equipCap: () => 2,
    isBattleStartEquip: card => !!card.rules?.equip?.battleStart,
    requestBattleRender: vi.fn(),
  });
  return { runtime, flow };
}

describe('deck capacity follows selected start equipment', () => {
  it('activates the eye expansion immediately, including when the previous capacity is full', () => {
    const { runtime, flow } = fixture();
    for (let i = 0; i < 15; i++) flow.toggleDeckCard(`f${i}`);
    flow.toggleDeckCard('eye');
    expect(runtime.sel.has('eye')).toBe(true);
    expect(runtime.selDeckMax).toBe(20);
    for (let i = 15; i < 19; i++) flow.toggleDeckCard(`f${i}`);
    expect(runtime.sel.size).toBe(20);
    flow.toggleDeckCard('f19');
    expect(runtime.sel.size).toBe(20);
  });

  it('removing the capacity equipment lowers the limit and prevents an oversized start', () => {
    const { runtime, flow } = fixture();
    runtime.set$sel(new Set(['eye', ...Array.from({ length: 19 }, (_, i) => `f${i}`)]));
    runtime.set$selDeckMax(20);
    flow.toggleDeckCard('eye');
    expect(runtime.selDeckMax).toBe(15);
    expect(runtime.sel.size).toBe(19);
    expect(runtime.sel.has('eye')).toBe(false);
    flow.beginBoss();
    expect(runtime.selectingDeck).toBe(true);
    expect(runtime.G.log).toHaveBeenCalledWith(expect.stringContaining('牌库上限'), 'warn');
  });
});
