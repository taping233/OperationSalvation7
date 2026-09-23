/* 龙巢·心（heartsMode）战斗实打：1-7 点 -1 心、8+ 点 -2 心、真实伤害按点数、破甲 1:1。 */
import { describe, it, expect, beforeAll } from 'vitest';
window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } };
await import('../game/src/cards/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle/battle.core.js');
const C = window.SDT.Cards;
beforeAll(() => { C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields(); });
let uidSeq = 0;
function makeGame(cards) {
  const logs = [];
  const g = { ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 99999, maxHp: 99999, atk: 5, spellPower: 2, coins: 0, myClass: '侠客', characterId: null,
    state: 'idle', battleActive: false, lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); }, logs, logs2: logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {} };
  return g;
}
const tick = () => new Promise(r => setTimeout(r, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const snap = () => BattleSession.getSnapshot();
async function drain(maxLoops = 300) {
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
const mk = (id, name, dmg, type, cost) => ({ id, name, cost, rarity: '古朴', type: '武术', dmg, dmgType: type, desc: `造成 ${dmg} 点${type === 'fixed' ? '固定' : type === 'true' ? '真实' : ''}伤害。` });
async function playOwned(g, name, idx = 0) {
  const e = g.ownedCards.find(o => o.card.name === name);
  BattleSession.commands.playCard(e.uid, idx);
  return drain();
}
describe('龙巢·心', () => {
  it('小伤害 -1 心；8+ 点 -2 心；真实伤害按点数', async () => {
    const small = mk('t1', '小击', 2, 'fixed', 0);
    const big = mk('t2', '大击', 10, 'fixed', 0);
    const trueHit = mk('t3', '真伤', 3, 'true', 0);
    const g = makeGame([small, big, trueHit]);
    BattleSession.start(g, [{ id: 'nest-sand', name: '心靶', hearts: 8, hp: 8, maxHp: 8, atk: 1, heartsMode: true }], { isBoss: false, name: '心测试' });
    await drain();
    await playOwned(g, '小击');
    console.log('LOGS:', g.logs.join(' || '));                       // 2 点固定 → -1 心
    expect(snap().foes[0].hp).toBe(7);
    await playOwned(g, '大击');                       // 10 点 ≥ 8 → -2 心
    expect(snap().foes[0].hp).toBe(5);
    await playOwned(g, '真伤');                       // 真实 3 → -3 心
    expect(snap().foes[0].hp).toBe(2);
    BattleSession.commands.flee(); await drain(50);
  });
});
