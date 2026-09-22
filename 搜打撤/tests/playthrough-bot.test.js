/* 实机游玩（确定性指挥）：三局对局全部通过真实 BattleSession 逐张打出。
 * 断言底线：无崩溃 / 无 NaN / 战斗正常收尾；胜负都算有效对局。 */
import { describe, it, expect, beforeAll } from 'vitest';
window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = { rules: { battleEnergy: 3, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } };
import fs from 'node:fs';
await import('../game/src/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle.core.js');
const MAPDATA = JSON.parse(fs.readFileSync('game/data/map.json', 'utf8'));
const C = window.SDT.Cards;
beforeAll(() => { C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields(); });
let uidSeq = 0;
function makeGame(cards, cls, hp) {
  const logs = [];
  const g = { ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: { ...c }, safe: false })),
    hp: hp || 60, maxHp: hp || 60, atk: 5, spellPower: 2, coins: 12, myClass: cls || '侠客', characterId: null,
    state: 'idle', battleActive: false, lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); }, logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {},
    onBattleEnd(opts, played, win) { this.battleActive = false; this.lastBattleEnd = { win: !!win }; } };
  return g;
}
const tick = () => new Promise(r => setTimeout(r, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const snap = () => BattleSession.getSnapshot();
async function drain(maxLoops = 500) {
  for (let i = 0; i < maxLoops; i++) { await tick(); const s = snap();
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    } }
  return snap();
}
const cardName = u => { const o = viewApi.findCard(u); return o && o.card.name; };
function expectFinite(s, tag) {
  expect(Number.isFinite(s.pstat.hp), tag + ' 玩家HP').toBe(true);
  s.foes.forEach(f => expect(Number.isFinite(f.hp), tag + ' ' + f.name + ' HP').toBe(true));
}
// 一场战斗：plays = 依次尝试打出的卡名（不在手牌就跳过）；余下回合结束
async function battle(g, foes, opts, plays, tag, maxTurns = 25) {
  const anomalies = [];
  BattleSession.start(g, foes, opts);
  await drain();
  if (snap().deckSelection) {
    while (snap().deckSelection && snap().deckSelection.selected.length < Math.min(snap().deckSelection.need, snap().deckSelection.cards.length)) {
      const next = snap().deckSelection.cards.find(c => !snap().deckSelection.selected.includes(c.uid));
      if (!next) break;
      BattleSession.commands.selectDeckCard(next.uid);
    }
    BattleSession.commands.confirmDeck();
    await drain();
  }
  expectFinite(snap(), tag + ' 开局');
  for (let turn = 0; turn < maxTurns; turn++) {
    if (g.lastBattleEnd) break;
    const name = plays[turn % plays.length];
    const uid = findInHandF(name);
    if (uid) {
      BattleSession.commands.playCard(uid, 0);
      await drain();
      if (g.lastBattleEnd) break;
    } else {
      BattleSession.commands.endTurn();
      await drain();
    }
    expectFinite(snap(), tag + ' 回合' + turn);
    if (snap().busy && turn === maxTurns - 1) anomalies.push('卡死');
  }
  await drain(100);
  if (snap().busy) anomalies.push('终局卡死');
  return anomalies;
}
function findInHandF(name) { return snap().hand.find(u => cardName(u) === name) || null; }

describe('实机游玩机器人（3 局）', () => {
  it('第一局：一图推进（L1 联邦遭遇 → 变异巢母首脑）', { timeout: 120_000 }, async () => {
    const deck = ['闪电链', '火球', '闪电链', '火球', '闪电链', '火球', '闪电链', '火球', '闪电链', '火球', '闪电链', '火球', '闪电链', '火球']
      .map(n => C.all().find(c => c.name === n)).filter(Boolean);
    const g = makeGame(deck, '侠客', 80);
    const entry = MAPDATA.encounters[0].entries[0];
    const n = entry.size[0];
    const foes = Array.from({ length: n }, () => ({ ...MAPDATA.monsters[entry.id], maxHp: MAPDATA.monsters[entry.id].hp }));
    BattleSession.start(g, foes, { isBoss: false, name: 'L1 遭遇战' });
    await drain();
    for (let t = 0; t < 25 && !g.lastBattleEnd; t++) {
      const uid = g.ownedCards.find(o => snap().hand.includes(o.uid) && (o.card.name === '闪电链' || o.card.name === '火球'));
      if (uid) { BattleSession.commands.playCard(uid.uid, 0); await drain(); }
      else { BattleSession.commands.endTurn(); await drain(); }
      expect(Number.isFinite(snap().pstat.hp)).toBe(true);
    }
    BattleSession.commands.flee(); await drain(50);
    // 首脑战
    const b = MAPDATA.altar.bosses[0];
    BattleSession.start(g, [{ ...b, maxHp: b.hp }], { isBoss: true, name: '肃清总督' });
    await drain();
    for (let t = 0; t < 25 && !g.lastBattleEnd; t++) {
      const uid = g.ownedCards.find(o => snap().hand.includes(o.uid) && (o.card.name === '闪电链' || o.card.name === '火球'));
      if (uid) { BattleSession.commands.playCard(uid.uid, 0); await drain(); }
      else { BattleSession.commands.endTurn(); await drain(); }
      expect(Number.isFinite(snap().pstat.hp)).toBe(true);
    }
    BattleSession.commands.flee(); await drain(50);
  });

  it('第二局：恶龙（只有偶数回合攻击）', { timeout: 120_000 }, async () => {
    const g = makeGame([C.all().find(c => c.id === 'tt3-fireball'), C.all().find(c => c.id === 'tt3-fireball'), C.all().find(c => c.id === 'tt3-fireball')].filter(Boolean), '降临者', 120);
    BattleSession.start(g, [{ id: 'nest-evil', name: '恶龙', hp: 60, maxHp: 60, atk: 18, evenAttack: true }], { isBoss: false, name: '恶龙战' });
    await drain();
    for (let t = 0; t < 20 && !g.lastBattleEnd; t++) {
      const uid = snap().hand.find(u => { const o = viewApi.findCard(u); return o && o.card.id === 'tt3-fireball'; });
      if (uid) { BattleSession.commands.playCard(uid, 0); await drain(); }
      else { BattleSession.commands.endTurn(); await drain(); }
      expect(Number.isFinite(snap().pstat.hp)).toBe(true);
    }
    BattleSession.commands.flee(); await drain(50);
  });

  it('第三局：龙巢完全形态（庇护/复活/借过规则）', { timeout: 120_000 }, async () => {
    const lord = { id: 'nest-elem-lord', name: '完全形态·元素领主', hearts: 4, hp: 4, maxHp: 4, atk: 0, heartsMode: true, revive: { hearts: 8, atk: 8 }, protected: false };
    const kill = n => ({ name: '终结' + n, id: 'fin' + n, cost: 0, rarity: '古朴', type: '武术', dmg: 20, dmgType: 'fixed', desc: '造成 20 点固定伤害。' });
    const g = makeGame([kill(1), kill(2), kill(3)], '侠客', 200);
    BattleSession.start(g, [lord], { isBoss: false, name: '复活测试' });
    await drain();
    expect(snap().foes[0].hp).toBe(4);
    BattleSession.commands.playCard(g.ownedCards[0].uid, 0); await drain();   // 第一击：-2 心（4→2）
    expect(snap().foes[0].dead).toBe(false);
    BattleSession.commands.playCard(g.ownedCards[1].uid, 0); await drain();   // 第二击：-2 心（2→0）→ 复活 8 心
    expect(snap().foes[0].dead).toBe(false);
    expect(snap().foes[0].hp).toBe(8);
    expect(snap().foes[0].revived).toBe(true);
    BattleSession.commands.playCard(g.ownedCards[2].uid, 0); await drain();   // 第三击：复活体再 -2 心（8→6），不再复活
    expect(snap().foes[0].hp).toBe(6);
    expect(snap().foes[0].revived).toBe(true);
    expect(snap().foes[0].dead).toBe(false);
    BattleSession.commands.flee(); await drain(50);
  });
});
