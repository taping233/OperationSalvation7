import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { Random } from '../game/src/core/random.js';
import { pstat, set$pstat } from '../game/src/battle/battle.runtime.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Icons.TYPE_ART = window.SDT.Icons.TYPE_ART || {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

let uidSequence = 0;
let activeGame = null;
function makeGame(cards) {
  const logs = [];
  const game = {
    ownedCards: cards.map(card => ({ uid: `structured-${uidSequence++}`, card, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
  return game;
}

const foe = (id, hp = 1000, atk = 1) => ({ id, name: `结构化靶子-${id}`, hp, atk });
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

async function startGame(cards, foes) {
  const game = makeGame(cards);
  activeGame = game;
  BattleSession.start(game, foes, { isBoss: false, name: '结构化 onPlay 实战验收' });
  await waitForIdle();
  return game;
}

async function playCard(game, card, target) {
  const entry = game.ownedCards.find(item => item.card.id === card.id);
  expect(entry, `应在真实战斗中找到手牌 ${card.id}`).toBeTruthy();
  expect(validateCardRules(card), `synthetic card ${card.id} must pass schema`).toMatchObject({ ok: true, errors: [] });
  BattleSession.commands.playCard(entry.uid, target);
  return waitForIdle();
}

async function finishBattle() {
  if (activeGame?.battleActive) {
    BattleSession.commands.flee();
    await waitForIdle();
  }
  activeGame = null;
}

afterEach(async () => {
  await finishBattle();
});

const singleDamage = (desc, id = 'structured-single') => ({
  id, name: '结构固定伤害', cost: 0, type: '武术', dmg: 3, dmgType: 'fixed', desc,
  rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
    onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }],
  } },
});
const areaDamage = (desc, id = 'structured-area') => ({
  id, name: '结构群体伤害', cost: 0, type: '武术', dmg: 4, dmgType: 'fixed', desc,
  rules: { version: 1, battle: { target: { side: 'enemy', area: true } }, triggers: {
    onPlay: [{ op: 'damage', amountField: 'dmg', target: 'allEnemies' }],
  } },
});
const armorCard = (desc, id = 'structured-armor') => ({
  id, name: '结构护甲', cost: 0, type: '法术', armor: 5, desc,
  rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: {
    onPlay: [{ op: 'armor', amountField: 'armor' }],
  } },
});
const supportCard = (desc, fields, operations, id) => ({
  id, name: '结构化辅助卡', cost: 0, type: '武术', dmg: 0, desc, ...fields,
  rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: operations } },
});

describe('structured onPlay in real BattleSession', () => {
  it('keeps single-target fixed damage unchanged when desc is rewritten, without text double damage', async () => {
    const outcomes = [];
    for (const [index, desc] of ['造成 97 点固定伤害。', '纯展示文字，改写后不再提及伤害。'].entries()) {
      const card = singleDamage(desc, `structured-single-${index}`);
      const game = await startGame([card], [foe('single')]);
      const state = await playCard(game, card, 0);
      outcomes.push({ hp: state.foes[0].hp, damageLogs: game.logs.filter(line => line.includes('造成')).length });
    }
    expect(outcomes).toEqual([{ hp: 997, damageLogs: 1 }, { hp: 997, damageLogs: 1 }]);
  });

  it('damages every enemy once for allEnemies across desc rewrites', async () => {
    const outcomes = [];
    for (const [index, desc] of ['对全体敌人造成 99 点固定伤害。', '新的展示文案。'].entries()) {
      const card = areaDamage(desc, `structured-area-${index}`);
      const game = await startGame([card], [foe('area-a'), foe('area-b')]);
      const state = await playCard(game, card, 0);
      outcomes.push({ hp: state.foes.map(enemy => enemy.hp), damageLogs: game.logs.filter(line => line.includes('造成')).length });
    }
    expect(outcomes).toEqual([
      { hp: [996, 996], damageLogs: 2 },
      { hp: [996, 996], damageLogs: 2 },
    ]);
  });

  it('retargets each structured segment after a kill without reading desc', async () => {
    const card = {
      ...singleDamage('展示文字写成 99 段也不影响规则。', 'structured-three-hits'),
      dmg: 3,
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
        onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', hitCount: 3, retarget: 'livingFoes' }],
      } },
    };
    const game = await startGame([card], [foe('first', 2), foe('second', 7)]);
    const state = await playCard(game, card, 0);
    expect(state.foes[0].dead).toBe(true);
    expect(state.foes[1].hp).toBe(1);
    expect(game.logs.filter(line => line.includes('造成'))).toHaveLength(3);
  });

  it('uses a negative attack modifier for every structured hit', async () => {
    const card = {
      id: 'structured-negative-attack', name: '负修正多段', cost: 0, type: '武术',
      dmg: -1, dmgType: 'attack', desc: '攻击 50 次。',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
        onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', hitCount: 2, retarget: 'livingFoes' }],
      } },
    };
    const game = await startGame([card], [foe('first', 3), foe('second', 9)]);
    const state = await playCard(game, card, 0);
    expect(state.foes[0].dead).toBe(true);
    expect(state.foes[1].hp).toBe(5);
  });

  it('adds armor exactly once after desc rewrites and ignores old text armor', async () => {
    const outcomes = [];
    for (const [index, desc] of ['获得 91 点护甲。', '纯展示文字，不提护甲。'].entries()) {
      const card = armorCard(desc, `structured-armor-${index}`);
      const game = await startGame([card], [foe('armor')]);
      const state = await playCard(game, card, 'self');
      outcomes.push({ armor: state.pdef.armor, armorLogs: game.logs.filter(line => line.includes('获得') && line.includes('护甲')).length });
    }
    expect(outcomes).toEqual([{ armor: 5, armorLogs: 1 }, { armor: 5, armorLogs: 1 }]);
  });

  it('keeps damage under silence and suppresses armor in a live battle', async () => {
    const damage = singleDamage('展示文字：造成 99 点固定伤害。', 'silenced-structured-damage');
    const armor = armorCard('展示文字：获得 99 点护甲。', 'silenced-structured-armor');
    const game = await startGame([damage, armor], [foe('silenced', 1000, 1)]);

    // Set the real combat runtime status fixture directly so this test can hit
    // the live silence gate without waiting for a random enemy curse to expire.
    set$pstat({ ...pstat, status: { ...pstat.status, silence: 1 } });
    const afterDamage = await playCard(game, damage, 0);
    expect(afterDamage.foes[0].hp).toBe(997);

    const afterArmor = await playCard(game, armor, 'self');
    expect(afterArmor.pdef.armor).toBe(0);
    expect(game.logs.some(line => line.includes('技能效果被沉默封印'))).toBe(true);
    expect(game.logs.some(line => line.includes('造成 99 点固定伤害') || line.includes('获得 99 点护甲'))).toBe(false);
  });

  it('resolves heal then armor once, regardless of rewritten desc', async () => {
    const outcomes = [];
    for (const [index, desc] of ['回复 99 点生命并获得 99 点护甲。', '改写后的展示文本。'].entries()) {
      const card = supportCard(desc, { heal: 3, armor: 3 }, [
        { op: 'heal', amountField: 'heal' }, { op: 'armor', amountField: 'armor' },
      ], `structured-bandage-${index}`);
      const game = await startGame([card], [foe(`bandage-${index}`)]);
      game.hp = 90;
      await playCard(game, card, 'self');
      const state = BattleSession.getSnapshot();
      outcomes.push({ hp: game.hp, armor: state.pdef.armor, healLogs: game.logs.filter(line => line.includes('回复 99')).length });
    }
    expect(outcomes).toEqual([
      { hp: 93, armor: 3, healLogs: 0 }, { hp: 93, armor: 3, healLogs: 0 },
    ]);
  });

  it('resolves armor then ordinary draw in order with one structural effect log each', async () => {
    const card = supportCard('获得 99 点护甲并抽 99 张牌。', { armor: 5, draw: 1 }, [
      { op: 'armor', amountField: 'armor' }, { op: 'draw', amountField: 'draw' },
    ], 'structured-hold-fast');
    const game = await startGame([card], [foe('hold-fast')]);
    await playCard(game, card, 'self');
    const state = BattleSession.getSnapshot();
    expect(state.pdef.armor).toBe(5);
    expect(game.logs.filter(line => line.includes('获得') && line.includes('护甲'))).toHaveLength(1);
    expect(game.logs.filter(line => line.includes('获得 1 张【初始攻击】'))).toHaveLength(1);
    expect(game.logs.some(line => line.includes('99 点护甲') || line.includes('99 张牌'))).toBe(false);
  });
});
