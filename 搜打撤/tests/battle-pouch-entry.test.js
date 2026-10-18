import { showBattleCardResults } from '../game/src/battle/view/battle.card-results.js';
// Canonical hosted card through the real battle session; no browser state is used.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 20, battleTurnDraw: 0, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };
function makeGame(cards) {
  return { ownedCards: cards.map((card, i) => ({ uid: `runtime-${i}`, card: { ...card }, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {}, };
}
async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }



it('存囊法术不进入普通初手，不能绕过锦囊直接释放，锦囊仍可正常施放', async () => {
  const game = makeGame([canonical('tt7-stratagem'),canonical('tt3-thunderblast')]);
  game.ownedCards[1].stored=1; game.ownedCards[1].pouchOf='tt7-stratagem';
  BattleSession.start(game,[{id:'foe',name:'靶子',hp:1000,atk:1,behavior:'strike'}],{isBoss:false});
  expect(R.hand).toEqual(['runtime-0']);
  BattleSession.commands.playCard('runtime-1',0); await settle();
  expect(R.foes[0].hp).toBe(1000);
  BattleSession.commands.playCard('runtime-0','any'); await settle();
  expect(R.discovering.options.map(c=>c.pouchUid)).toEqual(['runtime-1']);
  BattleSession.commands.pickDiscover(0); await settle();
  expect(R.foes[0].hp).toBe(993);
  const stage = document.createElement('div');
  const overlay = document.createElement('div'); overlay.id = 'overlay'; overlay.append(stage);
  showBattleCardResults(stage, R.cardAnims);
  expect(stage.textContent).toContain('法师锦囊 · 取出施放');
  expect(stage.textContent).not.toContain('获得卡牌 · 置入手牌');
  expect(game.ownedCards.some(o=>o.uid==='runtime-1')).toBe(false);
  BattleSession.commands.pickDiscover(0); await settle();
  expect(R.foes[0].hp).toBe(993);
});
it.each([{stored:1},{pouchOf:'tt7-stratagem'},{stored:1,pouchOf:'tt7-stratagem'}])('容器位置标记%j独立阻止初手；随身同名牌保留', flags => {
  const game=makeGame([canonical('tt7-stratagem'),canonical('tt3-thunderblast'),canonical('tt3-thunderblast')]);
  Object.assign(game.ownedCards[1],flags);
  BattleSession.start(game,[{id:'foe',name:'靶子',hp:1000,atk:1,behavior:'strike'}],{isBoss:false});
  expect(R.hand).toEqual(['runtime-0','runtime-2']);
  expect(game.ownedCards).toHaveLength(3);
  expect(game.ownedCards[1]).toMatchObject(flags);
});

it.each(['manual','automatic','nest'])('首脑%s入口排除容器卡，保留普通同名卡及安全格规则', mode => {
  const game=makeGame([canonical('tt7-stratagem'),canonical('tt3-thunderblast'),canonical('tt3-thunderblast')]);
  Object.assign(game.ownedCards[1],{stored:1,pouchOf:'tt7-stratagem'});
  game.ownedCards[2].safe=true;
  R.set$lastDeckSel(['runtime-1','runtime-2']);
  BattleSession.start(game,[{id:'foe',name:'靶子',hp:1000,atk:1,behavior:'strike'}],{isBoss:true,directBossStart:mode==='automatic',nest:mode==='nest'});
  expect(R.selPool.map(o=>o.uid)).toEqual(['runtime-0','runtime-2']);
  if(mode==='manual') {
    BattleSession.commands.selectDeckCard('runtime-1');
    expect(R.sel.has('runtime-1')).toBe(false);
    BattleSession.commands.selectDeckCard('runtime-0');
    BattleSession.commands.confirmDeck();
  }
  expect(R.selectingDeck).toBe(false);
  expect(R.hand).not.toContain('runtime-1');
  expect(R.hand).toContain('runtime-2');
});
