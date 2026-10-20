import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 修复轮回归：已确认差异按卡面正确结果断言；待裁定项仍保留现行行为边界。
// 原审查75/75及catalog/observations保持历史含义，本文件后续运行不覆盖原证据。
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 8, starterSha: 0,
    battleStartDraw: 99, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const Combat = await import('../game/src/battle/core/combat.js');
const { createBattleResolution } = await import('../game/src/battle/core/battle.resolution.js');
const { createBattleDiscoverFlow } = await import('../game/src/battle/effects/battle.discover-flow.js');
const { parsePoolNoun } = await import('../game/src/battle/effects/effect-steps.ctx.js');
const { displayCardDescription } = await import('../game/src/cards/card-description-text.js');
const byId = id => { const c = C.all().filter(c => c.id === id).at(-1); if (!c) throw Error(`缺卡 ${id}`); return c; };
afterEach(() => vi.restoreAllMocks());
const observed = [];
const record = (id, scenario, actual, described) => observed.push({ id, scenario, actual, described });
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();

function resolverProbe({ mode = 'boss', pool = [], infuseFuels = 0, playedMovesThisTurn = 0, spellPower = 0, atk = 0 } = {}) {
  const foe = Combat.ensureStatus({ name: '审查靶', hp: 50, maxHp: 100, atk: 0 });
  const events = [], added = [], jobs = [];
  const pstat = Combat.ensureStatus({ hp: 50 });
  const current = { mode, infuseFuels, playedMovesThisTurn, hand: [], grave: [] };
  const resolver = createBattleResolution({
    readState: () => current, getPlayerStatus: () => pstat, esc: String, log() {},
    heal: n => events.push(['heal', n]), addFloat() {}, addDelayed: q => events.push(['delayed', q]), takeDeckBottom: () => [], deckBottomCount: () => 0,
    startSurge() {}, getAllCards: () => C.all(), isRandomObtainable: () => true, randomBattle: () => 0,
    getDamageTypes: () => ['武术', '法术'], getDamageTypeMeta: () => Combat.TYPE_NAME, fixedDamageType: 'fixed',
    hasCurse: Combat.hasCurse, getAliveFoes: () => [foe].filter(f => !f.dead), getGrowth: () => 0,
    findCard: () => null, addTempCard: c => { added.push(c); return `tmp-${added.length}`; },
    addDeckCard: c => { added.push(c); return `deck-${added.length}`; }, shuffleDeck: () => added.length,
    randomDiscoverCard: pred => pool.find(c => !pred || pred(c)), queueDiscover: job => jobs.push(job), getMyClass: () => '战士',
    splitClauses: () => ({ immediate: [], turnStart: [], battle: [], onInfused: [], onDraw: [], skill: [] }),
    applyTextEffects: () => ({ did: false }), registerTurnStart() {}, registerBattle() {}, castRandomSpells() {},
    drawCards: n => { events.push(['draw', n]); return n; }, grantSha: n => events.push(['starter', n]), drawOf: () => 0, isAOE: () => false,
    addArmor: n => events.push(['armor', n]), addEnergy: n => events.push(['energy', n]), addEnergyCap: n => events.push(['energyCap', n]), addPlayerMaxHp() {}, addCoins() {},
    markNoDrawNext: () => events.push(['noDrawNext']),
    damagePlayer: n => events.push(['selfDamage', n]), getPlayerHp: () => 50, getPlayerSpellPower: () => spellPower,
    countDrawnSpells: () => 0, getHandSize: () => 0, combat: Combat,
    hitFoe: (f, c, n, type) => {
      const r = Combat.dealDamage({ atk, spellPower }, f, n, type || c.dmgType);
      events.push(['damage', r.dealt]); if (f.hp <= 0) f.dead = true; return r.dealt;
    },
  });
  return { resolver, foe, events, added, jobs, current };
}
const gameFor = cards => ({ ownedCards: cards.map((card, i) => ({ uid: `audit-${i}`, card })), inventory: [], usedPocket: [],
  hp: 50, maxHp: 50, atk: 5, spellPower: 0, coins: 0, state: 'idle', battleActive: false, myClass: '战士',
  log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, onBattleEnd() {} });
async function drain() {
  for (let n = 0; n < 300; n++) {
    await new Promise(r => setTimeout(r, 0));
    const s = BattleSession.getSnapshot();
    if (!s.busy && s.actionQueueLength === 0) {
      await new Promise(r => setTimeout(r, 30));
      const f = BattleSession.getSnapshot(); if (!f.busy && f.actionQueueLength === 0) return f;
    }
  }
  throw Error('审查战斗动作未收口');
}
async function start(cards, { boss = false } = {}) {
  const g = gameFor(cards);
  BattleSession.start(g, [{ id: 'audit-foe', name: '审查靶', hp: 1000, atk: 0 }], { isBoss: boss, nest: boss });
  await drain(); return g;
}
async function play(uid, target = 0) { BattleSession.commands.playCard(uid, target); return drain(); }

describe('全卡描述修复回归：卡面正确结果与待裁定边界', () => {
  // 独立按玩家可见数值登记：攻击力5、法伤2，单个存活目标；不从rules计算期望值。
  it.each([
    ['starter-attack', [5]], ['cc-chase-slash', [5]], ['cc-cursed-blade', [8]],
    ['cc-double-boom', [5]], ['cc-ember-burst', [4]], ['cc-lava-blast', [11]],
    ['tt2-bloodblade', [7], { heal: 7 }], ['tt2-comboarrow', [4]],
    ['tt2-forestarrow', [4], { armor: 3 }], ['tt2-piercearrow', [4], { armor: 3 }],
    ['tt2-shoot', [2]], ['tt2-swiftarrow', [4], { draw: 1 }],
    ['tt3-armor-rush', [9], { bleed: 2 }], ['tt3-arrow-rain', [4]],
    ['tt3-bandage', [], { heal: 3, armor: 3 }], ['tt3-blood-arrow', [4], { bleed: 1 }],
    ['tt3-double-shot', [2, 2, 2]], ['tt3-frost-slash', [7], { freeze: 1, healban: 1 }],
    ['tt3-hold-fast', [], { armor: 5, draw: 1 }], ['tt3-life-arrow', [4]],
    ['tt3-purify-arrow', [4]], ['tt3-reshot', [7]], ['tt3-skewer', [7], { abreak: 1 }],
    ['tt3-venom-arrow', [4], { poison: 1 }], ['tt3-wave-slash', [8]],
    ['tt7-bulwark', [], { armor: 8 }], ['tt7-demonbreaker', [10], { abreak: 2 }],
    ['tt7-fullstrike', [10], { draw: 1 }], ['tt7-ironcharge', [], { armor: 12, draw: 2 }],
    ['tt7-meteorrain', [4, 4]], ['tt7-sneak', [4]],
    ['tt7-throwblade', [2], { bleed: 1, draw: 1 }], ['tt7-whirlwind', [6]],
    ['tt8-dragonblade', [11], { abreak: 2, bleed: 1 }], ['cmtna0nb1yxt', [7]],
    ['tt12-barriermend', [], { armor: 6 }], ['tt12-elemburst', [4, 4, 4, 4]],
    ['tt12-firecracker', [1]], ['tt12-infectray', [6]],
    ['tt12-sporewall', [], { armor: 6, poison: 2 }], ['tt12-unstableray', [6]],
    ['tt3-chain-lightning', [5, 5]], ['tt3-fireball', [6]], ['tt3-flame-storm', [6]],
    ['tt3-holy-shield', [], { armor: 6 }], ['tt3-holy-water', [], { heal: 5 }],
    ['tt3-ice-spike', [4], { freeze: 1 }], ['tt3-thunderblast', [9]],
    ['tt3-toxin', [], { poison: 1, draw: 1 }], ['tt3-treasure-hunt', [6]],
    ['tt3sp-shadowshot', [5]], ['tt7-bloodpotion', [5], { heal: 5 }],
    ['tt7-burnharvest', [9]], ['tt7-livingwater', [], { draw: 5 }],
    ['tt7-twinfireball', [6]],
  ])('%s：实际分段伤害/附带数值与卡面相符', (id, damage, extras = {}) => {
    const p = resolverProbe({ atk: 5, spellPower: 2 }); p.resolver(byId(id), p.foe);
    const actualDamage = p.events.filter(e => e[0] === 'damage').map(e => e[1]);
    expect(actualDamage).toEqual(damage);
    const actualExtras = {};
    for (const [key, n] of Object.entries(extras)) {
      const actual = ['heal', 'armor', 'draw'].includes(key)
        ? p.events.filter(e => e[0] === key).reduce((sum, e) => sum + e[1], 0) : p.foe.status[key];
      expect(actual, key).toBe(n); actualExtras[key] = actual;
    }
    record(id, '实际结构化执行器：攻击力5/法伤2/目标存活，随机区间取下端', { damage: actualDamage, extras: actualExtras }, { damage, extras });
  });
  it('铁甲阵：真实 acquire 将2费模板减1费成为1费', () => {
    const p = resolverProbe({ pool: [byId('tt3-flame-storm')] });
    expect(byId('tt3-flame-storm').cost).toBe(2);
    p.resolver(byId('tt7-ironphalanx'), p.foe);
    expect(p.added.map(c => c.cost)).toEqual([1, 1, 1, 1, 1]);
    record('tt7-ironphalanx', '首脑执行器：随机池固定为真实2费风暴火球模板', p.added.map(c => c.cost), [1, 1, 1, 1, 1]);
  });
  it.each([
    ['tt12-basicdev', '0费招式', 'tt3-toxin'], ['tt12-breakthrough', '1费招式', 'tt3-ice-spike'],
    ['tt12-magicfind', '1费招式', 'tt3-ice-spike'], ['cmtn1gfhczzj', '能施加诅咒的招式', 'tt3-ice-spike'],
  ])('%s：招式池包含符合费用/诅咒的法术', (id, noun, spellId) => {
    const spell = byId(spellId), pred = parsePoolNoun(noun, '战士');
    expect(pred).toBeTypeOf('function'); expect(pred(spell)).toBe(true);
    record(id, `${noun}实际谓词对${spell.name}（${spell.type}/${spell.cost}费）`, pred(spell), true);
  });
  it('高端研发：实际发现流程2费moves池同时包含武术与法术', () => {
    let state = null, cursor = 0;
    const jobs = [{ n: 1, pool: { kind: 'moves', cost: 2 } }];
    const flow = createBattleDiscoverFlow({
      cards: { all: () => [byId('tt3-flame-storm'), byId('tt7-fullstrike')], isRandomObtainable: () => true },
      interaction: { getJobs: () => jobs, get: () => state, set: s => { state = s; }, requestRender() {} },
      random: { next: () => (cursor++ % 2) / 2 }, battle: { currentClass: () => '战士' }, effects: {}, output: { log() {} },
    });
    flow.processDiscoverQueue();
    expect(state.options.map(c => c.type).sort()).toEqual(['武术', '法术'].sort());
    record('tt12-hitechrd', '实际发现流程，2费武术与2费法术各1张输入', state.options.map(c => c.type), ['武术', '法术']);
  });
  it('充能射线：新入手副本不读取入手前本场注能历史', async () => {
    await start([byId('starter-attack')]);
    runtime.set$infuseFuels(3);
    // 本牌此时才进入手牌，随后走实际 BattleSession 出牌。
    const uid = engine.addTempCard(byId('tt12-chargeray'));
    const s = await play(uid);
    expect(s.foes[0].hp).toBe(995);
    record('tt12-chargeray', '本场先注能3张，本牌随后经实际addTempCard入手，期间没有再注能', 1000 - s.foes[0].hp, 5);
  });
  it('寒冰剑：实际装配后攻击冰冻敌人获得+2', async () => {
    await start([byId('tt2-frostsword'), byId('starter-attack')]);
    await play('audit-0', 'self');
    expect(BattleSession.getSnapshot().equipped.some(e => e.card.id === 'tt2-frostsword')).toBe(true);
    Combat.addCurse(runtime.foes[0], 'freeze', 1);
    const s = await play('audit-1');
    expect(s.foes[0].hp).toBe(993);
    record('tt2-frostsword', '装配寒冰剑→对冰冻目标打初始攻击，攻击力5', 1000 - s.foes[0].hp, 7);
  });
  it('飞身劈：本次攻击流血加成翻倍，后续攻击恢复普通加成', async () => {
    await start([byId('tt3-fly-arrowhawk'), byId('starter-attack')]);
    Combat.addCurse(runtime.foes[0], 'bleed', 2);
    const first = await play('audit-0');
    const second = await play('audit-1');
    const actual = [1000 - first.foes[0].hp, first.foes[0].hp - second.foes[0].hp];
    expect(actual).toEqual([12, 7]);
    record('tt3-fly-arrowhawk', '目标2层流血，攻击力5；飞身劈后打初始攻击', actual, [12, 7]);
  });
  it('充能火球：首次打出前跨过回合开始增长1点', async () => {
    await start([byId('cmtn1lbhbqi4')]);
    runtime.set$extraTurn(true); BattleSession.commands.endTurn(); await drain();
    expect(BattleSession.getSnapshot().turn).toBe(2);
    const s = await play('audit-0');
    expect(s.foes[0].hp).toBe(995);
    record('cmtn1lbhbqi4', '从第1回合持有到第2回合开始，首次打出；受控额外回合走生产回合管线', 1000 - s.foes[0].hp, 5);
  });
  it('正午决战：选择第二名存活目标，延迟四枪仍打该目标', async () => {
    await start([byId('tt3-noon-duel')]);
    runtime.foes.push(Combat.ensureStatus({ id: 'audit-second', name: '第二审查靶', hp: 1000, maxHp: 1000, atk: 0 }));
    await play('audit-0', 1);
    expect(runtime.delayed.some(q => q.special === 'triggerOps')).toBe(true);
    runtime.set$turn(2); await engine.processDelayed();
    const hp = runtime.foes.map(f => f.hp);
    expect(hp).toEqual([1000, 992]);
    record('tt3-noon-duel', '首回合指定第二敌人；第2回合真实延迟执行器结算，双方均存活', hp, [1000, 992]);
  });
  it.each([
    ['tt2-wreck', 'acquire', 2], ['tt3-azure-sword', 'damage', 5],
    ['tt3-sapper-bomb', 'damage', 4], ['tt7-arcanescroll', 'acquire', 3],
  ])('%s：临时卡到期消耗触发一次“本牌被消耗时”', async (id, effect, n) => {
    await start([byId('starter-attack')]);
    const consumedCard = byId(id);
    const uid = engine.addTempCard(consumedCard);
    // 固定为无获取派生效果的真实法术，基础张数不混入阿猫的额外奖励。
    // 法术也满足奥术卷轴的随机法术池；阿猫组合在下方单独严格验证。
    const plain = byId('tt3-ice-spike');
    expect(C.isRandomObtainable(plain)).toBe(true);
    expect(plain.rules?.triggers?.onAcquire?.length || 0).toBe(0);
    vi.spyOn(C, 'all').mockReturnValue([plain]);
    const beforeGranted = runtime.granted.length;
    runtime.delayed.push({ special: 'consumeTemps', uids: [uid], cardName: '江湖救急-改' });
    await engine.processDelayed(); await drain();
    expect(runtime.consumed).toContain(uid);
    const actual = effect === 'acquire' ? runtime.granted.length - beforeGranted : 1000 - runtime.foes[0].hp;
    expect(actual).toBe(n);
    // 重跑到期任务不再触发；正常消耗钩作为相同数值的独立正对照。
    runtime.delayed.push({ special: 'consumeTemps', uids: [uid], cardName: '重复到期回归' });
    await engine.processDelayed(); await drain();
    const repeated = effect === 'acquire' ? runtime.granted.length - beforeGranted : 1000 - runtime.foes[0].hp;
    expect(repeated).toBe(n);
    engine.fireConsumeTriggers(consumedCard, runtime.foes[0]); await drain();
    const control = (effect === 'acquire' ? runtime.granted.length - beforeGranted : 1000 - runtime.foes[0].hp) - repeated;
    expect(control).toBe(n);
    record(id, '生产consumeTemps到期消耗且重复到期不重发；随后正常消耗钩作正对照', { expiredEffect: actual, normalConsumeEffect: control }, { expiredEffect: n, normalConsumeEffect: n });
  });
  it.each(['到期', '正常'])('沉船宝盒%s消耗：基础2张抽中阿猫，派生额外1张并回复1能量', async mode => {
    await start([byId('starter-attack')]);
    const wreck = byId('tt2-wreck'), gift = byId('tt2-apollo'), plain = byId('tt3-ice-spike');
    expect([gift, plain].every(card => C.isRandomObtainable(card))).toBe(true);
    const uid = engine.addTempCard(wreck);
    const beforeGranted = runtime.granted.length, beforeEnergy = runtime.energy;
    // 首次随机获取必为阿猫；其派生获取及宝盒第二张必为冰刺。
    // 只约束候选池，保留生产随机获取、onAcquire、入手与消耗管线。
    vi.spyOn(C, 'all').mockImplementation(() =>
      runtime.granted.slice(beforeGranted).some(entry => entry.card.id === gift.id) ? [plain] : [gift]);
    if (mode === '到期') {
      runtime.delayed.push({ special: 'consumeTemps', uids: [uid], cardName: '阿猫组合回归' });
      await engine.processDelayed();
    } else {
      engine.fireConsumeTriggers(wreck, runtime.foes[0]);
    }
    await drain();
    const acquired = runtime.granted.slice(beforeGranted);
    expect(acquired.map(entry => entry.card.id)).toEqual([gift.id, plain.id, plain.id]);
    expect(acquired.every(entry => runtime.hand.includes(entry.uid))).toBe(true);
    expect(runtime.energy - beforeEnergy).toBe(1);
    if (mode === '到期') {
      expect(runtime.consumed).toContain(uid);
      runtime.delayed.push({ special: 'consumeTemps', uids: [uid], cardName: '阿猫组合重复到期' });
      await engine.processDelayed(); await drain();
      expect(runtime.granted.slice(beforeGranted)).toEqual(acquired);
      expect(runtime.energy - beforeEnergy).toBe(1);
    }
    record('tt2-wreck', `${mode}消耗：固定首张阿猫，派生与第二张冰刺`,
      { cards: acquired.map(entry => entry.card.id), energy: runtime.energy - beforeEnergy },
      { cards: [gift.id, plain.id, plain.id], energy: 1 });
  });
  it('闪避：真实Combat避开首段固定伤害并消耗闪避', () => {
    const t = Combat.ensureStatus({ hp: 20 }); Combat.addBlessing(t, 'dodge', 1);
    const r = Combat.dealDamage({}, t, 3, 'fixed');
    expect([r.dealt, t.status.dodge]).toEqual([0, 0]);
    record('tt3sp-dodge', '本回合先受到3点固定伤害', { damage: r.dealt, remainingDodge: t.status.dodge }, { damage: 0, remainingDodge: 0 });
  });
  it('惩击：半血增伤先乘基础10，再加法伤2', () => {
    const p = resolverProbe({ spellPower: 2 }); p.resolver(byId('tt7-smite'), p.foe);
    expect(p.events.filter(e => e[0] === 'damage')).toEqual([['damage', 17]]);
    record('tt7-smite', '目标半血，法伤加成2；当前先放大基础值', 17, '若“本次伤害+50%”包含法伤，应为18；待裁定加成顺序');
  });
  it('连续射击：此前0张/2张招式时实际0段/2段', () => {
    const outcomes = [0, 2].map(playedMovesThisTurn => {
      const p = resolverProbe({ playedMovesThisTurn }); p.resolver(byId('cc-rapid-fire'), p.foe);
      return p.events.filter(e => e[0] === 'damage').map(e => e[1]);
    });
    expect(outcomes).toEqual([[], [2, 2]]);
    record('cc-rapid-fire', '本回合此前0张与2张招式', outcomes, '当前是总段数N；卡面首句2点与后句触发N次是否另含基础1段待裁定');
  });
  it('恶魔之力：末敌死亡后的自伤被已有终局规则中止', () => {
    const p = resolverProbe(); p.foe.hp = 1; p.resolver(byId('cc-demon'), p.foe);
    expect(p.events.filter(e => e[0] === 'selfDamage')).toEqual([]);
    record('cc-demon', '击杀最后敌人', 0, '受现行终局守卫裁决影响，作为规则边界记录，不据此报新缺陷');
  });
  it('可见描述已澄清骷髅王剑与斩杀，避免原始简写误报', () => {
    expect(displayCardDescription(byId('tt3-immortal-blade').desc, 'tt3-immortal-blade')).toContain('每张');
    expect(displayCardDescription(byId('tt3-execute').desc, 'tt3-execute')).toContain('不超过 9');
  });
});

afterAll(() => {
  // 默认只断言。显式选择保存时仅写修复轮目录，绝不回写原始审查证据。
  if (process.env.CARD_DESCRIPTION_FIX_EVIDENCE !== '1') return;
  const evidenceDir = path.resolve('docs/evidence/2026-10-19-card-description-fixes');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'battle-observations.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), source: 'tests/card-description-audit-battle.test.js',
    historicalBaseline: 'docs/evidence/2026-10-19-card-description-audit/catalog.json',
    cardSource: '当前Cards.all()完成ensureSha/ensureStarters/ensureTabletop/ensureDmgTypes/ensureEffectFields后的生产对象',
    scope: '修复轮：真实执行器/Combat/发现流程与受控内存BattleSession；已确认差异断言卡面正确结果，其余保留待裁定行为边界。原审查75/75结论不受本轮影响。', observed,
  }, null, 2) + '\n');
});
