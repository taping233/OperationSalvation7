// U18 负血+即时死亡判定验收（2026-09-30 老板拍板 PENDING #15，对齐 STS2 IsAlive=hp>0）。
// 新语义：玩家受伤不再钳 0（数据层负血保留真实值）；伤害致 hp<=0 即时 finish(false)
//（自己回合自伤致死同样触发，死了即死无治疗复活）；免死钩 deathSave 一次致死拦一次（逻辑照旧）；
// 敌方回合既有 finish(false) 路径回归锚；展示层钳 0、快照数据层保留真实值。
// 修复单：docs/evidence/2026-09-29-nightshift/fix-U18-0500.md
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { pstat, set$pstat, set$deathSave, deathSave } from '../game/src/battle/runtime/battle.runtime.js';

window.SDT = window.SDT || {};
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Icons.TYPE_ART = window.SDT.Icons.TYPE_ART || {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
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
const foe = (id, hp = 1000, atk = 1) => ({ id, name: `U18靶子-${id}`, hp, maxHp: hp, atk });
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
  throw new Error('U18 BattleSession 动作未在时限内收敛');
}

async function startGame(cards, foesArg, hp = 100) {
  const game = {
    ownedCards: cards.map(card => ({ uid: `u18-${uidSequence++}`, card, safe: false })),
    hp, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false, lastBattleEnd: null,
    log(message) { this.logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs: [],
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {},
    // 战败/胜利收尾观测点（无总线订阅方时 lifecycle 回退调用 G.onBattleEnd）
    onBattleEnd(opts, played, win) { this.ended = { win }; },
    ended: null,
  };
  activeGame = game;
  BattleSession.start(game, foesArg, { isBoss: false, name: 'U18 负血即死验收' });
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

const R = (battle, onPlay) => ({ rules: { version: 1, battle, triggers: { onPlay } } });
const SELF = { target: { side: 'self', area: false } };
const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const filler = (id = 'u18-filler') => ({ id, name: '陪衬牌', cost: 0, type: '法术', desc: '' });
const selfHurt = (n, id) => ({ id, name: 'U18自伤牌', cost: 0, type: '法术', desc: `损失 ${n} 点生命。`,
  ...R(SELF, [{ op: 'heal', selfDamage: n }]) });

afterEach(async () => {
  if (activeGame?.battleActive) {
    BattleSession.commands.flee();
    await waitForIdle();
  }
  activeGame = null;
  set$pstat({ ...pstat, status: {} });
  set$deathSave(0);
});

describe('U18 负血+即时死亡判定（PENDING #15 老板拍板，对齐 STS2）', () => {
  it('① 自己回合自伤致 hp<0：即时 finish(false) 战败，负血保留真实值（死了即死）', async () => {
    const card = selfHurt(999, 'u18-selfkill');
    const game = await startGame([card, filler()], [foe('u18a')]);
    expect(game.battleActive).toBe(true);
    await playCard(game, card, 'self');
    // 即时死亡：数据层 hp=-899（不再钳 0），战斗已走战败收尾
    expect(game.hp).toBe(100 - 999);
    expect(game.battleActive).toBe(false);
    expect(game.ended).toMatchObject({ win: false });
  });

  it('①b 恰好打到 0 血同样即死：旧「0 血可被同回合治疗拉回」窗口不复存在', async () => {
    const card = selfHurt(100, 'u18-exactzero');
    const game = await startGame([card, filler()], [foe('u18a2')]);
    await playCard(game, card, 'self');
    expect(game.hp).toBe(0);
    expect(game.battleActive).toBe(false);
    expect(game.ended).toMatchObject({ win: false });
  });

  it('② 免死钩照旧：致死自伤被拦一次（deathSave 递减、hp 不动、战斗继续）', async () => {
    const card = selfHurt(999, 'u18-deathsave');
    const game = await startGame([card, filler()], [foe('u18b')]);
    set$deathSave(1);
    await playCard(game, card, 'self');
    // 黑暗吊坠语义逐字保留：致死伤被完整挡下，血量原值不动，保险 -1，战斗未结束
    expect(game.hp).toBe(100);
    expect(deathSave).toBe(0);
    expect(game.battleActive).toBe(true);
    expect(game.ended).toBeNull();
    expect(game.logs.some(line => line.includes('致命一击被挡下'))).toBe(true);
  });

  it('③ 敌方回合致死路径回归锚：敌方攻击致 hp<0 → 既有 hp<=0 检查收口 finish(false)', async () => {
    const game = await startGame([filler()], [foe('u18c', 1000, 50)], 10);
    BattleSession.commands.endTurn();
    await waitForIdle();
    // 敌方回合既有死亡检查在负血下照常触发（路径保留不动），数据层不再钳 0
    expect(game.battleActive).toBe(false);
    expect(game.ended).toMatchObject({ win: false });
    expect(game.hp).toBe(10 - 50);
  });

  it('④ 快照/展示分离：快照 player.hp 保留真实负值，HUD 展示口径 max(0,hp)=0、日志不外显负血', async () => {
    const card = selfHurt(999, 'u18-display');
    const game = await startGame([card, filler()], [foe('u18d')]);
    await playCard(game, card, 'self');
    const snap = BattleSession.getSnapshot();
    expect(snap.player.hp).toBeLessThan(0);            // 快照数据层：真实值保留
    expect(Math.max(0, snap.player.hp)).toBe(0);       // battle.layers.js setUnitHP:514 展示口径（照抄表达式）
    expect(snap.player.hp / snap.player.maxHp * 100).toBeLessThan(0);   // 原始比值可为负……
    expect(Math.max(0, snap.player.hp / snap.player.maxHp * 100)).toBe(0);  // ……血条百分比口径钳 0
    // 日志外显钳 0：受击行显示（0/100），不出现 -899
    expect(game.logs.some(line => line.includes('（0/100）'))).toBe(true);
    expect(game.logs.join()).not.toContain('-899/100');
  });
});
