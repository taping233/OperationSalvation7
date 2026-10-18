import { describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 2, battleHandMax: 8, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');

const starter = window.SDT.Cards.all().find(card => card.id === 'starter-attack') || {
  id: 'starter-attack', name: '初始攻击', cost: 1, type: '武术', desc: '造成攻击伤害。', dmg: 0, dmgType: 'attack',
};

function makeGame() {
  return {
    ownedCards: [{ uid: 'starter-1', card: { ...starter }, safe: false }],
    inventory: [{ id: 'ration', count: 1 }], cardOrder: ['starter-1'], usedPocket: [], eventLog: [],
    hp: 30, maxHp: 30, atk: 5, spellPower: 0, coins: 8, turn: 1,
    myClass: '战士', characterId: 'heixiang', state: 'idle', battleActive: false,
    log(message) { this.eventLog.push(String(message)); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    onBattleEnd() {},
  };
}

describe('战斗读档从入场检查点重开', () => {
  it('restores run state and rebuilds turn one instead of resuming a partial battle', () => {
    const game = makeGame();
    BattleSession.start(game, [{ id: 'infantry', name: '检查点靶子', hp: 12, atk: 4, behavior: 'strike' }], { isBoss: false, name: '检查点测试' });
    const checkpoint = BattleSession.serialize();
    expect(checkpoint).toMatchObject({ restartVersion: 1, selectedDeck: null });

    game.hp = 7;
    game.coins = 999;
    game.ownedCards[0].safe = true;
    expect(BattleSession.restore(game, checkpoint)).toBe(true);

    const state = BattleSession.getSnapshot();
    expect(game.hp).toBe(30);
    expect(game.coins).toBe(8);
    expect(game.ownedCards[0].safe).toBe(false);
    expect(state.turn).toBe(1);
    expect(state.energy).toBe(2);
    expect(state.foes[0]).toMatchObject({ hp: 12, maxHp: 12, dead: false });
    expect(game.eventLog.join('\n')).toContain('已从本场战斗开始处重新进入');
    BattleSession.commands.flee();
  });
});

it('当前检查点JSON往返保留庇护关系与真实伤害门', async () => {
  const game=makeGame();
  const defs=[{id:'lord',name:'受护者',hp:20,atk:2,protected:true},{id:'guard',name:'护卫',hp:10,atk:2,protects:true}];
  BattleSession.start(game,defs,{isBoss:false});
  const saved=JSON.parse(JSON.stringify(BattleSession.serialize()));
  expect(saved.enemyDefs).toMatchObject([{protected:true},{protects:true}]);
  expect(BattleSession.restore(game,saved)).toBe(true);
  const R=await import('../game/src/battle/runtime/battle.runtime.js');
  const {hitFoe}=await import('../game/src/battle/core/battle.engine.js');
  expect(R.foes).toMatchObject([{protected:true},{protects:true}]);
  expect(hitFoe(R.foes[0],starter,5,'fixed')).toBe(0);expect(R.foes[0].hp).toBe(20);
  BattleSession.commands.flee();
});

it('旧版无检查点存档保留庇护关系，升级检查点后仍保留', async () => {
  const game=makeGame();
  const saved={opts:{isBoss:false},mode:'normal',turn:2,maxEnergy:2,energy:2,
    hand:['starter-1'],drawPile:[],discard:[],grave:[],played:[],consumed:[],granted:[],
    pdef:{},pstat:{status:{}},foes:[{id:'lord',name:'受护者',hp:20,maxHp:20,atk:2,protected:true,status:{}},{id:'guard',name:'护卫',hp:10,maxHp:10,atk:2,protects:true,status:{}}]};
  expect(BattleSession.restore(game,JSON.parse(JSON.stringify(saved)))).toBe(true);
  const R=await import('../game/src/battle/runtime/battle.runtime.js');
  const {hitFoe}=await import('../game/src/battle/core/battle.engine.js');
  expect(R.foes).toMatchObject([{protected:true},{protects:true}]);
  expect(hitFoe(R.foes[0],starter,5,'fixed')).toBe(0);expect(R.foes[0].hp).toBe(20);
  const upgraded=BattleSession.serialize();expect(upgraded.restartVersion).toBe(1);
  expect(upgraded.enemyDefs).toMatchObject([{protected:true},{protects:true}]);
  BattleSession.commands.flee();
});

it('persists the new encounter checkpoint before any player command without overwriting it with null', () => {
  const game = makeGame();
  let disk = { trackPos: 9, battle: null };
  game.trackPos = 10;
  game.persistSave = vi.fn(() => {
    expect(game.battleActive).toBe(true);
    expect(game.state).toBe('modal');
    const battle = BattleSession.serialize();
    expect(battle).toMatchObject({ restartVersion: 1, enemyDefs: [{ id: 'entry-persist' }], opts: { isBoss: false }, run: { hp: 30, coins: 8 } });
    expect(battle.rngState).toBeTruthy();
    expect(battle.run.ownedCards).toEqual(game.ownedCards);
    disk = JSON.parse(JSON.stringify({ trackPos: game.trackPos, battle }));
    return true;
  });
  BattleSession.start(game, [{ id: 'entry-persist', name: '入场保存靶', hp: 7, atk: 4 }], { isBoss: false });
  expect(game.persistSave).toHaveBeenCalledOnce();
  expect(disk.trackPos).toBe(10);
  expect(disk.battle.run.hp).toBe(30);
  game.hp = 1;
  game.persistSave.mockClear();
  expect(BattleSession.restore(game, disk.battle)).toBe(true);
  expect(game.hp).toBe(30);
  // loadGame owns its post-restore write; start must not save partial restore state.
  expect(game.persistSave).not.toHaveBeenCalled();
  BattleSession.commands.flee();
});

it('reports failed entry persistence without blocking battle initialization', () => {
  const game = makeGame();
  game.persistSave = vi.fn(() => false);
  BattleSession.start(game, [{ id: 'entry-write-failed', name: '写失败靶', hp: 7, atk: 4 }], { isBoss: false });
  expect(game.persistSave).toHaveBeenCalledOnce();
  expect(game.battleActive).toBe(true);
  expect(BattleSession.serialize()).toMatchObject({ restartVersion: 1 });
  expect(game.eventLog.join('')).toContain('本场入场检查点未保存');
  BattleSession.commands.flee();
});

it('a thrown entry save does not block battle initialization or claim success', () => {
  const game = makeGame();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  game.persistSave = vi.fn(() => { throw new Error('entry-save-probe'); });
  try {
    expect(() => BattleSession.start(game, [{ id: 'throw-save', name: '异常保存靶', hp: 7, atk: 4 }], { isBoss: false })).not.toThrow();
    expect(game.battleActive).toBe(true);
    expect(BattleSession.getSnapshot().phase).toBe('player');
    expect(game.eventLog.join('')).toContain('本场入场检查点未保存');
    expect(warn).toHaveBeenCalledOnce();
    BattleSession.commands.flee();
  } finally { warn.mockRestore(); }
});
