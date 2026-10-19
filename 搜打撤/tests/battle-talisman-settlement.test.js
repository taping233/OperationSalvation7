// FB040: real boss Session and bag settlement; storage/reward shells are isolated.
// pocketAdd mirrors the existing name/count aggregator without loading the full bag UI.
import {expect,it,vi} from 'vitest';
const s=vi.hoisted(()=>({game:{}}));
vi.mock('../game/src/run/game.session.js',()=>({game:s.game,getActiveSlot:()=>null,saveGame:()=>true,createRunSavePayload:()=>({}),setBattleSettlementPending(){},clearBattleSettlementPending(){},doDeath(){}}));
vi.mock('../game/src/run/game.run.js',()=>({showRunTransition:async()=>{}}));
window.SDT={Icons:{img:()=>'',TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},UI:{log(){},hideOverlay(){},refresh(){},act(){},showOverlay(){}},MAP:{rules:{battleEnergy:99,battleHandMax:20,bossDeckSize:15,starterSha:0,battleStartDraw:20,battleTurnDraw:0,diceSides:6},items:{}},Meta:{track(){}},Base:{data:{ammoTaught:true},recordEggBattle(){},save(){}},Chests:{rollDrops:()=>[],dropText:()=>'',open(){},restore(_game,_saved,done){done();return true;}},Battle:{presentVictory:async()=>{}}};

await import('../game/src/cards/cards.js');const C=window.SDT.Cards; C.ensureSha();C.ensureStarters();C.ensureTabletop();C.ensureDmgTypes();C.ensureEffectFields();
const {BattleSession}=await import('../game/src/battle/core/battle.core.js');const R=await import('../game/src/battle/runtime/battle.runtime.js');
const {bagSlots}=await import('../game/src/hub/game.bag.bridge.js');
bagSlots.pocketAdd=card=>{const p=s.game.usedPocket.find(p=>p.card.name===card.name);if(p)p.count++;else s.game.usedPocket.push({card:{...card},count:1});};
const {bindBagMixins}=await import('../game/src/hub/game.bag.settle.js');
bindBagMixins();

it('灵符自动装配后战胜结算只入消耗区一次，同类未选卡保留', async () => {
  vi.useFakeTimers();
  try {
    const talisman = C.all().find(c => c.id === 'tt7-talisman');
    const eye = C.all().find(c => c.id === 'tt3-chaos-eye');
    Object.assign(s.game, {
      ownedCards: [
        { uid: 'talisman', card: { ...talisman } },
        { uid: 'unselected', card: { ...talisman } },
        { uid: 'eye', card: { ...eye } },
        { uid: 'kill', card: { id: 'kill', name: '终结', type: '武术', cost: 0, dmg: 999, dmgType: 'fixed', desc: '造成999点固定伤害。' } },
      ],
      usedPocket: [], hp: 100, maxHp: 100, atk: 5, coins: 0, spellPower: 0,
      myClass: '战士', state: 'idle', battleActive: false, seed: 'talisman',
      discoveredPairs: new Set(), visited: {}, layerIdx: 0, trackPos: 1,
      logs: [], log(message) { this.logs.push(message); }, heal() {}, addItem() {},
    });
    window.SDT.MAP.rules.bossDeckSize = 3;
    BattleSession.start(s.game, [{ id: 'target', name: '靶', hp: 20, atk: 5 }], { isBoss: true });
    for (const uid of ['talisman', 'eye', 'kill']) BattleSession.commands.selectDeckCard(uid);
    BattleSession.commands.confirmDeck();
    await vi.advanceTimersByTimeAsync(1000);
    expect(R.consumed).toEqual(['talisman']);
    expect(R.hand).toContain('kill');
    // Settlement receives the same UID through both lists only once.
    R.played.push('talisman');
    BattleSession.commands.playCard('kill', 0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.game.battleActive).toBe(false);
    expect(s.game.usedPocket.filter(p => p.card.id === talisman.id)).toMatchObject([{ count: 1 }]);
    expect(s.game.ownedCards.map(o => o.uid)).toEqual(expect.arrayContaining(['unselected', 'eye']));
    expect(s.game.ownedCards.some(o => o.uid === 'talisman')).toBe(false);
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});
