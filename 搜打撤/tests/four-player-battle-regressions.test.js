import { describe, expect, it } from 'vitest';
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 7, battleHandMax:99, bossDeckSize:1, starterSha:0, battleStartDraw:5, battleTurnDraw:1 }, items: { rations:{ name:'口粮' }, wood:{ name:'木材' } } } };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { set$extraTurn, applyRuneFlag } = await import('../game/src/battle/runtime/battle.runtime.effects.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const guard = Cards.all().find(c => c.id === 'tt2-block');
function start() {
  const game = { ownedCards:[{ uid:'guard', card:guard }], inventory:[], usedPocket:[], cardOrder:['guard'], hp:50, maxHp:50, atk:5, spellPower:0, coins:0,
    myClass:'战士', state:'idle', battleActive:false, log() {}, heal() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id:'target', name:'靶子', hp:100, atk:8 }], { isBoss:false, name:'回合到期验证' });
  return game;
}
async function drain() {
  for (let n = 0; n < 200; n++) {
    await new Promise(r => setTimeout(r, 0));
    const s = BattleSession.getSnapshot();
    if (!s.busy && s.actionQueueLength === 0) {
      await new Promise(r => setTimeout(r, 30));
      const next = BattleSession.getSnapshot();
      if (!next.busy && next.actionQueueLength === 0) return next;
    }
  }
  throw new Error('回合未完成');
}
describe('四线试玩 G11 格挡到期', () => {
  it('施放回合减伤到1，下一回合未格挡按8点正常受击', async () => {
    const g = start();
    BattleSession.commands.playCard('guard', 'self'); await drain();
    expect(BattleSession.getSnapshot().pdef.guard).toBe(true);
    BattleSession.commands.endTurn(); const s = await drain();
    expect(g.hp).toBe(49); expect(s.pdef.guard).toBe(false); expect(s.turn).toBe(2);
    BattleSession.commands.endTurn(); await drain(); expect(g.hp).toBe(41);
  });
  it('额外回合开始时格挡到期', async () => {
    const g = start(); BattleSession.commands.playCard('guard', 'self'); await drain();
    set$extraTurn(true); BattleSession.commands.endTurn(); const s = await drain();
    expect(g.hp).toBe(50); expect(s.turn).toBe(2); expect(s.pdef.guard).toBe(false);
  });
  it('时光符文不把本回合格挡延到新回合', async () => {
    start(); BattleSession.commands.playCard('guard', 'self'); await drain();
    applyRuneFlag('time'); BattleSession.commands.endTurn(); const s = await drain();
    expect(s.pdef.guard).toBe(false);
  });
});
