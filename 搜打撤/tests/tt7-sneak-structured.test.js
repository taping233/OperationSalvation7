import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/card-rules.schema.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Icons.TYPE_ART = window.SDT.Icons.TYPE_ART || {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession } = await import('../game/src/battle.core.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

let sequence = 0;
let activeGame = null;
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function waitForIdle(timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) {
      await tick();
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
    await tick();
  }
  throw new Error('真实 BattleSession 动作未在时限内收敛');
}
async function startAndPlay(card) {
  expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [] });
  const logs = [];
  const game = {
    ownedCards: [{ uid: `sneak-${sequence++}`, card, safe: false }],
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false, lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); }, logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }, addItem() {}, onBattleEnd() {},
  };
  activeGame = game;
  BattleSession.start(game, [{ id: 'sneak-target', name: '偷袭目标', hp: 100, atk: 1 }], { isBoss: false, name: '偷袭结构化实战' });
  await waitForIdle();
  BattleSession.commands.playCard(game.ownedCards[0].uid, 0);
  return { state: await waitForIdle(), logs };
}
async function finishBattle() {
  if (activeGame?.battleActive) {
    BattleSession.commands.flee();
    await waitForIdle();
  }
  activeGame = null;
}

afterEach(finishBattle);

describe('tt7-sneak structured onPlay', () => {
  it('backfills old snapshots by stable id, canonical damage fields, and preserves desc', () => {
    const ids = ['tt7-thundergrudge', 'tt7-meteorrain', 'tt7-sneak'];
    const previousCards = Cards.all().filter(card => !ids.includes(card.id));
    for (const id of ids) {
      const definition = Cards.TABLETOP10.find(card => card.id === id);
      expect(definition, `missing canonical definition ${id}`).toBeTruthy();
      previousCards.push({ ...definition, dmg: 99, dmgType: 'spell', desc: `${id} 自定义旧描述。`, rules: undefined });
    }
    Cards.saveAll(previousCards);
    Cards.ensureTT7MultiHitRules();

    const migrated = Cards.all().find(card => card.id === 'tt7-sneak');
    expect(migrated.desc).toBe('tt7-sneak 自定义旧描述。');
    expect(migrated).toMatchObject({ dmg: -1, dmgType: 'attack', rules: {
      version: 1,
      battle: { target: { side: 'enemy', area: false } },
      triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] },
    } });
  });

  it('applies the declared -1 attack once regardless of rewritten desc', async () => {
    const card = {
      id: 'tt7-sneak', name: '偷袭', cost: 0, type: '武术', dmg: -1, dmgType: 'attack',
      desc: '描述改写为攻击 99 次并造成 99 点伤害。',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      ] } },
    };
    const { state, logs } = await startAndPlay(card);
    expect(state.foes[0].hp).toBe(96);
    expect(logs.filter(line => line.includes('造成'))).toHaveLength(1);
  });
});
