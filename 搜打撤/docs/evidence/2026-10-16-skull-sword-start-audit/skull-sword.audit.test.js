import { describe, it, expect, afterEach } from 'vitest';

// This harness has fresh jsdom localStorage and synthetic in-memory game data only.
window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 10, battleHandMax: 99, bossDeckSize: 2,
    starterSha: 4, battleStartDraw: 99, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
await import('../../../game/src/cards/cards.js');
const { BattleSession } = await import('../../../game/src/battle/core/battle.core.js');
const engine = await import('../../../game/src/battle/core/battle.engine.js');
const runtime = await import('../../../game/src/battle/runtime/battle.runtime.js');
const { displayCardDescription } = await import('../../../game/src/cards/card-description-text.js');
const C = window.SDT.Cards;
for (const name of ['ensureSha', 'ensureStarters', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields']) C[name]();

let game;
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
async function idle() {
  for (let i = 0; i < 300; i++) {
    await tick();
    const s = BattleSession.getSnapshot();
    if (!s.busy && !s.actionQueueLength) return s;
  }
  throw new Error('BattleSession did not become idle');
}
function canonical(id) {
  const card = C.all().find(card => card.id === id);
  if (!card) throw new Error(`Canonical card missing: ${id}`);
  return structuredClone(card);
}
function fixture(extraIds = []) {
  game = {
    ownedCards: ['tt3-immortal-blade', 'starter-attack', 'starter-attack', 'starter-attack', 'starter-attack', 'tt3-reshot', 'tt3-reshot', ...extraIds]
      .map((id, i) => ({ uid: `audit-${i}`, card: canonical(id), safe: false })),
    inventory: [], usedPocket: [], hp: 100, maxHp: 100, atk: 4, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    logs: [], log(message) { this.logs.push(String(message)); }, heal() {}, addItem() {}, onBattleEnd() {},
  };
  return game;
}
function begin(options, extraIds = []) {
  BattleSession.start(fixture(extraIds), [{ id: 'audit-target', name: '独立验证靶', hp: 1000, atk: 0 }],
    { name: '骷髅王剑非存档审查', ...options });
}
function view() {
  const s = BattleSession.getSnapshot();
  return { mode: s.mode, shaTransform: runtime.shaTransform,
    equipped: s.equipped.map(x => x.card.name),
    hand: s.hand.map(uid => ({ uid, name: engine.findCard(uid)?.card.name })),
    logs: game.logs.filter(x => /开战被动|战斗规则/.test(x)) };
}
afterEach(async () => {
  if (game?.battleActive) { BattleSession.commands.cancelInfusion(); BattleSession.commands.flee(); await idle(); }
  game = null;
});

describe('骷髅王剑真实 BattleSession 只读审查', () => {
  it('普通战持有1剑+4初始攻击：开战装备不入手且没有变形规则', async () => {
    begin({ isBoss: false });
    await idle();
    const actual = view();
    console.log('AUDIT_NORMAL', JSON.stringify(actual));
    expect(actual.mode).toBe('normal');
    expect(actual.shaTransform).toBeNull();
    expect(actual.equipped).toEqual([]);
    expect(actual.hand.filter(x => x.name === '初始攻击')).toHaveLength(4);
    expect(actual.hand.some(x => x.name === '骷髅王剑')).toBe(false);
    const hpBefore = runtime.foes[0].hp;
    BattleSession.commands.playCard('audit-1', 0);
    await idle();
    expect(runtime.foes[0].hp).toBe(hpBefore - 4);
    expect(BattleSession.getSnapshot().hand).not.toContain('audit-1');
  });

  it('BOSS编入剑：规则登记，但开手仍显示初始攻击；打出实际为不朽斩并回手', async () => {
    begin({ isBoss: true });
    BattleSession.commands.selectDeckCard('audit-0');
    BattleSession.commands.selectDeckCard('audit-5');
    BattleSession.commands.confirmDeck();
    await idle();
    const actual = view();
    console.log('AUDIT_BOSS_SELECTED', JSON.stringify(actual));
    expect(actual.shaTransform).toBe('不朽斩');
    expect(actual.equipped).toContain('骷髅王剑');
    expect(actual.hand.filter(x => x.name === '初始攻击')).toHaveLength(4);
    expect(actual.hand.filter(x => x.name === '不朽斩')).toHaveLength(0);
    const hpBefore = runtime.foes[0].hp;
    BattleSession.commands.playCard('audit-1', 0);
    await idle();
    expect(runtime.foes[0].hp).toBe(hpBefore - 5);
    expect(BattleSession.getSnapshot().hand).toContain('audit-1');
    expect(engine.findCard('audit-1').card.name).toBe('初始攻击');
    BattleSession.commands.playCard('audit-1', 0);
    await idle();
    expect(runtime.foes[0].hp).toBe(hpBefore - 10);
    expect(BattleSession.getSnapshot().hand).toContain('audit-1');
    console.log('AUDIT_BOSS_PLAY', JSON.stringify({ hpBefore, hpAfter: runtime.foes[0].hp,
      repeatedUidRetained: true, shownCard: engine.findCard('audit-1').card.name }));
  });

  it('BOSS只持有未编入：不自动装配也不登记变形', async () => {
    begin({ isBoss: true });
    // Session remembers lastDeckSel; explicitly clear the visible selection first.
    for (const uid of [...BattleSession.getSnapshot().deckSelection.selected]) BattleSession.commands.selectDeckCard(uid);
    BattleSession.commands.selectDeckCard('audit-5');
    BattleSession.commands.selectDeckCard('audit-6');
    BattleSession.commands.confirmDeck();
    await idle();
    const actual = view();
    console.log('AUDIT_BOSS_NOT_SELECTED', JSON.stringify(actual));
    expect(actual.shaTransform).toBeNull();
    expect(actual.equipped).not.toContain('骷髅王剑');
  });


  it('BOSS变形规则已生效的初始攻击仍能被选作注能材料，违背不朽斩禁注能效果', async () => {
    begin({ isBoss: true }, ['tt3sp-silverthorn']);
    for (const uid of [...BattleSession.getSnapshot().deckSelection.selected]) BattleSession.commands.selectDeckCard(uid);
    BattleSession.commands.selectDeckCard('audit-0');
    BattleSession.commands.selectDeckCard('audit-7');
    BattleSession.commands.confirmDeck();
    await idle();
    expect(runtime.shaTransform).toBe('不朽斩');
    expect(engine.findCard('audit-7').card.infuse).toBe(1);
    BattleSession.commands.beginInfusion('audit-7');
    BattleSession.commands.selectInfusion('audit-1');
    console.log('AUDIT_NO_INFUSE_GAP', JSON.stringify({ shaTransform: runtime.shaTransform,
      source: engine.findCard('audit-7').card.name, selectedFuel: [...runtime.infusing.picked],
      effectiveToken: canonical('cmtn233trmeg').desc,
      originalCardUnchanged: game.ownedCards.find(x => x.uid === 'audit-1').card.name }));
    expect(runtime.infusing.picked.has('audit-1')).toBe(true);
  });

  it('地图首脑自动编入：剑进入自动选牌容量内即生效，卡面未说明BOSS限制', async () => {
    runtime.set$lastDeckSel([]); // New-run automatic formation, with no previous deck to carry over.
    begin({ isBoss: true, directBossStart: true });
    await idle();
    expect(runtime.shaTransform).toBe('不朽斩');
    const sword = canonical('tt3-immortal-blade');
    console.log('AUDIT_DIRECT_BOSS_AND_FACE', JSON.stringify({ ...view(),
      storedDescription: sword.desc, displayDescription: displayCardDescription(sword.desc, sword.id) }));
    expect(displayCardDescription(sword.desc, sword.id)).not.toMatch(/BOSS|首脑/);
    expect(displayCardDescription(sword.desc, sword.id)).toContain('每张');
  });
});
