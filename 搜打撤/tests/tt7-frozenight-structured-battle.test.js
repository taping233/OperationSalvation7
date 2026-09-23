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
function makeCard(desc, duration = 1) {
  return {
    id: 'tt7-frozenight', name: '冰封千里', cost: 0, rarity: '职业', type: '法术', cls: '法师',
    desc, dmg: 0, value: 3, unrandom: true,
    rules: { version: 1, battle: { target: { side: null, area: true } }, triggers: { onPlay: [
      { op: 'status', status: 'freeze', target: 'allEnemies', duration },
    ] } },
  };
}
const foe = (id, options = {}) => ({ id, name: id, hp: 1000, atk: 1, ...options });
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
async function startAndPlay(desc, foes, beforePlay = () => {}) {
  const card = makeCard(desc);
  expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [] });
  const logs = [];
  const game = {
    ownedCards: [{ uid: `frozenight-${sequence++}`, card, safe: false }],
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '法师', characterId: null, state: 'idle', battleActive: false, lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); }, logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }, addItem() {}, onBattleEnd() {},
  };
  activeGame = game;
  BattleSession.start(game, foes, { isBoss: false, name: '冰封千里结构化实战' });
  await waitForIdle();
  beforePlay();
  BattleSession.commands.playCard(game.ownedCards[0].uid, null);
  const state = await waitForIdle();
  return { state, logs };
}
async function finishBattle() {
  if (activeGame?.battleActive) {
    BattleSession.commands.flee();
    await waitForIdle();
  }
  activeGame = null;
}

afterEach(finishBattle);

describe('tt7-frozenight structured onPlay in real BattleSession', () => {
  it('backfills the frozenight rule onto the legacy card found in Cards.all()', () => {
    const before = Cards.all();
    const legacy = before.find(card => card.id === 'tt7-frozenight');
    expect(legacy, '真实卡库应包含 tt7-frozenight').toBeTruthy();
    const legacySnapshot = { ...legacy, desc: '旧档自定义描述。' };
    delete legacySnapshot.rules;
    Cards.saveAll(before.map(card => card.id === 'tt7-frozenight' ? legacySnapshot : card));

    Cards.ensureTT7StatusRules();

    const migrated = Cards.all().find(card => card.id === 'tt7-frozenight');
    expect(migrated.desc).toBe('旧档自定义描述。');
    expect(migrated.rules).toEqual({ version: 1, battle: { target: { side: null, area: true } }, triggers: {
      onPlay: [{ op: 'status', status: 'freeze', target: 'allEnemies', duration: 1 }],
    } });
    expect(validateCardRules(migrated)).toMatchObject({ ok: true, errors: [] });
  });

  it('freezes each living enemy once for the declared duration, independent of desc', async () => {
    const runtime = await import('../game/src/battle.runtime.js');
    const results = [];
    for (const desc of ['冰冻所有敌人，持续 1 回合。', '改写后的展示文案。']) {
      const { state, logs } = await startAndPlay(desc, [foe('正常敌人'), foe('免疫目标'), foe('已死亡')], () => {
        // 战斗入场会重建敌人实例；免疫/死亡要布置在真实实例上。
        runtime.foes[1].noCurseKeys = ['freeze'];
        runtime.foes[2].hp = 0;
        runtime.foes[2].dead = true;
      });
      results.push({
        freezes: state.foes.map(enemy => enemy.status.freeze || 0),
        freezeLogs: logs.filter(line => line.includes('被冰冻') || line.includes('全体敌人被冰冻')).length,
      });
      await finishBattle();
    }
    expect(results).toEqual([
      { freezes: [1, 0, 0], freezeLogs: 1 },
      { freezes: [1, 0, 0], freezeLogs: 1 },
    ]);
  });

  it('does not freeze enemies while the player is silenced', async () => {
    const runtime = await import('../game/src/battle.runtime.js');
    const second = await startAndPlay('描述含有冰冻所有敌人，持续 1 回合。', [foe('沉默时的敌人')], () => {
      runtime.set$pstat({ ...runtime.pstat, status: { ...runtime.pstat.status, silence: 1 } });
    });
    expect(second.state.foes[0].status.freeze || 0).toBe(0);
    expect(second.logs.some(line => line.includes('技能效果被沉默封印'))).toBe(true);
    runtime.set$pstat({ ...runtime.pstat, status: { ...runtime.pstat.status, silence: 0 } });
  });
});
