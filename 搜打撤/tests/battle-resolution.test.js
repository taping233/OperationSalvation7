import { describe, expect, it } from 'vitest';
import { createBattleResolution } from '../game/src/battle/battle.resolution.js';
import * as Combat from '../game/src/battle/combat.js';

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
    findCard: () => null,
    addTempCard: tpl => { events.push(['temp', tpl.name]); return `temp-${events.length}`; },
    queueDiscover: job => events.push(['discover', job]),
    // G3（A3 第三批）：acquire 族替身——洗入/洗混/随机池抽卡/金币/职业名；
    // randomDiscoverCard 默认从 state.discoverPool 轮转发卡，便于断言多张获取的次序与数量。
    addDeckCard: tpl => { events.push(['deckAdd', tpl.name]); return `deck-${events.length}`; },
    shuffleDeck: () => { events.push(['shuffle']); return state.deckSize ?? 0; },
    randomDiscoverCard: pred => {
      const pool = (state.discoverPool || []).filter(card => !pred || pred(card));
      if (!pool.length) return null;
      const index = (state.discoverCursor ?? 0) % pool.length;
      const card = pool[index];
      state.discoverCursor = index + 1;
      events.push(['drawPool', card.name]);
      return card;
    },
    addCoins: n => { state.coins = (state.coins || 0) + n; events.push(['coins', n]); },
    getMyClass: () => state.myClass ?? null,
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
    // B7（A3 第三批）：资源命令替身——energy/energyCap 记事件并回传累计值；maxHp 模拟引擎
    // addPlayerMaxHp 命令口径（上限 +n 同时回复 n；初值 10 与 getPlayerHp 缺省对齐）。
    addEnergy: amount => { state.energy = (state.energy ?? 0) + amount; events.push(['energy', amount]); return state.energy; },
    addEnergyCap: amount => { state.maxEnergy = (state.maxEnergy ?? 0) + amount; events.push(['energyCap', amount]); return state.maxEnergy; },
    addPlayerMaxHp: n => {
      state.playerMaxHp = (state.playerMaxHp ?? 10) + n;
      state.playerHp = (state.playerHp ?? 10) + n;
      events.push(['maxHp', n]);
    },
    damagePlayer: amount => events.push(['selfDamage', amount]),
    getPlayerHp: () => state.playerHp ?? 10,
    countDrawnSpells: () => state.drawnSpellCount ?? 0,
    // B5（A3 第二批）：与引擎 combatPort 同款包装——addCurse 回传生效值（免疫为 0），
    // 敌方施放时记一条 cursefx（引擎推彩闪浮标的测试替身；玩家自身不闪，与引擎一致）。
    combat: {
      ...Combat,
      addCurse(target, key, n) {
        const applied = Combat.addCurse(target, key, n);
        if (applied > 0 && target && !target.dead && target !== state.playerStatus) {
          events.push(['cursefx', key]);
        }
        return applied;
      },
    },
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

/* —— A3 第二批（B5 诅咒族，2026-09-25）：结构化 onPlay curse op ——
 * 运行时语义对齐 combat.js（CURSES/CURSE_META/addCurse/tickPoison）与文本路径
 * effect-steps.curse/.damage/.kills 的日志文案；每键至少 1 正 1 反。 */
describe('A3 第二批（B5 诅咒族）：结构化 onPlay curse op', () => {
  const CURSE_KEYS = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn'];
  const setup = ({ foes = [{}], playerStatus = { name: '我', status: {} } } = {}) => {
    const list = foes.map((spec, index) => ({
      name: `敌${index + 1}`, hp: spec.hp ?? 20, maxHp: spec.hp ?? 20, dead: false,
      status: { ...(spec.status || {}) },
    }));
    const callState = {
      current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] },
      playerStatus, target: list[0], foes: list,
    };
    return { foes: list, target: list[0], playerStatus, callState, ...makeResolver(callState) };
  };
  // battle.target 按 schema 交叉契约随 op.target 取值（chosen/random→enemy/false；all→enemy/true；self→self/false）
  const targetContract = target => target === 'allEnemies' ? { side: 'enemy', area: true }
    : target === 'self' ? { side: 'self', area: false } : { side: 'enemy', area: false };
  const curseCard = (operation, desc = '展示描述') => ({
    id: 'v2-curse', name: '诅咒测试', type: '法术', dmgType: 'spell', desc,
    rules: { version: 1, battle: { target: targetContract(operation.target) }, triggers: { onPlay: [operation] } },
  });
  const logTexts = events => events.filter(event => event[0] === 'log').map(event => String(event[1]));

  it('bleed：按 stacks 叠加施加，文本句跳过不双算（正/反）', () => {
    const state = setup({ foes: [{ status: { bleed: 2 } }] });
    const card = curseCard({ op: 'curse', curse: 'bleed', stacks: 3, target: 'chosenEnemy' }, '攻，附加流血。');
    const kinds = [];
    for (const step of state.resolver.steps(card, state.target, false, 0, null)) kinds.push(step.kind);
    expect(kinds, 'windup→hit 演出节奏').toEqual(['windup', 'hit']);
    expect(state.target.status.bleed, 'combat.addCurse 叠层：2+3').toBe(5);
    expect(state.events.some(event => event[0] === 'text'), '结构化在位时文本诅咒句不复算').toBe(false);
    expect(logTexts(state.events).some(t => t.includes('[[icon:blood]]') && t.includes('附加 3 层流血'))).toBe(true);
    expect(state.events.some(event => event[0] === 'cursefx'), '敌方施放推彩闪浮标（引擎同款包装）').toBe(true);
  });

  it('poison：allEnemies 全体各施加（正），玩家自身不受影响（反）', () => {
    const state = setup({ foes: [{}, {}] });
    state.resolver(curseCard({ op: 'curse', curse: 'poison', stacks: 2, target: 'allEnemies' }), state.target, false, 0, null);
    expect(state.foes.map(foe => foe.status.poison)).toEqual([2, 2]);
    expect(state.playerStatus.status.poison ?? 0, 'allEnemies 不波及玩家').toBe(0);
    expect(logTexts(state.events).some(t => t.includes('全体敌人附加 2 层中毒（每层回合末 1 点固定伤害）'))).toBe(true);
  });

  it('freeze：duration 施加（正）；已冻结取较大不缩短不叠加（反）', () => {
    const fresh = setup({ foes: [{}] });
    fresh.resolver(curseCard({ op: 'curse', curse: 'freeze', duration: 2, target: 'chosenEnemy' }), fresh.target, false, 0, null);
    expect(fresh.target.status.freeze).toBe(2);
    expect(logTexts(fresh.events).some(t => t.includes('[[icon:crystal]]') && t.includes('被冰冻 2 回合（无法行动）'))).toBe(true);

    const longer = setup({ foes: [{ status: { freeze: 3 } }] });
    longer.resolver(curseCard({ op: 'curse', curse: 'freeze', duration: 1, target: 'chosenEnemy' }), longer.target, false, 0, null);
    expect(longer.target.status.freeze, '计时诅咒取较大值（combat.addCurse 语义）').toBe(3);
  });

  it('silence：施加 N 回合（正）；玩家沉默时整段封印（反）', () => {
    const cast = setup({ foes: [{}] });
    cast.resolver(curseCard({ op: 'curse', curse: 'silence', duration: 1, target: 'chosenEnemy' }), cast.target, false, 0, null);
    expect(cast.target.status.silence).toBe(1);

    const silenced = setup({ foes: [{}], playerStatus: { name: '我', status: { silence: 1 } } });
    silenced.resolver(curseCard({ op: 'curse', curse: 'silence', duration: 1, target: 'chosenEnemy' }), silenced.target, false, 0, null);
    expect(silenced.target.status.silence ?? 0, '沉默门在 damage 之后、诅咒之前').toBe(0);
    expect(logTexts(silenced.events).some(t => t.includes('被沉默封印'))).toBe(true);
  });

  it('abreak：全体施加（正）；无存活目标时不施放不报错（反）', () => {
    const state = setup({ foes: [{}, {}] });
    state.resolver(curseCard({ op: 'curse', curse: 'abreak', duration: 2, target: 'allEnemies' }), state.target, false, 0, null);
    expect(state.foes.map(foe => foe.status.abreak)).toEqual([2, 2]);
    expect(logTexts(state.events).some(t => t.includes('破甲 2 回合（无法减免伤害——元素庇幕失效）'))).toBe(true);

    const empty = setup({ foes: [] });
    const kinds = [];
    for (const step of empty.resolver.steps(
      curseCard({ op: 'curse', curse: 'abreak', duration: 2, target: 'allEnemies' }), undefined, false, 0, null)) kinds.push(step.kind);
    expect(kinds, '无目标不 windup 不 hit').toEqual([]);
    expect(empty.events, '无目标不记日志').toEqual([]);
  });

  it('healban：target self 挂给玩家（正），敌人不受影响（反）', () => {
    const state = setup({ foes: [{}] });
    state.resolver(curseCard({ op: 'curse', curse: 'healban', duration: 2, target: 'self' }), state.target, false, 0, null);
    expect(state.playerStatus.status.healban).toBe(2);
    expect(state.target.status.healban ?? 0, 'self 不波及敌人').toBe(0);
    expect(state.events.some(event => event[0] === 'cursefx'), '玩家自身不推彩闪（与引擎包装一致）').toBe(false);
    expect(logTexts(state.events).some(t => t.includes('禁疗 2 回合（无法回复生命）'))).toBe(true);
  });

  it('burn：randomEnemy 施放时随机一名存活敌人（正）；重复施加不叠加（反）', () => {
    // makeResolver 的 randomBattle 恒为 0 → 战场首位；点选的是第二名敌人
    const state = setup({ foes: [{}, {}] });
    state.resolver(curseCard({ op: 'curse', curse: 'burn', duration: 3, target: 'randomEnemy' }), state.foes[1], false, 0, null);
    expect(state.foes[0].status.burn, 'randomBattle=0 → 首位存活敌人').toBe(3);
    expect(state.foes[1].status.burn ?? 0, 'randomEnemy 不取点选目标').toBe(0);

    const again = setup({ foes: [{ status: { burn: 3 } }] });
    again.resolver(curseCard({ op: 'curse', curse: 'burn', duration: 1, target: 'chosenEnemy' }), again.target, false, 0, null);
    expect(again.target.status.burn, '灼烧不叠加、取较大剩余（combat.js 定版）').toBe(3);
    expect(logTexts(again.events).some(t => t.includes('被灼烧（1 回合内每回合结束受 1 点固定伤害，不叠加）'))).toBe(true);
  });

  it('damage+curse 复合：按 onPlay 数组顺序先伤害后诅咒，文本句不复算', () => {
    const state = setup({ foes: [{ hp: 30 }] });
    const card = {
      id: 'v2-fatal-ray', name: '致命射线', type: '法术', dmgType: 'spell',
      desc: '造成8点法术伤害，附加 1 层中毒。',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
        { op: 'damage', amount: 8, target: 'chosenEnemy' },
        { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' },
      ] } },
    };
    state.resolver(card, state.target, false, 0, null);
    expect(state.events.filter(event => event[0] === 'damage')).toEqual([['damage', 8]]);
    expect(state.target.status.poison, '结构化中毒恰好 1 层').toBe(1);
    expect(state.events.some(event => event[0] === 'text'), 'desc 句不再复算').toBe(false);
    const damageAt = state.events.findIndex(event => event[0] === 'damage');
    const curseAt = state.events.findIndex(event => event[0] === 'log' && String(event[1]).includes('附加 1 层中毒'));
    expect(damageAt).toBeGreaterThanOrEqual(0);
    expect(curseAt, '伤害段先于诅咒段').toBeGreaterThan(damageAt);
  });

  it('randomKinds：随机 n 种不同诅咒各 1 层/1 回合（正）；超出池长截断（反）', () => {
    const state = setup({ foes: [{}] });
    state.resolver(curseCard({ op: 'curse', randomKinds: 3, target: 'chosenEnemy' }), state.target, false, 0, null);
    const active = CURSE_KEYS.filter(key => (state.target.status[key] || 0) > 0);
    expect(active, '恰抽出 3 种不同诅咒').toHaveLength(3);
    expect(active.every(key => state.target.status[key] === 1), '叠层型 1 层 / 计时型 1 回合').toBe(true);
    expect(logTexts(state.events).some(t => t.includes('附加了 3 种随机诅咒'))).toBe(true);

    const wide = setup({ foes: [{}] });
    wide.resolver(curseCard({ op: 'curse', randomKinds: 9, target: 'chosenEnemy' }), wide.target, false, 0, null);
    expect(CURSE_KEYS.filter(key => (wide.target.status[key] || 0) > 0), '池只有 7 种，slice 截断').toHaveLength(7);
  });

  it('double：中毒层数翻倍（正）；计时诅咒没有层数只记日志（反）', () => {
    const state = setup({ foes: [{ status: { poison: 4 } }] });
    state.resolver(curseCard({ op: 'curse', curse: 'poison', stacks: 1, double: true, target: 'chosenEnemy' }), state.target, false, 0, null);
    expect(state.target.status.poison, '先施加 4+1=5，再翻倍 5×2（与花鸩文本路径同序）').toBe(10);
    expect(logTexts(state.events).some(t => t.includes('中毒翻倍至 10 层'))).toBe(true);

    const timed = setup({ foes: [{ status: { freeze: 1 } }] });
    timed.resolver(curseCard({ op: 'curse', curse: 'freeze', duration: 1, double: true, target: 'chosenEnemy' }), timed.target, false, 0, null);
    expect(timed.target.status.freeze, '计时诅咒持续时间不翻倍').toBe(1);
    expect(logTexts(timed.events).some(t => t.includes('计时诅咒，没有可翻倍的层数'))).toBe(true);
  });

  it('burst：按当前层数引爆 n 次（正）；无中毒引爆 0 点（反）', () => {
    const state = setup({ foes: [{ hp: 20, status: { poison: 3 } }] });
    state.resolver(curseCard({ op: 'curse', curse: 'poison', stacks: 2, burst: 2, target: 'chosenEnemy' }), state.target, false, 0, null);
    expect(state.target.status.poison, '施加后 5 层，引爆不消耗层数').toBe(5);
    expect(state.target.hp, '2 发 × 5 层 = 10 点固定伤害（不吃防御）').toBe(10);
    expect(logTexts(state.events).some(t => t.includes('毒伤引爆 2 次，共 <b>10</b> 点固定伤害（5 层中毒保留）'))).toBe(true);

    // 反：burst 与 op 的诅咒种类无关（只引爆既有中毒）——目标无中毒时该发计 0 点
    const clean = setup({ foes: [{ hp: 20 }] });
    clean.resolver(curseCard({ op: 'curse', curse: 'bleed', stacks: 1, burst: 1, target: 'chosenEnemy' }), clean.target, false, 0, null);
    expect(clean.target.status.bleed, '本 op 施加的是流血').toBe(1);
    expect(clean.target.hp, '无中毒可引爆 → 不掉血').toBe(20);
    expect(logTexts(clean.events).some(t => t.includes('毒伤引爆 1 次，共 <b>0</b> 点固定伤害（0 层中毒保留）'))).toBe(true);
  });

  it('extend：已有冰冻延长 n 回合（正）；未冰冻目标不被 duration 白嫖（反）', () => {
    const frozen = setup({ foes: [{ status: { freeze: 2 } }] });
    frozen.resolver(curseCard({ op: 'curse', curse: 'freeze', duration: 1, extend: 1, target: 'chosenEnemy' }), frozen.target, false, 0, null);
    expect(frozen.target.status.freeze, '2 + extend 1').toBe(3);
    expect(logTexts(frozen.events).some(t => t.includes('的冰冻延长 1 回合（剩 3 回合）'))).toBe(true);

    const clean = setup({ foes: [{}] });
    clean.resolver(curseCard({ op: 'curse', curse: 'freeze', duration: 1, extend: 1, target: 'chosenEnemy' }), clean.target, false, 0, null);
    expect(clean.target.status.freeze ?? 0, '延长语义：目标未冻结则不施加 schema 必填的 duration').toBe(0);
    expect(logTexts(clean.events).some(t => t.includes('目标未被冰冻，延长无效'))).toBe(true);
  });

  it('守卫：curse op 已放行，G13 时点触发器仍逐键抛出', () => {
    const ok = setup({ foes: [{}] });
    expect(() => ok.resolver(
      curseCard({ op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' }), ok.target, false, 0, null,
    )).not.toThrow();

    const pending = setup({ foes: [{}] });
    const card = curseCard({ op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' });
    card.rules.triggers.onDraw = [];
    expect(() => pending.resolver(card, pending.target, false, 0, null)).toThrow(TypeError);
  });
});

/* —— A3 第三批（G3 acquire 族，2026-09-25）：结构化 onPlay acquire/coins op ——
 * 语义真源 docs/card-rules-v2-taxonomy-2026-09-25.md §3「卡牌获取与牌库」25 张效果一句话 + G3 行。
 * 池谓词复用 parsePoolNoun 语义（B6 定版）；dest 三向 hand|deck|discover（BOSS/普通战双口径：
 * 普通战无牌库 dest:'deck' 降级为直接获得，deckDraw/grantSha 先例口径）。 */
describe('A3 第三批（G3 acquire 族）：结构化 onPlay acquire/coins op', () => {
  const setup = ({ mode = 'boss', discoverPool = [], playerStatus = { name: '我', status: {} }, myClass = null } = {}) => {
    const callState = {
      current: { mode, playedMovesThisTurn: 0, infuseFuels: 0, grave: [] },
      playerStatus, target: { name: '靶', hp: 20, maxHp: 20, dead: false, status: {} },
      foes: [{ name: '靶', hp: 20, maxHp: 20, dead: false, status: {} }],
      discoverPool, myClass,
    };
    return { callState, ...makeResolver(callState) };
  };
  const acquireCard = operation => ({
    id: 'v2-acquire', name: '获取测试', type: '法术', desc: '展示描述',
    rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [operation] } },
  });
  const logTexts = events => events.filter(event => event[0] === 'log').map(event => String(event[1]));
  const CARD = name => ({ id: `pool-${name}`, name, type: '法术', rarity: '稀有', desc: '造成 1 点法术伤害。' });

  it('守卫摘除：acquire 与 coins 不再被 PENDING 守卫抛出，其余 pending op 仍抛出', () => {
    const state = setup({ discoverPool: [CARD('火球')] });
    expect(() => state.resolver(acquireCard({ op: 'acquire', n: 1, pool: { kind: '随机' } }), state.callState.target, false, 0, null)).not.toThrow();
    expect(() => state.resolver(acquireCard({ op: 'coins', n: 2 }), state.callState.target, false, 0, null)).not.toThrow();
    // 其余 pending 族不动：summon 仍必须炸出（守卫存在目的回归锚点）
    //（blessing 已随 B7 G4 批接线放行，不再充当 pending 锚点——见下方 B7 describe）
    expect(() => state.resolver(acquireCard({ op: 'summon', name: '步兵', count: 1 }), state.callState.target, false, 0, null)).toThrow(TypeError);
  });

  it('dest 缺省 discover：queueDiscover 收到 n/pred 面板任务（实打）', () => {
    const wushu = { ...CARD('斩'), type: '武术' };
    const spell = CARD('火球');
    const state = setup({ discoverPool: [wushu, spell] });
    state.resolver(acquireCard({ op: 'acquire', n: 1, pool: { kind: '武术' } }), state.callState.target, false, 0, null);
    const jobs = state.events.filter(event => event[0] === 'discover').map(event => event[1]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ n: 1 });
    expect(jobs[0].pred({ type: '武术' }), 'parsePoolNoun 武术谓词透传给面板').toBe(true);
    expect(jobs[0].pred({ type: '法术' })).toBe(false);
    expect(state.events.some(event => event[0] === 'temp'), '发现路径不直接入手').toBe(false);
    expect(logTexts(state.events).some(t => t.includes('发现 1 张') && t.includes('【武术】'))).toBe(true);
  });

  it("dest:'hand'：n 多张直发置入手牌，同名可重复（三重火球语义，实打）", () => {
    const fireball = { ...CARD('火球'), name: '火球' };
    const state = setup({ discoverPool: [fireball] });
    state.resolver(acquireCard({ op: 'acquire', n: 2, dest: 'hand', pool: { kind: '火球' } }), state.callState.target, false, 0, null);
    expect(state.events.filter(event => event[0] === 'temp'), 'n=2 → 置入 2 张').toEqual([['temp', '火球'], ['temp', '火球']]);
    expect(logTexts(state.events).some(t => t.includes('获得 【火球】×2'))).toBe(true);
  });

  it("dest:'deck'：BOSS 战洗入牌库并洗混（实打）", () => {
    const state = setup({ mode: 'boss', discoverPool: [CARD('流光照影'), CARD('另一张')] });
    state.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'deck', pool: { kind: '流光照影' } }), state.callState.target, false, 0, null);
    expect(state.events.filter(event => event[0] === 'deckAdd')).toEqual([['deckAdd', '流光照影']]);
    expect(state.events.some(event => event[0] === 'shuffle'), '洗混牌库').toBe(true);
    expect(logTexts(state.events).some(t => t.includes('洗入牌库'))).toBe(true);
  });

  it("dest:'deck' 普通战双口径：无牌库降级为直接置入手牌（deckDraw/grantSha 先例）", () => {
    const state = setup({ mode: 'normal', discoverPool: [CARD('流光照影')] });
    state.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'deck', pool: { kind: '流光照影' } }), state.callState.target, false, 0, null);
    expect(state.events.filter(event => event[0] === 'temp'), '普通战无牌库 → 直接获得').toEqual([['temp', '流光照影']]);
    expect(state.events.some(event => event[0] === 'deckAdd')).toBe(false);
    expect(state.events.some(event => event[0] === 'shuffle')).toBe(false);
    expect(logTexts(state.events).some(t => t.includes('普通战斗无牌库，改为直接获得'))).toBe(true);
  });

  it("pool:{kind:'moves', cost} v1 形状兼容 + 未识别 kind 走通用随机池", () => {
    const cheapMove = { ...CARD('连斩'), type: '武术', cost: 0 };
    const priceyMove = { ...CARD('重斩'), type: '武术', cost: 3 };
    const spell = CARD('火球');
    const state = setup({ discoverPool: [cheapMove, priceyMove, spell] });
    state.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'hand', pool: { kind: 'moves', cost: 0 } }), state.callState.target, false, 0, null);
    expect(state.events.filter(event => event[0] === 'temp'), 'moves+cost:0 只取 0 费武术').toEqual([['temp', '连斩']]);

    const generic = setup({ discoverPool: [spell] });
    generic.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'hand', pool: { kind: '随机' } }), generic.callState.target, false, 0, null);
    expect(generic.events.filter(event => event[0] === 'temp'), '未识别 kind → 通用池').toEqual([['temp', '火球']]);
  });

  it("act:'dup' 手牌本体+复制 ×2 置手；act:'noInfuse' 透传 _noInfuse（灵能召唤先例）", () => {
    const state = setup({ discoverPool: [CARD('武术牌')] });
    state.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'hand', act: 'dup', pool: { kind: '随机' } }), state.callState.target, false, 0, null);
    expect(state.events.filter(event => event[0] === 'temp'), 'dup：本体+复制共 2 张').toHaveLength(2);

    const infuseFree = setup({ discoverPool: [{ ...CARD('注能卡'), infuse: 1 }] });
    infuseFree.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'hand', act: 'noInfuse', pool: { kind: '注能' } }), infuseFree.callState.target, false, 0, null);
    expect(infuseFree.events.filter(event => event[0] === 'temp')).toEqual([['temp', '注能卡']]);
  });

  it("dest:'discover' 面板 act/费用修饰透传（play/zeroCost），面板外 pending 组合炸出", () => {
    const play = setup({ discoverPool: [CARD('形态')] });
    play.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'discover', act: 'play', pool: { kind: '形态' } }), play.callState.target, false, 0, null);
    expect(play.events.filter(event => event[0] === 'discover')[0][1]).toMatchObject({ act: 'play' });

    const zero = setup({ discoverPool: [CARD('低费')] });
    zero.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'discover', act: 'zeroCost', pool: { kind: '1费招式' } }), zero.callState.target, false, 0, null);
    expect(zero.events.filter(event => event[0] === 'discover')[0][1]).toMatchObject({ zeroCost: true });

    // 洗入模板静态 0 费（铁甲阵改模板先例）——deck+zeroCost 放行
    const deckZero = setup({ mode: 'boss', discoverPool: [{ ...CARD('带价卡'), cost: 2 }] });
    deckZero.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'deck', act: 'zeroCost', pool: { kind: '随机' } }), deckZero.callState.target, false, 0, null);
    expect(deckZero.events.filter(event => event[0] === 'deckAdd')[0][1]).toBe('带价卡');
    const deckJob = deckZero.events.filter(event => event[0] === 'deckAdd')[0];
    expect(deckJob).toEqual(['deckAdd', '带价卡']);

    // 无既有机制承载的 dest×act 组合在结算层显式失败（与守卫同风格：错数据炸出而非静默忽略）
    const pendingHand = setup({ discoverPool: [CARD('牌')] });
    expect(() => pendingHand.resolver(
      acquireCard({ op: 'acquire', n: 1, dest: 'hand', act: 'play', pool: { kind: '随机' } }),
      pendingHand.callState.target, false, 0, null,
    )).toThrow(TypeError);
    const pendingDeck = setup({ discoverPool: [CARD('牌')] });
    expect(() => pendingDeck.resolver(
      acquireCard({ op: 'acquire', n: 1, dest: 'deck', act: 'decay', pool: { kind: '随机' } }),
      pendingDeck.callState.target, false, 0, null,
    )).toThrow(TypeError);
    const pendingDiscoverNoInfuse = setup({ discoverPool: [CARD('牌')] });
    expect(() => pendingDiscoverNoInfuse.resolver(
      acquireCard({ op: 'acquire', n: 1, dest: 'discover', act: 'noInfuse', pool: { kind: '随机' } }),
      pendingDiscoverNoInfuse.callState.target, false, 0, null,
    )).toThrow(TypeError);
  });

  it('池空兜底：dim 日志不炸结算；coins：获得 N 币入账（实打）', () => {
    const empty = setup({ discoverPool: [] });
    empty.resolver(acquireCard({ op: 'acquire', n: 1, dest: 'hand', pool: { kind: '随机' } }), empty.callState.target, false, 0, null);
    expect(empty.events.some(event => event[0] === 'temp')).toBe(false);
    expect(logTexts(empty.events).some(t => t.includes('卡池里没有符合条件的卡牌'))).toBe(true);

    const coins = setup({});
    coins.resolver(acquireCard({ op: 'coins', n: 3 }), coins.callState.target, false, 0, null);
    expect(coins.callState.coins, 'G.coins 计数入账').toBe(3);
    expect(coins.events.filter(event => event[0] === 'coins')).toEqual([['coins', 3]]);
    expect(logTexts(coins.events).some(t => t.includes('[[icon:coin]]') && t.includes('获得 3 币'))).toBe(true);

    // 沉默封印：acquire/coins 与 heal/armor/draw 同门——沉默门后的技能效果
    const silenced = setup({ discoverPool: [CARD('牌')], playerStatus: { name: '我', status: { silence: 1 } } });
    silenced.resolver({
      id: 'v2-silenced-acquire', name: '获取测试', type: '法术', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [
        { op: 'acquire', n: 1, pool: { kind: '随机' } }, { op: 'coins', n: 3 },
      ] } },
    }, silenced.callState.target, false, 0, null);
    expect(silenced.events.some(event => ['temp', 'discover', 'coins'].includes(event[0]))).toBe(false);
    expect(logTexts(silenced.events).some(t => t.includes('被沉默封印'))).toBe(true);
  });
});

/* —— A3 第三批（B7 G4 增益·祝福·能量族，2026-09-25）：结构化 onPlay blessing / 资源族 op ——
 * 运行时语义对齐 combat.addBlessing（BUFF_META value/timed 两型）与文本路径增益专支
 * （effect-steps.curse.js buff.*、effect-steps.damage.js buff.dodge、effect-steps.tail.js res.*）；
 * 资源族走引擎命令端口（addEnergy/addEnergyCap/addPlayerMaxHp）。coins 归 G3（见其 describe）。
 * 每 op 至少 1 正 1 反；duration/stacks 组合与 maxHp 回血口径单独成例。 */
describe('A3 第三批（B7）：结构化 onPlay blessing 与资源族 op', () => {
  const setup = (extra = {}) => {
    const target = { hp: 20, dead: false, status: {} };
    const callState = {
      current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] },
      playerStatus: { name: '我', status: {} }, target, ...extra,
    };
    return { target, callState, playerStatus: callState.playerStatus, ...makeResolver(callState) };
  };
  const selfCard = (operation, desc = '展示描述') => ({
    id: 'v2-g4', name: '增益测试', type: '法术', desc,
    rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [operation] } },
  });
  const logTexts = events => events.filter(event => event[0] === 'log').map(event => String(event[1]));

  it('blessing atkUp：stacks 叠层入状态袋（正），desc 攻击句不双算；duration 走到期扣回（组合）', () => {
    const state = setup();
    state.resolver(selfCard({ op: 'blessing', key: 'atkUp', stacks: 3 }, '攻（+99）。'), state.target, false, 0, null);
    expect(state.playerStatus.status.atkUp, 'combat.addBlessing value 型叠层').toBe(3);
    expect(state.playerStatus.__timedBuffs ?? null, '无 duration → 本场战斗不挂到期记录').toBeNull();
    expect(logTexts(state.events).some(t => t.includes('[[icon:swords]]') && t.includes('攻击力 +3（本场战斗，当前加成 3）'))).toBe(true);
    expect(state.events.some(event => event[0] === 'text'), '结构化在位时文本攻击句不复算').toBe(false);

    const timed = setup();
    timed.resolver(selfCard({ op: 'blessing', key: 'atkUp', stacks: 2, duration: 2 }), timed.target, false, 0, null);
    expect(timed.playerStatus.status.atkUp).toBe(2);
    expect(timed.playerStatus.__timedBuffs, 'duration → __timedBuffs 到期扣回记录（tickDurations 同款）').toEqual([{ key: 'atkUp', amount: 2, turns: 2 }]);
    expect(logTexts(timed.events).some(t => t.includes('攻击力 +2（2 回合'))).toBe(true);
  });

  it('blessing spellUp：法伤加成叠加相加并读「当前加成」（正；反例口径：不取较大）', () => {
    const state = setup();
    state.resolver(selfCard({ op: 'blessing', key: 'spellUp', stacks: 1 }), state.target, false, 0, null);
    state.resolver(selfCard({ op: 'blessing', key: 'spellUp', stacks: 2 }), state.target, false, 0, null);
    expect(state.playerStatus.status.spellUp, 'value 型 1+2=3（叠加相加，与文本路径 buff.spellUp 同一 API）').toBe(3);
    expect(logTexts(state.events).some(t => t.includes('[[icon:crystal]]') && t.includes('法术伤害 +2（本场战斗，当前加成 3）'))).toBe(true);
  });

  it('blessing stealth：duration 定回合数（正）；已有更长潜行取较大不缩短（反）', () => {
    const state = setup();
    state.resolver(selfCard({ op: 'blessing', key: 'stealth', duration: 2 }), state.target, false, 0, null);
    expect(state.playerStatus.status.stealth, 'timed 型：n 即回合数').toBe(2);
    expect(logTexts(state.events).some(t => t.includes('[[icon:runner]]') && t.includes('祝福·潜行') && t.includes('2 回合内无法成为被攻击对象'))).toBe(true);

    const longer = setup({ playerStatus: { name: '我', status: { stealth: 3 } } });
    longer.resolver(selfCard({ op: 'blessing', key: 'stealth', duration: 1 }), longer.target, false, 0, null);
    expect(longer.playerStatus.status.stealth, '已有 3 回合潜行不被 1 回合缩短（addBlessing timed 取较大）').toBe(3);
  });

  it('blessing immune：免疫 N 回合（正）；timed 型 stacks 兜底按回合数解释（组合）', () => {
    const state = setup();
    state.resolver(selfCard({ op: 'blessing', key: 'immune', duration: 1 }), state.target, false, 0, null);
    expect(state.playerStatus.status.immune).toBe(1);
    expect(logTexts(state.events).some(t => t.includes('[[icon:sparkles]]') && t.includes('祝福·免疫伤害') && t.includes('1 回合内不受到任何伤害'))).toBe(true);

    const stacked = setup();
    stacked.resolver(selfCard({ op: 'blessing', key: 'immune', stacks: 2 }), stacked.target, false, 0, null);
    expect(stacked.playerStatus.status.immune, '无 duration 时 stacks 兜底为回合数（timed 型无层数，键不静默丢弃）').toBe(2);
  });

  it('blessing dodge：按层计数本回合有效（正）；显式 duration 覆盖本回合缺省（组合）', () => {
    const state = setup();
    state.resolver(selfCard({ op: 'blessing', key: 'dodge', stacks: 2 }), state.target, false, 0, null);
    expect(state.playerStatus.status.dodge).toBe(2);
    expect(state.playerStatus.__timedBuffs, '文本路径 buff.dodge 同款：turns=1 本回合到期').toEqual([{ key: 'dodge', amount: 2, turns: 1 }]);
    expect(logTexts(state.events).some(t => t.includes('[[icon:shield]]') && t.includes('接下来 2 次攻击将被完全避开（各消耗 1 层）'))).toBe(true);

    const lasting = setup();
    lasting.resolver(selfCard({ op: 'blessing', key: 'dodge', stacks: 1, duration: 3 }), lasting.target, false, 0, null);
    expect(lasting.playerStatus.__timedBuffs, '显式 duration 覆盖本回合缺省口径').toEqual([{ key: 'dodge', amount: 1, turns: 3 }]);
    expect(logTexts(lasting.events).some(t => t.includes('（持续 3 回合）'))).toBe(true);
  });

  it('blessing reduce：每次受伤 -N 本场（正）；带 duration 时挂到期扣回（组合）', () => {
    const state = setup();
    state.resolver(selfCard({ op: 'blessing', key: 'reduce', stacks: 2 }), state.target, false, 0, null);
    expect(state.playerStatus.status.reduce).toBe(2);
    expect(state.playerStatus.__timedBuffs ?? null, '无 duration → 本场战斗').toBeNull();
    expect(logTexts(state.events).some(t => t.includes('[[icon:plate]]') && t.includes('祝福·减伤') && t.includes('每次受到的伤害 -2（本场战斗）'))).toBe(true);

    const timed = setup();
    timed.resolver(selfCard({ op: 'blessing', key: 'reduce', stacks: 1, duration: 2 }), timed.target, false, 0, null);
    expect(timed.playerStatus.__timedBuffs).toEqual([{ key: 'reduce', amount: 1, turns: 2 }]);
  });

  it('energy：+n 入当前能量（正）；沉默封印整段（反）', () => {
    const state = setup();
    state.resolver(selfCard({ op: 'energy', n: 2 }), state.target, false, 0, null);
    expect(state.callState.energy, '资源命令入账（不设上限夹逼，回合开始重置回满）').toBe(2);
    expect(state.events.filter(event => event[0] === 'energy')).toEqual([['energy', 2]]);
    expect(logTexts(state.events).some(t => t.includes('[[icon:bolt]] 获得 2 点能量（当前 2）'))).toBe(true);

    const silenced = setup({ playerStatus: { name: '我', status: { silence: 1 } } });
    silenced.resolver(selfCard({ op: 'energy', n: 2 }), silenced.target, false, 0, null);
    expect(silenced.events.some(event => event[0] === 'energy'), '沉默门在资源段之前').toBe(false);
    expect(logTexts(silenced.events).some(t => t.includes('被沉默封印'))).toBe(true);
  });

  it('energyCap：上限 +n 且当前能量同加（引擎命令口径），日志带每回合费用（正）；沉默（反）', () => {
    const state = setup();
    state.resolver(selfCard({ op: 'energyCap', n: 1 }), state.target, false, 0, null);
    expect(state.callState.maxEnergy).toBe(1);
    expect(state.events.filter(event => event[0] === 'energyCap')).toEqual([['energyCap', 1]]);
    expect(logTexts(state.events).some(t => t.includes('[[icon:bolt]] 本场战斗能量上限 +1（每回合 1 费）'))).toBe(true);

    const silenced = setup({ playerStatus: { name: '我', status: { silence: 1 } } });
    silenced.resolver(selfCard({ op: 'energyCap', n: 1 }), silenced.target, false, 0, null);
    expect(silenced.events.some(event => event[0] === 'energyCap')).toBe(false);
  });

  it('maxHp：上限 +n 同时回复 n（回血口径与引擎 addPlayerMaxHp 命令一致）（正）；沉默（反）', () => {
    const state = setup({ playerHp: 4 });
    state.resolver(selfCard({ op: 'maxHp', n: 10 }), state.target, false, 0, null);
    expect(state.events.filter(event => event[0] === 'maxHp')).toEqual([['maxHp', 10]]);
    expect(state.callState.playerMaxHp, '上限 10 → 20').toBe(20);
    expect(state.callState.playerHp, '当前 4 → 14（上限 +n 同时回复 n）').toBe(14);

    const silenced = setup({ playerStatus: { name: '我', status: { silence: 1 } } });
    silenced.resolver(selfCard({ op: 'maxHp', n: 10 }), silenced.target, false, 0, null);
    expect(silenced.events.some(event => event[0] === 'maxHp')).toBe(false);
  });

  it('deckCap：BOSS 战注明编组阶段生效不追溯（正口径）；普通战注明无牌库（反口径）——均无状态变更', () => {
    const boss = setup();
    boss.resolver(selfCard({ op: 'deckCap', n: 5 }), boss.target, false, 0, null);
    expect(logTexts(boss.events).some(t => t.includes('牌库上限在开战前编组阶段生效') && t.includes('+5 不追溯扩容'))).toBe(true);

    const normal = setup({ current: { mode: 'normal', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] } });
    normal.resolver(selfCard({ op: 'deckCap', n: 5 }), normal.target, false, 0, null);
    expect(logTexts(normal.events).some(t => t.includes('普通战斗没有牌库'))).toBe(true);
  });

  it('damage + blessing 复合：按 onPlay 数组顺序先伤害后增益（循环 1 → 沉默门 → 循环 2）', () => {
    const state = setup();
    const card = {
      id: 'v2-g4-combo', name: '炽焰剑', type: '武术', dmgType: 'fixed', desc: '展示描述',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
        { op: 'damage', amount: 5, target: 'chosenEnemy' },
        { op: 'blessing', key: 'atkUp', stacks: 2 },
      ] } },
    };
    state.resolver(card, state.target, false, 0, null);
    const damageAt = state.events.findIndex(event => event[0] === 'damage');
    const blessingAt = state.events.findIndex(event => event[0] === 'log' && String(event[1]).includes('祝福·攻击力增加'));
    expect(damageAt).toBeGreaterThanOrEqual(0);
    expect(blessingAt, '伤害段先于增益段').toBeGreaterThan(damageAt);
    expect(state.playerStatus.status.atkUp).toBe(2);
  });

  it('blessing：沉默封印整段（反）——循环 2 在沉默门后，状态袋与日志均不产生', () => {
    const silenced = setup({ playerStatus: { name: '我', status: { silence: 1 } } });
    silenced.resolver(selfCard({ op: 'blessing', key: 'atkUp', stacks: 3 }), silenced.target, false, 0, null);
    expect(silenced.playerStatus.status.atkUp ?? 0, '沉默门先于增益段（与文本路径 buff.* 同门）').toBe(0);
    expect(logTexts(silenced.events).some(t => t.includes('被沉默封印'))).toBe(true);
    expect(logTexts(silenced.events).some(t => t.includes('祝福·攻击力增加'))).toBe(false);
  });

  it('守卫：B7 五 op 已放行不再抛错；summon 等 pending 族仍逐 op 抛出', () => {
    const ok = setup();
    for (const operation of [
      { op: 'blessing', key: 'atkUp', stacks: 1 },
      { op: 'energy', n: 1 },
      { op: 'energyCap', n: 1 },
      { op: 'maxHp', n: 1 },
      { op: 'deckCap', n: 1 },
    ]) {
      expect(() => ok.resolver(selfCard(operation), ok.target, false, 0, null), operation.op).not.toThrow();
    }
    const pending = setup();
    expect(() => pending.resolver(selfCard({ op: 'summon', name: '步兵', count: 1 }), pending.target, false, 0, null)).toThrow(TypeError);
  });
});
