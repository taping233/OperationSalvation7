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
      events.push(['damage', amount]);
      if (state.hitFoe) return state.hitFoe(foe, amount);
      (state.hitFoes ||= []).push(foe);
      (state.hitDescriptions ||= []).push(card?.desc);
      return amount;
    },
    drawOf: () => 0, isAOE: () => false,
    addArmor: (amount, opts) => events.push(opts ? ['armor', amount, opts] : ['armor', amount]),
    damagePlayer: amount => events.push(['selfDamage', amount]),
    getPlayerHp: () => state.playerHp ?? 10,
    countDrawnSpells: () => state.drawnSpellCount ?? 0,
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

  it('throws on schema v2 keys the interpreter has not wired yet (guard against silent mis-resolution)', () => {
    const target = { hp: 20, dead: false, status: {} };
    const callState = { current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target };
    const { resolver } = makeResolver(callState);
    const base = { type: '武术', dmg: 3, dmgType: 'fixed', desc: '' };
    for (const card of [
      // B1-B3 已接线键（amount/range/cond/bonus/lifesteal/hits.count/randomEnemy、heal/armor 的
      // v2 键）不再抛错——见下方行为用例；这里锁死仍 pending 的键：
      // damage.graveyard（B10 墓地域）、damage.schedule（B2 延迟段）、hits.perFoe（每人释放一段）
      { ...base, id: 'guard-damage-graveyard', rules: { version: 1, triggers: { onPlay: [
        { op: 'damage', amount: 3, target: 'chosenEnemy', graveyard: { type: '法术', perCard: 1 } },
      ] } } },
      { ...base, id: 'guard-damage-schedule', rules: { version: 1, triggers: { onPlay: [
        { op: 'damage', amount: 3, target: 'chosenEnemy', schedule: 'nextTurn' },
      ] } } },
      { ...base, id: 'guard-damage-perfoe', rules: { version: 1, triggers: { onPlay: [
        { op: 'damage', amount: 3, target: 'chosenEnemy', hits: { perFoe: 1 } },
      ] } } },
      // draw 的全部 v2 键（B4：boss/普通战双口径未结构化前不放行）
      { ...base, id: 'guard-draw-amount', type: '法术', rules: { version: 1, triggers: { onPlay: [{ op: 'draw', amount: 1 }] } } },
      { ...base, id: 'guard-draw-untilhandn', type: '法术', rules: { version: 1, triggers: { onPlay: [{ op: 'draw', untilHandN: 4 }] } } },
      // v2 新操作族（schema 放行、解释器未接线）
      { ...base, id: 'guard-pending-op', rules: { version: 1, triggers: { onPlay: [{ op: 'summon', name: '步兵', count: 1 }] } } },
      // G13 时点触发器（无任何运行时消费者）
      { ...base, id: 'guard-pending-trigger', rules: { version: 1, triggers: { onPlay: [], onTurnStart: [] } } },
    ]) {
      expect(() => resolver(card, target, false, 0, null), card.id).toThrow(TypeError);
    }
  });

  it('resolves literal, conditional, and bonus damage from v2 keys (B1)', () => {
    const makeCall = foeState => {
      const target = { hp: foeState.hp, maxHp: foeState.maxHp ?? 20, dead: false, status: foeState.status || {} };
      const callState = { current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target };
      return { target, ...makeResolver(callState) };
    };
    // 字面量伤害：amount 与文本/dmg 字段无关地直接结算
    const literal = makeCall({ hp: 20 });
    literal.resolver({
      id: 'v2-amount', type: '法术', dmgType: 'fixed', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 5, target: 'chosenEnemy' }] } },
    }, literal.target, false, 0, null);
    expect(literal.events.filter(event => event[0] === 'damage')).toEqual([['damage', 5]]);

    // cond.foeHpBelow（斩杀口径：血量 ≤ n 才生效）；满血目标被条件门拦下并给出日志
    const capped = makeCall({ hp: 20 });
    capped.resolver({
      id: 'v2-execute', type: '武术', dmgType: 'true', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 9, target: 'chosenEnemy', cond: { foeHpBelow: 9 } }] } },
    }, capped.target, false, 0, null);
    expect(capped.events.some(event => event[0] === 'damage')).toBe(false);
    expect(capped.events.some(event => event[0] === 'log' && String(event[1]).includes('不满足条件'))).toBe(true);

    const wounded = makeCall({ hp: 5 });
    wounded.resolver({
      id: 'v2-execute', type: '武术', dmgType: 'true', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 9, target: 'chosenEnemy', cond: { foeHpBelow: 9 } }] } },
    }, wounded.target, false, 0, null);
    expect(wounded.events.filter(event => event[0] === 'damage')).toEqual([['damage', 9]]);

    // bonus 条件增伤（flat）：目标流血时 +2；无流血不增伤
    const bleeding = makeCall({ hp: 20, status: { bleed: 1 } });
    bleeding.resolver({
      id: 'v2-pierce', type: '武术', dmgType: 'fixed', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 4, target: 'chosenEnemy', bonus: { amount: 2, if: { foeStatus: 'bleed' } } }] } },
    }, bleeding.target, false, 0, null);
    expect(bleeding.events.filter(event => event[0] === 'damage')).toEqual([['damage', 6]]);

    const clean = makeCall({ hp: 20 });
    clean.resolver({
      id: 'v2-pierce', type: '武术', dmgType: 'fixed', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 4, target: 'chosenEnemy', bonus: { amount: 2, if: { foeStatus: 'bleed' } } }] } },
    }, clean.target, false, 0, null);
    expect(clean.events.filter(event => event[0] === 'damage')).toEqual([['damage', 4]]);
  });

  it('resolves percent bonus, range rolls, random targets, and multi-hit counts (B1/B2)', () => {
    const makeCall = (foeState = {}) => {
      const target = { hp: foeState.hp ?? 20, maxHp: foeState.maxHp ?? 20, dead: false, status: foeState.status || {} };
      const callState = { current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target, foes: foeState.foes };
      return { target, callState, ...makeResolver(callState) };
    };
    // bonus.pct（惩击口径：半血 +N%，向下取整）；makeResolver 的 randomBattle 恒为 0
    const half = makeCall({ hp: 9, maxHp: 20 });
    half.resolver({
      id: 'v2-smite', type: '法术', dmgType: 'spell', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 10, target: 'chosenEnemy', bonus: { pct: 50, if: { foeHpHalf: true } } }] } },
    }, half.target, false, 0, null);
    expect(half.events.filter(event => event[0] === 'damage')).toEqual([['damage', 15]]);

    // range 区间（不稳定射线口径：含端点掷骰一次；randomBattle=0 → 下界）
    const ranged = makeCall({});
    ranged.resolver({
      id: 'v2-ray', type: '法术', dmgType: 'spell', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', range: [4, 6], target: 'chosenEnemy' }] } },
    }, ranged.target, false, 0, null);
    expect(ranged.events.filter(event => event[0] === 'damage')).toEqual([['damage', 4]]);

    // hits.count 多段（连射口径）：3 段各自 windup→hit 演出节奏
    const multi = makeCall({});
    const kinds = [];
    for (const step of multi.resolver.steps({
      id: 'v2-multihit', type: '武术', dmgType: 'fixed', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 2, target: 'chosenEnemy', hits: { count: 3 } }] } },
    }, multi.target, false, 0, null)) kinds.push(step.kind);
    expect(kinds).toEqual(['windup', 'hit', 'windup', 'hit', 'windup', 'hit']);
    expect(multi.events.filter(event => event[0] === 'damage')).toEqual([['damage', 2], ['damage', 2], ['damage', 2]]);

    // hits.range 段数掷骰（元素爆裂口径：randomBattle=0 → 下界 4 段）
    const rolled = makeCall({});
    rolled.resolver({
      id: 'v2-rolledhits', type: '法术', dmgType: 'spell', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 2, target: 'chosenEnemy', hits: { range: [4, 5] } }] } },
    }, rolled.target, false, 0, null);
    expect(rolled.events.filter(event => event[0] === 'damage')).toHaveLength(4);

    // target randomEnemy：randomBattle=0 → 战场第一名存活敌人（而非点选的第二名）
    const first = { hp: 20, dead: false, status: {} };
    const second = { hp: 20, dead: false, status: {} };
    const random = makeCall({ foes: [first, second] });
    random.resolver({
      id: 'v2-random', type: '法术', dmgType: 'spell', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 2, target: 'randomEnemy' }] } },
    }, second, false, 0, null);
    expect(random.events.filter(event => event[0] === 'damage')).toEqual([['damage', 2]]);
    expect(random.callState.hitFoes).toEqual([first]);
  });

  it('recasts a damage operation once per kill (B2) and keeps lifesteal off the healban-free path (B3)', () => {
    const dying = { hp: 1, maxHp: 1, dead: false, status: {} };
    const survivor = { hp: 20, maxHp: 20, dead: false, status: {} };
    const killState = {
      current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} },
      target: dying, foes: [dying, survivor],
      hitFoe: (foe, amount) => {
        if (!foe.dead) {
          foe.hp -= amount;
          if (foe.hp <= 0) foe.dead = true;
        }
        return amount;
      },
    };
    const { resolver: killResolver, events: killEvents } = makeResolver(killState);
    killResolver({
      id: 'v2-recast', name: '余烬', type: '法术', dmgType: 'spell', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: true } }, triggers: { onPlay: [{ op: 'damage', amount: 5, target: 'allEnemies', recast: { on: 'kill', times: 1 } }] } },
    }, dying, false, 0, null);
    expect(killEvents.filter(event => event[0] === 'damage')).toEqual([['damage', 5], ['damage', 5], ['damage', 5]]);
    expect(killEvents.some(event => event[0] === 'log' && String(event[1]).includes('再施放一次'))).toBe(true);
    expect(dying.dead).toBe(true);
    expect(survivor.hp).toBe(10);

    // 吸血：按实际伤害回复；禁疗中只给日志不回复
    const lifestealTarget = { hp: 20, maxHp: 20, dead: false, status: {} };
    const healState = { current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target: lifestealTarget };
    const { resolver: healResolver, events: healEvents } = makeResolver(healState);
    healResolver({
      id: 'v2-lifesteal', type: '武术', dmgType: 'fixed', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 3, target: 'chosenEnemy', lifesteal: true }] } },
    }, lifestealTarget, false, 0, null);
    expect(healEvents.filter(event => ['damage', 'heal'].includes(event[0]))).toEqual([['damage', 3], ['heal', 3]]);
    expect(healEvents.some(event => event[0] === 'log' && String(event[1]).includes('吸血'))).toBe(true);

    const bannedTarget = { hp: 20, maxHp: 20, dead: false, status: {} };
    const bannedState = { current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: { healban: 1 } }, target: bannedTarget };
    const { resolver: bannedResolver, events: bannedEvents } = makeResolver(bannedState);
    bannedResolver({
      id: 'v2-lifesteal', type: '武术', dmgType: 'fixed', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 3, target: 'chosenEnemy', lifesteal: true }] } },
    }, bannedTarget, false, 0, null);
    expect(bannedEvents.some(event => event[0] === 'heal')).toBe(false);
    expect(bannedEvents.some(event => event[0] === 'log' && String(event[1]).includes('吸血回复无效'))).toBe(true);
  });

  it('resolves heal upTo, selfDamage, perFuelCost, and perSpellHeal sources (B3)', () => {
    const makeCall = playerState => {
      const target = { hp: 20, dead: false, status: {} };
      const callState = { current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] },
        playerStatus: { status: playerState.playerStatus || {} }, target,
        playerHp: playerState.playerHp, ...playerState.extra };
      return { target, ...makeResolver(callState) };
    };
    // upTo（沐愈光辉口径）：低于目标值回复差值；已高于则无变化
    const low = makeCall({ playerHp: 8 });
    low.resolver({
      id: 'v2-upto', type: '法术', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'heal', upTo: 12 }] } },
    }, low.target, false, 0, null);
    expect(low.events.filter(event => event[0] === 'heal')).toEqual([['heal', 4]]);
    expect(low.events.some(event => event[0] === 'log' && String(event[1]).includes('回复至'))).toBe(true);

    const high = makeCall({ playerHp: 15 });
    high.resolver({
      id: 'v2-upto', type: '法术', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'heal', upTo: 12 }] } },
    }, high.target, false, 0, null);
    expect(high.events.some(event => event[0] === 'heal')).toBe(false);
    expect(high.events.some(event => event[0] === 'log' && String(event[1]).includes('无变化'))).toBe(true);

    // selfDamage（恶魔之力口径）：走 damagePlayer 命令，禁疗中照样生效
    const selfhurt = makeCall({ playerStatus: { healban: 2 } });
    selfhurt.resolver({
      id: 'v2-selfdamage', type: '法术', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'heal', selfDamage: 2 }] } },
    }, selfhurt.target, false, 0, null);
    expect(selfhurt.events.filter(event => event[0] === 'selfDamage')).toEqual([['selfDamage', 2]]);
    expect(selfhurt.events.some(event => event[0] === 'heal')).toBe(false);

    // perFuelCost（圣光治愈口径）：N 倍于注能牺牲品费用合计（resolveCardSteps 第 4 参）
    const fueled = makeCall({});
    fueled.resolver({
      id: 'v2-perfuel', type: '法术', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'heal', perFuelCost: 2 }] } },
    }, fueled.target, false, 3, null);
    expect(fueled.events.filter(event => event[0] === 'heal')).toEqual([['heal', 6]]);
    expect(fueled.events.some(event => event[0] === 'log' && String(event[1]).includes('牺牲品费用 3'))).toBe(true);

    // perSpellHeal（浪掷风吟口径）：与 draw 组合——按本次入手的法术数折算
    const spells = makeCall({ extra: { drawnCount: 2, drawnSpellCount: 2 } });
    spells.resolver({
      id: 'v2-perspell', name: '甘霖', type: '法术', draw: 2, desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [
        { op: 'draw', amountField: 'draw' }, { op: 'heal', perSpellHeal: 3 },
      ] } },
    }, spells.target, false, 0, null);
    expect(spells.events.filter(event => ['draw', 'heal'].includes(event[0]))).toEqual([['draw', 2], ['heal', 6]]);
  });

  it('resolves armor amount, guard, and decayAtTurnEnd from v2 keys (B3)', () => {
    const target = { hp: 20, dead: false, status: {} };
    const makeCard = operation => ({
      id: 'v2-armor', name: 'v2-armor', type: '武术', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [operation] } },
    });
    // amount + guard：护甲入账并置格挡旗标（第二个参数传给 addArmor 命令）
    const guarded = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target });
    guarded.resolver(makeCard({ op: 'armor', amount: 4, guard: true }), target, false, 0, null);
    expect(guarded.events.filter(event => event[0] === 'armor')).toEqual([['armor', 4, { guard: true }]]);
    expect(guarded.events.some(event => event[0] === 'log' && String(event[1]).includes('格挡'))).toBe(true);

    // 纯格挡（无数值）：只走格挡旗标
    const guardOnly = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target });
    guardOnly.resolver(makeCard({ op: 'armor', guard: true }), target, false, 0, null);
    expect(guardOnly.events.filter(event => event[0] === 'armor')).toEqual([['armor', 0, { guard: true }]]);

    // decayAtTurnEnd：注册下回合开始的护甲衰减延迟段（与坚盾同一条 delayed 管线）
    const decaying = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target });
    decaying.resolver(makeCard({ op: 'armor', amount: 8, decayAtTurnEnd: 4 }), target, false, 0, null);
    expect(decaying.events.filter(event => event[0] === 'armor')).toEqual([['armor', 8]]);
    const decayJob = decaying.events.find(event => event[0] === 'delayed')?.[1];
    expect(decayJob).toMatchObject({ text: '-4 点', cardName: 'v2-armor' });

    // 沉默封印：v2 数值键与 v1 同门——heal/armor 全部抑制
    const silenced = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: { silence: 1 } }, target });
    silenced.resolver({
      id: 'v2-silenced', type: '武术', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [
        { op: 'heal', amount: 5 }, { op: 'armor', amount: 5, guard: true },
      ] } },
    }, target, false, 0, null);
    expect(silenced.events.some(event => ['heal', 'armor', 'float'].includes(event[0]))).toBe(false);
    expect(silenced.events.filter(event => event[0] === 'log').some(event => String(event[1]).includes('沉默'))).toBe(true);
  });
});
