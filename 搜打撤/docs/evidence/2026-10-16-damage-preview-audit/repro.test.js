// Historical pre-fix reproduction. Expected gaps are recorded in repro-output.txt
// against source-baseline.json. After the fix, use tests/battle-preview-trust-boundary.test.js.
import { describe, expect, it } from 'vitest';
import { previewAction } from '../../../game/src/battle/view/battle.preview.js';
import { createBattleResolution } from '../../../game/src/battle/core/battle.resolution.js';
import { forecastEnemyTurn } from '../../../game/src/battle/view/battle.turn-forecast.js';
import * as Combat from '../../../game/src/battle/core/combat.js';

// Rules reproduce current cards.sync.m3.js / cards.sync.m11.js declarations.
// This isolated ports fixture never starts/restores/mutates a BattleSession.
function compare(card, { spellPower = 0, infuseFuels = 0, status = {} } = {}) {
  const foe = { name: '隔离靶', hp: 30, maxHp: 30, dead: false, status: { ...status }, defense: { shield: 0, armor: 0, guard: false } };
  const playerStatus = { status: {} };
  const caster = { atk: 4, spellPower, status: playerStatus.status };
  const snapshot = { foes: [structuredClone(foe)], player: caster, pstat: playerStatus };
  const preview = previewAction({ snapshot, action: { kind: 'play-card', uid: 'audit-only', targetIndex: 0 },
    cardContext: { card, targetIndexes: [0], legal: true } });
  let dealt = 0;
  const draws = [];
  const noop = () => {};
  const resolver = createBattleResolution({
    readState: () => ({ mode: 'normal', playedMovesThisTurn: 0, infuseFuels, grave: [] }),
    getPlayerStatus: () => playerStatus, getPlayerSpellPower: () => spellPower,
    esc: String, log: noop, heal: noop, addFloat: noop, addDelayed: noop,
    getDamageTypes: () => ['武术', '法术'], getDamageTypeMeta: () => Combat.TYPE_NAME,
    fixedDamageType: 'fixed', hasCurse: Combat.hasCurse,
    getAliveFoes: () => foe.dead ? [] : [foe], getGrowth: () => 0,
    splitClauses: () => ({ immediate: [], turnStart: [], battle: [], onInfused: [], onDraw: [], skill: [] }),
    applyTextEffects: () => ({ did: false }), registerTurnStart: noop, registerBattle: noop,
    drawOf: c => Number(c.draw) || 0, isAOE: () => false,
    drawCards: n => { draws.push(['draw', n]); return n; }, grantSha: n => draws.push(['grantSha', n]),
    combat: Combat,
    hitFoe: (target, _card, amount, type) => {
      const result = Combat.dealDamage(caster, target, amount, type);
      dealt += result.dealt;
      if (target.hp <= 0) target.dead = true;
      return result.dealt;
    },
  });
  resolver(card, foe, false, 0, 'audit-only');
  return { preview, dealt, actualHp: foe.hp, draws };
}

const structured = (id, amount, extra = {}, extraOps = []) => ({
  id, name: id, type: '法术', dmgType: 'spell', dmg: amount, cost: 1,
  rules: { version: 1, battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [{ op: 'damage', amount, target: 'chosenEnemy', ...extra }, ...extraOps] } },
});

describe('read-only damage preview audit: intentionally reproduce the current gaps', () => {
  it('奥术弹: preview unknown, isolated production resolver deals 1 and grants 初始攻击 in normal battle', () => {
    const result = compare({ id: 'tt7-arcanebolt', name: '奥术弹', type: '法术', cost: 0,
      dmg: 1, dmgType: 'spell', draw: 1, desc: '造成 1 点法术伤害，并抽 1 张牌。',
      rules: { version: 1, battle: { hosted: ['damage-and-draw'] } } });
    expect(result.preview).toMatchObject({ confidence: 'unknown', damage: null });
    expect(result.dealt).toBe(1);
    expect(result.draws).toEqual([['grantSha', 1]]);
    console.log('奥术弹', JSON.stringify({ preview: result.preview.confidence, realResolverDamage: result.dealt, draws: result.draws }));
  });

  it('爆燃火球: false exact 7 versus resolver 9 at spellPower 2', () => {
    const result = compare(structured('tt7-burnharvest', 5, { spellPowerMul: 2 }), { spellPower: 2 });
    expect(result.preview).toMatchObject({ confidence: 'exact', damage: { total: 7, hpAfter: 23 } });
    expect(result.dealt).toBe(9);
    expect(result.actualHp).toBe(21);
    console.log('爆燃火球', JSON.stringify({ preview: result.preview.damage.total, realResolverDamage: result.dealt }));
  });

  it('充能射线: false exact 5 versus resolver 9 after 2 prior infusions', () => {
    const result = compare(structured('tt12-chargeray', 5, { perInfusedInHand: 2 }), { infuseFuels: 2 });
    expect(result.preview).toMatchObject({ confidence: 'exact', damage: { total: 5, hpAfter: 25 } });
    expect(result.dealt).toBe(9);
    expect(result.actualHp).toBe(21);
    console.log('充能射线', JSON.stringify({ preview: result.preview.damage.total, realResolverDamage: result.dealt }));
  });

  it('暗影射击: false exact 3 versus resolver 6 on a cursed target', () => {
    const result = compare(structured('tt3sp-shadowshot', 3, {}, [
      { op: 'damage', amount: 3, target: 'chosenEnemy', cond: { anyCurse: true } },
    ]), { status: { poison: 1 } });
    expect(result.preview).toMatchObject({ confidence: 'exact', damage: { total: 3, hpAfter: 27 } });
    expect(result.dealt).toBe(6);
    expect(result.actualHp).toBe(24);
    console.log('暗影射击', JSON.stringify({ preview: result.preview.damage.total, realResolverDamage: result.dealt }));
  });

  it('友军先手: current forecast 6; after the documented allied attack phase forecast 0', () => {
    const foe = (name, hp, atk) => ({ name, hp, maxHp: hp, atk, dead: false, status: {}, defense: { shield: 0, armor: 0, guard: false } });
    const snapshot = { player: { hp: 35 }, pstat: { status: {} }, pdef: { shield: 0, armor: 0, guard: false }, turn: 1,
      foes: [foe('雪狼', 5, 7), foe('甲壳', 7, 4), foe('掷弹兵', 4, 6)],
      allies: [foe('步兵1', 4, 4), foe('步兵2', 4, 4)] };
    const initial = structuredClone(snapshot);
    expect(forecastEnemyTurn(snapshot)).toMatchObject({ damage: 6, hpAfter: 29 });
    expect(snapshot).toEqual(initial);
    // Mirrors only the documented enemy-phase.js:153-165 allied-first phase.
    for (const ally of snapshot.allies) {
      const target = snapshot.foes.find(f => !f.dead);
      Combat.dealDamage({ atk: ally.atk, status: ally.status }, target, 0, 'attack');
    }
    snapshot.foes.forEach(f => { if (f.hp <= 0) f.dead = true; });
    expect(forecastEnemyTurn(snapshot)).toMatchObject({ damage: 0, hpAfter: 35 });
    console.log('友军先手', JSON.stringify({ initialForecast: 6, forecastAfterDocumentedAlliedPhase: 0,
      note: forecastEnemyTurn(snapshot).note }));
  });
});
