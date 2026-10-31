import { connectSdtFixture } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const H = vi.hoisted(() => ({ game:{}, room:2, update:vi.fn(), finish:vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({ game:H.game, getActiveSlot:() => 1,
  saveGame:() => true, MAP:{ rules:{ starterSha:3 } }, MODES:{}, bagCap:() => 16, usedSlots:() => 0,
  curLayer:() => null, enterLayer(){}, newUid:() => 'new', scaledEnemy:value => value }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub(){} }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx:{}, _set_cardPageOpen(){} }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({ FIRE_RESTORABLE:() => true, consumeCurrentCell(){}, enterNode(){},
  finishInstant(){}, grantEventCard(){}, nodeOpt(){}, nodeShell(){}, openFixedRewardsOnCell(){}, openPocketRestore(){}, openShop(){} }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage:{ readIdentity:() => ({ ok:true, value:{ runId:'run-one' } }) } }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun(){}, readSettlementReceipt(){}, recoverSlot(){} }));
vi.mock('../game/src/hub/extraction.commands.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createExtractionCommands:ports => ({ ...actual.createExtractionCommands(ports), updateCards:H.update, finish:H.finish }) };
});
const a = { id:'same', name:'同名招式', type:'法术', rarity:'古朴', value:2 };
const b = { ...a, rarity:'史诗', value:9 };
const rows = () => [{ card:{ ...a }, count:1, variantKey:'v1' }, { card:{ ...b }, count:1, variantKey:'v2' }];
const key = variant => JSON.stringify(['same', variant, null]);
let resumeExtraction, handlers, UI;
beforeEach(async () => {
  vi.resetModules();
  for (const name of Object.keys(H.game)) delete H.game[name];
  Object.assign(H.game, { runActive:true, ownedCards:rows().map(s => ({ ...s, brought:true })), inventory:[],
    usedPocket:[], mode:'standard', layerIdx:1, turn:1, elapsed:0, coins:0, hp:20 });
  H.room = 2;
  H.update.mockReset().mockResolvedValue({ ok:false, code:'TEST_STOP' });
  H.finish.mockReset().mockResolvedValue({ ok:false, code:'TEST_STOP' });
  handlers = {};
  document.body.innerHTML = '<div id="overlay"><main id="ovBody"></main></div>';
  UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') },
    log:vi.fn(), refresh(){}, registerHelp(){}, helpBtn:() => '', act:(name, fn) => { handlers[name] = fn; },
    showOverlay:(_title, html) => { UI.el.ovBody.innerHTML = html; } };
  await connectSdtFixture({ UI, Icons:{rich:html=>html}, Base:{ isSha:() => false, stashRoom:() => H.room, stashCap:() => 25,
    stashUsed:() => 25 - H.room }, Meta:{ addXpToProgress(){} },
    Cards:{ cardHTML:card => card.name, rarityOf:card => card.rarity, sellPrice:card => card.value },
    Sound:{ sfx(){}, music(){} } });
  ({ resumeExtraction } = await import('../game/src/run/game.run.altar.js'));
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
const open = (modern = true) => {
  const pending = { version:1, runId:'run-one', phase:'organizing', requestSeq:0,
    remainingCards:rows(), keptPocket:[], totalPocketCount:0, lostPocketCount:0, resources:{ wood:0, rations:0 },
    ...(modern ? { sourceIdentityVersion:1 } : {}) };
  expect(resumeExtraction(pending).ok).toBe(true);
};

it('single-row deposit preserves the selected source variant after visual rarity sorting', async () => {
  open();
  expect(UI.el.ovBody.querySelector('[data-act=exStash]').dataset.i).toBe('1');
  await handlers.exStash({ i:'1' });
  expect(H.update).toHaveBeenCalledWith([{ name:b.name, count:1, sourceKey:key('v2') }], 'run-one', 1);
});
it('all deposit sends each same-name source identity separately', async () => {
  open(); await handlers.exAll();
  expect(H.update).toHaveBeenCalledWith([
    { name:a.name, count:1, sourceKey:key('v1') }, { name:b.name, count:1, sourceKey:key('v2') },
  ], 'run-one', 1);
});
it('smart deposit chooses the actual highest-value source variant when only one slot is available', async () => {
  H.room = 1; open(); await handlers.exSmart();
  expect(H.update).toHaveBeenCalledWith([{ name:b.name, count:1, sourceKey:key('v2') }], 'run-one', 1);
});
it('legacy drafts preserve name-only request payloads', async () => {
  open(false); await handlers.exStash({ i:'0' });
  expect(H.update).toHaveBeenCalledWith([{ name:a.name, count:1 }], 'run-one', 1);
});
it('finish confirmation detects source-variant changes with unchanged names, IDs and counts', async () => {
  open(); handlers.exFinish();
  H.game.pendingExtraction.remainingCards[1].variantKey = 'replacement';
  await handlers.exConfirmFinish();
  expect(H.finish).not.toHaveBeenCalled();
  expect(UI.el.ovBody.textContent).toContain('待入库卡牌已变化');
});
