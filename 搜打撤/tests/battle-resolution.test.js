import { describe, expect, it } from 'vitest';
import { createBattleResolution } from '../game/src/battle/battle.resolution.js';

function makeResolver(state) {
  const events = [];
  const resolver = createBattleResolution({
    readState: () => state.current,
    getPlayerStatus: () => state.playerStatus || { status: {} },
    esc: value => String(value),
    log: (...args) => events.push(['log', ...args]),
    heal: amount => events.push(['heal', amount]),
    addFloat: value => events.push(['float', value]),
    addDelayed: value => events.push(['delayed', value]),
    takeDeckBottom: () => [], deckBottomCount: () => 0,
    startSurge: () => {}, getAllCards: () => [], isRandomObtainable: () => false,
    randomBattle: () => 0, getDamageTypes: () => ['武术'], getDamageTypeMeta: () => ({}), fixedDamageType: 'fixed',
    hasCurse: () => false, getAliveFoes: () => state.foes || [state.target], getGrowth: uid => state.growth?.[uid] || 0,
    findCard: () => null, addTempCard: () => 'temp', queueDiscover: () => {},
    splitClauses: () => ({ immediate: ['可观察顺序'], turnStart: [], battle: [], onInfused: [], onDraw: [], skill: [] }),
    applyTextEffects: () => { events.push(['text']); state.onText?.(); return { did: true }; },
    registerTurnStart: () => {}, registerBattle: () => false, castRandomSpells: () => Promise.resolve(),
    drawCards: count => { events.push(['draw', count]); return Math.min(count, state.drawnCount ?? count); },
    grantSha: count => events.push(['sha', count]),
    hitFoe: (foe, card, amount) => {
      (state.hitFoes ||= []).push(foe);
      (state.hitDescriptions ||= []).push(card?.desc);
      events.push(['damage', amount]);
      return amount;
    },
    drawOf: () => 0, isAOE: () => false, addArmor: amount => events.push(['armor', amount]),
  });
  return { resolver, events };
}

describe('battle resolution ports', () => {
  it('uses structured onPlay damage independently of description and skips legacy text damage', () => {
    const makeCard = desc => ({
      id: 'structured-simple', name: '结构伤害', type: '武术', dmg: 3, dmgType: 'fixed', desc,
      rules: { version: 1, triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } },
    });
    const outcomes = ['造成 99 点伤害并获得护甲。', '任意展示描述，不含战斗效果。'].map(desc => {
      const target = { hp: 20, maxHp: 20, dead: false, status: {} };
      const callState = { current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target };
      const { resolver, events } = makeResolver(callState);
      resolver(makeCard(desc), target, false, 0, null);
      return { effects: events.filter(event => ['damage', 'text', 'armor'].includes(event[0])), hitDescriptions: callState.hitDescriptions };
    });
    expect(outcomes.map(outcome => outcome.effects)).toEqual([[['damage', 3]], [['damage', 3]]]);
    expect(outcomes.map(outcome => outcome.hitDescriptions)).toEqual([[''], ['']]);
  });

  it('resolves chosenEnemy and allEnemies targets in operation order', () => {
    const first = { hp: 20, dead: false, status: {} };
    const second = { hp: 20, dead: false, status: {} };
    const callState = {
      current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] },
      playerStatus: { status: {} }, target: first, foes: [first, second],
    };
    const { resolver, events } = makeResolver(callState);
    resolver({
      id: 'structured-area', type: '武术', dmg: 2, dmgType: 'fixed', desc: '展示文字',
      rules: { version: 1, triggers: { onPlay: [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
        { op: 'damage', amountField: 'dmg', target: 'allEnemies' },
      ] } },
    }, first, false, 0, null);
    expect(events.filter(event => event[0] === 'damage')).toEqual([['damage', 2], ['damage', 2], ['damage', 2]]);
    expect(callState.hitFoes).toEqual([first, first, second]);
  });

  it('keeps structured attack damage before the existing silence gate', () => {
    const target = { hp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({
      current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] },
      playerStatus: { status: { silence: 1 } }, target,
    });
    resolver({
      id: 'silent-structured-attack', type: '武术', dmg: 3, dmgType: 'attack', desc: '展示描述',
      rules: { version: 1, triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } },
    }, target, false, 0, null);
    expect(events.filter(event => ['damage', 'text'].includes(event[0]))).toEqual([['damage', 3]]);
    expect(events.some(event => event[0] === 'log' && String(event[1]).includes('沉默'))).toBe(true);
  });

  it('resolves structured armor once after silence and independently of description', () => {
    const outcomes = ['获得 99 点护甲。', '任意展示描述。'].map(desc => {
      const target = { hp: 20, dead: false, status: {} };
      const { resolver, events } = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target });
      resolver({
        id: 'structured-armor', type: '法术', armor: 4, desc,
        rules: { version: 1, triggers: { onPlay: [{ op: 'armor', amountField: 'armor' }] } },
      }, target, false, 0, null);
      return events.filter(event => ['armor', 'text'].includes(event[0]));
    });
    expect(outcomes).toEqual([[['armor', 4]], [['armor', 4]]]);
  });

  it('does not resolve structured armor before or during the silence gate', () => {
    const target = { hp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({
      current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] },
      playerStatus: { status: { silence: 1 } }, target,
    });
    resolver({
      id: 'silenced-structured-armor', type: '法术', armor: 4, desc: '获得护甲。',
      rules: { version: 1, triggers: { onPlay: [{ op: 'armor', amountField: 'armor' }] } },
    }, target, false, 0, null);
    expect(events.some(event => event[0] === 'armor')).toBe(false);
    expect(events.some(event => event[0] === 'log' && String(event[1]).includes('沉默'))).toBe(true);
  });

  it('runs heal then armor in declared order and preserves the healban log', () => {
    const target = { hp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({
      current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] },
      playerStatus: { status: { healban: 2 } }, target,
    });
    resolver({
      id: 'structured-heal-armor', name: '包扎', type: '武术', dmg: 0, heal: 3, armor: 3, desc: '旧描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [
        { op: 'heal', amountField: 'heal' }, { op: 'armor', amountField: 'armor' },
      ] } },
    }, target, false, 0, null);
    expect(events.filter(event => ['heal', 'armor', 'float'].includes(event[0]))).toEqual([['armor', 3]]);
    expect(events.find(event => event[0] === 'log' && String(event[1]).includes('禁疗中'))?.[1]).toContain('回复 3 点生命无效');
  });

  it('uses boss draw and ordinary grantSha semantics in declared order', () => {
    const resolve = mode => {
      const target = { hp: 20, dead: false, status: {} };
      const { resolver, events } = makeResolver({ current: { mode, playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target, drawnCount: 0 });
      resolver({
        id: `structured-armor-draw-${mode}`, name: '坚守', type: '武术', dmg: 0, armor: 5, draw: 1, desc: '改写描述',
        rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [
          { op: 'armor', amountField: 'armor' }, { op: 'draw', amountField: 'draw' },
        ] } },
      }, target, false, 0, null);
      return events;
    };
    const boss = resolve('boss');
    expect(boss.filter(event => ['armor', 'draw', 'sha'].includes(event[0]))).toEqual([['armor', 5], ['draw', 1]]);
    expect(boss.some(event => event[0] === 'log' && String(event[1]).includes('抽了 0 张牌'))).toBe(true);
    const normal = resolve('normal');
    expect(normal.filter(event => ['armor', 'draw', 'sha'].includes(event[0]))).toEqual([['armor', 5], ['sha', 1]]);
    expect(normal.some(event => event[0] === 'log' && String(event[1]).includes('获得 1 张【初始攻击】'))).toBe(true);
  });

  it('suppresses all structured heal, armor, and draw operations under silence', () => {
    const target = { hp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: { silence: 1 } }, target });
    resolver({
      id: 'silenced-structured-skills', name: '测试', type: '武术', dmg: 0, heal: 2, armor: 2, draw: 1, desc: '改写描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [
        { op: 'heal', amountField: 'heal' }, { op: 'armor', amountField: 'armor' }, { op: 'draw', amountField: 'draw' },
      ] } },
    }, target, false, 0, null);
    expect(events.some(event => ['heal', 'armor', 'float', 'draw', 'sha'].includes(event[0]))).toBe(false);
    expect(events.filter(event => event[0] === 'log').some(event => String(event[1]).includes('沉默'))).toBe(true);
  });

  it('treats empty onPlay as no immediate effect and keeps undeclared legacy behavior', () => {
    const structuredTarget = { hp: 20, dead: false, status: {} };
    const structured = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target: structuredTarget });
    structured.resolver({
      id: 'empty-onplay', type: '武术', dmg: 3, dmgType: 'fixed', desc: '造成文本伤害',
      rules: { version: 1, triggers: { onPlay: [] } },
    }, structuredTarget, false, 0, null);
    expect(structured.events.filter(event => ['damage', 'text'].includes(event[0]))).toEqual([]);

    const legacyTarget = { hp: 20, dead: false, status: {} };
    const legacy = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target: legacyTarget });
    legacy.resolver({ id: 'legacy-card', type: '武术', dmg: 3, dmgType: 'fixed', desc: '旧描述' }, legacyTarget, false, 0, null);
    expect(legacy.events.filter(event => ['damage', 'text'].includes(event[0]))).toEqual([['damage', 3], ['text']]);
  });

  it('preserves damage-before-text order', () => {
    const runtime = { current: { mode: 'boss', playedMovesThisTurn: 1, infuseFuels: 0, grave: [] } };
    const target = { hp: 20, maxHp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({ current: runtime.current, playerStatus: { status: {} }, target });
    const card = { id: 'probe', name: '顺序探针', type: '武术', dmg: 3, dmgType: 'fixed', desc: '本回合每打出一张其他招式，造成2点固定伤害。' };
    resolver(card, target, false, 0, null);
    expect(events.filter(event => ['damage', 'text'].includes(event[0]))).toEqual([['damage', 3], ['text']]);
  });

  it('reads rebound runtime values on the next cast', () => {
    const runtime = { current: { mode: 'boss', playedMovesThisTurn: 1, infuseFuels: 0, grave: [] } };
    const target = { hp: 20, maxHp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({ get current() { return runtime.current; }, playerStatus: { status: {} }, target });
    const card = { id: 'probe', name: '状态探针', type: '武术', dmg: 3, dmgType: 'fixed', desc: '本回合每打出一张其他招式，造成2点固定伤害。' };
    resolver(card, target, false, 0, null);
    events.length = 0;
    runtime.current = { ...runtime.current, playedMovesThisTurn: 4 };
    resolver(card, target, false, 0, null);
    expect(events.filter(event => event[0] === 'damage')).toHaveLength(4);
    expect(events.filter(event => event[0] === 'text')).toHaveLength(1);
  });

  it('reads player status again after text effects before the structured heal fallback', () => {
    const player = { current: { status: {} } };
    const healCard = { id: 'probe-heal', name: '禁疗探针', type: '法术', dmg: 0, desc: '可观察顺序', heal: 3 };
    // Mutate the player binding from a command before the structured heal fallback reads status.
    const callState = { current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, get playerStatus() { return player.current; }, target: { hp: 20, dead: false, status: {} }, onText: () => { player.current = { status: { healban: 2 } }; } };
    const { resolver, events } = makeResolver(callState);
    const target = callState.target;
    resolver(healCard, target, false, 0, null);
    expect(events.some(event => event[0] === 'heal')).toBe(false);
    expect(events.some(event => event[0] === 'log' && String(event[1]).includes('禁疗中'))).toBe(true);
  });

  it('sends structured armor through the armor command after text effects', () => {
    const target = { hp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target });
    resolver({ id: 'probe-armor', name: '护甲探针', type: '法术', dmg: 0, desc: '可观察顺序', armor: 4 }, target, false, 0, null);
    expect(events.filter(event => ['text', 'armor'].includes(event[0]))).toEqual([['text'], ['armor', 4]]);
  });
});
