import { afterEach, expect, it, vi } from 'vitest';

// Use the production renderer, catalog, inspection and command flow. Only the UI
// shell is supplied; jsdom clicks/keys are constructed input, not browser proof.
const actions = new Map();
const UI = { el:{}, act:(name, fn) => actions.set(name, fn), refresh(){} };
window.SDT = { UI, Icons:{ img:() => '', TYPE_ART:{} }, Sound:{ music(){}, sfx(){}, setDucked(){}, setBoss(){} },
  MAP:{ rules:{ battleEnergy:99, battleHandMax:99, bossDeckSize:15, starterSha:0, battleStartDraw:5, battleTurnDraw:2 }, items:{} } };
await import('../game/src/cards/cards.js');
const { BattleSession, findCard, infusionFuelReason, effCostOf, targetSide } = await import('../game/src/battle/core/battle.core.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const { renderInfusionSelection } = await import('../game/src/battle/view/battle.infusion-view.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const catalog = id => structuredClone(Cards.all().find(card => card.id === id));
const snapshot = () => BattleSession.getSnapshot();
let game;
function restore(n = 9) {
  const cards = Array.from({ length:n }, (_, i) => ({ uid:`u${i}`, card:i ? structuredClone(Cards.SHA) : catalog('tt3sp-bloodstorm') }));
  game = { ownedCards:cards, hp:99, maxHp:99, atk:4, spellPower:0, coins:0, myClass:'战士', state:'idle', battleActive:false,
    log:vi.fn(), heal(){}, addItem(){}, onBattleEnd(){} };
  window.SDT.game = game;
  expect(BattleSession.restore(game, { opts:{ isBoss:false, name:'existence regression' }, mode:'normal', turn:1, maxEnergy:99, energy:99,
    hand:cards.map(o => o.uid), drawPile:[], discard:[], grave:[], played:[], consumed:[], granted:[],
    pdef:{ shield:0, armor:0, guard:false }, pstat:{ status:{} },
    foes:[{ id:'foe', name:'敌人', hp:100, maxHp:100, atk:1, dead:false, status:{}, defense:{ shield:0, armor:0, guard:false } }],
    delayed:[], growth:{}, growthNames:[], zeroFeeUntil:[], cardOverrides:[] })).toBe(true);
  BattleSession.commands.beginInfusion('u0'); expect(snapshot().infusing.uid).toBe('u0');
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  UI.el = { overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled) actions.get(button.dataset.act)?.(button.dataset);
  });
  return game;
}
function render(fuelReason = infusionFuelReason, snap = snapshot()) {
  renderInfusionSelection({ UI, snapshot:snap, getSnapshot:snapshot, findCard, infusionFuelReason:fuelReason, effCostOf, targetSide,
    commands:BattleSession.commands, cardHTML:Cards.cardHTML,
    showBattleDecision(_title, html) { UI.el.ovBody.innerHTML = `<div class="battle-decision" data-decision-kind="infusion">${html}</div>`; } });
}
const control = act => UI.el.ovBody.querySelector(`[data-act="${act}"]`);
const key = () => document.dispatchEvent(new KeyboardEvent('keydown', { key:'1', bubbles:true, cancelable:true }));
const resources = () => { const { energy, hand, grave, consumed, discard, foes } = snapshot(); return { energy, hand, grave, consumed, discard, foes }; };
async function settle() {
  for (let i = 0; i < 200; i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    if (!snapshot().busy && !snapshot().actionQueueLength) return;
  }
  throw Error('Infusion action did not settle');
}
afterEach(async () => {
  if (game?.battleActive) BattleSession.commands.flee();
  document.dispatchEvent(new CustomEvent('sdt-overlay-close')); actions.clear(); await settle();
});

it.each([
  ['normal mixed nine', 9, true, 4, 90],
  ['normal stacked nine', 9, false, 1, 66],
  ['synthetic scale thirty (not a typical hand)', 30, false, 1, 528],
  ['synthetic scale sixty (not a typical hand)', 60, false, 1, 1953],
])('%s stops production eligibility at the first valid copy per stack', (_name, n, mixed, checks, reads) => {
  restore(n);
  if (mixed) for (const [i, id] of [[6,'tt3-fireball'],[7,'tt3-reshot'],[8,'tt2-shoot']]) game.ownedCards[i].card = catalog(id);
  // Exclude setup/snapshot acquisition; count one actual pane render. UID reads
  // include grouping as well as owned-card lookup comparisons, not just .find.
  const snap = snapshot(); let uidReads = 0;
  for (const entry of game.ownedCards) {
    const uid = entry.uid;
    Object.defineProperty(entry, 'uid', { configurable:true, enumerable:true, get(){ uidReads++; return uid; } });
  }
  const reason = vi.fn(infusionFuelReason); render(reason, snap);
  expect(reason).toHaveBeenCalledTimes(checks); expect(uidReads).toBe(reads);
  expect(UI.el.ovBody.querySelectorAll('.infusion-material')).toHaveLength(mixed ? 4 : 1);
  expect(UI.el.ovBody.textContent).toContain('已选 0/2');
  expect(control('btInfuseAdd').disabled).toBe(false); expect(control('btInfuseGo').disabled).toBe(true);
  expect([...UI.el.ovBody.querySelectorAll('[data-group-uid]')].every(node => node.dataset.groupUid !== 'u0')).toBe(true);
});

it('does not reduce all-forbidden scans or change their explanation', () => {
  restore(); for (const entry of game.ownedCards.slice(1)) entry.card.rules = { version:1, battle:{ fuelAllowed:false } };
  const reason = vi.fn(infusionFuelReason); render(reason);
  expect(reason).toHaveBeenCalledTimes(9); // Eight candidates and the original first-copy fallback.
  expect(control('btInfuseAdd').title).toBe('本牌无法用于注能'); expect(control('btInfuseAdjust').disabled).toBe(true);
});

it('keeps face/key add-full-remove semantics and reads same-object mixed-copy rules before rerender', () => {
  restore(); render(); const before = resources();
  BattleSession.commands.selectInfusion('u0'); expect(snapshot().infusing.picked).toEqual([]); // Self is never fuel.
  control('btInfuseAdjust').click(); key(); expect(snapshot().infusing.picked).toEqual(['u1','u2']);
  render(); expect(control('btInfuseAdd').disabled).toBe(true); expect(control('btInfuseAdjust').disabled).toBe(false);
  key(); expect(snapshot().infusing.picked).toEqual(['u2']);
  for (const i of [1,3]) game.ownedCards[i].card.rules = { version:1, battle:{ fuelAllowed:false } };
  key(); expect(snapshot().infusing.picked).toEqual(['u2','u4']);
  game.ownedCards[2].card.rules = { version:1, battle:{ fuelAllowed:false } };
  key(); expect(snapshot().infusing.picked).toEqual(['u4']); // Previously selected, now illegal: still removable.
  expect(resources()).toEqual(before);
});

it('short-circuits the second consumer on current face/key input without retaining its answer', () => {
  restore(); const reason = vi.fn(infusionFuelReason); render(reason); reason.mockClear();
  key(); expect(reason.mock.calls).toEqual([['u1'],['u1']]); // Existence, then the actual add search.
  expect(snapshot().infusing.picked).toEqual(['u1']);
  reason.mockClear(); game.ownedCards[2].card.rules = { version:1, battle:{ fuelAllowed:false } };
  control('btInfuseAdjust').click();
  expect(reason.mock.calls).toEqual([['u2'],['u3'],['u2'],['u3']]); expect(snapshot().infusing.picked).toEqual(['u1','u3']);
  reason.mockClear(); key();
  expect(reason.mock.calls).toEqual([['u2'],['u4']]); expect(snapshot().infusing.picked).toEqual(['u3']);
});

it('ignores removed copies and rechecks transformed/overridden fuel on the next input', () => {
  restore(); render();
  runtime.set$hand(runtime.hand.filter(uid => uid !== 'u1'));
  runtime.set$shaTransform('missing transform fixture'); key(); expect(snapshot().infusing.picked).toEqual([]);
  const fireball = catalog('tt3-fireball');
  runtime.cardOverrides.set('u2', fireball); key(); expect(snapshot().infusing.picked).toEqual(['u2']);
  fireball.rules = { version:1, battle:{ fuelAllowed:false } }; key(); expect(snapshot().infusing.picked).toEqual([]);
  runtime.set$shaTransform(null); key(); expect(snapshot().infusing.picked).toEqual(['u3']);
});

it.each(['owned','granted','override'])('repairs later legacy %s copies during full raw projection despite early eligibility success', kind => {
  restore();
  const canonical = Cards.TABLETOP10.find(card => card.id === 'tt7-thundergrudge'); expect(canonical.rules).toBeTruthy();
  for (const i of [1,2,3]) game.ownedCards[i].card = { ...structuredClone(canonical), dmg:1, dmgType:'attack', rules:{ old:true } };
  const repairTargets = game.ownedCards.slice(1, 4).map(entry => entry.card);
  if (kind === 'granted') runtime.granted.push(game.ownedCards.splice(3, 1)[0]);
  if (kind === 'override') {
    const replacement = structuredClone(repairTargets[2]);
    runtime.cardOverrides.set('u3', replacement); repairTargets[2] = replacement;
  }
  const legacy = repairTargets[2];
  // Keep only the legacy stack, source and first valid fuel; later legacy copies
  // share the same visual group and must be repaired even though some skips them.
  runtime.set$hand(['u0','u1','u2','u3']);
  const reason = vi.fn(infusionFuelReason); render(reason);
  expect(reason.mock.calls).toEqual([['u1']]);
  for (const card of repairTargets) expect(card).toMatchObject({ dmg:canonical.dmg, dmgType:canonical.dmgType, rules:canonical.rules });
  expect(legacy.rules).not.toBe(canonical.rules);
  // A later command/query repairs again. No provenance or eligibility cache is
  // retained; the presentation does not promise eager side effects on unused UIDs.
  legacy.rules = { old:true }; legacy.dmg = 1;
  BattleSession.commands.selectInfusion('u3');
  expect(snapshot().infusing.picked).toEqual(['u3']); expect(legacy.rules).toEqual(canonical.rules); expect(legacy.dmg).toBe(canonical.dmg);
});

it('revalidates every selected UID at confirmation, then spends only the valid replacement once', async () => {
  restore(); render(); const before = resources();
  control('btInfuseAdd').click(); control('btInfuseAdd').click(); render();
  game.ownedCards[2].card.rules = { version:1, battle:{ fuelAllowed:false } };
  control('btInfuseGo').click();
  expect(snapshot().infusing.picked).toEqual(['u1']); expect(resources()).toEqual(before);
  key(); expect(snapshot().infusing.picked).toEqual(['u1','u3']); render();
  const confirm = control('btInfuseGo'); confirm.click(); confirm.click(); await settle();
  expect(snapshot().infusing).toBeNull(); expect(runtime.consumed).toEqual(['u1','u3']);
  expect(runtime.hand).toContain('u2'); expect(runtime.hand).not.toContain('u0');
  expect(runtime.energy).toBe(before.energy - effCostOf(game.ownedCards[0].card, 'u0'));
  expect(runtime.infuseFuels).toBe(2);
});
